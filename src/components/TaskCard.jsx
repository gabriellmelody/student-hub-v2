import { useState } from "react";
import SubjectField from "./SubjectField.jsx";
import {
  findSubjectProfile,
  getDaysLeft,
  getUrgencyLabel,
  getUrgencyClass,
  getEffortLabel,
  getEffortClass,
} from "../utils/appUtils.js";

function TaskCard({
  task,
  subjects,
  onToggle,
  onDelete,
  onUpdate,
  completed = false,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTask, setDraftTask] = useState({
    subject: task.subject,
    title: task.title,
    dueDate: task.dueDate,
    effort: task.effort,
  });

  function startEdit() {
    setDraftTask({
      subject: task.subject,
      title: task.title,
      dueDate: task.dueDate,
      effort: task.effort,
    });
    setIsEditing(true);
  }

  const daysLeft = getDaysLeft(task.dueDate);
  const urgencyClass = getUrgencyClass(daysLeft);
  const urgencyLabel = getUrgencyLabel(daysLeft);
  const effortClass = getEffortClass(task.effort);
  const effortLabel = getEffortLabel(task.effort);
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
    setDraftTask({
      subject: task.subject,
      title: task.title,
      dueDate: task.dueDate,
      effort: task.effort,
    });

    setIsEditing(false);
  }

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
              setDraftTask({ ...draftTask, title: event.target.value })
            }
            placeholder="Task title"
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
      <button className="task-main" onClick={() => onToggle(task.id)}>
        <span className={`check-circle ${completed ? "checked" : ""}`}>
          {completed ? "✓" : ""}
        </span>

        <div className="task-content">
          <div className="task-topline">
            <span className="task-subject-label">{task.subject}</span>
            <span className={`urgency ${urgencyClass}`}>{urgencyLabel}</span>
          </div>

          <h3>{task.title}</h3>

          <div className="task-meta">
            <span className={`effort-pill ${effortClass}`}>
              {effortLabel} · {task.effort}/5
            </span>
          </div>
        </div>
      </button>

      <div className="task-actions">
        <button
          className="edit-button"
          onClick={startEdit}
          aria-label={`Edit ${task.title}`}
        >
          Edit
        </button>

        <button
          className="delete-button"
          onClick={() => onDelete(task.id)}
          aria-label={`Delete ${task.title}`}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default TaskCard;
