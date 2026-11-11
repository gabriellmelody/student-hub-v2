import {
  cleanNoteFolderName,
  cleanNoteTitle,
  createEmptyNoteContent,
  extractNotePlainText,
  normalizeNoteContent,
} from "../utils/notesUtils.js";

const FOLDER_COLUMNS = "id,user_id,name,sort_order,created_at,updated_at";
const NOTE_COLUMNS = "id,user_id,folder_id,title,content,plain_text,is_pinned,deleted_at,created_at,updated_at";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validUuid(value) {
  return UUID_PATTERN.test(String(value || ""));
}

function numericSortOrder(value) {
  const order = Number(value);
  return Number.isFinite(order) && order >= 0 ? order : 0;
}

export function mapCloudNoteFolder(row = {}) {
  return {
    id: String(row.id || ""),
    name: cleanNoteFolderName(row.name),
    sortOrder: numericSortOrder(row.sort_order),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export function mapCloudNote(row = {}) {
  const content = normalizeNoteContent(row.content);
  return {
    id: String(row.id || ""),
    folderId: validUuid(row.folder_id) ? String(row.folder_id) : null,
    title: cleanNoteTitle(row.title),
    content,
    plainText: typeof row.plain_text === "string" ? row.plain_text : extractNotePlainText(content),
    pinned: row.is_pinned === true,
    deletedAt: row.deleted_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export function buildNoteFolderPayload({ userId, name, sortOrder = 0 }) {
  const cleanName = cleanNoteFolderName(name);
  if (!userId || !cleanName) throw new Error("A folder name is required.");
  return { user_id: userId, name: cleanName, sort_order: numericSortOrder(sortOrder) };
}

export function buildNotePayload({ userId, folderId = null, title = "", content = createEmptyNoteContent() }) {
  const normalizedContent = normalizeNoteContent(content);
  return {
    user_id: userId,
    folder_id: validUuid(folderId) ? folderId : null,
    title: cleanNoteTitle(title),
    content: normalizedContent,
    plain_text: extractNotePlainText(normalizedContent),
    is_pinned: false,
  };
}

export async function fetchCloudNotes(client, userId) {
  if (!userId) return { folders: [], notes: [] };
  const [foldersResult, notesResult] = await Promise.all([
    client.from("note_folders").select(FOLDER_COLUMNS).eq("user_id", userId)
      .order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    client.from("notes").select(NOTE_COLUMNS).eq("user_id", userId)
      .order("updated_at", { ascending: false }),
  ]);
  if (foldersResult.error) throw foldersResult.error;
  if (notesResult.error) throw notesResult.error;
  return {
    folders: (foldersResult.data || []).map(mapCloudNoteFolder),
    notes: (notesResult.data || []).map(mapCloudNote),
  };
}

export async function createCloudNoteFolder(client, userId, name, sortOrder) {
  const { data, error } = await client.from("note_folders")
    .insert(buildNoteFolderPayload({ userId, name, sortOrder }))
    .select(FOLDER_COLUMNS).single();
  if (error) throw error;
  return mapCloudNoteFolder(data);
}

export async function renameCloudNoteFolder(client, userId, folderId, name) {
  const cleanName = cleanNoteFolderName(name);
  if (!cleanName) throw new Error("A folder name is required.");
  const { data, error } = await client.from("note_folders").update({ name: cleanName })
    .eq("user_id", userId).eq("id", folderId).select(FOLDER_COLUMNS).single();
  if (error) throw error;
  return mapCloudNoteFolder(data);
}

export async function deleteCloudNoteFolder(client, userId, folderId) {
  const { error } = await client.from("note_folders").delete()
    .eq("user_id", userId).eq("id", folderId);
  if (error) throw error;
  return true;
}

export async function createCloudNote(client, userId, folderId = null) {
  const { data, error } = await client.from("notes")
    .insert(buildNotePayload({ userId, folderId }))
    .select(NOTE_COLUMNS).single();
  if (error) throw error;
  return mapCloudNote(data);
}

export async function updateCloudNote(client, userId, noteId, changes = {}) {
  const payload = {};
  if (Object.hasOwn(changes, "title")) payload.title = cleanNoteTitle(changes.title);
  if (Object.hasOwn(changes, "content")) {
    payload.content = normalizeNoteContent(changes.content);
    payload.plain_text = extractNotePlainText(payload.content);
  }
  if (Object.hasOwn(changes, "folderId")) payload.folder_id = validUuid(changes.folderId) ? changes.folderId : null;
  if (Object.hasOwn(changes, "pinned")) payload.is_pinned = changes.pinned === true;
  if (Object.hasOwn(changes, "deletedAt")) payload.deleted_at = changes.deletedAt || null;

  const { data, error } = await client.from("notes").update(payload)
    .eq("user_id", userId).eq("id", noteId).select(NOTE_COLUMNS).single();
  if (error) throw error;
  return mapCloudNote(data);
}

export function softDeleteCloudNote(client, userId, noteId, now = new Date()) {
  return updateCloudNote(client, userId, noteId, { deletedAt: now.toISOString(), pinned: false });
}

export function restoreCloudNote(client, userId, noteId) {
  return updateCloudNote(client, userId, noteId, { deletedAt: null });
}

export async function permanentlyDeleteCloudNote(client, userId, noteId) {
  const { error } = await client.from("notes").delete()
    .eq("user_id", userId).eq("id", noteId);
  if (error) throw error;
  return true;
}

export function subscribeToCloudNoteChanges(client, userId, onChange) {
  if (!userId || typeof client?.channel !== "function") return () => {};
  const channel = client.channel(`notes:${userId}`)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "note_folders", filter: `user_id=eq.${userId}`,
    }, onChange)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "notes", filter: `user_id=eq.${userId}`,
    }, onChange)
    .subscribe();
  return () => client.removeChannel?.(channel) || channel?.unsubscribe?.();
}
