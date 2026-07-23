import { readCalendarSession } from "./_session.js";

const MAX_SELECTED_CALENDARS = 20;
const MAX_EVENTS_PER_CALENDAR = 2500;

async function readRequestJson(request) {
  if (request.body && typeof request.body === "object") return request.body;

  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      return null;
    }
  }

  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

async function readSafeJson(fetchResponse) {
  try {
    return await fetchResponse.json();
  } catch {
    return null;
  }
}

function getSafeGoogleError(googleResponse, fallbackMessage) {
  if (!googleResponse || typeof googleResponse !== "object") {
    return fallbackMessage;
  }

  return (
    googleResponse.error_description ||
    googleResponse.error?.message ||
    (typeof googleResponse.error === "string" ? googleResponse.error : "") ||
    fallbackMessage
  );
}

function normalizeCalendarId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidDateRange(timeMin, timeMax) {
  const minDate = Date.parse(timeMin);
  const maxDate = Date.parse(timeMax);

  return (
    typeof timeMin === "string" &&
    typeof timeMax === "string" &&
    Number.isFinite(minDate) &&
    Number.isFinite(maxDate) &&
    minDate < maxDate
  );
}

function normalizeCalendar(calendar) {
  return {
    id: String(calendar?.id || ""),
    name: String(calendar?.summary || "Untitled calendar"),
    backgroundColor: String(calendar?.backgroundColor || ""),
  };
}

function normalizeEvent(event, calendar) {
  const start = event?.start?.dateTime || event?.start?.date || "";
  const end = event?.end?.dateTime || event?.end?.date || start;
  const allDay = Boolean(event?.start?.date);

  return {
    id: String(event?.id || ""),
    calendarId: calendar.id,
    calendarName: calendar.name,
    title: String(event?.summary || "Untitled event"),
    description: String(event?.description || ""),
    location: String(event?.location || ""),
    start,
    end,
    allDay,
    status: String(event?.status || ""),
    backgroundColor: calendar.backgroundColor,
    calendarColor: calendar.backgroundColor,
  };
}

async function fetchCalendarMap(accessToken) {
  const calendarListResponse = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const calendarListJson = await readSafeJson(calendarListResponse);

  if (!calendarListResponse.ok) {
    throw new Error(
      getSafeGoogleError(
        calendarListJson,
        "Google Calendar list request failed."
      )
    );
  }

  const calendars = Array.isArray(calendarListJson?.items)
    ? calendarListJson.items.map(normalizeCalendar)
    : [];

  return new Map(calendars.map((calendar) => [calendar.id, calendar]));
}

async function fetchEventsForCalendar({
  accessToken,
  calendar,
  timeMin,
  timeMax,
}) {
  const events = [];
  let pageToken = "";

  do {
    const eventsUrl = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendar.id
      )}/events`
    );

    eventsUrl.search = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      showDeleted: "false",
      maxResults: String(MAX_EVENTS_PER_CALENDAR),
      ...(pageToken ? { pageToken } : {}),
    });

    const eventsResponse = await fetch(eventsUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const eventsJson = await readSafeJson(eventsResponse);

    if (!eventsResponse.ok) {
      throw new Error(
        getSafeGoogleError(eventsJson, "Google Calendar events request failed.")
      );
    }

    if (Array.isArray(eventsJson?.items)) {
      eventsJson.items
        .filter((event) => event?.status !== "cancelled")
        .forEach((event) => events.push(normalizeEvent(event, calendar)));
    }

    pageToken = eventsJson?.nextPageToken || "";
  } while (pageToken);

  return events;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({
      ok: false,
      status: "method_not_allowed",
      message: "Use POST to load Google Calendar events.",
    });
    return;
  }

  const sessionResult = readCalendarSession(request);

  if (sessionResult.status === "no_calendar_session") {
    response.status(401).json({
      ok: false,
      status: "no_calendar_session",
      connected: false,
      message: "No Google Calendar session is available yet.",
    });
    return;
  }

  if (!sessionResult.ok) {
    response.status(401).json({
      ok: false,
      status: "calendar_session_invalid_or_expired",
      connected: false,
      message: "Google Calendar session is invalid or expired. Connect again.",
    });
    return;
  }

  const body = await readRequestJson(request);

  if (!body || typeof body !== "object") {
    response.status(400).json({
      ok: false,
      status: "invalid_request",
      connected: true,
      message: "Student Hub could not read the calendar event request.",
    });
    return;
  }

  const selectedCalendarIds = Array.from(
    new Set(
      (Array.isArray(body.selectedCalendarIds)
        ? body.selectedCalendarIds
        : []
      )
        .map(normalizeCalendarId)
        .filter(Boolean)
    )
  ).slice(0, MAX_SELECTED_CALENDARS);
  const timeMin = typeof body.timeMin === "string" ? body.timeMin : "";
  const timeMax = typeof body.timeMax === "string" ? body.timeMax : "";

  if (selectedCalendarIds.length === 0) {
    response.status(400).json({
      ok: false,
      status: "no_selected_calendars",
      connected: true,
      message: "Choose at least one calendar to show in Student Hub.",
    });
    return;
  }

  if (!isValidDateRange(timeMin, timeMax)) {
    response.status(400).json({
      ok: false,
      status: "invalid_date_range",
      connected: true,
      message: "Choose a valid date range for Google Calendar events.",
    });
    return;
  }

  try {
    const calendarMap = await fetchCalendarMap(
      sessionResult.session.access_token
    );
    const selectedCalendars = selectedCalendarIds.map((calendarId) => {
      return (
        calendarMap.get(calendarId) || {
          id: calendarId,
          name: "Google Calendar",
          backgroundColor: "",
        }
      );
    });
    const eventGroups = await Promise.all(
      selectedCalendars.map((calendar) =>
        fetchEventsForCalendar({
          accessToken: sessionResult.session.access_token,
          calendar,
          timeMin,
          timeMax,
        })
      )
    );
    const events = eventGroups.flat();

    response.status(200).json({
      ok: true,
      status: "events_read_from_session",
      connected: true,
      message:
        events.length > 0
          ? "Google Calendar events were loaded."
          : "No Google Calendar events found for this view.",
      eventSummary: {
        count: events.length,
        calendarCount: selectedCalendars.length,
        timeMin,
        timeMax,
      },
      events,
    });
  } catch (error) {
    response.status(502).json({
      ok: false,
      status: "events_fetch_failed",
      connected: true,
      message: "Student Hub could not read Google Calendar events.",
      googleError:
        error instanceof Error
          ? error.message
          : "Google Calendar events request failed.",
    });
  }
}
