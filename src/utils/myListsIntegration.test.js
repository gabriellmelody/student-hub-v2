import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../pages/MyListsPage.jsx", import.meta.url), "utf8");
const hook = readFileSync(new URL("../hooks/useCloudMyLists.js", import.meta.url), "utf8");
const cloud = readFileSync(new URL("../lib/cloudMyLists.js", import.meta.url), "utf8");

test("My Lists is a separate sidebar destination", () => {
  assert.match(app, /label="My Lists"/);
  assert.match(app, /activePage === "myLists"/);
  assert.match(app, /<MyListsPage workspace=\{myListsWorkspace\} subjects=\{subjects\}/);
});

test("direct My Lists reload follows the existing path-state architecture", () => {
  assert.match(app, /"\/my-lists": "myLists"/);
  assert.match(app, /myLists: "\/my-lists"/);
});

test("account switching hides prior My Lists state before loading the next account", () => {
  assert.match(hook, /workspace\.userId === userId \? workspace\.lists : EMPTY_LISTS/);
  assert.match(hook, /activeUserRef\.current = userId/);
  assert.match(hook, /activeUserRef\.current !== userId/);
});

test("populated list deletion requires explicit card-loss confirmation", () => {
  assert.match(page, /list\.items\.length > 0 && !window\.confirm/);
  assert.match(page, /and its \$\{list\.items\.length\}/);
});

test("completed cards are hidden by default and can be shown", () => {
  assert.match(page, /useState\(false\)/);
  assert.match(page, /getVisibleMyListItems\(list\.items, showCompleted\)/);
  assert.match(page, />Show completed</);
});

test("active cards expose an independent accessible completion control", () => {
  assert.match(page, /className="my-list-card-complete"/);
  assert.match(page, /`Mark \$\{item\.title\} complete`/);
  assert.match(page, /event\.stopPropagation\(\)/);
  assert.match(page, /updateItem\(item\.id, \{ completed: !item\.completed \}\)/);
});

test("completed cards can be reopened from the board and details", () => {
  const modal = readFileSync(new URL("../components/MyListItemModal.jsx", import.meta.url), "utf8");
  assert.match(page, /item\.completed\s*\? `Reopen \$\{item\.title\}`/);
  assert.match(page, /aria-pressed=\{item\.completed\}/);
  assert.match(modal, /draft\.completed \? "Reopen" : "Complete"/);
});

test("completion uses the existing cloud update and Realtime sync path", () => {
  assert.match(hook, /updateCloudMyListItem\(supabase, userId, itemId, nextChanges\)/);
  assert.match(hook, /completed: nextChanges\.completed === true/);
  assert.match(cloud, /payload\.is_completed = changes\.completed === true/);
  assert.match(cloud, /table: "my_list_items"/);
});

test("My Lists cloud data never uses the academic tasks table", () => {
  assert.doesNotMatch(cloud, /from\("tasks"\)/);
  assert.doesNotMatch(hook, /cloudTasks|useCloudTasks|Task/);
});

test("My Lists has no Smart Planner payload or generation integration", () => {
  assert.doesNotMatch(`${page}\n${hook}\n${cloud}`, /SmartPlanner|smartPlanner|buildEveningPlan|planner payload/i);
});

test("My Lists has no Calendar export behavior", () => {
  assert.doesNotMatch(`${page}\n${hook}\n${cloud}`, /google calendar|calendarId|export.*calendar/i);
});

test("card details support notes, optional Subject context, completion, deletion and movement without academic fields", () => {
  const modal = readFileSync(new URL("../components/MyListItemModal.jsx", import.meta.url), "utf8");
  assert.match(modal, /Notes \(optional\)/);
  assert.match(modal, /Subject \(optional\)/);
  assert.match(modal, /<option value="">None<\/option>/);
  assert.match(modal, /Move to/);
  assert.match(modal, /draft\.completed \? "Reopen" : "Complete"/);
  assert.match(modal, /\sDelete\s*<\/button>/);
  assert.doesNotMatch(modal, /Due date|Formative|Summative|Effort/);
});

test("card order is persisted on create and cross-list movement", () => {
  assert.match(hook, /getNextItemSortOrder\(list\.items\)/);
  assert.match(hook, /nextChanges\.sortOrder = getNextItemSortOrder\(target\.items\)/);
});

test("one shared composer state switches card, list and rename editors", () => {
  assert.match(page, /const \[activeComposer, setActiveComposer\] = useState\(null\)/);
  assert.match(page, /activeComposer\?\.type === "card"/);
  assert.match(page, /activeComposer\?\.type === "list"/);
  assert.match(page, /activeComposer\?\.type === "rename"/);
  assert.doesNotMatch(page, /const \[addingList/);
  assert.doesNotMatch(page, /const \[open, setOpen\]/);
});

test("Subject context remains separate from academic Tasks, Smart Planner and Calendar", () => {
  assert.match(page, /resolveMyListItemSubject/);
  assert.doesNotMatch(`${page}\n${hook}\n${cloud}`, /from\("tasks"\)|SmartPlanner|smartPlanner|calendarId|Formative|Summative/);
});
