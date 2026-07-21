import { useEffect, useState } from "react";
import {
  subjectCourseSystems,
  subjectLevels,
  accentColorPresets,
  getContrastText,
  createSubjectDraft,
  findSubjectProfile,
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
const REAL_CLASSROOM_SOURCE = "classroom";
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
  removeMockClassroomTasks,
  updateMockClassroomCourseSubject,
  initialView = "hub",
  classroomCallbackStatus = null,
}) {
  const [settingsView, setSettingsView] = useState(() => initialView || "hub");
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
          removeMockClassroomTasks={removeMockClassroomTasks}
          updateMockClassroomCourseSubject={updateMockClassroomCourseSubject}
          classroomCallbackStatus={classroomCallbackStatus}
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
  removeMockClassroomTasks,
  updateMockClassroomCourseSubject,
  classroomCallbackStatus,
}) {
  const sampleCourses = buildMockClassroomPreview(mockClassroomData);
  const importedCount = tasks.filter(
    (task) => task.source === "classroom-mock"
  ).length;
  const [showMockPreview, setShowMockPreview] = useState(false);
  const [showRealClassroomReview, setShowRealClassroomReview] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [syncMessage, setSyncMessage] = useState("");
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
  const [realClassroomAssignmentPreview, setRealClassroomAssignmentPreview] =
    useState({
      loading: false,
      assignments: [],
      summary: null,
      lastPreviewedAt: "",
      message: "",
      error: "",
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
    checkRealClassroomSession();
  }, []);

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
    }

    setPendingAction(null);
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
            ? "Google Classroom session active."
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
                : "Google Classroom session expired. Connect again.",
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
            ? "Google Classroom connected, but no active courses were found."
            : "Read-only courses loaded. Assignments are not imported yet.",
        error: "",
      });
      setRealClassroomSession((currentState) => ({
        ...currentState,
        checking: false,
        connected: true,
        status: "classroom_session_available",
        message: "Google Classroom session active.",
      }));
      addSuggestedRealClassroomSubjectLinks(
        loadedCourses,
        realClassroomCourseSelections
      );
      if (loadedCourses.length > 0) {
        setShowRealClassroomReview(true);
      }
    } catch {
      setRealClassroomCourses((currentState) => ({
        ...currentState,
        loading: false,
        error: "Could not load Classroom courses. Try again later.",
      }));
    }
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
                : "Google Classroom session expired. Connect again.",
            tokenSummary: null,
          });
        }

        setRealClassroomAssignmentPreview((currentPreview) => ({
          ...currentPreview,
          loading: false,
          error:
            result.status === "classroom_coursework_permission_error"
              ? "Student Hub needs coursework access. Reconnect Google Classroom and approve read-only coursework permission."
              : result.message || "Could not preview Classroom assignments.",
        }));
        return;
      }

      setRealClassroomAssignmentPreview({
        loading: false,
        assignments: Array.isArray(result.assignments) ? result.assignments : [],
        summary: result.previewSummary || null,
        lastPreviewedAt: result.previewSummary?.previewedAt || new Date().toISOString(),
        message:
          result.message ||
          "Assignments loaded as a read-only preview. No tasks were created.",
        error: "",
      });
    } catch {
      setRealClassroomAssignmentPreview((currentPreview) => ({
        ...currentPreview,
        loading: false,
        error: "Could not preview Classroom assignments. Try again later.",
      }));
    }
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
            <p>
              Preview what is planned. No external services are connected yet.
            </p>
          </div>
          <span>Local workspace</span>
        </div>

        {classroomCallbackStatus && (
          <RealClassroomReturnStatus status={classroomCallbackStatus} />
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
              onLink={() => setPendingAction("link")}
              onSync={() => syncSampleClassroom()}
              onUnlink={() => setPendingAction("unlink")}
              onRemove={() => setPendingAction("remove")}
              onPreview={() => setShowMockPreview(true)}
              onCheckRealClassroomSetup={checkRealClassroomSetup}
              onLoadRealClassroomCourses={loadRealClassroomCourses}
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
          assignmentPreview={realClassroomAssignmentPreview}
          onPreviewAssignments={previewRealClassroomAssignments}
          onIncludeAll={() =>
            updateAllRealClassroomCourseSelections("included")
          }
          onIgnoreAll={() =>
            updateAllRealClassroomCourseSelections("ignored")
          }
          onResetChoices={resetRealClassroomCourseSelections}
          onClose={() => setShowRealClassroomReview(false)}
        />
      )}

      {pendingAction && (
        <ClassroomConnectionConfirmation
          action={pendingAction}
          onCancel={() => setPendingAction(null)}
          onConfirm={confirmAction}
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
      ? "Google Classroom connected for this browser. Courses were not checked during return, so try loading them here."
      : "Google Classroom connected for this browser. Read-only courses are available; assignments are not imported yet."
    : "Google Classroom did not finish connecting. Try again from the Google Classroom card.";

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

function IntegrationCard({
  integration,
  classroomConnection,
  importedCount,
  syncMessage,
  realClassroomSetup,
  realClassroomSession,
  realClassroomCourses,
  realClassroomCourseSelections,
  onLink,
  onSync,
  onUnlink,
  onRemove,
  onPreview,
  onCheckRealClassroomSetup,
  onLoadRealClassroomCourses,
}) {
  const isClassroom = integration.id === "google-classroom";
  const isRealClassroom = integration.id === "real-google-classroom";
  const isLinkedSample = isClassroom && classroomConnection.linked;
  const status = isClassroom
    ? isLinkedSample
      ? "linked-sample"
      : "not-linked"
    : integration.status;

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

      <p className="integration-description">{integration.description}</p>
      {isClassroom && (
        <p className="integration-helper">
          {isLinkedSample
            ? "Connected to Sample Classroom. Local demo connection; no Google account connected."
            : "Sample Classroom uses local data only. Real Google Classroom comes later."}
        </p>
      )}
      {isRealClassroom && (
        <div className="integration-helper integration-real-classroom-note">
          <p>Connect with read-only Classroom access for this browser.</p>
          <p>Assignments are not imported yet. Choose classes before importing later.</p>
        </div>
      )}
      {isRealClassroom && (
        <RealClassroomSetupStatus setup={realClassroomSetup} />
      )}
      {isRealClassroom && (
        <RealClassroomConnectionStatus
          session={realClassroomSession}
          setup={realClassroomSetup}
        />
      )}
      {isRealClassroom && (
        <RealClassroomCourseSummary
          courseState={realClassroomCourses}
          selections={realClassroomCourseSelections}
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
                className="integration-setup-button"
                onClick={onCheckRealClassroomSetup}
                disabled={realClassroomSetup.checking}
              >
                {realClassroomSetup.checking ? "Checking..." : "Check setup"}
              </button>
              <a
                className="integration-oauth-prototype-link"
                href="/api/google-classroom/connect"
              >
                Connect Google Classroom
              </a>
              <button
                type="button"
                className="integration-sync-button"
                onClick={onLoadRealClassroomCourses}
                disabled={realClassroomCourses.loading}
              >
                {realClassroomCourses.loading
                  ? "Loading classes..."
                  : realClassroomCourses.courses.length > 0
                    ? "Manage / refresh classes"
                    : "Load Classroom courses"}
              </button>
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

function RealClassroomCourseReviewModal({
  courseState,
  selections,
  subjects,
  subjectLinks,
  onSelectCourse,
  onSelectSubject,
  onCreateSubject,
  assignmentPreview,
  onPreviewAssignments,
  onIncludeAll,
  onIgnoreAll,
  onResetChoices,
  onClose,
}) {
  const courses = courseState.courses;
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
              Review Google Classroom classes
            </h3>
            <p>
              Choose which classes Student Hub should use later. Assignments
              are not imported yet.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close class review">
            Close
          </button>
        </header>

        <div className="real-classroom-course-summary">
          <span>{courses.length} total</span>
          <span>{includedCount} included</span>
          <span>{ignoredCount} ignored</span>
          <span>{needsReviewCount} needs review</span>
          <span>No tasks created</span>
        </div>

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
          <button
            type="button"
            onClick={onPreviewAssignments}
            disabled={assignmentPreview.loading}
          >
            {assignmentPreview.loading
              ? "Loading assignments..."
              : "Preview assignments"}
          </button>
        </div>

        {(unlinkedIncludedCount > 0 ||
          assignmentPreview.error ||
          assignmentPreview.message ||
          assignmentPreview.loading ||
          assignmentPreview.assignments.length > 0) && (
          <RealClassroomAssignmentPreview
            preview={assignmentPreview}
            unlinkedCount={unlinkedIncludedCount}
          />
        )}

        <div className="real-classroom-course-list">
          {courses.map((course) => {
            const courseId = getRealClassroomCourseId(course);
            const selection = selections[courseId] || "needs-review";
            const linkedSubject = subjects.find(
              (subject) => subject.id === subjectLinks[courseId]?.subjectId
            );
            const suggestedSubject =
              linkedSubject || findBestSubjectForClassroomCourse(subjects, course);
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
                  <button
                    type="button"
                    className={selection === "included" ? "is-selected" : ""}
                    onClick={() => onSelectCourse(courseId, "included")}
                  >
                    Include
                  </button>
                  <button
                    type="button"
                    className={selection === "ignored" ? "is-selected" : ""}
                    onClick={() => onSelectCourse(courseId, "ignored")}
                  >
                    Ignore
                  </button>
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
                        Assignments from this class will use this subject later.
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

        <footer className="real-classroom-modal-footer">
          <p>
            Only include/ignore choices are saved locally. No Google tokens are
            stored in localStorage.
          </p>
          <button type="button" onClick={onClose}>
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}

function formatRealClassroomAssignmentDueDate(assignment) {
  if (!assignment.dueDate) return "No due date";

  const date = new Date(`${assignment.dueDate}T00:00:00`);
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

function RealClassroomAssignmentPreview({ preview, unlinkedCount }) {
  const groupedAssignments = preview.assignments.reduce((groups, assignment) => {
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

  return (
    <section className="real-classroom-assignment-preview" aria-live="polite">
      <div className="real-classroom-assignment-preview-header">
        <div>
          <strong>Assignment preview</strong>
          <p>Preview only. No Student Hub tasks have been created yet.</p>
        </div>
        {preview.summary && (
          <span>
            {preview.summary.assignmentCount} assignment
            {preview.summary.assignmentCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {unlinkedCount > 0 && (
        <p className="real-classroom-preview-warning">
          {unlinkedCount} included class{unlinkedCount === 1 ? "" : "es"} not
          linked to subjects yet. You can preview now, but importing later will
          require subject links.
        </p>
      )}

      {preview.loading && <p>Reading assignments from included classes...</p>}
      {preview.error && (
        <p className="real-classroom-preview-error">{preview.error}</p>
      )}
      {preview.message && !preview.error && !preview.loading && (
        <p>{preview.message}</p>
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
                {group.assignments.map((assignment) => (
                  <div
                    className="real-classroom-assignment-row"
                    key={assignment.externalId}
                  >
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
                ))}
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

function ClassroomConnectionConfirmation({ action, onCancel, onConfirm }) {
  const isUnlink = action === "unlink";
  const isRemove = action === "remove";

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
          <p className="settings-group-label">Sample Classroom</p>
          <h3 id="classroom-confirmation-title">
            {isRemove
              ? "Remove imported sample tasks?"
              : isUnlink
                ? "Unlink sample Classroom?"
                : "Link sample Classroom?"}
          </h3>
          <p>
            {isRemove
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
            {isRemove
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
            <p className="settings-group-label">Prototype 3 foundation</p>
            <h3>Mock Classroom Preview</h3>
            <p>
              Review the local sample classes and subject mappings. No Google
              account is connected.
            </p>
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
            <strong>Preview only</strong>
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
