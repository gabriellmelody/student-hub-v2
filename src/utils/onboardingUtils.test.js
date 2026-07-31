import test from "node:test";
import assert from "node:assert/strict";
import {
  ONBOARDING_DRAFT_STORAGE_KEY,
  ONBOARDING_PLANNING_PREFERENCES_KEY,
  advanceOnboardingStep,
  completeOnboardingProfile,
  isPlanningFinishNextDay,
  loadOnboardingDraft,
  loadOnboardingPlanningPreferences,
  mergeIncludedClassroomSubjects,
  saveOnboardingDraft,
  saveOnboardingPlanningPreferences,
  shouldShowOnboarding,
} from "./onboardingUtils.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("Classroom and manual setup routes survive a refresh", () => {
  const storage = createStorage();

  saveOnboardingDraft({ step: 1, setupRoute: "classroom" }, storage);
  assert.deepEqual(loadOnboardingDraft(storage), {
    step: 1,
    setupRoute: "classroom",
  });

  saveOnboardingDraft({ step: 1, setupRoute: "manual" }, storage);
  assert.deepEqual(loadOnboardingDraft(storage), {
    step: 1,
    setupRoute: "manual",
  });
  assert.ok(storage.getItem(ONBOARDING_DRAFT_STORAGE_KEY));
});

test("included Classroom courses create and link Subjects without duplicates", () => {
  const course = {
    classroomCourseId: "course-1",
    name: "ISB Biology 2 S2026 P4",
  };
  const initial = mergeIncludedClassroomSubjects({
    courses: [course],
    selections: { "course-1": "included" },
    subjects: [],
    links: {},
    now: new Date("2026-08-01T10:00:00.000Z"),
  });
  const repeated = mergeIncludedClassroomSubjects({
    courses: [course],
    selections: { "course-1": "included" },
    subjects: initial.subjects,
    links: initial.links,
    now: new Date("2026-08-01T10:05:00.000Z"),
  });

  assert.equal(initial.subjects.length, 1);
  assert.equal(initial.subjects[0].name, "Biology");
  assert.equal(repeated.subjects.length, 1);
  assert.equal(repeated.links["course-1"].subjectId, initial.subjects[0].id);
});

test("ignored Classroom courses do not create Subjects", () => {
  const result = mergeIncludedClassroomSubjects({
    courses: [{ classroomCourseId: "ignored", name: "English" }],
    selections: { ignored: "ignored" },
    subjects: [],
    links: {},
  });

  assert.deepEqual(result.subjects, []);
  assert.deepEqual(result.links, {});
});

test("Calendar can be skipped and onboarding advances to planning", () => {
  assert.equal(advanceOnboardingStep(2), 3);
});

test("planning preferences persist with an overnight finish", () => {
  const storage = createStorage();
  const preferences = saveOnboardingPlanningPreferences(
    { startTime: "22:30", endTime: "01:00", planStyle: "lighter" },
    storage
  );

  assert.deepEqual(loadOnboardingPlanningPreferences(storage), preferences);
  assert.equal(isPlanningFinishNextDay(preferences), true);
  assert.ok(storage.getItem(ONBOARDING_PLANNING_PREFERENCES_KEY));
});

test("onboarding can finish without Google connections or demo data", () => {
  const profile = completeOnboardingProfile({
    schoolSystem: "",
    onboardingCompleted: false,
    source: "manual",
  });

  assert.equal(profile.onboardingCompleted, true);
  assert.equal(profile.source, "manual");
  assert.equal(shouldShowOnboarding(profile), false);
});

test("existing users stay complete while restarted users see onboarding", () => {
  const existingProfile = {
    schoolSystem: "IB",
    onboardingCompleted: true,
    source: "manual",
  };

  assert.equal(shouldShowOnboarding(existingProfile), false);
  assert.equal(
    shouldShowOnboarding({ ...existingProfile, onboardingCompleted: false }),
    true
  );
  assert.deepEqual(completeOnboardingProfile(existingProfile), existingProfile);
});
