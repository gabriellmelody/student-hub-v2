import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_LOGO_APPEARANCE,
  DEFAULT_THEME_COLORS,
  THEME_COLORS_STORAGE_KEY,
  loadThemeColors,
  migrateLegacyThemeColors,
  normalizeThemeColors,
  saveThemeColors,
  themeColorPalettes,
} from "./appUtils.js";

function createMemoryStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    read: (key) => values.get(key),
  };
}

test("the untouched Lavender preset migrates to Rose", () => {
  const migrated = migrateLegacyThemeColors({
    paletteId: "lavender",
    primary: "#7c3aed",
    secondary: "#db2777",
    tertiary: "#6366f1",
  });
  const rose = themeColorPalettes.find((palette) => palette.id === "rose");

  assert.deepEqual(
    {
      paletteId: migrated.paletteId,
      primary: migrated.primary,
      secondary: migrated.secondary,
      tertiary: migrated.tertiary,
    },
    {
      paletteId: "rose",
      primary: rose.primary,
      secondary: rose.secondary,
      tertiary: rose.tertiary,
    }
  );
});

test("customized Lavender colours remain unchanged and become Custom", () => {
  const migrated = normalizeThemeColors({
    paletteId: "lavender",
    primary: "#7c3aed",
    secondary: "#c45a82",
    tertiary: "#6366f1",
  });

  assert.equal(migrated.paletteId, "custom");
  assert.equal(migrated.primary, "#7c3aed");
  assert.equal(migrated.secondary, "#c45a82");
  assert.equal(migrated.tertiary, "#6366f1");
});

test("logo appearance defaults and invalid values fall back to Brand colours", () => {
  assert.equal(DEFAULT_LOGO_APPEARANCE, "brand");
  assert.equal(DEFAULT_THEME_COLORS.logoAppearance, "brand");
  assert.equal(normalizeThemeColors(null).logoAppearance, "brand");
  assert.equal(
    normalizeThemeColors({ logoAppearance: "unknown" }).logoAppearance,
    "brand"
  );
});

test("Appearance reset restores the DayLo palette and Brand colours logo", () => {
  const resetTheme = normalizeThemeColors(DEFAULT_THEME_COLORS);

  assert.equal(resetTheme.paletteId, "student-hub");
  assert.equal(resetTheme.primary, "#73a8df");
  assert.equal(resetTheme.secondary, "#ffa36b");
  assert.equal(resetTheme.tertiary, "#10213c");
  assert.equal(resetTheme.logoAppearance, "brand");
  assert.equal(resetTheme.backgroundMode, "neutral");
  assert.equal(resetTheme.backgroundStrength, "off");
});

test("Single colour logo preference persists without changing palette colours", () => {
  const originalWindow = globalThis.window;
  const storage = createMemoryStorage();
  globalThis.window = { localStorage: storage };

  try {
    saveThemeColors({
      ...DEFAULT_THEME_COLORS,
      logoAppearance: "single",
    });
    const loaded = loadThemeColors();

    assert.equal(loaded.logoAppearance, "single");
    assert.equal(loaded.primary, DEFAULT_THEME_COLORS.primary);
    assert.equal(loaded.secondary, DEFAULT_THEME_COLORS.secondary);
    assert.equal(loaded.tertiary, DEFAULT_THEME_COLORS.tertiary);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("loading Lavender persists the safe Rose migration", () => {
  const originalWindow = globalThis.window;
  const storage = createMemoryStorage({
    [THEME_COLORS_STORAGE_KEY]: JSON.stringify({
      paletteId: "lavender",
      primary: "#7c3aed",
      secondary: "#db2777",
      tertiary: "#6366f1",
      logoAppearance: "single",
    }),
  });
  globalThis.window = { localStorage: storage };

  try {
    const loaded = loadThemeColors();
    const persisted = JSON.parse(storage.read(THEME_COLORS_STORAGE_KEY));

    assert.equal(loaded.paletteId, "rose");
    assert.equal(loaded.logoAppearance, "single");
    assert.equal(persisted.paletteId, "rose");
    assert.equal(persisted.logoAppearance, "single");
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
