import { getIntegrationAuthHeaders } from "./integrationAuthUtils.js";

export const TASK_SCHEDULE_DURATION_OPTIONS = Object.freeze([15, 30, 45, 60, 90, 120]);

function pad(value) {
  return String(value).padStart(2, "0");
}

function localDateValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isTaskEligibleForCalendarScheduling(task) {
  return Boolean(
    task &&
    (task.source || "manual") === "manual" &&
    task.dueDate &&
    !task.completed &&
    !task.archived
  );
}

export function getDefaultTaskSchedule(task, now = new Date()) {
  const rounded = new Date(now);
  rounded.setSeconds(0, 0);
  rounded.setMinutes(Math.ceil(rounded.getMinutes() / 15) * 15);
  const effort = Math.max(1, Math.min(5, Number(task?.effort) || 3));
  const durationByEffort = { 1: 30, 2: 45, 3: 60, 4: 90, 5: 120 };
  return {
    date: localDateValue(rounded),
    startTime: `${pad(rounded.getHours())}:${pad(rounded.getMinutes())}`,
    durationMinutes: durationByEffort[effort],
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };
}

export function getStoredTaskSchedule(task) {
  if (!task?.scheduledDate || !task?.scheduledStartTime || !task?.scheduledDurationMinutes) return null;
  return {
    date: task.scheduledDate,
    startTime: task.scheduledStartTime,
    durationMinutes: Number(task.scheduledDurationMinutes),
    timeZone: task.scheduledTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };
}

export function clearTaskGoogleCalendarLinkage(task) {
  return {
    ...task,
    googleCalendarEventId: null,
    googleCalendarId: null,
    googleCalendarAccountId: null,
    googleCalendarEventHtmlLink: null,
    scheduledDate: "",
    scheduledStartTime: "",
    scheduledDurationMinutes: null,
    scheduledTimeZone: "",
  };
}

export async function requestTaskCalendarOperation({ accessToken, operation, taskId, schedule, signal }) {
  try {
    const response = await fetch("/api/google-calendar/task-scheduling", {
      method: "POST",
      credentials: "include",
      signal,
      headers: getIntegrationAuthHeaders(accessToken, {
        Accept: "application/json",
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ operation, taskId, ...(schedule ? { schedule } : {}) }),
    });
    const result = await response.json().catch(() => null);
    return {
      ok: response.ok && result?.ok === true,
      status: result?.status || "task_calendar_request_failed",
      message: result?.message || (response.ok ? "" : "DayLo could not update Google Calendar."),
      reconnectRequired: result?.reconnectRequired === true,
      linkageCleared: result?.linkageCleared === true,
      historicalEventPreserved: result?.historicalEventPreserved === true,
      schedule: result?.schedule || null,
    };
  } catch (error) {
    if (error?.name === "AbortError") return { ok: false, status: "request_cancelled", message: "" };
    return {
      ok: false,
      status: "calendar_temporarily_unavailable",
      message: "Google Calendar is temporarily unavailable. Try again shortly.",
    };
  }
}

export function formatTaskSchedule(task, locale) {
  const schedule = getStoredTaskSchedule(task);
  if (!schedule) return "";
  const [year, month, day] = schedule.date.split("-").map(Number);
  const [hour, minute] = schedule.startTime.split(":").map(Number);
  // Treat stored values as the schedule's wall clock so another device does not
  // relabel the session in its own timezone.
  const start = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const end = new Date(start.getTime() + schedule.durationMinutes * 60_000);
  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: "long", day: "numeric", month: "short", timeZone: "UTC",
  }).format(start);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric", minute: "2-digit", timeZone: "UTC",
  });
  return `${dateLabel} · ${time.format(start)}–${time.format(end)}`;
}
