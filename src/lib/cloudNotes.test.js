import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildNotePayload,
  createCloudNote,
  createCloudNoteFolder,
  deleteCloudNoteFolder,
  fetchCloudNotes,
  mapCloudNote,
  permanentlyDeleteCloudNote,
  renameCloudNoteFolder,
  restoreCloudNote,
  softDeleteCloudNote,
  subscribeToCloudNoteChanges,
  updateCloudNote,
} from "./cloudNotes.js";

const USER = "11111111-1111-4111-8111-111111111111";
const FOLDER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOTE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const folderRow = (overrides = {}) => ({ id: FOLDER, user_id: USER, name: "Ideas", sort_order: 0, created_at: "2026-10-01", updated_at: "2026-10-01", ...overrides });
const noteRow = (overrides = {}) => ({
  id: NOTE,
  user_id: USER,
  folder_id: null,
  title: "",
  content: { type: "doc", content: [{ type: "paragraph" }] },
  plain_text: "",
  is_pinned: false,
  deleted_at: null,
  created_at: "2026-10-01",
  updated_at: "2026-10-01",
  ...overrides,
});

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

test("empty and untitled notes are created without academic metadata", async () => {
  const client = mockClient([{ data: noteRow(), error: null }]);
  const created = await createCloudNote(client, USER, null);
  assert.equal(created.title, "");
  assert.equal(created.folderId, null);
  assert.deepEqual(Object.keys(client.calls[0].payload).sort(), ["content", "folder_id", "is_pinned", "plain_text", "title", "user_id"]);
  assert.equal(client.calls[0].table, "notes");
});

test("rich text, title edits and checklist state persist as structured JSON", async () => {
  const content = {
    type: "doc",
    content: [{ type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Done", marks: [{ type: "bold" }] }] }] }] }],
  };
  const client = mockClient([{ data: noteRow({ title: "Goals", content, plain_text: "Done" }), error: null }]);
  const saved = await updateCloudNote(client, USER, NOTE, { title: "Goals", content });
  assert.equal(saved.title, "Goals");
  assert.equal(saved.content.content[0].content[0].attrs.checked, true);
  assert.equal(client.calls[0].payload.content.content[0].type, "taskList");
  assert.equal(client.calls[0].payload.plain_text, "Done");
});

test("notes can be filed, unfiled, pinned and unpinned", async () => {
  const filedClient = mockClient([{ data: noteRow({ folder_id: FOLDER, is_pinned: true }), error: null }]);
  const filed = await updateCloudNote(filedClient, USER, NOTE, { folderId: FOLDER, pinned: true });
  assert.equal(filed.folderId, FOLDER);
  assert.equal(filed.pinned, true);
  assert.deepEqual(filedClient.calls[0].payload, { folder_id: FOLDER, is_pinned: true });

  const unfiledClient = mockClient([{ data: noteRow({ folder_id: null, is_pinned: false }), error: null }]);
  await updateCloudNote(unfiledClient, USER, NOTE, { folderId: null, pinned: false });
  assert.deepEqual(unfiledClient.calls[0].payload, { folder_id: null, is_pinned: false });
});

test("folders create, rename and delete within the authenticated account", async () => {
  const createClient = mockClient([{ data: folderRow(), error: null }]);
  assert.equal((await createCloudNoteFolder(createClient, USER, " Ideas ", 0)).name, "Ideas");
  assert.equal(createClient.calls[0].payload.user_id, USER);

  const renameClient = mockClient([{ data: folderRow({ name: "Goals" }), error: null }]);
  await renameCloudNoteFolder(renameClient, USER, FOLDER, "Goals");
  assert.deepEqual(renameClient.calls[0].filters, [["user_id", USER], ["id", FOLDER]]);

  const deleteClient = mockClient([{ data: null, error: null }]);
  assert.equal(await deleteCloudNoteFolder(deleteClient, USER, FOLDER), true);
  assert.deepEqual(deleteClient.calls[0].filters, [["user_id", USER], ["id", FOLDER]]);
});

test("delete is soft, restore clears deletion, and permanent delete is explicit", async () => {
  const deletedAt = new Date("2026-10-08T12:00:00.000Z");
  const softClient = mockClient([{ data: noteRow({ deleted_at: deletedAt.toISOString() }), error: null }]);
  assert.equal((await softDeleteCloudNote(softClient, USER, NOTE, deletedAt)).deletedAt, deletedAt.toISOString());
  assert.equal(softClient.calls[0].payload.is_pinned, false);

  const restoreClient = mockClient([{ data: noteRow(), error: null }]);
  assert.equal((await restoreCloudNote(restoreClient, USER, NOTE)).deletedAt, null);

  const permanentClient = mockClient([{ data: null, error: null }]);
  assert.equal(await permanentlyDeleteCloudNote(permanentClient, USER, NOTE), true);
  assert.equal(permanentClient.calls[0].action, "delete");
});

test("cloud serialization is stable across devices and account scoped", async () => {
  const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Across devices", marks: [{ type: "italic" }] }] }] };
  assert.equal(mapCloudNote(noteRow({ content, plain_text: "Across devices" })).content.content[0].content[0].marks[0].type, "italic");
  const client = mockClient([
    { data: [folderRow()], error: null },
    { data: [noteRow({ content, plain_text: "Across devices" })], error: null },
  ]);
  const result = await fetchCloudNotes(client, USER);
  assert.equal(result.notes[0].plainText, "Across devices");
  assert.ok(client.calls.every((call) => call.filters.some(([key, value]) => key === "user_id" && value === USER)));
});

test("Realtime watches private folders and notes for cross-device sync", () => {
  const configs = [];
  const channel = { on(_event, config) { configs.push(config); return channel; }, subscribe() { return channel; } };
  let removed;
  const client = { channel: () => channel, removeChannel: (value) => { removed = value; } };
  const cleanup = subscribeToCloudNoteChanges(client, USER, () => {});
  assert.deepEqual(configs.map((config) => config.table), ["note_folders", "notes"]);
  assert.ok(configs.every((config) => config.filter === `user_id=eq.${USER}`));
  cleanup();
  assert.equal(removed, channel);
});

test("payloads never store unsanitized HTML", () => {
  const payload = buildNotePayload({
    userId: USER,
    title: "Safe",
    content: { type: "doc", content: [{ type: "script", content: [{ type: "text", text: "alert" }] }] },
  });
  assert.deepEqual(payload.content, { type: "doc", content: [{ type: "paragraph" }] });
  assert.equal(Object.hasOwn(payload, "html"), false);
});

test("migration preserves notes when folders are deleted and enforces ownership", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261007_notes_workspace.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists public\.note_folders/);
  assert.match(sql, /create table if not exists public\.notes/);
  assert.match(sql, /foreign key \(folder_id\)[\s\S]*on delete set null/);
  assert.match(sql, /note_folders\.user_id = auth\.uid\(\)/g);
  assert.match(sql, /auth\.uid\(\) = user_id/g);
  assert.match(sql, /alter publication supabase_realtime add table public\.notes/);
});
