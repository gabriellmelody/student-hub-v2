import { useCallback, useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  PWA_UPDATE_CHECK_INTERVAL_MS,
  fetchLatestVersionMetadata,
  isServiceWorkerUpdateSupported,
  shouldCheckForServiceWorkerUpdate,
} from "../utils/pwaUpdateUtils.js";
import { CURRENT_DAYLO_VERSION, VERSION_METADATA_URL } from "../utils/appVersion.js";

export default function usePwaUpdate() {
  const registrationRef = useRef(null);
  const lastUpdateCheckRef = useRef(0);
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [latestVersion, setLatestVersion] = useState(CURRENT_DAYLO_VERSION);
  const [metadataError, setMetadataError] = useState(false);
  const [updateError, setUpdateError] = useState(false);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false
  );
  const supported = isServiceWorkerUpdateSupported();
  const checkForUpdate = useCallback(
    async ({ force = false } = {}) => {
      const registration = registrationRef.current;
      const now = Date.now();
      const visible =
        typeof document === "undefined" || document.visibilityState === "visible";
      const onlineNow = typeof navigator === "undefined" || navigator.onLine !== false;

      if (
        !force &&
        !shouldCheckForServiceWorkerUpdate({
          now,
          lastCheckAt: lastUpdateCheckRef.current,
          minIntervalMs: PWA_UPDATE_CHECK_INTERVAL_MS,
          online: onlineNow,
          visible,
          supported,
          hasRegistration: Boolean(registration),
        })
      ) {
        return false;
      }

      if (!registration?.update || !supported || !onlineNow || !visible) return false;

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

  const refreshLatestVersion = useCallback(async () => {
    const result = await fetchLatestVersionMetadata({ url: VERSION_METADATA_URL });
    if (result.ok) {
      setLatestVersion(result.version);
      setMetadataError(false);
      return result;
    }

    setMetadataError(true);
    return result;
  }, []);

  const checkNow = useCallback(async () => {
    if (checking) return { status: "ignored" };

    const onlineNow = typeof navigator === "undefined" || navigator.onLine !== false;
    setOnline(onlineNow);
    if (!onlineNow) {
      setMetadataError(false);
      return { status: "offline" };
    }

    setChecking(true);
    setMetadataError(false);

    try {
      const metadata = await refreshLatestVersion();
      const registrationChecked = await checkForUpdate({ force: true });
      return metadata.ok
        ? { status: "checked", latestVersion: metadata.version, registrationChecked }
        : { status: "metadata-error", registrationChecked };
    } finally {
      setChecking(false);
    }
  }, [checkForUpdate, checking, refreshLatestVersion]);

  useEffect(() => {
    void refreshLatestVersion();
  }, [refreshLatestVersion]);

  useEffect(() => {
    if (!supported) return undefined;

    function syncOnlineState() {
      setOnline(typeof navigator === "undefined" || navigator.onLine !== false);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void checkForUpdate();
      }
    }

    function handleOnline() {
      syncOnlineState();
      void checkForUpdate();
    }

    function handleOffline() {
      syncOnlineState();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
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
    checking,
    online,
    currentVersion: CURRENT_DAYLO_VERSION,
    latestVersion,
    metadataError,
    updateError,
    updateNow,
    dismissForSession,
    checkForUpdate,
    checkNow,
  };
}
