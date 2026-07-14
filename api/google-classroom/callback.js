import { getGoogleClassroomOAuthConfigStatus } from "./_config.js";

export default function handler(_request, response) {
  // Safe placeholder only: check readiness, but do not exchange auth codes yet.
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

  response.status(501).json({
    ok: false,
    status: "configured_not_implemented",
    configured: true,
    missingEnv: [],
    requiredEnv: config.requiredEnv,
    message:
      "Google Classroom OAuth callback configuration is present, but code exchange is not implemented yet.",
    nextStep:
      "Handle Google auth code exchange securely in a future serverless task.",
  });
}
