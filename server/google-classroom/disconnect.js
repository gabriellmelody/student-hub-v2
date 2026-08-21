import { clearClassroomSessionCookie } from "./_session.js";
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
  await deleteGoogleIntegration(auth.userId, "classroom");

  response.setHeader("Set-Cookie", clearClassroomSessionCookie());
  response.status(200).json({ ok: true, status: "classroom_disconnected", connected: false });
}
