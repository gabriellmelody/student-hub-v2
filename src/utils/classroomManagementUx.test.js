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
  assert.match(managerSource, /Manage ›/);
  assert.match(managerSource, /\+ Add class/);
});

test("Add class is hidden when no unconfigured courses remain", () => {
  assert.match(managerSource, /unconfiguredCourses\.length > 0 &&/);
});

test("Add class opens the lightweight picker", () => {
  assert.match(managerSource, /setAddClassesOpen\(\(open\) => !open\)/);
  assert.match(managerSource, /addClassesOpen &&/);
  assert.match(managerSource, /className="classroom-picker-list"/);
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
  assert.match(managerSource, /Edit/);
  assert.match(managerSource, /startRenamingClassroomSubject/);
  assert.match(managerSource, /saveRenamedClassroomSubject/);
  assert.match(managerSource, /renameSubjectDraft/);
  assert.doesNotMatch(managerSource, /window\.prompt/);
});

test("Manage expands and Done collapses the selected class", () => {
  assert.match(managerSource, /managedCourseId === setting\.classroomCourseId/);
  assert.match(managerSource, /setManagedCourseId\(managed \? "" : setting\.classroomCourseId\)/);
  assert.match(managerSource, /managed \? "Done" : "Manage/);
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

test("normal Sync now runs assignment sync without refreshing the class list", () => {
  assert.match(managerSource, /async function syncNow/);
  const syncNowStart = managerSource.indexOf("async function syncNow");
  const syncNowEnd = managerSource.indexOf("if (!session?.connected)", syncNowStart);
  const syncNowSource = managerSource.slice(syncNowStart, syncNowEnd);

  assert.doesNotMatch(syncNowSource, /onLoadCourses/);
  assert.match(syncNowSource, /await onSyncNow\(\)/);
  assert.match(managerSource, /className="small-button"/);
});

test("class refresh does not create phantom sync settings", () => {
  const loadCoursesStart = settingsSource.indexOf("async function loadRealClassroomCourses");
  const loadCoursesEnd = settingsSource.indexOf("function setRealClassroomManagerPageOpen", loadCoursesStart);
  const loadCoursesSource = settingsSource.slice(loadCoursesStart, loadCoursesEnd);

  assert.doesNotMatch(loadCoursesSource, /mergeClassroomCoursesWithSettings/);
  assert.doesNotMatch(loadCoursesSource, /saveClassroomSyncSettings/);
});

test("configured dashboard requires a linked Subject row", () => {
  assert.match(
    managerSource,
    /setting\.syncEnabled !== false && setting\.subjectId/
  );
});

test("setup syncs immediately with the freshly saved settings and Subjects", () => {
  assert.match(managerSource, /const subjectsForSync = \[\.\.\.subjects\]/);
  assert.match(
    managerSource,
    /await onSyncNow\(\{ settings: nextSettings, subjects: subjectsForSync \}\)/
  );
});

test("sync preferences use student-facing switch labels", () => {
  assert.match(settingsSource, /className="classroom-toggle-row/);
  assert.match(settingsSource, /updatePreference\("syncEnabled"/);
  assert.match(settingsSource, /updatePreference\("syncActive"/);
  assert.match(settingsSource, /updatePreference\("syncNoDueDate"/);
  assert.match(settingsSource, /updatePreference\("syncCompleted"/);
  assert.match(settingsSource, /Past completed work/);
  assert.match(settingsSource, /Import work you completed before DayLo first saw it/);
});

test("human-readable sync status is relative", () => {
  assert.match(settingsSource, /function formatRelativeClassroomSyncTime/);
  assert.match(settingsSource, /just now/);
  assert.match(settingsSource, /min ago/);
  assert.match(settingsSource, /hr/);
  assert.doesNotMatch(managerSource, /Synced \$\{formatConnectionTime/);
});

test("advanced manual tools are behind progressive disclosure", () => {
  assert.match(managerSource, /className="classroom-advanced-tools"/);
  assert.match(managerSource, /Preview assignments/);
  assert.match(managerSource, /Archive no-due-date tasks/);
});

test("old Completed history label is not normal user-facing copy", () => {
  assert.doesNotMatch(normalDashboardSource, /Completed history/);
  assert.match(normalDashboardSource, /Past completed work/);
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
