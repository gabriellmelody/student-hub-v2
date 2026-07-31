import assert from "node:assert/strict";
import test from "node:test";

import {
  attachHomeWeekDateData,
  formatHomeWeekRange,
  getRollingHomeWeek,
} from "./homeWeekUtils.js";

test("today is always the fourth day in the rolling Home week", () => {
  const week = getRollingHomeWeek(new Date(2026, 6, 31, 15, 30));

  assert.equal(week.days.length, 7);
  assert.equal(week.days.findIndex((day) => day.isToday), 3);
  assert.equal(week.days[3].dateKey, "2026-07-31");
});

test("the rolling Home week crosses a month boundary correctly", () => {
  const week = getRollingHomeWeek(new Date(2026, 6, 31, 12));

  assert.deepEqual(
    week.days.map((day) => day.dateKey),
    [
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
    ]
  );
  assert.equal(formatHomeWeekRange(week.start, week.end, "en-US"), "Jul 28–Aug 3");
});

test("the rolling Home week crosses a year boundary correctly", () => {
  const week = getRollingHomeWeek(new Date(2027, 0, 1, 12));

  assert.equal(week.days[0].dateKey, "2026-12-29");
  assert.equal(week.days[6].dateKey, "2027-01-04");
  assert.equal(formatHomeWeekRange(week.start, week.end, "en-US"), "Dec 29–Jan 4");
});

test("task and event counts remain attached to their date keys", () => {
  const week = getRollingHomeWeek(new Date(2026, 6, 31, 12));
  const days = attachHomeWeekDateData(week.days, {
    tasks: [
      { id: "before", dueDate: "2026-07-30", completed: false },
      { id: "today", dueDate: "2026-07-31", completed: false },
      { id: "done", dueDate: "2026-07-31", completed: true },
      { id: "after", dueDate: "2026-08-02", completed: false },
    ],
    eventDateKeys: ["2026-07-28", "2026-07-31", "2026-07-31"],
  });

  const byDate = new Map(days.map((day) => [day.dateKey, day]));
  assert.equal(byDate.get("2026-07-30").count, 1);
  assert.equal(byDate.get("2026-07-31").count, 1);
  assert.equal(byDate.get("2026-08-02").count, 1);
  assert.equal(byDate.get("2026-07-28").eventCount, 1);
  assert.equal(byDate.get("2026-07-31").eventCount, 2);
});

test("same-month ranges omit the repeated month label", () => {
  const week = getRollingHomeWeek(new Date(2026, 7, 7, 12));

  assert.equal(formatHomeWeekRange(week.start, week.end, "en-US"), "Aug 4–10");
});
