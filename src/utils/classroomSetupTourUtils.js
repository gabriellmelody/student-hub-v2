export const CLASSROOM_SETUP_INTRO_STORAGE_KEY =
  "daylo-classroom-setup-intro-seen";
export const CLASSROOM_SETUP_RESUME_STORAGE_KEY =
  "daylo-classroom-setup-tour-resume";
export const CLASSROOM_SETUP_TOUR_ID = "google-classroom-setup";

const RESUME_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const VALID_PHASES = new Set([
  "connect",
  "load-classes",
  "choose-classes",
  "link-subjects",
  "preview-assignments",
  "import-assignments",
  "manage",
]);

export function loadClassroomSetupIntroSeen(storage = globalThis.localStorage) {
  if (!storage?.getItem) return false;

  try {
    return storage.getItem(CLASSROOM_SETUP_INTRO_STORAGE_KEY) === "seen";
  } catch {
    return false;
  }
}

export function markClassroomSetupIntroSeen(storage = globalThis.localStorage) {
  if (!storage?.setItem) return false;

  try {
    storage.setItem(CLASSROOM_SETUP_INTRO_STORAGE_KEY, "seen");
    return true;
  } catch {
    return false;
  }
}

export function shouldShowClassroomSetupIntro({
  introSeen,
  onboardingActive,
  releaseWelcomeOpen,
  guidedTourActive,
  blockingUiOpen,
  integrationsVisible,
}) {
  return Boolean(
    integrationsVisible &&
      !introSeen &&
      !onboardingActive &&
      !releaseWelcomeOpen &&
      !guidedTourActive &&
      !blockingUiOpen
  );
}

export function getClassroomSetupStartPhase(context = {}, resumePhase = "") {
  if (!context.connected) return "connect";
  if ((Number(context.courseCount) || 0) === 0) return "load-classes";
  if ((Number(context.includedCount) || 0) === 0) return "choose-classes";
  if (
    (Number(context.linkedIncludedCount) || 0) <
    (Number(context.includedCount) || 0)
  ) {
    return "link-subjects";
  }
  if ((Number(context.importedCount) || 0) > 0) return "manage";
  if ((Number(context.previewAssignmentCount) || 0) > 0) {
    return "import-assignments";
  }

  if (VALID_PHASES.has(resumePhase) && resumePhase === "import-assignments") {
    return resumePhase;
  }

  return "preview-assignments";
}

export function saveClassroomSetupResume(
  phase,
  storage = globalThis.sessionStorage,
  now = () => new Date()
) {
  if (!VALID_PHASES.has(phase) || !storage?.setItem) return false;

  try {
    storage.setItem(
      CLASSROOM_SETUP_RESUME_STORAGE_KEY,
      JSON.stringify({ phase, updatedAt: now().toISOString() })
    );
    return true;
  } catch {
    return false;
  }
}

export function loadClassroomSetupResume(
  storage = globalThis.sessionStorage,
  now = () => new Date()
) {
  if (!storage?.getItem) return null;

  try {
    const parsed = JSON.parse(
      storage.getItem(CLASSROOM_SETUP_RESUME_STORAGE_KEY) || "null"
    );
    const updatedAt = Date.parse(parsed?.updatedAt || "");
    const currentTime = now().getTime();
    const valid =
      VALID_PHASES.has(parsed?.phase) &&
      Number.isFinite(updatedAt) &&
      Number.isFinite(currentTime) &&
      currentTime >= updatedAt &&
      currentTime - updatedAt <= RESUME_MAX_AGE_MS;

    if (valid) return { phase: parsed.phase, updatedAt: parsed.updatedAt };

    storage.removeItem?.(CLASSROOM_SETUP_RESUME_STORAGE_KEY);
    return null;
  } catch {
    storage.removeItem?.(CLASSROOM_SETUP_RESUME_STORAGE_KEY);
    return null;
  }
}

export function clearClassroomSetupResume(storage = globalThis.sessionStorage) {
  if (!storage?.removeItem) return false;

  try {
    storage.removeItem(CLASSROOM_SETUP_RESUME_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
