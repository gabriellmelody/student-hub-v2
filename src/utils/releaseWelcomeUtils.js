export const RELEASE_WELCOME_STORAGE_KEY = "daylo-last-seen-version";

export function loadAcknowledgedReleaseVersion(
  storage = globalThis.localStorage
) {
  if (!storage?.getItem) return "";

  try {
    return String(storage.getItem(RELEASE_WELCOME_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

export function acknowledgeReleaseVersion(
  version,
  storage = globalThis.localStorage
) {
  const normalizedVersion = String(version || "").trim();

  if (!normalizedVersion || !storage?.setItem) return false;

  try {
    storage.setItem(RELEASE_WELCOME_STORAGE_KEY, normalizedVersion);
    return true;
  } catch {
    return false;
  }
}

export function shouldShowReleaseWelcome({
  currentVersion,
  lastSeenVersion,
  activePage,
  onboardingCompleted,
  guidedTourActive,
  gettingStartedTourSettled,
  blockingUiOpen,
  tourStartPending,
}) {
  return Boolean(
    currentVersion &&
      currentVersion !== lastSeenVersion &&
      activePage === "home" &&
      onboardingCompleted &&
      !guidedTourActive &&
      gettingStartedTourSettled &&
      !blockingUiOpen &&
      !tourStartPending
  );
}

export function getInitialTourExitAction(tour, status) {
  const initialTourEnded = Boolean(
    tour?.id === "getting-started" &&
      (status === "completed" || status === "skipped")
  );

  return {
    returnHome: initialTourEnded,
    checkReleaseWelcome: initialTourEnded,
  };
}
