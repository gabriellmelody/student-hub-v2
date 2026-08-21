import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { searchSettings } from "./settingsSearch.js";

test("empty settings search returns the normal state", () => assert.deepEqual(searchSettings("  "), []));
test("exact labels rank ahead of aliases and weak matches", () => assert.equal(searchSettings("notifications")[0].id, "notifications"));
for (const [query, expected] of [["password", "change-password"], ["dark", "appearance-mode"], ["color", "accent-colour"], ["colour", "accent-colour"], ["classroom", "google-classroom"], ["calendar", "google-calendar"], ["alerts", "notifications"], ["planning reminder", "planning-reminder"], ["quiet", "quiet-hours"], ["quick links", "quick-links"], ["install", "app-updates"]]) test(`settings search maps ${query}`, () => assert.equal(searchSettings(query)[0].id, expected));
test("settings search source navigates, targets, highlights, and does not mutate preferences", () => { const source = readFileSync(new URL("../pages/SettingsPage.jsx", import.meta.url), "utf8"); assert.match(source, /setSettingsView\(result\.view\)/); assert.match(source, /getElementById\(result\.anchor\)/); assert.match(source, /setHighlightedSettingId\(result\.anchor\)/); assert.doesNotMatch(source.match(/function openSearchResult[\s\S]*?\n  }/)?.[0] || "", /onUpdateNotificationPreferences|setTheme\(/); });
test("direct notifications route selects its subpage", () => { const source = readFileSync(new URL("../App.jsx", import.meta.url), "utf8"); assert.match(source, /pathname === "\/settings\/notifications"[\s\S]*?\? "notifications"/); });
