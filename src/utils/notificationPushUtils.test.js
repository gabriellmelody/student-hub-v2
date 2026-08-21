import assert from "node:assert/strict";
import test from "node:test";
import {
  NOTIFICATION_CAPABILITY_STATES,
  getNotificationCapability,
  urlBase64ToUint8Array,
} from "./notificationPushUtils.js";

function environment({ permission = "default", subscription = null, ios = false, standalone = false } = {}) {
  return {
    windowObject: {
      isSecureContext: true,
      matchMedia: () => ({ matches: standalone }),
    },
    navigatorObject: {
      platform: ios ? "iPhone" : "Linux x86_64",
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: { getSubscription: async () => subscription },
        }),
      },
      standalone,
    },
    notificationApi: { permission },
    pushManagerApi: function PushManager() {},
  };
}

test("VAPID URL-safe base64 converts to the expected bytes", () => {
  assert.deepEqual([...urlBase64ToUint8Array("AQID-v8")], [1, 2, 3, 250, 255]);
  assert.throws(() => urlBase64ToUint8Array(""), /vapid_public_key_missing/);
});

test("notification capability detects unsupported and iOS installation requirements", async () => {
  assert.deepEqual(
    await getNotificationCapability({ windowObject: { isSecureContext: false } }),
    { state: NOTIFICATION_CAPABILITY_STATES.UNSUPPORTED }
  );
  assert.deepEqual(
    await getNotificationCapability(environment({ ios: true, standalone: false })),
    { state: NOTIFICATION_CAPABILITY_STATES.IOS_INSTALL_REQUIRED }
  );
});

test("notification capability distinguishes permission and subscription states", async () => {
  assert.deepEqual(
    await getNotificationCapability(environment()),
    { state: NOTIFICATION_CAPABILITY_STATES.PERMISSION_DEFAULT }
  );
  assert.deepEqual(
    await getNotificationCapability(environment({ permission: "denied" })),
    { state: NOTIFICATION_CAPABILITY_STATES.PERMISSION_DENIED }
  );
  assert.deepEqual(
    await getNotificationCapability(environment({ permission: "granted" })),
    { state: NOTIFICATION_CAPABILITY_STATES.PERMISSION_GRANTED_UNSUBSCRIBED }
  );
  const subscription = { endpoint: "https://push.example/device" };
  assert.deepEqual(
    await getNotificationCapability(environment({ permission: "granted", subscription })),
    { state: NOTIFICATION_CAPABILITY_STATES.SUBSCRIBED, subscription }
  );
});

