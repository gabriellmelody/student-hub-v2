import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "crypto";

const INTEGRATIONS = new Set(["classroom", "calendar"]);
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;

function requiredEnv(env, name) {
  const value = String(env[name] || "").trim();
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

function encryptionKey(env, purpose) {
  const secret = requiredEnv(env, "GOOGLE_INTEGRATION_VAULT_SECRET");
  if (secret.length < 32) throw new Error("invalid_google_integration_vault_secret");
  return createHash("sha256").update(`${purpose}:${secret}`).digest();
}

function encryptJson(value, env, purpose) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(env, purpose), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function decryptJson(value, env, purpose) {
  const [iv, tag, encrypted] = String(value || "").split(".").map((part) => Buffer.from(part, "base64url"));
  if (!iv?.length || !tag?.length || !encrypted?.length) throw new Error("invalid_encrypted_payload");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(env, purpose), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8"));
}

function serviceHeaders(env, extras = {}) {
  const serviceKey = requiredEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...extras };
}

function vaultUrl(env, query = "") {
  return `${requiredEnv(env, "SUPABASE_URL").replace(/\/$/, "")}/rest/v1/google_integration_tokens${query}`;
}

export function readBearerToken(request) {
  const match = String(request.headers?.authorization || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export async function requireDayloUser(request, { env = process.env, fetchImpl = fetch } = {}) {
  const token = readBearerToken(request);
  if (!token) return { ok: false, status: "daylo_auth_required", statusCode: 401 };
  const response = await fetchImpl(`${requiredEnv(env, "SUPABASE_URL").replace(/\/$/, "")}/auth/v1/user`, {
    headers: { ...serviceHeaders(env), Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || typeof body?.id !== "string") {
    return { ok: false, status: "daylo_session_invalid", statusCode: 401 };
  }
  return { ok: true, userId: body.id };
}

export async function loadGoogleIntegration(userId, integration, { env = process.env, fetchImpl = fetch } = {}) {
  if (!INTEGRATIONS.has(integration)) throw new Error("invalid_integration");
  const query = `?user_id=eq.${encodeURIComponent(userId)}&integration=eq.${integration}&select=*`;
  const response = await fetchImpl(vaultUrl(env, query), { headers: serviceHeaders(env) });
  const rows = await response.json().catch(() => []);
  if (!response.ok) throw new Error("vault_read_failed");
  if (!Array.isArray(rows) || !rows[0]) return null;
  return { ...rows[0], session: decryptJson(rows[0].encrypted_payload, env, "token-vault") };
}

export async function saveGoogleIntegration(userId, integration, session, { env = process.env, fetchImpl = fetch } = {}) {
  if (!INTEGRATIONS.has(integration)) throw new Error("invalid_integration");
  const payload = {
    user_id: userId,
    integration,
    encrypted_payload: encryptJson(session, env, "token-vault"),
    google_account_id: session.account_id || null,
    google_account_email: session.account_email || null,
  };
  const response = await fetchImpl(vaultUrl(env), {
    method: "POST",
    headers: serviceHeaders(env, { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("vault_write_failed");
  return session;
}

export async function deleteGoogleIntegration(userId, integration, { env = process.env, fetchImpl = fetch } = {}) {
  const query = `?user_id=eq.${encodeURIComponent(userId)}&integration=eq.${integration}`;
  const response = await fetchImpl(vaultUrl(env, query), { method: "DELETE", headers: serviceHeaders(env) });
  if (!response.ok) throw new Error("vault_delete_failed");
}

export function createGoogleOAuthState(userId, integration, { env = process.env, now = Date.now() } = {}) {
  if (!INTEGRATIONS.has(integration)) throw new Error("invalid_integration");
  return encryptJson({ userId, integration, issuedAt: now, nonce: randomBytes(16).toString("base64url") }, env, "oauth-state");
}

export function verifyGoogleOAuthState(state, integration, { env = process.env, now = Date.now() } = {}) {
  try {
    const payload = decryptJson(state, env, "oauth-state");
    const expected = Buffer.from(integration);
    const actual = Buffer.from(String(payload.integration || ""));
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    if (typeof payload.userId !== "string" || !Number.isFinite(payload.issuedAt) || now - payload.issuedAt > OAUTH_STATE_MAX_AGE_MS || payload.issuedAt > now + 30_000) return null;
    return payload;
  } catch {
    return null;
  }
}
