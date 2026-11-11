export const DAYLO_TASKS_CALENDAR_NAME = "DayLo Tasks";
export const DAYLO_TASKS_CALENDAR_MARKER =
  "Managed by DayLo for scheduled task study sessions.";
export const SCHEDULE_DURATION_OPTIONS = Object.freeze([15, 30, 45, 60, 90, 120]);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function isValidTaskId(value) {
  return UUID_PATTERN.test(clean(value));
}

export function isTaskEligibleForGoogleScheduling(task) {
  return Boolean(
    task &&
    clean(task.source || "manual") === "manual" &&
    clean(task.due_date || task.dueDate) &&
    !task.completed &&
    !task.archived
  );
}

export function normalizeScheduleInput(input = {}) {
  const date = clean(input.date || input.scheduledDate);
  const startTime = clean(input.startTime || input.scheduledStartTime);
  const durationMinutes = Number(input.durationMinutes || input.scheduledDurationMinutes);
  const timeZone = clean(input.timeZone) || "UTC";
  if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(startTime)) return null;
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 12 * 60) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
  } catch {
    return null;
  }
  return { date, startTime, durationMinutes, timeZone };
}

function localPartsAt(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function zonedScheduleToInstants(schedule) {
  const normalized = normalizeScheduleInput(schedule);
  if (!normalized) return null;
  const [year, month, day] = normalized.date.split("-").map(Number);
  const [hour, minute] = normalized.startTime.split(":").map(Number);
  const targetWallClock = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instant = targetWallClock;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = localPartsAt(new Date(instant), normalized.timeZone);
    const representedWallClock = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second)
    );
    const next = instant + (targetWallClock - representedWallClock);
    if (next === instant) break;
    instant = next;
  }

  const verified = localPartsAt(new Date(instant), normalized.timeZone);
  if (
    Number(verified.year) !== year || Number(verified.month) !== month ||
    Number(verified.day) !== day || Number(verified.hour) !== hour ||
    Number(verified.minute) !== minute
  ) return null;

  return {
    ...normalized,
    start: new Date(instant),
    end: new Date(instant + normalized.durationMinutes * 60_000),
  };
}

export function buildDayloTaskEvent({ task, schedule, taskLink }) {
  const instants = zonedScheduleToInstants(schedule);
  if (!instants || !isValidTaskId(task?.id)) return null;
  const safeLink = clean(taskLink);
  return {
    summary: clean(task.title) || "DayLo task",
    description: safeLink
      ? `Scheduled from DayLo\nOpen task in DayLo: ${safeLink}`
      : "Scheduled from DayLo",
    ...(safeLink ? { source: { title: "DayLo", url: safeLink } } : {}),
    start: { dateTime: instants.start.toISOString(), timeZone: instants.timeZone },
    end: { dateTime: instants.end.toISOString(), timeZone: instants.timeZone },
    extendedProperties: {
      private: { dayloTaskId: task.id, dayloManaged: "true" },
    },
  };
}

export function getTaskSchedule(task) {
  return normalizeScheduleInput({
    date: task?.scheduled_date || task?.scheduledDate,
    startTime: task?.scheduled_start_time || task?.scheduledStartTime,
    durationMinutes: task?.scheduled_duration_minutes || task?.scheduledDurationMinutes,
    timeZone: task?.scheduled_timezone || task?.scheduledTimeZone || "UTC",
  });
}

export function shouldRemoveFutureTaskEvent(task, now = new Date()) {
  const instants = zonedScheduleToInstants(getTaskSchedule(task) || {});
  return Boolean(instants && instants.start.getTime() > now.getTime());
}

export function clearTaskCalendarLinkage() {
  return {
    google_calendar_event_id: null,
    google_calendar_id: null,
    google_calendar_account_id: null,
    google_calendar_event_html_link: null,
    scheduled_date: null,
    scheduled_start_time: null,
    scheduled_duration_minutes: null,
    scheduled_timezone: null,
  };
}
