export const NOTIFICATION_TYPES = Object.freeze({
  CLASSROOM_NEW_TASK: "classroom_new_task",
  TASK_DUE_TOMORROW: "task_due_tomorrow",
  TASK_DUE_TODAY: "task_due_today",
  DAILY_PLANNING: "daily_planning",
  PLAN_START: "plan_start",
});

export const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({
  masterEnabled: false,
  newClassroomTasksEnabled: true,
  taskDueTomorrowEnabled: true,
  taskDueTodayEnabled: true,
  dailyPlanningEnabled: true,
  dailyPlanningTime: "17:00",
  planStartEnabled: true,
  planStartLeadMinutes: 15,
  quietHoursEnabled: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  notificationPreview: "private",
  timeZone: "UTC",
});

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function keyPart(value) {
  return encodeURIComponent(clean(value));
}

export function normalizeIanaTimeZone(timeZone) {
  const candidate = clean(timeZone) || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(0);
    return candidate;
  } catch {
    return "UTC";
  }
}

export function getZonedDateTimeParts(instant = new Date(), timeZone = "UTC") {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (!Number.isFinite(date.getTime())) return null;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeIanaTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

export function addLocalDays(dateKey, amount) {
  if (!DATE_PATTERN.test(clean(dateKey)) || !Number.isInteger(amount)) return "";
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

function localOrdinal(dateKey, time = "00:00") {
  if (!DATE_PATTERN.test(clean(dateKey)) || !TIME_PATTERN.test(clean(time))) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 60000) + hour * 60 + minute;
}

function taskCanNotify(task) {
  return Boolean(
    clean(task?.id) &&
      DATE_PATTERN.test(clean(task?.dueDate)) &&
      task?.completed !== true &&
      task?.archived !== true &&
      task?.hidden !== true
  );
}

export function isTaskDueTodayEligible(task, { now = new Date(), timeZone = "UTC" } = {}) {
  const local = getZonedDateTimeParts(now, timeZone);
  return Boolean(taskCanNotify(task) && local && clean(task.dueDate) === local.date);
}

export function isTaskDueTomorrowEligible(task, { now = new Date(), timeZone = "UTC" } = {}) {
  const local = getZonedDateTimeParts(now, timeZone);
  return Boolean(
    taskCanNotify(task) && local && clean(task.dueDate) === addLocalDays(local.date, 1)
  );
}

export function classroomNewOccurrenceKey(externalId) {
  return clean(externalId) ? `classroom:new:${keyPart(externalId)}` : "";
}

export function taskDueOccurrenceKey(taskId, kind, localDueDate) {
  if (!clean(taskId) || !DATE_PATTERN.test(clean(localDueDate))) return "";
  if (!["due-tomorrow", "due-today"].includes(kind)) return "";
  return `task:${keyPart(taskId)}:${kind}:${localDueDate}`;
}

export function dailyPlanningOccurrenceKey(localDate) {
  return DATE_PATTERN.test(clean(localDate)) ? `daily-planning:${localDate}` : "";
}

export function planStartOccurrenceKey(planId, localDate, startTime) {
  return clean(planId) && DATE_PATTERN.test(clean(localDate)) && TIME_PATTERN.test(clean(startTime))
    ? `plan-start:${keyPart(planId)}:${localDate}:${startTime}`
    : "";
}

export function isClassroomNewAssignmentEligible({
  externalId,
  baselineCompletedAt,
  alreadySeen = false,
  creationTime = "",
} = {}) {
  if (!clean(externalId) || !clean(baselineCompletedAt) || alreadySeen) return false;
  const baselineTime = Date.parse(baselineCompletedAt);
  const createdTime = Date.parse(creationTime);
  if (Number.isFinite(baselineTime) && Number.isFinite(createdTime)) {
    return createdTime > baselineTime;
  }
  return true;
}

export function isDailyPlanningOccurrenceDue({
  now = new Date(),
  timeZone = "UTC",
  reminderTime = "17:00",
  enabled = true,
} = {}) {
  if (!enabled || !TIME_PATTERN.test(clean(reminderTime))) return false;
  const local = getZonedDateTimeParts(now, timeZone);
  return Boolean(local && local.time >= reminderTime);
}

export function isPlanStartOccurrenceDue({
  now = new Date(),
  timeZone = "UTC",
  planDate,
  startTime,
  leadMinutes = 15,
  enabled = true,
} = {}) {
  if (!enabled || !DATE_PATTERN.test(clean(planDate)) || !TIME_PATTERN.test(clean(startTime))) {
    return false;
  }
  const local = getZonedDateTimeParts(now, timeZone);
  const nowOrdinal = local ? localOrdinal(local.date, local.time) : null;
  const startOrdinal = localOrdinal(planDate, startTime);
  const lead = Number.isFinite(Number(leadMinutes))
    ? Math.min(120, Math.max(0, Number(leadMinutes)))
    : 15;
  return Boolean(
    nowOrdinal != null &&
      startOrdinal != null &&
      nowOrdinal >= startOrdinal - lead &&
      nowOrdinal < startOrdinal
  );
}

export function getQuietHoursDecision({
  now = new Date(),
  timeZone = "UTC",
  enabled = true,
  start = "22:00",
  end = "07:00",
  usefulUntilDate,
  usefulUntilTime = "23:59",
} = {}) {
  const local = getZonedDateTimeParts(now, timeZone);
  if (!enabled || !local || !TIME_PATTERN.test(start) || !TIME_PATTERN.test(end) || start === end) {
    return { action: "deliver", resumeDate: null, resumeTime: null };
  }
  const overnight = start > end;
  const quiet = overnight
    ? local.time >= start || local.time < end
    : local.time >= start && local.time < end;
  if (!quiet) return { action: "deliver", resumeDate: null, resumeTime: null };

  const resumeDate = overnight && local.time >= start ? addLocalDays(local.date, 1) : local.date;
  const usefulOrdinal = localOrdinal(usefulUntilDate, usefulUntilTime);
  const resumeOrdinal = localOrdinal(resumeDate, end);
  return {
    action:
      usefulOrdinal != null && resumeOrdinal != null && resumeOrdinal > usefulOrdinal
        ? "drop"
        : "defer",
    resumeDate,
    resumeTime: end,
  };
}

export function applyNotificationPrecedence(candidates = [], deliveredOccurrenceKeys = []) {
  const delivered = new Set(deliveredOccurrenceKeys);
  const unseen = candidates.filter(
    (candidate) => clean(candidate?.occurrenceKey) && !delivered.has(candidate.occurrenceKey)
  );
  const classroomNewTaskIds = new Set(
    unseen
      .filter((candidate) => candidate.type === NOTIFICATION_TYPES.CLASSROOM_NEW_TASK)
      .map((candidate) => clean(candidate.taskId))
      .filter(Boolean)
  );
  deliveredOccurrenceKeys.forEach((key) => {
    const matching = candidates.find(
      (candidate) =>
        candidate.type === NOTIFICATION_TYPES.CLASSROOM_NEW_TASK &&
        candidate.occurrenceKey === key
    );
    if (matching?.taskId) classroomNewTaskIds.add(clean(matching.taskId));
  });

  return unseen.filter(
    (candidate) => {
      const suppressedByDeliveredOccurrence = Array.isArray(
        candidate.suppressedByOccurrenceKeys
      )
        ? candidate.suppressedByOccurrenceKeys.some((key) => delivered.has(key))
        : false;
      return !(
        suppressedByDeliveredOccurrence ||
        (
        candidate.type === NOTIFICATION_TYPES.TASK_DUE_TOMORROW &&
        classroomNewTaskIds.has(clean(candidate.taskId))
        )
      );
    }
  );
}
