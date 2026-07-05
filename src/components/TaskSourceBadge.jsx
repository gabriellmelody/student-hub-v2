function getTaskSourceLabel(task) {
  const source = task?.taskSource || task?.source;

  if (source === "classroom-mock") return "Sample Classroom";
  if (source === "classroom") return "Classroom";

  return "";
}

function TaskSourceBadge({ task }) {
  const label = getTaskSourceLabel(task);

  if (!label) return null;

  return (
    <span className="task-signal-badge task-source-badge">{label}</span>
  );
}

export default TaskSourceBadge;
