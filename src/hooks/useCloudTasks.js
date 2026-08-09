import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  createCloudTask,
  createCloudTasks,
  deleteAllCloudTasks,
  deleteCloudTask,
  deleteCloudTasks,
  fetchCloudTasks,
  getTasksForCloudWorkspace,
  subscribeToCloudTaskChanges,
  updateCloudTask,
  updateCloudTasks,
  upsertCloudClassroomTasks,
} from "../lib/cloudTasks.js";
import { getExternalSourceKey } from "../utils/appUtils.js";

const REALTIME_REFETCH_DELAY_MS = 120;

export default function useCloudTasks(user) {
  const userId = user?.id || "";
  const userIdRef = useRef(userId);
  const requestIdRef = useRef(0);
  const refetchTimerRef = useRef(null);
  const tasksRef = useRef([]);
  const [workspace, setWorkspace] = useState({ userId: "", tasks: [] });
  const [loading, setLoading] = useState(Boolean(userId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const visibleTasks = getTasksForCloudWorkspace(workspace, userId);

  useEffect(() => {
    tasksRef.current = visibleTasks;
  }, [visibleTasks]);

  const loadTasks = useCallback(
    async ({ silent = false } = {}) => {
      if (!userId) {
        setWorkspace({ userId: "", tasks: [] });
        tasksRef.current = [];
        setLoading(false);
        setError(null);
        return [];
      }

      const requestId = ++requestIdRef.current;
      if (!silent) setLoading(true);
      setError(null);

      try {
        const nextTasks = await fetchCloudTasks(supabase, userId);
        if (requestIdRef.current === requestId && userIdRef.current === userId) {
          tasksRef.current = nextTasks;
          setWorkspace({ userId, tasks: nextTasks });
        }
        return nextTasks;
      } catch (nextError) {
        if (requestIdRef.current === requestId && userIdRef.current === userId) {
          setWorkspace((currentWorkspace) =>
            currentWorkspace.userId === userId
              ? currentWorkspace
              : { userId, tasks: [] }
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
    tasksRef.current = [];
    setWorkspace({ userId: "", tasks: [] });
    setError(null);
    setSaving(false);

    if (!userId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    void loadTasks();

    const scheduleRefetch = () => {
      window.clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = window.setTimeout(() => {
        void loadTasks({ silent: true });
      }, REALTIME_REFETCH_DELAY_MS);
    };
    const unsubscribe = subscribeToCloudTaskChanges(
      supabase,
      userId,
      scheduleRefetch
    );
    const refetchOnFocus = () => void loadTasks({ silent: true });
    window.addEventListener("focus", refetchOnFocus);

    return () => {
      window.clearTimeout(refetchTimerRef.current);
      unsubscribe();
      window.removeEventListener("focus", refetchOnFocus);
    };
  }, [loadTasks, userId]);

  const runMutation = useCallback(
    async (operation) => {
      if (!userId) return null;
      setSaving(true);
      setError(null);
      try {
        return await operation();
      } catch (nextError) {
        if (userIdRef.current === userId) setError(nextError);
        return null;
      } finally {
        if (userIdRef.current === userId) setSaving(false);
      }
    },
    [userId]
  );

  const createTask = useCallback(
    (task) =>
      runMutation(async () => {
        const savedTask = await createCloudTask(supabase, userId, task);
        if (userIdRef.current !== userId) return null;
        const nextTasks = [...tasksRef.current, savedTask];
        tasksRef.current = nextTasks;
        setWorkspace({ userId, tasks: nextTasks });
        return savedTask;
      }),
    [runMutation, userId]
  );

  const createTasks = useCallback(
    (tasks) =>
      runMutation(async () => {
        const savedTasks = await createCloudTasks(supabase, userId, tasks);
        if (userIdRef.current !== userId) return null;
        const nextTasks = [...tasksRef.current, ...savedTasks];
        tasksRef.current = nextTasks;
        setWorkspace({ userId, tasks: nextTasks });
        return savedTasks;
      }),
    [runMutation, userId]
  );

  const updateTask = useCallback(
    (task) =>
      runMutation(async () => {
        const savedTask = await updateCloudTask(supabase, userId, task);
        if (userIdRef.current !== userId) return null;
        const nextTasks = tasksRef.current.map((currentTask) =>
          currentTask.id === savedTask.id ? savedTask : currentTask
        );
        tasksRef.current = nextTasks;
        setWorkspace({ userId, tasks: nextTasks });
        return savedTask;
      }),
    [runMutation, userId]
  );

  const updateTasks = useCallback(
    (tasks) =>
      runMutation(async () => {
        const savedTasks = await updateCloudTasks(supabase, userId, tasks);
        if (userIdRef.current !== userId) return null;
        const savedById = new Map(savedTasks.map((task) => [task.id, task]));
        const nextTasks = tasksRef.current.map(
          (task) => savedById.get(task.id) || task
        );
        tasksRef.current = nextTasks;
        setWorkspace({ userId, tasks: nextTasks });
        return savedTasks;
      }),
    [runMutation, userId]
  );

  const upsertClassroomTasks = useCallback(
    (tasks) =>
      runMutation(async () => {
        const savedTasks = await upsertCloudClassroomTasks(
          supabase,
          userId,
          tasks
        );
        if (userIdRef.current !== userId) return null;
        const savedBySource = new Map(
          savedTasks.map((task) => [getExternalSourceKey(task), task])
        );
        const retainedTasks = tasksRef.current.filter(
          (task) => !savedBySource.has(getExternalSourceKey(task))
        );
        const nextTasks = [...retainedTasks, ...savedTasks];
        tasksRef.current = nextTasks;
        setWorkspace({ userId, tasks: nextTasks });
        return savedTasks;
      }),
    [runMutation, userId]
  );

  const deleteTask = useCallback(
    (taskId) =>
      runMutation(async () => {
        const deleted = await deleteCloudTask(supabase, userId, taskId);
        if (!deleted || userIdRef.current !== userId) return null;
        const nextTasks = tasksRef.current.filter((task) => task.id !== taskId);
        tasksRef.current = nextTasks;
        setWorkspace({ userId, tasks: nextTasks });
        return true;
      }),
    [runMutation, userId]
  );

  const deleteTasks = useCallback(
    (taskIds) =>
      runMutation(async () => {
        const deletedCount = await deleteCloudTasks(supabase, userId, taskIds);
        if (userIdRef.current !== userId) return null;
        const deletedIds = new Set(taskIds);
        const nextTasks = tasksRef.current.filter(
          (task) => !deletedIds.has(task.id)
        );
        tasksRef.current = nextTasks;
        setWorkspace({ userId, tasks: nextTasks });
        return deletedCount;
      }),
    [runMutation, userId]
  );

  const clearTasks = useCallback(
    () =>
      runMutation(async () => {
        await deleteAllCloudTasks(supabase, userId);
        if (userIdRef.current !== userId) return null;
        tasksRef.current = [];
        setWorkspace({ userId, tasks: [] });
        return true;
      }),
    [runMutation, userId]
  );

  return {
    tasks: visibleTasks,
    loading: Boolean(userId && workspace.userId !== userId) || loading,
    saving,
    error,
    refetch: loadTasks,
    createTask,
    createTasks,
    updateTask,
    updateTasks,
    upsertClassroomTasks,
    deleteTask,
    deleteTasks,
    clearTasks,
  };
}
