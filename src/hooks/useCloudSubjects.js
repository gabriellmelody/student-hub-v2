import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  fetchCloudSubjects,
  reconcileCloudSubjects,
  subscribeToCloudSubjectChanges,
} from "../lib/cloudSubjects.js";

const REALTIME_REFETCH_DELAY_MS = 120;

export default function useCloudSubjects(user) {
  const userId = user?.id || "";
  const userIdRef = useRef(userId);
  const requestIdRef = useRef(0);
  const refetchTimerRef = useRef(null);
  const subjectsRef = useRef([]);
  const [subjects, setSubjectsState] = useState([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    subjectsRef.current = subjects;
  }, [subjects]);

  const loadSubjects = useCallback(
    async ({ silent = false } = {}) => {
      if (!userId) {
        setSubjectsState([]);
        setLoading(false);
        setError(null);
        return [];
      }

      const requestId = ++requestIdRef.current;
      if (!silent) setLoading(true);
      setError(null);

      try {
        const nextSubjects = await fetchCloudSubjects(supabase, userId);
        if (requestIdRef.current === requestId && userIdRef.current === userId) {
          setSubjectsState(nextSubjects);
        }
        return nextSubjects;
      } catch (nextError) {
        if (requestIdRef.current === requestId && userIdRef.current === userId) {
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
    setSubjectsState([]);
    subjectsRef.current = [];
    setError(null);
    setSaving(false);

    if (!userId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    void loadSubjects();

    const scheduleRefetch = () => {
      window.clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = window.setTimeout(() => {
        void loadSubjects({ silent: true });
      }, REALTIME_REFETCH_DELAY_MS);
    };
    const unsubscribe = subscribeToCloudSubjectChanges(
      supabase,
      userId,
      scheduleRefetch
    );
    const refetchOnFocus = () => {
      void loadSubjects({ silent: true });
    };

    window.addEventListener("focus", refetchOnFocus);

    return () => {
      window.clearTimeout(refetchTimerRef.current);
      unsubscribe();
      window.removeEventListener("focus", refetchOnFocus);
    };
  }, [loadSubjects, userId]);

  const setSubjects = useCallback(
    async (updater) => {
      if (!userId) return false;

      const currentSubjects = subjectsRef.current;
      const nextSubjects =
        typeof updater === "function" ? updater(currentSubjects) : updater;

      setSaving(true);
      setError(null);

      try {
        const result = await reconcileCloudSubjects({
          client: supabase,
          userId,
          currentSubjects,
          nextSubjects,
        });

        if (userIdRef.current !== userId) return false;

        setSubjectsState(result.subjects);
        return true;
      } catch (nextError) {
        if (userIdRef.current === userId) {
          setError(nextError);
        }
        return false;
      } finally {
        if (userIdRef.current === userId) {
          setSaving(false);
        }
      }
    },
    [userId]
  );

  return {
    subjects,
    setSubjects,
    loading,
    saving,
    error,
    refetch: loadSubjects,
  };
}
