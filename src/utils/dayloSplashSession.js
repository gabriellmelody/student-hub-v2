export const DAYLO_OPENING_SPLASH_SESSION_KEY =
  "daylo-opening-splash-seen";

export const DAYLO_SPLASH_NORMAL_DURATION_MS = 1650;
export const DAYLO_SPLASH_REDUCED_DURATION_MS = 420;

export function getDayloSplashSafetyDuration(reducedMotion = false) {
  return (
    (reducedMotion
      ? DAYLO_SPLASH_REDUCED_DURATION_MS
      : DAYLO_SPLASH_NORMAL_DURATION_MS) + 250
  );
}

export function createDayloSplashSessionController(
  getStorage = () => globalThis.sessionStorage
) {
  let claimedInRuntime = false;

  function writeSessionState(value) {
    try {
      getStorage()?.setItem(DAYLO_OPENING_SPLASH_SESSION_KEY, value);
    } catch {
      // The in-memory claim still prevents repeated playback this runtime.
    }
  }

  return {
    shouldShow() {
      if (claimedInRuntime) return false;

      try {
        if (getStorage()?.getItem(DAYLO_OPENING_SPLASH_SESSION_KEY)) {
          claimedInRuntime = true;
          return false;
        }
      } catch {
        // Storage is optional; fail open without blocking app startup.
      }

      claimedInRuntime = true;
      writeSessionState("started");
      return true;
    },

    complete() {
      claimedInRuntime = true;
      writeSessionState("complete");
    },
  };
}

export const dayloSplashSession = createDayloSplashSessionController();
