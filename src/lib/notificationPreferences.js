import { DEFAULT_NOTIFICATION_PREFERENCES } from "../utils/notificationSchedulingUtils.js";

const COLUMNS = "user_id,master_enabled,new_classroom_tasks_enabled,task_due_tomorrow_enabled,task_due_today_enabled,daily_planning_enabled,daily_planning_time,plan_start_enabled,plan_start_lead_minutes,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,notification_preview,timezone,created_at,updated_at";

const FIELD_MAP = {
  masterEnabled: "master_enabled",
  newClassroomTasksEnabled: "new_classroom_tasks_enabled",
  taskDueTomorrowEnabled: "task_due_tomorrow_enabled",
  taskDueTodayEnabled: "task_due_today_enabled",
  dailyPlanningEnabled: "daily_planning_enabled",
  dailyPlanningTime: "daily_planning_time",
  planStartEnabled: "plan_start_enabled",
  planStartLeadMinutes: "plan_start_lead_minutes",
  quietHoursEnabled: "quiet_hours_enabled",
  quietHoursStart: "quiet_hours_start",
  quietHoursEnd: "quiet_hours_end",
  notificationPreview: "notification_preview",
  timezone: "timezone",
};

function shortTime(value, fallback) {
  const match = String(value || "").match(/^(\d{2}:\d{2})/);
  return match?.[1] || fallback;
}

export function mapNotificationPreferences(row = {}) {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    userId: String(row.user_id || ""),
    masterEnabled: row.master_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.masterEnabled,
    newClassroomTasksEnabled: row.new_classroom_tasks_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.newClassroomTasksEnabled,
    taskDueTomorrowEnabled: row.task_due_tomorrow_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.taskDueTomorrowEnabled,
    taskDueTodayEnabled: row.task_due_today_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.taskDueTodayEnabled,
    dailyPlanningEnabled: row.daily_planning_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.dailyPlanningEnabled,
    dailyPlanningTime: shortTime(row.daily_planning_time, DEFAULT_NOTIFICATION_PREFERENCES.dailyPlanningTime),
    planStartEnabled: row.plan_start_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.planStartEnabled,
    planStartLeadMinutes: Number(row.plan_start_lead_minutes ?? DEFAULT_NOTIFICATION_PREFERENCES.planStartLeadMinutes),
    quietHoursEnabled: row.quiet_hours_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.quietHoursEnabled,
    quietHoursStart: shortTime(row.quiet_hours_start, DEFAULT_NOTIFICATION_PREFERENCES.quietHoursStart),
    quietHoursEnd: shortTime(row.quiet_hours_end, DEFAULT_NOTIFICATION_PREFERENCES.quietHoursEnd),
    notificationPreview: row.notification_preview || DEFAULT_NOTIFICATION_PREFERENCES.notificationPreview,
    timezone: row.timezone || DEFAULT_NOTIFICATION_PREFERENCES.timezone,
  };
}

export function mapNotificationPreferencesForWrite(preferences = {}) {
  return Object.fromEntries(Object.entries(FIELD_MAP)
    .filter(([key]) => Object.hasOwn(preferences, key))
    .map(([key, column]) => [column, preferences[key]]));
}

export async function fetchNotificationPreferences(client, userId) {
  const { data, error } = await client.from("notification_preferences").select(COLUMNS).eq("user_id", userId).maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return data ? mapNotificationPreferences(data) : null;
}

export async function ensureNotificationPreferences(client, userId) {
  const existing = await fetchNotificationPreferences(client, userId);
  if (existing) return existing;
  const payload = { user_id: userId, ...mapNotificationPreferencesForWrite(DEFAULT_NOTIFICATION_PREFERENCES) };
  const { data, error } = await client.from("notification_preferences").insert(payload).select(COLUMNS).single();
  if (error?.code === "23505") return fetchNotificationPreferences(client, userId);
  if (error) throw error;
  return mapNotificationPreferences(data);
}

export async function updateNotificationPreferences(client, userId, changes) {
  const { data, error } = await client.from("notification_preferences")
    .update(mapNotificationPreferencesForWrite(changes)).eq("user_id", userId).select(COLUMNS).single();
  if (error) throw error;
  return mapNotificationPreferences(data);
}

export function getBrowserTimeZone(intl = Intl) {
  const zone = intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || "";
  try { new intl.DateTimeFormat("en-US", { timeZone: zone }).format(0); return zone; } catch { return ""; }
}

export async function reconcileNotificationTimezone(client, userId, preferences, timeZone) {
  if (!timeZone || preferences?.timezone === timeZone) return preferences;
  return updateNotificationPreferences(client, userId, { timezone: timeZone });
}

export function subscribeToNotificationPreferenceChanges(client, userId, onChange) {
  const channel = client.channel(`notification-preferences:${userId}`).on("postgres_changes",
    { event: "*", schema: "public", table: "notification_preferences", filter: `user_id=eq.${userId}` }, onChange).subscribe();
  return () => client.removeChannel?.(channel) || channel?.unsubscribe?.();
}
