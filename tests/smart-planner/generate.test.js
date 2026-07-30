/* global process */

import assert from "node:assert/strict";
import test from "node:test";
import { createSmartPlannerHandler } from "../../api/smart-planner/generate.js";

const ENV = {
  NODE_ENV: "production",
  ANTHROPIC_API_KEY: "server-test-key",
  SMART_PLANNER_USAGE_SECRET: "test-only-usage-secret-with-enough-entropy",
  SMART_PLANNER_DAILY_LIMIT: "3",
};

function createResponse() {
  return {
    headers: new Map(),
    statusCode: 200,
    payload: null,
    setHeader(name, value) {
      this.headers.set(name.toLowerCase(), value);
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return payload;
    },
  };
}

function validRequest() {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-student-hub-request": "smart-planner",
      "x-forwarded-for": "203.0.113.5",
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
      tasks: [{ id: "task-1", title: "Essay", completed: false }],
    },
  };
}

function providerPlan() {
  return {
    ok: true,
    output: {
      status: "ready",
      summary: "A focused plan.",
      blocks: [
        {
          type: "study",
          taskId: "task-1",
          title: "Essay",
          subject: "",
          startMinute: 900,
          durationMinutes: 35,
          goal: "Draft the introduction.",
          reason: "It is the next useful step.",
        },
      ],
      omittedTasks: [],
      warnings: [],
    },
  };
}

async function withAllowedOrigin(run) {
  const previous = process.env.SMART_PLANNER_ALLOWED_ORIGINS;
  process.env.SMART_PLANNER_ALLOWED_ORIGINS = "https://student.example";
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.SMART_PLANNER_ALLOWED_ORIGINS;
    else process.env.SMART_PLANNER_ALLOWED_ORIGINS = previous;
  }
}

test("invalid requests do not consume quota", async () => {
  let providerCalls = 0;
  const handler = createSmartPlannerHandler({
    env: ENV,
    requestPlan: async () => {
      providerCalls += 1;
      return providerPlan();
    },
  });
  const response = createResponse();
  await handler({ method: "GET", headers: {} }, response);

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(providerCalls, 0);
});

test("missing Anthropic configuration does not consume quota", async () => {
  await withAllowedOrigin(async () => {
    const handler = createSmartPlannerHandler({ env: { ...ENV, ANTHROPIC_API_KEY: "" } });
    const response = createResponse();
    await handler(validRequest(), response);

    assert.equal(response.statusCode, 503);
    assert.equal(response.payload.status, "not_configured");
    assert.equal(response.headers.has("set-cookie"), false);
  });
});

test("successful generation returns safe remaining quota metadata", async () => {
  await withAllowedOrigin(async () => {
    let providerCalls = 0;
    const handler = createSmartPlannerHandler({
      env: ENV,
      now: () => Date.parse("2026-07-30T10:00:00.000Z"),
      ipBuckets: new Map(),
      requestPlan: async () => {
        providerCalls += 1;
        return providerPlan();
      },
    });
    const response = createResponse();
    await handler(validRequest(), response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.remainingGenerations, 2);
    assert.match(response.payload.resetAt, /^2026-07-31T10:00:00\.000Z$/);
    assert.equal(providerCalls, 1);
    assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  });
});

test("the fourth generation is blocked before the provider is called", async () => {
  await withAllowedOrigin(async () => {
    let providerCalls = 0;
    let cookie = "";
    const handler = createSmartPlannerHandler({
      env: ENV,
      now: () => Date.parse("2026-07-30T10:00:00.000Z"),
      ipBuckets: new Map(),
      requestPlan: async () => {
        providerCalls += 1;
        return providerPlan();
      },
    });

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const request = validRequest();
      request.headers.cookie = cookie;
      const response = createResponse();
      await handler(request, response);

      const setCookie = response.headers.get("set-cookie");
      if (setCookie) cookie = String(setCookie).split(";")[0];

      if (attempt === 4) {
        assert.equal(response.statusCode, 429);
        assert.equal(response.payload.status, "daily_limit_reached");
        assert.equal(response.payload.remainingGenerations, 0);
      }
    }

    assert.equal(providerCalls, 3);
  });
});
