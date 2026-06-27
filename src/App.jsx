import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

const COMPLETED_TASK_RETENTION_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ACCENT_COLOR = "#7c3aed";
const accentColorPresets = [
  { label: "Purple", value: "#7c3aed" },
  { label: "Blue", value: "#2563eb" },
  { label: "Green", value: "#16865c" },
  { label: "Orange", value: "#d76516" },
  { label: "Pink", value: "#d9468c" },
  { label: "Red", value: "#dc3f4f" },
];

function normalizeHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value || "")
    ? value.toLowerCase()
    : DEFAULT_ACCENT_COLOR;
}

function hexToRgb(hex) {
  const value = normalizeHexColor(hex).slice(1);

  return {
    red: parseInt(value.slice(0, 2), 16),
    green: parseInt(value.slice(2, 4), 16),
    blue: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex({ red, green, blue }) {
  return `#${[red, green, blue]
    .map((value) => Math.round(value).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixColors(color, target, amount) {
  const sourceRgb = hexToRgb(color);
  const targetRgb = hexToRgb(target);

  return rgbToHex({
    red: sourceRgb.red + (targetRgb.red - sourceRgb.red) * amount,
    green: sourceRgb.green + (targetRgb.green - sourceRgb.green) * amount,
    blue: sourceRgb.blue + (targetRgb.blue - sourceRgb.blue) * amount,
  });
}

function getRelativeLuminance(color) {
  const { red, green, blue } = hexToRgb(color);
  const channels = [red, green, blue].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function getContrastRatio(firstColor, secondColor) {
  const firstLuminance = getRelativeLuminance(firstColor);
  const secondLuminance = getRelativeLuminance(secondColor);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function getContrastText(accentColor) {
  const lightText = "#ffffff";
  const darkText = "#18181b";

  return getContrastRatio(accentColor, lightText) >=
    getContrastRatio(accentColor, darkText)
    ? lightText
    : darkText;
}

function getReadableAccent(accentColor, theme) {
  const background = theme === "dark" ? "#0d0d0f" : "#f7f7f5";
  const target = theme === "dark" ? "#ffffff" : "#18181b";

  for (let step = 0; step <= 10; step += 1) {
    const candidate = mixColors(accentColor, target, step / 10);
    if (getContrastRatio(candidate, background) >= 4.5) return candidate;
  }

  return target;
}

function colorToRgba(color, alpha) {
  const { red, green, blue } = hexToRgb(color);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function loadTasks() {
  const savedTasks = localStorage.getItem("student-hub-tasks");

  if (!savedTasks) return defaultTasks;

  try {
    const parsedTasks = JSON.parse(savedTasks);

    if (!Array.isArray(parsedTasks)) return defaultTasks;

    const now = Date.now();

    return parsedTasks.flatMap((task) => {
      if (!task.completed) return task;

      const savedCompletedAt = Number(task.completedAt);
      const completedAt = Number.isFinite(savedCompletedAt)
        ? savedCompletedAt
        : now;

      if (now - completedAt >= COMPLETED_TASK_RETENTION_MS) return [];

      return { ...task, completedAt };
    });
  } catch {
    return defaultTasks;
  }
}

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

function rebuildPlanFromStudyBlocks(studyBlocks, startTime) {
  const rebuiltPlan = [];
  let currentOffset = 0;

  studyBlocks.forEach((block, index) => {
    const duration = Number(block.duration);

    rebuiltPlan.push({
      ...block,
      start: formatTime(startTime, currentOffset),
      end: formatTime(startTime, currentOffset + duration),
    });

    currentOffset += duration;

    if (index < studyBlocks.length - 1) {
      rebuiltPlan.push({
        id: `break-${block.taskId}-${index}`,
        type: "break",
        start: formatTime(startTime, currentOffset),
        end: formatTime(startTime, currentOffset + 10),
        duration: 10,
        title: "Break",
        tip: "Step away from the screen for a few minutes.",
      });

      currentOffset += 10;
    }
  });

  return rebuiltPlan;
}

function getPlanBlockKey(block, index) {
  if (block.type === "study") return `study-${block.taskId}`;
  if (block.type === "break") return `break-${index}`;
  return block.id;
}

function App() {
  const [activePage, setActivePage] = useState("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("student-hub-theme") === "light"
      ? "light"
      : "dark";
  });
  const [accentColor, setAccentColor] = useState(() => {
    return normalizeHexColor(localStorage.getItem("student-hub-accent"));
  });
  const [layoutDensity, setLayoutDensity] = useState(() => {
    return localStorage.getItem("student-hub-density") === "comfortable"
      ? "comfortable"
      : "compact";
  });
  const [homeLayout, setHomeLayout] = useState(() => {
    return localStorage.getItem("student-hub-home-layout") === "dashboard"
      ? "dashboard"
      : "focused";
  });

  const [tasks, setTasks] = useState(loadTasks);

  const [hoursAvailable, setHoursAvailable] = useState(() => {
    return localStorage.getItem("student-hub-hours") || 2;
  });

  const [startTime, setStartTime] = useState(() => {
    return localStorage.getItem("student-hub-start-time") || "16:00";
  });

  const [showAddTask, setShowAddTask] = useState(false);
  const [planBlocks, setPlanBlocks] = useState([]);
  const [planMoveFeedback, setPlanMoveFeedback] = useState(null);
  const planMoveFeedbackTimer = useRef(null);

  const [newTask, setNewTask] = useState({
    subject: "",
    title: "",
    dueDate: "",
    effort: 2,
  });

  useEffect(() => {
    localStorage.setItem("student-hub-tasks", JSON.stringify(tasks));
  }, [tasks]);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("student-hub-theme", theme);
  }, [theme]);

  useLayoutEffect(() => {
    document.documentElement.dataset.density = layoutDensity;
    localStorage.setItem("student-hub-density", layoutDensity);
  }, [layoutDensity]);

  useEffect(() => {
    localStorage.setItem("student-hub-home-layout", homeLayout);
  }, [homeLayout]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const readableAccent = getReadableAccent(accentColor, theme);
    const hoverTarget = theme === "dark" ? "#ffffff" : "#18181b";
    const movedSurface = theme === "dark" ? "#202024" : "#ffffff";

    root.style.setProperty("--accent", accentColor);
    root.style.setProperty(
      "--accent-hover",
      mixColors(accentColor, hoverTarget, 0.12)
    );
    root.style.setProperty("--accent-soft", readableAccent);
    root.style.setProperty("--accent-contrast", getContrastText(accentColor));
    root.style.setProperty(
      "--accent-tint",
      colorToRgba(accentColor, theme === "dark" ? 0.14 : 0.09)
    );
    root.style.setProperty(
      "--accent-border",
      colorToRgba(accentColor, theme === "dark" ? 0.3 : 0.2)
    );
    root.style.setProperty(
      "--moved-border",
      colorToRgba(accentColor, theme === "dark" ? 0.72 : 0.48)
    );
    root.style.setProperty(
      "--moved-bg",
      mixColors(movedSurface, accentColor, theme === "dark" ? 0.1 : 0.06)
    );
    root.style.setProperty(
      "--moved-shadow",
      colorToRgba(accentColor, theme === "dark" ? 0.16 : 0.12)
    );
    localStorage.setItem("student-hub-accent", accentColor);
  }, [accentColor, theme]);

  useEffect(() => {
    const completedTimestamps = tasks
      .filter((task) => task.completed)
      .map((task) => Number(task.completedAt))
      .filter(Number.isFinite);

    if (completedTimestamps.length === 0) return undefined;

    const nextExpiry =
      Math.min(...completedTimestamps) + COMPLETED_TASK_RETENTION_MS;
    const expiryTimer = setTimeout(() => {
      const now = Date.now();

      setTasks((currentTasks) =>
        currentTasks.filter((task) => {
          if (!task.completed) return true;

          const completedAt = Number(task.completedAt);
          return (
            !Number.isFinite(completedAt) ||
            now - completedAt < COMPLETED_TASK_RETENTION_MS
          );
        })
      );
    }, Math.max(0, nextExpiry - Date.now()));

    return () => clearTimeout(expiryTimer);
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem("student-hub-hours", hoursAvailable);
  }, [hoursAvailable]);

  useEffect(() => {
    localStorage.setItem("student-hub-start-time", startTime);
  }, [startTime]);

  useEffect(() => {
    return () => clearTimeout(planMoveFeedbackTimer.current);
  }, []);

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
    const completedAt = Date.now();

    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              completed: !task.completed,
              completedAt: task.completed ? null : completedAt,
            }
          : task
      )
    );

    if (taskBeingChanged && !taskBeingChanged.completed) {
      setPlanBlocks(planBlocks.filter((block) => block.taskId !== taskId));
    }
  }

  function completeTaskFromPlan(taskId) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? { ...task, completed: true, completedAt: Date.now() }
          : task
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

  function movePlanStudyBlock(taskId, direction) {
    const studyBlocks = planBlocks.filter((block) => block.type === "study");
    const currentIndex = studyBlocks.findIndex((block) => block.taskId === taskId);
    const nextIndex = currentIndex + direction;

    if (
      currentIndex === -1 ||
      nextIndex < 0 ||
      nextIndex >= studyBlocks.length
    ) {
      return;
    }

    const reorderedStudyBlocks = [...studyBlocks];
    const [movedBlock] = reorderedStudyBlocks.splice(currentIndex, 1);
    reorderedStudyBlocks.splice(nextIndex, 0, movedBlock);

    setPlanBlocks(rebuildPlanFromStudyBlocks(reorderedStudyBlocks, startTime));
    setPlanMoveFeedback((currentFeedback) => ({
      taskId,
      direction,
      sequence: (currentFeedback?.sequence || 0) + 1,
    }));

    clearTimeout(planMoveFeedbackTimer.current);
    planMoveFeedbackTimer.current = setTimeout(() => {
      setPlanMoveFeedback(null);
    }, 700);
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
            ←
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
            homeLayout={homeLayout}
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
            movePlanStudyBlock={movePlanStudyBlock}
            planMoveFeedback={planMoveFeedback}
            completeTaskFromPlan={completeTaskFromPlan}
            hoursAvailable={hoursAvailable}
            setHoursAvailable={setHoursAvailable}
          />
        )}

        {activePage === "settings" && (
          <SettingsPage
            theme={theme}
            setTheme={setTheme}
            accentColor={accentColor}
            setAccentColor={setAccentColor}
            layoutDensity={layoutDensity}
            setLayoutDensity={setLayoutDensity}
            homeLayout={homeLayout}
            setHomeLayout={setHomeLayout}
          />
        )}
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

          {homeLayout === "dashboard" && (
            <section className="home-widget home-widget--overview">
              <div className="home-widget-header">
                <h3>Overview</h3>
                <span>Current workload</span>
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

            {homeLayout === "focused" && (
              <div className="home-task-summary">
                <span>
                  <strong>{activeTasks.length}</strong> active
                </span>
                <span>
                  <strong>{completedTasks.length}</strong> completed
                </span>
                <span>
                  <strong>{noDeadlineTasks.length}</strong> no deadline
                </span>
                <span>
                  <strong>{Math.max(hiddenBacklogCount, 0)}</strong> in backlog
                </span>
              </div>
            )}
          </section>
        </div>
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
  const hasActiveTasks =
    sortedActiveTasks.length > 0 ||
    sortedVisibleBacklog.length > 0 ||
    sortedNoDeadlineTasks.length > 0;

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

        {!hasActiveTasks && (
          <div className="task-empty-state">
            <h3>
              {sortedCompletedTasks.length > 0
                ? "All caught up."
                : "No tasks yet."}
            </h3>
            <p>
              {sortedCompletedTasks.length > 0
                ? "Your current tasks are complete. Add another when you’re ready."
                : "Add your first assignment."}
            </p>
          </div>
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
  movePlanStudyBlock,
  planMoveFeedback,
  completeTaskFromPlan,
  hoursAvailable,
  setHoursAvailable,
}) {
  const studyPlanBlocks = planBlocks.filter((block) => block.type === "study");
  const planBlockRefs = useRef(new Map());
  const flipFirstRects = useRef(null);
  const flipAnimationFrame = useRef(null);

  useEffect(() => {
    return () => cancelAnimationFrame(flipAnimationFrame.current);
  }, []);

  useLayoutEffect(() => {
    const firstRects = flipFirstRects.current;

    if (!firstRects) return;

    flipFirstRects.current = null;
    cancelAnimationFrame(flipAnimationFrame.current);

    const animatedBlocks = [];

    planBlockRefs.current.forEach((node, key) => {
      const firstRect = firstRects.get(key);

      if (!firstRect) return;

      const lastRect = node.getBoundingClientRect();
      const deltaX = firstRect.left - lastRect.left;
      const deltaY = firstRect.top - lastRect.top;

      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

      node.style.transition = "none";
      node.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      node.style.zIndex =
        key === `study-${planMoveFeedback?.taskId}` ? "2" : "1";
      animatedBlocks.push(node);
    });

    flipAnimationFrame.current = requestAnimationFrame(() => {
      animatedBlocks.forEach((node) => {
        node.style.transition =
          "transform 460ms cubic-bezier(0.22, 1, 0.36, 1), border-color 220ms ease, background 220ms ease, box-shadow 220ms ease";
        node.style.transform = "";
      });
    });

    const cleanupTimer = setTimeout(() => {
      animatedBlocks.forEach((node) => {
        node.style.transition = "";
        node.style.transform = "";
        node.style.zIndex = "";
      });
    }, 520);

    return () => clearTimeout(cleanupTimer);
  }, [planBlocks, planMoveFeedback]);

  function setPlanBlockRef(key, node) {
    if (node) {
      planBlockRefs.current.set(key, node);
    } else {
      planBlockRefs.current.delete(key);
    }
  }

  function getPlanBlockRects() {
    const rects = new Map();

    planBlockRefs.current.forEach((node, key) => {
      rects.set(key, node.getBoundingClientRect());
    });

    return rects;
  }

  function handleMovePlanStudyBlock(taskId, direction) {
    flipFirstRects.current = getPlanBlockRects();
    movePlanStudyBlock(taskId, direction);
  }

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

        {planBlocks.map((block, index) => {
          const blockKey = getPlanBlockKey(block, index);

          if (block.type === "message") {
            return (
              <div className="empty-plan" key={blockKey}>
                <h3>{block.title}</h3>
                <p>{block.note}</p>
              </div>
            );
          }

          const studyIndex =
            block.type === "study"
              ? studyPlanBlocks.findIndex(
                  (studyBlock) => studyBlock.taskId === block.taskId
                )
              : -1;
          const isFirstStudyBlock = studyIndex === 0;
          const isLastStudyBlock = studyIndex === studyPlanBlocks.length - 1;
          const isMovedStudyBlock =
            block.type === "study" && planMoveFeedback?.taskId === block.taskId;
          const moveClassName = isMovedStudyBlock ? " plan-block-moved" : "";

          return (
            <div
              className={
                block.type === "break"
                  ? "plan-block break-block"
                  : `plan-block${moveClassName}`
              }
              key={blockKey}
              ref={(node) => setPlanBlockRef(blockKey, node)}
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
                <div className="plan-block-controls">
                  <button
                    type="button"
                    className="move-plan-button"
                    onClick={() => handleMovePlanStudyBlock(block.taskId, -1)}
                    disabled={isFirstStudyBlock}
                  >
                    Move up
                  </button>

                  <button
                    type="button"
                    className="move-plan-button"
                    onClick={() => handleMovePlanStudyBlock(block.taskId, 1)}
                    disabled={isLastStudyBlock}
                  >
                    Move down
                  </button>

                  <button
                    type="button"
                    className="complete-plan-button"
                    onClick={() => completeTaskFromPlan(block.taskId)}
                  >
                    Mark task done
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SettingsPage({
  theme,
  setTheme,
  accentColor,
  setAccentColor,
  layoutDensity,
  setLayoutDensity,
  homeLayout,
  setHomeLayout,
}) {
  const [settingsView, setSettingsView] = useState("hub");

  return (
    <div className="page">
      <header className="page-header">
        {settingsView === "appearance" && (
          <button
            type="button"
            className="settings-back-button"
            onClick={() => setSettingsView("hub")}
          >
            ← Settings
          </button>
        )}
        <p className="eyebrow">
          {settingsView === "hub" ? "Settings" : "Appearance"}
        </p>
        <h2>{settingsView === "hub" ? "Settings" : "Appearance"}</h2>
        <p>
          {settingsView === "hub"
            ? "Manage your workspace preferences and future connections."
            : "Personalise how Student Hub looks and feels."}
        </p>
      </header>

      {settingsView === "hub" ? (
        <div className="settings-hub-grid">
          <button
            type="button"
            className="settings-hub-card"
            onClick={() => setSettingsView("appearance")}
          >
            <span>
              <strong>Appearance</strong>
              <small>Theme, colour, density, and Home layout</small>
            </span>
            <span className="settings-hub-arrow" aria-hidden="true">
              →
            </span>
          </button>

          {[
            ["Account", "Profile and sign-in preferences"],
            ["Integrations", "Connected services and data sources"],
            ["Help / FAQ", "Guidance and common questions"],
          ].map(([title, description]) => (
            <button
              key={title}
              type="button"
              className="settings-hub-card coming-soon"
              disabled
            >
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <span className="settings-coming-soon">Coming soon</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="panel appearance-panel">
          <section className="appearance-group">
            <p className="settings-group-label">Visual</p>

            <div className="theme-setting">
              <div>
                <h3>Theme</h3>
                <p>Choose the appearance that feels most comfortable.</p>
              </div>

              <div className="theme-toggle" role="group" aria-label="Theme">
                {["light", "dark"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={theme === option ? "active" : ""}
                    aria-pressed={theme === option}
                    onClick={() => setTheme(option)}
                  >
                    {option === "light" ? "Light" : "Dark"}
                  </button>
                ))}
              </div>
            </div>

            <div className="theme-setting accent-setting">
              <div>
                <h3>Accent colour</h3>
                <p>Personalise highlights while keeping statuses distinct.</p>
              </div>

              <div className="accent-controls">
                <div
                  className="accent-presets"
                  aria-label="Accent colour presets"
                >
                  {accentColorPresets.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      className={accentColor === preset.value ? "active" : ""}
                      style={{
                        "--preset-color": preset.value,
                        "--preset-contrast": getContrastText(preset.value),
                      }}
                      aria-label={`${preset.label} accent`}
                      aria-pressed={accentColor === preset.value}
                      title={preset.label}
                      onClick={() => setAccentColor(preset.value)}
                    >
                      <span aria-hidden="true">✓</span>
                    </button>
                  ))}
                </div>

                <label className="accent-picker">
                  <span>Custom</span>
                  <input
                    type="color"
                    value={accentColor}
                    aria-label="Custom accent colour"
                    onChange={(event) => setAccentColor(event.target.value)}
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="appearance-group">
            <p className="settings-group-label">Layout</p>

            <div className="theme-setting density-setting">
              <div>
                <h3>Layout density</h3>
                <p>Choose between breathing room and a tighter workspace.</p>
              </div>

              <div
                className="theme-toggle density-toggle"
                role="group"
                aria-label="Layout density"
              >
                {["comfortable", "compact"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={layoutDensity === option ? "active" : ""}
                    aria-pressed={layoutDensity === option}
                    onClick={() => setLayoutDensity(option)}
                  >
                    {option === "comfortable" ? "Comfortable" : "Compact"}
                  </button>
                ))}
              </div>
            </div>

            <div className="theme-setting home-layout-setting">
              <div>
                <h3>Home layout</h3>
                <p>Choose a focused workspace or a fuller task overview.</p>
              </div>

              <div
                className="theme-toggle home-layout-toggle"
                role="group"
                aria-label="Home layout"
              >
                {["focused", "dashboard"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={homeLayout === option ? "active" : ""}
                    aria-pressed={homeLayout === option}
                    onClick={() => setHomeLayout(option)}
                  >
                    {option === "focused" ? "Focused" : "Dashboard"}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
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
