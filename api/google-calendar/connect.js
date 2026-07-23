import { getGoogleCalendarOAuthConfigStatus } from "./_config.js";

const GOOGLE_CALENDAR_READONLY_SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
];

function isReadinessCheck(request) {
  const requestUrl = new URL(request.url || "", "https://student-hub.local");

  return requestUrl.searchParams.get("mode") === "readiness";
}

export default function handler(request, response) {
  const config = getGoogleCalendarOAuthConfigStatus();

  if (!config.configured) {
    response.status(501).json({
      ok: false,
      status: "not_configured",
      configured: false,
      missingEnv: config.missingEnv,
      requiredEnv: config.requiredEnv,
      message: "Google Calendar OAuth is not configured yet.",
      nextStep:
        "Add the required environment variables in Vercel before using Google Calendar.",
    });
    return;
  }

  if (isReadinessCheck(request)) {
    response.status(200).json({
      ok: true,
      status: "configured",
      configured: true,
      missingEnv: [],
      requiredEnv: config.requiredEnv,
      message: "Google Calendar OAuth configuration is present.",
    });
    return;
  }

  const authorizationUrl = new URL(
    "https://accounts.google.com/o/oauth2/v2/auth"
  );

  authorizationUrl.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLASSROOM_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_CALENDAR_READONLY_SCOPES.join(" "),
    state: "student-hub-google-calendar-phase-1",
  });

  response.writeHead(302, {
    Location: authorizationUrl.toString(),
  });
  response.end();
}
