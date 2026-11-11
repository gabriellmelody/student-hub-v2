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
import {
  formatCalendarWeekRange,
  getCalendarViewAnchor,
  getCalendarWeekDays,
  getCalendarWeekStart,
  getInitialGoogleEventsVisibility,
  groupCalendarItemsByDate,
  moveCalendarWeek,
} from "../utils/calendarWeekUtils.js";
import {
  getMonthDayPresentation,
  getMonthGoogleEvents,
  getWeekDayPresentation,
  shouldHideCompletedClassroomEvent,
} from "../utils/calendarPresentationUtils.js";
import { getIntegrationAuthHeaders } from "../utils/integrationAuthUtils.js";

const monthCalendarItemLimit = 4;
const weekCalendarItemLimit = 6;

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

function getCalendarEventStartLabel(event) {
  if (event.allDay) return "All day";
  const startDate = new Date(event.start);
  if (!Number.isFinite(startDate.getTime())) return "";
  return startDate.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getGoogleCalendarEventStyle(event) {
  return {
    "--calendar-event-color":
      event.backgroundColor || event.calendarColor || "var(--accent-soft)",
  };
}

function getCalendarTaskStyle(task, colourMode = "subject") {
  const deadlineStyle = getCalendarDeadlineSummaryStyle([task], colourMode);
  return {
    "--calendar-task-color":
      deadlineStyle?.["--calendar-deadline-color"] || "var(--accent-soft)",
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

function getAssessmentCalendarIndicator(event) {
  if (!isAssessmentCalendarEvent(event)) return null;
  const label = getAssessmentCalendarLabel(event);
  const normalized = label.toLowerCase();
  if (normalized.includes("common formative") || normalized === "cfa") {
    return { short: "CFA", label: "CFA" };
  }
  if (normalized.includes("summative")) return { short: "S", label: "Summative" };
  if (normalized.includes("formative")) return { short: "F", label: "Formative" };
  return { short: "A", label };
}

function formatTaskDueTime(task) {
  if (!task?.dueTime) return "";
  const [hours, minutes] = String(task.dueTime).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return "";
  const date = new Date(2026, 0, 1, hours, minutes);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
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
  if (count === 1) return "1 task due";
  return `${count} tasks due`;
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

function CalendarPage({
  authAccessToken = "",
  tasks,
  classroomTasks = tasks,
  subjects,
  setActivePage,
  addTaskToList,
  openTaskDetails,
}) {
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [calendarView, setCalendarView] = useState("month");
  const [visibleWeekStart, setVisibleWeekStart] = useState(() =>
    getCalendarWeekStart(today)
  );
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(today));
  const [dotColourMode, setDotColourMode] = useState("subject");
  const [showGoogleEvents, setShowGoogleEvents] = useState(
    getInitialGoogleEventsVisibility
  );
  const [showClassSchedule, setShowClassSchedule] = useState(false);
  const [showDayLoTasks, setShowDayLoTasks] = useState(true);
  const [hiddenGoogleCalendarIds, setHiddenGoogleCalendarIds] = useState(
    () => new Set()
  );
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [selectedDayOpen, setSelectedDayOpen] = useState(false);
  const [selectedGoogleEvent, setSelectedGoogleEvent] = useState(null);
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
  const selectedWeekDayRef = useRef(null);
  const googleCalendarEventsCacheRef = useRef(new Map());
  const calendarEvents = getTaskCalendarEvents(tasks, subjects);
  const displayedTaskEvents = showDayLoTasks
    ? calendarEvents.filter((event) => !event.completed)
    : [];
  const calendarDays = getMonthCalendarDays(visibleMonth);
  const selectedDateValue = parseDateKey(selectedDate);
  const miniCalendarMonth =
    calendarView === "week"
      ? new Date(selectedDateValue.getFullYear(), selectedDateValue.getMonth(), 1)
      : visibleMonth;
  const miniCalendarDays = getMonthCalendarDays(miniCalendarMonth);
  const calendarWeekDays = getCalendarWeekDays(visibleWeekStart, today);
  const visibleCalendarDays =
    calendarView === "week" ? calendarWeekDays : calendarDays;
  const selectedEvents = displayedTaskEvents.filter(
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
  const eventRangeStart = visibleCalendarDays[0]?.date;
  const eventRangeEnd = visibleCalendarDays[visibleCalendarDays.length - 1]?.date;
  const eventRangeStartKey = visibleCalendarDays[0]?.dateKey || "";
  const eventRangeEndKey =
    visibleCalendarDays[visibleCalendarDays.length - 1]?.dateKey || "";
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
      return !shouldHideCompletedClassroomEvent(
        event,
        classroomTasks,
        getGoogleEventDayKeys(event)
      );
    });
  }, [classroomTasks, currentViewGoogleCalendarEvents]);
  const displayedGoogleCalendarEvents = showGoogleEvents
    ? visibleGoogleCalendarEvents.filter(
        (event) => !hiddenGoogleCalendarIds.has(event.calendarId)
      )
    : [];
  const monthGoogleCalendarEvents = getMonthGoogleEvents(
    displayedGoogleCalendarEvents,
    { showGoogleEvents: true, showClassSchedule }
  );
  const selectedScheduleEvents = displayedGoogleCalendarEvents.filter((event) =>
    googleEventOccursOnDate(event, selectedDate)
  );
  const weekItemsByDate = useMemo(
    () =>
      groupCalendarItemsByDate({
        dateKeys: calendarWeekDays.map((day) => day.dateKey),
        taskEvents: displayedTaskEvents,
        googleEvents: displayedGoogleCalendarEvents,
        getGoogleEventDateKeys: getGoogleEventDayKeys,
        showGoogleEvents: true,
      }),
    [
      calendarWeekDays,
      displayedGoogleCalendarEvents,
      displayedTaskEvents,
    ]
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
          headers: getIntegrationAuthHeaders(authAccessToken, {
            Accept: "application/json",
          }),
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
        headers: getIntegrationAuthHeaders(authAccessToken, {
          Accept: "application/json",
          "Content-Type": "application/json",
        }),
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

  useEffect(() => {
    if (calendarView !== "week" || !selectedWeekDayRef.current) return undefined;

    const frame = requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 900px)").matches) {
        selectedWeekDayRef.current?.scrollIntoView({
          behavior: "auto",
          block: "nearest",
          inline: "center",
        });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [calendarView, selectedDate, visibleWeekStart]);

  function changeMonth(offset) {
    const nextMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + offset,
      1
    );
    setVisibleMonth(nextMonth);
    setSelectedDate(formatDateKey(nextMonth));
  }

  function changeWeek(offset) {
    const selectedDateValue = parseDateKey(selectedDate);
    const nextSelectedDate = new Date(
      selectedDateValue.getFullYear(),
      selectedDateValue.getMonth(),
      selectedDateValue.getDate() + offset * 7
    );

    setVisibleWeekStart(moveCalendarWeek(visibleWeekStart, offset));
    setSelectedDate(formatDateKey(nextSelectedDate));
  }

  function changeCalendarPeriod(offset) {
    if (calendarView === "week") {
      changeWeek(offset);
      return;
    }

    changeMonth(offset);
  }

  function showToday() {
    const currentDate = new Date();
    setVisibleMonth(
      new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    );
    setVisibleWeekStart(getCalendarWeekStart(currentDate));
    setSelectedDate(formatDateKey(currentDate));
  }

  function changeMiniMonth(offset) {
    const nextMonth = new Date(
      miniCalendarMonth.getFullYear(),
      miniCalendarMonth.getMonth() + offset,
      1
    );
    setVisibleMonth(nextMonth);
    setVisibleWeekStart(getCalendarWeekStart(nextMonth));
    setSelectedDate(formatDateKey(nextMonth));
  }

  function toggleGoogleCalendarSource(calendarId) {
    setHiddenGoogleCalendarIds((current) => {
      const next = new Set(current);
      if (next.has(calendarId)) next.delete(calendarId);
      else next.add(calendarId);
      return next;
    });
  }

  function openCalendarTask(task) {
    if (typeof openTaskDetails === "function" && task?.taskId) {
      openTaskDetails(task.taskId);
      return;
    }
    setActivePage("tasks");
  }

  function openSelectedDay(day) {
    selectCalendarDay(day);
    setSelectedDayOpen(true);
  }

  function openGoogleEvent(event, day) {
    if (day) selectCalendarDay(day);
    setSelectedGoogleEvent(event);
  }

  function changeCalendarView(nextView) {
    if (nextView === calendarView) return;

    const selectedDateValue = parseDateKey(selectedDate);
    const nextAnchor = getCalendarViewAnchor({
      view: nextView,
      selectedDate: selectedDateValue,
    });

    if (nextView === "week") {
      setVisibleWeekStart(nextAnchor);
    } else {
      setVisibleMonth(nextAnchor);
    }

    setCalendarView(nextView);
  }

  function selectCalendarDay(day) {
    setSelectedDate(day.dateKey);

    if (showCalendarTaskForm) {
      setCalendarTaskDraft((currentDraft) => ({
        ...currentDraft,
        dueDate: day.dateKey,
      }));
    }

    if (calendarView === "month" && !day.isCurrentMonth) {
      setVisibleMonth(
        new Date(day.date.getFullYear(), day.date.getMonth(), 1)
      );
    }
  }

  function openCalendarTaskForm() {
    setCalendarTaskDraft(createCalendarTaskDraft(selectedDate));
    setShowCalendarTaskForm(true);
    setSelectedDayOpen(true);
  }

  async function submitCalendarTask(event) {
    event.preventDefault();

    if (!(await addTaskToList(calendarTaskDraft))) return;

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
          <h2>Calendar</h2>
          <p>Deadlines and events, together in one place.</p>
        </div>
        <button
          type="button"
          className="calendar-sources-button"
          aria-expanded={sourcesOpen}
          aria-controls="calendar-sidebar-body"
          onClick={() => setSourcesOpen((current) => !current)}
        >
          Calendars
        </button>
      </header>

      <div className="calendar-workspace">
        <aside className={`panel calendar-sidebar ${sourcesOpen ? "is-open" : ""}`}>
          <div className="calendar-sidebar-heading">
            <strong>Calendars</strong>
            <button
              type="button"
              aria-label="Close calendar sources"
              onClick={() => setSourcesOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="calendar-sidebar-body" id="calendar-sidebar-body">
            <section className="calendar-mini" aria-label="Mini calendar">
              <header>
                <strong>
                  {miniCalendarMonth.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </strong>
                <span>
                  <button type="button" aria-label="Previous mini-calendar month" onClick={() => changeMiniMonth(-1)}>←</button>
                  <button type="button" aria-label="Next mini-calendar month" onClick={() => changeMiniMonth(1)}>→</button>
                </span>
              </header>
              <div className="calendar-mini-weekdays" aria-hidden="true">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
              </div>
              <div className="calendar-mini-grid">
                {miniCalendarDays.map((day) => (
                  <button
                    type="button"
                    key={`mini-${day.dateKey}`}
                    className={`${day.isCurrentMonth ? "" : "outside-month"} ${day.isToday ? "today" : ""} ${day.dateKey === selectedDate ? "selected" : ""}`}
                    aria-label={day.date.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
                    aria-pressed={day.dateKey === selectedDate}
                    onClick={() => selectCalendarDay(day)}
                  >
                    {day.date.getDate()}
                  </button>
                ))}
              </div>
            </section>

            <section className="calendar-source-section" aria-labelledby="daylo-calendar-sources">
              <h3 id="daylo-calendar-sources">DayLo</h3>
              <label className="calendar-source-row">
                <input type="checkbox" checked={showDayLoTasks} onChange={(event) => setShowDayLoTasks(event.target.checked)} />
                <i className="calendar-source-dot is-daylo" aria-hidden="true" />
                <span>Tasks</span>
              </label>
            </section>

            <section className="calendar-source-section" aria-labelledby="google-calendar-sources">
              <div className="calendar-source-heading">
                <h3 id="google-calendar-sources">Google Calendar</h3>
                <label className="calendar-source-master" title="Calendar display only">
                  <input type="checkbox" checked={showGoogleEvents} onChange={(event) => setShowGoogleEvents(event.target.checked)} />
                  <span>{showGoogleEvents ? "On" : "Off"}</span>
                </label>
              </div>
              {visibleGoogleCalendarPreferences.length > 0 ? (
                visibleGoogleCalendarPreferences.map((preference) => {
                  const sourceVisible = showGoogleEvents && !hiddenGoogleCalendarIds.has(preference.calendarId);
                  return (
                    <label className="calendar-source-row" key={preference.calendarId}>
                      <input
                        type="checkbox"
                        checked={sourceVisible}
                        disabled={!showGoogleEvents}
                        onChange={() => toggleGoogleCalendarSource(preference.calendarId)}
                      />
                      <i
                        className="calendar-source-dot"
                        aria-hidden="true"
                        style={{ "--calendar-source-color": preference.backgroundColor || preference.calendarColor || "var(--accent-soft)" }}
                      />
                      <span>{preference.calendarName || preference.summary || "Google Calendar"}</span>
                    </label>
                  );
                })
              ) : (
                <p className="calendar-source-empty">No calendars selected.</p>
              )}
              {showGoogleEvents && (
                <label className="calendar-source-row is-secondary">
                  <input type="checkbox" checked={showClassSchedule} onChange={(event) => setShowClassSchedule(event.target.checked)} />
                  <span>Show recurring classes in Month</span>
                </label>
              )}
            </section>

            <section className="calendar-colour-section" aria-labelledby="calendar-colour-heading">
              <h3 id="calendar-colour-heading">Task colours</h3>
              <div className="calendar-colour-toggle" aria-label="Calendar task colour mode">
                <button type="button" className={dotColourMode === "subject" ? "active" : ""} aria-pressed={dotColourMode === "subject"} onClick={() => setDotColourMode("subject")}>Subject</button>
                <button type="button" className={dotColourMode === "effort" ? "active" : ""} aria-pressed={dotColourMode === "effort"} onClick={() => setDotColourMode("effort")}>Effort</button>
              </div>
            </section>

            <section className="calendar-sidebar-selected" aria-label="Selected date summary">
              <span>Selected</span>
              <strong>{selectedDateValue.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</strong>
              <small>{formatSelectedTaskCount(selectedEvents.length)} · {formatSelectedEventCount(selectedScheduleEvents.length)}</small>
              <div>
                <button type="button" onClick={() => setSelectedDayOpen(true)}>View day</button>
                <button type="button" onClick={openCalendarTaskForm}>Add task</button>
              </div>
            </section>
          </div>
        </aside>

        <section
          className={`panel calendar-month-panel ${
            calendarView === "week" ? "calendar-week-panel" : ""
          }`}
          data-tour="calendar-overview"
        >
          <div className="calendar-toolbar">
            <div>
              <h3>
                {calendarView === "week"
                  ? formatCalendarWeekRange(visibleWeekStart)
                  : visibleMonth.toLocaleDateString(undefined, {
                      month: "long",
                      year: "numeric",
                    })}
              </h3>
            </div>

            <div className="calendar-navigation" aria-label="Calendar navigation">
              <button
                type="button"
                aria-label={`Previous ${calendarView}`}
                onClick={() => changeCalendarPeriod(-1)}
              >
                ←
              </button>
              <button type="button" onClick={showToday}>
                Today
              </button>
              <button
                type="button"
                aria-label={`Next ${calendarView}`}
                onClick={() => changeCalendarPeriod(1)}
              >
                →
              </button>
            </div>
                <div className="calendar-view-toggle" role="tablist" aria-label="Calendar view">
                  <button type="button" role="tab" aria-selected={calendarView === "month"} className={calendarView === "month" ? "active" : ""} onClick={() => changeCalendarView("month")}>Month</button>
                  <button type="button" role="tab" aria-selected={calendarView === "week"} className={calendarView === "week" ? "active" : ""} onClick={() => changeCalendarView("week")}>Week</button>
                </div>
          </div>

          {calendarView === "month" ? (
            <>
              <div className="calendar-month-scroll">
                <div className="calendar-weekdays" aria-hidden="true">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (weekday) => (
                      <span key={weekday}>{weekday}</span>
                    )
                  )}
                </div>

                <div className="calendar-grid">
                {calendarDays.map((day) => {
              const activeDayEvents = displayedTaskEvents.filter(
                (event) => event.date === day.dateKey
              );
              const assessmentCount = activeDayEvents.filter(
                isAssessmentCalendarEvent
              ).length;
              const dayGoogleCalendarEvents = monthGoogleCalendarEvents.filter(
                (event) => googleEventOccursOnDate(event, day.dateKey)
              );
              const monthPresentation = getMonthDayPresentation(
                activeDayEvents,
                dayGoogleCalendarEvents,
                { itemLimit: monthCalendarItemLimit }
              );
              const isSelected = day.dateKey === selectedDate;

                  return (
                <article
                  key={day.dateKey}
                  className={`calendar-day ${
                    day.isCurrentMonth ? "" : "outside-month"
                  } ${day.isToday ? "today" : ""} ${
                    isSelected ? "selected" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="calendar-day-heading"
                    aria-pressed={isSelected}
                    aria-label={`${day.date.toLocaleDateString(undefined, { month: "long", day: "numeric" })}, ${formatDueCount(activeDayEvents.length)}, ${dayGoogleCalendarEvents.length} calendar events`}
                    onClick={() => selectCalendarDay(day)}
                  >
                    <span className="calendar-day-number">{day.date.getDate()}</span>
                  </button>
                  <div className="calendar-day-content">
                    {monthPresentation.allDayEvents.map((event) => (
                      <button type="button" className="calendar-all-day-event" key={`all-day-${event.calendarId}-${event.id}-${day.dateKey}`} style={getGoogleCalendarEventStyle(event)} onClick={() => openGoogleEvent(event, day)} title={`${event.title} · All day`}>
                        <span>{event.title}</span>
                      </button>
                    ))}
                    {monthPresentation.tasks.map((task) => {
                      const indicator = getAssessmentCalendarIndicator(task);
                      const dueTime = formatTaskDueTime(task);
                      return (
                        <button type="button" className="calendar-task-block" key={task.id} style={getCalendarTaskStyle(task, dotColourMode)} onClick={() => openCalendarTask(task)} title={`${task.title}${indicator ? ` · ${indicator.label}` : ""}`}>
                          {dueTime && <small>{dueTime}</small>}
                          <span>{task.title}</span>
                          {indicator && <b aria-label={indicator.label} title={indicator.label}>{indicator.short}</b>}
                        </button>
                      );
                    })}
                    {monthPresentation.timedEvents.map((event) => (
                      <button type="button" className="calendar-timed-event" key={`timed-${event.calendarId}-${event.id}-${day.dateKey}`} style={getGoogleCalendarEventStyle(event)} onClick={() => openGoogleEvent(event, day)} title={`${getCalendarEventTimeLabel(event)} · ${event.title}`}>
                        <i aria-hidden="true" />
                        <small>{getCalendarEventStartLabel(event)}</small>
                        <span>{event.title}</span>
                      </button>
                    ))}
                    {monthPresentation.hiddenItemCount > 0 && (
                      <button type="button" className="calendar-day-more" onClick={() => openSelectedDay(day)}>+{monthPresentation.hiddenItemCount} more</button>
                    )}
                  </div>
                </article>
                  );
                })}
                </div>
              </div>
            </>
          ) : (
            <div
              className="calendar-week-scroll"
              aria-label={`Week of ${formatCalendarWeekRange(visibleWeekStart)}`}
            >
              <div className="calendar-week-grid">
                {calendarWeekDays.map((day) => {
                  const dayItems = weekItemsByDate[day.dateKey] || {
                    tasks: [],
                    googleEvents: [],
                  };
                  const weekPresentation = getWeekDayPresentation(dayItems, {
                    itemLimit: weekCalendarItemLimit,
                  });
                  const visibleTasks = weekPresentation.tasks;
                  const visibleAllDayEvents = weekPresentation.allDayEvents;
                  const visibleTimedEvents = weekPresentation.timedEvents;
                  const isSelected = day.dateKey === selectedDate;
                  const isEmptyDay =
                    dayItems.tasks.length === 0 &&
                    dayItems.googleEvents.length === 0;
                  const fullDateLabel = day.date.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  });

                  return (
                    <article
                      className={`calendar-week-day ${
                        day.isToday ? "today" : ""
                      } ${isSelected ? "selected" : ""} ${
                        isEmptyDay ? "empty" : "has-items"
                      }`}
                      key={day.dateKey}
                      onClick={() => selectCalendarDay(day)}
                      ref={isSelected ? selectedWeekDayRef : null}
                    >
                      <button
                        type="button"
                        className="calendar-week-day-heading"
                        aria-label={`${fullDateLabel}, ${formatDueCount(
                          dayItems.tasks.length
                        )}, ${formatSelectedEventCount(
                          dayItems.googleEvents.length
                        )}`}
                        aria-pressed={isSelected}
                        onClick={() => selectCalendarDay(day)}
                      >
                        <span>{day.weekday}</span>
                        <strong>{day.date.getDate()}</strong>
                        {(day.isToday || isSelected) && (
                          <small>
                            {day.isToday
                              ? `Today${isSelected ? " · Selected" : ""}`
                              : "Selected"}
                          </small>
                        )}
                      </button>

                      {!isEmptyDay && (
                        <div className="calendar-week-day-counts" aria-hidden="true">
                          {dayItems.tasks.length > 0 && (
                            <span>
                              {formatDueCount(dayItems.tasks.length, {
                                compact: true,
                              })}
                            </span>
                          )}
                          {dayItems.googleEvents.length > 0 && (
                            <span>
                              {dayItems.googleEvents.length} event
                              {dayItems.googleEvents.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                      )}

                      {(visibleAllDayEvents.length > 0 || visibleTasks.length > 0) && (
                        <section className="calendar-week-deadline-area" aria-label={`All-day events and deadlines ${fullDateLabel}`}>
                          {visibleAllDayEvents.map((event) => (
                            <button type="button" className="calendar-all-day-event" key={`week-all-${event.calendarId}-${event.id}-${day.dateKey}`} style={getGoogleCalendarEventStyle(event)} onClick={(clickEvent) => { clickEvent.stopPropagation(); openGoogleEvent(event, day); }}>
                              <span>{event.title}</span>
                            </button>
                          ))}
                          {visibleTasks.map((task) => {
                            const indicator = getAssessmentCalendarIndicator(task);
                            const dueTime = formatTaskDueTime(task);

                            return (
                              <button
                                type="button"
                                className="calendar-task-block calendar-week-task"
                                key={task.id}
                                style={getCalendarTaskStyle(task, dotColourMode)}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openCalendarTask(task);
                                }}
                              >
                                {dueTime && <small>{dueTime}</small>}
                                <span>{task.title}</span>
                                {indicator && <b aria-label={indicator.label} title={indicator.label}>{indicator.short}</b>}
                              </button>
                            );
                          })}
                        </section>
                      )}

                      {visibleTimedEvents.length > 0 && (
                        <section
                          className="calendar-week-items calendar-week-google-events"
                          aria-label={`Google Calendar events ${fullDateLabel}`}
                        >
                          {visibleTimedEvents.map((event) => (
                            <button
                              type="button"
                              className="calendar-timed-event calendar-week-google-event"
                              key={`${event.calendarId}-${event.id}-${day.dateKey}`}
                              style={getGoogleCalendarEventStyle(event)}
                              onClick={(clickEvent) => {
                                clickEvent.stopPropagation();
                                openGoogleEvent(event, day);
                              }}
                            >
                              <i aria-hidden="true" />
                              <small>{getCalendarEventTimeLabel(event)}</small>
                              <span>{event.title}</span>
                            </button>
                          ))}
                        </section>
                      )}

                      {weekPresentation.hiddenItemCount > 0 && (
                        <div className="calendar-week-overflow">
                          <button
                            type="button"
                            className="calendar-week-more"
                            onClick={(event) => {
                              event.stopPropagation();
                              openSelectedDay(day);
                            }}
                          >
                            +{weekPresentation.hiddenItemCount} more
                          </button>
                        </div>
                      )}

                      {visibleTasks.length === 0 && visibleAllDayEvents.length === 0 && visibleTimedEvents.length === 0 && (
                        <p className="calendar-week-empty">Nothing scheduled</p>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      {selectedDayOpen && (
        <div className="calendar-detail-layer" role="presentation">
          <button type="button" className="calendar-detail-backdrop" aria-label="Close selected day" onClick={() => { setSelectedDayOpen(false); setShowCalendarTaskForm(false); }} />
        <aside className="panel calendar-detail-panel" role="dialog" aria-modal="true" aria-labelledby="calendar-selected-day-title">
          <div className="calendar-detail-header">
            <div>
              <p className="section-label">Selected day</p>
              <h3 id="calendar-selected-day-title">
                {selectedDateValue.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
            </div>
            <button
              type="button"
              className="calendar-detail-close"
              aria-label="Close selected day"
              onClick={() => {
                setSelectedDayOpen(false);
                setShowCalendarTaskForm(false);
              }}
            >
              ×
            </button>
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

          <section
            className="calendar-detail-section"
            data-tour="calendar-task-deadlines"
          >
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
                      onClick={() => openCalendarTask(event)}
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

          <section
            className="calendar-detail-section"
            data-tour={
              selectedGoogleCalendarIds.length > 0
                ? "calendar-google-events"
                : undefined
            }
          >
            <div
              className="calendar-detail-section-heading"
              data-tour={
                selectedGoogleCalendarIds.length > 0
                  ? "calendar-busy-time"
                  : undefined
              }
            >
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

            {!showGoogleEvents ? (
              <div className="calendar-empty-state calendar-empty-state-compact">
                <h3>Google events hidden.</h3>
                <p>Turn on Show Google events to display this schedule.</p>
              </div>
            ) : googleCalendarEvents.error ? (
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
                  <button
                    type="button"
                    className="calendar-google-event-item"
                    key={`${event.calendarId}-${event.id}-${getGoogleEventDateKey(event)}`}
                    style={getGoogleCalendarEventStyle(event)}
                    onClick={() => setSelectedGoogleEvent(event)}
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
                  </button>
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
      )}

      {selectedGoogleEvent && (
        <div className="calendar-event-detail-layer" role="presentation">
          <button type="button" className="calendar-detail-backdrop" aria-label="Close event details" onClick={() => setSelectedGoogleEvent(null)} />
          <section className="calendar-event-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="calendar-event-detail-title" style={getGoogleCalendarEventStyle(selectedGoogleEvent)}>
            <header>
              <span><i aria-hidden="true" />{selectedGoogleEvent.allDay ? "All-day event" : "Calendar event"}</span>
              <button type="button" aria-label="Close event details" onClick={() => setSelectedGoogleEvent(null)}>×</button>
            </header>
            <h3 id="calendar-event-detail-title">{selectedGoogleEvent.title}</h3>
            <p>{getCalendarEventTimeLabel(selectedGoogleEvent)}</p>
            <dl>
              <div><dt>Calendar</dt><dd>{selectedGoogleEvent.calendarName || "Google Calendar"}</dd></div>
              {selectedGoogleEvent.location && <div><dt>Location</dt><dd>{selectedGoogleEvent.location}</dd></div>}
            </dl>
          </section>
        </div>
      )}
    </div>
  );
}

export default CalendarPage;
