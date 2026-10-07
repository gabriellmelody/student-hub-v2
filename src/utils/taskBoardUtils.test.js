import test from "node:test";
import assert from "node:assert/strict";
import {
  createDueDateBoardColumns,
  createPriorityBoardColumns,
} from "./taskBoardUtils.js";

function task(id, dueDate, extra = {}) {
  return {
    id,
    title: id,
    dueDate,
    dueTime: "",
    importance: "normal",
    completed: false,
    archived: false,
    ...extra,
  };
}

function labelsFor(date) {
  return createDueDateBoardColumns([], date)
    .filter((column) => column.kind !== "unscheduled")
    .map((column) => column.label);
}

test("Wednesday and Friday produce deterministic rolling due-date columns", () => {
  assert.deepEqual(labelsFor(new Date(2026, 6, 29, 12)), [
    "Overdue",
    "Today",
    "Tomorrow",
    "Friday",
    "Saturday",
    "Sunday",
    "Monday",
    "Later",
  ]);
  assert.deepEqual(labelsFor(new Date(2026, 6, 31, 12)), [
    "Overdue",
    "Today",
    "Tomorrow",
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Later",
  ]);
});

test("rolling dates cross month, year, and leap-day boundaries", () => {
  const monthColumns = createDueDateBoardColumns([], new Date(2026, 6, 31, 12));
  assert.equal(monthColumns.find((column) => column.label === "Tomorrow").dateKey, "2026-08-01");

  const yearColumns = createDueDateBoardColumns([], new Date(2026, 11, 31, 12));
  assert.equal(yearColumns.find((column) => column.label === "Tomorrow").dateKey, "2027-01-01");

  const leapColumns = createDueDateBoardColumns([], new Date(2028, 1, 28, 12));
  assert.equal(leapColumns.find((column) => column.label === "Tomorrow").dateKey, "2028-02-29");
});

test("tasks enter overdue, today, tomorrow, later, and unscheduled buckets", () => {
  const columns = createDueDateBoardColumns(
    [
      task("past", "2026-07-28"),
      task("timed-past", "2026-07-29", { dueTime: "09:00" }),
      task("today", "2026-07-29"),
      task("tomorrow", "2026-07-30"),
      task("later", "2026-08-10"),
      task("none", ""),
      task("complete", "2026-07-29", { completed: true }),
      task("archived", "2026-07-29", { archived: true }),
    ],
    new Date(2026, 6, 29, 12)
  );

  assert.deepEqual(columns.find((column) => column.id === "overdue").tasks.map(({ id }) => id), [
    "past",
    "timed-past",
  ]);
  assert.deepEqual(columns.find((column) => column.id === "date:2026-07-29").tasks.map(({ id }) => id), ["today"]);
  assert.deepEqual(columns.find((column) => column.id === "date:2026-07-30").tasks.map(({ id }) => id), ["tomorrow"]);
  assert.deepEqual(columns.find((column) => column.id === "later").tasks.map(({ id }) => id), ["later"]);
  assert.deepEqual(columns.find((column) => column.id === "unscheduled").tasks.map(({ id }) => id), ["none"]);
});

test("priority board uses existing authoritative importance values", () => {
  const columns = createPriorityBoardColumns([
    task("normal", ""),
    task("urgent", "", { importance: "urgent" }),
    task("high", "", { importance: "high" }),
  ]);

  assert.deepEqual(columns.map((column) => column.label), ["Urgent", "High", "Normal"]);
  assert.deepEqual(columns.map((column) => column.tasks[0]?.id), ["urgent", "high", "normal"]);
});
