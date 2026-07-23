import { readCalendarSession } from "./_session.js";

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

export default async function handler(request, response) {
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

  try {
    const calendarsResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${sessionResult.session.access_token}`,
        },
      }
    );
    const calendarsJson = await readSafeJson(calendarsResponse);

    if (!calendarsResponse.ok) {
      response.status(502).json({
        ok: false,
        status: "calendars_fetch_failed",
        connected: true,
        message: "Student Hub could not read Google calendars.",
        googleError: getSafeGoogleError(
          calendarsJson,
          "Google Calendar returned an unexpected response."
        ),
      });
      return;
    }

    const calendars = Array.isArray(calendarsJson?.items)
      ? calendarsJson.items.map(normalizeCalendar)
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
