import assert from "node:assert/strict";
import test from "node:test";

import { createQuickTaskDraft, loadTasks, normalizeTask } from "./appUtils.js";

function task(overrides = {}) {
  return normalizeTask({
    id: overrides.id || "task-1",
    subject: overrides.subject ?? "Maths",
    title: overrides.title || "Finish worksheet",
    dueDate: overrides.dueDate ?? "2026-08-12",
    effort: overrides.effort ?? 2,
    completed: overrides.completed ?? false,
    source: overrides.source || "manual",
    externalId: overrides.externalId ?? null,
    classroomCourseId: overrides.classroomCourseId ?? null,
    classroomCourseName: overrides.classroomCourseName ?? null,
    importedAt: overrides.importedAt ?? null,
    lastSyncedAt: overrides.lastSyncedAt ?? null,
    taskType: overrides.taskType || "homework",
    importance: overrides.importance || "normal",
    detectedTags: overrides.detectedTags || [],
    importanceSource: overrides.importanceSource || "auto",
    ...overrides,
  });
}

function toggleTask(tasks, taskId, completedAt = 1000) {
  return tasks.map((item) =>
    item.id === taskId
      ? {
          ...item,
          completed: !item.completed,
          completedAt: item.completed ? null : completedAt,
        }
      : item
  );
}

function deleteTask(tasks, taskId) {
  return tasks.filter((item) => item.id !== taskId);
}

function visibleGroups(tasks) {
  return {
    active: tasks.filter((item) => !item.completed && item.dueDate),
    noDeadline: tasks.filter((item) => !item.completed && !item.dueDate),
    completed: tasks.filter((item) => item.completed),
  };
}

function withMockStorage(storedTasks, run) {
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

test("completing an active task moves it to Completed", () => {
  const [completedTask] = toggleTask([task()], "task-1", 2000);
  const groups = visibleGroups([completedTask]);

  assert.equal(groups.active.length, 0);
  assert.equal(groups.completed.length, 1);
  assert.equal(groups.completed[0].completed, true);
});

test("completed task survives persistence and reload", () => {
  const stored = [task({ completed: true, completedAt: 2000 })];
  const loaded = withMockStorage(stored, () => loadTasks());

  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].completed, true);
  assert.equal(loaded[0].completedAt, 2000);
});

test("restoring a task returns it to active", () => {
  const restored = toggleTask([task({ completed: true, completedAt: 2000 })], "task-1");
  const groups = visibleGroups(restored);

  assert.equal(groups.active.length, 1);
  assert.equal(groups.completed.length, 0);
});

test("restored task is no longer marked completed", () => {
  const [restored] = toggleTask([task({ completed: true, completedAt: 2000 })], "task-1");

  assert.equal(restored.completed, false);
  assert.equal(restored.completedAt, null);
});

test("completed task can still be deleted", () => {
  const tasks = deleteTask([task({ completed: true, completedAt: 2000 })], "task-1");

  assert.deepEqual(tasks, []);
});

test("existing task data is preserved through complete and restore", () => {
  const original = task({
    id: "classroom-1",
    subject: "History",
    title: "Read chapter 4",
    dueDate: "2026-07-01",
    effort: 4,
    source: "classroom",
    externalId: "course-work-1",
    classroomCourseId: "course-1",
    classroomCourseName: "History",
  });
  const [completed] = toggleTask([original], "classroom-1", 2000);
  const [restored] = toggleTask([completed], "classroom-1", 3000);

  assert.deepEqual(
    { ...restored, completedAt: undefined },
    { ...original, completedAt: undefined }
  );
});

test("undated Quick Add tasks move between No deadline and Completed", () => {
  const quickTask = normalizeTask({
    id: "quick-1",
    ...createQuickTaskDraft("Bring calculator"),
  });
  const [completed] = toggleTask([quickTask], "quick-1", 2000);
  const completedGroups = visibleGroups([completed]);
  const restoredGroups = visibleGroups(toggleTask([completed], "quick-1", 3000));

  assert.equal(quickTask.dueDate, "");
  assert.equal(completedGroups.noDeadline.length, 0);
  assert.equal(completedGroups.completed.length, 1);
  assert.equal(restoredGroups.noDeadline.length, 1);
});

test("old due-date completed tasks are not deleted on reload", () => {
  const oldCompletedAt = Date.now() - 400 * 24 * 60 * 60 * 1000;
  const stored = [
    task({
      id: "old-due",
      dueDate: "2024-01-15",
      completed: true,
      completedAt: oldCompletedAt,
    }),
  ];
  const loaded = withMockStorage(stored, () => loadTasks());

  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, "old-due");
  assert.equal(loaded[0].dueDate, "2024-01-15");
  assert.equal(loaded[0].completed, true);
});

test("older stored completed tasks without completion metadata remain valid", () => {
  const stored = [
    {
      id: "legacy-completed",
      subject: "English",
      title: "Legacy task",
      dueDate: "",
      effort: 2,
      completed: true,
      source: "manual",
    },
  ];
  const loaded = withMockStorage(stored, () => loadTasks());

  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, "legacy-completed");
  assert.equal(loaded[0].completed, true);
  assert.equal(Object.hasOwn(loaded[0], "completedAt"), false);
});
