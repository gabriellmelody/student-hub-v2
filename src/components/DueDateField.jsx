import { getDueDateShortcutValue } from "../utils/appUtils.js";

function DueDateField({ value, onChange, label = "Due date" }) {
  function setShortcut(shortcut) {
    onChange(getDueDateShortcutValue(shortcut));
  }

  return (
    <label className="task-form-field task-date-field">
      <span>{label}</span>
      <span className="task-date-input-wrap">
        <input
          type="date"
          value={value || ""}
          aria-describedby="task-date-picker-hint"
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="task-date-picker-affordance" aria-hidden="true">
          Calendar picker
        </span>
      </span>
      <span className="task-date-shortcuts" aria-label="Due date shortcuts">
        <button type="button" onClick={() => setShortcut("today")}>
          Today
        </button>
        <button type="button" onClick={() => setShortcut("tomorrow")}>
          Tomorrow
        </button>
        <button type="button" onClick={() => setShortcut("clear")}>
          Clear
        </button>
      </span>
      <span className="task-date-picker-hint" id="task-date-picker-hint">
        Choose from the calendar or type a date.
      </span>
    </label>
  );
}

export default DueDateField;
