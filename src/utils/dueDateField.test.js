import assert from "node:assert/strict";
import test from "node:test";

import {
  createQuickTaskDraft,
  formatDateKey,
  getDueDateShortcutValue,
  loadTasks,
  normalizeTask,
  parseDateKey,
} from "./appUtils.js";

function setDueDate(task, dueDate) {
  return { ...task, dueDate };
}

function saveEditedTask(task, dueDate) {
  return normalizeTask({ ...task, dueDate });
}

function withMockTaskStorage(storedTasks, run) {
  const originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem(key) {
      return key === "student-hub-tasks" ? JSON.stringify(storedTasks) : null;
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

test("date value can be set", () => {
  const task = setDueDate({ dueDate: "" }, "2026-08-10");

  assert.equal(task.dueDate, "2026-08-10");
});

test("date value can be cleared", () => {
  const task = setDueDate({ dueDate: "2026-08-10" }, "");

  assert.equal(task.dueDate, "");
});

test("Today shortcut sets today's local date", () => {
  const now = new Date(2026, 7, 9, 23, 30);

  assert.equal(getDueDateShortcutValue("today", now), "2026-08-09");
});

test("Tomorrow shortcut sets next local date", () => {
  const now = new Date(2026, 7, 9, 23, 30);

  assert.equal(getDueDateShortcutValue("tomorrow", now), "2026-08-10");
});

test("saved date survives persistence", () => {
  const stored = [
    normalizeTask({
      id: "task-1",
      subject: "Maths",
      title: "Worksheet",
      dueDate: "2026-08-10",
      effort: 2,
      completed: false,
      source: "manual",
    }),
  ];
  const loaded = withMockTaskStorage(stored, () => loadTasks());

  assert.equal(loaded[0].dueDate, "2026-08-10");
});

test("edit preserves the same date", () => {
  const task = normalizeTask({
    id: "task-1",
    subject: "Maths",
    title: "Worksheet",
    dueDate: "2026-08-10",
    effort: 2,
    completed: false,
    source: "manual",
  });
  const edited = saveEditedTask(task, "2026-08-10");

  assert.equal(edited.dueDate, "2026-08-10");
});

test("date-only value does not shift timezone or day", () => {
  const dateKey = "2026-08-10";
  const parsed = parseDateKey(dateKey);

  assert.equal(formatDateKey(parsed), dateKey);
});

test("Quick Add More details uses the same date behavior", () => {
  const detailedDraft = setDueDate(createQuickTaskDraft("Bring calculator"), "2026-08-10");

  assert.equal(detailedDraft.title, "Bring calculator");
  assert.equal(detailedDraft.dueDate, "2026-08-10");
});

test("existing tasks with due dates remain compatible", () => {
  const loaded = withMockTaskStorage(
    [{ id: "legacy", subject: "History", title: "Essay", dueDate: "2026-08-10", completed: false }],
    () => loadTasks()
  );

  assert.equal(loaded[0].dueDate, "2026-08-10");
});

test("empty due date remains valid", () => {
  const loaded = withMockTaskStorage(
    [{ id: "undated", subject: "", title: "Bring calculator", dueDate: "", completed: false }],
    () => loadTasks()
  );

  assert.equal(loaded[0].dueDate, "");
});

test("Clear shortcut returns an empty date", () => {
  assert.equal(getDueDateShortcutValue("clear", new Date(2026, 7, 9)), "");
});
