import {
  getDaysLeft,
  formatDateKey,
  parseDateKey,
  getTaskCalendarEvents,
  getUrgencyLabel,
  getUrgencyClass,
  getEffortLabel,
  getEffortClass,
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
}) {
  return (
    <div className={`page home-layout-${homeLayout}`}>
      <header className="page-header">
        <p className="eyebrow">Home</p>
        <h2>Your school day, organised.</h2>
        <p>
          See what matters, decide how much time you have, and generate a plan
          when you’re ready.
        </p>
      </header>

      <section
        className={`home-dashboard home-dashboard--${homeLayout}`}
        aria-label="Home dashboard"
      >
        <div className="home-widget-grid">
          <section className="home-widget home-widget--focus">
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

          <section className="home-widget home-widget--setup">
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

          <HomeCalendarWidget
            tasks={tasks}
            subjects={subjects}
            homeLayout={homeLayout}
            setActivePage={setActivePage}
          />

          {homeLayout === "dashboard" && (
            <section className="home-widget home-widget--overview">
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
          )}

          {homeLayout === "focused" && (
            <section className="home-widget home-widget--summary">
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
          )}
        </div>
      </section>
    </div>
  );
}

function HomeCalendarWidget({ tasks, subjects, homeLayout, setActivePage }) {
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
    <section className="home-widget home-widget--calendar">
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
      ) : homeLayout === "focused" ? (
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

function HomeStatCard({ label, value }) {
  return (
    <div className="home-stat">
      <p>{label}</p>
      <h3>{value}</h3>
    </div>
  );
}

export default HomePage;
