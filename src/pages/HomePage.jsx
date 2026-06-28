import { useState } from "react";
import {
  getDaysLeft,
  formatDateKey,
  parseDateKey,
  getTaskCalendarEvents,
  getUrgencyLabel,
  getUrgencyClass,
  getEffortLabel,
  getEffortClass,
  getWidgetsForArea,
} from "../utils/appUtils.js";

function HomePage({
  tasks,
  subjects,
  activeTasks,
  completedTasks,
  noDeadlineTasks,
  hiddenBacklogCount,
  hoursAvailable,
  setHoursAvailable,
  startTime,
  setStartTime,
  progressPercentage,
  nextTask,
  generatePlan,
  setActivePage,
  homeLayout,
  widgetConfig,
  setWidgetConfig,
  homeEditMode,
  setHomeEditMode,
}) {
  const [showAddWidget, setShowAddWidget] = useState(false);
  const homeWidgets = getWidgetsForArea(widgetConfig, "home");
  const hiddenHomeWidgets = getWidgetsForArea(
    widgetConfig,
    "home",
    false
  ).filter((widget) => !widget.visible);

  function updateWidget(widgetId, updates) {
    setWidgetConfig((currentConfig) =>
      currentConfig.map((widget) =>
        widget.id === widgetId ? { ...widget, ...updates } : widget
      )
    );
  }

  function finishEditing() {
    setShowAddWidget(false);
    setHomeEditMode(false);
  }

  function renderWidgetControls(widget, supportsSize = false) {
    if (!homeEditMode) return null;

    return (
      <HomeWidgetControls
        widget={widget}
        supportsSize={supportsSize}
        onUpdate={updateWidget}
      />
    );
  }

  function renderHomeWidget(widget) {
    if (widget.type === "nextFocus") {
      return (
        <section
          className={`home-widget home-widget--focus home-widget--size-${widget.size} ${
            homeEditMode ? "home-widget--editing" : ""
          }`}
          key={widget.id}
        >
          {renderWidgetControls(widget)}
          <div className="home-widget-header">
            <h3>Next focus</h3>
          </div>

          {nextTask ? (
            <div className="focus-card">
              <p>{nextTask.subject}</p>
              <h3>{nextTask.title}</h3>
              <div className="focus-meta-row">
                <span>{getUrgencyLabel(getDaysLeft(nextTask.dueDate))}</span>
                <span
                  className={`effort-pill ${getEffortClass(nextTask.effort)}`}
                >
                  {getEffortLabel(nextTask.effort)} · {nextTask.effort}/5
                </span>
              </div>
            </div>
          ) : (
            <div className="empty-plan">
              <h3>No urgent task.</h3>
              <p>You’re clear for now.</p>
            </div>
          )}

          <button
            className="secondary-button"
            onClick={() => setActivePage("tasks")}
          >
            Open to-do list
          </button>
        </section>
      );
    }

    if (widget.type === "todayPlan") {
      return (
        <section
          className={`home-widget home-widget--setup home-widget--size-${widget.size} ${
            homeEditMode ? "home-widget--editing" : ""
          }`}
          key={widget.id}
        >
          {renderWidgetControls(widget)}
          <div className="home-widget-header">
            <h3>Today setup</h3>
          </div>

          <div className="setup-row">
            <label>
              <span>Hours available</span>
              <input
                type="number"
                min="0"
                max="12"
                value={hoursAvailable}
                onChange={(event) => setHoursAvailable(event.target.value)}
              />
            </label>

            <label>
              <span>Start time</span>
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </label>
          </div>

          <button className="primary-button" onClick={generatePlan}>
            Plan my day
          </button>
        </section>
      );
    }

    if (widget.type === "schoolCalendar") {
      return (
        <HomeCalendarWidget
          key={widget.id}
          tasks={tasks}
          subjects={subjects}
          size={widget.size}
          setActivePage={setActivePage}
          editMode={homeEditMode}
          widget={widget}
          onUpdateWidget={updateWidget}
        />
      );
    }

    if (widget.type === "progress" && widget.size === "expanded") {
      return (
        <section
          className={`home-widget home-widget--overview home-widget--size-expanded ${
            homeEditMode ? "home-widget--editing" : ""
          }`}
          key={widget.id}
        >
          {renderWidgetControls(widget, true)}
          <div className="home-widget-header">
            <h3>Overview</h3>
            <span>{progressPercentage}% complete</span>
          </div>

          <div className="progress-track overview-progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <div className="home-widget-stats">
            <HomeStatCard label="Active" value={activeTasks.length} />
            <HomeStatCard label="Completed" value={completedTasks.length} />
            <HomeStatCard label="No deadline" value={noDeadlineTasks.length} />
            <HomeStatCard
              label="Backlog"
              value={Math.max(hiddenBacklogCount, 0)}
            />
          </div>
        </section>
      );
    }

    if (widget.type === "progress") {
      return (
        <section
          className={`home-widget home-widget--summary home-widget--size-compact ${
            homeEditMode ? "home-widget--editing" : ""
          }`}
          key={widget.id}
        >
          {renderWidgetControls(widget, true)}
          <div className="home-widget-header progress-header">
            <h3>Progress</h3>
            <span>{progressPercentage}%</span>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <div className="home-task-summary">
            <span>
              <strong>{activeTasks.length}</strong> active
            </span>
            <span>
              <strong>{completedTasks.length}</strong> completed
            </span>
          </div>
        </section>
      );
    }

    return null;
  }

  return (
    <div
      className={`page home-layout-${homeLayout} ${
        homeEditMode ? "home-edit-mode" : ""
      }`}
    >
      <header className="page-header">
        <p className="eyebrow">Home</p>
        <h2>Your school day, organised.</h2>
        <p>
          See what matters, decide how much time you have, and generate a plan
          when you’re ready.
        </p>
      </header>

      {homeEditMode && (
        <section className="home-edit-bar" aria-label="Home edit mode">
          <div>
            <strong>Editing Home Page</strong>
            <p>Choose which blocks appear and how much detail they show.</p>
          </div>
          <div className="home-edit-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={hiddenHomeWidgets.length === 0}
              onClick={() => setShowAddWidget((currentValue) => !currentValue)}
            >
              Add widget
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={finishEditing}
            >
              Done
            </button>
          </div>
        </section>
      )}

      {homeEditMode && showAddWidget && hiddenHomeWidgets.length > 0 && (
        <section className="home-add-widget-panel" aria-label="Add Home widget">
          <div className="home-add-widget-heading">
            <div>
              <strong>Add a widget</strong>
              <p>Restore a hidden block to its saved position.</p>
            </div>
            <button
              type="button"
              aria-label="Close add widget panel"
              onClick={() => setShowAddWidget(false)}
            >
              ×
            </button>
          </div>
          <div className="home-add-widget-list">
            {hiddenHomeWidgets.map((widget) => (
              <button
                type="button"
                key={widget.id}
                onClick={() => updateWidget(widget.id, { visible: true })}
              >
                <span>
                  <strong>{widget.label}</strong>
                  <small>
                    {widget.size === "expanded" ? "Expanded" : "Compact"}
                  </small>
                </span>
                <span aria-hidden="true">+</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section
        className={`home-dashboard home-dashboard--${homeLayout}`}
        aria-label="Home dashboard"
      >
        <div
          className={`home-widget-grid home-widget-grid--count-${Math.min(
            homeWidgets.length,
            4
          )}`}
        >
          {homeWidgets.length > 0 ? (
            homeWidgets.map(renderHomeWidget)
          ) : (
            <section className="home-widget home-widget--empty">
              <div className="empty-plan">
                <h3>No Home widgets selected.</h3>
                <p>
                  {homeEditMode
                    ? "Use Add widget to restore a block."
                    : "Edit your Home Page from Appearance settings."}
                </p>
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

function HomeCalendarWidget({
  tasks,
  subjects,
  size,
  setActivePage,
  editMode,
  widget,
  onUpdateWidget,
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = formatDateKey(today);
  const upcomingEvents = getTaskCalendarEvents(tasks, subjects)
    .filter((event) => !event.completed && event.date >= todayKey)
    .sort(
      (first, second) =>
        first.date.localeCompare(second.date) ||
        first.title.localeCompare(second.title)
    );
  const previewDays = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const dateKey = formatDateKey(date);

    return {
      date,
      dateKey,
      count: upcomingEvents.filter((event) => event.date === dateKey).length,
    };
  });
  const openCalendar = () => setActivePage("calendar");

  return (
    <section
      className={`home-widget home-widget--calendar home-widget--size-${size} ${
        editMode ? "home-widget--editing" : ""
      }`}
    >
      {editMode && (
        <HomeWidgetControls
          widget={widget}
          supportsSize
          onUpdate={onUpdateWidget}
        />
      )}
      <div className="home-widget-header">
        <h3>School calendar</h3>
        <button className="home-calendar-action" onClick={openCalendar}>
          View calendar
        </button>
      </div>

      {upcomingEvents.length === 0 ? (
        <button className="home-calendar-empty" onClick={openCalendar}>
          No upcoming school deadlines.
        </button>
      ) : size === "compact" ? (
        <button
          className={`home-calendar-next ${
            upcomingEvents[0].subjectColour ? "has-subject-colour" : ""
          }`}
          data-source={upcomingEvents[0].source}
          style={
            upcomingEvents[0].subjectColour
              ? { "--subject-color": upcomingEvents[0].subjectColour }
              : undefined
          }
          onClick={openCalendar}
        >
          <span className="home-calendar-date">
            {parseDateKey(upcomingEvents[0].date).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
          <span className="home-calendar-task-copy">
            <strong>{upcomingEvents[0].title}</strong>
            <small>{upcomingEvents[0].subject}</small>
          </span>
          <span
            className={`urgency ${getUrgencyClass(
              getDaysLeft(upcomingEvents[0].date)
            )}`}
          >
            {getUrgencyLabel(getDaysLeft(upcomingEvents[0].date))}
          </span>
        </button>
      ) : (
        <>
          <div className="home-calendar-days" aria-label="Next two weeks">
            {previewDays.map(({ date, dateKey, count }) => (
              <button
                key={dateKey}
                className={count > 0 ? "has-deadline" : ""}
                aria-label={`${date.toLocaleDateString()}${
                  count ? `, ${count} deadline${count === 1 ? "" : "s"}` : ""
                }`}
                onClick={openCalendar}
              >
                <span>
                  {date.toLocaleDateString(undefined, { weekday: "narrow" })}
                </span>
                <strong>{date.getDate()}</strong>
                <i aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="home-calendar-deadlines">
            {upcomingEvents.slice(0, 2).map((event) => {
              const daysLeft = getDaysLeft(event.date);

              return (
                <button
                  key={event.id}
                  className={event.subjectColour ? "has-subject-colour" : ""}
                  data-source={event.source}
                  style={
                    event.subjectColour
                      ? { "--subject-color": event.subjectColour }
                      : undefined
                  }
                  onClick={openCalendar}
                >
                  <span className="home-calendar-task-copy">
                    <strong>{event.title}</strong>
                    <small>{event.subject}</small>
                  </span>
                  <span className={`urgency ${getUrgencyClass(daysLeft)}`}>
                    {getUrgencyLabel(daysLeft)}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function HomeWidgetControls({ widget, supportsSize, onUpdate }) {
  return (
    <div className="home-widget-edit-controls">
      {supportsSize && (
        <div
          className="home-widget-size-toggle"
          role="group"
          aria-label={`${widget.label} size`}
        >
          {["compact", "expanded"].map((size) => (
            <button
              type="button"
              key={size}
              className={widget.size === size ? "active" : ""}
              aria-pressed={widget.size === size}
              onClick={() => onUpdate(widget.id, { size })}
            >
              {size === "compact" ? "Compact" : "Expanded"}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="home-widget-hide-button"
        onClick={() => onUpdate(widget.id, { visible: false })}
      >
        Hide
      </button>
    </div>
  );
}

function HomeStatCard({ label, value }) {
  return (
    <div className="home-stat">
      <p>{label}</p>
      <h3>{value}</h3>
    </div>
  );
}

export default HomePage;
