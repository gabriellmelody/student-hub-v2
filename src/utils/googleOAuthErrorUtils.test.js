import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { getGoogleOAuthAccessDeniedMessage } from "./googleOAuthErrorUtils.js";

test("private beta Test User access-denied errors get clear guidance", () => {
  assert.equal(
    getGoogleOAuthAccessDeniedMessage({
      error: "access_denied",
      error_description: "access blocked: app is in testing and user is not a test user",
    }),
    "This Google account isn't currently approved for the DayLo private beta."
  );
});

test("ordinary access-denied remains a cancelled connection", () => {
  assert.equal(
    getGoogleOAuthAccessDeniedMessage({ error: "access_denied" }),
    "Google connection was cancelled."
  );
});

test("non access-denied OAuth errors use existing error handling", () => {
  assert.equal(getGoogleOAuthAccessDeniedMessage({ error: "server_error" }), "");
});

test("popup_closed preserves cancellation copy and exposes the shared redirect fallback", () => {
  const settingsSource = fs.readFileSync(
    new URL("../pages/SettingsPage.jsx", import.meta.url),
    "utf8"
  );
  const popupClosedBranch = settingsSource.match(
    /if \(errorType === "popup_closed"\) \{([\s\S]*?)\} else if/
  )?.[1] || "";

  assert.match(popupClosedBranch, /messageProvider: provider/);
  assert.match(
    popupClosedBranch,
    /message: "Google connection was cancelled\."/
  );
  assert.match(popupClosedBranch, /fallbackProvider: provider/);
  assert.match(popupClosedBranch, /focusGoogleConnectButton\(provider\)/);
  assert.match(settingsSource, /provider === "classroom"/);
  assert.match(settingsSource, /provider: "calendar"/);
});

test("access_denied remains a cancellation without enabling redirect fallback", () => {
  const settingsSource = fs.readFileSync(
    new URL("../pages/SettingsPage.jsx", import.meta.url),
    "utf8"
  );
  const messageHelper = settingsSource.match(
    /function setGooglePopupMessage\(provider, message\) \{([\s\S]*?)\n  \}/
  )?.[1] || "";

  assert.equal(
    getGoogleOAuthAccessDeniedMessage({ error: "access_denied" }),
    "Google connection was cancelled."
  );
  assert.match(
    settingsSource,
    /setGooglePopupMessage\(provider, accessDeniedMessage\)/
  );
  assert.match(messageHelper, /fallbackProvider: null/);
});
