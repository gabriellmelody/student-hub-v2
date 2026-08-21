export const SMART_PLANNER_MAX_TASKS = 20;
export const SMART_PLANNER_MAX_BUSY_INTERVALS = 40;
export const SMART_PLANNER_CONTEXT_MAX_LENGTH = 800;
export const SMART_PLANNER_MAX_SUBJECT_PROFILES = 12;

const SMART_PLANNER_GRADE_SYSTEMS = new Set([
  "IB",
  "AP",
  "GCSE",
  "A-level",
  "Other",
]);

export function shouldRequestSmartPlannerAi({
  basic = false,
  remainingGenerations = null,
} = {}) {
  return basic !== true && remainingGenerations !== 0;
}

export function normalizeSmartPlannerContext(value) {
  return typeof value === "string"
    ? value.trim().slice(0, SMART_PLANNER_CONTEXT_MAX_LENGTH)
    : "";
}

function padTimePart(value) {
  return String(value).padStart(2, "0");
}

export function formatMinuteOfDay(minutes) {
  const safeMinutes = Math.min(1439, Math.max(0, Math.round(Number(minutes) || 0)));
  return `${padTimePart(Math.floor(safeMinutes / 60))}:${padTimePart(safeMinutes % 60)}`;
}

export function getNextQuarterHourStart(now = new Date()) {
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const roundedMinute = Math.ceil(currentMinute / 15) * 15;

  if (roundedMinute >= 24 * 60) {
    return {
      available: false,
      minute: null,
      time: "",
    };
  }

  return {
    available: true,
    minute: roundedMinute,
    time: formatMinuteOfDay(roundedMinute),
  };
}

export function getDefaultSmartPlannerDraft({
  now = new Date(),
  calendarAvailable = false,
  hoursAvailable = 2,
} = {}) {
  const start = getNextQuarterHourStart(now);

  if (!start.available) {
    return {
      startTime: "",
      endTime: "",
      planStyle: "balanced",
      useCalendar: calendarAvailable,
      plannerContext: "",
      noTimeLeftToday: true,
    };
  }

  const durationMinutes = Math.max(15, Math.round((Number(hoursAvailable) || 2) * 60));
  const finishMinute = start.minute + durationMinutes;

  return {
    startTime: start.time,
    endTime: formatMinuteOfDay(finishMinute % (24 * 60)),
    planStyle: "balanced",
    useCalendar: calendarAvailable,
    plannerContext: "",
    noTimeLeftToday: false,
  };
}

export const getNextHalfHourStart = getNextQuarterHourStart;

export function formatLocalDate(date = new Date()) {
  return `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(
    date.getDate()
  )}`;
}

export function formatSmartPlannerResetTime(
  resetAt,
  now = new Date(),
  locale
) {
  if (!resetAt) return "";

  const resetDate = new Date(resetAt);
  const currentDate = new Date(now);
  if (
    !Number.isFinite(resetDate.getTime()) ||
    !Number.isFinite(currentDate.getTime())
  ) {
    return "";
  }

  const dayStart = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate()
  );
  const resetDayStart = new Date(
    resetDate.getFullYear(),
    resetDate.getMonth(),
    resetDate.getDate()
  );
  const dayDifference = Math.round(
    (resetDayStart.getTime() - dayStart.getTime()) / (24 * 60 * 60 * 1000)
  );
  const time = resetDate.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (dayDifference === 0) return `Resets today at ${time}`;
  if (dayDifference === 1) return `Resets tomorrow at ${time}`;

  const date = resetDate.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year:
      resetDate.getFullYear() === currentDate.getFullYear()
        ? undefined
        : "numeric",
  });
  return `Resets ${date} at ${time}`;
}

function truncate(value, length) {
  return String(value ?? "").trim().slice(0, length);
}

function normalizeSubjectKey(value) {
  return truncate(value, 80).toLocaleLowerCase().replace(/\s+/g, " ");
}

function isInactiveClassroomTask(task) {
  return (
    task?.source === "classroom" &&
    ["done", "returned", "turned_in", "submitted"].includes(
      task.classroomStatusCategory
    )
  );
}

function isOverdue(dueDate, localDate) {
  const dueDateKey = /^\d{4}-\d{2}-\d{2}/.exec(String(dueDate || ""))?.[0];
  return Boolean(dueDateKey && dueDateKey < localDate);
}

function getDueDateKey(dueDate) {
  return /^\d{4}-\d{2}-\d{2}/.exec(String(dueDate || ""))?.[0] || "";
}

function getDaysUntilDue(dueDate, localDate) {
  const dueDateKey = getDueDateKey(dueDate);
  if (!dueDateKey) return Number.POSITIVE_INFINITY;

  const due = Date.parse(`${dueDateKey}T00:00:00Z`);
  const today = Date.parse(`${localDate}T00:00:00Z`);
  if (!Number.isFinite(due) || !Number.isFinite(today)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.round((due - today) / (24 * 60 * 60 * 1000));
}

function isAssessmentTask(task) {
  const searchable = [
    task?.title,
    task?.taskType,
    ...(Array.isArray(task?.detectedTags) ? task.detectedTags : []),
  ]
    .join(" ")
    .toLowerCase();
  return /\b(test|exam|assessment|essay|project|presentation|summative|quiz|final|lab report)\b/.test(
    searchable
  );
}

function getImportanceScore(task) {
  const importance = String(task?.importance || "").toLowerCase();
  if (["critical", "urgent", "high"].includes(importance)) return 3;
  if (["medium", "normal"].includes(importance)) return 2;
  if (["low"].includes(importance)) return 1;
  return 0;
}

function compareTaskRelevance(left, right, localDate) {
  const leftDays = getDaysUntilDue(left.task?.dueDate, localDate);
  const rightDays = getDaysUntilDue(right.task?.dueDate, localDate);
  const leftOverdue = leftDays < 0;
  const rightOverdue = rightDays < 0;
  if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;

  const leftDueToday = leftDays === 0;
  const rightDueToday = rightDays === 0;
  if (leftDueToday !== rightDueToday) return leftDueToday ? -1 : 1;

  const leftImminentAssessment = isAssessmentTask(left.task) && leftDays >= 0 && leftDays <= 14;
  const rightImminentAssessment = isAssessmentTask(right.task) && rightDays >= 0 && rightDays <= 14;
  if (leftImminentAssessment !== rightImminentAssessment) {
    return leftImminentAssessment ? -1 : 1;
  }

  if (leftDays !== rightDays) return leftDays - rightDays;

  const importanceDifference =
    getImportanceScore(right.task) - getImportanceScore(left.task);
  if (importanceDifference !== 0) return importanceDifference;

  const effortDifference =
    (Number(right.task?.effort) || 0) - (Number(left.task?.effort) || 0);
  return effortDifference || left.index - right.index;
}

export function buildSmartPlannerTaskPayload(tasks, localDate) {
  return (Array.isArray(tasks) ? tasks : [])
    .filter(
      (task) =>
        task &&
        !task.completed &&
        !task.archived &&
        !task.ignored &&
        !isInactiveClassroomTask(task)
    )
    .map((task, index) => ({ task, index }))
    .sort((left, right) => compareTaskRelevance(left, right, localDate))
    .slice(0, SMART_PLANNER_MAX_TASKS)
    .map(({ task }) => {
      const classification = getEffectiveTaskClassification(task);
      const personalAdmin =
        !task.subject &&
        /\b(order|shopping|buy|appointment|errand|admin|email|call)\b/i.test(
          `${task.title || ""} ${task.description || ""}`
        );

      return ({
      id: truncate(task.id, 120),
      title: truncate(task.title, 180),
      description: truncate(task.description, 500),
      subjectId: truncate(task.linkedSubjectId || task.subjectId, 120),
      subject: truncate(task.subject, 80),
      dueDate: truncate(task.dueDate, 40),
      dueTime: truncate(task.dueTime, 12),
      overdue: isOverdue(task.dueDate, localDate),
      taskType: truncate(classification.taskType, 60),
      detectedTags: classification.detectedTags.map((tag) => truncate(tag, 60)).slice(0, 6),
      assessmentClassification: truncate(classification.assessmentClassification, 32),
      assessmentPreparation: classification.assessmentPreparation,
      personalAdmin,
      importance: truncate(task.importance, 32),
      effort: Math.min(5, Math.max(1, Math.round(Number(task.effort) || 2))),
      source: truncate(task.source || "manual", 40),
      classroomSubmissionState: truncate(
        task.classroomStatusCategory || task.submissionState || "",
        60
      ),
      progress: Number.isFinite(Number(task.progress))
        ? Math.min(100, Math.max(0, Math.round(Number(task.progress))))
        : null,
      completed: false,
    }); })
    .filter((task) => task.id && task.title);
}

export function buildSmartPlannerSubjectProfiles(subjects, eligibleTasks) {
  const subjectByName = new Map();

  (Array.isArray(subjects) ? subjects : []).forEach((subject) => {
    const nameKey = normalizeSubjectKey(subject?.name);
    if (nameKey && !subjectByName.has(nameKey)) {
      subjectByName.set(nameKey, subject);
    }
  });

  const profiles = [];
  const includedProfileKeys = new Set();

  for (const task of Array.isArray(eligibleTasks) ? eligibleTasks : []) {
    const subject = subjectByName.get(normalizeSubjectKey(task?.subject));
    if (!subject) continue;

    const subjectId = truncate(subject.id, 120) || null;
    const subjectName = truncate(subject.name, 80);
    const profileKey = subjectId
      ? `id:${subjectId}`
      : `name:${normalizeSubjectKey(subjectName)}`;
    if (!subjectName || includedProfileKeys.has(profileKey)) continue;

    const gradeSystem = truncate(subject.courseSystem, 16);
    const profile = {
      subjectId,
      subject: subjectName,
      currentGrade: truncate(subject.currentGrade, 16),
      targetGrade: truncate(subject.targetGrade, 16),
      gradeSystem: SMART_PLANNER_GRADE_SYSTEMS.has(gradeSystem)
        ? gradeSystem
        : "Other",
    };
    const level = truncate(subject.level, 40);
    if (level) profile.level = level;
    profiles.push(profile);
    includedProfileKeys.add(profileKey);

    if (profiles.length >= SMART_PLANNER_MAX_SUBJECT_PROFILES) break;
  }

  for (const subject of (Array.isArray(eligibleTasks) && eligibleTasks.length > 0)
    ? []
    : (Array.isArray(subjects) ? subjects : [])) {
    if (profiles.length >= SMART_PLANNER_MAX_SUBJECT_PROFILES) break;
    const subjectId = truncate(subject?.id, 120) || null;
    const subjectName = truncate(subject?.name, 80);
    const profileKey = subjectId ? `id:${subjectId}` : `name:${normalizeSubjectKey(subjectName)}`;
    if (!subjectName || includedProfileKeys.has(profileKey)) continue;
    const gradeSystem = truncate(subject.courseSystem, 16);
    const profile = {
      subjectId,
      subject: subjectName,
      currentGrade: truncate(subject.currentGrade, 16),
      targetGrade: truncate(subject.targetGrade, 16),
      gradeSystem: SMART_PLANNER_GRADE_SYSTEMS.has(gradeSystem) ? gradeSystem : "Other",
    };
    const level = truncate(subject.level, 40);
    if (level) profile.level = level;
    profiles.push(profile);
    includedProfileKeys.add(profileKey);
  }

  return profiles;
}

function normalizeClassName(value) {
  return truncate(value, 120).toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function detectTomorrowClasses(events, subjects, tomorrowDate) {
  const aliases = (Array.isArray(subjects) ? subjects : []).flatMap((subject) => {
    const values = [subject?.name, subject?.classroomCourseName, subject?.linkedCourseName]
      .map(normalizeClassName)
      .filter((value) => value.length >= 3);
    return values.map((alias) => ({ alias, subject: truncate(subject?.name, 80) }));
  });
  const found = new Set();
  (Array.isArray(events) ? events : []).forEach((event) => {
    const eventDate = String(
      event?.start?.dateTime || event?.start?.date || event?.start || ""
    ).slice(0, 10);
    const title = normalizeClassName(event?.title || event?.summary);
    if (eventDate !== tomorrowDate || !title) return;
    aliases.forEach(({ alias, subject }) => {
      if (title === alias || title.startsWith(`${alias} `) || title.endsWith(` ${alias}`)) {
        if (subject) found.add(subject);
      }
    });
  });
  return [...found].slice(0, 12);
}

export function getSmartPlannerLocalContext(draft, now = new Date()) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Etc/UTC";
  const startMinute = timeStringToMinute(draft.startTime);
  const rawFinishMinute = timeStringToMinute(draft.endTime);
  const finishMinute =
    startMinute !== null && rawFinishMinute !== null && rawFinishMinute <= startMinute
      ? rawFinishMinute + 24 * 60
      : rawFinishMinute;

  return {
    localDate: formatLocalDate(now),
    currentMinute: now.getHours() * 60 + now.getMinutes(),
    startMinute,
    finishMinute,
    timeZone: truncate(timeZone, 80),
    utcOffsetMinutes: -now.getTimezoneOffset(),
    planningStyle: draft.planStyle,
    plannerContext: normalizeSmartPlannerContext(draft.plannerContext),
  };
}

export function timeStringToMinute(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatPlannerPreviewTime(minutes) {
  const date = new Date();
  date.setHours(0, Number(minutes) || 0, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
import { getEffectiveTaskClassification } from "./appUtils.js";
