import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../../public/push-sw.js", import.meta.url), "utf8");

function loadWorker() {
  const listeners = new Map();
  const shown = [];
  const scope = {
    location: { origin: "https://daylo.example" },
    registration: {
      showNotification: async (...args) => shown.push(args),
    },
    clients: {
      matchAll: async () => [],
      openWindow: async () => null,
    },
    addEventListener: (type, listener) => listeners.set(type, listener),
  };
  vm.runInNewContext(source, { self: scope, URL });
  return { scope, listeners, shown };
}

test("push payload validation is private by default and bounded", () => {
  const { scope } = loadWorker();
  assert.deepEqual(
    { ...scope.DayloPushWorker.normalizePushPayload(null) },
    {
      title: "DayLo reminder",
      body: "You have a DayLo reminder.",
      url: "/",
      tag: undefined,
      occurrenceKey: "",
    }
  );
  assert.equal(scope.DayloPushWorker.normalizePushPayload({ title: "x".repeat(200) }).title.length, 120);
});

test("notification routes allow DayLo deep links and reject external URLs", () => {
  const { scope } = loadWorker();
  assert.equal(
    scope.DayloPushWorker.normalizeInternalRoute("/tasks?task=abc#details"),
    "/tasks?task=abc#details"
  );
  assert.equal(scope.DayloPushWorker.normalizeInternalRoute("https://evil.example/tasks"), "/");
  assert.equal(scope.DayloPushWorker.normalizeInternalRoute("/not-allowlisted"), "/");
});

test("malformed push data displays a safe DayLo notification", async () => {
  const { listeners, shown } = loadWorker();
  let promise;
  listeners.get("push")({
    data: { json: () => { throw new Error("bad json"); } },
    waitUntil: (value) => { promise = value; },
  });
  await promise;
  assert.equal(shown.length, 1);
  assert.equal(shown[0][0], "DayLo reminder");
  assert.equal(shown[0][1].data.url, "/");
  assert.equal(shown[0][1].icon, "/icons/daylo-192.png");
});

test("notification click navigates and focuses an existing DayLo client", async () => {
  const { scope, listeners } = loadWorker();
  const calls = [];
  scope.clients.matchAll = async () => [{
    url: "https://daylo.example/",
    navigate: async (url) => calls.push(["navigate", url]),
    focus: async () => calls.push(["focus"]),
  }];
  let promise;
  listeners.get("notificationclick")({
    notification: { data: { url: "/plan" }, close: () => calls.push(["close"]) },
    waitUntil: (value) => { promise = value; },
  });
  await promise;
  assert.deepEqual(calls, [
    ["close"],
    ["navigate", "https://daylo.example/plan"],
    ["focus"],
  ]);
});

