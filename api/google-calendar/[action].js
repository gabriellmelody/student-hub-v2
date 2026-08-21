import connect from "../../server/google-calendar/connect.js";
import callback from "../../server/google-calendar/callback.js";
import session from "../../server/google-calendar/session.js";
import disconnect from "../../server/google-calendar/disconnect.js";
import calendars from "../../server/google-calendar/calendars.js";
import events from "../../server/google-calendar/events.js";

const handlers = Object.freeze({
  connect,
  callback,
  session,
  disconnect,
  calendars,
  events,
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
