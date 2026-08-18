import { formatDateKey } from "../utils/appUtils.js";
import {
  DEFAULT_ONBOARDING_PLANNING_PREFERENCES,
  normalizeOnboardingPlanningPreferences,
} from "../utils/onboardingUtils.js";

const PREFERENCE_COLUMNS = "user_id, preferences, created_at, updated_at";
const PLAN_COLUMNS = "id, user_id, plan_date, plan_data, created_at, updated_at";

export const DEFAULT_PLANNING_PREFERENCES = Object.freeze({
  ...DEFAULT_ONBOARDING_PLANNING_PREFERENCES,
  hoursAvailable: 2,
});

export function getLocalPlanDate(date = new Date()) {
  return formatDateKey(date);
}

export function normalizePlanningPreferences(value = {}) {
  const onboarding = normalizeOnboardingPlanningPreferences(value);
  const hours = Number(value.hoursAvailable);
  return {
    ...onboarding,
    hoursAvailable: Number.isFinite(hours) && hours > 0 ? hours : 2,
  };
}

export function mapCloudPlanningPreferences(row = {}) {
  return {
    userId: String(row.user_id || ""),
    ...normalizePlanningPreferences(row.preferences),
  };
}

export function mapPlanningPreferencesForUpsert(preferences, userId) {
  return {
    user_id: userId,
    preferences: normalizePlanningPreferences(preferences),
  };
}

export function mapCloudDailyPlan(row = {}) {
  if (!row.plan_data || typeof row.plan_data !== "object") return null;
  return {
    ...row.plan_data,
    generatedDate: row.plan_date,
  };
}

export function mapDailyPlanForUpsert(plan, userId, planDate = getLocalPlanDate()) {
  return {
    user_id: userId,
    plan_date: planDate,
    plan_data: { ...plan, generatedDate: planDate },
  };
}

export async function fetchPlanningPreferences(client, userId) {
  const { data, error } = await client.from("planning_preferences")
    .select(PREFERENCE_COLUMNS).eq("user_id", userId).maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return data ? mapCloudPlanningPreferences(data) : null;
}

export async function ensurePlanningPreferences(client, userId) {
  const existing = await fetchPlanningPreferences(client, userId);
  if (existing) return existing;
  const payload = mapPlanningPreferencesForUpsert(DEFAULT_PLANNING_PREFERENCES, userId);
  const { data, error } = await client.from("planning_preferences")
    .upsert(payload, { onConflict: "user_id" }).select(PREFERENCE_COLUMNS).single();
  if (error) throw error;
  return mapCloudPlanningPreferences(data);
}

export async function savePlanningPreferences(client, userId, preferences) {
  const payload = mapPlanningPreferencesForUpsert(preferences, userId);
  const { data, error } = await client.from("planning_preferences")
    .upsert(payload, { onConflict: "user_id" }).select(PREFERENCE_COLUMNS).single();
  if (error) throw error;
  return mapCloudPlanningPreferences(data);
}

export async function fetchDailyPlan(client, userId, planDate = getLocalPlanDate()) {
  const { data, error } = await client.from("daily_plans").select(PLAN_COLUMNS)
    .eq("user_id", userId).eq("plan_date", planDate).maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return data ? mapCloudDailyPlan(data) : null;
}

export async function saveDailyPlan(client, userId, plan, planDate = getLocalPlanDate()) {
  const payload = mapDailyPlanForUpsert(plan, userId, planDate);
  const { data, error } = await client.from("daily_plans")
    .upsert(payload, { onConflict: "user_id,plan_date" }).select(PLAN_COLUMNS).single();
  if (error) throw error;
  return mapCloudDailyPlan(data);
}

export async function deleteDailyPlan(client, userId, planDate = getLocalPlanDate()) {
  const { error } = await client.from("daily_plans").delete()
    .eq("user_id", userId).eq("plan_date", planDate);
  if (error) throw error;
  return true;
}

function subscribe(client, table, userId, onChange) {
  if (!userId || typeof client?.channel !== "function") return () => {};
  const channel = client.channel(`${table}:${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` }, onChange)
    .subscribe();
  return () => client.removeChannel?.(channel) || channel?.unsubscribe?.();
}

export const subscribeToPlanningPreferenceChanges = (client, userId, onChange) =>
  subscribe(client, "planning_preferences", userId, onChange);
export const subscribeToDailyPlanChanges = (client, userId, onChange) =>
  subscribe(client, "daily_plans", userId, onChange);

export function getPlanningWorkspaceForUser(workspace, userId) {
  return workspace?.userId === userId ? workspace : null;
}
