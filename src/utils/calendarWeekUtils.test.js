import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCalendarWeekRange,
  getCalendarViewAnchor,
  getCalendarWeekDays,
  getCalendarWeekStart,
  getInitialGoogleEventsVisibility,
  getTodayCalendarWeek,
  groupCalendarItemsByDate,
  moveCalendarWeek,
} from "./calendarWeekUtils.js";

function keys(days) {
  return days.map((day) => day.dateKey);
}

test("week ranges always run Monday through Sunday", () => {
  assert.deepEqual(keys(getCalendarWeekDays(new Date(2026, 6, 31))), [
    "2026-07-27",
    "2026-07-28",
    "2026-07-29",
    "2026-07-30",
    "2026-07-31",
    "2026-08-01",
    "2026-08-02",
  ]);
});

test("previous and next navigation moves exactly one week", () => {
  const anchor = new Date(2026, 6, 31);

  assert.equal(
    getCalendarWeekStart(moveCalendarWeek(anchor, -1)).getDate(),
    20
  );
  assert.equal(
    getCalendarWeekStart(moveCalendarWeek(anchor, 1)).getDate(),
    3
  );
});

test("Today returns to the current Monday-Sunday week", () => {
  const todayWeek = getTodayCalendarWeek(new Date(2026, 6, 31));

  assert.equal(todayWeek.getFullYear(), 2026);
  assert.equal(todayWeek.getMonth(), 6);
  assert.equal(todayWeek.getDate(), 27);
});

test("week headings handle a month boundary", () => {
  assert.equal(formatCalendarWeekRange(new Date(2026, 6, 31), "en-US"), "Jul 27–Aug 2");
});

test("week headings handle a year boundary", () => {
  assert.equal(formatCalendarWeekRange(new Date(2026, 7, 5), "en-US"), "Aug 3–9");
  assert.equal(formatCalendarWeekRange(new Date(2026, 11, 31), "en-US"), "Dec 28–Jan 3, 2027");
});

test("week ranges preserve leap day without timezone drift", () => {
  assert.deepEqual(keys(getCalendarWeekDays(new Date(2024, 1, 29))), [
    "2024-02-26",
    "2024-02-27",
    "2024-02-28",
    "2024-02-29",
    "2024-03-01",
    "2024-03-02",
    "2024-03-03",
  ]);
});

test("tasks remain attached to their date keys", () => {
  const dateKeys = ["2026-07-31", "2026-08-01"];
  const task = { id: "task-1", date: "2026-07-31" };
  const grouped = groupCalendarItemsByDate({
    dateKeys,
    taskEvents: [task],
    getGoogleEventDateKeys: (item) => item.dates,
  });

  assert.deepEqual(grouped["2026-07-31"].tasks, [task]);
});

test("Google events remain attached to their date keys", () => {
  const dateKeys = ["2026-07-31", "2026-08-01"];
  const event = { id: "event-1", dates: ["2026-08-01"] };
  const grouped = groupCalendarItemsByDate({
    dateKeys,
    googleEvents: [event],
    getGoogleEventDateKeys: (item) => item.dates,
  });

  assert.deepEqual(grouped["2026-08-01"].googleEvents, [event]);
});

test("hiding Google events leaves tasks and source preference data unchanged", () => {
  const dateKeys = ["2026-07-31"];
  const task = { id: "task-1", date: "2026-07-31" };
  const event = { id: "event-1", dates: ["2026-07-31"] };
  const preferences = { calendar: { useAsBusyTime: true } };
  const grouped = groupCalendarItemsByDate({
    dateKeys,
    taskEvents: [task],
    googleEvents: [event],
    getGoogleEventDateKeys: (item) => item.dates,
    showGoogleEvents: false,
  });

  assert.deepEqual(grouped["2026-07-31"].tasks, [task]);
  assert.deepEqual(grouped["2026-07-31"].googleEvents, []);
  assert.equal(event.id, "event-1");
  assert.equal(preferences.calendar.useAsBusyTime, true);
});

test("Google events are shown by default on fresh initialization", () => {
  assert.equal(getInitialGoogleEventsVisibility(), true);
});

test("switching Week and Month preserves the selected date", () => {
  const selectedDate = new Date(2026, 6, 31);
  const weekAnchor = getCalendarViewAnchor({
    view: "week",
    selectedDate,
  });
  const monthAnchor = getCalendarViewAnchor({
    view: "month",
    selectedDate,
  });

  assert.equal(keys(getCalendarWeekDays(weekAnchor))[4], "2026-07-31");
  assert.equal(monthAnchor.getMonth(), selectedDate.getMonth());
});
