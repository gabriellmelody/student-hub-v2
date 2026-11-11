import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  clearTaskGoogleCalendarLinkage,
  formatTaskSchedule,
  getDefaultTaskSchedule,
  isTaskEligibleForCalendarScheduling,
  requestTaskCalendarOperation,
} from "./taskCalendarScheduling.js";

const TASK_ID = "11111111-1111-4111-8111-111111111111";

test("frontend eligibility excludes no-deadline, Classroom, completed and archived tasks", () => {
  const task = { id: TASK_ID, source: "manual", dueDate: "2026-10-23", completed: false, archived: false };
  assert.equal(isTaskEligibleForCalendarScheduling(task), true);
  assert.equal(isTaskEligibleForCalendarScheduling({ ...task, dueDate: "" }), false);
  assert.equal(isTaskEligibleForCalendarScheduling({ ...task, source: "classroom" }), false);
  assert.equal(isTaskEligibleForCalendarScheduling({ ...task, completed: true }), false);
  assert.equal(isTaskEligibleForCalendarScheduling({ ...task, archived: true }), false);
});

test("defaults round to a quarter hour and use effort without copying the deadline", () => {
  const schedule = getDefaultTaskSchedule(
    { effort: 4, dueDate: "2026-10-30", dueTime: "17:00" },
    new Date(2026, 9, 21, 10, 31, 25)
  );
  assert.equal(schedule.startTime, "10:45");
  assert.equal(schedule.durationMinutes, 90);
  assert.notEqual(schedule.date, "2026-10-30");
});

test("explicit scheduling calls only the consolidated authenticated endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let call;
  globalThis.fetch = async (url, options) => {
    call = { url, options };
    return { ok: true, json: async () => ({ ok: true, status: "task_calendar_event_created" }) };
  };
  try {
    const result = await requestTaskCalendarOperation({
      accessToken: "daylo-session",
      operation: "schedule",
      taskId: TASK_ID,
      schedule: { date: "2026-10-21", startTime: "19:00", durationMinutes: 60, timeZone: "UTC" },
    });
    assert.equal(result.ok, true);
    assert.equal(call.url, "/api/google-calendar/task-scheduling");
    assert.equal(call.options.headers.Authorization, "Bearer daylo-session");
    assert.equal(JSON.parse(call.options.body).operation, "schedule");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("clearing scheduling fields preserves the DayLo task and deadline", () => {
  const task = { id: TASK_ID, title: "Essay", dueDate: "2026-10-23", googleCalendarEventId: "event" };
  const cleared = clearTaskGoogleCalendarLinkage(task);
  assert.equal(cleared.id, TASK_ID);
  assert.equal(cleared.dueDate, "2026-10-23");
  assert.equal(cleared.googleCalendarEventId, null);
});

test("My Lists and Notes never import or call Calendar task scheduling", () => {
  const myLists = readFileSync(new URL("../pages/MyListsPage.jsx", import.meta.url), "utf8");
  const notes = readFileSync(new URL("../pages/NotesPage.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(myLists, /task-scheduling|Schedule in Google Calendar/);
  assert.doesNotMatch(notes, /task-scheduling|Schedule in Google Calendar/);
});

test("task creation and due-date editing contain no automatic scheduling call", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  const createStart = app.indexOf("async function addTaskToList");
  const createEnd = app.indexOf("async function importMockClassroomAssignments", createStart);
  const creationFlow = app.slice(createStart, createEnd);
  const updateStart = app.indexOf("async function updateTask(");
  const updateEnd = app.indexOf("function clearPlan", updateStart);
  const updateFlow = app.slice(updateStart, updateEnd);
  assert.doesNotMatch(creationFlow, /runTaskCalendarOperation|task-scheduling/);
  assert.doesNotMatch(updateFlow, /runTaskCalendarOperation\("schedule"/);
  assert.match(updateFlow, /runTaskCalendarOperation\("sync-title", taskId\)/);
});

test("linked schedule labels use the stored wall-clock time across devices", () => {
  const task = {
    scheduledDate: "2026-10-21",
    scheduledStartTime: "19:00",
    scheduledDurationMinutes: 60,
    scheduledTimeZone: "Asia/Bangkok",
  };
  assert.match(formatTaskSchedule(task, "en-GB"), /19:00–20:00/);
});
