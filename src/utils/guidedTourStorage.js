export const GUIDED_TOUR_STORAGE_KEY = "student-hub-guided-tours";
export const GUIDED_TOUR_STORAGE_VERSION = 1;

function createEmptyProgress() {
  return { version: GUIDED_TOUR_STORAGE_VERSION, tours: {} };
}

function normalizeRecord(record) {
  if (
    !record ||
    !["completed", "skipped"].includes(record.status) ||
    !Number.isInteger(record.version) ||
    record.version < 1 ||
    typeof record.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(record.updatedAt))
  ) {
    return null;
  }

  return {
    status: record.status,
    version: record.version,
    updatedAt: record.updatedAt,
  };
}

export function loadGuidedTourProgress(storage = globalThis.localStorage) {
  if (!storage?.getItem) return createEmptyProgress();

  try {
    const parsed = JSON.parse(storage.getItem(GUIDED_TOUR_STORAGE_KEY) || "null");
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Number.isInteger(parsed.version) ||
      parsed.version < 1 ||
      !parsed.tours ||
      typeof parsed.tours !== "object" ||
      Array.isArray(parsed.tours)
    ) {
      return createEmptyProgress();
    }

    const tours = Object.entries(parsed.tours).reduce((safeTours, [id, record]) => {
      const normalized = normalizeRecord(record);
      if (normalized) safeTours[id] = normalized;
      return safeTours;
    }, {});

    return { version: GUIDED_TOUR_STORAGE_VERSION, tours };
  } catch {
    return createEmptyProgress();
  }
}

export function saveGuidedTourOutcome(
  tour,
  status,
  storage = globalThis.localStorage,
  now = () => new Date()
) {
  if (
    !storage?.setItem ||
    !tour?.id ||
    !Number.isInteger(tour.version) ||
    !["completed", "skipped"].includes(status)
  ) {
    return false;
  }

  let updatedAt;

  try {
    updatedAt = now().toISOString();
  } catch {
    return false;
  }

  const progress = loadGuidedTourProgress(storage);
  progress.tours[tour.id] = {
    status,
    version: tour.version,
    updatedAt,
  };

  try {
    storage.setItem(GUIDED_TOUR_STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function isGuidedTourEligible(tour, progress = loadGuidedTourProgress()) {
  if (!tour?.id || !Number.isInteger(tour.version)) return false;

  return progress.tours?.[tour.id]?.version !== tour.version;
}

export function shouldAutomaticallyStartGettingStarted({
  onboardingCompleted,
  blockingUiOpen,
  oauthCallbackActive,
  tourAlreadyActive,
  eligible,
}) {
  return Boolean(
    onboardingCompleted &&
      !blockingUiOpen &&
      !oauthCallbackActive &&
      !tourAlreadyActive &&
      eligible
  );
}
