export const MY_LIST_NAME_MAX_LENGTH = 60;
export const MY_LIST_ITEM_TITLE_MAX_LENGTH = 200;
export const MY_LIST_ITEM_NOTES_MAX_LENGTH = 5000;

export const MY_LIST_COLOURS = [
  { id: "sky", label: "Sky blue", value: "#6699ce" },
  { id: "peach", label: "Sunrise peach", value: "#d98252" },
  { id: "violet", label: "Violet", value: "#8876bd" },
  { id: "green", label: "Leaf green", value: "#579174" },
  { id: "rose", label: "Rose", value: "#b97898" },
  { id: "gold", label: "Warm gold", value: "#b78d45" },
  { id: "teal", label: "Teal", value: "#4f969d" },
  { id: "navy", label: "Midnight navy", value: "#5f7fc4" },
];

const MY_LIST_COLOUR_IDS = new Set(MY_LIST_COLOURS.map((colour) => colour.id));

export function cleanMyListName(value) {
  return String(value || "").trim().slice(0, MY_LIST_NAME_MAX_LENGTH);
}

export function cleanMyListItemTitle(value) {
  return String(value || "").trim().slice(0, MY_LIST_ITEM_TITLE_MAX_LENGTH);
}

export function cleanMyListItemNotes(value) {
  return String(value || "").trim().slice(0, MY_LIST_ITEM_NOTES_MAX_LENGTH);
}

export function normalizeMyListColourKey(value) {
  return MY_LIST_COLOUR_IDS.has(value) ? value : MY_LIST_COLOURS[0].id;
}

export function getMyListColour(value) {
  const key = normalizeMyListColourKey(value);
  return MY_LIST_COLOURS.find((colour) => colour.id === key) || MY_LIST_COLOURS[0];
}

export function getDefaultMyListColour(index = 0) {
  const safeIndex = Math.max(0, Number(index) || 0) % MY_LIST_COLOURS.length;
  return MY_LIST_COLOURS[safeIndex].id;
}

export function resolveMyListItemSubject(item, subjects = []) {
  if (!item?.subjectId) return null;
  return subjects.find((subject) => String(subject.id) === String(item.subjectId)) || null;
}

export function getMyListSubjectColour(subject) {
  const colour = String(subject?.colour || "").trim();
  return /^#[0-9a-f]{6}$/i.test(colour) ? colour : "#6699ce";
}

export function getVisibleMyListItems(items = [], showCompleted = false) {
  return items.filter((item) => showCompleted || !item.completed);
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
