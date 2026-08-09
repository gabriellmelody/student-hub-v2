import assert from "node:assert/strict";
import test from "node:test";
import {
  createUpdateActionController,
  getUpdateErrorMessage,
  isServiceWorkerUpdateSupported,
  shouldCheckForServiceWorkerUpdate,
  shouldShowUpdatePrompt,
} from "./pwaUpdateUtils.js";

test("no prompt when no update is waiting", () => {
  assert.equal(shouldShowUpdatePrompt({ needRefresh: false }), false);
});

test("prompt appears when update is waiting", () => {
  assert.equal(shouldShowUpdatePrompt({ needRefresh: true }), true);
});

test("active modal or editor delays the visible prompt", () => {
  assert.equal(
    shouldShowUpdatePrompt({ needRefresh: true, blockingUiOpen: true }),
    false
  );
});

test("prompt appears after blocker closes", () => {
  assert.equal(
    shouldShowUpdatePrompt({ needRefresh: true, blockingUiOpen: false }),
    true
  );
});

test("Later hides it for the current session", () => {
  assert.equal(
    shouldShowUpdatePrompt({ needRefresh: true, sessionDismissed: true }),
    false
  );
});

test("Later does not activate the service worker", async () => {
  let calls = 0;
  const controller = createUpdateActionController(async () => {
    calls += 1;
  });

  assert.equal(shouldShowUpdatePrompt({ needRefresh: true, sessionDismissed: true }), false);
  assert.equal(calls, 0);
  assert.equal(controller.calls, 0);
});

test("Update now invokes update exactly once", async () => {
  let calls = 0;
  const controller = createUpdateActionController(async () => {
    calls += 1;
  });

  assert.deepEqual(await controller.updateNow(), { status: "updating" });
  assert.equal(calls, 1);
  assert.equal(controller.calls, 1);
});

test("update-in-progress prevents duplicate clicks", async () => {
  let resolveUpdate;
  let calls = 0;
  const controller = createUpdateActionController(
    () =>
      new Promise((resolve) => {
        calls += 1;
        resolveUpdate = resolve;
      })
  );

  const first = controller.updateNow();
  assert.deepEqual(await controller.updateNow(), { status: "ignored" });
  resolveUpdate();
  assert.deepEqual(await first, { status: "updating" });
  assert.equal(calls, 1);
});

test("update failure returns to a usable state", async () => {
  const controller = createUpdateActionController(async () => {
    throw new Error("nope");
  });

  const result = await controller.updateNow();
  assert.equal(result.status, "failed");
  assert.equal(controller.inProgress, false);
  assert.equal(getUpdateErrorMessage(true), "DayLo couldn't update. Try again in a moment.");
});

test("unsupported SW environment does not show update UI", () => {
  assert.equal(
    isServiceWorkerUpdateSupported({ navigator: {}, window: {} }),
    false
  );
  assert.equal(
    shouldShowUpdatePrompt({ needRefresh: true, supported: false }),
    false
  );
});

test("foreground update checks are rate-limited", () => {
  assert.equal(
    shouldCheckForServiceWorkerUpdate({ now: 90_000, lastCheckAt: 40_000 }),
    false
  );
  assert.equal(
    shouldCheckForServiceWorkerUpdate({ now: 101_000, lastCheckAt: 40_000 }),
    true
  );
});

test("offline state does not cause destructive update behavior", () => {
  assert.equal(
    shouldCheckForServiceWorkerUpdate({ now: 120_000, lastCheckAt: 0, online: false }),
    false
  );
});
