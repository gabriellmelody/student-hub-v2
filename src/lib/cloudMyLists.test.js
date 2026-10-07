import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildMyListItemPayload,
  buildMyListPayload,
  createCloudMyList,
  createCloudMyListItem,
  deleteCloudMyList,
  deleteCloudMyListItem,
  fetchCloudMyLists,
  mapCloudMyList,
  mapCloudMyListItem,
  renameCloudMyList,
  subscribeToCloudMyListChanges,
  updateCloudMyListItem,
  updateCloudMyListColour,
  updateCloudMyListOrder,
} from "./cloudMyLists.js";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER_USER = "22222222-2222-4222-8222-222222222222";
const LIST = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_LIST = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ITEM = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SUBJECT = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const listRow = (overrides = {}) => ({ id: LIST, user_id: USER, name: "Personal", color_key: "sky", sort_order: 0, ...overrides });
const itemRow = (overrides = {}) => ({ id: ITEM, user_id: USER, list_id: LIST, subject_id: null, title: "Email coach", notes: "", is_completed: false, sort_order: 0, ...overrides });

function mockClient(results = []) {
  const calls = [];
  return {
    calls,
    from(table) {
      const state = { table, action: "select", filters: [] };
      const builder = {
        select(columns) { state.columns = columns; return builder; },
        insert(payload) { state.action = "insert"; state.payload = payload; return builder; },
        update(payload) { state.action = "update"; state.payload = payload; return builder; },
        delete() { state.action = "delete"; return builder; },
        eq(key, value) { state.filters.push([key, value]); return builder; },
        order(key, options) { (state.orders ||= []).push([key, options]); return builder; },
        single() { calls.push(structuredClone(state)); return Promise.resolve(results.shift() || { data: null, error: null }); },
        then(resolve) { calls.push(structuredClone(state)); return Promise.resolve(results.shift() || { data: [], error: null }).then(resolve); },
      };
      return builder;
    },
  };
}

test("fetch is scoped to the authenticated user and keeps list/card ordering", async () => {
  const client = mockClient([
    { data: [listRow(), listRow({ id: OTHER_LIST, name: "Ideas", sort_order: 1 })], error: null },
    { data: [itemRow({ sort_order: 3 }), itemRow({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", list_id: OTHER_LIST, title: "Weekend trip" })], error: null },
  ]);
  const lists = await fetchCloudMyLists(client, USER);
  assert.deepEqual(lists.map((list) => list.name), ["Personal", "Ideas"]);
  assert.equal(lists[0].items[0].sortOrder, 3);
  assert.ok(client.calls.every((call) => call.filters.some(([key, value]) => key === "user_id" && value === USER)));
});

test("cloud rows serialize consistently across devices", () => {
  assert.deepEqual(mapCloudMyListItem(itemRow({ notes: "Line one\nLine two", is_completed: true })), {
    id: ITEM, listId: LIST, subjectId: null, title: "Email coach", notes: "Line one\nLine two", completed: true, sortOrder: 0,
  });
  assert.equal(mapCloudMyList(listRow({ color_key: "violet" })).colorKey, "violet");
});

test("list creation writes authenticated ownership and persisted order", async () => {
  const client = mockClient([{ data: listRow({ name: "Cooking", sort_order: 2 }), error: null }]);
  const created = await createCloudMyList(client, USER, " Cooking ", 2);
  assert.equal(created.name, "Cooking");
  assert.deepEqual(client.calls[0].payload, { user_id: USER, name: "Cooking", color_key: "sky", sort_order: 2 });
});

test("list colour persists without changing list contents", async () => {
  const client = mockClient([{ data: listRow({ color_key: "peach" }), error: null }]);
  const updated = await updateCloudMyListColour(client, USER, LIST, "peach");
  assert.equal(updated.colorKey, "peach");
  assert.deepEqual(client.calls[0].payload, { color_key: "peach" });
  assert.deepEqual(client.calls[0].filters, [["user_id", USER], ["id", LIST]]);
  assert.equal(Object.hasOwn(client.calls[0].payload, "items"), false);
});

test("spaces-only list names are rejected", () => {
  assert.throws(() => buildMyListPayload({ userId: USER, name: "   " }), /required/);
});

test("rename targets only the current user's list", async () => {
  const client = mockClient([{ data: listRow({ name: "Emails" }), error: null }]);
  await renameCloudMyList(client, USER, LIST, "Emails");
  assert.deepEqual(client.calls[0].filters, [["user_id", USER], ["id", LIST]]);
  assert.equal(client.calls[0].payload.name, "Emails");
});

test("list order updates are persisted with authenticated ownership", async () => {
  const client = mockClient([{ data: null, error: null }, { data: null, error: null }]);
  await updateCloudMyListOrder(client, USER, [{ id: OTHER_LIST }, { id: LIST }]);
  assert.deepEqual(client.calls.map((call) => call.payload.sort_order), [0, 1]);
  assert.ok(client.calls.every((call) => call.filters[0][1] === USER));
});

test("empty and populated list deletion use the same user-scoped cascade boundary", async () => {
  const client = mockClient([{ data: null, error: null }]);
  assert.equal(await deleteCloudMyList(client, USER, LIST), true);
  assert.deepEqual(client.calls[0].filters, [["user_id", USER], ["id", LIST]]);
});

test("title-only card creation stores no academic metadata", async () => {
  const client = mockClient([{ data: itemRow(), error: null }]);
  await createCloudMyListItem(client, { userId: USER, listId: LIST, title: "Email coach" });
  assert.deepEqual(Object.keys(client.calls[0].payload).sort(), ["is_completed", "list_id", "notes", "sort_order", "subject_id", "title", "user_id"]);
  assert.equal(client.calls[0].payload.notes, "");
  assert.equal(client.calls[0].payload.subject_id, null);
});

test("an existing Subject UUID persists as optional card context", async () => {
  const client = mockClient([{ data: itemRow({ subject_id: SUBJECT }), error: null }]);
  const result = await createCloudMyListItem(client, {
    userId: USER,
    listId: LIST,
    title: "Email teacher",
    subjectId: SUBJECT,
  });
  assert.equal(client.calls[0].payload.subject_id, SUBJECT);
  assert.equal(result.subjectId, SUBJECT);
});

test("invalid Subject references safely become null", () => {
  const payload = buildMyListItemPayload({ userId: USER, listId: LIST, title: "Buy folder", subjectId: "not-a-uuid" });
  assert.equal(payload.subject_id, null);
  assert.equal(mapCloudMyListItem(itemRow({ subject_id: "bad" })).subjectId, null);
});

test("card creation preserves multiline notes", () => {
  const payload = buildMyListItemPayload({ userId: USER, listId: LIST, title: "Recipe", notes: "Buy rice\nBuy curry paste" });
  assert.equal(payload.notes, "Buy rice\nBuy curry paste");
});

test("card editing targets only the authenticated user's card", async () => {
  const client = mockClient([{ data: itemRow({ title: "Reply to coach", notes: "Before Friday" }), error: null }]);
  const result = await updateCloudMyListItem(client, USER, ITEM, { title: "Reply to coach", notes: "Before Friday" });
  assert.equal(result.notes, "Before Friday");
  assert.deepEqual(client.calls[0].filters, [["user_id", USER], ["id", ITEM]]);
});

test("cards can be completed without deletion", async () => {
  const client = mockClient([{ data: itemRow({ is_completed: true }), error: null }]);
  const result = await updateCloudMyListItem(client, USER, ITEM, { completed: true });
  assert.equal(result.completed, true);
  assert.equal(client.calls[0].payload.is_completed, true);
});

test("completed cards can be reopened", async () => {
  const client = mockClient([{ data: itemRow({ is_completed: false }), error: null }]);
  assert.equal((await updateCloudMyListItem(client, USER, ITEM, { completed: false })).completed, false);
});

test("card Subject links can be updated or cleared without changing task semantics", async () => {
  const linkedClient = mockClient([{ data: itemRow({ subject_id: SUBJECT }), error: null }]);
  await updateCloudMyListItem(linkedClient, USER, ITEM, { subjectId: SUBJECT });
  assert.deepEqual(linkedClient.calls[0].payload, { subject_id: SUBJECT });

  const clearedClient = mockClient([{ data: itemRow({ subject_id: null }), error: null }]);
  await updateCloudMyListItem(clearedClient, USER, ITEM, { subjectId: "" });
  assert.deepEqual(clearedClient.calls[0].payload, { subject_id: null });
});

test("cards can move between lists and append with a stable order", async () => {
  const client = mockClient([{ data: itemRow({ list_id: OTHER_LIST, sort_order: 4 }), error: null }]);
  const result = await updateCloudMyListItem(client, USER, ITEM, { listId: OTHER_LIST, sortOrder: 4 });
  assert.equal(result.listId, OTHER_LIST);
  assert.deepEqual(client.calls[0].payload, { list_id: OTHER_LIST, sort_order: 4 });
});

test("card deletion targets only the authenticated user's card", async () => {
  const client = mockClient([{ data: null, error: null }]);
  assert.equal(await deleteCloudMyListItem(client, USER, ITEM), true);
  assert.deepEqual(client.calls[0].filters, [["user_id", USER], ["id", ITEM]]);
});

test("Realtime listens to both separate My Lists tables", () => {
  const configs = [];
  const channel = { on(_event, config) { configs.push(config); return channel; }, subscribe() { return channel; } };
  let removed;
  const client = { channel: (name) => { assert.equal(name, `my-lists:${USER}`); return channel; }, removeChannel: (value) => { removed = value; } };
  const cleanup = subscribeToCloudMyListChanges(client, USER, () => {});
  assert.deepEqual(configs.map((config) => config.table), ["my_lists", "my_list_items"]);
  assert.ok(configs.every((config) => config.filter === `user_id=eq.${USER}`));
  cleanup();
  assert.equal(removed, channel);
});

test("Realtime is not opened without an authenticated account", () => {
  const client = { channel: () => { throw new Error("should not subscribe"); } };
  assert.doesNotThrow(() => subscribeToCloudMyListChanges(client, "", () => {})());
});

test("migration prevents account crossover and cards in another user's list", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261007_my_lists.sql", import.meta.url), "utf8");
  assert.match(sql, /auth\.uid\(\) = user_id/g);
  assert.match(sql, /foreign key \(user_id, list_id\)/);
  assert.match(sql, /references public\.my_lists \(user_id, id\)/);
  assert.match(sql, /my_lists\.user_id = auth\.uid\(\)/);
  assert.doesNotMatch(sql, new RegExp(OTHER_USER));
});

test("migration cascades deliberate list deletion and enables Realtime", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261007_my_lists.sql", import.meta.url), "utf8");
  assert.match(sql, /references public\.my_lists \(user_id, id\)[\s\S]*on delete cascade/);
  assert.match(sql, /supabase_realtime add table public\.my_lists/);
  assert.match(sql, /supabase_realtime add table public\.my_list_items/);
});

test("polish migration keeps Subject links contextual and account scoped", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261007_my_lists_colour_subject.sql", import.meta.url), "utf8");
  assert.match(sql, /add column if not exists color_key text not null default 'sky'/);
  assert.match(sql, /add column if not exists subject_id uuid null/);
  assert.match(sql, /references public\.subjects \(id\)[\s\S]*on delete set null/);
  assert.match(sql, /subjects\.user_id = auth\.uid\(\)/g);
  assert.match(sql, /where subject_id is not null/);
});
