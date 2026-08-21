(function registerDayloPushWorker(scope) {
  const ALLOWED_PATHS = new Set(["/", "/tasks", "/plan", "/settings/notifications"]);
  const DEFAULT_TITLE = "DayLo reminder";
  const DEFAULT_BODY = "You have a DayLo reminder.";

  function clean(value, maxLength) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
  }

  function normalizeInternalRoute(value) {
    try {
      const url = new URL(clean(value, 1000) || "/", scope.location.origin);
      if (url.origin !== scope.location.origin || !ALLOWED_PATHS.has(url.pathname)) return "/";
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return "/";
    }
  }

  function normalizePushPayload(value) {
    const payload = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return {
      title: clean(payload.title, 120) || DEFAULT_TITLE,
      body: clean(payload.body, 240) || DEFAULT_BODY,
      url: normalizeInternalRoute(payload.url),
      tag: clean(payload.tag, 160) || undefined,
      occurrenceKey: clean(payload.occurrenceKey, 500),
    };
  }

  async function readPushPayload(event) {
    if (!event.data) return normalizePushPayload(null);
    try {
      return normalizePushPayload(event.data.json());
    } catch {
      return normalizePushPayload(null);
    }
  }

  scope.addEventListener("push", (event) => {
    event.waitUntil(
      readPushPayload(event).then((payload) =>
        scope.registration.showNotification(payload.title, {
          body: payload.body,
          icon: "/icons/daylo-192.png",
          badge: "/icons/daylo-32.png",
          tag: payload.tag,
          data: {
            url: payload.url,
            occurrenceKey: payload.occurrenceKey,
          },
        })
      )
    );
  });

  scope.addEventListener("notificationclick", (event) => {
    event.notification?.close();
    const route = normalizeInternalRoute(event.notification?.data?.url);
    const targetUrl = new URL(route, scope.location.origin).href;
    event.waitUntil(
      scope.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then(async (windowClients) => {
          const existingClient = windowClients.find((client) => {
            try {
              return new URL(client.url).origin === scope.location.origin;
            } catch {
              return false;
            }
          });
          if (existingClient) {
            if (typeof existingClient.navigate === "function") {
              await existingClient.navigate(targetUrl);
            }
            return existingClient.focus?.();
          }
          return scope.clients.openWindow?.(targetUrl);
        })
    );
  });

  scope.DayloPushWorker = Object.freeze({
    normalizeInternalRoute,
    normalizePushPayload,
  });
})(self);

