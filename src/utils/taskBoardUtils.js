import { formatDateKey, getEffectiveTaskClassification } from "./appUtils.js";

const PRIORITY_COLUMNS = [
  { id: "urgent", label: "Urgent", importance: "urgent" },
  { id: "high", label: "High", importance: "high" },
  { id: "normal", label: "Normal", importance: "normal" },
];

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

function parseTaskDate(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
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
  const classification = getEffectiveTaskClassification(task).assessmentClassification;
  if (classification === "formative") return "Formative";
  if (classification === "summative") return "Summative";
  return "";
}

export function createDueDateBoardColumns(tasks, now = new Date()) {
  const eligibleTasks = (Array.isArray(tasks) ? tasks : []).filter(isEligibleBoardTask);
  const today = startOfLocalDay(now);
  const todayKey = formatDateKey(today);
  const rollingDates = Array.from({ length: 6 }, (_, index) => addLocalDays(today, index));
  const finalDate = rollingDates[rollingDates.length - 1];
  const columns = [
    { id: "overdue", label: "Overdue", kind: "overdue", tasks: [] },
    ...rollingDates.map((date, index) => ({
      id: `date:${formatDateKey(date)}`,
      label:
        index === 0
          ? "Today"
          : index === 1
            ? "Tomorrow"
            : date.toLocaleDateString("en-US", { weekday: "long" }),
      dateLabel: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      dateKey: formatDateKey(date),
      kind: "date",
      tasks: [],
    })),
    { id: "later", label: "Later", kind: "later", tasks: [] },
    { id: "unscheduled", label: "Unscheduled", kind: "unscheduled", tasks: [] },
  ];
  const overdueColumn = columns[0];
  const laterColumn = columns[columns.length - 2];
  const unscheduledColumn = columns[columns.length - 1];
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

