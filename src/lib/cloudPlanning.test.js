import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  DEFAULT_PLANNING_PREFERENCES,
  deleteDailyPlan,
  ensurePlanningPreferences,
  fetchDailyPlan,
  getLocalPlanDate,
  getPlanningWorkspaceForUser,
  mapCloudDailyPlan,
  mapCloudPlanningPreferences,
  mapDailyPlanForUpsert,
  mapPlanningPreferencesForUpsert,
  saveDailyPlan,
  subscribeToDailyPlanChanges,
  subscribeToPlanningPreferenceChanges,
} from "./cloudPlanning.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-9222-222222222222";
const TASK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DATE = "2026-08-18";
const PLAN = {
  generatedDate: DATE,
  savedAt: "2026-08-18T09:00:00.000Z",
  startTime: "16:30",
  hoursAvailable: 2,
  metadata: { source: "smart" },
  blocks: [{ id: "study-1", type: "study", taskId: TASK_ID, completed: false }],
};

function clientWith(results = []) {
  const calls = [];
  return {
    calls,
    from(table) {
      const state = { table, filters: [], action: "select" };
      const builder = {
        select(columns) { state.columns = columns; return builder; },
        eq(column, value) { state.filters.push([column, value]); return builder; },
        upsert(payload, options) { state.action = "upsert"; state.payload = payload; state.options = options; return builder; },
        delete() { state.action = "delete"; return builder; },
        maybeSingle() { calls.push({ ...state }); return Promise.resolve(results.shift() || { data: null, error: null }); },
        single() { calls.push({ ...state }); return Promise.resolve(results.shift() || { data: null, error: null }); },
        then(resolve) { calls.push({ ...state }); return Promise.resolve(results.shift() || { data: null, error: null }).then(resolve); },
      };
      return builder;
    },
  };
}

test("planning preferences map between DB JSONB and the DayLo shape", () => {
  const row = { user_id: USER_ID, preferences: { startTime: "17:00", endTime: "21:00", planStyle: "lighter", hoursAvailable: 3 } };
  assert.deepEqual(mapCloudPlanningPreferences(row), { userId: USER_ID, ...row.preferences });
  assert.deepEqual(mapPlanningPreferencesForUpsert(row.preferences, USER_ID), { user_id: USER_ID, preferences: row.preferences });
});

test("missing planning preferences use current defaults without reading localStorage", async () => {
  globalThis.localStorage = { getItem() { throw new Error("must not import local preferences"); } };
  const row = { user_id: USER_ID, preferences: DEFAULT_PLANNING_PREFERENCES };
  const client = clientWith([{ data: null, error: null }, { data: row, error: null }]);
  const result = await ensurePlanningPreferences(client, USER_ID);
  assert.deepEqual(result, { userId: USER_ID, ...DEFAULT_PLANNING_PREFERENCES });
  assert.equal(client.calls[1].options.onConflict, "user_id");
  delete globalThis.localStorage;
});

test("Today’s Plan maps to one user/date JSONB row and preserves UUID task IDs", () => {
  const payload = mapDailyPlanForUpsert(PLAN, USER_ID, DATE);
  assert.equal(payload.user_id, USER_ID);
  assert.equal(payload.plan_date, DATE);
  assert.equal(payload.plan_data.blocks[0].taskId, TASK_ID);
  assert.deepEqual(mapCloudDailyPlan({ user_id: USER_ID, plan_date: DATE, plan_data: payload.plan_data }), PLAN);
});

test("same-day repeated saves use the same conflict identity instead of duplicate rows", async () => {
  const row = { id: "plan-id", user_id: USER_ID, plan_date: DATE, plan_data: PLAN };
  const client = clientWith([{ data: row, error: null }, { data: row, error: null }]);
  await saveDailyPlan(client, USER_ID, PLAN, DATE);
  await saveDailyPlan(client, USER_ID, PLAN, DATE);
  assert.equal(client.calls.length, 2);
  assert.ok(client.calls.every((call) => call.options.onConflict === "user_id,plan_date"));
  assert.ok(client.calls.every((call) => call.payload.user_id === USER_ID && call.payload.plan_date === DATE));
});

test("daily plan loading is restricted to today and never returns yesterday", async () => {
  const client = clientWith([{ data: null, error: null }]);
  assert.equal(await fetchDailyPlan(client, USER_ID, DATE), null);
  assert.deepEqual(client.calls[0].filters, [["user_id", USER_ID], ["plan_date", DATE]]);
});

test("local date keys do not shift through UTC", () => {
  assert.equal(getLocalPlanDate(new Date(2026, 7, 18, 0, 5)), "2026-08-18");
});

test("clearing a plan deletes only the authenticated user’s current date", async () => {
  const client = clientWith([{ data: null, error: null }]);
  assert.equal(await deleteDailyPlan(client, USER_ID, DATE), true);
  assert.deepEqual(client.calls[0].filters, [["user_id", USER_ID], ["plan_date", DATE]]);
});

test("account-scoped workspace prevents User B from seeing User A planning data", () => {
  const workspace = { userId: USER_ID, preferences: {}, plan: PLAN };
  assert.equal(getPlanningWorkspaceForUser(workspace, OTHER_USER_ID), null);
  assert.equal(getPlanningWorkspaceForUser(workspace, ""), null);
});

function assertRealtimeSubscription(subscribe, table) {
  let config;
  let refreshed = false;
  const channel = { on(_event, nextConfig, handler) { config = nextConfig; handler(); return channel; }, subscribe() { return channel; } };
  let removed = null;
  const client = { channel(name) { assert.equal(name, `${table}:${USER_ID}`); return channel; }, removeChannel(value) { removed = value; } };
  const unsubscribe = subscribe(client, USER_ID, () => { refreshed = true; });
  assert.deepEqual(config, { event: "*", schema: "public", table, filter: `user_id=eq.${USER_ID}` });
  assert.equal(refreshed, true);
  unsubscribe();
  assert.equal(removed, channel);
}

test("Realtime plan events trigger a user-filtered refresh", () => assertRealtimeSubscription(subscribeToDailyPlanChanges, "daily_plans"));
test("Realtime preference events trigger a user-filtered refresh", () => assertRealtimeSubscription(subscribeToPlanningPreferenceChanges, "planning_preferences"));

test("failed cloud saves reject instead of reporting success", async () => {
  const failure = new Error("offline");
  const client = clientWith([{ data: null, error: failure }]);
  await assert.rejects(saveDailyPlan(client, USER_ID, PLAN, DATE), failure);
});

test("App cloud-persists Smart/Basic results, edits, completion cleanup and clear", () => {
  const source = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(source, /setPlanBlocks\(smartPlannerPreview\.blocks\)/);
  assert.match(source, /source: smartPlannerPreview\.source/);
  assert.match(source, /persistCloudPlan\(/);
  assert.match(source, /updatePlanBlockDuration/);
  assert.match(source, /togglePlanBlockLocked/);
  assert.match(source, /currentBlocks\.filter\(\(block\) => block\.taskId !== taskId\)/);
  assert.match(source, /void clearCloudPlan\(\)/);
});

test("legacy Today’s Plan and planning preferences are no longer authoritative", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  const onboarding = readFileSync(new URL("../pages/Onboarding.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(app, /loadSavedPlanSnapshot|saveTodayPlanSnapshot|student-hub-hours|student-hub-start-time/);
  assert.doesNotMatch(onboarding, /loadOnboardingPlanningPreferences|saveOnboardingPlanningPreferences/);
});

test("the hook clears prior account state and supplies loading/realtime fallbacks", () => {
  const source = readFileSync(new URL("../hooks/useCloudPlanning.js", import.meta.url), "utf8");
  assert.match(source, /setWorkspace\(\{ userId: "", preferences: null, plan: null \}\)/);
  assert.match(source, /subscribeToDailyPlanChanges/);
  assert.match(source, /subscribeToPlanningPreferenceChanges/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /return null;/);
});
