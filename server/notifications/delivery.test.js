import assert from "node:assert/strict";
import test from "node:test";
import { authorizeDeliveryRequest, deliverDueNotifications, handleDeliverDue, validateVapidConfig } from "./delivery.js";

const env = { SUPABASE_URL: "https://project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "server-secret",
  VITE_DAYLO_VAPID_PUBLIC_KEY: "B".repeat(80), DAYLO_VAPID_PRIVATE_KEY: "p".repeat(40),
  DAYLO_VAPID_SUBJECT: "mailto:notifications@daylo.app", DAYLO_NOTIFICATION_CRON_SECRET: "cron-secret" };
const candidate = { userId: "user-a", entityId: "task-a", type: "task_due_today", occurrenceKey: "task:task-a:due-today:2026-08-24", payload: { title: "Task due today", body: "Open DayLo", url: "/tasks" } };
const subscription = (id) => ({ id, user_id: "user-a", endpoint: `https://push.example/${id}`, p256dh: "key", auth: "auth" });
function response() { return { statusCode: 0, payload: null, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } }; }
function deliveryFetch(claims = [true]) { const requests = []; return { requests, fetchImpl: async (url, options = {}) => { requests.push({ url: String(url), options }); if (String(url).includes("/rpc/")) { const claimed = claims.shift(); return { ok: true, json: async () => claimed ? [{ id: `delivery-${requests.length}`, attempt_count: 1 }] : [] }; } return { ok: true, json: async () => null }; } }; }
function push(statusCode = 201) { const sent = []; return { sent, setVapidDetails() {}, async sendNotification(target, payload) { sent.push([target, JSON.parse(payload)]); if (statusCode !== 201) throw Object.assign(new Error("push failed"), { statusCode }); } }; }

test("cron authorization rejects missing and incorrect secrets and accepts the configured secret", () => {
  assert.equal(authorizeDeliveryRequest({ headers: {} }, env), false);
  assert.equal(authorizeDeliveryRequest({ headers: { authorization: "Bearer wrong" } }, env), false);
  assert.equal(authorizeDeliveryRequest({ headers: { authorization: "Bearer cron-secret" } }, env), true);
});

test("VAPID configuration is validated without exposing values", () => {
  assert.equal(validateVapidConfig(env).subject, env.DAYLO_VAPID_SUBJECT);
  assert.throws(() => validateVapidConfig({ ...env, DAYLO_VAPID_PRIVATE_KEY: "" }), /missing_daylo_vapid_private_key/);
  assert.throws(() => validateVapidConfig({ ...env, DAYLO_VAPID_SUBJECT: "not-contact" }), /invalid_daylo_vapid_subject/);
});

test("correct scheduler secret invokes delivery and returns bounded counts", async () => {
  const reply = response(); const transport = push(); const database = deliveryFetch([true]);
  await handleDeliverDue({ headers: { authorization: "Bearer cron-secret" } }, reply, { env, data: { candidates: [candidate], subscriptions: [subscription("mac")] }, webPushImpl: transport, fetchImpl: database.fetchImpl });
  assert.equal(reply.statusCode, 200); assert.deepEqual(reply.payload, { ok: true, candidates: 1, claimed: 1, sent: 1, failed: 0, staleRemoved: 0 });
  assert.doesNotMatch(JSON.stringify(reply.payload), /endpoint|p256dh|auth|task-a/);
});

test("missing scheduler secret is rejected before delivery configuration is read", async () => {
  const reply = response();
  await handleDeliverDue({ headers: {} }, reply, { env: { DAYLO_NOTIFICATION_CRON_SECRET: "cron-secret" } });
  assert.deepEqual([reply.statusCode, reply.payload], [401, { ok: false, status: "scheduler_unauthorized" }]);
});

test("one occurrence sends once per subscription and both devices coexist", async () => {
  const transport = push(); const database = deliveryFetch([true, true]);
  const summary = await deliverDueNotifications({ env, data: { candidates: [candidate], subscriptions: [subscription("mac"), subscription("phone")] }, webPushImpl: transport, fetchImpl: database.fetchImpl });
  assert.equal(summary.sent, 2); assert.equal(transport.sent.length, 2);
});

test("repeated and concurrent claims do not duplicate delivery", async () => {
  const transport = push(); const database = deliveryFetch([true, false]); const data = { candidates: [candidate], subscriptions: [subscription("mac")] };
  const first = await deliverDueNotifications({ env, data, webPushImpl: transport, fetchImpl: database.fetchImpl });
  const second = await deliverDueNotifications({ env, data, webPushImpl: transport, fetchImpl: database.fetchImpl });
  assert.equal(first.sent, 1); assert.equal(second.sent, 0); assert.equal(transport.sent.length, 1);
});

test("two concurrent scheduler runs send only the atomic claim winner", async () => {
  let claimed = false;
  const fetchImpl = async (url) => {
    if (String(url).includes("/rpc/")) {
      await new Promise((resolve) => setTimeout(resolve, 2));
      if (claimed) return { ok: true, json: async () => [] };
      claimed = true; return { ok: true, json: async () => [{ id: "delivery-one", attempt_count: 1 }] };
    }
    return { ok: true, json: async () => null };
  };
  const transport = push(); const data = { candidates: [candidate], subscriptions: [subscription("mac")] };
  const summaries = await Promise.all([
    deliverDueNotifications({ env, data, webPushImpl: transport, fetchImpl }),
    deliverDueNotifications({ env, data, webPushImpl: transport, fetchImpl }),
  ]);
  assert.equal(summaries.reduce((total, item) => total + item.sent, 0), 1);
  assert.equal(transport.sent.length, 1);
});

for (const statusCode of [404, 410]) test(`permanent ${statusCode} removes only the exact subscription`, async () => {
  const database = deliveryFetch([true]); const summary = await deliverDueNotifications({ env, data: { candidates: [candidate], subscriptions: [subscription("mac"), subscription("phone")] }, webPushImpl: push(statusCode), fetchImpl: database.fetchImpl });
  assert.equal(summary.staleRemoved, 1);
  const deletion = database.requests.find((item) => item.options.method === "DELETE");
  assert.match(deletion.url, /id=eq.mac/); assert.doesNotMatch(deletion.url, /phone/);
});

test("transient failures preserve subscriptions and schedule a bounded retry", async () => {
  const database = deliveryFetch([true]); const summary = await deliverDueNotifications({ env, now: new Date("2026-08-24T07:00:00Z"), data: { candidates: [candidate], subscriptions: [subscription("mac")] }, webPushImpl: push(503), fetchImpl: database.fetchImpl });
  assert.equal(summary.failed, 1); assert.equal(database.requests.some((item) => item.options.method === "DELETE"), false);
  const update = database.requests.find((item) => item.options.method === "PATCH");
  assert.equal(JSON.parse(update.options.body).status, "failed"); assert.match(JSON.parse(update.options.body).next_attempt_at, /2026-08-24T07:05/);
});
