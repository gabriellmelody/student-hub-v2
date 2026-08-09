import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { gettingStartedGuidedTour } from "../data/guidedTours.js";

function cssRule(source, selector) {
  const start = source.indexOf(`${selector} {`);
  if (start === -1) return "";

  const ruleStart = source.indexOf("{", start);
  const ruleEnd = source.indexOf("}", ruleStart);
  return source.slice(ruleStart + 1, ruleEnd);
}

const appChrome = readFileSync(new URL("../components/AppChrome.jsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const shellCss = readFileSync(new URL("../styles/shell.css", import.meta.url), "utf8");
const responsiveCss = readFileSync(new URL("../styles/responsive.css", import.meta.url), "utf8");

test("desktop Settings shortcut opens the existing Settings page", () => {
  assert.match(appChrome, /function SettingsShortcut/);
  assert.match(appChrome, /data-tour="settings-shortcut"/);
  assert.match(appChrome, /onClick=\{\(\) => openSettings\("hub"\)\}/);
  assert.match(app, /<SettingsShortcut[\s\S]*openSettings=\{openSettings\}/);
});

test("collapsed sidebar keeps Settings available as an accessible button", () => {
  assert.match(appChrome, /aria-label=\{collapsed \? "Open Settings" : undefined\}/);
  assert.match(appChrome, /title=\{collapsed \? "Settings" : undefined\}/);
  assert.match(shellCss, /\.sidebar\.collapsed \.sidebar-settings-shortcut/);
  assert.match(shellCss, /\.sidebar\.collapsed \.sidebar-settings-shortcut-label \{[\s\S]*display: none;/);
});

test("mobile Settings action opens Settings directly", () => {
  assert.match(appChrome, /className="mobile-settings-shortcut"/);
  assert.match(appChrome, /data-tour="mobile-settings-shortcut"/);
  assert.match(appChrome, /onClick=\{\(\) => openSettings\("hub"\)\}/);
  assert.match(app, /<MobileTopBar[\s\S]*openSettings=\{openSettings\}/);
});

test("existing account and profile menu actions remain available", () => {
  assert.match(appChrome, /function AccountMenu/);
  assert.match(appChrome, /chooseItem\(onEditProfile\)/);
  assert.match(appChrome, /chooseItem\(\(\) => openSettings\("hub"\)\)/);
  assert.match(appChrome, /chooseItem\(\(\) => openSettings\("integrations"\)\)/);
});

test("guided-tour Settings target exists", () => {
  const step = gettingStartedGuidedTour.steps.find(
    (candidate) => candidate.id === "settings-shortcut"
  );

  assert.ok(step);
  assert.equal(step.title, "Personalise DayLo");
  assert.equal(
    step.description,
    "Open Settings to change appearance, integrations and other preferences."
  );
  assert.equal(step.target, '[data-tour="settings-shortcut"]');
  assert.equal(step.mobileTarget, '[data-tour="mobile-settings-shortcut"]');
});

test("navigation remains usable around 390px mobile width", () => {
  assert.match(responsiveCss, /@media \(max-width: 700px\)/);
  assert.match(responsiveCss, /\.mobile-bottom-nav \{[\s\S]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  const settingsShortcutRule = cssRule(responsiveCss, ".mobile-settings-shortcut");

  assert.match(settingsShortcutRule, /flex: 0 0 auto;/);
  assert.doesNotMatch(settingsShortcutRule, /position: fixed;/);
});
