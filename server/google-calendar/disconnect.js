import { clearCalendarSessionCookie } from "./_session.js";
import { deleteGoogleIntegration, requireDayloUser } from "../google-integration-vault.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ ok: false, status: "method_not_allowed" });
    return;
  }

  const auth = await requireDayloUser(request);
  if (!auth.ok) {
    response.status(auth.statusCode).json({ ok: false, status: auth.status });
    return;
  }
  await deleteGoogleIntegration(auth.userId, "calendar");

  response.setHeader("Set-Cookie", clearCalendarSessionCookie());
  response.status(200).json({ ok: true, status: "calendar_disconnected", connected: false });
}
