const SUBJECT_COLUMNS = [
  "id",
  "user_id",
  "name",
  "course_system",
  "level",
  "current_grade",
  "target_grade",
  "colour",
  "source",
  "classroom_course_id",
  "external_id",
  "imported_at",
  "last_synced_at",
  "sort_order",
  "created_at",
  "updated_at",
].join(",");

const CLOUD_SUBJECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function nullableString(value) {
  const cleaned = cleanString(value, "");
  return cleaned || null;
}

function normalizeSortOrder(value, fallback = 0) {
  const order = Number(value);
  return Number.isFinite(order) ? order : fallback;
}

export function isCloudSubjectId(subjectId) {
  return CLOUD_SUBJECT_ID_PATTERN.test(String(subjectId || ""));
}

export function mapCloudSubject(row = {}) {
  return {
    id: String(row.id || ""),
    name: cleanString(row.name),
    courseSystem: cleanString(row.course_system, "Other") || "Other",
    level: cleanString(row.level, "Other") || "Other",
    currentGrade: cleanString(row.current_grade),
    targetGrade: cleanString(row.target_grade),
    colour: row.colour || undefined,
    source: cleanString(row.source, "manual") || "manual",
    classroomCourseId: row.classroom_course_id || null,
    externalId: row.external_id || null,
    importedAt: row.imported_at || null,
    lastSyncedAt: row.last_synced_at || null,
    sortOrder: normalizeSortOrder(row.sort_order),
  };
}

export function mapSubjectForInsert(subject, userId, sortOrder = 0) {
  return {
    user_id: userId,
    name: cleanString(subject?.name),
    course_system: cleanString(subject?.courseSystem, "Other") || "Other",
    level: cleanString(subject?.level, "Other") || "Other",
    current_grade: cleanString(subject?.currentGrade),
    target_grade: cleanString(subject?.targetGrade),
    colour: subject?.colour || null,
    source: cleanString(subject?.source, "manual") || "manual",
    classroom_course_id: nullableString(subject?.classroomCourseId),
    external_id: nullableString(subject?.externalId),
    imported_at: subject?.importedAt || null,
    last_synced_at: subject?.lastSyncedAt || null,
    sort_order: sortOrder,
  };
}

export function mapSubjectForUpdate(subject, sortOrder = 0) {
  const insertPayload = mapSubjectForInsert(subject, "", sortOrder);
  const { user_id, ...updatePayload } = insertPayload;
  return updatePayload;
}

function subjectNeedsUpdate(currentSubject, nextSubject, sortOrder) {
  const currentPayload = mapSubjectForUpdate(currentSubject, currentSubject.sortOrder);
  const nextPayload = mapSubjectForUpdate(nextSubject, sortOrder);

  return Object.keys(nextPayload).some(
    (key) => currentPayload[key] !== nextPayload[key]
  );
}

export async function fetchCloudSubjects(client, userId) {
  if (!userId) return [];

  const { data, error } = await client
    .from("subjects")
    .select(SUBJECT_COLUMNS)
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []).map(mapCloudSubject).filter((subject) => subject.id && subject.name);
}

export async function createCloudSubject(client, userId, subject, sortOrder) {
  const { data, error } = await client
    .from("subjects")
    .insert(mapSubjectForInsert(subject, userId, sortOrder))
    .select(SUBJECT_COLUMNS)
    .single();

  if (error) throw error;
  return mapCloudSubject(data);
}

export async function updateCloudSubject(client, userId, subject, sortOrder) {
  const { data, error } = await client
    .from("subjects")
    .update(mapSubjectForUpdate(subject, sortOrder))
    .eq("user_id", userId)
    .eq("id", subject.id)
    .select(SUBJECT_COLUMNS)
    .single();

  if (error) throw error;
  return mapCloudSubject(data);
}

export async function deleteCloudSubject(client, userId, subjectId) {
  const { error } = await client
    .from("subjects")
    .delete()
    .eq("user_id", userId)
    .eq("id", subjectId);

  if (error) throw error;
  return true;
}

export async function reconcileCloudSubjects({
  client,
  userId,
  currentSubjects = [],
  nextSubjects = [],
}) {
  if (!userId) throw new Error("Cannot save Subjects without an authenticated user.");

  const desiredSubjects = Array.isArray(nextSubjects)
    ? nextSubjects.filter((subject) => subject && cleanString(subject.name))
    : [];
  const currentById = new Map(currentSubjects.map((subject) => [subject.id, subject]));
  const desiredCloudIds = new Set(
    desiredSubjects
      .map((subject) => subject.id)
      .filter((subjectId) => currentById.has(subjectId) && isCloudSubjectId(subjectId))
  );
  const savedSubjects = [];

  for (const [index, desiredSubject] of desiredSubjects.entries()) {
    const currentSubject = currentById.get(desiredSubject.id);

    if (currentSubject && isCloudSubjectId(desiredSubject.id)) {
      if (subjectNeedsUpdate(currentSubject, desiredSubject, index)) {
        savedSubjects.push(
          await updateCloudSubject(client, userId, desiredSubject, index)
        );
      } else {
        savedSubjects.push({ ...currentSubject, sortOrder: index });
      }
      continue;
    }

    savedSubjects.push(
      await createCloudSubject(client, userId, desiredSubject, index)
    );
  }

  for (const currentSubject of currentSubjects) {
    if (isCloudSubjectId(currentSubject.id) && !desiredCloudIds.has(currentSubject.id)) {
      await deleteCloudSubject(client, userId, currentSubject.id);
    }
  }

  return { subjects: savedSubjects };
}

export function subscribeToCloudSubjectChanges(client, userId, onChange) {
  if (!userId || typeof client?.channel !== "function") return () => {};

  const channel = client
    .channel(`subjects:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "subjects",
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
