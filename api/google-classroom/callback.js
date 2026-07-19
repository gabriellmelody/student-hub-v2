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

export default function handler(request, response) {
  // Safe OAuth step only: confirm callback params, but do not exchange or store codes.
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
    response.status(501).json({
      ok: false,
      status: "code_received_exchange_not_implemented",
      configured: true,
      message:
        "Google returned an authorization code, but token exchange is not implemented yet.",
      nextStep:
        "Implement secure server-side code exchange in the next task.",
    });
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
