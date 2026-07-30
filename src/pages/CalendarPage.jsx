import { useEffect, useMemo, useRef, useState } from "react";
import SubjectField from "../components/SubjectField.jsx";
import TaskClassificationFields from "../components/TaskClassificationFields.jsx";
import TaskSourceBadge from "../components/TaskSourceBadge.jsx";
import {
  getDaysLeft,
  formatDateKey,
  parseDateKey,
  getTaskCalendarEvents,
  getMonthCalendarDays,
  getUrgencyLabel,
  getUrgencyClass,
  getEffortClass,
  getTaskSignalBadges,
  updateTaskTitleWithDetection,
} from "../utils/appUtils.js";
import {
  GOOGLE_CALENDAR_ACCOUNT_KEY,
  GOOGLE_CALENDAR_PREFERENCES_KEY,
  getGoogleCalendarAccountId,
  loadGoogleCalendarAccountMeta,
  loadGoogleCalendarPreferencesFromStorage,
  reconcileGoogleCalendarAccountStorage,
} from "../utils/googleCalendarStorage.js";

const googleCalendarEventLimit = 2;

const effortKeywordGroups = {
  high: [
    "test",
    "exam",
    "assessment",
    "essay",
    "project",
    "presentation",
    "lab report",
    "final",
    "draft",
    "research",
  ],
  medium: [
    "worksheet",
    "practice",
    "questions",
    "reading",
    "paragraph",
    "homework",
  ],
  low: ["vocab", "review", "watch", "check", "form", "short"],
};

const effortLabels = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function loadGoogleCalendarPreferences() {
  return loadGoogleCalendarPreferencesFromStorage();
}

function getVisibleGoogleCalendarPreferences(preferences) {
  return Object.values(preferences).filter(
    (preference) =>
      preference?.calendarId &&
      preference.showInStudentHub === true
  );
}

function normalizeCalendarMatchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getGoogleEventDayKeys(event) {
  if (!event?.start) return [];

  if (event.allDay) {
    const startDate = parseDateKey(event.start);
    const endDate = event.end ? parseDateKey(event.end) : startDate;
    const dayKeys = [];
    const currentDate = new Date(startDate);
    const exclusiveEnd = new Date(endDate);

    if (exclusiveEnd <= currentDate) {
      return [formatDateKey(currentDate)];
    }

    while (currentDate < exclusiveEnd) {
      dayKeys.push(formatDateKey(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dayKeys;
  }

  const startDate = new Date(event.start);
  const endDate = event.end ? new Date(event.end) : startDate;
  const dayKeys = [];
  const currentDate = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );
  const finalDate = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );

  while (currentDate <= finalDate) {
    dayKeys.push(formatDateKey(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dayKeys;
}

function googleEventOccursOnDate(event, dateKey) {
  return getGoogleEventDayKeys(event).includes(dateKey);
}

function getGoogleEventDateKey(event) {
  return getGoogleEventDayKeys(event)[0] || "";
}

function shouldSuppressGoogleCalendarEvent(event, dateKey, tasks) {
  if (event?.duplicateRisk?.source !== "classroom") return false;

  const eventTitle = normalizeCalendarMatchText(event.title);
  if (!eventTitle) return false;

  return tasks.some((task) => {
    return (
      task.source === "classroom" &&
      task.archived !== true &&
      task.dueDate === dateKey &&
      normalizeCalendarMatchText(task.title) === eventTitle
    );
  });
}

function getCalendarEventTimeLabel(event) {
  if (event.allDay) return "All day";

  const startDate = new Date(event.start);
  const endDate = event.end ? new Date(event.end) : null;
  const formatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };

  if (!Number.isFinite(startDate.getTime())) return "";

  const startLabel = startDate.toLocaleTimeString(undefined, formatOptions);

  if (!endDate || !Number.isFinite(endDate.getTime())) return startLabel;

  return `${startLabel}–${endDate.toLocaleTimeString(
    undefined,
    formatOptions
  )}`;
}

function getGoogleCalendarEventStyle(event) {
  return {
    "--calendar-event-color":
      event.backgroundColor || event.calendarColor || "var(--accent-soft)",
  };
}

function textIncludesKeyword(text, keyword) {
  return new RegExp(`\\b${keyword.replaceAll(" ", "\\s+")}\\b`, "i").test(text);
}

function getCalendarEffortLevel(task) {
  const numericEffort = Number(task.effort);

  if (Number.isFinite(numericEffort) && numericEffort > 0) {
    if (numericEffort <= 2) return "low";
    if (numericEffort >= 4) return "high";
    return "medium";
  }

  if (["urgent", "high"].includes(task.importance)) return "high";
  if (["assessment", "project"].includes(task.taskType)) return "high";
  if (task.taskType === "revision") return "medium";

  const searchText = [
    task.title,
    task.subject,
    task.taskType,
    task.importance,
    ...(Array.isArray(task.detectedTags) ? task.detectedTags : []),
  ]
    .filter(Boolean)
    .join(" ");

  if (
    effortKeywordGroups.high.some((keyword) =>
      textIncludesKeyword(searchText, keyword)
    )
  ) {
    return "high";
  }

  if (
    effortKeywordGroups.medium.some((keyword) =>
      textIncludesKeyword(searchText, keyword)
    )
  ) {
    return "medium";
  }

  if (
    effortKeywordGroups.low.some((keyword) =>
      textIncludesKeyword(searchText, keyword)
    )
  ) {
    return "low";
  }

  return "medium";
}

function isAssessmentCalendarEvent(event) {
  return (
    event?.taskType === "assessment" ||
    (Array.isArray(event?.detectedTags) && event.detectedTags.length > 0)
  );
}

function getAssessmentCalendarLabel(event) {
  const assessmentBadge = getTaskSignalBadges(event).find(
    (badge) => badge.tone === "assessment"
  );

  return assessmentBadge?.label || "Assessment";
}

function formatAssessmentSummaryLabel(event) {
  return getAssessmentCalendarLabel(event).toLowerCase();
}

function formatDueCount(count, { compact = false } = {}) {
  if (compact) return `${count} due`;

  if (count === 0) return "No tasks due";
  if (count === 1) return "1 task due";
  return `${count} tasks due`;
}

function getCalendarDeadlineSummaryLabel(events) {
  const assessmentEvents = events.filter(isAssessmentCalendarEvent);
  const assessmentCount = assessmentEvents.length;

  if (assessmentCount === 1 && events.length === 1) {
    return `1 ${formatAssessmentSummaryLabel(assessmentEvents[0])}`;
  }

  if (assessmentCount > 0) {
    return `${formatDueCount(events.length, { compact: true })} · ${assessmentCount} ${
      assessmentCount === 1 ? "assessment" : "assessments"
    }`;
  }

  return formatDueCount(events.length, { compact: true });
}

function getCalendarMobileDeadlineSummaryLabel(events) {
  const assessmentCount = events.filter(isAssessmentCalendarEvent).length;

  if (assessmentCount === 1 && events.length === 1) return "1 test";
  if (assessmentCount > 0) return `${events.length} + test`;

  return `${events.length} due`;
}

function formatSelectedTaskCount(count) {
  if (count === 0) return "No tasks due";
  if (count === 1) return "1 due";
  return `${count} due`;
}

function formatSelectedEventCount(count) {
  if (count === 0) return "No events";
  if (count === 1) return "1 event";
  return `${count} events`;
}

function getCalendarDeadlineSummaryStyle(events, colourMode) {
  if (colourMode === "subject") {
    const subjectEvent = events.find((event) => event.subjectColour);

    return subjectEvent
      ? { "--calendar-deadline-color": subjectEvent.subjectColour }
      : undefined;
  }

  const effortRank = { low: 0, medium: 1, high: 2 };
  const highestEffort = events.reduce((highestLevel, event) => {
    const effortLevel = getCalendarEffortLevel(event);

    return effortRank[effortLevel] > effortRank[highestLevel]
      ? effortLevel
      : highestLevel;
  }, "low");

  return {
    "--calendar-deadline-color": `var(--calendar-effort-${highestEffort})`,
  };
}

function createCalendarTaskDraft(dueDate) {
  return {
    subject: "",
    title: "",
    dueDate,
    effort: 2,
    taskType: "homework",
    importance: "normal",
    detectedTags: [],
    importanceSource: "auto",
  };
}

function CalendarPage({ tasks, subjects, setActivePage, addTaskToList }) {
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(today));
  const [dotColourMode, setDotColourMode] = useState("subject");
  const [showCalendarTaskForm, setShowCalendarTaskForm] = useState(false);
  const [calendarTaskDraft, setCalendarTaskDraft] = useState(() =>
    createCalendarTaskDraft(formatDateKey(today))
  );
  const [googleCalendarPreferences, setGoogleCalendarPreferences] = useState(
    loadGoogleCalendarPreferences
  );
  const [googleCalendarAccount, setGoogleCalendarAccount] = useState({
    checking: true,
    connected: false,
    accountId: "",
  });
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState({
    loading: false,
    events: [],
    lastLoadedAt: "",
    message: "",
    error: "",
    requestKey: "",
  });
  const activeEventsRequestRef = useRef({
    id: 0,
    key: "",
    controller: null,
  });
  const googleCalendarEventsCacheRef = useRef(new Map());
  const calendarEvents = getTaskCalendarEvents(tasks, subjects);
  const calendarDays = getMonthCalendarDays(visibleMonth);
  const selectedEvents = calendarEvents.filter(
    (event) => event.date === selectedDate
  );
  const visibleGoogleCalendarPreferences = useMemo(
    () =>
      googleCalendarAccount.connected && googleCalendarAccount.accountId
        ? getVisibleGoogleCalendarPreferences(googleCalendarPreferences)
        : [],
    [
      googleCalendarAccount.accountId,
      googleCalendarAccount.connected,
      googleCalendarPreferences,
    ]
  );
  const selectedGoogleCalendarIds = useMemo(
    () =>
      visibleGoogleCalendarPreferences
        .map((preference) => preference.calendarId)
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [visibleGoogleCalendarPreferences]
  );
  const googleCalendarPreferenceMap = useMemo(() => {
    return Object.fromEntries(
      visibleGoogleCalendarPreferences.map((preference) => [
        preference.calendarId,
        preference,
      ])
    );
  }, [visibleGoogleCalendarPreferences]);
  const selectedDateValue = parseDateKey(selectedDate);
  const eventRangeStart = calendarDays[0]?.date;
  const eventRangeEnd = calendarDays[calendarDays.length - 1]?.date;
  const eventRangeStartKey = calendarDays[0]?.dateKey || "";
  const eventRangeEndKey = calendarDays[calendarDays.length - 1]?.dateKey || "";
  const googleCalendarRequestKey = [
    googleCalendarAccount.accountId || "no-calendar-account",
    eventRangeStartKey,
    eventRangeEndKey,
    selectedGoogleCalendarIds.join("|"),
  ].join("::");
  const currentViewGoogleCalendarEvents =
    googleCalendarEvents.requestKey === googleCalendarRequestKey
      ? googleCalendarEvents.events
      : [];
  const visibleGoogleCalendarEvents = useMemo(() => {
    return currentViewGoogleCalendarEvents.filter((event) => {
      return !getGoogleEventDayKeys(event).some((dateKey) =>
        shouldSuppressGoogleCalendarEvent(event, dateKey, tasks)
      );
    });
  }, [currentViewGoogleCalendarEvents, tasks]);
  const selectedScheduleEvents = visibleGoogleCalendarEvents.filter((event) =>
    googleEventOccursOnDate(event, selectedDate)
  );

  function clearGoogleCalendarEventState(message = "") {
    activeEventsRequestRef.current.controller?.abort();
    activeEventsRequestRef.current = {
      id: activeEventsRequestRef.current.id + 1,
      key: "",
      controller: null,
    };
    googleCalendarEventsCacheRef.current.clear();
    setGoogleCalendarEvents({
      loading: false,
      events: [],
      lastLoadedAt: "",
      message,
      error: "",
      requestKey: "",
    });
  }

  useEffect(() => {
    function handleStorageChange(event) {
      if (
        event.key !== GOOGLE_CALENDAR_PREFERENCES_KEY &&
        event.key !== GOOGLE_CALENDAR_ACCOUNT_KEY
      ) {
        return;
      }

      setGoogleCalendarPreferences(loadGoogleCalendarPreferences());
      if (event.key === GOOGLE_CALENDAR_ACCOUNT_KEY) {
        const account = loadGoogleCalendarAccountMeta();

        setGoogleCalendarAccount({
          checking: false,
          connected: Boolean(account?.accountId),
          accountId: account?.accountId || "",
        });
      }
      googleCalendarEventsCacheRef.current.clear();
      setGoogleCalendarEvents((currentState) => ({
        ...currentState,
        events: [],
        lastLoadedAt: "",
        message: "",
        error: "",
        requestKey: "",
      }));
    }

    window.addEventListener("storage", handleStorageChange);

    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    return () => {
      activeEventsRequestRef.current.controller?.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function checkCalendarAccountSession() {
      try {
        const response = await fetch("/api/google-calendar/session", {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });
        const result = await response.json().catch(() => null);
        const accountId =
          response.ok && result?.connected === true
            ? getGoogleCalendarAccountId(result)
            : "";

        if (!isActive) return;

        if (!accountId) {
          reconcileGoogleCalendarAccountStorage("");
          setGoogleCalendarAccount({
            checking: false,
            connected: false,
            accountId: "",
          });
          setGoogleCalendarPreferences({});
          clearGoogleCalendarEventState(
            "Connect Google Calendar in Settings to show events."
          );
          return;
        }

        const accountScope =
          reconcileGoogleCalendarAccountStorage(accountId);

        setGoogleCalendarAccount({
          checking: false,
          connected: true,
          accountId,
        });

        if (accountScope.cleared) {
          setGoogleCalendarPreferences({});
          clearGoogleCalendarEventState(
            "Load calendars in Settings to show events."
          );
          return;
        }

        setGoogleCalendarPreferences(loadGoogleCalendarPreferences());
      } catch (error) {
        if (error?.name === "AbortError" || !isActive) return;

        reconcileGoogleCalendarAccountStorage("");
        setGoogleCalendarAccount({
          checking: false,
          connected: false,
          accountId: "",
        });
        setGoogleCalendarPreferences({});
        clearGoogleCalendarEventState(
          "Connect Google Calendar in Settings to show events."
        );
      }
    }

    checkCalendarAccountSession();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  async function loadGoogleCalendarEvents({
    quiet = false,
    bypassCache = false,
  } = {}) {
    const requestKey = googleCalendarRequestKey;

    activeEventsRequestRef.current.controller?.abort();

    if (googleCalendarAccount.checking) return;

    if (!googleCalendarAccount.connected || !googleCalendarAccount.accountId) {
      activeEventsRequestRef.current = {
        id: activeEventsRequestRef.current.id + 1,
        key: requestKey,
        controller: null,
      };
      googleCalendarEventsCacheRef.current.clear();
      setGoogleCalendarEvents({
        loading: false,
        events: [],
        lastLoadedAt: "",
        message: "Connect Google Calendar in Settings to show events.",
        error: "",
        requestKey,
      });
      return;
    }

    if (selectedGoogleCalendarIds.length === 0) {
      activeEventsRequestRef.current = {
        id: activeEventsRequestRef.current.id + 1,
        key: requestKey,
        controller: null,
      };
      setGoogleCalendarEvents({
        loading: false,
        events: [],
        lastLoadedAt: "",
        message: "Choose calendars in Settings to show events here.",
        error: "",
        requestKey,
      });
      return;
    }

    if (!eventRangeStart || !eventRangeEnd) return;

    if (!bypassCache && googleCalendarEventsCacheRef.current.has(requestKey)) {
      setGoogleCalendarEvents({
        ...googleCalendarEventsCacheRef.current.get(requestKey),
        loading: false,
        requestKey,
      });
      return;
    }

    const rangeStart = new Date(
      eventRangeStart.getFullYear(),
      eventRangeStart.getMonth(),
      eventRangeStart.getDate()
    );
    const rangeEnd = new Date(
      eventRangeEnd.getFullYear(),
      eventRangeEnd.getMonth(),
      eventRangeEnd.getDate() + 1
    );
    const controller = new AbortController();
    const requestId = activeEventsRequestRef.current.id + 1;

    activeEventsRequestRef.current = {
      id: requestId,
      key: requestKey,
      controller,
    };

    setGoogleCalendarEvents((currentState) => ({
      ...currentState,
      loading: true,
      events: currentState.requestKey === requestKey ? currentState.events : [],
      message: quiet ? currentState.message : "Loading schedule...",
      error: "",
      requestKey,
    }));

    try {
      const response = await fetch("/api/google-calendar/events", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          accountId: googleCalendarAccount.accountId,
          selectedCalendarIds: selectedGoogleCalendarIds,
          timeMin: rangeStart.toISOString(),
          timeMax: rangeEnd.toISOString(),
        }),
      });
      const result = await response.json();

      if (
        activeEventsRequestRef.current.id !== requestId ||
        activeEventsRequestRef.current.key !== requestKey
      ) {
        return;
      }

      if (!response.ok || result.ok !== true) {
        setGoogleCalendarEvents((currentState) => ({
          ...currentState,
          loading: false,
          events: [],
          message: "",
          error:
            result.status === "no_calendar_session" ||
            result.status === "calendar_session_invalid_or_expired"
              ? "Reconnect Google Calendar to show events."
              : result.message || "Calendar events are unavailable.",
          requestKey,
        }));
        if (
          result.status === "no_calendar_session" ||
          result.status === "calendar_session_invalid_or_expired" ||
          result.status === "calendar_session_reconnect_required" ||
          result.status === "calendar_account_changed"
        ) {
          const nextAccountId =
            result.status === "calendar_account_changed"
              ? getGoogleCalendarAccountId(result)
              : "";

          reconcileGoogleCalendarAccountStorage(nextAccountId);
          setGoogleCalendarAccount({
            checking: false,
            connected: Boolean(nextAccountId),
            accountId: nextAccountId,
          });
          setGoogleCalendarPreferences({});
          googleCalendarEventsCacheRef.current.clear();
        }
        return;
      }

      const responseAccountId = getGoogleCalendarAccountId(result);

      if (
        responseAccountId &&
        responseAccountId !== googleCalendarAccount.accountId
      ) {
        reconcileGoogleCalendarAccountStorage(responseAccountId);
        setGoogleCalendarAccount({
          checking: false,
          connected: true,
          accountId: responseAccountId,
        });
        setGoogleCalendarPreferences({});
        clearGoogleCalendarEventState(
          "Calendar account changed. Load calendars in Settings again."
        );
        return;
      }

      const loadedEvents = Array.isArray(result.events) ? result.events : [];
      const selectedCalendarIdSet = new Set(selectedGoogleCalendarIds);
      const eventsWithPreferences = loadedEvents.flatMap((event) => {
        const calendarId =
          typeof event?.calendarId === "string" ? event.calendarId : "";
        const preference = googleCalendarPreferenceMap[calendarId];

        if (!calendarId || !selectedCalendarIdSet.has(calendarId)) {
          return [];
        }

        if (!preference) return [];

        if (
          event.accountId &&
          event.accountId !== googleCalendarAccount.accountId
        ) {
          return [];
        }

        return [
          {
            ...event,
            calendarName:
              event.calendarName ||
              preference.calendarName ||
              "Google Calendar",
            duplicateRisk: preference.duplicateRisk || null,
          },
        ];
      });
      const nextEventState = {
        loading: false,
        events: eventsWithPreferences,
        lastLoadedAt: new Date().toISOString(),
        message:
          eventsWithPreferences.length > 0
            ? `${eventsWithPreferences.length} calendar event${
                eventsWithPreferences.length === 1 ? "" : "s"
              } loaded.`
            : "No Google Calendar events in this view.",
        error: "",
        requestKey,
      };

      googleCalendarEventsCacheRef.current.set(requestKey, nextEventState);
      setGoogleCalendarEvents(nextEventState);
    } catch (error) {
      if (error?.name === "AbortError") return;

      if (
        activeEventsRequestRef.current.id !== requestId ||
        activeEventsRequestRef.current.key !== requestKey
      ) {
        return;
      }

      setGoogleCalendarEvents((currentState) => ({
        ...currentState,
        loading: false,
        events: [],
        message: "",
        error: "Calendar events are unavailable.",
        requestKey,
      }));
    }
  }

  useEffect(() => {
    loadGoogleCalendarEvents({ quiet: true });
  }, [googleCalendarAccount.checking, googleCalendarRequestKey]);

  function changeMonth(offset) {
    const nextMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + offset,
      1
    );
    setVisibleMonth(nextMonth);
    setSelectedDate(formatDateKey(nextMonth));
  }

  function showToday() {
    const currentDate = new Date();
    setVisibleMonth(
      new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    );
    setSelectedDate(formatDateKey(currentDate));
  }

  function selectCalendarDay(day) {
    setSelectedDate(day.dateKey);

    if (showCalendarTaskForm) {
      setCalendarTaskDraft((currentDraft) => ({
        ...currentDraft,
        dueDate: day.dateKey,
      }));
    }

    if (!day.isCurrentMonth) {
      setVisibleMonth(
        new Date(day.date.getFullYear(), day.date.getMonth(), 1)
      );
    }
  }

  function openCalendarTaskForm() {
    setCalendarTaskDraft(createCalendarTaskDraft(selectedDate));
    setShowCalendarTaskForm(true);
  }

  function submitCalendarTask(event) {
    event.preventDefault();

    if (!addTaskToList(calendarTaskDraft)) return;

    const taskDate = parseDateKey(calendarTaskDraft.dueDate);
    setSelectedDate(calendarTaskDraft.dueDate);
    setVisibleMonth(
      new Date(taskDate.getFullYear(), taskDate.getMonth(), 1)
    );
    setShowCalendarTaskForm(false);
  }

  return (
    <div className="page calendar-page">
      <header className="page-header calendar-page-header">
        <div>
          <p className="eyebrow">Calendar</p>
          <h2>School calendar</h2>
          <p>Due dates from your tasks and Classroom imports.</p>
        </div>

        <div className="calendar-colour-toggle" aria-label="Calendar dot colour mode">
          <span>Colour by</span>
          <div>
            <button
              type="button"
              className={dotColourMode === "subject" ? "active" : ""}
              aria-pressed={dotColourMode === "subject"}
              onClick={() => setDotColourMode("subject")}
            >
              Subject
            </button>
            <button
              type="button"
              className={dotColourMode === "effort" ? "active" : ""}
              aria-pressed={dotColourMode === "effort"}
              onClick={() => setDotColourMode("effort")}
            >
              Effort
            </button>
          </div>
        </div>
      </header>

      <div className="calendar-layout">
        <section className="panel calendar-month-panel">
          <div className="calendar-toolbar">
            <div>
              <p className="section-label">Month</p>
              <h3>
                {visibleMonth.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </h3>
            </div>

            <div className="calendar-navigation" aria-label="Calendar navigation">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => changeMonth(-1)}
              >
                ←
              </button>
              <button type="button" onClick={showToday}>
                Today
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => changeMonth(1)}
              >
                →
              </button>
            </div>
          </div>

          <div className="calendar-weekdays" aria-hidden="true">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (weekday) => (
                <span key={weekday}>{weekday}</span>
              )
            )}
          </div>

          <div className="calendar-grid">
            {calendarDays.map((day) => {
              const dayEvents = calendarEvents.filter(
                (event) => event.date === day.dateKey
              );
              const activeDayEvents = dayEvents.filter(
                (event) => !event.completed
              );
              const assessmentCount = activeDayEvents.filter(
                isAssessmentCalendarEvent
              ).length;
              const dayGoogleCalendarEvents = visibleGoogleCalendarEvents.filter(
                (event) => googleEventOccursOnDate(event, day.dateKey)
              );
              const visibleEventBars = dayGoogleCalendarEvents.slice(
                0,
                googleCalendarEventLimit
              );
              const hiddenEventCount = Math.max(
                0,
                dayGoogleCalendarEvents.length - visibleEventBars.length
              );
              const isSelected = day.dateKey === selectedDate;

              return (
                <button
                  type="button"
                  key={day.dateKey}
                  className={`calendar-day ${
                    day.isCurrentMonth ? "" : "outside-month"
                  } ${day.isToday ? "today" : ""} ${
                    isSelected ? "selected" : ""
                  }`}
                  aria-pressed={isSelected}
                  aria-label={`${day.date.toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                  })}, ${formatDueCount(activeDayEvents.length)}${
                    assessmentCount > 0
                      ? `, ${assessmentCount} assessment${
                          assessmentCount === 1 ? "" : "s"
                        }`
                      : ""
                  }, ${dayGoogleCalendarEvents.length} calendar event${
                    dayGoogleCalendarEvents.length === 1 ? "" : "s"
                  }`}
                  onClick={() => selectCalendarDay(day)}
                >
                  <span className="calendar-day-number">{day.date.getDate()}</span>

                  {visibleEventBars.length > 0 && (
                    <>
                      <span className="calendar-google-events" aria-hidden="true">
                        {visibleEventBars.map((event) => (
                          <span
                            className="calendar-google-event-bar"
                            key={`${event.calendarId}-${event.id}-${day.dateKey}`}
                            style={getGoogleCalendarEventStyle(event)}
                            title={`${event.title} · ${event.calendarName}`}
                          >
                            <span>{event.title}</span>
                          </span>
                        ))}
                        {hiddenEventCount > 0 && (
                          <small className="calendar-google-event-overflow">
                            +{hiddenEventCount} more
                          </small>
                        )}
                      </span>

                      <span className="calendar-google-event-mobile-summary" aria-hidden="true">
                        {visibleEventBars.map((event) => (
                          <i
                            key={`${event.calendarId}-${event.id}-${day.dateKey}-dot`}
                            style={getGoogleCalendarEventStyle(event)}
                          />
                        ))}
                        {hiddenEventCount > 0 ? (
                          <small>+{hiddenEventCount}</small>
                        ) : dayGoogleCalendarEvents.length > 1 ? (
                          <small>{dayGoogleCalendarEvents.length}</small>
                        ) : (
                          <small>Event</small>
                        )}
                      </span>
                    </>
                  )}

                  {activeDayEvents.length > 0 && (
                    <span className="calendar-task-dots" aria-hidden="true">
                      <span
                        className={`calendar-deadline-summary ${
                          assessmentCount > 0 ? "has-assessment" : ""
                        }`}
                        data-colour-mode={dotColourMode}
                        style={getCalendarDeadlineSummaryStyle(
                          activeDayEvents,
                          dotColourMode
                        )}
                        title={`${formatDueCount(activeDayEvents.length)}${
                          assessmentCount > 0
                            ? ` · ${assessmentCount} assessment${
                                assessmentCount === 1 ? "" : "s"
                              }`
                            : ""
                        }`}
                      >
                        {assessmentCount > 0 && (
                          <span
                            className="calendar-deadline-assessment-mark"
                            aria-hidden="true"
                          />
                        )}
                        <span className="calendar-deadline-label-desktop">
                          {getCalendarDeadlineSummaryLabel(activeDayEvents)}
                        </span>
                        <span className="calendar-deadline-label-mobile">
                          {getCalendarMobileDeadlineSummaryLabel(activeDayEvents)}
                        </span>
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="panel calendar-detail-panel">
          <div className="calendar-detail-header">
            <div>
              <p className="section-label">Selected day</p>
              <h3>
                {selectedDateValue.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
            </div>
            <div className="calendar-detail-actions">
              <span>{formatSelectedTaskCount(selectedEvents.length)}</span>
              <span>{formatSelectedEventCount(selectedScheduleEvents.length)}</span>
              <button type="button" onClick={openCalendarTaskForm}>
                + Add task
              </button>
            </div>
          </div>

          {showCalendarTaskForm && (
            <form
              className="calendar-add-task-form"
              onSubmit={submitCalendarTask}
            >
              <div className="calendar-form-grid">
                <label>
                  <span>Subject</span>
                  <SubjectField
                    subjects={subjects}
                    value={calendarTaskDraft.subject}
                    placeholder="e.g. Chemistry"
                    onChange={(subject) =>
                      setCalendarTaskDraft({
                        ...calendarTaskDraft,
                        subject,
                      })
                    }
                  />
                </label>

                <label>
                  <span>Task title</span>
                  <input
                    type="text"
                    value={calendarTaskDraft.title}
                    placeholder="Assignment title"
                    required
                    onChange={(event) =>
                      setCalendarTaskDraft(
                        updateTaskTitleWithDetection(
                          calendarTaskDraft,
                          event.target.value
                        )
                      )
                    }
                  />
                </label>

                <label>
                  <span>Due date</span>
                  <input
                    type="date"
                    value={calendarTaskDraft.dueDate}
                    required
                    onChange={(event) =>
                      setCalendarTaskDraft({
                        ...calendarTaskDraft,
                        dueDate: event.target.value,
                      })
                    }
                  />
                </label>
              </div>

              <TaskClassificationFields
                task={calendarTaskDraft}
                onChange={setCalendarTaskDraft}
              />

              <div className="calendar-effort-row">
                <span>Effort</span>
                <div>
                  {[1, 2, 3, 4, 5].map((number) => (
                    <button
                      key={number}
                      type="button"
                      className={
                        calendarTaskDraft.effort === number
                          ? `effort-button selected ${getEffortClass(number)}`
                          : `effort-button ${getEffortClass(number)}`
                      }
                      onClick={() =>
                        setCalendarTaskDraft({
                          ...calendarTaskDraft,
                          effort: number,
                        })
                      }
                    >
                      {number}
                    </button>
                  ))}
                </div>
              </div>

              <div className="calendar-form-actions">
                <button className="primary-button" type="submit">
                  Add task
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setShowCalendarTaskForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <section className="calendar-detail-section">
            <div className="calendar-detail-section-heading">
              <h4>Tasks due</h4>
            </div>

            {selectedEvents.length > 0 ? (
              <div className="calendar-task-list">
                {selectedEvents.map((event) => {
                  const daysLeft = getDaysLeft(event.date);
                  const signalBadges = getTaskSignalBadges(event);
                  const effortLevel = getCalendarEffortLevel(event);
                  const hasClassroomSource = [
                    "classroom",
                    "classroom-mock",
                  ].includes(event.taskSource);

                  return (
                    <button
                      type="button"
                      className={`calendar-task-item ${
                        event.completed ? "completed" : ""
                      } ${event.subjectColour ? "has-subject-colour" : ""}`}
                      data-source={event.source}
                      key={event.id}
                      style={
                        event.subjectColour
                          ? { "--subject-color": event.subjectColour }
                          : undefined
                      }
                      onClick={() => setActivePage("tasks")}
                    >
                      <span>
                        <small>{event.subject}</small>
                        <strong>{event.title}</strong>
                        {(signalBadges.length > 0 || hasClassroomSource) && (
                          <span className="task-signal-badges">
                            <TaskSourceBadge task={event} />
                            {signalBadges.map((badge) => (
                              <span
                                className={`task-signal-badge task-signal-${badge.tone}`}
                                key={`${badge.tone}-${badge.label}`}
                              >
                                {badge.label}
                              </span>
                            ))}
                          </span>
                        )}
                        <span className="calendar-effort-summary">
                          <span
                            className={`calendar-effort-chip calendar-effort-${effortLevel}`}
                          >
                            {effortLabels[effortLevel]} effort
                          </span>
                        </span>
                      </span>
                      <span
                        className={
                          event.completed
                            ? "calendar-task-status completed"
                            : `calendar-task-status urgency ${getUrgencyClass(
                                daysLeft
                              )}`
                        }
                      >
                        {event.completed
                          ? "Completed"
                          : getUrgencyLabel(daysLeft)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="calendar-empty-state calendar-empty-state-compact">
                <h3>
                  {calendarEvents.length === 0
                    ? "No due dates yet."
                    : "No tasks due."}
                </h3>
                <p>
                  {calendarEvents.length === 0
                    ? "Add a due date to see it here."
                    : "Pick another day or add a task."}
                </p>
              </div>
            )}
          </section>

          <section className="calendar-detail-section">
            <div className="calendar-detail-section-heading">
              <h4>Schedule</h4>
              <button
                type="button"
                onClick={() =>
                  loadGoogleCalendarEvents({ bypassCache: true })
                }
                disabled={
                  googleCalendarEvents.loading ||
                  selectedGoogleCalendarIds.length === 0
                }
              >
                {googleCalendarEvents.loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {googleCalendarEvents.error ? (
              <div className="calendar-empty-state">
                <h3>Events unavailable</h3>
                <p>{googleCalendarEvents.error}</p>
              </div>
            ) : selectedGoogleCalendarIds.length === 0 ? (
              <div className="calendar-empty-state">
                <h3>No calendars selected.</h3>
                <p>Choose calendars in Settings to show events here.</p>
              </div>
            ) : selectedScheduleEvents.length > 0 ? (
              <div className="calendar-google-event-list">
                {selectedScheduleEvents.map((event) => (
                  <article
                    className="calendar-google-event-item"
                    key={`${event.calendarId}-${event.id}-${getGoogleEventDateKey(event)}`}
                    style={getGoogleCalendarEventStyle(event)}
                  >
                    <span className="calendar-google-event-time">
                      {getCalendarEventTimeLabel(event)}
                    </span>
                    <span>
                      <strong>{event.title}</strong>
                      <small>
                        {event.calendarName}
                        {event.location ? ` · ${event.location}` : ""}
                      </small>
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="calendar-empty-state">
                <h3>
                  {googleCalendarEvents.loading
                    ? "Loading events..."
                    : "No events scheduled."}
                </h3>
                <p>
                  {googleCalendarEvents.loading
                    ? "Reading selected calendars."
                    : "Selected calendars have no events on this day."}
                </p>
              </div>
            )}
          </section>

          <button
            type="button"
            className="secondary-button calendar-open-tasks"
            onClick={() => setActivePage("tasks")}
          >
            Open to-do list
          </button>
        </aside>
      </div>
    </div>
  );
}

export default CalendarPage;
