import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export const CALENDAR_SESSION_COOKIE_NAME = "student_hub_calendar_session";

const CALENDAR_SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;
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
    `${CALENDAR_SESSION_COOKIE_NAME}=${value}`,
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

export function clearCalendarSessionCookie() {
  return serializeCookie("", 0);
}

export function createCalendarSessionCookie(
  tokenResponse,
  existingSession = null,
  account = null
) {
  return createCalendarSessionCookieFromTokenResponse(
    tokenResponse,
    existingSession,
    account
  );
}

function getSessionAccountId(session) {
  return typeof session?.account_id === "string" ? session.account_id : "";
}

export function createCalendarSessionCookieFromTokenResponse(
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
  const accessExpiresInSeconds =
    Number.isFinite(tokenExpiresIn) && tokenExpiresIn > 0
      ? tokenExpiresIn
      : 60 * 60;
  const accessExpiresAt = new Date(
    now + accessExpiresInSeconds * 1000
  ).toISOString();
  const sessionExpiresAt = new Date(
    now + CALENDAR_SESSION_MAX_AGE_SECONDS * 1000
  ).toISOString();
  const createdAt =
    typeof existingSession?.created_at === "string"
      ? existingSession.created_at
      : new Date(now).toISOString();
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
    expires_at: accessExpiresAt,
    access_expires_at: accessExpiresAt,
    session_expires_at: sessionExpiresAt,
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
    refreshed_at: existingSession ? new Date(now).toISOString() : null,
  };

  return {
    cookie: serializeCookie(
      encryptSessionPayload(payload),
      CALENDAR_SESSION_MAX_AGE_SECONDS
    ),
    expiresAt: sessionExpiresAt,
    accessExpiresAt,
    sessionExpiresAt,
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

export function readCalendarSession(request) {
  const cookies = parseCookieHeader(request.headers?.cookie);
  const cookieValue = cookies[CALENDAR_SESSION_COOKIE_NAME];

  if (!cookieValue) {
    return {
      ok: false,
      status: "no_calendar_session",
    };
  }

  try {
    const payload = decryptSessionPayload(cookieValue);
    const sessionExpiresAt = Date.parse(
      payload.session_expires_at || payload.expires_at
    );

    if (!Number.isFinite(sessionExpiresAt) || sessionExpiresAt <= Date.now()) {
      return {
        ok: false,
        status: "calendar_session_invalid_or_expired",
      };
    }

    return {
      ok: true,
      status: "calendar_session_available",
      session: payload,
    };
  } catch {
    return {
      ok: false,
      status: "calendar_session_invalid_or_expired",
    };
  }
}

function isAccessTokenExpiring(session, forceRefresh = false) {
  if (forceRefresh) return true;

  const accessExpiresAt = Date.parse(
    session.access_expires_at || session.expires_at
  );

  return (
    !Number.isFinite(accessExpiresAt) ||
    accessExpiresAt - Date.now() <= ACCESS_TOKEN_REFRESH_BUFFER_MS
  );
}

async function readSafeJson(fetchResponse) {
  try {
    return await fetchResponse.json();
  } catch {
    return null;
  }
}

function classifyCalendarRefreshFailure(response, body) {
  const googleError = typeof body?.error === "string" ? body.error : "";
  if (response?.status === 400 && googleError === "invalid_grant") {
    return { status: "calendar_session_reconnect_required", connected: false };
  }
  if (response?.status === 401 || googleError === "invalid_client") {
    return { status: "calendar_refresh_configuration_error", connected: true };
  }
  return { status: "calendar_refresh_temporarily_unavailable", connected: true };
}

export async function refreshCalendarSession(
  session,
  response,
  { fetchImpl = fetch, log = console } = {}
) {
  if (typeof session?.refresh_token !== "string" || !session.refresh_token.trim()) {
    return {
      ok: false,
      status: "calendar_session_reconnect_required",
      connected: false,
      message: "Reconnect Google Calendar to refresh access.",
    };
  }

  log.info("calendar auth: access token expired; refresh attempted");
  try {
    const refreshResponse = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLASSROOM_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLASSROOM_CLIENT_SECRET,
        refresh_token: session.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const refreshJson = await readSafeJson(refreshResponse);

    if (!refreshResponse.ok || typeof refreshJson?.access_token !== "string") {
      const failure = classifyCalendarRefreshFailure(refreshResponse, refreshJson);
      log.warn(
        failure.connected
          ? "calendar auth: transient refresh failure"
          : "calendar auth: refresh token rejected; reconnect required",
        { category: failure.status, httpStatus: refreshResponse.status }
      );
      return {
        ok: false,
        ...failure,
        session: failure.connected ? session : undefined,
        message: failure.connected
          ? "Google Calendar is temporarily unavailable."
          : "Reconnect Google Calendar to continue.",
      };
    }

    const sessionCookie = createCalendarSessionCookieFromTokenResponse(
      refreshJson,
      session
    );

    response.setHeader("Set-Cookie", sessionCookie.cookie);

    log.info("calendar auth: refresh succeeded");
    return {
      ok: true,
      status: "calendar_session_refreshed",
      connected: true,
      session: sessionCookie.session,
      refreshed: true,
      sessionCookie,
    };
  } catch {
    log.warn("calendar auth: transient refresh failure", { category: "network" });
    return {
      ok: false,
      status: "calendar_refresh_temporarily_unavailable",
      connected: true,
      session,
      message: "Google Calendar is temporarily unavailable.",
    };
  }
}

export async function getValidCalendarSession(
  request,
  response,
  { forceRefresh = false, fetchImpl = fetch, log = console } = {}
) {
  const sessionResult = readCalendarSession(request);

  if (!sessionResult.ok) return sessionResult;

  if (!isAccessTokenExpiring(sessionResult.session, forceRefresh)) {
    return {
      ...sessionResult,
      connected: true,
      refreshed: false,
    };
  }

  return refreshCalendarSession(sessionResult.session, response, { fetchImpl, log });
}
