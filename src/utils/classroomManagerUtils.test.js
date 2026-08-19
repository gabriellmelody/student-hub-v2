import assert from "node:assert/strict";
import test from "node:test";
import { getClassroomManagerState, sortClassroomSettingsBySubject } from "./classroomManagerUtils.js";

const configured = [{ classroomCourseId: "course-a", subjectId: "subject-a" }];

test("Classroom stays resolving until session and current-user settings are authoritative", () => {
  assert.equal(getClassroomManagerState({ sessionChecking: true }), "resolving");
  assert.equal(getClassroomManagerState({ connected: true, settingsLoading: true, activeSettings: [] }), "resolving");
  assert.equal(getClassroomManagerState({ connected: true, settingsUserMatches: false, activeSettings: configured }), "resolving");
  assert.equal(getClassroomManagerState({ connected: true, settingsLoading: true, activeSettings: configured }), "resolving");
});

test("Classroom selects genuine disconnected, reconnect, first-time and configured states", () => {
  assert.equal(getClassroomManagerState({ connected: false, sessionStatus: "no_classroom_session" }), "disconnected");
  assert.equal(getClassroomManagerState({ connected: false, sessionStatus: "classroom_session_invalid_or_expired" }), "reconnect");
  assert.equal(getClassroomManagerState({ connected: true, coursesResolved: true, activeSettings: [] }), "first-time");
  assert.equal(getClassroomManagerState({ connected: true, coursesResolved: false, activeSettings: configured }), "configured");
  assert.equal(getClassroomManagerState({ connected: true, settingsError: "failed" }), "error");
  assert.equal(getClassroomManagerState({ connected: true, coursesError: "failed" }), "error");
});

test("configured cards follow Subject order regardless of settings and timestamps", () => {
  const subjects = [{ id: "subject-b", name: "Biology" }, { id: "subject-a", name: "Art" }];
  const settings = [
    { classroomCourseId: "course-a", classroomCourseName: "Art class", subjectId: "subject-a", updatedAt: "2030-01-01", lastSyncedAt: "2030-01-01" },
    { classroomCourseId: "course-b", classroomCourseName: "Biology class", subjectId: "subject-b", updatedAt: "2020-01-01", lastSyncedAt: "2020-01-01" },
  ];
  const ids = (items) => sortClassroomSettingsBySubject(items, subjects).map((item) => item.classroomCourseId);
  assert.deepEqual(ids(settings), ["course-b", "course-a"]);
  assert.deepEqual(ids(settings.map((item) => ({ ...item, syncEnabled: false, syncActive: false, syncNoDueDate: false, syncCompleted: true, updatedAt: "2040-01-01", lastSyncedAt: "2040-01-01" }))), ["course-b", "course-a"]);
});

test("Subject rename preserves position and deliberate Subject reorder changes it", () => {
  const settings = [
    { classroomCourseId: "course-a", classroomCourseName: "Course A", subjectId: "subject-a" },
    { classroomCourseId: "course-b", classroomCourseName: "Course B", subjectId: "subject-b" },
  ];
  const order = (subjects) => sortClassroomSettingsBySubject(settings, subjects).map((item) => item.classroomCourseId);
  assert.deepEqual(order([{ id: "subject-a", name: "Z renamed" }, { id: "subject-b", name: "A" }]), ["course-a", "course-b"]);
  assert.deepEqual(order([{ id: "subject-b", name: "A" }, { id: "subject-a", name: "Z renamed" }]), ["course-b", "course-a"]);
});

test("settings without usable Subject order use deterministic name, course and ID fallback", () => {
  const settings = [
    { classroomCourseId: "course-z", classroomCourseName: "Math" },
    { classroomCourseId: "course-b", classroomCourseName: "Art" },
    { classroomCourseId: "course-a", classroomCourseName: "Art" },
  ];
  assert.deepEqual(
    sortClassroomSettingsBySubject(settings, []).map((item) => item.classroomCourseId),
    ["course-a", "course-b", "course-z"]
  );
});
