export const MY_LIST_NAME_MAX_LENGTH = 60;
export const MY_LIST_ITEM_TITLE_MAX_LENGTH = 200;
export const MY_LIST_ITEM_NOTES_MAX_LENGTH = 5000;

export function cleanMyListName(value) {
  return String(value || "").trim().slice(0, MY_LIST_NAME_MAX_LENGTH);
}

export function cleanMyListItemTitle(value) {
  return String(value || "").trim().slice(0, MY_LIST_ITEM_TITLE_MAX_LENGTH);
}

export function cleanMyListItemNotes(value) {
  return String(value || "").trim().slice(0, MY_LIST_ITEM_NOTES_MAX_LENGTH);
}

export function moveMyList(lists, listId, direction) {
  const sourceIndex = lists.findIndex((list) => list.id === listId);
  const targetIndex = sourceIndex + (direction === "left" ? -1 : 1);

  if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= lists.length) {
    return lists;
  }

  const nextLists = [...lists];
  [nextLists[sourceIndex], nextLists[targetIndex]] = [
    nextLists[targetIndex],
    nextLists[sourceIndex],
  ];

  return nextLists.map((list, index) => ({ ...list, sortOrder: index }));
}

export function getNextItemSortOrder(items = []) {
  return items.reduce(
    (highest, item) => Math.max(highest, Number(item.sortOrder) || 0),
    -1
  ) + 1;
}

export function findMyListItem(lists, itemId) {
  for (const list of lists) {
    const item = list.items.find((candidate) => candidate.id === itemId);
    if (item) return { list, item };
  }
  return null;
}

