import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  formatHomeDate,
  getHomeGreeting,
  getHomeRecommendationItems,
  getHomeUpcomingTasks,
  sortHomeCalendarEvents,
} from "./homeDashboardUtils.js";

test("greeting follows the local time of day", () => {
  assert.equal(getHomeGreeting(new Date(2026, 10, 11, 8)), "Good morning");
  assert.equal(getHomeGreeting(new Date(2026, 10, 11, 14)), "Good afternoon");
  assert.equal(getHomeGreeting(new Date(2026, 10, 11, 20)), "Good evening");
  assert.match(formatHomeDate(new Date(2026, 10, 11)), /, 11 /);
});

test("Home shows two primary recommendations and keeps the rest behind disclosure", () => {
  const result = getHomeRecommendationItems({
    primary: [{ id: "one" }, { id: "two" }, { id: "ignored" }],
    finishEarly: { id: "finish" },
    extra: [{ id: "extra" }],
  });
  assert.deepEqual(result.primary.map((item) => item.id), ["one", "two"]);
  assert.deepEqual(result.additional.map((item) => item.id), ["finish", "extra"]);
});

test("Coming Up includes active homework and assessments but excludes inactive work", () => {
  const result = getHomeUpcomingTasks(
    [
      { id: "homework", title: "Essay", subject: "English", dueDate: "2026-11-12", taskType: "homework" },
      { id: "assessment", title: "Test", subject: "Maths", dueDate: "2026-11-13", taskType: "assessment", assessmentClassification: "summative" },
      { id: "done", title: "Done", dueDate: "2026-11-11", completed: true },
      { id: "archived", title: "Archived", dueDate: "2026-11-11", archived: true },
    ],
    [],
    new Date(2026, 10, 11)
  );
  assert.deepEqual(result.map((task) => task.id), ["homework", "assessment"]);
});

test("Calendar events put all-day items before upcoming timed events", () => {
  const result = sortHomeCalendarEvents([
    { id: "late", start: "2026-11-11T10:15:00+07:00" },
    { id: "all-day", start: "2026-11-11", allDay: true },
    { id: "early", start: "2026-11-11T07:25:00+07:00" },
  ]);
  assert.deepEqual(result.map((event) => event.id), ["all-day", "early", "late"]);
});

test("Home integration removes legacy sections and preserves direct existing flows", () => {
  const page = fs.readFileSync(new URL("../pages/HomePage.jsx", import.meta.url), "utf8");
  const styles = fs.readFileSync(new URL("../styles/home.css", import.meta.url), "utf8");
  assert.doesNotMatch(page, /Smart Planner|WeeklyProgressArc|home-week-strip/);
  assert.match(page, /Today's Plan/);
  assert.match(page, /Today's Calendar/);
  assert.match(page, /Coming Up/);
  assert.match(page, /Quick Access/);
  assert.match(page, /home-plan-more/);
  assert.match(page, /event\.allDay \? "All day"/);
  assert.match(page, /formatEventStart\(event\.start\)/);
  assert.match(page, /hiddenCalendarEventCount/);
  assert.match(page, /openTaskDetails/);
  assert.match(page, /openIntegrations/);
  assert.doesNotMatch(page, /localStorage/);
  assert.match(styles, /\.home-overview-top/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\)/);
});

