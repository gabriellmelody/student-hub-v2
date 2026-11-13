import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { integrationCatalog } from "../data/integrationCatalog.js";
import { helpTopics } from "../data/helpGuides.js";
import { getGuidedTourDefinition } from "../data/guidedTours.js";

const readSource = (path) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const settings = readSource("../pages/SettingsPage.jsx");
const onboarding = readSource("../pages/Onboarding.jsx");
const home = readSource("../pages/HomePage.jsx");
const navigation = readSource("../components/AppChrome.jsx");
const releaseNotes = readSource("../data/releaseNotes.js");

test("all visible Google account actions use the existing redirect flow", () => {
  assert.match(
    settings,
    /onConnect=\{\(\) => startGoogleRedirectConnection\("classroom"\)\}/
  );
  assert.match(
    settings,
    /onClick=\{\(\) => onConnectGoogleRedirect\("classroom"\)\}/
  );
  assert.match(
    settings,
    /onClick=\{\(\) => onConnectGoogleRedirect\("calendar"\)\}/
  );
  assert.match(settings, /\?mode=redirect/);
  assert.match(settings, /Change account/);
  assert.doesNotMatch(settings, />\s*Use redirect instead\s*</);
});

test("onboarding already starts Classroom and Calendar through redirect OAuth", () => {
  assert.match(
    onboarding,
    /`\/api\/google-\$\{provider\}\/connect\?mode=redirect`/
  );
  assert.doesNotMatch(onboarding, /Smart Planner|smart-planner/);
});

test("Smart Planner is absent from current user-facing discovery surfaces", () => {
  assert.equal(
    integrationCatalog.some((integration) => integration.id === "ai-planner"),
    false
  );
  assert.equal(getGuidedTourDefinition("smart-planner"), null);
  assert.doesNotMatch(JSON.stringify(helpTopics), /Smart Planner|smart-planner/);
  assert.doesNotMatch(releaseNotes, /Smart Planner|smart-planner/);
  assert.doesNotMatch(home, /Smart Planner|smart-planner/);
  assert.doesNotMatch(navigation, /Smart Planner|smart-planner/);
});

test("Smart Planner backend entry point remains in place", () => {
  const endpoint = readSource("../../api/smart-planner/generate.js");
  assert.match(endpoint, /createSmartPlannerHandler/);
});
