import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export const CALENDAR_SESSION_COOKIE_NAME = "student_hub_calendar_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60;

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

export function createCalendarSessionCookie(tokenResponse) {
  const now = Date.now();
  const tokenExpiresIn = Number(tokenResponse.expires_in);
  const expiresInSeconds =
    Number.isFinite(tokenExpiresIn) && tokenExpiresIn > 0
      ? Math.min(tokenExpiresIn, SESSION_MAX_AGE_SECONDS)
      : SESSION_MAX_AGE_SECONDS;
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + expiresInSeconds * 1000).toISOString();
  const payload = {
    access_token: tokenResponse.access_token,
    ...(typeof tokenResponse.refresh_token === "string"
      ? { refresh_token: tokenResponse.refresh_token }
      : {}),
    expires_at: expiresAt,
    scope: typeof tokenResponse.scope === "string" ? tokenResponse.scope : "",
    token_type:
      typeof tokenResponse.token_type === "string"
        ? tokenResponse.token_type
        : "",
    created_at: createdAt,
  };

  return {
    cookie: serializeCookie(encryptSessionPayload(payload), expiresInSeconds),
    expiresAt,
    hasRefreshToken: typeof tokenResponse.refresh_token === "string",
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
    const expiresAt = Date.parse(payload.expires_at);

    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
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
