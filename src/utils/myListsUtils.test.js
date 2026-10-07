import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanMyListItemNotes,
  cleanMyListItemTitle,
  cleanMyListName,
  findMyListItem,
  getNextItemSortOrder,
  moveMyList,
} from "./myListsUtils.js";

test("list names are trimmed and capped", () => {
  assert.equal(cleanMyListName("  Personal  "), "Personal");
  assert.equal(cleanMyListName("x".repeat(80)).length, 60);
});

test("card titles support title-only cards and reject whitespace after cleaning", () => {
  assert.equal(cleanMyListItemTitle("  Email coach  "), "Email coach");
  assert.equal(cleanMyListItemTitle("   "), "");
});

test("multiline notes are preserved", () => {
  assert.equal(cleanMyListItemNotes("  First line\nSecond line  "), "First line\nSecond line");
});

test("moving a list left changes only its position and stable sort order", () => {
  const lists = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const moved = moveMyList(lists, "b", "left");
  assert.deepEqual(moved.map((list) => [list.id, list.sortOrder]), [["b", 0], ["a", 1], ["c", 2]]);
});

test("moving a list right changes only its position and stable sort order", () => {
  const lists = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(moveMyList(lists, "b", "right").map((list) => list.id), ["a", "c", "b"]);
});

test("list movement at a boundary is a no-op", () => {
  const lists = [{ id: "a" }, { id: "b" }];
  assert.equal(moveMyList(lists, "a", "left"), lists);
  assert.equal(moveMyList(lists, "b", "right"), lists);
});

test("new cards append after the highest persisted card order", () => {
  assert.equal(getNextItemSortOrder([{ sortOrder: 2 }, { sortOrder: 8 }]), 9);
  assert.equal(getNextItemSortOrder([]), 0);
});

test("cards can be found with their owning list", () => {
  const result = findMyListItem([
    { id: "a", items: [] },
    { id: "b", items: [{ id: "item", title: "Buy shampoo" }] },
  ], "item");
  assert.equal(result.list.id, "b");
  assert.equal(result.item.title, "Buy shampoo");
});

