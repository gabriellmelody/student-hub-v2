import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  deleteDailyPlan,
  ensurePlanningPreferences,
  fetchDailyPlan,
  getLocalPlanDate,
  getPlanningWorkspaceForUser,
  normalizePlanningPreferences,
  saveDailyPlan,
  savePlanningPreferences,
  subscribeToDailyPlanChanges,
  subscribeToPlanningPreferenceChanges,
} from "../lib/cloudPlanning.js";

const REFRESH_DELAY_MS = 120;

export default function useCloudPlanning(user) {
  const userId = user?.id || "";
  const activeUserRef = useRef(userId);
  const refreshTimerRef = useRef(null);
  const preferenceQueueRef = useRef(Promise.resolve());
  const planQueueRef = useRef(Promise.resolve());
  const [workspace, setWorkspace] = useState({ userId: "", preferences: null, plan: null });
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState(null);
  const current = getPlanningWorkspaceForUser(workspace, userId);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!userId) return null;
    if (!silent) setLoading(true);
    try {
      const [preferences, plan] = await Promise.all([
        ensurePlanningPreferences(supabase, userId),
        fetchDailyPlan(supabase, userId, getLocalPlanDate()),
      ]);
      if (activeUserRef.current !== userId) return null;
      const next = { userId, preferences, plan };
      setWorkspace(next);
      setError(null);
      return next;
    } catch (nextError) {
      if (activeUserRef.current === userId) setError(nextError);
      return null;
    } finally {
      if (activeUserRef.current === userId) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    activeUserRef.current = userId;
    preferenceQueueRef.current = Promise.resolve();
    planQueueRef.current = Promise.resolve();
    setWorkspace({ userId: "", preferences: null, plan: null });
    setError(null);
    if (!userId) { setLoading(false); return undefined; }
    setLoading(true);
    void refresh();
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => void refresh({ silent: true }), REFRESH_DELAY_MS);
    };
    const unsubscribePreferences = subscribeToPlanningPreferenceChanges(supabase, userId, scheduleRefresh);
    const unsubscribePlan = subscribeToDailyPlanChanges(supabase, userId, scheduleRefresh);
    window.addEventListener("focus", scheduleRefresh);
    const onVisibility = () => { if (document.visibilityState === "visible") scheduleRefresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(refreshTimerRef.current);
      unsubscribePreferences();
      unsubscribePlan();
      window.removeEventListener("focus", scheduleRefresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh, userId]);

  const updatePreferences = useCallback(async (updates) => {
    if (!userId || !current?.preferences) return null;
    const previous = current.preferences;
    const optimistic = normalizePlanningPreferences({ ...previous, ...updates });
    setWorkspace({ ...current, preferences: optimistic });
    setError(null);
    try {
      const request = preferenceQueueRef.current.catch(() => null)
        .then(() => savePlanningPreferences(supabase, userId, optimistic));
      preferenceQueueRef.current = request;
      const saved = await request;
      if (activeUserRef.current === userId) setWorkspace((value) => value.userId === userId ? { ...value, preferences: saved } : value);
      return saved;
    } catch (nextError) {
      if (activeUserRef.current === userId) {
        setWorkspace((value) => value.userId === userId ? { ...value, preferences: previous } : value);
        setError(nextError);
      }
      return null;
    }
  }, [current, userId]);

  const persistPlan = useCallback(async (plan) => {
    if (!userId) return null;
    const expectedUserId = userId;
    try {
      const request = planQueueRef.current.catch(() => null)
        .then(() => saveDailyPlan(supabase, expectedUserId, plan, getLocalPlanDate()));
      planQueueRef.current = request;
      const saved = await request;
      if (activeUserRef.current === expectedUserId) setWorkspace((value) => value.userId === expectedUserId ? { ...value, plan: saved } : value);
      return saved;
    } catch (nextError) {
      if (activeUserRef.current === expectedUserId) setError(nextError);
      return null;
    }
  }, [userId]);

  const clearPlan = useCallback(async () => {
    if (!userId) return false;
    try {
      await deleteDailyPlan(supabase, userId, getLocalPlanDate());
      if (activeUserRef.current === userId) setWorkspace((value) => value.userId === userId ? { ...value, plan: null } : value);
      return true;
    } catch (nextError) {
      if (activeUserRef.current === userId) setError(nextError);
      return false;
    }
  }, [userId]);

  return { preferences: current?.preferences || null, plan: current?.plan || null, loading: Boolean(userId && !current && !error) || loading, error, refresh, updatePreferences, persistPlan, clearPlan };
}
