import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dismissInstallSuggestion,
  getInstallCapability,
  isIosLikeDevice,
  isStandaloneDisplay,
  loadInstallSuggestionDismissed,
} from "../utils/pwaInstallUtils.js";

export default function usePwaInstall() {
  const promptEventRef = useRef(null);
  const [nativePromptAvailable, setNativePromptAvailable] = useState(false);
  const [installed, setInstalled] = useState(() => isStandaloneDisplay());
  const [iosLike, setIosLike] = useState(() => isIosLikeDevice());
  const [suggestionDismissed, setSuggestionDismissed] = useState(() =>
    loadInstallSuggestionDismissed()
  );
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false
  );

  useEffect(() => {
    setInstalled(isStandaloneDisplay());
    setIosLike(isIosLikeDevice());
  }, []);

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      if (isStandaloneDisplay()) return;
      event.preventDefault();
      promptEventRef.current = event;
      setNativePromptAvailable(true);
    }

    function handleInstalled() {
      promptEventRef.current = null;
      setNativePromptAvailable(false);
      setInstalled(true);
      dismissInstallSuggestion();
      setSuggestionDismissed(true);
    }

    function syncOnlineState() {
      setOnline(navigator.onLine !== false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("online", syncOnlineState);
    window.addEventListener("offline", syncOnlineState);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("online", syncOnlineState);
      window.removeEventListener("offline", syncOnlineState);
    };
  }, []);

  const capability = useMemo(
    () =>
      getInstallCapability({
        standalone: installed || isStandaloneDisplay(),
        installed,
        nativePromptAvailable,
        iosLike,
      }),
    [installed, iosLike, nativePromptAvailable]
  );

  const requestInstall = useCallback(async () => {
    if (capability === "installed") return { outcome: "installed" };
    if (capability === "ios-instructions") return { outcome: "manual" };

    const promptEvent = promptEventRef.current;

    if (!promptEvent || capability !== "native") {
      return { outcome: "unavailable" };
    }

    promptEventRef.current = null;
    setNativePromptAvailable(false);

    try {
      await promptEvent.prompt();
      return (await promptEvent.userChoice) || { outcome: "dismissed" };
    } catch {
      return { outcome: "dismissed" };
    }
  }, [capability]);

  const dismissSuggestion = useCallback(() => {
    dismissInstallSuggestion();
    setSuggestionDismissed(true);
  }, []);

  return {
    capability,
    installed: capability === "installed",
    iosLike,
    nativePromptAvailable,
    online,
    suggestionDismissed,
    requestInstall,
    dismissSuggestion,
  };
}
