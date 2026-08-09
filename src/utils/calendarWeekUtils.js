import { formatDateKey } from "./appUtils.js";

function cloneLocalDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getCalendarWeekStart(date) {
  const localDate = cloneLocalDate(date);
  const daysSinceMonday = (localDate.getDay() + 6) % 7;

  return new Date(
    localDate.getFullYear(),
    localDate.getMonth(),
    localDate.getDate() - daysSinceMonday
  );
}

export function getCalendarWeekDays(anchorDate, today = new Date()) {
  const weekStart = getCalendarWeekStart(anchorDate);
  const todayKey = formatDateKey(today);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(
      weekStart.getFullYear(),
      weekStart.getMonth(),
      weekStart.getDate() + index
    );

    return {
      date,
      dateKey: formatDateKey(date),
      isToday: formatDateKey(date) === todayKey,
      weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
    };
  });
}

export function moveCalendarWeek(anchorDate, offset) {
  const weekStart = getCalendarWeekStart(anchorDate);

  return new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + Number(offset || 0) * 7
  );
}

export function getTodayCalendarWeek(today = new Date()) {
  return getCalendarWeekStart(today);
}

export function formatCalendarWeekRange(anchorDate, locale) {
  const days = getCalendarWeekDays(anchorDate, anchorDate);
  const start = days[0].date;
  const end = days[6].date;
  const startMonth = start.toLocaleDateString(locale, { month: "short" });
  const endMonth = end.toLocaleDateString(locale, { month: "short" });
  const crossesYear = start.getFullYear() !== end.getFullYear();

  if (start.getMonth() === end.getMonth() && !crossesYear) {
    return `${startMonth} ${start.getDate()}–${end.getDate()}`;
  }

  return `${startMonth} ${start.getDate()}–${endMonth} ${end.getDate()}${
    crossesYear ? `, ${end.getFullYear()}` : ""
  }`;
}

export function groupCalendarItemsByDate({
  dateKeys,
  taskEvents = [],
  googleEvents = [],
  getGoogleEventDateKeys,
  showGoogleEvents = true,
}) {
  const grouped = Object.fromEntries(
    dateKeys.map((dateKey) => [dateKey, { tasks: [], googleEvents: [] }])
  );

  taskEvents.forEach((task) => {
    if (grouped[task.date]) grouped[task.date].tasks.push(task);
  });

  if (!showGoogleEvents) return grouped;

  googleEvents.forEach((event) => {
    const eventDateKeys = getGoogleEventDateKeys(event);

    eventDateKeys.forEach((dateKey) => {
      if (grouped[dateKey]) grouped[dateKey].googleEvents.push(event);
    });
  });

  return grouped;
}

export function getInitialGoogleEventsVisibility() {
  return true;
}

export function getCalendarViewAnchor({ view, selectedDate }) {
  if (view === "week") return getCalendarWeekStart(selectedDate);

  return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
}
