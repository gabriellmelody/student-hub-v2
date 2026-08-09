import assert from "node:assert/strict";
import test from "node:test";
import {
  CLASSROOM_SETUP_INTRO_STORAGE_KEY,
  clearClassroomSetupResume,
  getClassroomSetupStartPhase,
  loadClassroomSetupIntroSeen,
  loadClassroomSetupResume,
  markClassroomSetupIntroSeen,
  saveClassroomSetupResume,
  shouldShowClassroomSetupIntro,
} from "./classroomSetupTourUtils.js";

function createStorage() {
  const values = new Map();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function eligibleIntroState(overrides = {}) {
  return {
    introSeen: false,
    onboardingActive: false,
    releaseWelcomeOpen: false,
    guidedTourActive: false,
    blockingUiOpen: false,
    integrationsVisible: true,
    ...overrides,
  };
}

test("the Integrations introduction appears on its first suitable visit", () => {
  assert.equal(shouldShowClassroomSetupIntro(eligibleIntroState()), true);
});

test("Not now records the introduction and prevents automatic reappearance", () => {
  const storage = createStorage();

  assert.equal(markClassroomSetupIntroSeen(storage), true);
  assert.equal(storage.getItem(CLASSROOM_SETUP_INTRO_STORAGE_KEY), "seen");
  assert.equal(loadClassroomSetupIntroSeen(storage), true);
  assert.equal(
    shouldShowClassroomSetupIntro(eligibleIntroState({ introSeen: true })),
    false
  );
});

test("the Classroom introduction never overlaps the update modal or a tour", () => {
  assert.equal(
    shouldShowClassroomSetupIntro(
      eligibleIntroState({ releaseWelcomeOpen: true })
    ),
    false
  );
  assert.equal(
    shouldShowClassroomSetupIntro(
      eligibleIntroState({ guidedTourActive: true })
    ),
    false
  );
});

test("a disconnected Classroom setup starts at Connect Classroom", () => {
  assert.equal(getClassroomSetupStartPhase({ connected: false }), "connect");
});

test("connected Classroom setup skips completed phases", () => {
  assert.equal(
    getClassroomSetupStartPhase({ connected: true, courseCount: 0 }),
    "load-classes"
  );
  assert.equal(
    getClassroomSetupStartPhase({
      connected: true,
      courseCount: 4,
      includedCount: 2,
      linkedIncludedCount: 1,
    }),
    "link-subjects"
  );
  assert.equal(
    getClassroomSetupStartPhase({
      connected: true,
      courseCount: 4,
      includedCount: 2,
      linkedIncludedCount: 2,
      importedCount: 3,
    }),
    "manage"
  );
});

test("OAuth return restores only the next setup phase", () => {
  const storage = createStorage();
  const now = () => new Date("2026-08-01T10:00:00.000Z");

  assert.equal(saveClassroomSetupResume("load-classes", storage, now), true);
  assert.deepEqual(loadClassroomSetupResume(storage, now), {
    phase: "load-classes",
    updatedAt: "2026-08-01T10:00:00.000Z",
  });
  assert.equal(clearClassroomSetupResume(storage), true);
  assert.equal(loadClassroomSetupResume(storage, now), null);
});

test("stale OAuth resume state is discarded", () => {
  const storage = createStorage();

  saveClassroomSetupResume(
    "load-classes",
    storage,
    () => new Date("2026-08-01T08:00:00.000Z")
  );

  assert.equal(
    loadClassroomSetupResume(
      storage,
      () => new Date("2026-08-01T11:00:01.000Z")
    ),
    null
  );
});

test("successful OAuth resume moves to the next relevant setup step", () => {
  const storage = createStorage();
  const now = () => new Date("2026-08-01T10:00:00.000Z");

  saveClassroomSetupResume("load-classes", storage, now);
  const resume = loadClassroomSetupResume(storage, now);

  assert.equal(resume.phase, "load-classes");
  assert.equal(
    getClassroomSetupStartPhase({ connected: true, courseCount: 0 }, resume.phase),
    "load-classes"
  );
});

test("loaded classes advance to choosing or linking appropriately", () => {
  assert.equal(
    getClassroomSetupStartPhase({ connected: true, courseCount: 3, includedCount: 0 }),
    "choose-classes"
  );
  assert.equal(
    getClassroomSetupStartPhase({
      connected: true,
      courseCount: 3,
      includedCount: 2,
      linkedIncludedCount: 1,
    }),
    "link-subjects"
  );
});

test("imported state skips completed setup steps", () => {
  assert.equal(
    getClassroomSetupStartPhase({
      connected: true,
      courseCount: 3,
      includedCount: 2,
      linkedIncludedCount: 2,
      importedCount: 1,
      previewAssignmentCount: 5,
    }),
    "manage"
  );
});

test("replay starts safely from the current context", () => {
  assert.equal(
    getClassroomSetupStartPhase({ connected: true, courseCount: 0 }),
    "load-classes"
  );
  assert.equal(
    getClassroomSetupStartPhase({ connected: false, courseCount: 3 }),
    "connect"
  );
});

test("stale session setup phase cannot trap the user", () => {
  const storage = createStorage();
  storage.setItem(
    "daylo-classroom-setup-tour-resume",
    JSON.stringify({ phase: "choose-classes", updatedAt: "2026-08-01T08:00:00.000Z" })
  );

  assert.equal(
    loadClassroomSetupResume(storage, () => new Date("2026-08-01T12:00:00.000Z")),
    null
  );
  assert.equal(storage.getItem("daylo-classroom-setup-tour-resume"), null);
});
