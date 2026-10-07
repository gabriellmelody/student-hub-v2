import {
  cleanMyListItemNotes,
  cleanMyListItemTitle,
  cleanMyListName,
} from "../utils/myListsUtils.js";

const LIST_COLUMNS = "id,user_id,name,sort_order,created_at,updated_at";
const ITEM_COLUMNS = "id,user_id,list_id,title,notes,is_completed,sort_order,created_at,updated_at";

function numericSortOrder(value) {
  const order = Number(value);
  return Number.isFinite(order) && order >= 0 ? order : 0;
}

export function mapCloudMyList(row = {}) {
  return {
    id: String(row.id || ""),
    name: cleanMyListName(row.name),
    sortOrder: numericSortOrder(row.sort_order),
    items: [],
  };
}

export function mapCloudMyListItem(row = {}) {
  return {
    id: String(row.id || ""),
    listId: String(row.list_id || ""),
    title: cleanMyListItemTitle(row.title),
    notes: String(row.notes || "").slice(0, 5000),
    completed: row.is_completed === true,
    sortOrder: numericSortOrder(row.sort_order),
  };
}

export function buildMyListPayload({ userId, name, sortOrder = 0 }) {
  const cleanName = cleanMyListName(name);
  if (!userId || !cleanName) throw new Error("A list name is required.");
  return { user_id: userId, name: cleanName, sort_order: numericSortOrder(sortOrder) };
}

export function buildMyListItemPayload({
  userId,
  listId,
  title,
  notes = "",
  completed = false,
  sortOrder = 0,
}) {
  const cleanTitle = cleanMyListItemTitle(title);
  if (!userId || !listId || !cleanTitle) throw new Error("A card title is required.");
  return {
    user_id: userId,
    list_id: listId,
    title: cleanTitle,
    notes: cleanMyListItemNotes(notes),
    is_completed: completed === true,
    sort_order: numericSortOrder(sortOrder),
  };
}

export async function fetchCloudMyLists(client, userId) {
  if (!userId) return [];
  const [listsResult, itemsResult] = await Promise.all([
    client.from("my_lists").select(LIST_COLUMNS).eq("user_id", userId)
      .order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    client.from("my_list_items").select(ITEM_COLUMNS).eq("user_id", userId)
      .order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
  ]);
  if (listsResult.error) throw listsResult.error;
  if (itemsResult.error) throw itemsResult.error;

  const itemsByList = new Map();
  for (const row of itemsResult.data || []) {
    const item = mapCloudMyListItem(row);
    if (!itemsByList.has(item.listId)) itemsByList.set(item.listId, []);
    itemsByList.get(item.listId).push(item);
  }

  return (listsResult.data || []).map((row) => {
    const list = mapCloudMyList(row);
    return { ...list, items: itemsByList.get(list.id) || [] };
  });
}

export async function createCloudMyList(client, userId, name, sortOrder) {
  const { data, error } = await client.from("my_lists")
    .insert(buildMyListPayload({ userId, name, sortOrder }))
    .select(LIST_COLUMNS).single();
  if (error) throw error;
  return mapCloudMyList(data);
}

export async function renameCloudMyList(client, userId, listId, name) {
  const cleanName = cleanMyListName(name);
  if (!cleanName) throw new Error("A list name is required.");
  const { data, error } = await client.from("my_lists").update({ name: cleanName })
    .eq("user_id", userId).eq("id", listId).select(LIST_COLUMNS).single();
  if (error) throw error;
  return mapCloudMyList(data);
}

export async function updateCloudMyListOrder(client, userId, lists) {
  await Promise.all(lists.map(async (list, index) => {
    const sortOrder = numericSortOrder(list.sortOrder ?? index);
    const { error } = await client.from("my_lists").update({ sort_order: sortOrder })
      .eq("user_id", userId).eq("id", list.id);
    if (error) throw error;
  }));
}

export async function deleteCloudMyList(client, userId, listId) {
  const { error } = await client.from("my_lists").delete()
    .eq("user_id", userId).eq("id", listId);
  if (error) throw error;
  return true;
}

export async function createCloudMyListItem(client, payload) {
  const { data, error } = await client.from("my_list_items")
    .insert(buildMyListItemPayload(payload)).select(ITEM_COLUMNS).single();
  if (error) throw error;
  return mapCloudMyListItem(data);
}

export async function updateCloudMyListItem(client, userId, itemId, changes) {
  const payload = {};
  if (Object.hasOwn(changes, "title")) {
    const title = cleanMyListItemTitle(changes.title);
    if (!title) throw new Error("A card title is required.");
    payload.title = title;
  }
  if (Object.hasOwn(changes, "notes")) payload.notes = cleanMyListItemNotes(changes.notes);
  if (Object.hasOwn(changes, "completed")) payload.is_completed = changes.completed === true;
  if (changes.listId) payload.list_id = changes.listId;
  if (Object.hasOwn(changes, "sortOrder")) payload.sort_order = numericSortOrder(changes.sortOrder);

  const { data, error } = await client.from("my_list_items").update(payload)
    .eq("user_id", userId).eq("id", itemId).select(ITEM_COLUMNS).single();
  if (error) throw error;
  return mapCloudMyListItem(data);
}

export async function deleteCloudMyListItem(client, userId, itemId) {
  const { error } = await client.from("my_list_items").delete()
    .eq("user_id", userId).eq("id", itemId);
  if (error) throw error;
  return true;
}

export function subscribeToCloudMyListChanges(client, userId, onChange) {
  if (!userId) return () => {};
  const channel = client.channel(`my-lists:${userId}`)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "my_lists", filter: `user_id=eq.${userId}`,
    }, onChange)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "my_list_items", filter: `user_id=eq.${userId}`,
    }, onChange)
    .subscribe();
  return () => client.removeChannel?.(channel) || channel?.unsubscribe?.();
}
