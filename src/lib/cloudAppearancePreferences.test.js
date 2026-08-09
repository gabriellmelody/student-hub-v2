import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  DEFAULT_APPEARANCE_PREFERENCES,
  ensureCloudAppearancePreferences,
  getAppearancePreferencesForWorkspace,
  mapAppearancePreferencesForInsert,
  mapAppearancePreferencesForUpdate,
  mapCloudAppearancePreferences,
  subscribeToCloudAppearancePreferenceChanges,
  updateCloudAppearancePreferences,
  updateCloudDensity,
  updateCloudTheme,
  updateCloudThemeColors,
} from "./cloudAppearancePreferences.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-9222-222222222222";

const THEME_COLORS = {
  paletteId: "sunset",
  primary: "#bb6688",
  secondary: "#dd9955",
  tertiary: "#334466",
  logoAppearance: "single",
  backgroundMode: "custom",
  backgroundTone: "#ffeecc",
  backgroundStrength: "medium",
};

function cloudRow(overrides = {}) {
  return {
    user_id: USER_ID,
    theme: "system",
    density: "comfortable",
    theme_colors: THEME_COLORS,
    created_at: "2026-08-09T10:00:00.000Z",
    updated_at: "2026-08-09T10:00:00.000Z",
    ...overrides,
  };
}

function createPreferenceClient(responseQueues = {}) {
  const calls = [];
  const queues = {
    select: [...(responseQueues.select || [])],
    insert: [...(responseQueues.insert || [])],
    update: [...(responseQueues.update || [])],
  };

  return {
    calls,
    from(table) {
      const state = { table, action: "select", payload: null, filters: [] };
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
        eq(column, value) {
          state.filters.push([column, value]);
          return builder;
        },
        maybeSingle() {
          calls.push({ ...state });
          return Promise.resolve(
            queues.select.shift() || { data: null, error: null }
          );
        },
        single() {
          calls.push({ ...state });
          return Promise.resolve(
            queues[state.action].shift() || { data: null, error: null }
          );
        },
      };
      return builder;
    },
  };
}

test("maps DB appearance fields to the DayLo shape", () => {
  assert.deepEqual(mapCloudAppearancePreferences(cloudRow()), {
    userId: USER_ID,
    theme: "system",
    density: "comfortable",
    themeColors: THEME_COLORS,
  });
});

test("maps DayLo appearance fields to DB names", () => {
  assert.deepEqual(
    mapAppearancePreferencesForInsert(
      { theme: "dark", density: "compact", themeColors: THEME_COLORS },
      USER_ID
    ),
    {
      user_id: USER_ID,
      theme: "dark",
      density: "compact",
      theme_colors: THEME_COLORS,
    }
  );
});

test("an account without preferences gets current DayLo defaults", async () => {
  globalThis.localStorage = {
    getItem() {
      throw new Error("legacy preferences must not be imported");
    },
  };
  const defaultRow = cloudRow({
    theme: DEFAULT_APPEARANCE_PREFERENCES.theme,
    density: DEFAULT_APPEARANCE_PREFERENCES.density,
    theme_colors: DEFAULT_APPEARANCE_PREFERENCES.themeColors,
  });
  const client = createPreferenceClient({
    select: [{ data: null, error: null }],
    insert: [{ data: defaultRow, error: null }],
  });

  const preferences = await ensureCloudAppearancePreferences(client, USER_ID);
  assert.equal(preferences.theme, "light");
  assert.equal(preferences.density, "compact");
  assert.deepEqual(client.calls[1].payload.theme_colors, {
    ...DEFAULT_APPEARANCE_PREFERENCES.themeColors,
  });
  delete globalThis.localStorage;
});

test("a concurrent default-row insert safely reloads the winning row", async () => {
  const winner = cloudRow({ theme: "dark" });
  const client = createPreferenceClient({
    select: [
      { data: null, error: null },
      { data: winner, error: null },
    ],
    insert: [{ data: null, error: { code: "23505" } }],
  });

  const preferences = await ensureCloudAppearancePreferences(client, USER_ID);
  assert.equal(preferences.theme, "dark");
  assert.equal(client.calls.filter((call) => call.action === "insert").length, 1);
});

test("theme updates persist through the user-owned row", async () => {
  const client = createPreferenceClient({
    update: [{ data: cloudRow({ theme: "dark" }), error: null }],
  });
  const saved = await updateCloudTheme(client, USER_ID, "dark");
  assert.equal(saved.theme, "dark");
  assert.deepEqual(client.calls[0].filters, [["user_id", USER_ID]]);
  assert.equal(client.calls[0].payload.theme, "dark");
});

test("density updates persist", async () => {
  const client = createPreferenceClient({
    update: [{ data: cloudRow({ density: "compact" }), error: null }],
  });
  const saved = await updateCloudDensity(client, USER_ID, "compact");
  assert.equal(saved.density, "compact");
  assert.equal(client.calls[0].payload.density, "compact");
});

test("paletteId persists inside theme_colors", () => {
  assert.equal(
    mapAppearancePreferencesForUpdate({ themeColors: THEME_COLORS })
      .theme_colors.paletteId,
    "sunset"
  );
});

test("primary, secondary and tertiary colours persist", () => {
  const colors = mapAppearancePreferencesForUpdate({ themeColors: THEME_COLORS })
    .theme_colors;
  assert.equal(colors.primary, "#bb6688");
  assert.equal(colors.secondary, "#dd9955");
  assert.equal(colors.tertiary, "#334466");
});

test("logoAppearance persists", () => {
  assert.equal(
    mapAppearancePreferencesForUpdate({ themeColors: THEME_COLORS })
      .theme_colors.logoAppearance,
    "single"
  );
});

test("backgroundMode persists", () => {
  assert.equal(
    mapAppearancePreferencesForUpdate({ themeColors: THEME_COLORS })
      .theme_colors.backgroundMode,
    "custom"
  );
});

test("backgroundTone persists", () => {
  assert.equal(
    mapAppearancePreferencesForUpdate({ themeColors: THEME_COLORS })
      .theme_colors.backgroundTone,
    "#ffeecc"
  );
});

test("backgroundStrength persists", () => {
  assert.equal(
    mapAppearancePreferencesForUpdate({ themeColors: THEME_COLORS })
      .theme_colors.backgroundStrength,
    "medium"
  );
});

test("theme color updates use one JSONB object", async () => {
  const client = createPreferenceClient({
    update: [{ data: cloudRow(), error: null }],
  });
  await updateCloudThemeColors(client, USER_ID, THEME_COLORS);
  assert.deepEqual(client.calls[0].payload, { theme_colors: THEME_COLORS });
});

test("system remains a stored preference instead of resolving to light or dark", () => {
  assert.equal(mapAppearancePreferencesForUpdate({ theme: "system" }).theme, "system");
  assert.equal(mapCloudAppearancePreferences(cloudRow()).theme, "system");
});

test("logout clears access to account-scoped appearance state", () => {
  const workspace = {
    userId: USER_ID,
    preferences: mapCloudAppearancePreferences(cloudRow()),
  };
  assert.equal(getAppearancePreferencesForWorkspace(workspace, ""), null);
});

test("an account switch cannot inherit the previous user's appearance", () => {
  const workspace = {
    userId: USER_ID,
    preferences: mapCloudAppearancePreferences(cloudRow()),
  };
  assert.equal(
    getAppearancePreferencesForWorkspace(workspace, OTHER_USER_ID),
    null
  );
});

test("Realtime listens only to the authenticated preference row", () => {
  let handler = null;
  let removedChannel = null;
  const channel = {
    on(_event, config, nextHandler) {
      assert.deepEqual(config, {
        event: "*",
        schema: "public",
        table: "user_preferences",
        filter: `user_id=eq.${USER_ID}`,
      });
      handler = nextHandler;
      return channel;
    },
    subscribe() {
      return channel;
    },
  };
  const client = {
    channel(name) {
      assert.equal(name, `appearance-preferences:${USER_ID}`);
      return channel;
    },
    removeChannel(value) {
      removedChannel = value;
    },
  };
  let refreshCount = 0;
  const unsubscribe = subscribeToCloudAppearancePreferenceChanges(
    client,
    USER_ID,
    () => {
      refreshCount += 1;
    }
  );

  handler();
  assert.equal(refreshCount, 1);
  unsubscribe();
  assert.equal(removedChannel, channel);
});

test("failed writes reject and never report a saved preference", async () => {
  const failure = new Error("offline");
  const client = createPreferenceClient({
    update: [{ data: null, error: failure }],
  });
  await assert.rejects(
    updateCloudAppearancePreferences(client, USER_ID, { theme: "dark" }),
    failure
  );
});

test("the app uses cloud preferences without legacy appearance dual writes", () => {
  const appSource = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(appSource, /useCloudAppearancePreferences\(auth\.user\)/);
  assert.match(appSource, /appearanceLoading/);
  assert.doesNotMatch(appSource, /localStorage\.setItem\("student-hub-theme"/);
  assert.doesNotMatch(appSource, /localStorage\.setItem\("student-hub-density"/);
  assert.doesNotMatch(appSource, /loadThemeColors/);
});

test("the hook clears account state and refreshes on Realtime changes", () => {
  const hookSource = readFileSync(
    new URL("../hooks/useCloudAppearancePreferences.js", import.meta.url),
    "utf8"
  );
  assert.match(hookSource, /setWorkspace\(\{ userId: "", preferences: null \}\)/);
  assert.match(hookSource, /subscribeToCloudAppearancePreferenceChanges/);
  assert.match(hookSource, /loadPreferences\(\{ silent: true \}\)/);
  assert.match(hookSource, /unsubscribe\(\)/);
});

test("the hook rolls a failed optimistic write back and retains retry data", () => {
  const hookSource = readFileSync(
    new URL("../hooks/useCloudAppearancePreferences.js", import.meta.url),
    "utf8"
  );
  assert.match(hookSource, /rollbackPreferences = confirmedPreferencesRef\.current/);
  assert.match(hookSource, /failedPreferencesRef\.current = optimisticPreferences/);
  assert.match(hookSource, /return updatePreferences\(failedPreferencesRef\.current\)/);
});
