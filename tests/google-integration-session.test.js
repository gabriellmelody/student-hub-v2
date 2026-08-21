import assert from "node:assert/strict";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createClassroomSessionCookie, getValidClassroomSession } from "../server/google-classroom/_session.js";
import { createCalendarSessionCookie, getValidCalendarSession } from "../server/google-calendar/_session.js";
import disconnectClassroom from "../server/google-classroom/disconnect.js";
import disconnectCalendar from "../server/google-calendar/disconnect.js";
import classroomCallback from "../server/google-classroom/callback.js";
import {
  createGoogleOAuthState,
  loadGoogleIntegration,
  saveGoogleIntegration,
  verifyGoogleOAuthState,
} from "../server/google-integration-vault.js";

const SILENT_LOG = { info() {}, error() {}, warn() {} };

const ENV = {
  SUPABASE_URL: "https://supabase.example",
  SUPABASE_SERVICE_ROLE_KEY: "server-service-role-test-key",
  GOOGLE_INTEGRATION_VAULT_SECRET: "test-vault-secret-with-more-than-thirty-two-characters",
  GOOGLE_CLASSROOM_CLIENT_ID: "google-client-id",
  GOOGLE_CLASSROOM_CLIENT_SECRET: "google-client-secret",
};
const ORIGINAL_SESSION_SECRET = process.env.STUDENT_HUB_SESSION_SECRET;
process.env.STUDENT_HUB_SESSION_SECRET = "test-session-secret-with-at-least-thirty-two-characters";
test.after(() => {
  if (ORIGINAL_SESSION_SECRET === undefined) delete process.env.STUDENT_HUB_SESSION_SECRET;
  else process.env.STUDENT_HUB_SESSION_SECRET = ORIGINAL_SESSION_SECRET;
});

function createBackend({ refreshResponse } = {}) {
  const rows = new Map();
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const value = String(url);
    calls.push({ url: value, options });
    if (value.endsWith("/auth/v1/user")) {
      const token = String(options.headers?.Authorization || "").replace(/^Bearer /, "");
      const userId = token.startsWith("daylo-") ? token.slice(6) : "";
      return { ok: Boolean(userId), status: userId ? 200 : 401, json: async () => userId ? { id: userId } : {} };
    }
    if (value.includes("/rest/v1/google_integration_tokens")) {
      if (options.method === "POST") {
        const row = JSON.parse(options.body);
        rows.set(`${row.user_id}:${row.integration}`, row);
        return { ok: true, status: 201, json: async () => [row] };
      }
      const parsed = new URL(value);
      const userId = String(parsed.searchParams.get("user_id") || "").replace(/^eq\./, "");
      const integration = String(parsed.searchParams.get("integration") || "").replace(/^eq\./, "");
      const key = `${userId}:${integration}`;
      if (options.method === "DELETE") {
        rows.delete(key);
        return { ok: true, status: 204, json: async () => null };
      }
      return { ok: true, status: 200, json: async () => rows.has(key) ? [rows.get(key)] : [] };
    }
    if (value === "https://oauth2.googleapis.com/token") {
      return refreshResponse || { ok: true, status: 200, json: async () => ({ access_token: "access-new", expires_in: 3600 }) };
    }
    throw new Error(`Unexpected URL: ${value}`);
  };
  return { rows, calls, fetchImpl };
}

function request(userId, cookie = "") {
  return { headers: { authorization: `Bearer daylo-${userId}`, ...(cookie ? { cookie } : {}) } };
}

function responseRecorder() {
  return {
    headers: new Map(), statusCode: 0, payload: null,
    setHeader(name, value) { this.headers.set(name.toLowerCase(), value); },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return payload; },
  };
}

function session(integration, overrides = {}) {
  const account = { accountId: `${integration}-google-id`, accountEmail: `${integration}@school.edu` };
  const tokens = { access_token: "access-old", refresh_token: "refresh-stable", expires_in: 3600, ...overrides };
  return integration === "classroom"
    ? createClassroomSessionCookie(tokens, null, account).session
    : createCalendarSessionCookie(tokens, null, account).session;
}

function encryptRawVaultPayload(value, secret = ENV.GOOGLE_INTEGRATION_VAULT_SECRET) {
  const iv = randomBytes(12);
  const key = createHash("sha256").update(`token-vault:${secret}`).digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

test("no vault row is a clean disconnected state for both providers", async () => {
  const backend = createBackend();
  assert.equal(await loadGoogleIntegration("user-a", "classroom", { env: ENV, fetchImpl: backend.fetchImpl, log: SILENT_LOG }), null);
  const classroom = await getValidClassroomSession(request("user-a"), { env: ENV, fetchImpl: backend.fetchImpl });
  const calendar = await getValidCalendarSession(request("user-a"), responseRecorder(), { env: ENV, fetchImpl: backend.fetchImpl });
  assert.equal(classroom.status, "classroom_account_reconnect_required");
  assert.equal(calendar.status, "calendar_account_reconnect_required");
});

test("opaque Supabase secret keys use apikey without an invalid Bearer header", async () => {
  let headers;
  const env = { ...ENV, SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test-server-key" };
  await loadGoogleIntegration("user-a", "classroom", {
    env,
    log: SILENT_LOG,
    fetchImpl: async (_url, options) => {
      headers = options.headers;
      return { ok: true, status: 200, json: async () => [] };
    },
  });
  assert.equal(headers.apikey, env.SUPABASE_SERVICE_ROLE_KEY);
  assert.equal(headers.Authorization, undefined);
});

test("vault query and configuration failures are classified separately", async () => {
  await assert.rejects(
    loadGoogleIntegration("user-a", "classroom", {
      env: ENV,
      log: SILENT_LOG,
      fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ message: "Invalid JWT" }) }),
    }),
    (error) => error.code === "vault_query_failed" && error.category === "credential_rejected"
  );
  await assert.rejects(
    loadGoogleIntegration("user-a", "classroom", {
      env: { ...ENV, SUPABASE_SERVICE_ROLE_KEY: "   " },
      log: SILENT_LOG,
      fetchImpl: async () => assert.fail("fetch should not run"),
    }),
    (error) => error.code === "vault_configuration_failed"
  );
});

test("vault decryption and stored payload failures remain distinct", async () => {
  const backend = createBackend();
  await saveGoogleIntegration("user-a", "classroom", session("classroom"), { env: ENV, fetchImpl: backend.fetchImpl, log: SILENT_LOG });
  await assert.rejects(
    loadGoogleIntegration("user-a", "classroom", {
      env: { ...ENV, GOOGLE_INTEGRATION_VAULT_SECRET: "a-different-secret-that-is-still-at-least-thirty-two-characters" },
      fetchImpl: backend.fetchImpl,
      log: SILENT_LOG,
    }),
    (error) => error.code === "vault_decrypt_failed"
  );

  const row = backend.rows.get("user-a:classroom");
  row.encrypted_payload = encryptRawVaultPayload("not-json");
  await assert.rejects(
    loadGoogleIntegration("user-a", "classroom", { env: ENV, fetchImpl: backend.fetchImpl, log: SILENT_LOG }),
    (error) => error.code === "vault_payload_invalid" && error.category === "json_invalid"
  );
  row.encrypted_payload = encryptRawVaultPayload(JSON.stringify({ account_email: "missing-token@example.com" }));
  await assert.rejects(
    loadGoogleIntegration("user-a", "classroom", { env: ENV, fetchImpl: backend.fetchImpl, log: SILENT_LOG }),
    (error) => error.code === "vault_payload_invalid" && error.category === "session_invalid"
  );
});

test("vault ownership isolates users while the same user works across devices", async () => {
  const backend = createBackend();
  await saveGoogleIntegration("user-a", "classroom", session("classroom"), { env: ENV, fetchImpl: backend.fetchImpl });
  const laptop = await getValidClassroomSession(request("user-a"), { env: ENV, fetchImpl: backend.fetchImpl });
  const phone = await getValidClassroomSession(request("user-a"), { env: ENV, fetchImpl: backend.fetchImpl });
  const otherUser = await getValidClassroomSession(request("user-b"), { env: ENV, fetchImpl: backend.fetchImpl });
  assert.equal(laptop.ok, true);
  assert.equal(phone.session.account_email, "classroom@school.edu");
  assert.equal(otherUser.status, "classroom_account_reconnect_required");
  assert.equal(otherUser.session, undefined);
});

test("Classroom and Calendar records remain independent and replace atomically", async () => {
  const backend = createBackend();
  await saveGoogleIntegration("user-a", "classroom", session("classroom"), { env: ENV, fetchImpl: backend.fetchImpl });
  await saveGoogleIntegration("user-a", "calendar", session("calendar"), { env: ENV, fetchImpl: backend.fetchImpl });
  await saveGoogleIntegration("user-a", "classroom", { ...session("classroom"), account_email: "new@school.edu" }, { env: ENV, fetchImpl: backend.fetchImpl });
  assert.equal((await loadGoogleIntegration("user-a", "classroom", { env: ENV, fetchImpl: backend.fetchImpl })).session.account_email, "new@school.edu");
  assert.equal((await loadGoogleIntegration("user-a", "calendar", { env: ENV, fetchImpl: backend.fetchImpl })).session.account_email, "calendar@school.edu");
});

test("expired vault tokens refresh and preserve an omitted refresh token", async () => {
  const backend = createBackend();
  await saveGoogleIntegration("user-a", "classroom", session("classroom", { expires_in: 60 }), { env: ENV, fetchImpl: backend.fetchImpl });
  await saveGoogleIntegration("user-a", "calendar", session("calendar", { expires_in: 60 }), { env: ENV, fetchImpl: backend.fetchImpl });
  const classroom = await getValidClassroomSession(request("user-a"), { env: ENV, fetchImpl: backend.fetchImpl });
  const calendar = await getValidCalendarSession(request("user-a"), responseRecorder(), { env: ENV, fetchImpl: backend.fetchImpl });
  assert.equal(classroom.status, "classroom_session_refreshed");
  assert.equal(calendar.status, "calendar_session_refreshed");
  assert.equal((await loadGoogleIntegration("user-a", "classroom", { env: ENV, fetchImpl: backend.fetchImpl })).session.refresh_token, "refresh-stable");
  assert.equal((await loadGoogleIntegration("user-a", "calendar", { env: ENV, fetchImpl: backend.fetchImpl })).session.refresh_token, "refresh-stable");
});

test("temporary refresh failure retains vault data while invalid_grant requires reconnect", async () => {
  const temporary = createBackend({ refreshResponse: { ok: false, status: 503, json: async () => ({ error: "temporarily_unavailable" }) } });
  await saveGoogleIntegration("user-a", "classroom", session("classroom", { expires_in: 60 }), { env: ENV, fetchImpl: temporary.fetchImpl });
  const transient = await getValidClassroomSession(request("user-a"), { env: ENV, fetchImpl: temporary.fetchImpl });
  assert.deepEqual([transient.status, transient.connected], ["classroom_refresh_temporarily_unavailable", true]);
  assert.ok(await loadGoogleIntegration("user-a", "classroom", { env: ENV, fetchImpl: temporary.fetchImpl }));

  const rejected = createBackend({ refreshResponse: { ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) } });
  await saveGoogleIntegration("user-a", "calendar", session("calendar", { expires_in: 60 }), { env: ENV, fetchImpl: rejected.fetchImpl });
  const invalid = await getValidCalendarSession(request("user-a"), responseRecorder(), { env: ENV, fetchImpl: rejected.fetchImpl });
  assert.deepEqual([invalid.status, invalid.connected], ["calendar_session_reconnect_required", false]);
});

test("OAuth state binds the initiating user and rejects tampering or expiry", () => {
  const state = createGoogleOAuthState("user-a", "classroom", { env: ENV, now: 1_000_000 });
  assert.equal(verifyGoogleOAuthState(state, "classroom", { env: ENV, now: 1_001_000 }).userId, "user-a");
  assert.equal(verifyGoogleOAuthState(`${state}x`, "classroom", { env: ENV, now: 1_001_000 }), null);
  assert.equal(verifyGoogleOAuthState(state, "calendar", { env: ENV, now: 1_001_000 }), null);
  assert.equal(verifyGoogleOAuthState(state, "classroom", { env: ENV, now: 1_700_000 }), null);
});

test("disconnect deletes only the verified user's selected integration", async () => {
  const backend = createBackend();
  await saveGoogleIntegration("user-a", "classroom", session("classroom"), { env: ENV, fetchImpl: backend.fetchImpl });
  await saveGoogleIntegration("user-a", "calendar", session("calendar"), { env: ENV, fetchImpl: backend.fetchImpl });
  await saveGoogleIntegration("user-b", "classroom", session("classroom"), { env: ENV, fetchImpl: backend.fetchImpl });

  const originalFetch = globalThis.fetch;
  const originalEnv = process.env;
  globalThis.fetch = backend.fetchImpl;
  process.env = { ...process.env, ...ENV };
  try {
    await disconnectClassroom({ method: "POST", ...request("user-a") }, responseRecorder());
    assert.equal(await loadGoogleIntegration("user-a", "classroom", { env: ENV, fetchImpl: backend.fetchImpl }), null);
    assert.ok(await loadGoogleIntegration("user-a", "calendar", { env: ENV, fetchImpl: backend.fetchImpl }));
    assert.ok(await loadGoogleIntegration("user-b", "classroom", { env: ENV, fetchImpl: backend.fetchImpl }));
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

test("legacy cookies are detected but never assigned to the signed-in account", async () => {
  const backend = createBackend();
  const legacy = createClassroomSessionCookie({ access_token: "legacy-access", refresh_token: "legacy-refresh", expires_in: 3600 }, null, { accountId: "legacy", accountEmail: "legacy@school.edu" });
  const result = await getValidClassroomSession(request("user-a", legacy.cookie.split(";")[0]), { env: { ...ENV, STUDENT_HUB_SESSION_SECRET: "test-session-secret-with-at-least-thirty-two-characters" }, fetchImpl: backend.fetchImpl });
  assert.equal(result.status, "classroom_account_reconnect_required");
  assert.equal(result.legacyConnectionDetected, true);
  assert.equal(backend.rows.size, 0);
});

test("Classroom callback distinguishes vault writes from token exchange", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env;
  process.env = {
    ...process.env,
    ...ENV,
    GOOGLE_CLASSROOM_REDIRECT_URI: "http://localhost:5173",
    GOOGLE_OAUTH_ALLOWED_ORIGINS: "http://localhost:5173",
  };

  async function runCallback(writeOk) {
    globalThis.fetch = async (url, options = {}) => {
      const value = String(url);
      if (value.endsWith("/auth/v1/user")) {
        return { ok: true, status: 200, json: async () => ({ id: "user-a" }) };
      }
      if (value === "https://oauth2.googleapis.com/token") {
        return { ok: true, status: 200, json: async () => ({ access_token: "google-access", refresh_token: "google-refresh", expires_in: 3600 }) };
      }
      if (value === "https://openidconnect.googleapis.com/v1/userinfo") {
        return { ok: true, status: 200, json: async () => ({ sub: "google-user", email: "student@school.edu" }) };
      }
      if (value.includes("/rest/v1/google_integration_tokens")) {
        if (options.method === "POST") {
          return { ok: writeOk, status: writeOk ? 201 : 503, json: async () => writeOk ? [JSON.parse(options.body)] : { code: "PGRST000" } };
        }
        return { ok: true, status: 200, json: async () => [] };
      }
      throw new Error(`Unexpected callback URL: ${value}`);
    };

    const oauthState = createGoogleOAuthState("user-a", "classroom", { env: process.env });
    const response = responseRecorder();
    await classroomCallback({
      method: "POST",
      url: "/api/google-classroom/callback",
      headers: {
        authorization: "Bearer daylo-user-a",
        "content-type": "application/json",
        "x-requested-with": "XmlHttpRequest",
        origin: "http://localhost:5173",
      },
      body: { code: "valid-google-code", oauthState },
    }, response);
    return response;
  }

  try {
    const success = await runCallback(true);
    assert.equal(success.statusCode, 200);
    assert.equal(success.payload.status, "classroom_popup_session_created");

    const failure = await runCallback(false);
    assert.equal(failure.statusCode, 502);
    assert.equal(failure.payload.status, "vault_write_failed");
    assert.notEqual(failure.payload.status, "token_exchange_failed");
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

test("vault table and client boundary expose no token material", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260821_google_integration_token_vault.sql", import.meta.url), "utf8");
  assert.match(migration, /revoke all .* from anon/);
  assert.match(migration, /revoke all .* from authenticated/);
  assert.doesNotMatch(migration, /grant select|grant insert|grant update|grant delete/);
  const client = readFileSync(new URL("../src/utils/integrationAuthUtils.js", import.meta.url), "utf8");
  assert.doesNotMatch(client, /SERVICE_ROLE|refresh_token|access_token/);
  const vault = readFileSync(new URL("../server/google-integration-vault.js", import.meta.url), "utf8");
  assert.match(vault, /aes-256-gcm/);
  assert.match(vault, /SUPABASE_SERVICE_ROLE_KEY/);
});
