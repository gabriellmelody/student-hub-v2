import {
  findSubjectProfile,
  getEffectiveTaskClassification,
  parseDateKey,
} from "./appUtils.js";

const INACTIVE_CLASSROOM_STATES = new Set([
  "done",
  "returned",
  "submitted",
  "turned_in",
]);

export function getHomeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function formatHomeDate(date = new Date()) {
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  const day = date.toLocaleDateString(undefined, { day: "numeric" });
  const month = date.toLocaleDateString(undefined, { month: "short" });
  return `${weekday}, ${day} ${month}`;
}

export function getHomeRecommendationItems(day) {
  if (!day) return { primary: [], additional: [] };

  return {
    primary: Array.isArray(day.primary) ? day.primary.slice(0, 2) : [],
    additional: [
      ...(day.finishEarly ? [day.finishEarly] : []),
      ...(Array.isArray(day.extra) ? day.extra : []),
    ],
  };
}

export function getHomeAssessmentIndicator(item) {
  const label = String(item?.assessmentLabel || "").trim();
  if (label === "Formative") return { short: "F", label };
  if (label === "Summative") return { short: "S", label };
  if (label === "CFA") return { short: "CFA", label };

  const classification = getEffectiveTaskClassification(item || {});
  if (classification.assessmentClassification === "formative") {
    return { short: "F", label: "Formative" };
  }
  if (classification.assessmentClassification === "summative") {
    return { short: "S", label: "Summative" };
  }
  return null;
}

export function getHomeSubjectColour(item, subjects = []) {
  if (item?.subjectColour) return item.subjectColour;
  const subject = findSubjectProfile(subjects, item?.subject);
  return subject?.colour || subject?.color || null;
}

export function getHomeUpcomingTasks(tasks = [], subjects = [], now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  return tasks
    .filter((task) => {
      if (!task?.dueDate || task.completed || task.archived || task.ignored) {
        return false;
      }
      if (
        task.source === "classroom" &&
        INACTIVE_CLASSROOM_STATES.has(task.classroomStatusCategory)
      ) {
        return false;
      }
      const dueDate = parseDateKey(task.dueDate);
      return Number.isFinite(dueDate.getTime()) && dueDate >= today;
    })
    .map((task) => {
      const classification = getEffectiveTaskClassification(task);
      const subject = findSubjectProfile(subjects, task.subject);
      return {
        ...task,
        subjectColour: subject?.colour || subject?.color || null,
        assessmentClassification: classification.assessmentClassification,
      };
    })
    .sort((first, second) => {
      const dateDifference = first.dueDate.localeCompare(second.dueDate);
      if (dateDifference !== 0) return dateDifference;
      const firstAssessment = first.assessmentClassification ? 1 : 0;
      const secondAssessment = second.assessmentClassification ? 1 : 0;
      if (firstAssessment !== secondAssessment) {
        return secondAssessment - firstAssessment;
      }
      return first.title.localeCompare(second.title);
    })
    .slice(0, 3);
}

export function sortHomeCalendarEvents(events = []) {
  return [...events].sort((first, second) => {
    if (Boolean(first.allDay) !== Boolean(second.allDay)) {
      return first.allDay ? -1 : 1;
    }
    return String(first.start || "").localeCompare(String(second.start || ""));
  });
}

