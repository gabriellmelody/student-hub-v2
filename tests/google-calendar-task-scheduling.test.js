import assert from "node:assert/strict";
import test from "node:test";
import { GOOGLE_CALENDAR_TASK_WRITE_SCOPE } from "../server/google-calendar/_config.js";
import { createTaskSchedulingHandler } from "../server/google-calendar/task-scheduling.js";

const USER_ID = "user-1";
const TASK_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_TASK_ID = "22222222-2222-4222-8222-222222222222";
const CALENDAR_ID = "daylo-tasks@group.calendar.google.com";
const ENV = {
  SUPABASE_URL: "https://supabase.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  GOOGLE_OAUTH_ALLOWED_ORIGINS: "https://daylo.test",
  NODE_ENV: "production",
};

function task(overrides = {}) {
  return {
    id: TASK_ID,
    user_id: USER_ID,
    title: "Economics IA draft",
    due_date: "2026-10-23",
    completed: false,
    archived: false,
    source: "manual",
    google_calendar_event_id: null,
    google_calendar_id: null,
    google_calendar_account_id: null,
    google_calendar_event_html_link: null,
    scheduled_date: null,
    scheduled_start_time: null,
    scheduled_duration_minutes: null,
    scheduled_timezone: null,
    ...overrides,
  };
}

function jsonResponse(status, body = null) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
  };
}

function createResponse() {
  return {
    statusCode: 0,
    payload: null,
    headers: new Map(),
    setHeader(name, value) { this.headers.set(name.toLowerCase(), value); },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

function createBackend(initialTasks = [task()]) {
  const state = {
    tasks: new Map(initialTasks.map((entry) => [entry.id, structuredClone(entry)])),
    calendars: new Map(),
    events: new Map(),
    calendarCreates: 0,
    eventCreates: 0,
    eventPatches: 0,
    eventDeletes: 0,
    failNextGoogleStatus: null,
    failNextTaskPatch: false,
  };

  function eventMap(calendarId) {
    if (!state.events.has(calendarId)) state.events.set(calendarId, new Map());
    return state.events.get(calendarId);
  }

  async function fetchImpl(input, options = {}) {
    const url = input instanceof URL ? input : new URL(String(input));
    const method = String(options.method || "GET").toUpperCase();

    if (url.origin === "https://supabase.test" && url.pathname === "/rest/v1/tasks") {
      const taskId = url.searchParams.get("id")?.replace(/^eq\./, "") || "";
      const userId = url.searchParams.get("user_id")?.replace(/^eq\./, "") || "";
      const stored = state.tasks.get(taskId);
      if (!stored || stored.user_id !== userId) return jsonResponse(200, []);
      if (method === "PATCH") {
        if (state.failNextTaskPatch) {
          state.failNextTaskPatch = false;
          return jsonResponse(500, { message: "safe test failure" });
        }
        Object.assign(stored, JSON.parse(options.body));
        return jsonResponse(200, [structuredClone(stored)]);
      }
      return jsonResponse(200, [structuredClone(stored)]);
    }

    if (url.origin !== "https://www.googleapis.com") {
      throw new Error(`Unexpected request: ${method} ${url}`);
    }
    if (state.failNextGoogleStatus) {
      const status = state.failNextGoogleStatus;
      state.failNextGoogleStatus = null;
      return jsonResponse(status, { error: { message: "safe test failure" } });
    }

    const parts = url.pathname
      .replace(/^\/calendar\/v3\/?/, "")
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent);

    if (parts.join("/") === "users/me/calendarList") {
      return jsonResponse(200, {
        items: [...state.calendars.values()].map((calendar) => structuredClone(calendar)),
      });
    }
    if (parts[0] === "calendars" && parts.length === 1 && method === "POST") {
      state.calendarCreates += 1;
      const body = JSON.parse(options.body);
      const calendar = { id: CALENDAR_ID, accessRole: "owner", ...body };
      state.calendars.set(CALENDAR_ID, calendar);
      return jsonResponse(200, structuredClone(calendar));
    }
    if (parts[0] === "calendars" && parts.length === 2) {
      const calendar = state.calendars.get(parts[1]);
      return calendar ? jsonResponse(200, structuredClone(calendar)) : jsonResponse(404, null);
    }
    if (parts[0] === "calendars" && parts[2] === "events") {
      const calendarId = parts[1];
      if (!state.calendars.has(calendarId)) return jsonResponse(404, null);
      const events = eventMap(calendarId);
      if (parts.length === 3 && method === "GET") {
        const required = url.searchParams.getAll("privateExtendedProperty");
        const items = [...events.values()].filter((event) => required.every((condition) => {
          const [key, value] = condition.split("=");
          return event.extendedProperties?.private?.[key] === value;
        }));
        return jsonResponse(200, { items: structuredClone(items) });
      }
      if (parts.length === 3 && method === "POST") {
        state.eventCreates += 1;
        const body = JSON.parse(options.body);
        const id = `event-${state.eventCreates}`;
        const event = {
          id,
          htmlLink: `https://calendar.google.com/calendar/event?eid=${id}`,
          status: "confirmed",
          ...body,
        };
        events.set(id, event);
        return jsonResponse(200, structuredClone(event));
      }
      const eventId = parts[3];
      const existing = events.get(eventId);
      if (!existing) return jsonResponse(404, null);
      if (method === "PATCH") {
        state.eventPatches += 1;
        Object.assign(existing, JSON.parse(options.body));
        return jsonResponse(200, structuredClone(existing));
      }
      if (method === "DELETE") {
        state.eventDeletes += 1;
        events.delete(eventId);
        return jsonResponse(204, null);
      }
      return jsonResponse(200, structuredClone(existing));
    }

    throw new Error(`Unexpected Google request: ${method} ${url}`);
  }

  return { state, fetchImpl, eventMap };
}

function createHarness(initialTasks, {
  accountId = "google-account-1",
  scope = GOOGLE_CALENDAR_TASK_WRITE_SCOPE,
  sessionFailure = null,
  now = () => new Date("2026-10-20T12:00:00.000Z"),
} = {}) {
  const backend = createBackend(initialTasks);
  let session = {
    access_token: "google-access-token",
    account_id: accountId,
    scope,
    access_expires_at: "2099-01-01T00:00:00.000Z",
  };
  const handler = createTaskSchedulingHandler({
    env: ENV,
    fetchImpl: backend.fetchImpl,
    now,
    log: { info() {}, warn() {}, error() {} },
    getSession: async () => sessionFailure || {
      ok: true,
      connected: true,
      userId: USER_ID,
      session: structuredClone(session),
    },
    saveIntegration: async (_userId, _integration, nextSession) => {
      session = structuredClone(nextSession);
      return nextSession;
    },
  });

  async function invoke(operation, taskId = TASK_ID, schedule = null) {
    const response = createResponse();
    await handler({
      method: "POST",
      headers: { origin: "https://daylo.test", authorization: "Bearer daylo-session" },
      body: { operation, taskId, ...(schedule ? { schedule } : {}) },
    }, response);
    return response;
  }

  return { ...backend, invoke, getSession: () => structuredClone(session) };
}

const FIRST_SCHEDULE = {
  date: "2026-10-21",
  startTime: "19:00",
  durationMinutes: 60,
  timeZone: "Asia/Bangkok",
};

test("explicit scheduling creates one dedicated calendar and persists a safe linked event", async () => {
  const harness = createHarness([task()]);
  const response = await harness.invoke("schedule", TASK_ID, FIRST_SCHEDULE);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.status, "task_calendar_event_created");
  assert.equal(harness.state.calendarCreates, 1);
  assert.equal(harness.state.eventCreates, 1);
  assert.equal(harness.getSession().daylo_tasks_calendar_id, CALENDAR_ID);

  const saved = harness.state.tasks.get(TASK_ID);
  assert.equal(saved.due_date, "2026-10-23");
  assert.equal(saved.scheduled_date, "2026-10-21");
  assert.equal(saved.scheduled_start_time, "19:00");
  assert.equal(saved.scheduled_duration_minutes, 60);
  assert.equal(saved.google_calendar_event_id, "event-1");

  const event = harness.eventMap(CALENDAR_ID).get("event-1");
  assert.equal(event.extendedProperties.private.dayloTaskId, TASK_ID);
  assert.equal(event.extendedProperties.private.dayloManaged, "true");
  assert.match(event.description, new RegExp(`/tasks\\?task=${TASK_ID}`));
  assert.doesNotMatch(event.description, /grade|reasoning|notes/i);
});

test("rescheduling and title changes update the same event while another task reuses the calendar", async () => {
  const second = task({ id: SECOND_TASK_ID, title: "Problem set", due_date: "2026-10-25" });
  const harness = createHarness([task(), second]);
  await harness.invoke("schedule", TASK_ID, FIRST_SCHEDULE);
  const rescheduled = await harness.invoke("schedule", TASK_ID, {
    ...FIRST_SCHEDULE,
    date: "2026-10-22",
    startTime: "20:15",
    durationMinutes: 90,
  });

  assert.equal(rescheduled.payload.status, "task_calendar_event_updated");
  assert.equal(harness.state.eventCreates, 1);
  assert.equal(harness.state.tasks.get(TASK_ID).google_calendar_event_id, "event-1");
  assert.equal(harness.state.tasks.get(TASK_ID).scheduled_start_time, "20:15");

  harness.state.tasks.get(TASK_ID).title = "Economics IA final draft";
  const titleSync = await harness.invoke("sync-title");
  assert.equal(titleSync.payload.status, "task_calendar_title_updated");
  assert.equal(harness.eventMap(CALENDAR_ID).get("event-1").summary, "Economics IA final draft");

  await harness.invoke("schedule", SECOND_TASK_ID, FIRST_SCHEDULE);
  assert.equal(harness.state.calendarCreates, 1);
  assert.equal(harness.state.eventCreates, 2);
  assert.equal(harness.state.tasks.get(SECOND_TASK_ID).google_calendar_id, CALENDAR_ID);
});

test("removing a Calendar session deletes only the event and preserves the task deadline", async () => {
  const harness = createHarness([task()]);
  await harness.invoke("schedule", TASK_ID, FIRST_SCHEDULE);
  const removed = await harness.invoke("remove");

  assert.equal(removed.statusCode, 200);
  assert.equal(removed.payload.status, "task_calendar_event_removed");
  assert.equal(harness.state.eventDeletes, 1);
  assert.equal(harness.state.tasks.has(TASK_ID), true);
  assert.equal(harness.state.tasks.get(TASK_ID).due_date, "2026-10-23");
  assert.equal(harness.state.tasks.get(TASK_ID).google_calendar_event_id, null);
});

test("future completion and deletion remove sessions while past completion preserves history", async () => {
  const future = createHarness([task()]);
  await future.invoke("schedule", TASK_ID, FIRST_SCHEDULE);
  const completion = await future.invoke("prepare-completion");
  assert.equal(completion.payload.status, "task_calendar_event_removed");
  assert.equal(future.state.eventDeletes, 1);

  const deletion = createHarness([task()]);
  await deletion.invoke("schedule", TASK_ID, FIRST_SCHEDULE);
  const preparedDelete = await deletion.invoke("prepare-deletion");
  assert.equal(preparedDelete.payload.status, "task_calendar_event_removed");
  assert.equal(deletion.state.eventDeletes, 1);

  const past = createHarness([task()], {
    now: () => new Date("2026-10-22T12:00:00.000Z"),
  });
  await past.invoke("schedule", TASK_ID, FIRST_SCHEDULE);
  const historical = await past.invoke("prepare-completion");
  assert.equal(historical.payload.historicalEventPreserved, true);
  assert.equal(past.state.eventDeletes, 0);
  assert.equal(past.state.tasks.get(TASK_ID).google_calendar_event_id, "event-1");
});

test("a stale event ID reconciles through private metadata without creating a duplicate", async () => {
  const linked = task({
    google_calendar_event_id: "stale-event",
    google_calendar_id: CALENDAR_ID,
    google_calendar_account_id: "google-account-1",
    scheduled_date: "2026-10-20",
    scheduled_start_time: "18:00",
    scheduled_duration_minutes: 30,
    scheduled_timezone: "UTC",
  });
  const harness = createHarness([linked]);
  harness.state.calendars.set(CALENDAR_ID, {
    id: CALENDAR_ID,
    summary: "DayLo Tasks",
    description: "Managed by DayLo for scheduled task study sessions.",
    accessRole: "owner",
  });
  harness.eventMap(CALENDAR_ID).set("recovered-event", {
    id: "recovered-event",
    status: "confirmed",
    extendedProperties: { private: { dayloTaskId: TASK_ID, dayloManaged: "true" } },
  });

  const response = await harness.invoke("schedule", TASK_ID, FIRST_SCHEDULE);
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.reconciled, true);
  assert.equal(harness.state.eventCreates, 0);
  assert.equal(harness.state.tasks.get(TASK_ID).google_calendar_event_id, "recovered-event");
});

test("retry after a linkage write failure reconciles the created event instead of duplicating it", async () => {
  const harness = createHarness([task()]);
  harness.state.failNextTaskPatch = true;

  const failed = await harness.invoke("schedule", TASK_ID, FIRST_SCHEDULE);
  assert.equal(failed.statusCode, 502);
  assert.equal(failed.payload.status, "task_linkage_save_failed");
  assert.equal(harness.state.eventCreates, 1);
  assert.equal(harness.state.tasks.get(TASK_ID).google_calendar_event_id, null);

  const retried = await harness.invoke("schedule", TASK_ID, FIRST_SCHEDULE);
  assert.equal(retried.statusCode, 200);
  assert.equal(retried.payload.status, "task_calendar_event_updated");
  assert.equal(harness.state.eventCreates, 1);
  assert.equal(harness.state.tasks.get(TASK_ID).google_calendar_event_id, "event-1");
});

test("a genuinely missing linked event clears stale linkage during title sync", async () => {
  const linked = task({
    google_calendar_event_id: "missing-event",
    google_calendar_id: CALENDAR_ID,
    google_calendar_account_id: "google-account-1",
  });
  const harness = createHarness([linked]);
  harness.state.calendars.set(CALENDAR_ID, { id: CALENDAR_ID });

  const response = await harness.invoke("sync-title");
  assert.equal(response.payload.status, "missing_task_calendar_event_reconciled");
  assert.equal(response.payload.linkageCleared, true);
  assert.equal(harness.state.tasks.get(TASK_ID).google_calendar_event_id, null);
});

test("Classroom tasks remain ineligible at the server write boundary", async () => {
  const harness = createHarness([task({ source: "classroom" })]);
  const response = await harness.invoke("schedule", TASK_ID, FIRST_SCHEDULE);
  assert.equal(response.statusCode, 400);
  assert.equal(response.payload.status, "task_not_eligible_for_calendar");
  assert.equal(harness.state.calendarCreates, 0);
  assert.equal(harness.state.eventCreates, 0);
});

test("the authenticated DayLo user cannot schedule another user's task", async () => {
  const harness = createHarness([task({ user_id: "user-2" })]);
  const response = await harness.invoke("schedule", TASK_ID, FIRST_SCHEDULE);
  assert.equal(response.statusCode, 404);
  assert.equal(response.payload.status, "task_not_found");
  assert.equal(harness.state.calendarCreates, 0);
  assert.equal(harness.state.eventCreates, 0);
});

test("transient Google failures retain connection state and do not save linkage", async () => {
  const harness = createHarness([task()]);
  harness.state.failNextGoogleStatus = 503;
  const response = await harness.invoke("schedule", TASK_ID, FIRST_SCHEDULE);
  assert.equal(response.statusCode, 503);
  assert.equal(response.payload.status, "calendar_temporarily_unavailable");
  assert.equal(response.payload.connected, true);
  assert.equal(harness.state.tasks.get(TASK_ID).google_calendar_event_id, null);
});

test("revoked authorization and missing write scope require deliberate reconnect", async () => {
  const revoked = createHarness([task()], {
    sessionFailure: {
      ok: false,
      status: "calendar_session_reconnect_required",
      statusCode: 401,
      connected: false,
    },
  });
  const revokedResponse = await revoked.invoke("schedule", TASK_ID, FIRST_SCHEDULE);
  assert.equal(revokedResponse.statusCode, 401);
  assert.equal(revokedResponse.payload.reconnectRequired, true);

  const readOnly = createHarness([task()], {
    scope: "https://www.googleapis.com/auth/calendar.events.readonly",
  });
  const readOnlyResponse = await readOnly.invoke("schedule", TASK_ID, FIRST_SCHEDULE);
  assert.equal(readOnlyResponse.statusCode, 403);
  assert.equal(readOnlyResponse.payload.status, "calendar_write_scope_required");
  assert.equal(readOnlyResponse.payload.reconnectRequired, true);
});

test("linked events are isolated from a newly connected Google account", async () => {
  const harness = createHarness([task({
    google_calendar_event_id: "event-from-old-account",
    google_calendar_id: CALENDAR_ID,
    google_calendar_account_id: "google-account-old",
  })], { accountId: "google-account-new" });

  const response = await harness.invoke("schedule", TASK_ID, FIRST_SCHEDULE);
  assert.equal(response.statusCode, 409);
  assert.equal(response.payload.status, "calendar_account_mismatch");
  assert.equal(response.payload.reconnectRequired, true);
  assert.equal(harness.state.calendarCreates, 0);
  assert.equal(harness.state.eventCreates, 0);
});
