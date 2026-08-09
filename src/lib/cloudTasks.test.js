import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  createCloudTask,
  deleteCloudTask,
  fetchCloudTasks,
  getTasksForCloudWorkspace,
  isCloudTaskId,
  mapCloudTask,
  mapTaskForInsert,
  mapTaskForUpdate,
  subscribeToCloudTaskChanges,
  updateCloudTask,
  upsertCloudClassroomTasks,
} from "./cloudTasks.js";
import {
  createQuickTaskDraft,
  getTaskCalendarEvents,
  restoreSavedPlanBlocks,
} from "../utils/appUtils.js";

const USER_ID = "user-123";
const TASK_ID = "11111111-1111-4111-8111-111111111111";
const SUBJECT_ID = "22222222-2222-4222-9222-222222222222";
const COMPLETED_AT = "2026-08-09T12:30:00.000Z";

function cloudRow(overrides = {}) {
  return {
    id: TASK_ID,
    user_id: USER_ID,
    subject_id: SUBJECT_ID,
    subject_name: "Economics",
    title: "Economics essay",
    description: "Draft the introduction",
    due_date: "2026-08-10",
    due_time: "16:00",
    effort: 4,
    completed: false,
    completed_at: null,
    source: "manual",
    external_id: null,
    task_type: "homework",
    importance: "normal",
    detected_tags: [],
    importance_source: "manual",
    classroom_course_id: null,
    classroom_course_name: null,
    alternate_link: null,
    work_type: null,
    state: null,
    submission_id: null,
    submission_state: null,
    classroom_status_category: "unknown",
    late: false,
    assigned_grade: null,
    draft_grade: null,
    submission_updated_at: null,
    imported_at: null,
    source_updated_at: null,
    last_synced_at: null,
    archived: false,
    archived_at: null,
    created_at: "2026-08-09T10:00:00.000Z",
    updated_at: "2026-08-09T10:00:00.000Z",
    ...overrides,
  };
}

function dayloTask(overrides = {}) {
  return {
    id: TASK_ID,
    subject: "Economics",
    linkedSubjectId: SUBJECT_ID,
    linkedSubjectName: "Economics",
    title: "Economics essay",
    description: "Draft the introduction",
    dueDate: "2026-08-10",
    dueTime: "16:00",
    effort: 4,
    completed: false,
    completedAt: null,
    source: "manual",
    externalId: null,
    taskType: "homework",
    importance: "normal",
    detectedTags: [],
    importanceSource: "manual",
    classroomCourseId: null,
    classroomCourseName: null,
    alternateLink: "",
    workType: "",
    state: "",
    submissionId: null,
    submissionState: "",
    classroomStatusCategory: "unknown",
    late: false,
    assignedGrade: null,
    draftGrade: null,
    submissionUpdatedAt: null,
    importedAt: null,
    sourceUpdatedAt: null,
    lastSyncedAt: null,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

function createTableClient({ rows = [], singleRows = [], errors = {} } = {}) {
  const calls = [];
  const client = {
    calls,
    from(table) {
      const state = {
        table,
        action: null,
        payload: null,
        filters: [],
        orders: [],
        options: null,
        ids: null,
      };
      const builder = {
        select(columns) {
          state.columns = columns;
          return builder;
        },
        insert(payload) {
          state.action = "insert";
          state.payload = payload;
          return builder;
        },
        update(payload) {
          state.action = "update";
          state.payload = payload;
          return builder;
        },
        upsert(payload, options) {
          state.action = "upsert";
          state.payload = payload;
          state.options = options;
          return builder;
        },
        delete() {
          state.action = "delete";
          return builder;
        },
        eq(column, value) {
          state.filters.push([column, value]);
          return builder;
        },
        in(column, ids) {
          state.ids = [column, ids];
          return builder;
        },
        order(column, options) {
          state.orders.push([column, options]);
          return builder;
        },
        single() {
          calls.push(state);
          return Promise.resolve({
            data: singleRows.shift() || cloudRow(),
            error: errors[state.action] || null,
          });
        },
        then(resolve) {
          calls.push(state);
          return Promise.resolve({
            data: state.action === "delete" ? null : rows,
            error: errors[state.action || "select"] || null,
          }).then(resolve);
        },
      };
      return builder;
    },
  };
  return client;
}

test("maps DB rows to the normal DayLo task shape with stable UUIDs", () => {
  const task = mapCloudTask(cloudRow());
  assert.equal(task.id, TASK_ID);
  assert.equal(isCloudTaskId(task.id), true);
  assert.equal(task.subject, "Economics");
  assert.equal(task.linkedSubjectId, SUBJECT_ID);
  assert.equal(task.dueDate, "2026-08-10");
});

test("maps the full DayLo task shape to snake_case DB fields", () => {
  const payload = mapTaskForInsert(dayloTask(), USER_ID);
  assert.equal(payload.user_id, USER_ID);
  assert.equal(payload.subject_id, SUBJECT_ID);
  assert.equal(payload.subject_name, "Economics");
  assert.equal(payload.due_date, "2026-08-10");
  assert.equal(payload.due_time, "16:00");
  assert.equal(payload.importance_source, "manual");
  assert.equal("id" in payload, false);
  assert.equal("user_id" in mapTaskForUpdate(dayloTask()), false);
});

test("zero-task cloud accounts load empty and never consult localStorage", async () => {
  globalThis.localStorage = {
    getItem() {
      throw new Error("legacy task storage must not be read");
    },
  };
  const client = createTableClient({ rows: [] });
  assert.deepEqual(await fetchCloudTasks(client, USER_ID), []);
  delete globalThis.localStorage;
});

test("logout and account switching never expose the previous user's tasks", () => {
  const userATask = dayloTask({ title: "User A task" });
  const workspace = { userId: "user-a", tasks: [userATask] };
  assert.deepEqual(getTasksForCloudWorkspace(workspace, "user-a"), [userATask]);
  assert.deepEqual(getTasksForCloudWorkspace(workspace, ""), []);
  assert.deepEqual(getTasksForCloudWorkspace(workspace, "user-b"), []);
});

test("task creation is owned by the authenticated user and uses returned UUID", async () => {
  const client = createTableClient({ singleRows: [cloudRow()] });
  const saved = await createCloudTask(client, USER_ID, dayloTask({ id: 42 }));
  assert.equal(saved.id, TASK_ID);
  assert.equal(client.calls[0].payload.user_id, USER_ID);
  assert.equal("id" in client.calls[0].payload, false);
});

test("Quick Add cloud payload keeps normal defaults and fabricates no deadline", () => {
  const payload = mapTaskForInsert(createQuickTaskDraft("  Bring calculator  "), USER_ID);
  assert.equal(payload.title, "Bring calculator");
  assert.equal(payload.subject_id, null);
  assert.equal(payload.subject_name, "");
  assert.equal(payload.due_date, null);
  assert.equal(payload.effort, 2);
  assert.equal(payload.completed, false);
  assert.equal(payload.source, "manual");
});

test("detailed task creation preserves date-only deadlines without timezone conversion", () => {
  const payload = mapTaskForInsert(dayloTask({ dueDate: "2026-08-10" }), USER_ID);
  assert.equal(payload.due_date, "2026-08-10");
  assert.equal(mapCloudTask(cloudRow({ due_date: payload.due_date })).dueDate, "2026-08-10");
});

test("updates preserve task UUID and Classroom metadata", async () => {
  const classroomRow = cloudRow({
    source: "classroom",
    external_id: "assignment-1",
    classroom_course_id: "course-1",
    alternate_link: "https://classroom.google.com/a/1",
  });
  const client = createTableClient({ singleRows: [classroomRow] });
  const saved = await updateCloudTask(
    client,
    USER_ID,
    mapCloudTask(classroomRow)
  );
  assert.equal(saved.id, TASK_ID);
  assert.equal(saved.externalId, "assignment-1");
  assert.deepEqual(client.calls[0].filters, [
    ["user_id", USER_ID],
    ["id", TASK_ID],
  ]);
});

test("completion sets completed_at and restore clears it", () => {
  const completed = mapTaskForUpdate(
    dayloTask({ completed: true, completedAt: Date.parse(COMPLETED_AT) })
  );
  const restored = mapTaskForUpdate(
    dayloTask({ completed: false, completedAt: Date.parse(COMPLETED_AT) })
  );
  assert.equal(completed.completed, true);
  assert.equal(completed.completed_at, COMPLETED_AT);
  assert.equal(restored.completed, false);
  assert.equal(restored.completed_at, null);
});

test("old completed tasks remain valid and are not age-filtered", async () => {
  const oldRow = cloudRow({
    completed: true,
    completed_at: "2020-01-01T00:00:00.000Z",
    due_date: "2019-12-31",
  });
  const client = createTableClient({ rows: [oldRow] });
  const loaded = await fetchCloudTasks(client, USER_ID);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].completed, true);
});

test("older completed rows without completed_at remain valid", () => {
  const task = mapCloudTask(cloudRow({ completed: true, completed_at: null }));
  assert.equal(task.completed, true);
  assert.equal(task.completedAt, null);
});

test("archive and restore payloads persist archived_at safely", () => {
  const archivedAt = "2026-08-09T13:00:00.000Z";
  const archived = mapTaskForUpdate(dayloTask({ archived: true, archivedAt }));
  const restored = mapTaskForUpdate(dayloTask({ archived: false, archivedAt }));
  assert.equal(archived.archived, true);
  assert.equal(archived.archived_at, archivedAt);
  assert.equal(restored.archived, false);
  assert.equal(restored.archived_at, null);
});

test("delete targets only the current user's cloud task", async () => {
  const client = createTableClient();
  assert.equal(await deleteCloudTask(client, USER_ID, TASK_ID), true);
  assert.deepEqual(client.calls[0].filters, [
    ["user_id", USER_ID],
    ["id", TASK_ID],
  ]);
});

test("unassigned tasks round-trip with null subject UUID and stored empty name", () => {
  const payload = mapTaskForInsert(
    dayloTask({ subject: "", linkedSubjectId: null, linkedSubjectName: "" }),
    USER_ID
  );
  const mapped = mapCloudTask(
    cloudRow({ subject_id: payload.subject_id, subject_name: payload.subject_name })
  );
  assert.equal(payload.subject_id, null);
  assert.equal(mapped.subject, "");
  assert.equal(mapped.linkedSubjectId, null);
});

test("Classroom metadata round-trips and repeated imports use the DB uniqueness key", async () => {
  const row = cloudRow({
    source: "classroom",
    external_id: "assignment-1",
    classroom_course_id: "course-1",
    classroom_course_name: "Economics",
    alternate_link: "https://classroom.google.com/a/1",
    work_type: "ASSIGNMENT",
    state: "PUBLISHED",
    submission_id: "submission-1",
    submission_state: "TURNED_IN",
    classroom_status_category: "done",
    late: true,
    assigned_grade: 8,
    draft_grade: 9,
    submission_updated_at: "2026-08-09T09:00:00.000Z",
    imported_at: "2026-08-09T10:00:00.000Z",
    source_updated_at: "2026-08-09T11:00:00.000Z",
    last_synced_at: "2026-08-09T12:00:00.000Z",
  });
  const task = mapCloudTask(row);
  const client = createTableClient({ rows: [row] });
  const saved = await upsertCloudClassroomTasks(client, USER_ID, [task, task]);
  assert.equal(saved[0].submissionId, "submission-1");
  assert.deepEqual(client.calls[0].options, {
    onConflict: "user_id,source,external_id",
  });
  assert.equal(client.calls[0].payload.length, 1);
  assert.equal(client.calls[0].payload[0].classroom_course_id, "course-1");
});

test("cloud failures reject so callers cannot report false success", async () => {
  const client = createTableClient({ errors: { insert: new Error("network") } });
  await assert.rejects(createCloudTask(client, USER_ID, dayloTask()), /network/);
});

test("Realtime is user-scoped and cleanup removes the task channel", () => {
  const calls = [];
  const channel = {
    on(...args) {
      calls.push(["on", ...args]);
      return channel;
    },
    subscribe() {
      return channel;
    },
  };
  const client = {
    channel(name) {
      calls.push(["channel", name]);
      return channel;
    },
    removeChannel(value) {
      calls.push(["removeChannel", value]);
    },
  };
  const cleanup = subscribeToCloudTaskChanges(client, USER_ID, () => {});
  cleanup();
  assert.equal(calls[0][1], `tasks:${USER_ID}`);
  assert.equal(calls[1][2].filter, `user_id=eq.${USER_ID}`);
  assert.deepEqual(calls.at(-1), ["removeChannel", channel]);
});

test("Today Plan and Calendar helpers preserve UUID task references", () => {
  const task = dayloTask();
  const savedPlan = {
    blocks: [
      {
        id: "study-1",
        type: "study",
        title: task.title,
        subject: task.subject,
        duration: 30,
        taskId: TASK_ID,
      },
    ],
  };
  const restored = restoreSavedPlanBlocks(savedPlan, [task], "16:00");
  const calendarEvents = getTaskCalendarEvents([task], [
    { id: SUBJECT_ID, name: "Economics", colour: "mint" },
  ]);
  assert.equal(restored[0].taskId, TASK_ID);
  assert.equal(calendarEvents[0].taskId, TASK_ID);
  assert.equal(calendarEvents[0].date, "2026-08-10");
});

test("App integration uses cloud Tasks and leaves legacy localStorage unimported", () => {
  const appSource = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  const hookSource = readFileSync(
    new URL("../hooks/useCloudTasks.js", import.meta.url),
    "utf8"
  );
  assert.match(appSource, /useCloudTasks\(auth\.user\)/);
  assert.doesNotMatch(appSource, /useState\(loadTasks\)/);
  assert.doesNotMatch(
    appSource,
    /localStorage\.setItem\("student-hub-tasks"/
  );
  assert.doesNotMatch(hookSource, /student-hub-tasks|localStorage/);
  assert.match(hookSource, /setWorkspace\(\{ userId: "", tasks: \[\] \}\)/);
  assert.match(hookSource, /getTasksForCloudWorkspace\(workspace, userId\)/);
});
