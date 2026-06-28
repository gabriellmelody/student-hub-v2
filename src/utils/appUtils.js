export const defaultTasks = [
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

export const COMPLETED_TASK_RETENTION_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_ACCENT_COLOR = "#6366f1";
export const DEFAULT_SUBJECT_COLOR = "#2563eb";
export const STUDENT_HUB_STORAGE_KEYS = [
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
export const subjectCourseSystems = ["IB", "AP", "GCSE", "A-level", "Other"];
export const subjectLevels = ["HL", "SL", "AP", "Standard", "Higher", "Other"];
export const accentColorPresets = [
  { label: "Indigo", value: DEFAULT_ACCENT_COLOR },
  { label: "Purple", value: "#7c3aed" },
  { label: "Blue", value: "#2563eb" },
  { label: "Green", value: "#16865c" },
  { label: "Orange", value: "#d76516" },
  { label: "Pink", value: "#d9468c" },
  { label: "Red", value: "#dc3f4f" },
];
export const rightRailWidgetOptions = [
  { value: "clock", label: "Clock" },
  { value: "calendar", label: "School calendar" },
  { value: "deadlines", label: "Upcoming deadlines" },
  { value: "plan", label: "Today’s plan" },
];

export function normalizeHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value || "")
    ? value.toLowerCase()
    : DEFAULT_ACCENT_COLOR;
}

export function hexToRgb(hex) {
  const value = normalizeHexColor(hex).slice(1);

  return {
    red: parseInt(value.slice(0, 2), 16),
    green: parseInt(value.slice(2, 4), 16),
    blue: parseInt(value.slice(4, 6), 16),
  };
}

export function rgbToHex({ red, green, blue }) {
  return `#${[red, green, blue]
    .map((value) => Math.round(value).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function mixColors(color, target, amount) {
  const sourceRgb = hexToRgb(color);
  const targetRgb = hexToRgb(target);

  return rgbToHex({
    red: sourceRgb.red + (targetRgb.red - sourceRgb.red) * amount,
    green: sourceRgb.green + (targetRgb.green - sourceRgb.green) * amount,
    blue: sourceRgb.blue + (targetRgb.blue - sourceRgb.blue) * amount,
  });
}

export function getRelativeLuminance(color) {
  const { red, green, blue } = hexToRgb(color);
  const channels = [red, green, blue].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function getContrastRatio(firstColor, secondColor) {
  const firstLuminance = getRelativeLuminance(firstColor);
  const secondLuminance = getRelativeLuminance(secondColor);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

export function getContrastText(accentColor) {
  const lightText = "#ffffff";
  const darkText = "#18181b";

  return getContrastRatio(accentColor, lightText) >=
    getContrastRatio(accentColor, darkText)
    ? lightText
    : darkText;
}

export function getReadableAccent(accentColor, theme) {
  const background = theme === "dark" ? "#0d0d0f" : "#f7f7f5";
  const target = theme === "dark" ? "#ffffff" : "#18181b";

  for (let step = 0; step <= 10; step += 1) {
    const candidate = mixColors(accentColor, target, step / 10);
    if (getContrastRatio(candidate, background) >= 4.5) return candidate;
  }

  return target;
}

export function colorToRgba(color, alpha) {
  const { red, green, blue } = hexToRgb(color);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function loadTasks() {
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

export function loadRightRailWidgets() {
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

export function loadSubjects() {
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

export function loadStudentProfile() {
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

export function findSubjectProfile(subjects, subjectName) {
  const normalizedName = subjectName?.trim().toLocaleLowerCase();

  if (!normalizedName) return null;

  return (
    subjects.find(
      (subject) => subject.name.trim().toLocaleLowerCase() === normalizedName
    ) || null
  );
}

export function getDaysLeft(dueDate) {
  if (!dueDate) return null;

  const today = new Date();
  const due = new Date(dueDate);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
}

export function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getTaskCalendarEvents(tasks, subjects = []) {
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

export function getMonthCalendarDays(monthDate) {
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

export function getUrgencyLabel(daysLeft) {
  if (daysLeft === null) return "No deadline";
  if (daysLeft < 0) return "Overdue";
  if (daysLeft === 0) return "Due today";
  if (daysLeft === 1) return "Due tomorrow";
  return `${daysLeft} days left`;
}

export function getUrgencyClass(daysLeft) {
  if (daysLeft === null) return "neutral";
  if (daysLeft <= 1) return "urgent";
  if (daysLeft <= 5) return "soon";
  return "safe";
}

export function getEffortLabel(effort) {
  if (effort === 1) return "Easy";
  if (effort === 2 || effort === 3) return "Medium";
  if (effort === 4) return "High";
  return "Max";
}

export function getEffortClass(effort) {
  if (effort === 1) return "effort-low";
  if (effort === 2 || effort === 3) return "effort-medium";
  if (effort === 4) return "effort-high";
  return "effort-max";
}

export function formatTime(startTime, minutesToAdd) {
  const [hours, minutes] = startTime.split(":").map(Number);

  const date = new Date();
  date.setHours(hours, minutes + minutesToAdd, 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getTaskTip(task) {
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

export function compareTasksSmart(a, b) {
  const aDays = getDaysLeft(a.dueDate);
  const bDays = getDaysLeft(b.dueDate);
  const safeADays = aDays === null ? 999 : aDays;
  const safeBDays = bDays === null ? 999 : bDays;

  if (safeADays !== safeBDays) return safeADays - safeBDays;
  return b.effort - a.effort;
}

export function sortTasksForDisplay(taskList) {
  return [...taskList].sort(compareTasksSmart);
}

export const taskSortOptions = [
  { value: "smart", label: "Smart" },
  { value: "dueDate", label: "Due date" },
  { value: "effort", label: "Effort" },
  { value: "subject", label: "Subject" },
];

export function sortTasksByMode(taskList, sortMode) {
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

export function cleanPlanSequence(blocks) {
  if (blocks.some((block) => block.type === "message")) return blocks;

  return blocks.filter((block, index) => {
    if (block.type !== "break") return true;

    const hasStudyBefore = blocks
      .slice(0, index)
      .some((previousBlock) => previousBlock.type === "study");
    const hasStudyAfter = blocks
      .slice(index + 1)
      .some((nextBlock) => nextBlock.type === "study");
    const previousBlock = blocks[index - 1];

    return (
      hasStudyBefore &&
      hasStudyAfter &&
      previousBlock?.type !== "break"
    );
  });
}

export function recalculatePlanTimes(blocks, startTime) {
  let currentOffset = 0;

  return blocks.map((block) => {
    if (block.type === "message") return block;

    const duration = Math.max(1, Math.round(Number(block.duration) || 1));
    const timedBlock = {
      ...block,
      duration,
      start: formatTime(startTime, currentOffset),
      end: formatTime(startTime, currentOffset + duration),
    };

    currentOffset += duration;
    return timedBlock;
  });
}

export function getPlanBlockKey(block, index) {
  if (block.type === "study") return `study-${block.taskId}`;
  if (block.type === "break") return block.id || `break-${index}`;
  return block.id;
}

export function createSubjectDraft(courseSystem = "IB") {
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
