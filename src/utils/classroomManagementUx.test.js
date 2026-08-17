import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const settingsSource = readFileSync(
  new URL("../pages/SettingsPage.jsx", import.meta.url),
  "utf8"
);
const settingsCss = readFileSync(
  new URL("../styles/settings.css", import.meta.url),
  "utf8"
);

const managerStart = settingsSource.indexOf("function RealClassroomCourseReviewPage");
const managerEnd = settingsSource.indexOf("function formatRealClassroomAssignmentDueDate");
assert.notEqual(managerStart, -1);
assert.notEqual(managerEnd, -1);
const managerSource = settingsSource.slice(managerStart, managerEnd);
const normalDashboardEnd = managerSource.indexOf("className=\"classroom-advanced-tools\"");
const normalDashboardSource = managerSource.slice(0, normalDashboardEnd);

test("disconnected Classroom manager shows Connect Classroom", () => {
  assert.match(managerSource, /Automatically keep your DayLo assignments up to date/);
  assert.match(managerSource, /Connect Google Classroom/);
});

test("connected unconfigured Classroom manager shows first-time setup", () => {
  assert.match(managerSource, /Choose your classes/);
  assert.match(managerSource, /What should DayLo sync/);
  assert.match(managerSource, /Start syncing/);
});

test("configured Classroom manager shows dashboard instead of setup", () => {
  assert.match(managerSource, /Your classes/);
  assert.match(managerSource, /Manage →/);
  assert.match(managerSource, /Add classes/);
});

test("normal dashboard no longer exposes old Include or review tabs", () => {
  assert.doesNotMatch(normalDashboardSource, /Include all/);
  assert.doesNotMatch(normalDashboardSource, /Ignore all/);
  assert.doesNotMatch(normalDashboardSource, /Needs review/);
  assert.doesNotMatch(normalDashboardSource, /Assignment preview/);
  assert.doesNotMatch(normalDashboardSource, /Cleanup/);
});

test("Classroom setup creates or reuses reliable Subjects", () => {
  assert.match(settingsSource, /function getReliableClassroomSubject/);
  assert.match(settingsSource, /subject\.classroomCourseId === courseId/);
  assert.match(settingsSource, /subject\.externalId === courseId/);
  assert.match(managerSource, /createCloudSubject/);
  assert.match(managerSource, /name: course\.name \|\| "Untitled class"/);
});

test("sync settings preserve UUID links and defaults", () => {
  assert.match(managerSource, /subjectId: subject\.id/);
  assert.match(managerSource, /syncEnabled: true/);
  assert.match(managerSource, /syncActive: preferences\.syncActive !== false/);
  assert.match(managerSource, /syncNoDueDate: preferences\.syncNoDueDate === true/);
  assert.match(managerSource, /syncCompleted: preferences\.syncCompleted === true/);
});

test("renamed Subject remains the card title with original course context", () => {
  assert.match(managerSource, /const title = subject\?\.name/);
  assert.match(managerSource, /setting\.classroomCourseName, "Google Classroom"/);
  assert.match(managerSource, /Rename Subject/);
});

test("Add classes excludes already configured courses", () => {
  assert.match(managerSource, /configuredCourseIds/);
  assert.match(managerSource, /!configuredCourseIds\.has/);
});

test("Stop syncing keeps existing DayLo data", () => {
  assert.match(managerSource, /Existing DayLo tasks will stay/);
  assert.match(managerSource, /syncEnabled: false/);
  assert.doesNotMatch(managerSource, /deleteCloudTask|deleteCloudSubject/);
});

test("normal Sync now refreshes classes and syncs", () => {
  assert.match(managerSource, /async function syncNow/);
  assert.match(managerSource, /await onLoadCourses\(\)/);
  assert.match(managerSource, /await onSyncNow\(\)/);
});

test("advanced manual tools are behind progressive disclosure", () => {
  assert.match(managerSource, /className="classroom-advanced-tools"/);
  assert.match(managerSource, /Preview assignments/);
  assert.match(managerSource, /Archive no-due-date tasks/);
});

test("Open Classroom is only shown when course URL exists", () => {
  assert.match(managerSource, /course\?\.alternateLink &&/);
  assert.match(managerSource, /rel="noopener noreferrer"/);
});

test("mobile styles prevent horizontal dashboard overflow", () => {
  assert.match(settingsCss, /@media \(max-width: 560px\)/);
  assert.match(settingsCss, /\.classroom-watch-card-main/);
  assert.match(settingsCss, /flex-direction: column/);
  assert.match(settingsCss, /width: 100%/);
});
