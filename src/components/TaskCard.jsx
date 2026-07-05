import { useState } from "react";
import SubjectField from "./SubjectField.jsx";
import TaskClassificationFields from "./TaskClassificationFields.jsx";
import TaskSourceBadge from "./TaskSourceBadge.jsx";
import {
  findSubjectProfile,
  getDaysLeft,
  getUrgencyLabel,
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
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTask, setDraftTask] = useState(() => createTaskDraft(task));

  function startEdit() {
    setDraftTask(createTaskDraft(task));
    setIsEditing(true);
  }

  const daysLeft = getDaysLeft(task.dueDate);
  const urgencyClass = getUrgencyClass(daysLeft);
  const urgencyLabel = getUrgencyLabel(daysLeft);
  const effortClass = getEffortClass(task.effort);
  const effortLabel = getEffortLabel(task.effort);
  const signalBadges = getTaskSignalBadges(task);
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
