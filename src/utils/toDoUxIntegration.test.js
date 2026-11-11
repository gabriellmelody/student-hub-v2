import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const tasksPage = readFileSync(new URL("../pages/TasksPage.jsx", import.meta.url), "utf8");
const taskCard = readFileSync(new URL("../components/TaskCard.jsx", import.meta.url), "utf8");
const taskDetails = readFileSync(new URL("../components/TaskDetailsModal.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles/tasks.css", import.meta.url), "utf8");

test("global Quick Add is removed while every board column exposes Add task", () => {
  assert.doesNotMatch(tasksPage, /task-quick-add|Quick add task|addQuickTask/);
  assert.match(tasksPage, /className="task-board-add-task"/);
  assert.match(tasksPage, /aria-label={`Add task to \$\{column\.label\}`}/);
  assert.match(tasksPage, /boardMode={taskView}/);
});

test("Add Task is a focus-trapped modal with explicit optional due time", () => {
  assert.match(tasksPage, /createPortal\(/);
  assert.match(tasksPage, /role="dialog"/);
  assert.match(tasksPage, /aria-modal="true"/);
  assert.match(tasksPage, /getTourFocusTrapTarget/);
  assert.match(tasksPage, /blockGuidedTourBackground/);
  assert.match(tasksPage, /Add time/);
  assert.match(tasksPage, /Remove time/);
  assert.match(tasksPage, /dueTime: ""/);
});

test("board expansion is per-column and leaves completed tasks separate", () => {
  assert.match(tasksPage, /new Set\(current\)/);
  assert.match(tasksPage, /const columnKey = `\$\{boardMode\}:\$\{column\.id\}`/);
  assert.match(tasksPage, /Show \$\{hiddenCount\} more/);
  assert.match(tasksPage, /Show less/);
  assert.match(tasksPage, /task-completed-section/);
});

test("cards and Task Details retain their existing behavior and metadata", () => {
  assert.match(tasksPage, /<TaskCard/);
  assert.match(tasksPage, /<TaskDetailsModal/);
  assert.match(taskCard, /onOpen\(task\.id/);
  assert.match(taskCard, /task\.subject/);
  assert.match(taskCard, /academicLabel/);
  assert.match(taskCard, /dueTime/);
  assert.match(taskDetails, /Schedule study time/);
  assert.match(taskDetails, /Open in Classroom/);
});

test("mobile keeps the horizontal board and full-width usable modal", () => {
  assert.match(styles, /\.task-board-scroll\s*{[^}]*overflow-x:\s*auto/s);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.task-details-dialog\s*{[^}]*width:\s*100%/);
  assert.match(styles, /\.task-add-actions\s*{[^}]*grid-template-columns:\s*1fr 1fr/s);
});
