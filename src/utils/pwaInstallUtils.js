export const INSTALL_PROMOTION_DISMISSED_KEY = "daylo-install-suggestion-dismissed";

export function isStandaloneDisplay({
  matchMedia = globalThis.matchMedia,
  navigator = globalThis.navigator,
} = {}) {
  const displayModeStandalone =
    typeof matchMedia === "function" &&
    matchMedia("(display-mode: standalone)")?.matches === true;

  return Boolean(displayModeStandalone || navigator?.standalone === true);
}

export function isIosLikeDevice({ navigator = globalThis.navigator } = {}) {
  const platform = String(navigator?.platform || "");
  const userAgent = String(navigator?.userAgent || "");
  const maxTouchPoints = Number(navigator?.maxTouchPoints || 0);

  return Boolean(
    /iPad|iPhone|iPod/.test(platform) ||
      /iPad|iPhone|iPod/.test(userAgent) ||
      (platform === "MacIntel" && maxTouchPoints > 1)
  );
}

export function getInstallCapability({
  standalone = false,
  installed = false,
  nativePromptAvailable = false,
  iosLike = false,
} = {}) {
  if (standalone || installed) return "installed";
  if (nativePromptAvailable) return "native";
  if (iosLike) return "ios-instructions";
  return "unsupported";
}

export function getInstallActionLabel(capability) {
  if (capability === "native") return "Install DayLo";
  if (capability === "ios-instructions") return "How to install";
  return "";
}

export function getInstallStatusLabel(capability) {
  if (capability === "installed") return "Installed";
  if (capability === "unsupported") return "Not available in this browser";
  return "";
}

export function loadInstallSuggestionDismissed(storage = globalThis.localStorage) {
  if (!storage?.getItem) return false;

  try {
    return storage.getItem(INSTALL_PROMOTION_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function dismissInstallSuggestion(storage = globalThis.localStorage) {
  if (!storage?.setItem) return false;

  try {
    storage.setItem(INSTALL_PROMOTION_DISMISSED_KEY, "true");
    return true;
  } catch {
    return false;
  }
}

export function shouldShowInstallSuggestion({
  capability,
  dismissed = false,
  onboardingCompleted = false,
  blockingUiOpen = false,
  standalone = false,
  elapsedMs = 0,
  minimumDelayMs = 15000,
} = {}) {
  return Boolean(
    onboardingCompleted &&
      !dismissed &&
      !blockingUiOpen &&
      !standalone &&
      elapsedMs >= minimumDelayMs &&
      (capability === "native" || capability === "ios-instructions")
  );
}

export function getOfflineMessage(online = true) {
  return online === false
    ? "Offline — some Google features may be unavailable"
    : "";
}

export function didBrowserPromptInstall(userChoice = {}) {
  return userChoice?.outcome === "accepted";
}
