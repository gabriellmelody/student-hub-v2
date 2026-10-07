import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  blockGuidedTourBackground,
  getFocusableTourElements,
  getTourFocusTrapTarget,
  restoreTourFocus,
} from "../utils/guidedTourUtils.js";

export default function MyListItemModal({
  item,
  currentListId,
  lists,
  saving,
  onSave,
  onDelete,
  onClose,
  returnFocusRef,
}) {
  const [draft, setDraft] = useState({
    title: item.title,
    notes: item.notes || "",
    listId: currentListId,
    completed: item.completed === true,
  });
  const [error, setError] = useState("");
  const dialogRef = useRef(null);
  const titleRef = useRef(null);

  useLayoutEffect(() => {
    const returnFocusElement = returnFocusRef?.current;
    const restoreBackground = blockGuidedTourBackground(document.querySelector(".app-shell"));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => titleRef.current?.focus());

    function keepFocusInside(event) {
      if (dialogRef.current?.contains(event.target)) return;
      titleRef.current?.focus();
    }

    document.addEventListener("focusin", keepFocusInside);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("focusin", keepFocusInside);
      document.body.style.overflow = previousOverflow;
      restoreBackground();
      requestAnimationFrame(() => restoreTourFocus(returnFocusElement));
    };
  }, [returnFocusRef]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusableElements = getFocusableTourElements(dialogRef.current);
      const focusTarget = getTourFocusTrapTarget({
        focusableElements,
        activeElement: document.activeElement,
        shiftKey: event.shiftKey,
        focusIsInside: dialogRef.current?.contains(document.activeElement),
      });
      if (!focusTarget) return;
      event.preventDefault();
      focusTarget.focus();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function saveItem(event) {
    event.preventDefault();
    if (!draft.title.trim() || saving) return;
    setError("");
    const saved = await onSave(item.id, draft);
    if (saved) onClose();
    else setError("This card could not be saved. Try again.");
  }

  async function toggleCompleted() {
    if (saving) return;
    setError("");
    const saved = await onSave(item.id, { ...draft, completed: !draft.completed });
    if (saved) onClose();
    else setError("This card could not be updated. Try again.");
  }

  async function deleteItem() {
    if (saving || !window.confirm(`Delete “${item.title}”?`)) return;
    setError("");
    const deleted = await onDelete(item.id);
    if (deleted) onClose();
    else setError("This card could not be deleted. Try again.");
  }

  return createPortal(
    <div className="my-list-modal-layer" role="presentation">
      <button
        type="button"
        className="my-list-modal-backdrop"
        aria-label="Close card details"
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        className="my-list-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-list-card-title"
        aria-describedby="my-list-card-description"
      >
        <form onSubmit={saveItem}>
          <header className="my-list-modal-header">
            <div>
              <p className="eyebrow">My Lists</p>
              <h2 id="my-list-card-title">Card details</h2>
              <p id="my-list-card-description">Keep it simple. Add only what helps you remember.</p>
            </div>
            <button type="button" aria-label="Close card details" onClick={onClose}>×</button>
          </header>

          <div className="my-list-modal-body">
            <label>
              <span>Title</span>
              <input
                ref={titleRef}
                type="text"
                maxLength={200}
                required
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
            </label>
            <label>
              <span>Notes (optional)</span>
              <textarea
                rows={6}
                maxLength={5000}
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              />
            </label>
            <label>
              <span>Move to</span>
              <select
                value={draft.listId}
                onChange={(event) => setDraft({ ...draft, listId: event.target.value })}
              >
                {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
              </select>
            </label>
            <p className="my-list-card-state" role="status">
              Status: <strong>{draft.completed ? "Completed" : "Open"}</strong>
            </p>
            {error && <p className="my-list-modal-error" role="alert">{error}</p>}
          </div>

          <footer className="my-list-modal-actions">
            <button type="button" className="my-list-delete-action" onClick={deleteItem} disabled={saving}>
              Delete
            </button>
            <div>
              <button type="button" className="secondary-button" onClick={toggleCompleted} disabled={saving}>
                {draft.completed ? "Reopen" : "Complete"}
              </button>
              <button type="submit" className="primary-button" disabled={saving || !draft.title.trim()}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
}
