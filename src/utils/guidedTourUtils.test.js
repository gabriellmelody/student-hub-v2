import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarGuidedTour,
  demoGuidedTour,
  gettingStartedGuidedTour,
  getGuidedTourDefinition,
  smartPlannerGuidedTour,
  subjectsGuidedTour,
  todoGuidedTour,
  todaysPlanGuidedTour,
} from "../data/guidedTours.js";
import {
  computeTourCardPosition,
  claimGuidedTourExit,
  claimGuidedTourStartup,
  findTourTarget,
  getSpotlightRect,
  getStepTargetSelectors,
  getTourNavigationRequest,
  getTourRequestFromSearch,
  getTourScrollBehavior,
  getTourViewportMetrics,
  guidedTourReducer,
  initialGuidedTourState,
  isTourExitKey,
  isTourTooltipReady,
  removeTourRequestFromUrl,
  resolveForcedTourRequest,
  restoreTourFocus,
  shouldCloseTourOpenedModal,
  targetNeedsTourScroll,
  tourGeometryMatches,
  waitForTourTarget,
} from "./guidedTourUtils.js";

test("a tour begins at its first definition step", () => {
  const state = guidedTourReducer(initialGuidedTourState, {
    type: "start",
    tour: demoGuidedTour,
  });

  assert.equal(state.isTourActive, true);
  assert.equal(state.activeStepIndex, 0);
  assert.equal(state.activeTour.steps[0].title, demoGuidedTour.steps[0].title);
});

test("next advances and back returns to the previous step", () => {
  const started = guidedTourReducer(initialGuidedTourState, {
    type: "start",
    tour: demoGuidedTour,
  });
  const advanced = guidedTourReducer(started, { type: "next" });
  const returned = guidedTourReducer(advanced, { type: "previous" });

  assert.equal(advanced.activeStepIndex, 1);
  assert.equal(returned.activeStepIndex, 0);
});

test("next on the final step completes the tour", () => {
  const started = guidedTourReducer(initialGuidedTourState, {
    type: "start",
    tour: demoGuidedTour,
  });
  const finalStep = guidedTourReducer(started, { type: "next" });
  const finished = guidedTourReducer(finalStep, { type: "next" });

  assert.equal(finished.isTourActive, false);
  assert.equal(finished.lastExitReason, "finished");
});

test("skip closes the tour immediately", () => {
  const started = guidedTourReducer(initialGuidedTourState, {
    type: "start",
    tour: demoGuidedTour,
  });
  const skipped = guidedTourReducer(started, { type: "skip" });

  assert.equal(skipped.isTourActive, false);
  assert.equal(skipped.lastExitReason, "skipped");
});

test("starting another tour safely replaces the active definition", () => {
  const started = guidedTourReducer(initialGuidedTourState, {
    type: "start",
    tour: demoGuidedTour,
  });
  const replacement = {
    id: "replacement",
    steps: [
      {
        id: "replacement-step",
        target: "[data-replacement]",
        title: "Replacement",
        description: "A replacement tour.",
      },
    ],
  };
  const replaced = guidedTourReducer(started, {
    type: "start",
    tour: replacement,
  });

  assert.equal(replaced.activeTour.id, "replacement");
  assert.equal(replaced.activeStepIndex, 0);
});

test("a missing target resolves safely instead of waiting forever", async () => {
  const missingDocument = {
    body: {},
    querySelector: () => null,
  };
  const target = await waitForTourTarget({
    step: demoGuidedTour.steps[0],
    documentRef: missingDocument,
    timeoutMs: 0,
    now: () => 0,
    requestFrame: () => 1,
    cancelFrame: () => {},
    createObserver: () => null,
  });

  assert.equal(target, null);
  assert.equal(findTourTarget(demoGuidedTour.steps[0], {
    documentRef: missingDocument,
  }), null);
});

test("a cross-page step requests the existing app page", () => {
  assert.equal(
    getTourNavigationRequest("home", demoGuidedTour.steps[1]),
    "tasks"
  );
  assert.equal(
    getTourNavigationRequest("tasks", demoGuidedTour.steps[1]),
    null
  );
});

test("tour copy remains in the definition", () => {
  const loadedTour = getGuidedTourDefinition("demo");

  assert.equal(loadedTour.steps[0].title, "Your next task");
  assert.match(loadedTour.steps[1].description, /organise it/);
});

test("preferred placement falls back when it would overflow", () => {
  const position = computeTourCardPosition({
    targetRect: { left: 120, right: 180, top: 700, bottom: 760, width: 60, height: 60 },
    cardSize: { width: 280, height: 180 },
    preferredPlacement: "bottom",
    viewport: { width: 390, height: 800 },
    bottomInset: 80,
  });

  assert.equal(position.placement, "top");
});

test("card and spotlight positions are clamped to the viewport", () => {
  const spotlight = getSpotlightRect(
    { left: -10, top: -4, right: 420, bottom: 30 },
    8,
    { width: 390, height: 800 }
  );
  const card = computeTourCardPosition({
    targetRect: spotlight,
    cardSize: { width: 350, height: 220 },
    preferredPlacement: "top",
    viewport: { width: 390, height: 800 },
  });

  assert.equal(spotlight.left, 0);
  assert.equal(spotlight.right, 390);
  assert.ok(card.left >= 16);
  assert.ok(card.left + 350 <= 374);
  assert.ok(card.top >= 16);
});

test("placement stays inside a 360px viewport and clears bottom navigation", () => {
  const position = computeTourCardPosition({
    targetRect: { left: 310, right: 350, top: 690, bottom: 730, width: 40, height: 40 },
    cardSize: { width: 336, height: 240 },
    preferredPlacement: "bottom",
    viewport: { width: 360, height: 800, left: 0, top: 0 },
    bottomInset: 72,
  });

  assert.ok(position.left >= 12);
  assert.ok(position.left + 336 <= 348);
  assert.ok(position.top + 240 <= 716);
});

test("safe-area offsets constrain card and spotlight geometry", () => {
  const viewport = {
    width: 390,
    height: 844,
    left: 0,
    top: 0,
    leftInset: 9,
    rightInset: 11,
    topInset: 72,
    bottomInset: 102,
    safeArea: { top: 8, right: 11, bottom: 14, left: 9 },
  };
  const spotlight = getSpotlightRect(
    { left: 0, top: 0, right: 420, bottom: 840 },
    20,
    viewport
  );
  const card = computeTourCardPosition({
    targetRect: spotlight,
    cardSize: { width: 340, height: 220 },
    viewport,
    bottomInset: 72,
  });

  assert.equal(spotlight.left, 9);
  assert.equal(spotlight.top, 72);
  assert.equal(spotlight.right, 379);
  assert.equal(spotlight.bottom, 742);
  assert.ok(card.left >= 12);
  assert.ok(card.top >= 12);
  assert.ok(card.top + 220 <= 758);
});

test("visualViewport metrics are used with a safe window fallback", () => {
  const visual = getTourViewportMetrics({
    innerWidth: 1024,
    innerHeight: 768,
    visualViewport: {
      width: 390,
      height: 620,
      offsetLeft: 4,
      offsetTop: 120,
    },
  });
  const fallback = getTourViewportMetrics({ innerWidth: 430, innerHeight: 932 });

  assert.deepEqual(
    { width: visual.width, height: visual.height, left: visual.left, top: visual.top },
    { width: 390, height: 620, left: 4, top: 120 }
  );
  assert.deepEqual(
    { width: fallback.width, height: fallback.height, left: fallback.left, top: fallback.top },
    { width: 430, height: 932, left: 0, top: 0 }
  );
});

test("old geometry is distinguishable between tour steps", () => {
  const first = { left: 20, top: 30, right: 80, bottom: 90, width: 60, height: 60 };
  const same = { ...first, left: 20.2 };
  const nextStep = { ...first, left: 120, right: 180 };

  assert.equal(tourGeometryMatches(first, same), true);
  assert.equal(tourGeometryMatches(first, nextStep), false);
});

test("scrolling is requested only when a target is not sufficiently visible", () => {
  const viewport = {
    width: 390,
    height: 844,
    topInset: 64,
    bottomInset: 88,
  };

  assert.equal(
    targetNeedsTourScroll(
      { left: 20, right: 370, top: 100, bottom: 500, width: 350, height: 400 },
      viewport
    ),
    false
  );
  assert.equal(
    targetNeedsTourScroll(
      { left: 20, right: 370, top: 810, bottom: 1010, width: 350, height: 200 },
      viewport
    ),
    true
  );
});

test("reduced motion disables smooth scrolling", () => {
  assert.equal(getTourScrollBehavior(true), "auto");
  assert.equal(getTourScrollBehavior(false), "smooth");
});

test("focus can be returned after a tour closes", () => {
  let focused = false;
  const starter = {
    isConnected: true,
    focus: () => {
      focused = true;
    },
  };

  assert.equal(restoreTourFocus(starter), true);
  assert.equal(focused, true);
});

test("focus falls back to the page heading when the launcher is gone", () => {
  let focused = false;
  const heading = {
    focus: () => {
      focused = true;
    },
    hasAttribute: () => false,
    setAttribute: () => {},
    addEventListener: () => {},
  };

  assert.equal(
    restoreTourFocus({ isConnected: false }, { querySelector: () => heading }),
    true
  );
  assert.equal(focused, true);
});

test("Escape is recognised as the safe tour exit key", () => {
  assert.equal(isTourExitKey({ key: "Escape" }), true);
  assert.equal(isTourExitKey({ key: "Enter" }), false);
});

test("the demo query starts only the requested demonstration", () => {
  assert.equal(getTourRequestFromSearch("?tour=demo"), "demo");
  assert.equal(getGuidedTourDefinition(getTourRequestFromSearch("?tour=demo"))?.id, "demo");
  assert.equal(getTourRequestFromSearch("?tab=integrations"), null);
});

test("removing the demo query preserves other safe URL state", () => {
  assert.equal(
    removeTourRequestFromUrl("https://student.example/?tour=demo&tab=integrations#top"),
    "/?tab=integrations#top"
  );
});

test("tour state transitions do not persist completion", () => {
  let storageWrites = 0;
  const originalLocalStorage = globalThis.localStorage;

  globalThis.localStorage = {
    setItem: () => {
      storageWrites += 1;
    },
  };

  try {
    const started = guidedTourReducer(initialGuidedTourState, {
      type: "start",
      tour: demoGuidedTour,
    });
    guidedTourReducer(started, { type: "finish" });
    assert.equal(storageWrites, 0);
  } finally {
    if (originalLocalStorage === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = originalLocalStorage;
    }
  }
});

test("getting started contains the six required app areas", () => {
  assert.equal(gettingStartedGuidedTour.steps.length, 6);
  assert.deepEqual(
    gettingStartedGuidedTour.steps.map((step) => step.page),
    ["home", "tasks", "subjects", "calendar", "plan", "settings"]
  );
});

test("getting started opens the Integrations settings view", () => {
  const finalStep = gettingStartedGuidedTour.steps.at(-1);

  assert.equal(finalStep.settingsView, "integrations");
  assert.equal(
    getTourNavigationRequest("settings", finalStep, "hub"),
    "settings"
  );
  assert.equal(
    getTourNavigationRequest("settings", finalStep, "integrations"),
    null
  );
});

test("all supported forced replay identifiers resolve", () => {
  for (const tourId of [
    "getting-started",
    "todo",
    "subjects",
    "calendar",
    "smart-planner",
    "todays-plan",
    "demo",
  ]) {
    assert.equal(getGuidedTourDefinition(tourId)?.id, tourId);
  }
});

test("unknown forced replay identifiers are rejected", () => {
  assert.equal(getGuidedTourDefinition("not-a-tour"), null);
});

test("Subjects steps provide empty-state fallbacks", () => {
  assert.equal(subjectsGuidedTour.steps.length, 4);
  assert.match(subjectsGuidedTour.steps[0].fallbackTarget, /subject-empty-add/);
  assert.match(subjectsGuidedTour.steps[1].fallbackTarget, /subject-empty-add/);
  assert.match(subjectsGuidedTour.steps[2].fallbackTarget, /subject-empty-add/);
});

test("To-do tour resolves and provides safe task fallbacks", () => {
  assert.equal(todoGuidedTour.steps.length, 4);
  assert.deepEqual(
    todoGuidedTour.steps.map((step) => step.page),
    ["tasks", "tasks", "tasks", "tasks"]
  );
  assert.equal(
    todoGuidedTour.steps[1].fallbackTarget,
    '[data-tour="todo-overview"]'
  );
  assert.equal(
    todoGuidedTour.steps[2].fallbackTarget,
    '[data-tour="todo-overview"]'
  );
  assert.equal(
    todoGuidedTour.steps[3].fallbackTarget,
    '[data-tour="todo-add-task"]'
  );
});

test("Today’s Plan tour resolves and falls back to the plan overview", () => {
  assert.equal(todaysPlanGuidedTour.steps.length, 4);
  assert.deepEqual(
    todaysPlanGuidedTour.steps.map((step) => step.page),
    ["plan", "plan", "plan", "plan"]
  );
  for (const step of todaysPlanGuidedTour.steps.slice(1)) {
    assert.equal(
      step.fallbackTarget,
      '[data-tour="todays-plan-overview"]'
    );
  }
});

test("Calendar steps provide safe fallbacks for unavailable event data", () => {
  assert.equal(calendarGuidedTour.steps.length, 4);
  assert.match(calendarGuidedTour.steps[2].fallbackTarget, /calendar-overview/);
  assert.match(calendarGuidedTour.steps[3].fallbackTarget, /calendar-overview/);
});

test("fallback selectors follow the primary selector", () => {
  const selectors = getStepTargetSelectors(subjectsGuidedTour.steps[0]);

  assert.deepEqual(selectors, [
    '[data-tour="subjects-overview"]',
    '[data-tour="subject-empty-add"]',
  ]);
});

test("Calendar busy-time fallback returns to the overview", () => {
  assert.equal(
    calendarGuidedTour.steps[3].fallbackTarget,
    '[data-tour="calendar-overview"]'
  );
});

test("Smart Planner tour opens the existing modal declaratively", () => {
  assert.equal(smartPlannerGuidedTour.steps.length, 5);
  assert.equal(smartPlannerGuidedTour.steps[0].action, "open-smart-planner");
  assert.deepEqual(
    smartPlannerGuidedTour.steps.map((step) => step.page),
    ["plan", "plan", "plan", "plan", "plan"]
  );
});

test("forced replay resolves a completed tour definition directly", () => {
  const request = resolveForcedTourRequest(
    "?tour=getting-started",
    getGuidedTourDefinition
  );

  assert.equal(request.requested, true);
  assert.equal(request.tour.id, "getting-started");
});

test("invalid forced replay remains a safe empty request", () => {
  const request = resolveForcedTourRequest(
    "?tour=unknown",
    getGuidedTourDefinition
  );

  assert.equal(request.requested, true);
  assert.equal(request.tour, null);
});

test("startup claims prevent StrictMode duplicate starts", () => {
  const handledRef = { current: false };

  assert.equal(claimGuidedTourStartup(handledRef), true);
  assert.equal(claimGuidedTourStartup(handledRef), false);
});

test("tour exits are recorded only once", () => {
  const handledRef = { current: false };

  assert.equal(claimGuidedTourExit(handledRef), true);
  assert.equal(claimGuidedTourExit(handledRef), false);
});

test("tooltip remains hidden until placement is complete", () => {
  assert.equal(isTourTooltipReady("locating", null, null), false);
  assert.equal(isTourTooltipReady("measuring", {}, null), false);
  assert.equal(isTourTooltipReady("ready", {}, { left: 10, top: 10 }), true);
});

test("only a tour-owned Smart Planner modal closes with the tour", () => {
  assert.equal(shouldCloseTourOpenedModal(true), true);
  assert.equal(shouldCloseTourOpenedModal(false), false);
});
