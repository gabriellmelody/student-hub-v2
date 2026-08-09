import { normalizeTask } from "../utils/appUtils.js";

export const TASK_COLUMNS = [
  "id",
  "user_id",
  "subject_id",
  "subject_name",
  "title",
  "description",
  "due_date",
  "due_time",
  "effort",
  "completed",
  "completed_at",
  "source",
  "external_id",
  "task_type",
  "importance",
  "detected_tags",
  "importance_source",
  "classroom_course_id",
  "classroom_course_name",
  "alternate_link",
  "work_type",
  "state",
  "submission_id",
  "submission_state",
  "classroom_status_category",
  "late",
  "assigned_grade",
  "draft_grade",
  "submission_updated_at",
  "imported_at",
  "source_updated_at",
  "last_synced_at",
  "archived",
  "archived_at",
  "created_at",
  "updated_at",
].join(",");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value) {
  return cleanString(value) || null;
}

function timestampToMilliseconds(value) {
  if (value == null || value === "") return null;
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) return numericValue;
  const parsedValue = Date.parse(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function toTimestamp(value) {
  const milliseconds = timestampToMilliseconds(value);
  return milliseconds == null ? null : new Date(milliseconds).toISOString();
}

export function isCloudTaskId(taskId) {
  return UUID_PATTERN.test(String(taskId || ""));
}

export function getTasksForCloudWorkspace(workspace, userId) {
  return workspace?.userId === userId && Array.isArray(workspace?.tasks)
    ? workspace.tasks
    : [];
}

export function mapCloudTask(row = {}) {
  const subjectName = cleanString(row.subject_name);

  return normalizeTask({
    id: String(row.id || ""),
    subject: subjectName,
    linkedSubjectId: row.subject_id || null,
    linkedSubjectName: subjectName,
    title: cleanString(row.title),
    description: cleanString(row.description),
    dueDate: cleanString(row.due_date),
    dueTime: cleanString(row.due_time),
    effort: Number.isFinite(Number(row.effort)) ? Number(row.effort) : 2,
    completed: row.completed === true,
    completedAt: timestampToMilliseconds(row.completed_at),
    source: cleanString(row.source) || "manual",
    externalId: row.external_id || null,
    taskType: cleanString(row.task_type) || "homework",
    importance: cleanString(row.importance) || "normal",
    detectedTags: Array.isArray(row.detected_tags) ? row.detected_tags : [],
    importanceSource: cleanString(row.importance_source) || "auto",
    classroomCourseId: row.classroom_course_id || null,
    classroomCourseName: row.classroom_course_name || null,
    alternateLink: cleanString(row.alternate_link),
    workType: cleanString(row.work_type),
    state: cleanString(row.state),
    submissionId: row.submission_id || null,
    submissionState: cleanString(row.submission_state),
    classroomStatusCategory:
      cleanString(row.classroom_status_category) || "unknown",
    late: row.late === true,
    assignedGrade: row.assigned_grade ?? null,
    draftGrade: row.draft_grade ?? null,
    submissionUpdatedAt: row.submission_updated_at || null,
    importedAt: row.imported_at || null,
    sourceUpdatedAt: row.source_updated_at || null,
    lastSyncedAt: row.last_synced_at || null,
    archived: row.archived === true,
    archivedAt: row.archived_at || null,
  });
}

export function mapTaskForInsert(task, userId) {
  const subjectId = isCloudTaskId(task?.linkedSubjectId)
    ? task.linkedSubjectId
    : null;
  const subjectName = cleanString(task?.subject || task?.linkedSubjectName);

  return {
    user_id: userId,
    subject_id: subjectId,
    subject_name: subjectName,
    title: cleanString(task?.title),
    description: cleanString(task?.description),
    due_date: nullableString(task?.dueDate),
    due_time: nullableString(task?.dueTime),
    effort: Number.isFinite(Number(task?.effort)) ? Number(task.effort) : 2,
    completed: task?.completed === true,
    completed_at: task?.completed === true ? toTimestamp(task.completedAt) : null,
    source: cleanString(task?.source) || "manual",
    external_id: nullableString(task?.externalId),
    task_type: cleanString(task?.taskType) || "homework",
    importance: cleanString(task?.importance) || "normal",
    detected_tags: Array.isArray(task?.detectedTags) ? task.detectedTags : [],
    importance_source: cleanString(task?.importanceSource) || "auto",
    classroom_course_id: nullableString(task?.classroomCourseId),
    classroom_course_name: nullableString(task?.classroomCourseName),
    alternate_link: nullableString(task?.alternateLink),
    work_type: nullableString(task?.workType),
    state: nullableString(task?.state),
    submission_id: nullableString(task?.submissionId),
    submission_state: nullableString(task?.submissionState),
    classroom_status_category:
      cleanString(task?.classroomStatusCategory) || "unknown",
    late: task?.late === true,
    assigned_grade: task?.assignedGrade ?? null,
    draft_grade: task?.draftGrade ?? null,
    submission_updated_at: task?.submissionUpdatedAt || null,
    imported_at: task?.importedAt || null,
    source_updated_at: task?.sourceUpdatedAt || null,
    last_synced_at: task?.lastSyncedAt || null,
    archived: task?.archived === true,
    archived_at: task?.archived === true ? task?.archivedAt || null : null,
  };
}

export function mapTaskForUpdate(task) {
  const { user_id, ...payload } = mapTaskForInsert(task, "");
  return payload;
}

export async function fetchCloudTasks(client, userId) {
  if (!userId) return [];

  const { data, error } = await client
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []).map(mapCloudTask).filter((task) => task.id && task.title);
}

export async function createCloudTask(client, userId, task) {
  if (!userId) throw new Error("Cannot create a task without an authenticated user.");

  const { data, error } = await client
    .from("tasks")
    .insert(mapTaskForInsert(task, userId))
    .select(TASK_COLUMNS)
    .single();

  if (error) throw error;
  return mapCloudTask(data);
}

export async function createCloudTasks(client, userId, tasks) {
  if (!userId) throw new Error("Cannot create tasks without an authenticated user.");
  if (!Array.isArray(tasks) || tasks.length === 0) return [];

  const { data, error } = await client
    .from("tasks")
    .insert(tasks.map((task) => mapTaskForInsert(task, userId)))
    .select(TASK_COLUMNS);

  if (error) throw error;
  return (data || []).map(mapCloudTask);
}

export async function updateCloudTask(client, userId, task) {
  if (!userId || !isCloudTaskId(task?.id)) {
    throw new Error("Cannot update a task without a cloud task ID.");
  }

  const { data, error } = await client
    .from("tasks")
    .update(mapTaskForUpdate(task))
    .eq("user_id", userId)
    .eq("id", task.id)
    .select(TASK_COLUMNS)
    .single();

  if (error) throw error;
  return mapCloudTask(data);
}

export async function updateCloudTasks(client, userId, tasks) {
  const updatedTasks = [];
  for (const task of tasks || []) {
    updatedTasks.push(await updateCloudTask(client, userId, task));
  }
  return updatedTasks;
}

export async function upsertCloudClassroomTasks(client, userId, tasks) {
  if (!userId) throw new Error("Cannot sync tasks without an authenticated user.");
  if (!Array.isArray(tasks) || tasks.length === 0) return [];

  const uniqueTasks = new Map();
  tasks.forEach((task) => {
    const source = cleanString(task?.source);
    const externalId = cleanString(task?.externalId);
    if (source && externalId) uniqueTasks.set(`${source}:${externalId}`, task);
  });
  const payloads = [...uniqueTasks.values()].map((task) =>
    mapTaskForInsert(task, userId)
  );
  if (payloads.length === 0) return [];
  const { data, error } = await client
    .from("tasks")
    .upsert(payloads, { onConflict: "user_id,source,external_id" })
    .select(TASK_COLUMNS);

  if (error) throw error;
  return (data || []).map(mapCloudTask);
}

export async function deleteCloudTask(client, userId, taskId) {
  if (!userId || !isCloudTaskId(taskId)) return false;

  const { error } = await client
    .from("tasks")
    .delete()
    .eq("user_id", userId)
    .eq("id", taskId);

  if (error) throw error;
  return true;
}

export async function deleteCloudTasks(client, userId, taskIds) {
  const ids = [...new Set((taskIds || []).filter(isCloudTaskId))];
  if (!userId || ids.length === 0) return 0;

  const { error } = await client
    .from("tasks")
    .delete()
    .eq("user_id", userId)
    .in("id", ids);

  if (error) throw error;
  return ids.length;
}

export async function deleteAllCloudTasks(client, userId) {
  if (!userId) return false;
  const { error } = await client.from("tasks").delete().eq("user_id", userId);
  if (error) throw error;
  return true;
}

export function subscribeToCloudTaskChanges(client, userId, onChange) {
  if (!userId || typeof client?.channel !== "function") return () => {};

  const channel = client
    .channel(`tasks:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "tasks",
        filter: `user_id=eq.${userId}`,
      },
      onChange
    )
    .subscribe();

  return () => {
    if (typeof client.removeChannel === "function") {
      client.removeChannel(channel);
      return;
    }
    channel?.unsubscribe?.();
  };
}
