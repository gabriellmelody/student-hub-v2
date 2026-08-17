import test from "node:test";
import assert from "node:assert/strict";
import {
  mapClassroomSyncSetting,
  mapClassroomSyncSettingForUpsert,
} from "./classroomSyncSettings.js";

test("Classroom sync mapper defaults missing no-due-date preference on", () => {
  const setting = mapClassroomSyncSetting({
    classroom_course_id: "course-1",
    classroom_course_name: "IB Psychology HL",
  });

  assert.equal(setting.syncEnabled, true);
  assert.equal(setting.syncActive, true);
  assert.equal(setting.syncNoDueDate, true);
  assert.equal(setting.syncCompleted, false);
});

test("Classroom sync mapper preserves explicit no-due-date false", () => {
  const setting = mapClassroomSyncSetting({
    classroom_course_id: "course-1",
    classroom_course_name: "IB Psychology HL",
    sync_no_due_date: false,
  });

  assert.equal(setting.syncNoDueDate, false);
});

test("Classroom sync upsert defaults missing no-due-date preference on", () => {
  const payload = mapClassroomSyncSettingForUpsert(
    {
      classroomCourseId: "course-1",
      classroomCourseName: "IB Psychology HL",
    },
    "user-1"
  );

  assert.equal(payload.sync_enabled, true);
  assert.equal(payload.sync_active, true);
  assert.equal(payload.sync_no_due_date, true);
  assert.equal(payload.sync_completed, false);
});

test("Classroom sync upsert preserves explicit no-due-date false", () => {
  const payload = mapClassroomSyncSettingForUpsert(
    {
      classroomCourseId: "course-1",
      classroomCourseName: "IB Psychology HL",
      syncNoDueDate: false,
    },
    "user-1"
  );

  assert.equal(payload.sync_no_due_date, false);
});
