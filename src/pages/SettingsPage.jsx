import { useEffect, useState } from "react";
import {
  subjectCourseSystems,
  subjectLevels,
  accentColorPresets,
  getContrastText,
  createSubjectDraft,
  findSubjectProfile,
  hasRealDueDate,
  REAL_CLASSROOM_COURSE_LINKS_STORAGE_KEY,
  MOCK_CLASSROOM_COURSE_LINKS_STORAGE_KEY,
  MOCK_CLASSROOM_INTEGRATION_STORAGE_KEY,
  normalizeSubjectName,
} from "../utils/appUtils.js";
import {
  helpCategories,
  helpContent,
  helpStatusLabels,
} from "../data/helpContent.js";
import { mockClassroomData } from "../data/mockClassroomData.js";
import {
  integrationCatalog,
  integrationStatusLabels,
} from "../data/integrationCatalog.js";
import {
  buildMockClassroomPreview,
  createMockClassroomCourseLink,
  createSubjectFromMockCourse,
  findLinkedSubjectForMockCourse,
  formatMockClassroomDueDate,
  loadMockClassroomCourseLinks,
} from "../utils/classroomMockUtils.js";

const REAL_CLASSROOM_COURSE_SELECTIONS_KEY =
  "studentHub.realClassroomCourseSelections";
const GOOGLE_CALENDAR_PREFERENCES_KEY =
  "studentHub.googleCalendarPreferences";
const REAL_CLASSROOM_SOURCE = "classroom";
const CLASSROOM_STATUS_LABELS = {
  active: "Assigned",
  missing: "Missing",
  done: "Turned in",
  returned: "Returned",
  no_due_date: "No due date",
  unknown: "Unknown status",
};
const CLASSROOM_DONE_CATEGORIES = new Set(["done", "returned"]);
const COMMON_CLASSROOM_SUBJECTS = [
  ["world studies", "World Studies"],
  ["computer science", "Computer Science"],
  ["biology", "Biology"],
  ["chemistry", "Chemistry"],
  ["physics", "Physics"],
  ["english", "English"],
  ["spanish", "Spanish"],
  ["history", "History"],
  ["geography", "Geography"],
  ["economics", "Economics"],
  ["maths", "Maths"],
  ["math", "Maths"],
  ["science", "Science"],
  ["art", "Art"],
  ["music", "Music"],
  ["drama", "Drama"],
  ["design", "Design"],
];

function getRealClassroomCourseId(course) {
  return course?.classroomCourseId || course?.externalId || "";
}

function normalizeClassroomMatchText(value) {
  return normalizeSubjectName(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function hasClassroomSubjectPhrase(courseName, subjectName) {
  const courseText = ` ${normalizeClassroomMatchText(courseName)} `;
  const subjectText = normalizeClassroomMatchText(subjectName);

  if (!courseText.trim() || !subjectText) return false;

  const aliases =
    subjectText === "maths"
      ? ["maths", "math"]
      : subjectText === "math"
        ? ["math", "maths"]
        : [subjectText];

  return aliases.some((alias) => courseText.includes(` ${alias} `));
}

function findBestSubjectForClassroomCourse(subjects, course) {
  const exactSubject = findSubjectProfile(subjects, course?.name);

  if (exactSubject) return exactSubject;

  return (
    subjects.find((subject) =>
      hasClassroomSubjectPhrase(course?.name, subject.name)
    ) || null
  );
}

function getSuggestedClassroomSubjectName(course) {
  const courseName = course?.name || "";
  const matchedCommonSubject = COMMON_CLASSROOM_SUBJECTS.find(([keyword]) =>
    hasClassroomSubjectPhrase(courseName, keyword)
  );

  if (matchedCommonSubject) return matchedCommonSubject[1];

  return courseName.trim() || "Untitled Subject";
}

function createRealClassroomCourseLink(course, subject) {
  return {
    classroomCourseId: getRealClassroomCourseId(course),
    classroomCourseName: course?.name || "Untitled class",
    subjectId: subject.id,
    subjectName: subject.name,
    source: REAL_CLASSROOM_SOURCE,
    linkedAt: new Date().toISOString(),
  };
}

function getGoogleCalendarId(calendar) {
  return calendar?.id || "";
}

function getDefaultGoogleCalendarPreference(calendar) {
  const calendarId = getGoogleCalendarId(calendar);
  const selectedByGoogle =
    typeof calendar?.selected === "boolean"
      ? calendar.selected
      : calendar?.primary === true;

  return {
    calendarId,
    calendarName: calendar?.summary || calendar?.name || "Untitled calendar",
    showInStudentHub: selectedByGoogle,
    useAsBusyTime: selectedByGoogle,
    duplicateRisk: null,
  };
}

function normalizeGoogleCalendarPreference(calendarId, preference) {
  if (!calendarId || !preference || typeof preference !== "object") {
    return null;
  }

  return {
    calendarId,
    calendarName:
      typeof preference.calendarName === "string"
        ? preference.calendarName
        : "",
    showInStudentHub: preference.showInStudentHub === true,
    useAsBusyTime: preference.useAsBusyTime === true,
    duplicateRisk:
      preference.duplicateRisk &&
      typeof preference.duplicateRisk === "object" &&
      preference.duplicateRisk.source === REAL_CLASSROOM_SOURCE
        ? {
            source: REAL_CLASSROOM_SOURCE,
            classroomCourseId:
              typeof preference.duplicateRisk.classroomCourseId === "string"
                ? preference.duplicateRisk.classroomCourseId
                : "",
            classroomCourseName:
              typeof preference.duplicateRisk.classroomCourseName === "string"
                ? preference.duplicateRisk.classroomCourseName
                : "",
          }
        : null,
  };
}

function loadGoogleCalendarPreferences() {
  const savedPreferences = localStorage.getItem(
    GOOGLE_CALENDAR_PREFERENCES_KEY
  );

  if (!savedPreferences) return {};

  try {
    const parsedPreferences = JSON.parse(savedPreferences);

    if (!parsedPreferences || typeof parsedPreferences !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsedPreferences)
        .map(([calendarId, preference]) => [
          calendarId,
          normalizeGoogleCalendarPreference(calendarId, preference),
        ])
        .filter(([, preference]) => preference)
    );
  } catch {
    return {};
  }
}

function normalizeCalendarCourseMatchName(value) {
  return normalizeSubjectName(value)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeCalendarCourseYearTokens(value) {
  return value
    .split(" ")
    .filter(
      (token) =>
        !/^(?:s|f)?20\d{2}$/.test(token) &&
        !/^\d{2}\d{2}$/.test(token) &&
        !/^(?:20)?\d{2}(?:20)?\d{2}$/.test(token) &&
        !/^(?:20)?\d{2}$/.test(token)
    )
    .join(" ")
    .trim();
}

function getCalendarCourseMatchParts(value) {
  const normalizedName = normalizeCalendarCourseMatchName(value);
  const withoutYearTokens = removeCalendarCourseYearTokens(normalizedName);

  return {
    normalizedName,
    withoutYearTokens,
    meaningfulTokenCount: withoutYearTokens
      .split(" ")
      .filter((token) => token.length > 1 && !/^p\d+$/i.test(token)).length,
  };
}

function calendarNameMatchesClassroomCourse(calendarName, courseName) {
  const calendarParts = getCalendarCourseMatchParts(calendarName);
  const courseParts = getCalendarCourseMatchParts(courseName);

  if (
    !calendarParts.normalizedName ||
    !courseParts.normalizedName ||
    calendarParts.meaningfulTokenCount < 2 ||
    courseParts.meaningfulTokenCount < 2
  ) {
    return false;
  }

  return (
    calendarParts.normalizedName === courseParts.normalizedName ||
    (calendarParts.withoutYearTokens.length >= 8 &&
      courseParts.withoutYearTokens.length >= 8 &&
      calendarParts.withoutYearTokens === courseParts.withoutYearTokens)
  );
}

function getClassroomCalendarDuplicateRiskMap({
  calendars,
  courses,
  selections,
  subjectLinks,
  tasks,
  classroomConnected,
}) {
  if (!classroomConnected) return {};

  const importedCourseMap = new Map();

  tasks.forEach((task) => {
    if (task.source !== REAL_CLASSROOM_SOURCE || !task.classroomCourseId) {
      return;
    }

    importedCourseMap.set(task.classroomCourseId, {
      classroomCourseId: task.classroomCourseId,
      classroomCourseName: task.classroomCourseName || "",
    });
  });

  if (importedCourseMap.size === 0) return {};

  const coursesById = new Map();

  courses.forEach((course) => {
    const courseId = getRealClassroomCourseId(course);

    if (!courseId) return;

    coursesById.set(courseId, {
      classroomCourseId: courseId,
      classroomCourseName: course.name || course.classroomCourseName || "",
    });
  });

  importedCourseMap.forEach((importedCourse, courseId) => {
    if (!coursesById.has(courseId)) {
      coursesById.set(courseId, importedCourse);
    }
  });

  const duplicateRiskMap = {};

  calendars.forEach((calendar) => {
    const calendarId = getGoogleCalendarId(calendar);
    const calendarName = calendar.summary || calendar.name || "";

    if (!calendarId || !calendarName) return;

    const matchedCourse = Array.from(coursesById.values()).find((course) => {
      const courseId = course.classroomCourseId;
      const courseIsIncludedOrLinked =
        selections[courseId] === "included" || Boolean(subjectLinks[courseId]);

      return (
        courseIsIncludedOrLinked &&
        importedCourseMap.has(courseId) &&
        calendarNameMatchesClassroomCourse(
          calendarName,
          course.classroomCourseName
        )
      );
    });

    if (!matchedCourse) return;

    duplicateRiskMap[calendarId] = {
      source: REAL_CLASSROOM_SOURCE,
      classroomCourseId: matchedCourse.classroomCourseId,
      classroomCourseName: matchedCourse.classroomCourseName,
    };
  });

  return duplicateRiskMap;
}

function mergeGoogleCalendarPreferences(
  preferences,
  calendars,
  duplicateRiskMap = {}
) {
  const nextPreferences = { ...preferences };

  calendars.forEach((calendar) => {
    const calendarId = getGoogleCalendarId(calendar);

    if (!calendarId) return;

    const savedPreference = nextPreferences[calendarId];
    const duplicateRisk = duplicateRiskMap[calendarId] || null;
    const defaultPreference = {
      ...getDefaultGoogleCalendarPreference(calendar),
      ...(duplicateRisk
        ? {
            showInStudentHub: false,
            useAsBusyTime: false,
            duplicateRisk,
          }
        : {}),
    };

    nextPreferences[calendarId] = {
      ...defaultPreference,
      ...savedPreference,
      calendarId,
      calendarName: calendar.summary || calendar.name || "Untitled calendar",
      duplicateRisk,
    };
  });

  return nextPreferences;
}

function getImportedClassroomTaskMap(tasks) {
  return new Map(
    tasks
      .filter(
        (task) =>
          task.source === REAL_CLASSROOM_SOURCE &&
          typeof task.externalId === "string" &&
          task.externalId.trim()
      )
      .map((task) => [task.externalId, task])
  );
}

function hasClassroomAssignmentChanges(assignment, existingTask) {
  if (!existingTask) return false;

  const sourceUpdatedAt = assignment.updateTime || assignment.sourceUpdatedAt || "";

  return [
    ["title", assignment.title],
    ["description", assignment.description],
    ["dueDate", assignment.dueDate],
    ["dueTime", assignment.dueTime],
    ["alternateLink", assignment.alternateLink],
    ["classroomCourseName", assignment.classroomCourseName],
    ["submissionId", assignment.submissionId],
    ["submissionState", assignment.submissionState],
    ["classroomStatusCategory", assignment.classroomStatusCategory],
    ["late", assignment.late === true ? "true" : "false"],
    ["assignedGrade", assignment.assignedGrade],
    ["draftGrade", assignment.draftGrade],
    ["submissionUpdatedAt", assignment.submissionUpdatedAt],
    ["sourceUpdatedAt", sourceUpdatedAt],
  ].some(
    ([field, value]) => String(existingTask[field] || "") !== String(value || "")
  );
}

function getClassroomAssignmentSyncStatus({
  assignment,
  existingTask,
  linkedCourseIds,
}) {
  const hasDueDate = hasRealDueDate(assignment.dueDate);
  const category = assignment.classroomStatusCategory || "unknown";
  const isImported = Boolean(existingTask);
  const isUpdated = isImported && hasClassroomAssignmentChanges(assignment, existingTask);
  const isUnlinked = !linkedCourseIds.has(assignment.classroomCourseId);
  const badges = [];

  if (isUnlinked) badges.push({ label: "Unlinked subject", tone: "warning" });
  badges.push({
    label: CLASSROOM_STATUS_LABELS[category] || "Unknown status",
    tone:
      category === "missing"
        ? "warning"
        : CLASSROOM_DONE_CATEGORIES.has(category)
          ? "done"
          : category === "no_due_date" || category === "unknown"
            ? "muted"
            : "active",
  });
  if (!isImported) {
    badges.push({ label: "New", tone: "new" });
  } else if (isUpdated) {
    badges.push({ label: "Updated in Classroom", tone: "updated" });
  } else {
    badges.push({ label: "Already imported", tone: "imported" });
  }

  return {
    hasDueDate,
    category,
    isImported,
    isUpdated,
    isUnlinked,
    badges,
  };
}

function SettingsPage({
  tasks,
  subjects,
  setSubjects,
  theme,
  setTheme,
  accentColor,
  setAccentColor,
  layoutDensity,
  setLayoutDensity,
  homeLayout,
  setHomeLayout,
  rightRailVisible,
  setRightRailVisible,
  openHomeEditMode,
  openRightRailEditMode,
  restartOnboarding,
  resetTasks,
  resetSubjects,
  resetAppearancePreferences,
  clearAllStudentHubData,
  loadDemoWorkspace,
  removeDemoData,
  hasDemoTasks,
  hasDemoData,
  importMockClassroomAssignments,
  importRealClassroomAssignments,
  removeMockClassroomTasks,
  archiveNoDueDateClassroomTasks,
  restoreArchivedClassroomTasks,
  updateMockClassroomCourseSubject,
  initialView = "hub",
  classroomCallbackStatus = null,
  googleCalendarCallbackStatus = null,
}) {
  const [settingsView, setSettingsView] = useState(() => initialView || "hub");

  useEffect(() => {
    setSettingsView(initialView || "hub");
  }, [initialView]);

  const viewCopy = {
    hub: {
      eyebrow: "Settings",
      title: "Settings",
      description: "Manage your workspace preferences and future connections.",
    },
    appearance: {
      eyebrow: "Settings / Appearance",
      title: "Appearance",
      description: "Personalise how Student Hub looks and feels.",
    },
    subjects: {
      eyebrow: "Settings / Subjects",
      title: "Subjects",
      description: "Keep your courses and grade goals organised in one place.",
    },
    data: {
      eyebrow: "Settings / Data",
      title: "Data & reset",
      description: "Manage local Student Hub data and workspace defaults.",
    },
    help: {
      eyebrow: "Settings / Help",
      title: "Help / FAQ",
      description: "Quick answers for getting comfortable with Student Hub.",
    },
    integrations: {
      eyebrow: "Settings / Integrations",
      title: "Integrations",
      description: "Manage future school connections and local previews.",
    },
  };
  const currentViewCopy = viewCopy[settingsView];

  return (
    <div className={`page settings-page settings-view-${settingsView}`}>
      <header className="page-header">
        {settingsView !== "hub" && (
          <button
            type="button"
            className="settings-back-button"
            onClick={() => setSettingsView("hub")}
          >
            ← Settings
          </button>
        )}
        <p className="eyebrow">{currentViewCopy.eyebrow}</p>
        <h2>{currentViewCopy.title}</h2>
        <p>{currentViewCopy.description}</p>
      </header>

      {settingsView === "hub" ? (
        <div className="settings-hub-grid">
          <button
            type="button"
            className="settings-hub-card"
            onClick={() => setSettingsView("appearance")}
          >
            <span>
              <strong>Appearance</strong>
              <small>Theme, colour, density, and workspace layout</small>
            </span>
            <span className="settings-hub-arrow" aria-hidden="true">
              →
            </span>
          </button>

          <button
            type="button"
            className="settings-hub-card"
            onClick={() => setSettingsView("subjects")}
          >
            <span>
              <strong>Subjects</strong>
              <small>Courses, levels, grade goals, and colours</small>
            </span>
            <span className="settings-hub-arrow" aria-hidden="true">
              →
            </span>
          </button>

          <button
            type="button"
            className="settings-hub-card"
            onClick={() => setSettingsView("data")}
          >
            <span>
              <strong>Data & reset</strong>
              <small>Local data, workspace resets, and onboarding</small>
            </span>
            <span className="settings-hub-arrow" aria-hidden="true">
              →
            </span>
          </button>

          <button
            type="button"
            className="settings-hub-card"
            onClick={() => setSettingsView("help")}
          >
            <span>
              <strong>Help / FAQ</strong>
              <small>Guidance, local data, and common questions</small>
            </span>
            <span className="settings-hub-arrow" aria-hidden="true">
              →
            </span>
          </button>

          <button
            type="button"
            className="settings-hub-card"
            onClick={() => setSettingsView("integrations")}
          >
            <span>
              <strong>Integrations</strong>
              <small>Future school connections and local previews</small>
            </span>
            <span className="settings-hub-meta">
              <span className="settings-preview-status">Preview</span>
              <span className="settings-hub-arrow" aria-hidden="true">
                →
              </span>
            </span>
          </button>

          <button
            type="button"
            className="settings-hub-card coming-soon"
            disabled
          >
            <span>
              <strong>Account</strong>
              <small>Profile and sign-in preferences</small>
            </span>
            <span className="settings-coming-soon">Planned later</span>
          </button>
        </div>
      ) : settingsView === "appearance" ? (
        <div className="panel appearance-panel">
          <section className="appearance-group">
            <p className="settings-group-label">Visual</p>

            <div className="theme-setting">
              <div>
                <h3>Theme</h3>
                <p>Choose the appearance that feels most comfortable.</p>
              </div>

              <div className="theme-toggle" role="group" aria-label="Theme">
                {["light", "dark"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={theme === option ? "active" : ""}
                    aria-pressed={theme === option}
                    onClick={() => setTheme(option)}
                  >
                    {option === "light" ? "Light" : "Dark"}
                  </button>
                ))}
              </div>
            </div>

            <div className="theme-setting accent-setting">
              <div>
                <h3>Accent colour</h3>
                <p>Personalise highlights while keeping statuses distinct.</p>
              </div>

              <div className="accent-controls">
                <div
                  className="accent-presets"
                  aria-label="Accent colour presets"
                >
                  {accentColorPresets.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      className={accentColor === preset.value ? "active" : ""}
                      style={{
                        "--preset-color": preset.value,
                        "--preset-contrast": getContrastText(preset.value),
                      }}
                      aria-label={`${preset.label} accent`}
                      aria-pressed={accentColor === preset.value}
                      title={preset.label}
                      onClick={() => setAccentColor(preset.value)}
                    >
                      <span aria-hidden="true">✓</span>
                    </button>
                  ))}
                </div>

                <label className="accent-picker">
                  <span>Custom</span>
                  <input
                    type="color"
                    value={accentColor}
                    aria-label="Custom accent colour"
                    onChange={(event) => setAccentColor(event.target.value)}
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="appearance-group">
            <p className="settings-group-label">Layout</p>

            <div className="theme-setting density-setting">
              <div>
                <h3>Layout density</h3>
                <p>Choose between breathing room and a tighter workspace.</p>
              </div>

              <div
                className="theme-toggle density-toggle"
                role="group"
                aria-label="Layout density"
              >
                {["comfortable", "compact"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={layoutDensity === option ? "active" : ""}
                    aria-pressed={layoutDensity === option}
                    onClick={() => setLayoutDensity(option)}
                  >
                    {option === "comfortable" ? "Comfortable" : "Compact"}
                  </button>
                ))}
              </div>
            </div>

            <div className="theme-setting home-layout-setting">
              <div>
                <h3>Home layout</h3>
                <p>Choose a focused workspace or a fuller task overview.</p>
              </div>

              <div
                className="theme-toggle home-layout-toggle"
                role="group"
                aria-label="Home layout"
              >
                {["focused", "dashboard"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={homeLayout === option ? "active" : ""}
                    aria-pressed={homeLayout === option}
                    onClick={() => setHomeLayout(option)}
                  >
                    {option === "focused" ? "Focused" : "Dashboard"}
                  </button>
                ))}
              </div>
            </div>

            <div className="theme-setting right-rail-setting">
              <div>
                <h3>Side Panel</h3>
                <p>Show compact school context beside the workspace.</p>
              </div>

              <div
                className="theme-toggle right-rail-toggle"
                role="group"
                aria-label="Side Panel"
              >
                {[
                  ["On", true],
                  ["Off", false],
                ].map(([label, value]) => (
                  <button
                    key={label}
                    type="button"
                    className={rightRailVisible === value ? "active" : ""}
                    aria-pressed={rightRailVisible === value}
                    onClick={() => setRightRailVisible(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="widget-edit-launch-grid"
              aria-label="Widget customisation"
            >
              <button
                type="button"
                className="settings-widget-edit-card"
                onClick={openHomeEditMode}
              >
                <span>
                  <strong>Edit Home Page</strong>
                  <small>Reorder, hide, and resize Home widgets.</small>
                </span>
                <span aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                className="settings-widget-edit-card"
                onClick={openRightRailEditMode}
              >
                <span>
                  <strong>Edit Side Panel</strong>
                  <small>Reorder or hide quick side widgets.</small>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            </div>

          </section>
        </div>
      ) : settingsView === "subjects" ? (
        <SubjectsSettings subjects={subjects} setSubjects={setSubjects} />
      ) : settingsView === "data" ? (
        <DataSettings
          resetTasks={resetTasks}
          resetSubjects={resetSubjects}
          resetAppearancePreferences={resetAppearancePreferences}
          restartOnboarding={restartOnboarding}
          clearAllStudentHubData={clearAllStudentHubData}
          loadDemoWorkspace={loadDemoWorkspace}
          removeDemoData={removeDemoData}
          hasDemoTasks={hasDemoTasks}
          hasDemoData={hasDemoData}
        />
      ) : settingsView === "integrations" ? (
        <IntegrationsSettings
          tasks={tasks}
          subjects={subjects}
          setSubjects={setSubjects}
          importMockClassroomAssignments={importMockClassroomAssignments}
          importRealClassroomAssignments={importRealClassroomAssignments}
          removeMockClassroomTasks={removeMockClassroomTasks}
          archiveNoDueDateClassroomTasks={archiveNoDueDateClassroomTasks}
          restoreArchivedClassroomTasks={restoreArchivedClassroomTasks}
          updateMockClassroomCourseSubject={updateMockClassroomCourseSubject}
          classroomCallbackStatus={classroomCallbackStatus}
          googleCalendarCallbackStatus={googleCalendarCallbackStatus}
        />
      ) : (
        <HelpSettings />
      )}
    </div>
  );
}

function IntegrationsSettings({
  tasks,
  subjects,
  setSubjects,
  importMockClassroomAssignments,
  importRealClassroomAssignments,
  removeMockClassroomTasks,
  archiveNoDueDateClassroomTasks,
  restoreArchivedClassroomTasks,
  updateMockClassroomCourseSubject,
  classroomCallbackStatus,
  googleCalendarCallbackStatus,
}) {
  const sampleCourses = buildMockClassroomPreview(mockClassroomData);
  const importedCount = tasks.filter(
    (task) => task.source === "classroom-mock"
  ).length;
  const realClassroomImportedCount = tasks.filter(
    (task) => task.source === REAL_CLASSROOM_SOURCE
  ).length;
  const [showMockPreview, setShowMockPreview] = useState(false);
  const [showRealClassroomReview, setShowRealClassroomReview] = useState(false);
  const [showGoogleCalendarManager, setShowGoogleCalendarManager] =
    useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [classroomCleanupMessage, setClassroomCleanupMessage] = useState("");
  const [successToast, setSuccessToast] = useState(null);
  const [realClassroomSetup, setRealClassroomSetup] = useState({
    checking: false,
    result: null,
    error: "",
  });
  const [realClassroomSession, setRealClassroomSession] = useState({
    checking: true,
    connected: false,
    status: "checking",
    message: "Checking Classroom session...",
    tokenSummary: null,
  });
  const [realClassroomCourses, setRealClassroomCourses] = useState({
    loading: false,
    courses: [],
    summary: null,
    lastCheckedAt: "",
    message: "",
    error: "",
  });
  const [googleCalendarSession, setGoogleCalendarSession] = useState({
    checking: true,
    connected: false,
    status: "checking",
    message: "Checking Google Calendar...",
    tokenSummary: null,
  });
  const [googleCalendarCalendars, setGoogleCalendarCalendars] = useState({
    loading: false,
    calendars: [],
    summary: null,
    lastCheckedAt: "",
    message: "",
    error: "",
  });
  const [googleCalendarPreferences, setGoogleCalendarPreferences] = useState(
    loadGoogleCalendarPreferences
  );
  const [realClassroomAssignmentPreview, setRealClassroomAssignmentPreview] =
    useState({
      loading: false,
      assignments: [],
      summary: null,
      lastPreviewedAt: "",
      message: "",
      error: "",
      importResult: null,
      importResultCopy: null,
      selectedAssignmentIds: {},
    });
  const [realClassroomCourseSelections, setRealClassroomCourseSelections] =
    useState(() => {
      const savedSelections = localStorage.getItem(
        REAL_CLASSROOM_COURSE_SELECTIONS_KEY
      );

      if (!savedSelections) return {};

      try {
        const parsedSelections = JSON.parse(savedSelections);

        if (!parsedSelections || typeof parsedSelections !== "object") {
          return {};
        }

        return Object.fromEntries(
          Object.entries(parsedSelections).filter(([, value]) =>
            ["included", "ignored"].includes(value)
          )
        );
      } catch {
        return {};
      }
    });
  const [
    realClassroomCourseSubjectLinks,
    setRealClassroomCourseSubjectLinks,
  ] = useState(() => {
    const savedLinks = localStorage.getItem(
      REAL_CLASSROOM_COURSE_LINKS_STORAGE_KEY
    );

    if (!savedLinks) return {};

    try {
      const parsedLinks = JSON.parse(savedLinks);

      if (!parsedLinks || typeof parsedLinks !== "object") return {};

      return Object.fromEntries(
        Object.entries(parsedLinks)
          .filter(
            ([courseId, link]) =>
              typeof courseId === "string" &&
              link?.source === REAL_CLASSROOM_SOURCE &&
              typeof link.subjectId === "string" &&
              typeof link.subjectName === "string"
          )
          .map(([courseId, link]) => [
            courseId,
            {
              classroomCourseId: courseId,
              classroomCourseName: link.classroomCourseName || "",
              subjectId: link.subjectId,
              subjectName: link.subjectName,
              source: REAL_CLASSROOM_SOURCE,
              linkedAt: link.linkedAt || new Date().toISOString(),
            },
          ])
      );
    } catch {
      return {};
    }
  });
  const [classroomConnection, setClassroomConnection] = useState(() => {
    const fallbackState = {
      linked: false,
      mode: "sample",
      linkedAt: null,
      lastSyncedAt: null,
      importedCount,
      linkedCourseCount: 0,
    };
    const savedState = localStorage.getItem(
      MOCK_CLASSROOM_INTEGRATION_STORAGE_KEY
    );

    if (!savedState) return fallbackState;

    try {
      const parsedState = JSON.parse(savedState);

      return {
        ...fallbackState,
        linked: parsedState?.linked === true,
        linkedAt: parsedState?.linkedAt || null,
        lastSyncedAt: parsedState?.lastSyncedAt || null,
        importedCount,
        linkedCourseCount: Number.isFinite(parsedState?.linkedCourseCount)
          ? parsedState.linkedCourseCount
          : 0,
      };
    } catch {
      return fallbackState;
    }
  });
  const realClassroomCleanup = {
    candidateCount: tasks.filter(
      (task) =>
        task.source === REAL_CLASSROOM_SOURCE &&
        !hasRealDueDate(task.dueDate) &&
        !task.completed &&
        task.archived !== true
    ).length,
    dueDateActiveCount: tasks.filter(
      (task) =>
        task.source === REAL_CLASSROOM_SOURCE &&
        hasRealDueDate(task.dueDate) &&
        !task.completed &&
        task.archived !== true
    ).length,
    manualSafeCount: tasks.filter(
      (task) => task.source !== REAL_CLASSROOM_SOURCE
    ).length,
    archivedCount: tasks.filter(
      (task) => task.source === REAL_CLASSROOM_SOURCE && task.archived === true
    ).length,
    message: classroomCleanupMessage,
  };

  useEffect(() => {
    localStorage.setItem(
      MOCK_CLASSROOM_INTEGRATION_STORAGE_KEY,
      JSON.stringify({ ...classroomConnection, importedCount })
    );
  }, [classroomConnection, importedCount]);

  useEffect(() => {
    localStorage.setItem(
      REAL_CLASSROOM_COURSE_SELECTIONS_KEY,
      JSON.stringify(realClassroomCourseSelections)
    );
  }, [realClassroomCourseSelections]);

  useEffect(() => {
    localStorage.setItem(
      REAL_CLASSROOM_COURSE_LINKS_STORAGE_KEY,
      JSON.stringify(realClassroomCourseSubjectLinks)
    );
  }, [realClassroomCourseSubjectLinks]);

  useEffect(() => {
    localStorage.setItem(
      GOOGLE_CALENDAR_PREFERENCES_KEY,
      JSON.stringify(googleCalendarPreferences)
    );
  }, [googleCalendarPreferences]);

  useEffect(() => {
    checkRealClassroomSession();
    checkGoogleCalendarSession();
  }, []);

  useEffect(() => {
    if (classroomCallbackStatus?.result !== "connected") return;

    setSuccessToast({
      title: "Google Classroom connected",
      summary: "Ready to manage classes",
    });
  }, [classroomCallbackStatus]);

  useEffect(() => {
    if (googleCalendarCallbackStatus?.result !== "connected") return;

    setSuccessToast({
      title: "Google Calendar connected",
      summary: "Ready to load calendars",
    });
    checkGoogleCalendarSession();
  }, [googleCalendarCallbackStatus]);

  useEffect(() => {
    if (!successToast) return undefined;

    const toastTimer = window.setTimeout(() => {
      setSuccessToast(null);
    }, 3400);

    return () => window.clearTimeout(toastTimer);
  }, [successToast]);

  function syncSampleClassroom({ link = false } = {}) {
    const courseLinks = loadMockClassroomCourseLinks();
    const assignments = sampleCourses.flatMap((course) => {
      const linkedSubject = findLinkedSubjectForMockCourse(
        course,
        subjects,
        courseLinks
      );

      return course.assignments.map((assignment) => ({
        ...assignment,
        linkedSubjectId: linkedSubject?.id || null,
      }));
    });
    const result = importMockClassroomAssignments(assignments);
    const syncedAt = new Date().toISOString();
    const linkedCourseCount = sampleCourses.filter((course) =>
      findLinkedSubjectForMockCourse(course, subjects, courseLinks)
    ).length;

    setClassroomConnection((currentConnection) => ({
      ...currentConnection,
      linked: link ? true : currentConnection.linked,
      linkedAt: link
        ? currentConnection.linkedAt || syncedAt
        : currentConnection.linkedAt,
      lastSyncedAt: syncedAt,
      importedCount: importedCount + result.importedCount,
      linkedCourseCount,
    }));
    setSyncMessage(
      result.importedCount > 0
        ? `${result.importedCount} sample assignment${
            result.importedCount === 1 ? "" : "s"
          } synced.`
        : "Sample Classroom is up to date."
    );
  }

  function confirmAction() {
    if (pendingAction === "link") {
      syncSampleClassroom({ link: true });
    } else if (pendingAction === "unlink") {
      setClassroomConnection((currentConnection) => ({
        ...currentConnection,
        linked: false,
        linkedAt: null,
      }));
      setSyncMessage(
        "Sample Classroom unlinked. Imported tasks remain in Student Hub."
      );
    } else if (pendingAction === "remove") {
      const removedCount = removeMockClassroomTasks();

      setSyncMessage(
        `${removedCount} sample task${removedCount === 1 ? "" : "s"} removed. Manual tasks were kept.`
      );
    } else if (pendingAction === "archive-real-no-due") {
      const archivedCount = archiveNoDueDateClassroomTasks();

      setClassroomCleanupMessage(
        `${archivedCount} no-due-date Classroom task${
          archivedCount === 1 ? "" : "s"
        } archived · 0 due-date tasks archived · 0 manual tasks archived · Nothing was deleted.`
      );
    }

    setPendingAction(null);
  }

  function restoreArchivedRealClassroomTasks() {
    const restoredCount = restoreArchivedClassroomTasks();

    setClassroomCleanupMessage(
      `${restoredCount} archived Classroom task${
        restoredCount === 1 ? "" : "s"
      } restored to active views.`
    );
  }

  function updateCourseMapping(course, subject, courseLinks) {
    updateMockClassroomCourseSubject(course.externalId, subject?.name || "");
    setClassroomConnection((currentConnection) => ({
      ...currentConnection,
      linkedCourseCount: courseLinks.length,
    }));
  }

  async function checkRealClassroomSetup() {
    setRealClassroomSetup({
      checking: true,
      result: null,
      error: "",
    });

    try {
      const response = await fetch("/api/google-classroom/connect?mode=readiness", {
        headers: {
          Accept: "application/json",
        },
      });
      const result = await response.json();

      setRealClassroomSetup({
        checking: false,
        result,
        error: "",
      });
    } catch {
      setRealClassroomSetup({
        checking: false,
        result: null,
        error: "Could not check setup status. Try again later.",
      });
    }
  }

  async function checkRealClassroomSession() {
    setRealClassroomSession((currentState) => ({
      ...currentState,
      checking: true,
    }));

    try {
      const response = await fetch("/api/google-classroom/session", {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });
      const result = await response.json();

      setRealClassroomSession({
        checking: false,
        connected: result.connected === true,
        status: result.status || "unknown",
        message:
          result.connected === true
            ? "Google Classroom connected."
            : result.message || "No Google account connected.",
        tokenSummary: result.tokenSummary || null,
      });
    } catch {
      setRealClassroomSession({
        checking: false,
        connected: false,
        status: "session_check_failed",
        message: "Could not check Classroom connection status.",
        tokenSummary: null,
      });
    }
  }

  async function loadRealClassroomCourses() {
    setRealClassroomCourses((currentState) => ({
      ...currentState,
      loading: true,
      message: "",
      error: "",
    }));

    try {
      const response = await fetch("/api/google-classroom/courses", {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });
      const result = await response.json();

      if (!response.ok || result.ok !== true) {
        if (
          result.status === "no_classroom_session" ||
          result.status === "classroom_session_invalid_or_expired"
        ) {
          setRealClassroomSession({
            checking: false,
            connected: false,
            status: result.status,
            message:
              result.status === "no_classroom_session"
                ? "No Google account connected."
                : "Classroom connection expired. Connect again.",
            tokenSummary: null,
          });
        }

        setRealClassroomCourses((currentState) => ({
          ...currentState,
          loading: false,
          error:
            result.status === "no_classroom_session"
              ? "Connect Google Classroom first, then load courses."
              : result.message || "Could not load Classroom courses.",
        }));
        return;
      }

      const loadedCourses = Array.isArray(result.courses) ? result.courses : [];

      setRealClassroomCourses({
        loading: false,
        courses: loadedCourses,
        summary: result.courseSummary || null,
        lastCheckedAt: new Date().toISOString(),
        message:
          result.courseSummary?.count === 0
            ? "Google Classroom connected, but no active classes were found."
            : "Classes loaded. Choose what Student Hub should use.",
        error: "",
      });
      setRealClassroomSession((currentState) => ({
        ...currentState,
        checking: false,
        connected: true,
        status: "classroom_session_available",
        message: "Google Classroom connected.",
      }));
      addSuggestedRealClassroomSubjectLinks(
        loadedCourses,
        realClassroomCourseSelections
      );
      if (loadedCourses.length > 0) {
        setShowRealClassroomReview(true);
      }
      setSuccessToast({
        title: "Google Classroom ready",
        summary: `${loadedCourses.length} class${
          loadedCourses.length === 1 ? "" : "es"
        } found`,
      });
    } catch {
      setRealClassroomCourses((currentState) => ({
        ...currentState,
        loading: false,
        error: "Could not load Classroom courses. Try again later.",
      }));
    }
  }

  async function checkGoogleCalendarSession() {
    setGoogleCalendarSession((currentState) => ({
      ...currentState,
      checking: true,
    }));

    try {
      const response = await fetch("/api/google-calendar/session", {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });
      const result = await response.json();

      setGoogleCalendarSession({
        checking: false,
        connected: result.connected === true,
        status: result.status || "unknown",
        message:
          result.connected === true
            ? "Google Calendar connected."
            : result.message || "No Google Calendar connected.",
        tokenSummary: result.tokenSummary || null,
      });
    } catch {
      setGoogleCalendarSession({
        checking: false,
        connected: false,
        status: "session_check_failed",
        message: "Could not check Google Calendar status.",
        tokenSummary: null,
      });
    }
  }

  async function loadGoogleCalendars() {
    setGoogleCalendarCalendars((currentState) => ({
      ...currentState,
      loading: true,
      message: "",
      error: "",
    }));

    try {
      const response = await fetch("/api/google-calendar/calendars", {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });
      const result = await response.json();

      if (!response.ok || result.ok !== true) {
        if (
          result.status === "no_calendar_session" ||
          result.status === "calendar_session_invalid_or_expired"
        ) {
          setGoogleCalendarSession({
            checking: false,
            connected: false,
            status: result.status,
            message:
              result.status === "no_calendar_session"
                ? "No Google Calendar connected."
                : "Google Calendar connection expired. Connect again.",
            tokenSummary: null,
          });
        }

        setGoogleCalendarCalendars((currentState) => ({
          ...currentState,
          loading: false,
          error:
            result.status === "no_calendar_session"
              ? "Connect Google Calendar first, then load calendars."
              : result.message || "Could not load Google calendars.",
        }));
        return;
      }

      const loadedCalendars = Array.isArray(result.calendars)
        ? result.calendars
        : [];
      const duplicateRiskMap = getClassroomCalendarDuplicateRiskMap({
        calendars: loadedCalendars,
        courses: realClassroomCourses.courses,
        selections: realClassroomCourseSelections,
        subjectLinks: realClassroomCourseSubjectLinks,
        tasks,
        classroomConnected: realClassroomSession.connected,
      });

      setGoogleCalendarCalendars({
        loading: false,
        calendars: loadedCalendars,
        summary: result.calendarSummary || null,
        lastCheckedAt: new Date().toISOString(),
        message:
          loadedCalendars.length === 0
            ? "Google Calendar connected, but no calendars were found."
            : "Calendars loaded. Events are not imported yet.",
        error: "",
      });
      setGoogleCalendarPreferences((currentPreferences) =>
        mergeGoogleCalendarPreferences(
          currentPreferences,
          loadedCalendars,
          duplicateRiskMap
        )
      );
      setGoogleCalendarSession((currentState) => ({
        ...currentState,
        checking: false,
        connected: true,
        status: "calendar_session_available",
        message: "Google Calendar connected.",
      }));
      setSuccessToast({
        title: "Google Calendar ready",
        summary: `${loadedCalendars.length} calendar${
          loadedCalendars.length === 1 ? "" : "s"
        } found`,
      });
      if (loadedCalendars.length > 0) {
        setShowGoogleCalendarManager(true);
      }
    } catch {
      setGoogleCalendarCalendars((currentState) => ({
        ...currentState,
        loading: false,
        error: "Could not load Google calendars. Try again later.",
      }));
    }
  }

  function updateGoogleCalendarPreference(calendar, updates) {
    const calendarId = getGoogleCalendarId(calendar);

    if (!calendarId) return;

    setGoogleCalendarPreferences((currentPreferences) => ({
      ...currentPreferences,
      [calendarId]: {
        ...getDefaultGoogleCalendarPreference(calendar),
        ...currentPreferences[calendarId],
        calendarId,
        calendarName: calendar.summary || calendar.name || "Untitled calendar",
        ...updates,
      },
    }));
  }

  function updateAllGoogleCalendarVisibility(showInStudentHub) {
    setGoogleCalendarPreferences((currentPreferences) => {
      const nextPreferences = { ...currentPreferences };

      googleCalendarCalendars.calendars.forEach((calendar) => {
        const calendarId = getGoogleCalendarId(calendar);

        if (!calendarId) return;

        nextPreferences[calendarId] = {
          ...getDefaultGoogleCalendarPreference(calendar),
          ...nextPreferences[calendarId],
          calendarId,
          calendarName: calendar.summary || calendar.name || "Untitled calendar",
          showInStudentHub,
        };
      });

      return nextPreferences;
    });
  }

  function getSuggestedRealClassroomCourseLink(course) {
    const matchedSubject = findBestSubjectForClassroomCourse(subjects, course);

    return matchedSubject
      ? createRealClassroomCourseLink(course, matchedSubject)
      : null;
  }

  function addSuggestedRealClassroomSubjectLinks(courses, selections) {
    setRealClassroomCourseSubjectLinks((currentLinks) => {
      const nextLinks = { ...currentLinks };
      let changed = false;

      courses.forEach((course) => {
        const courseId = getRealClassroomCourseId(course);

        if (
          !courseId ||
          selections[courseId] !== "included" ||
          nextLinks[courseId]
        ) {
          return;
        }

        const suggestedLink = getSuggestedRealClassroomCourseLink(course);

        if (!suggestedLink) return;

        nextLinks[courseId] = suggestedLink;
        changed = true;
      });

      return changed ? nextLinks : currentLinks;
    });
  }

  function updateRealClassroomCourseSelection(courseId, selection) {
    setRealClassroomCourseSelections((currentSelections) => {
      const nextSelections = { ...currentSelections };

      if (selection === "included" || selection === "ignored") {
        nextSelections[courseId] = selection;
      } else {
        delete nextSelections[courseId];
      }

      return nextSelections;
    });

    const course = realClassroomCourses.courses.find(
      (courseItem) => getRealClassroomCourseId(courseItem) === courseId
    );

    if (selection === "included" && course) {
      setRealClassroomCourseSubjectLinks((currentLinks) => {
        if (currentLinks[courseId]) return currentLinks;

        const suggestedLink = getSuggestedRealClassroomCourseLink(course);

        return suggestedLink
          ? { ...currentLinks, [courseId]: suggestedLink }
          : currentLinks;
      });
    } else if (selection === "ignored") {
      setRealClassroomCourseSubjectLinks((currentLinks) => {
        if (!currentLinks[courseId]) return currentLinks;

        const nextLinks = { ...currentLinks };
        delete nextLinks[courseId];
        return nextLinks;
      });
    }
  }

  function updateAllRealClassroomCourseSelections(selection) {
    setRealClassroomCourseSelections((currentSelections) => {
      const nextSelections = { ...currentSelections };

      realClassroomCourses.courses.forEach((course) => {
        const courseId = getRealClassroomCourseId(course);
        if (courseId) nextSelections[courseId] = selection;
      });

      return nextSelections;
    });

    if (selection === "included") {
      setRealClassroomCourseSubjectLinks((currentLinks) => {
        const nextLinks = { ...currentLinks };
        let changed = false;

        realClassroomCourses.courses.forEach((course) => {
          const courseId = getRealClassroomCourseId(course);

          if (!courseId || nextLinks[courseId]) return;

          const suggestedLink = getSuggestedRealClassroomCourseLink(course);

          if (!suggestedLink) return;

          nextLinks[courseId] = suggestedLink;
          changed = true;
        });

        return changed ? nextLinks : currentLinks;
      });
    } else if (selection === "ignored") {
      setRealClassroomCourseSubjectLinks((currentLinks) => {
        const nextLinks = { ...currentLinks };
        let changed = false;

        realClassroomCourses.courses.forEach((course) => {
          const courseId = getRealClassroomCourseId(course);

          if (!courseId || !nextLinks[courseId]) return;

          delete nextLinks[courseId];
          changed = true;
        });

        return changed ? nextLinks : currentLinks;
      });
    }
  }

  function resetRealClassroomCourseSelections() {
    setRealClassroomCourseSelections((currentSelections) => {
      const nextSelections = { ...currentSelections };

      realClassroomCourses.courses.forEach((course) => {
        delete nextSelections[getRealClassroomCourseId(course)];
      });

      return nextSelections;
    });

    setRealClassroomCourseSubjectLinks((currentLinks) => {
      const nextLinks = { ...currentLinks };
      let changed = false;

      realClassroomCourses.courses.forEach((course) => {
        const courseId = getRealClassroomCourseId(course);

        if (!courseId || !nextLinks[courseId]) return;

        delete nextLinks[courseId];
        changed = true;
      });

      return changed ? nextLinks : currentLinks;
    });
  }

  function updateRealClassroomCourseSubject(course, subjectId) {
    const courseId = getRealClassroomCourseId(course);

    if (!courseId) return;

    const selectedSubject = subjects.find((subject) => subject.id === subjectId);

    setRealClassroomCourseSubjectLinks((currentLinks) => {
      if (!selectedSubject) {
        if (!currentLinks[courseId]) return currentLinks;

        const nextLinks = { ...currentLinks };
        delete nextLinks[courseId];
        return nextLinks;
      }

      return {
        ...currentLinks,
        [courseId]: createRealClassroomCourseLink(course, selectedSubject),
      };
    });
  }

  function createSubjectFromRealClassroomCourse(course) {
    const courseId = getRealClassroomCourseId(course);

    if (!courseId) return;

    const existingSubject = findBestSubjectForClassroomCourse(subjects, course);

    if (existingSubject) {
      updateRealClassroomCourseSubject(course, existingSubject.id);
      return;
    }

    const subjectName = getSuggestedClassroomSubjectName(course);
    const duplicateSubject = findSubjectProfile(subjects, subjectName);

    if (duplicateSubject) {
      updateRealClassroomCourseSubject(course, duplicateSubject.id);
      return;
    }

    const newSubject = {
      id: `subject-${REAL_CLASSROOM_SOURCE}-${courseId}`,
      ...createSubjectDraft("Other"),
      name: subjectName,
      courseSystem: "Other",
      level: "Other",
      source: REAL_CLASSROOM_SOURCE,
      classroomCourseId: courseId,
      externalId: courseId,
      importedAt: new Date().toISOString(),
      lastSyncedAt: null,
    };

    setSubjects((currentSubjects) => {
      const existingCurrentSubject =
        findBestSubjectForClassroomCourse(currentSubjects, course) ||
        findSubjectProfile(currentSubjects, subjectName);

      if (existingCurrentSubject) return currentSubjects;

      return [...currentSubjects, newSubject];
    });
    setRealClassroomCourseSubjectLinks((currentLinks) => ({
      ...currentLinks,
      [courseId]: createRealClassroomCourseLink(course, newSubject),
    }));
  }

  function getIncludedRealClassroomCoursesForPreview() {
    return realClassroomCourses.courses
      .filter((course) => {
        const courseId = getRealClassroomCourseId(course);

        return courseId && realClassroomCourseSelections[courseId] === "included";
      })
      .map((course) => {
        const courseId = getRealClassroomCourseId(course);
        const link = realClassroomCourseSubjectLinks[courseId];

        return {
          classroomCourseId: courseId,
          classroomCourseName: course.name,
          linkedSubjectId: link?.subjectId || "",
          linkedSubjectName: link?.subjectName || "",
        };
      });
  }

  async function previewRealClassroomAssignments() {
    const includedCourses = getIncludedRealClassroomCoursesForPreview();

    if (includedCourses.length === 0) {
      setRealClassroomAssignmentPreview((currentPreview) => ({
        ...currentPreview,
        loading: false,
        error: "Choose at least one class first.",
        message: "",
      }));
      return;
    }

    setRealClassroomAssignmentPreview((currentPreview) => ({
      ...currentPreview,
      loading: true,
      error: "",
      message: "",
      importResult: null,
      importResultCopy: null,
      selectedAssignmentIds: {},
    }));

    try {
      const response = await fetch("/api/google-classroom/coursework-preview", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ courses: includedCourses }),
      });
      const result = await response.json();

      if (!response.ok || result.ok !== true) {
        if (
          result.status === "no_classroom_session" ||
          result.status === "classroom_session_invalid_or_expired"
        ) {
          setRealClassroomSession({
            checking: false,
            connected: false,
            status: result.status,
            message:
              result.status === "no_classroom_session"
                ? "No Google account connected."
                : "Classroom connection expired. Connect again.",
            tokenSummary: null,
          });
        }

        setRealClassroomAssignmentPreview((currentPreview) => ({
          ...currentPreview,
          loading: false,
          error:
            result.status === "classroom_submission_status_permission_error"
              ? "Student Hub can read assignments but not submission status yet. Reconnect Google Classroom or check school permissions."
              : result.status === "classroom_coursework_permission_error"
              ? "Student Hub needs assignment access. Reconnect Google Classroom and approve read-only access."
              : result.message || "Could not preview Classroom assignments.",
        }));
        return;
      }

      const previewAssignments = Array.isArray(result.assignments)
        ? result.assignments
        : [];
      const importedClassroomTasks = getImportedClassroomTaskMap(tasks);
      const linkedCourseIds = new Set(
        Object.keys(realClassroomCourseSubjectLinks)
      );
      const selectedAssignmentIds = Object.fromEntries(
        previewAssignments
          .filter((assignment) => {
            const courseId = assignment.classroomCourseId;
            const existingTask = importedClassroomTasks.get(
              assignment.externalId
            );

            return (
              realClassroomCourseSelections[courseId] === "included" &&
              linkedCourseIds.has(courseId) &&
              hasRealDueDate(assignment.dueDate) &&
              ["active", "missing"].includes(
                assignment.classroomStatusCategory || "unknown"
              ) &&
              (!existingTask ||
                hasClassroomAssignmentChanges(assignment, existingTask))
            );
          })
          .map((assignment) => [assignment.externalId, true])
      );

      setRealClassroomAssignmentPreview({
        loading: false,
        assignments: previewAssignments,
        summary: result.previewSummary || null,
        lastPreviewedAt: result.previewSummary?.previewedAt || new Date().toISOString(),
        message: result.message || "Assignments ready to review.",
        error: "",
        importResult: null,
        importResultCopy: null,
        selectedAssignmentIds,
      });
    } catch {
      setRealClassroomAssignmentPreview((currentPreview) => ({
        ...currentPreview,
        loading: false,
        error: "Could not preview Classroom assignments. Try again later.",
      }));
    }
  }

  function getImportableRealClassroomAssignments() {
    return realClassroomAssignmentPreview.assignments
      .filter((assignment) => {
        const courseId = assignment.classroomCourseId;

        return (
          realClassroomCourseSelections[courseId] === "included" &&
          realClassroomAssignmentPreview.selectedAssignmentIds[
            assignment.externalId
          ] === true
        );
      })
      .map((assignment) => {
        const link = realClassroomCourseSubjectLinks[assignment.classroomCourseId];

        return {
          ...assignment,
          linkedSubjectId: link?.subjectId || assignment.linkedSubjectId || "",
          linkedSubjectName:
            link?.subjectName || assignment.linkedSubjectName || "",
        };
      });
  }

  function importPreviewedRealClassroomAssignments() {
    const importableAssignments = getImportableRealClassroomAssignments();
    const hasUnlinkedAssignments = importableAssignments.some(
      (assignment) => !assignment.linkedSubjectId || !assignment.linkedSubjectName
    );

    if (importableAssignments.length === 0) {
      setRealClassroomAssignmentPreview((currentPreview) => ({
        ...currentPreview,
        error: "Select at least one assignment to import or sync.",
        importResult: null,
        importResultCopy: null,
      }));
      return;
    }

    if (hasUnlinkedAssignments) {
      setRealClassroomAssignmentPreview((currentPreview) => ({
        ...currentPreview,
        error: "Link included classes to Subjects before importing assignments.",
        importResult: null,
        importResultCopy: null,
      }));
      return;
    }

    const result = importRealClassroomAssignments(importableAssignments);
    const resultCopy = getRealClassroomImportResultCopy(
      result,
      importableAssignments.length
    );

    setRealClassroomAssignmentPreview((currentPreview) => ({
      ...currentPreview,
      error: "",
      message: resultCopy.inlineSummary,
      importResult: result,
      importResultCopy: resultCopy,
    }));
    setSuccessToast({
      title: resultCopy.title,
      summary: resultCopy.toastSummary,
    });
  }

  function updateRealClassroomAssignmentSelection(assignmentId, selected) {
    setRealClassroomAssignmentPreview((currentPreview) => {
      const nextSelectedAssignmentIds = {
        ...currentPreview.selectedAssignmentIds,
      };

      if (selected) {
        nextSelectedAssignmentIds[assignmentId] = true;
      } else {
        delete nextSelectedAssignmentIds[assignmentId];
      }

      return {
        ...currentPreview,
        error: "",
        selectedAssignmentIds: nextSelectedAssignmentIds,
      };
    });
  }

  function updateVisibleRealClassroomAssignmentSelection(mode, assignmentIds = null) {
    setRealClassroomAssignmentPreview((currentPreview) => {
      const nextSelectedAssignmentIds =
        mode === "clear" ? {} : { ...currentPreview.selectedAssignmentIds };
      const visibleAssignmentIds = Array.isArray(assignmentIds)
        ? new Set(assignmentIds)
        : null;
      const assignmentsToUpdate = visibleAssignmentIds
        ? currentPreview.assignments.filter((assignment) =>
            visibleAssignmentIds.has(assignment.externalId)
          )
        : currentPreview.assignments;

      assignmentsToUpdate.forEach((assignment) => {
        if (mode === "all" || (mode === "due" && hasRealDueDate(assignment.dueDate))) {
          nextSelectedAssignmentIds[assignment.externalId] = true;
        } else if (mode === "clear" || mode === "due") {
          delete nextSelectedAssignmentIds[assignment.externalId];
        }
      });

      return {
        ...currentPreview,
        error: "",
        selectedAssignmentIds: nextSelectedAssignmentIds,
      };
    });
  }

  const visibleIntegrations = integrationCatalog.filter(
    (integration) => integration.id !== "google-classroom"
  );

  return (
    <div className="integrations-settings">
      <section className="panel integration-control-panel">
        <div className="integration-control-intro">
          <div>
            <p className="settings-group-label">Connections</p>
            <h3>School tools in one place</h3>
            <p>Manage Classroom and future school tools.</p>
          </div>
          <span>Local workspace</span>
        </div>

        {classroomCallbackStatus && (
          <RealClassroomReturnStatus status={classroomCallbackStatus} />
        )}
        {googleCalendarCallbackStatus && (
          <GoogleCalendarReturnStatus status={googleCalendarCallbackStatus} />
        )}

        <div className="integration-card-grid">
          {visibleIntegrations.map((integration) => (
            <IntegrationCard
              integration={integration}
              key={integration.id}
              classroomConnection={classroomConnection}
              importedCount={importedCount}
              syncMessage={syncMessage}
              realClassroomSetup={realClassroomSetup}
              realClassroomSession={realClassroomSession}
              realClassroomCourses={realClassroomCourses}
              realClassroomCourseSelections={realClassroomCourseSelections}
              realClassroomCleanup={realClassroomCleanup}
              realClassroomImportedCount={realClassroomImportedCount}
              googleCalendarSession={googleCalendarSession}
              googleCalendarCalendars={googleCalendarCalendars}
              googleCalendarPreferences={googleCalendarPreferences}
              realClassroomLinkedSubjectCount={
                Object.keys(realClassroomCourseSubjectLinks).length
              }
              onLink={() => setPendingAction("link")}
              onSync={() => syncSampleClassroom()}
              onUnlink={() => setPendingAction("unlink")}
              onRemove={() => setPendingAction("remove")}
              onPreview={() => setShowMockPreview(true)}
              onCheckRealClassroomSetup={checkRealClassroomSetup}
              onLoadRealClassroomCourses={loadRealClassroomCourses}
              onLoadGoogleCalendars={loadGoogleCalendars}
              onManageGoogleCalendars={() => setShowGoogleCalendarManager(true)}
            />
          ))}
        </div>
      </section>

      {showMockPreview && (
        <MockClassroomPreview
          tasks={tasks}
          subjects={subjects}
          setSubjects={setSubjects}
          onCourseMappingChange={updateCourseMapping}
          onClose={() => setShowMockPreview(false)}
        />
      )}

      {showRealClassroomReview && (
        <RealClassroomCourseReviewModal
          courseState={realClassroomCourses}
          selections={realClassroomCourseSelections}
          subjects={subjects}
          subjectLinks={realClassroomCourseSubjectLinks}
          onSelectCourse={updateRealClassroomCourseSelection}
          onSelectSubject={updateRealClassroomCourseSubject}
          onCreateSubject={createSubjectFromRealClassroomCourse}
          cleanup={realClassroomCleanup}
          assignmentPreview={realClassroomAssignmentPreview}
          importedClassroomTasks={getImportedClassroomTaskMap(tasks)}
          onPreviewAssignments={previewRealClassroomAssignments}
          onImportAssignments={importPreviewedRealClassroomAssignments}
          onSelectAssignment={updateRealClassroomAssignmentSelection}
          onSelectAllAssignments={(assignmentIds) =>
            updateVisibleRealClassroomAssignmentSelection("all", assignmentIds)
          }
          onClearAssignmentSelection={(assignmentIds) =>
            updateVisibleRealClassroomAssignmentSelection("clear", assignmentIds)
          }
          onSelectDueAssignments={(assignmentIds) =>
            updateVisibleRealClassroomAssignmentSelection("due", assignmentIds)
          }
          onIncludeAll={() =>
            updateAllRealClassroomCourseSelections("included")
          }
          onIgnoreAll={() =>
            updateAllRealClassroomCourseSelections("ignored")
          }
          onResetChoices={resetRealClassroomCourseSelections}
          onArchiveNoDueDateClassroomTasks={() =>
            setPendingAction("archive-real-no-due")
          }
          onRestoreArchivedClassroomTasks={restoreArchivedRealClassroomTasks}
          onClose={() => setShowRealClassroomReview(false)}
        />
      )}

      {showGoogleCalendarManager && (
        <GoogleCalendarManagerModal
          calendarState={googleCalendarCalendars}
          preferences={googleCalendarPreferences}
          onLoadCalendars={loadGoogleCalendars}
          onTogglePreference={updateGoogleCalendarPreference}
          onShowAll={() => updateAllGoogleCalendarVisibility(true)}
          onHideAll={() => updateAllGoogleCalendarVisibility(false)}
          onClose={() => setShowGoogleCalendarManager(false)}
        />
      )}

      {pendingAction && (
        <ClassroomConnectionConfirmation
          action={pendingAction}
          cleanupCount={realClassroomCleanup.candidateCount}
          onCancel={() => setPendingAction(null)}
          onConfirm={confirmAction}
        />
      )}

      {successToast && (
        <ClassroomSuccessToast
          title={successToast.title}
          summary={successToast.summary}
          onClose={() => setSuccessToast(null)}
        />
      )}
    </div>
  );
}

function RealClassroomReturnStatus({ status }) {
  const connected = status.result === "connected";
  const courseCheckFailed = status.status === "courses_fetch_failed";
  const message = connected
    ? courseCheckFailed
      ? "Connected. Open Manage Classroom to load classes."
      : "Connected. Open Manage Classroom to choose classes."
    : "Google Classroom did not finish connecting. Try again.";

  return (
    <div
      className={`real-classroom-return-status ${
        connected ? "connected" : "error"
      }`}
      aria-live="polite"
    >
      <strong>
        {connected
          ? "Google Classroom connected"
          : "Google Classroom connection needs attention"}
      </strong>
      <p>{message}</p>
    </div>
  );
}

function GoogleCalendarReturnStatus({ status }) {
  const connected = status.result === "connected";

  return (
    <div
      className={`real-classroom-return-status ${
        connected ? "connected" : "error"
      }`}
      aria-live="polite"
    >
      <strong>
        {connected
          ? "Google Calendar connected"
          : "Google Calendar connection needs attention"}
      </strong>
      <p>
        {connected
          ? "Load calendars to review available calendar lists."
          : "Google Calendar did not finish connecting. Try again."}
      </p>
    </div>
  );
}

function ClassroomSuccessToast({ title, summary, onClose }) {
  return (
    <div className="classroom-success-toast" role="status" aria-live="polite">
      <button type="button" aria-label="Dismiss success message" onClick={onClose}>
        x
      </button>
      <div className="classroom-success-check" aria-hidden="true">
        <span>✓</span>
      </div>
      <strong>{title}</strong>
      <p>{summary}</p>
    </div>
  );
}

function IntegrationCard({
  integration,
  classroomConnection,
  importedCount,
  syncMessage,
  realClassroomSetup,
  realClassroomSession,
  realClassroomCourses,
  realClassroomCourseSelections,
  realClassroomCleanup,
  realClassroomImportedCount,
  realClassroomLinkedSubjectCount,
  googleCalendarSession,
  googleCalendarCalendars,
  googleCalendarPreferences,
  onLink,
  onSync,
  onUnlink,
  onRemove,
  onPreview,
  onCheckRealClassroomSetup,
  onLoadRealClassroomCourses,
  onLoadGoogleCalendars,
  onManageGoogleCalendars,
}) {
  const isClassroom = integration.id === "google-classroom";
  const isRealClassroom = integration.id === "real-google-classroom";
  const isGoogleCalendar = integration.id === "google-calendar";
  const isLinkedSample = isClassroom && classroomConnection.linked;
  const status = isClassroom
    ? isLinkedSample
      ? "linked-sample"
      : "not-linked"
    : isGoogleCalendar
      ? googleCalendarSession.connected
        ? "linked"
        : "not-linked"
      : integration.status;
  const { includedCount } = getRealClassroomCourseCounts(
    realClassroomCourses.courses,
    realClassroomCourseSelections
  );

  return (
    <article className="integration-card">
      <div className="integration-card-heading">
        <span className="integration-provider-mark" aria-hidden="true">
          {integration.id === "ai-planner" ? "AI" : "G"}
        </span>
        <div>
          <h3>{integration.name}</h3>
          <p>{integration.provider}</p>
        </div>
        <span
          className={`integration-status integration-status-${status}`}
        >
          {integrationStatusLabels[status]}
        </span>
      </div>

      <p className="integration-description">
        {isRealClassroom && realClassroomSession.connected
          ? "Classroom is connected. Manage classes, preview assignments, and import selected work."
          : isGoogleCalendar && googleCalendarSession.connected
            ? "Google Calendar is connected. Load calendars to review what Student Hub can use later."
          : integration.description}
      </p>
      {isClassroom && (
        <p className="integration-helper">
          {isLinkedSample
            ? "Connected to Sample Classroom. Local demo connection; no Google account connected."
            : "Sample Classroom uses local data only. Real Google Classroom comes later."}
        </p>
      )}
      {isRealClassroom && (
        <div className="integration-helper integration-real-classroom-note">
          <p>Manage classes, preview work, and import only what you select.</p>
        </div>
      )}
      {isGoogleCalendar && (
        <div className="integration-helper integration-real-classroom-note">
          <p>Phase 1 lists calendars only. Events are not loaded yet.</p>
        </div>
      )}
      {isRealClassroom && (
        <RealClassroomCompactStatus
          session={realClassroomSession}
          courseState={realClassroomCourses}
          includedCount={includedCount}
          linkedCount={realClassroomLinkedSubjectCount}
          importedCount={realClassroomImportedCount}
          archivedCount={realClassroomCleanup.archivedCount}
        />
      )}
      {isGoogleCalendar && (
        <GoogleCalendarCompactStatus
          session={googleCalendarSession}
          calendarState={googleCalendarCalendars}
          preferences={googleCalendarPreferences}
        />
      )}
      {isLinkedSample && (
        <dl className="integration-sync-meta" aria-label="Sample sync status">
          <div>
            <dt>Last synced</dt>
            <dd>{formatConnectionTime(classroomConnection.lastSyncedAt)}</dd>
          </div>
          <div>
            <dt>Assignments</dt>
            <dd>{importedCount}</dd>
          </div>
          <div>
            <dt>Linked courses</dt>
            <dd>{classroomConnection.linkedCourseCount || 0}</dd>
          </div>
        </dl>
      )}
      {isClassroom && syncMessage && (
        <p className="integration-card-message" aria-live="polite">
          {syncMessage}
        </p>
      )}

      <div className="integration-card-actions">
        {isClassroom && !isLinkedSample && (
          <button
            type="button"
            className="integration-link-button link-action"
            onClick={onLink}
          >
            Link sample
          </button>
        )}
        {isLinkedSample && (
          <>
            <button
              type="button"
              className="integration-sync-button"
              onClick={onSync}
            >
              Sync now
            </button>
            <button
              type="button"
              className="integration-link-button unlink-action"
              onClick={onUnlink}
            >
              Unlink sample
            </button>
          </>
        )}
        {integration.previewAvailable && (
          <button
            type="button"
            className="integration-preview-button"
            onClick={onPreview}
          >
            Preview sample data
          </button>
        )}
        {isClassroom && importedCount > 0 && (
          <button
            type="button"
            className="integration-link-button unlink-action"
            onClick={onRemove}
          >
            Remove sample imported tasks
          </button>
        )}
        {!isClassroom && (
          isRealClassroom ? (
            <>
              <button
                type="button"
                className="integration-preview-button"
                onClick={onLoadRealClassroomCourses}
                disabled={realClassroomCourses.loading}
              >
                {realClassroomCourses.loading
                  ? "Loading classes..."
                  : realClassroomCourses.courses.length > 0
                    ? "Manage Classroom"
                    : "Manage Classroom"}
              </button>
              <a
                className="integration-oauth-prototype-link secondary"
                href="/api/google-classroom/connect"
              >
                {realClassroomSession.connected
                  ? "Reconnect"
                  : "Connect Google Classroom"}
              </a>
              <button
                type="button"
                className="integration-setup-button secondary"
                onClick={onCheckRealClassroomSetup}
                disabled={realClassroomSetup.checking}
              >
                {realClassroomSetup.checking ? "Checking..." : "Check setup"}
              </button>
            </>
          ) : isGoogleCalendar ? (
            <>
              {googleCalendarSession.connected && (
                <button
                  type="button"
                  className="integration-preview-button"
                  onClick={
                    googleCalendarCalendars.calendars.length > 0
                      ? onManageGoogleCalendars
                      : onLoadGoogleCalendars
                  }
                  disabled={googleCalendarCalendars.loading}
                >
                  {googleCalendarCalendars.loading
                    ? "Loading calendars..."
                    : googleCalendarCalendars.calendars.length > 0
                      ? "Manage calendars"
                      : "Load calendars"}
                </button>
              )}
              <a
                className={`integration-oauth-prototype-link ${
                  googleCalendarSession.connected ? "secondary" : ""
                }`}
                href="/api/google-calendar/connect"
              >
                {googleCalendarSession.connected
                  ? "Reconnect Calendar"
                  : "Connect Google Calendar"}
              </a>
            </>
          ) : (
            <button type="button" className="integration-link-button" disabled>
              {integrationStatusLabels[status]}
            </button>
          )
        )}
      </div>
    </article>
  );
}

function getRealClassroomCourseCounts(courses, selections) {
  const includedCount = courses.filter(
    (course) =>
      selections[course.classroomCourseId || course.externalId] === "included"
  ).length;
  const ignoredCount = courses.filter(
    (course) =>
      selections[course.classroomCourseId || course.externalId] === "ignored"
  ).length;
  const needsReviewCount = Math.max(
    0,
    courses.length - includedCount - ignoredCount
  );

  return {
    includedCount,
    ignoredCount,
    needsReviewCount,
  };
}

function getRealClassroomImportResultCopy(result, checkedCount) {
  const importedCount = Number(result?.importedCount) || 0;
  const updatedCount = Number(result?.updatedCount) || 0;
  const skippedCount = Number(result?.skippedCount) || 0;
  const totalChecked =
    checkedCount || importedCount + updatedCount + skippedCount;
  const checkedLabel = `${totalChecked} assignment${
    totalChecked === 1 ? "" : "s"
  } checked`;

  if (importedCount > 0) {
    return {
      title: "Assignments imported",
      toastSummary: `${importedCount} imported · ${updatedCount} updated · 0 duplicates`,
      inlineSummary: `${totalChecked} checked · ${importedCount} imported · ${updatedCount} updated · no duplicates`,
    };
  }

  if (updatedCount > 0) {
    return {
      title: "Assignments synced",
      toastSummary: `${updatedCount} updated · 0 duplicates`,
      inlineSummary: `${totalChecked} checked · ${updatedCount} updated · no duplicates`,
    };
  }

  return {
    title: "Already up to date",
    toastSummary: `${checkedLabel} · 0 new imports · 0 duplicates`,
    inlineSummary: `${totalChecked} checked · already up to date · no duplicates`,
  };
}

function RealClassroomCourseSummary({ courseState, selections }) {
  const courses = courseState.courses;
  const { includedCount, ignoredCount, needsReviewCount } =
    getRealClassroomCourseCounts(courses, selections);

  if (!courseState.lastCheckedAt && !courseState.error && !courseState.loading) {
    return null;
  }

  return (
    <div className="real-classroom-course-summary-card" aria-live="polite">
      <strong>
        {courseState.loading
          ? "Loading courses"
          : courseState.error
            ? "Courses not loaded"
            : `${courses.length} courses loaded`}
      </strong>
      <p>
        {courseState.loading
          ? "Reading active Classroom courses..."
          : courseState.error ||
            `${includedCount} included · ${ignoredCount} ignored · ${needsReviewCount} need review`}
      </p>
      {courseState.lastCheckedAt && (
        <small>Last loaded {formatConnectionTime(courseState.lastCheckedAt)}</small>
      )}
      <span>Assignments are not imported yet.</span>
    </div>
  );
}

function RealClassroomCompactStatus({
  session,
  courseState,
  includedCount,
  linkedCount,
  importedCount,
  archivedCount,
}) {
  const connected = session.connected === true;
  const classesLoaded = courseState.courses.length;

  return (
    <div className="real-classroom-compact-status" aria-live="polite">
      <div>
        <strong>{connected ? "Connected" : "Not connected"}</strong>
        <span>{connected ? "Ready to manage" : "Connect to start"}</span>
      </div>
      <dl>
        <div>
          <dt>Classes</dt>
          <dd>{classesLoaded}</dd>
        </div>
        <div>
          <dt>Included</dt>
          <dd>{includedCount}</dd>
        </div>
        <div>
          <dt>Subject links</dt>
          <dd>{linkedCount}</dd>
        </div>
        <div>
          <dt>Imported</dt>
          <dd>{importedCount}</dd>
        </div>
        <div>
          <dt>Archived</dt>
          <dd>{archivedCount}</dd>
        </div>
      </dl>
      {courseState.lastCheckedAt && (
        <small>Last sync {formatConnectionTime(courseState.lastCheckedAt)}</small>
      )}
    </div>
  );
}

function GoogleCalendarCompactStatus({ session, calendarState, preferences }) {
  const connected = session.connected === true;
  const calendarCount = calendarState.calendars.length;
  const shownCount = calendarState.calendars.filter((calendar) => {
    const preference =
      preferences[getGoogleCalendarId(calendar)] ||
      getDefaultGoogleCalendarPreference(calendar);

    return preference.showInStudentHub;
  }).length;
  const busyCount = calendarState.calendars.filter((calendar) => {
    const preference =
      preferences[getGoogleCalendarId(calendar)] ||
      getDefaultGoogleCalendarPreference(calendar);

    return preference.useAsBusyTime;
  }).length;

  return (
    <div className="real-classroom-compact-status" aria-live="polite">
      <div>
        <strong>{connected ? "Connected" : "Not connected"}</strong>
        <span>
          {connected
            ? calendarCount > 0
              ? `${calendarCount} calendars available`
              : "Load calendars to manage"
            : "Connect to list calendars"}
        </span>
      </div>
      <dl>
        <div>
          <dt>Calendars</dt>
          <dd>{calendarCount}</dd>
        </div>
        <div>
          <dt>Shown</dt>
          <dd>{shownCount}</dd>
        </div>
        <div>
          <dt>Busy time</dt>
          <dd>{busyCount}</dd>
        </div>
      </dl>
      {calendarState.lastCheckedAt && (
        <small>Last loaded {formatConnectionTime(calendarState.lastCheckedAt)}</small>
      )}
      {calendarState.error && <small>{calendarState.error}</small>}
      {!calendarState.error && calendarState.message && (
        <small>{calendarState.message}</small>
      )}
    </div>
  );
}

function GoogleCalendarManagerModal({
  calendarState,
  preferences,
  onLoadCalendars,
  onTogglePreference,
  onShowAll,
  onHideAll,
  onClose,
}) {
  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false);
  const calendars = calendarState.calendars;
  const shownCount = calendars.filter((calendar) => {
    const preference =
      preferences[getGoogleCalendarId(calendar)] ||
      getDefaultGoogleCalendarPreference(calendar);

    return preference.showInStudentHub;
  }).length;
  const busyCount = calendars.filter((calendar) => {
    const preference =
      preferences[getGoogleCalendarId(calendar)] ||
      getDefaultGoogleCalendarPreference(calendar);

    return preference.useAsBusyTime;
  }).length;
  const duplicateRiskCount = calendars.filter((calendar) => {
    const preference =
      preferences[getGoogleCalendarId(calendar)] ||
      getDefaultGoogleCalendarPreference(calendar);

    return Boolean(preference.duplicateRisk);
  }).length;

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape" && !showSavedConfirmation) onClose();
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, showSavedConfirmation]);

  function saveChoices() {
    setShowSavedConfirmation(true);

    window.setTimeout(() => {
      onClose();
    }, 1250);
  }

  return (
    <div
      className="data-confirmation-backdrop real-classroom-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !showSavedConfirmation) {
          onClose();
        }
      }}
    >
      <section
        className="data-confirmation google-calendar-manager-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="google-calendar-manager-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="google-calendar-manager-header">
          <div>
            <p className="settings-group-label">Google Calendar</p>
            <h3 id="google-calendar-manager-title">Manage calendars</h3>
            <p>
              Choose what Student Hub should show and what should block study
              time. Nothing is changed in Google.
            </p>
            <p>
              The planner will avoid events from calendars marked Block study
              time.
            </p>
          </div>
          <div className="google-calendar-manager-close-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Close
            </button>
            <button type="button" onClick={saveChoices}>
              Save choices
            </button>
          </div>
        </header>

        <div className="google-calendar-manager-summary">
          <span>{calendars.length} calendars</span>
          <span>{shownCount} shown</span>
          <span>{busyCount} block study time</span>
          {duplicateRiskCount > 0 && (
            <span>{duplicateRiskCount} Classroom assignment calendars</span>
          )}
          {calendarState.lastCheckedAt && (
            <span>Loaded {formatConnectionTime(calendarState.lastCheckedAt)}</span>
          )}
        </div>

        <div className="google-calendar-manager-actions">
          <button type="button" onClick={onShowAll} disabled={calendars.length === 0}>
            Show all
          </button>
          <button type="button" onClick={onHideAll} disabled={calendars.length === 0}>
            Hide all
          </button>
          <button
            type="button"
            onClick={onLoadCalendars}
            disabled={calendarState.loading}
          >
            {calendarState.loading ? "Refreshing..." : "Refresh calendars"}
          </button>
        </div>

        <div className="google-calendar-manager-list">
          {calendarState.loading && calendars.length === 0 ? (
            <div className="classroom-preview-empty">
              <strong>Loading calendars...</strong>
              <p>Reading your calendar list securely.</p>
            </div>
          ) : calendarState.error ? (
            <div className="classroom-preview-empty">
              <strong>Could not load calendars</strong>
              <p>{calendarState.error}</p>
            </div>
          ) : calendars.length === 0 ? (
            <div className="classroom-preview-empty">
              <strong>No calendars loaded yet</strong>
              <p>Connect Google Calendar, then load your calendars.</p>
            </div>
          ) : (
            calendars.map((calendar) => {
              const calendarId = getGoogleCalendarId(calendar);
              const preference =
                preferences[calendarId] ||
                getDefaultGoogleCalendarPreference(calendar);

              return (
                <GoogleCalendarManagerRow
                  calendar={calendar}
                  preference={preference}
                  key={calendarId}
                  onTogglePreference={onTogglePreference}
                />
              );
            })
          )}
        </div>

        {showSavedConfirmation && (
          <div
            className="google-calendar-save-confirmation"
            role="status"
            aria-live="polite"
          >
            <div className="classroom-success-check" aria-hidden="true">
              <span>✓</span>
            </div>
            <strong>Calendar choices saved</strong>
            <p>Student Hub will remember these settings.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function GoogleCalendarManagerRow({ calendar, preference, onTogglePreference }) {
  const calendarName = calendar.summary || calendar.name || "Untitled calendar";

  return (
    <div className="google-calendar-manager-row">
      <span
        className="google-calendar-colour"
        style={{
          "--google-calendar-colour": calendar.backgroundColor || "var(--accent)",
        }}
        aria-hidden="true"
      />
      <div className="google-calendar-manager-copy">
        <strong>{calendarName}</strong>
        <span>
          {calendar.primary && <em>Primary</em>}
          {preference.duplicateRisk && (
            <em className="google-calendar-classroom-risk">
              Classroom assignments
            </em>
          )}
          {calendar.accessRole && <small>{calendar.accessRole}</small>}
        </span>
        {preference.duplicateRisk && (
          <p>
            Assignments from this class are already handled through Google
            Classroom.
          </p>
        )}
      </div>
      <label className="google-calendar-switch">
        <input
          type="checkbox"
          checked={preference.showInStudentHub}
          onChange={(event) =>
            onTogglePreference(calendar, {
              showInStudentHub: event.target.checked,
            })
          }
        />
        <span>Show in Student Hub</span>
      </label>
      <label className="google-calendar-switch">
        <input
          type="checkbox"
          checked={preference.useAsBusyTime}
          onChange={(event) =>
            onTogglePreference(calendar, {
              useAsBusyTime: event.target.checked,
            })
          }
        />
        <span>Block study time</span>
      </label>
    </div>
  );
}

function RealClassroomCourseReviewModal({
  courseState,
  selections,
  subjects,
  subjectLinks,
  onSelectCourse,
  onSelectSubject,
  onCreateSubject,
  cleanup,
  assignmentPreview,
  importedClassroomTasks,
  onPreviewAssignments,
  onImportAssignments,
  onSelectAssignment,
  onSelectAllAssignments,
  onClearAssignmentSelection,
  onSelectDueAssignments,
  onIncludeAll,
  onIgnoreAll,
  onResetChoices,
  onArchiveNoDueDateClassroomTasks,
  onRestoreArchivedClassroomTasks,
  onClose,
}) {
  const courses = courseState.courses;
  const [activeReviewTab, setActiveReviewTab] = useState("classes");
  const { includedCount, ignoredCount, needsReviewCount } =
    getRealClassroomCourseCounts(courses, selections);
  const unlinkedIncludedCount = courses.filter((course) => {
    const courseId = getRealClassroomCourseId(course);

    return selections[courseId] === "included" && !subjectLinks[courseId];
  }).length;

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function previewAssignments() {
    setActiveReviewTab("assignments");
    onPreviewAssignments();
  }

  return (
    <div
      className="data-confirmation-backdrop real-classroom-modal-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="real-classroom-course-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="real-classroom-review-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="real-classroom-modal-header">
          <div>
            <p className="settings-group-label">Real Google Classroom</p>
            <h3 id="real-classroom-review-title">
              Manage Classroom
            </h3>
            <p>Choose classes, link Subjects, and import selected work.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close class review">
            Close
          </button>
        </header>

        <div className="real-classroom-course-summary">
          <span>{courses.length} classes found</span>
          <span>{includedCount} included</span>
          <span>{ignoredCount} ignored</span>
          <span>
            {needsReviewCount}{" "}
            {needsReviewCount === 1 ? "needs class choice" : "need class choices"}
          </span>
          <span>
            {unlinkedIncludedCount}{" "}
            {unlinkedIncludedCount === 1
              ? "needs Subject"
              : "need Subjects"}
          </span>
        </div>

        <div
          className="real-classroom-review-tabs"
          role="tablist"
          aria-label="Google Classroom review sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeReviewTab === "classes"}
            className={activeReviewTab === "classes" ? "active" : ""}
            onClick={() => setActiveReviewTab("classes")}
          >
            Classes & subjects
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeReviewTab === "assignments"}
            className={activeReviewTab === "assignments" ? "active" : ""}
            onClick={() => setActiveReviewTab("assignments")}
          >
            Assignment preview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeReviewTab === "cleanup"}
            className={activeReviewTab === "cleanup" ? "active" : ""}
            onClick={() => setActiveReviewTab("cleanup")}
          >
            Cleanup
          </button>
        </div>

        {activeReviewTab === "classes" ? (
          <section className="real-classroom-tab-panel real-classroom-tab-panel--classes">
            <div className="real-classroom-tab-heading">
              <div>
                <strong>Classes & subjects</strong>
                <p>
                  Pick classes and match them to Subjects.
                </p>
              </div>
              <button
                type="button"
                onClick={previewAssignments}
                disabled={assignmentPreview.loading}
              >
                {assignmentPreview.loading
                  ? "Loading..."
                  : "Preview assignments"}
              </button>
            </div>

            {unlinkedIncludedCount > 0 && (
              <p className="real-classroom-preview-warning">
                {unlinkedIncludedCount} included class
                {unlinkedIncludedCount === 1 ? "" : "es"} need a Subject before
                import.
              </p>
            )}

            <div className="real-classroom-course-actions">
              <button type="button" onClick={onIncludeAll}>
                Include all
              </button>
              <button type="button" onClick={onIgnoreAll}>
                Ignore all
              </button>
              <button type="button" onClick={onResetChoices}>
                Reset choices
              </button>
            </div>

            <div className="real-classroom-course-list">
              {courses.map((course) => {
                const courseId = getRealClassroomCourseId(course);
                const selection = selections[courseId] || "needs-review";
                const linkedSubject = subjects.find(
                  (subject) => subject.id === subjectLinks[courseId]?.subjectId
                );
                const suggestedSubject =
                  linkedSubject ||
                  findBestSubjectForClassroomCourse(subjects, course);
                const subjectName = getSuggestedClassroomSubjectName(course);

                return (
                  <article className="real-classroom-course-row" key={courseId}>
                    <div className="real-classroom-course-main">
                      <h4>{course.name}</h4>
                      <p>
                        {[course.section, course.description || course.courseState]
                          .filter(Boolean)
                          .join(" · ") || "No section"}
                      </p>
                    </div>
                    <span className={`real-classroom-course-chip ${selection}`}>
                      {selection === "included"
                        ? "Included"
                        : selection === "ignored"
                          ? "Ignored"
                          : "Needs review"}
                    </span>
                    <div className="real-classroom-course-choice">
                      {selection === "included" ? (
                        <button
                          type="button"
                          onClick={() => onSelectCourse(courseId, "ignored")}
                        >
                          Ignore
                        </button>
                      ) : selection === "ignored" ? (
                        <button
                          type="button"
                          onClick={() => onSelectCourse(courseId, "included")}
                        >
                          Include
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onSelectCourse(courseId, "included")}
                          >
                            Include
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectCourse(courseId, "ignored")}
                          >
                            Ignore
                          </button>
                        </>
                      )}
                    </div>
                    {selection === "included" && (
                      <div className="real-classroom-subject-link">
                        <div>
                          <strong>
                            {linkedSubject
                              ? `Linked to ${linkedSubject.name}`
                              : suggestedSubject
                                ? `Suggested: ${suggestedSubject.name}`
                                : "Needs subject link"}
                          </strong>
                          <p>
                            Assignments from this class will use this Subject.
                          </p>
                        </div>
                        <label>
                          <span>Student Hub subject</span>
                          <select
                            value={linkedSubject?.id || ""}
                            onChange={(event) =>
                              onSelectSubject(course, event.target.value)
                            }
                          >
                            <option value="">Choose a subject</option>
                            {subjects.map((subject) => (
                              <option key={subject.id} value={subject.id}>
                                {subject.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        {!linkedSubject && (
                          <button
                            type="button"
                            onClick={() => onCreateSubject(course)}
                          >
                            {suggestedSubject
                              ? `Link to ${suggestedSubject.name}`
                              : `Create "${subjectName}" Subject`}
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ) : activeReviewTab === "assignments" ? (
          <section className="real-classroom-tab-panel real-classroom-tab-panel--assignments">
            <div className="real-classroom-tab-heading">
              <div>
                <strong>Assignments</strong>
                <p>Only selected assignments become tasks.</p>
              </div>
              <button
                type="button"
                onClick={previewAssignments}
                disabled={assignmentPreview.loading}
              >
                {assignmentPreview.loading
                  ? "Loading..."
                  : "Refresh assignments"}
              </button>
            </div>

            <RealClassroomAssignmentPreview
              preview={assignmentPreview}
              unlinkedCount={unlinkedIncludedCount}
              includedCourseIds={new Set(
                Object.entries(selections)
                  .filter(([, selection]) => selection === "included")
                  .map(([courseId]) => courseId)
              )}
              linkedCourseIds={new Set(Object.keys(subjectLinks))}
              importedClassroomTasks={importedClassroomTasks}
              onImportAssignments={onImportAssignments}
              onSelectAssignment={onSelectAssignment}
              onSelectAllAssignments={onSelectAllAssignments}
              onClearAssignmentSelection={onClearAssignmentSelection}
              onSelectDueAssignments={onSelectDueAssignments}
            />
          </section>
        ) : (
          <section className="real-classroom-tab-panel real-classroom-tab-panel--cleanup">
            <div className="real-classroom-tab-heading">
              <div>
                <strong>Cleanup</strong>
                <p>No-due-date Classroom items can be noisy.</p>
              </div>
            </div>
            <div className="real-classroom-cleanup-card">
              <dl>
                <div>
                  <dt>Can archive</dt>
                  <dd>{cleanup.candidateCount}</dd>
                </div>
                <div>
                  <dt>Due dates stay</dt>
                  <dd>{cleanup.dueDateActiveCount}</dd>
                </div>
                <div>
                  <dt>Manual kept</dt>
                  <dd>{cleanup.manualSafeCount}</dd>
                </div>
                <div>
                  <dt>Archived</dt>
                  <dd>{cleanup.archivedCount}</dd>
                </div>
              </dl>
              {cleanup.message && (
                <p className="integration-card-message" aria-live="polite">
                  {cleanup.message}
                </p>
              )}
              <div className="real-classroom-cleanup-actions">
                <button
                  type="button"
                  onClick={onArchiveNoDueDateClassroomTasks}
                  disabled={cleanup.candidateCount === 0}
                >
                  Archive no-due-date items
                </button>
                {cleanup.archivedCount > 0 && (
                  <button
                    type="button"
                    onClick={onRestoreArchivedClassroomTasks}
                  >
                    Restore archived items
                  </button>
                )}
              </div>
              <small>
                {cleanup.candidateCount === 0
                  ? "No no-due-date Classroom tasks to archive."
                  : "Due-date tasks are never auto-archived."}
              </small>
            </div>
          </section>
        )}

        <footer className="real-classroom-modal-footer">
          <p>Choices and Subject links are saved on this device.</p>
          <button type="button" onClick={onClose}>
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}

function formatRealClassroomAssignmentDueDate(assignment) {
  if (!hasRealDueDate(assignment.dueDate)) return "No due date";

  const date = new Date(`${assignment.dueDate.trim()}T00:00:00`);
  const formattedDate = Number.isNaN(date.getTime())
    ? assignment.dueDate
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);

  return assignment.dueTime
    ? `${formattedDate} · ${assignment.dueTime}`
    : formattedDate;
}

function RealClassroomAssignmentPreview({
  preview,
  unlinkedCount,
  includedCourseIds,
  linkedCourseIds,
  importedClassroomTasks,
  onImportAssignments,
  onSelectAssignment,
  onSelectAllAssignments,
  onClearAssignmentSelection,
  onSelectDueAssignments,
}) {
  const [assignmentFilter, setAssignmentFilter] = useState("active");
  const filteredAssignments = preview.assignments.filter((assignment) => {
    const category = assignment.classroomStatusCategory || "unknown";

    if (assignmentFilter === "all") return true;
    if (assignmentFilter === "active") {
      return category === "active" || category === "missing";
    }
    if (assignmentFilter === "missing") return category === "missing";
    if (assignmentFilter === "no_due_date") return category === "no_due_date";
    if (assignmentFilter === "done") {
      return CLASSROOM_DONE_CATEGORIES.has(category);
    }

    return true;
  });
  const visibleAssignmentIds = filteredAssignments
    .map((assignment) => assignment.externalId)
    .filter(Boolean);
  const groupedAssignments = filteredAssignments.reduce((groups, assignment) => {
    const groupKey = assignment.classroomCourseId || "unknown-course";

    if (!groups[groupKey]) {
      groups[groupKey] = {
        courseName: assignment.classroomCourseName || "Untitled class",
        linkedSubjectName: assignment.linkedSubjectName || "",
        assignments: [],
      };
    }

    groups[groupKey].assignments.push(assignment);
    return groups;
  }, {});
  const groups = Object.values(groupedAssignments);
  const hasAssignments = preview.assignments.length > 0;
  const includedPreviewAssignments = preview.assignments.filter((assignment) =>
    includedCourseIds.has(assignment.classroomCourseId)
  );
  const selectedAssignments = includedPreviewAssignments.filter(
    (assignment) => preview.selectedAssignmentIds?.[assignment.externalId]
  );
  const selectedCount = selectedAssignments.length;
  const importedCount = selectedAssignments.filter((assignment) =>
    importedClassroomTasks.has(assignment.externalId)
  ).length;
  const updatedCount = selectedAssignments.filter((assignment) =>
    hasClassroomAssignmentChanges(
      assignment,
      importedClassroomTasks.get(assignment.externalId)
    )
  ).length;
  const importableCount = Math.max(0, selectedCount - importedCount);
  const unlinkedPreviewCourseCount = new Set(
    selectedAssignments
      .filter((assignment) => !linkedCourseIds.has(assignment.classroomCourseId))
      .map((assignment) => assignment.classroomCourseId)
  ).size;
  const importButtonLabel =
    selectedCount > 0
      ? `Import ${selectedCount} selected assignment${
          selectedCount === 1 ? "" : "s"
        }`
      : "Import selected";

  return (
    <section className="real-classroom-assignment-preview" aria-live="polite">
      <div className="real-classroom-assignment-preview-header">
        <div>
          <strong>Preview</strong>
          <p>Only selected assignments become tasks.</p>
        </div>
        {preview.summary && (
          <span>
            {preview.summary.assignmentCount} assignment
            {preview.summary.assignmentCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {hasAssignments && (
        <div className="real-classroom-import-panel">
          <div>
            <strong>Import selected</strong>
            <p>Manual tasks are never changed.</p>
            <small>
              {selectedCount} selected · {importableCount} new · {updatedCount} updated · {importedCount} already imported
            </small>
          </div>
          <button
            type="button"
            onClick={onImportAssignments}
            disabled={
              selectedCount === 0 ||
              unlinkedPreviewCourseCount > 0 ||
              preview.loading
            }
          >
            {importButtonLabel}
          </button>
        </div>
      )}

      {preview.importResult && (
        <div className="real-classroom-inline-success" aria-live="polite">
          <div className="classroom-success-check small" aria-hidden="true">
            <span>✓</span>
          </div>
          <div>
            <strong>
              {preview.importResultCopy?.title || "Assignments synced"}
            </strong>
            <p>
              {preview.importResultCopy?.toastSummary ||
                `${preview.importResult.importedCount} imported · ${preview.importResult.updatedCount} updated · 0 duplicates`}
            </p>
          </div>
        </div>
      )}

      {hasAssignments && (
        <div className="real-classroom-selection-panel">
          <div
            className="real-classroom-assignment-filters"
            role="group"
            aria-label="Assignment status filters"
          >
            {[
              ["active", "Active"],
              ["missing", "Missing"],
              ["no_due_date", "No due date"],
              ["done", "Done / turned in"],
              ["all", "All"],
            ].map(([value, label]) => (
              <button
                type="button"
                className={assignmentFilter === value ? "active" : ""}
                aria-pressed={assignmentFilter === value}
                key={value}
                onClick={() => setAssignmentFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="real-classroom-selection-actions">
            <button
              type="button"
              onClick={() => onSelectAllAssignments(visibleAssignmentIds)}
            >
              Select all visible
            </button>
            <button
              type="button"
              onClick={() => onClearAssignmentSelection(visibleAssignmentIds)}
            >
              Clear selection
            </button>
            <button
              type="button"
              onClick={() => onSelectDueAssignments(visibleAssignmentIds)}
            >
              Select due-date assignments
            </button>
          </div>
          <p>
            Turned-in and no-due-date items are not selected by default.
          </p>
        </div>
      )}

      {hasAssignments && selectedCount === 0 && !preview.error && (
        <p className="real-classroom-preview-warning">
          Select at least one assignment to import or sync.
        </p>
      )}

      {unlinkedPreviewCourseCount > 0 && (
        <p className="real-classroom-preview-warning">
          {unlinkedPreviewCourseCount} included class
          {unlinkedPreviewCourseCount === 1 ? "" : "es"} with assignments not
          linked to subjects yet. Import will need subject links.
        </p>
      )}

      {preview.loading && <p>Reading assignments from included classes...</p>}
      {preview.error && (
        <p className="real-classroom-preview-error">{preview.error}</p>
      )}
      {preview.message && !preview.error && !preview.loading && (
        <p>{preview.message}</p>
      )}
      {!preview.loading &&
        !preview.error &&
        !preview.message &&
        preview.assignments.length === 0 && (
          <p>Load assignments to start reviewing.</p>
        )}
      {!preview.loading &&
        !preview.error &&
        preview.assignments.length > 0 &&
        groups.length === 0 && (
          <p>No assignments match this filter.</p>
        )}

      {groups.length > 0 && (
        <div className="real-classroom-assignment-group-list">
          {groups.map((group) => (
            <article
              className="real-classroom-assignment-group"
              key={`${group.courseName}-${group.linkedSubjectName}`}
            >
              <header>
                <div>
                  <h4>{group.courseName}</h4>
                  <p>
                    {group.linkedSubjectName
                      ? `Subject: ${group.linkedSubjectName}`
                      : "No linked subject yet"}
                  </p>
                </div>
                <span>{group.assignments.length}</span>
              </header>

              <div className="real-classroom-assignment-list">
                {group.assignments.map((assignment) => {
                  const isSelected =
                    preview.selectedAssignmentIds?.[assignment.externalId] ===
                    true;
                  const existingTask = importedClassroomTasks.get(
                    assignment.externalId
                  );
                  const syncStatus = getClassroomAssignmentSyncStatus({
                    assignment,
                    existingTask,
                    linkedCourseIds,
                  });

                  return (
                    <div
                      className={`real-classroom-assignment-row ${
                        syncStatus.isImported ? "is-imported" : ""
                      } ${
                        !syncStatus.hasDueDate ? "has-no-due-date" : ""
                      }`}
                      key={assignment.externalId}
                    >
                      <label className="real-classroom-assignment-select">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(event) =>
                            onSelectAssignment(
                              assignment.externalId,
                              event.target.checked
                            )
                          }
                        />
                        <span>{isSelected ? "Selected" : "Not selected"}</span>
                      </label>
                      <div>
                        <strong>{assignment.title}</strong>
                        <p>
                          {formatRealClassroomAssignmentDueDate(assignment)}
                          {[assignment.workType, assignment.state]
                            .filter(Boolean)
                            .join(" · ")
                            ? ` · ${[assignment.workType, assignment.state]
                                .filter(Boolean)
                                .join(" · ")}`
                            : ""}
                        </p>
                        <div
                          className="real-classroom-assignment-status-list"
                          aria-label="Assignment sync status"
                        >
                          {syncStatus.badges.map((badge) => (
                            <span
                              className={`real-classroom-sync-chip ${badge.tone}`}
                              key={badge.label}
                            >
                              {badge.label}
                            </span>
                          ))}
                        </div>
                        {!syncStatus.hasDueDate && (
                          <em>Not selected by default · Review before importing</em>
                        )}
                      </div>
                      {assignment.alternateLink && (
                        <a
                          href={assignment.alternateLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function RealClassroomConnectionStatus({ session, setup }) {
  const setupConfigured =
    setup.result?.configured === true ||
    setup.result?.status === "configured_not_implemented";
  const setupChecked = setup.result || setup.error;
  const statusLabel = session.checking
    ? "Checking session"
    : session.connected
      ? "Connected for this browser"
      : session.status === "classroom_session_invalid_or_expired"
        ? "Session expired"
        : "Not connected";
  const detail = session.checking
    ? "Checking whether a secure Classroom session exists."
    : session.connected
      ? "Read-only courses are available. Assignments are not imported yet."
      : session.status === "classroom_session_invalid_or_expired"
        ? "Session expired. Connect Google Classroom again."
        : "No Google account connected.";

  return (
    <div
      className={`real-classroom-connection-status ${
        session.connected ? "is-connected" : ""
      }`}
    >
      <div>
        <strong>{statusLabel}</strong>
        <p>{detail}</p>
      </div>
      <span>
        {setupConfigured
          ? "Setup configured"
          : setupChecked
            ? "Setup not configured"
            : "Setup check optional"}
      </span>
    </div>
  );
}

function RealClassroomSetupStatus({ setup }) {
  const result = setup.result;

  if (setup.error) {
    return (
      <div className="integration-readiness-status is-error" aria-live="polite">
        <strong>Setup check</strong>
        <p>{setup.error}</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="integration-readiness-status">
        <strong>Setup check only</strong>
        <p>Real Google Classroom is not connected yet.</p>
      </div>
    );
  }

  const isConfigured = result.status === "configured_not_implemented";
  const missingEnv = Array.isArray(result.missingEnv)
    ? result.missingEnv
    : [];

  return (
    <div
      className={`integration-readiness-status ${
        isConfigured ? "is-configured" : "is-missing"
      }`}
      aria-live="polite"
    >
      <strong>
        {isConfigured ? "Configured but not implemented" : "Not configured"}
      </strong>
      <p>{result.message || "No Google account connected yet."}</p>
      {missingEnv.length > 0 && (
        <div className="integration-missing-env">
          <span>Missing setup variables</span>
          <ul>
            {missingEnv.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ClassroomConnectionConfirmation({
  action,
  cleanupCount = 0,
  onCancel,
  onConfirm,
}) {
  const isUnlink = action === "unlink";
  const isRemove = action === "remove";
  const isArchiveRealNoDue = action === "archive-real-no-due";

  return (
    <div className="data-confirmation-backdrop" role="presentation">
      <section
        className={`data-confirmation integration-confirmation ${
          isUnlink || isRemove ? "destructive" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="classroom-confirmation-title"
      >
        <div>
          <p className="settings-group-label">
            {isArchiveRealNoDue ? "Google Classroom" : "Sample Classroom"}
          </p>
          <h3 id="classroom-confirmation-title">
            {isArchiveRealNoDue
              ? "Archive no-due-date Classroom items?"
              : isRemove
                ? "Remove imported sample tasks?"
                : isUnlink
                  ? "Unlink sample Classroom?"
                  : "Link sample Classroom?"}
          </h3>
          <p>
            {isArchiveRealNoDue
              ? `This will archive ${cleanupCount} imported Classroom task${
                  cleanupCount === 1 ? "" : "s"
                } with no due date. Tasks with due dates and manual tasks will not be touched. Nothing will be deleted.`
              : isRemove
                ? "Only tasks imported from Sample Classroom will be removed. Manual tasks will be kept."
                : isUnlink
                  ? "This disconnects local sample mode. Imported sample tasks remain in Student Hub."
                  : "This uses local demo data only. No Google account will be connected."}
          </p>
        </div>
        <div className="data-confirmation-actions">
          <button type="button" className="data-cancel-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="data-confirm-button"
            onClick={onConfirm}
          >
            {isArchiveRealNoDue
              ? "Archive Classroom items"
              : isRemove
                ? "Remove sample imported tasks"
                : isUnlink
                  ? "Unlink"
                  : "Link sample"}
          </button>
        </div>
      </section>
    </div>
  );
}

function formatConnectionTime(value) {
  if (!value) return "Not synced yet";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not synced yet";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function MockClassroomPreview({
  tasks,
  subjects,
  setSubjects,
  onCourseMappingChange,
  onClose,
}) {
  const previewCourses = buildMockClassroomPreview(mockClassroomData);
  const [previewMessage, setPreviewMessage] = useState("");
  const [courseSubjectLinks, setCourseSubjectLinks] = useState(() => {
    const savedLinks = loadMockClassroomCourseLinks().filter((link) =>
      subjects.some((subject) => subject.id === link.subjectId)
    );
    const initialLinks = [...savedLinks];

    previewCourses.forEach((course) => {
      if (
        initialLinks.some(
          (link) => link.classroomCourseId === course.externalId
        )
      ) {
        return;
      }

      const exactSubject = subjects.find(
        (subject) =>
          normalizeSubjectName(subject.name) === normalizeSubjectName(course.name)
      );

      if (exactSubject) {
        initialLinks.push(createMockClassroomCourseLink(course, exactSubject));
      }
    });

    return initialLinks;
  });
  const previewAssignments = previewCourses.flatMap(
    (course) => course.assignments
  );
  const importedAssignmentIds = new Set(
    tasks
      .filter((task) => task.source === "classroom-mock")
      .map((task) => task.externalId)
      .filter(Boolean)
  );
  const assignmentCount = previewCourses.reduce(
    (total, course) => total + course.assignments.length,
    0
  );
  const importedCount = previewAssignments.filter((assignment) =>
    importedAssignmentIds.has(assignment.externalId)
  ).length;

  useEffect(() => {
    localStorage.setItem(
      MOCK_CLASSROOM_COURSE_LINKS_STORAGE_KEY,
      JSON.stringify(courseSubjectLinks)
    );
  }, [courseSubjectLinks]);

  function updateCourseSubjectLink(course, subjectId) {
    const subject = subjects.find((item) => item.id === subjectId);
    const otherLinks = courseSubjectLinks.filter(
      (link) => link.classroomCourseId !== course.externalId
    );
    const nextLinks = subject
      ? [...otherLinks, createMockClassroomCourseLink(course, subject)]
      : otherLinks;

    setCourseSubjectLinks(nextLinks);
    onCourseMappingChange?.(course, subject || null, nextLinks);
    setPreviewMessage(
      subject
        ? `${course.name} is linked to ${subject.name}. Existing sample tasks from this course were updated.`
        : `${course.name} is unassigned. Existing sample tasks from this course were updated.`
    );
  }

  function createAndLinkSubject(course) {
    const existingSubject = subjects.find(
      (subject) =>
        normalizeSubjectName(subject.name) === normalizeSubjectName(course.name)
    );
    const subject = existingSubject || createSubjectFromMockCourse(course);

    if (!existingSubject) {
      setSubjects((currentSubjects) => [...currentSubjects, subject]);
    }

    const nextLinks = [
      ...courseSubjectLinks.filter(
        (link) => link.classroomCourseId !== course.externalId
      ),
      createMockClassroomCourseLink(course, subject),
    ];

    setCourseSubjectLinks(nextLinks);
    onCourseMappingChange?.(course, subject, nextLinks);
    setPreviewMessage(`${course.name} is linked to ${subject.name}.`);
  }

  return (
    <div className="classroom-preview-settings" aria-label="Mock Classroom Preview">
      <section className="panel classroom-preview-panel">
        <div className="classroom-preview-intro">
          <div>
            <p className="settings-group-label">Sample data</p>
            <h3>Sample Classroom</h3>
            <p>Review sample classes and subject links.</p>
          </div>
          <div className="classroom-preview-intro-actions">
            <span>Local sample data only</span>
            <button type="button" onClick={onClose} aria-label="Close mock preview">
              Close
            </button>
          </div>
        </div>

        <div className="classroom-preview-summary" aria-label="Preview summary">
          <span><strong>{previewCourses.length}</strong> classes</span>
          <span><strong>{assignmentCount}</strong> assignments</span>
          <span><strong>{importedCount}</strong> already imported</span>
        </div>

        {previewCourses.length > 0 ? (
          <div className="classroom-course-list">
            {previewCourses.map((course) => {
              const linkedSubject = findLinkedSubjectForMockCourse(
                course,
                subjects,
                courseSubjectLinks
              );

              return (
            <section className="classroom-course" key={course.externalId}>
              <header className="classroom-course-heading">
                <div>
                  <h3>{course.name}</h3>
                  <p>
                    {course.section || "Class"} · {course.assignments.length}{" "}
                    assignments
                  </p>
                </div>
                <div className="classroom-course-actions">
                  <span className="classroom-mock-badge">Mock</span>
                </div>
              </header>

              <div
                className={`classroom-subject-link ${
                  linkedSubject ? "is-linked" : ""
                }`}
              >
                <div className="classroom-subject-link-status">
                  <div className="classroom-link-status-row">
                    <strong>Course mapping</strong>
                    <span
                      className={`classroom-link-state ${
                        linkedSubject ? "is-linked" : ""
                      }`}
                    >
                      {linkedSubject ? "Linked" : "Not linked"}
                    </span>
                  </div>
                  <span>
                    {linkedSubject
                      ? `Linked to ${linkedSubject.name}`
                      : "Choose a Student Hub subject or leave unassigned."}
                  </span>
                </div>
                <div className="classroom-subject-link-actions">
                  <label>
                    <span>Choose subject</span>
                    <select
                      value={linkedSubject?.id || ""}
                      onChange={(event) =>
                        updateCourseSubjectLink(course, event.target.value)
                      }
                    >
                      <option value="">Unassigned / No subject</option>
                      {subjects.map((subject) => (
                        <option value={subject.id} key={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!linkedSubject && (
                    <button
                      type="button"
                      onClick={() => createAndLinkSubject(course)}
                    >
                      Create subject
                    </button>
                  )}
                </div>
              </div>

              {course.assignments.length > 0 ? (
                <div className="classroom-assignment-list">
                  {course.assignments.map((assignment) => (
                  <article
                    className={`classroom-assignment classroom-assignment-readonly ${
                      importedAssignmentIds.has(assignment.externalId)
                        ? "is-imported"
                        : ""
                    }`}
                    key={assignment.externalId}
                  >
                    <div className="classroom-assignment-copy">
                      <strong>{assignment.title}</strong>
                      {assignment.description && <p>{assignment.description}</p>}
                    </div>
                    <div className="classroom-assignment-meta">
                      <time dateTime={assignment.dueAt}>
                        Due {formatMockClassroomDueDate(assignment.dueAt)}
                      </time>
                      <span className="classroom-source-badge">Mock</span>
                      <span
                        className={`classroom-import-status ${
                          importedAssignmentIds.has(assignment.externalId)
                            ? "is-imported"
                            : ""
                        }`}
                      >
                        {importedAssignmentIds.has(assignment.externalId)
                          ? "Already synced"
                          : "Ready to sync"}
                      </span>
                    </div>
                  </article>
                  ))}
                </div>
              ) : (
                <p className="classroom-course-empty">No sample assignments.</p>
              )}
            </section>
              );
            })}
          </div>
        ) : (
          <div className="classroom-preview-empty">
            <strong>No sample classes available</strong>
            <p>Local preview data will appear here when available.</p>
          </div>
        )}

        <div className="classroom-preview-footer">
          <div>
            <strong>Sample only</strong>
            <p>Use Sync now on the Classroom card to import sample tasks.</p>
            {previewMessage && (
              <p className="classroom-import-message" aria-live="polite">
                {previewMessage}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function HelpSettings() {
  return (
    <div className="help-settings">
      <section className="panel help-panel">
        <div className="help-local-summary">
          <div>
            <p className="settings-group-label">Local for now</p>
            <h3>Your workspace stays on this device</h3>
            <p>
              There are no accounts yet. Google Classroom and AI are not
              connected, and clearing browser site data may remove your work.
            </p>
          </div>
          <span>Browser saved</span>
        </div>

        <div className="help-faq-sections">
          {helpCategories.map((category) => {
            const categoryItems = helpContent.filter(
              (item) => item.category === category.id
            );

            return (
              <section className="help-faq-section" key={category.id}>
                <div className="help-faq-section-heading">
                  <h3>{category.label}</h3>
                  <p>{category.description}</p>
                </div>

                <div className="help-faq-list">
                  {categoryItems.map((item) => (
                    <details className="help-faq-item" key={item.id}>
                      <summary>
                        <span className="help-faq-title">{item.title}</span>
                        <span
                          className={`help-status help-status-${item.status}`}
                        >
                          {helpStatusLabels[item.status]}
                        </span>
                        <span className="help-faq-expand" aria-hidden="true">
                          +
                        </span>
                      </summary>
                      <div className="help-faq-answer">
                        <p>{item.summary}</p>
                        {item.details && <p>{item.details}</p>}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="help-video-empty">
          <div>
            <strong>Video guides</strong>
            <p>Short walkthroughs are not available yet.</p>
          </div>
          <span>Coming soon</span>
        </div>
      </section>
    </div>
  );
}

function DataSettings({
  resetTasks,
  resetSubjects,
  resetAppearancePreferences,
  restartOnboarding,
  clearAllStudentHubData,
  loadDemoWorkspace,
  removeDemoData,
  hasDemoTasks,
  hasDemoData,
}) {
  const [pendingReset, setPendingReset] = useState(null);
  const resetOptions = [
    {
      id: "load-demo",
      title: "Load demo workspace",
      description: hasDemoTasks
        ? "Demo tasks are already available in this workspace."
        : "The Demo workspace is not loaded. Add a few sample tasks.",
      confirmation:
        "Sample tasks will be added alongside your existing work. No current tasks or subjects will be changed.",
      confirmLabel: "Load demo",
      actionLabel: hasDemoTasks ? "Loaded" : "Load",
      action: loadDemoWorkspace,
      disabled: hasDemoTasks,
    },
    ...(hasDemoData
      ? [
          {
            id: "remove-demo",
            title: "Remove demo data",
            description: "Remove sample data while keeping your own work.",
            confirmation:
              "Only demo tasks, subjects, and completed history will be removed. Your manual work will stay untouched.",
            confirmLabel: "Remove demo data",
            actionLabel: "Remove",
            action: removeDemoData,
            destructive: true,
          },
        ]
      : []),
    {
      id: "tasks",
      title: "Reset tasks",
      description: "Remove tasks, completed history, and the current plan.",
      confirmation:
        "All active and completed tasks, completed history, and the current plan will be removed.",
      confirmLabel: "Reset tasks",
      action: resetTasks,
      destructive: true,
    },
    {
      id: "subjects",
      title: "Reset subjects",
      description: "Remove Subject Profiles without deleting any tasks.",
      confirmation:
        "Saved subjects, course details, grades, and subject colours will be removed. Existing task subject names will remain.",
      confirmLabel: "Reset subjects",
      action: resetSubjects,
      destructive: true,
    },
    {
      id: "appearance",
      title: "Reset appearance",
      description: "Restore theme, accent, density, Home, and Side Panel defaults.",
      confirmation:
        "Your visual and workspace layout preferences will return to their default values. Tasks and subjects will stay untouched.",
      confirmLabel: "Reset appearance",
      action: resetAppearancePreferences,
    },
    {
      id: "onboarding",
      title: "Restart onboarding",
      description: "Run local workspace setup again without deleting your work.",
      confirmation:
        "Onboarding will open again. Your tasks, subjects, and current preferences will remain available.",
      confirmLabel: "Restart onboarding",
      action: restartOnboarding,
    },
    {
      id: "all",
      title: "Clear all local app data",
      description: "Return Student Hub to a clean first-time state.",
      confirmation:
        "Tasks, completed history, subjects, profile, onboarding, preferences, widgets, and the current plan will all be removed from this device.",
      confirmLabel: "Clear all data",
      action: clearAllStudentHubData,
      destructive: true,
    },
  ];

  useEffect(() => {
    if (!pendingReset) return undefined;

    function closeOnEscape(event) {
      if (event.key === "Escape") setPendingReset(null);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [pendingReset]);

  function confirmReset() {
    if (!pendingReset) return;

    pendingReset.action();
    setPendingReset(null);
  }

  return (
    <div className="data-settings">
      <section className="panel data-panel">
        <div className="data-panel-intro">
          <div>
            <p className="settings-group-label">Stored on this device</p>
            <h3>Local workspace data</h3>
            <p>
              These controls only affect Student Hub data saved in this
              browser. Other site data is never touched.
            </p>
          </div>
          <span>Local only</span>
        </div>

        <div className="data-reset-list">
          {resetOptions.map((option) => (
            <div
              className={`data-reset-row ${
                option.destructive ? "destructive" : ""
              }`}
              key={option.id}
            >
              <div>
                <h3>{option.title}</h3>
                <p>{option.description}</p>
              </div>
              <button
                type="button"
                disabled={option.disabled}
                onClick={() => setPendingReset(option)}
              >
                {option.actionLabel ||
                  (option.id === "onboarding"
                    ? "Restart"
                    : option.id === "all"
                      ? "Clear"
                      : "Reset")}
              </button>
            </div>
          ))}
        </div>
      </section>

      {pendingReset && (
        <div
          className="data-confirmation-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPendingReset(null);
          }}
        >
          <section
            className={`data-confirmation ${
              pendingReset.destructive ? "destructive" : ""
            }`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="data-confirmation-title"
            aria-describedby="data-confirmation-description"
          >
            <div>
              <p className="settings-group-label">Confirm action</p>
              <h3 id="data-confirmation-title">{pendingReset.title}?</h3>
              <p id="data-confirmation-description">
                {pendingReset.confirmation}
              </p>
            </div>
            <div className="data-confirmation-actions">
              <button
                type="button"
                className="data-cancel-button"
                autoFocus
                onClick={() => setPendingReset(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="data-confirm-button"
                onClick={confirmReset}
              >
                {pendingReset.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SubjectsSettings({ subjects, setSubjects }) {
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [subjectDraft, setSubjectDraft] = useState(createSubjectDraft);
  const [subjectFormError, setSubjectFormError] = useState("");

  function openAddSubject() {
    setEditingSubjectId(null);
    setSubjectDraft(createSubjectDraft());
    setSubjectFormError("");
    setShowSubjectForm(true);
  }

  function openEditSubject(subject) {
    setEditingSubjectId(subject.id);
    setSubjectDraft({
      name: subject.name,
      courseSystem: subject.courseSystem,
      level: subject.level,
      currentGrade: subject.currentGrade,
      targetGrade: subject.targetGrade,
      colour: subject.colour,
    });
    setSubjectFormError("");
    setShowSubjectForm(true);
  }

  function closeSubjectForm() {
    setShowSubjectForm(false);
    setEditingSubjectId(null);
    setSubjectFormError("");
  }

  function saveSubject(event) {
    event.preventDefault();
    const name = subjectDraft.name.trim();
    const duplicateSubject = subjects.some(
      (subject) =>
        subject.id !== editingSubjectId &&
        subject.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase()
    );

    if (!name) return;

    if (duplicateSubject) {
      setSubjectFormError("A subject with this name already exists.");
      return;
    }

    if (editingSubjectId) {
      setSubjects((currentSubjects) =>
        currentSubjects.map((subject) =>
          subject.id === editingSubjectId
            ? { ...subject, ...subjectDraft, name, source: subject.source || "manual" }
            : subject
        )
      );
    } else {
      setSubjects((currentSubjects) => [
        ...currentSubjects,
        {
          id: `subject-${Date.now()}`,
          ...subjectDraft,
          name,
          source: "manual",
          classroomCourseId: null,
          externalId: null,
          importedAt: null,
          lastSyncedAt: null,
        },
      ]);
    }

    closeSubjectForm();
  }

  function deleteSubject(subjectId) {
    setSubjects((currentSubjects) =>
      currentSubjects.filter((subject) => subject.id !== subjectId)
    );

    if (editingSubjectId === subjectId) closeSubjectForm();
  }

  return (
    <div className="subjects-settings">
      <div className="panel subjects-panel">
        <div className="panel-header subjects-panel-header">
          <div>
            <h3>Subject profiles</h3>
            <p>Task names stay compatible even if a profile is removed.</p>
          </div>
          <button className="small-button" type="button" onClick={openAddSubject}>
            + Add subject
          </button>
        </div>

        {showSubjectForm && (
          <form className="subject-profile-form" onSubmit={saveSubject}>
            <div className="subject-form-grid">
              <label>
                <span>Subject name</span>
                <input
                  type="text"
                  value={subjectDraft.name}
                  placeholder="e.g. Biology"
                  required
                  onChange={(event) =>
                    setSubjectDraft({ ...subjectDraft, name: event.target.value })
                  }
                />
              </label>

              <label>
                <span>Course system</span>
                <select
                  value={subjectDraft.courseSystem}
                  onChange={(event) =>
                    setSubjectDraft({
                      ...subjectDraft,
                      courseSystem: event.target.value,
                    })
                  }
                >
                  {subjectCourseSystems.map((courseSystem) => (
                    <option key={courseSystem} value={courseSystem}>
                      {courseSystem}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Level</span>
                <select
                  value={subjectDraft.level}
                  onChange={(event) =>
                    setSubjectDraft({ ...subjectDraft, level: event.target.value })
                  }
                >
                  {subjectLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Current grade</span>
                <input
                  type="text"
                  value={subjectDraft.currentGrade}
                  placeholder="e.g. 5, B, 82%"
                  onChange={(event) =>
                    setSubjectDraft({
                      ...subjectDraft,
                      currentGrade: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>Target grade</span>
                <input
                  type="text"
                  value={subjectDraft.targetGrade}
                  placeholder="e.g. 7, A, 90%"
                  onChange={(event) =>
                    setSubjectDraft({
                      ...subjectDraft,
                      targetGrade: event.target.value,
                    })
                  }
                />
              </label>

              <label className="subject-colour-field">
                <span>Subject colour</span>
                <span>
                  <input
                    type="color"
                    value={subjectDraft.colour}
                    aria-label="Subject colour"
                    onChange={(event) =>
                      setSubjectDraft({
                        ...subjectDraft,
                        colour: event.target.value,
                      })
                    }
                  />
                  <strong>{subjectDraft.colour.toUpperCase()}</strong>
                </span>
              </label>
            </div>

            {subjectFormError && (
              <p className="subject-form-error">{subjectFormError}</p>
            )}

            <div className="subject-form-actions">
              <button className="primary-button" type="submit">
                {editingSubjectId ? "Save changes" : "Add subject"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={closeSubjectForm}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {subjects.length > 0 ? (
          <div className="subject-profile-list">
            {subjects.map((subject) => (
              <article
                className="subject-profile-card"
                key={subject.id}
                style={{ "--subject-color": subject.colour }}
              >
                <span className="subject-profile-colour" aria-hidden="true" />
                <div className="subject-profile-copy">
                  <div>
                    <h3>{subject.name}</h3>
                    <span>
                      {subject.courseSystem} · {subject.level}
                    </span>
                  </div>
                  <p>
                    Current <strong>{subject.currentGrade || "Not set"}</strong>
                    <i aria-hidden="true">→</i>
                    Target <strong>{subject.targetGrade || "Not set"}</strong>
                  </p>
                </div>
                <div className="subject-profile-actions">
                  <button type="button" onClick={() => openEditSubject(subject)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="subject-delete-button"
                    onClick={() => deleteSubject(subject.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="subject-empty-state">
            <h3>No subject profiles yet.</h3>
            <p>Add a course to use it across tasks and school calendars.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default SettingsPage;
