import assert from "node:assert/strict";
import test from "node:test";
import {
  compareDayloVersions,
  createManualUpdateCheckController,
  createUpdateActionController,
  fetchLatestVersionMetadata,
  getInstallationStatus,
  getUpdateAvailability,
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


test("semantic comparison recognises 0.9.2 as newer than 0.9.1", () => {
  assert.equal(compareDayloVersions("0.9.2", "0.9.1"), 1);
});

test("semantic comparison treats 0.10.0 as newer than 0.9.9", () => {
  assert.equal(compareDayloVersions("0.10.0", "0.9.9"), 1);
  assert.equal(compareDayloVersions("1.0.0", "0.10.0"), 1);
});

test("latest equal to current reports up to date", () => {
  assert.equal(
    getUpdateAvailability({ currentVersion: "0.9.2", latestVersion: "0.9.2" }),
    "up-to-date"
  );
});

test("latest newer than current reports update available without sequential requirements", () => {
  assert.equal(
    getUpdateAvailability({ currentVersion: "0.9.2", latestVersion: "0.9.3" }),
    "update-available"
  );
});

test("waiting service worker exposes update waiting", () => {
  assert.equal(
    getUpdateAvailability({ currentVersion: "0.9.2", latestVersion: "0.9.2", needRefresh: true }),
    "update-waiting"
  );
});

test("installation states produce Settings copy and actions", () => {
  assert.deepEqual(getInstallationStatus("installed"), {
    status: "installed",
    label: "Installed on this device",
    actionLabel: "",
  });
  assert.equal(getInstallationStatus("native").actionLabel, "Install DayLo");
  assert.equal(getInstallationStatus("ios-instructions").actionLabel, "How to install");
  assert.equal(getInstallationStatus("unsupported").label, "Install option not available yet");
});

test("manual update check invokes registration update once", async () => {
  let calls = 0;
  const controller = createManualUpdateCheckController({
    fetchLatestVersion: async () => ({ ok: true, version: "0.9.2" }),
    registrationUpdate: async () => {
      calls += 1;
    },
  });

  assert.deepEqual(await controller.check(), { status: "checked", latestVersion: "0.9.2" });
  assert.equal(calls, 1);
  assert.equal(controller.registrationCalls, 1);
});

test("repeated manual update check clicks are ignored while checking", async () => {
  let resolveFetch;
  const controller = createManualUpdateCheckController({
    fetchLatestVersion: () =>
      new Promise((resolve) => {
        resolveFetch = () => resolve({ ok: true, version: "0.9.2" });
      }),
    registrationUpdate: async () => {},
  });

  const first = controller.check();
  assert.deepEqual(await controller.check(), { status: "ignored" });
  resolveFetch();
  assert.deepEqual(await first, { status: "checked", latestVersion: "0.9.2" });
});

test("offline manual update check produces safe status", async () => {
  const controller = createManualUpdateCheckController({ getOnline: () => false });
  assert.deepEqual(await controller.check(), { status: "offline" });
  assert.equal(controller.registrationCalls, 0);
});

test("metadata fetch failure remains recoverable", async () => {
  const result = await fetchLatestVersionMetadata({
    fetchImpl: async () => ({ ok: false, json: async () => ({}) }),
    cacheBust: 123,
  });

  assert.equal(result.ok, false);
  assert.equal(result.version, "");
});

test("metadata fetch uses no-store and cache-busting", async () => {
  let requestedUrl = "";
  let requestedOptions = null;
  const result = await fetchLatestVersionMetadata({
    url: "/version.json",
    cacheBust: 123,
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      requestedOptions = options;
      return { ok: true, json: async () => ({ version: "0.9.2" }) };
    },
  });

  assert.equal(result.version, "0.9.2");
  assert.equal(requestedUrl, "/version.json?t=123");
  assert.equal(requestedOptions.cache, "no-store");
});
