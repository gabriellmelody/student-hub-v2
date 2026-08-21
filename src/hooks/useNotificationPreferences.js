import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "../utils/notificationSchedulingUtils.js";
import { ensureNotificationPreferences, getBrowserTimeZone, reconcileNotificationTimezone, subscribeToNotificationPreferenceChanges, updateNotificationPreferences } from "../lib/notificationPreferences.js";

export default function useNotificationPreferences(user) {
  const userId = user?.id || "";
  const activeUserRef = useRef(userId);
  const preferencesRef = useRef(DEFAULT_NOTIFICATION_PREFERENCES);
  const [workspace, setWorkspace] = useState({ userId: "", preferences: DEFAULT_NOTIFICATION_PREFERENCES });
  const [loading, setLoading] = useState(Boolean(userId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const preferences = workspace.userId === userId ? workspace.preferences : DEFAULT_NOTIFICATION_PREFERENCES;

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!userId) return null;
    if (!silent) setLoading(true);
    try {
      let next = await ensureNotificationPreferences(supabase, userId);
      next = await reconcileNotificationTimezone(supabase, userId, next, getBrowserTimeZone());
      if (activeUserRef.current !== userId) return null;
      preferencesRef.current = next; setWorkspace({ userId, preferences: next }); setError(null); return next;
    } catch (nextError) { if (activeUserRef.current === userId) setError(nextError); return null; }
    finally { if (activeUserRef.current === userId) setLoading(false); }
  }, [userId]);

  useEffect(() => {
    activeUserRef.current = userId; preferencesRef.current = DEFAULT_NOTIFICATION_PREFERENCES;
    setWorkspace({ userId: "", preferences: DEFAULT_NOTIFICATION_PREFERENCES }); setError(null); setSaving(false);
    if (!userId) { setLoading(false); return undefined; }
    setLoading(true); void refresh();
    const unsubscribe = subscribeToNotificationPreferenceChanges(supabase, userId, () => void refresh({ silent: true }));
    return unsubscribe;
  }, [refresh, userId]);

  const updatePreferences = useCallback(async (changes) => {
    if (!userId) return false;
    const previous = preferencesRef.current; const next = { ...previous, ...changes };
    preferencesRef.current = next; setWorkspace({ userId, preferences: next }); setSaving(true); setError(null);
    try { const saved = await updateNotificationPreferences(supabase, userId, changes); if (activeUserRef.current !== userId) return false; preferencesRef.current = saved; setWorkspace({ userId, preferences: saved }); return true; }
    catch (nextError) { if (activeUserRef.current === userId) { preferencesRef.current = previous; setWorkspace({ userId, preferences: previous }); setError(nextError); } return false; }
    finally { if (activeUserRef.current === userId) setSaving(false); }
  }, [userId]);

  return { preferences, loading, saving, error, updatePreferences, refresh };
}
