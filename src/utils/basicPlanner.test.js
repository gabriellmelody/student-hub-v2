import assert from "node:assert/strict";
import test from "node:test";

import { buildEveningPlan, formatDateKey } from "./appUtils.js";

function dueIn(days) {
  const dueDate = new Date();
  dueDate.setHours(12, 0, 0, 0);
  dueDate.setDate(dueDate.getDate() + days);
  return formatDateKey(dueDate);
}

function task(overrides) {
  return {
    id: overrides.id,
    title: overrides.title || overrides.id,
    subject: overrides.subject || "Study",
    dueDate: overrides.dueDate,
    effort: overrides.effort ?? 2,
    importance: overrides.importance || "normal",
    taskType: overrides.taskType || "homework",
    completed: false,
    archived: false,
    ignored: false,
    ...overrides,
  };
}

function studyBlocks(result) {
  return result.blocks.filter((block) => block.type === "study");
}

test("a task due tomorrow outranks a high assessment due in seven days", () => {
  const result = buildEveningPlan({
    tasks: [
      task({
        id: "report",
        dueDate: dueIn(7),
        effort: 4,
        importance: "high",
        taskType: "assessment",
      }),
      task({ id: "essay", dueDate: dueIn(1), effort: 2 }),
    ],
    startTime: "20:00",
    endTime: "21:00",
    includeBreaks: false,
  });

  assert.equal(result.ok, true);
  assert.equal(studyBlocks(result)[0].taskId, "essay");
});

test("urgent eligible work is scheduled before a later task can repeat", () => {
  const result = buildEveningPlan({
    tasks: [
      task({
        id: "later-report",
        dueDate: dueIn(7),
        effort: 5,
        importance: "high",
        taskType: "assessment",
      }),
      task({ id: "tomorrow-essay", dueDate: dueIn(1), effort: 2 }),
    ],
    startTime: "20:00",
    endTime: "21:00",
    includeBreaks: false,
  });

  const ids = studyBlocks(result).map((block) => block.taskId);
  assert.equal(result.ok, true);
  assert.deepEqual(ids, ["tomorrow-essay", "later-report"]);
});

test("the planner uses the requested finish when useful work remains", () => {
  const result = buildEveningPlan({
    tasks: [
      task({ id: "essay", dueDate: dueIn(1), effort: 2 }),
      task({ id: "problem-set", dueDate: dueIn(3), effort: 2 }),
      task({
        id: "lab-report",
        dueDate: dueIn(7),
        effort: 4,
        importance: "high",
        taskType: "assessment",
      }),
    ],
    startTime: "22:31",
    endTime: "23:59",
  });

  const scheduledMinutes = result.blocks.reduce(
    (total, block) => total + block.duration,
    0
  );
  assert.equal(result.ok, true);
  assert.equal(result.blocks.at(-1).end, "11:59 PM");
  assert.equal(scheduledMinutes, 88);
  assert.ok(result.unscheduledWorkMinutes > 0);
});

test("a useful small remainder becomes a final study block", () => {
  const result = buildEveningPlan({
    tasks: [
      task({ id: "first", dueDate: dueIn(1), effort: 2 }),
      task({ id: "second", dueDate: dueIn(2), effort: 2 }),
      task({ id: "third", dueDate: dueIn(3), effort: 2 }),
    ],
    startTime: "20:00",
    endTime: "21:18",
    includeBreaks: false,
  });

  const blocks = studyBlocks(result);
  assert.equal(result.ok, true);
  assert.equal(blocks.at(-1).duration, 18);
  assert.equal(blocks.at(-1).end, "9:18 PM");
});

test("a finish clock time before the start is treated as the next day", () => {
  const result = buildEveningPlan({
    tasks: [
      task({ id: "one", dueDate: dueIn(1), effort: 5 }),
      task({ id: "two", dueDate: dueIn(2), effort: 5 }),
      task({ id: "three", dueDate: dueIn(3), effort: 5 }),
    ],
    startTime: "22:30",
    endTime: "01:00",
    includeBreaks: false,
    maxFocusMinutes: 60,
    planStyle: "push",
  });

  assert.equal(result.ok, true);
  assert.equal(result.crossesMidnight, true);
  assert.equal(result.windowMinutes, 150);
  assert.equal(result.blocks.at(-1).end, "1:00 AM");
  assert.equal(result.blocks.at(-1).endDayOffset, 1);
});

test("ordinary same-day planning keeps its existing window interpretation", () => {
  const result = buildEveningPlan({
    tasks: [task({ id: "same-day", dueDate: dueIn(1), effort: 2 })],
    startTime: "16:30",
    endTime: "20:30",
    includeBreaks: false,
  });

  assert.equal(result.ok, true);
  assert.equal(result.crossesMidnight, false);
  assert.equal(result.windowMinutes, 240);
  assert.equal(result.blocks[0].start, "4:30 PM");
  assert.equal(result.blocks[0].startDayOffset, 0);
  assert.equal(result.blocks[0].endDayOffset, 0);
});
