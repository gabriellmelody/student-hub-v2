import assert from "node:assert/strict";
import test from "node:test";
import {
  MOBILE_SWIPE_PAGES,
  evaluateMobileSwipe,
  getAdjacentMobilePage,
  getNavigationDirection,
  getPagerCleanupPage,
  getPagerDragState,
  getPagerPanelTransforms,
  getPagerSettleDuration,
  getPagerSettleTargets,
  getSwipeIntent,
  shouldCommitPagerNavigation,
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


test("adjacent page resolution follows the mobile order", () => {
  assert.equal(getAdjacentMobilePage("home", "forward"), "calendar");
  assert.equal(getAdjacentMobilePage("home", "back"), "plan");
});

test("drag progress tracks distance as a viewport ratio", () => {
  const drag = getPagerDragState({
    currentPage: "home",
    deltaX: -100,
    viewportWidth: 400,
  });

  assert.equal(drag.adjacentPage, "calendar");
  assert.equal(drag.offset, -100);
  assert.equal(drag.progress, 0.25);
});

test("commit threshold accepts roughly 28 percent of viewport", () => {
  assert.equal(
    shouldCommitPagerNavigation({ offset: -120, viewportWidth: 400, velocityX: -0.1 }),
    true
  );
});

test("snap-back decision rejects short slow drags", () => {
  assert.equal(
    shouldCommitPagerNavigation({ offset: -70, viewportWidth: 400, velocityX: -0.1 }),
    false
  );
});

test("velocity-based commit accepts fast directional swipes", () => {
  assert.equal(
    shouldCommitPagerNavigation({ offset: -48, viewportWidth: 400, velocityX: -0.7 }),
    true
  );
  assert.equal(
    shouldCommitPagerNavigation({ offset: -48, viewportWidth: 400, velocityX: 0.7 }),
    false
  );
});

test("boundary drags use resisted movement", () => {
  const todo = getPagerDragState({ currentPage: "tasks", deltaX: 100, viewportWidth: 400 });
  const calendar = getPagerDragState({ currentPage: "calendar", deltaX: -100, viewportWidth: 400 });

  assert.equal(todo.boundary, true);
  assert.equal(todo.adjacentPage, null);
  assert.ok(todo.offset > 0 && todo.offset < 30);
  assert.equal(calendar.boundary, true);
  assert.equal(calendar.adjacentPage, null);
  assert.ok(calendar.offset < 0 && calendar.offset > -30);
});

test("gesture intent waits, accepts horizontal and rejects vertical", () => {
  assert.equal(getSwipeIntent({ deltaX: 4, deltaY: 3 }), "pending");
  assert.equal(getSwipeIntent({ deltaX: 24, deltaY: 8 }), "horizontal");
  assert.equal(getSwipeIntent({ deltaX: 18, deltaY: 34 }), "vertical");
});


test("adjacent panel starts exactly one viewport away", () => {
  assert.deepEqual(
    getPagerPanelTransforms({ direction: "forward", offset: 0, viewportWidth: 400 }),
    { currentX: 0, adjacentX: 400 }
  );
  assert.deepEqual(
    getPagerPanelTransforms({ direction: "back", offset: 0, viewportWidth: 400 }),
    { currentX: 0, adjacentX: -400 }
  );
});

test("drag transforms keep current and destination panels edge-to-edge", () => {
  const forward = getPagerPanelTransforms({ direction: "forward", offset: -100, viewportWidth: 400 });
  const back = getPagerPanelTransforms({ direction: "back", offset: 100, viewportWidth: 400 });

  assert.equal(forward.currentX, -100);
  assert.equal(forward.adjacentX, 300);
  assert.equal(forward.adjacentX - forward.currentX, 400);
  assert.equal(back.currentX, 100);
  assert.equal(back.adjacentX, -300);
  assert.equal(back.currentX - back.adjacentX, 400);
});

test("committed settle targets end with destination at zero", () => {
  assert.deepEqual(
    getPagerSettleTargets({ direction: "forward", commit: true, viewportWidth: 400 }),
    { currentX: -400, adjacentX: 0 }
  );
  assert.deepEqual(
    getPagerSettleTargets({ direction: "back", commit: true, viewportWidth: 400 }),
    { currentX: 400, adjacentX: 0 }
  );
});

test("snap-back settle targets return current panel to zero", () => {
  assert.deepEqual(
    getPagerSettleTargets({ direction: "forward", commit: false, viewportWidth: 400 }),
    { currentX: 0, adjacentX: 400 }
  );
  assert.deepEqual(
    getPagerSettleTargets({ direction: "none", commit: false, viewportWidth: 400 }),
    { currentX: 0, adjacentX: null }
  );
});

test("pager cleanup preserves the intended navigation destination", () => {
  assert.equal(getPagerCleanupPage({ from: "home", to: "calendar", commit: true }), "calendar");
  assert.equal(getPagerCleanupPage({ from: "home", to: "calendar", commit: false }), "home");
});

test("reduced-motion completion is effectively immediate", () => {
  assert.equal(
    getPagerSettleDuration({
      currentOffset: -120,
      targetOffset: -400,
      viewportWidth: 400,
      reducedMotion: true,
    }),
    1
  );
});
