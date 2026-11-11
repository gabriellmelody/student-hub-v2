import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {
  NOTE_AUTOSAVE_DELAY_MS,
  createEmptyNoteContent,
  extractNotePlainText,
  filterNotes,
  getNoteDisplayTitle,
  getNotePreview,
} from "../utils/notesUtils.js";

function formatNoteUpdated(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return "Just now";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function FolderPane({
  folders,
  notes,
  selectedView,
  selectedFolderId,
  saving,
  onSelectView,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onCloseMobile,
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameName, setRenameName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (adding || renamingId) requestAnimationFrame(() => inputRef.current?.focus());
  }, [adding, renamingId]);

  function choose(view, folderId = null) {
    onSelectView(view, folderId);
    onCloseMobile();
  }

  async function createFolder(event) {
    event.preventDefault();
    if (!newName.trim() || saving) return;
    const folder = await onCreateFolder(newName);
    if (!folder) return;
    setNewName("");
    setAdding(false);
    choose("folder", folder.id);
  }

  async function renameFolder(event) {
    event.preventDefault();
    if (!renameName.trim() || saving) return;
    if (await onRenameFolder(renamingId, renameName)) setRenamingId(null);
  }

  async function deleteFolder(folder) {
    const noteCount = notes.filter((note) => note.folderId === folder.id && !note.deletedAt).length;
    const message = noteCount > 0
      ? `Delete “${folder.name}”? Its ${noteCount} ${noteCount === 1 ? "note" : "notes"} will move to All Notes.`
      : `Delete “${folder.name}”?`;
    if (!window.confirm(message)) return;
    if (await onDeleteFolder(folder.id) && selectedFolderId === folder.id) choose("all");
  }

  const openNotes = notes.filter((note) => !note.deletedAt);
  const systemViews = [
    { id: "all", label: "All Notes", icon: "▤", count: openNotes.length },
    { id: "pinned", label: "Pinned", icon: "◆", count: openNotes.filter((note) => note.pinned).length },
    { id: "deleted", label: "Recently Deleted", icon: "⌫", count: notes.filter((note) => note.deletedAt).length },
  ];

  return (
    <aside className="notes-folders-pane" aria-label="Note folders">
      <div className="notes-pane-heading">
        <h2>Folders</h2>
        <button type="button" className="notes-mobile-close" onClick={onCloseMobile}>Done</button>
      </div>
      <nav className="notes-folder-nav" aria-label="Notes views">
        {systemViews.map((view) => (
          <button
            key={view.id}
            type="button"
            className={selectedView === view.id ? "active" : ""}
            aria-current={selectedView === view.id ? "page" : undefined}
            onClick={() => choose(view.id)}
          >
            <span aria-hidden="true">{view.icon}</span>
            <strong>{view.label}</strong>
            <small>{view.count}</small>
          </button>
        ))}
      </nav>

      <div className="notes-custom-folders-heading">
        <h3>My folders</h3>
        <button type="button" aria-label="Create folder" title="New folder" onClick={() => setAdding(true)}>+</button>
      </div>

      {adding && (
        <form className="notes-folder-form" onSubmit={createFolder}>
          <input
            ref={inputRef}
            value={newName}
            maxLength={60}
            aria-label="New folder name"
            placeholder="Folder name"
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") { setAdding(false); setNewName(""); }
            }}
          />
          <button type="submit" aria-label="Create folder" disabled={!newName.trim() || saving}>✓</button>
          <button type="button" aria-label="Cancel new folder" onClick={() => { setAdding(false); setNewName(""); }}>×</button>
        </form>
      )}

      <div className="notes-folder-list">
        {folders.map((folder) => renamingId === folder.id ? (
          <form key={folder.id} className="notes-folder-form" onSubmit={renameFolder}>
            <input
              ref={inputRef}
              value={renameName}
              maxLength={60}
              aria-label={`Rename ${folder.name}`}
              onChange={(event) => setRenameName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setRenamingId(null);
              }}
            />
            <button type="submit" aria-label="Save folder name" disabled={!renameName.trim() || saving}>✓</button>
            <button type="button" aria-label="Cancel renaming folder" onClick={() => setRenamingId(null)}>×</button>
          </form>
        ) : (
          <div key={folder.id} className={`notes-folder-row${selectedView === "folder" && selectedFolderId === folder.id ? " active" : ""}`}>
            <button type="button" onClick={() => choose("folder", folder.id)}>
              <span aria-hidden="true">▱</span>
              <strong>{folder.name}</strong>
              <small>{openNotes.filter((note) => note.folderId === folder.id).length}</small>
            </button>
            <details>
              <summary aria-label={`Folder options for ${folder.name}`}>•••</summary>
              <div>
                <button type="button" onClick={() => { setRenameName(folder.name); setRenamingId(folder.id); }}>Rename</button>
                <button type="button" className="danger" onClick={() => void deleteFolder(folder)}>Delete</button>
              </div>
            </details>
          </div>
        ))}
      </div>

      <button type="button" className="notes-new-folder" onClick={() => setAdding(true)}>
        <span aria-hidden="true">+</span> New folder
      </button>
    </aside>
  );
}

function NoteListPane({ notes, query, selectedNoteId, viewLabel, onQueryChange, onCreate, onSelect }) {
  return (
    <section className="notes-list-pane" aria-label={`${viewLabel} notes`}>
      <div className="notes-list-header">
        <div>
          <p className="eyebrow">Notes</p>
          <h2>{viewLabel}</h2>
        </div>
        <button type="button" className="notes-new-note" onClick={onCreate} aria-label="Create new note">+</button>
      </div>
      <label className="notes-search">
        <span aria-hidden="true">⌕</span>
        <span className="sr-only">Search notes</span>
        <input type="search" value={query} placeholder="Search notes" onChange={(event) => onQueryChange(event.target.value)} />
      </label>
      <div className="notes-list" role="listbox" aria-label="Notes">
        {notes.map((note) => (
          <button
            key={note.id}
            type="button"
            role="option"
            aria-selected={selectedNoteId === note.id}
            className={selectedNoteId === note.id ? "selected" : ""}
            onClick={() => onSelect(note.id)}
          >
            <span className="notes-list-title">
              <strong>{getNoteDisplayTitle(note)}</strong>
              {note.pinned && <span title="Pinned" aria-label="Pinned">◆</span>}
            </span>
            <span className="notes-list-preview">{getNotePreview(note)}</span>
            <time dateTime={note.updatedAt || undefined}>{formatNoteUpdated(note.updatedAt)}</time>
          </button>
        ))}
        {notes.length === 0 && (
          <div className="notes-list-empty">
            <strong>No notes yet</strong>
            <p>{query ? "Try a different search." : "Create a note when something is worth keeping."}</p>
            {!query && <button type="button" onClick={onCreate}>New note</button>}
          </div>
        )}
      </div>
    </section>
  );
}

function FormatButton({ active = false, label, children, onClick, disabled }) {
  return (
    <button
      type="button"
      className={active ? "active" : ""}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function NotesToolbar({ editor, disabled }) {
  if (!editor) return null;
  return (
    <div className="notes-format-toolbar" role="toolbar" aria-label="Note formatting">
      <FormatButton label="Paragraph" active={editor.isActive("paragraph")} disabled={disabled} onClick={() => editor.chain().focus().setParagraph().run()}>¶</FormatButton>
      <FormatButton label="Heading" active={editor.isActive("heading", { level: 2 })} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H</FormatButton>
      <span aria-hidden="true" />
      <FormatButton label="Bold" active={editor.isActive("bold")} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></FormatButton>
      <FormatButton label="Italic" active={editor.isActive("italic")} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></FormatButton>
      <span aria-hidden="true" />
      <FormatButton label="Bullet list" active={editor.isActive("bulletList")} disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</FormatButton>
      <FormatButton label="Numbered list" active={editor.isActive("orderedList")} disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</FormatButton>
      <FormatButton label="Checklist" active={editor.isActive("taskList")} disabled={disabled} onClick={() => editor.chain().focus().toggleTaskList().run()}>☑</FormatButton>
    </div>
  );
}

function NoteEditor({
  note,
  folders,
  draft,
  editor,
  saveStatus,
  saveError,
  foldersCollapsed,
  listCollapsed,
  onDraftTitle,
  onRetrySave,
  onToggleFolders,
  onToggleList,
  onBackMobile,
  onTogglePin,
  onMove,
  onDelete,
  onRestore,
  onPermanentDelete,
}) {
  if (!note) {
    return (
      <section className="notes-editor-pane notes-editor-empty">
        <header className="notes-editor-header">
          <div className="notes-editor-view-controls">
            <button type="button" aria-label={foldersCollapsed ? "Show folders" : "Hide folders"} aria-pressed={!foldersCollapsed} onClick={onToggleFolders}>☰</button>
            <button type="button" aria-label={listCollapsed ? "Show notes list" : "Hide notes list"} aria-pressed={!listCollapsed} onClick={onToggleList}>▤</button>
          </div>
        </header>
        <div className="notes-editor-empty-message">
          <span aria-hidden="true">✎</span>
          <h2>No note selected</h2>
          <p>Choose a note or create a new one.</p>
        </div>
      </section>
    );
  }

  const deleted = Boolean(note.deletedAt);
  return (
    <section className="notes-editor-pane" aria-label={`Editing ${getNoteDisplayTitle(note)}`}>
      <header className="notes-editor-header">
        <div className="notes-editor-view-controls">
          <button type="button" className="notes-mobile-back" onClick={onBackMobile} aria-label="Back to notes">←</button>
          <button type="button" aria-label={foldersCollapsed ? "Show folders" : "Hide folders"} aria-pressed={!foldersCollapsed} onClick={onToggleFolders}>☰</button>
          <button type="button" aria-label={listCollapsed ? "Show notes list" : "Hide notes list"} aria-pressed={!listCollapsed} onClick={onToggleList}>▤</button>
        </div>
        <div className="notes-editor-actions">
          {!deleted ? (
            <>
              <button type="button" className={note.pinned ? "active" : ""} aria-pressed={note.pinned} onClick={onTogglePin}>
                {note.pinned ? "Unpin" : "Pin"}
              </button>
              <label>
                <span className="sr-only">Move note to folder</span>
                <select value={note.folderId || ""} onChange={(event) => onMove(event.target.value || null)}>
                  <option value="">No folder</option>
                  {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                </select>
              </label>
              <button type="button" className="danger" onClick={onDelete}>Delete</button>
            </>
          ) : (
            <>
              <button type="button" onClick={onRestore}>Restore</button>
              <button type="button" className="danger" onClick={onPermanentDelete}>Delete permanently</button>
            </>
          )}
        </div>
      </header>

      <NotesToolbar editor={editor} disabled={deleted} />

      <div className="notes-editor-document">
        <input
          className="notes-title-input"
          type="text"
          maxLength={200}
          value={draft.title}
          readOnly={deleted}
          aria-label="Note title"
          placeholder="Title"
          onChange={(event) => onDraftTitle(event.target.value)}
        />
        <EditorContent editor={editor} className="notes-rich-editor" aria-label="Note body" />
      </div>

      <footer className="notes-editor-status" aria-live="polite">
        {deleted ? (
          <span>Recently deleted</span>
        ) : saveError ? (
          <span className="error">Couldn’t save. Your text is still here. <button type="button" onClick={onRetrySave}>Try again</button></span>
        ) : (
          <span>{saveStatus}</span>
        )}
      </footer>
    </section>
  );
}

export default function NotesPage({ workspace }) {
  const {
    folders, notes, loading, saving, error,
    createFolder, renameFolder, deleteFolder,
    createNote, saveNote, deleteNote, restoreNote, permanentlyDeleteNote,
  } = workspace;
  const [selectedView, setSelectedView] = useState("all");
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [query, setQuery] = useState("");
  const [foldersCollapsed, setFoldersCollapsed] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [mobileFoldersOpen, setMobileFoldersOpen] = useState(false);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [draft, setDraft] = useState({ title: "", content: createEmptyNoteContent(), plainText: "" });
  const [saveStatus, setSaveStatus] = useState("Saved");
  const [saveError, setSaveError] = useState(false);
  const draftRef = useRef(draft);
  const selectedNoteIdRef = useRef(selectedNoteId);
  const dirtyRef = useRef(false);
  const autosaveTimerRef = useRef(null);
  const editVersionRef = useRef(0);
  const hydratedUpdatedAtRef = useRef(null);
  const mountedRef = useRef(true);
  const editorUpdateRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: createEmptyNoteContent(),
    editorProps: { attributes: { "aria-label": "Note body", role: "textbox" } },
    onUpdate: ({ editor: currentEditor }) => editorUpdateRef.current?.(currentEditor),
  });

  const selectedNote = notes.find((note) => note.id === selectedNoteId) || null;
  const visibleNotes = useMemo(() => filterNotes(notes, {
    view: selectedView,
    folderId: selectedFolderId,
    query,
  }), [notes, query, selectedFolderId, selectedView]);
  const viewLabel = selectedView === "pinned"
    ? "Pinned"
    : selectedView === "deleted"
      ? "Recently Deleted"
      : selectedView === "folder"
        ? folders.find((folder) => folder.id === selectedFolderId)?.name || "Folder"
        : "All Notes";

  const persistDraft = useCallback(async (noteId, snapshot, version) => {
    if (!noteId) return false;
    if (mountedRef.current) { setSaveStatus("Saving…"); setSaveError(false); }
    const saved = await saveNote(noteId, { title: snapshot.title, content: snapshot.content });
    if (!mountedRef.current) return Boolean(saved);
    if (!saved) {
      setSaveError(true);
      dirtyRef.current = true;
      return false;
    }
    if (selectedNoteIdRef.current === noteId && editVersionRef.current === version) {
      dirtyRef.current = false;
      hydratedUpdatedAtRef.current = saved.updatedAt;
      setSaveStatus("Saved");
    }
    return true;
  }, [saveNote]);

  const scheduleAutosave = useCallback((nextDraft) => {
    const noteId = selectedNoteIdRef.current;
    if (!noteId) return;
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    dirtyRef.current = true;
    setSaveError(false);
    const version = ++editVersionRef.current;
    window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      void persistDraft(noteId, nextDraft, version);
    }, NOTE_AUTOSAVE_DELAY_MS);
  }, [persistDraft]);

  useEffect(() => {
    editorUpdateRef.current = (currentEditor) => {
      if (!selectedNoteIdRef.current || selectedNote?.deletedAt) return;
      const content = currentEditor.getJSON();
      scheduleAutosave({
        ...draftRef.current,
        content,
        plainText: extractNotePlainText(content),
      });
    };
  }, [scheduleAutosave, selectedNote?.deletedAt]);

  useEffect(() => {
    selectedNoteIdRef.current = selectedNoteId;
  }, [selectedNoteId]);

  useEffect(() => {
    if (!editor) return;
    if (!selectedNote) {
      editor.setEditable(false);
      return;
    }
    const changedNote = selectedNote.id !== selectedNoteIdRef.current
      || hydratedUpdatedAtRef.current !== selectedNote.updatedAt;
    if (!changedNote || dirtyRef.current) return;
    const nextDraft = {
      title: selectedNote.title || "",
      content: selectedNote.content || createEmptyNoteContent(),
      plainText: selectedNote.plainText || "",
    };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    editor.commands.setContent(nextDraft.content, { emitUpdate: false });
    editor.setEditable(!selectedNote.deletedAt);
    hydratedUpdatedAtRef.current = selectedNote.updatedAt;
    setSaveStatus("Saved");
    setSaveError(false);
  }, [editor, selectedNote]);

  useEffect(() => {
    if (!editor || !selectedNote) return;
    editor.setEditable(!selectedNote.deletedAt);
  }, [editor, selectedNote]);

  useEffect(() => () => {
    mountedRef.current = false;
    window.clearTimeout(autosaveTimerRef.current);
    if (dirtyRef.current && selectedNoteIdRef.current) {
      void saveNote(selectedNoteIdRef.current, {
        title: draftRef.current.title,
        content: draftRef.current.content,
      });
    }
  }, [saveNote]);

  function flushPendingSave() {
    window.clearTimeout(autosaveTimerRef.current);
    if (!dirtyRef.current || !selectedNoteIdRef.current) return;
    void persistDraft(selectedNoteIdRef.current, draftRef.current, editVersionRef.current);
  }

  function selectNote(noteId) {
    if (noteId !== selectedNoteIdRef.current) flushPendingSave();
    dirtyRef.current = false;
    hydratedUpdatedAtRef.current = null;
    selectedNoteIdRef.current = noteId;
    setSelectedNoteId(noteId);
    setMobileEditorOpen(true);
  }

  async function addNote() {
    flushPendingSave();
    const folderId = selectedView === "folder" ? selectedFolderId : null;
    const note = await createNote(folderId);
    if (!note) return;
    if (selectedView === "deleted" || selectedView === "pinned") {
      setSelectedView(folderId ? "folder" : "all");
    }
    selectNote(note.id);
    requestAnimationFrame(() => document.querySelector(".notes-title-input")?.focus());
  }

  function chooseView(view, folderId = null) {
    flushPendingSave();
    setSelectedView(view);
    setSelectedFolderId(folderId);
    setSelectedNoteId(null);
    selectedNoteIdRef.current = null;
    hydratedUpdatedAtRef.current = null;
    setQuery("");
    setMobileEditorOpen(false);
  }

  async function moveNote(folderId) {
    if (!selectedNote) return;
    flushPendingSave();
    await saveNote(selectedNote.id, { folderId });
  }

  async function removeNote() {
    if (!selectedNote || !window.confirm(`Move “${getNoteDisplayTitle(selectedNote)}” to Recently Deleted?`)) return;
    window.clearTimeout(autosaveTimerRef.current);
    if (dirtyRef.current) {
      const saved = await persistDraft(selectedNote.id, draftRef.current, editVersionRef.current);
      if (!saved) return;
    }
    dirtyRef.current = false;
    if (await deleteNote(selectedNote.id)) {
      setSelectedNoteId(null);
      selectedNoteIdRef.current = null;
      setMobileEditorOpen(false);
    }
  }

  async function restoreSelectedNote() {
    if (!selectedNote) return;
    if (await restoreNote(selectedNote.id)) chooseView("all");
  }

  async function permanentlyDeleteSelectedNote() {
    if (!selectedNote || !window.confirm(`Delete “${getNoteDisplayTitle(selectedNote)}” permanently? This cannot be undone.`)) return;
    if (await permanentlyDeleteNote(selectedNote.id)) {
      setSelectedNoteId(null);
      selectedNoteIdRef.current = null;
      setMobileEditorOpen(false);
    }
  }

  const workspaceClasses = [
    "notes-workspace",
    foldersCollapsed ? "folders-collapsed" : "",
    listCollapsed ? "list-collapsed" : "",
    mobileFoldersOpen ? "mobile-folders-open" : "",
    mobileEditorOpen ? "mobile-editor-open" : "",
  ].filter(Boolean).join(" ");

  if (loading) return <section className="page panel notes-loading" aria-busy="true">Loading Notes…</section>;

  return (
    <div className="page notes-page">
      <header className="notes-page-header">
        <div>
          <p className="eyebrow">Notes</p>
          <h1>Write it down</h1>
          <p>Study notes, ideas, reflections, and anything worth keeping.</p>
        </div>
        <div>
          <button type="button" className="secondary-button notes-mobile-folders" onClick={() => setMobileFoldersOpen(true)}>Folders</button>
          <button type="button" className="primary-button" onClick={() => void addNote()}>New note</button>
        </div>
      </header>

      {(error || saveError) && (
        <div className="notes-sync-error" role="alert">
          Notes couldn’t sync. Your current text remains in the editor.
        </div>
      )}

      <div className={workspaceClasses}>
        <FolderPane
          folders={folders}
          notes={notes}
          selectedView={selectedView}
          selectedFolderId={selectedFolderId}
          saving={saving}
          onSelectView={chooseView}
          onCreateFolder={createFolder}
          onRenameFolder={renameFolder}
          onDeleteFolder={deleteFolder}
          onCloseMobile={() => setMobileFoldersOpen(false)}
        />
        <NoteListPane
          notes={visibleNotes}
          query={query}
          selectedNoteId={selectedNoteId}
          viewLabel={viewLabel}
          onQueryChange={setQuery}
          onCreate={() => void addNote()}
          onSelect={selectNote}
        />
        <NoteEditor
          note={selectedNote}
          folders={folders}
          draft={draft}
          editor={editor}
          saveStatus={saveStatus}
          saveError={saveError}
          foldersCollapsed={foldersCollapsed}
          listCollapsed={listCollapsed}
          onDraftTitle={(title) => scheduleAutosave({ ...draftRef.current, title })}
          onRetrySave={() => void persistDraft(selectedNoteId, draftRef.current, editVersionRef.current)}
          onToggleFolders={() => setFoldersCollapsed((collapsed) => !collapsed)}
          onToggleList={() => setListCollapsed((collapsed) => !collapsed)}
          onBackMobile={() => setMobileEditorOpen(false)}
          onTogglePin={() => void saveNote(selectedNote.id, { pinned: !selectedNote.pinned })}
          onMove={(folderId) => void moveNote(folderId)}
          onDelete={() => void removeNote()}
          onRestore={() => void restoreSelectedNote()}
          onPermanentDelete={() => void permanentlyDeleteSelectedNote()}
        />
      </div>
    </div>
  );
}
