import {
  NOTIFICATION_TYPES,
  addLocalDays,
  dailyPlanningOccurrenceKey,
  getQuietHoursDecision,
  getZonedDateTimeParts,
  planStartOccurrenceKey,
  taskDueOccurrenceKey,
} from "../../src/utils/notificationSchedulingUtils.js";

export const DELIVERY_WINDOW_MINUTES = 5;
export const MAX_DELIVERY_ATTEMPTS = 3;
export const ALLOWED_PUSH_PATHS = new Set(["/tasks", "/plan"]);

function clean(value) { return typeof value === "string" ? value.trim() : ""; }
function shortTime(value, fallback) { return clean(value).match(/^(\d{2}:\d{2})/)?.[1] || fallback; }
function minutes(value) { const match = clean(value).match(/^(\d{2}):(\d{2})$/); return match ? Number(match[1]) * 60 + Number(match[2]) : null; }

export function isLocalDeliveryWindow(localTime, targetTime, windowMinutes = DELIVERY_WINDOW_MINUTES) {
  const current = minutes(localTime); const target = minutes(targetTime);
  return current != null && target != null && current >= target && current < target + windowMinutes;
}

function preference(row) {
  return {
    userId: clean(row.user_id), masterEnabled: row.master_enabled === true,
    dueTomorrow: row.task_due_tomorrow_enabled === true, dueToday: row.task_due_today_enabled === true,
    dailyPlanning: row.daily_planning_enabled === true, planningTime: shortTime(row.daily_planning_time, "17:00"),
    planStart: row.plan_start_enabled === true, lead: Math.max(0, Math.min(120, Number(row.plan_start_lead_minutes) || 15)),
    quietEnabled: row.quiet_hours_enabled === true, quietStart: shortTime(row.quiet_hours_start, "22:00"),
    quietEnd: shortTime(row.quiet_hours_end, "07:00"), preview: row.notification_preview === "full" ? "full" : "private",
    timeZone: clean(row.timezone) || "UTC",
  };
}

function quietDecision(pref, now, usefulUntilDate, usefulUntilTime = "23:59") {
  return getQuietHoursDecision({ now, timeZone: pref.timeZone, enabled: pref.quietEnabled,
    start: pref.quietStart, end: pref.quietEnd, usefulUntilDate, usefulUntilTime });
}

function dueNow(pref, now, targetTime, usefulUntilDate, usefulUntilTime = "23:59", retry = false) {
  const local = getZonedDateTimeParts(now, pref.timeZone); if (!local) return false;
  const quiet = quietDecision(pref, now, usefulUntilDate, usefulUntilTime);
  if (quiet.action === "drop" || quiet.action === "defer") return false;
  if (retry) {
    const reachedTarget = local.date < usefulUntilDate || minutes(local.time) >= minutes(targetTime);
    const stillUseful = local.date < usefulUntilDate || (local.date === usefulUntilDate && minutes(local.time) < minutes(usefulUntilTime));
    return reachedTarget && stillUseful;
  }
  if (isLocalDeliveryWindow(local.time, targetTime)) return true;
  return pref.quietEnabled && isLocalDeliveryWindow(local.time, pref.quietEnd) && minutes(targetTime) < minutes(pref.quietEnd);
}

function taskPayload(task, kind, preview) {
  const dueLabel = kind === "due-tomorrow" ? "due tomorrow" : "due today";
  const detail = [clean(task.subject_name), clean(task.title)].filter(Boolean).join(" · ");
  return {
    title: preview === "full" && detail ? `${detail} ${dueLabel}` : `Task ${dueLabel}`,
    body: kind === "due-tomorrow" ? "Open DayLo to see your plan." : "Check what still needs to be done.",
    url: "/tasks",
  };
}

export function resolveDeliveryCandidates({ preferences = [], tasks = [], plans = [], retryOccurrenceKeys = [], now = new Date() } = {}) {
  const retries = new Set(retryOccurrenceKeys);
  const tasksByUser = new Map();
  tasks.forEach((task) => {
    const userId = clean(task.user_id);
    tasksByUser.set(userId, [...(tasksByUser.get(userId) || []), task]);
  });
  const plansByUser = new Map(plans.map((plan) => [clean(plan.user_id), plan]));
  const candidates = [];
  for (const row of preferences) {
    const pref = preference(row); if (!pref.userId || !pref.masterEnabled) continue;
    const local = getZonedDateTimeParts(now, pref.timeZone); if (!local) continue;
    for (const task of tasksByUser.get(pref.userId) || []) {
      if (!task.id || task.completed === true || task.archived === true || task.hidden === true || !task.due_date) continue;
      const kind = task.due_date === local.date ? "due-today" : task.due_date === addLocalDays(local.date, 1) ? "due-tomorrow" : "";
      if (!kind || (kind === "due-today" ? !pref.dueToday : !pref.dueTomorrow)) continue;
      const targetTime = kind === "due-today" ? pref.quietEnd : pref.planningTime;
      const occurrenceKey = taskDueOccurrenceKey(task.id, kind, task.due_date);
      if (!dueNow(pref, now, targetTime, task.due_date, "23:59", retries.has(occurrenceKey))) continue;
      candidates.push({ userId: pref.userId, taskId: task.id, entityId: task.id,
        type: kind === "due-today" ? NOTIFICATION_TYPES.TASK_DUE_TODAY : NOTIFICATION_TYPES.TASK_DUE_TOMORROW,
        occurrenceKey, payload: taskPayload(task, kind, pref.preview) });
    }
    const planningKey = dailyPlanningOccurrenceKey(local.date);
    if (pref.dailyPlanning && dueNow(pref, now, pref.planningTime, local.date, "23:59", retries.has(planningKey))) {
      candidates.push({ userId: pref.userId, entityId: null, type: NOTIFICATION_TYPES.DAILY_PLANNING,
        occurrenceKey: planningKey, payload: { title: "Plan your evening", body: "See what's due and build tonight's plan.", url: "/plan" } });
    }
    const plan = plansByUser.get(pref.userId); const startTime = shortTime(plan?.plan_data?.startTime, "");
    if (pref.planStart && plan?.id && plan.plan_date === local.date && startTime && Array.isArray(plan.plan_data?.blocks) && plan.plan_data.blocks.length) {
      const targetMinutes = minutes(startTime) - pref.lead;
      const targetTime = targetMinutes >= 0 ? `${String(Math.floor(targetMinutes / 60)).padStart(2, "0")}:${String(targetMinutes % 60).padStart(2, "0")}` : "";
      const occurrenceKey = planStartOccurrenceKey(plan.id, local.date, startTime);
      if (targetTime && dueNow(pref, now, targetTime, local.date, startTime, retries.has(occurrenceKey))) candidates.push({ userId: pref.userId, entityId: plan.id,
        type: NOTIFICATION_TYPES.PLAN_START, occurrenceKey,
        payload: { title: `Your plan starts in ${pref.lead} minutes`, body: "Open DayLo when you're ready to begin.", url: "/plan" } });
    }
  }
  return candidates;
}

export function normalizeDeliveryPayload(candidate) {
  const url = ALLOWED_PUSH_PATHS.has(candidate?.payload?.url) ? candidate.payload.url : "/";
  return { title: clean(candidate?.payload?.title).slice(0, 120) || "DayLo reminder",
    body: clean(candidate?.payload?.body).slice(0, 240) || "You have a DayLo reminder.", url,
    tag: clean(candidate?.occurrenceKey).slice(0, 160), occurrenceKey: clean(candidate?.occurrenceKey).slice(0, 500) };
}
