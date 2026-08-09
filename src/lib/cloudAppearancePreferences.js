import {
  DEFAULT_THEME_COLORS,
  normalizeThemeColors,
} from "../utils/appUtils.js";

const APPEARANCE_PREFERENCE_COLUMNS = [
  "user_id",
  "theme",
  "density",
  "theme_colors",
  "created_at",
  "updated_at",
].join(",");

const VALID_THEMES = new Set(["light", "dark", "system"]);
const VALID_DENSITIES = new Set(["compact", "comfortable"]);

export const DEFAULT_APPEARANCE_PREFERENCES = Object.freeze({
  theme: "light",
  density: "compact",
  themeColors: Object.freeze(normalizeThemeColors(DEFAULT_THEME_COLORS)),
});

function normalizeTheme(theme) {
  return VALID_THEMES.has(theme) ? theme : DEFAULT_APPEARANCE_PREFERENCES.theme;
}

function normalizeDensity(density) {
  return VALID_DENSITIES.has(density)
    ? density
    : DEFAULT_APPEARANCE_PREFERENCES.density;
}

export function getDefaultAppearancePreferences() {
  return {
    theme: DEFAULT_APPEARANCE_PREFERENCES.theme,
    density: DEFAULT_APPEARANCE_PREFERENCES.density,
    themeColors: { ...DEFAULT_APPEARANCE_PREFERENCES.themeColors },
  };
}

export function normalizeAppearancePreferences(preferences = {}) {
  return {
    theme: normalizeTheme(preferences.theme),
    density: normalizeDensity(preferences.density),
    themeColors: normalizeThemeColors(preferences.themeColors),
  };
}

export function mergeAppearancePreferences(currentPreferences, updates = {}) {
  const current = normalizeAppearancePreferences(currentPreferences);

  return normalizeAppearancePreferences({
    theme: Object.hasOwn(updates, "theme") ? updates.theme : current.theme,
    density: Object.hasOwn(updates, "density")
      ? updates.density
      : current.density,
    themeColors: Object.hasOwn(updates, "themeColors")
      ? updates.themeColors
      : current.themeColors,
  });
}

export function mapCloudAppearancePreferences(row = {}) {
  const preferences = normalizeAppearancePreferences({
    theme: row.theme,
    density: row.density,
    themeColors: row.theme_colors,
  });

  return {
    userId: String(row.user_id || ""),
    ...preferences,
  };
}

export function mapAppearancePreferencesForInsert(preferences, userId) {
  const normalized = normalizeAppearancePreferences(preferences);

  return {
    user_id: userId,
    theme: normalized.theme,
    density: normalized.density,
    theme_colors: normalized.themeColors,
  };
}

export function mapAppearancePreferencesForUpdate(updates = {}) {
  const payload = {};

  if (Object.hasOwn(updates, "theme")) {
    payload.theme = normalizeTheme(updates.theme);
  }
  if (Object.hasOwn(updates, "density")) {
    payload.density = normalizeDensity(updates.density);
  }
  if (Object.hasOwn(updates, "themeColors")) {
    payload.theme_colors = normalizeThemeColors(updates.themeColors);
  }

  return payload;
}

function isMissingRowError(error) {
  return error?.code === "PGRST116";
}

function isDuplicateRowError(error) {
  return error?.code === "23505";
}

export async function fetchCloudAppearancePreferences(client, userId) {
  if (!userId) return null;

  const { data, error } = await client
    .from("user_preferences")
    .select(APPEARANCE_PREFERENCE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error && !isMissingRowError(error)) throw error;
  return data ? mapCloudAppearancePreferences(data) : null;
}

export async function ensureCloudAppearancePreferences(client, userId) {
  if (!userId) return null;

  const existingPreferences = await fetchCloudAppearancePreferences(client, userId);
  if (existingPreferences) return existingPreferences;

  const defaults = getDefaultAppearancePreferences();
  const { data, error } = await client
    .from("user_preferences")
    .insert(mapAppearancePreferencesForInsert(defaults, userId))
    .select(APPEARANCE_PREFERENCE_COLUMNS)
    .single();

  if (!error) return mapCloudAppearancePreferences(data);
  if (!isDuplicateRowError(error)) throw error;

  const concurrentlyCreatedPreferences = await fetchCloudAppearancePreferences(
    client,
    userId
  );
  if (concurrentlyCreatedPreferences) return concurrentlyCreatedPreferences;
  throw error;
}

export async function updateCloudAppearancePreferences(
  client,
  userId,
  updates
) {
  if (!userId) throw new Error("Cannot save appearance without an authenticated user.");

  const payload = mapAppearancePreferencesForUpdate(updates);
  const { data, error } = await client
    .from("user_preferences")
    .update(payload)
    .eq("user_id", userId)
    .select(APPEARANCE_PREFERENCE_COLUMNS)
    .single();

  if (error) throw error;
  return mapCloudAppearancePreferences(data);
}

export function updateCloudTheme(client, userId, theme) {
  return updateCloudAppearancePreferences(client, userId, { theme });
}

export function updateCloudDensity(client, userId, density) {
  return updateCloudAppearancePreferences(client, userId, { density });
}

export function updateCloudThemeColors(client, userId, themeColors) {
  return updateCloudAppearancePreferences(client, userId, { themeColors });
}

export function getAppearancePreferencesForWorkspace(workspace, userId) {
  if (!userId || workspace?.userId !== userId) return null;
  return workspace.preferences || null;
}

export function subscribeToCloudAppearancePreferenceChanges(
  client,
  userId,
  onChange
) {
  if (!userId || typeof client?.channel !== "function") return () => {};

  const channel = client
    .channel(`appearance-preferences:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "user_preferences",
        filter: `user_id=eq.${userId}`,
      },
      onChange
    )
    .subscribe();

  return () => {
    if (typeof client.removeChannel === "function") {
      client.removeChannel(channel);
      return;
    }
    channel?.unsubscribe?.();
  };
}
