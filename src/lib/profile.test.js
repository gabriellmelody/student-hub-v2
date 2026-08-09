import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  bootstrapUserProfile,
  createDefaultProfile,
  ensureUserProfile,
  fetchUserProfile,
  getProfileDisplayName,
  getProfileForAuthenticatedUser,
  mapCloudProfile,
  mapProfileForUpdate,
  saveUserProfile,
  subscribeToUserProfileChanges,
  updateUserProfile,
} from "./profile.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function profileRow(overrides = {}) {
  return {
    id: USER_ID,
    display_name: "Maya Chen",
    avatar_id: "planet",
    school_system: "IB",
    onboarding_completed: true,
    ...overrides,
  };
}

function createProfileClient({ row = profileRow(), error = null } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      const state = { table, action: "select", filters: [], payload: null };
      const builder = {
        select() {
          return builder;
        },
        update(payload) {
          state.action = "update";
          state.payload = payload;
          return builder;
        },
        eq(column, value) {
          state.filters.push([column, value]);
          return builder;
        },
        maybeSingle() {
          calls.push(state);
          return Promise.resolve({ data: row, error });
        },
        single() {
          calls.push(state);
          return Promise.resolve({ data: row, error });
        },
      };
      return builder;
    },
  };
}

test("maps DB profile fields to the normal DayLo profile model", () => {
  assert.deepEqual(mapCloudProfile(profileRow()), {
    id: USER_ID,
    displayName: "Maya Chen",
    avatarId: "planet",
    schoolSystem: "IB",
    onboardingCompleted: true,
  });
});

test("maps DayLo profile fields to DB updates", () => {
  assert.deepEqual(
    mapProfileForUpdate({
      displayName: "  Maya Chen  ",
      avatarId: "book",
      schoolSystem: "A-Level",
      onboardingCompleted: false,
    }),
    {
      display_name: "Maya Chen",
      avatar_id: "book",
      school_system: "A-Level",
      onboarding_completed: false,
    }
  );
});

test("authenticated profile loads by the current auth UUID", async () => {
  const client = createProfileClient();
  const loaded = await fetchUserProfile(client, USER_ID);
  assert.equal(loaded.id, USER_ID);
  assert.deepEqual(client.calls[0].filters, [["id", USER_ID]]);
});

test("display name and avatar updates persist after confirmed DB success", async () => {
  const client = createProfileClient({
    row: profileRow({ display_name: "Ari Patel", avatar_id: "star" }),
  });
  const saved = await saveUserProfile(client, USER_ID, {
    displayName: " Ari Patel ",
    avatarId: "star",
  });
  assert.equal(saved.displayName, "Ari Patel");
  assert.equal(saved.avatarId, "star");
  assert.deepEqual(client.calls[0].payload, {
    display_name: "Ari Patel",
    avatar_id: "star",
  });
});

test("blank and overlong display names remain invalid", () => {
  assert.throws(() => mapProfileForUpdate({ displayName: "   " }), /display name/i);
  assert.throws(
    () => mapProfileForUpdate({ displayName: "x".repeat(41) }),
    /display name/i
  );
});

test("profile updates remain scoped to the auth UUID", async () => {
  const client = createProfileClient();
  const saved = await saveUserProfile(client, USER_ID, { avatarId: "planet" });
  assert.equal(saved.id, USER_ID);
  assert.deepEqual(client.calls[0].filters, [["id", USER_ID]]);
});

test("failed profile writes reject instead of reporting success", async () => {
  const client = createProfileClient({ error: new Error("network") });
  await assert.rejects(
    saveUserProfile(client, USER_ID, { displayName: "Maya" }),
    /network/
  );
});

test("logout and account switching cannot expose the previous profile", () => {
  const userAProfile = mapCloudProfile(profileRow());
  assert.equal(getProfileForAuthenticatedUser(userAProfile, USER_ID), userAProfile);
  assert.equal(getProfileForAuthenticatedUser(userAProfile, ""), null);
  assert.equal(getProfileForAuthenticatedUser(userAProfile, "user-b"), null);
});

test("Realtime profile events are user-scoped and clean up", () => {
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
  let refreshCalls = 0;
  const cleanup = subscribeToUserProfileChanges(client, USER_ID, () => {
    refreshCalls += 1;
  });
  calls[1][3]();
  cleanup();
  assert.equal(refreshCalls, 1);
  assert.equal(calls[0][1], `profile:${USER_ID}`);
  assert.equal(calls[1][2].filter, `id=eq.${USER_ID}`);
  assert.deepEqual(calls.at(-1), ["removeChannel", channel]);
});

test("school system and onboarding completion map safely", () => {
  const mapped = mapCloudProfile(
    profileRow({ school_system: "GCSE", onboarding_completed: false })
  );
  assert.equal(mapped.schoolSystem, "GCSE");
  assert.equal(mapped.onboardingCompleted, false);
  assert.deepEqual(
    mapProfileForUpdate({ schoolSystem: "IB", onboardingCompleted: true }),
    { school_system: "IB", onboarding_completed: true }
  );
});

test("authenticated App identity does not read or write legacy local profiles", () => {
  const appSource = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(appSource, /loadLocalProfile|saveLocalProfile/);
  assert.doesNotMatch(
    appSource,
    /localStorage\.setItem\(\s*["']student-hub-student-profile["']/
  );
  assert.match(appSource, /displayName: studentProfile\.displayName/);
  assert.match(appSource, /auth\.updateProfile/);
});

test("AuthProvider refreshes on profile events and cleans up on user changes", () => {
  const source = readFileSync(
    new URL("../hooks/useAuth.jsx", import.meta.url),
    "utf8"
  );
  assert.match(
    source,
    /subscribeToUserProfileChanges\(\s*supabase,\s*userId,\s*scheduleRefresh/
  );
  assert.match(source, /loadProfile\(user, \{ retry: false, silent: true \}\)/);
  assert.match(source, /unsubscribe\(\)/);
  assert.match(source, /getProfileForAuthenticatedUser\(profile, user\?\.id/);
});

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

  assert.deepEqual(result, mapCloudProfile(profile));
  assert.equal(insertCalls, 1);
  assert.equal(selectCalls, 2);
});
