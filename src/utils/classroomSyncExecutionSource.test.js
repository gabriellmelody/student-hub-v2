import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

const syncStart = appSource.indexOf("const syncConfiguredClassroomCourses = useCallback");
const syncEnd = appSource.indexOf("useEffect(() =>", syncStart);
assert.notEqual(syncStart, -1);
assert.notEqual(syncEnd, -1);
const syncSource = appSource.slice(syncStart, syncEnd);

test("Classroom autosync reloads the current user's persisted sync settings", () => {
  assert.match(syncSource, /fetchClassroomSyncSettings\(supabase, userId\)/);
  assert.match(syncSource, /classroomSyncSettingsRef\.current = latestSettings/);
  assert.match(syncSource, /setClassroomSyncSettings\(latestSettings\)/);
});

test("Classroom manual sync can use the freshly configured Settings snapshot", () => {
  assert.match(syncSource, /settings: providedSettings/);
  assert.match(syncSource, /subjects: providedSubjects/);
  assert.match(syncSource, /Array\.isArray\(providedSettings\)/);
  assert.match(syncSource, /Array\.isArray\(providedSubjects\)/);
  assert.match(
    appSource,
    /onSyncClassroomNow=\{\(options = \{\}\) =>\s*syncConfiguredClassroomCourses\(\{ force: true, \.\.\.options \}\)/
  );
});

test("Classroom sync runs assignment reconciliation, not only course loading", () => {
  assert.match(syncSource, /\/api\/google-classroom\/coursework-preview/);
  assert.match(syncSource, /reconcileClassroomAssignments/);
  assert.match(syncSource, /upsertCloudClassroomTasks/);
  assert.match(syncSource, /markClassroomSyncSettingsSynced/);
});

test("Classroom sync only imports configured active settings with Subject links", () => {
  assert.match(
    syncSource,
    /setting\.syncEnabled !== false && setting\.subjectId/
  );
});
