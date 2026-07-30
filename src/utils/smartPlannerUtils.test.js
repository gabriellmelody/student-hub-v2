import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSmartPlannerTaskPayload,
  buildSmartPlannerSubjectProfiles,
  formatSmartPlannerResetTime,
  getDefaultSmartPlannerDraft,
  getNextHalfHourStart,
  normalizeSmartPlannerContext,
  shouldRequestSmartPlannerAi,
} from "./smartPlannerUtils.js";

function localTime(hours, minutes) {
  const date = new Date(2026, 6, 30, hours, minutes, 0, 0);
  return date;
}

test("rounds a fresh Smart Planner start to the next half-hour", () => {
  assert.deepEqual(getNextHalfHourStart(localTime(14, 5)), {
    available: true,
    minute: 14 * 60 + 30,
    time: "14:30",
  });
  assert.deepEqual(getNextHalfHourStart(localTime(14, 29)), {
    available: true,
    minute: 14 * 60 + 30,
    time: "14:30",
  });
  assert.deepEqual(getNextHalfHourStart(localTime(14, 30)), {
    available: true,
    minute: 14 * 60 + 30,
    time: "14:30",
  });
  assert.deepEqual(getNextHalfHourStart(localTime(14, 31)), {
    available: true,
    minute: 15 * 60,
    time: "15:00",
  });
  assert.deepEqual(getNextHalfHourStart(localTime(14, 45)), {
    available: true,
    minute: 15 * 60,
    time: "15:00",
  });
});

test("does not roll a current-day plan into tomorrow", () => {
  assert.deepEqual(getNextHalfHourStart(localTime(23, 45)), {
    available: false,
    minute: null,
    time: "",
  });
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
