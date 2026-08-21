import {
  handleStatus,
  handleSubscribe,
  handleUnsubscribe,
} from "../../server/notifications/subscriptions.js";

const handlers = Object.freeze({
  subscribe: handleSubscribe,
  unsubscribe: handleUnsubscribe,
  status: handleStatus,
});

export default function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ ok: false, status: "method_not_allowed" });
  }
  const action = Array.isArray(request.query?.action)
    ? request.query.action[0]
    : request.query?.action;
  const routeHandler = handlers[action];
  if (!routeHandler) {
    return response.status(404).json({ ok: false, status: "route_not_found" });
  }
  return routeHandler(request, response);
}

