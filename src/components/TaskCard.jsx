import { findSubjectProfile } from "../utils/appUtils.js";
import { getTaskAcademicLabel } from "../utils/taskBoardUtils.js";

function formatDueTime(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ""));
  if (!match) return "";

  const date = new Date(2000, 0, 1, Number(match[1]), Number(match[2]));
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function TaskCard({ task, subjects, onOpen, completed = false }) {
  const subjectProfile = findSubjectProfile(subjects, task.subject);
  const academicLabel = getTaskAcademicLabel(task);
  const dueTime = formatDueTime(task.dueTime);
  const subjectStyle = subjectProfile
    ? { "--subject-color": subjectProfile.colour }
    : undefined;

  return (
    <button
      className={`task-board-card${completed ? " completed" : ""}${
        subjectProfile ? " has-subject-colour" : ""
      }`}
      type="button"
      style={subjectStyle}
      onClick={(event) => onOpen(task.id, event.currentTarget)}
      aria-label={`Open task details for ${task.title}`}
      data-tour="todo-task-actions"
    >
      <span className="task-board-card-title">{task.title}</span>
      <span className="task-board-card-meta">
        <span className="task-board-card-subject">
          <span className="task-board-card-subject-dot" aria-hidden="true" />
          {task.subject || "No subject"}
        </span>
        {academicLabel && (
          <span className={`task-academic-chip task-academic-${academicLabel.toLowerCase()}`}>
            {academicLabel}
          </span>
        )}
      </span>
      {dueTime && <span className="task-board-card-time">Due {dueTime}</span>}
      {completed && <span className="task-board-card-completed">✓ Completed</span>}
    </button>
  );
}

export default TaskCard;
