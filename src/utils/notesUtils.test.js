import assert from "node:assert/strict";
import test from "node:test";
import {
  NOTE_AUTOSAVE_DELAY_MS,
  createEmptyNoteContent,
  extractNotePlainText,
  filterNotes,
  getNoteDisplayTitle,
  normalizeNoteContent,
  sortNotesByUpdated,
} from "./notesUtils.js";

const formattedDocument = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Study plan" }] },
    { type: "paragraph", content: [
      { type: "text", text: "Bold", marks: [{ type: "bold" }] },
      { type: "text", text: " and italic", marks: [{ type: "italic" }] },
    ] },
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Bullet" }] }] }] },
    { type: "orderedList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Numbered" }] }] }] },
    { type: "taskList", content: [
      { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Email teacher" }] }] },
    ] },
  ],
};

test("empty and untitled notes remain valid", () => {
  assert.deepEqual(createEmptyNoteContent(), { type: "doc", content: [{ type: "paragraph" }] });
  assert.equal(getNoteDisplayTitle({ title: "", plainText: "" }), "Untitled note");
  assert.equal(getNoteDisplayTitle({ title: "", plainText: "First meaningful line\nMore" }), "First meaningful line");
});

test("structured rich text preserves supported formatting and checklists", () => {
  const normalized = normalizeNoteContent(formattedDocument);
  assert.equal(normalized.content[0].type, "heading");
  assert.equal(normalized.content[1].content[0].marks[0].type, "bold");
  assert.equal(normalized.content[1].content[1].marks[0].type, "italic");
  assert.equal(normalized.content[2].type, "bulletList");
  assert.equal(normalized.content[3].type, "orderedList");
  assert.equal(normalized.content[4].content[0].attrs.checked, true);
});

test("unsupported nodes and marks are discarded instead of becoming HTML", () => {
  const normalized = normalizeNoteContent({
    type: "doc",
    content: [
      { type: "script", content: [{ type: "text", text: "bad" }] },
      { type: "paragraph", content: [{ type: "text", text: "Safe", marks: [{ type: "link", attrs: { href: "javascript:x" } }] }] },
    ],
  });
  assert.equal(normalized.content.length, 1);
  assert.deepEqual(normalized.content[0].content[0], { type: "text", text: "Safe" });
});

test("multiline plain text is extracted for previews and search", () => {
  const text = extractNotePlainText(formattedDocument);
  assert.match(text, /Study plan/);
  assert.match(text, /Bold and italic/);
  assert.match(text, /Email teacher/);
  assert.match(text, /\n/);
});

test("search finds title and body while excluding deleted notes", () => {
  const notes = [
    { id: "title", title: "CAS reflection", plainText: "Friday", pinned: false, deletedAt: null, updatedAt: "2026-10-02" },
    { id: "body", title: "Ideas", plainText: "Economics essay question", pinned: false, deletedAt: null, updatedAt: "2026-10-03" },
    { id: "deleted", title: "Economics old", plainText: "", pinned: false, deletedAt: "2026-10-04", updatedAt: "2026-10-04" },
  ];
  assert.deepEqual(filterNotes(notes, { query: "CAS" }).map((note) => note.id), ["title"]);
  assert.deepEqual(filterNotes(notes, { query: "essay" }).map((note) => note.id), ["body"]);
  assert.deepEqual(filterNotes(notes, { query: "Economics" }).map((note) => note.id), ["body"]);
  assert.deepEqual(filterNotes(notes, { view: "deleted" }).map((note) => note.id), ["deleted"]);
});

test("folder, pinned and updated ordering stay deterministic", () => {
  const notes = [
    { id: "old", folderId: "a", pinned: false, deletedAt: null, updatedAt: "2026-10-01" },
    { id: "new", folderId: "b", pinned: false, deletedAt: null, updatedAt: "2026-10-03" },
    { id: "pin", folderId: "a", pinned: true, deletedAt: null, updatedAt: "2026-10-02" },
  ];
  assert.deepEqual(sortNotesByUpdated(notes).map((note) => note.id), ["pin", "new", "old"]);
  assert.deepEqual(filterNotes(notes, { view: "folder", folderId: "a" }).map((note) => note.id), ["pin", "old"]);
  assert.deepEqual(filterNotes(notes, { view: "pinned" }).map((note) => note.id), ["pin"]);
});

test("autosave uses a bounded debounce rather than per-keystroke writes", () => {
  assert.equal(NOTE_AUTOSAVE_DELAY_MS, 700);
  assert.ok(NOTE_AUTOSAVE_DELAY_MS >= 500 && NOTE_AUTOSAVE_DELAY_MS <= 1000);
});
