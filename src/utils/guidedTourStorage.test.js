import assert from "node:assert/strict";
import test from "node:test";
import { gettingStartedGuidedTour } from "../data/guidedTours.js";
import {
  GUIDED_TOUR_STORAGE_KEY,
  isGuidedTourEligible,
  loadGuidedTourProgress,
  saveGuidedTourOutcome,
  shouldAutomaticallyStartGettingStarted,
} from "./guidedTourStorage.js";

function createStorage(initialValue = null) {
  const values = new Map();
  if (initialValue !== null) values.set(GUIDED_TOUR_STORAGE_KEY, initialValue);

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    read: () => values.get(GUIDED_TOUR_STORAGE_KEY),
  };
}

test("new users receive empty guided-tour progress", () => {
  assert.deepEqual(loadGuidedTourProgress(createStorage()), {
    version: 1,
    tours: {},
  });
});

test("malformed guided-tour JSON is ignored safely", () => {
  assert.deepEqual(loadGuidedTourProgress(createStorage("{broken")), {
    version: 1,
    tours: {},
  });
});

test("invalid stored records are discarded", () => {
  const storage = createStorage(
    JSON.stringify({
      version: 1,
      tours: {
        invalid: { status: "active", version: 1 },
        valid: {
          status: "skipped",
          version: 2,
          updatedAt: "2026-07-31T08:00:00.000Z",
        },
      },
    })
  );

  assert.deepEqual(Object.keys(loadGuidedTourProgress(storage).tours), ["valid"]);
});

test("invalid timestamps and storage schema versions are ignored", () => {
  const invalidTimestamp = createStorage(
    JSON.stringify({
      version: 1,
      tours: {
        invalid: { status: "completed", version: 1, updatedAt: "not-a-date" },
      },
    })
  );
  const invalidSchema = createStorage(
    JSON.stringify({ version: "1", tours: {} })
  );

  assert.deepEqual(loadGuidedTourProgress(invalidTimestamp).tours, {});
  assert.deepEqual(loadGuidedTourProgress(invalidSchema), {
    version: 1,
    tours: {},
  });
});

test("completed tours store status, definition version and timestamp", () => {
  const storage = createStorage();
  const saved = saveGuidedTourOutcome(
    gettingStartedGuidedTour,
    "completed",
    storage,
    () => new Date("2026-07-31T08:00:00.000Z")
  );
  const record = JSON.parse(storage.read()).tours["getting-started"];

  assert.equal(saved, true);
  assert.deepEqual(record, {
    status: "completed",
    version: 1,
    updatedAt: "2026-07-31T08:00:00.000Z",
  });
});

test("skipped tours are stored without an active step", () => {
  const storage = createStorage();
  saveGuidedTourOutcome(gettingStartedGuidedTour, "skipped", storage);
  const record = JSON.parse(storage.read()).tours["getting-started"];

  assert.equal(record.status, "skipped");
  assert.equal("activeStepIndex" in record, false);
});

test("completed current-version tours are not automatically eligible", () => {
  const storage = createStorage();
  saveGuidedTourOutcome(gettingStartedGuidedTour, "completed", storage);

  assert.equal(
    isGuidedTourEligible(gettingStartedGuidedTour, loadGuidedTourProgress(storage)),
    false
  );
});

test("skipped current-version tours are not automatically eligible", () => {
  const storage = createStorage();
  saveGuidedTourOutcome(gettingStartedGuidedTour, "skipped", storage);

  assert.equal(
    isGuidedTourEligible(gettingStartedGuidedTour, loadGuidedTourProgress(storage)),
    false
  );
});

test("a newer definition version becomes eligible again", () => {
  const storage = createStorage();
  saveGuidedTourOutcome(gettingStartedGuidedTour, "completed", storage);

  assert.equal(
    isGuidedTourEligible(
      { ...gettingStartedGuidedTour, version: 2 },
      loadGuidedTourProgress(storage)
    ),
    true
  );
});

test("automatic startup requires completed onboarding and an eligible tour", () => {
  assert.equal(
    shouldAutomaticallyStartGettingStarted({
      onboardingCompleted: true,
      blockingUiOpen: false,
      oauthCallbackActive: false,
      tourAlreadyActive: false,
      eligible: true,
    }),
    true
  );
  assert.equal(
    shouldAutomaticallyStartGettingStarted({
      onboardingCompleted: false,
      blockingUiOpen: false,
      oauthCallbackActive: false,
      tourAlreadyActive: false,
      eligible: true,
    }),
    false
  );
});

test("automatic startup waits for blocking UI to close", () => {
  assert.equal(
    shouldAutomaticallyStartGettingStarted({
      onboardingCompleted: true,
      blockingUiOpen: true,
      oauthCallbackActive: false,
      tourAlreadyActive: false,
      eligible: true,
    }),
    false
  );
});

test("automatic startup does not run during OAuth callback handling", () => {
  assert.equal(
    shouldAutomaticallyStartGettingStarted({
      onboardingCompleted: true,
      blockingUiOpen: false,
      oauthCallbackActive: true,
      tourAlreadyActive: false,
      eligible: true,
    }),
    false
  );
});

test("an active tour prevents a duplicate automatic startup", () => {
  assert.equal(
    shouldAutomaticallyStartGettingStarted({
      onboardingCompleted: true,
      blockingUiOpen: false,
      oauthCallbackActive: false,
      tourAlreadyActive: true,
      eligible: true,
    }),
    false
  );
});
