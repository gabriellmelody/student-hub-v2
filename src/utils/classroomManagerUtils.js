export function getClassroomManagerState({
  sessionChecking = false,
  connected = false,
  sessionStatus = "",
  settingsLoading = false,
  settingsError = "",
  settingsUserMatches = true,
  activeSettings = [],
  coursesResolved = false,
  coursesError = "",
} = {}) {
  if (sessionChecking || settingsLoading || !settingsUserMatches) return "resolving";
  if (settingsError || coursesError) return "error";
  if (!connected) {
    return ["session_check_failed", "classroom_session_invalid_or_expired"].includes(sessionStatus)
      ? "reconnect"
      : "disconnected";
  }
  if (activeSettings.length > 0) return "configured";
  return coursesResolved ? "first-time" : "resolving";
}

export function sortClassroomSettingsBySubject(settings = [], subjects = []) {
  const subjectOrder = new Map(subjects.map((subject, index) => [String(subject?.id || ""), index]));
  const subjectNames = new Map(subjects.map((subject) => [String(subject?.id || ""), String(subject?.name || "")]));

  return [...settings].sort((left, right) => {
    const leftOrder = subjectOrder.get(String(left?.subjectId || ""));
    const rightOrder = subjectOrder.get(String(right?.subjectId || ""));
    if (leftOrder !== undefined || rightOrder !== undefined) {
      if (leftOrder === undefined) return 1;
      if (rightOrder === undefined) return -1;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    }
    return (
      (subjectNames.get(String(left?.subjectId || "")) || "").localeCompare(
        subjectNames.get(String(right?.subjectId || "")) || "",
        undefined,
        { sensitivity: "base" }
      ) ||
      String(left?.classroomCourseName || "").localeCompare(
        String(right?.classroomCourseName || ""),
        undefined,
        { sensitivity: "base" }
      ) ||
      String(left?.classroomCourseId || "").localeCompare(String(right?.classroomCourseId || ""))
    );
  });
}
