import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  ensureCloudAppearancePreferences,
  getAppearancePreferencesForWorkspace,
  mergeAppearancePreferences,
  subscribeToCloudAppearancePreferenceChanges,
  updateCloudAppearancePreferences,
} from "../lib/cloudAppearancePreferences.js";

const REALTIME_REFETCH_DELAY_MS = 120;

export default function useCloudAppearancePreferences(user) {
  const userId = user?.id || "";
  const userIdRef = useRef(userId);
  const requestIdRef = useRef(0);
  const mutationIdRef = useRef(0);
  const mutationQueueRef = useRef(Promise.resolve());
  const refetchTimerRef = useRef(null);
  const preferencesRef = useRef(null);
  const confirmedPreferencesRef = useRef(null);
  const failedPreferencesRef = useRef(null);
  const pendingMutationsRef = useRef(0);
  const [workspace, setWorkspace] = useState({
    userId: "",
    preferences: null,
  });
  const [loading, setLoading] = useState(Boolean(userId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const preferences = getAppearancePreferencesForWorkspace(workspace, userId);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  const loadPreferences = useCallback(
    async ({ silent = false } = {}) => {
      if (!userId) {
        preferencesRef.current = null;
        confirmedPreferencesRef.current = null;
        failedPreferencesRef.current = null;
        setWorkspace({ userId: "", preferences: null });
        setLoading(false);
        setError(null);
        return null;
      }

      const requestId = ++requestIdRef.current;
      if (!silent) setLoading(true);
      setError(null);

      try {
        const nextPreferences = await ensureCloudAppearancePreferences(
          supabase,
          userId
        );
        if (requestIdRef.current === requestId && userIdRef.current === userId) {
          preferencesRef.current = nextPreferences;
          confirmedPreferencesRef.current = nextPreferences;
          failedPreferencesRef.current = null;
          setWorkspace({ userId, preferences: nextPreferences });
        }
        return nextPreferences;
      } catch (nextError) {
        if (requestIdRef.current === requestId && userIdRef.current === userId) {
          setWorkspace((currentWorkspace) =>
            currentWorkspace.userId === userId
              ? currentWorkspace
              : { userId, preferences: null }
          );
          setError(nextError);
        }
        return null;
      } finally {
        if (requestIdRef.current === requestId && userIdRef.current === userId) {
          setLoading(false);
        }
      }
    },
    [userId]
  );

  useEffect(() => {
    userIdRef.current = userId;
    requestIdRef.current += 1;
    mutationIdRef.current += 1;
    mutationQueueRef.current = Promise.resolve();
    preferencesRef.current = null;
    confirmedPreferencesRef.current = null;
    failedPreferencesRef.current = null;
    pendingMutationsRef.current = 0;
    setWorkspace({ userId: "", preferences: null });
    setError(null);
    setSaving(false);

    if (!userId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    void loadPreferences();

    const scheduleRefetch = () => {
      window.clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = window.setTimeout(() => {
        void loadPreferences({ silent: true });
      }, REALTIME_REFETCH_DELAY_MS);
    };
    const unsubscribe = subscribeToCloudAppearancePreferenceChanges(
      supabase,
      userId,
      scheduleRefetch
    );
    const refetchOnFocus = () => void loadPreferences({ silent: true });
    window.addEventListener("focus", refetchOnFocus);

    return () => {
      window.clearTimeout(refetchTimerRef.current);
      unsubscribe();
      window.removeEventListener("focus", refetchOnFocus);
    };
  }, [loadPreferences, userId]);

  const updatePreferences = useCallback(
    async (updates) => {
      if (!userId || !preferencesRef.current) return null;

      const mutationId = ++mutationIdRef.current;
      const optimisticPreferences = mergeAppearancePreferences(
        preferencesRef.current,
        updates
      );
      preferencesRef.current = optimisticPreferences;
      setWorkspace({ userId, preferences: optimisticPreferences });
      failedPreferencesRef.current = null;
      pendingMutationsRef.current += 1;
      setSaving(true);
      setError(null);

      try {
        const queuedMutation = mutationQueueRef.current
          .catch(() => null)
          .then(() =>
            updateCloudAppearancePreferences(
              supabase,
              userId,
              optimisticPreferences
            )
          );
        mutationQueueRef.current = queuedMutation;
        const savedPreferences = await queuedMutation;
        if (userIdRef.current !== userId) return null;

        confirmedPreferencesRef.current = savedPreferences;
        failedPreferencesRef.current = null;
        if (mutationIdRef.current === mutationId) {
          preferencesRef.current = savedPreferences;
          setWorkspace({ userId, preferences: savedPreferences });
        }
        return savedPreferences;
      } catch (nextError) {
        if (userIdRef.current === userId && mutationIdRef.current === mutationId) {
          const rollbackPreferences = confirmedPreferencesRef.current;
          preferencesRef.current = rollbackPreferences;
          failedPreferencesRef.current = optimisticPreferences;
          setWorkspace({ userId, preferences: rollbackPreferences });
          setError(nextError);
        }
        return null;
      } finally {
        if (userIdRef.current === userId) {
          pendingMutationsRef.current = Math.max(
            0,
            pendingMutationsRef.current - 1
          );
          setSaving(pendingMutationsRef.current > 0);
        }
      }
    },
    [userId]
  );

  const setTheme = useCallback(
    (theme) => updatePreferences({ theme }),
    [updatePreferences]
  );
  const setDensity = useCallback(
    (density) => updatePreferences({ density }),
    [updatePreferences]
  );
  const setThemeColors = useCallback(
    (themeColors) => updatePreferences({ themeColors }),
    [updatePreferences]
  );
  const retry = useCallback(() => {
    if (!failedPreferencesRef.current) return loadPreferences();
    return updatePreferences(failedPreferencesRef.current);
  }, [loadPreferences, updatePreferences]);

  return {
    preferences,
    loading: Boolean(userId && workspace.userId !== userId) || loading,
    saving,
    error,
    refresh: loadPreferences,
    retry,
    updatePreferences,
    setTheme,
    setDensity,
    setThemeColors,
  };
}
