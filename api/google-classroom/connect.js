import { getGoogleClassroomOAuthConfigStatus } from "./_config.js";

const GOOGLE_CLASSROOM_READONLY_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
];

function isReadinessCheck(request) {
  const requestUrl = new URL(request.url || "", "https://student-hub.local");

  return requestUrl.searchParams.get("mode") === "readiness";
}

export default function handler(request, response) {
  // Safe OAuth step only: build the permission-screen URL, but do not store tokens.
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

  if (isReadinessCheck(request)) {
    response.status(501).json({
      ok: false,
      status: "configured_not_implemented",
      configured: true,
      missingEnv: [],
      requiredEnv: config.requiredEnv,
      message:
        "Google Classroom OAuth configuration is present, but the authorization redirect is a prototype step.",
      nextStep:
        "Use the prototype permission-screen action to test the redirect. Token exchange is still not implemented.",
    });
    return;
  }

  const authorizationUrl = new URL(
    "https://accounts.google.com/o/oauth2/v2/auth"
  );

  authorizationUrl.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLASSROOM_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_CLASSROOM_REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_CLASSROOM_READONLY_SCOPES.join(" "),
    state: "student-hub-google-classroom-prototype",
  });

  response.writeHead(302, {
    Location: authorizationUrl.toString(),
  });
  response.end();
}
