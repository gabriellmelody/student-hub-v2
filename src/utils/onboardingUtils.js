import {
  REAL_CLASSROOM_COURSE_LINKS_STORAGE_KEY,
  findSubjectProfile,
} from "./appUtils.js";
import {
  createRealClassroomCourseLink,
  createSubjectFromRealClassroomCourse,
  findBestSubjectForClassroomCourse,
  getRealClassroomCourseId,
} from "./classroomCourseUtils.js";

export const ONBOARDING_DRAFT_STORAGE_KEY = "student-hub-onboarding-draft";
export const ONBOARDING_PLANNING_PREFERENCES_KEY =
  "student-hub-planning-preferences";
export const REAL_CLASSROOM_COURSE_SELECTIONS_KEY =
  "studentHub.realClassroomCourseSelections";

export const DEFAULT_ONBOARDING_PLANNING_PREFERENCES = {
  startTime: "16:30",
  endTime: "20:30",
  planStyle: "balanced",
};

const VALID_SETUP_ROUTES = new Set(["classroom", "manual"]);
const VALID_PLAN_STYLES = new Set(["balanced", "lighter", "maximum"]);

function isTime(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function normalizeOnboardingDraft(value) {
  const step = Math.min(4, Math.max(0, Number(value?.step) || 0));

  return {
    step,
    setupRoute: VALID_SETUP_ROUTES.has(value?.setupRoute)
      ? value.setupRoute
      : "",
  };
}

export function loadOnboardingDraft(storage = globalThis.localStorage) {
  try {
    return normalizeOnboardingDraft(
      JSON.parse(storage?.getItem(ONBOARDING_DRAFT_STORAGE_KEY) || "null")
    );
  } catch {
    return normalizeOnboardingDraft(null);
  }
}

export function saveOnboardingDraft(draft, storage = globalThis.localStorage) {
  const normalizedDraft = normalizeOnboardingDraft(draft);
  storage?.setItem(ONBOARDING_DRAFT_STORAGE_KEY, JSON.stringify(normalizedDraft));
  return normalizedDraft;
}

export function clearOnboardingDraft(storage = globalThis.localStorage) {
  storage?.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);
}

export function normalizeOnboardingPlanningPreferences(value) {
  return {
    startTime: isTime(value?.startTime)
      ? value.startTime
      : DEFAULT_ONBOARDING_PLANNING_PREFERENCES.startTime,
    endTime: isTime(value?.endTime)
      ? value.endTime
      : DEFAULT_ONBOARDING_PLANNING_PREFERENCES.endTime,
    planStyle: VALID_PLAN_STYLES.has(value?.planStyle)
      ? value.planStyle
      : DEFAULT_ONBOARDING_PLANNING_PREFERENCES.planStyle,
  };
}

export function loadOnboardingPlanningPreferences(
  storage = globalThis.localStorage
) {
  try {
    const saved = storage?.getItem(ONBOARDING_PLANNING_PREFERENCES_KEY);
    return saved ? normalizeOnboardingPlanningPreferences(JSON.parse(saved)) : null;
  } catch {
    return null;
  }
}

export function saveOnboardingPlanningPreferences(
  preferences,
  storage = globalThis.localStorage
) {
  const normalizedPreferences =
    normalizeOnboardingPlanningPreferences(preferences);
  storage?.setItem(
    ONBOARDING_PLANNING_PREFERENCES_KEY,
    JSON.stringify(normalizedPreferences)
  );
  return normalizedPreferences;
}

export function isPlanningFinishNextDay({ startTime, endTime }) {
  if (!isTime(startTime) || !isTime(endTime)) return false;
  return endTime <= startTime;
}

export function loadRealClassroomCourseSelections(
  storage = globalThis.localStorage
) {
  try {
    const parsed = JSON.parse(
      storage?.getItem(REAL_CLASSROOM_COURSE_SELECTIONS_KEY) || "{}"
    );
    return Object.fromEntries(
      Object.entries(parsed || {}).filter(([, selection]) =>
        ["included", "ignored"].includes(selection)
      )
    );
  } catch {
    return {};
  }
}

export function loadRealClassroomCourseLinks(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(
      storage?.getItem(REAL_CLASSROOM_COURSE_LINKS_STORAGE_KEY) || "{}"
    );
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function mergeIncludedClassroomSubjects({
  courses,
  selections,
  subjects,
  links,
  now = new Date(),
}) {
  const nextSubjects = [...subjects];
  const nextLinks = { ...links };

  courses.forEach((course) => {
    const courseId = getRealClassroomCourseId(course);
    if (!courseId || selections[courseId] !== "included") return;

    let subject =
      nextSubjects.find(
        (item) =>
          item.id === nextLinks[courseId]?.subjectId ||
          item.classroomCourseId === courseId
      ) || findBestSubjectForClassroomCourse(nextSubjects, course);

    if (!subject) {
      const candidate = createSubjectFromRealClassroomCourse(
        course,
        nextSubjects,
        now
      );
      subject = findSubjectProfile(nextSubjects, candidate.name) || candidate;
      if (subject === candidate) nextSubjects.push(candidate);
    }

    nextLinks[courseId] = createRealClassroomCourseLink(course, subject, now);
  });

  return { subjects: nextSubjects, links: nextLinks };
}

export function completeOnboardingProfile(profile) {
  return {
    ...profile,
    onboardingCompleted: true,
    source: profile?.source || "manual",
  };
}

export function shouldShowOnboarding(profile) {
  return profile?.onboardingCompleted !== true;
}

export function advanceOnboardingStep(step) {
  return Math.min(4, Math.max(0, Number(step) || 0) + 1);
}
