import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildStudyRecommendations,
  clearUnlockedFutureRecommendationOverrides,
  createManualTaskStudyRecommendation,
  createRecommendationOverride,
  filterValidMoveOverrides,
  getDayStudyMinutes,
  getHorizonStudyMinutes,
  getNextAvailableOverrideSlot,
  getStudyWeekDays,
  getTaskStudyBlockCount,
  getValidTaskStudyDates,
  isRecommendationEligibleOnDate,
} from "./studyRecommendations.js";

const NOW = new Date(2026, 10, 9, 12, 0, 0);
const SUBJECTS = [
  { id: "maths", name: "Maths", colour: "#73a8df" },
  { id: "english", name: "English", colour: "#ffa36b" },
  { id: "biology", name: "Biology", colour: "#63b68a" },
];

function preferences(overrides = {}) {
  return {
    dailyStudyBlocks: 2,
    blockDurationMinutes: 45,
    weeklyRoutine: {
      monday: ["maths", "biology"],
      tuesday: ["english"],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    },
    ...overrides,
  };
}

function task(overrides = {}) {
  return {
    id: overrides.id || "task-1",
    title: "Homework",
    subject: "English",
    dueDate: "2026-11-10",
    effort: 2,
    importance: "normal",
    importanceSource: "manual",
    taskType: "homework",
    detectedTags: [],
    completed: false,
    archived: false,
    source: "manual",
    ...overrides,
  };
}

function assessment(overrides = {}) {
  return task({
    id: "assessment-1",
    title: "Biology assessment",
    subject: "Biology",
    dueDate: "2026-11-11",
    effort: 3,
    importance: "high",
    taskType: "assessment",
    detectedTags: ["Formative"],
    ...overrides,
  });
}

function build(tasks = [], preferenceOverrides = {}, now = NOW, options = {}) {
  return buildStudyRecommendations({
    tasks,
    subjects: SUBJECTS,
    preferences: preferences(preferenceOverrides),
    now,
    ...options,
  });
}

function visibleRecommendations(day) {
  return [...day.primary, ...(day.finishEarly ? [day.finishEarly] : []), ...day.extra];
}

test("Today and Next 7 Days use the same recommendation object", () => {
  const result = build([task()]);
  assert.equal(result.today, result.days.find((day) => day.isToday));
  assert.deepEqual(result.today.primary, result.days[0].primary);
});

test("no academic work uses the configured weekday routine", () => {
  const result = build();
  assert.deepEqual(result.today.primary.map((item) => item.title), [
    "Review today's Maths work",
    "Review today's Biology work",
  ]);
  assert.deepEqual(result.today.primary.map((item) => item.subject), ["Maths", "Biology"]);
  assert.ok(result.today.primary.every((item) => item.kind === "routine"));
  assert.ok(result.today.primary.every((item) => item.reason === "No urgent work · Review"));
});

test("fallback review wording is concise and subject-aware", () => {
  const result = build([], {
    weeklyRoutine: { monday: ["english"] },
  });
  assert.deepEqual(result.today.primary.map((item) => item.title), [
    "Review today's English notes or reading",
  ]);
});

test("urgent homework displaces routine slots without changing the routine", () => {
  const savedRoutine = preferences().weeklyRoutine;
  const oneTask = build([task()]);
  assert.deepEqual(oneTask.today.primary.map((item) => item.kind), ["homework", "routine"]);
  const twoTasks = build([task(), task({ id: "task-2", title: "Maths questions", subject: "Maths" })]);
  assert.ok(twoTasks.today.primary.every((item) => item.kind === "homework"));
  assert.deepEqual(preferences().weeklyRoutine, savedRoutine);
});

test("Wednesday assessment creates required Monday and Tuesday preparation only", () => {
  const result = build([assessment()]);
  assert.equal(result.days[0].primary[0].kind, "assessment");
  assert.equal(result.days[1].primary[0].kind, "assessment");
  assert.equal(result.days[2].primary.some((item) => item.kind === "assessment"), false);
  assert.ok(result.days[0].primary[0].reason.includes("Wednesday"));
});

test("Friday assessment creates Wednesday and Thursday preparation", () => {
  const result = build([assessment({ dueDate: "2026-11-13" })]);
  assert.equal(result.days[2].primary[0].kind, "assessment");
  assert.equal(result.days[3].primary[0].kind, "assessment");
});

test("Monday assessment creates Saturday and Sunday preparation", () => {
  const friday = new Date(2026, 10, 13, 12, 0, 0);
  const result = build(
    [assessment({ dueDate: "2026-11-16" })],
    { weeklyRoutine: {} },
    friday
  );
  assert.equal(result.days[1].primary[0].kind, "assessment");
  assert.equal(result.days[2].primary[0].kind, "assessment");
});

test("an assessment arriving one day early uses the remaining day", () => {
  const result = build([assessment({ dueDate: "2026-11-10" })]);
  assert.equal(result.today.primary.filter((item) => item.kind === "assessment").length, 1);
});

test("Formative, Summative and CFA use existing classification semantics", () => {
  const result = build([
    assessment({ id: "formative", title: "Formative test" }),
    assessment({ id: "summative", title: "Summative exam", detectedTags: ["Summative"] }),
    task({ id: "cfa", title: "Biology CFA", subject: "Biology", dueDate: "2026-11-11", importanceSource: "auto" }),
  ], { dailyStudyBlocks: 6, weeklyRoutine: {} });
  const mondayReasons = visibleRecommendations(result.days[0]).map((item) => item.reason);
  assert.ok(mondayReasons.some((reason) => reason.includes("Formative")));
  assert.ok(mondayReasons.some((reason) => reason.includes("Summative")));
  assert.ok(mondayReasons.some((reason) => reason.includes("CFA")));
});

test("completed and archived assessments are excluded", () => {
  const result = build([
    assessment({ id: "done", completed: true }),
    assessment({ id: "archived", archived: true }),
  ]);
  assert.equal(result.today.primary.some((item) => item.kind === "assessment"), false);
});

test("due-tomorrow and near-due homework outrank routine", () => {
  const result = build([
    task({ id: "tomorrow", title: "Essay" }),
    task({ id: "three-days", title: "Questions", dueDate: "2026-11-12" }),
  ]);
  assert.deepEqual(result.today.primary.map((item) => item.title), ["Essay", "Questions"]);
  assert.equal(result.today.primary[0].reason, "Due tomorrow");
});

test("an optional incomplete Task is reconsidered when it becomes due tomorrow", () => {
  const wednesday = new Date(2026, 10, 11, 12, 0, 0);
  const englishHomework = task({
    id: "english-friday",
    title: "English homework",
    dueDate: "2026-11-13",
  });
  const result = build([
    task({ id: "due-thursday-1", title: "Due tomorrow one", dueDate: "2026-11-12" }),
    task({ id: "due-thursday-2", title: "Due tomorrow two", dueDate: "2026-11-12" }),
    englishHomework,
  ], { weeklyRoutine: {} }, wednesday);
  const wednesdayPlan = result.days.find((day) => day.dateKey === "2026-11-11");
  const thursdayPlan = result.days.find((day) => day.dateKey === "2026-11-12");

  assert.equal(wednesdayPlan.finishEarly.taskId, englishHomework.id);
  assert.equal(thursdayPlan.primary[0].taskId, englishHomework.id);
  assert.equal(thursdayPlan.primary[0].reason, "Due tomorrow");
  assert.equal(
    visibleRecommendations(thursdayPlan).filter((item) => item.taskId === englishHomework.id).length,
    1
  );
});

test("completing a carried-forward Task removes every future recommendation", () => {
  const wednesday = new Date(2026, 10, 11, 12, 0, 0);
  const completed = task({
    id: "completed-friday",
    title: "Completed homework",
    dueDate: "2026-11-13",
    completed: true,
  });
  const result = build([completed], { weeklyRoutine: {} }, wednesday);

  assert.ok(result.days.every((day) =>
    visibleRecommendations(day).every((item) => item.taskId !== completed.id)
  ));
});

test("a manual swap does not consume a Task's later urgent recommendation", () => {
  const wednesday = new Date(2026, 10, 11, 12, 0, 0);
  const englishHomework = task({
    id: "swapped-friday",
    title: "Swapped English homework",
    dueDate: "2026-11-13",
  });
  const tasks = [
    task({ id: "swap-due-1", title: "Due tomorrow one", dueDate: "2026-11-12" }),
    task({ id: "swap-due-2", title: "Due tomorrow two", dueDate: "2026-11-12" }),
    englishHomework,
  ];
  const initial = build(tasks, { weeklyRoutine: {} }, wednesday);
  const override = createRecommendationOverride({
    dateKey: "2026-11-11",
    slotIndex: 0,
    recommendation: initial.today.finishEarly,
    manual: true,
  });
  const swapped = build(tasks, {
    weeklyRoutine: {},
    recommendationOverrides: [override],
  }, wednesday);
  const thursdayPlan = swapped.days.find((day) => day.dateKey === "2026-11-12");

  assert.equal(swapped.today.primary[0].taskId, englishHomework.id);
  assert.equal(swapped.today.primary[0].manualOverride, true);
  assert.equal(thursdayPlan.primary[0].taskId, englishHomework.id);
  assert.equal(thursdayPlan.primary[0].reason, "Due tomorrow");
});

test("far-away low-effort homework keeps routine while high-effort work may start", () => {
  const low = build([task({ dueDate: "2026-11-16", effort: 1 })]);
  assert.ok(low.today.primary.every((item) => item.kind === "routine"));
  const high = build([task({ dueDate: "2026-11-16", effort: 5 })]);
  assert.equal(high.today.primary[0].kind, "homework");
  assert.match(high.today.primary[0].reason, /High effort/);
});

test("effort maps to one, two or three deterministic occurrences", () => {
  assert.equal(getTaskStudyBlockCount({ effort: 1 }), 1);
  assert.equal(getTaskStudyBlockCount({ effort: 3 }), 2);
  assert.equal(getTaskStudyBlockCount({ effort: 5 }), 3);
  const result = build([task({ effort: 5, dueDate: "2026-11-12" })], { weeklyRoutine: {} });
  const occurrences = result.days.flatMap((day) => day.primary).filter((item) => item.taskId === "task-1");
  assert.equal(occurrences.length, 3);
  assert.equal(new Set(occurrences.map((item) => item.id)).size, 3);
  const shortWindow = build([
    task({ effort: 5, dueDate: "2026-11-10" }),
  ], { weeklyRoutine: {} });
  const shortWindowOccurrences = shortWindow.days
    .flatMap(visibleRecommendations)
    .filter((item) => item.taskId === "task-1");
  assert.equal(shortWindowOccurrences.length, 3);
});

test("normal capacity and overflow urgent work stay honest", () => {
  const result = build([
    assessment({ id: "maths", subject: "Maths" }),
    assessment({ id: "biology", subject: "Biology" }),
    task({ id: "english", title: "English essay" }),
  ], { weeklyRoutine: {} });
  assert.equal(result.today.primary.length, 2);
  assert.equal(result.today.extra.length, 1);
  assert.equal(result.today.extra[0].title, "English essay");
});

test("normal presentation uses two primary slots and one useful finish-early slot", () => {
  const tasks = [1, 2, 3, 4].map((number) => task({ id: `task-${number}`, title: `Task ${number}` }));
  const result = build(tasks, { dailyStudyBlocks: 4, weeklyRoutine: {} });
  assert.equal(result.today.primary.length, 2);
  assert.ok(result.today.extra.length >= 2);
  assert.equal(result.today.finishEarly, null);
});

test("configured duration is attached to every day without assigning clock times", () => {
  const result = build([], { blockDurationMinutes: 60 });
  assert.equal(result.blockDurationMinutes, 60);
  assert.ok(result.days.every((day) => day.blockDurationMinutes === 60));
  assert.equal("start" in result.today.primary[0], false);
  assert.equal("end" in result.today.primary[0], false);
});

test("task completion, due-date and assessment changes recalculate output", () => {
  const active = task({ title: "Essay" });
  assert.equal(build([active]).today.primary[0].title, "Essay");
  assert.equal(build([{ ...active, completed: true }]).today.primary.some((item) => item.taskId === active.id), false);
  assert.equal(build([{ ...active, dueDate: "2026-12-20" }]).today.primary.some((item) => item.taskId === active.id), false);
  assert.equal(build([{ ...active, taskType: "assessment", detectedTags: ["Formative"], dueDate: "2026-11-11" }]).today.primary[0].kind, "assessment");
});

test("routine Subject IDs resolve only against the current account Subjects", () => {
  const result = buildStudyRecommendations({
    tasks: [],
    subjects: [{ id: "current-user-subject", name: "Maths" }],
    preferences: preferences({ weeklyRoutine: { monday: ["other-user-subject", "current-user-subject"] } }),
    now: NOW,
  });
  assert.deepEqual(result.today.primary.map((item) => item.subjectId), ["current-user-subject"]);
});

test("Notes and My Lists sources are excluded from academic recommendations", () => {
  const result = build([
    task({ id: "note", source: "notes" }),
    task({ id: "list", source: "my-list" }),
  ]);
  assert.ok(result.today.primary.every((item) => item.kind === "routine"));
});

test("rolling seven-day boundaries remain stable near midnight", () => {
  const days = getStudyWeekDays(new Date(2026, 10, 11, 0, 5, 0));
  assert.equal(days[0].dateKey, "2026-11-11");
  assert.equal(days[6].dateKey, "2026-11-17");
  assert.equal(days.findIndex((day) => day.isToday), 0);
});

test("rolling horizon crosses calendar-week and month boundaries", () => {
  const days = getStudyWeekDays(new Date(2026, 10, 27, 23, 55, 0));
  assert.deepEqual(days.map((day) => day.dateKey), [
    "2026-11-27",
    "2026-11-28",
    "2026-11-29",
    "2026-11-30",
    "2026-12-01",
    "2026-12-02",
    "2026-12-03",
  ]);
});

test("a day may show one meaningful recommendation without filler", () => {
  const result = build(
    [task({ id: "only", title: "Only task", effort: 1 })],
    { weeklyRoutine: {} }
  );
  assert.deepEqual(result.today.primary.map((item) => item.title), ["Only task"]);
  assert.equal(result.today.finishEarly, null);
});

test("a day may show exactly two primary recommendations", () => {
  const result = build([
    task({ id: "first", title: "First" }),
    task({ id: "second", title: "Second" }),
  ], { weeklyRoutine: {} });
  assert.equal(result.today.primary.length, 2);
});

test("a useful lower-priority third item becomes If you finish early", () => {
  const result = build([
    task({ id: "urgent", title: "Urgent", dueDate: "2026-11-10" }),
    task({ id: "near", title: "Near", dueDate: "2026-11-12" }),
    task({ id: "later", title: "Later", dueDate: "2026-11-15", effort: 4 }),
  ], { weeklyRoutine: {} });
  assert.deepEqual(result.today.primary.map((item) => item.title), ["Urgent", "Near"]);
  assert.equal(result.today.finishEarly.title, "Later");
  assert.equal(result.today.extra.length, 0);
});

test("important assessments may start one day before mandatory preparation", () => {
  const result = build([
    assessment({ dueDate: "2026-11-13", importance: "high", effort: 4 }),
  ], { weeklyRoutine: {} });
  assert.match(result.days[1].primary[0].reason, /Start early/);
  assert.match(result.days[2].primary[0].reason, /Mandatory prep/);
  assert.match(result.days[3].primary[0].reason, /Mandatory prep/);
});

test("ordinary assessments do not automatically occupy an earlier third day", () => {
  const result = build([
    assessment({ dueDate: "2026-11-13", importance: "normal", effort: 2 }),
  ], { weeklyRoutine: {} });
  assert.equal(result.days[1].primary.some((item) => item.kind === "assessment"), false);
  assert.equal(result.days[2].primary[0].kind, "assessment");
  assert.equal(result.days[3].primary[0].kind, "assessment");
});

test("large homework keeps distributed work through the day before its deadline", () => {
  const result = build([
    task({ id: "essay", title: "Large essay", effort: 5, dueDate: "2026-11-13" }),
  ], { weeklyRoutine: {} });
  const dates = result.days.flatMap((day) =>
    visibleRecommendations(day).filter((item) => item.taskId === "essay").map(() => day.dateKey)
  );
  assert.deepEqual(dates, [
    "2026-11-09",
    "2026-11-11",
    "2026-11-12",
  ]);
  assert.equal(new Set(dates).size, dates.length);
});

test("completed Tasks remove future recommendations even when the slot was locked", () => {
  const active = task({ id: "locked-task", title: "Locked essay" });
  const initial = build([active], { weeklyRoutine: {} });
  const override = createRecommendationOverride({
    dateKey: initial.today.dateKey,
    slotIndex: 0,
    recommendation: initial.today.primary[0],
    locked: true,
    manual: false,
  });
  const completed = build(
    [{ ...active, completed: true }],
    { weeklyRoutine: {}, recommendationOverrides: [override] }
  );
  assert.equal(visibleRecommendations(completed.today).some((item) => item.taskId === active.id), false);
});

test("advancing the rolling horizon starts at the new day and removes completed work", () => {
  const active = task({ id: "rolling-task", title: "Rolling essay", dueDate: "2026-11-12" });
  const tuesday = build(
    [{ ...active, completed: true }],
    { weeklyRoutine: {} },
    new Date(2026, 10, 10, 12, 0, 0)
  );
  assert.equal(tuesday.days[0].dateKey, "2026-11-10");
  assert.equal(tuesday.days[6].dateKey, "2026-11-16");
  assert.equal(tuesday.days.some((day) => day.historical), false);
  assert.equal(tuesday.days.some((day) =>
    visibleRecommendations(day).some((item) => item.taskId === active.id)
  ), false);
});

test("ordinary homework is not recommended on its due date", () => {
  const thursdayDue = task({ id: "thursday", title: "Thursday work", dueDate: "2026-11-12", effort: 5 });
  const result = build([thursdayDue], { weeklyRoutine: {} });
  const dueDay = result.days.find((day) => day.dateKey === thursdayDue.dueDate);
  assert.equal(
    visibleRecommendations(dueDay).some((item) => item.taskId === thursdayDue.id),
    false
  );
  assert.ok(result.days
    .filter((day) => day.dateKey < thursdayDue.dueDate)
    .some((day) => visibleRecommendations(day).some((item) => item.taskId === thursdayDue.id)));
});

test("assessment deadline is a marker while preparation remains before it", () => {
  const upcoming = assessment({ id: "marker", dueDate: "2026-11-13" });
  const result = build([upcoming], { weeklyRoutine: {} });
  const dueDay = result.days.find((day) => day.dateKey === upcoming.dueDate);
  assert.deepEqual(dueDay.deadlines.map((item) => item.taskId), [upcoming.id]);
  assert.equal(visibleRecommendations(dueDay).some((item) => item.taskId === upcoming.id), false);
  assert.ok(result.days
    .filter((day) => day.dateKey < upcoming.dueDate)
    .some((day) => visibleRecommendations(day).some((item) => item.taskId === upcoming.id)));
});

test("manual swap changes one slot without mutating either Task", () => {
  const tasks = [1, 2, 3, 4].map((number) => task({
    id: `swap-${number}`,
    title: `Swap ${number}`,
    dueDate: "2026-11-12",
    effort: 1,
  }));
  const original = structuredClone(tasks);
  const initial = build(tasks, { weeklyRoutine: {} });
  const alternative = initial.today.alternatives[0];
  assert.ok(alternative);
  const override = createRecommendationOverride({
    dateKey: initial.today.dateKey,
    slotIndex: 0,
    recommendation: alternative,
    manual: true,
  });
  const swapped = build(tasks, { weeklyRoutine: {}, recommendationOverrides: [override] });
  assert.equal(swapped.today.primary[0].taskId, alternative.taskId);
  assert.equal(swapped.today.primary[0].manualOverride, true);
  assert.deepEqual(tasks, original);
});

test("lock and manual override records are deterministic and Redo preserves manual placements", () => {
  const result = build([task()], { weeklyRoutine: {} });
  const locked = createRecommendationOverride({
    dateKey: result.today.dateKey,
    slotIndex: 0,
    recommendation: result.today.primary[0],
    locked: true,
    manual: false,
  });
  const unlocked = createRecommendationOverride({
    dateKey: result.today.dateKey,
    slotIndex: 1,
    recommendation: result.today.primary[0],
    locked: false,
    manual: true,
  });
  const past = { ...unlocked, dateKey: "2026-11-08" };
  const retained = clearUnlockedFutureRecommendationOverrides(
    [locked, unlocked, past],
    result.today.dateKey
  );
  assert.deepEqual(retained, [locked, unlocked, past]);
  const rebuilt = build([task()], { weeklyRoutine: {}, recommendationOverrides: retained });
  assert.equal(rebuilt.today.primary[0].locked, true);
});

test("a recommendation can move from Saturday to Sunday beyond the daily target", () => {
  const friday = new Date(2026, 10, 13, 12, 0, 0);
  const upcoming = assessment({ id: "move-assessment", dueDate: "2026-11-16" });
  const initial = build([upcoming], { dailyStudyBlocks: 1, weeklyRoutine: {} }, friday);
  const saturday = initial.days.find((day) => day.dateKey === "2026-11-14");
  const sunday = initial.days.find((day) => day.dateKey === "2026-11-15");
  const moved = saturday.primary[0];
  const removal = createRecommendationOverride({
    dateKey: saturday.dateKey,
    slotIndex: 0,
    recommendation: moved,
    removed: true,
    originDateKey: saturday.dateKey,
    originSlotIndex: 0,
  });
  const destination = createRecommendationOverride({
    dateKey: sunday.dateKey,
    slotIndex: 3,
    recommendation: moved,
    originDateKey: saturday.dateKey,
    originSlotIndex: 0,
  });
  const result = build([upcoming], {
    dailyStudyBlocks: 1,
    weeklyRoutine: {},
    recommendationOverrides: [removal, destination],
  }, friday);
  const movedSaturday = result.days.find((day) => day.dateKey === saturday.dateKey);
  const movedSunday = result.days.find((day) => day.dateKey === sunday.dateKey);

  assert.equal(visibleRecommendations(movedSaturday).some((item) => item.id === moved.id), false);
  assert.equal(visibleRecommendations(movedSunday).filter((item) => item.taskId === upcoming.id).length, 2);
  assert.equal(movedSunday.targetBlockCount, 1);
});

test("an active Task can add a persistent study block using the default duration", () => {
  const now = new Date(2026, 10, 12, 12, 0, 0);
  const homework = task({ id: "manual-add", dueDate: "2026-11-16", effort: 2 });
  const validDates = getValidTaskStudyDates(homework, now);
  assert.deepEqual(validDates.map((day) => day.dateKey), [
    "2026-11-12",
    "2026-11-13",
    "2026-11-14",
    "2026-11-15",
  ]);

  const dateKey = "2026-11-14";
  const recommendation = createManualTaskStudyRecommendation(homework, dateKey);
  const slotIndex = getNextAvailableOverrideSlot([], dateKey);
  const added = createRecommendationOverride({
    dateKey,
    slotIndex,
    recommendation,
    manual: true,
    added: true,
    originDateKey: dateKey,
    originSlotIndex: slotIndex,
    durationMinutes: 45,
  });
  const result = build([homework], {
    weeklyRoutine: {},
    blockDurationMinutes: 45,
    recommendationOverrides: [added],
  }, now);
  const day = result.days.find((item) => item.dateKey === dateKey);
  const manualBlock = visibleRecommendations(day).find((item) => item.id === recommendation.id);

  assert.equal(slotIndex, 3);
  assert.equal(manualBlock.durationMinutes, 45);
  assert.equal(manualBlock.manualAdded, true);
  assert.equal(homework.dueDate, "2026-11-16");
  assert.equal(homework.effort, 2);
  assert.deepEqual(clearUnlockedFutureRecommendationOverrides([added], result.todayKey), [added]);
});

test("manual study dates reject due day, later dates, and completed Tasks", () => {
  const now = new Date(2026, 10, 12, 12, 0, 0);
  const homework = task({ id: "cutoff-homework", dueDate: "2026-11-14" });
  const assessmentTask = assessment({ id: "cutoff-assessment", dueDate: "2026-11-14" });
  assert.deepEqual(getValidTaskStudyDates(homework, now).map((day) => day.dateKey), ["2026-11-12", "2026-11-13"]);
  assert.deepEqual(getValidTaskStudyDates(assessmentTask, now).map((day) => day.dateKey), ["2026-11-12", "2026-11-13"]);
  assert.deepEqual(getValidTaskStudyDates({ ...homework, completed: true }, now), []);
});

test("a standalone removal hides one occurrence, survives Redo, and leaves the Task unchanged", () => {
  const homework = task({ id: "removed-occurrence", dueDate: "2026-11-12", effort: 2 });
  const initial = build([homework], { weeklyRoutine: {} });
  const recommendation = initial.today.primary.find((item) => item.taskId === homework.id);
  const removal = createRecommendationOverride({
    dateKey: initial.today.dateKey,
    slotIndex: 0,
    recommendation,
    manual: true,
    removed: true,
  });
  const result = build([homework], { weeklyRoutine: {}, recommendationOverrides: [removal] });
  const retained = clearUnlockedFutureRecommendationOverrides([removal], initial.todayKey);

  assert.equal(visibleRecommendations(result.today).some((item) => item.taskId === homework.id), false);
  assert.deepEqual(retained, [removal]);
  assert.equal(homework.completed, false);
  assert.equal(homework.dueDate, "2026-11-12");
});

test("manual move destinations respect homework and assessment cutoffs", () => {
  const homework = task({ dueDate: "2026-11-13" });
  const prep = assessment({ dueDate: "2026-11-17" });
  assert.equal(isRecommendationEligibleOnDate(homework, "2026-11-12", "2026-11-11"), true);
  assert.equal(isRecommendationEligibleOnDate(homework, "2026-11-13", "2026-11-11"), false);
  assert.equal(isRecommendationEligibleOnDate(prep, "2026-11-16", "2026-11-11"), true);
  assert.equal(isRecommendationEligibleOnDate(prep, "2026-11-17", "2026-11-11"), false);
  assert.equal(isRecommendationEligibleOnDate(prep, "2026-11-10", "2026-11-11"), false);
});

test("an invalidated move restores generated work and discards its paired overrides", () => {
  const upcoming = task({ id: "changed-date", dueDate: "2026-11-11" });
  const initial = build([upcoming], { weeklyRoutine: {} });
  const recommendation = initial.today.primary[0];
  const removal = createRecommendationOverride({
    dateKey: initial.today.dateKey,
    slotIndex: 0,
    recommendation,
    removed: true,
    originDateKey: initial.today.dateKey,
    originSlotIndex: 0,
  });
  const destination = createRecommendationOverride({
    dateKey: "2026-11-10",
    slotIndex: 3,
    recommendation,
    originDateKey: initial.today.dateKey,
    originSlotIndex: 0,
  });
  const changedTask = { ...upcoming, dueDate: "2026-11-10" };
  const validOverrides = filterValidMoveOverrides(
    [removal, destination],
    [changedTask],
    initial.todayKey
  );
  const result = build([changedTask], {
    weeklyRoutine: {},
    recommendationOverrides: [removal, destination],
  });

  assert.deepEqual(validOverrides, []);
  assert.equal(result.today.primary.some((item) => item.taskId === changedTask.id), true);
});

test("duration override changes only one occurrence and survives Redo", () => {
  const highEffort = task({ id: "duration-task", effort: 5, dueDate: "2026-11-13" });
  const initial = build([highEffort], { weeklyRoutine: {} });
  const firstOccurrence = initial.today.primary[0];
  const durationOverride = createRecommendationOverride({
    dateKey: initial.today.dateKey,
    slotIndex: 0,
    recommendation: firstOccurrence,
    manual: true,
    durationMinutes: 60,
  });
  const result = build([highEffort], {
    weeklyRoutine: {},
    blockDurationMinutes: 45,
    recommendationOverrides: [durationOverride],
  });
  const taskOccurrences = result.days.flatMap(visibleRecommendations)
    .filter((item) => item.taskId === highEffort.id);
  const retained = clearUnlockedFutureRecommendationOverrides(
    [durationOverride],
    initial.todayKey
  );

  assert.equal(result.today.primary[0].durationMinutes, 60);
  assert.equal(result.blockDurationMinutes, 45);
  assert.equal(getDayStudyMinutes(result.today), 60);
  assert.equal(
    getHorizonStudyMinutes(result.days),
    result.days.reduce((sum, day) => sum + getDayStudyMinutes(day), 0)
  );
  assert.ok(taskOccurrences.some((item) => !item.durationMinutes));
  assert.deepEqual(retained, [durationOverride]);
  assert.equal(highEffort.effort, 5);
});

test("completed Tasks remove manually moved future blocks", () => {
  const upcoming = task({ id: "completed-move", dueDate: "2026-11-13" });
  const initial = build([upcoming], { weeklyRoutine: {} });
  const recommendation = initial.today.primary[0];
  const removal = createRecommendationOverride({
    dateKey: initial.today.dateKey,
    slotIndex: 0,
    recommendation,
    removed: true,
    originDateKey: initial.today.dateKey,
    originSlotIndex: 0,
  });
  const destination = createRecommendationOverride({
    dateKey: "2026-11-12",
    slotIndex: 3,
    recommendation,
    originDateKey: initial.today.dateKey,
    originSlotIndex: 0,
  });
  const result = build([{ ...upcoming, completed: true }], {
    weeklyRoutine: {},
    recommendationOverrides: [removal, destination],
  });
  assert.equal(result.days.some((day) =>
    visibleRecommendations(day).some((item) => item.taskId === upcoming.id)
  ), false);
});

test("generic review appears only when no higher-priority work or routine exists", () => {
  const empty = build([], { weeklyRoutine: {} });
  assert.equal(empty.today.primary[0].kind, "review");
  assert.equal(empty.today.primary[0].title, "Review today's classes");
  const urgent = build([task()], { weeklyRoutine: {} });
  assert.equal(urgent.today.primary.some((item) => item.kind === "review"), false);
});

test("subject-aware review requires an exact reliable Subject mapping", () => {
  const mapped = build([], { weeklyRoutine: {} }, NOW, {
    classSubjectsByDate: { "2026-11-09": ["maths"] },
  });
  assert.equal(mapped.today.primary[0].subject, "Maths");
  assert.match(mapped.today.primary[0].title, /Maths/);
  const unknown = build([], { weeklyRoutine: {} }, NOW, {
    classSubjectsByDate: { "2026-11-09": ["Unknown class"] },
  });
  assert.equal(unknown.today.primary[0].subject, "General review");
});

test("Classroom Tasks participate normally while submitted work stays excluded", () => {
  const active = build([
    task({ id: "classroom-active", source: "classroom", classroomStatusCategory: "assigned" }),
  ], { weeklyRoutine: {} });
  assert.equal(active.today.primary[0].source, "classroom");
  const submitted = build([
    task({ id: "classroom-done", source: "classroom", classroomStatusCategory: "submitted" }),
  ], { weeklyRoutine: {} });
  assert.equal(visibleRecommendations(submitted.today).some((item) => item.taskId === "classroom-done"), false);
});

test("the Week snapshot contains no assessment prep on or after the assessment date", () => {
  const result = build([assessment({ dueDate: "2026-11-11" })], { weeklyRoutine: {} });
  assert.equal(visibleRecommendations(result.days[2]).some((item) => item.kind === "assessment"), false);
  assert.equal(visibleRecommendations(result.days[3]).some((item) => item.kind === "assessment"), false);
});

