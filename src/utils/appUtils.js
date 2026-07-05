export const defaultTasks = [
  {
    id: "demo-english-essay",
    subject: "English",
    title: "Essay draft",
    dueDate: "2026-06-22",
    effort: 3,
    completed: false,
    source: "demo",
    externalId: null,
    classroomCourseId: null,
    classroomCourseName: null,
    importedAt: null,
    lastSyncedAt: null,
  },
  {
    id: "demo-maths-problem-set",
    subject: "Maths",
    title: "Problem set",
    dueDate: "2026-06-25",
    effort: 2,
    completed: false,
    source: "demo",
    externalId: null,
    classroomCourseId: null,
    classroomCourseName: null,
    importedAt: null,
    lastSyncedAt: null,
  },
  {
    id: "demo-biology-lab-report",
    subject: "Biology",
    title: "Summative lab report",
    dueDate: "2026-07-02",
    effort: 4,
    completed: false,
    source: "demo",
    externalId: null,
    classroomCourseId: null,
    classroomCourseName: null,
    importedAt: null,
    lastSyncedAt: null,
  },
  {
    id: "demo-history-reading",
    subject: "History",
    title: "Chapter reading",
    dueDate: "",
    effort: 1,
    completed: false,
    source: "demo",
    externalId: null,
    classroomCourseId: null,
    classroomCourseName: null,
    importedAt: null,
    lastSyncedAt: null,
  },
];

export function createDemoTasks() {
  const dueDateOffsets = [1, 3, 7, null];

  return defaultTasks.map((task, index) => {
    const dueDateOffset = dueDateOffsets[index];
    const dueDate = new Date();

    if (dueDateOffset !== null) dueDate.setDate(dueDate.getDate() + dueDateOffset);

    return normalizeTask({
      ...task,
      dueDate: dueDateOffset === null ? "" : formatDateKey(dueDate),
    });
  });
}

export const COMPLETED_TASK_RETENTION_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_ACCENT_COLOR = "#6366f1";
export const DEFAULT_SUBJECT_COLOR = "#2563eb";
export const WIDGET_CONFIG_STORAGE_KEY = "student-hub-widget-config";
export const TODAY_PLAN_STORAGE_KEY = "student-hub-today-plan";
export const MOCK_CLASSROOM_COURSE_LINKS_STORAGE_KEY =
  "student-hub-mock-classroom-course-links";
export const MOCK_CLASSROOM_INTEGRATION_STORAGE_KEY =
  "student-hub-mock-classroom-integration";
export const COMPLETED_HISTORY_STORAGE_KEY =
  "student-hub-completed-task-history";
export const MAX_COMPLETED_HISTORY_RECORDS = 500;
export const STUDENT_HUB_STORAGE_KEYS = [
  "student-hub-tasks",
  COMPLETED_HISTORY_STORAGE_KEY,
  "student-hub-subjects",
  "student-hub-student-profile",
  "student-hub-theme",
  "student-hub-accent",
  "student-hub-density",
  "student-hub-home-layout",
  "student-hub-right-rail",
  "student-hub-right-rail-state",
  "student-hub-right-rail-widgets",
  WIDGET_CONFIG_STORAGE_KEY,
  TODAY_PLAN_STORAGE_KEY,
  MOCK_CLASSROOM_COURSE_LINKS_STORAGE_KEY,
  MOCK_CLASSROOM_INTEGRATION_STORAGE_KEY,
  "student-hub-hours",
  "student-hub-start-time",
];
export const subjectCourseSystems = ["IB", "AP", "GCSE", "A-level", "Other"];
export const subjectLevels = ["HL", "SL", "AP", "Standard", "Higher", "Other"];
export const taskTypeOptions = [
  { value: "homework", label: "Homework" },
  { value: "assessment", label: "Assessment" },
  { value: "revision", label: "Revision" },
  { value: "project", label: "Project" },
  { value: "other", label: "Other" },
];
export const taskImportanceOptions = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];
const assessmentKeywordDefinitions = [
  ["summative", "Summative"],
  ["formative", "Formative"],
  ["coursework", "Coursework"],
  ["presentation", "Presentation"],
  ["assessment", "Assessment"],
  ["exam", "Exam"],
  ["quiz", "Quiz"],
  ["test", "Test"],
  ["mock", "Mock"],
  ["oral", "Oral"],
  ["ia", "IA"],
  ["paper", "Paper"],
];
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
  { value: "plan", label: "Today’s Plan" },
];

export function getDefaultWidgetConfig(homeLayout = "focused") {
  const expandedHome = homeLayout === "dashboard";

  return [
    {
      id: "home-next-focus",
      type: "nextFocus",
      label: "Next focus",
      area: "home",
      visible: true,
      size: "expanded",
      order: 0,
      source: "local",
    },
    {
      id: "home-today-plan",
      type: "todayPlan",
      label: "Today’s Plan",
      area: "home",
      visible: true,
      size: "compact",
      order: 1,
      source: "local",
    },
    {
      id: "home-school-calendar",
      type: "schoolCalendar",
      label: "School calendar",
      area: "home",
      visible: true,
      size: expandedHome ? "expanded" : "compact",
      order: 2,
      source: "local",
    },
    {
      id: "home-progress",
      type: "progress",
      label: "Progress",
      area: "home",
      visible: true,
      size: expandedHome ? "expanded" : "compact",
      order: 3,
      source: "local",
    },
    ...rightRailWidgetOptions.map((option, order) => ({
      id: `right-rail-${option.value}`,
      type: option.value,
      label: option.label,
      area: "rightRail",
      visible: true,
      size: "compact",
      order,
      source: "local",
    })),
  ];
}

export function normalizeWidgetConfig(
  savedConfig,
  homeLayout = "focused",
  legacyRightRailWidgets = null
) {
  const defaults = getDefaultWidgetConfig(homeLayout);

  return defaults.map((defaultWidget) => {
    const savedWidget = Array.isArray(savedConfig)
      ? savedConfig.find((widget) => widget?.id === defaultWidget.id)
      : null;
    const legacyVisibility =
      defaultWidget.area === "rightRail" &&
      Array.isArray(legacyRightRailWidgets)
        ? legacyRightRailWidgets.includes(defaultWidget.type)
        : defaultWidget.visible;

    return {
      ...defaultWidget,
      visible:
        typeof savedWidget?.visible === "boolean"
          ? savedWidget.visible
          : legacyVisibility,
      size:
        savedWidget?.size === "compact" || savedWidget?.size === "expanded"
          ? savedWidget.size
          : defaultWidget.size,
      order: Number.isFinite(Number(savedWidget?.order))
        ? Number(savedWidget.order)
        : defaultWidget.order,
    };
  });
}

export function loadWidgetConfig(homeLayout = "focused") {
  const legacyRightRailWidgets = loadRightRailWidgets();
  const savedConfig = localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY);

  if (!savedConfig) {
    return normalizeWidgetConfig(
      null,
      homeLayout,
      legacyRightRailWidgets
    );
  }

  try {
    return normalizeWidgetConfig(
      JSON.parse(savedConfig),
      homeLayout,
      legacyRightRailWidgets
    );
  } catch {
    return normalizeWidgetConfig(
      null,
      homeLayout,
      legacyRightRailWidgets
    );
  }
}

export function getWidgetsForArea(widgetConfig, area, visibleOnly = true) {
  return widgetConfig
    .filter(
      (widget) =>
        widget.area === area && (!visibleOnly || widget.visible === true)
    )
    .sort((first, second) => first.order - second.order);
}

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

export function normalizeTask(task, fallbackSource = "manual") {
  const normalizedMetadata = applyTaskImportanceDetection(task);

  return {
    ...task,
    ...normalizedMetadata,
    source: task.source || fallbackSource,
    externalId: task.externalId || null,
    classroomCourseId: task.classroomCourseId || null,
    classroomCourseName: task.classroomCourseName || null,
    importedAt: task.importedAt || null,
    sourceUpdatedAt: task.sourceUpdatedAt || null,
    lastSyncedAt: task.lastSyncedAt || null,
  };
}

export function detectTaskImportance(title = "") {
  const detectedTags = assessmentKeywordDefinitions
    .filter(([keyword]) =>
      new RegExp(`\\b${keyword}\\b`, "i").test(String(title))
    )
    .map(([, label]) => label);

  return {
    detectedTags,
    taskType: detectedTags.length > 0 ? "assessment" : "homework",
    importance: detectedTags.length > 0 ? "high" : "normal",
  };
}

export function applyTaskImportanceDetection(task) {
  const detection = detectTaskImportance(
    [task?.title, task?.description].filter(Boolean).join(" ")
  );
  const hasManualOverride = task?.importanceSource === "manual";
  const validTaskTypes = new Set(taskTypeOptions.map((option) => option.value));
  const validImportance = new Set(
    taskImportanceOptions.map((option) => option.value)
  );

  return {
    taskType:
      hasManualOverride && validTaskTypes.has(task?.taskType)
        ? task.taskType
        : detection.taskType,
    importance:
      hasManualOverride && validImportance.has(task?.importance)
        ? task.importance
        : detection.importance,
    detectedTags: detection.detectedTags,
    importanceSource: hasManualOverride ? "manual" : "auto",
  };
}

export function updateTaskTitleWithDetection(task, title) {
  const nextTask = { ...task, title };

  return {
    ...nextTask,
    ...applyTaskImportanceDetection(nextTask),
  };
}

export function getTaskSignalBadges(task) {
  const badges = [];
  const primaryTag = Array.isArray(task?.detectedTags)
    ? task.detectedTags[0]
    : null;

  if (task?.taskType === "assessment") {
    badges.push({
      label: primaryTag || "Assessment",
      tone: "assessment",
    });
  } else if (task?.taskType === "revision") {
    badges.push({ label: "Revision", tone: "type" });
  } else if (task?.taskType === "project") {
    badges.push({ label: "Project", tone: "type" });
  }

  if (task?.importance === "urgent") {
    badges.push({ label: "Urgent importance", tone: "urgent" });
  } else if (
    task?.importance === "high" &&
    task?.taskType !== "assessment"
  ) {
    badges.push({ label: "High importance", tone: "high" });
  }

  return badges.slice(0, 2);
}

function normalizeHistorySource(source) {
  return ["manual", "demo", "classroom", "classroom-mock"].includes(source)
    ? source
    : "manual";
}

export function createCompletedTaskHistoryRecord(task, completedAt = Date.now()) {
  const timestamp = Number(completedAt);
  const safeCompletedAt = Number.isFinite(timestamp) ? timestamp : Date.now();
  const normalizedMetadata = applyTaskImportanceDetection(task);

  return {
    id: `history-${String(task.id)}-${safeCompletedAt}`,
    originalTaskId: task.id ?? null,
    title: String(task.title || "Untitled task").trim() || "Untitled task",
    subject: String(task.subject || "").trim(),
    dueDate: typeof task.dueDate === "string" ? task.dueDate : "",
    completedAt: safeCompletedAt,
    source: normalizeHistorySource(task.source),
    ...normalizedMetadata,
  };
}

function normalizeCompletedTaskHistory(records) {
  if (!Array.isArray(records)) return [];

  const normalizedRecords = records.flatMap((record) => {
    if (!record || typeof record !== "object") return [];

    const completedAt = Number(record.completedAt);

    if (!Number.isFinite(completedAt)) return [];

    const normalizedMetadata = applyTaskImportanceDetection(record);

    return {
      id:
        record.id ||
        `history-${String(record.originalTaskId ?? "unknown")}-${completedAt}`,
      originalTaskId: record.originalTaskId ?? null,
      title:
        String(record.title || "Untitled task").trim() || "Untitled task",
      subject: String(record.subject || "").trim(),
      dueDate: typeof record.dueDate === "string" ? record.dueDate : "",
      completedAt,
      source: normalizeHistorySource(record.source),
      ...normalizedMetadata,
    };
  });

  normalizedRecords.sort(
    (firstRecord, secondRecord) =>
      secondRecord.completedAt - firstRecord.completedAt
  );

  const seenTaskIds = new Set();

  return normalizedRecords
    .filter((record) => {
      const dedupeKey =
        record.originalTaskId == null
          ? `record:${record.id}`
          : `task:${String(record.originalTaskId)}`;

      if (seenTaskIds.has(dedupeKey)) return false;

      seenTaskIds.add(dedupeKey);
      return true;
    })
    .slice(0, MAX_COMPLETED_HISTORY_RECORDS);
}

export function loadCompletedTaskHistory(tasks = []) {
  let savedRecords;

  try {
    const savedHistory = localStorage.getItem(COMPLETED_HISTORY_STORAGE_KEY);
    savedRecords = savedHistory ? JSON.parse(savedHistory) : [];
  } catch {
    savedRecords = [];
  }

  const currentCompletedRecords = tasks
    .filter((task) => task.completed)
    .map((task) =>
      createCompletedTaskHistoryRecord(task, task.completedAt || Date.now())
    );

  return normalizeCompletedTaskHistory([
    ...(Array.isArray(savedRecords) ? savedRecords : []),
    ...currentCompletedRecords,
  ]);
}

export function upsertCompletedTaskHistory(history, task, completedAt) {
  return normalizeCompletedTaskHistory([
    createCompletedTaskHistoryRecord(task, completedAt),
    ...history,
  ]);
}

export function removeTaskFromCompletedHistory(history, taskId) {
  return history.filter(
    (record) => String(record.originalTaskId) !== String(taskId)
  );
}

export function getExternalSourceKey(item) {
  const source = typeof item?.source === "string" ? item.source.trim() : "";
  const externalId =
    typeof item?.externalId === "string" ? item.externalId.trim() : "";

  return source && externalId ? `${source}:${externalId}` : null;
}

export function findExternalSourceMatch(items, candidate) {
  const candidateKey = getExternalSourceKey(candidate);

  if (!candidateKey || !Array.isArray(items)) return null;

  return (
    items.find((item) => getExternalSourceKey(item) === candidateKey) || null
  );
}

export function loadTasks() {
  const savedTasks = localStorage.getItem("student-hub-tasks");

  if (!savedTasks) return [];

  try {
    const parsedTasks = JSON.parse(savedTasks);

    if (!Array.isArray(parsedTasks)) return [];

    const now = Date.now();

    return parsedTasks.flatMap((task) => {
      if (!task || typeof task !== "object") return [];

      const normalizedTask = normalizeTask(task);

      if (!normalizedTask.completed) return normalizedTask;

      const savedCompletedAt = Number(normalizedTask.completedAt);
      const completedAt = Number.isFinite(savedCompletedAt)
        ? savedCompletedAt
        : now;

      if (now - completedAt >= COMPLETED_TASK_RETENTION_MS) return [];

      return { ...normalizedTask, completedAt };
    });
  } catch {
    return [];
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
        externalId: subject.externalId || null,
        importedAt: subject.importedAt || null,
        lastSyncedAt: subject.lastSyncedAt || null,
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
  const normalizedName = normalizeSubjectName(subjectName);

  if (!normalizedName) return null;

  return (
    subjects.find(
      (subject) => normalizeSubjectName(subject.name) === normalizedName
    ) || null
  );
}

export function normalizeSubjectName(subjectName) {
  return typeof subjectName === "string"
    ? subjectName.trim().toLocaleLowerCase().replace(/\s+/g, " ")
    : "";
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
        externalId: task.externalId || null,
        date: task.dueDate,
        title: task.title,
        subject: task.subject,
        subjectName: task.subject,
        subjectId: subjectProfile?.id || null,
        colour: subjectProfile?.colour || null,
        subjectColour: subjectProfile?.colour || null,
        taskSource: task.source || "manual",
        completed: task.completed,
        effort: task.effort,
        taskType: task.taskType,
        importance: task.importance,
        detectedTags: task.detectedTags,
        importanceSource: task.importanceSource,
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

  const importanceScore = { normal: 0, high: 1, urgent: 2 };
  const importanceDifference =
    (importanceScore[b.importance] || 0) -
    (importanceScore[a.importance] || 0);

  if (safeADays !== safeBDays) {
    const dueDateGap = Math.abs(safeADays - safeBDays);
    const bothBeyondImmediateUrgency = safeADays > 1 && safeBDays > 1;

    if (
      dueDateGap <= 1 &&
      bothBeyondImmediateUrgency &&
      importanceDifference !== 0
    ) {
      return importanceDifference;
    }

    return safeADays - safeBDays;
  }

  if (importanceDifference !== 0) return importanceDifference;
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
      const importanceScore = { normal: 0, high: 1, urgent: 2 };
      const importanceDifference =
        (importanceScore[b.importance] || 0) -
        (importanceScore[a.importance] || 0);

      if (importanceDifference !== 0) return importanceDifference;
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
    if (block.source === "manual") return true;

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
  if (block.type === "study") return block.id || `study-${block.taskId}`;
  if (block.type === "break") return block.id || `break-${index}`;
  return block.id;
}

export function loadSavedPlanSnapshot() {
  const savedPlan = localStorage.getItem(TODAY_PLAN_STORAGE_KEY);

  if (!savedPlan) return null;

  try {
    const parsedPlan = JSON.parse(savedPlan);

    if (
      !parsedPlan ||
      typeof parsedPlan !== "object" ||
      !Array.isArray(parsedPlan.blocks) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(parsedPlan.generatedDate || "")
    ) {
      return null;
    }

    return parsedPlan;
  } catch {
    return null;
  }
}

export function isSavedPlanForToday(savedPlan) {
  return savedPlan?.generatedDate === formatDateKey(new Date());
}

export function restoreSavedPlanBlocks(savedPlan, tasks, startTime) {
  if (!savedPlan || !Array.isArray(savedPlan.blocks)) return [];

  const taskIds = new Set(tasks.map((task) => task.id));
  const normalizedBlocks = savedPlan.blocks
    .filter(
      (block) =>
        block &&
        typeof block === "object" &&
        ["study", "break", "message"].includes(block.type)
    )
    .map((block, index) => {
      const hasValidTaskLink =
        block.taskId == null || taskIds.has(block.taskId);
      const taskId = hasValidTaskLink ? (block.taskId ?? null) : null;

      return {
        ...block,
        id: block.id || `restored-${block.type}-${index}`,
        source:
          !hasValidTaskLink && block.source === "generated"
            ? "manual"
            : block.source || (taskId == null ? "manual" : "generated"),
        taskId,
        edited: block.edited === true,
        locked: block.locked === true,
        calendarEventId: block.calendarEventId || null,
      };
    });

  return recalculatePlanTimes(normalizedBlocks, startTime);
}

export function saveTodayPlanSnapshot({
  blocks,
  startTime,
  hoursAvailable,
}) {
  localStorage.setItem(
    TODAY_PLAN_STORAGE_KEY,
    JSON.stringify({
      generatedDate: formatDateKey(new Date()),
      savedAt: new Date().toISOString(),
      startTime,
      hoursAvailable,
      blocks,
    })
  );
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
