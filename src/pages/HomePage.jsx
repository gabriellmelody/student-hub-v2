import {
  getDaysLeft,
  formatDateKey,
  parseDateKey,
  getUrgencyLabel,
  getUrgencyClass,
  getEffortLabel,
  getEffortClass,
  getTaskSignalBadges,
} from "../utils/appUtils.js";
import TaskSourceBadge from "../components/TaskSourceBadge.jsx";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function HomePage({
  tasks,
  nextTask,
  openEveningPlanner,
  hasPlan,
  planBlocks = [],
  setActivePage,
}) {
  const today = getStartOfDay(new Date());
  const todayKey = formatDateKey(today);
  const weekStart = getMonday(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const dateKey = formatDateKey(date);
    const dueTasks = tasks.filter(
      (task) => !task.completed && task.dueDate === dateKey
    );

    return {
      date,
      dateKey,
      label: WEEKDAY_LABELS[index],
      count: dueTasks.length,
      isToday: dateKey === todayKey,
    };
  });

  const weeklyTasks = tasks.filter((task) => {
    if (!task.dueDate) return false;

    const dueDate = parseTaskDate(task.dueDate);
    if (!dueDate) return false;

    return dueDate >= weekStart && dueDate <= weekEnd;
  });
  const weeklyCompleted = weeklyTasks.filter((task) => task.completed).length;
  const weeklyTotal = weeklyTasks.length;
  const weeklyLeft = Math.max(weeklyTotal - weeklyCompleted, 0);
  const weeklyProgress =
    weeklyTotal === 0 ? 0 : Math.round((weeklyCompleted / weeklyTotal) * 100);
  const earlierOverdueCount = tasks.filter((task) => {
    if (task.completed || !task.dueDate) return false;

    const dueDate = parseTaskDate(task.dueDate);
    return dueDate && dueDate < weekStart;
  }).length;

  const nextPlanBlock = planBlocks.find(
    (block) => !block.completed && block.type === "study"
  );
  const nextOpenBlock =
    nextPlanBlock ||
    planBlocks.find(
      (block) => !block.completed && block.type !== "message"
    );
  const planRepeatsNextTask =
    Boolean(nextTask?.id) &&
    Boolean(nextOpenBlock?.taskId) &&
    nextOpenBlock.taskId === nextTask.id;

  const upcomingTasks = [...tasks]
    .filter((task) => {
      const dueDate = parseTaskDate(task.dueDate);
      return !task.completed && dueDate && dueDate >= today;
    })
    .sort(
      (first, second) =>
        first.dueDate.localeCompare(second.dueDate) ||
        first.title.localeCompare(second.title)
    )
    .slice(0, 3);
  const glowSurfaceProps = {
    onPointerEnter: handleHomeGlowPointerEnter,
    onPointerMove: handleHomeGlowPointerMove,
    onPointerLeave: handleHomeGlowPointerLeave,
  };

  return (
    <div className="page home-fixed-dashboard">
      <header className="page-header">
        <h2>Your school day</h2>
      </header>

      <section
        className="home-hero-dashboard home-glow-surface"
        aria-label="Student Hub overview"
        {...glowSurfaceProps}
      >
        <div className="home-hero-zone home-next-zone">
          <p className="home-zone-label">Next up</p>
          {nextTask ? (
            <>
              <div className="home-next-task">
                <p>{nextTask.subject}</p>
                <h3>{nextTask.title}</h3>
                <div className="home-task-meta-row">
                  <span className={`urgency ${getUrgencyClass(getDaysLeft(nextTask.dueDate))}`}>
                    {getUrgencyLabel(getDaysLeft(nextTask.dueDate))}
                  </span>
                  {nextTask.effort && (
                    <span className={`effort-pill ${getEffortClass(nextTask.effort)}`}>
                      {getEffortLabel(nextTask.effort)}
                    </span>
                  )}
                </div>
                <TaskSignalRow task={nextTask} />
              </div>
              <button
                type="button"
                className="secondary-button home-quiet-action"
                onClick={() => setActivePage("tasks")}
              >
                Open to-do list
              </button>
            </>
          ) : (
            <div className="home-empty-copy">
              <h3>No active tasks.</h3>
              <p>Add tasks when school work comes in.</p>
              <button
                type="button"
                className="secondary-button home-quiet-action"
                onClick={() => setActivePage("tasks")}
              >
                Open to-do list
              </button>
            </div>
          )}
        </div>

        <div className="home-progress-zone">
          <WeeklyProgressArc
            completed={weeklyCompleted}
            left={weeklyLeft}
            overdueEarlier={earlierOverdueCount}
            progress={weeklyProgress}
            total={weeklyTotal}
          />
        </div>

        <div className="home-hero-zone home-plan-zone">
          <p className="home-zone-label">Today’s Plan</p>
          {hasPlan ? (
            <>
              {nextOpenBlock ? (
                <div className="home-plan-preview">
                  <span>{formatPlanBlockTime(nextOpenBlock)}</span>
                  {planRepeatsNextTask ? (
                    <>
                      <h3>Next study block</h3>
                      <p>Continue where you left off.</p>
                    </>
                  ) : (
                    <>
                      <h3>{nextOpenBlock.title}</h3>
                      {nextOpenBlock.subject && <p>{nextOpenBlock.subject}</p>}
                    </>
                  )}
                </div>
              ) : (
                <div className="home-plan-preview">
                  <span>Done</span>
                  <h3>Plan complete</h3>
                  <p>Nice work. You can still review or adjust it.</p>
                </div>
              )}
              <button
                type="button"
                className="primary-button home-plan-action"
                onClick={() => setActivePage("plan")}
              >
                Continue plan
              </button>
            </>
          ) : (
            <div className="home-empty-copy">
              <h3>No plan yet.</h3>
              <p>Create a realistic plan from your active tasks.</p>
              <button
                type="button"
                className="primary-button home-plan-action"
                onClick={openEveningPlanner}
              >
                Create plan
              </button>
            </div>
          )}
        </div>
      </section>

      <section
        className="home-week-strip-panel home-glow-surface"
        aria-label="This week"
        {...glowSurfaceProps}
      >
        <div className="home-section-heading">
          <div>
            <p className="home-zone-label">This week</p>
            <h3>{formatWeekRange(weekStart, weekEnd)}</h3>
          </div>
          <button
            type="button"
            className="quiet-button home-calendar-link"
            onClick={() => setActivePage("calendar")}
          >
            Open calendar <span aria-hidden="true">→</span>
          </button>
        </div>

        <div className="home-week-strip">
          {weekDays.map((day) => (
            <div
              className={`home-week-day${day.isToday ? " is-today" : ""}${
                day.count > 0 ? " has-due-work" : ""
              }`}
              key={day.dateKey}
              aria-label={`${day.label} ${day.date.getDate()}: ${
                day.count === 1 ? "1 task due" : `${day.count} tasks due`
              }${day.isToday ? ", today" : ""}`}
            >
              <span>{day.label}</span>
              <strong>{day.date.getDate()}</strong>
              <div className="home-week-dots" aria-hidden="true">
                {Array.from({ length: Math.min(day.count, 3) }, (_, index) => (
                  <i key={`${day.dateKey}-${index}`} />
                ))}
                {day.count > 3 && <em>+{day.count - 3}</em>}
              </div>
              {day.isToday && <small>Today</small>}
            </div>
          ))}
        </div>
      </section>

      <section
        className="home-coming-up home-glow-surface"
        aria-label="Coming up"
        {...glowSurfaceProps}
      >
        <div className="home-section-heading">
          <div>
            <p className="home-zone-label">Coming up</p>
            <h3>Upcoming work</h3>
          </div>
          <button
            type="button"
            className="quiet-button"
            onClick={() => setActivePage("tasks")}
          >
            Open to-do list
          </button>
        </div>

        {upcomingTasks.length > 0 ? (
          <div className="home-upcoming-list">
            {upcomingTasks.map((task) => (
              <button
                type="button"
                className="home-upcoming-item"
                key={task.id}
                onClick={() => setActivePage("tasks")}
              >
                <span>
                  <strong>{task.title}</strong>
                  <small>{task.subject}</small>
                </span>
                <em>{formatDueTiming(task.dueDate)}</em>
              </button>
            ))}
          </div>
        ) : (
          <p className="home-coming-empty">Nothing due soon.</p>
        )}
      </section>
    </div>
  );
}

function WeeklyProgressArc({
  completed,
  left,
  overdueEarlier,
  progress,
  total,
}) {
  const radius = 58;
  const center = 72;
  const startAngle = 216;
  const endAngle = 504;
  const progressEndAngle = startAngle + ((endAngle - startAngle) * progress) / 100;
  const trackPath = describeArc(center, center, radius, startAngle, endAngle);
  const progressPath =
    total === 0
      ? ""
      : describeArc(center, center, radius, startAngle, progressEndAngle);
  const progressText =
    total === 0
      ? `0 due. No assignments due this week.${
          overdueEarlier > 0
            ? ` ${overdueEarlier} overdue from earlier.`
            : ""
        }`
      : `${left} left. ${completed} of ${total} done this week.${
          overdueEarlier > 0
            ? ` ${overdueEarlier} overdue from earlier.`
            : ""
        }`;

  return (
    <div className="home-week-progress" aria-label={progressText}>
      <svg
        className="home-progress-arc"
        viewBox="0 0 144 144"
        role="img"
        aria-hidden="true"
      >
        <path className="home-progress-track-arc" d={trackPath} />
        {progressPath && <path className="home-progress-value-arc" d={progressPath} />}
      </svg>
      <div className="home-progress-center">
        {total === 0 ? (
          <>
            <strong>0 due</strong>
            <span>No assignments due this week.</span>
            <EarlierOverdueIndicator count={overdueEarlier} />
          </>
        ) : (
          <>
            <strong>{left} left</strong>
            <span>
              {completed} of {total} done this week
            </span>
            <EarlierOverdueIndicator count={overdueEarlier} />
          </>
        )}
      </div>
    </div>
  );
}

function EarlierOverdueIndicator({ count }) {
  if (count <= 0) return null;

  return (
    <em className="home-overdue-indicator">
      {count} {count === 1 ? "overdue" : "overdue"} from earlier
    </em>
  );
}

function TaskSignalRow({ task }) {
  const signalBadges = getTaskSignalBadges(task).slice(0, 2);
  const hasSourceBadge = ["classroom", "classroom-mock"].includes(
    task.taskSource || task.source
  );

  if (!hasSourceBadge && signalBadges.length === 0) return null;

  return (
    <div className="task-signal-badges home-task-signals">
      <TaskSourceBadge task={task} />
      {signalBadges.map((badge) => (
        <span
          className={`task-signal-badge task-signal-${badge.tone}`}
          key={`${badge.tone}-${badge.label}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

function getStartOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function getMonday(date) {
  const monday = getStartOfDay(date);
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diff);
  return monday;
}

function parseTaskDate(dateKey) {
  if (!dateKey) return null;

  const date = parseDateKey(dateKey);
  if (Number.isNaN(date.getTime())) return null;

  return getStartOfDay(date);
}

function formatDueTiming(dateKey) {
  const daysLeft = getDaysLeft(dateKey);
  return getUrgencyLabel(daysLeft);
}

function formatPlanBlockTime(block) {
  if (!block?.start || !block?.end) return `${block?.duration || 0} min`;
  return `${block.start}–${block.end}`;
}

function formatWeekRange(start, end) {
  const startText = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endText = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return `${startText}–${endText}`;
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(centerX, centerY, radius, startAngle, endAngle) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(" ");
}

function shouldUseHomePointerGlow() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    window.matchMedia("(prefers-reduced-motion: no-preference)").matches &&
    window.matchMedia("(min-width: 641px)").matches
  );
}

function handleHomeGlowPointerEnter(event) {
  if (!shouldUseHomePointerGlow()) return;

  event.currentTarget.classList.add("is-pointer-glowing");
}

function handleHomeGlowPointerMove(event) {
  if (!shouldUseHomePointerGlow()) return;

  const surface = event.currentTarget;
  const rect = surface.getBoundingClientRect();
  surface.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
  surface.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
}

function handleHomeGlowPointerLeave(event) {
  const surface = event.currentTarget;
  surface.classList.remove("is-pointer-glowing");
  surface.style.removeProperty("--pointer-x");
  surface.style.removeProperty("--pointer-y");
}

export default HomePage;
