import assert from "node:assert/strict";
import test from "node:test";
import {
  SMART_PLANNER_QUOTA_WINDOW_MS,
  consumeSmartPlannerQuota,
  getSmartPlannerDailyLimit,
  readSmartPlannerQuota,
} from "./_quota.js";

const NOW = Date.parse("2026-07-30T10:00:00.000Z");
const ENV = {
  NODE_ENV: "production",
  SMART_PLANNER_USAGE_SECRET: "test-only-usage-secret-with-enough-entropy",
  SMART_PLANNER_DAILY_LIMIT: "3",
};

function cookieHeader(setCookie) {
  return String(setCookie).split(";")[0];
}

test("allows the first three attempts and blocks the fourth", () => {
  let cookie = "";

  for (const expectedRemaining of [2, 1, 0]) {
    const result = consumeSmartPlannerQuota({ cookieHeader: cookie, env: ENV, now: NOW });
    assert.equal(result.allowed, true);
    assert.equal(result.remainingGenerations, expectedRemaining);
    cookie = cookieHeader(result.setCookie);
  }

  const blocked = consumeSmartPlannerQuota({ cookieHeader: cookie, env: ENV, now: NOW });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.status, "daily_limit_reached");
  assert.equal(blocked.remainingGenerations, 0);
});

test("starts a fresh quota after the rolling 24-hour window", () => {
  const first = consumeSmartPlannerQuota({ env: ENV, now: NOW });
  const reset = consumeSmartPlannerQuota({
    cookieHeader: cookieHeader(first.setCookie),
    env: ENV,
    now: NOW + SMART_PLANNER_QUOTA_WINDOW_MS + 1,
  });

  assert.equal(reset.allowed, true);
  assert.equal(reset.remainingGenerations, 2);
  assert.equal(reset.state.windowStartedAt, NOW + SMART_PLANNER_QUOTA_WINDOW_MS + 1);
});

test("rejects a tampered signature without trusting its payload", () => {
  const first = consumeSmartPlannerQuota({ env: ENV, now: NOW });
  const original = cookieHeader(first.setCookie);
  const tampered = `${original.slice(0, -1)}${original.endsWith("a") ? "b" : "a"}`;
  const result = consumeSmartPlannerQuota({ cookieHeader: tampered, env: ENV, now: NOW });

  assert.equal(result.allowed, false);
  assert.equal(result.status, "quota_cookie_invalid");
  assert.equal(result.remainingGenerations, 0);
  assert.match(result.setCookie, /HttpOnly/);
});

test("rejects a malformed quota cookie safely", () => {
  const result = consumeSmartPlannerQuota({
    cookieHeader: "student_hub_smart_planner_quota=not-a-signed-payload",
    env: ENV,
    now: NOW,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.status, "quota_cookie_invalid");
  assert.equal(result.remainingGenerations, 0);
});

test("reading quota for the Basic planner does not consume an attempt", () => {
  const before = readSmartPlannerQuota({ env: ENV, now: NOW });
  const after = readSmartPlannerQuota({ env: ENV, now: NOW });

  assert.equal(before.remainingGenerations, 3);
  assert.equal(after.remainingGenerations, 3);
});

test("fails safely when the production usage secret is missing", () => {
  const result = consumeSmartPlannerQuota({
    env: { NODE_ENV: "production" },
    now: NOW,
  });

  assert.equal(result.configured, false);
  assert.equal(result.status, "quota_not_configured");
  assert.equal(result.allowed, false);
});

test("clamps configured daily limits to one through ten", () => {
  assert.equal(getSmartPlannerDailyLimit({ SMART_PLANNER_DAILY_LIMIT: "0" }), 1);
  assert.equal(getSmartPlannerDailyLimit({ SMART_PLANNER_DAILY_LIMIT: "7" }), 7);
  assert.equal(getSmartPlannerDailyLimit({ SMART_PLANNER_DAILY_LIMIT: "99" }), 10);
  assert.equal(getSmartPlannerDailyLimit({}), 3);
});

test("production cookies use the required security attributes", () => {
  const result = consumeSmartPlannerQuota({ env: ENV, now: NOW });
  assert.match(result.setCookie, /HttpOnly/);
  assert.match(result.setCookie, /SameSite=Lax/);
  assert.match(result.setCookie, /Path=\//);
  assert.match(result.setCookie, /Secure/);
  assert.match(result.setCookie, /Max-Age=/);
});
