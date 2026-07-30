/* global process */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ANTHROPIC_SMART_PLANNER_OUTPUT_SCHEMA,
  SMART_PLANNER_OUTPUT_SCHEMA,
  requestAnthropicPlan,
  validateSmartPlannerOutput,
  validateSmartPlannerRequest,
} from "../../server/smart-planner/planner.js";

const UNSUPPORTED_PROVIDER_SCHEMA_KEYS = new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
]);

function collectSchemaKeys(value, keys = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectSchemaKeys(item, keys));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      keys.push(key);
      collectSchemaKeys(child, keys);
    });
  }
  return keys;
}

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

test("provider schema excludes unsupported constraints while internal schema keeps them", () => {
  const providerKeys = collectSchemaKeys(ANTHROPIC_SMART_PLANNER_OUTPUT_SCHEMA);
  assert.equal(
    providerKeys.some((key) => UNSUPPORTED_PROVIDER_SCHEMA_KEYS.has(key)),
    false
  );
  assert.equal(SMART_PLANNER_OUTPUT_SCHEMA.properties.summary.maxLength, 280);
  assert.equal(
    SMART_PLANNER_OUTPUT_SCHEMA.properties.blocks.items.properties.startMinute.minimum,
    0
  );
  assert.equal(SMART_PLANNER_OUTPUT_SCHEMA.properties.blocks.maxItems, 18);
});

test("internal validation enforces string, number, count, and timing limits", () => {
  assert.equal(
    validateSmartPlannerOutput(readyPlan({ summary: "" }), input).ok,
    false
  );
  assert.equal(
    validateSmartPlannerOutput(
      readyPlan({
        blocks: [{ ...readyPlan().blocks[0], durationMinutes: 80 }],
      }),
      input
    ).ok,
    false
  );
  assert.equal(
    validateSmartPlannerOutput(
      readyPlan({ warnings: Array.from({ length: 7 }, () => "Note") }),
      input
    ).ok,
    false
  );
  assert.equal(
    validateSmartPlannerOutput(
      readyPlan({
        blocks: [{ ...readyPlan().blocks[0], startMinute: 990, durationMinutes: 30 }],
      }),
      input
    ).ok,
    false
  );
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

test("provider errors make exactly one Anthropic request", async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.ANTHROPIC_API_KEY;
  const previousWarn = console.warn;
  let calls = 0;
  console.warn = () => {};
  globalThis.fetch = async (_url, options) => {
    calls += 1;
    const body = JSON.parse(options.body);
    assert.equal(body.max_tokens, 2000);
    assert.deepEqual(
      body.output_config.format.schema,
      ANTHROPIC_SMART_PLANNER_OUTPUT_SCHEMA
    );
    return { ok: false, status: 529, headers: new Headers(), json: async () => ({}) };
  };
  process.env.ANTHROPIC_API_KEY = "server-test-key";

  try {
    const result = await requestAnthropicPlan(input);
    assert.equal(result.ok, false);
    assert.equal(result.status, "provider_unavailable");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
    console.warn = previousWarn;
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
  }
});

test("provider HTTP failures return distinct safe statuses and diagnostics", async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.ANTHROPIC_API_KEY;
  const previousWarn = console.warn;
  const diagnostics = [];
  console.warn = (_label, metadata) => diagnostics.push(metadata);
  process.env.ANTHROPIC_API_KEY = "server-test-key";

  try {
    for (const [httpStatus, expectedStatus] of [
      [400, "provider_request_invalid"],
      [401, "provider_auth_failed"],
      [403, "provider_permission_denied"],
      [404, "model_unavailable"],
      [429, "rate_limited"],
      [500, "provider_unavailable"],
    ]) {
      let calls = 0;
      globalThis.fetch = async () => {
        calls += 1;
        return {
          ok: false,
          status: httpStatus,
          headers: new Headers({ "request-id": "req_safe_123" }),
          json: async () => ({
            error: {
              type: "invalid_request_error",
              message: "must not be logged",
            },
          }),
        };
      };

      const result = await requestAnthropicPlan(input);
      assert.equal(result.status, expectedStatus);
      assert.equal(calls, 1);
      assert.equal(JSON.stringify(diagnostics.at(-1)).includes("must not be logged"), false);
    }
  } finally {
    globalThis.fetch = previousFetch;
    console.warn = previousWarn;
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
  }
});

test("timeout and network failures stay safe and never retry", async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.ANTHROPIC_API_KEY;
  const previousWarn = console.warn;
  console.warn = () => {};
  process.env.ANTHROPIC_API_KEY = "server-test-key";

  try {
    for (const [error, expectedStatus] of [
      [Object.assign(new Error("timeout details"), { name: "AbortError" }), "timeout"],
      [new Error("network details"), "provider_unavailable"],
    ]) {
      let calls = 0;
      globalThis.fetch = async () => {
        calls += 1;
        throw error;
      };
      const result = await requestAnthropicPlan(input);
      assert.equal(result.status, expectedStatus);
      assert.equal(calls, 1);
      assert.equal(JSON.stringify(result).includes("details"), false);
    }
  } finally {
    globalThis.fetch = previousFetch;
    console.warn = previousWarn;
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
  }
});
