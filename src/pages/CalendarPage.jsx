import { useState } from "react";
import SubjectField from "../components/SubjectField.jsx";
import {
  getDaysLeft,
  formatDateKey,
  parseDateKey,
  getTaskCalendarEvents,
  getMonthCalendarDays,
  getUrgencyLabel,
  getUrgencyClass,
  getEffortClass,
} from "../utils/appUtils.js";

function CalendarPage({ tasks, subjects, setActivePage, addTaskToList }) {
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(today));
  const [showCalendarTaskForm, setShowCalendarTaskForm] = useState(false);
  const [calendarTaskDraft, setCalendarTaskDraft] = useState(() => ({
    subject: "",
    title: "",
    dueDate: formatDateKey(today),
    effort: 2,
  }));
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
    setCalendarTaskDraft({
      subject: "",
      title: "",
      dueDate: selectedDate,
      effort: 2,
    });
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
      <header className="page-header">
        <p className="eyebrow">Calendar</p>
        <h2>School calendar</h2>
        <p>Your local assignment deadlines, organised by due date.</p>
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
                  })}, ${dayEvents.length} task${
                    dayEvents.length === 1 ? "" : "s"
                  } due`}
                  onClick={() => selectCalendarDay(day)}
                >
                  <span className="calendar-day-number">{day.date.getDate()}</span>

                  <span className="calendar-day-events">
                    {dayEvents.slice(0, 2).map((event) => (
                      <span
                        className={`calendar-event-label ${
                          event.completed ? "completed" : ""
                        } ${event.subjectColour ? "has-subject-colour" : ""}`}
                        data-source={event.source}
                        key={event.id}
                        style={
                          event.subjectColour
                            ? { "--subject-color": event.subjectColour }
                            : undefined
                        }
                      >
                        <i aria-hidden="true" />
                        <em>{event.title}</em>
                      </span>
                    ))}
                    {dayEvents.length > 2 && (
                      <small>+{dayEvents.length - 2} more</small>
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
                      setCalendarTaskDraft({
                        ...calendarTaskDraft,
                        title: event.target.value,
                      })
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
              <h3>No school tasks due.</h3>
              <p>Select another day or add an assignment from the To-do page.</p>
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
