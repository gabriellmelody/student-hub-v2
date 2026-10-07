import { useEffect, useRef, useState } from "react";
import MyListItemModal from "../components/MyListItemModal.jsx";

function AddCardForm({ list, saving, onCreate }) {
  const [open, setOpen] = useState(false);
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
      setOpen(false);
    }
  }

  if (!open) {
    return <button type="button" className="my-list-add-card" onClick={() => setOpen(true)}>+ Add card</button>;
  }

  return (
    <form className="my-list-inline-add" onSubmit={submit}>
      <label>
        <span className="sr-only">Card title for {list.name}</span>
        <input
          ref={inputRef}
          type="text"
          maxLength={200}
          value={title}
          placeholder="What do you want to remember?"
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") { setOpen(false); setTitle(""); }
          }}
        />
      </label>
      <div>
        <button type="submit" className="small-button" disabled={!title.trim() || saving}>Add</button>
        <button type="button" className="quiet-button" onClick={() => { setOpen(false); setTitle(""); }}>Cancel</button>
      </div>
    </form>
  );
}

function MyListColumn({
  list,
  index,
  listCount,
  showCompleted,
  saving,
  onRename,
  onReorder,
  onDelete,
  onCreateItem,
  onOpenItem,
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(list.name);
  const renameRef = useRef(null);
  const visibleItems = list.items.filter((item) => showCompleted || !item.completed);
  const openCount = list.items.filter((item) => !item.completed).length;

  useEffect(() => {
    if (renaming) requestAnimationFrame(() => renameRef.current?.select());
  }, [renaming]);

  async function submitRename(event) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    if (await onRename(list.id, name)) setRenaming(false);
  }

  function deleteList() {
    if (list.items.length > 0 && !window.confirm(
      `Delete “${list.name}” and its ${list.items.length} ${list.items.length === 1 ? "card" : "cards"}?`
    )) return;
    void onDelete(list.id);
  }

  return (
    <section className="my-list-column" aria-labelledby={`my-list-${list.id}`}>
      <header className="my-list-column-header">
        {renaming ? (
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
                  if (event.key === "Escape") { setName(list.name); setRenaming(false); }
                }}
              />
            </label>
            <button type="submit" aria-label="Save list name" disabled={!name.trim() || saving}>✓</button>
          </form>
        ) : (
          <div className="my-list-column-title">
            <h2 id={`my-list-${list.id}`}>{list.name}</h2>
            <span>{openCount}</span>
          </div>
        )}

        <details className="my-list-column-menu">
          <summary aria-label={`List options for ${list.name}`}>•••</summary>
          <div>
            <button type="button" onClick={() => { setName(list.name); setRenaming(true); }}>Rename</button>
            <button type="button" disabled={index === 0 || saving} onClick={() => onReorder(list.id, "left")}>Move left</button>
            <button type="button" disabled={index === listCount - 1 || saving} onClick={() => onReorder(list.id, "right")}>Move right</button>
            <button type="button" className="danger" onClick={deleteList}>Delete list</button>
          </div>
        </details>
      </header>

      <div className="my-list-cards">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`my-list-card${item.completed ? " completed" : ""}`}
            aria-label={`${item.title}${item.completed ? ", completed" : ""}`}
            onClick={(event) => onOpenItem(item.id, event.currentTarget)}
          >
            <strong>{item.title}</strong>
            {item.notes && <span>{item.notes.replace(/\s+/g, " ")}</span>}
            {item.completed && <small>✓ Completed</small>}
          </button>
        ))}
        {visibleItems.length === 0 && (
          <p className="my-list-column-empty">
            {list.items.length > 0 ? "No open cards." : "Nothing here yet."}
          </p>
        )}
      </div>

      <AddCardForm list={list} saving={saving} onCreate={onCreateItem} />
    </section>
  );
}

export default function MyListsPage({ workspace }) {
  const {
    lists, loading, saving, error, refresh,
    createList, renameList, reorderList, deleteList,
    createItem, updateItem, deleteItem,
  } = workspace;
  const [showCompleted, setShowCompleted] = useState(false);
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [selectedItemId, setSelectedItemId] = useState(null);
  const newListInputRef = useRef(null);
  const itemReturnFocusRef = useRef(null);
  const selected = (() => {
    for (const list of lists) {
      const item = list.items.find((candidate) => candidate.id === selectedItemId);
      if (item) return { list, item };
    }
    return null;
  })();

  useEffect(() => {
    if (addingList) requestAnimationFrame(() => newListInputRef.current?.focus());
  }, [addingList]);
  async function submitList(event) {
    event.preventDefault();
    if (!newListName.trim() || saving) return;
    if (await createList(newListName)) {
      setNewListName("");
      setAddingList(false);
    }
  }

  function openItem(itemId, element) {
    itemReturnFocusRef.current = element;
    setSelectedItemId(itemId);
  }

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
          {addingList ? (
            <form onSubmit={submitList}>
              <label>
                <span className="sr-only">List name</span>
                <input ref={newListInputRef} type="text" maxLength={60} value={newListName} placeholder="List name" onChange={(event) => setNewListName(event.target.value)} />
              </label>
              <button type="submit" className="primary-button" disabled={!newListName.trim() || saving}>Create list</button>
              <button type="button" className="secondary-button" onClick={() => setAddingList(false)}>Cancel</button>
            </form>
          ) : (
            <button type="button" className="primary-button" onClick={() => setAddingList(true)}>Create first list</button>
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
              showCompleted={showCompleted}
              saving={saving}
              onRename={renameList}
              onReorder={reorderList}
              onDelete={deleteList}
              onCreateItem={createItem}
              onOpenItem={openItem}
            />
          ))}

          <section className="my-list-new-column">
            {addingList ? (
              <form onSubmit={submitList}>
                <label>
                  <span className="sr-only">New list name</span>
                  <input
                    ref={newListInputRef}
                    type="text"
                    maxLength={60}
                    value={newListName}
                    placeholder="List name"
                    onChange={(event) => setNewListName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") { setAddingList(false); setNewListName(""); }
                    }}
                  />
                </label>
                <button type="submit" className="small-button" disabled={!newListName.trim() || saving}>Create</button>
                <button type="button" className="quiet-button" onClick={() => { setAddingList(false); setNewListName(""); }}>Cancel</button>
              </form>
            ) : (
              <button type="button" onClick={() => setAddingList(true)}>+ New list</button>
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
