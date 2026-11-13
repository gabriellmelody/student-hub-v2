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
  dailyStudyBlocks: 2,
  blockDurationMinutes: 45,
  weeklyRoutine: Object.freeze({
    monday: Object.freeze([]),
    tuesday: Object.freeze([]),
    wednesday: Object.freeze([]),
    thursday: Object.freeze([]),
    friday: Object.freeze([]),
    saturday: Object.freeze([]),
    sunday: Object.freeze([]),
  }),
  recommendationOverrides: Object.freeze([]),
});

const STUDY_WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
const PLAN_BLOCK_DURATION_OPTIONS = new Set([15, 20, 25, 30, 45, 60, 75, 90]);

function normalizeWeeklyRoutine(value) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(
    STUDY_WEEKDAY_KEYS.map((weekday) => [
      weekday,
      Array.from(
        new Set(
          (Array.isArray(source[weekday]) ? source[weekday] : [])
            .map((subjectId) => String(subjectId || "").trim())
            .filter(Boolean)
        )
      ).slice(0, 6),
    ])
  );
}

function cleanPreferenceString(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeRecommendationOverrides(value) {
  if (!Array.isArray(value)) return [];
  const bySlot = new Map();
  value.slice(-64).forEach((override) => {
    const recommendation = override?.recommendation;
    const dateKey = cleanPreferenceString(override?.dateKey, 10);
    const slotIndex = Math.max(0, Math.min(12, Math.trunc(Number(override?.slotIndex))));
    const kind = cleanPreferenceString(recommendation?.kind, 30);
    const title = cleanPreferenceString(recommendation?.title, 180);
    const subject = cleanPreferenceString(recommendation?.subject, 120);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !kind || !title || !subject) return;
    const normalized = {
      dateKey,
      slotIndex,
      locked: Boolean(override?.locked),
      manual: Boolean(override?.manual),
      removed: Boolean(override?.removed),
      added: Boolean(override?.added),
      originDateKey: /^\d{4}-\d{2}-\d{2}$/.test(String(override?.originDateKey || ""))
        ? String(override.originDateKey)
        : "",
      originSlotIndex: override?.originSlotIndex !== null && override?.originSlotIndex !== undefined && Number.isFinite(Number(override.originSlotIndex))
        ? Math.max(0, Math.min(12, Math.trunc(Number(override.originSlotIndex))))
        : null,
      durationMinutes: PLAN_BLOCK_DURATION_OPTIONS.has(Number(override?.durationMinutes))
        ? Number(override.durationMinutes)
        : null,
      recommendation: {
        id: cleanPreferenceString(recommendation?.id, 180),
        kind,
        taskId: recommendation?.taskId ? cleanPreferenceString(recommendation.taskId, 80) : null,
        subjectId: recommendation?.subjectId ? cleanPreferenceString(recommendation.subjectId, 80) : null,
        title,
        subject,
        reason: cleanPreferenceString(recommendation?.reason || "Manual choice", 180),
        description: cleanPreferenceString(recommendation?.description, 4000),
        dueDate: cleanPreferenceString(recommendation?.dueDate, 10),
        assessmentLabel: cleanPreferenceString(recommendation?.assessmentLabel, 40),
        score: Number(recommendation?.score) || 0,
        required: Boolean(recommendation?.required),
        effort: Number(recommendation?.effort) || null,
        importance: cleanPreferenceString(recommendation?.importance || "normal", 20),
        source: cleanPreferenceString(recommendation?.source || "manual", 30),
      },
    };
    bySlot.set(`${dateKey}:${slotIndex}`, normalized);
  });
  return Array.from(bySlot.values());
}

export function getLocalPlanDate(date = new Date()) {
  return formatDateKey(date);
}

export function normalizePlanningPreferences(value = {}) {
  const onboarding = normalizeOnboardingPlanningPreferences(value);
  const hours = Number(value.hoursAvailable);
  const dailyStudyBlocks = Math.min(
    6,
    Math.max(1, Math.round(Number(value.dailyStudyBlocks) || 2))
  );
  const requestedBlockDuration = Number(value.blockDurationMinutes);
  const blockDurationMinutes = [20, 25, 30, 45, 60, 90].includes(
    requestedBlockDuration
  )
    ? requestedBlockDuration
    : 45;
  return {
    ...onboarding,
    hoursAvailable: Number.isFinite(hours) && hours > 0 ? hours : 2,
    dailyStudyBlocks,
    blockDurationMinutes,
    weeklyRoutine: normalizeWeeklyRoutine(value.weeklyRoutine),
    recommendationOverrides: normalizeRecommendationOverrides(value.recommendationOverrides),
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
