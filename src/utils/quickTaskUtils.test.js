import assert from "node:assert/strict";
import test from "node:test";

import {
  createQuickTaskDraft,
  normalizeTask,
  updateTaskTitleWithDetection,
} from "./appUtils.js";

function addTaskToArray(tasks, taskInput, id = Date.now()) {
  if (!taskInput.title.trim()) return tasks;

  return [
    ...tasks,
    normalizeTask({
      id,
      subject: taskInput.subject.trim(),
      title: taskInput.title.trim(),
      dueDate: taskInput.dueDate,
      effort: Number(taskInput.effort),
      completed: false,
      source: "manual",
      externalId: null,
      classroomCourseId: null,
      classroomCourseName: null,
      importedAt: null,
      lastSyncedAt: null,
      taskType: taskInput.taskType,
      importance: taskInput.importance,
      detectedTags: taskInput.detectedTags,
      importanceSource: taskInput.importanceSource,
    }),
  ];
}

function submitQuickTask(tasks, title, id) {
  return addTaskToArray(tasks, createQuickTaskDraft(title), id);
}

test("Quick Add creates a task from a valid title", () => {
  const tasks = submitQuickTask([], "Bring calculator", "task-1");

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, "Bring calculator");
});

test("Enter submits through the same Quick Add submit path", () => {
  const tasks = submitQuickTask([], "Collect papers from Mr Ram", "task-1");

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, "Collect papers from Mr Ram");
});

test("Quick Add trims surrounding whitespace", () => {
  const tasks = submitQuickTask([], "  10 minutes of Spanish practice  ", "task-1");

  assert.equal(tasks[0].title, "10 minutes of Spanish practice");
});

test("Quick Add ignores empty or spaces-only titles", () => {
  assert.deepEqual(submitQuickTask([], "", "task-1"), []);
  assert.deepEqual(submitQuickTask([], "   ", "task-1"), []);
});

test("Quick Add uses the normal DayLo task model", () => {
  const [task] = submitQuickTask([], "Bring calculator", "task-1");

  assert.equal(task.id, "task-1");
  assert.equal(task.subject, "");
  assert.equal(task.effort, 2);
  assert.equal(task.completed, false);
  assert.equal(task.source, "manual");
  assert.equal(task.externalId, null);
  assert.equal(task.classroomCourseId, null);
  assert.equal(task.classroomCourseName, null);
  assert.equal(task.importedAt, null);
  assert.equal(task.lastSyncedAt, null);
  assert.equal(task.taskType, "homework");
  assert.equal(task.importance, "normal");
  assert.deepEqual(task.detectedTags, []);
  assert.equal(task.importanceSource, "auto");
  assert.equal(task.archived, false);
});

test("Quick Add does not fabricate a due date", () => {
  const [task] = submitQuickTask([], "Bring calculator", "task-1");

  assert.equal(task.dueDate, "");
});

test("existing detailed Add Task flow still accepts detailed task fields", () => {
  const tasks = addTaskToArray(
    [],
    {
      subject: "Maths",
      title: "Finish worksheet",
      dueDate: "2026-08-12",
      effort: 4,
      taskType: "homework",
      importance: "normal",
      detectedTags: [],
      importanceSource: "manual",
    },
    "task-1"
  );

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].subject, "Maths");
  assert.equal(tasks[0].title, "Finish worksheet");
  assert.equal(tasks[0].dueDate, "2026-08-12");
  assert.equal(tasks[0].effort, 4);
});

test("More details preserves a typed Quick Add title", () => {
  const draft = {
    subject: "",
    title: "",
    dueDate: "",
    effort: 2,
    taskType: "homework",
    importance: "normal",
    detectedTags: [],
    importanceSource: "auto",
  };

  const detailedDraft = updateTaskTitleWithDetection(draft, "Bring calculator");

  assert.equal(detailedDraft.title, "Bring calculator");
});

test("repeated Quick Adds append tasks without overwriting earlier tasks", () => {
  const first = submitQuickTask([], "Bring calculator", "task-1");
  const second = submitQuickTask(first, "Collect papers from Mr Ram", "task-2");

  assert.deepEqual(
    second.map((task) => task.title),
    ["Bring calculator", "Collect papers from Mr Ram"]
  );
});
