import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  createCloudMyList,
  createCloudMyListItem,
  deleteCloudMyList,
  deleteCloudMyListItem,
  fetchCloudMyLists,
  renameCloudMyList,
  subscribeToCloudMyListChanges,
  updateCloudMyListItem,
  updateCloudMyListOrder,
} from "../lib/cloudMyLists.js";
import {
  findMyListItem,
  getNextItemSortOrder,
  moveMyList,
} from "../utils/myListsUtils.js";

const REALTIME_REFETCH_DELAY_MS = 120;
const EMPTY_LISTS = [];

export default function useCloudMyLists(user) {
  const userId = user?.id || "";
  const activeUserRef = useRef(userId);
  const listsRef = useRef([]);
  const requestIdRef = useRef(0);
  const timerRef = useRef(null);
  const [workspace, setWorkspace] = useState({ userId: "", lists: [] });
  const [loadState, setLoadState] = useState({ userId: "", loading: false });
  const [saveState, setSaveState] = useState({ userId: "", saving: false });
  const [errorState, setErrorState] = useState({ userId: "", error: null });
  const lists = workspace.userId === userId ? workspace.lists : EMPTY_LISTS;
  const loading = loadState.userId === userId ? loadState.loading : Boolean(userId);
  const saving = saveState.userId === userId ? saveState.saving : false;
  const error = errorState.userId === userId ? errorState.error : null;

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!userId) return [];
    const requestId = ++requestIdRef.current;
    if (!silent) setLoadState({ userId, loading: true });
    setErrorState({ userId, error: null });
    try {
      const nextLists = await fetchCloudMyLists(supabase, userId);
      if (requestIdRef.current !== requestId || activeUserRef.current !== userId) return null;
      listsRef.current = nextLists;
      setWorkspace({ userId, lists: nextLists });
      return nextLists;
    } catch (nextError) {
      if (requestIdRef.current === requestId && activeUserRef.current === userId) {
        setErrorState({ userId, error: nextError });
      }
      return null;
    } finally {
      if (requestIdRef.current === requestId && activeUserRef.current === userId) {
        setLoadState({ userId, loading: false });
      }
    }
  }, [userId]);

  useEffect(() => {
    activeUserRef.current = userId;
    requestIdRef.current += 1;
    listsRef.current = [];
    if (!userId) return undefined;

    // Account-scoped refresh hides the previous workspace before applying async results.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const scheduleRefresh = () => {
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void refresh({ silent: true }), REALTIME_REFETCH_DELAY_MS);
    };
    const unsubscribe = subscribeToCloudMyListChanges(supabase, userId, scheduleRefresh);
    window.addEventListener("focus", scheduleRefresh);
    return () => {
      window.clearTimeout(timerRef.current);
      unsubscribe();
      window.removeEventListener("focus", scheduleRefresh);
    };
  }, [refresh, userId]);

  const perform = useCallback(async (operation) => {
    if (!userId || saving) return false;
    setSaveState({ userId, saving: true });
    setErrorState({ userId, error: null });
    try {
      await operation();
      if (activeUserRef.current !== userId) return false;
      return (await refresh({ silent: true })) !== null;
    } catch (nextError) {
      if (activeUserRef.current === userId) setErrorState({ userId, error: nextError });
      return false;
    } finally {
      if (activeUserRef.current === userId) setSaveState({ userId, saving: false });
    }
  }, [refresh, saving, userId]);

  const createList = useCallback((name) => perform(() =>
    createCloudMyList(supabase, userId, name, listsRef.current.length)
  ), [perform, userId]);

  const renameList = useCallback((listId, name) => perform(() =>
    renameCloudMyList(supabase, userId, listId, name)
  ), [perform, userId]);

  const reorderList = useCallback((listId, direction) => {
    const nextLists = moveMyList(listsRef.current, listId, direction);
    if (nextLists === listsRef.current) return Promise.resolve(false);
    const changedLists = nextLists.filter((list) => {
      const current = listsRef.current.find((candidate) => candidate.id === list.id);
      return current?.sortOrder !== list.sortOrder;
    });
    return perform(() => updateCloudMyListOrder(supabase, userId, changedLists));
  }, [perform, userId]);

  const deleteList = useCallback((listId) => perform(() =>
    deleteCloudMyList(supabase, userId, listId)
  ), [perform, userId]);

  const createItem = useCallback((listId, title) => {
    const list = listsRef.current.find((candidate) => candidate.id === listId);
    if (!list) return Promise.resolve(false);
    return perform(() => createCloudMyListItem(supabase, {
      userId,
      listId,
      title,
      sortOrder: getNextItemSortOrder(list.items),
    }));
  }, [perform, userId]);

  const updateItem = useCallback((itemId, changes) => {
    const located = findMyListItem(listsRef.current, itemId);
    if (!located) return Promise.resolve(false);
    const nextChanges = { ...changes };
    if (changes.listId && changes.listId !== located.list.id) {
      const target = listsRef.current.find((list) => list.id === changes.listId);
      if (!target) return Promise.resolve(false);
      nextChanges.sortOrder = getNextItemSortOrder(target.items);
    }
    return perform(() => updateCloudMyListItem(supabase, userId, itemId, nextChanges));
  }, [perform, userId]);

  const deleteItem = useCallback((itemId) => perform(() =>
    deleteCloudMyListItem(supabase, userId, itemId)
  ), [perform, userId]);

  return {
    lists, loading, saving, error, refresh,
    createList, renameList, reorderList, deleteList,
    createItem, updateItem, deleteItem,
  };
}
