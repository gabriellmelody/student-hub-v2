export async function readSafeJson(fetchResponse) {
  try {
    return await fetchResponse.json();
  } catch {
    return null;
  }
}

export function getSafeGoogleError(googleResponse, fallbackMessage) {
  if (!googleResponse || typeof googleResponse !== "object") {
    return fallbackMessage;
  }

  return (
    googleResponse.error_description ||
    googleResponse.error?.message ||
    (typeof googleResponse.error === "string" ? googleResponse.error : "") ||
    fallbackMessage
  );
}

function normalizeOrigin(value) {
  if (typeof value !== "string" || value.trim().length === 0) return "";

  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function isLocalDevelopmentRuntime() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_ENV !== "production"
  );
}

function parseAllowedPopupOrigins() {
  const configuredValue = process.env.GOOGLE_OAUTH_ALLOWED_ORIGINS || "";
  const configuredParts = configuredValue
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const malformedOrigins = configuredParts.filter(
    (part) => normalizeOrigin(part) === ""
  );
  const configuredOrigins = configuredParts
    .map(normalizeOrigin)
    .filter(Boolean);
  const localOrigins = isLocalDevelopmentRuntime()
    ? ["http://localhost:5173", "http://127.0.0.1:5173"]
    : [];

  return {
    malformedOrigins,
    origins: new Set([...localOrigins, ...configuredOrigins]),
  };
}

async function readRequestBody(request) {
  if (request.body && typeof request.body === "object") {
    return request.body;
  }

  if (typeof request.body === "string") {
    return JSON.parse(request.body);
  }

  const chunks = [];

  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

export async function validatePopupCodeExchangeRequest(
  request
) {
  if (request.method !== "POST") {
    return {
      ok: false,
      statusCode: 405,
      payload: {
        ok: false,
        status: "method_not_allowed",
        message: "Popup OAuth exchange must use POST.",
      },
    };
  }

  const contentType = String(request.headers?.["content-type"] || "");

  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      ok: false,
      statusCode: 415,
      payload: {
        ok: false,
        status: "unsupported_media_type",
        message: "Popup OAuth exchange expects JSON.",
      },
    };
  }

  if (request.headers?.["x-requested-with"] !== "XmlHttpRequest") {
    return {
      ok: false,
      statusCode: 403,
      payload: {
        ok: false,
        status: "csrf_header_required",
        message: "Popup OAuth exchange was rejected.",
      },
    };
  }

  const requestOrigin = normalizeOrigin(String(request.headers?.origin || ""));
  const allowedOrigins = parseAllowedPopupOrigins();

  if (allowedOrigins.malformedOrigins.length > 0) {
    return {
      ok: false,
      statusCode: 500,
      payload: {
        ok: false,
        status: "oauth_origin_config_invalid",
        message: "Google popup origin allowlist is not configured correctly.",
      },
    };
  }

  if (!requestOrigin || !allowedOrigins.origins.has(requestOrigin)) {
    return {
      ok: false,
      statusCode: 403,
      payload: {
        ok: false,
        status: "origin_not_allowed",
        message: "Popup OAuth exchange was rejected for this origin.",
      },
    };
  }

  let body;

  try {
    body = await readRequestBody(request);
  } catch {
    return {
      ok: false,
      statusCode: 400,
      payload: {
        ok: false,
        status: "invalid_json",
        message: "Popup OAuth exchange could not read the request.",
      },
    };
  }

  const authorizationCode = body?.code;

  if (
    typeof authorizationCode !== "string" ||
    authorizationCode.trim().length < 12 ||
    authorizationCode.length > 4096
  ) {
    return {
      ok: false,
      statusCode: 400,
      payload: {
        ok: false,
        status: "missing_code",
        message: "Google did not return a usable authorization code.",
      },
    };
  }

  return {
    ok: true,
    code: authorizationCode,
    redirectUri: requestOrigin,
  };
}

function normalizeAccountIdentity(identity) {
  const accountId = String(identity?.sub || identity?.accountId || "").trim();

  if (!accountId) return null;

  return {
    accountId,
    accountEmail: String(identity?.email || identity?.accountEmail || "").trim(),
  };
}

export async function getGoogleAccountIdentity(tokenResponse) {
  const accessToken = tokenResponse?.access_token;

  if (typeof accessToken !== "string" || accessToken.length === 0) {
    return null;
  }

  const userInfoResponse = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const userInfo = await readSafeJson(userInfoResponse);
  const userInfoIdentity = normalizeAccountIdentity(userInfo);

  if (userInfoResponse.ok && userInfoIdentity) {
    return userInfoIdentity;
  }

  return null;
}

export async function exchangeGoogleAuthorizationCode({
  code,
  clientId,
  clientSecret,
  redirectUri,
}) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokenJson = await readSafeJson(tokenResponse);

  return {
    ok: tokenResponse.ok,
    status: tokenResponse.status,
    json: tokenJson,
  };
}
