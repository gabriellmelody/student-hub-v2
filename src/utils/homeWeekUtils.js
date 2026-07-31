import { formatDateKey } from "./appUtils.js";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getStartOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

export function getRollingHomeWeek(referenceDate = new Date()) {
  const today = getStartOfDay(referenceDate);
  const todayKey = formatDateKey(today);
  const start = new Date(today);
  start.setDate(today.getDate() - 3);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateKey = formatDateKey(date);

    return {
      date,
      dateKey,
      label: WEEKDAY_LABELS[date.getDay()],
      isToday: dateKey === todayKey,
    };
  });

  return {
    start,
    end: days.at(-1).date,
    days,
  };
}

export function attachHomeWeekDateData(
  days,
  { tasks = [], eventDateKeys = [] } = {}
) {
  const eventCounts = eventDateKeys.reduce((counts, dateKey) => {
    counts.set(dateKey, (counts.get(dateKey) || 0) + 1);
    return counts;
  }, new Map());

  return days.map((day) => ({
    ...day,
    count: tasks.filter(
      (task) => !task.completed && task.dueDate === day.dateKey
    ).length,
    eventCount: eventCounts.get(day.dateKey) || 0,
  }));
}

export function formatHomeWeekRange(start, end, locale) {
  const startMonth = start.toLocaleDateString(locale, { month: "short" });
  const endMonth = end.toLocaleDateString(locale, { month: "short" });
  const startDay = start.getDate();
  const endDay = end.getDate();

  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()
  ) {
    return `${startMonth} ${startDay}–${endDay}`;
  }

  return `${startMonth} ${startDay}–${endMonth} ${endDay}`;
}
