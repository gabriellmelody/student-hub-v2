export const PWA_UPDATE_CHECK_INTERVAL_MS = 60 * 1000;

export function isServiceWorkerUpdateSupported({
  navigator = globalThis.navigator,
  window = globalThis.window,
} = {}) {
  return Boolean(window && navigator && "serviceWorker" in navigator);
}

export function shouldShowUpdatePrompt({
  needRefresh = false,
  blockingUiOpen = false,
  sessionDismissed = false,
  supported = true,
} = {}) {
  return Boolean(needRefresh && supported && !blockingUiOpen && !sessionDismissed);
}

export function shouldCheckForServiceWorkerUpdate({
  now = Date.now(),
  lastCheckAt = 0,
  minIntervalMs = PWA_UPDATE_CHECK_INTERVAL_MS,
  online = true,
  visible = true,
  supported = true,
  hasRegistration = true,
} = {}) {
  return Boolean(
    supported &&
      hasRegistration &&
      online &&
      visible &&
      now - lastCheckAt >= minIntervalMs
  );
}

export function createUpdateActionController(updateServiceWorker) {
  let inProgress = false;
  let calls = 0;

  return {
    get inProgress() {
      return inProgress;
    },
    get calls() {
      return calls;
    },
    async updateNow() {
      if (inProgress) return { status: "ignored" };
      if (typeof updateServiceWorker !== "function") {
        return { status: "unsupported" };
      }

      inProgress = true;
      calls += 1;

      try {
        await updateServiceWorker(true);
        return { status: "updating" };
      } catch (error) {
        inProgress = false;
        return { status: "failed", error };
      }
    },
  };
}

export function getUpdateErrorMessage(failed = false) {
  return failed ? "DayLo couldn't update. Try again in a moment." : "";
}
