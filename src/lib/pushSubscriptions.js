import { getIntegrationAuthHeaders } from "../utils/integrationAuthUtils.js";
import {
  NOTIFICATION_CAPABILITY_STATES,
  getNotificationCapability,
  urlBase64ToUint8Array,
} from "../utils/notificationPushUtils.js";

export const PUSH_OWNER_STORAGE_KEY = "daylo-push-owner-user-id";
export const PUSH_ENDPOINT_STORAGE_KEY = "daylo-push-endpoint";

function readLocal(storage, key) {
  try {
    return storage?.getItem?.(key) || "";
  } catch {
    return "";
  }
}

function writeLocal(storage, key, value) {
  try {
    if (value) storage?.setItem?.(key, value);
    else storage?.removeItem?.(key);
  } catch {
    // Browser storage failure must not block subscription cleanup.
  }
}

function storeOwnership(storage, userId, endpoint) {
  writeLocal(storage, PUSH_OWNER_STORAGE_KEY, userId);
  writeLocal(storage, PUSH_ENDPOINT_STORAGE_KEY, endpoint);
}

function clearOwnership(storage) {
  writeLocal(storage, PUSH_OWNER_STORAGE_KEY, "");
  writeLocal(storage, PUSH_ENDPOINT_STORAGE_KEY, "");
}

export function serializePushSubscription(subscription) {
  const json = subscription?.toJSON?.() || subscription;
  return {
    endpoint: String(json?.endpoint || ""),
    keys: {
      p256dh: String(json?.keys?.p256dh || ""),
      auth: String(json?.keys?.auth || ""),
    },
  };
}

async function callSubscriptionApi(action, accessToken, body, fetchImpl = fetch) {
  const response = await fetchImpl(`/api/notifications/${action}`, {
    method: "POST",
    headers: getIntegrationAuthHeaders(accessToken, {
      Accept: "application/json",
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) {
    const error = new Error(result?.status || "notification_subscription_failed");
    error.status = result?.status || "notification_subscription_failed";
    throw error;
  }
  return result;
}

export async function enableNotifications({
  userId,
  accessToken,
  vapidPublicKey = import.meta.env.VITE_DAYLO_VAPID_PUBLIC_KEY,
  navigatorObject = globalThis.navigator,
  notificationApi = globalThis.Notification,
  pushManagerApi = globalThis.PushManager,
  storage = globalThis.localStorage,
  fetchImpl = fetch,
  windowObject = globalThis.window,
} = {}) {
  if (!userId || !accessToken) throw new Error("daylo_auth_required");
  const capability = await getNotificationCapability({
    windowObject,
    navigatorObject,
    notificationApi,
    pushManagerApi,
  });
  if (capability.state === NOTIFICATION_CAPABILITY_STATES.UNSUPPORTED ||
      capability.state === NOTIFICATION_CAPABILITY_STATES.IOS_INSTALL_REQUIRED ||
      capability.state === NOTIFICATION_CAPABILITY_STATES.PERMISSION_DENIED) {
    return capability;
  }
  let permission = notificationApi.permission;
  if (permission !== "granted") permission = await notificationApi.requestPermission();
  if (permission !== "granted") {
    return {
      state: permission === "denied"
        ? NOTIFICATION_CAPABILITY_STATES.PERMISSION_DENIED
        : NOTIFICATION_CAPABILITY_STATES.PERMISSION_DEFAULT,
    };
  }
  try {
    const registration = await navigatorObject.serviceWorker.ready;
    let previous = await registration.pushManager.getSubscription();
    const storedOwner = readLocal(storage, PUSH_OWNER_STORAGE_KEY);
    if (previous && storedOwner !== userId) {
      await previous.unsubscribe?.();
      previous = null;
      clearOwnership(storage);
    }
    const subscription = previous || (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));
    const serialized = serializePushSubscription(subscription);
    await callSubscriptionApi("subscribe", accessToken, {
      subscription: serialized,
      platform: String(navigatorObject.platform || "").slice(0, 40),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    }, fetchImpl);
    storeOwnership(storage, userId, serialized.endpoint);
    return { state: NOTIFICATION_CAPABILITY_STATES.SUBSCRIBED, subscription };
  } catch (error) {
    if (error?.status === "subscription_owner_conflict") {
      try {
        const registration = await navigatorObject.serviceWorker.ready;
        await (await registration.pushManager.getSubscription())?.unsubscribe?.();
      } catch {
        // The server still refused the cross-account ownership transfer.
      }
      clearOwnership(storage);
    }
    return { state: NOTIFICATION_CAPABILITY_STATES.ERROR, error };
  }
}

export async function cleanupNotificationSubscription({
  accessToken,
  navigatorObject = globalThis.navigator,
  storage = globalThis.localStorage,
  fetchImpl = fetch,
} = {}) {
  const storedEndpoint = readLocal(storage, PUSH_ENDPOINT_STORAGE_KEY);
  let subscription = null;
  try {
    const registration = await navigatorObject?.serviceWorker?.ready;
    subscription = await registration?.pushManager?.getSubscription?.();
  } catch {
    // Fall back to the locally remembered endpoint.
  }
  const endpoint = subscription?.endpoint || storedEndpoint;
  try {
    await subscription?.unsubscribe?.();
  } catch {
    // Cleanup is best effort and must not trap the user in their account.
  }
  if (accessToken && endpoint) {
    try {
      await callSubscriptionApi("unsubscribe", accessToken, { endpoint }, fetchImpl);
    } catch {
      // The invalid browser endpoint can also be retired after a permanent push failure.
    }
  }
  clearOwnership(storage);
  return { state: NOTIFICATION_CAPABILITY_STATES.PERMISSION_GRANTED_UNSUBSCRIBED };
}

export async function reconcileNotificationSubscription({
  userId,
  accessToken,
  navigatorObject = globalThis.navigator,
  notificationApi = globalThis.Notification,
  pushManagerApi = globalThis.PushManager,
  storage = globalThis.localStorage,
  fetchImpl = fetch,
  windowObject = globalThis.window,
} = {}) {
  const capability = await getNotificationCapability({
    windowObject,
    navigatorObject,
    notificationApi,
    pushManagerApi,
  });
  const storedOwner = readLocal(storage, PUSH_OWNER_STORAGE_KEY);
  const storedEndpoint = readLocal(storage, PUSH_ENDPOINT_STORAGE_KEY);
  const subscription = capability.subscription || null;

  if (!userId || !accessToken) return capability;
  if (storedOwner && storedOwner !== userId) {
    try { await subscription?.unsubscribe?.(); } catch { /* Best effort. */ }
    clearOwnership(storage);
    return { state: NOTIFICATION_CAPABILITY_STATES.PERMISSION_GRANTED_UNSUBSCRIBED };
  }
  if (capability.state === NOTIFICATION_CAPABILITY_STATES.PERMISSION_DENIED || !subscription) {
    if (storedOwner === userId && storedEndpoint) {
      try {
        await callSubscriptionApi("unsubscribe", accessToken, { endpoint: storedEndpoint }, fetchImpl);
      } catch {
        // A stale endpoint will also be retired later after a permanent push failure.
      }
    }
    clearOwnership(storage);
    return capability;
  }
  if (!storedOwner) {
    await subscription.unsubscribe?.();
    clearOwnership(storage);
    return { state: NOTIFICATION_CAPABILITY_STATES.PERMISSION_GRANTED_UNSUBSCRIBED };
  }
  if (storedEndpoint && storedEndpoint !== subscription.endpoint) {
    try {
      await callSubscriptionApi("unsubscribe", accessToken, { endpoint: storedEndpoint }, fetchImpl);
    } catch {
      // Continue by registering the current browser endpoint.
    }
  }
  try {
    const serialized = serializePushSubscription(subscription);
    await callSubscriptionApi("subscribe", accessToken, {
      subscription: serialized,
      platform: String(navigatorObject.platform || "").slice(0, 40),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    }, fetchImpl);
    storeOwnership(storage, userId, serialized.endpoint);
    return { state: NOTIFICATION_CAPABILITY_STATES.SUBSCRIBED, subscription };
  } catch (error) {
    return { state: NOTIFICATION_CAPABILITY_STATES.ERROR, error };
  }
}
