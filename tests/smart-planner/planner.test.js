/* global process */

import assert from "node:assert/strict";
import test from "node:test";
import {
  SMART_PLANNER_OUTPUT_SCHEMA,
  requestAnthropicPlan,
  validateSmartPlannerOutput,
  validateSmartPlannerRequest,
} from "../../server/smart-planner/planner.js";

const input = {
  startMinute: 900,
  finishMinute: 1080,
  busyIntervals: [{ startMinute: 990, endMinute: 1020 }],
  tasks: [
    { id: "task-1", title: "Essay", subject: "English", completed: false },
    { id: "task-2", title: "Questions", subject: "Maths", completed: false },
  ],
};

function readyPlan(overrides = {}) {
  return {
    status: "ready",
    summary: "A focused plan.",
    blocks: [
      {
        type: "study",
        taskId: "task-1",
        title: "Essay",
        subject: "English",
        startMinute: 900,
        durationMinutes: 45,
        goal: "Draft the introduction.",
        reason: "It is due soon.",
      },
    ],
    omittedTasks: [
      {
        taskId: "task-2",
        title: "Questions",
        reason: "It does not fit today.",
        suggestedNextStep: "Plan it next time.",
      },
    ],
    warnings: [],
    ...overrides,
  };
}

test("accepts a bounded plan and derives block end times", () => {
  const result = validateSmartPlannerOutput(readyPlan(), input);
  assert.equal(result.ok, true);
  assert.equal(result.plan.blocks[0].endMinute, 945);
});

test("rejects hallucinated task IDs", () => {
  const result = validateSmartPlannerOutput(
    readyPlan({
      blocks: [
        {
          ...readyPlan().blocks[0],
          taskId: "invented-task",
        },
      ],
    }),
    input
  );
  assert.equal(result.ok, false);
});

test("rejects blocks that overlap busy Calendar time", () => {
  const result = validateSmartPlannerOutput(
    readyPlan({
      blocks: [
        {
          ...readyPlan().blocks[0],
          startMinute: 990,
          durationMinutes: 30,
        },
      ],
    }),
    input
  );
  assert.equal(result.ok, false);
});

test("rejects unexplained omissions", () => {
  const result = validateSmartPlannerOutput(
    readyPlan({ omittedTasks: [] }),
    input
  );
  assert.equal(result.ok, false);
});

test("output schema caps blocks and omitted tasks", () => {
  assert.equal(SMART_PLANNER_OUTPUT_SCHEMA.properties.blocks.maxItems, 18);
  assert.equal(SMART_PLANNER_OUTPUT_SCHEMA.properties.omittedTasks.maxItems, 20);
  assert.equal(SMART_PLANNER_OUTPUT_SCHEMA.properties.warnings.maxItems, 6);
});

test("rejects requests containing more than 20 eligible tasks", async () => {
  const previous = process.env.SMART_PLANNER_ALLOWED_ORIGINS;
  process.env.SMART_PLANNER_ALLOWED_ORIGINS = "https://student.example";
  try {
    const result = await validateSmartPlannerRequest({
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-student-hub-request": "smart-planner",
        origin: "https://student.example",
      },
      body: {
        localDate: "2026-07-30",
        timeZone: "Asia/Bangkok",
        utcOffsetMinutes: 420,
        currentMinute: 600,
        startMinute: 900,
        finishMinute: 1080,
        planningStyle: "balanced",
        busyIntervals: [],
        tasks: Array.from({ length: 21 }, (_, index) => ({
          id: `task-${index}`,
          title: `Task ${index}`,
          completed: false,
        })),
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, "invalid_request");
  } finally {
    if (previous === undefined) delete process.env.SMART_PLANNER_ALLOWED_ORIGINS;
    else process.env.SMART_PLANNER_ALLOWED_ORIGINS = previous;
  }
});

test("temporary provider errors make exactly one Anthropic request", async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.ANTHROPIC_API_KEY;
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls += 1;
    const body = JSON.parse(options.body);
    assert.equal(body.max_tokens, 2000);
    return { ok: false, status: 529, json: async () => ({}) };
  };
  process.env.ANTHROPIC_API_KEY = "server-test-key";

  try {
    const result = await requestAnthropicPlan(input);
    assert.equal(result.ok, false);
    assert.equal(result.status, "temporary_error");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
  }
});
