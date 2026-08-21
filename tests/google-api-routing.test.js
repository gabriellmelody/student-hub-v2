import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

const expectedRoutes = {
  "google-classroom": [
    "connect",
    "callback",
    "session",
    "disconnect",
    "courses",
    "coursework-preview",
  ],
  "google-calendar": [
    "connect",
    "callback",
    "session",
    "disconnect",
    "calendars",
    "events",
  ],
};

test("Google integrations use two dynamic functions with every public action", async () => {
  for (const [provider, actions] of Object.entries(expectedRoutes)) {
    const routeSource = await readFile(
      new URL(`../api/${provider}/[action].js`, import.meta.url),
      "utf8"
    );
    for (const action of actions) {
      assert.match(routeSource, new RegExp(`["']?${action}["']?`));
      assert.match(routeSource, new RegExp(`server/${provider}/`));
    }
  }
});

test("all consolidated Google handler modules remain callable", async () => {
  for (const [provider, actions] of Object.entries(expectedRoutes)) {
    for (const action of actions) {
      const module = await import(
        new URL(`../server/${provider}/${action}.js`, import.meta.url)
      );
      assert.equal(typeof module.default, "function", `${provider}/${action}`);
    }
  }
});

test("api contains only four consolidated deployable JavaScript functions and no helpers", async () => {
  async function collect(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map((entry) => {
      const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
      return entry.isDirectory() ? collect(url) : [url.pathname];
    }));
    return nested.flat();
  }

  const files = (await collect(new URL("../api/", import.meta.url)))
    .filter((file) => file.endsWith(".js"))
    .map((file) => file.slice(root.pathname.length))
    .sort();

  assert.deepEqual(files, [
    "api/google-calendar/[action].js",
    "api/google-classroom/[action].js",
    "api/notifications/[action].js",
    "api/smart-planner/generate.js",
  ]);
  assert.equal(files.some((file) => /\/(?:_|helpers?)/.test(file)), false);
});

test("Google OAuth callback and frontend API URLs remain unchanged", async () => {
  const sources = await Promise.all([
    "src/App.jsx",
    "src/pages/CalendarPage.jsx",
    "src/pages/Onboarding.jsx",
    "src/pages/SettingsPage.jsx",
  ].map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")));
  const frontend = sources.join("\n");

  assert.match(frontend, /\/api\/google-classroom\/callback/);
  assert.match(frontend, /\/api\/google-calendar\/callback/);
  assert.match(frontend, /\/api\/google-classroom\/courses/);
  assert.match(frontend, /\/api\/google-classroom\/coursework-preview/);
  assert.match(frontend, /\/api\/google-calendar\/calendars/);
  assert.match(frontend, /\/api\/google-calendar\/events/);
});
