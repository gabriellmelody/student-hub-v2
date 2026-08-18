import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  dedupeLegacyQuickLinks,
  deriveSiteFaviconUrl,
  fetchCloudQuickLinks,
  getDefaultCloudQuickLinks,
  mapCloudQuickLink,
  mapQuickLinkForWrite,
  reconcileCloudQuickLinks,
  subscribeToCloudQuickLinkChanges,
} from "./cloudQuickLinks.js";

const USER = "11111111-1111-4111-8111-111111111111";
const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SECOND_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const row = (overrides = {}) => ({ id: ID, user_id: USER, name: "Drive", url: "https://drive.google.com/", icon_mode: "site", icon_key: null, pinned: true, sort_order: 0, ...overrides });

function mockClient(results = []) {
  const calls = [];
  return { calls, from(table) {
    const state = { table, action: "select", filters: [] };
    const builder = {
      select(value) { state.columns = value; return builder; },
      insert(value) { state.action = "insert"; state.payload = value; return builder; },
      update(value) { state.action = "update"; state.payload = value; return builder; },
      delete() { state.action = "delete"; return builder; },
      upsert(value, options) { state.action = "upsert"; state.payload = value; state.options = options; return builder; },
      eq(key, value) { state.filters.push([key, value]); return builder; },
      order(key, options) { (state.orders ||= []).push([key, options]); return builder; },
      maybeSingle() { calls.push(structuredClone(state)); return Promise.resolve(results.shift() || { data: null, error: null }); },
      then(resolve) { calls.push(structuredClone(state)); return Promise.resolve(results.shift() || { data: null, error: null }).then(resolve); },
    }; return builder;
  }};
}

test("Quick Links fetch is user-scoped and ordered", async () => {
  const client = mockClient([{ data: [row()], error: null }]);
  assert.equal((await fetchCloudQuickLinks(client, USER))[0].id, ID);
  assert.deepEqual(client.calls[0].filters, [["user_id", USER]]);
  assert.equal(client.calls[0].orders[0][0], "sort_order");
});

test("site and DayLo icon modes persist with authenticated ownership", () => {
  assert.equal(mapCloudQuickLink(row()).iconMode, "site");
  const daylo = mapQuickLinkForWrite({ label: "School", url: "school.edu", iconMode: "daylo", iconId: "school" }, USER, 2);
  assert.deepEqual([daylo.user_id, daylo.icon_mode, daylo.icon_key, daylo.sort_order], [USER, "daylo", "school", 2]);
  assert.equal(mapQuickLinkForWrite({ label: "Site", url: "https://example.com", iconMode: "site" }, USER).icon_key, null);
});

test("unsafe schemes are rejected", () => {
  assert.throws(() => mapQuickLinkForWrite({ label: "Bad", url: "javascript:alert(1)" }, USER));
  assert.throws(() => mapQuickLinkForWrite({ label: "Bad", url: "data:text/plain,test" }, USER));
  assert.throws(() => mapQuickLinkForWrite({ label: "Bad", url: "file:///tmp/a" }, USER));
});

test("site favicon derives from and follows the current URL", () => {
  assert.equal(deriveSiteFaviconUrl("https://classroom.google.com/u/0"), "https://classroom.google.com/favicon.ico");
  assert.equal(deriveSiteFaviconUrl("https://drive.google.com/drive"), "https://drive.google.com/favicon.ico");
  assert.equal(deriveSiteFaviconUrl("javascript:alert(1)"), "");
});

test("legacy migration preserves order and deduplicates by normalized URL", () => {
  const cloud = [{ label: "Drive", url: "https://drive.google.com/" }];
  const legacy = [{ label: "Different name", url: "drive.google.com" }, { label: "Calendar", url: "https://calendar.google.com" }];
  assert.deepEqual(dedupeLegacyQuickLinks(cloud, legacy).map((link) => link.label), ["Calendar"]);
});

test("fresh defaults are ordinary removable links", () => {
  const defaults = getDefaultCloudQuickLinks();
  assert.equal(defaults.length, 5);
  assert.ok(defaults.every((link) => link.type === "custom" && link.iconMode === "site"));
  assert.equal(defaults.find((link) => link.label === "Gemini").pinned, false);
  assert.equal(defaults.find((link) => link.label === "Claude").pinned, false);
});

test("edit, delete and reorder target the correct user-owned UUID rows", async () => {
  const current = [mapCloudQuickLink(row()), mapCloudQuickLink(row({ id: SECOND_ID, name: "Calendar", url: "https://calendar.google.com/", sort_order: 1 }))];
  const next = [{ ...current[1], label: "My Calendar", pinnedOrder: 0 }];
  const client = mockClient([{ data: null, error: null }, { data: null, error: null }, { data: null, error: null }, { data: [row({ id: SECOND_ID, name: "My Calendar", url: "https://calendar.google.com/" })], error: null }]);
  await reconcileCloudQuickLinks(client, USER, current, next);
  const update = client.calls.find((call) => call.action === "update");
  const deletion = client.calls.find((call) => call.action === "delete");
  assert.deepEqual(update.filters, [["user_id", USER], ["id", SECOND_ID]]);
  assert.equal(update.payload.sort_order, 0);
  assert.deepEqual(deletion.filters, [["user_id", USER], ["id", ID]]);
});

test("Realtime is filtered to the authenticated user", () => {
  let config; let removed; let count = 0;
  const channel = { on(_event, value, handler) { config = value; handler(); return channel; }, subscribe() { return channel; } };
  const client = { channel(name) { assert.equal(name, `quick-links:${USER}`); return channel; }, removeChannel(value) { removed = value; } };
  const unsubscribe = subscribeToCloudQuickLinkChanges(client, USER, () => count++);
  assert.equal(config.filter, `user_id=eq.${USER}`); assert.equal(count, 1); unsubscribe(); assert.equal(removed, channel);
});

test("site icon failure resets on URL change and falls back", () => {
  const source = readFileSync(new URL("../components/QuickLinkIcon.jsx", import.meta.url), "utf8");
  assert.match(source, /onError=\{\(\) => setFaviconFailed\(true\)\}/);
  assert.match(source, /setFaviconFailed\(false\).*\[faviconUrl\]/s);
  assert.match(source, /resolvedIconId/);
});

test("legacy data is confirmed, claimed once and removed only after cloud success", () => {
  const source = readFileSync(new URL("../hooks/useCloudQuickLinks.js", import.meta.url), "utf8");
  assert.match(source, /migrationPending/);
  assert.match(source, /QUICK_LINKS_MIGRATION_OWNER_KEY, userId/);
  assert.ok(source.indexOf("await importLegacyQuickLinks") < source.indexOf("localStorage.removeItem(QUICK_LINKS_STORAGE_KEY)"));
  assert.match(source, /setWorkspace\(\{ userId: "", links: \[\] \}\)/);
});

test("migration enforces ownership, modes, durable initialization, RLS and Realtime", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20260818_cloud_quick_links.sql", import.meta.url), "utf8");
  assert.match(sql, /id uuid primary key default gen_random_uuid\(\)/);
  assert.match(sql, /icon_mode in \('site', 'daylo'\)/);
  assert.match(sql, /public\.quick_links_state/);
  assert.match(sql, /auth\.uid\(\) = user_id/);
  assert.match(sql, /alter publication supabase_realtime add table public\.quick_links/);
});

test("App uses cloud Quick Links without local authoritative reads or writes", () => {
  const source = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(source, /useCloudQuickLinks\(auth\.user\)/);
  assert.doesNotMatch(source, /saveQuickLinksPreferences\(/);
  assert.doesNotMatch(source, /loadQuickLinksPreferences/);
});
