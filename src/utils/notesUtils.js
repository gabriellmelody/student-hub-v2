export const NOTE_TITLE_MAX_LENGTH = 200;
export const NOTE_PLAIN_TEXT_MAX_LENGTH = 100000;
export const NOTE_FOLDER_NAME_MAX_LENGTH = 60;
export const NOTE_AUTOSAVE_DELAY_MS = 700;

const ALLOWED_NODE_TYPES = new Set([
  "doc",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "text",
  "hardBreak",
]);
const ALLOWED_MARK_TYPES = new Set(["bold", "italic"]);

export function createEmptyNoteContent() {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function cleanNoteTitle(value) {
  return String(value || "").slice(0, NOTE_TITLE_MAX_LENGTH);
}

export function cleanNoteFolderName(value) {
  return String(value || "").trim().slice(0, NOTE_FOLDER_NAME_MAX_LENGTH);
}

function normalizeNode(node, depth, counter) {
  if (!node || typeof node !== "object" || depth > 24 || counter.count > 10000) return null;
  if (!ALLOWED_NODE_TYPES.has(node.type)) return null;
  counter.count += 1;

  if (node.type === "text") {
    const text = String(node.text || "").slice(0, NOTE_PLAIN_TEXT_MAX_LENGTH);
    if (!text) return null;
    const marks = Array.isArray(node.marks)
      ? node.marks.filter((mark) => ALLOWED_MARK_TYPES.has(mark?.type)).map((mark) => ({ type: mark.type }))
      : [];
    return marks.length > 0 ? { type: "text", text, marks } : { type: "text", text };
  }

  const normalized = { type: node.type };
  if (node.type === "heading") {
    const level = Number(node.attrs?.level);
    normalized.attrs = { level: [1, 2, 3].includes(level) ? level : 2 };
  }
  if (node.type === "taskItem") normalized.attrs = { checked: node.attrs?.checked === true };

  if (Array.isArray(node.content)) {
    const content = node.content
      .map((child) => normalizeNode(child, depth + 1, counter))
      .filter(Boolean);
    if (content.length > 0) normalized.content = content;
  }
  return normalized;
}

export function normalizeNoteContent(value) {
  const source = value?.type === "doc" ? value : createEmptyNoteContent();
  const normalized = normalizeNode(source, 0, { count: 0 });
  if (!normalized || normalized.type !== "doc") return createEmptyNoteContent();
  if (!Array.isArray(normalized.content) || normalized.content.length === 0) {
    normalized.content = [{ type: "paragraph" }];
  }
  return normalized;
}

export function extractNotePlainText(content) {
  const pieces = [];
  const blockTypes = new Set(["paragraph", "heading", "listItem", "taskItem"]);

  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "text") pieces.push(String(node.text || ""));
    if (node.type === "hardBreak") pieces.push("\n");
    for (const child of node.content || []) visit(child);
    if (blockTypes.has(node.type)) pieces.push("\n");
  }

  visit(normalizeNoteContent(content));
  return pieces.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
    .slice(0, NOTE_PLAIN_TEXT_MAX_LENGTH);
}

export function getNoteDisplayTitle(note) {
  const title = String(note?.title || "").trim();
  if (title) return title;
  const firstLine = String(note?.plainText || "").split(/\n/).map((line) => line.trim()).find(Boolean);
  return firstLine?.slice(0, 80) || "Untitled note";
}

export function getNotePreview(note) {
  const text = String(note?.plainText || "").replace(/\s+/g, " ").trim();
  if (!text) return "No additional text";
  return text.slice(0, 180);
}

export function sortNotesByUpdated(notes = []) {
  return [...notes].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
  });
}

export function filterNotes(notes = [], { view = "all", folderId = null, query = "" } = {}) {
  const normalizedQuery = String(query || "").trim().toLocaleLowerCase();
  const visible = notes.filter((note) => {
    if (view === "deleted") return Boolean(note.deletedAt);
    if (note.deletedAt) return false;
    if (view === "pinned" && !note.pinned) return false;
    if (view === "folder" && note.folderId !== folderId) return false;
    if (!normalizedQuery) return true;
    return `${note.title || ""}\n${note.plainText || ""}`.toLocaleLowerCase().includes(normalizedQuery);
  });
  return sortNotesByUpdated(visible);
}
