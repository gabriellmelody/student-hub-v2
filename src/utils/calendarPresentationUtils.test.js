import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getMonthDayPresentation,
  getMonthGoogleEvents,
  getWeekDayPresentation,
  googleEventMatchesClassroomTask,
  isRecurringTimedGoogleEvent,
  shouldHideCompletedClassroomEvent,
} from "./calendarPresentationUtils.js";

const DUE_DATE = "2026-08-20";

function classroomTask(overrides = {}) {
  return {
    source: "classroom",
    externalId: "course-12345:work-67890",
    classroomCourseId: "course-12345",
    classroomCourseName: "IB Biology",
    title: "Cell respiration questions",
    dueDate: DUE_DATE,
    alternateLink:
      "https://classroom.google.com/c/course-12345/a/work-67890/details",
    completed: false,
    classroomStatusCategory: "active",
    submissionState: "NEW",
    ...overrides,
  };
}

function googleEvent(overrides = {}) {
  return {
    id: "event-1",
    title: "Assignment: Cell respiration questions",
    start: `${DUE_DATE}T09:00:00+07:00`,
    end: `${DUE_DATE}T10:00:00+07:00`,
    allDay: false,
    recurringEventId: "",
    description: "",
    duplicateRisk: {
      source: "classroom",
      classroomCourseId: "course-12345",
      classroomCourseName: "IB Biology",
    },
    ...overrides,
  };
}

test("active Classroom assignment Calendar events remain visible", () => {
  const task = classroomTask();
  const event = googleEvent({
    description: `Course course-12345, coursework work-67890`,
  });

  assert.equal(
    shouldHideCompletedClassroomEvent(event, [task], [DUE_DATE]),
    false
  );
});

test("completed Classroom assignments matched by strong identifiers are hidden", () => {
  const task = classroomTask({ completed: true });
  const event = googleEvent({
    description: `Course course-12345, coursework work-67890`,
  });

  assert.equal(
    shouldHideCompletedClassroomEvent(event, [task], [DUE_DATE]),
    true
  );
});

test("turned-in Classroom tasks hide events matched by assignment URL", () => {
  const task = classroomTask({ submissionState: "TURNED_IN" });
  const event = googleEvent({
    description: `<a href="${task.alternateLink}">View assignment</a>`,
  });

  assert.equal(
    shouldHideCompletedClassroomEvent(event, [task], [DUE_DATE]),
    true
  );
});

test("a completed manual task never hides a Google event", () => {
  const task = {
    ...classroomTask({ completed: true }),
    source: "manual",
  };
  assert.equal(
    shouldHideCompletedClassroomEvent(googleEvent(), [task], [DUE_DATE]),
    false
  );
});

test("a similar-title ordinary Google event remains visible", () => {
  const event = googleEvent({ duplicateRisk: null });
  const task = classroomTask({ completed: true });

  assert.equal(googleEventMatchesClassroomTask(event, task, DUE_DATE), false);
  assert.equal(
    shouldHideCompletedClassroomEvent(event, [task], [DUE_DATE]),
    false
  );
});

test("title, date and course fallback is deliberately conservative", () => {
  const task = classroomTask({ completed: true, alternateLink: "" });
  const matchingEvent = googleEvent();
  const otherCourseEvent = googleEvent({
    duplicateRisk: {
      source: "classroom",
      classroomCourseId: "other-course",
    },
  });

  assert.equal(
    googleEventMatchesClassroomTask(matchingEvent, task, DUE_DATE),
    true
  );
  assert.equal(
    googleEventMatchesClassroomTask(matchingEvent, task, "2026-08-21"),
    false
  );
  assert.equal(
    googleEventMatchesClassroomTask(otherCourseEvent, task, DUE_DATE),
    false
  );
});

test("Month hides recurring timed schedule instances by default", () => {
  const recurringClass = googleEvent({ recurringEventId: "series-1" });
  assert.equal(isRecurringTimedGoogleEvent(recurringClass), true);
  assert.deepEqual(getMonthGoogleEvents([recurringClass]), []);
});

test("Month keeps a one-off timed Google event", () => {
  const appointment = googleEvent({
    id: "appointment",
    title: "Dentist",
    duplicateRisk: null,
  });
  assert.deepEqual(getMonthGoogleEvents([appointment]), [appointment]);
});

test("Month keeps recurring all-day holidays", () => {
  const holiday = googleEvent({
    id: "holiday",
    title: "School holiday",
    allDay: true,
    start: DUE_DATE,
    end: "2026-08-21",
    recurringEventId: "holiday-series",
    duplicateRisk: null,
  });
  assert.equal(isRecurringTimedGoogleEvent(holiday), false);
  assert.deepEqual(getMonthGoogleEvents([holiday]), [holiday]);
});

test("Month presentation always retains its task deadline indicators", () => {
  const tasks = [{ id: "task-1" }, { id: "task-2" }];
  const events = [googleEvent(), googleEvent({ id: "event-2" })];
  const presentation = getMonthDayPresentation(tasks, events);

  assert.deepEqual(presentation.tasks, tasks);
  assert.equal(presentation.googleEvents.length, 2);
});

test("dense Month presentation orders all-day events, Tasks and timed events", () => {
  const allDay = googleEvent({ id: "holiday", allDay: true, start: DUE_DATE, end: "2026-08-21" });
  const timed = googleEvent({ id: "lesson" });
  const tasks = [{ id: "task-1" }, { id: "task-2" }];
  const presentation = getMonthDayPresentation(tasks, [timed, allDay], {
    itemLimit: 3,
  });

  assert.deepEqual(presentation.allDayEvents, [allDay]);
  assert.deepEqual(presentation.tasks, tasks);
  assert.deepEqual(presentation.timedEvents, []);
  assert.equal(presentation.hiddenItemCount, 1);
});

test("Week deadline area keeps date-only Tasks separate from timed events", () => {
  const task = { id: "task-1", dueTime: "" };
  const allDay = googleEvent({ id: "all-day", allDay: true, start: DUE_DATE, end: "2026-08-21" });
  const timed = googleEvent({ id: "timed" });
  const presentation = getWeekDayPresentation(
    { tasks: [task], googleEvents: [timed, allDay] },
    { itemLimit: 3 }
  );

  assert.deepEqual(presentation.allDayEvents, [allDay]);
  assert.deepEqual(presentation.tasks, [task]);
  assert.deepEqual(presentation.timedEvents, [timed]);
});

test("Show class schedule restores recurring Month events", () => {
  const recurringClass = googleEvent({ recurringEventId: "series-1" });
  assert.deepEqual(
    getMonthGoogleEvents([recurringClass], { showClassSchedule: true }),
    [recurringClass]
  );
});

test("Week keeps recurring timetable events", () => {
  const recurringClass = googleEvent({ recurringEventId: "series-1" });
  const presentation = getWeekDayPresentation({
    tasks: [],
    googleEvents: [recurringClass],
  });
  assert.deepEqual(presentation.googleEvents, [recurringClass]);
});

test("Week keeps every task before capping Google events", () => {
  const tasks = Array.from({ length: 5 }, (_, index) => ({ id: `task-${index}` }));
  const googleEvents = Array.from({ length: 4 }, (_, index) => ({
    id: `event-${index}`,
  }));
  const presentation = getWeekDayPresentation({ tasks, googleEvents });

  assert.deepEqual(presentation.tasks, tasks);
  assert.deepEqual(presentation.googleEvents, googleEvents.slice(0, 2));
  assert.equal(presentation.hiddenGoogleEventCount, 2);
});

test("overflow excludes Month schedule events hidden by the default filter", () => {
  const events = [
    googleEvent({ id: "class", recurringEventId: "series-1" }),
    googleEvent({ id: "one" }),
    googleEvent({ id: "two" }),
    googleEvent({ id: "three" }),
  ];
  const filteredEvents = getMonthGoogleEvents(events);
  const presentation = getMonthDayPresentation([], filteredEvents);

  assert.equal(filteredEvents.length, 3);
  assert.equal(presentation.hiddenGoogleEventCount, 1);
});

test("global Hide Google events overrides the Month schedule toggle", () => {
  const recurringClass = googleEvent({ recurringEventId: "series-1" });
  assert.deepEqual(
    getMonthGoogleEvents([recurringClass], {
      showGoogleEvents: false,
      showClassSchedule: true,
    }),
    []
  );
});

test("Selected Day keeps Tasks due before the complete Schedule section", () => {
  const source = readFileSync(new URL("../pages/CalendarPage.jsx", import.meta.url), "utf8");
  const tasksHeadingIndex = source.indexOf("<h4>Tasks due</h4>");
  const scheduleHeadingIndex = source.indexOf("<h4>Schedule</h4>");

  assert.ok(tasksHeadingIndex > 0);
  assert.ok(scheduleHeadingIndex > tasksHeadingIndex);
  assert.match(source, /selectedScheduleEvents = displayedGoogleCalendarEvents\.filter/);
});

test("Calendar API remains read-only and exposes recurrence metadata", () => {
  const source = readFileSync(
    new URL("../../server/google-calendar/events.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /recurringEventId/);
  assert.match(source, /htmlLink/);
  assert.doesNotMatch(source, /method:\s*["'](?:DELETE|PATCH|PUT)["']/i);
  assert.doesNotMatch(source, /events\.(?:delete|patch|update|insert)/i);
});

test("existing Calendar navigation remains intact", () => {
  const source = readFileSync(new URL("../pages/CalendarPage.jsx", import.meta.url), "utf8");
  assert.match(source, /changeCalendarPeriod\(-1\)/);
  assert.match(source, /changeCalendarPeriod\(1\)/);
  assert.match(source, /onClick=\{showToday\}/);
  assert.match(source, /changeCalendarView\("week"\)/);
  assert.match(source, /changeCalendarView\("month"\)/);
});

test("Calendar visual redesign keeps Month, Week, sources and detail interactions distinct", () => {
  const source = readFileSync(new URL("../pages/CalendarPage.jsx", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

  assert.match(source, /className="calendar-mini"/);
  assert.match(source, /calendar-source-section/);
  assert.match(source, /visibleGoogleCalendarPreferences\.map/);
  assert.match(source, /role="tablist" aria-label="Calendar view"/);
  assert.match(source, /aria-selected=\{calendarView === "month"\}/);
  assert.match(source, /aria-selected=\{calendarView === "week"\}/);
  assert.match(source, /calendar-task-block/);
  assert.match(source, /calendar-all-day-event/);
  assert.match(source, /calendar-timed-event/);
  assert.match(source, /calendar-week-deadline-area/);
  assert.match(source, /\+\{monthPresentation\.hiddenItemCount\} more/);
  assert.match(source, /openCalendarTask\(task\)/);
  assert.match(source, /setSelectedGoogleEvent\(event\)/);
  assert.match(appSource, /<CalendarPage[\s\S]*openTaskDetails=/);
});

test("academic Task blocks expose compact Formative, Summative and CFA indicators", () => {
  const source = readFileSync(new URL("../pages/CalendarPage.jsx", import.meta.url), "utf8");

  assert.match(source, /return \{ short: "CFA", label: "CFA" \}/);
  assert.match(source, /return \{ short: "S", label: "Summative" \}/);
  assert.match(source, /return \{ short: "F", label: "Formative" \}/);
  assert.match(source, /aria-label=\{indicator\.label\}/);
});

test("date-only Tasks never invent midnight and timed Tasks render their real due time", () => {
  const source = readFileSync(new URL("../pages/CalendarPage.jsx", import.meta.url), "utf8");
  const appUtilsSource = readFileSync(new URL("./appUtils.js", import.meta.url), "utf8");

  assert.match(source, /if \(!task\?\.dueTime\) return ""/);
  assert.match(source, /\{dueTime && <small>\{dueTime\}<\/small>\}/);
  assert.doesNotMatch(source, /12:00\s*(?:am|AM)/);
  assert.match(appUtilsSource, /dueTime: task\.dueTime \|\| ""/);
});

test("Calendar source filters remain display-only local state", () => {
  const source = readFileSync(new URL("../pages/CalendarPage.jsx", import.meta.url), "utf8");

  assert.match(source, /hiddenGoogleCalendarIds/);
  assert.match(source, /showDayLoTasks/);
  assert.match(source, /displayedGoogleCalendarEvents/);
  assert.doesNotMatch(source, /localStorage\.setItem\([^)]*hiddenGoogleCalendarIds/);
});

test("Calendar styling uses theme tokens and responsive internal scrolling", () => {
  const styles = readFileSync(new URL("../styles/calendar.css", import.meta.url), "utf8");

  assert.match(styles, /\.calendar-workspace\s*\{[\s\S]*grid-template-columns: 220px minmax\(0, 1fr\)/);
  assert.match(styles, /\.calendar-task-block\s*\{[\s\S]*--calendar-task-color/);
  assert.match(styles, /\.calendar-timed-event\s*\{[\s\S]*grid-template-columns/);
  assert.match(styles, /\.calendar-month-scroll\s*\{[\s\S]*overflow-x: auto/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.calendar-sidebar\.is-open/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.calendar-week-grid/);
  assert.match(styles, /var\(--surface-raised\)/);
  assert.match(styles, /var\(--text\)/);
});

test("Calendar remains click-based and introduces no drag or resize behavior", () => {
  const source = readFileSync(new URL("../pages/CalendarPage.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /draggable=|onDrag|onDrop|resize/i);
});
