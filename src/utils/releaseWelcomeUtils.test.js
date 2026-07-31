import assert from "node:assert/strict";
import test from "node:test";
import {
  RELEASE_WELCOME_STORAGE_KEY,
  acknowledgeReleaseVersion,
  getInitialTourExitAction,
  loadAcknowledgedReleaseVersion,
  shouldShowReleaseWelcome,
} from "./releaseWelcomeUtils.js";

function createStorage() {
  const values = new Map();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

function createEligibleState(overrides = {}) {
  return {
    currentVersion: "0.9.0",
    lastSeenVersion: "",
    activePage: "home",
    onboardingCompleted: true,
    guidedTourActive: false,
    gettingStartedTourSettled: true,
    blockingUiOpen: false,
    tourStartPending: false,
    ...overrides,
  };
}

test("an unseen release is eligible on Home", () => {
  assert.equal(shouldShowReleaseWelcome(createEligibleState()), true);
});

test("an acknowledged release does not show again", () => {
  const storage = createStorage();

  assert.equal(acknowledgeReleaseVersion("0.9.0", storage), true);
  assert.equal(storage.getItem(RELEASE_WELCOME_STORAGE_KEY), "0.9.0");
  assert.equal(loadAcknowledgedReleaseVersion(storage), "0.9.0");
  assert.equal(
    shouldShowReleaseWelcome(
      createEligibleState({ lastSeenVersion: "0.9.0" })
    ),
    false
  );
});

test("the welcome action keeps the existing version acknowledgement", () => {
  const storage = createStorage();

  acknowledgeReleaseVersion("0.9.0", storage);
  assert.equal(loadAcknowledgedReleaseVersion(storage), "0.9.0");
});

test("the release waits while onboarding is active", () => {
  assert.equal(
    shouldShowReleaseWelcome(
      createEligibleState({ onboardingCompleted: false })
    ),
    false
  );
});

test("the release waits while a guided tour is active", () => {
  assert.equal(
    shouldShowReleaseWelcome(createEligibleState({ guidedTourActive: true })),
    false
  );
});

test("completing the initial tour returns Home before checking the release", () => {
  assert.deepEqual(
    getInitialTourExitAction({ id: "getting-started" }, "completed"),
    { returnHome: true, checkReleaseWelcome: true }
  );
});

test("skipping the initial tour returns Home before checking the release", () => {
  assert.deepEqual(
    getInitialTourExitAction({ id: "getting-started" }, "skipped"),
    { returnHome: true, checkReleaseWelcome: true }
  );
});

test("replaying a tour after acknowledgement does not reopen the release", () => {
  assert.equal(
    shouldShowReleaseWelcome(
      createEligibleState({ lastSeenVersion: "0.9.0" })
    ),
    false
  );
});

test("a future release becomes eligible after the current release was seen", () => {
  assert.equal(
    shouldShowReleaseWelcome(
      createEligibleState({
        currentVersion: "0.10.0",
        lastSeenVersion: "0.9.0",
      })
    ),
    true
  );
});
