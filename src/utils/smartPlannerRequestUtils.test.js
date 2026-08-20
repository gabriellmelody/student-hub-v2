import assert from "node:assert/strict";
import test from "node:test";
import { getSmartPlannerFallback, startRequestDeadline } from "./smartPlannerRequestUtils.js";

test("request deadline aborts exactly once and reports a timeout", () => {
  let scheduled;
  let aborts = 0;
  let cancelled = 0;
  const deadline = startRequestDeadline(
    { abort: () => aborts++ },
    30,
    (callback, delay) => { scheduled = { callback, delay }; return 7; },
    (timer) => { assert.equal(timer, 7); cancelled++; }
  );
  assert.equal(scheduled.delay, 30);
  assert.equal(deadline.didTimeOut(), false);
  scheduled.callback();
  assert.equal(deadline.didTimeOut(), true);
  assert.equal(aborts, 1);
  deadline.cancel();
  assert.equal(cancelled, 1);
});

test("fallback metadata distinguishes timeout without changing Basic identity", () => {
  assert.deepEqual(getSmartPlannerFallback("timeout"), {
    reason: "timeout",
    title: "Smart Planner timed out",
    message: "We made you a Basic plan instead.",
  });
  assert.equal(getSmartPlannerFallback("provider_unavailable").title, "Smart Planner was unavailable");
  assert.equal(getSmartPlannerFallback("provider_timeout").title, "Smart Planner timed out");
});
