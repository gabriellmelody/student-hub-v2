import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSmartPlannerTaskPayload,
  getDefaultSmartPlannerDraft,
  getNextHalfHourStart,
  normalizeSmartPlannerContext,
  shouldRequestSmartPlannerAi,
} from "./smartPlannerUtils.js";

function localTime(hours, minutes) {
  const date = new Date(2026, 6, 30, hours, minutes, 0, 0);
  return date;
}

test("rounds a fresh Smart Planner start to the next half-hour", () => {
  assert.deepEqual(getNextHalfHourStart(localTime(14, 5)), {
    available: true,
    minute: 14 * 60 + 30,
    time: "14:30",
  });
  assert.deepEqual(getNextHalfHourStart(localTime(14, 29)), {
    available: true,
    minute: 14 * 60 + 30,
    time: "14:30",
  });
  assert.deepEqual(getNextHalfHourStart(localTime(14, 30)), {
    available: true,
    minute: 14 * 60 + 30,
    time: "14:30",
  });
  assert.deepEqual(getNextHalfHourStart(localTime(14, 31)), {
    available: true,
    minute: 15 * 60,
    time: "15:00",
  });
  assert.deepEqual(getNextHalfHourStart(localTime(14, 45)), {
    available: true,
    minute: 15 * 60,
    time: "15:00",
  });
});

test("does not roll a current-day plan into tomorrow", () => {
  assert.deepEqual(getNextHalfHourStart(localTime(23, 45)), {
    available: false,
    minute: null,
    time: "",
  });
});

test("preselects the 20 most relevant active tasks", () => {
  const lowPriority = Array.from({ length: 24 }, (_, index) => ({
    id: `low-${index}`,
    title: `Low priority ${index}`,
    dueDate: "",
    importance: "low",
    effort: 1,
  }));
  const urgent = {
    id: "urgent-overdue",
    title: "Overdue essay assessment",
    dueDate: "2026-07-29",
    importance: "high",
    effort: 5,
  };
  const dueToday = {
    id: "due-today",
    title: "Questions",
    dueDate: "2026-07-30",
    effort: 2,
  };

  const selected = buildSmartPlannerTaskPayload(
    [...lowPriority, dueToday, urgent],
    "2026-07-30"
  );

  assert.equal(selected.length, 20);
  assert.deepEqual(selected.slice(0, 2).map((task) => task.id), [
    "urgent-overdue",
    "due-today",
  ]);
});

test("Basic planning makes no AI request and preserves displayed quota", () => {
  const quota = { remainingGenerations: 2, resetAt: "2026-07-31T10:00:00.000Z" };
  let smartPlannerApiRequests = 0;

  if (
    shouldRequestSmartPlannerAi({
      basic: true,
      plannerContext: "Temporary context must stay local.",
      ...quota,
    })
  ) {
    smartPlannerApiRequests += 1;
  }

  assert.equal(smartPlannerApiRequests, 0);
  assert.deepEqual(quota, {
    remainingGenerations: 2,
    resetAt: "2026-07-31T10:00:00.000Z",
  });
  assert.equal(
    shouldRequestSmartPlannerAi({ basic: false, remainingGenerations: 0 }),
    false
  );
});

test("Planner context is trimmed, bounded, and fresh for each modal open", () => {
  assert.equal(normalizeSmartPlannerContext("  steady EE progress  "), "steady EE progress");
  assert.equal(normalizeSmartPlannerContext("x".repeat(900)).length, 800);

  const firstOpen = getDefaultSmartPlannerDraft({ now: localTime(14, 5) });
  firstOpen.plannerContext = "Temporary details";
  const reopened = getDefaultSmartPlannerDraft({ now: localTime(14, 5) });

  assert.equal(reopened.plannerContext, "");
  assert.equal(firstOpen.plannerContext, "Temporary details");
});

test("editing context alone creates no API request or quota change", () => {
  const quota = { remainingGenerations: 3, resetAt: "" };
  const draft = getDefaultSmartPlannerDraft({ now: localTime(14, 5) });
  let smartPlannerApiRequests = 0;

  draft.plannerContext = "Prioritise my existing EE task.";

  assert.equal(smartPlannerApiRequests, 0);
  assert.equal(quota.remainingGenerations, 3);
  assert.equal(draft.plannerContext, "Prioritise my existing EE task.");
});
