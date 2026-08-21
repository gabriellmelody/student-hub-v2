import connect from "../../server/google-classroom/connect.js";
import callback from "../../server/google-classroom/callback.js";
import session from "../../server/google-classroom/session.js";
import disconnect from "../../server/google-classroom/disconnect.js";
import courses from "../../server/google-classroom/courses.js";
import courseworkPreview from "../../server/google-classroom/coursework-preview.js";

const handlers = Object.freeze({
  connect,
  callback,
  session,
  disconnect,
  courses,
  "coursework-preview": courseworkPreview,
});

export default function handler(request, response) {
  const action = Array.isArray(request.query?.action)
    ? request.query.action[0]
    : request.query?.action;
  const routeHandler = handlers[action];

  if (!routeHandler) {
    response.status(404).json({ ok: false, status: "route_not_found" });
    return;
  }

  return routeHandler(request, response);
}
