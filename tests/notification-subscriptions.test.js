import assert from "node:assert/strict";
import test from "node:test";
import {
  handleStatus,
  handleSubscribe,
  handleUnsubscribe,
  normalizePushSubscription,
} from "../server/notifications/subscriptions.js";
import { getSupabaseServiceHeaders } from "../server/supabase-server.js";

const env = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_server_key",
};

function request(body, token = "jwt-user") {
  return { headers: { authorization: `Bearer ${token}` }, body };
}

function response() {
  return {
    statusCode: 0,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

function jsonResponse(body, ok = true, status = ok ? 200 : 500) {
  return { ok, status, json: async () => body };
}

function validSubscription(endpoint = "https://push.example/device-a") {
  return { endpoint, keys: { p256dh: "public-key", auth: "auth-key" } };
}

function authenticatedFetch(userId, requests, endpointRows = []) {
  return async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).includes("/auth/v1/user")) return jsonResponse({ id: userId });
    if (options.method === "POST" || options.method === "PATCH" || options.method === "DELETE") {
      return jsonResponse(null);
    }
    return jsonResponse(endpointRows);
  };
}

test("opaque Supabase server keys are apikey-only outside JWT verification", () => {
  assert.deepEqual(getSupabaseServiceHeaders(env), { apikey: "sb_secret_server_key" });
});

test("subscribe derives ownership from JWT and ignores client user_id", async () => {
  const requests = [];
  const reply = response();
  await handleSubscribe(
    request({ user_id: "attacker", subscription: validSubscription() }),
    reply,
    { env, fetchImpl: authenticatedFetch("user-a", requests) }
  );
  assert.equal(reply.statusCode, 200);
  const write = requests.find((item) => item.options.method === "POST");
  const payload = JSON.parse(write.options.body);
  assert.equal(payload.user_id, "user-a");
  assert.equal(payload.endpoint, "https://push.example/device-a");
});

test("an endpoint owned by another account cannot be read or transferred", async () => {
  const requests = [];
  const reply = response();
  await handleSubscribe(request({ subscription: validSubscription() }), reply, {
    env,
    fetchImpl: authenticatedFetch("user-b", requests, [{ id: "sub-a", user_id: "user-a" }]),
  });
  assert.equal(reply.statusCode, 409);
  assert.equal(reply.payload.status, "subscription_owner_conflict");
  assert.equal(requests.some((item) => ["POST", "PATCH"].includes(item.options.method)), false);
});

test("an existing endpoint is updated only under its authenticated owner", async () => {
  const requests = [];
  const reply = response();
  await handleSubscribe(request({ subscription: validSubscription() }), reply, {
    env,
    fetchImpl: authenticatedFetch("user-a", requests, [{ id: "sub-a", user_id: "user-a" }]),
  });
  const update = requests.find((item) => item.options.method === "PATCH");
  assert.match(update.url, /user_id=eq\.user-a/);
  assert.equal(reply.statusCode, 200);
});

test("a simultaneous insert conflict for the same owner is recovered idempotently", async () => {
  const requests = [];
  let subscriptionReads = 0;
  const reply = response();
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).includes("/auth/v1/user")) return jsonResponse({ id: "user-a" });
    if (!options.method && String(url).includes("push_subscriptions")) {
      subscriptionReads += 1;
      return jsonResponse(subscriptionReads === 1 ? [] : [{ id: "winner", user_id: "user-a" }]);
    }
    if (options.method === "POST") return jsonResponse({ code: "23505" }, false, 409);
    if (options.method === "PATCH") return jsonResponse(null);
    return jsonResponse(null);
  };
  await handleSubscribe(request({ subscription: validSubscription() }), reply, { env, fetchImpl });
  assert.equal(reply.statusCode, 200);
  assert.equal(requests.filter((item) => item.options.method === "POST").length, 1);
  assert.equal(requests.filter((item) => item.options.method === "PATCH").length, 1);
});

test("insert-conflict recovery cannot transfer another user's endpoint", async () => {
  let subscriptionReads = 0;
  const reply = response();
  const fetchImpl = async (url, options = {}) => {
    if (String(url).includes("/auth/v1/user")) return jsonResponse({ id: "user-b" });
    if (!options.method && String(url).includes("push_subscriptions")) {
      subscriptionReads += 1;
      return jsonResponse(subscriptionReads === 1 ? [] : [{ id: "winner", user_id: "user-a" }]);
    }
    if (options.method === "POST") return jsonResponse({ code: "23505" }, false, 409);
    throw new Error("another user's endpoint must not be patched");
  };
  await handleSubscribe(request({ subscription: validSubscription() }), reply, { env, fetchImpl });
  assert.equal(reply.statusCode, 409);
  assert.equal(reply.payload.status, "subscription_owner_conflict");
});

test("unsubscribe is scoped to the authenticated user and matching endpoint", async () => {
  const requests = [];
  const reply = response();
  await handleUnsubscribe(request({ endpoint: "https://push.example/user-a" }), reply, {
    env,
    fetchImpl: authenticatedFetch("user-b", requests),
  });
  const deletion = requests.find((item) => item.options.method === "DELETE");
  assert.match(deletion.url, /user_id=eq\.user-b/);
  assert.match(deletion.url, /endpoint=eq\.https%3A%2F%2Fpush\.example%2Fuser-a/);
  assert.equal(reply.statusCode, 200);
});

test("multiple device endpoints insert independently", async () => {
  const writes = [];
  for (const endpoint of ["https://push.example/laptop", "https://push.example/phone"]) {
    const requests = [];
    await handleSubscribe(request({ subscription: validSubscription(endpoint) }), response(), {
      env,
      fetchImpl: authenticatedFetch("user-a", requests),
    });
    writes.push(JSON.parse(requests.find((item) => item.options.method === "POST").options.body));
  }
  assert.deepEqual(writes.map((item) => item.endpoint), [
    "https://push.example/laptop",
    "https://push.example/phone",
  ]);
  assert.equal(writes.every((item) => item.user_id === "user-a"), true);
});

test("status returns no endpoint or subscription secret fields", async () => {
  const reply = response();
  await handleStatus(request({ endpoint: "https://push.example/device-a" }), reply, {
    env,
    fetchImpl: authenticatedFetch("user-a", [], [{ id: "sub-a" }]),
  });
  assert.deepEqual(reply.payload, { ok: true, status: "subscribed", registered: true });
  assert.equal(JSON.stringify(reply.payload).includes("p256dh"), false);
});

test("status lookup is scoped so User B cannot read User A's row", async () => {
  const requests = [];
  const reply = response();
  await handleStatus(request({ endpoint: "https://push.example/user-a" }), reply, {
    env,
    fetchImpl: authenticatedFetch("user-b", requests, []),
  });
  const lookup = requests.find((item) => item.url.includes("push_subscriptions"));
  assert.match(lookup.url, /user_id=eq\.user-b/);
  assert.deepEqual(reply.payload, { ok: true, status: "not_subscribed", registered: false });
});

test("malformed subscriptions are rejected before table access", async () => {
  const requests = [];
  const reply = response();
  await handleSubscribe(request({ subscription: { endpoint: "javascript:bad" } }), reply, {
    env,
    fetchImpl: authenticatedFetch("user-a", requests),
  });
  assert.equal(reply.statusCode, 400);
  assert.equal(normalizePushSubscription({ endpoint: "http://push.example", keys: { p256dh: "a", auth: "b" } }), null);
  assert.equal(requests.filter((item) => item.url.includes("push_subscriptions")).length, 0);
});
