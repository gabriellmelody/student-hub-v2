import { clearCalendarSessionCookie } from "./_session.js";

export default function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ ok: false, status: "method_not_allowed" });
    return;
  }

  response.setHeader("Set-Cookie", clearCalendarSessionCookie());
  response.status(200).json({ ok: true, status: "calendar_disconnected", connected: false });
}
