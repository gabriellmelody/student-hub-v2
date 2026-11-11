import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const planPage = readFileSync(new URL("../pages/PlanPage.jsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const planStyles = readFileSync(new URL("../styles/plan.css", import.meta.url), "utf8");
const engine = readFileSync(new URL("./studyRecommendations.js", import.meta.url), "utf8");
const cloudPlanning = readFileSync(new URL("../lib/cloudPlanning.js", import.meta.url), "utf8");

test("Plan offers Today and Week from one recommendation result", () => {
  assert.match(planPage, /buildStudyRecommendations/);
  assert.match(planPage, /className="study-view-toggle" role="tablist"/);
  assert.match(planPage, /role="tab"[\s\S]*?aria-selected=\{view === "today"\}/);
  assert.match(planPage, /role="tab"[\s\S]*?aria-selected=\{view === "week"\}/);
  assert.match(planPage, /handleViewTabKeyDown/);
  assert.match(planPage, /recommendations\.today/);
  assert.match(planPage, /recommendations\.days\.map/);
});

test("Study preferences expose only account-wide block count and duration", () => {
  assert.match(planPage, /Daily study blocks/);
  assert.match(planPage, /Block duration/);
  assert.doesNotMatch(planPage, /Weekly routine|No routine Subject|updateRoutineSlot/);
  assert.match(planPage, /dailyStudyBlocks: draft\.dailyStudyBlocks/);
  assert.match(planPage, /blockDurationMinutes: draft\.blockDurationMinutes/);
  assert.match(planPage, /onSave=\{updatePlanningPreferences\}/);
});

test("Today presents the saved target and compact recommendation hierarchy", () => {
  assert.match(planPage, /<h2>Today<\/h2>/);
  assert.match(planPage, /study-daily-target/);
  assert.match(planPage, /recommendation\.reason} · \{duration} min/);
  assert.match(planPage, /study-recommendation-type/);
  assert.match(planPage, /Extra work recommended/);
  assert.match(planPage, /If you finish early/);
  assert.match(planPage, /study-priority-label/);
  assert.match(planPage, /is-priority-\$\{index \+ 1\}/);
  assert.match(planStyles, /\.study-recommendation-row\.is-priority-1/);
  assert.match(planStyles, /\.study-recommendation-finish-early \.study-recommendation-card/);
});

test("Week renders Monday–Sunday cards and marks today without clock times", () => {
  assert.match(planPage, /recommendations\.days\.map/);
  assert.match(planPage, /study-week-day\$\{day\.isToday \? " is-today"/);
  assert.match(planPage, /study-today-label/);
  assert.match(planPage, /day\.historical \? " is-past"/);
  assert.doesNotMatch(planPage, /recommendation\.start|recommendation\.end/);
});

test("recommendations are advisory blocks without clock times or Smart Planner calls", () => {
  assert.doesNotMatch(engine, /anthropic|smart-planner|fetch\(/i);
  assert.doesNotMatch(planPage, /openSmartPlanner|startTime|endTime/);
  assert.doesNotMatch(planPage, /scheduled time|start time|finish time/i);
});

test("recommendation cards open details before handing off to the existing Task flow", () => {
  assert.match(planPage, /RecommendationDetailsModal/);
  assert.match(planPage, /View recommendation details for/);
  assert.match(planPage, /Open Task/);
  assert.match(app, /requestedTaskDetailsId/);
  assert.match(app, /setActivePage\("tasks"\)/);
});

test("recommendation details expose reasons, description, alternatives and lock state", () => {
  assert.match(planPage, /Other work you could do/);
  assert.match(planPage, /recommendation\.description/);
  assert.match(planPage, /recommendation\.reason/);
  assert.match(planPage, /Locked for Redo week|Updates with Redo week/);
  assert.match(planPage, /study-detail-context/);
  assert.match(planPage, /study-alternative-subject/);
  assert.match(planPage, /onSwap\(alternative\)/);
  assert.match(planPage, /aria-modal="true"/);
});

test("card lock controls are independent and accessible", () => {
  assert.match(planPage, /study-recommendation-lock/);
  assert.match(planPage, /aria-pressed=\{recommendation\.locked\}/);
  assert.match(planPage, /Unlock.*Lock/);
  assert.match(planPage, /onClick=\{onToggleLock\}/);
});

test("Redo Week preserves locked overrides and clears unlocked future swaps", () => {
  assert.match(planPage, /"Redo week"/);
  assert.match(planPage, /clearUnlockedFutureRecommendationOverrides/);
  assert.match(planPage, /setRedoRevision/);
  assert.match(cloudPlanning, /recommendationOverrides/);
});

test("mobile Week view stacks readable days without page overflow", () => {
  assert.match(planStyles, /@media \(max-width: 700px\)[\s\S]*\.study-week-grid\s*\{[\s\S]*grid-template-columns: 1fr/);
  assert.match(planStyles, /\.study-preferences-dialog[\s\S]*max-height: calc\(100dvh - 36px\)/);
  assert.match(planStyles, /@media \(max-width: 700px\)[\s\S]*\.study-plan-title,[\s\S]*\.study-plan-controls\s*\{[\s\S]*width: 100%[\s\S]*flex: 0 1 auto/);
  assert.match(planStyles, /\.study-plan-page\s*\{[\s\S]*min-width: 0/);
  assert.match(planStyles, /@media \(max-width: 700px\)[\s\S]*\.study-detail-layout\s*\{[\s\S]*grid-template-columns: 1fr/);
});

test("desktop layout avoids narrow forced week columns and header copy collapse", () => {
  assert.match(planStyles, /\.study-plan-controls\s*\{[\s\S]*flex: 1 1 auto/);
  assert.match(planStyles, /\.study-week-grid\s*\{[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 260px\), 1fr\)\)/);
  assert.doesNotMatch(planStyles, /repeat\(7, minmax\(145px, 1fr\)\)/);
});

test("cards use Subject colour, compact assessment indicators and dense empty days", () => {
  assert.match(planPage, /--study-subject-colour/);
  assert.match(planPage, /study-assessment-indicator/);
  assert.match(planPage, /short: "F"/);
  assert.match(planPage, /short: "S"/);
  assert.match(planStyles, /\.study-recommendation-card\.has-subject-colour/);
  assert.match(planStyles, /border-left-width: 5px/);
  assert.match(planStyles, /color-mix\(in srgb, var\(--study-subject-colour\) 6%/);
  assert.match(planStyles, /\.study-week-day \.study-recommendation-empty\s*\{[\s\S]*border: 0/);
  assert.match(planStyles, /\.study-week-day\.is-past/);
});

test("fallback copy is actionable without exposing recommendation internals", () => {
  assert.match(engine, /Review today's \$\{name\} notes or reading/);
  assert.match(engine, /Review today's \$\{name\} slides and key concepts/);
  assert.match(engine, /No urgent work · Review/);
  assert.doesNotMatch(engine, /title: "Regular study"/);
});

test("Week uses light day boundaries with one Today treatment and quieter past days", () => {
  assert.match(planStyles, /\.study-week-day\s*\{[\s\S]*border-top: 1px solid var\(--border-soft\)[\s\S]*background: transparent/);
  assert.match(planStyles, /\.study-week-day\.is-today\s*\{[\s\S]*background: transparent/);
  assert.match(planStyles, /\.study-week-day\.is-past\s*\{[\s\S]*opacity: 0\.72/);
});

test("recommendation types retain explicit styling hooks", () => {
  assert.match(planPage, /Assessment prep/);
  assert.match(planPage, /Homework/);
  assert.match(planPage, /Routine study/);
  assert.match(planPage, /Extra work/);
  assert.match(planPage, /Review/);
  assert.match(planStyles, /\.study-recommendation-card\.is-assessment/);
  assert.match(planStyles, /\.study-recommendation-card\.is-homework/);
  assert.match(planStyles, /\.study-recommendation-card\.is-routine/);
  assert.match(planStyles, /\.study-recommendation-card\.is-review/);
});

test("Task, Classroom, Calendar, Notes, My Lists and notifications remain separate inputs", () => {
  assert.doesNotMatch(engine, /google-calendar|notifications|cloudNotes|cloudMyLists|classroomAutoSync/i);
  assert.match(engine, /task\.source === "classroom"/);
  assert.doesNotMatch(planPage, /taskCalendarScheduling|google-calendar|notifications|cloudNotes|cloudMyLists/i);
});

test("Plan keeps swaps and locks in the existing account-scoped preferences JSONB", () => {
  assert.match(cloudPlanning, /preferences: normalizePlanningPreferences/);
  assert.match(cloudPlanning, /recommendationOverrides: normalizeRecommendationOverrides/);
  assert.doesNotMatch(cloudPlanning, /localStorage/);
});

