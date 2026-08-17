import { hasRealDueDate, normalizeTask, getExternalSourceKey } from "./appUtils.js";

export const CLASSROOM_AUTO_SYNC_INTERVAL_MS = 7 * 60 * 1000;
export const CLASSROOM_AUTO_SYNC_FRESHNESS_MS = 90 * 1000;

const DONE_CATEGORIES = new Set(["done", "returned"]);
const ACTIVE_CATEGORIES = new Set(["active", "missing"]);

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function getDefaultClassroomSyncSetting(course, subjectId = null) {
  return {
    classroomCourseId: cleanString(course?.classroomCourseId || course?.externalId),
    classroomCourseName: cleanString(course?.classroomCourseName || course?.name) || "Untitled class",
    subjectId,
    syncEnabled: true,
    syncActive: true,
    syncNoDueDate: false,
    syncCompleted: false,
    lastSyncedAt: null,
  };
}

export function mergeClassroomCoursesWithSettings(courses, settings) {
  const existing = new Map((settings || []).map((setting) => [setting.classroomCourseId, setting]));

  return (courses || [])
    .map((course) => {
      const courseId = cleanString(course?.classroomCourseId || course?.externalId);
      if (!courseId) return null;
      return {
        ...getDefaultClassroomSyncSetting(course),
        ...existing.get(courseId),
        classroomCourseId: courseId,
        classroomCourseName:
          cleanString(course?.classroomCourseName || course?.name) ||
          existing.get(courseId)?.classroomCourseName ||
          "Untitled class",
      };
    })
    .filter(Boolean);
}

export function pruneDeletedSubjectLinks(settings, subjects) {
  const subjectIds = new Set((subjects || []).map((subject) => subject.id));
  return (settings || []).map((setting) =>
    setting.subjectId && !subjectIds.has(setting.subjectId)
      ? { ...setting, subjectId: null }
      : setting
  );
}

export function shouldSyncNewClassroomAssignment(assignment, setting) {
  if (!setting?.syncEnabled) return false;
  const category = cleanString(assignment?.classroomStatusCategory) || "unknown";
  if (!hasRealDueDate(assignment?.dueDate)) return setting.syncNoDueDate === true;
  if (DONE_CATEGORIES.has(category)) return setting.syncCompleted === true;
  if (ACTIVE_CATEGORIES.has(category)) return setting.syncActive === true;
  return setting.syncActive === true;
}

export function createClassroomTaskFromAssignment(assignment, subject, syncedAt) {
  const category = cleanString(assignment?.classroomStatusCategory) || "unknown";
  const completed = DONE_CATEGORIES.has(category);

  return normalizeTask({
    id: `classroom-${cleanString(assignment?.externalId).replace(/[^a-z0-9-]+/gi, "-")}`,
    subject: subject?.name || cleanString(assignment?.linkedSubjectName),
    title: cleanString(assignment?.title) || "Untitled assignment",
    description: cleanString(assignment?.description),
    dueDate: cleanString(assignment?.dueDate),
    dueTime: cleanString(assignment?.dueTime),
    effort: 2,
    completed,
    completedAt: completed ? Date.parse(assignment?.submissionUpdatedAt) || Date.parse(syncedAt) : null,
    source: "classroom",
    externalId: cleanString(assignment?.externalId),
    classroomCourseId: cleanString(assignment?.classroomCourseId) || null,
    classroomCourseName: cleanString(assignment?.classroomCourseName) || null,
    linkedSubjectId: subject?.id || assignment?.linkedSubjectId || null,
    linkedSubjectName: subject?.name || cleanString(assignment?.linkedSubjectName),
    alternateLink: cleanString(assignment?.alternateLink),
    workType: cleanString(assignment?.workType),
    state: cleanString(assignment?.state),
    submissionId: assignment?.submissionId || null,
    submissionState: cleanString(assignment?.submissionState),
    classroomStatusCategory: category,
    late: assignment?.late === true,
    assignedGrade: assignment?.assignedGrade ?? null,
    draftGrade: assignment?.draftGrade ?? null,
    submissionUpdatedAt: assignment?.submissionUpdatedAt || null,
    importedAt: syncedAt,
    sourceUpdatedAt: assignment?.updateTime || assignment?.sourceUpdatedAt || null,
    lastSyncedAt: syncedAt,
    taskType: "homework",
    importance: "normal",
    detectedTags: [],
    importanceSource: "auto",
    archived: false,
    archivedAt: null,
  });
}

export function reconcileClassroomAssignments({ assignments, settings, subjects, tasks, syncedAt }) {
  const settingsByCourse = new Map((settings || []).map((setting) => [setting.classroomCourseId, setting]));
  const subjectsById = new Map((subjects || []).map((subject) => [subject.id, subject]));
  const tasksBySource = new Map((tasks || []).map((task) => [getExternalSourceKey(task), task]).filter(([key]) => key));
  const tasksToSync = [];
  const counts = { importedCount: 0, updatedCount: 0, skippedCount: 0, upToDateCount: 0 };

  (assignments || []).forEach((assignment) => {
    const setting = settingsByCourse.get(cleanString(assignment?.classroomCourseId));
    const subject = setting?.subjectId ? subjectsById.get(setting.subjectId) : null;
    const key = getExternalSourceKey(assignment);
    const existingTask = key ? tasksBySource.get(key) : null;

    if (!setting?.syncEnabled || !subject || !key) {
      counts.skippedCount += 1;
      return;
    }

    if (!existingTask && !shouldSyncNewClassroomAssignment(assignment, setting)) {
      counts.skippedCount += 1;
      return;
    }

    const classroomTask = createClassroomTaskFromAssignment(
      { ...assignment, linkedSubjectId: subject.id, linkedSubjectName: subject.name },
      subject,
      syncedAt
    );

    if (!existingTask) {
      counts.importedCount += 1;
      tasksToSync.push(classroomTask);
      return;
    }

    const nextTask = normalizeTask({
      ...existingTask,
      title: classroomTask.title,
      description: classroomTask.description,
      dueDate: classroomTask.dueDate,
      dueTime: classroomTask.dueTime,
      completed: classroomTask.completed,
      completedAt: classroomTask.completed
        ? existingTask.completedAt || classroomTask.completedAt
        : null,
      classroomCourseId: classroomTask.classroomCourseId,
      classroomCourseName: classroomTask.classroomCourseName,
      linkedSubjectId: subject.id,
      linkedSubjectName: subject.name,
      subject: subject.name,
      alternateLink: classroomTask.alternateLink,
      workType: classroomTask.workType,
      state: classroomTask.state,
      submissionId: classroomTask.submissionId,
      submissionState: classroomTask.submissionState,
      classroomStatusCategory: classroomTask.classroomStatusCategory,
      late: classroomTask.late,
      assignedGrade: classroomTask.assignedGrade,
      draftGrade: classroomTask.draftGrade,
      submissionUpdatedAt: classroomTask.submissionUpdatedAt,
      sourceUpdatedAt: classroomTask.sourceUpdatedAt,
      lastSyncedAt: syncedAt,
      archived: false,
      archivedAt: null,
    });

    const changed = [
      "title",
      "description",
      "dueDate",
      "dueTime",
      "completed",
      "completedAt",
      "classroomCourseName",
      "linkedSubjectId",
      "linkedSubjectName",
      "alternateLink",
      "submissionState",
      "classroomStatusCategory",
      "lastSyncedAt",
    ].some((field) => String(existingTask[field] ?? "") !== String(nextTask[field] ?? ""));

    if (changed) {
      counts.updatedCount += 1;
      tasksToSync.push(nextTask);
    } else {
      counts.upToDateCount += 1;
    }
  });

  return { tasksToSync, counts };
}
