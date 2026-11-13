import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const planPage = readFileSync(new URL("../pages/PlanPage.jsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const planStyles = readFileSync(new URL("../styles/plan.css", import.meta.url), "utf8");
const shellStyles = readFileSync(new URL("../styles/shell.css", import.meta.url), "utf8");
const calendarStyles = readFileSync(new URL("../styles/calendar.css", import.meta.url), "utf8");
const engine = readFileSync(new URL("./studyRecommendations.js", import.meta.url), "utf8");
const cloudPlanning = readFileSync(new URL("../lib/cloudPlanning.js", import.meta.url), "utf8");

test("Plan offers Today and Next 7 Days from one recommendation result", () => {
  assert.match(planPage, /buildStudyRecommendations/);
  assert.match(planPage, /className="study-view-toggle" role="tablist"/);
  assert.match(planPage, /role="tab"[\s\S]*?aria-selected=\{view === "today"\}/);
  assert.match(planPage, /role="tab"[\s\S]*?aria-selected=\{view === "next7"\}/);
  assert.match(planPage, />Next 7 Days</);
  assert.doesNotMatch(planPage, />Week</);
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
  assert.match(planPage, /\+1 more optional/);
  assert.match(planPage, /aria-expanded=\{optionalOpen\}/);
  assert.match(planPage, /study-priority-label/);
  assert.match(planPage, /is-priority-\$\{index \+ 1\}/);
  assert.match(planStyles, /\.study-recommendation-row\.is-priority-1/);
  assert.match(planStyles, /\.study-recommendation-finish-early \.study-recommendation-card/);
});

test("Next 7 Days renders a rolling vertical horizon and marks today without clock times", () => {
  assert.match(planPage, /recommendations\.days\.map/);
  assert.match(planPage, /study-horizon-day\$\{day\.isToday \? " is-today"/);
  assert.match(planPage, /formatHorizonRange\(recommendations\.weekStart, recommendations\.weekEnd\)/);
  assert.match(planPage, /study-today-label/);
  assert.match(planPage, /study-horizon-days/);
  assert.match(planPage, /day\.deadlines\?\.map/);
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
  assert.match(planPage, /Locked for Redo plan|Updates with Redo plan/);
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

test("Redo plan preserves locked and manual overrides", () => {
  assert.match(planPage, /"Redo plan"/);
  assert.match(planPage, /clearUnlockedFutureRecommendationOverrides/);
  assert.match(planPage, /setRedoRevision/);
  assert.match(cloudPlanning, /recommendationOverrides/);
});

test("mobile Next 7 Days stacks readable days without page overflow", () => {
  assert.match(planStyles, /@media \(max-width: 700px\)[\s\S]*\.study-horizon-day\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(planStyles, /\.study-preferences-dialog[\s\S]*max-height: calc\(100dvh - 36px\)/);
  assert.match(planStyles, /@media \(max-width: 700px\)[\s\S]*\.study-plan-title,[\s\S]*\.study-plan-controls\s*\{[\s\S]*width: 100%[\s\S]*flex: 0 1 auto/);
  assert.match(planStyles, /\.study-plan-page\s*\{[\s\S]*min-width: 0/);
  assert.match(planStyles, /@media \(max-width: 700px\)[\s\S]*\.study-detail-layout\s*\{[\s\S]*grid-template-columns: 1fr/);
});

test("desktop layout uses a readable vertical horizon and avoids header copy collapse", () => {
  assert.match(planStyles, /\.study-plan-controls\s*\{[\s\S]*flex: 1 1 auto/);
  assert.match(planStyles, /\.study-horizon-day\s*\{[\s\S]*grid-template-columns: 150px minmax\(0, 1fr\) 96px/);
  assert.doesNotMatch(planStyles, /repeat\(7, minmax\(145px, 1fr\)\)/);
  assert.match(planStyles, /\.study-today-panel\s*\{[\s\S]*margin-inline: auto/);
});

test("desktop shell scroll remains available without a prominent main scrollbar", () => {
  assert.match(shellStyles, /@media \(min-width: 701px\)[\s\S]*\.main-content\s*\{[\s\S]*overflow-y: auto/);
  assert.match(shellStyles, /\.main-content\s*\{[\s\S]*scrollbar-width: none/);
  assert.match(shellStyles, /\.main-content::\-webkit-scrollbar\s*\{[\s\S]*display: none/);
  assert.match(shellStyles, /\.nav\s*\{[\s\S]*scrollbar-width: thin/);
});

test("desktop month Calendar fits its grid inside the app viewport", () => {
  assert.match(calendarStyles, /@media \(min-width: 901px\) and \(min-height: 900px\)/);
  assert.match(calendarStyles, /\.calendar-page\s*\{[\s\S]*height: calc\(100dvh - var\(--density-main-top\) - var\(--density-main-bottom\)\)/);
  assert.match(calendarStyles, /\.calendar-month-panel:not\(\.calendar-week-panel\) \.calendar-grid\s*\{[\s\S]*grid-template-rows: repeat\(6, minmax\(112px, 1fr\)\)/);
});

test("cards use Subject colour, compact assessment indicators and deadline markers", () => {
  assert.match(planPage, /--study-subject-colour/);
  assert.match(planPage, /study-assessment-indicator/);
  assert.match(planPage, /short: "F"/);
  assert.match(planPage, /short: "S"/);
  assert.match(planStyles, /\.study-recommendation-card\.has-subject-colour/);
  assert.match(planStyles, /border-left-width: 5px/);
  assert.match(planStyles, /color-mix\(in srgb, var\(--study-subject-colour\) 6%/);
  assert.match(planStyles, /\.study-horizon-deadline\s*\{/);
  assert.match(planStyles, /\.study-horizon-empty\s*\{/);
});

test("fallback copy is actionable without exposing recommendation internals", () => {
  assert.match(engine, /Review today's \$\{name\} notes or reading/);
  assert.match(engine, /Review today's \$\{name\} slides and key concepts/);
  assert.match(engine, /No urgent work · Review/);
  assert.doesNotMatch(engine, /title: "Regular study"/);
});

test("Next 7 Days uses clear day boundaries with one Today treatment", () => {
  assert.match(planStyles, /\.study-horizon-day\s*\{[\s\S]*border: 1px solid var\(--border-soft\)/);
  assert.match(planStyles, /\.study-horizon-day\.is-today\s*\{[\s\S]*border-color: var\(--accent-border\)/);
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

test("Next 7 Days exposes drag and accessible manual move controls", () => {
  assert.match(planPage, /draggable/);
  assert.match(planPage, /handleRecommendationDragStart/);
  assert.match(planPage, /onDropRecommendation/);
  assert.match(planPage, /Move to…/);
  assert.match(planPage, /Move block/);
  assert.match(planPage, /isRecommendationEligibleOnDate/);
  assert.match(planStyles, /\.study-horizon-day\.is-drop-valid/);
  assert.match(planStyles, /\.study-horizon-day\.is-drop-invalid/);
  assert.match(planPage, /Remove study block/);
  assert.match(planPage, /handleRemoveRecommendation/);
  assert.match(planStyles, /\.study-detail-remove/);
});

test("per-block durations drive card, day, and horizon totals", () => {
  assert.match(planPage, /getRecommendationDurationMinutes/);
  assert.match(planPage, /getDayStudyMinutes/);
  assert.match(planPage, /getHorizonStudyMinutes/);
  assert.match(planPage, /onDurationChange/);
  assert.match(planPage, /PLAN_BLOCK_DURATION_OPTIONS/);
  assert.match(engine, /export function getDayStudyMinutes/);
  assert.match(engine, /export function getHorizonStudyMinutes/);
});

test("Today remains centered and priority labels stay attached to cards", () => {
  assert.match(planStyles, /\.study-today-panel\s*\{[\s\S]*width: min\(100%, 980px\)[\s\S]*margin-inline: auto/);
  assert.match(planStyles, /\.study-recommendation-row\s*\{[\s\S]*gap: 3px/);
});

