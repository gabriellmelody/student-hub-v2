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


export function compareDayloVersions(a = "", b = "") {
  const left = String(a || "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = String(b || "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(left.length, right.length, 3);

  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index] || 0;
    const rightPart = right[index] || 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}

export function getUpdateAvailability({
  currentVersion = "",
  latestVersion = "",
  needRefresh = false,
  online = true,
  checking = false,
  error = false,
} = {}) {
  if (checking) return "checking";
  if (online === false) return "offline";
  if (error) return "error";
  if (needRefresh) return "update-waiting";
  if (latestVersion && compareDayloVersions(latestVersion, currentVersion) > 0) {
    return "update-available";
  }
  return "up-to-date";
}

export function getInstallationStatus(capability = "unsupported") {
  if (capability === "installed") {
    return { status: "installed", label: "Installed on this device", actionLabel: "" };
  }
  if (capability === "native") {
    return { status: "browser", label: "Using DayLo in your browser", actionLabel: "Install DayLo" };
  }
  if (capability === "ios-instructions") {
    return { status: "browser", label: "Using DayLo in your browser", actionLabel: "How to install" };
  }
  return { status: "unavailable", label: "Install option not available yet", actionLabel: "" };
}

export async function fetchLatestVersionMetadata({
  fetchImpl = globalThis.fetch,
  url = "/version.json",
  cacheBust = Date.now(),
} = {}) {
  if (typeof fetchImpl !== "function") {
    return { ok: false, version: "", error: "unsupported" };
  }

  const separator = url.includes("?") ? "&" : "?";
  const requestUrl = `${url}${separator}t=${encodeURIComponent(String(cacheBust))}`;

  try {
    const response = await fetchImpl(requestUrl, { cache: "no-store" });
    if (!response?.ok) return { ok: false, version: "", error: "status" };

    const metadata = await response.json();
    const version = String(metadata?.version || "").trim();
    if (!version) return { ok: false, version: "", error: "empty" };

    return { ok: true, version };
  } catch (error) {
    return { ok: false, version: "", error };
  }
}

export function createManualUpdateCheckController({
  fetchLatestVersion = async () => ({ ok: true, version: "" }),
  registrationUpdate = async () => {},
  getOnline = () => true,
} = {}) {
  let checking = false;
  let registrationCalls = 0;

  return {
    get checking() {
      return checking;
    },
    get registrationCalls() {
      return registrationCalls;
    },
    async check() {
      if (checking) return { status: "ignored" };
      if (getOnline() === false) return { status: "offline" };

      checking = true;

      try {
        const metadata = await fetchLatestVersion();
        registrationCalls += 1;
        await registrationUpdate();
        return metadata.ok
          ? { status: "checked", latestVersion: metadata.version }
          : { status: "metadata-error" };
      } catch (error) {
        return { status: "failed", error };
      } finally {
        checking = false;
      }
    },
  };
}
