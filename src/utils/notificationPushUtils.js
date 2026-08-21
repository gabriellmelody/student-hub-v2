import { isIosLikeDevice, isStandaloneDisplay } from "./pwaInstallUtils.js";

export const NOTIFICATION_CAPABILITY_STATES = Object.freeze({
  UNSUPPORTED: "unsupported",
  IOS_INSTALL_REQUIRED: "ios_install_required",
  PERMISSION_DEFAULT: "permission_default",
  PERMISSION_DENIED: "permission_denied",
  PERMISSION_GRANTED_UNSUBSCRIBED: "permission_granted_unsubscribed",
  SUBSCRIBED: "subscribed",
  ERROR: "subscription_error",
});

export function urlBase64ToUint8Array(value) {
  const normalized = String(value || "").trim().replace(/-/g, "+").replace(/_/g, "/");
  if (!normalized) throw new Error("vapid_public_key_missing");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  let decoded;
  try {
    decoded = globalThis.atob(padded);
  } catch {
    throw new Error("vapid_public_key_invalid");
  }
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export async function getNotificationCapability({
  windowObject = globalThis.window,
  navigatorObject = globalThis.navigator,
  notificationApi = globalThis.Notification,
  pushManagerApi = globalThis.PushManager,
  registration = null,
} = {}) {
  const secure = windowObject?.isSecureContext === true;
  const hasRequiredApis = Boolean(
    secure &&
      navigatorObject?.serviceWorker &&
      pushManagerApi &&
      notificationApi
  );
  if (!hasRequiredApis) return { state: NOTIFICATION_CAPABILITY_STATES.UNSUPPORTED };
  if (
    isIosLikeDevice({ navigator: navigatorObject }) &&
    !isStandaloneDisplay({ matchMedia: windowObject?.matchMedia, navigator: navigatorObject })
  ) {
    return { state: NOTIFICATION_CAPABILITY_STATES.IOS_INSTALL_REQUIRED };
  }
  if (notificationApi.permission === "denied") {
    return { state: NOTIFICATION_CAPABILITY_STATES.PERMISSION_DENIED };
  }
  if (notificationApi.permission !== "granted") {
    return { state: NOTIFICATION_CAPABILITY_STATES.PERMISSION_DEFAULT };
  }
  try {
    const activeRegistration = registration || (await navigatorObject.serviceWorker.ready);
    const subscription = await activeRegistration?.pushManager?.getSubscription?.();
    return subscription
      ? { state: NOTIFICATION_CAPABILITY_STATES.SUBSCRIBED, subscription }
      : { state: NOTIFICATION_CAPABILITY_STATES.PERMISSION_GRANTED_UNSUBSCRIBED };
  } catch (error) {
    return { state: NOTIFICATION_CAPABILITY_STATES.ERROR, error };
  }
}

