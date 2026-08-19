import assert from "node:assert/strict";
import test from "node:test";
import { getDueDateShortcutValue } from "./appUtils.js";
import { openDatePicker } from "./datePickerUtils.js";

test("calendar control uses the native picker when available", () => {
  let focused = 0;
  let shown = 0;
  let clicked = 0;
  assert.equal(openDatePicker({ focus: () => focused++, showPicker: () => shown++, click: () => clicked++ }), true);
  assert.deepEqual({ focused, shown, clicked }, { focused: 1, shown: 1, clicked: 0 });
});

test("calendar control focuses and clicks when showPicker is unavailable or rejected", () => {
  let clicked = 0;
  const input = { focus() {}, click: () => clicked++ };
  openDatePicker(input);
  input.showPicker = () => { throw new Error("unsupported"); };
  openDatePicker(input);
  assert.equal(clicked, 2);
});

test("due-date shortcuts preserve local date-only values", () => {
  assert.match(getDueDateShortcutValue("today"), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(getDueDateShortcutValue("tomorrow"), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(getDueDateShortcutValue("clear"), "");
});
