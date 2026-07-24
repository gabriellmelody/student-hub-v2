import {
  getValidCalendarSession,
  refreshCalendarSession,
} from "./_session.js";

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

function normalizeCalendar(calendar) {
  return {
    id: String(calendar?.id || ""),
    summary: String(calendar?.summary || "Untitled calendar"),
    name: String(calendar?.summary || "Untitled calendar"),
    primary: calendar?.primary === true,
    selected: calendar?.selected === true,
    accessRole: String(calendar?.accessRole || ""),
    backgroundColor: String(calendar?.backgroundColor || ""),
  };
}

async function fetchGoogleCalendars(accessToken) {
  const calendarsResponse = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const calendarsJson = await readSafeJson(calendarsResponse);

  return {
    ok: calendarsResponse.ok,
    status: calendarsResponse.status,
    json: calendarsJson,
  };
}

export default async function handler(request, response) {
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

  try {
    let activeSession = sessionResult.session;
    let calendarsResult = await fetchGoogleCalendars(
      activeSession.access_token
    );

    if (calendarsResult.status === 401) {
      const refreshedSession = await refreshCalendarSession(
        activeSession,
        response
      );

      if (refreshedSession.ok) {
        activeSession = refreshedSession.session;
        calendarsResult = await fetchGoogleCalendars(
          activeSession.access_token
        );
      } else {
        response.status(401).json({
          ok: false,
          status:
            refreshedSession.status || "calendar_session_reconnect_required",
          connected: false,
          message:
            refreshedSession.message ||
            "Reconnect Google Calendar to load calendars.",
        });
        return;
      }
    }

    if (!calendarsResult.ok) {
      response.status(502).json({
        ok: false,
        status: "calendars_fetch_failed",
        connected: true,
        message: "Student Hub could not read Google calendars.",
        googleError: getSafeGoogleError(
          calendarsResult.json,
          "Google Calendar returned an unexpected response."
        ),
      });
      return;
    }

    const calendars = Array.isArray(calendarsResult.json?.items)
      ? calendarsResult.json.items.map(normalizeCalendar)
      : [];

    response.status(200).json({
      ok: true,
      status: "calendars_read_from_session",
      connected: true,
      message:
        calendars.length > 0
          ? "Google calendars were loaded from the secure session."
          : "Google Calendar connected, but no calendars were found.",
      calendarSummary: {
        count: calendars.length,
      },
      calendars,
    });
  } catch {
    response.status(502).json({
      ok: false,
      status: "calendars_fetch_failed",
      connected: true,
      message: "Student Hub could not read Google calendars.",
      googleError: "Google Calendar request failed.",
    });
  }
}
