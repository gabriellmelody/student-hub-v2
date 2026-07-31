import assert from "node:assert/strict";
import test from "node:test";
import { helpTopics, getHelpTopic } from "../data/helpGuides.js";
import {
  SUPPORT_FIELD_LIMITS,
  buildSafeDiagnosticDetails,
  buildSupportMailto,
  buildSupportMessage,
  copySupportMessage,
  getGuidedTourDisplayStatus,
  normalizeSupportEmail,
  resetGuidedTourProgress,
  validateSupportDraft,
} from "./helpSupportUtils.js";
import { GUIDED_TOUR_STORAGE_KEY } from "./guidedTourStorage.js";

test("the Help centre defines the six required topics", () => {
  assert.equal(helpTopics.length, 6);
  assert.deepEqual(
    helpTopics.map((topic) => topic.title),
    [
      "Getting started",
      "To-do and assignments",
      "Subjects and grade targets",
      "Calendar and busy time",
      "Smart Planner",
      "Today’s Plan",
    ]
  );
});

test("only topics with existing tours expose replay identifiers", () => {
  assert.deepEqual(
    helpTopics.filter((topic) => topic.tourId).map((topic) => topic.tourId),
    ["getting-started", "subjects", "calendar", "smart-planner"]
  );
  assert.equal(getHelpTopic("todo-assignments").tourId, undefined);
  assert.equal(getHelpTopic("todays-plan").tourId, undefined);
});

test("written guides contain the required planning explanations", () => {
  const subjects = JSON.stringify(getHelpTopic("subjects-grades"));
  const calendar = JSON.stringify(getHelpTopic("calendar-busy-time"));
  const planner = JSON.stringify(getHelpTopic("smart-planner"));
  const today = JSON.stringify(getHelpTopic("todays-plan"));

  assert.match(subjects, /secondary planning signal/);
  assert.match(calendar, /not treated as Student Hub tasks/);
  assert.match(planner, /successful Smart Planner result uses one daily allowance/);
  assert.match(planner, /Basic Planner is unlimited/);
  assert.doesNotMatch(today, /timer/i);
});

test("tour status is derived safely from versioned progress", () => {
  const tour = { id: "subjects", version: 2 };

  assert.equal(getGuidedTourDisplayStatus(tour, { tours: {} }), "Not viewed");
  assert.equal(
    getGuidedTourDisplayStatus(tour, {
      tours: { subjects: { status: "completed", version: 2 } },
    }),
    "Completed"
  );
  assert.equal(
    getGuidedTourDisplayStatus(tour, {
      tours: { subjects: { status: "skipped", version: 2 } },
    }),
    "Skipped"
  );
  assert.equal(
    getGuidedTourDisplayStatus(tour, {
      tours: { subjects: { status: "completed", version: 1 } },
    }),
    "Updated"
  );
});

test("reset removes only guided-tour persistence", () => {
  const values = new Map([
    [GUIDED_TOUR_STORAGE_KEY, "{}"],
    ["studentHub.tasks", "[1]"],
  ]);
  const storage = {
    removeItem: (key) => values.delete(key),
  };

  assert.equal(resetGuidedTourProgress(storage), true);
  assert.equal(values.has(GUIDED_TOUR_STORAGE_KEY), false);
  assert.equal(values.get("studentHub.tasks"), "[1]");
});

test("support email validation fails closed", () => {
  assert.equal(normalizeSupportEmail(" support@example.com "), "support@example.com");
  assert.equal(normalizeSupportEmail("not-an-email"), "");
  assert.equal(
    buildSupportMailto({ supportEmail: "", draft: { message: "Hello" } }),
    ""
  );
});

test("valid support email creates an encoded mailto only on request", () => {
  const mailto = buildSupportMailto({
    supportEmail: "support@example.com",
    draft: { feedbackType: "Idea", message: "Add A&B?" },
  });

  assert.match(mailto, /^mailto:support%40example\.com\?/);
  assert.match(mailto, /Student%20Hub%20feedback/);
  assert.match(mailto, /Add%20A%26B%3F/);
});

test("diagnostics contain allowed categories and exclude student data", () => {
  const diagnostics = buildSafeDiagnosticDetails({
    appVersion: "beta-5",
    now: new Date("2026-07-31T08:00:00.000Z"),
    currentPage: "Help & tours",
    userAgent: "Mozilla/5.0 Chrome/140",
    viewportWidth: 390,
    viewportHeight: 844,
    theme: "dark",
    online: true,
    classroomConnected: true,
    calendarConnected: false,
    smartPlannerStatus: "ready",
    remainingAllowance: 2,
    tasks: [{ title: "Secret assignment" }],
    grades: ["A"],
    events: ["Private meeting"],
    localStorage: "private",
  });

  assert.match(diagnostics, /Viewport: 390 × 844/);
  assert.match(diagnostics, /Classroom connected: Yes/);
  assert.match(diagnostics, /AI allowance remaining: 2/);
  assert.doesNotMatch(
    diagnostics,
    /Secret assignment|Private meeting|localStorage|grades|token|cookie/i
  );
});

test("diagnostics are truncated before the student's core report", () => {
  const core = "The save button closes the form.";
  const message = buildSupportMessage({
    mode: "problem",
    draft: { whatHappened: core },
    diagnostics: "x".repeat(10000),
    includeDiagnostics: true,
  });

  assert.match(message, new RegExp(core.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.ok(message.length <= SUPPORT_FIELD_LIMITS.mailtoBody);
});

test("form validation enforces required content and reply email", () => {
  assert.equal(validateSupportDraft("feedback", { message: "" }), "Write a short feedback message.");
  assert.equal(validateSupportDraft("problem", { whatHappened: "" }), "Tell us what happened.");
  assert.equal(
    validateSupportDraft("feedback", {
      message: "Useful",
      replyEmail: "invalid",
    }),
    "Enter a valid reply email or leave it blank."
  );
});

test("copy remains available without support email configuration", async () => {
  let copied = "";
  const result = await copySupportMessage("Safe report", {
    clipboard: {
      writeText: async (value) => {
        copied = value;
      },
    },
  });

  assert.equal(result, true);
  assert.equal(copied, "Safe report");
});

test("support fields are bounded and no draft is persisted", () => {
  const longMessage = "a".repeat(SUPPORT_FIELD_LIMITS.feedbackMessage + 50);
  const report = buildSupportMessage({
    draft: { message: longMessage },
  });
  let storageWrites = 0;
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = { setItem: () => { storageWrites += 1; } };

  try {
    assert.equal(report.split("\n").at(-1).length, SUPPORT_FIELD_LIMITS.feedbackMessage);
    assert.equal(storageWrites, 0);
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});
