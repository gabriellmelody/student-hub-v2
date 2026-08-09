import assert from "node:assert/strict";
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
