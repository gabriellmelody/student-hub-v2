export function requiredServerEnv(env, name) {
  const value = String(env[name] || "").trim();
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

function isLegacyJwtKey(value) {
  return String(value).split(".").length === 3;
}

export function getSupabaseServiceHeaders(env, extras = {}) {
  const serviceKey = requiredServerEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: serviceKey,
    ...(isLegacyJwtKey(serviceKey)
      ? { Authorization: `Bearer ${serviceKey}` }
      : {}),
    ...extras,
  };
}

export function getSupabaseServerUrl(env, path = "") {
  return `${requiredServerEnv(env, "SUPABASE_URL").replace(/\/$/, "")}${path}`;
}

export function readBearerToken(request) {
  const match = String(request.headers?.authorization || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export async function requireDayloUser(
  request,
  { env = process.env, fetchImpl = fetch } = {}
) {
  const token = readBearerToken(request);
  if (!token) return { ok: false, status: "daylo_auth_required", statusCode: 401 };
  const response = await fetchImpl(getSupabaseServerUrl(env, "/auth/v1/user"), {
    headers: {
      ...getSupabaseServiceHeaders(env),
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || typeof body?.id !== "string") {
    return { ok: false, status: "daylo_session_invalid", statusCode: 401 };
  }
  return { ok: true, userId: body.id };
}

