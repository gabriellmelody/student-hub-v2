import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DueDateField from "./DueDateField.jsx";
import SubjectField from "./SubjectField.jsx";
import TaskClassificationFields from "./TaskClassificationFields.jsx";
import TaskSourceBadge from "./TaskSourceBadge.jsx";
import {
  getEffortClass,
  getEffectiveTaskClassification,
  updateTaskTitleWithDetection,
} from "../utils/appUtils.js";
import {
  blockGuidedTourBackground,
  getFocusableTourElements,
  getTourFocusTrapTarget,
  restoreTourFocus,
} from "../utils/guidedTourUtils.js";

function createTaskDraft(task) {
  return {
    subject: task.subject || "",
    title: task.title || "",
    description: task.description || "",
    dueDate: task.dueDate || "",
    dueTime: task.dueTime || "",
    effort: Number(task.effort) || 2,
    taskType: task.taskType || "homework",
    importance: task.importance || "normal",
    detectedTags: Array.isArray(task.detectedTags) ? task.detectedTags : [],
    importanceSource: task.importanceSource || "auto",
  };
}

function getSourceLabel(task) {
  if (task.source === "classroom") return task.classroomCourseName || "Google Classroom";
  if (task.source === "classroom-mock") return "Sample Classroom";
  if (task.source === "demo") return "Demo workspace";
  return "Manual task";
}

export default function TaskDetailsModal({
  task,
  subjects,
  onSave,
  onToggle,
  onDelete,
  onClose,
  returnFocusRef,
}) {
  const [draftTask, setDraftTask] = useState(() => createTaskDraft(task));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef(null);
  const titleRef = useRef(null);
  const classroomLink =
    task.source === "classroom" && typeof task.alternateLink === "string"
      ? task.alternateLink.trim()
      : "";
  const classification = getEffectiveTaskClassification(draftTask);

  useLayoutEffect(() => {
    const returnFocusElement = returnFocusRef?.current;
    const restoreBackground = blockGuidedTourBackground(
      document.querySelector(".app-shell")
    );
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

  async function saveTask(event) {
    event.preventDefault();
    if (!draftTask.title.trim() || saving) return;

    setSaving(true);
    setError("");
    const saved = await onSave(task.id, draftTask);
    setSaving(false);
    if (!saved) {
      setError("This task could not be saved. Try again.");
      return;
    }
    onClose();
  }

  async function toggleTask() {
    if (saving) return;
    setSaving(true);
    const saved = await onToggle(task.id);
    setSaving(false);
    if (saved) onClose();
  }

  async function deleteTask() {
    if (saving || !window.confirm(`Delete “${task.title}”?`)) return;
    setSaving(true);
    const deleted = await onDelete(task.id);
    setSaving(false);
    if (deleted) onClose();
  }

  return createPortal(
    <div className="task-details-layer" role="presentation">
      <button
        className="task-details-backdrop"
        type="button"
        aria-label="Close task details"
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        className="task-details-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-details-title"
        aria-describedby="task-details-description"
        tabIndex={-1}
      >
        <form onSubmit={saveTask}>
          <header className="task-details-header">
            <div>
              <span className="eyebrow">Task details</span>
              <h2 id="task-details-title">Edit task</h2>
              <p id="task-details-description">
                Keep the details useful for planning and deadlines.
              </p>
            </div>
            <button
              type="button"
              className="task-details-close"
              aria-label="Close task details"
              onClick={onClose}
            >
              ×
            </button>
          </header>

          <div className="task-details-scroll">
            <label className="task-form-field task-details-title-field">
              <span>Task title</span>
              <input
                ref={titleRef}
                type="text"
                value={draftTask.title}
                required
                onChange={(event) =>
                  setDraftTask(
                    updateTaskTitleWithDetection(draftTask, event.target.value)
                  )
                }
              />
            </label>

            <label className="task-form-field">
              <span>Description (optional)</span>
              <textarea
                rows={5}
                value={draftTask.description}
                placeholder="Add details, instructions, or notes…"
                onChange={(event) =>
                  setDraftTask({ ...draftTask, description: event.target.value })
                }
              />
            </label>

            <div className="task-details-grid">
              <label className="task-form-field">
                <span>Subject</span>
                <SubjectField
                  subjects={subjects}
                  value={draftTask.subject}
                  onChange={(subject) => setDraftTask({ ...draftTask, subject })}
                />
              </label>

              <DueDateField
                value={draftTask.dueDate}
                onChange={(dueDate) => setDraftTask({ ...draftTask, dueDate })}
              />

              <label className="task-form-field">
                <span>Due time (optional)</span>
                <input
                  type="time"
                  value={draftTask.dueTime}
                  onChange={(event) =>
                    setDraftTask({ ...draftTask, dueTime: event.target.value })
                  }
                />
              </label>
            </div>

            <TaskClassificationFields task={draftTask} onChange={setDraftTask} />

            <div className="task-details-classification-note" role="status">
              <span>Academic classification</span>
              <strong>
                {classification.assessmentClassification === "formative"
                  ? "Formative"
                  : classification.assessmentClassification === "summative"
                    ? "Summative"
                    : "Not set"}
              </strong>
            </div>

            <fieldset className="task-details-effort">
              <legend>Effort</legend>
              <div className="effort-row">
                {[1, 2, 3, 4, 5].map((number) => (
                  <button
                    key={number}
                    type="button"
                    aria-pressed={Number(draftTask.effort) === number}
                    className={
                      Number(draftTask.effort) === number
                        ? `effort-button selected ${getEffortClass(number)}`
                        : `effort-button ${getEffortClass(number)}`
                    }
                    onClick={() => setDraftTask({ ...draftTask, effort: number })}
                  >
                    {number}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="task-details-source">
              <span>Source</span>
              <div>
                <strong>{getSourceLabel(task)}</strong>
                <TaskSourceBadge task={task} />
              </div>
              {task.source === "classroom" && task.classroomCourseName && (
                <small>{task.classroomCourseName}</small>
              )}
              {classroomLink && (
                <a href={classroomLink} target="_blank" rel="noopener noreferrer">
                  Open in Classroom ↗
                </a>
              )}
            </div>

            {error && <p className="task-details-error" role="alert">{error}</p>}
          </div>

          <footer className="task-details-actions">
            <button
              type="button"
              className="task-details-delete"
              onClick={deleteTask}
              disabled={saving}
            >
              Delete task
            </button>
            <div>
              <button
                type="button"
                className="secondary-button"
                onClick={toggleTask}
                disabled={saving}
              >
                {task.completed ? "Mark incomplete" : "Mark complete"}
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={saving || !draftTask.title.trim()}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
}
