import assert from "node:assert/strict";
import test from "node:test";

import {
  formatSubjectCourseLabel,
  getDefaultSubjectLevel,
  getSubjectLevelLabel,
  getSubjectLevelOptions,
  loadSubjects,
  reorderSubjects,
} from "./appUtils.js";

function subject(overrides = {}) {
  return {
    id: overrides.id || "subject-1",
    name: overrides.name || "Biology",
    courseSystem: overrides.courseSystem || "IB",
    level: overrides.level || "SL",
    currentGrade: overrides.currentGrade || "5",
    targetGrade: overrides.targetGrade || "7",
    colour: overrides.colour || "#73a8df",
    source: overrides.source || "manual",
    classroomCourseId: overrides.classroomCourseId || null,
    externalId: overrides.externalId || null,
    importedAt: overrides.importedAt || null,
    lastSyncedAt: overrides.lastSyncedAt || null,
  };
}

function withMockSubjectStorage(storedSubjects, run) {
  const originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem(key) {
      return key === "student-hub-subjects" ? JSON.stringify(storedSubjects) : null;
    },
  };

  try {
    return run();
  } finally {
    if (originalLocalStorage === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = originalLocalStorage;
    }
  }
}

test("IB SL renders clearly as Standard Level (SL)", () => {
  assert.equal(getSubjectLevelLabel("IB", "SL"), "Standard Level (SL)");
  assert.equal(
    formatSubjectCourseLabel(subject({ courseSystem: "IB", level: "SL" })),
    "IB · Standard Level (SL)"
  );
});

test("IB HL renders clearly as Higher Level (HL)", () => {
  assert.equal(getSubjectLevelLabel("IB", "HL"), "Higher Level (HL)");
  assert.equal(
    formatSubjectCourseLabel(subject({ courseSystem: "IB", level: "HL" })),
    "IB · Higher Level (HL)"
  );
});

test("existing stored IB values remain compatible", () => {
  const loaded = withMockSubjectStorage(
    [subject({ id: "ib-sl", level: "SL" }), subject({ id: "ib-hl", level: "HL" })],
    () => loadSubjects()
  );

  assert.deepEqual(loaded.map((item) => item.level), ["SL", "HL"]);
  assert.deepEqual(
    loaded.map((item) => getSubjectLevelLabel(item)),
    ["Standard Level (SL)", "Higher Level (HL)"]
  );
});

test("non-IB Subjects retain appropriate existing level behaviour", () => {
  assert.equal(formatSubjectCourseLabel(subject({ courseSystem: "AP", level: "AP" })), "AP");
  assert.equal(
    formatSubjectCourseLabel(subject({ courseSystem: "GCSE", level: "Higher" })),
    "GCSE · Higher"
  );
  assert.equal(getDefaultSubjectLevel("A-level"), "Standard");
});

test("Subject reorder persists through array order", () => {
  const subjects = [subject({ id: "a" }), subject({ id: "b" }), subject({ id: "c" })];
  const reordered = reorderSubjects(subjects, "c", 0);
  const loaded = withMockSubjectStorage(reordered, () => loadSubjects());

  assert.deepEqual(loaded.map((item) => item.id), ["c", "a", "b"]);
});

test("reorder preserves Subject IDs and data", () => {
  const subjects = [
    subject({ id: "a", name: "Maths", currentGrade: "6" }),
    subject({ id: "b", name: "History", targetGrade: "A" }),
  ];
  const reordered = reorderSubjects(subjects, "b", "up");

  assert.equal(reordered[0], subjects[1]);
  assert.equal(reordered[0].id, "b");
  assert.equal(reordered[0].targetGrade, "A");
});

test("Classroom-linked Subject metadata is preserved", () => {
  const linked = subject({
    id: "classroom-subject",
    source: "classroom",
    classroomCourseId: "course-1",
    externalId: "external-1",
    importedAt: "2026-08-09T00:00:00.000Z",
    lastSyncedAt: "2026-08-09T01:00:00.000Z",
  });
  const reordered = reorderSubjects([subject({ id: "manual" }), linked], "classroom-subject", "up");

  assert.equal(reordered[0], linked);
  assert.equal(reordered[0].classroomCourseId, "course-1");
  assert.equal(reordered[0].externalId, "external-1");
});

test("new Subject placement remains sensible at the end", () => {
  const subjects = [subject({ id: "a" }), subject({ id: "b" })];
  const added = [...subjects, subject({ id: "new", name: "Chemistry" })];

  assert.deepEqual(added.map((item) => item.id), ["a", "b", "new"]);
});

test("Move up and down boundaries are safe", () => {
  const subjects = [subject({ id: "a" }), subject({ id: "b" })];

  assert.deepEqual(reorderSubjects(subjects, "a", "up").map((item) => item.id), ["a", "b"]);
  assert.deepEqual(reorderSubjects(subjects, "b", "down").map((item) => item.id), ["a", "b"]);
  assert.equal(reorderSubjects(subjects, "missing", "up"), subjects);
});

test("legacy or malformed stored Subject data falls back safely", () => {
  const loaded = withMockSubjectStorage(
    [
      null,
      { id: "legacy", name: "  English  ", level: "HL" },
      { id: "missing-name", level: "SL" },
    ],
    () => loadSubjects()
  );

  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, "legacy");
  assert.equal(loaded[0].name, "English");
  assert.equal(loaded[0].courseSystem, "Other");
  assert.equal(loaded[0].level, "HL");
});

test("IB level options avoid redundant Standard/Higher choices", () => {
  assert.deepEqual(getSubjectLevelOptions("IB"), [
    { value: "SL", label: "Standard Level (SL)" },
    { value: "HL", label: "Higher Level (HL)" },
  ]);
});
