import { useCallback, useEffect, useRef, useState } from "react";
import {
  cleanupNotificationSubscription,
  enableNotifications,
  reconcileNotificationSubscription,
} from "../lib/pushSubscriptions.js";
import {
  NOTIFICATION_CAPABILITY_STATES,
  getNotificationCapability,
} from "../utils/notificationPushUtils.js";

export default function useNotificationPush({ userId = "", accessToken = "" } = {}) {
  const previousAuthRef = useRef({ userId: "", accessToken: "" });
  const [capability, setCapability] = useState({
    state: NOTIFICATION_CAPABILITY_STATES.UNSUPPORTED,
  });

  const refresh = useCallback(async () => {
    const next = userId && accessToken
      ? await reconcileNotificationSubscription({ userId, accessToken })
      : await getNotificationCapability();
    setCapability(next);
    return next;
  }, [accessToken, userId]);

  useEffect(() => {
    const previous = previousAuthRef.current;
    previousAuthRef.current = { userId, accessToken };
    if (!userId && previous.userId && previous.accessToken) {
      void cleanupNotificationSubscription({ accessToken: previous.accessToken }).then(setCapability);
      return;
    }
    void refresh();
  }, [accessToken, refresh, userId]);

  const enable = useCallback(async () => {
    const next = await enableNotifications({ userId, accessToken });
    setCapability(next);
    return next;
  }, [accessToken, userId]);

  const cleanupForLogout = useCallback(async () => {
    const next = await cleanupNotificationSubscription({ accessToken });
    setCapability(next);
    return next;
  }, [accessToken]);

  const disableThisDevice = useCallback(async () => {
    const next = await cleanupNotificationSubscription({ accessToken });
    setCapability(next);
    return next;
  }, [accessToken]);

  return {
    ...capability,
    enableNotifications: enable,
    reconcile: refresh,
    cleanupForLogout,
    disableThisDevice,
  };
}
