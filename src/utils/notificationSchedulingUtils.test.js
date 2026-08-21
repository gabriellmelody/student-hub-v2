import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_TYPES,
  addLocalDays,
  applyNotificationPrecedence,
  classroomNewOccurrenceKey,
  dailyPlanningOccurrenceKey,
  getQuietHoursDecision,
  getZonedDateTimeParts,
  isClassroomNewAssignmentEligible,
  isDailyPlanningOccurrenceDue,
  isPlanStartOccurrenceDue,
  isTaskDueTodayEligible,
  isTaskDueTomorrowEligible,
  planStartOccurrenceKey,
  taskDueOccurrenceKey,
} from "./notificationSchedulingUtils.js";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260821_notifications_pass1.sql", import.meta.url),
  "utf8"
);

test("notification occurrence keys are deterministic and identifier-based", () => {
  assert.equal(
    classroomNewOccurrenceKey("course-1:work-2"),
    "classroom:new:course-1%3Awork-2"
  );
  assert.equal(
    taskDueOccurrenceKey("task-1", "due-tomorrow", "2026-08-22"),
    "task:task-1:due-tomorrow:2026-08-22"
  );
  assert.equal(dailyPlanningOccurrenceKey("2026-08-21"), "daily-planning:2026-08-21");
  assert.equal(
    planStartOccurrenceKey("plan-1", "2026-08-21", "17:30"),
    "plan-start:plan-1:2026-08-21:17:30"
  );
});

test("notification preference defaults are conservative and useful", () => {
  assert.deepEqual(DEFAULT_NOTIFICATION_PREFERENCES, {
    masterEnabled: false,
    newClassroomTasksEnabled: true,
    taskDueTomorrowEnabled: true,
    taskDueTodayEnabled: true,
    dailyPlanningEnabled: true,
    dailyPlanningTime: "17:00",
    planStartEnabled: true,
    planStartLeadMinutes: 15,
    quietHoursEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    notificationPreview: "private",
    timeZone: "UTC",
  });
});

test("due reminders use the account IANA timezone and current task state", () => {
  const now = new Date("2026-08-21T17:30:00.000Z");
  const task = { id: "task-1", dueDate: "2026-08-22", completed: false, archived: false };

  assert.equal(isTaskDueTodayEligible(task, { now, timeZone: "Asia/Bangkok" }), true);
  assert.equal(isTaskDueTomorrowEligible(task, { now, timeZone: "UTC" }), true);
  assert.equal(isTaskDueTodayEligible({ ...task, completed: true }, { now, timeZone: "Asia/Bangkok" }), false);
  assert.equal(isTaskDueTodayEligible({ ...task, archived: true }, { now, timeZone: "Asia/Bangkok" }), false);
});

test("zoned local dates handle London DST without fixed offsets", () => {
  assert.deepEqual(
    getZonedDateTimeParts("2026-03-29T00:30:00.000Z", "Europe/London"),
    { date: "2026-03-29", time: "00:30", hour: 0, minute: 30 }
  );
  assert.deepEqual(
    getZonedDateTimeParts("2026-03-29T01:30:00.000Z", "Europe/London"),
    { date: "2026-03-29", time: "02:30", hour: 2, minute: 30 }
  );
  assert.equal(addLocalDays("2028-02-28", 1), "2028-02-29");
});

test("the first Classroom crawl is baseline-only and historical work stays suppressed", () => {
  const baselineCompletedAt = "2026-08-21T10:00:00.000Z";

  assert.equal(
    isClassroomNewAssignmentEligible({ externalId: "course:old", baselineCompletedAt: "" }),
    false
  );
  assert.equal(
    isClassroomNewAssignmentEligible({
      externalId: "course:old",
      baselineCompletedAt,
      creationTime: "2026-08-20T10:00:00.000Z",
    }),
    false
  );
  assert.equal(
    isClassroomNewAssignmentEligible({
      externalId: "course:new",
      baselineCompletedAt,
      creationTime: "2026-08-21T10:01:00.000Z",
    }),
    true
  );
  assert.equal(
    isClassroomNewAssignmentEligible({
      externalId: "course:new",
      baselineCompletedAt,
      alreadySeen: true,
      creationTime: "2026-08-21T10:01:00.000Z",
    }),
    false
  );
});

test("daily planning and plan start become due from local wall-clock values", () => {
  assert.equal(
    isDailyPlanningOccurrenceDue({
      now: "2026-08-21T10:00:00.000Z",
      timeZone: "Asia/Bangkok",
      reminderTime: "17:00",
    }),
    true
  );
  assert.equal(
    isPlanStartOccurrenceDue({
      now: "2026-08-21T16:57:00.000Z",
      timeZone: "UTC",
      planDate: "2026-08-21",
      startTime: "17:10",
      leadMinutes: 15,
    }),
    true
  );
  assert.equal(
    isPlanStartOccurrenceDue({
      now: "2026-08-21T17:10:00.000Z",
      timeZone: "UTC",
      planDate: "2026-08-21",
      startTime: "17:10",
      leadMinutes: 15,
    }),
    false
  );
});

test("overnight quiet hours defer useful reminders and drop stale ones", () => {
  assert.deepEqual(
    getQuietHoursDecision({
      now: "2026-08-21T23:30:00.000Z",
      timeZone: "UTC",
      usefulUntilDate: "2026-08-22",
      usefulUntilTime: "23:59",
    }),
    { action: "defer", resumeDate: "2026-08-22", resumeTime: "07:00" }
  );
  assert.deepEqual(
    getQuietHoursDecision({
      now: "2026-08-21T23:30:00.000Z",
      timeZone: "UTC",
      usefulUntilDate: "2026-08-21",
      usefulUntilTime: "23:59",
    }),
    { action: "drop", resumeDate: "2026-08-22", resumeTime: "07:00" }
  );
});

test("a new Classroom occurrence suppresses only the overlapping due-tomorrow reminder", () => {
  const newTask = {
    type: NOTIFICATION_TYPES.CLASSROOM_NEW_TASK,
    taskId: "task-1",
    occurrenceKey: classroomNewOccurrenceKey("course:work"),
  };
  const dueTomorrow = {
    type: NOTIFICATION_TYPES.TASK_DUE_TOMORROW,
    taskId: "task-1",
    occurrenceKey: taskDueOccurrenceKey("task-1", "due-tomorrow", "2026-08-22"),
    suppressedByOccurrenceKeys: [newTask.occurrenceKey],
  };
  const dueToday = {
    type: NOTIFICATION_TYPES.TASK_DUE_TODAY,
    taskId: "task-1",
    occurrenceKey: taskDueOccurrenceKey("task-1", "due-today", "2026-08-22"),
  };

  assert.deepEqual(applyNotificationPrecedence([newTask, dueTomorrow, dueToday]), [newTask, dueToday]);
  assert.deepEqual(
    applyNotificationPrecedence([newTask, dueTomorrow], [newTask.occurrenceKey]),
    []
  );
  assert.deepEqual(
    applyNotificationPrecedence([dueTomorrow], [newTask.occurrenceKey]),
    []
  );
});

test("migration keeps preferences user-owned and sensitive tables server-only", () => {
  assert.match(migration, /create table if not exists public\.notification_preferences/);
  assert.match(migration, /master_enabled boolean not null default false/);
  assert.match(migration, /daily_planning_time time not null default '17:00'/);
  assert.match(migration, /timezone text not null default 'UTC'/);
  assert.match(migration, /auth\.uid\(\) = user_id/);
  assert.match(migration, /grant select, insert, update, delete on public\.notification_preferences to authenticated/);
  for (const table of [
    "push_subscriptions",
    "notification_deliveries",
    "classroom_notification_baselines",
    "classroom_coursework_seen",
  ]) {
    assert.match(migration, new RegExp(`revoke all on public\\.${table} from authenticated`));
  }
});

test("delivery dedupe is per subscription and enforces matching ownership", () => {
  assert.match(migration, /unique \(subscription_id, occurrence_key\)/);
  assert.match(migration, /foreign key \(subscription_id, user_id\)/);
  assert.match(migration, /references public\.push_subscriptions\(id, user_id\) on delete cascade/);
});
