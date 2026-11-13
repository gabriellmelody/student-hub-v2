import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyTaskDraft,
  createDueDateBoardColumns,
  createPriorityBoardColumns,
  createTaskDraftForBoardColumn,
  formatTaskCompletionLabel,
  formatTaskDueLabel,
  getTaskAcademicLabel,
  getVisibleTaskColumnItems,
  TASK_BOARD_VISIBLE_LIMIT,
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

test("due-date groups use one rolling seven-day horizon", () => {
  assert.deepEqual(labelsFor(new Date(2026, 6, 29, 12)), [
    "Overdue",
    "Today",
    "Tomorrow",
    "Next 7 Days",
    "Later",
  ]);
  assert.deepEqual(labelsFor(new Date(2026, 6, 31, 12)), [
    "Overdue",
    "Today",
    "Tomorrow",
    "Next 7 Days",
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

test("tasks enter overdue, today, tomorrow, next-seven-day, later, and unscheduled groups", () => {
  const columns = createDueDateBoardColumns(
    [
      task("past", "2026-07-28"),
      task("timed-past", "2026-07-29", { dueTime: "09:00" }),
      task("today", "2026-07-29"),
      task("tomorrow", "2026-07-30"),
      task("next-seven", "2026-08-03"),
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
  assert.deepEqual(columns.find((column) => column.id === "next-seven-days").tasks.map(({ id }) => id), ["next-seven"]);
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

test("Due Date column creation defaults follow the selected column", () => {
  const now = new Date(2026, 6, 29, 12);
  const columns = createDueDateBoardColumns([], now);
  const today = columns.find((column) => column.label === "Today");
  const tomorrow = columns.find((column) => column.label === "Tomorrow");
  const later = columns.find((column) => column.id === "later");
  const unscheduled = columns.find((column) => column.id === "unscheduled");
  const overdue = columns.find((column) => column.id === "overdue");

  assert.equal(createTaskDraftForBoardColumn(today, "dueDate", now).dueDate, "2026-07-29");
  assert.equal(createTaskDraftForBoardColumn(tomorrow, "dueDate", now).dueDate, "2026-07-30");
  assert.equal(createTaskDraftForBoardColumn(later, "dueDate", now).dueDate, "2026-08-04");
  assert.equal(createTaskDraftForBoardColumn(unscheduled, "dueDate", now).dueDate, "");
  assert.equal(createTaskDraftForBoardColumn(overdue, "dueDate", now).dueDate, "2026-07-29");
});

test("Priority column creation defaults use the selected authoritative priority", () => {
  for (const column of createPriorityBoardColumns([])) {
    const draft = createTaskDraftForBoardColumn(column, "priority");
    assert.equal(draft.importance, column.importance);
    assert.equal(draft.importanceSource, "manual");
    assert.equal(draft.dueDate, "");
  }
});

test("new task drafts keep date and due time independently optional", () => {
  const draft = createEmptyTaskDraft();
  assert.equal(draft.dueDate, "");
  assert.equal(draft.dueTime, "");
  assert.notEqual(draft.dueTime, "00:00");
});

test("assessment labels keep Summative, Formative, and CFA distinct", () => {
  assert.equal(getTaskAcademicLabel(task("summative", "", { detectedTags: ["Summative"] })), "Summative");
  assert.equal(getTaskAcademicLabel(task("formative", "", { detectedTags: ["Formative"] })), "Formative");
  assert.equal(getTaskAcademicLabel(task("cfa", "", { title: "Unit 2 CFA", detectedTags: ["Formative"] })), "CFA");
});

test("due labels stay relative for three days and format due times without seconds", () => {
  const now = new Date(2026, 10, 12, 10, 0, 0);
  assert.equal(formatTaskDueLabel(task("today", "2026-11-12"), now, "en-US"), "Due today");
  assert.equal(formatTaskDueLabel(task("tomorrow", "2026-11-13"), now, "en-US"), "Due tomorrow");
  assert.equal(formatTaskDueLabel(task("two", "2026-11-14"), now, "en-US"), "Due in 2 days");
  assert.equal(formatTaskDueLabel(task("three", "2026-11-15"), now, "en-US"), "Due in 3 days");
  assert.equal(formatTaskDueLabel(task("later", "2026-11-20"), now, "en-US"), "Due Nov 20");
  assert.equal(
    formatTaskDueLabel(task("timed", "2026-11-12", { dueTime: "16:59:00" }), now, "en-US"),
    "Due today · 4:59 PM"
  );
});

test("completed rows use a completion label instead of active urgency", () => {
  const completedAt = new Date(2026, 10, 11, 9, 30).getTime();
  assert.equal(formatTaskCompletionLabel({ completedAt }, "en-US"), "Completed Nov 11");
  assert.equal(formatTaskCompletionLabel({}, "en-US"), "Completed");
});

test("task columns show seven cards by default and expand independently", () => {
  const tasks = Array.from({ length: 11 }, (_, index) => task(`task-${index + 1}`, ""));
  assert.equal(TASK_BOARD_VISIBLE_LIMIT, 7);
  assert.deepEqual(
    getVisibleTaskColumnItems(tasks).map(({ id }) => id),
    tasks.slice(0, 7).map(({ id }) => id)
  );
  assert.equal(getVisibleTaskColumnItems(tasks, true).length, 11);
  assert.equal(getVisibleTaskColumnItems(tasks.slice(0, 3)).length, 3);
});
