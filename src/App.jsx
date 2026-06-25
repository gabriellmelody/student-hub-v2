import { useEffect, useState } from "react";
import "./App.css";

const defaultTasks = [
  {
    id: 1,
    subject: "English",
    title: "Essay draft",
    dueDate: "2026-06-22",
    effort: 3,
    completed: false,
  },
  {
    id: 2,
    subject: "Maths",
    title: "Problem set",
    dueDate: "2026-06-25",
    effort: 2,
    completed: false,
  },
  {
    id: 3,
    subject: "Biology",
    title: "Lab report",
    dueDate: "2026-07-02",
    effort: 4,
    completed: false,
  },
  {
    id: 4,
    subject: "History",
    title: "Chapter reading",
    dueDate: "",
    effort: 1,
    completed: false,
  },
];

function getDaysLeft(dueDate) {
  if (!dueDate) return null;

  const today = new Date();
  const due = new Date(dueDate);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
}

function getUrgencyLabel(daysLeft) {
  if (daysLeft === null) return "No deadline";
  if (daysLeft < 0) return "Overdue";
  if (daysLeft === 0) return "Due today";
  if (daysLeft === 1) return "Due tomorrow";
  return `${daysLeft} days left`;
}

function getUrgencyClass(daysLeft) {
  if (daysLeft === null) return "neutral";
  if (daysLeft <= 1) return "urgent";
  if (daysLeft <= 5) return "soon";
  return "safe";
}

function getEffortLabel(effort) {
  if (effort === 1) return "Easy";
  if (effort === 2 || effort === 3) return "Medium";
  if (effort === 4) return "High";
  return "Max";
}

function getEffortClass(effort) {
  if (effort === 1) return "effort-low";
  if (effort === 2 || effort === 3) return "effort-medium";
  if (effort === 4) return "effort-high";
  return "effort-max";
}

function formatTime(startTime, minutesToAdd) {
  const [hours, minutes] = startTime.split(":").map(Number);

  const date = new Date();
  date.setHours(hours, minutes + minutesToAdd, 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTaskTip(task) {
  const daysLeft = getDaysLeft(task.dueDate);

  if (daysLeft !== null && daysLeft < 0) {
    return "This is overdue. Aim to finish the minimum acceptable version first.";
  }

  if (daysLeft !== null && daysLeft <= 1) {
    return "Focus on completion first, polish later.";
  }

  if (task.effort >= 4) {
    return "Break this into one clear section rather than trying to finish everything.";
  }

  if (!task.dueDate) {
    return "Do this only if it is quick or blocking something else.";
  }

  return "Make steady progress and stop when the block ends.";
}

function compareTasksSmart(a, b) {
  const aDays = getDaysLeft(a.dueDate);
  const bDays = getDaysLeft(b.dueDate);
  const safeADays = aDays === null ? 999 : aDays;
  const safeBDays = bDays === null ? 999 : bDays;

  if (safeADays !== safeBDays) return safeADays - safeBDays;
  return b.effort - a.effort;
}

function sortTasksForDisplay(taskList) {
  return [...taskList].sort(compareTasksSmart);
}

const taskSortOptions = [
  { value: "smart", label: "Smart" },
  { value: "dueDate", label: "Due date" },
  { value: "effort", label: "Effort" },
  { value: "subject", label: "Subject" },
];

function sortTasksByMode(taskList, sortMode) {
  if (sortMode === "smart") {
    return sortTasksForDisplay(taskList);
  }

  return [...taskList].sort((a, b) => {
    if (sortMode === "dueDate") {
      const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;

      if (aTime !== bTime) return aTime - bTime;
      return b.effort - a.effort;
    }

    if (sortMode === "effort") {
      if (a.effort !== b.effort) return b.effort - a.effort;
      return compareTasksSmart(a, b);
    }

    return (
      a.subject.localeCompare(b.subject, undefined, { sensitivity: "base" }) ||
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
    );
  });
}

function App() {
  const [activePage, setActivePage] = useState("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [tasks, setTasks] = useState(() => {
    const savedTasks = localStorage.getItem("student-hub-tasks");
    return savedTasks ? JSON.parse(savedTasks) : defaultTasks;
  });

  const [hoursAvailable, setHoursAvailable] = useState(() => {
    return localStorage.getItem("student-hub-hours") || 2;
  });

  const [startTime, setStartTime] = useState(() => {
    return localStorage.getItem("student-hub-start-time") || "16:00";
  });

  const [showAddTask, setShowAddTask] = useState(false);
  const [planBlocks, setPlanBlocks] = useState([]);

  const [newTask, setNewTask] = useState({
    subject: "",
    title: "",
    dueDate: "",
    effort: 2,
  });

  useEffect(() => {
    localStorage.setItem("student-hub-tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem("student-hub-hours", hoursAvailable);
  }, [hoursAvailable]);

  useEffect(() => {
    localStorage.setItem("student-hub-start-time", startTime);
  }, [startTime]);

  const activeTasks = sortTasksForDisplay(
    tasks.filter((task) => {
      const daysLeft = getDaysLeft(task.dueDate);
      return !task.completed && daysLeft !== null && daysLeft <= 14;
    })
  );

  const backlogTasks = sortTasksForDisplay(
    tasks.filter((task) => {
      const daysLeft = getDaysLeft(task.dueDate);
      return !task.completed && daysLeft !== null && daysLeft > 14;
    })
  );

  const noDeadlineTasks = tasks.filter(
    (task) => !task.completed && !task.dueDate
  );

  const completedTasks = tasks.filter((task) => task.completed);

  let visibleBacklog = [];

  if (activeTasks.length === 0) {
    visibleBacklog = backlogTasks;
  } else if (activeTasks.length <= 2) {
    visibleBacklog = backlogTasks.slice(0, 2);
  }

  const hiddenBacklogCount = backlogTasks.length - visibleBacklog.length;

  const progressPercentage =
    tasks.length === 0
      ? 0
      : Math.round((completedTasks.length / tasks.length) * 100);

  const nextTask = [...activeTasks, ...visibleBacklog][0];

  function toggleTask(taskId) {
    const taskBeingChanged = tasks.find((task) => task.id === taskId);

    setTasks(
      tasks.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );

    if (taskBeingChanged && !taskBeingChanged.completed) {
      setPlanBlocks(planBlocks.filter((block) => block.taskId !== taskId));
    }
  }

  function completeTaskFromPlan(taskId) {
    setTasks(
      tasks.map((task) =>
        task.id === taskId ? { ...task, completed: true } : task
      )
    );

    setPlanBlocks(planBlocks.filter((block) => block.taskId !== taskId));
  }

  function deleteTask(taskId) {
    setTasks(tasks.filter((task) => task.id !== taskId));
    setPlanBlocks(planBlocks.filter((block) => block.taskId !== taskId));
  }

  function updateTask(taskId, updatedTask) {
    if (!updatedTask.subject.trim() || !updatedTask.title.trim()) {
      return;
    }

    setTasks(
      tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              subject: updatedTask.subject.trim(),
              title: updatedTask.title.trim(),
              dueDate: updatedTask.dueDate,
              effort: Number(updatedTask.effort),
            }
          : task
      )
    );

    setPlanBlocks([]);
  }

  function clearPlan() {
    setPlanBlocks([]);
  }

  function addTask(event) {
    event.preventDefault();

    if (!newTask.subject.trim() || !newTask.title.trim()) {
      return;
    }

    const taskToAdd = {
      id: Date.now(),
      subject: newTask.subject.trim(),
      title: newTask.title.trim(),
      dueDate: newTask.dueDate,
      effort: Number(newTask.effort),
      completed: false,
    };

    setTasks([...tasks, taskToAdd]);

    setNewTask({
      subject: "",
      title: "",
      dueDate: "",
      effort: 2,
    });

    setShowAddTask(false);
  }

  function generatePlan() {
    const availableMinutes = Math.round(Number(hoursAvailable) * 60);

    if (!availableMinutes || availableMinutes < 20) {
      setPlanBlocks([
        {
          id: "not-enough-time",
          type: "message",
          title: "Not enough time to build a proper plan.",
          note: "Try setting at least 20 minutes.",
        },
      ]);
      setActivePage("plan");
      return;
    }

    let candidateTasks = [...activeTasks, ...visibleBacklog];

    if (candidateTasks.length === 0 && noDeadlineTasks.length > 0) {
      candidateTasks = [...noDeadlineTasks];
    }

    if (candidateTasks.length === 0) {
      setPlanBlocks([
        {
          id: "no-tasks",
          type: "message",
          title: "No tasks to plan.",
          note: "You are clear for now.",
        },
      ]);
      setActivePage("plan");
      return;
    }

    const sortedTasks = sortTasksForDisplay(candidateTasks);

    const effortDurations = {
      1: 25,
      2: 35,
      3: 50,
      4: 65,
      5: 80,
    };

    const newPlan = [];
    let remainingMinutes = availableMinutes;
    let currentOffset = 0;

    for (const task of sortedTasks) {
      if (remainingMinutes < 20) break;

      const idealDuration = effortDurations[task.effort] || 35;
      const duration = Math.min(idealDuration, remainingMinutes);

      if (duration < 20) break;

      newPlan.push({
        id: `${task.id}-${currentOffset}`,
        type: "study",
        taskId: task.id,
        subject: task.subject,
        title: task.title,
        start: formatTime(startTime, currentOffset),
        end: formatTime(startTime, currentOffset + duration),
        duration,
        effort: task.effort,
        tip: getTaskTip(task),
      });

      currentOffset += duration;
      remainingMinutes -= duration;

      if (remainingMinutes >= 30) {
        newPlan.push({
          id: `break-${currentOffset}`,
          type: "break",
          start: formatTime(startTime, currentOffset),
          end: formatTime(startTime, currentOffset + 10),
          duration: 10,
          title: "Break",
          tip: "Step away from the screen for a few minutes.",
        });

        currentOffset += 10;
        remainingMinutes -= 10;
      }
    }

    setPlanBlocks(newPlan);
    setActivePage("plan");
  }

  return (
    <main className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="brand-row">
          <div className="brand">
            <div className="brand-mark">S</div>
            <div className="brand-text">
              <h1>Student Hub</h1>
              <p>School, organised.</p>
            </div>
          </div>

          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label="Toggle sidebar"
          >
            {sidebarCollapsed ? "→" : "←"}
          </button>
        </div>

        <nav className={`nav nav-${activePage}`}>
          <span className="nav-indicator" />
          
          <NavButton
            label="Home"
            icon="⌂"
            active={activePage === "home"}
            onClick={() => setActivePage("home")}
          />
          <NavButton
            label="To-do list"
            icon="✓"
            active={activePage === "tasks"}
            onClick={() => setActivePage("tasks")}
          />
          <NavButton
            label="Today’s plan"
            icon="◷"
            active={activePage === "plan"}
            onClick={() => setActivePage("plan")}
          />
          <NavButton
            label="Settings"
            icon="⚙"
            active={activePage === "settings"}
            onClick={() => setActivePage("settings")}
          />
        </nav>

        <div className="sidebar-footer">
          <p>
            {completedTasks.length}/{tasks.length} tasks done
          </p>
          <div className="mini-progress-track">
            <div
              className="mini-progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </aside>

      <section className="main-content">
        {activePage === "home" && (
          <HomePage
            activeTasks={activeTasks}
            completedTasks={completedTasks}
            noDeadlineTasks={noDeadlineTasks}
            visibleBacklog={visibleBacklog}
            hiddenBacklogCount={hiddenBacklogCount}
            hoursAvailable={hoursAvailable}
            setHoursAvailable={setHoursAvailable}
            startTime={startTime}
            setStartTime={setStartTime}
            progressPercentage={progressPercentage}
            nextTask={nextTask}
            generatePlan={generatePlan}
            setActivePage={setActivePage}
          />
        )}

        {activePage === "tasks" && (
          <TasksPage
            activeTasks={activeTasks}
            visibleBacklog={visibleBacklog}
            hiddenBacklogCount={hiddenBacklogCount}
            noDeadlineTasks={noDeadlineTasks}
            completedTasks={completedTasks}
            showAddTask={showAddTask}
            setShowAddTask={setShowAddTask}
            newTask={newTask}
            setNewTask={setNewTask}
            addTask={addTask}
            toggleTask={toggleTask}
            deleteTask={deleteTask}
            updateTask={updateTask}
          />
        )}

        {activePage === "plan" && (
          <PlanPage
            planBlocks={planBlocks}
            startTime={startTime}
            setStartTime={setStartTime}
            generatePlan={generatePlan}
            clearPlan={clearPlan}
            completeTaskFromPlan={completeTaskFromPlan}
            hoursAvailable={hoursAvailable}
            setHoursAvailable={setHoursAvailable}
          />
        )}

        {activePage === "settings" && <SettingsPage />}
      </section>
    </main>
  );
}

function NavButton({ label, icon, active, onClick }) {
  return (
    <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
    </button>
  );
}

function HomePage({
  activeTasks,
  completedTasks,
  noDeadlineTasks,
  visibleBacklog,
  hiddenBacklogCount,
  hoursAvailable,
  setHoursAvailable,
  startTime,
  setStartTime,
  progressPercentage,
  nextTask,
  generatePlan,
  setActivePage,
}) {
  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Home</p>
        <h2>Your school day, organised.</h2>
        <p>
          See what matters, decide how much time you have, and generate a plan
          when you’re ready.
        </p>
      </header>

      <section className="stat-grid">
        <StatCard label="Active tasks" value={activeTasks.length} />
        <StatCard label="Completed" value={completedTasks.length} />
        <StatCard label="No deadline" value={noDeadlineTasks.length} />
        <StatCard
          label="Backlog hidden"
          value={hiddenBacklogCount > 0 ? hiddenBacklogCount : 0}
        />
      </section>

      <section className="home-grid">
        <div className="panel">
          <div className="panel-header">
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
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Next focus</h3>
          </div>

          {nextTask ? (
            <div className="focus-card">
              <p>{nextTask.subject}</p>
              <h3>{nextTask.title}</h3>
              <div className="focus-meta-row">
                <span>{getUrgencyLabel(getDaysLeft(nextTask.dueDate))}</span>
                <span className={`effort-pill ${getEffortClass(nextTask.effort)}`}>
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
        </div>
      </section>

      <section className="progress-card">
        <div className="progress-header">
          <span>Overall progress</span>
          <span>{progressPercentage}%</span>
        </div>

        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        <p>
          {completedTasks.length} task
          {completedTasks.length === 1 ? "" : "s"} completed so far.
        </p>
      </section>
    </div>
  );
}

function TasksPage({
  activeTasks,
  visibleBacklog,
  hiddenBacklogCount,
  noDeadlineTasks,
  completedTasks,
  showAddTask,
  setShowAddTask,
  newTask,
  setNewTask,
  addTask,
  toggleTask,
  deleteTask,
  updateTask,
}) {
  const [taskSortMode, setTaskSortMode] = useState("smart");
  const sortedActiveTasks = sortTasksByMode(activeTasks, taskSortMode);
  const sortedVisibleBacklog = sortTasksByMode(visibleBacklog, taskSortMode);
  const sortedNoDeadlineTasks = sortTasksByMode(noDeadlineTasks, taskSortMode);
  const sortedCompletedTasks = sortTasksByMode(completedTasks, taskSortMode);

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">To-do list</p>
        <h2>Your tasks</h2>
        <p>Active work stays visible. Future work appears when your list clears.</p>
      </header>

      <div className="panel">
        <div className="panel-header">
          <h3>Tasks</h3>
          <button
            className="small-button"
            onClick={() => setShowAddTask(!showAddTask)}
          >
            {showAddTask ? "Cancel" : "+ Add task"}
          </button>
        </div>

        <div className="task-sort-row" aria-label="Sort tasks">
          {taskSortOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                taskSortMode === option.value
                  ? "small-button sort-button active"
                  : "small-button sort-button"
              }
              onClick={() => setTaskSortMode(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {showAddTask && (
          <form className="add-task-form" onSubmit={addTask}>
            <input
              type="text"
              placeholder="Subject, e.g. Chemistry"
              value={newTask.subject}
              onChange={(event) =>
                setNewTask({ ...newTask, subject: event.target.value })
              }
            />

            <input
              type="text"
              placeholder="Task title"
              value={newTask.title}
              onChange={(event) =>
                setNewTask({ ...newTask, title: event.target.value })
              }
            />

            <input
              type="date"
              value={newTask.dueDate}
              onChange={(event) =>
                setNewTask({ ...newTask, dueDate: event.target.value })
              }
            />

            <div className="effort-row">
              <span>Effort</span>

              {[1, 2, 3, 4, 5].map((number) => (
                <button
                  key={number}
                  type="button"
                  className={
                    newTask.effort === number
                      ? `effort-button selected ${getEffortClass(number)}`
                      : `effort-button ${getEffortClass(number)}`
                  }
                  onClick={() => setNewTask({ ...newTask, effort: number })}
                >
                  {number}
                </button>
              ))}
            </div>

            <button className="primary-button" type="submit">
              Add task
            </button>
          </form>
        )}

        {sortedActiveTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onToggle={toggleTask}
            onDelete={deleteTask}
            onUpdate={updateTask}
          />
        ))}

        {sortedVisibleBacklog.length > 0 && (
          <div className="task-section">
            <p className="section-label">Coming up</p>
            {sortedVisibleBacklog.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onUpdate={updateTask}
              />
            ))}
          </div>
        )}

        {hiddenBacklogCount > 0 && (
          <p className="muted-text">
            + {hiddenBacklogCount} more task
            {hiddenBacklogCount === 1 ? "" : "s"} in backlog
          </p>
        )}

        {sortedNoDeadlineTasks.length > 0 && (
          <div className="task-section">
            <p className="section-label">No deadline</p>
            {sortedNoDeadlineTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onUpdate={updateTask}
              />
            ))}
          </div>
        )}

        {sortedCompletedTasks.length > 0 && (
          <div className="task-section">
            <p className="section-label">Completed</p>
            {sortedCompletedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onUpdate={updateTask}
                completed
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlanPage({
  planBlocks,
  startTime,
  setStartTime,
  generatePlan,
  clearPlan,
  completeTaskFromPlan,
  hoursAvailable,
  setHoursAvailable,
}) {
  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Today’s plan</p>
        <h2>Build a study plan</h2>
        <p>Use your available time and task list to generate a simple schedule.</p>
      </header>

      <div className="panel">
        <div className="panel-header">
          <h3>Plan</h3>

          <div className="plan-actions">
            {planBlocks.length > 0 && (
              <button className="small-button secondary" onClick={clearPlan}>
                Clear
              </button>
            )}

            <button className="small-button" onClick={generatePlan}>
              {planBlocks.length > 0 ? "Regenerate" : "Plan my day"}
            </button>
          </div>
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

        {planBlocks.length === 0 && (
          <div className="empty-plan">
            <h3>Ready when you are.</h3>
            <p>
              Set your available hours, choose a start time, then generate a
              simple study plan.
            </p>
          </div>
        )}

        {planBlocks.map((block) => {
          if (block.type === "message") {
            return (
              <div className="empty-plan" key={block.id}>
                <h3>{block.title}</h3>
                <p>{block.note}</p>
              </div>
            );
          }

          return (
            <div
              className={
                block.type === "break"
                  ? "plan-block break-block"
                  : "plan-block"
              }
              key={block.id}
            >
              <div className="plan-time">
                {block.start} – {block.end}
              </div>

              {block.type === "study" && (
                <div className="plan-study-meta">
                  <p className="plan-subject">{block.subject}</p>
                  <span className={`effort-pill ${getEffortClass(block.effort)}`}>
                    {getEffortLabel(block.effort)} · {block.effort}/5
                  </span>
                </div>
              )}

              <h3>{block.title}</h3>
              <p>{block.tip}</p>

              {block.type === "study" && (
                <button
                  className="complete-plan-button"
                  onClick={() => completeTaskFromPlan(block.taskId)}
                >
                  Mark task done
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Settings</p>
        <h2>Preferences</h2>
        <p>
          Later this is where we’ll add default study times, connected school
          accounts, subjects, and AI settings.
        </p>
      </header>

      <div className="panel">
        <div className="empty-plan">
          <h3>Coming soon.</h3>
          <p>
            Settings will matter more once we add AI, Google Classroom, and
            calendar syncing.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <p>{label}</p>
      <h3>{value}</h3>
    </div>
  );
}

function TaskCard({ task, onToggle, onDelete, onUpdate, completed = false }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTask, setDraftTask] = useState({
    subject: task.subject,
    title: task.title,
    dueDate: task.dueDate,
    effort: task.effort,
  });

  useEffect(() => {
    setDraftTask({
      subject: task.subject,
      title: task.title,
      dueDate: task.dueDate,
      effort: task.effort,
    });
  }, [task]);

  const daysLeft = getDaysLeft(task.dueDate);
  const urgencyClass = getUrgencyClass(daysLeft);
  const urgencyLabel = getUrgencyLabel(daysLeft);
  const effortClass = getEffortClass(task.effort);
  const effortLabel = getEffortLabel(task.effort);

  function saveEdit(event) {
    event.preventDefault();

    if (!draftTask.subject.trim() || !draftTask.title.trim()) {
      return;
    }

    onUpdate(task.id, draftTask);
    setIsEditing(false);
  }

  function cancelEdit() {
    setDraftTask({
      subject: task.subject,
      title: task.title,
      dueDate: task.dueDate,
      effort: task.effort,
    });

    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div className={`task-card editing ${completed ? "completed" : ""}`}>
        <form className="edit-task-form" onSubmit={saveEdit}>
          <input
            type="text"
            value={draftTask.subject}
            onChange={(event) =>
              setDraftTask({ ...draftTask, subject: event.target.value })
            }
            placeholder="Subject"
          />

          <input
            type="text"
            value={draftTask.title}
            onChange={(event) =>
              setDraftTask({ ...draftTask, title: event.target.value })
            }
            placeholder="Task title"
          />

          <input
            type="date"
            value={draftTask.dueDate}
            onChange={(event) =>
              setDraftTask({ ...draftTask, dueDate: event.target.value })
            }
          />

          <div className="effort-row edit-effort-row">
            <span>Effort</span>

            {[1, 2, 3, 4, 5].map((number) => (
              <button
                key={number}
                type="button"
                className={
                  Number(draftTask.effort) === number
                    ? `effort-button selected ${getEffortClass(number)}`
                    : `effort-button ${getEffortClass(number)}`
                }
                onClick={() => setDraftTask({ ...draftTask, effort: number })}
              >
                {number}
              </button>
            ))}
          </div>

          <div className="edit-form-actions">
            <button className="save-edit-button" type="submit">
              Save
            </button>

            <button
              className="cancel-edit-button"
              type="button"
              onClick={cancelEdit}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={`task-card ${completed ? "completed" : ""}`}>
      <button className="task-main" onClick={() => onToggle(task.id)}>
        <span className={`check-circle ${completed ? "checked" : ""}`}>
          {completed ? "✓" : ""}
        </span>

        <div className="task-content">
          <div className="task-topline">
            <span>{task.subject}</span>
            <span className={`urgency ${urgencyClass}`}>{urgencyLabel}</span>
          </div>

          <h3>{task.title}</h3>

          <div className="task-meta">
            <span className={`effort-pill ${effortClass}`}>
              {effortLabel} · {task.effort}/5
            </span>
          </div>
        </div>
      </button>

      <div className="task-actions">
        <button
          className="edit-button"
          onClick={() => setIsEditing(true)}
          aria-label={`Edit ${task.title}`}
        >
          Edit
        </button>

        <button
          className="delete-button"
          onClick={() => onDelete(task.id)}
          aria-label={`Delete ${task.title}`}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default App;
