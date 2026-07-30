import { getValidCalendarSession } from "./_session.js";

export default async function handler(request, response) {
  const sessionResult = await getValidCalendarSession(request, response);

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
      status: sessionResult.status || "calendar_session_invalid_or_expired",
      connected: false,
      message:
        sessionResult.message ||
        "Google Calendar session is invalid or expired. Connect again.",
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
      sessionExpiresAt: session.session_expires_at || session.expires_at,
      scope: session.scope,
    },
    account: {
      id: typeof session.account_id === "string" ? session.account_id : "",
      email: typeof session.account_email === "string" ? session.account_email : "",
    },
  });
}
