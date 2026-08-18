import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  fetchCloudQuickLinks,
  fetchQuickLinksInitialized,
  importLegacyQuickLinks,
  initializeCloudQuickLinks,
  reconcileCloudQuickLinks,
  subscribeToCloudQuickLinkChanges,
} from "../lib/cloudQuickLinks.js";
import { QUICK_LINKS_STORAGE_KEY, normalizeQuickLinksPreferences } from "../utils/appUtils.js";

export const QUICK_LINKS_MIGRATION_OWNER_KEY = "student-hub-quick-links-cloud-owner";
const REALTIME_DELAY_MS = 120;

function readLegacyLinks(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(QUICK_LINKS_STORAGE_KEY);
    if (!raw) return [];
    return normalizeQuickLinksPreferences(JSON.parse(raw)).links.filter((link) => link.url);
  } catch { return []; }
}

export default function useCloudQuickLinks(user) {
  const userId = user?.id || "";
  const activeUserRef = useRef(userId);
  const linksRef = useRef([]);
  const timerRef = useRef(null);
  const [workspace, setWorkspace] = useState({ userId: "", links: [] });
  const [loading, setLoading] = useState(Boolean(userId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [migration, setMigration] = useState(null);
  const links = workspace.userId === userId ? workspace.links : [];

  useEffect(() => { linksRef.current = links; }, [links]);

  const refresh = useCallback(async ({ silent = false, bootstrap = false } = {}) => {
    if (!userId) return [];
    if (!silent) setLoading(true);
    try {
      let [nextLinks, initialized] = await Promise.all([
        fetchCloudQuickLinks(supabase, userId), fetchQuickLinksInitialized(supabase, userId),
      ]);
      const legacyLinks = readLegacyLinks();
      const owner = localStorage.getItem(QUICK_LINKS_MIGRATION_OWNER_KEY) || "";
      const declined = localStorage.getItem(`${QUICK_LINKS_MIGRATION_OWNER_KEY}:declined:${userId}`) === "true";
      const canOfferLegacy = legacyLinks.length > 0 && (!owner || owner === userId) && !declined;
      if (bootstrap && !initialized && !canOfferLegacy) {
        nextLinks = await initializeCloudQuickLinks(supabase, userId, nextLinks.length ? [] : undefined);
        initialized = true;
      }
      if (activeUserRef.current !== userId) return [];
      linksRef.current = nextLinks;
      setWorkspace({ userId, links: nextLinks });
      setMigration(canOfferLegacy ? { legacyLinks, initialized } : null);
      setError(null);
      return nextLinks;
    } catch (nextError) {
      if (activeUserRef.current === userId) setError(nextError);
      return null;
    } finally {
      if (activeUserRef.current === userId) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    activeUserRef.current = userId;
    linksRef.current = [];
    setWorkspace({ userId: "", links: [] });
    setMigration(null); setError(null); setSaving(false);
    if (!userId) { setLoading(false); return undefined; }
    setLoading(true); void refresh({ bootstrap: true });
    const schedule = () => { clearTimeout(timerRef.current); timerRef.current = setTimeout(() => void refresh({ silent: true }), REALTIME_DELAY_MS); };
    const unsubscribe = subscribeToCloudQuickLinkChanges(supabase, userId, schedule);
    window.addEventListener("focus", schedule);
    const visibility = () => { if (document.visibilityState === "visible") schedule(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { clearTimeout(timerRef.current); unsubscribe(); window.removeEventListener("focus", schedule); document.removeEventListener("visibilitychange", visibility); };
  }, [refresh, userId]);

  const setLinks = useCallback(async (updater) => {
    if (!userId) return false;
    const previous = linksRef.current;
    const next = typeof updater === "function" ? updater(previous) : updater;
    linksRef.current = next; setWorkspace({ userId, links: next }); setSaving(true); setError(null);
    try {
      const saved = await reconcileCloudQuickLinks(supabase, userId, previous, next);
      if (activeUserRef.current !== userId) return false;
      linksRef.current = saved; setWorkspace({ userId, links: saved }); return true;
    } catch (nextError) {
      if (activeUserRef.current === userId) { linksRef.current = previous; setWorkspace({ userId, links: previous }); setError(nextError); }
      return false;
    } finally { if (activeUserRef.current === userId) setSaving(false); }
  }, [userId]);

  const importLegacy = useCallback(async () => {
    if (!migration || !userId) return false;
    setSaving(true); setError(null);
    try {
      let current = linksRef.current;
      if (!migration.initialized && current.length === 0) current = [];
      const saved = await importLegacyQuickLinks(supabase, userId, current, migration.legacyLinks);
      if (activeUserRef.current !== userId) return false;
      localStorage.setItem(QUICK_LINKS_MIGRATION_OWNER_KEY, userId);
      localStorage.removeItem(QUICK_LINKS_STORAGE_KEY);
      linksRef.current = saved; setWorkspace({ userId, links: saved }); setMigration(null); return true;
    } catch (nextError) { if (activeUserRef.current === userId) setError(nextError); return false; }
    finally { if (activeUserRef.current === userId) setSaving(false); }
  }, [migration, userId]);

  const declineLegacy = useCallback(async () => {
    if (!migration || !userId) return false;
    let saved = linksRef.current;
    if (!migration.initialized) saved = await initializeCloudQuickLinks(supabase, userId, saved.length ? [] : undefined);
    localStorage.setItem(`${QUICK_LINKS_MIGRATION_OWNER_KEY}:declined:${userId}`, "true");
    linksRef.current = saved; setWorkspace({ userId, links: saved }); setMigration(null); return true;
  }, [migration, userId]);

  return { links, loading, saving, error, migrationPending: Boolean(migration), setLinks, importLegacy, declineLegacy, refresh };
}
