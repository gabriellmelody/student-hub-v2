const CLASSROOM_SYNC_SETTINGS_COLUMNS = [
  "id",
  "user_id",
  "classroom_course_id",
  "classroom_course_name",
  "subject_id",
  "sync_enabled",
  "sync_active",
  "sync_no_due_date",
  "sync_completed",
  "last_synced_at",
  "created_at",
  "updated_at",
].join(",");

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function mapClassroomSyncSetting(row = {}) {
  return {
    id: cleanString(row.id),
    userId: cleanString(row.user_id),
    classroomCourseId: cleanString(row.classroom_course_id),
    classroomCourseName: cleanString(row.classroom_course_name),
    subjectId: row.subject_id || null,
    syncEnabled: row.sync_enabled !== false,
    syncActive: row.sync_active !== false,
    syncNoDueDate: row.sync_no_due_date !== false,
    syncCompleted: row.sync_completed === true,
    lastSyncedAt: row.last_synced_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export function mapClassroomSyncSettingForUpsert(setting, userId) {
  return {
    user_id: userId,
    classroom_course_id: cleanString(setting?.classroomCourseId),
    classroom_course_name: cleanString(setting?.classroomCourseName),
    subject_id: setting?.subjectId || null,
    sync_enabled: setting?.syncEnabled !== false,
    sync_active: setting?.syncActive !== false,
    sync_no_due_date: setting?.syncNoDueDate !== false,
    sync_completed: setting?.syncCompleted === true,
    last_synced_at: setting?.lastSyncedAt || null,
  };
}

export async function fetchClassroomSyncSettings(client, userId) {
  if (!userId) return [];

  const { data, error } = await client
    .from("classroom_sync_settings")
    .select(CLASSROOM_SYNC_SETTINGS_COLUMNS)
    .eq("user_id", userId)
    .order("classroom_course_name", { ascending: true });

  if (error) throw error;
  return (data || []).map(mapClassroomSyncSetting).filter((setting) => setting.classroomCourseId);
}

export async function upsertClassroomSyncSettings(client, userId, settings) {
  if (!userId) throw new Error("Cannot save Classroom settings without a user.");
  const payloads = (Array.isArray(settings) ? settings : [])
    .map((setting) => mapClassroomSyncSettingForUpsert(setting, userId))
    .filter((setting) => setting.classroom_course_id);
  if (payloads.length === 0) return [];

  const { data, error } = await client
    .from("classroom_sync_settings")
    .upsert(payloads, { onConflict: "user_id,classroom_course_id" })
    .select(CLASSROOM_SYNC_SETTINGS_COLUMNS);

  if (error) throw error;
  return (data || []).map(mapClassroomSyncSetting);
}

export async function markClassroomSyncSettingsSynced(client, userId, courseIds, syncedAt) {
  const ids = [...new Set((courseIds || []).map(cleanString).filter(Boolean))];
  if (!userId || ids.length === 0) return [];

  const { data, error } = await client
    .from("classroom_sync_settings")
    .update({ last_synced_at: syncedAt })
    .eq("user_id", userId)
    .in("classroom_course_id", ids)
    .select(CLASSROOM_SYNC_SETTINGS_COLUMNS);

  if (error) throw error;
  return (data || []).map(mapClassroomSyncSetting);
}
