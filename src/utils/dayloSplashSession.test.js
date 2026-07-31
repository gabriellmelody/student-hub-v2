import assert from "node:assert/strict";
import test from "node:test";
import {
  DAYLO_OPENING_SPLASH_SESSION_KEY,
  DAYLO_SPLASH_NORMAL_DURATION_MS,
  DAYLO_SPLASH_REDUCED_DURATION_MS,
  createDayloSplashSessionController,
  getDayloSplashSafetyDuration,
} from "./dayloSplashSession.js";

function createMemoryStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    value(key) {
      return values.get(key);
    },
  };
}

test("opening splash appears when the session key is absent", () => {
  const storage = createMemoryStorage();
  const controller = createDayloSplashSessionController(() => storage);

  assert.equal(controller.shouldShow(), true);
  assert.equal(storage.value(DAYLO_OPENING_SPLASH_SESSION_KEY), "started");
});

test("opening splash stays hidden when the session key is present", () => {
  const storage = createMemoryStorage({
    [DAYLO_OPENING_SPLASH_SESSION_KEY]: "complete",
  });
  const controller = createDayloSplashSessionController(() => storage);

  assert.equal(controller.shouldShow(), false);
});

test("opening splash is claimed only once in the current runtime", () => {
  const storage = createMemoryStorage();
  const controller = createDayloSplashSessionController(() => storage);

  assert.equal(controller.shouldShow(), true);
  assert.equal(controller.shouldShow(), false);
});

test("completing the splash records the completed session state", () => {
  const storage = createMemoryStorage();
  const controller = createDayloSplashSessionController(() => storage);

  controller.shouldShow();
  controller.complete();

  assert.equal(storage.value(DAYLO_OPENING_SPLASH_SESSION_KEY), "complete");
});

test("reduced motion uses the brief safety duration", () => {
  assert.equal(
    getDayloSplashSafetyDuration(true),
    DAYLO_SPLASH_REDUCED_DURATION_MS + 250
  );
  assert.equal(
    getDayloSplashSafetyDuration(false),
    DAYLO_SPLASH_NORMAL_DURATION_MS + 250
  );
});

test("sessionStorage failure never blocks startup or repeats in runtime", () => {
  const controller = createDayloSplashSessionController(() => {
    throw new Error("Storage unavailable");
  });

  assert.doesNotThrow(() => controller.shouldShow());
  assert.equal(controller.shouldShow(), false);
  assert.doesNotThrow(() => controller.complete());
});
