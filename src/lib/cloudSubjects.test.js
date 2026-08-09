import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  createCloudSubject,
  deleteCloudSubject,
  fetchCloudSubjects,
  isCloudSubjectId,
  mapCloudSubject,
  mapSubjectForInsert,
  mapSubjectForUpdate,
  reconcileCloudSubjects,
  subscribeToCloudSubjectChanges,
  updateCloudSubject,
} from "./cloudSubjects.js";

const USER_ID = "user-123";
const FIRST_UUID = "11111111-1111-4111-8111-111111111111";
const SECOND_UUID = "22222222-2222-4222-9222-222222222222";

function cloudRow(overrides = {}) {
  return {
    id: FIRST_UUID,
    user_id: USER_ID,
    name: "Biology",
    course_system: "IB",
    level: "HL",
    current_grade: "6",
    target_grade: "7",
    colour: "mint",
    source: "manual",
    classroom_course_id: null,
    external_id: null,
    imported_at: null,
    last_synced_at: null,
    sort_order: 0,
    created_at: "2026-08-09T00:00:00.000Z",
    updated_at: "2026-08-09T00:00:00.000Z",
    ...overrides,
  };
}

function subject(overrides = {}) {
  return {
    id: FIRST_UUID,
    name: "Biology",
    courseSystem: "IB",
    level: "HL",
    currentGrade: "6",
    targetGrade: "7",
    colour: "mint",
    source: "manual",
    classroomCourseId: null,
    externalId: null,
    importedAt: null,
    lastSyncedAt: null,
    sortOrder: 0,
    ...overrides,
  };
}

function createTableClient({ selectRows = [], singleRows = [], errors = {} } = {}) {
  const calls = [];
  const client = {
    calls,
    from(table) {
      const state = { table, action: null, payload: null, filters: [], orders: [] };
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
        delete() {
          state.action = "delete";
          return builder;
        },
        eq(column, value) {
          state.filters.push([column, value]);
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
          const action = state.action || "select";
          return Promise.resolve({
            data: action === "select" ? selectRows : null,
            error: errors[action] || null,
          }).then(resolve);
        },
      };
      return builder;
    },
  };
  return client;
}

test("maps cloud Subject rows to the normal DayLo Subject model", () => {
  assert.deepEqual(mapCloudSubject(cloudRow()), subject());
});

test("maps DayLo Subject objects to Supabase insert and update payloads", () => {
  const nextSubject = subject({ id: "temporary", classroomCourseId: "course-1" });

  assert.deepEqual(mapSubjectForInsert(nextSubject, USER_ID, 3), {
    user_id: USER_ID,
    name: "Biology",
    course_system: "IB",
    level: "HL",
    current_grade: "6",
    target_grade: "7",
    colour: "mint",
    source: "manual",
    classroom_course_id: "course-1",
    external_id: null,
    imported_at: null,
    last_synced_at: null,
    sort_order: 3,
  });
  assert.equal("user_id" in mapSubjectForUpdate(nextSubject, 3), false);
});

test("loads authenticated user's subjects from Supabase in stored order", async () => {
  const client = createTableClient({ selectRows: [cloudRow()] });
  const loaded = await fetchCloudSubjects(client, USER_ID);

  assert.deepEqual(loaded, [subject()]);
  assert.deepEqual(client.calls[0].filters, [["user_id", USER_ID]]);
  assert.deepEqual(client.calls[0].orders.map(([column]) => column), [
    "sort_order",
    "created_at",
  ]);
});

test("loads an empty list for an account with no Subjects", async () => {
  const client = createTableClient({ selectRows: [] });
  assert.deepEqual(await fetchCloudSubjects(client, USER_ID), []);
});

test("does not query Supabase when there is no authenticated user", async () => {
  const client = createTableClient({ selectRows: [cloudRow()] });

  assert.deepEqual(await fetchCloudSubjects(client, ""), []);
  assert.deepEqual(client.calls, []);
});

test("creates new Subjects with user ownership and returned cloud UUID", async () => {
  const client = createTableClient({ singleRows: [cloudRow({ id: SECOND_UUID })] });
  const saved = await createCloudSubject(
    client,
    USER_ID,
    subject({ id: "subject-temp" }),
    1
  );

  assert.equal(saved.id, SECOND_UUID);
  assert.equal(client.calls[0].payload.user_id, USER_ID);
  assert.equal(client.calls[0].payload.sort_order, 1);
  assert.equal(isCloudSubjectId(saved.id), true);
});

test("updates existing cloud Subjects without changing IDs or Classroom metadata", async () => {
  const linkedRow = cloudRow({
    classroom_course_id: "course-42",
    external_id: "course-42",
    imported_at: "2026-08-09T02:00:00.000Z",
    source: "classroom",
  });
  const client = createTableClient({ singleRows: [linkedRow] });
  const saved = await updateCloudSubject(
    client,
    USER_ID,
    subject({ name: "Biology HL", classroomCourseId: "course-42", externalId: "course-42", importedAt: linkedRow.imported_at, source: "classroom" }),
    0
  );

  assert.equal(saved.id, FIRST_UUID);
  assert.equal(saved.classroomCourseId, "course-42");
  assert.deepEqual(client.calls[0].filters, [
    ["user_id", USER_ID],
    ["id", FIRST_UUID],
  ]);
});

test("reorder persists through sort_order updates while preserving Subject IDs and data", async () => {
  const math = subject({ id: FIRST_UUID, name: "Maths", sortOrder: 0 });
  const history = subject({ id: SECOND_UUID, name: "History", sortOrder: 1 });
  const client = createTableClient({
    singleRows: [
      cloudRow({ id: SECOND_UUID, name: "History", sort_order: 0 }),
      cloudRow({ id: FIRST_UUID, name: "Maths", sort_order: 1 }),
    ],
  });

  const result = await reconcileCloudSubjects({
    client,
    userId: USER_ID,
    currentSubjects: [math, history],
    nextSubjects: [history, math],
  });

  assert.deepEqual(result.subjects.map((item) => item.id), [SECOND_UUID, FIRST_UUID]);
  assert.deepEqual(client.calls.map((call) => call.payload.sort_order), [0, 1]);
});

test("delete removes only the cloud row for the current user", async () => {
  const client = createTableClient();
  await deleteCloudSubject(client, USER_ID, FIRST_UUID);

  assert.equal(client.calls[0].action, "delete");
  assert.deepEqual(client.calls[0].filters, [
    ["user_id", USER_ID],
    ["id", FIRST_UUID],
  ]);
});

test("reconcile deletes removed cloud Subjects but never deletes temporary local drafts", async () => {
  const client = createTableClient();
  await reconcileCloudSubjects({
    client,
    userId: USER_ID,
    currentSubjects: [subject(), subject({ id: "subject-local", name: "Draft" })],
    nextSubjects: [],
  });

  assert.deepEqual(client.calls.map((call) => call.action), ["delete"]);
  assert.deepEqual(client.calls[0].filters.at(-1), ["id", FIRST_UUID]);
});

test("cloud save failure rejects instead of falsely reporting success", async () => {
  const client = createTableClient({ errors: { insert: new Error("network") } });

  await assert.rejects(
    reconcileCloudSubjects({
      client,
      userId: USER_ID,
      currentSubjects: [],
      nextSubjects: [subject({ id: "subject-temp" })],
    }),
    /network/
  );
});

test("Realtime subscription uses the Subjects table and cleans up on user changes", () => {
  const calls = [];
  const channel = { on: (...args) => { calls.push(["on", ...args]); return channel; }, subscribe: () => channel };
  const client = {
    channel: (name) => { calls.push(["channel", name]); return channel; },
    removeChannel: (removedChannel) => calls.push(["removeChannel", removedChannel]),
  };

  const cleanup = subscribeToCloudSubjectChanges(client, USER_ID, () => {});
  cleanup();

  assert.equal(calls[0][1], `subjects:${USER_ID}`);
  assert.deepEqual(calls[1][2], {
    event: "*",
    schema: "public",
    table: "subjects",
    filter: `user_id=eq.${USER_ID}`,
  });
  assert.deepEqual(calls.at(-1), ["removeChannel", channel]);
});

test("Realtime subscription is a no-op without an authenticated user", () => {
  const client = {
    channel: () => {
      throw new Error("should not subscribe");
    },
  };

  assert.doesNotThrow(() => subscribeToCloudSubjectChanges(client, "", () => {})());
});

test("App no longer imports localStorage Subjects as the authenticated source", () => {
  const appSource = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(appSource, /useCloudSubjects\(auth\.user\)/);
  assert.doesNotMatch(appSource, /useState\(loadSubjects\)/);
  assert.doesNotMatch(appSource, /setItem\("student-hub-subjects"/);
});

test("cloud hook clears previous Subjects on logout or account switch", () => {
  const hookSource = readFileSync(new URL("../hooks/useCloudSubjects.js", import.meta.url), "utf8");
  assert.match(hookSource, /setSubjectsState\(\[\]\)/);
  assert.match(hookSource, /userIdRef\.current = userId/);
  assert.match(hookSource, /userIdRef\.current !== userId/);
});
