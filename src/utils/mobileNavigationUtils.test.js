import assert from "node:assert/strict";
import test from "node:test";
import {
  MOBILE_SWIPE_PAGES,
  evaluateMobileSwipe,
  getNavigationDirection,
} from "./mobileNavigationUtils.js";

test("mobile page order is To-do -> Plan -> Home -> Calendar", () => {
  assert.deepEqual(MOBILE_SWIPE_PAGES, ["tasks", "plan", "home", "calendar"]);
});

test("Home swipe left resolves to Calendar", () => {
  assert.equal(
    evaluateMobileSwipe({ currentPage: "home", startX: 240, startY: 100, endX: 170, endY: 106, viewportWidth: 390 }).page,
    "calendar"
  );
});

test("Home swipe right resolves to Plan", () => {
  assert.equal(
    evaluateMobileSwipe({ currentPage: "home", startX: 170, startY: 100, endX: 240, endY: 106, viewportWidth: 390 }).page,
    "plan"
  );
});

test("Plan swipe right resolves to To-do", () => {
  assert.equal(
    evaluateMobileSwipe({ currentPage: "plan", startX: 160, startY: 100, endX: 228, endY: 104, viewportWidth: 390 }).page,
    "tasks"
  );
});

test("boundary swipe from To-do right does nothing", () => {
  assert.equal(
    evaluateMobileSwipe({ currentPage: "tasks", startX: 150, startY: 100, endX: 220, endY: 100, viewportWidth: 390 }).page,
    null
  );
});

test("boundary swipe from Calendar left does nothing", () => {
  assert.equal(
    evaluateMobileSwipe({ currentPage: "calendar", startX: 220, startY: 100, endX: 150, endY: 100, viewportWidth: 390 }).page,
    null
  );
});

test("vertical-dominant gesture does not navigate", () => {
  assert.equal(
    evaluateMobileSwipe({ currentPage: "home", startX: 220, startY: 100, endX: 150, endY: 190, viewportWidth: 390 }).reason,
    "vertical"
  );
});

test("movement below threshold does not navigate", () => {
  assert.equal(
    evaluateMobileSwipe({ currentPage: "home", startX: 220, startY: 100, endX: 180, endY: 104, viewportWidth: 390 }).reason,
    "threshold"
  );
});

test("direction calculation for bottom-nav taps is correct", () => {
  assert.equal(getNavigationDirection("home", "calendar"), "forward");
  assert.equal(getNavigationDirection("calendar", "home"), "back");
  assert.equal(getNavigationDirection("home", "home"), "none");
});

test("More is not part of swipe navigation", () => {
  assert.equal(MOBILE_SWIPE_PAGES.includes("more"), false);
  assert.equal(MOBILE_SWIPE_PAGES.includes("settings"), false);
  assert.equal(MOBILE_SWIPE_PAGES.includes("subjects"), false);
});
