import { useRef } from "react";
import { getDueDateShortcutValue } from "../utils/appUtils.js";
import { openDatePicker } from "../utils/datePickerUtils.js";

function DueDateField({ value, onChange, label = "Due date" }) {
  const inputRef = useRef(null);
  function setShortcut(shortcut) {
    onChange(getDueDateShortcutValue(shortcut));
  }

  return (
    <label className="task-form-field task-date-field">
      <span>{label}</span>
      <span className="task-date-input-wrap">
        <input
          ref={inputRef}
          type="date"
          value={value || ""}
          aria-describedby="task-date-picker-hint"
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="task-date-picker-affordance"
          aria-label="Open calendar picker"
          onClick={() => openDatePicker(inputRef.current)}
        >
          Calendar picker
        </button>
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
