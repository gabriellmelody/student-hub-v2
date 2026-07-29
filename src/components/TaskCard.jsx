import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SubjectField from "./SubjectField.jsx";
import TaskClassificationFields from "./TaskClassificationFields.jsx";
import TaskSourceBadge from "./TaskSourceBadge.jsx";
import {
  findSubjectProfile,
  getDaysLeft,
  getUrgencyClass,
  getEffortLabel,
  getEffortClass,
  getTaskSignalBadges,
  updateTaskTitleWithDetection,
} from "../utils/appUtils.js";

function createTaskDraft(task) {
  return {
    subject: task.subject,
    title: task.title,
    dueDate: task.dueDate,
    effort: task.effort,
    taskType: task.taskType,
    importance: task.importance,
    detectedTags: task.detectedTags,
    importanceSource: task.importanceSource,
  };
}

function TaskCard({
  task,
  subjects,
  onToggle,
  onDelete,
  onUpdate,
  completed = false,
  openMenuTaskId = null,
  setOpenMenuTaskId,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const [draftTask, setDraftTask] = useState(() => createTaskDraft(task));
  const optionsRef = useRef(null);
  const menuRef = useRef(null);
  const optionsButtonRef = useRef(null);
  const showOptions = openMenuTaskId === task.id;

  function startEdit() {
    setDraftTask(createTaskDraft(task));
    setIsEditing(true);
    setOpenMenuTaskId?.(null);
  }

  const daysLeft = getDaysLeft(task.dueDate);
  const urgencyClass = getUrgencyClass(daysLeft);
  const effortClass = getEffortClass(task.effort);
  const effortLabel = getEffortLabel(task.effort);
  const signalBadges = getTaskSignalBadges(task);
  const dueLabel = completed ? "Completed" : getTaskDueLabel(daysLeft);
  const subjectProfile = findSubjectProfile(subjects, task.subject);
  const subjectStyle = subjectProfile
    ? { "--subject-color": subjectProfile.colour }
    : undefined;

  function saveEdit(event) {
    event.preventDefault();

    if (!draftTask.subject.trim() || !draftTask.title.trim()) {
      return;
    }

    onUpdate(task.id, draftTask);
    setIsEditing(false);
  }

  function cancelEdit() {
    setDraftTask(createTaskDraft(task));

    setIsEditing(false);
  }

  function confirmDelete() {
    setOpenMenuTaskId?.(null);

    if (window.confirm(`Delete “${task.title}”?`)) {
      onDelete(task.id);
    }
  }

  function updateMenuPosition() {
    const button = optionsButtonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const menuWidth = 144;
    const menuHeight = 88;
    const safeGap = 8;
    const left = Math.min(
      Math.max(safeGap, rect.right - menuWidth),
      window.innerWidth - menuWidth - safeGap
    );
    const preferredTop = rect.bottom + 6;
    const top =
      preferredTop + menuHeight > window.innerHeight - safeGap
        ? Math.max(safeGap, rect.top - menuHeight - 6)
        : preferredTop;

    setMenuPosition({ left, top });
  }

  useEffect(() => {
    if (!showOptions) return undefined;

    updateMenuPosition();

    function closeOptions(event) {
      if (
        !optionsRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        setOpenMenuTaskId?.(null);
      }
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") setOpenMenuTaskId?.(null);
    }

    document.addEventListener("mousedown", closeOptions);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      document.removeEventListener("mousedown", closeOptions);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [showOptions, setOpenMenuTaskId]);

  if (isEditing) {
    return (
      <div className={`task-card editing ${completed ? "completed" : ""}`}>
        <form className="edit-task-form" onSubmit={saveEdit}>
          <SubjectField
            subjects={subjects}
            value={draftTask.subject}
            onChange={(subject) =>
              setDraftTask({ ...draftTask, subject })
            }
            placeholder="Subject"
          />

          <input
            type="text"
            value={draftTask.title}
            onChange={(event) =>
              setDraftTask(
                updateTaskTitleWithDetection(
                  draftTask,
                  event.target.value
                )
              )
            }
            placeholder="Task title"
          />

          <TaskClassificationFields
            task={draftTask}
            onChange={setDraftTask}
          />

          <input
            type="date"
            value={draftTask.dueDate}
            onChange={(event) =>
              setDraftTask({ ...draftTask, dueDate: event.target.value })
            }
          />

          <div className="effort-row edit-effort-row">
            <span>Effort</span>

            {[1, 2, 3, 4, 5].map((number) => (
              <button
                key={number}
                type="button"
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

          <div className="edit-form-actions">
            <button className="save-edit-button" type="submit">
              Save
            </button>

            <button
              className="cancel-edit-button"
              type="button"
              onClick={cancelEdit}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
      <div
        className={`task-card ${completed ? "completed" : ""} ${
          subjectProfile ? "has-subject-colour" : ""
        }`}
        style={subjectStyle}
      >
      <div className="task-row">
        <button
          className={`check-circle ${completed ? "checked" : ""}`}
          type="button"
          aria-label={`${completed ? "Mark incomplete" : "Mark complete"}: ${
            task.title
          }`}
          onClick={() => onToggle(task.id)}
        >
          {completed ? "✓" : ""}
        </button>

        <div className="task-content">
          <h3>{task.title}</h3>

          <div className="task-topline">
            <span className="task-subject-label">{task.subject}</span>
          </div>

          <div className="task-meta">
            <span className={`effort-pill ${effortClass}`}>
              {effortLabel}
            </span>
            <TaskSourceBadge task={task} />
            {signalBadges.map((badge) => (
              <span
                className={`task-signal-badge task-signal-${badge.tone}`}
                key={`${badge.tone}-${badge.label}`}
              >
                {badge.label}
              </span>
            ))}
          </div>
        </div>

        <div className="task-row-end">
          <span className={`task-due-pill urgency ${completed ? "neutral" : urgencyClass}`}>
            {dueLabel}
          </span>

          <div className="task-options" ref={optionsRef}>
            <button
              ref={optionsButtonRef}
              className="task-options-button"
              type="button"
              aria-label={`Task options for ${task.title}`}
              aria-haspopup="menu"
              aria-expanded={showOptions}
              onClick={(event) => {
                event.stopPropagation();
                updateMenuPosition();
                setOpenMenuTaskId?.(showOptions ? null : task.id);
              }}
            >
              ⋯
            </button>

            {showOptions &&
              createPortal(
                <div
                  className="task-options-menu"
                  ref={menuRef}
                  role="menu"
                  style={menuPosition || { visibility: "hidden" }}
                >
                  <button type="button" role="menuitem" onClick={startEdit}>
                    Edit
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="danger"
                    onClick={confirmDelete}
                  >
                    Delete
                  </button>
                </div>,
                document.body
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getTaskDueLabel(daysLeft) {
  if (daysLeft === null) return "No deadline";
  if (daysLeft < 0) {
    const overdueDays = Math.abs(daysLeft);
    return `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`;
  }
  if (daysLeft === 0) return "Due today";
  if (daysLeft === 1) return "Due tomorrow";
  return `${daysLeft} days left`;
}

export default TaskCard;
