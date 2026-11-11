function normalizeMatchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAssignmentTitle(value) {
  return normalizeMatchText(
    String(value || "").replace(/^\s*(?:assignment|homework)\s*:\s*/i, "")
  );
}

function getEventMetadataText(event) {
  return [
    event?.id,
    event?.htmlLink,
    event?.description,
    event?.location,
    event?.iCalUID,
    event?.sourceUrl,
    JSON.stringify(event?.extendedProperties || {}),
  ]
    .filter(Boolean)
    .join(" ");
}

function getIdentifierTokens(value) {
  return String(value || "")
    .split(":")
    .map((part) => part.trim())
    .filter((part) => part.length >= 5);
}

function metadataContainsToken(metadata, token) {
  if (!token) return false;
  return metadata.includes(token) || metadata.includes(encodeURIComponent(token));
}

function getComparableUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return "";
  }
}

export function isCompletedClassroomTask(task) {
  if (task?.source !== "classroom") return false;
  if (task.completed === true) return true;

  const statusCategory = String(task.classroomStatusCategory || "").toLowerCase();
  const submissionState = String(task.submissionState || "").toUpperCase();

  return (
    ["done", "returned", "turned_in", "submitted", "completed"].includes(
      statusCategory
    ) || ["TURNED_IN", "RETURNED"].includes(submissionState)
  );
}

export function googleEventMatchesClassroomTask(event, task, dateKey = "") {
  if (task?.source !== "classroom") return false;

  const metadata = getEventMetadataText(event);
  const externalTokens = getIdentifierTokens(task.externalId);
  if (
    externalTokens.length >= 2 &&
    externalTokens.every((token) => metadataContainsToken(metadata, token))
  ) {
    return true;
  }

  const alternateLink = getComparableUrl(task.alternateLink);
  if (alternateLink && getComparableUrl(metadata).includes(alternateLink)) {
    return true;
  }
  if (alternateLink && metadata.toLowerCase().includes(alternateLink)) {
    return true;
  }

  const duplicateRisk = event?.duplicateRisk;
  const taskCourseId = String(task.classroomCourseId || "");
  const eventCourseId = String(duplicateRisk?.classroomCourseId || "");
  const sameKnownCourse =
    duplicateRisk?.source === "classroom" &&
    taskCourseId &&
    eventCourseId === taskCourseId;

  return Boolean(
    sameKnownCourse &&
      dateKey &&
      task.dueDate === dateKey &&
      normalizeAssignmentTitle(event?.title) &&
      normalizeAssignmentTitle(event?.title) === normalizeAssignmentTitle(task.title)
  );
}

export function shouldHideCompletedClassroomEvent(event, tasks, eventDateKeys) {
  const dateKeys = Array.isArray(eventDateKeys) ? eventDateKeys : [];

  return (Array.isArray(tasks) ? tasks : []).some((task) => {
    if (!isCompletedClassroomTask(task)) return false;

    if (googleEventMatchesClassroomTask(event, task)) return true;
    return dateKeys.some((dateKey) =>
      googleEventMatchesClassroomTask(event, task, dateKey)
    );
  });
}

export function isRecurringTimedGoogleEvent(event) {
  return Boolean(event?.recurringEventId && event.allDay !== true);
}

export function getMonthGoogleEvents(
  events,
  { showGoogleEvents = true, showClassSchedule = false } = {}
) {
  if (!showGoogleEvents) return [];
  if (showClassSchedule) return Array.isArray(events) ? events : [];

  return (Array.isArray(events) ? events : []).filter(
    (event) => !isRecurringTimedGoogleEvent(event)
  );
}

export function getWeekDayPresentation(
  dayItems,
  { googleEventLimit = 2, itemLimit = null } = {}
) {
  const tasks = Array.isArray(dayItems?.tasks) ? dayItems.tasks : [];
  const googleEvents = Array.isArray(dayItems?.googleEvents)
    ? dayItems.googleEvents
    : [];
  const allDayEvents = googleEvents.filter((event) => event?.allDay === true);
  const timedEvents = googleEvents.filter((event) => event?.allDay !== true);

  if (Number.isFinite(itemLimit)) {
    const orderedItems = [
      ...allDayEvents.map((item) => ({ kind: "all-day", item })),
      ...tasks.map((item) => ({ kind: "task", item })),
      ...timedEvents.map((item) => ({ kind: "timed", item })),
    ];
    const visibleItems = orderedItems.slice(0, Math.max(0, itemLimit));
    const visibleAllDayEvents = visibleItems
      .filter((entry) => entry.kind === "all-day")
      .map((entry) => entry.item);
    const visibleTasks = visibleItems
      .filter((entry) => entry.kind === "task")
      .map((entry) => entry.item);
    const visibleTimedEvents = visibleItems
      .filter((entry) => entry.kind === "timed")
      .map((entry) => entry.item);

    return {
      tasks: visibleTasks,
      allDayEvents: visibleAllDayEvents,
      timedEvents: visibleTimedEvents,
      googleEvents: [...visibleAllDayEvents, ...visibleTimedEvents],
      hiddenItemCount: Math.max(0, orderedItems.length - visibleItems.length),
      hiddenGoogleEventCount: Math.max(
        0,
        googleEvents.length - visibleAllDayEvents.length - visibleTimedEvents.length
      ),
    };
  }

  const visibleGoogleEvents = googleEvents.slice(0, googleEventLimit);

  return {
    tasks,
    allDayEvents: visibleGoogleEvents.filter((event) => event?.allDay === true),
    timedEvents: visibleGoogleEvents.filter((event) => event?.allDay !== true),
    googleEvents: visibleGoogleEvents,
    hiddenItemCount: Math.max(
      0,
      googleEvents.length - visibleGoogleEvents.length
    ),
    hiddenGoogleEventCount: Math.max(
      0,
      googleEvents.length - visibleGoogleEvents.length
    ),
  };
}

export function getMonthDayPresentation(
  taskEvents,
  googleEvents,
  { googleEventLimit = 2, itemLimit = null } = {}
) {
  const tasks = Array.isArray(taskEvents) ? taskEvents : [];
  const events = Array.isArray(googleEvents) ? googleEvents : [];
  const allDayEvents = events.filter((event) => event?.allDay === true);
  const timedEvents = events.filter((event) => event?.allDay !== true);

  if (Number.isFinite(itemLimit)) {
    const orderedItems = [
      ...allDayEvents.map((item) => ({ kind: "all-day", item })),
      ...tasks.map((item) => ({ kind: "task", item })),
      ...timedEvents.map((item) => ({ kind: "timed", item })),
    ];
    const visibleItems = orderedItems.slice(0, Math.max(0, itemLimit));
    const visibleAllDayEvents = visibleItems
      .filter((entry) => entry.kind === "all-day")
      .map((entry) => entry.item);
    const visibleTasks = visibleItems
      .filter((entry) => entry.kind === "task")
      .map((entry) => entry.item);
    const visibleTimedEvents = visibleItems
      .filter((entry) => entry.kind === "timed")
      .map((entry) => entry.item);

    return {
      tasks: visibleTasks,
      allDayEvents: visibleAllDayEvents,
      timedEvents: visibleTimedEvents,
      googleEvents: [...visibleAllDayEvents, ...visibleTimedEvents],
      hiddenItemCount: Math.max(0, orderedItems.length - visibleItems.length),
      hiddenGoogleEventCount: Math.max(
        0,
        events.length - visibleAllDayEvents.length - visibleTimedEvents.length
      ),
    };
  }

  const visibleGoogleEvents = events.slice(0, googleEventLimit);

  return {
    tasks,
    allDayEvents: visibleGoogleEvents.filter((event) => event?.allDay === true),
    timedEvents: visibleGoogleEvents.filter((event) => event?.allDay !== true),
    googleEvents: visibleGoogleEvents,
    hiddenItemCount: Math.max(0, events.length - visibleGoogleEvents.length),
    hiddenGoogleEventCount: Math.max(0, events.length - visibleGoogleEvents.length),
  };
}
