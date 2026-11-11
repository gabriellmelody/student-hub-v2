import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDayloTaskEvent,
  clearTaskCalendarLinkage,
  isTaskEligibleForGoogleScheduling,
  shouldRemoveFutureTaskEvent,
  zonedScheduleToInstants,
} from "./task-scheduling-utils.js";

const TASK_ID = "11111111-1111-4111-8111-111111111111";

test("only active manual academic tasks with due dates are eligible", () => {
  const eligible = { id: TASK_ID, source: "manual", due_date: "2026-10-23", completed: false, archived: false };
  assert.equal(isTaskEligibleForGoogleScheduling(eligible), true);
  assert.equal(isTaskEligibleForGoogleScheduling({ ...eligible, due_date: null }), false);
  assert.equal(isTaskEligibleForGoogleScheduling({ ...eligible, source: "classroom" }), false);
  assert.equal(isTaskEligibleForGoogleScheduling({ ...eligible, completed: true }), false);
  assert.equal(isTaskEligibleForGoogleScheduling({ ...eligible, archived: true }), false);
});

test("event payload uses private task metadata and a safe DayLo deep link", () => {
  const event = buildDayloTaskEvent({
    task: { id: TASK_ID, title: "Economics IA draft" },
    schedule: { date: "2026-10-21", startTime: "19:00", durationMinutes: 60, timeZone: "Asia/Bangkok" },
    taskLink: `https://daylo.example/tasks?task=${TASK_ID}`,
  });
  assert.equal(event.summary, "Economics IA draft");
  assert.equal(event.extendedProperties.private.dayloTaskId, TASK_ID);
  assert.equal(event.extendedProperties.private.dayloManaged, "true");
  assert.match(event.description, new RegExp(`/tasks\\?task=${TASK_ID}`));
  assert.equal(event.start.dateTime, "2026-10-21T12:00:00.000Z");
  assert.equal(Date.parse(event.end.dateTime) - Date.parse(event.start.dateTime), 60 * 60_000);
});

test("timezone conversion handles Bangkok, London DST and UTC", () => {
  const bangkok = zonedScheduleToInstants({ date: "2026-10-21", startTime: "19:00", durationMinutes: 60, timeZone: "Asia/Bangkok" });
  const london = zonedScheduleToInstants({ date: "2026-03-29", startTime: "00:30", durationMinutes: 120, timeZone: "Europe/London" });
  const utc = zonedScheduleToInstants({ date: "2026-10-21", startTime: "19:00", durationMinutes: 30, timeZone: "UTC" });
  assert.equal(bangkok.start.toISOString(), "2026-10-21T12:00:00.000Z");
  assert.equal(london.start.toISOString(), "2026-03-29T00:30:00.000Z");
  assert.equal(london.end.getTime() - london.start.getTime(), 120 * 60_000);
  assert.equal(utc.start.toISOString(), "2026-10-21T19:00:00.000Z");
});

test("completion removes only future sessions and preserves historical events", () => {
  const task = {
    scheduled_date: "2026-10-21",
    scheduled_start_time: "19:00",
    scheduled_duration_minutes: 60,
    scheduled_timezone: "UTC",
  };
  assert.equal(shouldRemoveFutureTaskEvent(task, new Date("2026-10-21T18:00:00Z")), true);
  assert.equal(shouldRemoveFutureTaskEvent(task, new Date("2026-10-21T20:00:00Z")), false);
});

test("clearing Calendar linkage never changes deadline fields", () => {
  const cleared = clearTaskCalendarLinkage();
  assert.equal(Object.hasOwn(cleared, "due_date"), false);
  assert.equal(Object.hasOwn(cleared, "due_time"), false);
  assert.equal(cleared.google_calendar_event_id, null);
  assert.equal(cleared.scheduled_date, null);
});
