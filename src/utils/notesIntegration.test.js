import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const appStyles = readFileSync(new URL("../App.css", import.meta.url), "utf8");
const chrome = readFileSync(new URL("../components/AppChrome.jsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../pages/NotesPage.jsx", import.meta.url), "utf8");
const hook = readFileSync(new URL("../hooks/useCloudNotes.js", import.meta.url), "utf8");
const cloud = readFileSync(new URL("../lib/cloudNotes.js", import.meta.url), "utf8");

test("Notes is dormant and absent from desktop, mobile and direct navigation", () => {
  assert.doesNotMatch(app, /"\/notes": "notes"/);
  assert.doesNotMatch(app, /notes: "\/notes"/);
  assert.doesNotMatch(app, /label="Notes"/);
  assert.doesNotMatch(app, /<NotesPage|useCloudNotes/);
  assert.doesNotMatch(chrome, /activePage === "notes"/);
  assert.doesNotMatch(chrome, /navigate\("notes"\)|<strong>Notes<\/strong>/);
  assert.doesNotMatch(appStyles, /styles\/notes\.css/);
  assert.match(app, /activePage: "home"/);
});

test("Notes uses structured TipTap JSON with the required formatting", () => {
  assert.match(page, /@tiptap\/react/);
  assert.match(page, /StarterKit/);
  assert.match(page, /TaskList/);
  assert.match(page, /TaskItem\.configure/);
  assert.match(page, /toggleBold/);
  assert.match(page, /toggleItalic/);
  assert.match(page, /toggleHeading/);
  assert.match(page, /toggleBulletList/);
  assert.match(page, /toggleOrderedList/);
  assert.match(page, /toggleTaskList/);
});

test("editor changes and checklist toggles share the debounced autosave path", () => {
  assert.match(page, /onUpdate: \(\{ editor: currentEditor \}\)/);
  assert.match(page, /window\.clearTimeout\(autosaveTimerRef\.current\)/);
  assert.match(page, /NOTE_AUTOSAVE_DELAY_MS/);
  assert.match(page, /saveNote\(noteId, \{ title: snapshot\.title, content: snapshot\.content \}\)/);
});

test("save failures preserve local draft text and expose retry", () => {
  assert.match(page, /dirtyRef\.current = true/);
  assert.match(page, /Couldn’t save\. Your text is still here/);
  assert.match(page, /onRetrySave/);
});

test("Realtime cannot replace active unsaved editor state", () => {
  assert.match(page, /if \(!changedNote \|\| dirtyRef\.current\) return/);
  assert.match(page, /editVersionRef\.current === version/);
  assert.match(hook, /REALTIME_REFETCH_DELAY_MS/);
});

test("account switching clears Notes before the next account loads", () => {
  assert.match(hook, /activeUserRef\.current = userId/);
  assert.match(hook, /workspaceRef\.current = EMPTY_WORKSPACE/);
  assert.match(hook, /setWorkspaceState\(\{ userId: "", \.\.\.EMPTY_WORKSPACE \}\)/);
  assert.match(hook, /activeUserRef\.current !== userId/);
});

test("folders, pinning and Recently Deleted actions remain explicit", () => {
  assert.match(page, /All Notes/);
  assert.match(page, /Pinned/);
  assert.match(page, /Recently Deleted/);
  assert.match(page, /Pin note|\{note\.pinned \? "Unpin" : "Pin"\}/);
  assert.match(page, /Move note to folder/);
  assert.match(page, /Delete permanently/);
  assert.match(page, /Restore/);
});

test("panel toggles remain available when no note is selected", () => {
  const emptyEditor = page.slice(page.indexOf("if (!note)"), page.indexOf("const deleted = Boolean(note.deletedAt)"));
  assert.match(emptyEditor, /onToggleFolders/);
  assert.match(emptyEditor, /onToggleList/);
  assert.match(emptyEditor, /No note selected/);
});

test("Notes stays outside Tasks, My Lists, Smart Planner, Calendar and notifications", () => {
  const notesSource = `${page}\n${hook}\n${cloud}`;
  assert.doesNotMatch(cloud, /from\("tasks"\)|from\("my_lists"\)|from\("my_list_items"\)/);
  assert.doesNotMatch(notesSource, /SmartPlanner|smartPlanner|calendarId|Google Calendar|notification_preferences|push_subscriptions/);
});

test("the dormant editor and cloud implementation remain intact but are not loaded by App", () => {
  assert.doesNotMatch(app, /NotesPage|useCloudNotes|<Suspense fallback=/);
  assert.match(page, /function NotesPage/);
  assert.match(hook, /export default function useCloudNotes/);
  assert.match(cloud, /from\("notes"\)/);
});
