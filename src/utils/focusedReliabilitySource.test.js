import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const modal = readFileSync(new URL("../components/SmartPlannerModal.jsx", import.meta.url), "utf8");
const dueDate = readFileSync(new URL("../components/DueDateField.jsx", import.meta.url), "utf8");

test("Add Task calendar affordance invokes the existing native date input", () => {
  assert.match(dueDate, /ref=\{inputRef\}/);
  assert.match(dueDate, /openDatePicker\(inputRef\.current\)/);
  assert.match(dueDate, /\n\s+Today\n/);
  assert.match(dueDate, /\n\s+Tomorrow\n/);
  assert.match(dueDate, /\n\s+Clear\n/);
});

test("Smart Planner fallback is identified at the top and direct Basic remains unmarked", () => {
  assert.match(modal, /preview\.fallback/);
  assert.ok(modal.indexOf("smart-planner-fallback-notice") < modal.indexOf("smart-planner-preview-intro"));
  assert.match(app, /fallback,\n\s+status: "ready"/);
  assert.match(app, /fallbackReason: smartPlannerPreview\.fallback\?\.reason \|\| null/);
  assert.match(app, /buildBasicPlannerPreview\(busyIntervals, getSmartPlannerFallback/);
});

test("request identity, loading guard, deadline and validation cleanup remain wired", () => {
  assert.match(app, /if \(smartPlannerLoading \|\| smartPlannerRequestRef\.current\.controller\) return/);
  assert.match(app, /smartPlannerRequestRef\.current\.id !== requestId/);
  assert.match(app, /startRequestDeadline\(controller\)/);
  assert.match(app, /function updateSmartPlannerDraft/);
  assert.match(app, /setSmartPlannerError\(""\)/);
});
