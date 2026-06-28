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
const DEFAULT_ACCENT_COLOR = "#6366f1";
const DEFAULT_SUBJECT_COLOR = "#2563eb";
const STUDENT_HUB_STORAGE_KEYS = [
  "student-hub-tasks",
  "student-hub-subjects",
  "student-hub-student-profile",
  "student-hub-theme",
  "student-hub-accent",
  "student-hub-density",
  "student-hub-home-layout",
  "student-hub-right-rail",
  "student-hub-right-rail-state",
  "student-hub-right-rail-widgets",
  "student-hub-hours",
  "student-hub-start-time",
];
const subjectCourseSystems = ["IB", "AP", "GCSE", "A-level", "Other"];
const subjectLevels = ["HL", "SL", "AP", "Standard", "Higher", "Other"];
const accentColorPresets = [
  { label: "Indigo", value: DEFAULT_ACCENT_COLOR },
  { label: "Purple", value: "#7c3aed" },
  { label: "Blue", value: "#2563eb" },
  { label: "Green", value: "#16865c" },
  { label: "Orange", value: "#d76516" },
  { label: "Pink", value: "#d9468c" },
  { label: "Red", value: "#dc3f4f" },
];
const rightRailWidgetOptions = [
  { value: "clock", label: "Clock" },
  { value: "calendar", label: "School calendar" },
  { value: "deadlines", label: "Upcoming deadlines" },
  { value: "plan", label: "Today’s plan" },
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

function loadRightRailWidgets() {
  const savedWidgets = localStorage.getItem("student-hub-right-rail-widgets");
  const defaultWidgets = rightRailWidgetOptions.map((option) => option.value);

  if (!savedWidgets) return defaultWidgets;

  try {
    const parsedWidgets = JSON.parse(savedWidgets);

    if (!Array.isArray(parsedWidgets)) return defaultWidgets;

    return rightRailWidgetOptions
      .filter((option) => parsedWidgets.includes(option.value))
      .map((option) => option.value);
  } catch {
    return defaultWidgets;
  }
}

function loadSubjects() {
  const savedSubjects = localStorage.getItem("student-hub-subjects");

  if (!savedSubjects) return [];

  try {
    const parsedSubjects = JSON.parse(savedSubjects);

    if (!Array.isArray(parsedSubjects)) return [];

    return parsedSubjects
      .filter((subject) => subject && typeof subject.name === "string")
      .map((subject) => ({
        id: subject.id || `subject-${Date.now()}-${Math.random()}`,
        name: subject.name.trim(),
        courseSystem: subject.courseSystem || "Other",
        level: subject.level || "Other",
        currentGrade: subject.currentGrade || "",
        targetGrade: subject.targetGrade || "",
        colour: /^#[0-9a-f]{6}$/i.test(subject.colour || "")
          ? subject.colour
          : DEFAULT_SUBJECT_COLOR,
        source: subject.source || "manual",
        classroomCourseId: subject.classroomCourseId || null,
      }))
      .filter((subject) => subject.name);
  } catch {
    return [];
  }
}

function loadStudentProfile() {
  const savedProfile = localStorage.getItem("student-hub-student-profile");

  if (!savedProfile) {
    return {
      schoolSystem: "",
      onboardingCompleted: false,
      source: "manual",
    };
  }

  try {
    const parsedProfile = JSON.parse(savedProfile);

    return {
      schoolSystem: parsedProfile.schoolSystem || "",
      onboardingCompleted: parsedProfile.onboardingCompleted === true,
      source: parsedProfile.source || "manual",
    };
  } catch {
    return {
      schoolSystem: "",
      onboardingCompleted: false,
      source: "manual",
    };
  }
}

function findSubjectProfile(subjects, subjectName) {
  const normalizedName = subjectName?.trim().toLocaleLowerCase();

  if (!normalizedName) return null;

  return (
    subjects.find(
      (subject) => subject.name.trim().toLocaleLowerCase() === normalizedName
    ) || null
  );
}

function getDaysLeft(dueDate) {
  if (!dueDate) return null;

  const today = new Date();
  const due = new Date(dueDate);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getTaskCalendarEvents(tasks, subjects = []) {
  return tasks
    .filter((task) => task.dueDate)
    .map((task) => {
      const subjectProfile = findSubjectProfile(subjects, task.subject);

      return {
        id: `task-${task.id}`,
        source: "task",
        taskId: task.id,
        date: task.dueDate,
        title: task.title,
        subject: task.subject,
        subjectId: subjectProfile?.id || null,
        subjectColour: subjectProfile?.colour || null,
        completed: task.completed,
        effort: task.effort,
      };
    });
}

function getMonthCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    return {
      date,
      dateKey: formatDateKey(date),
      isCurrentMonth: date.getMonth() === month,
      isToday: formatDateKey(date) === formatDateKey(new Date()),
    };
  });
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
    return localStorage.getItem("student-hub-theme") === "dark"
      ? "dark"
      : "light";
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
  const [rightRailVisible, setRightRailVisible] = useState(() => {
    return localStorage.getItem("student-hub-right-rail") !== "off";
  });
  const [rightRailCollapsed, setRightRailCollapsed] = useState(() => {
    return localStorage.getItem("student-hub-right-rail-state") === "collapsed";
  });
  const [rightRailWidgets, setRightRailWidgets] = useState(loadRightRailWidgets);
  const [subjects, setSubjects] = useState(loadSubjects);
  const [studentProfile, setStudentProfile] = useState(loadStudentProfile);

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

  useEffect(() => {
    localStorage.setItem("student-hub-subjects", JSON.stringify(subjects));
  }, [subjects]);

  useEffect(() => {
    localStorage.setItem(
      "student-hub-student-profile",
      JSON.stringify(studentProfile)
    );
  }, [studentProfile]);

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

  useEffect(() => {
    localStorage.setItem(
      "student-hub-right-rail",
      rightRailVisible ? "on" : "off"
    );
  }, [rightRailVisible]);

  useEffect(() => {
    localStorage.setItem(
      "student-hub-right-rail-state",
      rightRailCollapsed ? "collapsed" : "expanded"
    );
  }, [rightRailCollapsed]);

  useEffect(() => {
    localStorage.setItem(
      "student-hub-right-rail-widgets",
      JSON.stringify(rightRailWidgets)
    );
  }, [rightRailWidgets]);

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

  function addTaskToList(taskInput) {
    if (!taskInput.subject.trim() || !taskInput.title.trim()) {
      return false;
    }

    const taskToAdd = {
      id: Date.now(),
      subject: taskInput.subject.trim(),
      title: taskInput.title.trim(),
      dueDate: taskInput.dueDate,
      effort: Number(taskInput.effort),
      completed: false,
    };

    setTasks((currentTasks) => [...currentTasks, taskToAdd]);
    return true;
  }

  function addTask(event) {
    event.preventDefault();

    if (!addTaskToList(newTask)) return;

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

  function completeOnboarding() {
    const completedProfile = {
      ...studentProfile,
      onboardingCompleted: true,
      source: studentProfile.source || "manual",
    };

    setStudentProfile(completedProfile);
    localStorage.setItem(
      "student-hub-student-profile",
      JSON.stringify(completedProfile)
    );
    setActivePage("home");
  }

  function restartOnboarding() {
    const restartedProfile = {
      ...studentProfile,
      onboardingCompleted: false,
      source: studentProfile.source || "manual",
    };

    setStudentProfile(restartedProfile);
    localStorage.setItem(
      "student-hub-student-profile",
      JSON.stringify(restartedProfile)
    );
    setActivePage("home");
  }

  function resetTasks() {
    localStorage.removeItem("student-hub-tasks");
    setTasks([]);
    setPlanBlocks([]);
    setPlanMoveFeedback(null);
    setShowAddTask(false);
  }

  function resetSubjects() {
    localStorage.removeItem("student-hub-subjects");
    setSubjects([]);
  }

  function resetAppearancePreferences() {
    [
      "student-hub-theme",
      "student-hub-accent",
      "student-hub-density",
      "student-hub-home-layout",
      "student-hub-right-rail",
      "student-hub-right-rail-state",
      "student-hub-right-rail-widgets",
    ].forEach((storageKey) => localStorage.removeItem(storageKey));

    setTheme("light");
    setAccentColor(DEFAULT_ACCENT_COLOR);
    setLayoutDensity("compact");
    setHomeLayout("focused");
    setRightRailVisible(true);
    setRightRailCollapsed(false);
    setRightRailWidgets(
      rightRailWidgetOptions.map((option) => option.value)
    );
  }

  function clearAllStudentHubData() {
    STUDENT_HUB_STORAGE_KEYS.forEach((storageKey) =>
      localStorage.removeItem(storageKey)
    );

    setTasks([]);
    setSubjects([]);
    setPlanBlocks([]);
    setPlanMoveFeedback(null);
    setShowAddTask(false);
    setNewTask({ subject: "", title: "", dueDate: "", effort: 2 });
    setTheme("light");
    setAccentColor(DEFAULT_ACCENT_COLOR);
    setLayoutDensity("compact");
    setHomeLayout("focused");
    setRightRailVisible(true);
    setRightRailCollapsed(false);
    setRightRailWidgets(
      rightRailWidgetOptions.map((option) => option.value)
    );
    setHoursAvailable(2);
    setStartTime("16:00");
    setSidebarCollapsed(false);
    setActivePage("home");
    setStudentProfile({
      schoolSystem: "",
      onboardingCompleted: false,
      source: "manual",
    });
  }

  if (!studentProfile.onboardingCompleted) {
    return (
      <OnboardingFlow
        studentProfile={studentProfile}
        setStudentProfile={setStudentProfile}
        subjects={subjects}
        setSubjects={setSubjects}
        theme={theme}
        setTheme={setTheme}
        accentColor={accentColor}
        setAccentColor={setAccentColor}
        layoutDensity={layoutDensity}
        setLayoutDensity={setLayoutDensity}
        homeLayout={homeLayout}
        setHomeLayout={setHomeLayout}
        rightRailVisible={rightRailVisible}
        setRightRailVisible={setRightRailVisible}
        rightRailWidgets={rightRailWidgets}
        setRightRailWidgets={setRightRailWidgets}
        onComplete={completeOnboarding}
      />
    );
  }

  return (
    <main
      className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${
        rightRailVisible ? "right-rail-visible" : ""
      } ${rightRailCollapsed ? "right-rail-collapsed" : ""}`}
    >
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
            label="Calendar"
            icon="▦"
            active={activePage === "calendar"}
            onClick={() => setActivePage("calendar")}
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
            tasks={tasks}
            subjects={subjects}
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
            subjects={subjects}
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

        {activePage === "calendar" && (
          <CalendarPage
            tasks={tasks}
            subjects={subjects}
            setActivePage={setActivePage}
            addTaskToList={addTaskToList}
          />
        )}

        {activePage === "settings" && (
          <SettingsPage
            subjects={subjects}
            setSubjects={setSubjects}
            theme={theme}
            setTheme={setTheme}
            accentColor={accentColor}
            setAccentColor={setAccentColor}
            layoutDensity={layoutDensity}
            setLayoutDensity={setLayoutDensity}
            homeLayout={homeLayout}
            setHomeLayout={setHomeLayout}
            rightRailVisible={rightRailVisible}
            setRightRailVisible={setRightRailVisible}
            rightRailWidgets={rightRailWidgets}
            setRightRailWidgets={setRightRailWidgets}
            restartOnboarding={restartOnboarding}
            resetTasks={resetTasks}
            resetSubjects={resetSubjects}
            resetAppearancePreferences={resetAppearancePreferences}
            clearAllStudentHubData={clearAllStudentHubData}
          />
        )}
      </section>

      {rightRailVisible && (
        <RightRail
          tasks={tasks}
          planBlocks={planBlocks}
          setActivePage={setActivePage}
          collapsed={rightRailCollapsed}
          setCollapsed={setRightRailCollapsed}
          enabledWidgets={rightRailWidgets}
        />
      )}
    </main>
  );
}

const onboardingSteps = [
  "Welcome",
  "Appearance",
  "School system",
  "Subjects",
  "Workspace",
  "Finish",
];

function OnboardingFlow({
  studentProfile,
  setStudentProfile,
  subjects,
  setSubjects,
  theme,
  setTheme,
  accentColor,
  setAccentColor,
  layoutDensity,
  setLayoutDensity,
  homeLayout,
  setHomeLayout,
  rightRailVisible,
  setRightRailVisible,
  rightRailWidgets,
  setRightRailWidgets,
  onComplete,
}) {
  const [step, setStep] = useState(0);
  const [subjectDraft, setSubjectDraft] = useState(() =>
    createSubjectDraft(studentProfile.schoolSystem || "Other")
  );
  const [subjectError, setSubjectError] = useState("");
  const subjectNameInputRef = useRef(null);

  function selectSchoolSystem(schoolSystem) {
    setStudentProfile((currentProfile) => ({
      ...currentProfile,
      schoolSystem,
      source: "manual",
    }));
    setSubjectDraft((currentDraft) => ({
      ...currentDraft,
      courseSystem: schoolSystem,
      level:
        schoolSystem === "IB"
          ? "HL"
          : schoolSystem === "AP"
            ? "AP"
            : schoolSystem === "GCSE" || schoolSystem === "A-level"
              ? "Higher"
              : "Standard",
    }));
  }

  function toggleWidget(widgetId) {
    setRightRailWidgets((currentWidgets) => {
      const nextWidgets = currentWidgets.includes(widgetId)
        ? currentWidgets.filter((currentWidget) => currentWidget !== widgetId)
        : [...currentWidgets, widgetId];

      return rightRailWidgetOptions
        .filter((option) => nextWidgets.includes(option.value))
        .map((option) => option.value);
    });
  }

  function addOnboardingSubject(event) {
    event.preventDefault();
    const name = subjectDraft.name.trim();
    const duplicateSubject = subjects.some(
      (subject) =>
        subject.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase()
    );

    if (!name) return;

    if (duplicateSubject) {
      setSubjectError("That subject is already in your workspace.");
      return;
    }

    setSubjects((currentSubjects) => [
      ...currentSubjects,
      {
        id: `subject-${Date.now()}`,
        ...subjectDraft,
        name,
        source: "manual",
        classroomCourseId: null,
      },
    ]);
    setSubjectDraft(
      createSubjectDraft(studentProfile.schoolSystem || "Other")
    );
    setSubjectError("");
    requestAnimationFrame(() => subjectNameInputRef.current?.focus());
  }

  function goForward() {
    if (step === 2 && !studentProfile.schoolSystem) {
      selectSchoolSystem("Other");
    }

    setStep((currentStep) => Math.min(currentStep + 1, onboardingSteps.length - 1));
  }

  return (
    <main className="onboarding-shell">
      <section className="onboarding-frame">
        <header className="onboarding-topbar">
          <div className="onboarding-brand">
            <span>SH</span>
            <div>
              <strong>Student Hub</strong>
              <small>Local workspace setup</small>
            </div>
          </div>
          {step < onboardingSteps.length - 1 && (
            <button type="button" onClick={onComplete}>
              Skip setup
            </button>
          )}
        </header>

        <div className="onboarding-progress" aria-label="Onboarding progress">
          {onboardingSteps.map((label, index) => (
            <span
              key={label}
              className={`${index === step ? "active" : ""} ${
                index < step ? "complete" : ""
              }`}
              aria-current={index === step ? "step" : undefined}
            >
              <i>{index + 1}</i>
              <small>{label}</small>
            </span>
          ))}
        </div>

        <div className="onboarding-content" key={step}>
          {step === 0 && (
            <div className="onboarding-welcome">
              <p className="eyebrow">Welcome</p>
              <h1>Set up school around the way you work.</h1>
              <p>
                Plan schoolwork, deadlines, subjects, and study time in one
                calm workspace. This setup stays on this device.
              </p>
              <div className="onboarding-value-grid">
                <div>
                  <strong>See what matters</strong>
                  <span>Keep tasks, deadlines, and plans together.</span>
                </div>
                <div>
                  <strong>Make it yours</strong>
                  <span>Choose the layout and subjects that fit you.</span>
                </div>
                <div>
                  <strong>Ready for later</strong>
                  <span>Your local setup can support future school tools.</span>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="onboarding-step">
              <div className="onboarding-step-heading">
                <p className="eyebrow">Appearance</p>
                <h2>Choose a workspace that feels comfortable.</h2>
                <p>These are the same controls you can change in Settings.</p>
              </div>

              <div className="onboarding-setting-row">
                <div>
                  <strong>Theme</strong>
                  <span>Set the overall surface and contrast.</span>
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

              <div className="onboarding-setting-row">
                <div>
                  <strong>Accent colour</strong>
                  <span>Used for actions and selected states.</span>
                </div>
                <div className="accent-controls">
                  <div className="accent-presets">
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
                      onChange={(event) => setAccentColor(event.target.value)}
                    />
                  </label>
                </div>
              </div>

              <div className="onboarding-setting-row">
                <div>
                  <strong>Layout density</strong>
                  <span>Choose breathing room or a tighter workspace.</span>
                </div>
                <div className="theme-toggle" role="group" aria-label="Density">
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
            </div>
          )}

          {step === 2 && (
            <div className="onboarding-step">
              <div className="onboarding-step-heading">
                <p className="eyebrow">School system</p>
                <h2>What course system do you use?</h2>
                <p>This gives new subjects a useful default. You can mix systems later.</p>
              </div>
              <div className="onboarding-choice-grid">
                {subjectCourseSystems.map((schoolSystem) => (
                  <button
                    key={schoolSystem}
                    type="button"
                    className={
                      studentProfile.schoolSystem === schoolSystem ? "active" : ""
                    }
                    aria-pressed={studentProfile.schoolSystem === schoolSystem}
                    onClick={() => selectSchoolSystem(schoolSystem)}
                  >
                    <strong>{schoolSystem}</strong>
                    <span>{getSchoolSystemDescription(schoolSystem)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="onboarding-step onboarding-subjects-step">
              <div className="onboarding-step-heading">
                <p className="eyebrow">Subjects</p>
                <h2>Add the classes you are studying.</h2>
                <p>Add your main subjects now, or finish setup and add them later.</p>
              </div>

              <form className="onboarding-subject-form" onSubmit={addOnboardingSubject}>
                <div className="onboarding-subject-form-heading">
                  <div>
                    <strong>New subject</strong>
                    <span>Grades are optional and can be updated later.</span>
                  </div>
                  <span
                    className="onboarding-subject-colour-preview"
                    style={{ "--subject-color": subjectDraft.colour }}
                    aria-hidden="true"
                  />
                </div>
                <div className="subject-form-grid">
                  <label className="onboarding-subject-name-field">
                    <span>Subject name</span>
                    <input
                      ref={subjectNameInputRef}
                      type="text"
                      value={subjectDraft.name}
                      placeholder="e.g. Biology"
                      onChange={(event) =>
                        setSubjectDraft({ ...subjectDraft, name: event.target.value })
                      }
                    />
                  </label>
                  <label className="onboarding-subject-system-field">
                    <span>Course system</span>
                    <select
                      value={subjectDraft.courseSystem}
                      onChange={(event) =>
                        setSubjectDraft({
                          ...subjectDraft,
                          courseSystem: event.target.value,
                        })
                      }
                    >
                      {subjectCourseSystems.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label className="onboarding-subject-level-field">
                    <span>Level</span>
                    <select
                      value={subjectDraft.level}
                      onChange={(event) =>
                        setSubjectDraft({ ...subjectDraft, level: event.target.value })
                      }
                    >
                      {subjectLevels.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label className="onboarding-subject-grade-field">
                    <span>Current grade</span>
                    <input
                      type="text"
                      value={subjectDraft.currentGrade}
                      placeholder="Optional"
                      onChange={(event) =>
                        setSubjectDraft({
                          ...subjectDraft,
                          currentGrade: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="onboarding-subject-grade-field">
                    <span>Target grade</span>
                    <input
                      type="text"
                      value={subjectDraft.targetGrade}
                      placeholder="Optional"
                      onChange={(event) =>
                        setSubjectDraft({
                          ...subjectDraft,
                          targetGrade: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="subject-colour-field">
                    <span>Subject colour</span>
                    <span>
                      <input
                        type="color"
                        value={subjectDraft.colour}
                        onChange={(event) =>
                          setSubjectDraft({
                            ...subjectDraft,
                            colour: event.target.value,
                          })
                        }
                      />
                      <strong>{subjectDraft.colour.toUpperCase()}</strong>
                    </span>
                  </label>
                </div>
                {subjectError && <p className="subject-form-error">{subjectError}</p>}
                <div className="onboarding-subject-form-actions">
                  <span>Saved to Subject Profiles</span>
                  <button className="small-button" type="submit">
                    + Add subject
                  </button>
                </div>
              </form>

              <div className="onboarding-subject-results" aria-live="polite">
                <div className="onboarding-subject-results-heading">
                  <strong>Your subjects</strong>
                  <span>{subjects.length} added</span>
                </div>
                <div className="onboarding-subject-list">
                  {subjects.length > 0 ? (
                    subjects.map((subject) => (
                      <span
                        key={subject.id}
                        style={{ "--subject-color": subject.colour }}
                      >
                        <i />
                        <strong>{subject.name}</strong>
                        <small>
                          {subject.courseSystem} · {subject.level}
                        </small>
                      </span>
                    ))
                  ) : (
                    <p>
                      Add your main subjects now, or finish setup and add them
                      later in Settings.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="onboarding-step">
              <div className="onboarding-step-heading">
                <p className="eyebrow">Workspace</p>
                <h2>Decide how much context you want at a glance.</h2>
                <p>Keep Home focused, or show a broader school overview.</p>
              </div>
              <div className="onboarding-setting-row">
                <div>
                  <strong>Home layout</strong>
                  <span>Choose the amount of information shown on Home.</span>
                </div>
                <div className="theme-toggle">
                  {["focused", "dashboard"].map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={homeLayout === option ? "active" : ""}
                      onClick={() => setHomeLayout(option)}
                    >
                      {option === "focused" ? "Focused" : "Dashboard"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="onboarding-setting-row">
                <div>
                  <strong>Right rail</strong>
                  <span>Show compact school context beside your workspace.</span>
                </div>
                <div className="theme-toggle">
                  <button
                    type="button"
                    className={rightRailVisible ? "active" : ""}
                    onClick={() => setRightRailVisible(true)}
                  >
                    On
                  </button>
                  <button
                    type="button"
                    className={!rightRailVisible ? "active" : ""}
                    onClick={() => setRightRailVisible(false)}
                  >
                    Off
                  </button>
                </div>
              </div>
              {rightRailVisible && (
                <div className="onboarding-widget-options">
                  {rightRailWidgetOptions.map((option) => (
                    <label key={option.value}>
                      <input
                        type="checkbox"
                        checked={rightRailWidgets.includes(option.value)}
                        onChange={() => toggleWidget(option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="onboarding-finish">
              <span className="onboarding-finish-mark">✓</span>
              <p className="eyebrow">Ready</p>
              <h2>Your workspace is set up.</h2>
              <p>You can change any of these choices later in Settings.</p>
              <div className="onboarding-summary">
                <span><small>School system</small><strong>{studentProfile.schoolSystem || "Other"}</strong></span>
                <span><small>Subjects</small><strong>{subjects.length}</strong></span>
                <span><small>Home</small><strong>{homeLayout === "focused" ? "Focused" : "Dashboard"}</strong></span>
                <span><small>Right rail</small><strong>{rightRailVisible ? "On" : "Off"}</strong></span>
              </div>
            </div>
          )}
        </div>

        <footer className="onboarding-actions">
          <button
            type="button"
            className="onboarding-back"
            disabled={step === 0}
            onClick={() => setStep((currentStep) => Math.max(0, currentStep - 1))}
          >
            Back
          </button>
          <span>Step {step + 1} of {onboardingSteps.length}</span>
          <button
            type="button"
            className="onboarding-next"
            onClick={step === onboardingSteps.length - 1 ? onComplete : goForward}
          >
            {step === 0
              ? "Get started"
              : step === onboardingSteps.length - 1
                ? "Enter Student Hub"
                : "Continue"}
          </button>
        </footer>
      </section>
    </main>
  );
}

function getSchoolSystemDescription(schoolSystem) {
  const descriptions = {
    IB: "International Baccalaureate",
    AP: "Advanced Placement",
    GCSE: "GCSE courses",
    "A-level": "A-level courses",
    Other: "Another school system",
  };

  return descriptions[schoolSystem];
}

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

function HomePage({
  tasks,
  subjects,
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

function SubjectField({ subjects, value, onChange, placeholder = "Subject" }) {
  const matchedSubject = findSubjectProfile(subjects, value);

  if (subjects.length === 0) {
    return (
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        required
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <select
      value={value}
      required
      aria-label="Subject"
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="" disabled>
        Choose subject
      </option>
      {!matchedSubject && value && <option value={value}>{value}</option>}
      {subjects.map((subject) => (
        <option key={subject.id} value={subject.name}>
          {subject.name}
        </option>
      ))}
    </select>
  );
}

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

function TasksPage({
  subjects,
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
            <SubjectField
              subjects={subjects}
              placeholder="Subject, e.g. Chemistry"
              value={newTask.subject}
              onChange={(subject) =>
                setNewTask({ ...newTask, subject })
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
            subjects={subjects}
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
                subjects={subjects}
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
                subjects={subjects}
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
                subjects={subjects}
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
  subjects,
  setSubjects,
  theme,
  setTheme,
  accentColor,
  setAccentColor,
  layoutDensity,
  setLayoutDensity,
  homeLayout,
  setHomeLayout,
  rightRailVisible,
  setRightRailVisible,
  rightRailWidgets,
  setRightRailWidgets,
  restartOnboarding,
  resetTasks,
  resetSubjects,
  resetAppearancePreferences,
  clearAllStudentHubData,
}) {
  const [settingsView, setSettingsView] = useState("hub");
  const viewCopy = {
    hub: {
      eyebrow: "Settings",
      title: "Settings",
      description: "Manage your workspace preferences and future connections.",
    },
    appearance: {
      eyebrow: "Settings / Appearance",
      title: "Appearance",
      description: "Personalise how Student Hub looks and feels.",
    },
    subjects: {
      eyebrow: "Settings / Subjects",
      title: "Subjects",
      description: "Keep your courses and grade goals organised in one place.",
    },
    data: {
      eyebrow: "Settings / Data",
      title: "Data & reset",
      description: "Manage local Student Hub data and workspace defaults.",
    },
  };
  const currentViewCopy = viewCopy[settingsView];

  function toggleRightRailWidget(widgetId) {
    setRightRailWidgets((currentWidgets) => {
      const selectedWidgets = currentWidgets.includes(widgetId)
        ? currentWidgets.filter((currentWidget) => currentWidget !== widgetId)
        : [...currentWidgets, widgetId];

      return rightRailWidgetOptions
        .filter((option) => selectedWidgets.includes(option.value))
        .map((option) => option.value);
    });
  }

  return (
    <div className={`page settings-page settings-view-${settingsView}`}>
      <header className="page-header">
        {settingsView !== "hub" && (
          <button
            type="button"
            className="settings-back-button"
            onClick={() => setSettingsView("hub")}
          >
            ← Settings
          </button>
        )}
        <p className="eyebrow">{currentViewCopy.eyebrow}</p>
        <h2>{currentViewCopy.title}</h2>
        <p>{currentViewCopy.description}</p>
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
              <small>Theme, colour, density, and workspace layout</small>
            </span>
            <span className="settings-hub-arrow" aria-hidden="true">
              →
            </span>
          </button>

          <button
            type="button"
            className="settings-hub-card"
            onClick={() => setSettingsView("subjects")}
          >
            <span>
              <strong>Subjects</strong>
              <small>Courses, levels, grade goals, and colours</small>
            </span>
            <span className="settings-hub-arrow" aria-hidden="true">
              →
            </span>
          </button>

          <button
            type="button"
            className="settings-hub-card"
            onClick={() => setSettingsView("data")}
          >
            <span>
              <strong>Data & reset</strong>
              <small>Local data, workspace resets, and onboarding</small>
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
      ) : settingsView === "appearance" ? (
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

            <div className="theme-setting right-rail-setting">
              <div>
                <h3>Right rail</h3>
                <p>Show compact school context beside the workspace.</p>
              </div>

              <div
                className="theme-toggle right-rail-toggle"
                role="group"
                aria-label="Right rail"
              >
                {[
                  ["On", true],
                  ["Off", false],
                ].map(([label, value]) => (
                  <button
                    key={label}
                    type="button"
                    className={rightRailVisible === value ? "active" : ""}
                    aria-pressed={rightRailVisible === value}
                    onClick={() => setRightRailVisible(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="theme-setting rail-widgets-setting">
              <div>
                <h3>Rail widgets</h3>
                <p>Choose the school context shown in the right rail.</p>
              </div>

              <div className="rail-widget-options">
                {rightRailWidgetOptions.map((option) => (
                  <label className="rail-widget-option" key={option.value}>
                    <input
                      type="checkbox"
                      checked={rightRailWidgets.includes(option.value)}
                      onChange={() => toggleRightRailWidget(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : settingsView === "subjects" ? (
        <SubjectsSettings subjects={subjects} setSubjects={setSubjects} />
      ) : (
        <DataSettings
          resetTasks={resetTasks}
          resetSubjects={resetSubjects}
          resetAppearancePreferences={resetAppearancePreferences}
          restartOnboarding={restartOnboarding}
          clearAllStudentHubData={clearAllStudentHubData}
        />
      )}
    </div>
  );
}

function DataSettings({
  resetTasks,
  resetSubjects,
  resetAppearancePreferences,
  restartOnboarding,
  clearAllStudentHubData,
}) {
  const [pendingReset, setPendingReset] = useState(null);
  const resetOptions = [
    {
      id: "tasks",
      title: "Reset tasks",
      description: "Remove all tasks and clear the current generated plan.",
      confirmation: "All active, backlog, and completed tasks will be removed.",
      confirmLabel: "Reset tasks",
      action: resetTasks,
      destructive: true,
    },
    {
      id: "subjects",
      title: "Reset subjects",
      description: "Remove Subject Profiles without deleting any tasks.",
      confirmation:
        "Saved subjects, course details, grades, and subject colours will be removed. Existing task subject names will remain.",
      confirmLabel: "Reset subjects",
      action: resetSubjects,
      destructive: true,
    },
    {
      id: "appearance",
      title: "Reset appearance",
      description: "Restore theme, accent, density, Home, and rail defaults.",
      confirmation:
        "Your visual and workspace layout preferences will return to their default values. Tasks and subjects will stay untouched.",
      confirmLabel: "Reset appearance",
      action: resetAppearancePreferences,
    },
    {
      id: "onboarding",
      title: "Restart onboarding",
      description: "Run local workspace setup again without deleting your work.",
      confirmation:
        "Onboarding will open again. Your tasks, subjects, and current preferences will remain available.",
      confirmLabel: "Restart onboarding",
      action: restartOnboarding,
    },
    {
      id: "all",
      title: "Clear all local app data",
      description: "Return Student Hub to a clean first-time state.",
      confirmation:
        "Tasks, subjects, profile, onboarding status, preferences, and the current plan will all be removed from this device.",
      confirmLabel: "Clear all data",
      action: clearAllStudentHubData,
      destructive: true,
    },
  ];

  useEffect(() => {
    if (!pendingReset) return undefined;

    function closeOnEscape(event) {
      if (event.key === "Escape") setPendingReset(null);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [pendingReset]);

  function confirmReset() {
    if (!pendingReset) return;

    pendingReset.action();
    setPendingReset(null);
  }

  return (
    <div className="data-settings">
      <section className="panel data-panel">
        <div className="data-panel-intro">
          <div>
            <p className="settings-group-label">Stored on this device</p>
            <h3>Local workspace data</h3>
            <p>
              These controls only affect Student Hub data saved in this
              browser. Other site data is never touched.
            </p>
          </div>
          <span>Local only</span>
        </div>

        <div className="data-reset-list">
          {resetOptions.map((option) => (
            <div
              className={`data-reset-row ${
                option.destructive ? "destructive" : ""
              }`}
              key={option.id}
            >
              <div>
                <h3>{option.title}</h3>
                <p>{option.description}</p>
              </div>
              <button type="button" onClick={() => setPendingReset(option)}>
                {option.id === "onboarding"
                  ? "Restart"
                  : option.id === "all"
                    ? "Clear"
                    : "Reset"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {pendingReset && (
        <div
          className="data-confirmation-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPendingReset(null);
          }}
        >
          <section
            className={`data-confirmation ${
              pendingReset.destructive ? "destructive" : ""
            }`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="data-confirmation-title"
            aria-describedby="data-confirmation-description"
          >
            <div>
              <p className="settings-group-label">Confirm action</p>
              <h3 id="data-confirmation-title">{pendingReset.title}?</h3>
              <p id="data-confirmation-description">
                {pendingReset.confirmation}
              </p>
            </div>
            <div className="data-confirmation-actions">
              <button
                type="button"
                className="data-cancel-button"
                autoFocus
                onClick={() => setPendingReset(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="data-confirm-button"
                onClick={confirmReset}
              >
                {pendingReset.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function createSubjectDraft(courseSystem = "IB") {
  return {
    name: "",
    courseSystem,
    level:
      courseSystem === "IB"
        ? "HL"
        : courseSystem === "AP"
          ? "AP"
          : courseSystem === "GCSE" || courseSystem === "A-level"
            ? "Higher"
            : "Standard",
    currentGrade: "",
    targetGrade: "",
    colour: DEFAULT_SUBJECT_COLOR,
  };
}

function SubjectsSettings({ subjects, setSubjects }) {
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [subjectDraft, setSubjectDraft] = useState(createSubjectDraft);
  const [subjectFormError, setSubjectFormError] = useState("");

  function openAddSubject() {
    setEditingSubjectId(null);
    setSubjectDraft(createSubjectDraft());
    setSubjectFormError("");
    setShowSubjectForm(true);
  }

  function openEditSubject(subject) {
    setEditingSubjectId(subject.id);
    setSubjectDraft({
      name: subject.name,
      courseSystem: subject.courseSystem,
      level: subject.level,
      currentGrade: subject.currentGrade,
      targetGrade: subject.targetGrade,
      colour: subject.colour,
    });
    setSubjectFormError("");
    setShowSubjectForm(true);
  }

  function closeSubjectForm() {
    setShowSubjectForm(false);
    setEditingSubjectId(null);
    setSubjectFormError("");
  }

  function saveSubject(event) {
    event.preventDefault();
    const name = subjectDraft.name.trim();
    const duplicateSubject = subjects.some(
      (subject) =>
        subject.id !== editingSubjectId &&
        subject.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase()
    );

    if (!name) return;

    if (duplicateSubject) {
      setSubjectFormError("A subject with this name already exists.");
      return;
    }

    if (editingSubjectId) {
      setSubjects((currentSubjects) =>
        currentSubjects.map((subject) =>
          subject.id === editingSubjectId
            ? { ...subject, ...subjectDraft, name, source: subject.source || "manual" }
            : subject
        )
      );
    } else {
      setSubjects((currentSubjects) => [
        ...currentSubjects,
        {
          id: `subject-${Date.now()}`,
          ...subjectDraft,
          name,
          source: "manual",
          classroomCourseId: null,
        },
      ]);
    }

    closeSubjectForm();
  }

  function deleteSubject(subjectId) {
    setSubjects((currentSubjects) =>
      currentSubjects.filter((subject) => subject.id !== subjectId)
    );

    if (editingSubjectId === subjectId) closeSubjectForm();
  }

  return (
    <div className="subjects-settings">
      <div className="panel subjects-panel">
        <div className="panel-header subjects-panel-header">
          <div>
            <h3>Subject profiles</h3>
            <p>Task names stay compatible even if a profile is removed.</p>
          </div>
          <button className="small-button" type="button" onClick={openAddSubject}>
            + Add subject
          </button>
        </div>

        {showSubjectForm && (
          <form className="subject-profile-form" onSubmit={saveSubject}>
            <div className="subject-form-grid">
              <label>
                <span>Subject name</span>
                <input
                  type="text"
                  value={subjectDraft.name}
                  placeholder="e.g. Biology"
                  required
                  onChange={(event) =>
                    setSubjectDraft({ ...subjectDraft, name: event.target.value })
                  }
                />
              </label>

              <label>
                <span>Course system</span>
                <select
                  value={subjectDraft.courseSystem}
                  onChange={(event) =>
                    setSubjectDraft({
                      ...subjectDraft,
                      courseSystem: event.target.value,
                    })
                  }
                >
                  {subjectCourseSystems.map((courseSystem) => (
                    <option key={courseSystem} value={courseSystem}>
                      {courseSystem}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Level</span>
                <select
                  value={subjectDraft.level}
                  onChange={(event) =>
                    setSubjectDraft({ ...subjectDraft, level: event.target.value })
                  }
                >
                  {subjectLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Current grade</span>
                <input
                  type="text"
                  value={subjectDraft.currentGrade}
                  placeholder="e.g. 5, B, 82%"
                  onChange={(event) =>
                    setSubjectDraft({
                      ...subjectDraft,
                      currentGrade: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>Target grade</span>
                <input
                  type="text"
                  value={subjectDraft.targetGrade}
                  placeholder="e.g. 7, A, 90%"
                  onChange={(event) =>
                    setSubjectDraft({
                      ...subjectDraft,
                      targetGrade: event.target.value,
                    })
                  }
                />
              </label>

              <label className="subject-colour-field">
                <span>Subject colour</span>
                <span>
                  <input
                    type="color"
                    value={subjectDraft.colour}
                    aria-label="Subject colour"
                    onChange={(event) =>
                      setSubjectDraft({
                        ...subjectDraft,
                        colour: event.target.value,
                      })
                    }
                  />
                  <strong>{subjectDraft.colour.toUpperCase()}</strong>
                </span>
              </label>
            </div>

            {subjectFormError && (
              <p className="subject-form-error">{subjectFormError}</p>
            )}

            <div className="subject-form-actions">
              <button className="primary-button" type="submit">
                {editingSubjectId ? "Save changes" : "Add subject"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={closeSubjectForm}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {subjects.length > 0 ? (
          <div className="subject-profile-list">
            {subjects.map((subject) => (
              <article
                className="subject-profile-card"
                key={subject.id}
                style={{ "--subject-color": subject.colour }}
              >
                <span className="subject-profile-colour" aria-hidden="true" />
                <div className="subject-profile-copy">
                  <div>
                    <h3>{subject.name}</h3>
                    <span>
                      {subject.courseSystem} · {subject.level}
                    </span>
                  </div>
                  <p>
                    Current <strong>{subject.currentGrade || "Not set"}</strong>
                    <i aria-hidden="true">→</i>
                    Target <strong>{subject.targetGrade || "Not set"}</strong>
                  </p>
                </div>
                <div className="subject-profile-actions">
                  <button type="button" onClick={() => openEditSubject(subject)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="subject-delete-button"
                    onClick={() => deleteSubject(subject.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="subject-empty-state">
            <h3>No subject profiles yet.</h3>
            <p>Add a course to use it across tasks and school calendars.</p>
          </div>
        )}
      </div>
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

function TaskCard({
  task,
  subjects,
  onToggle,
  onDelete,
  onUpdate,
  completed = false,
}) {
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
  const subjectProfile = findSubjectProfile(subjects, task.subject);
  const subjectStyle = subjectProfile
    ? { "--subject-color": subjectProfile.colour }
    : undefined;

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
          <SubjectField
            subjects={subjects}
            value={draftTask.subject}
            onChange={(subject) =>
              setDraftTask({ ...draftTask, subject })
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
      <div
        className={`task-card ${completed ? "completed" : ""} ${
          subjectProfile ? "has-subject-colour" : ""
        }`}
        style={subjectStyle}
      >
      <button className="task-main" onClick={() => onToggle(task.id)}>
        <span className={`check-circle ${completed ? "checked" : ""}`}>
          {completed ? "✓" : ""}
        </span>

        <div className="task-content">
          <div className="task-topline">
            <span className="task-subject-label">{task.subject}</span>
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
