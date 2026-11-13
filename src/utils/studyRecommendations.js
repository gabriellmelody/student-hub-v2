import {
  findSubjectProfile,
  formatDateKey,
  getEffectiveTaskClassification,
  parseDateKey,
} from "./appUtils.js";

export const STUDY_WEEKDAYS = Object.freeze([
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
]);

const INACTIVE_CLASSROOM_STATES = new Set(["done", "returned", "submitted", "turned_in"]);
const RECOMMENDATION_KINDS = new Set(["assessment", "homework", "routine", "review"]);
const MAX_OVERRIDE_COUNT = 64;
export const PLAN_BLOCK_DURATION_OPTIONS = Object.freeze([15, 20, 25, 30, 45, 60, 75, 90]);

export function getRecommendationDurationMinutes(recommendation, fallbackMinutes = 45) {
  const requested = Number(recommendation?.durationMinutes);
  return PLAN_BLOCK_DURATION_OPTIONS.includes(requested)
    ? requested
    : Number(fallbackMinutes) || 45;
}

export function getDayStudyMinutes(day) {
  return [...(day?.primary || []), ...(day?.extra || [])].reduce(
    (sum, recommendation) => sum + getRecommendationDurationMinutes(
      recommendation,
      day?.blockDurationMinutes
    ),
    0
  );
}

export function getHorizonStudyMinutes(days) {
  return (Array.isArray(days) ? days : []).reduce(
    (sum, day) => sum + getDayStudyMinutes(day),
    0
  );
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

function differenceInLocalDays(later, earlier) {
  const laterDate = startOfLocalDay(later);
  const earlierDate = startOfLocalDay(earlier);
  laterDate.setHours(12, 0, 0, 0);
  earlierDate.setHours(12, 0, 0, 0);
  return Math.round((laterDate - earlierDate) / 86400000);
}

export function getStudyWeekDays(now = new Date()) {
  const today = startOfLocalDay(now);
  const todayKey = formatDateKey(today);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addLocalDays(today, index);
    const weekday = STUDY_WEEKDAYS[(date.getDay() + 6) % 7];
    return {
      ...weekday,
      date,
      dateKey: formatDateKey(date),
      isToday: formatDateKey(date) === todayKey,
      isPast: date < today,
    };
  });
}

export function getTaskStudyBlockCount(task) {
  const effort = Math.min(5, Math.max(1, Number(task?.effort) || 2));
  if (effort >= 5) return 3;
  if (effort >= 3) return 2;
  return 1;
}

function isActiveAcademicTask(task) {
  if (!task || task.completed || task.archived || task.ignored) return false;
  if (["note", "notes", "my-list", "my-lists"].includes(task.source)) return false;
  if (task.source === "classroom" && INACTIVE_CLASSROOM_STATES.has(task.classroomStatusCategory)) {
    return false;
  }
  return true;
}

function isAssessmentTask(task) {
  const classification = getEffectiveTaskClassification(task);
  return {
    classification,
    isAssessment:
      classification.taskType === "assessment" ||
      ["formative", "summative", "assessment"].includes(classification.assessmentClassification),
  };
}

function getAssessmentLabel(task, classification) {
  const tags = Array.isArray(task?.detectedTags) ? task.detectedTags : [];
  if (
    /\bcfa\b/i.test(`${task?.title || ""} ${task?.description || ""}`) ||
    tags.some((tag) => /\bcfa\b/i.test(String(tag)))
  ) return "CFA";
  if (classification.assessmentClassification === "summative") return "Summative";
  if (classification.assessmentClassification === "formative") return "Formative";
  return "Assessment";
}

function getDueReason(daysUntilDue, dueDate) {
  if (daysUntilDue < 0) return "Overdue";
  if (daysUntilDue === 0) return "Due today";
  if (daysUntilDue === 1) return "Due tomorrow";
  return `Due ${dueDate.toLocaleDateString(undefined, { weekday: "long" })}`;
}

function getHomeworkScore(task, daysUntilDue) {
  const dueScore = daysUntilDue < 0
    ? 900
    : daysUntilDue === 0
      ? 850
      : daysUntilDue === 1
        ? 800
        : daysUntilDue <= 3
          ? 650
          : daysUntilDue <= 7
            ? 400
            : 120;
  const importanceScore = { urgent: 90, high: 55, normal: 0 };
  return dueScore + (importanceScore[task.importance] || 0) + (Number(task.effort) || 2) * 4;
}

function shouldRecommendHomework(task, daysUntilDue) {
  if (daysUntilDue <= 3) return true;
  if (daysUntilDue <= 7) {
    return Number(task.effort) >= 4 || ["high", "urgent"].includes(task.importance);
  }
  return task.importance === "urgent" || Number(task.effort) >= 5;
}

function getHomeworkOccurrenceDates(task, today, weekEnd) {
  if (!task.dueDate) return [];
  const dueDate = parseDateKey(task.dueDate);
  const daysUntilDue = differenceInLocalDays(dueDate, today);
  if (!shouldRecommendHomework(task, daysUntilDue)) return [];
  const count = getTaskStudyBlockCount(task);
  if (daysUntilDue < 0) return Array.from({ length: count }, () => today);
  if (daysUntilDue === 0) return [];
  const finalWorkDate = addLocalDays(dueDate, -1);
  const lastEligibleDate = finalWorkDate < weekEnd ? finalWorkDate : weekEnd;
  const availableDates = [];
  for (let date = today; date <= lastEligibleDate; date = addLocalDays(date, 1)) {
    availableDates.push(date);
  }
  if (availableDates.length === 0) return [];
  const occurrenceDates = count === 1 ? [availableDates[0]] : Array.from({ length: count }, (_, index) => {
    const distributedIndex = Math.round((index * (availableDates.length - 1)) / (count - 1));
    return availableDates[distributedIndex];
  });
  const urgentCarryForwardDates = [finalWorkDate]
    .filter((date) => date >= today && date <= weekEnd);
  const scheduledDateKeys = new Set(occurrenceDates.map(formatDateKey));
  const newCarryForwardDates = urgentCarryForwardDates.filter((date) => {
    const dateKey = formatDateKey(date);
    if (scheduledDateKeys.has(dateKey)) return false;
    scheduledDateKeys.add(dateKey);
    return true;
  });
  return [...occurrenceDates, ...newCarryForwardDates]
    .sort((first, second) => first - second);
}

function createTaskRecommendation({
  task,
  date,
  kind,
  reason,
  score,
  required,
  occurrenceIndex = 0,
  assessmentLabel = "",
}) {
  return {
    id: `${kind}:${task.id}:${formatDateKey(date)}:${occurrenceIndex}`,
    kind,
    taskId: task.id,
    title: task.title,
    subject: task.subject || "Unassigned",
    reason,
    description: task.description || "",
    dueDate: task.dueDate || "",
    assessmentLabel,
    score,
    required,
    effort: Number(task.effort) || 2,
    importance: task.importance || "normal",
    source: task.source || "manual",
    locked: false,
    manualOverride: false,
  };
}

function compareRecommendations(first, second) {
  if (first.required !== second.required) return first.required ? -1 : 1;
  if (first.score !== second.score) return second.score - first.score;
  const titleDifference = first.title.localeCompare(second.title);
  return titleDifference || String(first.id).localeCompare(String(second.id));
}

function addCandidate(candidateMap, dateKey, recommendation) {
  if (!candidateMap.has(dateKey)) return;
  const candidates = candidateMap.get(dateKey);
  if (!candidates.some((candidate) => candidate.id === recommendation.id)) candidates.push(recommendation);
}

function getSubjectReviewTitle(subjectName) {
  const name = String(subjectName || "").trim();
  const normalized = name.toLowerCase();
  if (normalized.includes("english")) return `Review today's ${name} notes or reading`;
  if (normalized.includes("psychology")) return `Review today's ${name} slides and key concepts`;
  if (normalized.includes("sport science")) return `Review today's ${name} lesson`;
  return `Review today's ${name} work`;
}

function createRoutineRecommendations({ weekday, subjects, routineIds, occupiedSubjects }) {
  return routineIds.flatMap((subjectId, index) => {
    const subject = subjects.find((item) => String(item.id) === String(subjectId));
    if (!subject || occupiedSubjects.has(String(subject.id))) return [];
    occupiedSubjects.add(String(subject.id));
    return [{
      id: `routine:${weekday.dateKey}:${subject.id}:${index}`,
      kind: "routine",
      taskId: null,
      subjectId: subject.id,
      title: getSubjectReviewTitle(subject.name),
      subject: subject.name,
      subjectColour: subject.colour || subject.color || null,
      reason: "No urgent work · Review",
      description: `Review your ${subject.name} slides or notes and fill any gaps.`,
      dueDate: "",
      score: 0,
      required: false,
      effort: null,
      importance: "normal",
      source: "routine",
      locked: false,
      manualOverride: false,
    }];
  });
}

function resolveReliableSubjects(subjects, values) {
  if (!Array.isArray(values)) return [];
  return values.flatMap((value) => {
    const normalized = String(value || "").trim().toLowerCase();
    const subject = subjects.find((item) =>
      String(item.id) === String(value) || String(item.name || "").trim().toLowerCase() === normalized
    );
    return subject ? [subject] : [];
  });
}

function createReviewRecommendations({ weekday, subjects, classSubjectsByDate }) {
  const reliableSubjects = resolveReliableSubjects(subjects, classSubjectsByDate?.[weekday.dateKey]);
  if (reliableSubjects.length > 0) {
    return reliableSubjects.map((subject, index) => ({
      id: `review:${weekday.dateKey}:${subject.id}:${index}`,
      kind: "review",
      taskId: null,
      subjectId: subject.id,
      title: getSubjectReviewTitle(subject.name),
      subject: subject.name,
      subjectColour: subject.colour || subject.color || null,
      reason: "No urgent tasks · Review",
      description: `Review today's ${subject.name} slides and notes, then practise anything that is still unclear.`,
      dueDate: "",
      score: -20,
      required: false,
      effort: null,
      importance: "normal",
      source: "review",
      locked: false,
      manualOverride: false,
    }));
  }
  return [{
    id: `review:${weekday.dateKey}:general`,
    kind: "review",
    taskId: null,
    subjectId: null,
    title: "Review today's classes",
    subject: "General review",
    subjectColour: null,
    reason: "No urgent tasks · Review",
    description: "Review today's class slides and notes, check what you understand, and fill any gaps.",
    dueDate: "",
    score: -30,
    required: false,
    effort: null,
    importance: "normal",
    source: "review",
    locked: false,
    manualOverride: false,
  }];
}

function getRecommendationIdentity(recommendation) {
  if (recommendation?.taskId) return `task:${recommendation.taskId}`;
  if (recommendation?.subjectId) return `${recommendation.kind}:subject:${recommendation.subjectId}`;
  return recommendation?.id || `${recommendation?.kind}:${recommendation?.title}`;
}

function uniqueAlternatives(recommendations, displayed) {
  const displayedIdentities = new Set(displayed.map(getRecommendationIdentity));
  const seen = new Set();
  return recommendations.filter((recommendation) => {
    const identity = getRecommendationIdentity(recommendation);
    if (displayedIdentities.has(identity) || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  }).slice(0, 8);
}

function cleanOverrideRecommendation(recommendation) {
  if (!recommendation || !RECOMMENDATION_KINDS.has(recommendation.kind)) return null;
  const title = String(recommendation.title || "").trim();
  const subject = String(recommendation.subject || "").trim();
  if (!title || !subject) return null;
  return {
    id: String(recommendation.id || "").slice(0, 180),
    kind: recommendation.kind,
    taskId: recommendation.taskId ? String(recommendation.taskId) : null,
    subjectId: recommendation.subjectId ? String(recommendation.subjectId) : null,
    title: title.slice(0, 180),
    subject: subject.slice(0, 120),
    reason: String(recommendation.reason || "Manual choice").slice(0, 180),
    description: String(recommendation.description || "").slice(0, 4000),
    dueDate: String(recommendation.dueDate || "").slice(0, 10),
    assessmentLabel: String(recommendation.assessmentLabel || "").slice(0, 40),
    score: Number(recommendation.score) || 0,
    required: Boolean(recommendation.required),
    effort: Number(recommendation.effort) || null,
    importance: String(recommendation.importance || "normal").slice(0, 20),
    source: String(recommendation.source || "manual").slice(0, 30),
  };
}

function normalizeOverrideDuration(value) {
  const duration = Number(value);
  return PLAN_BLOCK_DURATION_OPTIONS.includes(duration) ? duration : null;
}

export function isRecommendationEligibleOnDate(
  recommendation,
  dateKey,
  todayKey = formatDateKey(new Date())
) {
  const destination = String(dateKey || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(destination) || destination < todayKey) return false;
  const dueDate = String(recommendation?.dueDate || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate) && destination >= dueDate) return false;
  return true;
}

export function createManualTaskStudyRecommendation(task, dateKey) {
  if (!isActiveAcademicTask(task) || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) {
    return null;
  }
  const date = parseDateKey(dateKey);
  const { classification, isAssessment } = isAssessmentTask(task);
  const assessmentLabel = isAssessment ? getAssessmentLabel(task, classification) : "";
  const recommendation = createTaskRecommendation({
    task,
    date,
    kind: isAssessment ? "assessment" : "homework",
    reason: "Manual study block",
    score: 0,
    required: false,
    occurrenceIndex: "manual",
    assessmentLabel,
  });
  recommendation.id = `manual-task:${task.id}:${dateKey}`;
  return recommendation;
}

export function getValidTaskStudyDates(task, now = new Date()) {
  const recommendation = createManualTaskStudyRecommendation(task, formatDateKey(startOfLocalDay(now)));
  if (!recommendation) return [];
  const todayKey = formatDateKey(startOfLocalDay(now));
  return getStudyWeekDays(now).filter((day) =>
    isRecommendationEligibleOnDate(recommendation, day.dateKey, todayKey)
  );
}

export function getNextAvailableOverrideSlot(overrides, dateKey) {
  const occupied = new Set(
    (Array.isArray(overrides) ? overrides : [])
      .filter((override) => override?.dateKey === dateKey && !override?.removed)
      .map((override) => Number(override.slotIndex))
  );
  for (let slotIndex = 3; slotIndex <= 12; slotIndex += 1) {
    if (!occupied.has(slotIndex)) return slotIndex;
  }
  return null;
}

export function createRecommendationOverride({
  dateKey,
  slotIndex,
  recommendation,
  locked = false,
  manual = true,
  removed = false,
  added = false,
  originDateKey = "",
  originSlotIndex = null,
  durationMinutes = null,
}) {
  const cleanedRecommendation = cleanOverrideRecommendation(recommendation);
  const normalizedSlotIndex = Math.max(0, Math.min(12, Math.trunc(Number(slotIndex))));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || "")) || !cleanedRecommendation) return null;
  return {
    dateKey: String(dateKey),
    slotIndex: normalizedSlotIndex,
    recommendation: cleanedRecommendation,
    locked: Boolean(locked),
    manual: Boolean(manual),
    removed: Boolean(removed),
    added: Boolean(added),
    originDateKey: /^\d{4}-\d{2}-\d{2}$/.test(String(originDateKey || ""))
      ? String(originDateKey)
      : "",
    originSlotIndex: originSlotIndex !== null && originSlotIndex !== "" && Number.isFinite(Number(originSlotIndex))
      ? Math.max(0, Math.min(12, Math.trunc(Number(originSlotIndex))))
      : null,
    durationMinutes: normalizeOverrideDuration(durationMinutes),
  };
}

export function clearUnlockedFutureRecommendationOverrides(overrides, todayKey) {
  return (Array.isArray(overrides) ? overrides : []).filter((override) =>
    override?.dateKey < todayKey || override?.locked || override?.manual
  );
}

function normalizeOverrides(value) {
  if (!Array.isArray(value)) return [];
  const bySlot = new Map();
  value.slice(-MAX_OVERRIDE_COUNT).forEach((override) => {
    const normalized = createRecommendationOverride(override || {});
    if (normalized) bySlot.set(`${normalized.dateKey}:${normalized.slotIndex}`, normalized);
  });
  return Array.from(bySlot.values());
}

function getMoveOverrideKey(override) {
  return `${override.originDateKey}:${override.originSlotIndex}`;
}

export function filterValidMoveOverrides(overrides, tasks, todayKey) {
  const taskById = new Map((Array.isArray(tasks) ? tasks : []).map((task) => [String(task.id), task]));
  const isTaskOverrideValid = (override) => {
    const taskId = override.recommendation?.taskId;
    if (!taskId) return true;
    const task = taskById.get(String(taskId));
    if (!isActiveAcademicTask(task)) return false;
    if (override.removed && !override.originDateKey) return true;
    return isRecommendationEligibleOnDate(
      { ...override.recommendation, dueDate: task.dueDate || "" },
      override.dateKey,
      todayKey
    );
  };
  const validMoveKeys = new Set();
  overrides.forEach((override) => {
    if (override.removed || !override.originDateKey) return;
    if (isTaskOverrideValid(override)) {
      validMoveKeys.add(getMoveOverrideKey(override));
    }
  });
  return overrides.filter((override) => {
    if (!isTaskOverrideValid(override)) return false;
    if (!override.originDateKey) return true;
    if (override.removed) return validMoveKeys.has(getMoveOverrideKey(override));
    return validMoveKeys.has(getMoveOverrideKey(override));
  });
}

function hydrateOverrideRecommendation(override, tasks, subjects, today) {
  const stored = override.recommendation;
  if (stored.taskId) {
    const task = tasks.find((item) => String(item.id) === String(stored.taskId));
    if (!isActiveAcademicTask(task)) return null;
    const dueDate = task.dueDate ? parseDateKey(task.dueDate) : null;
    const { classification, isAssessment } = isAssessmentTask(task);
    const assessmentLabel = isAssessment ? getAssessmentLabel(task, classification) : "";
    const reason = dueDate
      ? isAssessment
        ? `${assessmentLabel} ${dueDate.toLocaleDateString(undefined, { weekday: "long" })}`
        : getDueReason(differenceInLocalDays(dueDate, today), dueDate)
      : stored.reason;
    return {
      ...stored,
      title: task.title,
      subject: task.subject || "Unassigned",
      description: task.description || "",
      dueDate: task.dueDate || "",
      assessmentLabel,
      reason: override.manual ? `Manual choice · ${reason}` : reason,
      effort: Number(task.effort) || stored.effort,
      importance: task.importance || stored.importance,
      source: task.source || stored.source,
      locked: override.locked,
      manualOverride: override.manual,
      manualAdded: override.added,
      manualOriginDateKey: override.originDateKey || "",
      manualOriginSlotIndex: override.originSlotIndex,
      overrideSlotIndex: override.slotIndex,
      durationMinutes: override.durationMinutes,
    };
  }
  if (stored.subjectId) {
    const subject = subjects.find((item) => String(item.id) === String(stored.subjectId));
    if (!subject) return null;
    return {
      ...stored,
      subject: subject.name,
      subjectColour: subject.colour || subject.color || null,
      locked: override.locked,
      manualOverride: override.manual,
      manualAdded: override.added,
      manualOriginDateKey: override.originDateKey || "",
      manualOriginSlotIndex: override.originSlotIndex,
      overrideSlotIndex: override.slotIndex,
      durationMinutes: override.durationMinutes,
    };
  }
  if (stored.kind !== "review") return null;
  return {
    ...stored,
    locked: override.locked,
    manualOverride: override.manual,
    manualAdded: override.added,
    manualOriginDateKey: override.originDateKey || "",
    manualOriginSlotIndex: override.originSlotIndex,
    overrideSlotIndex: override.slotIndex,
    durationMinutes: override.durationMinutes,
  };
}

function getDisplayed(day) {
  return [...day.primary, ...(day.finishEarly ? [day.finishEarly] : []), ...day.extra];
}

function setDaySlot(day, slotIndex, recommendation) {
  if (slotIndex <= 1) {
    day.primary[slotIndex] = recommendation;
  } else if (slotIndex === 2) {
    day.finishEarly = recommendation;
  } else {
    day.extra[slotIndex - 3] = recommendation;
  }
}

function applyDayOverrides({ day, overrides, tasks, subjects, today }) {
  const next = {
    ...day,
    primary: [...day.primary],
    extra: [...day.extra],
    finishEarly: day.finishEarly || null,
  };
  const displacedRequired = [];
  const dayOverrides = overrides
    .filter((override) => override.dateKey === day.dateKey)
    .sort((first, second) => first.slotIndex - second.slotIndex);
  const removedRecommendationIds = new Set();
  dayOverrides
    .filter((override) => override.removed)
    .forEach((override) => {
      const removed = hydrateOverrideRecommendation(override, tasks, subjects, today);
      if (removed?.id) removedRecommendationIds.add(removed.id);
      if (override.added) return;
      const current = override.slotIndex <= 1
        ? next.primary[override.slotIndex]
        : override.slotIndex === 2
          ? next.finishEarly
          : next.extra[override.slotIndex - 3];
      if (current?.id) removedRecommendationIds.add(current.id);
      setDaySlot(next, override.slotIndex, null);
    });
  dayOverrides
    .filter((override) => !override.removed)
    .forEach((override) => {
      const replacement = hydrateOverrideRecommendation(override, tasks, subjects, today);
      if (!replacement) return;
      if (
        override.manual &&
        override.originDateKey &&
        !isRecommendationEligibleOnDate(replacement, override.dateKey, formatDateKey(today))
      ) return;
      const current = override.slotIndex <= 1
        ? next.primary[override.slotIndex]
        : override.slotIndex === 2
          ? next.finishEarly
          : next.extra[override.slotIndex - 3];
      if (current?.required && current.id !== replacement.id) displacedRequired.push(current);
      setDaySlot(next, override.slotIndex, replacement);
    });
  next.primary = next.primary.filter(Boolean);
  next.extra = next.extra.filter(Boolean);
  const displayedIds = new Set(getDisplayed(next).map((item) => item.id));
  [...day.requiredCandidates, ...displacedRequired].forEach((recommendation) => {
    if (!displayedIds.has(recommendation.id) && !removedRecommendationIds.has(recommendation.id)) {
      next.extra.push(recommendation);
      displayedIds.add(recommendation.id);
    }
  });
  next.extra = next.extra.filter((recommendation, index, list) =>
    !removedRecommendationIds.has(recommendation.id) &&
    list.findIndex((item) => item.id === recommendation.id) === index
  );
  next.primary = next.primary.filter((recommendation) => !removedRecommendationIds.has(recommendation.id));
  if (next.finishEarly && removedRecommendationIds.has(next.finishEarly.id)) next.finishEarly = null;
  return next;
}

function createEmptyHistoricalDay(weekday, blockDurationMinutes, dailyBlockCount) {
  return {
    ...weekday,
    primary: [],
    finishEarly: null,
    extra: [],
    alternatives: [],
    blockDurationMinutes,
    targetBlockCount: dailyBlockCount,
    historical: true,
  };
}

export function buildStudyRecommendations({
  tasks = [],
  subjects = [],
  preferences = {},
  classSubjectsByDate = {},
  previousDays = [],
  now = new Date(),
} = {}) {
  const weekDays = getStudyWeekDays(now);
  const weekStart = weekDays[0].date;
  const weekEnd = weekDays[6].date;
  const today = startOfLocalDay(now);
  const todayKey = formatDateKey(today);
  const activeTasks = tasks.filter(isActiveAcademicTask);
  const candidateMap = new Map(weekDays.map((day) => [day.dateKey, []]));
  const deadlineMap = new Map(weekDays.map((day) => [day.dateKey, []]));
  const dailyBlockCount = Math.min(6, Math.max(1, Number(preferences.dailyStudyBlocks) || 2));
  const primaryLimit = Math.min(2, dailyBlockCount);
  const blockDurationMinutes = [20, 25, 30, 45, 60, 90].includes(Number(preferences.blockDurationMinutes))
    ? Number(preferences.blockDurationMinutes)
    : 45;
  const weeklyRoutine = preferences.weeklyRoutine || {};
  const overrides = filterValidMoveOverrides(
    normalizeOverrides(preferences.recommendationOverrides),
    activeTasks,
    todayKey
  );

  activeTasks.forEach((task) => {
    if (!task.dueDate) return;
    const dueDate = parseDateKey(task.dueDate);
    const { classification, isAssessment } = isAssessmentTask(task);
    if (isAssessment) {
      const label = getAssessmentLabel(task, classification);
      const dueDateKey = formatDateKey(dueDate);
      if (deadlineMap.has(dueDateKey)) {
        deadlineMap.get(dueDateKey).push({
          id: `assessment-deadline:${task.id}:${dueDateKey}`,
          taskId: task.id,
          title: task.title,
          subject: task.subject || "Unassigned",
          assessmentLabel: label,
          source: task.source || "manual",
        });
      }
      [-2, -1].forEach((offset, occurrenceIndex) => {
        const prepDate = addLocalDays(dueDate, offset);
        if (prepDate < today || prepDate < weekStart || prepDate > weekEnd) return;
        addCandidate(candidateMap, formatDateKey(prepDate), createTaskRecommendation({
          task,
          date: prepDate,
          kind: "assessment",
          reason: `Mandatory prep · ${label} ${dueDate.toLocaleDateString(undefined, { weekday: "long" })}`,
          score: 1000 - Math.abs(offset),
          required: true,
          occurrenceIndex,
          assessmentLabel: label,
        }));
      });
      if (["high", "urgent"].includes(task.importance) || Number(task.effort) >= 4) {
        const earlierDate = addLocalDays(dueDate, -3);
        if (earlierDate >= today && earlierDate >= weekStart && earlierDate <= weekEnd) {
          addCandidate(candidateMap, formatDateKey(earlierDate), createTaskRecommendation({
            task,
            date: earlierDate,
            kind: "assessment",
            reason: `Start early · ${label} ${dueDate.toLocaleDateString(undefined, { weekday: "long" })}`,
            score: 540,
            required: false,
            occurrenceIndex: 2,
            assessmentLabel: label,
          }));
        }
      }
      return;
    }
    getHomeworkOccurrenceDates(task, today, weekEnd).forEach((date, occurrenceIndex) => {
      if (date < weekStart || date > weekEnd) return;
      const daysUntilDue = differenceInLocalDays(dueDate, date);
      const reason = getDueReason(daysUntilDue, dueDate);
      addCandidate(candidateMap, formatDateKey(date), createTaskRecommendation({
        task,
        date,
        kind: "homework",
        reason: Number(task.effort) >= 4 && daysUntilDue > 1
          ? `High effort · ${reason.toLocaleLowerCase()}`
          : reason,
        score: getHomeworkScore(task, daysUntilDue) - occurrenceIndex,
        required: daysUntilDue <= 1,
        occurrenceIndex,
      }));
    });
  });

  const days = weekDays.map((weekday) => {
    if (weekday.isPast) {
      const previous = previousDays.find((day) => day.dateKey === weekday.dateKey);
      return previous
        ? { ...previous, ...weekday, historical: true }
        : createEmptyHistoricalDay(weekday, blockDurationMinutes, dailyBlockCount);
    }
    const candidates = [...(candidateMap.get(weekday.dateKey) || [])].sort(compareRecommendations);
    const primary = candidates.slice(0, primaryLimit);
    const occupiedSubjects = new Set(primary.flatMap((item) => {
      const subject = findSubjectProfile(subjects, item.subject);
      return subject?.id ? [String(subject.id)] : [];
    }));
    const routine = createRoutineRecommendations({
      weekday,
      subjects,
      routineIds: Array.isArray(weeklyRoutine[weekday.key]) ? weeklyRoutine[weekday.key] : [],
      occupiedSubjects,
    });
    primary.push(...routine.slice(0, Math.max(0, primaryLimit - primary.length)));
    const primaryIds = new Set(primary.map((item) => item.id));
    const remainingCandidates = candidates.filter((item) => !primaryIds.has(item.id));
    const extra = remainingCandidates.filter((candidate) => candidate.required);
    const remainingRoutine = routine.filter((item) => !primaryIds.has(item.id));
    let finishEarly = remainingCandidates.find((candidate) => !candidate.required) || remainingRoutine[0] || null;
    let fallbackRecommendations = [];
    if (primary.length === 0 && weekday.isToday) {
      fallbackRecommendations = createReviewRecommendations({ weekday, subjects, classSubjectsByDate });
      primary.push(...fallbackRecommendations.slice(0, primaryLimit));
      finishEarly = fallbackRecommendations[primaryLimit] || null;
    }
    const baseDay = {
      ...weekday,
      deadlines: deadlineMap.get(weekday.dateKey) || [],
      primary,
      finishEarly,
      extra,
      alternatives: [],
      requiredCandidates: candidates.filter((item) => item.required),
      candidatePool: [...candidates, ...routine, ...fallbackRecommendations],
      blockDurationMinutes,
      targetBlockCount: dailyBlockCount,
      historical: false,
    };
    const overriddenDay = applyDayOverrides({ day: baseDay, overrides, tasks: activeTasks, subjects, today });
    const displayed = getDisplayed(overriddenDay);
    const result = {
      ...overriddenDay,
      alternatives: uniqueAlternatives(baseDay.candidatePool, displayed),
    };
    delete result.requiredCandidates;
    delete result.candidatePool;
    return result;
  });

  return {
    weekStart: formatDateKey(weekStart),
    weekEnd: formatDateKey(weekEnd),
    todayKey,
    blockDurationMinutes,
    dailyBlockCount,
    days,
    today: days.find((day) => day.dateKey === todayKey) || null,
  };
}
