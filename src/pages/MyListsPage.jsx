import { useEffect, useRef, useState } from "react";
import MyListItemModal from "../components/MyListItemModal.jsx";
import {
  MY_LIST_COLOURS,
  getMyListColour,
  getMyListSubjectColour,
  getVisibleMyListItems,
  resolveMyListItemSubject,
} from "../utils/myListsUtils.js";

function AddCardForm({ list, open, saving, onActivate, onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  async function submit(event) {
    event.preventDefault();
    if (!title.trim() || saving) return;
    if (await onCreate(list.id, title)) {
      setTitle("");
      onClose();
    }
  }

  function cancel() {
    setTitle("");
    onClose();
  }

  if (!open) {
    return (
      <button type="button" className="my-list-add-card" onClick={onActivate}>
        <span aria-hidden="true">+</span> Add card
      </button>
    );
  }

  return (
    <form className="my-list-inline-add" onSubmit={submit}>
      <label>
        <span>Title</span>
        <input
          ref={inputRef}
          type="text"
          maxLength={200}
          value={title}
          placeholder="What do you want to remember?"
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") cancel();
          }}
        />
      </label>
      <div>
        <button type="submit" className="small-button" disabled={!title.trim() || saving}>Save</button>
        <button type="button" className="quiet-button" onClick={cancel}>Cancel</button>
      </div>
    </form>
  );
}

function MyListCard({ item, listColour, subject, saving, onOpen, onToggle }) {
  const completionLabel = item.completed
    ? `Reopen ${item.title}`
    : `Mark ${item.title} complete`;

  return (
    <article
      className={`my-list-card${item.completed ? " completed" : ""}`}
      style={{ "--list-colour": listColour }}
    >
      <button
        type="button"
        className="my-list-card-complete"
        aria-label={completionLabel}
        aria-pressed={item.completed}
        title={item.completed ? "Reopen card" : "Mark complete"}
        disabled={saving}
        onClick={(event) => {
          event.stopPropagation();
          void onToggle(item);
        }}
      >
        <span aria-hidden="true">{item.completed ? "✓" : ""}</span>
      </button>
      <button
        type="button"
        className="my-list-card-open"
        aria-label={`Open ${item.title}${item.completed ? ", completed" : ""}`}
        onClick={(event) => onOpen(item.id, event.currentTarget)}
      >
        <strong>{item.title}</strong>
        {item.notes && <span className="my-list-card-notes">{item.notes.replace(/\s+/g, " ")}</span>}
        <span className="my-list-card-meta">
          {subject && (
            <span className="my-list-subject-chip" style={{ "--subject-colour": getMyListSubjectColour(subject) }}>
              <i aria-hidden="true" />
              {subject.name}
            </span>
          )}
          {item.completed && <small>Completed</small>}
        </span>
      </button>
    </article>
  );
}

function MyListColumn({
  list,
  index,
  listCount,
  subjects,
  showCompleted,
  saving,
  activeComposer,
  onActivateComposer,
  onCloseComposer,
  onRename,
  onChangeColour,
  onReorder,
  onDelete,
  onCreateItem,
  onOpenItem,
  onToggleItem,
}) {
  const [name, setName] = useState(list.name);
  const [colourPickerOpen, setColourPickerOpen] = useState(false);
  const renameRef = useRef(null);
  const isRenaming = activeComposer?.type === "rename" && activeComposer.listId === list.id;
  const isAddingCard = activeComposer?.type === "card" && activeComposer.listId === list.id;
  const visibleItems = getVisibleMyListItems(list.items, showCompleted);
  const openCount = list.items.filter((item) => !item.completed).length;
  const listColour = getMyListColour(list.colorKey);

  useEffect(() => {
    if (isRenaming) requestAnimationFrame(() => renameRef.current?.select());
  }, [isRenaming]);

  async function submitRename(event) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    if (await onRename(list.id, name)) onCloseComposer();
  }

  function cancelRename() {
    setName(list.name);
    onCloseComposer();
  }

  function startRename(event) {
    event.currentTarget.closest("details")?.removeAttribute("open");
    onActivateComposer({ type: "rename", listId: list.id });
  }

  function deleteList() {
    if (list.items.length > 0 && !window.confirm(
      `Delete “${list.name}” and its ${list.items.length} ${list.items.length === 1 ? "card" : "cards"}?`
    )) return;
    void onDelete(list.id);
  }

  return (
    <section
      className="my-list-column"
      aria-labelledby={`my-list-${list.id}`}
      style={{ "--list-colour": listColour.value }}
    >
      <header className="my-list-column-header">
        {isRenaming ? (
          <form className="my-list-rename" onSubmit={submitRename}>
            <label>
              <span className="sr-only">List name</span>
              <input
                ref={renameRef}
                type="text"
                maxLength={60}
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") cancelRename();
                }}
              />
            </label>
            <button type="submit" aria-label="Save list name" disabled={!name.trim() || saving}>✓</button>
            <button type="button" aria-label="Cancel renaming list" onClick={cancelRename}>×</button>
          </form>
        ) : (
          <div className="my-list-column-title">
            <span className="my-list-colour-dot" aria-hidden="true" />
            <h2 id={`my-list-${list.id}`}>{list.name}</h2>
            <span>{openCount}</span>
          </div>
        )}

        {!isRenaming && (
          <details className="my-list-column-menu" onToggle={(event) => {
            if (!event.currentTarget.open) setColourPickerOpen(false);
          }}>
            <summary aria-label={`List options for ${list.name}`}>•••</summary>
            <div>
              <button type="button" onClick={startRename}>Rename</button>
              <button
                type="button"
                aria-expanded={colourPickerOpen}
                onClick={() => setColourPickerOpen((open) => !open)}
              >
                Change colour
              </button>
              {colourPickerOpen && (
                <div className="my-list-colour-picker" aria-label={`Colour for ${list.name}`}>
                  {MY_LIST_COLOURS.map((colour) => (
                    <button
                      key={colour.id}
                      type="button"
                      className={colour.id === listColour.id ? "selected" : ""}
                      aria-label={`${colour.label}${colour.id === listColour.id ? ", selected" : ""}`}
                      aria-pressed={colour.id === listColour.id}
                      title={colour.label}
                      style={{ "--choice-colour": colour.value }}
                      disabled={saving}
                      onClick={() => {
                        void onChangeColour(list.id, colour.id);
                        setColourPickerOpen(false);
                      }}
                    >
                      <span aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
              <button type="button" disabled={index === 0 || saving} onClick={() => onReorder(list.id, "left")}>Move left</button>
              <button type="button" disabled={index === listCount - 1 || saving} onClick={() => onReorder(list.id, "right")}>Move right</button>
              <button type="button" className="danger" onClick={deleteList}>Delete list</button>
            </div>
          </details>
        )}
      </header>

      <div className="my-list-cards">
        {visibleItems.map((item) => (
          <MyListCard
            key={item.id}
            item={item}
            listColour={listColour.value}
            subject={resolveMyListItemSubject(item, subjects)}
            saving={saving}
            onOpen={onOpenItem}
            onToggle={onToggleItem}
          />
        ))}
        {visibleItems.length === 0 && (
          <p className="my-list-column-empty">
            {list.items.length > 0 ? "No open cards." : "No cards yet."}
          </p>
        )}
      </div>

      <AddCardForm
        list={list}
        open={isAddingCard}
        saving={saving}
        onActivate={() => onActivateComposer({ type: "card", listId: list.id })}
        onClose={onCloseComposer}
        onCreate={onCreateItem}
      />
    </section>
  );
}

export default function MyListsPage({ workspace, subjects = [] }) {
  const {
    lists, loading, saving, error, refresh,
    createList, renameList, changeListColour, reorderList, deleteList,
    createItem, updateItem, deleteItem,
  } = workspace;
  const [showCompleted, setShowCompleted] = useState(false);
  const [activeComposer, setActiveComposer] = useState(null);
  const [newListName, setNewListName] = useState("");
  const [selectedItemId, setSelectedItemId] = useState(null);
  const newListInputRef = useRef(null);
  const itemReturnFocusRef = useRef(null);
  const isAddingList = activeComposer?.type === "list";
  const selected = (() => {
    for (const list of lists) {
      const item = list.items.find((candidate) => candidate.id === selectedItemId);
      if (item) return { list, item };
    }
    return null;
  })();

  useEffect(() => {
    if (isAddingList) requestAnimationFrame(() => newListInputRef.current?.focus());
  }, [isAddingList]);

  async function submitList(event) {
    event.preventDefault();
    if (!newListName.trim() || saving) return;
    if (await createList(newListName)) {
      setNewListName("");
      setActiveComposer(null);
    }
  }

  function cancelNewList() {
    setNewListName("");
    setActiveComposer(null);
  }

  function openItem(itemId, element) {
    itemReturnFocusRef.current = element;
    setSelectedItemId(itemId);
  }

  async function toggleItem(item) {
    return updateItem(item.id, { completed: !item.completed });
  }

  const newListComposer = (
    <form className="my-list-new-composer" onSubmit={submitList}>
      <label>
        <span>List name</span>
        <input
          ref={newListInputRef}
          type="text"
          maxLength={60}
          value={newListName}
          placeholder="e.g. Personal"
          onChange={(event) => setNewListName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") cancelNewList();
          }}
        />
      </label>
      <div>
        <button type="submit" className="small-button" disabled={!newListName.trim() || saving}>Create</button>
        <button type="button" className="quiet-button" onClick={cancelNewList}>Cancel</button>
      </div>
    </form>
  );

  return (
    <div className="page my-lists-page">
      <header className="page-header my-lists-header">
        <div>
          <p className="eyebrow">My Lists</p>
          <h1>Keep it out of your head</h1>
          <p>Simple personal lists for anything that is not schoolwork.</p>
        </div>
        {lists.length > 0 && (
          <label className="my-lists-completed-toggle">
            <input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} />
            <span>Show completed</span>
          </label>
        )}
      </header>

      {error && (
        <div className="my-lists-sync-error" role="alert">
          <span>My Lists could not sync. Check your connection and try again.</span>
          <button type="button" className="quiet-button" onClick={() => refresh()}>Try again</button>
        </div>
      )}

      {loading ? (
        <section className="panel my-lists-loading" aria-busy="true">Loading your lists…</section>
      ) : lists.length === 0 ? (
        <section className="panel my-lists-empty">
          <span aria-hidden="true">☷</span>
          <h2>Create your first list</h2>
          <p>Start with Personal, Ideas, Things to buy, or anything else.</p>
          {isAddingList ? newListComposer : (
            <button type="button" className="primary-button" onClick={() => setActiveComposer({ type: "list" })}>
              Create first list
            </button>
          )}
        </section>
      ) : (
        <div className="my-lists-board" data-page-swipe-ignore="true" tabIndex={0} aria-label="My Lists board">
          {lists.map((list, index) => (
            <MyListColumn
              key={list.id}
              list={list}
              index={index}
              listCount={lists.length}
              subjects={subjects}
              showCompleted={showCompleted}
              saving={saving}
              activeComposer={activeComposer}
              onActivateComposer={setActiveComposer}
              onCloseComposer={() => setActiveComposer(null)}
              onRename={renameList}
              onChangeColour={changeListColour}
              onReorder={reorderList}
              onDelete={deleteList}
              onCreateItem={createItem}
              onOpenItem={openItem}
              onToggleItem={toggleItem}
            />
          ))}

          <section className="my-list-new-column">
            {isAddingList ? newListComposer : (
              <button type="button" onClick={() => setActiveComposer({ type: "list" })}>
                <span aria-hidden="true">+</span> New list
              </button>
            )}
          </section>
        </div>
      )}

      {selected && (
        <MyListItemModal
          key={selected.item.id}
          item={selected.item}
          currentListId={selected.list.id}
          lists={lists}
          subjects={subjects}
          saving={saving}
          onSave={updateItem}
          onDelete={deleteItem}
          onClose={() => setSelectedItemId(null)}
          returnFocusRef={itemReturnFocusRef}
        />
      )}
    </div>
  );
}
