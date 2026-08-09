import assert from "node:assert/strict";
import test from "node:test";
import { bootstrapUserProfile, createDefaultProfile, ensureUserProfile, getProfileDisplayName, updateUserProfile } from "./profile.js";

test("profile defaults belong to the authenticated user", () => {
  const profile = createDefaultProfile({ id: "user-1", email: "alex.student@example.com" });

  assert.deepEqual(profile, {
    id: "user-1",
    display_name: "Alex Student",
    avatar_id: "initials",
    school_system: "",
    onboarding_completed: false,
  });
});

test("profile display name falls back safely", () => {
  assert.equal(getProfileDisplayName({ user_metadata: { display_name: "  Maya  " } }), "Maya");
  assert.equal(getProfileDisplayName({ email: "" }), "Student");
});

test("profile update helper scopes updates to the authenticated user id", async () => {
  const calls = [];
  const client = {
    from(table) {
      calls.push(["from", table]);
      return {
        update(updates) {
          calls.push(["update", updates]);
          return {
            eq(column, value) {
              calls.push(["eq", column, value]);
              return {
                select(columns) {
                  calls.push(["select", columns]);
                  return { single: async () => ({ data: { id: value }, error: null }) };
                },
              };
            },
          };
        },
      };
    },
  };

  await updateUserProfile(client, "user-1", { display_name: "Maya" });
  assert.deepEqual(calls.slice(0, 3), [
    ["from", "profiles"],
    ["update", { display_name: "Maya" }],
    ["eq", "id", "user-1"],
  ]);
});


test("authenticated session bootstraps a profile", async () => {
  const profile = { id: "user-1", display_name: "Maya" };
  const result = await bootstrapUserProfile({
    user: { id: "user-1" },
    ensureProfile: async () => profile,
    waitForRetry: async () => {},
  });

  assert.equal(result, profile);
});

test("temporary first profile bootstrap failure retries once and succeeds", async () => {
  let calls = 0;
  const profile = { id: "user-1", display_name: "Maya" };
  const result = await bootstrapUserProfile({
    user: { id: "user-1" },
    waitForRetry: async () => {},
    ensureProfile: async () => {
      calls += 1;
      if (calls === 1) throw new Error("session settling");
      return profile;
    },
  });

  assert.equal(result, profile);
  assert.equal(calls, 2);
});

test("persistent profile bootstrap failure remains recoverable by caller", async () => {
  let calls = 0;

  await assert.rejects(
    bootstrapUserProfile({
      user: { id: "user-1" },
      waitForRetry: async () => {},
      ensureProfile: async () => {
        calls += 1;
        throw new Error("still failing");
      },
    }),
    /still failing/
  );
  assert.equal(calls, 2);
});

test("unauthenticated state never bootstraps a profile", async () => {
  let calls = 0;
  const result = await bootstrapUserProfile({
    user: null,
    ensureProfile: async () => {
      calls += 1;
      return {};
    },
  });

  assert.equal(result, null);
  assert.equal(calls, 0);
});

test("duplicate profile insert race reselects without creating a duplicate", async () => {
  const profile = createDefaultProfile({ id: "user-1", email: "maya@example.com" });
  let selectCalls = 0;
  let insertCalls = 0;
  const client = {
    from(table) {
      assert.equal(table, "profiles");
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => {
                  selectCalls += 1;
                  return selectCalls === 1
                    ? { data: null, error: { code: "PGRST116" } }
                    : { data: profile, error: null };
                },
              };
            },
            single: async () => {
              insertCalls += 1;
              return { data: null, error: { code: "23505", message: "duplicate key value" } };
            },
          };
        },
        insert() {
          return {
            select() {
              return {
                single: async () => {
                  insertCalls += 1;
                  return { data: null, error: { code: "23505", message: "duplicate key value" } };
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await ensureUserProfile(client, { id: "user-1", email: "maya@example.com" });

  assert.deepEqual(result, profile);
  assert.equal(insertCalls, 1);
  assert.equal(selectCalls, 2);
});
