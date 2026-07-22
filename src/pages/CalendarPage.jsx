import { useState } from "react";
import SubjectField from "../components/SubjectField.jsx";
import TaskClassificationFields from "../components/TaskClassificationFields.jsx";
import TaskSourceBadge from "../components/TaskSourceBadge.jsx";
import {
  getDaysLeft,
  formatDateKey,
  parseDateKey,
  getTaskCalendarEvents,
  getMonthCalendarDays,
  getUrgencyLabel,
  getUrgencyClass,
  getEffortClass,
  getTaskSignalBadges,
  updateTaskTitleWithDetection,
} from "../utils/appUtils.js";

const calendarDotLimit = 5;

const effortKeywordGroups = {
  high: [
    "test",
    "exam",
    "assessment",
    "essay",
    "project",
    "presentation",
    "lab report",
    "final",
    "draft",
    "research",
  ],
  medium: [
    "worksheet",
    "practice",
    "questions",
    "reading",
    "paragraph",
    "homework",
  ],
  low: ["vocab", "review", "watch", "check", "form", "short"],
};

const effortLabels = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function textIncludesKeyword(text, keyword) {
  return new RegExp(`\\b${keyword.replaceAll(" ", "\\s+")}\\b`, "i").test(text);
}

function getCalendarEffortLevel(task) {
  const numericEffort = Number(task.effort);

  if (Number.isFinite(numericEffort) && numericEffort > 0) {
    if (numericEffort <= 2) return "low";
    if (numericEffort >= 4) return "high";
    return "medium";
  }

  if (["urgent", "high"].includes(task.importance)) return "high";
  if (["assessment", "project"].includes(task.taskType)) return "high";
  if (task.taskType === "revision") return "medium";

  const searchText = [
    task.title,
    task.subject,
    task.taskType,
    task.importance,
    ...(Array.isArray(task.detectedTags) ? task.detectedTags : []),
  ]
    .filter(Boolean)
    .join(" ");

  if (
    effortKeywordGroups.high.some((keyword) =>
      textIncludesKeyword(searchText, keyword)
    )
  ) {
    return "high";
  }

  if (
    effortKeywordGroups.medium.some((keyword) =>
      textIncludesKeyword(searchText, keyword)
    )
  ) {
    return "medium";
  }

  if (
    effortKeywordGroups.low.some((keyword) =>
      textIncludesKeyword(searchText, keyword)
    )
  ) {
    return "low";
  }

  return "medium";
}

function getCalendarDotStyle(event, colourMode) {
  if (colourMode === "subject" && event.subjectColour) {
    return { "--calendar-dot-color": event.subjectColour };
  }

  return undefined;
}

function createCalendarTaskDraft(dueDate) {
  return {
    subject: "",
    title: "",
    dueDate,
    effort: 2,
    taskType: "homework",
    importance: "normal",
    detectedTags: [],
    importanceSource: "auto",
  };
}

function CalendarPage({ tasks, subjects, setActivePage, addTaskToList }) {
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(today));
  const [dotColourMode, setDotColourMode] = useState("subject");
  const [showCalendarTaskForm, setShowCalendarTaskForm] = useState(false);
  const [calendarTaskDraft, setCalendarTaskDraft] = useState(() =>
    createCalendarTaskDraft(formatDateKey(today))
  );
  const calendarEvents = getTaskCalendarEvents(tasks, subjects);
  const calendarDays = getMonthCalendarDays(visibleMonth);
  const selectedEvents = calendarEvents.filter(
    (event) => event.date === selectedDate
  );
  const selectedDateValue = parseDateKey(selectedDate);

  function changeMonth(offset) {
    const nextMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + offset,
      1
    );
    setVisibleMonth(nextMonth);
    setSelectedDate(formatDateKey(nextMonth));
  }

  function showToday() {
    const currentDate = new Date();
    setVisibleMonth(
      new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    );
    setSelectedDate(formatDateKey(currentDate));
  }

  function selectCalendarDay(day) {
    setSelectedDate(day.dateKey);

    if (showCalendarTaskForm) {
      setCalendarTaskDraft((currentDraft) => ({
        ...currentDraft,
        dueDate: day.dateKey,
      }));
    }

    if (!day.isCurrentMonth) {
      setVisibleMonth(
        new Date(day.date.getFullYear(), day.date.getMonth(), 1)
      );
    }
  }

  function openCalendarTaskForm() {
    setCalendarTaskDraft(createCalendarTaskDraft(selectedDate));
    setShowCalendarTaskForm(true);
  }

  function submitCalendarTask(event) {
    event.preventDefault();

    if (!addTaskToList(calendarTaskDraft)) return;

    const taskDate = parseDateKey(calendarTaskDraft.dueDate);
    setSelectedDate(calendarTaskDraft.dueDate);
    setVisibleMonth(
      new Date(taskDate.getFullYear(), taskDate.getMonth(), 1)
    );
    setShowCalendarTaskForm(false);
  }

  return (
    <div className="page calendar-page">
      <header className="page-header calendar-page-header">
        <div>
          <p className="eyebrow">Calendar</p>
          <h2>School calendar</h2>
          <p>Due dates from your tasks and Classroom imports.</p>
        </div>

        <div className="calendar-colour-toggle" aria-label="Calendar dot colour mode">
          <span>Colour by</span>
          <div>
            <button
              type="button"
              className={dotColourMode === "subject" ? "active" : ""}
              aria-pressed={dotColourMode === "subject"}
              onClick={() => setDotColourMode("subject")}
            >
              Subject
            </button>
            <button
              type="button"
              className={dotColourMode === "effort" ? "active" : ""}
              aria-pressed={dotColourMode === "effort"}
              onClick={() => setDotColourMode("effort")}
            >
              Effort
            </button>
          </div>
        </div>
      </header>

      <div className="calendar-layout">
        <section className="panel calendar-month-panel">
          <div className="calendar-toolbar">
            <div>
              <p className="section-label">Month</p>
              <h3>
                {visibleMonth.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </h3>
            </div>

            <div className="calendar-navigation" aria-label="Calendar navigation">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => changeMonth(-1)}
              >
                ←
              </button>
              <button type="button" onClick={showToday}>
                Today
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => changeMonth(1)}
              >
                →
              </button>
            </div>
          </div>

          <div className="calendar-weekdays" aria-hidden="true">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (weekday) => (
                <span key={weekday}>{weekday}</span>
              )
            )}
          </div>

          <div className="calendar-grid">
            {calendarDays.map((day) => {
              const dayEvents = calendarEvents.filter(
                (event) => event.date === day.dateKey
              );
              const activeDayEvents = dayEvents.filter(
                (event) => !event.completed
              );
              const visibleDots = activeDayEvents.slice(0, calendarDotLimit);
              const hiddenDotCount = Math.max(
                0,
                activeDayEvents.length - visibleDots.length
              );
              const isSelected = day.dateKey === selectedDate;

              return (
                <button
                  type="button"
                  key={day.dateKey}
                  className={`calendar-day ${
                    day.isCurrentMonth ? "" : "outside-month"
                  } ${day.isToday ? "today" : ""} ${
                    isSelected ? "selected" : ""
                  }`}
                  aria-pressed={isSelected}
                  aria-label={`${day.date.toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                  })}, ${activeDayEvents.length} active task${
                    activeDayEvents.length === 1 ? "" : "s"
                  } due`}
                  onClick={() => selectCalendarDay(day)}
                >
                  <span className="calendar-day-number">{day.date.getDate()}</span>

                  <span
                    className="calendar-task-dots"
                    aria-hidden="true"
                    data-colour-mode={dotColourMode}
                  >
                    {visibleDots.map((event) => {
                      const effortLevel = getCalendarEffortLevel(event);

                      return (
                        <span
                          key={event.id}
                          className={`calendar-task-dot calendar-dot-${dotColourMode} calendar-dot-effort-${effortLevel} ${
                            dotColourMode === "subject" && event.subjectColour
                              ? "has-subject-colour"
                              : ""
                          }`}
                          style={getCalendarDotStyle(event, dotColourMode)}
                          title={`${event.title} · ${
                            dotColourMode === "effort"
                              ? `${effortLabels[effortLevel]} effort`
                              : event.subject || "No subject"
                          }`}
                        />
                      );
                    })}
                    {hiddenDotCount > 0 && (
                      <small className="calendar-dot-overflow">
                        +{hiddenDotCount}
                      </small>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="panel calendar-detail-panel">
          <div className="calendar-detail-header">
            <div>
              <p className="section-label">Selected day</p>
              <h3>
                {selectedDateValue.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
            </div>
            <div className="calendar-detail-actions">
              <span>
                {selectedEvents.length} task
                {selectedEvents.length === 1 ? "" : "s"}
              </span>
              <button type="button" onClick={openCalendarTaskForm}>
                + Add task
              </button>
            </div>
          </div>

          {showCalendarTaskForm && (
            <form
              className="calendar-add-task-form"
              onSubmit={submitCalendarTask}
            >
              <div className="calendar-form-grid">
                <label>
                  <span>Subject</span>
                  <SubjectField
                    subjects={subjects}
                    value={calendarTaskDraft.subject}
                    placeholder="e.g. Chemistry"
                    onChange={(subject) =>
                      setCalendarTaskDraft({
                        ...calendarTaskDraft,
                        subject,
                      })
                    }
                  />
                </label>

                <label>
                  <span>Task title</span>
                  <input
                    type="text"
                    value={calendarTaskDraft.title}
                    placeholder="Assignment title"
                    required
                    onChange={(event) =>
                      setCalendarTaskDraft(
                        updateTaskTitleWithDetection(
                          calendarTaskDraft,
                          event.target.value
                        )
                      )
                    }
                  />
                </label>

                <label>
                  <span>Due date</span>
                  <input
                    type="date"
                    value={calendarTaskDraft.dueDate}
                    required
                    onChange={(event) =>
                      setCalendarTaskDraft({
                        ...calendarTaskDraft,
                        dueDate: event.target.value,
                      })
                    }
                  />
                </label>
              </div>

              <TaskClassificationFields
                task={calendarTaskDraft}
                onChange={setCalendarTaskDraft}
              />

              <div className="calendar-effort-row">
                <span>Effort</span>
                <div>
                  {[1, 2, 3, 4, 5].map((number) => (
                    <button
                      key={number}
                      type="button"
                      className={
                        calendarTaskDraft.effort === number
                          ? `effort-button selected ${getEffortClass(number)}`
                          : `effort-button ${getEffortClass(number)}`
                      }
                      onClick={() =>
                        setCalendarTaskDraft({
                          ...calendarTaskDraft,
                          effort: number,
                        })
                      }
                    >
                      {number}
                    </button>
                  ))}
                </div>
              </div>

              <div className="calendar-form-actions">
                <button className="primary-button" type="submit">
                  Add task
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setShowCalendarTaskForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {selectedEvents.length > 0 ? (
            <div className="calendar-task-list">
              {selectedEvents.map((event) => {
                const daysLeft = getDaysLeft(event.date);
                const signalBadges = getTaskSignalBadges(event);
                const effortLevel = getCalendarEffortLevel(event);
                const hasClassroomSource = [
                  "classroom",
                  "classroom-mock",
                ].includes(event.taskSource);

                return (
                  <button
                    type="button"
                    className={`calendar-task-item ${
                      event.completed ? "completed" : ""
                    } ${event.subjectColour ? "has-subject-colour" : ""}`}
                    data-source={event.source}
                    key={event.id}
                    style={
                      event.subjectColour
                        ? { "--subject-color": event.subjectColour }
                        : undefined
                    }
                    onClick={() => setActivePage("tasks")}
                  >
                    <span>
                      <small>{event.subject}</small>
                      <strong>{event.title}</strong>
                      {(signalBadges.length > 0 || hasClassroomSource) && (
                        <span className="task-signal-badges">
                          <TaskSourceBadge task={event} />
                          {signalBadges.map((badge) => (
                            <span
                              className={`task-signal-badge task-signal-${badge.tone}`}
                              key={`${badge.tone}-${badge.label}`}
                            >
                              {badge.label}
                            </span>
                          ))}
                        </span>
                      )}
                      <span className="calendar-effort-summary">
                        <span
                          className={`calendar-effort-chip calendar-effort-${effortLevel}`}
                        >
                          {effortLabels[effortLevel]} effort
                        </span>
                      </span>
                    </span>
                    <span
                      className={
                        event.completed
                          ? "calendar-task-status completed"
                          : `calendar-task-status urgency ${getUrgencyClass(
                              daysLeft
                            )}`
                      }
                    >
                      {event.completed ? "Completed" : getUrgencyLabel(daysLeft)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="calendar-empty-state">
              <h3>
                {calendarEvents.length === 0
                  ? "No due dates yet."
                  : "No school tasks due."}
              </h3>
              <p>
                {calendarEvents.length === 0
                  ? "Add a due date to see it here."
                  : "Pick another day or add a task."}
              </p>
            </div>
          )}

          <button
            type="button"
            className="secondary-button calendar-open-tasks"
            onClick={() => setActivePage("tasks")}
          >
            Open to-do list
          </button>
        </aside>
      </div>
    </div>
  );
}

export default CalendarPage;
