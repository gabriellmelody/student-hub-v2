import { formatDateKey, getEffectiveTaskClassification } from "./appUtils.js";

const PRIORITY_COLUMNS = [
  { id: "urgent", label: "Urgent", importance: "urgent" },
  { id: "high", label: "High", importance: "high" },
  { id: "normal", label: "Normal", importance: "normal" },
];

export const TASK_BOARD_VISIBLE_LIMIT = 7;

export function createEmptyTaskDraft() {
  return {
    subject: "",
    title: "",
    description: "",
    dueDate: "",
    dueTime: "",
    effort: 2,
    taskType: "homework",
    importance: "normal",
    detectedTags: [],
    importanceSource: "auto",
  };
}

function startOfLocalDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addLocalDays(value, amount) {
  const date = startOfLocalDay(value);
  date.setDate(date.getDate() + amount);
  return date;
}

export function createTaskDraftForBoardColumn(column, boardMode, now = new Date()) {
  const draft = createEmptyTaskDraft();

  if (boardMode === "priority" && column?.importance) {
    return {
      ...draft,
      importance: column.importance,
      importanceSource: "manual",
    };
  }

  if (column?.kind === "date" && column.dateKey) {
    return { ...draft, dueDate: column.dateKey };
  }
  if (column?.kind === "overdue") {
    return { ...draft, dueDate: formatDateKey(startOfLocalDay(now)) };
  }
  if (column?.kind === "later") {
    return { ...draft, dueDate: formatDateKey(addLocalDays(now, 6)) };
  }

  return draft;
}

export function getVisibleTaskColumnItems(tasks, expanded = false) {
  const taskList = Array.isArray(tasks) ? tasks : [];
  return expanded ? taskList : taskList.slice(0, TASK_BOARD_VISIBLE_LIMIT);
}

function parseTaskDate(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTaskDueTime(value, locale) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ""));
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return "";
  const date = new Date(2000, 0, 1, hours, minutes);
  return date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

export function formatTaskDueLabel(task, now = new Date(), locale) {
  const dueDate = parseTaskDate(task?.dueDate);
  if (!dueDate) return "Unscheduled";

  const today = startOfLocalDay(now);
  const difference = Math.round((dueDate - today) / 86400000);
  const dueTime = formatTaskDueTime(task?.dueTime, locale);
  const suffix = dueTime ? ` · ${dueTime}` : "";
  if (difference < 0) return `Overdue${suffix}`;
  if (difference === 0) return `Due today${suffix}`;
  if (difference === 1) return `Due tomorrow${suffix}`;
  if (difference <= 3) return `Due in ${difference} days${suffix}`;
  return `Due ${dueDate.toLocaleDateString(locale, { month: "short", day: "numeric" })}${suffix}`;
}

export function formatTaskCompletionLabel(task, locale) {
  const value = task?.completedAt;
  if (value == null || value === "") return "Completed";
  const numericValue = Number(value);
  const date = new Date(Number.isFinite(numericValue) ? numericValue : value);
  if (Number.isNaN(date.getTime())) return "Completed";
  return `Completed ${date.toLocaleDateString(locale, { month: "short", day: "numeric" })}`;
}

function getTaskDeadline(task) {
  const date = parseTaskDate(task?.dueDate);
  if (!date) return null;

  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(String(task?.dueTime || ""));
  if (!timeMatch) return date;

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  if (hours > 23 || minutes > 59) return date;

  date.setHours(hours, minutes, 0, 0);
  return date;
}

function isEligibleBoardTask(task) {
  return task && task.completed !== true && task.archived !== true;
}

function sortColumnTasks(tasks) {
  return [...tasks].sort((left, right) => {
    const leftDeadline = getTaskDeadline(left)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightDeadline = getTaskDeadline(right)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (leftDeadline !== rightDeadline) return leftDeadline - rightDeadline;

    const rank = { urgent: 0, high: 1, normal: 2 };
    const priorityDifference =
      (rank[left.importance] ?? rank.normal) -
      (rank[right.importance] ?? rank.normal);
    if (priorityDifference !== 0) return priorityDifference;

    return String(left.title || "").localeCompare(String(right.title || ""));
  });
}

export function getTaskAcademicLabel(task) {
  const tags = Array.isArray(task?.detectedTags) ? task.detectedTags.join(" ") : "";
  const searchable = `${task?.title || ""} ${task?.description || ""} ${tags}`;
  if (/\bc\s*[.-]?\s*f\s*[.-]?\s*a\b|common\s+formative\s+assessment/i.test(searchable)) return "CFA";
  const classification = getEffectiveTaskClassification(task).assessmentClassification;
  if (classification === "formative") return "Formative";
  if (classification === "summative") return "Summative";
  return "";
}

export function createDueDateBoardColumns(tasks, now = new Date()) {
  const eligibleTasks = (Array.isArray(tasks) ? tasks : []).filter(isEligibleBoardTask);
  const today = startOfLocalDay(now);
  const todayKey = formatDateKey(today);
  const tomorrow = addLocalDays(today, 1);
  const finalDate = addLocalDays(today, 6);
  const columns = [
    { id: "overdue", label: "Overdue", kind: "overdue", tasks: [] },
    { id: `date:${todayKey}`, label: "Today", dateKey: todayKey, kind: "date", tasks: [] },
    { id: `date:${formatDateKey(tomorrow)}`, label: "Tomorrow", dateKey: formatDateKey(tomorrow), kind: "date", tasks: [] },
    { id: "next-seven-days", label: "Next 7 Days", kind: "range", tasks: [] },
    { id: "later", label: "Later", kind: "later", tasks: [] },
    { id: "unscheduled", label: "Unscheduled", kind: "unscheduled", tasks: [] },
  ];
  const overdueColumn = columns[0];
  const laterColumn = columns[columns.length - 2];
  const unscheduledColumn = columns[columns.length - 1];
  const nextSevenDaysColumn = columns.find((column) => column.id === "next-seven-days");
  const dateColumns = new Map(
    columns.filter((column) => column.kind === "date").map((column) => [column.dateKey, column])
  );

  eligibleTasks.forEach((task) => {
    const dueDate = parseTaskDate(task.dueDate);
    if (!dueDate) {
      unscheduledColumn.tasks.push(task);
      return;
    }

    const dueKey = formatDateKey(dueDate);
    const deadline = getTaskDeadline(task);
    const isPast =
      dueDate < today ||
      (dueKey === todayKey && Boolean(task.dueTime) && deadline && deadline < now);

    if (isPast) {
      overdueColumn.tasks.push(task);
    } else if (dateColumns.has(dueKey)) {
      dateColumns.get(dueKey).tasks.push(task);
    } else if (dueDate <= finalDate) {
      nextSevenDaysColumn.tasks.push(task);
    } else if (dueDate > finalDate) {
      laterColumn.tasks.push(task);
    }
  });

  return columns.map((column) => ({
    ...column,
    tasks: sortColumnTasks(column.tasks),
  }));
}

export function createPriorityBoardColumns(tasks) {
  const eligibleTasks = (Array.isArray(tasks) ? tasks : []).filter(isEligibleBoardTask);

  return PRIORITY_COLUMNS.map((column) => ({
    ...column,
    tasks: sortColumnTasks(
      eligibleTasks.filter((task) => (task.importance || "normal") === column.importance)
    ),
  }));
}

