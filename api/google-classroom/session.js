import { getValidClassroomSession } from "./_session.js";

export default async function handler(request, response) {
  const sessionResult = await getValidClassroomSession(request);

  if (sessionResult.status === "no_classroom_session") {
    response.status(sessionResult.connected ? 503 : 401).json({
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
      status: sessionResult.status || "classroom_session_invalid_or_expired",
      connected: sessionResult.connected === true,
      message: sessionResult.connected ? "Google Classroom is temporarily unavailable." : "Reconnect Google Classroom.",
      account: { email: sessionResult.session?.account_email || "" },
    });
    return;
  }

  if (sessionResult.cookie) response.setHeader("Set-Cookie", sessionResult.cookie);

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
