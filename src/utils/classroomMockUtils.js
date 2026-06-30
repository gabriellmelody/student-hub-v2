import {
  findSubjectProfile,
  formatDateKey,
  normalizeTask,
} from "./appUtils.js";

const MOCK_CLASSROOM_SOURCE = "classroom-mock";

function safeString(value, fallback = "") {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function safeDateTime(value) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeMockCourse(course, index = 0) {
  const externalId = safeString(
    course?.externalId || course?.id,
    `mock-course-${index + 1}`
  );

  return {
    id: externalId,
    externalId,
    name: safeString(course?.name, "Untitled class"),
    section: safeString(course?.section),
    source: MOCK_CLASSROOM_SOURCE,
  };
}

export function normalizeMockAssignment(
  assignment,
  course = null,
  index = 0
) {
  const classroomCourseId = safeString(
    assignment?.classroomCourseId || assignment?.courseId,
    course?.externalId || "mock-course-unassigned"
  );
  const externalId = safeString(
    assignment?.externalId || assignment?.id,
    `${classroomCourseId}-assignment-${index + 1}`
  );

  return {
    id: externalId,
    externalId,
    title: safeString(assignment?.title, "Untitled assignment"),
    description: safeString(assignment?.description),
    source: MOCK_CLASSROOM_SOURCE,
    classroomCourseId,
    classroomCourseName: safeString(course?.name, "Unassigned class"),
    dueAt: safeDateTime(assignment?.dueAt),
    sourceUpdatedAt: safeDateTime(
      assignment?.sourceUpdatedAt || assignment?.updatedAt
    ),
  };
}

export function buildMockClassroomPreview(data) {
  const courses = Array.isArray(data?.courses)
    ? data.courses.map(normalizeMockCourse)
    : [];
  const assignments = Array.isArray(data?.assignments)
    ? data.assignments
    : [];

  return courses.map((course) => ({
    ...course,
    assignments: assignments
      .filter(
        (assignment) =>
          safeString(assignment?.classroomCourseId || assignment?.courseId) ===
          course.externalId
      )
      .map((assignment, index) =>
        normalizeMockAssignment(assignment, course, index)
      )
      .sort((left, right) => {
        if (!left.dueAt) return 1;
        if (!right.dueAt) return -1;
        return new Date(left.dueAt) - new Date(right.dueAt);
      }),
  }));
}

export function formatMockClassroomDueDate(dueAt) {
  if (!dueAt) return "No due date";

  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return "No due date";

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function createTaskFromMockAssignment(
  assignment,
  subjects = [],
  importedAt = new Date().toISOString()
) {
  const normalizedAssignment = normalizeMockAssignment(assignment, {
    externalId: assignment?.classroomCourseId,
    name: assignment?.classroomCourseName,
  });
  const matchedSubject = findSubjectProfile(
    subjects,
    normalizedAssignment.classroomCourseName
  );
  const dueDate = normalizedAssignment.dueAt
    ? formatDateKey(new Date(normalizedAssignment.dueAt))
    : "";

  return normalizeTask({
    id: `${MOCK_CLASSROOM_SOURCE}-${normalizedAssignment.externalId}`,
    title: normalizedAssignment.title,
    description: normalizedAssignment.description,
    subject:
      matchedSubject?.name || normalizedAssignment.classroomCourseName || "School",
    dueDate,
    effort: 2,
    completed: false,
    completedAt: null,
    source: MOCK_CLASSROOM_SOURCE,
    externalId: normalizedAssignment.externalId,
    classroomCourseId: normalizedAssignment.classroomCourseId,
    classroomCourseName: normalizedAssignment.classroomCourseName,
    importedAt,
    sourceUpdatedAt: normalizedAssignment.sourceUpdatedAt,
    lastSyncedAt: importedAt,
  });
}
