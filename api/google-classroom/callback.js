import { getGoogleClassroomOAuthConfigStatus } from "./_config.js";

function getCallbackParam(request, name) {
  if (request.query && typeof request.query[name] === "string") {
    return request.query[name];
  }

  const callbackUrl = new URL(
    request.url || "",
    "https://student-hub.local"
  );

  return callbackUrl.searchParams.get(name);
}

function summarizeTokenResponse(tokenResponse) {
  return {
    hasAccessToken: typeof tokenResponse.access_token === "string",
    hasRefreshToken: typeof tokenResponse.refresh_token === "string",
    expiresIn:
      typeof tokenResponse.expires_in === "number"
        ? tokenResponse.expires_in
        : null,
    scope:
      typeof tokenResponse.scope === "string" ? tokenResponse.scope : null,
    tokenType:
      typeof tokenResponse.token_type === "string"
        ? tokenResponse.token_type
        : null,
  };
}

function getSafeGoogleError(tokenResponse) {
  if (!tokenResponse || typeof tokenResponse !== "object") {
    return "Google token endpoint returned an unexpected response.";
  }

  return (
    tokenResponse.error_description ||
    tokenResponse.error ||
    "Google token endpoint rejected the authorization code."
  );
}

export default async function handler(request, response) {
  // Safe OAuth proof only: exchange server-side, summarize success, discard tokens.
  const config = getGoogleClassroomOAuthConfigStatus();

  if (!config.configured) {
    response.status(501).json({
      ok: false,
      status: "not_configured",
      configured: false,
      missingEnv: config.missingEnv,
      requiredEnv: config.requiredEnv,
      message: "Google Classroom OAuth callback is not configured yet.",
      nextStep:
        "Add the required environment variables in Vercel before implementing the callback.",
    });
    return;
  }

  const oauthError = getCallbackParam(request, "error");

  if (oauthError) {
    response.status(400).json({
      ok: false,
      status: "oauth_error",
      configured: true,
      error: oauthError,
      message: "Google returned an OAuth error.",
      nextStep:
        "Review the Google OAuth response and try the authorization step again.",
    });
    return;
  }

  const authorizationCode = getCallbackParam(request, "code");

  if (authorizationCode) {
    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          code: authorizationCode,
          client_id: process.env.GOOGLE_CLASSROOM_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLASSROOM_CLIENT_SECRET,
          redirect_uri: process.env.GOOGLE_CLASSROOM_REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });
      const tokenJson = await tokenResponse.json();

      if (!tokenResponse.ok) {
        response.status(400).json({
          ok: false,
          status: "token_exchange_failed",
          configured: true,
          message: "Google OAuth token exchange failed.",
          googleError: getSafeGoogleError(tokenJson),
          nextStep:
            "Start the authorization flow again or review the OAuth configuration.",
        });
        return;
      }

      response.status(200).json({
        ok: true,
        status: "token_exchange_verified_not_stored",
        configured: true,
        message:
          "Google OAuth token exchange worked. Tokens were received server-side and discarded.",
        tokenSummary: summarizeTokenResponse(tokenJson),
        nextStep:
          "Store tokens securely server-side before reading Classroom courses.",
      });
    } catch {
      response.status(502).json({
        ok: false,
        status: "token_exchange_failed",
        configured: true,
        message: "Google OAuth token exchange could not be completed.",
        googleError: "Token endpoint request failed.",
        nextStep:
          "Try the authorization flow again after checking the serverless runtime.",
      });
    }
    return;
  }

  response.status(400).json({
    ok: false,
    status: "missing_code",
    configured: true,
    message: "Google Classroom OAuth callback did not include a code.",
    nextStep: "Start the authorization redirect again from Student Hub.",
  });
}
