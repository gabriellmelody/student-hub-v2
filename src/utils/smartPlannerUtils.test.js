import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSmartPlannerTaskPayload,
  buildSmartPlannerSubjectProfiles,
  detectTomorrowClasses,
  formatSmartPlannerResetTime,
  getDefaultSmartPlannerDraft,
  getSmartPlannerLocalContext,
  getNextQuarterHourStart,
  normalizeSmartPlannerContext,
  shouldRequestSmartPlannerAi,
} from "./smartPlannerUtils.js";

function localTime(hours, minutes) {
  const date = new Date(2026, 6, 30, hours, minutes, 0, 0);
  return date;
}

test("rounds a fresh Smart Planner start up to the next quarter-hour", () => {
  assert.deepEqual(getNextQuarterHourStart(localTime(18, 29)), {
    available: true,
    minute: 18 * 60 + 30,
    time: "18:30",
  });
  assert.deepEqual(getNextQuarterHourStart(localTime(18, 30)), {
    available: true,
    minute: 18 * 60 + 30,
    time: "18:30",
  });
  assert.deepEqual(getNextQuarterHourStart(localTime(18, 34)), {
    available: true,
    minute: 18 * 60 + 45,
    time: "18:45",
  });
  assert.deepEqual(getNextQuarterHourStart(localTime(19, 38)), {
    available: true,
    minute: 19 * 60 + 45,
    time: "19:45",
  });
});

test("does not roll a current-day plan into tomorrow", () => {
  assert.deepEqual(getNextQuarterHourStart(localTime(23, 53)), {
    available: false,
    minute: null,
    time: "",
  });
});

test("uses the saved normal study duration for the default finish", () => {
  assert.deepEqual(
    getDefaultSmartPlannerDraft({ now: localTime(18, 34), hoursAvailable: 2 }),
    {
      startTime: "18:45",
      endTime: "20:45",
      planStyle: "balanced",
      useCalendar: false,
      plannerContext: "",
      noTimeLeftToday: false,
    }
  );
});

test("preserves overnight windows with logical next-day minutes", () => {
  const context = getSmartPlannerLocalContext(
    { startTime: "23:45", endTime: "01:45", planStyle: "balanced" },
    localTime(23, 30)
  );
  assert.equal(context.startMinute, 1425);
  assert.equal(context.finishMinute, 1545);
});

test("detects tomorrow classes only from conservative Subject aliases", () => {
  const classes = detectTomorrowClasses(
    [
      { title: "Spanish HL", start: { dateTime: "2026-07-31T09:00:00+07:00" } },
      { title: "Football training", start: { dateTime: "2026-07-31T16:00:00+07:00" } },
    ],
    [{ name: "Spanish" }, { name: "Maths" }],
    "2026-07-31"
  );
  assert.deepEqual(classes, ["Spanish"]);
});

test("formats Smart Planner reset times in the browser's local day", () => {
  const now = localTime(14, 0);

  assert.equal(
    formatSmartPlannerResetTime(localTime(18, 30), now, "en-US"),
    "Resets today at 6:30 PM"
  );
  assert.equal(
    formatSmartPlannerResetTime(new Date(2026, 6, 31, 9, 5), now, "en-US"),
    "Resets tomorrow at 9:05 AM"
  );
  assert.equal(
    formatSmartPlannerResetTime(new Date(2026, 7, 3, 16, 0), now, "en-US"),
    "Resets Aug 3 at 4:00 PM"
  );
  assert.equal(formatSmartPlannerResetTime(null, now, "en-US"), "");
  assert.equal(formatSmartPlannerResetTime("not-a-date", now, "en-US"), "");
});

test("preselects the 20 most relevant active tasks", () => {
  const lowPriority = Array.from({ length: 24 }, (_, index) => ({
    id: `low-${index}`,
    title: `Low priority ${index}`,
    dueDate: "",
    importance: "low",
    effort: 1,
  }));
  const urgent = {
    id: "urgent-overdue",
    title: "Overdue essay assessment",
    dueDate: "2026-07-29",
    importance: "high",
    effort: 5,
  };
  const dueToday = {
    id: "due-today",
    title: "Questions",
    dueDate: "2026-07-30",
    effort: 2,
  };

  const selected = buildSmartPlannerTaskPayload(
    [...lowPriority, dueToday, urgent],
    "2026-07-30"
  );

  assert.equal(selected.length, 20);
  assert.deepEqual(selected.slice(0, 2).map((task) => task.id), [
    "urgent-overdue",
    "due-today",
  ]);
});

test("sends effective assessment, description, and personal/admin context", () => {
  const payload = buildSmartPlannerTaskPayload([
    {
      id: "cfa",
      title: "Study for CFA",
      description: "Use the teacher review sheet.",
      subject: "Maths",
      linkedSubjectId: "maths-id",
    },
    { id: "order", title: "make SHEIN order", importance: "normal" },
  ], "2026-07-30");

  const cfa = payload.find((task) => task.id === "cfa");
  assert.equal(cfa.assessmentClassification, "formative");
  assert.equal(cfa.assessmentPreparation, true);
  assert.equal(cfa.taskType, "revision");
  assert.equal(cfa.description, "Use the teacher review sheet.");
  assert.equal(cfa.subjectId, "maths-id");
  assert.equal(payload.find((task) => task.id === "order").personalAdmin, true);
});

test("builds grade profiles only for Subjects represented by eligible tasks", () => {
  const subjects = [
    {
      id: "subject-economics",
      name: "Economics",
      courseSystem: "IB",
      currentGrade: "6",
      targetGrade: "7",
    },
    {
      id: "subject-english",
      name: "English",
      courseSystem: "AP",
      currentGrade: "B",
      targetGrade: "A",
    },
  ];
  const eligibleTasks = buildSmartPlannerTaskPayload(
    [
      { id: "econ-1", title: "Essay plan", subject: "  ECONOMICS  " },
      { id: "econ-2", title: "Review graphs", subject: "economics" },
      {
        id: "english-done",
        title: "Finished essay",
        subject: "English",
        completed: true,
      },
    ],
    "2026-07-30"
  );

  assert.deepEqual(
    buildSmartPlannerSubjectProfiles(subjects, eligibleTasks),
    [
      {
        subjectId: "subject-economics",
        subject: "Economics",
        currentGrade: "6",
        targetGrade: "7",
        gradeSystem: "IB",
      },
    ]
  );
});

test("deduplicates Subject profiles, prefers stable IDs, and caps the list at 12", () => {
  const subjects = Array.from({ length: 14 }, (_, index) => ({
    id: `subject-${index}`,
    name: `Subject ${index}`,
    courseSystem: index === 0 ? "GCSE" : "Other",
    currentGrade: index === 0 ? " B " : "",
    targetGrade: index === 0 ? " A " : "",
  }));
  const eligibleTasks = [
    ...subjects.map((subject, index) => ({
      id: `task-${index}`,
      subject: index === 0 ? " subject   0 " : subject.name,
    })),
    { id: "duplicate", subject: "SUBJECT 0" },
  ];

  const profiles = buildSmartPlannerSubjectProfiles(subjects, eligibleTasks);

  assert.equal(profiles.length, 12);
  assert.equal(profiles.filter((profile) => profile.subjectId === "subject-0").length, 1);
  assert.deepEqual(profiles[0], {
    subjectId: "subject-0",
    subject: "Subject 0",
    currentGrade: "B",
    targetGrade: "A",
    gradeSystem: "GCSE",
  });
});

test("preserves short non-comparable grades and accepts missing grade values", () => {
  const profiles = buildSmartPlannerSubjectProfiles(
    [
      {
        name: "Art",
        courseSystem: "Other",
        currentGrade: "Developing",
        targetGrade: "",
      },
      {
        id: "subject-ap",
        name: "US History",
        courseSystem: "AP",
        currentGrade: "",
        targetGrade: "5",
      },
    ],
    [
      { id: "task-art", subject: "Art" },
      { id: "task-history", subject: "US History" },
    ]
  );

  assert.deepEqual(profiles, [
    {
      subjectId: null,
      subject: "Art",
      currentGrade: "Developing",
      targetGrade: "",
      gradeSystem: "Other",
    },
    {
      subjectId: "subject-ap",
      subject: "US History",
      currentGrade: "",
      targetGrade: "5",
      gradeSystem: "AP",
    },
  ]);
});

test("Basic planning makes no AI request and preserves displayed quota", () => {
  const quota = { remainingGenerations: 2, resetAt: "2026-07-31T10:00:00.000Z" };
  let smartPlannerApiRequests = 0;

  if (
    shouldRequestSmartPlannerAi({
      basic: true,
      plannerContext: "Temporary context must stay local.",
      ...quota,
    })
  ) {
    smartPlannerApiRequests += 1;
  }

  assert.equal(smartPlannerApiRequests, 0);
  assert.deepEqual(quota, {
    remainingGenerations: 2,
    resetAt: "2026-07-31T10:00:00.000Z",
  });
  assert.equal(
    shouldRequestSmartPlannerAi({ basic: false, remainingGenerations: 0 }),
    false
  );
});

test("Planner context is trimmed, bounded, and fresh for each modal open", () => {
  assert.equal(normalizeSmartPlannerContext("  steady EE progress  "), "steady EE progress");
  assert.equal(normalizeSmartPlannerContext("x".repeat(900)).length, 800);

  const firstOpen = getDefaultSmartPlannerDraft({ now: localTime(14, 5) });
  firstOpen.plannerContext = "Temporary details";
  const reopened = getDefaultSmartPlannerDraft({ now: localTime(14, 5) });

  assert.equal(reopened.plannerContext, "");
  assert.equal(firstOpen.plannerContext, "Temporary details");
});

test("editing context alone creates no API request or quota change", () => {
  const quota = { remainingGenerations: 3, resetAt: "" };
  const draft = getDefaultSmartPlannerDraft({ now: localTime(14, 5) });
  let smartPlannerApiRequests = 0;

  draft.plannerContext = "Prioritise my existing EE task.";

  assert.equal(smartPlannerApiRequests, 0);
  assert.equal(quota.remainingGenerations, 3);
  assert.equal(draft.plannerContext, "Prioritise my existing EE task.");
});
