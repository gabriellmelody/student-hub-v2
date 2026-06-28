import { useEffect, useState } from "react";
import {
  getDaysLeft,
  formatDateKey,
  getUrgencyLabel,
  getUrgencyClass,
} from "../utils/appUtils.js";

function NavButton({ label, icon, active, onClick }) {
  return (
    <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
    </button>
  );
}

function RightRail({
  tasks,
  planBlocks,
  setActivePage,
  collapsed,
  setCollapsed,
  enabledWidgets,
}) {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  const datedTasks = tasks
    .filter((task) => !task.completed && task.dueDate)
    .sort(
      (firstTask, secondTask) =>
        firstTask.dueDate.localeCompare(secondTask.dueDate) ||
        secondTask.effort - firstTask.effort
    );
  const upcomingDeadlines = datedTasks.slice(0, 3);
  const planPreview = planBlocks
    .filter((block) => block.type === "study")
    .slice(0, 2);
  const schoolDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    const dateKey = formatDateKey(date);

    return {
      dateKey,
      dayLabel: date.toLocaleDateString(undefined, { weekday: "short" }),
      dateLabel: date.getDate(),
      deadlineCount: datedTasks.filter((task) => task.dueDate === dateKey)
        .length,
      isToday: index === 0,
    };
  });
  const hasSelectedWidgets = enabledWidgets.length > 0;

  return (
    <aside
      className={`right-rail ${collapsed ? "collapsed" : ""}`}
      aria-label="School widgets"
    >
      <div className="right-rail-toolbar">
        <div className="right-rail-heading">
          <p className="eyebrow">School widgets</p>
          <h2>At a glance</h2>
        </div>
        <button
          type="button"
          className="right-rail-collapse-button"
          aria-label={collapsed ? "Expand right rail" : "Collapse right rail"}
          onClick={() => setCollapsed(!collapsed)}
        >
          →
        </button>
      </div>

      <div className="right-rail-content">
        {!hasSelectedWidgets && (
          <div className="right-rail-empty">
            <strong>No widgets selected.</strong>
            <p>Choose widgets in Appearance settings.</p>
          </div>
        )}

        {enabledWidgets.includes("clock") && (
          <section className="right-rail-widget right-rail-widget--clock">
            <div className="rail-widget-header">
              <h3>Clock</h3>
              <span>Device time</span>
            </div>
            <time dateTime={currentTime.toISOString()}>
              <strong>
                {currentTime.toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </strong>
              <span>
                {currentTime.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </time>
          </section>
        )}

        {enabledWidgets.includes("calendar") && (
          <section className="right-rail-widget right-rail-widget--calendar">
            <div className="rail-widget-header">
              <button
                type="button"
                className="rail-widget-title-button"
                onClick={() => setActivePage("calendar")}
              >
                School calendar
              </button>
              <span>Next 7 days</span>
            </div>

            <div className="school-week" aria-label="Upcoming school deadlines">
              {schoolDays.map((day) => (
                <button
                  type="button"
                  key={day.dateKey}
                  className={`school-day ${day.isToday ? "today" : ""} ${
                    day.deadlineCount > 0 ? "has-deadline" : ""
                  }`}
                  onClick={() => setActivePage("calendar")}
                  title={
                    day.deadlineCount > 0
                      ? `${day.deadlineCount} task${
                          day.deadlineCount === 1 ? "" : "s"
                        } due`
                      : "No school tasks due"
                  }
                >
                  <span>{day.dayLabel}</span>
                  <strong>{day.dateLabel}</strong>
                  <i aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        )}

        {enabledWidgets.includes("deadlines") && (
          <section className="right-rail-widget right-rail-widget--deadlines">
            <div className="rail-widget-header">
              <h3>Upcoming deadlines</h3>
              <button type="button" onClick={() => setActivePage("tasks")}>
                View tasks
              </button>
            </div>

            {upcomingDeadlines.length > 0 ? (
              <div className="rail-deadline-list">
                {upcomingDeadlines.map((task) => {
                  const daysLeft = getDaysLeft(task.dueDate);

                  return (
                    <button
                      type="button"
                      className="rail-deadline"
                      key={task.id}
                      onClick={() => setActivePage("tasks")}
                    >
                      <span>
                        <small>{task.subject}</small>
                        <strong>{task.title}</strong>
                      </span>
                      <span className={`urgency ${getUrgencyClass(daysLeft)}`}>
                        {getUrgencyLabel(daysLeft)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rail-empty">No upcoming school deadlines.</p>
            )}
          </section>
        )}

        {enabledWidgets.includes("plan") && (
          <section className="right-rail-widget right-rail-widget--plan">
            <div className="rail-widget-header">
              <h3>Today’s plan</h3>
              <button type="button" onClick={() => setActivePage("plan")}>
                Open plan
              </button>
            </div>

            {planPreview.length > 0 ? (
              <div className="rail-plan-list">
                {planPreview.map((block) => (
                  <div className="rail-plan-item" key={block.taskId}>
                    <span>{block.start}</span>
                    <strong>{block.title}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rail-plan-empty">
                <p>No study plan yet.</p>
                <button type="button" onClick={() => setActivePage("plan")}>
                  Go to Today’s plan
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </aside>
  );
}

export { NavButton, RightRail };
