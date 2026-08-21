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

function statusRequest(cookie = "") {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-student-hub-request": "smart-planner",
      "x-forwarded-for": "203.0.113.5",
      origin: "https://student.example",
      ...(cookie ? { cookie } : {}),
    },
    body: { action: "status" },
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

test("status mode reports the full allowance without calling the provider", async () => {
  await withAllowedOrigin(async () => {
    let providerCalls = 0;
    const handler = createSmartPlannerHandler({
      env: ENV,
      requestPlan: async () => {
        providerCalls += 1;
        return providerPlan();
      },
    });
    const response = createResponse();
    await handler(statusRequest(), response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.payload, {
      ok: true,
      configured: true,
      status: "ready",
      remainingGenerations: 3,
      dailyLimit: 3,
      resetAt: null,
      basicPlannerAvailable: true,
    });
    assert.equal(providerCalls, 0);
    assert.equal(response.headers.has("set-cookie"), false);
  });
});

test("repeated status checks read quota without consuming it", async () => {
  await withAllowedOrigin(async () => {
    let providerCalls = 0;
    const handler = createSmartPlannerHandler({
      env: ENV,
      requestPlan: async () => {
        providerCalls += 1;
        return providerPlan();
      },
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = createResponse();
      await handler(statusRequest(), response);
      assert.equal(response.payload.remainingGenerations, 3);
      assert.equal(response.payload.resetAt, null);
      assert.equal(response.headers.has("set-cookie"), false);
    }
    assert.equal(providerCalls, 0);
  });
});

test("status mode reports existing and exhausted signed quota", async () => {
  await withAllowedOrigin(async () => {
    let providerCalls = 0;
    let cookie = "";
    const now = Date.parse("2026-07-30T10:00:00.000Z");
    const handler = createSmartPlannerHandler({
      env: ENV,
      now: () => now,
      ipBuckets: new Map(),
      requestPlan: async () => {
        providerCalls += 1;
        return providerPlan();
      },
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const request = validRequest();
      request.headers.cookie = cookie;
      const response = createResponse();
      await handler(request, response);
      cookie = String(response.headers.get("set-cookie")).split(";")[0];

      const statusResponse = createResponse();
      await handler(statusRequest(cookie), statusResponse);
      assert.equal(statusResponse.payload.remainingGenerations, 2 - attempt);
      assert.equal(statusResponse.payload.dailyLimit, 3);
      assert.equal(
        statusResponse.payload.status,
        attempt === 2 ? "daily_limit_reached" : "ready"
      );
      assert.equal(statusResponse.payload.resetAt, "2026-07-31T10:00:00.000Z");
      assert.equal(statusResponse.headers.has("set-cookie"), false);
    }

    assert.equal(providerCalls, 3);
  });
});

test("status mode reports missing server configuration safely", async () => {
  await withAllowedOrigin(async () => {
    const missingKeyResponse = createResponse();
    await createSmartPlannerHandler({
      env: { ...ENV, ANTHROPIC_API_KEY: "" },
    })(statusRequest(), missingKeyResponse);

    assert.equal(missingKeyResponse.payload.status, "unavailable");
    assert.equal(missingKeyResponse.payload.configured, false);
    assert.equal(missingKeyResponse.payload.basicPlannerAvailable, true);

    const missingSecretResponse = createResponse();
    await createSmartPlannerHandler({
      env: { ...ENV, SMART_PLANNER_USAGE_SECRET: "" },
    })(statusRequest(), missingSecretResponse);

    assert.equal(missingSecretResponse.payload.status, "configuration_error");
    assert.equal(missingSecretResponse.payload.configured, false);
    assert.equal(missingSecretResponse.payload.basicPlannerAvailable, true);
    assert.equal(missingSecretResponse.headers.has("set-cookie"), false);
  });
});

test("status mode handles a tampered quota cookie without exposing it", async () => {
  await withAllowedOrigin(async () => {
    let providerCalls = 0;
    const handler = createSmartPlannerHandler({
      env: ENV,
      requestPlan: async () => {
        providerCalls += 1;
        return providerPlan();
      },
    });
    const response = createResponse();
    const cookie = "student_hub_smart_planner_quota=tampered.payload";
    await handler(statusRequest(cookie), response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.status, "configuration_error");
    assert.equal(response.payload.remainingGenerations, 0);
    assert.equal(response.payload.resetAt, null);
    assert.equal(response.headers.has("set-cookie"), false);
    assert.equal(JSON.stringify(response.payload).includes("tampered"), false);
    assert.equal(providerCalls, 0);
  });
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
    const request = validRequest();
    request.body.plannerContext = "Temporary EE progress details";
    await handler(request, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.remainingGenerations, 2);
    assert.match(response.payload.resetAt, /^2026-07-31T10:00:00\.000Z$/);
    assert.equal(providerCalls, 1);
    assert.match(response.headers.get("set-cookie"), /HttpOnly/);
    assert.equal(JSON.stringify(response.payload).includes("Temporary EE progress details"), false);
    assert.equal(Object.hasOwn(response.payload, "plannerContext"), false);
  });
});

test("one generation forwards Subject profiles once without returning grade data", async () => {
  await withAllowedOrigin(async () => {
    let providerCalls = 0;
    let receivedInput = null;
    const handler = createSmartPlannerHandler({
      env: ENV,
      now: () => Date.parse("2026-07-30T10:00:00.000Z"),
      ipBuckets: new Map(),
      requestPlan: async (input) => {
        providerCalls += 1;
        receivedInput = input;
        return providerPlan();
      },
    });
    const request = validRequest();
    request.body.subjectProfiles = [
      {
        subjectId: "subject-economics",
        subject: "Economics",
        currentGrade: "6",
        targetGrade: "7",
        gradeSystem: "IB",
      },
    ];
    const response = createResponse();
    await handler(request, response);

    assert.equal(response.statusCode, 200);
    assert.equal(providerCalls, 1);
    assert.deepEqual(receivedInput.subjectProfiles, request.body.subjectProfiles);
    assert.equal(Object.hasOwn(response.payload, "subjectProfiles"), false);
    assert.equal(JSON.stringify(response.payload).includes("Economics"), false);
    assert.equal(JSON.stringify(response.payload).includes('"currentGrade"'), false);
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
        assert.match(response.payload.message, /Basic planner/);
      }
    }

    assert.equal(providerCalls, 3);
  });
});

test("provider failures preserve the previously confirmed allowance", async () => {
  await withAllowedOrigin(async () => {
    for (const providerStatus of [
      "provider_request_invalid",
      "provider_auth_failed",
      "provider_permission_denied",
      "rate_limited",
      "provider_unavailable",
      "provider_timeout",
      "provider_error",
      "provider_output_missing",
      "output_truncated",
      "parse_error",
    ]) {
      let providerResult = providerPlan();
      const handler = createSmartPlannerHandler({
        env: ENV,
        now: () => Date.parse("2026-07-30T10:00:00.000Z"),
        ipBuckets: new Map(),
        requestPlan: async () => providerResult,
      });

      const successfulResponse = createResponse();
      await handler(validRequest(), successfulResponse);
      const cookie = String(successfulResponse.headers.get("set-cookie")).split(";")[0];

      providerResult = {
        ok: false,
        status: providerStatus,
        message: "Use the Basic planner for now.",
      };
      const failedRequest = validRequest();
      failedRequest.headers.cookie = cookie;
      const failedResponse = createResponse();
      await handler(failedRequest, failedResponse);

      assert.equal(failedResponse.statusCode, providerStatus === "provider_timeout" ? 504 : 502);
      assert.equal(failedResponse.payload.status, providerStatus);
      assert.equal(failedResponse.payload.remainingGenerations, 2);
      assert.equal(failedResponse.headers.has("set-cookie"), false);
    }
  });
});

test("whitespace-only provider configuration fails before provider dispatch", async () => {
  await withAllowedOrigin(async () => {
    let providerCalls = 0;
    const handler = createSmartPlannerHandler({
      env: { ...ENV, ANTHROPIC_API_KEY: "   " },
      requestPlan: async () => {
        providerCalls += 1;
        return providerPlan();
      },
    });
    const response = createResponse();
    await handler(validRequest(), response);
    assert.equal(response.statusCode, 503);
    assert.equal(response.payload.status, "not_configured");
    assert.equal(response.payload.configured, false);
    assert.equal(providerCalls, 0);
    assert.equal(response.headers.has("set-cookie"), false);
  });
});

test("server-rejected model output does not consume quota", async () => {
  await withAllowedOrigin(async () => {
    const handler = createSmartPlannerHandler({
      env: ENV,
      now: () => Date.parse("2026-07-30T10:00:00.000Z"),
      ipBuckets: new Map(),
      requestPlan: async () => ({
        ok: true,
        output: { ...providerPlan().output, summary: "" },
      }),
    });
    const response = createResponse();
    await handler(validRequest(), response);

    assert.equal(response.statusCode, 502);
    assert.equal(response.payload.status, "ai_invalid");
    assert.equal(response.payload.remainingGenerations, 3);
    assert.equal(response.headers.has("set-cookie"), false);
  });
});
