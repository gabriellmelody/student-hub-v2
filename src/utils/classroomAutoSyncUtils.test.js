import test from "node:test";
import assert from "node:assert/strict";
import {
  getDefaultClassroomSyncSetting,
  mergeClassroomCoursesWithSettings,
  pruneDeletedSubjectLinks,
  reconcileClassroomAssignments,
  shouldSyncNewClassroomAssignment,
} from "./classroomAutoSyncUtils.js";

const course = { classroomCourseId: "course-1", name: "IB Psychology HL" };
const subject = { id: "subject-1", name: "Psychology" };
const setting = {
  ...getDefaultClassroomSyncSetting(course, subject.id),
  classroomCourseId: "course-1",
};
const assignment = {
  source: "classroom",
  externalId: "course-1:work-1",
  classroomCourseId: "course-1",
  classroomCourseName: "IB Psychology HL",
  title: "Essay",
  dueDate: "2026-08-20",
  dueTime: "09:00",
  classroomStatusCategory: "active",
  alternateLink: "https://classroom.google.com/c/abc/a/def",
};

test("Classroom course configuration persists with user-scoped rows", () => {
  const merged = mergeClassroomCoursesWithSettings([course], [setting]);
  assert.equal(merged[0].classroomCourseId, "course-1");
  assert.equal(merged[0].subjectId, "subject-1");
  assert.equal(merged[0].syncEnabled, true);
});

test("new Classroom course defaults turn no-due-date imports on", () => {
  const defaults = getDefaultClassroomSyncSetting(course, subject.id);
  assert.equal(defaults.syncEnabled, true);
  assert.equal(defaults.syncActive, true);
  assert.equal(defaults.syncNoDueDate, true);
  assert.equal(defaults.syncCompleted, false);
});

test("existing saved no-due-date false remains false", () => {
  const merged = mergeClassroomCoursesWithSettings(
    [course],
    [{ ...setting, syncNoDueDate: false }]
  );
  assert.equal(merged[0].syncNoDueDate, false);
});

test("Subject rename keeps course linked by UUID", () => {
  const renamedSubject = { ...subject, name: "Psych" };
  const result = reconcileClassroomAssignments({
    assignments: [assignment],
    settings: [setting],
    subjects: [renamedSubject],
    tasks: [],
    syncedAt: "2026-08-17T00:00:00.000Z",
  });
  assert.equal(result.tasksToSync[0].linkedSubjectId, "subject-1");
  assert.equal(result.tasksToSync[0].subject, "Psych");
});

test("Deleted linked Subject leaves course unlinked", () => {
  const pruned = pruneDeletedSubjectLinks([setting], []);
  assert.equal(pruned[0].subjectId, null);
});

test("Active switch controls new active imports", () => {
  assert.equal(shouldSyncNewClassroomAssignment(assignment, setting), true);
  assert.equal(
    shouldSyncNewClassroomAssignment(assignment, {
      ...setting,
      syncActive: false,
    }),
    false
  );
});

test("No-due-date switch imports without fabricating due dates", () => {
  const noDue = { ...assignment, externalId: "course-1:work-2", dueDate: "" };
  assert.equal(
    shouldSyncNewClassroomAssignment(noDue, { ...setting, syncNoDueDate: false }),
    false
  );
  assert.equal(shouldSyncNewClassroomAssignment(noDue, setting), true);
  const result = reconcileClassroomAssignments({
    assignments: [noDue],
    settings: [setting],
    subjects: [subject],
    tasks: [],
    syncedAt: "2026-08-17T00:00:00.000Z",
  });
  assert.equal(result.tasksToSync[0].dueDate, "");
  assert.equal(result.tasksToSync[0].linkedSubjectId, subject.id);
});

test("Repeated no-due-date sync does not duplicate up-to-date tasks", () => {
  const noDue = { ...assignment, externalId: "course-1:work-2", dueDate: "" };
  const existingTask = reconcileClassroomAssignments({
    assignments: [noDue],
    settings: [setting],
    subjects: [subject],
    tasks: [],
    syncedAt: "2026-08-17T00:00:00.000Z",
  }).tasksToSync[0];
  const result = reconcileClassroomAssignments({
    assignments: [noDue],
    settings: [setting],
    subjects: [subject],
    tasks: [existingTask],
    syncedAt: "2026-08-17T00:00:00.000Z",
  });
  assert.equal(result.tasksToSync.length, 0);
});

test("Completed switch controls historical completed imports", () => {
  const done = { ...assignment, classroomStatusCategory: "done" };
  assert.equal(shouldSyncNewClassroomAssignment(done, setting), false);
  assert.equal(
    shouldSyncNewClassroomAssignment(done, {
      ...setting,
      syncCompleted: true,
    }),
    true
  );
});

test("Existing active task completes regardless of completed import toggle", () => {
  const result = reconcileClassroomAssignments({
    assignments: [{ ...assignment, classroomStatusCategory: "done" }],
    settings: [{ ...setting, syncCompleted: false }],
    subjects: [subject],
    tasks: [
      {
        id: "task-1",
        source: "classroom",
        externalId: "course-1:work-1",
        title: "Essay",
        effort: 5,
        importance: "high",
        importanceSource: "manual",
        completed: false,
      },
    ],
    syncedAt: "2026-08-17T00:00:00.000Z",
  });
  assert.equal(result.tasksToSync[0].completed, true);
  assert.equal(result.tasksToSync[0].effort, 5);
  assert.equal(result.tasksToSync[0].importance, "high");
});

test("Reopened assignment can become active again", () => {
  const result = reconcileClassroomAssignments({
    assignments: [assignment],
    settings: [setting],
    subjects: [subject],
    tasks: [
      {
        id: "task-1",
        source: "classroom",
        externalId: "course-1:work-1",
        title: "Essay",
        completed: true,
      },
    ],
    syncedAt: "2026-08-17T00:00:00.000Z",
  });
  assert.equal(result.tasksToSync[0].completed, false);
});

test("Title and due-date changes update existing task without duplicate", () => {
  const result = reconcileClassroomAssignments({
    assignments: [{ ...assignment, title: "Essay revised", dueDate: "2026-08-21" }],
    settings: [setting],
    subjects: [subject],
    tasks: [
      {
        id: "task-1",
        source: "classroom",
        externalId: "course-1:work-1",
        title: "Essay",
        dueDate: "2026-08-20",
      },
    ],
    syncedAt: "2026-08-17T00:00:00.000Z",
  });
  assert.equal(result.tasksToSync.length, 1);
  assert.equal(result.tasksToSync[0].title, "Essay revised");
  assert.equal(result.tasksToSync[0].dueDate, "2026-08-21");
});

test("Repeated sync does not duplicate up-to-date tasks", () => {
  const result = reconcileClassroomAssignments({
    assignments: [assignment],
    settings: [setting],
    subjects: [subject],
    tasks: [
      {
        ...assignment,
        id: "task-1",
        linkedSubjectId: subject.id,
        linkedSubjectName: subject.name,
        subject: subject.name,
        completed: false,
        lastSyncedAt: "2026-08-17T00:00:00.000Z",
      },
    ],
    syncedAt: "2026-08-17T00:00:00.000Z",
  });
  assert.equal(result.tasksToSync.length, 0);
});

test("Alternate link is preserved for Classroom tasks only", () => {
  const result = reconcileClassroomAssignments({
    assignments: [assignment],
    settings: [setting],
    subjects: [subject],
    tasks: [],
    syncedAt: "2026-08-17T00:00:00.000Z",
  });
  assert.equal(result.tasksToSync[0].alternateLink, assignment.alternateLink);
});
