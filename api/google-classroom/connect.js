import { getGoogleClassroomOAuthConfigStatus } from "./_config.js";

export default function handler(_request, response) {
  // Safe placeholder only: check readiness, but do not redirect to Google yet.
  const config = getGoogleClassroomOAuthConfigStatus();

  if (!config.configured) {
    response.status(501).json({
      ok: false,
      status: "not_configured",
      configured: false,
      missingEnv: config.missingEnv,
      requiredEnv: config.requiredEnv,
      message: "Google Classroom OAuth is not configured yet.",
      nextStep:
        "Add the required environment variables in Vercel before implementing the authorization redirect.",
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
      "Google Classroom OAuth configuration is present, but the authorization redirect is not implemented yet.",
    nextStep: "Implement the authorization URL generation in a future task.",
  });
}
