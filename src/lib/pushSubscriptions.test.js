import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PUSH_ENDPOINT_STORAGE_KEY,
  PUSH_OWNER_STORAGE_KEY,
  cleanupNotificationSubscription,
  enableNotifications,
  reconcileNotificationSubscription,
} from "./pushSubscriptions.js";
import { NOTIFICATION_CAPABILITY_STATES } from "../utils/notificationPushUtils.js";

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function browser(subscription) {
  return {
    platform: "Test",
    serviceWorker: {
      ready: Promise.resolve({ pushManager: { getSubscription: async () => subscription } }),
    },
  };
}

const secureWindow = { isSecureContext: true, matchMedia: () => ({ matches: false }) };
const notificationApi = { permission: "granted" };

test("permission is requested only by the explicit enable action", async () => {
  const hookSource = readFileSync(new URL("../hooks/useNotificationPush.js", import.meta.url), "utf8");
  assert.doesNotMatch(hookSource, /requestPermission/);
  let permissionRequests = 0;
  let oldUnsubscribes = 0;
  let subscribeOptions = null;
  const newSubscription = {
    endpoint: "https://push.example/new",
    toJSON: () => ({
      endpoint: "https://push.example/new",
      keys: { p256dh: "new-key", auth: "new-auth" },
    }),
  };
  const result = await enableNotifications({
    userId: "user-b",
    accessToken: "token-b",
    vapidPublicKey: "AQID",
    windowObject: secureWindow,
    navigatorObject: {
      platform: "Test",
      serviceWorker: { ready: Promise.resolve({ pushManager: {
        getSubscription: async () => ({
          endpoint: "https://push.example/old",
          unsubscribe: async () => { oldUnsubscribes += 1; },
        }),
        subscribe: async (options) => { subscribeOptions = options; return newSubscription; },
      } }) },
    },
    notificationApi: {
      permission: "default",
      requestPermission: async () => { permissionRequests += 1; return "granted"; },
    },
    pushManagerApi: function PushManager() {},
    storage: storage({ [PUSH_OWNER_STORAGE_KEY]: "user-a" }),
    fetchImpl: async () => ({ ok: true, json: async () => ({ ok: true }) }),
  });
  assert.equal(result.state, NOTIFICATION_CAPABILITY_STATES.SUBSCRIBED);
  assert.equal(permissionRequests, 1);
  assert.equal(oldUnsubscribes, 1);
  assert.equal(subscribeOptions.userVisibleOnly, true);
  assert.deepEqual([...subscribeOptions.applicationServerKey], [1, 2, 3]);
});

test("logout removes the authenticated endpoint then unsubscribes only this browser", async () => {
  const local = storage({
    [PUSH_OWNER_STORAGE_KEY]: "user-a",
    [PUSH_ENDPOINT_STORAGE_KEY]: "https://push.example/a",
  });
  let unsubscribed = 0;
  const requests = [];
  await cleanupNotificationSubscription({
    accessToken: "token-a",
    navigatorObject: browser({
      endpoint: "https://push.example/a",
      unsubscribe: async () => { unsubscribed += 1; },
    }),
    storage: local,
    fetchImpl: async (url, options) => {
      requests.push([url, JSON.parse(options.body), options.headers.Authorization]);
      return { ok: true, json: async () => ({ ok: true }) };
    },
  });
  assert.equal(unsubscribed, 1);
  assert.deepEqual(requests, [[
    "/api/notifications/unsubscribe",
    { endpoint: "https://push.example/a" },
    "Bearer token-a",
  ]]);
  assert.equal(local.getItem(PUSH_OWNER_STORAGE_KEY), null);
});

test("account switching never reassigns the previous owner's browser subscription", async () => {
  let unsubscribed = 0;
  let apiCalls = 0;
  const result = await reconcileNotificationSubscription({
    userId: "user-b",
    accessToken: "token-b",
    windowObject: secureWindow,
    navigatorObject: browser({
      endpoint: "https://push.example/a",
      unsubscribe: async () => { unsubscribed += 1; },
    }),
    notificationApi,
    pushManagerApi: function PushManager() {},
    storage: storage({ [PUSH_OWNER_STORAGE_KEY]: "user-a" }),
    fetchImpl: async () => { apiCalls += 1; },
  });
  assert.equal(result.state, NOTIFICATION_CAPABILITY_STATES.PERMISSION_GRANTED_UNSUBSCRIBED);
  assert.equal(unsubscribed, 1);
  assert.equal(apiCalls, 0);
});

function enabledEnvironment({ local = storage(), initialSubscription = null } = {}) {
  let current = initialSubscription;
  let subscribeCalls = 0;
  const requests = [];
  const navigatorObject = {
    platform: "Test",
    serviceWorker: { ready: Promise.resolve({ pushManager: {
      getSubscription: async () => current,
      subscribe: async () => {
        subscribeCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        current = { endpoint: "https://push.example/current", toJSON() { return { endpoint: this.endpoint, keys: { p256dh: "key", auth: "auth" } }; }, unsubscribe: async () => { current = null; } };
        return current;
      },
    } }) },
  };
  const fetchImpl = async (url, options) => { requests.push([url, JSON.parse(options.body)]); return { ok: true, json: async () => ({ ok: true }) }; };
  const options = { userId: "user-a", accessToken: "token-a", vapidPublicKey: "AQID", windowObject: secureWindow, navigatorObject, notificationApi, pushManagerApi: function PushManager() {}, storage: local, fetchImpl };
  return { options, requests, get subscribeCalls() { return subscribeCalls; }, get current() { return current; } };
}

test("existing browser subscription is reused without subscribing again", async () => {
  const subscription = { endpoint: "https://push.example/current", toJSON: () => ({ endpoint: "https://push.example/current", keys: { p256dh: "key", auth: "auth" } }) };
  const environment = enabledEnvironment({ local: storage({ [PUSH_OWNER_STORAGE_KEY]: "user-a", [PUSH_ENDPOINT_STORAGE_KEY]: subscription.endpoint }), initialSubscription: subscription });
  await enableNotifications(environment.options);
  assert.equal(environment.subscribeCalls, 0);
});

test("simultaneous and repeated enable calls create one browser subscription", async () => {
  const environment = enabledEnvironment();
  const [first, second] = await Promise.all([enableNotifications(environment.options), enableNotifications(environment.options)]);
  await enableNotifications(environment.options);
  assert.equal(first.subscription, second.subscription);
  assert.equal(environment.subscribeCalls, 1);
  assert.equal(environment.requests.filter(([url]) => url.endsWith("/subscribe")).length, 3);
});

test("enable and passive reconciliation serialize around one subscription", async () => {
  const local = storage({ [PUSH_OWNER_STORAGE_KEY]: "user-a" });
  const environment = enabledEnvironment({ local });
  await Promise.all([enableNotifications(environment.options), reconcileNotificationSubscription(environment.options)]);
  assert.equal(environment.subscribeCalls, 1);
  assert.equal(local.getItem(PUSH_ENDPOINT_STORAGE_KEY), "https://push.example/current");
});

test("changed browser endpoint retires only the safely remembered endpoint", async () => {
  const current = { endpoint: "https://push.example/current", toJSON: () => ({ endpoint: "https://push.example/current", keys: { p256dh: "key", auth: "auth" } }) };
  const environment = enabledEnvironment({ local: storage({ [PUSH_OWNER_STORAGE_KEY]: "user-a", [PUSH_ENDPOINT_STORAGE_KEY]: "https://push.example/old" }), initialSubscription: current });
  await enableNotifications(environment.options);
  assert.deepEqual(environment.requests.map(([url, body]) => [url.split("/").pop(), body.endpoint || body.subscription?.endpoint]), [["unsubscribe", "https://push.example/old"], ["subscribe", "https://push.example/current"]]);
  assert.equal(environment.requests.some(([, body]) => body.endpoint === "https://push.example/other-device"), false);
});

test("disable retires current and remembered stale endpoints without touching preferences", async () => {
  const local = storage({ [PUSH_OWNER_STORAGE_KEY]: "user-a", [PUSH_ENDPOINT_STORAGE_KEY]: "https://push.example/old" });
  const current = { endpoint: "https://push.example/current", unsubscribe: async () => {} };
  const environment = enabledEnvironment({ local, initialSubscription: current });
  const preferences = { masterEnabled: true, quietHoursEnabled: true };
  await cleanupNotificationSubscription(environment.options);
  assert.deepEqual(environment.requests.map(([, body]) => body.endpoint), ["https://push.example/current", "https://push.example/old"]);
  assert.deepEqual(preferences, { masterEnabled: true, quietHoursEnabled: true });
  assert.equal(local.getItem(PUSH_ENDPOINT_STORAGE_KEY), null);
});

test("passive reconciliation never requests notification permission", async () => {
  let requests = 0;
  const environment = enabledEnvironment();
  await reconcileNotificationSubscription({ ...environment.options, notificationApi: { permission: "default", requestPermission: async () => { requests += 1; } } });
  assert.equal(requests, 0);
});
