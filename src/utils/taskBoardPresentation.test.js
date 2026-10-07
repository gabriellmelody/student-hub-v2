import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mapCloudTask, mapTaskForUpdate } from "../lib/cloudTasks.js";

const tasksPage = readFileSync(new URL("../pages/TasksPage.jsx", import.meta.url), "utf8");
const taskCard = readFileSync(new URL("../components/TaskCard.jsx", import.meta.url), "utf8");
const taskDetails = readFileSync(
  new URL("../components/TaskDetailsModal.jsx", import.meta.url),
  "utf8"
);
const planner = readFileSync(
  new URL("../../server/smart-planner/planner.js", import.meta.url),
  "utf8"
);

test("Due date is the default board and Priority is the only secondary board", () => {
  assert.match(tasksPage, /useState\("dueDate"\)/);
  assert.match(tasksPage, />\s*Due date\s*</);
  assert.match(tasksPage, />\s*Priority\s*</);
  assert.match(tasksPage, /createDueDateBoardColumns/);
  assert.match(tasksPage, /createPriorityBoardColumns/);
});

test("the shared compact card opens the selected task details", () => {
  assert.match(taskCard, /onOpen\(task\.id, event\.currentTarget\)/);
  assert.match(tasksPage, /setSelectedTaskId\(taskId\)/);
  assert.match(tasksPage, /<TaskDetailsModal[\s\S]*task=\{selectedTask\}/);
  assert.match(taskDetails, /value=\{draftTask\.title\}/);
  assert.match(taskDetails, /value=\{draftTask\.description\}/);
});

test("Task Details keeps subject, classification, priority, effort, and due editing", () => {
  assert.match(taskDetails, /<SubjectField/);
  assert.match(taskDetails, /<DueDateField/);
  assert.match(taskDetails, /type="time"/);
  assert.match(taskDetails, /<TaskClassificationFields/);
  assert.match(taskDetails, /Academic classification/);
  assert.match(taskDetails, /task-details-effort/);
});

test("Task Details exposes completion and deletion while Classroom action is source-gated", () => {
  assert.match(taskDetails, /onToggle\(task\.id\)/);
  assert.match(taskDetails, /onDelete\(task\.id\)/);
  assert.match(taskDetails, /task\.source === "classroom"/);
  assert.match(taskDetails, /Open in Classroom/);
  assert.doesNotMatch(taskDetails, /task\.source === "manual"[\s\S]*Open in Classroom/);
});

test("multiline descriptions survive load, edit, clear, and planner serialization", () => {
  const loaded = mapCloudTask({
    id: "task-1",
    title: "Essay",
    description: "Plan thesis\nDraft introduction",
  });
  assert.equal(loaded.description, "Plan thesis\nDraft introduction");
  assert.equal(mapTaskForUpdate({ ...loaded, description: "Updated\nnotes" }).description, "Updated\nnotes");
  assert.equal(mapTaskForUpdate({ ...loaded, description: "" }).description, "");
  assert.match(planner, /description: text\(task\.description, 500\)/);
});

test("manual creation keeps description directly below title and supports due time", () => {
  const titlePosition = tasksPage.indexOf("<span>Task title</span>");
  const descriptionPosition = tasksPage.indexOf("<span>Description (optional)</span>");
  const subjectPosition = tasksPage.indexOf("<span>Subject</span>");
  assert.ok(titlePosition >= 0);
  assert.ok(descriptionPosition > titlePosition);
  assert.ok(subjectPosition > descriptionPosition);
  assert.match(tasksPage, /value=\{newTask\.dueTime \|\| ""\}/);
});
