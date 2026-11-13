import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const tasksPage = readFileSync(new URL("../pages/TasksPage.jsx", import.meta.url), "utf8");
const taskDetails = readFileSync(new URL("../components/TaskDetailsModal.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles/tasks.css", import.meta.url), "utf8");

test("To-do uses one prominent Add task action and no Kanban column actions", () => {
  assert.doesNotMatch(tasksPage, /task-quick-add|Quick add task|addQuickTask/);
  assert.match(tasksPage, /className="primary-button task-add-trigger"/);
  assert.doesNotMatch(tasksPage, /className="task-board-add-task"/);
  assert.doesNotMatch(tasksPage, /<TaskBoard/);
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

test("grouped list renders useful groups and leaves completed tasks separate", () => {
  assert.match(tasksPage, /function TaskGroupList/);
  assert.match(tasksPage, /task-grouped-list/);
  assert.match(tasksPage, /populatedColumns/);
  assert.match(tasksPage, /task-completed-section/);
});

test("task groups collapse independently with high-value groups expanded by default", () => {
  assert.match(tasksPage, /new Set\(\["later", "unscheduled"\]\)/);
  assert.match(tasksPage, /aria-expanded=\{!collapsed\}/);
  assert.match(tasksPage, /onToggleGroup\(column\.id\)/);
  assert.match(tasksPage, /setCompletedOpen\(\(open\) => !open\)/);
  assert.doesNotMatch(tasksPage, /new Set\(\["overdue"|new Set\(\["date:/);
});

test("compact rows and Task Details retain completion behavior and metadata", () => {
  assert.match(tasksPage, /<TaskListRow/);
  assert.match(tasksPage, /<TaskDetailsModal/);
  assert.match(tasksPage, /onToggleTask\(task\.id\)/);
  assert.match(tasksPage, /onOpenTask\(task\.id/);
  assert.match(tasksPage, /task\.subject/);
  assert.match(tasksPage, /academicLabel/);
  assert.match(tasksPage, /formatTaskDueLabel/);
  assert.match(tasksPage, /TaskSourceBadge/);
  assert.match(taskDetails, /Schedule study time/);
  assert.match(taskDetails, /Open in Classroom/);
});

test("Completed reuses the same full-width row and active urgency is replaced by completion metadata", () => {
  assert.match(tasksPage, /<TaskListRow[\s\S]*completed/);
  assert.match(tasksPage, /completed \? formatTaskCompletionLabel\(task\) : formatTaskDueLabel\(task\)/);
  assert.doesNotMatch(tasksPage, /task-completed-grid/);
  assert.match(styles, /\.task-list-row\.is-completed \.task-list-due/);
});

test("successful completion feedback and Set study block use existing cloud flows", () => {
  assert.match(tasksPage, /const saved = await toggleTask\(taskId\)/);
  assert.match(tasksPage, /if \(saved && task && !task\.completed\)/);
  assert.match(tasksPage, /task-completion-toast/);
  assert.match(tasksPage, /role="status" aria-live="polite"/);
  assert.match(taskDetails, /Set study block/);
  assert.match(taskDetails, /validStudyDates/);
  assert.match(taskDetails, /defaultStudyDuration/);
  assert.match(tasksPage, /createManualTaskStudyRecommendation/);
  assert.match(tasksPage, /updatePlanningPreferences/);
});

test("mobile grouped rows wrap safely and keep a full-width usable modal", () => {
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.task-list-row-main\s*\{[\s\S]*display: flex[\s\S]*flex-wrap: wrap/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.task-list-subject,[\s\S]*\.task-list-row-main > strong\s*\{[\s\S]*width: 100%/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.task-details-dialog\s*{[^}]*width:\s*100%/);
  assert.match(styles, /\.task-add-actions\s*{[^}]*grid-template-columns:\s*1fr 1fr/s);
});

test("search and Due date or Priority grouping share the same list presentation", () => {
  assert.match(tasksPage, /type="search"/);
  assert.match(tasksPage, /columns = taskView === "dueDate" \? dueDateColumns : priorityColumns/);
  assert.match(tasksPage, /columns=\{visibleColumns\}/);
  assert.match(tasksPage, /Due date/);
  assert.match(tasksPage, /Priority/);
});

test("desktop rows use stable metadata columns and semantic assessment hooks", () => {
  assert.match(tasksPage, /task-list-classification \$\{classificationTone\}/);
  assert.match(tasksPage, /is-summative/);
  assert.match(tasksPage, /is-formative/);
  assert.match(tasksPage, /is-cfa/);
  assert.match(styles, /\.task-list-row-main\s*\{[\s\S]*grid-template-columns:/);
  assert.match(styles, /\.task-list-classification\.is-summative/);
  assert.match(styles, /\.task-list-classification\.is-formative/);
  assert.match(styles, /\.task-list-classification\.is-cfa/);
});
