import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CLASSROOM_SESSION_COOKIE_NAME,
  createClassroomSessionCookie,
  getValidClassroomSession,
  readClassroomSession,
} from "../api/google-classroom/_session.js";
import {
  CALENDAR_SESSION_COOKIE_NAME,
  createCalendarSessionCookie,
  getValidCalendarSession,
  readCalendarSession,
} from "../api/google-calendar/_session.js";
import disconnectClassroom from "../api/google-classroom/disconnect.js";
import disconnectCalendar from "../api/google-calendar/disconnect.js";

const ORIGINAL_ENV = { ...process.env };
process.env.STUDENT_HUB_SESSION_SECRET = "test-session-secret-with-at-least-thirty-two-characters";
process.env.GOOGLE_CLASSROOM_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLASSROOM_CLIENT_SECRET = "test-client-secret";

function requestFromSetCookie(setCookie) {
  return { headers: { cookie: String(setCookie).split(";")[0] } };
}

function responseRecorder() {
  return {
    headers: new Map(), statusCode: 0, payload: null,
    setHeader(name, value) { this.headers.set(name.toLowerCase(), value); },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return payload; },
  };
}

function token(overrides = {}) {
  return { access_token: "access-old", refresh_token: "refresh-stable", expires_in: 3600, ...overrides };
}

function account() {
  return { accountId: "google-account-1", accountEmail: "student@example.edu" };
}

function successfulRefresh() {
  return { ok: true, status: 200, json: async () => ({ access_token: "access-new", expires_in: 3600 }) };
}

test.after(() => {
  process.env = ORIGINAL_ENV;
});

test("valid Classroom and Calendar access tokens are reused without refresh", async () => {
  let calls = 0;
  const classroom = createClassroomSessionCookie(token(), null, account());
  const calendar = createCalendarSessionCookie(token(), null, account());
  const fetchImpl = async () => { calls += 1; return successfulRefresh(); };
  assert.equal((await getValidClassroomSession(requestFromSetCookie(classroom.cookie), { fetchImpl })).ok, true);
  assert.equal((await getValidCalendarSession(requestFromSetCookie(calendar.cookie), responseRecorder(), { fetchImpl })).ok, true);
  assert.equal(calls, 0);
});

test("expired tokens refresh silently and preserve omitted refresh tokens", async () => {
    const classroom = createClassroomSessionCookie(token({ expires_in: 60 }), null, account());
    const calendar = createCalendarSessionCookie(token({ expires_in: 60 }), null, account());

    const classroomResult = await getValidClassroomSession(requestFromSetCookie(classroom.cookie), { fetchImpl: async () => successfulRefresh() });
    const calendarResponse = responseRecorder();
    const calendarResult = await getValidCalendarSession(requestFromSetCookie(calendar.cookie), calendarResponse, { fetchImpl: async () => successfulRefresh() });

    assert.equal(classroomResult.status, "classroom_session_refreshed");
    assert.equal(classroomResult.session.refresh_token, "refresh-stable");
    assert.equal(readClassroomSession(requestFromSetCookie(classroomResult.cookie)).session.refresh_token, "refresh-stable");
    assert.equal(calendarResult.status, "calendar_session_refreshed");
    assert.equal(calendarResult.session.refresh_token, "refresh-stable");
    assert.equal(readCalendarSession(requestFromSetCookie(calendarResponse.headers.get("set-cookie"))).session.refresh_token, "refresh-stable");
});

test("temporary refresh failures retain connected authorization", async () => {
    const classroom = createClassroomSessionCookie(token({ expires_in: 60 }), null, account());
    const calendar = createCalendarSessionCookie(token({ expires_in: 60 }), null, account());
    const unavailable = async () => ({ ok: false, status: 503, json: async () => ({ error: "temporarily_unavailable" }) });

    const classroomResult = await getValidClassroomSession(requestFromSetCookie(classroom.cookie), { fetchImpl: unavailable });
    const calendarResult = await getValidCalendarSession(requestFromSetCookie(calendar.cookie), responseRecorder(), { fetchImpl: unavailable });
    assert.deepEqual([classroomResult.status, classroomResult.connected], ["classroom_refresh_temporarily_unavailable", true]);
    assert.deepEqual([calendarResult.status, calendarResult.connected], ["calendar_refresh_temporarily_unavailable", true]);
    assert.equal(classroomResult.session.refresh_token, "refresh-stable");
    assert.equal(calendarResult.session.refresh_token, "refresh-stable");
});

test("invalid_grant is the definitive reconnect boundary", async () => {
    const classroom = createClassroomSessionCookie(token({ expires_in: 60 }), null, account());
    const calendar = createCalendarSessionCookie(token({ expires_in: 60 }), null, account());
    const rejected = async () => ({ ok: false, status: 400, json: async () => ({ error: "invalid_grant", error_description: "secret details" }) });
    const classroomResult = await getValidClassroomSession(requestFromSetCookie(classroom.cookie), { fetchImpl: rejected });
    const calendarResult = await getValidCalendarSession(requestFromSetCookie(calendar.cookie), responseRecorder(), { fetchImpl: rejected });
    assert.deepEqual([classroomResult.status, classroomResult.connected], ["classroom_reauthorization_required", false]);
    assert.deepEqual([calendarResult.status, calendarResult.connected], ["calendar_session_reconnect_required", false]);
    assert.equal(JSON.stringify([classroomResult, calendarResult]).includes("secret details"), false);
});

test("an expired session without refresh authorization requires reconnect", async () => {
  const classroom = createClassroomSessionCookie(token({ refresh_token: "", expires_in: 60 }), null, account());
  const calendar = createCalendarSessionCookie(token({ refresh_token: "", expires_in: 60 }), null, account());
  const classroomResult = await getValidClassroomSession(requestFromSetCookie(classroom.cookie));
  const calendarResult = await getValidCalendarSession(requestFromSetCookie(calendar.cookie), responseRecorder());
  assert.deepEqual([classroomResult.status, classroomResult.connected], ["classroom_reauthorization_required", false]);
  assert.deepEqual([calendarResult.status, calendarResult.connected], ["calendar_session_reconnect_required", false]);
});

test("persistent cookies outlive access tokens and disconnect independently", () => {
  const classroom = createClassroomSessionCookie(token(), null, account());
  const calendar = createCalendarSessionCookie(token(), null, account());
  assert.match(classroom.cookie, /Max-Age=2592000/);
  assert.match(calendar.cookie, /Max-Age=1209600/);

  const classroomResponse = responseRecorder();
  disconnectClassroom({ method: "POST" }, classroomResponse);
  assert.match(classroomResponse.headers.get("set-cookie"), new RegExp(`^${CLASSROOM_SESSION_COOKIE_NAME}=.*Max-Age=0`));
  assert.doesNotMatch(classroomResponse.headers.get("set-cookie"), new RegExp(CALENDAR_SESSION_COOKIE_NAME));

  const calendarResponse = responseRecorder();
  disconnectCalendar({ method: "POST" }, calendarResponse);
  assert.match(calendarResponse.headers.get("set-cookie"), new RegExp(`^${CALENDAR_SESSION_COOKIE_NAME}=.*Max-Age=0`));
  assert.doesNotMatch(calendarResponse.headers.get("set-cookie"), new RegExp(CLASSROOM_SESSION_COOKIE_NAME));
});

test("integration authorization remains server-cookie based and independent from DayLo login", () => {
  const sessionSources = [
    readFileSync(new URL("../api/google-classroom/_session.js", import.meta.url), "utf8"),
    readFileSync(new URL("../api/google-calendar/_session.js", import.meta.url), "utf8"),
  ].join("\n");
  assert.match(sessionSources, /HttpOnly/);
  assert.match(sessionSources, /aes-256-gcm/);
  assert.doesNotMatch(sessionSources, /localStorage|sessionStorage|supabase|provider_refresh_token/);
  const authSource = readFileSync(new URL("../src/hooks/useAuth.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(authSource, /classroom_session|calendar_session|refresh_token/);

  const settingsSource = readFileSync(new URL("../src/pages/SettingsPage.jsx", import.meta.url), "utf8");
  assert.match(settingsSource, /\/api\/google-classroom\/disconnect/);
  assert.match(settingsSource, /\/api\/google-calendar\/disconnect/);
  assert.match(settingsSource, /Change account/);
  assert.doesNotMatch(settingsSource, /refresh_token|access_token/);
});
