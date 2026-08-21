import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { loadGoogleIntegration, requireDayloUser, saveGoogleIntegration } from "../../server/google-integration-vault.js";

export const CLASSROOM_SESSION_COOKIE_NAME = "student_hub_classroom_session";

const ACCESS_TOKEN_SESSION_MAX_AGE_SECONDS = 60 * 60;
const REFRESH_TOKEN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

function base64UrlEncode(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url");
}

function getSessionSecret() {
  const secret = process.env.STUDENT_HUB_SESSION_SECRET;

  if (typeof secret !== "string" || secret.trim().length < 32) {
    throw new Error("missing_session_secret");
  }

  return secret;
}

function getEncryptionKey() {
  return createHash("sha256").update(getSessionSecret()).digest();
}

function encryptSessionPayload(payload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    base64UrlEncode(iv),
    base64UrlEncode(tag),
    base64UrlEncode(encrypted),
  ].join(".");
}

function decryptSessionPayload(value) {
  const [ivValue, tagValue, encryptedValue] = String(value || "").split(".");

  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("invalid_session_cookie");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    base64UrlDecode(ivValue)
  );
  decipher.setAuthTag(base64UrlDecode(tagValue));

  const decrypted = Buffer.concat([
    decipher.update(base64UrlDecode(encryptedValue)),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}

function parseCookieHeader(cookieHeader = "") {
  return String(cookieHeader)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf("=");

      if (separatorIndex === -1) return cookies;

      const name = decodeURIComponent(part.slice(0, separatorIndex));
      const value = part.slice(separatorIndex + 1);

      return {
        ...cookies,
        [name]: value,
      };
    }, {});
}

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

function serializeCookie(value, maxAgeSeconds) {
  const cookieParts = [
    `${CLASSROOM_SESSION_COOKIE_NAME}=${value}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (isProductionRuntime()) {
    cookieParts.push("Secure");
  }

  return cookieParts.join("; ");
}

export function clearClassroomSessionCookie() {
  return serializeCookie("", 0);
}

export function createClassroomSessionCookie(
  tokenResponse,
  existingSession = null,
  account = null
) {
  return createClassroomSessionCookieFromTokenResponse(
    tokenResponse,
    existingSession,
    account
  );
}

function getSessionAccountId(session) {
  return typeof session?.account_id === "string" ? session.account_id : "";
}

export function createClassroomSessionCookieFromTokenResponse(
  tokenResponse,
  existingSession = null,
  account = null
) {
  const now = Date.now();
  const newAccountId =
    typeof account?.accountId === "string"
      ? account.accountId
      : account === null && typeof existingSession?.account_id === "string"
        ? existingSession.account_id
        : "";
  const accountEmail =
    typeof account?.accountEmail === "string"
      ? account.accountEmail
      : account === null && typeof existingSession?.account_email === "string"
        ? existingSession.account_email
        : "";
  const existingAccountId = getSessionAccountId(existingSession);
  const accountChanged =
    Boolean(existingSession) &&
    (!existingAccountId || !newAccountId || existingAccountId !== newAccountId);
  const sameAccount =
    Boolean(existingSession) &&
    Boolean(existingAccountId) &&
    Boolean(newAccountId) &&
    existingAccountId === newAccountId;
  const tokenExpiresIn = Number(tokenResponse.expires_in);
  const expiresInSeconds =
    Number.isFinite(tokenExpiresIn) && tokenExpiresIn > 0
      ? Math.min(tokenExpiresIn, ACCESS_TOKEN_SESSION_MAX_AGE_SECONDS)
      : ACCESS_TOKEN_SESSION_MAX_AGE_SECONDS;
  const createdAt =
    typeof existingSession?.created_at === "string"
      ? existingSession.created_at
      : new Date(now).toISOString();
  const expiresAt = new Date(now + expiresInSeconds * 1000).toISOString();
  const returnedRefreshToken =
    typeof tokenResponse.refresh_token === "string"
      ? tokenResponse.refresh_token.trim()
      : "";
  const existingRefreshToken =
    typeof existingSession?.refresh_token === "string"
      ? existingSession.refresh_token.trim()
      : "";
  const refreshToken = returnedRefreshToken
    ? returnedRefreshToken
    : sameAccount && existingRefreshToken
        ? existingRefreshToken
        : null;
  const payload = {
    access_token: tokenResponse.access_token,
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
    ...(newAccountId ? { account_id: newAccountId } : {}),
    ...(accountEmail ? { account_email: accountEmail } : {}),
    expires_at: expiresAt,
    scope:
      typeof tokenResponse.scope === "string"
        ? tokenResponse.scope
        : typeof existingSession?.scope === "string"
          ? existingSession.scope
          : "",
    token_type:
      typeof tokenResponse.token_type === "string"
        ? tokenResponse.token_type
        : typeof existingSession?.token_type === "string"
          ? existingSession.token_type
          : "",
    created_at: createdAt,
  };

  const cookieMaxAgeSeconds = refreshToken
    ? REFRESH_TOKEN_SESSION_MAX_AGE_SECONDS
    : expiresInSeconds;

  return {
    cookie: serializeCookie(encryptSessionPayload(payload), cookieMaxAgeSeconds),
    expiresAt,
    hasRefreshToken: typeof refreshToken === "string",
    refreshTokenPreserved:
      !returnedRefreshToken &&
      sameAccount &&
      Boolean(existingRefreshToken),
    accountChanged,
    accountId: newAccountId,
    accountEmail,
    session: payload,
  };
}

export function readClassroomSession(request) {
  const cookies = parseCookieHeader(request.headers?.cookie);
  const cookieValue = cookies[CLASSROOM_SESSION_COOKIE_NAME];

  if (!cookieValue) {
    return {
      ok: false,
      status: "no_classroom_session",
    };
  }

  try {
    const payload = decryptSessionPayload(cookieValue);
    const expiresAt = Date.parse(payload.expires_at);

    if (!Number.isFinite(expiresAt)) {
      return {
        ok: false,
        status: "classroom_session_invalid_or_expired",
      };
    }

    const expired = expiresAt - Date.now() <= ACCESS_TOKEN_REFRESH_BUFFER_MS;

    return {
      ok: !expired,
      status: expired
        ? "classroom_access_token_expired"
        : "classroom_session_available",
      session: payload,
    };
  } catch {
    return {
      ok: false,
      status: "classroom_session_invalid_or_expired",
    };
  }
}

function classifyClassroomRefreshFailure(response, body) {
  const googleError = typeof body?.error === "string" ? body.error : "";
  if (response?.status === 400 && googleError === "invalid_grant") {
    return { status: "classroom_reauthorization_required", connected: false };
  }
  if (response?.status === 401 || googleError === "invalid_client") {
    return { status: "classroom_refresh_configuration_error", connected: true };
  }
  return { status: "classroom_refresh_temporarily_unavailable", connected: true };
}

export async function getValidClassroomSession(
  request,
  { fetchImpl = fetch, log = console, forceRefresh = false, env = process.env } = {}
) {
  const auth = await requireDayloUser(request, { env, fetchImpl });
  if (!auth.ok) return { ok: false, status: auth.status, statusCode: auth.statusCode, connected: false };
  const vaultRecord = await loadGoogleIntegration(auth.userId, "classroom", { env, fetchImpl });
  if (!vaultRecord) {
    return {
      ok: false,
      status: "classroom_account_reconnect_required",
      connected: false,
      legacyConnectionDetected: Boolean(readClassroomSession(request).session),
    };
  }
  const sessionResult = {
    ok: Date.parse(vaultRecord.session.expires_at) - Date.now() > ACCESS_TOKEN_REFRESH_BUFFER_MS,
    status: "classroom_access_token_expired",
    session: vaultRecord.session,
  };

  if (sessionResult.ok && !forceRefresh) return sessionResult;

  if (!forceRefresh && sessionResult.status !== "classroom_access_token_expired") {
    return sessionResult;
  }
  if (
    typeof sessionResult.session?.refresh_token !== "string" ||
    !sessionResult.session.refresh_token.trim()
  ) {
    return {
      ok: false,
      status: "classroom_reauthorization_required",
      connected: false,
    };
  }

  log.info("classroom auth: access token expired; refresh attempted");
  let tokenResponse;
  try {
    tokenResponse = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLASSROOM_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLASSROOM_CLIENT_SECRET,
        refresh_token: sessionResult.session.refresh_token,
        grant_type: "refresh_token",
      }),
    });
  } catch {
    log.warn("classroom auth: transient refresh failure", { category: "network" });
    return {
      ok: false,
      status: "classroom_refresh_temporarily_unavailable",
      connected: true,
      session: sessionResult.session,
    };
  }

  let tokenJson = null;
  try {
    tokenJson = await tokenResponse.json();
  } catch {
    tokenJson = null;
  }

  if (!tokenResponse.ok || typeof tokenJson?.access_token !== "string") {
    const failure = classifyClassroomRefreshFailure(tokenResponse, tokenJson);
    log.warn(
      failure.connected
        ? "classroom auth: transient refresh failure"
        : "classroom auth: refresh token rejected; reconnect required",
      { category: failure.status, httpStatus: tokenResponse.status }
    );
    return {
      ok: false,
      ...failure,
      session: failure.connected ? sessionResult.session : undefined,
    };
  }

  const sessionCookie = createClassroomSessionCookieFromTokenResponse(
    tokenJson,
    sessionResult.session,
    null
  );
  await saveGoogleIntegration(auth.userId, "classroom", sessionCookie.session, { env, fetchImpl });

  log.info("classroom auth: refresh succeeded");
  return {
    ok: true,
    status: "classroom_session_refreshed",
    session: sessionCookie.session,
    expiresAt: sessionCookie.expiresAt,
    userId: auth.userId,
  };
}
