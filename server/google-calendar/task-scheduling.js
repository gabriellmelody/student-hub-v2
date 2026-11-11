import { Buffer } from "node:buffer";
import process from "node:process";
import {
  GOOGLE_CALENDAR_TASK_WRITE_SCOPE,
  hasGoogleCalendarTaskWriteScope,
} from "./_config.js";
import { getValidCalendarSession, refreshCalendarSession } from "./_session.js";
import { saveGoogleIntegration } from "../google-integration-vault.js";
import {
  getSupabaseServerUrl,
  getSupabaseServiceHeaders,
} from "../supabase-server.js";
import {
  DAYLO_TASKS_CALENDAR_MARKER,
  DAYLO_TASKS_CALENDAR_NAME,
  buildDayloTaskEvent,
  clearTaskCalendarLinkage,
  isTaskEligibleForGoogleScheduling,
  isValidTaskId,
  normalizeScheduleInput,
  shouldRemoveFutureTaskEvent,
} from "./task-scheduling-utils.js";

const TASK_SELECT = [
  "id", "user_id", "title", "due_date", "completed", "archived", "source",
  "google_calendar_event_id", "google_calendar_id", "google_calendar_account_id",
  "google_calendar_event_html_link", "scheduled_date", "scheduled_start_time",
  "scheduled_duration_minutes", "scheduled_timezone",
].join(",");
const OPERATIONS = new Set([
  "schedule", "remove", "sync-title", "prepare-completion", "prepare-deletion",
]);

class TaskSchedulingError extends Error {
  constructor(status, statusCode = 400, options = {}) {
    super(status);
    this.name = "TaskSchedulingError";
    this.status = status;
    this.statusCode = statusCode;
    this.connected = options.connected !== false;
    this.reconnectRequired = options.reconnectRequired === true;
  }
}

async function readRequestJson(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") {
    try { return JSON.parse(request.body); } catch { return null; }
  }
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return null; }
}

async function readSafeJson(fetchResponse) {
  try { return await fetchResponse.json(); } catch { return null; }
}

function taskUrl(env, query = "") {
  return `${getSupabaseServerUrl(env, "/rest/v1/tasks")}${query}`;
}

async function loadOwnedTask(userId, taskId, { env, fetchImpl }) {
  const query = `?user_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(taskId)}&select=${encodeURIComponent(TASK_SELECT)}`;
  const result = await fetchImpl(taskUrl(env, query), {
    headers: getSupabaseServiceHeaders(env),
  });
  const body = await readSafeJson(result);
  if (!result.ok) throw new TaskSchedulingError("task_lookup_failed", 502);
  return Array.isArray(body) ? body[0] || null : null;
}

async function updateOwnedTask(userId, taskId, changes, { env, fetchImpl }) {
  const query = `?user_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(taskId)}&select=${encodeURIComponent(TASK_SELECT)}`;
  const result = await fetchImpl(taskUrl(env, query), {
    method: "PATCH",
    headers: getSupabaseServiceHeaders(env, {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify(changes),
  });
  const body = await readSafeJson(result);
  if (!result.ok || !Array.isArray(body) || !body[0]) {
    throw new TaskSchedulingError("task_linkage_save_failed", 502);
  }
  return body[0];
}

function parseAllowedOrigins(env) {
  const origins = String(env.GOOGLE_OAUTH_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try { return new URL(value).origin; } catch { return ""; }
    })
    .filter(Boolean);
  if (env.NODE_ENV !== "production" && env.VERCEL_ENV !== "production") {
    origins.push("http://localhost:5173", "http://127.0.0.1:5173");
  }
  return new Set(origins);
}

function getSafeTaskLink(request, taskId, env) {
  let origin;
  try { origin = new URL(String(request.headers?.origin || "")).origin; } catch { return ""; }
  if (!parseAllowedOrigins(env).has(origin)) return "";
  return `${origin}/tasks?task=${encodeURIComponent(taskId)}`;
}

function linkedAccountMismatch(task, session) {
  return Boolean(
    task.google_calendar_account_id &&
    task.google_calendar_account_id !== session.account_id
  );
}

function safeSchedule(task) {
  return {
    scheduledDate: task.scheduled_date || "",
    scheduledStartTime: String(task.scheduled_start_time || "").slice(0, 5),
    scheduledDurationMinutes: Number(task.scheduled_duration_minutes) || null,
    scheduledTimeZone: task.scheduled_timezone || "",
    googleCalendarEventHtmlLink: task.google_calendar_event_html_link || "",
  };
}

function googleUrl(path, query = null) {
  const url = new URL(`https://www.googleapis.com/calendar/v3/${path}`);
  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      (Array.isArray(value) ? value : [value]).forEach((item) => params.append(key, item));
    });
    url.search = params;
  }
  return url;
}

function classifyGoogleFailure(status) {
  if (status === 403) return new TaskSchedulingError("calendar_write_forbidden", 403);
  if (status === 429 || status >= 500) return new TaskSchedulingError("calendar_temporarily_unavailable", 503);
  return new TaskSchedulingError("calendar_write_failed", 502);
}

function createGoogleRequester({
  sessionResult,
  response,
  env,
  fetchImpl,
  log,
  saveIntegration,
}) {
  let activeSession = sessionResult.session;
  let refreshed = false;

  async function request(url, options = {}, { allow404 = false } = {}) {
    const send = () => fetchImpl(url, {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${activeSession.access_token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    let googleResponse = await send();
    if (googleResponse.status === 401 && !refreshed) {
      refreshed = true;
      const refresh = await refreshCalendarSession(activeSession, response, { fetchImpl, log });
      if (!refresh.ok) {
        throw new TaskSchedulingError(
          refresh.status || "calendar_session_reconnect_required",
          refresh.connected ? 503 : 401,
          { connected: refresh.connected, reconnectRequired: !refresh.connected }
        );
      }
      activeSession = refresh.session;
      await saveIntegration(sessionResult.userId, "calendar", activeSession, { env, fetchImpl, log });
      googleResponse = await send();
    }
    const json = googleResponse.status === 204 ? null : await readSafeJson(googleResponse);
    if (googleResponse.ok || (allow404 && googleResponse.status === 404)) {
      return { ok: googleResponse.ok, status: googleResponse.status, json };
    }
    throw classifyGoogleFailure(googleResponse.status);
  }

  return {
    request,
    getSession: () => activeSession,
    async persistCalendarId(calendarId) {
      if (activeSession.daylo_tasks_calendar_id === calendarId) return;
      activeSession = { ...activeSession, daylo_tasks_calendar_id: calendarId };
      await saveIntegration(sessionResult.userId, "calendar", activeSession, { env, fetchImpl, log });
    },
  };
}

async function findManagedCalendar(requester) {
  const result = await requester.request(googleUrl("users/me/calendarList", { maxResults: "250" }));
  return (Array.isArray(result.json?.items) ? result.json.items : []).find((calendar) =>
    calendar?.summary === DAYLO_TASKS_CALENDAR_NAME &&
    calendar?.description === DAYLO_TASKS_CALENDAR_MARKER &&
    calendar?.accessRole === "owner"
  ) || null;
}

async function ensureDayloCalendar(requester, timeZone, preferredCalendarId = "") {
  const savedCalendarId = preferredCalendarId || requester.getSession().daylo_tasks_calendar_id || "";
  if (savedCalendarId) {
    const existing = await requester.request(
      googleUrl(`calendars/${encodeURIComponent(savedCalendarId)}`), {}, { allow404: true }
    );
    if (existing.ok) {
      await requester.persistCalendarId(savedCalendarId);
      return savedCalendarId;
    }
  }

  const matched = await findManagedCalendar(requester);
  if (matched?.id) {
    await requester.persistCalendarId(String(matched.id));
    return String(matched.id);
  }

  const created = await requester.request(googleUrl("calendars"), {
    method: "POST",
    body: JSON.stringify({
      summary: DAYLO_TASKS_CALENDAR_NAME,
      description: DAYLO_TASKS_CALENDAR_MARKER,
      timeZone,
    }),
  });
  const calendarId = String(created.json?.id || "");
  if (!calendarId) throw new TaskSchedulingError("daylo_calendar_create_failed", 502);
  await requester.persistCalendarId(calendarId);
  return calendarId;
}

async function findTaskEvent(requester, calendarId, task) {
  const eventId = String(task.google_calendar_event_id || "");
  if (eventId) {
    const direct = await requester.request(
      googleUrl(`calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`),
      {}, { allow404: true }
    );
    if (direct.ok && direct.json?.status !== "cancelled") return direct.json;
  }
  const search = await requester.request(googleUrl(
    `calendars/${encodeURIComponent(calendarId)}/events`,
    {
      privateExtendedProperty: [`dayloTaskId=${task.id}`, "dayloManaged=true"],
      showDeleted: "false",
      singleEvents: "true",
      maxResults: "10",
    }
  ), {}, { allow404: true });
  if (!search.ok) return null;
  return (Array.isArray(search.json?.items) ? search.json.items : [])
    .find((event) => event?.status !== "cancelled") || null;
}

async function deleteLinkedEvent(requester, task) {
  const calendarId = String(task.google_calendar_id || "");
  if (!calendarId) return { removed: false, missing: true };
  const event = await findTaskEvent(requester, calendarId, task);
  if (!event?.id) return { removed: false, missing: true };
  const deleted = await requester.request(
    googleUrl(`calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id)}`),
    { method: "DELETE" }, { allow404: true }
  );
  return { removed: deleted.ok, missing: !deleted.ok };
}

async function handleSchedule({ task, body, requester, request, userId, env, fetchImpl }) {
  if (!isTaskEligibleForGoogleScheduling(task)) {
    throw new TaskSchedulingError("task_not_eligible_for_calendar", 400);
  }
  const schedule = normalizeScheduleInput(body.schedule || body);
  if (!schedule) throw new TaskSchedulingError("invalid_schedule", 400);
  if (linkedAccountMismatch(task, requester.getSession())) {
    throw new TaskSchedulingError("calendar_account_mismatch", 409, {
      reconnectRequired: true,
    });
  }
  const calendarId = await ensureDayloCalendar(
    requester,
    schedule.timeZone,
    task.google_calendar_id || ""
  );
  const eventPayload = buildDayloTaskEvent({
    task,
    schedule,
    taskLink: getSafeTaskLink(request, task.id, env),
  });
  if (!eventPayload) throw new TaskSchedulingError("invalid_schedule", 400);
  const existingEvent = await findTaskEvent(requester, calendarId, task);
  const eventResult = existingEvent?.id
    ? await requester.request(googleUrl(
        `calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(existingEvent.id)}`
      ), { method: "PATCH", body: JSON.stringify(eventPayload) })
    : await requester.request(googleUrl(
        `calendars/${encodeURIComponent(calendarId)}/events`
      ), { method: "POST", body: JSON.stringify(eventPayload) });
  const event = eventResult.json;
  if (!event?.id) throw new TaskSchedulingError("calendar_event_save_failed", 502);
  const savedTask = await updateOwnedTask(userId, task.id, {
    google_calendar_event_id: String(event.id),
    google_calendar_id: calendarId,
    google_calendar_account_id: requester.getSession().account_id || null,
    google_calendar_event_html_link: String(event.htmlLink || "") || null,
    scheduled_date: schedule.date,
    scheduled_start_time: schedule.startTime,
    scheduled_duration_minutes: schedule.durationMinutes,
    scheduled_timezone: schedule.timeZone,
  }, { env, fetchImpl });
  return {
    status: existingEvent ? "task_calendar_event_updated" : "task_calendar_event_created",
    schedule: safeSchedule(savedTask),
    reconciled: Boolean(existingEvent && existingEvent.id !== task.google_calendar_event_id),
  };
}

async function handleRemove({ task, requester, userId, env, fetchImpl, operation, now }) {
  if (!task.google_calendar_event_id && !task.google_calendar_id) {
    return { status: "task_calendar_not_linked", schedule: safeSchedule(task) };
  }
  if (linkedAccountMismatch(task, requester.getSession())) {
    throw new TaskSchedulingError("calendar_account_mismatch", 409, {
      reconnectRequired: true,
    });
  }
  if (operation === "prepare-completion" && !shouldRemoveFutureTaskEvent(task, now())) {
    return {
      status: "historical_task_calendar_event_preserved",
      historicalEventPreserved: true,
      schedule: safeSchedule(task),
    };
  }
  const removal = await deleteLinkedEvent(requester, task);
  const savedTask = await updateOwnedTask(
    userId, task.id, clearTaskCalendarLinkage(), { env, fetchImpl }
  );
  return {
    status: removal.missing
      ? "missing_task_calendar_event_reconciled"
      : "task_calendar_event_removed",
    linkageCleared: true,
    schedule: safeSchedule(savedTask),
  };
}

async function handleTitleSync({ task, requester, userId, env, fetchImpl }) {
  if (!task.google_calendar_event_id && !task.google_calendar_id) {
    return { status: "task_calendar_not_linked" };
  }
  if (linkedAccountMismatch(task, requester.getSession())) {
    throw new TaskSchedulingError("calendar_account_mismatch", 409, {
      reconnectRequired: true,
    });
  }
  const calendarId = String(task.google_calendar_id || "");
  const event = calendarId ? await findTaskEvent(requester, calendarId, task) : null;
  if (!event?.id) {
    await updateOwnedTask(userId, task.id, clearTaskCalendarLinkage(), { env, fetchImpl });
    return { status: "missing_task_calendar_event_reconciled", linkageCleared: true };
  }
  await requester.request(googleUrl(
    `calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id)}`
  ), {
    method: "PATCH",
    body: JSON.stringify({
      summary: String(task.title || "DayLo task"),
      extendedProperties: {
        private: { dayloTaskId: task.id, dayloManaged: "true" },
      },
    }),
  });
  return { status: "task_calendar_title_updated" };
}

function sendError(response, error) {
  const known = error instanceof TaskSchedulingError;
  const status = known ? error.status : "task_calendar_request_failed";
  const messages = {
    calendar_write_scope_required: "Reconnect Google Calendar once to allow DayLo to schedule study sessions.",
    calendar_account_mismatch: "This session belongs to a different Google account. Reconnect the original account before changing it.",
    calendar_session_reconnect_required: "Reconnect Google Calendar to continue.",
    task_not_eligible_for_calendar: "Only active manual tasks with a due date can be scheduled.",
    invalid_schedule: "Choose a valid study date, time, and duration.",
    calendar_temporarily_unavailable: "Google Calendar is temporarily unavailable. Try again shortly.",
    task_linkage_save_failed: "The Calendar event was saved, but DayLo could not finish linking it. Retry to reconcile it safely.",
  };
  response.status(known ? error.statusCode : 502).json({
    ok: false,
    status,
    connected: known ? error.connected : true,
    reconnectRequired: known ? error.reconnectRequired : false,
    message: messages[status] || "DayLo could not update this Calendar session.",
  });
}

export function createTaskSchedulingHandler({
  env = process.env,
  fetchImpl = fetch,
  log = console,
  now = () => new Date(),
  getSession = getValidCalendarSession,
  saveIntegration = saveGoogleIntegration,
} = {}) {
  return async function handler(request, response) {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      response.status(405).json({ ok: false, status: "method_not_allowed" });
      return;
    }
    try {
      const body = await readRequestJson(request);
      const operation = String(body?.operation || "");
      const taskId = String(body?.taskId || "");
      if (!body || !OPERATIONS.has(operation) || !isValidTaskId(taskId)) {
        throw new TaskSchedulingError("invalid_request", 400);
      }
      const sessionResult = await getSession(request, response, {
        env, fetchImpl, log,
      });
      if (!sessionResult.ok) {
        throw new TaskSchedulingError(
          sessionResult.status || "calendar_session_reconnect_required",
          sessionResult.statusCode || (sessionResult.connected ? 503 : 401),
          { connected: sessionResult.connected, reconnectRequired: !sessionResult.connected }
        );
      }
      if (!hasGoogleCalendarTaskWriteScope(sessionResult.session.scope)) {
        const scopeError = new TaskSchedulingError("calendar_write_scope_required", 403, {
          connected: true,
          reconnectRequired: true,
        });
        scopeError.requiredScope = GOOGLE_CALENDAR_TASK_WRITE_SCOPE;
        throw scopeError;
      }
      const task = await loadOwnedTask(sessionResult.userId, taskId, { env, fetchImpl });
      if (!task) throw new TaskSchedulingError("task_not_found", 404);
      const requester = createGoogleRequester({
        sessionResult,
        response,
        env,
        fetchImpl,
        log,
        saveIntegration,
      });
      const result = operation === "schedule"
        ? await handleSchedule({ task, body, requester, request, userId: sessionResult.userId, env, fetchImpl })
        : operation === "sync-title"
          ? await handleTitleSync({ task, requester, userId: sessionResult.userId, env, fetchImpl })
          : await handleRemove({ task, requester, userId: sessionResult.userId, env, fetchImpl, operation, now });
      response.status(200).json({ ok: true, connected: true, ...result });
    } catch (error) {
      log.warn?.("calendar task scheduling failed", {
        category: error instanceof TaskSchedulingError ? error.status : "unexpected",
      });
      sendError(response, error);
    }
  };
}

export default createTaskSchedulingHandler();
