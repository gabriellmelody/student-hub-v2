import { clearClassroomSessionCookie } from "./_session.js";

export default function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ ok: false, status: "method_not_allowed" });
    return;
  }

  response.setHeader("Set-Cookie", clearClassroomSessionCookie());
  response.status(200).json({ ok: true, status: "classroom_disconnected", connected: false });
}
