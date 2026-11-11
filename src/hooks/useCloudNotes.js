import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  createCloudNote,
  createCloudNoteFolder,
  deleteCloudNoteFolder,
  fetchCloudNotes,
  permanentlyDeleteCloudNote,
  renameCloudNoteFolder,
  restoreCloudNote,
  softDeleteCloudNote,
  subscribeToCloudNoteChanges,
  updateCloudNote,
} from "../lib/cloudNotes.js";

const REALTIME_REFETCH_DELAY_MS = 180;
const EMPTY_WORKSPACE = { folders: [], notes: [] };

export default function useCloudNotes(user) {
  const userId = user?.id || "";
  const activeUserRef = useRef(userId);
  const requestIdRef = useRef(0);
  const timerRef = useRef(null);
  const workspaceRef = useRef(EMPTY_WORKSPACE);
  const [workspaceState, setWorkspaceState] = useState({ userId: "", ...EMPTY_WORKSPACE });
  const [loadingState, setLoadingState] = useState({ userId: "", loading: false });
  const [saveCount, setSaveCount] = useState(0);
  const [errorState, setErrorState] = useState({ userId: "", error: null });
  const workspace = workspaceState.userId === userId ? workspaceState : { userId, ...EMPTY_WORKSPACE };
  const loading = loadingState.userId === userId ? loadingState.loading : Boolean(userId);
  const error = errorState.userId === userId ? errorState.error : null;

  const applyWorkspace = useCallback((nextWorkspace) => {
    workspaceRef.current = nextWorkspace;
    setWorkspaceState({ userId, ...nextWorkspace });
  }, [userId]);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!userId) return EMPTY_WORKSPACE;
    const requestId = ++requestIdRef.current;
    if (!silent) setLoadingState({ userId, loading: true });
    try {
      const nextWorkspace = await fetchCloudNotes(supabase, userId);
      if (requestIdRef.current !== requestId || activeUserRef.current !== userId) return null;
      applyWorkspace(nextWorkspace);
      setErrorState({ userId, error: null });
      return nextWorkspace;
    } catch (nextError) {
      if (requestIdRef.current === requestId && activeUserRef.current === userId) {
        setErrorState({ userId, error: nextError });
      }
      return null;
    } finally {
      if (requestIdRef.current === requestId && activeUserRef.current === userId) {
        setLoadingState({ userId, loading: false });
      }
    }
  }, [applyWorkspace, userId]);

  useEffect(() => {
    activeUserRef.current = userId;
    requestIdRef.current += 1;
    workspaceRef.current = EMPTY_WORKSPACE;
    // Account boundaries must clear cached state before the next async load resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWorkspaceState({ userId: "", ...EMPTY_WORKSPACE });
    setErrorState({ userId: "", error: null });
    setSaveCount(0);
    if (!userId) {
      setLoadingState({ userId: "", loading: false });
      return undefined;
    }

    setLoadingState({ userId, loading: true });
    void refresh();
    const scheduleRefresh = () => {
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void refresh({ silent: true }), REALTIME_REFETCH_DELAY_MS);
    };
    const unsubscribe = subscribeToCloudNoteChanges(supabase, userId, scheduleRefresh);
    const refetchOnFocus = () => void refresh({ silent: true });
    window.addEventListener("focus", refetchOnFocus);
    return () => {
      window.clearTimeout(timerRef.current);
      unsubscribe();
      window.removeEventListener("focus", refetchOnFocus);
    };
  }, [refresh, userId]);

  const runMutation = useCallback(async (operation) => {
    if (!userId) return null;
    setSaveCount((count) => count + 1);
    setErrorState({ userId, error: null });
    try {
      const result = await operation();
      if (activeUserRef.current !== userId) return null;
      return result;
    } catch (nextError) {
      if (activeUserRef.current === userId) setErrorState({ userId, error: nextError });
      return null;
    } finally {
      if (activeUserRef.current === userId) setSaveCount((count) => Math.max(0, count - 1));
    }
  }, [userId]);

  const mergeFolder = useCallback((folder) => {
    if (!folder) return;
    const current = workspaceRef.current;
    const folders = current.folders.some((item) => item.id === folder.id)
      ? current.folders.map((item) => item.id === folder.id ? folder : item)
      : [...current.folders, folder];
    applyWorkspace({ ...current, folders });
  }, [applyWorkspace]);

  const mergeNote = useCallback((note) => {
    if (!note) return;
    const current = workspaceRef.current;
    const notes = current.notes.some((item) => item.id === note.id)
      ? current.notes.map((item) => item.id === note.id ? note : item)
      : [note, ...current.notes];
    applyWorkspace({ ...current, notes });
  }, [applyWorkspace]);

  const createFolder = useCallback(async (name) => {
    const folder = await runMutation(() => createCloudNoteFolder(
      supabase, userId, name, workspaceRef.current.folders.length
    ));
    mergeFolder(folder);
    return folder;
  }, [mergeFolder, runMutation, userId]);

  const renameFolder = useCallback(async (folderId, name) => {
    const folder = await runMutation(() => renameCloudNoteFolder(supabase, userId, folderId, name));
    mergeFolder(folder);
    return Boolean(folder);
  }, [mergeFolder, runMutation, userId]);

  const deleteFolder = useCallback(async (folderId) => {
    const deleted = await runMutation(() => deleteCloudNoteFolder(supabase, userId, folderId));
    if (!deleted) return false;
    const current = workspaceRef.current;
    applyWorkspace({
      folders: current.folders.filter((folder) => folder.id !== folderId),
      notes: current.notes.map((note) => note.folderId === folderId ? { ...note, folderId: null } : note),
    });
    return true;
  }, [applyWorkspace, runMutation, userId]);

  const createNote = useCallback(async (folderId = null) => {
    const note = await runMutation(() => createCloudNote(supabase, userId, folderId));
    mergeNote(note);
    return note;
  }, [mergeNote, runMutation, userId]);

  const saveNote = useCallback(async (noteId, changes) => {
    const note = await runMutation(() => updateCloudNote(supabase, userId, noteId, changes));
    mergeNote(note);
    return note;
  }, [mergeNote, runMutation, userId]);

  const deleteNote = useCallback(async (noteId) => {
    const note = await runMutation(() => softDeleteCloudNote(supabase, userId, noteId));
    mergeNote(note);
    return note;
  }, [mergeNote, runMutation, userId]);

  const restoreNote = useCallback(async (noteId) => {
    const note = await runMutation(() => restoreCloudNote(supabase, userId, noteId));
    mergeNote(note);
    return note;
  }, [mergeNote, runMutation, userId]);

  const permanentlyDeleteNote = useCallback(async (noteId) => {
    const deleted = await runMutation(() => permanentlyDeleteCloudNote(supabase, userId, noteId));
    if (!deleted) return false;
    const current = workspaceRef.current;
    applyWorkspace({ ...current, notes: current.notes.filter((note) => note.id !== noteId) });
    return true;
  }, [applyWorkspace, runMutation, userId]);

  return {
    folders: workspace.folders,
    notes: workspace.notes,
    loading,
    saving: saveCount > 0,
    error,
    refresh,
    createFolder,
    renameFolder,
    deleteFolder,
    createNote,
    saveNote,
    deleteNote,
    restoreNote,
    permanentlyDeleteNote,
  };
}
