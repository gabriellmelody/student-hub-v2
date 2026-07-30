import { readClassroomSession } from "./_session.js";

export default function handler(request, response) {
  const sessionResult = readClassroomSession(request);

  if (sessionResult.status === "no_classroom_session") {
    response.status(401).json({
      ok: false,
      status: "no_classroom_session",
      connected: false,
      message: "No Google Classroom session is available yet.",
    });
    return;
  }

  if (!sessionResult.ok) {
    response.status(401).json({
      ok: false,
      status: "classroom_session_invalid_or_expired",
      connected: false,
      message: "Google Classroom session is invalid or expired. Connect again.",
    });
    return;
  }

  const session = sessionResult.session;

  response.status(200).json({
    ok: true,
    status: "classroom_session_available",
    connected: true,
    tokenSummary: {
      hasAccessToken: typeof session.access_token === "string",
      hasRefreshToken: typeof session.refresh_token === "string",
      expiresAt: session.expires_at,
      scope: session.scope,
    },
    account: {
      email: typeof session.account_email === "string" ? session.account_email : "",
    },
  });
}
