import {
  applyTaskImportanceDetection,
  taskImportanceOptions,
  taskTypeOptions,
} from "../utils/appUtils.js";

function TaskClassificationFields({ task, onChange }) {
  const detectionLabel =
    task.importanceSource === "manual"
      ? "Manual choice"
      : task.detectedTags?.length > 0
        ? `Detected: ${task.detectedTags.join(", ")}`
        : "Automatic";

  function setManualField(field, value) {
    onChange({
      ...task,
      [field]: value,
      importanceSource: "manual",
    });
  }

  function useAutomaticDetection() {
    const automaticTask = { ...task, importanceSource: "auto" };

    onChange({
      ...automaticTask,
      ...applyTaskImportanceDetection(automaticTask),
    });
  }

  return (
    <div className="task-classification-fields">
      <label>
        <span>Task type</span>
        <select
          value={task.taskType}
          onChange={(event) => setManualField("taskType", event.target.value)}
        >
          {taskTypeOptions.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Importance</span>
        <select
          value={task.importance}
          onChange={(event) =>
            setManualField("importance", event.target.value)
          }
        >
          {taskImportanceOptions.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="task-detection-status">
        <span>{detectionLabel}</span>
        {task.importanceSource === "manual" && (
          <button type="button" onClick={useAutomaticDetection}>
            Use automatic
          </button>
        )}
      </div>
    </div>
  );
}

export default TaskClassificationFields;
