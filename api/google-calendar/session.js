import { readCalendarSession } from "./_session.js";

export default function handler(request, response) {
  const sessionResult = readCalendarSession(request);

  if (sessionResult.status === "no_calendar_session") {
    response.status(401).json({
      ok: false,
      status: "no_calendar_session",
      connected: false,
      message: "No Google Calendar session is available yet.",
    });
    return;
  }

  if (!sessionResult.ok) {
    response.status(401).json({
      ok: false,
      status: "calendar_session_invalid_or_expired",
      connected: false,
      message: "Google Calendar session is invalid or expired. Connect again.",
    });
    return;
  }

  const session = sessionResult.session;

  response.status(200).json({
    ok: true,
    status: "calendar_session_available",
    connected: true,
    tokenSummary: {
      hasAccessToken: typeof session.access_token === "string",
      hasRefreshToken: typeof session.refresh_token === "string",
      expiresAt: session.expires_at,
      scope: session.scope,
    },
  });
}
