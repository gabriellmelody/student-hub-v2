import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDeliveryPayload, resolveDeliveryCandidates } from "./delivery-utils.js";

const basePreference = (overrides = {}) => ({ user_id: "user-a", master_enabled: true,
  task_due_tomorrow_enabled: true, task_due_today_enabled: true, daily_planning_enabled: true,
  daily_planning_time: "17:00:00", plan_start_enabled: true, plan_start_lead_minutes: 15,
  quiet_hours_enabled: true, quiet_hours_start: "22:00:00", quiet_hours_end: "07:00:00",
  notification_preview: "private", timezone: "UTC", ...overrides });
const task = (overrides = {}) => ({ id: "task-a", user_id: "user-a", title: "CFA", subject_name: "Maths",
  due_date: "2026-08-25", completed: false, archived: false, ...overrides });

test("due-tomorrow and planning occurrences use the local planning window", () => {
  const candidates = resolveDeliveryCandidates({ preferences: [basePreference()], tasks: [task()], now: new Date("2026-08-24T17:02:00Z") });
  assert.deepEqual(candidates.map((item) => item.type).sort(), ["daily_planning", "task_due_tomorrow"]);
});

test("due-today runs after quiet hours and skips completed tasks", () => {
  const now = new Date("2026-08-25T07:02:00Z");
  assert.equal(resolveDeliveryCandidates({ preferences: [basePreference()], tasks: [task()], now }).some((item) => item.type === "task_due_today"), true);
  assert.equal(resolveDeliveryCandidates({ preferences: [basePreference()], tasks: [task({ completed: true })], now }).some((item) => item.type === "task_due_today"), false);
});

test("master and category switches stop current candidates", () => {
  const now = new Date("2026-08-24T17:02:00Z");
  assert.deepEqual(resolveDeliveryCandidates({ preferences: [basePreference({ master_enabled: false })], tasks: [task()], now }), []);
  assert.equal(resolveDeliveryCandidates({ preferences: [basePreference({ task_due_tomorrow_enabled: false })], tasks: [task()], now }).some((item) => item.type === "task_due_tomorrow"), false);
});

test("changed due date invalidates the old occurrence", () => {
  const candidates = resolveDeliveryCandidates({ preferences: [basePreference()], tasks: [task({ due_date: "2026-08-28" })], now: new Date("2026-08-24T17:02:00Z"), retryOccurrenceKeys: ["task:task-a:due-tomorrow:2026-08-25"] });
  assert.equal(candidates.some((item) => item.occurrenceKey.includes("task-a")), false);
});

test("plan-start uses current plan time and lead minutes", () => {
  const plans = [{ id: "plan-a", user_id: "user-a", plan_date: "2026-08-24", plan_data: { startTime: "18:00", blocks: [{ id: "one" }] } }];
  const candidates = resolveDeliveryCandidates({ preferences: [basePreference()], plans, now: new Date("2026-08-24T17:47:00Z") });
  assert.equal(candidates.find((item) => item.type === "plan_start")?.occurrenceKey, "plan-start:plan-a:2026-08-24:18:00");
});

test("quiet hours defer useful retries and drop obsolete plan reminders", () => {
  const pref = basePreference({ daily_planning_time: "23:00:00" });
  assert.equal(resolveDeliveryCandidates({ preferences: [pref], now: new Date("2026-08-24T23:02:00Z") }).some((item) => item.type === "daily_planning"), false);
  const plans = [{ id: "plan-a", user_id: "user-a", plan_date: "2026-08-24", plan_data: { startTime: "22:30", blocks: [{}] } }];
  assert.equal(resolveDeliveryCandidates({ preferences: [basePreference()], plans, now: new Date("2026-08-24T22:20:00Z") }).some((item) => item.type === "plan_start"), false);
});

test("Bangkok and London DST use stored IANA wall-clock time", () => {
  assert.equal(resolveDeliveryCandidates({ preferences: [basePreference({ timezone: "Asia/Bangkok" })], now: new Date("2026-08-24T10:02:00Z") }).some((item) => item.type === "daily_planning"), true);
  assert.equal(resolveDeliveryCandidates({ preferences: [basePreference({ timezone: "Europe/London" })], now: new Date("2026-03-29T16:02:00Z") }).some((item) => item.type === "daily_planning"), true);
});

test("push payload routes are allowlisted and contain no subscription material", () => {
  const payload = normalizeDeliveryPayload({ occurrenceKey: "key", payload: { title: "Title", body: "Body", url: "https://evil.example" }, endpoint: "secret", p256dh: "secret" });
  assert.deepEqual(payload, { title: "Title", body: "Body", url: "/", tag: "key", occurrenceKey: "key" });
  assert.doesNotMatch(JSON.stringify(payload), /endpoint|p256dh|auth/);
});
