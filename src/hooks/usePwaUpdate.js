import { useCallback, useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  PWA_UPDATE_CHECK_INTERVAL_MS,
  isServiceWorkerUpdateSupported,
  shouldCheckForServiceWorkerUpdate,
} from "../utils/pwaUpdateUtils.js";

export default function usePwaUpdate() {
  const registrationRef = useRef(null);
  const lastUpdateCheckRef = useRef(0);
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(false);
  const supported = isServiceWorkerUpdateSupported();
  const checkForUpdate = useCallback(
    async ({ force = false } = {}) => {
      const registration = registrationRef.current;
      const now = Date.now();
      const visible =
        typeof document === "undefined" || document.visibilityState === "visible";
      const online = typeof navigator === "undefined" || navigator.onLine !== false;

      if (
        !force &&
        !shouldCheckForServiceWorkerUpdate({
          now,
          lastCheckAt: lastUpdateCheckRef.current,
          minIntervalMs: PWA_UPDATE_CHECK_INTERVAL_MS,
          online,
          visible,
          supported,
          hasRegistration: Boolean(registration),
        })
      ) {
        return false;
      }

      if (!registration?.update || !supported || !online || !visible) return false;

      lastUpdateCheckRef.current = now;

      try {
        await registration.update();
        return true;
      } catch {
        return false;
      }
    },
    [supported]
  );


  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      registrationRef.current = registration || null;
      void checkForUpdate({ force: true });
    },
    onRegisterError() {
      registrationRef.current = null;
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (!supported) return undefined;

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void checkForUpdate();
      }
    }

    function handleOnline() {
      void checkForUpdate();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleOnline);
    };
  }, [checkForUpdate, supported]);

  const updateNow = useCallback(async () => {
    if (updating) return { status: "ignored" };

    setUpdating(true);
    setUpdateError(false);

    try {
      await updateServiceWorker(true);
      return { status: "updating" };
    } catch (error) {
      setUpdating(false);
      setUpdateError(true);
      return { status: "failed", error };
    }
  }, [updateServiceWorker, updating]);

  const dismissForSession = useCallback(() => {
    setSessionDismissed(true);
    setUpdateError(false);
  }, []);

  return {
    supported,
    needRefresh,
    sessionDismissed,
    updating,
    updateError,
    updateNow,
    dismissForSession,
    checkForUpdate,
  };
}
