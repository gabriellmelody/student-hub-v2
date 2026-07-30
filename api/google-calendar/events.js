import {
  getValidCalendarSession,
  refreshCalendarSession,
} from "./_session.js";

const MAX_SELECTED_CALENDARS = 20;
const MAX_EVENTS_PER_CALENDAR = 2500;

class GoogleCalendarRequestError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "GoogleCalendarRequestError";
    this.statusCode = statusCode;
  }
}

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

function isSkippableCalendarFetchError(error) {
  return (
    error instanceof GoogleCalendarRequestError &&
    [403, 404, 410].includes(error.statusCode)
  );
}

function normalizeEvent(event, calendar, accountId = "") {
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
    accountId,
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
    throw new GoogleCalendarRequestError(
      getSafeGoogleError(
        calendarListJson,
        "Google Calendar list request failed."
      ),
      calendarListResponse.status
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
  accountId,
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
      throw new GoogleCalendarRequestError(
        getSafeGoogleError(
          eventsJson,
          "Google Calendar events request failed."
        ),
        eventsResponse.status
      );
    }

    if (Array.isArray(eventsJson?.items)) {
      eventsJson.items
        .filter((event) => event?.status !== "cancelled")
        .forEach((event) =>
          events.push(normalizeEvent(event, calendar, accountId))
        );
    }

    pageToken = eventsJson?.nextPageToken || "";
  } while (pageToken);

  return events;
}

async function fetchSelectedCalendarEvents({
  accessToken,
  selectedCalendarIds,
  timeMin,
  timeMax,
  accountId,
}) {
  const calendarMap = await fetchCalendarMap(accessToken);
  let skippedCalendarCount = 0;
  const selectedCalendars = selectedCalendarIds
    .map((calendarId) => {
      const calendar = calendarMap.get(calendarId);

      if (!calendar) {
        skippedCalendarCount += 1;
        return null;
      }

      return calendar;
    })
    .filter(Boolean);

  const successfulCalendars = [];
  const eventGroups = [];

  for (const calendar of selectedCalendars) {
    try {
      const calendarEvents = await fetchEventsForCalendar({
        accessToken,
        calendar,
        timeMin,
        timeMax,
        accountId,
      });

      successfulCalendars.push(calendar);
      eventGroups.push(calendarEvents);
    } catch (error) {
      if (isSkippableCalendarFetchError(error)) {
        skippedCalendarCount += 1;
        continue;
      }

      throw error;
    }
  }

  return {
    requestedCalendarCount: selectedCalendarIds.length,
    selectedCalendars,
    successfulCalendars,
    skippedCalendarCount,
    events: eventGroups.flat(),
  };
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

  const sessionResult = await getValidCalendarSession(request, response);

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
      status: sessionResult.status || "calendar_session_invalid_or_expired",
      connected: false,
      message:
        sessionResult.message ||
        "Google Calendar session is invalid or expired. Connect again.",
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
  const requestedAccountId =
    typeof body.accountId === "string" ? body.accountId.trim() : "";
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
    let activeSession = sessionResult.session;
    let eventsResult;

    const activeAccountId =
      typeof activeSession.account_id === "string"
        ? activeSession.account_id
        : "";

    if (requestedAccountId && requestedAccountId !== activeAccountId) {
      response.status(409).json({
        ok: false,
        status: "calendar_account_changed",
        connected: true,
        message: "Calendar account changed. Load calendars again.",
        account: {
          id: activeAccountId,
        },
      });
      return;
    }

    try {
      eventsResult = await fetchSelectedCalendarEvents({
        accessToken: activeSession.access_token,
        selectedCalendarIds,
        timeMin,
        timeMax,
        accountId: activeSession.account_id || "",
      });
    } catch (error) {
      if (
        !(error instanceof GoogleCalendarRequestError) ||
        error.statusCode !== 401
      ) {
        throw error;
      }

      const refreshedSession = await refreshCalendarSession(
        activeSession,
        response
      );

      if (!refreshedSession.ok) {
        response.status(401).json({
          ok: false,
          status:
            refreshedSession.status || "calendar_session_reconnect_required",
          connected: false,
          message:
            refreshedSession.message ||
            "Reconnect Google Calendar to load events.",
        });
        return;
      }

      activeSession = refreshedSession.session;
      const refreshedAccountId =
        typeof activeSession.account_id === "string"
          ? activeSession.account_id
          : "";

      if (requestedAccountId && requestedAccountId !== refreshedAccountId) {
        response.status(409).json({
          ok: false,
          status: "calendar_account_changed",
          connected: true,
          message: "Calendar account changed. Load calendars again.",
          account: {
            id: refreshedAccountId,
          },
        });
        return;
      }

      eventsResult = await fetchSelectedCalendarEvents({
        accessToken: activeSession.access_token,
        selectedCalendarIds,
        timeMin,
        timeMax,
        accountId: activeSession.account_id || "",
      });
    }

    const events = eventsResult.events;

    if (
      eventsResult.requestedCalendarCount > 0 &&
      eventsResult.successfulCalendars.length === 0
    ) {
      response.status(502).json({
        ok: false,
        status: "all_calendar_event_fetches_failed",
        connected: true,
        message:
          "Student Hub could not read events from the selected calendars.",
        skippedCalendarCount: eventsResult.skippedCalendarCount,
      });
      return;
    }

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
        calendarCount: eventsResult.successfulCalendars.length,
        selectedCalendarCount: eventsResult.requestedCalendarCount,
        skippedCalendarCount: eventsResult.skippedCalendarCount,
        timeMin,
        timeMax,
      },
      skippedCalendarCount: eventsResult.skippedCalendarCount,
      account: {
        id:
          typeof activeSession.account_id === "string"
            ? activeSession.account_id
            : "",
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
