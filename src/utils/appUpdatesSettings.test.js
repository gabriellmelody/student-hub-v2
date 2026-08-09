import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const settingsPage = readFileSync(new URL("../pages/SettingsPage.jsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const settingsCss = readFileSync(new URL("../styles/settings.css", import.meta.url), "utf8");
const viteConfig = readFileSync(new URL("../../vite.config.js", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

test("Settings has an App & updates section with current version rows", () => {
  assert.match(settingsPage, /App & updates/);
  assert.match(settingsPage, /Installation/);
  assert.match(settingsPage, /Updates/);
  assert.match(settingsPage, /Current version/);
  assert.match(settingsPage, /Latest version/);
  assert.match(settingsPage, /DayLo \{currentVersion\}/);
});

test("Settings update actions reuse the shared App update control", () => {
  assert.match(app, /const updateControl = useMemo/);
  assert.match(settingsPage, /onClick=\{updateControl\.onCheckForUpdates\}/);
  assert.match(settingsPage, /onClick=\{updateControl\.onUpdateNow\}/);
  assert.match(settingsPage, /onClick=\{updateControl\.onLater\}/);
});

test("version metadata is generated from package version", () => {
  assert.equal(packageJson.version, "0.9.2");
  assert.match(viteConfig, /readFileSync\(new URL\("\.\/package\.json"/);
  assert.match(viteConfig, /fileName: "version\.json"/);
  assert.match(viteConfig, /__DAYLO_VERSION__/);
});

test("Settings App & updates has narrow mobile layout protection", () => {
  assert.match(settingsCss, /@media \(max-width: 420px\)/);
  assert.match(settingsCss, /\.app-updates-facts > div/);
  assert.match(settingsCss, /grid-template-columns: 1fr/);
});
