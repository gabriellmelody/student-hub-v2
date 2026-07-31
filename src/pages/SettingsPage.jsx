import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DayloMark from "../components/DayloMark.jsx";
import QuickLinkIcon from "../components/QuickLinkIcon.jsx";
import {
  subjectCourseSystems,
  subjectLevels,
  DEFAULT_THEME_COLORS,
  themeBackgroundModes,
  themeBackgroundStrengths,
  logoAppearanceOptions,
  getThemeColorWarnings,
  createSubjectDraft,
  findSubjectProfile,
  hasRealDueDate,
  normalizeThemeColors,
  REAL_CLASSROOM_COURSE_LINKS_STORAGE_KEY,
  MOCK_CLASSROOM_COURSE_LINKS_STORAGE_KEY,
  MOCK_CLASSROOM_INTEGRATION_STORAGE_KEY,
  normalizeSubjectName,
  QUICK_LINK_PIN_LIMIT,
  quickLinkIconCatalog,
  normalizeQuickLinksPreferences,
  normalizeQuickLinkUrl,
  quickLinkPresets,
} from "../utils/appUtils.js";
import { helpTopics, getHelpTopic } from "../data/helpGuides.js";
import { getGuidedTourDefinition } from "../data/guidedTours.js";
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
import {
  GOOGLE_CALENDAR_PREFERENCES_KEY,
  getGoogleCalendarAccountId,
  loadGoogleCalendarAccountMeta,
  reconcileGoogleCalendarAccountStorage,
} from "../utils/googleCalendarStorage.js";
import { formatSmartPlannerResetTime } from "../utils/smartPlannerUtils.js";
import {
  isValidSubjectColour,
  suggestSubjectColour,
  suggestSubjectDraftColour,
} from "../utils/subjectColourUtils.js";
import {
  SUPPORT_FIELD_LIMITS,
  buildSafeDiagnosticDetails,
  buildSupportMailto,
  buildSupportMessage,
  copySupportMessage,
  getGuidedTourActionLabel,
  getGuidedTourDisplayStatus,
  normalizeSupportEmail,
  resetGuidedTourProgress,
  validateSupportDraft,
} from "../utils/helpSupportUtils.js";
import { loadGuidedTourProgress } from "../utils/guidedTourStorage.js";
import {
  REAL_CLASSROOM_SOURCE,
  createRealClassroomCourseLink,
  findBestSubjectForClassroomCourse,
  getRealClassroomCourseId,
  getSuggestedClassroomSubjectName,
} from "../utils/classroomCourseUtils.js";
import { REAL_CLASSROOM_COURSE_SELECTIONS_KEY } from "../utils/onboardingUtils.js";

const STUDENT_HUB_SUPPORT_EMAIL = normalizeSupportEmail(
  import.meta.env.VITE_STUDENT_HUB_SUPPORT_EMAIL || ""
);
const STUDENT_HUB_BUILD_ID =
  String(import.meta.env.VITE_STUDENT_HUB_BUILD_ID || "").trim() ||
  "Beta build";
const GOOGLE_IDENTITY_SERVICES_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_OAUTH_BROWSER_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLASSROOM_CLIENT_ID ||
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID ||
  "";
const GOOGLE_CLASSROOM_POPUP_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
];
const GOOGLE_CALENDAR_POPUP_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
];
const CLASSROOM_STATUS_LABELS = {
  active: "Assigned",
  missing: "Missing",
  done: "Turned in",
  returned: "Returned",
  no_due_date: "No due date",
  unknown: "Unknown status",
};
const CLASSROOM_DONE_CATEGORIES = new Set(["done", "returned"]);
let googleIdentityServicesLoadPromise = null;

function loadGoogleIdentityServicesScript() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("browser_unavailable"));
  }

  if (window.google?.accounts?.oauth2?.initCodeClient) {
    return Promise.resolve(window.google);
  }

  if (googleIdentityServicesLoadPromise) {
    return googleIdentityServicesLoadPromise;
  }

  googleIdentityServicesLoadPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(
      `script[src="${GOOGLE_IDENTITY_SERVICES_SRC}"]`
    );

    function handleLoad() {
      if (window.google?.accounts?.oauth2?.initCodeClient) {
        resolve(window.google);
      } else {
        reject(new Error("google_identity_unavailable"));
      }
    }

    if (existingScript) {
      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("google_identity_load_failed")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_IDENTITY_SERVICES_SRC;
    script.async = true;
    script.defer = true;
    script.onload = handleLoad;
    script.onerror = () => reject(new Error("google_identity_load_failed"));
    document.head.appendChild(script);
  }).catch((error) => {
    googleIdentityServicesLoadPromise = null;
    throw error;
  });

  return googleIdentityServicesLoadPromise;
}

function formatCountLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
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

  if (isUnlinked) badges.push({ label: "Needs Subject", tone: "warning" });
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
  themeColors,
  setThemeColors,
  saveThemeColorPreferences,
  themeColorPalettes,
  layoutDensity,
  setLayoutDensity,
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
  quickLinksPreferences,
  setQuickLinksPreferences,
  initialView = "hub",
  classroomCallbackStatus = null,
  googleCalendarCallbackStatus = null,
  smartPlannerStatus,
  onRefreshSmartPlannerStatus,
  onOpenSmartPlanner,
  onReplayTour,
  navigationRequest = 0,
}) {
  const [settingsView, setSettingsView] = useState(() => initialView || "hub");
  const [savedThemeColorSnapshot, setSavedThemeColorSnapshot] = useState(() =>
    normalizeThemeColors(themeColors)
  );
  const [themeColorDraft, setThemeColorDraft] = useState(() =>
    normalizeThemeColors(themeColors)
  );
  const [themeColorDirty, setThemeColorDirty] = useState(false);
  const [themeAdvancedOpen, setThemeAdvancedOpen] = useState(false);
  const themeColorDirtyRef = useRef(false);
  const savedThemeColorRef = useRef(savedThemeColorSnapshot);
  const setThemeColorsRef = useRef(setThemeColors);
  const settingsHeadingRef = useRef(null);
  const previousSettingsViewRef = useRef(settingsView);

  useEffect(() => {
    setSettingsView(initialView || "hub");
  }, [initialView, navigationRequest]);

  useEffect(() => {
    themeColorDirtyRef.current = themeColorDirty;
  }, [themeColorDirty]);

  useEffect(() => {
    savedThemeColorRef.current = savedThemeColorSnapshot;
  }, [savedThemeColorSnapshot]);

  useEffect(() => {
    setThemeColorsRef.current = setThemeColors;
  }, [setThemeColors]);

  useEffect(() => {
    if (themeColorDirty) return;

    const normalizedThemeColors = normalizeThemeColors(themeColors);
    setSavedThemeColorSnapshot(normalizedThemeColors);
    setThemeColorDraft(normalizedThemeColors);
  }, [themeColors, themeColorDirty]);

  useEffect(() => {
    if (settingsView !== "appearance" && themeColorDirty) {
      setThemeColorsRef.current(savedThemeColorSnapshot);
      setThemeColorDraft(savedThemeColorSnapshot);
      setThemeColorDirty(false);
    }
  }, [settingsView, themeColorDirty, savedThemeColorSnapshot]);

  useEffect(() => {
    if (settingsView === "appearance") {
      setThemeAdvancedOpen(false);
    }
  }, [settingsView]);

  useLayoutEffect(() => {
    if (previousSettingsViewRef.current === settingsView) return;

    previousSettingsViewRef.current = settingsView;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    settingsHeadingRef.current?.focus({ preventScroll: true });
  }, [settingsView]);

  useEffect(() => {
    return () => {
      if (themeColorDirtyRef.current) {
        setThemeColorsRef.current(savedThemeColorRef.current);
      }
    };
  }, []);

  const themeColorWarnings = getThemeColorWarnings(themeColorDraft);
  const themeColorHasWarnings = Object.keys(themeColorWarnings).length > 0;
  const matchingThemePalette = themeColorPalettes.find((palette) =>
    ["primary", "secondary", "tertiary"].every(
      (role) =>
        palette[role].toLowerCase() === themeColorDraft[role].toLowerCase()
    )
  );
  const selectedThemePaletteId = matchingThemePalette?.id || "custom";
  const hasCustomThemePalette = selectedThemePaletteId === "custom";
  const selectedBackgroundMode =
    themeBackgroundModes.find(
      (mode) => mode.value === themeColorDraft.backgroundMode
    ) || themeBackgroundModes[0];
  const selectedBackgroundStrength =
    themeBackgroundStrengths.find(
      (strength) => strength.value === themeColorDraft.backgroundStrength
    ) || themeBackgroundStrengths[0];
  const backgroundTonePreview =
    themeColorDraft.backgroundMode === "match-theme"
      ? themeColorDraft.primary
      : themeColorDraft.backgroundTone;

  function previewThemeColors(nextThemeColors) {
    const normalizedThemeColors = normalizeThemeColors(nextThemeColors);

    setThemeColorDraft(normalizedThemeColors);
    setThemeColors(normalizedThemeColors);
    setThemeColorDirty(true);
  }

  function persistThemeColors(nextThemeColors) {
    const normalizedThemeColors = normalizeThemeColors(nextThemeColors);

    saveThemeColorPreferences(normalizedThemeColors);
    setSavedThemeColorSnapshot(normalizedThemeColors);
    setThemeColorDraft(normalizedThemeColors);
    setThemeColors(normalizedThemeColors);
    setThemeColorDirty(false);
  }

  function persistThemePreference(updatePreference) {
    const nextSavedTheme = normalizeThemeColors(
      updatePreference(savedThemeColorSnapshot)
    );
    const nextDraftTheme = normalizeThemeColors(
      updatePreference(themeColorDraft)
    );

    saveThemeColorPreferences(nextSavedTheme);
    setSavedThemeColorSnapshot(nextSavedTheme);
    setThemeColorDraft(nextDraftTheme);
    setThemeColors(nextDraftTheme);
  }

  function chooseThemePalette(palette) {
    persistThemeColors({
      ...themeColorDraft,
      paletteId: palette.id,
      primary: palette.primary,
      secondary: palette.secondary,
      tertiary: palette.tertiary,
    });
  }

  function updateThemeColorRole(role, nextColor) {
    previewThemeColors({
      ...themeColorDraft,
      paletteId: "custom",
      [role]: nextColor,
    });
  }

  function updateLogoAppearance(nextAppearance) {
    persistThemePreference((currentTheme) => ({
      ...currentTheme,
      logoAppearance: nextAppearance,
    }));
  }

  function updateThemeBackgroundField(field, nextValue) {
    persistThemePreference((currentTheme) => ({
      ...currentTheme,
      [field]: nextValue,
    }));
  }

  function updateThemeBackgroundMode(nextMode) {
    persistThemePreference((currentTheme) => ({
      ...currentTheme,
      backgroundMode: nextMode,
      backgroundStrength:
        nextMode === "neutral"
          ? "off"
          : currentTheme.backgroundStrength === "off"
            ? "subtle"
            : currentTheme.backgroundStrength,
    }));
  }

  function resetThemeColorDraft() {
    persistThemeColors(DEFAULT_THEME_COLORS);
  }

  function cancelThemeColorChanges() {
    setThemeColors(savedThemeColorSnapshot);
    setThemeColorDraft(savedThemeColorSnapshot);
    setThemeColorDirty(false);
  }

  function saveThemeColorChanges() {
    const normalizedThemeColors = normalizeThemeColors(themeColorDraft);

    saveThemeColorPreferences(normalizedThemeColors);
    setSavedThemeColorSnapshot(normalizedThemeColors);
    setThemeColorDraft(normalizedThemeColors);
    setThemeColorDirty(false);
  }

  const viewCopy = {
    hub: {
      eyebrow: "Settings",
      title: "Settings",
      description: "Manage how DayLo looks, stores data, and connects to school tools.",
    },
    appearance: {
      eyebrow: "Settings / Appearance",
      title: "Appearance",
      description: "Personalise how DayLo looks and feels.",
    },
    subjects: {
      eyebrow: "Settings / Subjects",
      title: "Subjects",
      description: "Keep your courses and grade goals organised in one place.",
    },
    data: {
      eyebrow: "Settings / Data",
      title: "Data & reset",
      description: "Manage local DayLo data and workspace defaults.",
    },
    help: {
      eyebrow: "Settings / Help & tours",
      title: "Help & tours",
      description:
        "Learn how DayLo works, replay guided tours or report a problem.",
    },
    integrations: {
      eyebrow: "Settings / Integrations",
      title: "Integrations",
      description: "Connect school tools and choose what DayLo can use.",
    },
    quickLinks: {
      eyebrow: "Settings / Quick links",
      title: "Quick links",
      description: "Pin a few school websites in the sidebar.",
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
        <h1 ref={settingsHeadingRef} tabIndex="-1">
          {currentViewCopy.title}
        </h1>
        <p>{currentViewCopy.description}</p>
      </header>

      <div
        className={`settings-view-content ${
          settingsView === "hub"
            ? "settings-hub-content"
            : "settings-detail-content"
        }`}
        key={settingsView}
      >
        {settingsView === "hub" ? (
        <div className="settings-hub-grid">
          <button
            type="button"
            className="settings-hub-card"
            onClick={() => setSettingsView("appearance")}
          >
            <span>
              <strong>Appearance</strong>
              <small>Theme, colours, density, and layout</small>
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
              <small>Courses, grade goals, and colours</small>
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
              <small>Local data, resets, and onboarding</small>
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
              <strong>Help & tours</strong>
              <small>Guides, tour replays, feedback, and support</small>
            </span>
            <span className="settings-hub-arrow" aria-hidden="true">
              →
            </span>
          </button>

          <button
            type="button"
            className="settings-hub-card"
            onClick={() => setSettingsView("quickLinks")}
          >
            <span>
              <strong>Quick links</strong>
              <small>Pin school websites in the sidebar</small>
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
              <small>Classroom, Calendar, and future tools</small>
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
            <div className="theme-setting">
              <div>
                <h3>Appearance mode</h3>
                <p>Choose the appearance that feels most comfortable.</p>
              </div>

              <div className="theme-toggle" role="group" aria-label="Theme">
                {["light", "dark", "system"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={theme === option ? "active" : ""}
                    aria-pressed={theme === option}
                    onClick={() => setTheme(option)}
                  >
                    {option === "light"
                      ? "Light"
                      : option === "dark"
                        ? "Dark"
                        : "System"}
                  </button>
                ))}
              </div>
            </div>

            <div className="theme-setting accent-setting theme-colour-setting">
              <div>
                <h3>Theme colours</h3>
                <p>Palettes customise the three colour roles together.</p>
              </div>

              <div className="theme-colour-controls">
                <div
                  className="theme-palette-grid"
                  aria-label="Theme colour palettes"
                >
                  {themeColorPalettes.map((palette) => {
                    const isSelected = selectedThemePaletteId === palette.id;

                    return (
                      <button
                        key={palette.id}
                        type="button"
                        className={isSelected ? "active" : ""}
                        aria-pressed={isSelected}
                        aria-label={`${palette.label} palette${
                          isSelected ? ", selected" : ""
                        }`}
                        onClick={() => chooseThemePalette(palette)}
                      >
                        <span
                          className="theme-palette-swatches"
                          aria-hidden="true"
                        >
                          <i style={{ "--swatch-color": palette.primary }} />
                          <i style={{ "--swatch-color": palette.secondary }} />
                          <i style={{ "--swatch-color": palette.tertiary }} />
                        </span>
                        <span className="theme-palette-name">
                          <strong>{palette.label}</strong>
                          {isSelected && <small>Selected</small>}
                        </span>
                        <span
                          className="theme-palette-check"
                          aria-hidden="true"
                        >
                          {isSelected ? "✓" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {hasCustomThemePalette && (
                  <div
                    className="theme-palette-custom-state active"
                    role="status"
                    aria-label="Custom palette selected"
                  >
                    <span
                      className="theme-palette-swatches"
                      aria-hidden="true"
                    >
                      <i style={{ "--swatch-color": themeColorDraft.primary }} />
                      <i
                        style={{ "--swatch-color": themeColorDraft.secondary }}
                      />
                      <i style={{ "--swatch-color": themeColorDraft.tertiary }} />
                    </span>
                    <span>
                      <strong>Custom</strong>
                      <small>Selected</small>
                    </span>
                    <span aria-hidden="true">✓</span>
                  </div>
                )}

                <div className="theme-logo-setting">
                  <div className="theme-logo-heading">
                    <strong>Logo appearance</strong>
                    <small>Choose how the in-app DayLo mark is shown.</small>
                  </div>
                  <div
                    className="theme-logo-options"
                    role="group"
                    aria-label="Logo appearance"
                  >
                    {logoAppearanceOptions.map((option) => {
                      const isSelected =
                        themeColorDraft.logoAppearance === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={isSelected ? "active" : ""}
                          aria-pressed={isSelected}
                          onClick={() => updateLogoAppearance(option.value)}
                        >
                          <DayloMark
                            className="theme-logo-option-mark"
                            appearance={option.value}
                          />
                          <strong>{option.label}</strong>
                          <span aria-hidden="true">{isSelected ? "✓" : ""}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  className="theme-background-setting"
                  id="theme-background-setting"
                >
                  <div className="theme-background-heading">
                    <span>
                      <strong>Background</strong>
                      <small>
                        {selectedBackgroundMode.label}
                        {themeColorDraft.backgroundMode !== "neutral"
                          ? ` · ${selectedBackgroundStrength.label}`
                          : ""}
                      </small>
                    </span>
                    <span
                      className="theme-background-current-swatch"
                      aria-hidden="true"
                      style={{ "--background-tone-preview": backgroundTonePreview }}
                    />
                  </div>

                  <div
                    className="theme-background-options"
                    role="group"
                    aria-label="Background mode"
                  >
                    {themeBackgroundModes.map((mode) => {
                      const isSelected =
                        themeColorDraft.backgroundMode === mode.value;

                      return (
                        <button
                          key={mode.value}
                          type="button"
                          className={isSelected ? "active" : ""}
                          aria-pressed={isSelected}
                          onClick={() => updateThemeBackgroundMode(mode.value)}
                        >
                          <span aria-hidden="true">
                            {isSelected ? "✓" : ""}
                          </span>
                          <strong>{mode.label}</strong>
                        </button>
                      );
                    })}
                  </div>

                  {themeColorDraft.backgroundMode === "custom" && (
                    <label className="theme-background-tone-picker">
                      <span>
                        <strong>Custom tone</strong>
                        <small>{themeColorDraft.backgroundTone}</small>
                      </span>
                      <input
                        type="color"
                        value={themeColorDraft.backgroundTone}
                        aria-label="Custom background tone"
                        onChange={(event) =>
                          updateThemeBackgroundField(
                            "backgroundTone",
                            event.target.value
                          )
                        }
                      />
                    </label>
                  )}

                  {themeColorDraft.backgroundMode !== "neutral" && (
                    <div
                      className="theme-background-strength"
                      role="group"
                      aria-label="Tint strength"
                    >
                      <span>Tint strength</span>
                      <div>
                        {themeBackgroundStrengths.map((strength) => {
                          const isSelected =
                            themeColorDraft.backgroundStrength ===
                            strength.value;

                          return (
                            <button
                              key={strength.value}
                              type="button"
                              className={isSelected ? "active" : ""}
                              aria-pressed={isSelected}
                              onClick={() =>
                                updateThemeBackgroundField(
                                  "backgroundStrength",
                                  strength.value
                                )
                              }
                            >
                              <span aria-hidden="true">
                                {isSelected ? "✓" : ""}
                              </span>
                              {strength.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="theme-colour-advanced">
                  <button
                    type="button"
                    className="theme-colour-advanced-toggle"
                    aria-expanded={themeAdvancedOpen}
                    aria-controls="advanced-theme-colours"
                    onClick={() =>
                      setThemeAdvancedOpen((currentOpen) => !currentOpen)
                    }
                  >
                    <span>
                      <strong>Advanced colours</strong>
                      <small>Edit Primary, Secondary, and Tertiary individually.</small>
                    </span>
                    <span
                      className={`theme-colour-advanced-chevron ${
                        themeAdvancedOpen ? "open" : ""
                      }`}
                      aria-hidden="true"
                    >
                      ⌄
                    </span>
                  </button>

                  {themeColorHasWarnings && (
                    <p className="theme-colour-warning">
                      {Object.values(themeColorWarnings)[0]}
                    </p>
                  )}

                  {themeAdvancedOpen && (
                    <div
                      id="advanced-theme-colours"
                      className="theme-colour-advanced-body"
                    >
                      {[
                        ["primary", "Primary"],
                        ["secondary", "Secondary"],
                        ["tertiary", "Tertiary"],
                      ].map(([role, label]) => (
                        <label className="theme-colour-picker" key={role}>
                          <span>
                            <strong>{label}</strong>
                            <small>{themeColorDraft[role]}</small>
                          </span>
                          <input
                            type="color"
                            value={themeColorDraft[role]}
                            aria-label={`${label} theme colour`}
                            onChange={(event) =>
                              updateThemeColorRole(role, event.target.value)
                            }
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {themeColorDirty && (
                  <div
                    className="theme-colour-actions theme-colour-pending-actions"
                    role="group"
                    aria-label="Unsaved advanced colour changes"
                  >
                    <button
                      type="button"
                      className="theme-colour-cancel"
                      onClick={cancelThemeColorChanges}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="theme-colour-save"
                      onClick={saveThemeColorChanges}
                    >
                      Save theme
                    </button>
                  </div>
                )}
              </div>
            </div>

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

            <div className="appearance-reset-row">
              <button
                type="button"
                className="theme-colour-reset"
                onClick={resetThemeColorDraft}
              >
                Reset to DayLo default
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
          smartPlannerStatus={smartPlannerStatus}
          onRefreshSmartPlannerStatus={onRefreshSmartPlannerStatus}
          onOpenSmartPlanner={onOpenSmartPlanner}
          navigationRequest={navigationRequest}
        />
      ) : settingsView === "quickLinks" ? (
        <QuickLinksSettings
          quickLinksPreferences={quickLinksPreferences}
          setQuickLinksPreferences={setQuickLinksPreferences}
        />
      ) : (
        <HelpSettings
          theme={theme}
          classroomConnected={
            classroomCallbackStatus?.result === "connected" ? true : undefined
          }
          calendarConnected={Boolean(loadGoogleCalendarAccountMeta()?.accountId)}
          smartPlannerStatus={smartPlannerStatus}
          onReplayTour={onReplayTour}
        />
        )}
      </div>
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
  smartPlannerStatus,
  onRefreshSmartPlannerStatus,
  onOpenSmartPlanner,
  navigationRequest = 0,
}) {
  const sampleCourses = buildMockClassroomPreview(mockClassroomData);
  const importedCount = tasks.filter(
    (task) => task.source === "classroom-mock"
  ).length;
  const realClassroomImportedCount = tasks.filter(
    (task) => task.source === REAL_CLASSROOM_SOURCE
  ).length;
  const [showMockPreview, setShowMockPreview] = useState(false);
  const [showRealClassroomReview, setShowRealClassroomReview] = useState(() => {
    if (typeof window === "undefined") return false;

    return (
      new URLSearchParams(window.location.search).get(
        "googleClassroomManager"
      ) === "1"
    );
  });
  const [showGoogleCalendarManager, setShowGoogleCalendarManager] =
    useState(() => {
      if (typeof window === "undefined") return false;

      return (
        new URLSearchParams(window.location.search).get(
          "googleCalendarManager"
        ) === "1"
      );
    });
  const [integrationAutoSaveStatus, setIntegrationAutoSaveStatus] = useState({
    status: "idle",
    message: "",
  });
  const [pendingAction, setPendingAction] = useState(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [classroomCleanupMessage, setClassroomCleanupMessage] = useState("");
  const [successToast, setSuccessToast] = useState(null);
  const [googleIdentityStatus, setGoogleIdentityStatus] = useState(() => ({
    loading: Boolean(GOOGLE_OAUTH_BROWSER_CLIENT_ID),
    ready: false,
    error: GOOGLE_OAUTH_BROWSER_CLIENT_ID
      ? ""
      : "Google popup setup needs a browser client ID.",
  }));
  const [googleOAuthPopupState, setGoogleOAuthPopupState] = useState({
    provider: null,
    messageProvider: null,
    message: "",
    errorProvider: null,
    error: "",
    fallbackProvider: null,
  });
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
  const autoSaveTimerRef = useRef(null);
  const autoSaveRequestedRef = useRef(false);
  const realClassroomSelectionsReadyRef = useRef(false);
  const realClassroomLinksReadyRef = useRef(false);
  const googleCalendarPreferencesReadyRef = useRef(false);
  const realClassroomConnectButtonRef = useRef(null);
  const googleCalendarConnectButtonRef = useRef(null);
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
    onRefreshSmartPlannerStatus?.();
  }, [onRefreshSmartPlannerStatus]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!GOOGLE_OAUTH_BROWSER_CLIENT_ID) return undefined;

    let isMounted = true;

    setGoogleIdentityStatus({
      loading: true,
      ready: false,
      error: "",
    });

    loadGoogleIdentityServicesScript()
      .then(() => {
        if (!isMounted) return;

        setGoogleIdentityStatus({
          loading: false,
          ready: true,
          error: "",
        });
      })
      .catch(() => {
        if (!isMounted) return;

        setGoogleIdentityStatus({
          loading: false,
          ready: false,
          error:
            "Google popup setup could not load. Use redirect instead or try again.",
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function showIntegrationAutoSaveStatus(status, message) {
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    setIntegrationAutoSaveStatus({ status, message });

    if (status === "saved") {
      autoSaveTimerRef.current = window.setTimeout(() => {
        setIntegrationAutoSaveStatus({ status: "idle", message: "" });
        autoSaveTimerRef.current = null;
      }, 1800);
    }
  }

  function markIntegrationAutoSaving() {
    autoSaveRequestedRef.current = true;
    showIntegrationAutoSaveStatus("saving", "Saving…");
  }

  function markIntegrationAutoSaved() {
    if (!autoSaveRequestedRef.current) return;

    autoSaveRequestedRef.current = false;
    showIntegrationAutoSaveStatus("saved", "Saved");
  }

  function markIntegrationAutoSaveError() {
    if (!autoSaveRequestedRef.current) return;

    autoSaveRequestedRef.current = false;
    showIntegrationAutoSaveStatus("error", "Couldn’t save");
  }

  function dismissIntegrationAutoSaveError() {
    if (integrationAutoSaveStatus.status !== "error") return;

    setIntegrationAutoSaveStatus({ status: "idle", message: "" });
  }

  useEffect(() => {
    localStorage.setItem(
      MOCK_CLASSROOM_INTEGRATION_STORAGE_KEY,
      JSON.stringify({ ...classroomConnection, importedCount })
    );
  }, [classroomConnection, importedCount]);

  useEffect(() => {
    if (!realClassroomSelectionsReadyRef.current) {
      realClassroomSelectionsReadyRef.current = true;
      return;
    }

    try {
      localStorage.setItem(
        REAL_CLASSROOM_COURSE_SELECTIONS_KEY,
        JSON.stringify(realClassroomCourseSelections)
      );
      markIntegrationAutoSaved();
    } catch {
      markIntegrationAutoSaveError();
    }
  }, [realClassroomCourseSelections]);

  useEffect(() => {
    if (!realClassroomLinksReadyRef.current) {
      realClassroomLinksReadyRef.current = true;
      return;
    }

    try {
      localStorage.setItem(
        REAL_CLASSROOM_COURSE_LINKS_STORAGE_KEY,
        JSON.stringify(realClassroomCourseSubjectLinks)
      );
      markIntegrationAutoSaved();
    } catch {
      markIntegrationAutoSaveError();
    }
  }, [realClassroomCourseSubjectLinks]);

  useEffect(() => {
    if (!googleCalendarPreferencesReadyRef.current) {
      googleCalendarPreferencesReadyRef.current = true;
      return;
    }

    try {
      localStorage.setItem(
        GOOGLE_CALENDAR_PREFERENCES_KEY,
        JSON.stringify(googleCalendarPreferences)
      );
      markIntegrationAutoSaved();
    } catch {
      markIntegrationAutoSaveError();
    }
  }, [googleCalendarPreferences]);

  useEffect(() => {
    function syncCalendarManagerFromHistory() {
      const params = new URLSearchParams(window.location.search);
      const isCalendarManagerOpen =
        params.get("googleCalendarManager") === "1";
      const isClassroomManagerOpen =
        params.get("googleClassroomManager") === "1";

      setShowGoogleCalendarManager(isCalendarManagerOpen);
      setShowRealClassroomReview(isClassroomManagerOpen);
    }

    window.addEventListener("popstate", syncCalendarManagerFromHistory);

    return () =>
      window.removeEventListener("popstate", syncCalendarManagerFromHistory);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);

    setShowGoogleCalendarManager(params.get("googleCalendarManager") === "1");
    setShowRealClassroomReview(params.get("googleClassroomManager") === "1");
  }, [navigationRequest]);

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
    }, 1900);

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
        "Sample Classroom unlinked. Imported tasks remain in DayLo."
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

  function focusGoogleConnectButton(provider) {
    window.setTimeout(() => {
      if (provider === "classroom") {
        realClassroomConnectButtonRef.current?.focus();
      } else if (provider === "calendar") {
        googleCalendarConnectButtonRef.current?.focus();
      }
    }, 0);
  }

  function getGooglePopupConfig(provider) {
    if (provider === "classroom") {
      return {
        provider,
        endpoint: "/api/google-classroom/callback",
        scopes: GOOGLE_CLASSROOM_POPUP_SCOPES,
        fallbackHref: "/api/google-classroom/connect",
        successTitle: "Google Classroom connected",
        successSummary: "Ready to manage classes",
        checkingLabel: "Connecting Classroom...",
      };
    }

    return {
      provider: "calendar",
      endpoint: "/api/google-calendar/callback",
      scopes: GOOGLE_CALENDAR_POPUP_SCOPES,
      fallbackHref: "/api/google-calendar/connect",
      successTitle: "Google Calendar connected",
      successSummary: "Ready to load calendars",
      checkingLabel: "Connecting Calendar...",
    };
  }

  function setGooglePopupMessage(provider, message) {
    setGoogleOAuthPopupState({
      provider: null,
      messageProvider: provider,
      message,
      errorProvider: null,
      error: "",
      fallbackProvider: null,
    });
    focusGoogleConnectButton(provider);
  }

  function setGooglePopupError(provider, error, { fallback = true } = {}) {
    setGoogleOAuthPopupState({
      provider: null,
      messageProvider: null,
      message: "",
      errorProvider: provider,
      error,
      fallbackProvider: fallback ? provider : null,
    });
    focusGoogleConnectButton(provider);
  }

  function clearGoogleCalendarProviderState({
    accountId = "",
    message = "Google Calendar connected. Load calendars to review them.",
  } = {}) {
    reconcileGoogleCalendarAccountStorage(accountId);
    setGoogleCalendarCalendars({
      loading: false,
      calendars: [],
      summary: null,
      lastCheckedAt: "",
      message,
      error: "",
    });
    setGoogleCalendarPreferences({});
  }

  function clearProviderResultsAfterReconnect(provider, accountId = "") {
    if (provider === "classroom") {
      setRealClassroomCourses({
        loading: false,
        courses: [],
        summary: null,
        lastCheckedAt: "",
        message: "Classroom connected. Load classes to review them.",
        error: "",
      });
      setRealClassroomAssignmentPreview({
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
    } else {
      clearGoogleCalendarProviderState({
        accountId,
        message: "Google Calendar connected. Load calendars to review them.",
      });
    }
  }

  async function refreshProviderSessionAfterPopup(provider) {
    if (provider === "classroom") {
      await checkRealClassroomSession();
    } else {
      await checkGoogleCalendarSession();
    }
  }

  async function exchangeGooglePopupCode(provider, code) {
    const config = getGooglePopupConfig(provider);
    const response = await fetch(config.endpoint, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "XmlHttpRequest",
      },
      body: JSON.stringify({ code }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || result?.ok !== true) {
      throw new Error(
        result?.message || "Google connection could not be completed."
      );
    }

    if (result.accountChanged === true) {
      clearProviderResultsAfterReconnect(
        provider,
        provider === "calendar" ? getGoogleCalendarAccountId(result) : ""
      );
    }
    await refreshProviderSessionAfterPopup(provider);
    setSuccessToast({
      title: config.successTitle,
      summary: config.successSummary,
    });
    setGoogleOAuthPopupState({
      provider: null,
      messageProvider: provider,
      message: result.message || config.successTitle,
      errorProvider: null,
      error: "",
      fallbackProvider: null,
    });
    focusGoogleConnectButton(provider);
  }

  function startGooglePopupConnection(provider) {
    const config = getGooglePopupConfig(provider);

    if (googleOAuthPopupState.provider) return;

    if (!GOOGLE_OAUTH_BROWSER_CLIENT_ID) {
      setGooglePopupError(
        provider,
        "Google popup setup needs a browser client ID. Use redirect instead.",
        { fallback: true }
      );
      return;
    }

    if (!googleIdentityStatus.ready) {
      setGooglePopupError(
        provider,
        googleIdentityStatus.error ||
          "Google popup setup is still loading. Try again in a moment.",
        { fallback: true }
      );
      return;
    }

    setGoogleOAuthPopupState({
      provider,
      messageProvider: null,
      message: "",
      errorProvider: null,
      error: "",
      fallbackProvider: null,
    });

    try {
      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: GOOGLE_OAUTH_BROWSER_CLIENT_ID,
        scope: config.scopes.join(" "),
        ux_mode: "popup",
        select_account: true,
        include_granted_scopes: true,
        callback: async (codeResponse) => {
          if (codeResponse?.error) {
            const cancelled = codeResponse.error === "access_denied";

            if (cancelled) {
              setGooglePopupMessage(
                provider,
                "Google connection was cancelled."
              );
            } else {
              setGooglePopupError(
                provider,
                "Google connection could not be completed.",
                { fallback: true }
              );
            }
            return;
          }

          if (typeof codeResponse?.code !== "string") {
            setGooglePopupError(
              provider,
              "Google did not return a connection code. Try again.",
              { fallback: true }
            );
            return;
          }

          try {
            await exchangeGooglePopupCode(provider, codeResponse.code);
          } catch (error) {
            setGooglePopupError(
              provider,
              error?.message || "Google connection could not be completed.",
              { fallback: true }
            );
          }
        },
        error_callback: (popupError) => {
          const errorType = popupError?.type || popupError?.error || "unknown";

          if (errorType === "popup_closed") {
            setGooglePopupMessage(provider, "Google connection was cancelled.");
          } else if (errorType === "popup_failed_to_open") {
            setGooglePopupError(
              provider,
              "Google popup was blocked. Use redirect instead.",
              { fallback: true }
            );
          } else {
            setGooglePopupError(
              provider,
              "Google popup could not start. Try again or use redirect instead.",
              { fallback: true }
            );
          }
        },
      });

      client.requestCode();
    } catch {
      setGooglePopupError(
        provider,
        "Google popup could not start. Try again or use redirect instead.",
        { fallback: true }
      );
    }
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
            : "Classes loaded. Choose what DayLo should use.",
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
        setRealClassroomManagerPageOpen(true, {
          push: !showRealClassroomReview,
        });
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

  function setRealClassroomManagerPageOpen(isOpen, { push = true } = {}) {
    setShowRealClassroomReview(isOpen);

    if (typeof window === "undefined") return;

    const nextUrl = new URL(window.location.href);

    if (isOpen) {
      nextUrl.searchParams.set("tab", "integrations");
      nextUrl.searchParams.set("googleClassroomManager", "1");
      nextUrl.searchParams.delete("googleCalendarManager");
    } else {
      nextUrl.searchParams.delete("googleClassroomManager");
      if (!nextUrl.searchParams.get("tab")) {
        nextUrl.searchParams.set("tab", "integrations");
      }
    }

    const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;

    if (nextPath === `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      return;
    }

    if (push) {
      window.history.pushState({}, "", nextPath);
    } else {
      window.history.replaceState({}, "", nextPath);
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
      const accountId =
        response.ok && result.connected === true
          ? getGoogleCalendarAccountId(result)
          : "";

      if (!accountId) {
        clearGoogleCalendarProviderState({
          message:
            result.connected === true
              ? "Google Calendar connected. Load calendars to review them."
              : "No Google Calendar connected.",
        });
      } else {
        const accountScope =
          reconcileGoogleCalendarAccountStorage(accountId);

        if (accountScope.cleared) {
          setGoogleCalendarCalendars({
            loading: false,
            calendars: [],
            summary: null,
            lastCheckedAt: "",
            message: "Google Calendar connected. Load calendars to review them.",
            error: "",
          });
          setGoogleCalendarPreferences({});
        }
      }

      setGoogleCalendarSession({
        checking: false,
        connected: result.connected === true && Boolean(accountId),
        status: result.status || "unknown",
        message:
          result.connected === true && accountId
            ? "Google Calendar connected."
            : result.message || "No Google Calendar connected.",
        tokenSummary: result.tokenSummary || null,
        accountId,
      });
    } catch {
      clearGoogleCalendarProviderState({
        message: "Could not check Google Calendar status.",
      });
      setGoogleCalendarSession({
        checking: false,
        connected: false,
        status: "session_check_failed",
        message: "Could not check Google Calendar status.",
        tokenSummary: null,
      });
    }
  }

  function setGoogleCalendarManagerPageOpen(isOpen, { push = true } = {}) {
    setShowGoogleCalendarManager(isOpen);

    if (typeof window === "undefined") return;

    const nextUrl = new URL(window.location.href);

    if (isOpen) {
      nextUrl.searchParams.set("tab", "integrations");
      nextUrl.searchParams.set("googleCalendarManager", "1");
      nextUrl.searchParams.delete("googleClassroomManager");
    } else {
      nextUrl.searchParams.delete("googleCalendarManager");
      if (!nextUrl.searchParams.get("tab")) {
        nextUrl.searchParams.set("tab", "integrations");
      }
    }

    const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;

    if (nextPath === `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      return;
    }

    if (push) {
      window.history.pushState({}, "", nextPath);
    } else {
      window.history.replaceState({}, "", nextPath);
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
          clearGoogleCalendarProviderState({
            message:
              result.status === "no_calendar_session"
                ? "No Google Calendar connected."
                : "Google Calendar connection expired. Connect again.",
          });
          setGoogleCalendarSession({
            checking: false,
            connected: false,
            status: result.status,
            message:
              result.status === "no_calendar_session"
                ? "No Google Calendar connected."
                : "Google Calendar connection expired. Connect again.",
            tokenSummary: null,
            accountId: "",
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
      const accountId = getGoogleCalendarAccountId(result);

      if (!accountId) {
        clearGoogleCalendarProviderState({
          message: "Google Calendar connected. Load calendars to review them.",
        });
        setGoogleCalendarSession({
          checking: false,
          connected: false,
          status: "calendar_account_missing",
          message: "Reconnect Google Calendar to load calendars.",
          tokenSummary: null,
          accountId: "",
        });
        setGoogleCalendarCalendars((currentState) => ({
          ...currentState,
          loading: false,
          error: "Reconnect Google Calendar to load calendars.",
        }));
        return;
      }

      const accountScope = reconcileGoogleCalendarAccountStorage(accountId);
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
          accountScope.cleared ? {} : currentPreferences,
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
        accountId,
      }));
      setSuccessToast({
        title: "Google Calendar ready",
        summary: `${loadedCalendars.length} calendar${
          loadedCalendars.length === 1 ? "" : "s"
        } found`,
      });
      if (loadedCalendars.length > 0) {
        setGoogleCalendarManagerPageOpen(true, {
          push: !showGoogleCalendarManager,
        });
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

    const currentPreference = {
      ...getDefaultGoogleCalendarPreference(calendar),
      ...googleCalendarPreferences[calendarId],
      calendarId,
      calendarName: calendar.summary || calendar.name || "Untitled calendar",
    };
    const hasChanges = Object.entries(updates).some(
      ([key, value]) => currentPreference[key] !== value
    );

    if (!hasChanges) return;

    markIntegrationAutoSaving();
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
    const hasChanges = googleCalendarCalendars.calendars.some((calendar) => {
      const calendarId = getGoogleCalendarId(calendar);

      if (!calendarId) return false;

      const currentPreference =
        googleCalendarPreferences[calendarId] ||
        getDefaultGoogleCalendarPreference(calendar);

      return currentPreference.showInStudentHub !== showInStudentHub;
    });

    if (!hasChanges) return;

    markIntegrationAutoSaving();
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
    const course = realClassroomCourses.courses.find(
      (courseItem) => getRealClassroomCourseId(courseItem) === courseId
    );
    const suggestedLink =
      selection === "included" && course
        ? getSuggestedRealClassroomCourseLink(course)
        : null;
    const selectionWillChange =
      selection === "included" || selection === "ignored"
        ? realClassroomCourseSelections[courseId] !== selection
        : Boolean(realClassroomCourseSelections[courseId]);
    const linkWillChange =
      (selection === "included" &&
        course &&
        !realClassroomCourseSubjectLinks[courseId] &&
        Boolean(suggestedLink)) ||
      (selection === "ignored" &&
        Boolean(realClassroomCourseSubjectLinks[courseId]));

    if (!selectionWillChange && !linkWillChange) return;

    markIntegrationAutoSaving();
    setRealClassroomCourseSelections((currentSelections) => {
      const nextSelections = { ...currentSelections };

      if (selection === "included" || selection === "ignored") {
        nextSelections[courseId] = selection;
      } else {
        delete nextSelections[courseId];
      }

      return nextSelections;
    });

    if (selection === "included" && course) {
      setRealClassroomCourseSubjectLinks((currentLinks) => {
        if (currentLinks[courseId]) return currentLinks;

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
    const hasSelectionChanges = realClassroomCourses.courses.some((course) => {
      const courseId = getRealClassroomCourseId(course);

      return courseId && realClassroomCourseSelections[courseId] !== selection;
    });
    const hasLinkChanges =
      selection === "included"
        ? realClassroomCourses.courses.some((course) => {
            const courseId = getRealClassroomCourseId(course);

            return (
              courseId &&
              !realClassroomCourseSubjectLinks[courseId] &&
              Boolean(getSuggestedRealClassroomCourseLink(course))
            );
          })
        : selection === "ignored"
          ? realClassroomCourses.courses.some((course) => {
              const courseId = getRealClassroomCourseId(course);

              return courseId && Boolean(realClassroomCourseSubjectLinks[courseId]);
            })
          : false;

    if (!hasSelectionChanges && !hasLinkChanges) return;

    markIntegrationAutoSaving();
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
    const hasCourseChoices = realClassroomCourses.courses.some((course) => {
      const courseId = getRealClassroomCourseId(course);

      return (
        courseId &&
        (realClassroomCourseSelections[courseId] ||
          realClassroomCourseSubjectLinks[courseId])
      );
    });

    if (!hasCourseChoices) return;

    markIntegrationAutoSaving();
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
    const currentLink = realClassroomCourseSubjectLinks[courseId];

    if (
      (selectedSubject && currentLink?.subjectId === selectedSubject.id) ||
      (!selectedSubject && !currentLink)
    ) {
      return;
    }

    markIntegrationAutoSaving();
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

    markIntegrationAutoSaving();

    const explicitCourseColour = course?.colour || course?.color;
    const subjectColour = isValidSubjectColour(explicitCourseColour)
      ? explicitCourseColour
      : suggestSubjectColour(subjectName, subjects, courseId);

    const newSubject = {
      id: `subject-${REAL_CLASSROOM_SOURCE}-${courseId}`,
      ...createSubjectDraft("Other", subjects, subjectName),
      name: subjectName,
      courseSystem: "Other",
      level: "Other",
      colour: subjectColour,
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
              ? "DayLo can read assignments but not submission status yet. Reconnect Google Classroom or check school permissions."
              : result.status === "classroom_coursework_permission_error"
              ? "DayLo needs assignment access. Reconnect Google Classroom and approve read-only access."
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
    const importedClassroomTasks = getImportedClassroomTaskMap(tasks);

    return realClassroomAssignmentPreview.assignments
      .filter((assignment) => {
        const courseId = assignment.classroomCourseId;
        const link = realClassroomCourseSubjectLinks[courseId];
        const existingTask = importedClassroomTasks.get(assignment.externalId);

        return (
          realClassroomCourseSelections[courseId] === "included" &&
          link?.subjectId &&
          link?.subjectName &&
          realClassroomAssignmentPreview.selectedAssignmentIds[
            assignment.externalId
          ] === true &&
          (!existingTask ||
            hasClassroomAssignmentChanges(assignment, existingTask))
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

    if (importableAssignments.length === 0) {
      setRealClassroomAssignmentPreview((currentPreview) => ({
        ...currentPreview,
        error: "Select at least one new or updated assignment with a linked Subject.",
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

  if (showRealClassroomReview) {
    return (
      <div className="integrations-settings">
        <IntegrationAutoSaveStatus
          status={integrationAutoSaveStatus.status}
          message={integrationAutoSaveStatus.message}
          onDismiss={dismissIntegrationAutoSaveError}
        />

        <RealClassroomCourseReviewPage
          courseState={realClassroomCourses}
          selections={realClassroomCourseSelections}
          subjects={subjects}
          subjectLinks={realClassroomCourseSubjectLinks}
          cleanup={realClassroomCleanup}
          assignmentPreview={realClassroomAssignmentPreview}
          importedClassroomTasks={getImportedClassroomTaskMap(tasks)}
          onLoadCourses={loadRealClassroomCourses}
          onSelectCourse={updateRealClassroomCourseSelection}
          onSelectSubject={updateRealClassroomCourseSubject}
          onCreateSubject={createSubjectFromRealClassroomCourse}
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
          onBack={() => setRealClassroomManagerPageOpen(false)}
        />

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

  if (showGoogleCalendarManager) {
    return (
      <div className="integrations-settings">
        <IntegrationAutoSaveStatus
          status={integrationAutoSaveStatus.status}
          message={integrationAutoSaveStatus.message}
          onDismiss={dismissIntegrationAutoSaveError}
        />

        <GoogleCalendarManagerPage
          calendarState={googleCalendarCalendars}
          preferences={googleCalendarPreferences}
          onLoadCalendars={loadGoogleCalendars}
          onTogglePreference={updateGoogleCalendarPreference}
          onShowAll={() => updateAllGoogleCalendarVisibility(true)}
          onHideAll={() => updateAllGoogleCalendarVisibility(false)}
          onBack={() => setGoogleCalendarManagerPageOpen(false)}
        />

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

  return (
    <div className="integrations-settings">
      <IntegrationAutoSaveStatus
        status={integrationAutoSaveStatus.status}
        message={integrationAutoSaveStatus.message}
        onDismiss={dismissIntegrationAutoSaveError}
      />

      <section
        className="panel integration-control-panel"
        data-tour="integrations-overview"
      >
        <div className="integration-control-intro">
          <div>
            <p className="settings-group-label">Connections</p>
            <h3>School tools in one place</h3>
            <p>Connect tools, review what they can use, and keep control of what appears in DayLo.</p>
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
              googleIdentityStatus={googleIdentityStatus}
              googleOAuthPopupState={googleOAuthPopupState}
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
              onConnectGooglePopup={startGooglePopupConnection}
              realClassroomConnectButtonRef={realClassroomConnectButtonRef}
              onManageRealClassroom={() =>
                setRealClassroomManagerPageOpen(true)
              }
              onLoadGoogleCalendars={loadGoogleCalendars}
              googleCalendarConnectButtonRef={googleCalendarConnectButtonRef}
              onManageGoogleCalendars={() =>
                setGoogleCalendarManagerPageOpen(true)
              }
              smartPlannerStatus={smartPlannerStatus}
              onRefreshSmartPlannerStatus={onRefreshSmartPlannerStatus}
              onOpenSmartPlanner={onOpenSmartPlanner}
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
  googleIdentityStatus,
  googleOAuthPopupState,
  onLink,
  onSync,
  onUnlink,
  onRemove,
  onPreview,
  onCheckRealClassroomSetup,
  onLoadRealClassroomCourses,
  onConnectGooglePopup,
  realClassroomConnectButtonRef,
  onManageRealClassroom,
  onLoadGoogleCalendars,
  googleCalendarConnectButtonRef,
  onManageGoogleCalendars,
  smartPlannerStatus,
  onRefreshSmartPlannerStatus,
  onOpenSmartPlanner,
}) {
  const isClassroom = integration.id === "google-classroom";
  const isRealClassroom = integration.id === "real-google-classroom";
  const isGoogleCalendar = integration.id === "google-calendar";
  const isSmartPlanner = integration.id === "ai-planner";
  const isLinkedSample = isClassroom && classroomConnection.linked;
  const status = isClassroom
    ? isLinkedSample
      ? "linked-sample"
      : "not-linked"
    : isRealClassroom
      ? realClassroomSession.connected
        ? "linked"
        : "not-linked"
    : isGoogleCalendar
      ? googleCalendarSession.connected
        ? "linked"
        : "not-linked"
      : isSmartPlanner
        ? smartPlannerStatus?.error
          ? "unavailable"
          : smartPlannerStatus?.loading
            ? "checking"
            : smartPlannerStatus?.status === "ready"
              ? "ready"
              : smartPlannerStatus?.status === "daily_limit_reached"
                ? "daily-limit-reached"
                : smartPlannerStatus?.status === "unavailable" ||
                    smartPlannerStatus?.status === "configuration_error"
                  ? "unavailable"
                  : "checking"
        : integration.status;
  const { includedCount } = getRealClassroomCourseCounts(
    realClassroomCourses.courses,
    realClassroomCourseSelections
  );
  const popupProvider = isRealClassroom
    ? "classroom"
    : isGoogleCalendar
      ? "calendar"
      : null;
  const isPopupConnecting =
    popupProvider && googleOAuthPopupState.provider === popupProvider;
  const popupMessage =
    popupProvider && googleOAuthPopupState.messageProvider === popupProvider
      ? googleOAuthPopupState.message
      : "";
  const popupError =
    popupProvider && googleOAuthPopupState.errorProvider === popupProvider
      ? googleOAuthPopupState.error
      : "";
  const showRedirectFallback =
    popupProvider &&
    (googleOAuthPopupState.fallbackProvider === popupProvider ||
      googleIdentityStatus.error);
  const popupConnectDisabled =
    Boolean(isPopupConnecting) ||
    googleIdentityStatus.loading ||
    (!googleIdentityStatus.ready && !googleIdentityStatus.error);
  const integrationIconId = isRealClassroom
    ? "school"
    : isGoogleCalendar
      ? "calendar"
      : isSmartPlanner
        ? "sparkles"
        : "school";

  return (
    <article
      className="integration-card"
      data-tour={isSmartPlanner ? "smart-planner-status" : undefined}
    >
      <div className="integration-card-heading">
        <span className="integration-provider-mark" aria-hidden="true">
          <QuickLinkIcon
            iconId={integrationIconId}
            className="integration-provider-icon"
          />
        </span>
        <div>
          <h3>{integration.name}</h3>
          <p>{integration.provider}</p>
        </div>
        <span
          className={`integration-status integration-status-${status}`}
        >
          {integrationStatusLabels[status] || "Checking"}
        </span>
      </div>

      <p className="integration-description">
        {isRealClassroom && realClassroomSession.connected
          ? "Manage classes, preview assignments, and import selected work."
          : isGoogleCalendar && googleCalendarSession.connected
            ? "Manage calendars, visible events, and busy time."
          : integration.description}
      </p>
      {isClassroom && (
        <p className="integration-helper">
          {isLinkedSample
            ? "Local demo connection. No Google account connected."
            : "Local sample data only."}
        </p>
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
      {isSmartPlanner && (
        <SmartPlannerIntegrationStatus status={smartPlannerStatus} />
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
      {popupMessage && (
        <p className="integration-card-message" aria-live="polite">
          {popupMessage}
        </p>
      )}
      {popupError && (
        <p
          className="integration-card-message integration-card-message-error"
          role="alert"
        >
          {popupError}
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
              {realClassroomSession.connected && (
                <button
                  type="button"
                  className="integration-primary-action"
                  onClick={
                    realClassroomCourses.courses.length > 0
                      ? onManageRealClassroom
                      : onLoadRealClassroomCourses
                  }
                  disabled={realClassroomCourses.loading}
                >
                  {realClassroomCourses.loading
                    ? "Loading classes..."
                    : realClassroomCourses.courses.length > 0
                      ? "Manage Classroom"
                      : "Load classes"}
                </button>
              )}
              <button
                type="button"
                className={
                  realClassroomSession.connected
                    ? "integration-secondary-action secondary"
                    : "integration-primary-action"
                }
                onClick={() => onConnectGooglePopup("classroom")}
                disabled={popupConnectDisabled}
                ref={realClassroomConnectButtonRef}
                aria-busy={isPopupConnecting ? "true" : undefined}
              >
                {isPopupConnecting
                  ? "Connecting..."
                  : realClassroomSession.connected
                  ? "Reconnect"
                  : "Connect Google Classroom"}
              </button>
              {showRedirectFallback && (
                <a
                  className="integration-setup-button secondary"
                  href="/api/google-classroom/connect"
                >
                  Use redirect instead
                </a>
              )}
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
                  className="integration-primary-action"
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
              <button
                type="button"
                className={
                  googleCalendarSession.connected
                    ? "integration-secondary-action secondary"
                    : "integration-primary-action"
                }
                onClick={() => onConnectGooglePopup("calendar")}
                disabled={popupConnectDisabled}
                ref={googleCalendarConnectButtonRef}
                aria-busy={isPopupConnecting ? "true" : undefined}
              >
                {isPopupConnecting
                  ? "Connecting..."
                  : googleCalendarSession.connected
                  ? "Reconnect"
                  : "Connect Google Calendar"}
              </button>
              {showRedirectFallback && (
                <a
                  className="integration-setup-button secondary"
                  href="/api/google-calendar/connect"
                >
                  Use redirect instead
                </a>
              )}
            </>
          ) : isSmartPlanner ? (
            <>
              <button
                type="button"
                className="integration-primary-action"
                onClick={onOpenSmartPlanner}
              >
                Open Smart Planner
              </button>
              <button
                type="button"
                className="integration-setup-button secondary"
                onClick={onRefreshSmartPlannerStatus}
                disabled={smartPlannerStatus?.loading}
              >
                {smartPlannerStatus?.loading ? "Refreshing..." : "Refresh status"}
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

function SmartPlannerIntegrationStatus({ status }) {
  const dailyLimit = Number.isInteger(status?.dailyLimit)
    ? status.dailyLimit
    : 3;
  const remaining = Number.isInteger(status?.remainingGenerations)
    ? Math.max(0, status.remainingGenerations)
    : null;
  const resetLabel = formatSmartPlannerResetTime(status?.resetAt);
  const isLimitReached = status?.status === "daily_limit_reached";
  const isUnavailable =
    status?.status === "unavailable" ||
    status?.status === "configuration_error" ||
    Boolean(status?.error);

  let detail = `${dailyLimit} AI plans available every 24 hours`;
  let support = "Basic Planner is always available.";

  if (status?.loading && status?.status === "unknown") {
    detail = "Checking Smart Planner availability...";
  } else if (isLimitReached) {
    detail = `0 of ${dailyLimit} AI plans remaining`;
    support = "Basic Planner is still available.";
  } else if (isUnavailable) {
    detail = "AI planning is unavailable right now.";
    support = "Basic Planner still works.";
  } else if (
    remaining !== null &&
    !(status?.status === "ready" && !status?.resetAt && remaining === dailyLimit)
  ) {
    detail = `${remaining} of ${dailyLimit} AI plans remaining`;
  }

  return (
    <div
      className="smart-planner-integration-status"
      role="status"
      aria-live="polite"
      aria-busy={status?.loading ? "true" : "false"}
    >
      <strong>{detail}</strong>
      {resetLabel && !isUnavailable && <span>{resetLabel}</span>}
      <small>{support}</small>
    </div>
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

function IntegrationAutoSaveStatus({ status, message, onDismiss }) {
  if (!status || status === "idle") return null;

  const isError = status === "error";

  return (
    <div
      className={`integration-auto-save-status ${status}`}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <span className="integration-auto-save-icon" aria-hidden="true">
        {status === "saving" ? "" : status === "saved" ? "✓" : "!"}
      </span>
      <span>{message}</span>
      {isError && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss save error"
        >
          ×
        </button>
      )}
    </div>
  );
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
          ? "Loading classes"
          : courseState.error
            ? "Classes not loaded"
            : `${courses.length} ${courses.length === 1 ? "class" : "classes"} loaded`}
      </strong>
      <p>
        {courseState.loading
          ? "Reading active Classroom classes..."
          : courseState.error ||
            `${includedCount} included · ${ignoredCount} ignored · ${needsReviewCount} ${
              needsReviewCount === 1 ? "needs" : "need"
            } review`}
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
        <strong>{connected ? "Classroom ready" : "Connect to start"}</strong>
        <span>
          {connected
            ? "Manage classes and imported work"
            : "Import assignments and link Subjects"}
        </span>
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
        <strong>{connected ? "Calendars ready" : "Connect to start"}</strong>
        <span>
          {connected
            ? calendarCount > 0
              ? `${calendarCount} calendars available`
              : "Load calendars to manage"
            : "Show events and protect study time"}
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

function GoogleCalendarManagerPage({
  calendarState,
  preferences,
  onLoadCalendars,
  onTogglePreference,
  onShowAll,
  onHideAll,
  onBack,
}) {
  const calendars = calendarState.calendars;
  const duplicateRiskCount = calendars.filter((calendar) => {
    const preference =
      preferences[getGoogleCalendarId(calendar)] ||
      getDefaultGoogleCalendarPreference(calendar);

    return Boolean(preference.duplicateRisk);
  }).length;

  return (
    <section className="settings-provider-subpage google-calendar-manager-page">
      <div className="settings-provider-header google-calendar-manager-top">
        <button
          type="button"
          className="settings-back-button settings-provider-back google-calendar-manager-back"
          onClick={onBack}
          aria-label="Back to Integrations"
        >
          ← Integrations
        </button>
        <header className="google-calendar-manager-header">
          <div>
            <p className="settings-group-label">
              Settings / Integrations / Google Calendar
            </p>
            <h1 id="google-calendar-manager-title">Manage calendars</h1>
            <p id="google-calendar-manager-description">
              Choose which calendars appear in DayLo and which events block study time. Nothing is changed in Google.
            </p>
          </div>
        </header>

        <div className="google-calendar-manager-summary">
          <span>
            {calendars.length} calendar{calendars.length === 1 ? "" : "s"}
          </span>
          {duplicateRiskCount > 0 && (
            <span>{duplicateRiskCount} Classroom assignment calendars</span>
          )}
          {calendarState.lastCheckedAt && (
            <small>Loaded {formatConnectionTime(calendarState.lastCheckedAt)}</small>
          )}
        </div>

        <div className="google-calendar-manager-actions">
          <button
            type="button"
            onClick={onShowAll}
            disabled={calendars.length === 0}
          >
            Show all
          </button>
          <button
            type="button"
            onClick={onHideAll}
            disabled={calendars.length === 0}
          >
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
    </section>
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
      <div className="google-calendar-manager-controls">
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
          <span>Show in DayLo</span>
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
    </div>
  );
}

function RealClassroomCourseReviewPage({
  courseState,
  selections,
  subjects,
  subjectLinks,
  onLoadCourses,
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
  onBack,
}) {
  const courses = courseState.courses;
  const [activeReviewTab, setActiveReviewTab] = useState("classes");
  const { includedCount, ignoredCount, needsReviewCount } =
    getRealClassroomCourseCounts(courses, selections);
  const unlinkedIncludedCount = courses.filter((course) => {
    const courseId = getRealClassroomCourseId(course);

    return selections[courseId] === "included" && !subjectLinks[courseId];
  }).length;

  function previewAssignments() {
    setActiveReviewTab("assignments");
    onPreviewAssignments();
  }

  function goToClassSetup(courseId = "") {
    setActiveReviewTab("classes");

    if (!courseId || typeof document === "undefined") return;

    window.setTimeout(() => {
      const safeCourseId =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(courseId)
          : courseId.replace(/["\\]/g, "\\$&");
      const courseRow = document.querySelector(
        `[data-classroom-course-id="${safeCourseId}"]`
      );

      courseRow?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  return (
    <section className="settings-provider-subpage real-classroom-manager-page">
      <div className="settings-provider-header">
        <button
          type="button"
          className="settings-back-button settings-provider-back"
          onClick={onBack}
          aria-label="Back to Integrations"
        >
          ← Integrations
        </button>
        <header className="real-classroom-manager-header">
          <div>
            <p className="settings-group-label">
              Settings / Integrations / Google Classroom
            </p>
            <h1 id="real-classroom-review-title">
              Manage Classroom
            </h1>
            <p id="real-classroom-review-description">
              Choose classes, link Subjects, preview assignments, and import selected work.
            </p>
          </div>
        </header>
      </div>

        <div className="real-classroom-manager-body">
          <div className="real-classroom-course-summary">
            <span>{courses.length} classes found</span>
            {includedCount > 0 && <span>{includedCount} included</span>}
            {ignoredCount > 0 && <span>{ignoredCount} ignored</span>}
            {needsReviewCount > 0 && (
              <span>
                {needsReviewCount}{" "}
                {needsReviewCount === 1
                  ? "needs class choice"
                  : "need class choices"}
              </span>
            )}
            {unlinkedIncludedCount > 0 && (
              <span>
                {unlinkedIncludedCount}{" "}
                {unlinkedIncludedCount === 1
                  ? "needs Subject"
                  : "need Subjects"}
              </span>
            )}
            {courseState.lastCheckedAt && (
              <small>Loaded {formatConnectionTime(courseState.lastCheckedAt)}</small>
            )}
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
                <p>Included classes need a Subject before import.</p>
              </div>
              <div className="real-classroom-tab-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={onLoadCourses}
                  disabled={courseState.loading}
                >
                  {courseState.loading ? "Loading..." : "Refresh classes"}
                </button>
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
                  <article
                    className="real-classroom-course-row"
                    data-classroom-course-id={courseId}
                    key={courseId}
                  >
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
                            Imported assignments will use this Subject.
                          </p>
                        </div>
                        <label>
                          <span>DayLo subject</span>
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
                              : `Create and link "${subjectName}"`}
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
              <div className="real-classroom-tab-actions">
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
              onGoToClassSetup={goToClassSetup}
            />
            </section>
          ) : (
            <section className="real-classroom-tab-panel real-classroom-tab-panel--cleanup">
            <div className="real-classroom-tab-heading">
              <div>
                <strong>Cleanup</strong>
                <p>Archive imported Classroom items without due dates.</p>
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
        </div>
    </section>
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
  onGoToClassSetup,
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
  const assignmentDisplayStates = new Map(
    includedPreviewAssignments.map((assignment) => {
      const existingTask = importedClassroomTasks.get(assignment.externalId);
      const syncStatus = getClassroomAssignmentSyncStatus({
        assignment,
        existingTask,
        linkedCourseIds,
      });

      return [assignment.externalId, syncStatus];
    })
  );
  const staleSelectedIds = includedPreviewAssignments
    .filter((assignment) => {
      const syncStatus = assignmentDisplayStates.get(assignment.externalId);

      return (
        preview.selectedAssignmentIds?.[assignment.externalId] === true &&
        syncStatus?.isImported &&
        !syncStatus?.isUpdated
      );
    })
    .map((assignment) => assignment.externalId);

  useEffect(() => {
    staleSelectedIds.forEach((assignmentId) => {
      onSelectAssignment(assignmentId, false);
    });
  }, [onSelectAssignment, staleSelectedIds.join("|")]);

  const selectedAssignments = includedPreviewAssignments.filter((assignment) => {
    const syncStatus = assignmentDisplayStates.get(assignment.externalId);

    return (
      preview.selectedAssignmentIds?.[assignment.externalId] === true &&
      !(syncStatus?.isImported && !syncStatus?.isUpdated)
    );
  });
  const selectedCount = selectedAssignments.length;
  const selectedAlreadyImportedCount = selectedAssignments.filter((assignment) => {
    const syncStatus = assignmentDisplayStates.get(assignment.externalId);

    return syncStatus?.isImported && !syncStatus?.isUpdated;
  }).length;
  const updatedCount = selectedAssignments.filter(
    (assignment) => assignmentDisplayStates.get(assignment.externalId)?.isUpdated
  ).length;
  const newImportCount = selectedAssignments.filter((assignment) => {
    const syncStatus = assignmentDisplayStates.get(assignment.externalId);

    return !syncStatus?.isImported && !syncStatus?.isUnlinked;
  }).length;
  const unlinkedSelectedCourseIds = Array.from(
    new Set(
      selectedAssignments
        .filter((assignment) => assignmentDisplayStates.get(assignment.externalId)?.isUnlinked)
        .map((assignment) => assignment.classroomCourseId)
        .filter(Boolean)
    )
  );
  const unlinkedPreviewCourseCount = unlinkedSelectedCourseIds.length;
  const actionableCount = newImportCount + updatedCount;
  const visibleSelectableAssignmentIds = filteredAssignments
    .filter((assignment) => {
      const syncStatus =
        assignmentDisplayStates.get(assignment.externalId) ||
        getClassroomAssignmentSyncStatus({
          assignment,
          existingTask: importedClassroomTasks.get(assignment.externalId),
          linkedCourseIds,
        });

      return !(syncStatus.isImported && !syncStatus.isUpdated);
    })
    .map((assignment) => assignment.externalId)
    .filter(Boolean);
  const unlinkedVisibleCourseIds = Array.from(
    new Set(
      filteredAssignments
        .filter((assignment) => {
          const syncStatus =
            assignmentDisplayStates.get(assignment.externalId) ||
            getClassroomAssignmentSyncStatus({
              assignment,
              existingTask: importedClassroomTasks.get(assignment.externalId),
              linkedCourseIds,
            });

          return syncStatus.isUnlinked;
        })
        .map((assignment) => assignment.classroomCourseId)
        .filter(Boolean)
    )
  );
  const firstUnlinkedCourseId =
    unlinkedSelectedCourseIds[0] || unlinkedVisibleCourseIds[0] || "";
  const importedVisibleCount = filteredAssignments.filter((assignment) => {
    const syncStatus =
      assignmentDisplayStates.get(assignment.externalId) ||
      getClassroomAssignmentSyncStatus({
        assignment,
        existingTask: importedClassroomTasks.get(assignment.externalId),
        linkedCourseIds,
      });

    return syncStatus.isImported && !syncStatus.isUpdated;
  }).length;
  const noVisibleActionableAssignments =
    hasAssignments &&
    filteredAssignments.length > 0 &&
    visibleSelectableAssignmentIds.length === 0 &&
    importedVisibleCount > 0;
  const skippedSelectedCount = selectedAssignments.filter((assignment) => {
    const syncStatus = assignmentDisplayStates.get(assignment.externalId);

    return syncStatus?.isUnlinked || (syncStatus?.isImported && !syncStatus?.isUpdated);
  }).length;
  const importButtonLabel = preview.loading
    ? "Loading assignments..."
    : noVisibleActionableAssignments
      ? "No new assignments to import"
    : selectedCount === 0
      ? "Select assignments to import"
      : actionableCount === 0 && unlinkedPreviewCourseCount > 0
        ? "Link Subject to import"
      : actionableCount === 0
        ? "No new assignments to import"
        : newImportCount > 0 && updatedCount > 0
          ? `Import ${newImportCount} · sync ${updatedCount}`
          : newImportCount > 0
            ? `Import ${formatCountLabel(newImportCount, "assignment")}`
            : `Sync ${formatCountLabel(updatedCount, "assignment")}`;
  const importPanelSummary =
    noVisibleActionableAssignments
      ? `${formatCountLabel(importedVisibleCount, "assignment")} already imported.`
      : selectedCount === 0
      ? "Due-date assignments are selected by default."
      : actionableCount === 0 && unlinkedPreviewCourseCount > 0
        ? `Link ${formatCountLabel(
            unlinkedPreviewCourseCount,
            "class",
            "classes"
          )} to a Subject first.`
      : actionableCount === 0
        ? selectedAlreadyImportedCount > 0
          ? `${formatCountLabel(
              selectedAlreadyImportedCount,
              "assignment"
            )} already imported.`
          : "No selected assignments can be imported."
        : [
            `${formatCountLabel(selectedCount, "assignment")} selected`,
            newImportCount > 0
              ? `${formatCountLabel(newImportCount, "new assignment")}`
              : "",
            updatedCount > 0
              ? `${formatCountLabel(updatedCount, "Classroom update")}`
              : "",
            skippedSelectedCount > 0
              ? `${formatCountLabel(skippedSelectedCount, "selection")} skipped`
              : "",
          ]
            .filter(Boolean)
            .join(" · ");
  const hasMissingSubjectWarning =
    unlinkedPreviewCourseCount > 0 || unlinkedVisibleCourseIds.length > 0;

  return (
    <section className="real-classroom-assignment-preview" aria-live="polite">
      <div className="real-classroom-assignment-preview-header">
        <div>
          <strong>Preview</strong>
          <p>Select the work to turn into DayLo tasks.</p>
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
            <p>{importPanelSummary}</p>
            {skippedSelectedCount > 0 && actionableCount > 0 && (
              <small>
                {formatCountLabel(skippedSelectedCount, "selected item")} will be skipped.
              </small>
            )}
          </div>
          <button
            type="button"
            onClick={onImportAssignments}
            aria-label={importButtonLabel}
            disabled={
              selectedCount === 0 ||
              actionableCount === 0 ||
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
              onClick={() => onSelectAllAssignments(visibleSelectableAssignmentIds)}
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
            Due-date assignments are selected by default.
          </p>
        </div>
      )}

      {hasAssignments && selectedCount === 0 && !preview.error && (
        <p className="real-classroom-preview-warning">
          {noVisibleActionableAssignments
            ? "No new assignments to import in this view."
            : "Select assignments to import."}
        </p>
      )}

      {hasMissingSubjectWarning && (
        <div className="real-classroom-preview-warning real-classroom-preview-warning-action">
          <span>
            {unlinkedPreviewCourseCount > 0
              ? `Link ${formatCountLabel(
                  unlinkedPreviewCourseCount,
                  "class",
                  "classes"
                )} to a Subject before importing.`
              : `${formatCountLabel(
                  unlinkedVisibleCourseIds.length,
                  "class",
                  "classes"
                )} need Subject links.`}
          </span>
          <button
            type="button"
            onClick={() => onGoToClassSetup(firstUnlinkedCourseId)}
          >
            Go to class setup
          </button>
        </div>
      )}

      {preview.loading && <p>Reading assignments from included classes...</p>}
      {preview.error && (
        <p className="real-classroom-preview-error">{preview.error}</p>
      )}
      {preview.message && !preview.error && !preview.loading && !hasAssignments && (
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
                  const existingTask = importedClassroomTasks.get(
                    assignment.externalId
                  );
                  const syncStatus =
                    assignmentDisplayStates.get(assignment.externalId) ||
                    getClassroomAssignmentSyncStatus({
                      assignment,
                      existingTask,
                      linkedCourseIds,
                    });
                  const selectionDisabled =
                    syncStatus.isImported && !syncStatus.isUpdated;
                  const isSelected =
                    !selectionDisabled &&
                    preview.selectedAssignmentIds?.[assignment.externalId] ===
                      true;
                  const selectionLabel = selectionDisabled
                    ? "Imported"
                    : isSelected
                      ? "Selected"
                      : "Not selected";

                  return (
                    <div
                      className={`real-classroom-assignment-row ${
                        isSelected ? "is-selected" : ""
                      } ${
                        syncStatus.isImported ? "is-imported" : ""
                      } ${
                        syncStatus.isUnlinked ? "needs-subject" : ""
                      } ${
                        !syncStatus.hasDueDate ? "has-no-due-date" : ""
                      }`}
                      key={assignment.externalId}
                    >
                      <label className="real-classroom-assignment-select">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={selectionDisabled}
                          aria-label={`${assignment.title}: ${selectionLabel}`}
                          title={
                            selectionDisabled
                              ? "This assignment is already imported and up to date."
                              : undefined
                          }
                          onChange={(event) =>
                            onSelectAssignment(
                              assignment.externalId,
                              event.target.checked
                            )
                          }
                        />
                        <span>{selectionLabel}</span>
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
                  ? "This disconnects local sample mode. Imported sample tasks remain in DayLo."
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
    const subject =
      existingSubject || createSubjectFromMockCourse(course, subjects);

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
                      : "Choose a DayLo subject or leave unassigned."}
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

function QuickLinksSettings({
  quickLinksPreferences,
  setQuickLinksPreferences,
}) {
  const preferences = normalizeQuickLinksPreferences(quickLinksPreferences);
  const [customDraft, setCustomDraft] = useState({
    label: "",
    url: "",
    iconId: "globe",
  });
  const [customError, setCustomError] = useState("");
  const [openIconPicker, setOpenIconPicker] = useState(null);
  const [iconPickerPosition, setIconPickerPosition] = useState(null);
  const [powerSchoolDraft, setPowerSchoolDraft] = useState(
    preferences.links.find((link) => link.id === "powerschool")?.url || ""
  );
  const [message, setMessage] = useState("");
  const iconPickerRef = useRef(null);
  const iconPickerTriggerRef = useRef(null);
  const pinnedLinks = preferences.links
    .filter((link) => link.pinned)
    .sort((left, right) => left.pinnedOrder - right.pinnedOrder);
  const presetLinks = preferences.links.filter((link) => link.type === "preset");
  const customLinks = preferences.links.filter((link) => link.type === "custom");
  const aiPresetIds = quickLinkPresets
    .filter((preset) => preset.aiAssistant)
    .map((preset) => preset.id);
  const activeIconPickerLink = openIconPicker
    ? openIconPicker.linkId === "__custom-draft"
      ? {
          id: "__custom-draft",
          label: customDraft.label || "Custom website",
          iconId: customDraft.iconId || "globe",
          defaultIconId: "globe",
          type: "custom",
        }
      : preferences.links.find((link) => link.id === openIconPicker.linkId)
    : null;

  useEffect(() => {
    setPowerSchoolDraft(
      preferences.links.find((link) => link.id === "powerschool")?.url || ""
    );
  }, [quickLinksPreferences]);

  useLayoutEffect(() => {
    if (!openIconPicker) return undefined;

    const frameId = requestAnimationFrame(() => {
      updateIconPickerPosition();
      const selectedOption = iconPickerRef.current?.querySelector(
        '[role="menuitemradio"][aria-checked="true"]'
      );
      const firstOption = iconPickerRef.current?.querySelector(
        '[role="menuitemradio"]'
      );
      (selectedOption || firstOption)?.focus();
    });

    return () => cancelAnimationFrame(frameId);
  }, [openIconPicker]);

  useEffect(() => {
    if (!openIconPicker) return undefined;

    let frameId = 0;

    function closeIconPicker(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        dismissIconPicker(true);
        return;
      }

      if (
        event.type === "pointerdown" &&
        !iconPickerRef.current?.contains(event.target) &&
        !iconPickerTriggerRef.current?.contains(event.target)
      ) {
        dismissIconPicker(false);
      }
    }

    function schedulePositionUpdate() {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updateIconPickerPosition);
    }

    document.addEventListener("pointerdown", closeIconPicker);
    document.addEventListener("keydown", closeIconPicker);
    window.addEventListener("resize", schedulePositionUpdate);
    window.addEventListener("scroll", schedulePositionUpdate, true);
    window.visualViewport?.addEventListener("resize", schedulePositionUpdate);
    window.visualViewport?.addEventListener("scroll", schedulePositionUpdate);

    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener("pointerdown", closeIconPicker);
      document.removeEventListener("keydown", closeIconPicker);
      window.removeEventListener("resize", schedulePositionUpdate);
      window.removeEventListener("scroll", schedulePositionUpdate, true);
      window.visualViewport?.removeEventListener(
        "resize",
        schedulePositionUpdate
      );
      window.visualViewport?.removeEventListener(
        "scroll",
        schedulePositionUpdate
      );
    };
  }, [openIconPicker]);

  function getIconPickerPosition(triggerElement, pickerElement = null) {
    if (!triggerElement || typeof window === "undefined") return null;

    const viewportMargin = 12;
    const triggerGap = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const triggerRect = triggerElement.getBoundingClientRect();
    const width = Math.min(340, viewportWidth - viewportMargin * 2);
    const estimatedHeight = Math.min(
      pickerElement?.offsetHeight || 340,
      viewportHeight - viewportMargin * 2
    );
    const spaceBelow =
      viewportHeight - viewportMargin - triggerRect.bottom - triggerGap;
    const spaceAbove = triggerRect.top - viewportMargin - triggerGap;
    const placement =
      spaceBelow >= Math.min(estimatedHeight, 240) || spaceBelow >= spaceAbove
        ? "below"
        : "above";
    const availableHeight = Math.max(
      0,
      Math.min(
        360,
        placement === "below" ? spaceBelow : spaceAbove,
        viewportHeight - viewportMargin * 2
      )
    );
    const measuredHeight = Math.min(estimatedHeight, availableHeight);
    const left = Math.min(
      Math.max(triggerRect.left, viewportMargin),
      viewportWidth - viewportMargin - width
    );
    const top =
      placement === "below"
        ? triggerRect.bottom + triggerGap
        : Math.max(viewportMargin, triggerRect.top - triggerGap - measuredHeight);

    return { top, left, width, maxHeight: availableHeight, placement };
  }

  function updateIconPickerPosition() {
    const nextPosition = getIconPickerPosition(
      iconPickerTriggerRef.current,
      iconPickerRef.current
    );

    if (nextPosition) setIconPickerPosition(nextPosition);
  }

  function dismissIconPicker(restoreFocus = false) {
    const triggerElement = iconPickerTriggerRef.current;

    setOpenIconPicker(null);
    setIconPickerPosition(null);

    if (restoreFocus) {
      requestAnimationFrame(() => triggerElement?.focus());
    }
  }

  function toggleIconPicker(pickerId, linkId, triggerElement) {
    if (openIconPicker?.pickerId === pickerId) {
      dismissIconPicker(true);
      return;
    }

    iconPickerTriggerRef.current = triggerElement;
    setIconPickerPosition(getIconPickerPosition(triggerElement));
    setOpenIconPicker({ pickerId, linkId });
  }

  function handleIconPickerKeyDown(event) {
    const navigationKeys = [
      "ArrowDown",
      "ArrowRight",
      "ArrowUp",
      "ArrowLeft",
      "Home",
      "End",
    ];

    if (!navigationKeys.includes(event.key)) {
      return;
    }

    const options = Array.from(
      event.currentTarget.querySelectorAll('[role="menuitemradio"]')
    );

    if (options.length === 0) return;

    const currentIndex = options.indexOf(document.activeElement);
    let nextIndex = currentIndex;

    if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else if (["ArrowDown", "ArrowRight"].includes(event.key)) {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % options.length;
    } else {
      nextIndex = currentIndex <= 0 ? options.length - 1 : currentIndex - 1;
    }

    event.preventDefault();
    options[nextIndex]?.focus();
  }

  function updatePreferences(updater) {
    setQuickLinksPreferences((currentPreferences) =>
      normalizeQuickLinksPreferences(
        updater(normalizeQuickLinksPreferences(currentPreferences))
      )
    );
  }

  function updateLink(linkId, updates) {
    updatePreferences((currentPreferences) => ({
      ...currentPreferences,
      links: currentPreferences.links.map((link) =>
        link.id === linkId ? { ...link, ...updates } : link
      ),
    }));
  }

  function updateLinkIcon(linkId, iconId) {
    if (linkId === "__custom-draft") {
      setCustomDraft((currentDraft) => ({ ...currentDraft, iconId }));
      dismissIconPicker(true);
      return;
    }

    updateLink(linkId, { iconId });
    dismissIconPicker(true);
  }

  function pinLink(linkId) {
    const link = preferences.links.find((nextLink) => nextLink.id === linkId);

    if (!link?.url) {
      setMessage("Add a website address before pinning this link.");
      return;
    }

    if (!link.pinned && pinnedLinks.length >= QUICK_LINK_PIN_LIMIT) {
      setMessage(`You can pin up to ${QUICK_LINK_PIN_LIMIT} quick links.`);
      return;
    }

    updatePreferences((currentPreferences) => {
      const currentPinned = currentPreferences.links
        .filter((nextLink) => nextLink.pinned)
        .sort((left, right) => left.pinnedOrder - right.pinnedOrder);

      return {
        ...currentPreferences,
        links: currentPreferences.links.map((nextLink) =>
          nextLink.id === linkId
            ? {
                ...nextLink,
                pinned: true,
                pinnedOrder: currentPinned.length,
              }
            : nextLink
        ),
      };
    });
    setMessage("");
  }

  function unpinLink(linkId) {
    updatePreferences((currentPreferences) => {
      const nextLinks = currentPreferences.links.map((link) =>
        link.id === linkId ? { ...link, pinned: false, pinnedOrder: null } : link
      );
      const pinnedIds = nextLinks
        .filter((link) => link.pinned)
        .sort((left, right) => left.pinnedOrder - right.pinnedOrder)
        .map((link) => link.id);

      return {
        ...currentPreferences,
        links: nextLinks.map((link) => {
          const pinnedOrder = pinnedIds.indexOf(link.id);
          return pinnedOrder >= 0 ? { ...link, pinnedOrder } : link;
        }),
      };
    });
    setMessage("");
  }

  function movePinnedLink(linkId, direction) {
    const currentIndex = pinnedLinks.findIndex((link) => link.id === linkId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= pinnedLinks.length) {
      return;
    }

    const nextPinnedIds = pinnedLinks.map((link) => link.id);
    const [movedId] = nextPinnedIds.splice(currentIndex, 1);
    nextPinnedIds.splice(nextIndex, 0, movedId);

    updatePreferences((currentPreferences) => ({
      ...currentPreferences,
      links: currentPreferences.links.map((link) => {
        const pinnedOrder = nextPinnedIds.indexOf(link.id);
        return pinnedOrder >= 0 ? { ...link, pinnedOrder } : link;
      }),
    }));
  }

  function chooseAiAssistant(nextAssistantId) {
    const selectedLink = preferences.links.find(
      (link) => link.id === nextAssistantId
    );
    const currentlyPinnedAi = pinnedLinks.find((link) =>
      aiPresetIds.includes(link.id)
    );
    const canPinSelected =
      selectedLink?.pinned ||
      Boolean(currentlyPinnedAi) ||
      pinnedLinks.length < QUICK_LINK_PIN_LIMIT;

    updatePreferences((currentPreferences) => ({
      ...currentPreferences,
      aiAssistantPreference: nextAssistantId,
      links: currentPreferences.links.map((link) => {
        if (!aiPresetIds.includes(link.id)) return link;

        if (link.id === nextAssistantId && canPinSelected) {
          return {
            ...link,
            pinned: true,
            pinnedOrder: currentlyPinnedAi?.pinnedOrder ?? pinnedLinks.length,
          };
        }

        return { ...link, pinned: false, pinnedOrder: null };
      }),
    }));

    setMessage(
      canPinSelected
        ? ""
        : "Saved your AI shortcut preference. Unpin another link to show it in the sidebar."
    );
  }

  function savePowerSchoolUrl() {
    const normalizedUrl = normalizeQuickLinkUrl(powerSchoolDraft);

    if (!normalizedUrl.ok) {
      setMessage(normalizedUrl.error);
      return;
    }

    updateLink("powerschool", { url: normalizedUrl.url });
    setMessage("PowerSchool URL saved.");
  }

  function addCustomLink(event) {
    event.preventDefault();
    const label = customDraft.label.trim();
    const normalizedUrl = normalizeQuickLinkUrl(customDraft.url);

    if (!label) {
      setCustomError("Enter a name.");
      return;
    }

    if (!normalizedUrl.ok) {
      setCustomError(normalizedUrl.error);
      return;
    }

    if (
      preferences.links.some(
        (link) => link.url.toLowerCase() === normalizedUrl.url.toLowerCase()
      )
    ) {
      setCustomError("That link is already listed.");
      return;
    }

    updatePreferences((currentPreferences) => ({
      ...currentPreferences,
      links: [
        ...currentPreferences.links,
        {
          id: `custom-${Date.now()}`,
          label,
          url: normalizedUrl.url,
          iconId: customDraft.iconId || "globe",
          defaultIconId: "globe",
          type: "custom",
          pinned: false,
          pinnedOrder: null,
        },
      ],
    }));
    setCustomDraft({ label: "", url: "", iconId: "globe" });
    setCustomError("");
    setMessage("Custom link added.");
  }

  function removeCustomLink(linkId) {
    updatePreferences((currentPreferences) => ({
      ...currentPreferences,
      links: currentPreferences.links.filter((link) => link.id !== linkId),
    }));
    setMessage("");
  }

  function renderIconPicker(link, pickerId) {
    const pickerOpen = openIconPicker?.pickerId === pickerId;

    return (
      <div className="quick-link-icon-picker-wrap">
        <button
          type="button"
          className="quick-link-icon-button"
          aria-label={`Choose icon for ${link.label}`}
          aria-haspopup="menu"
          aria-expanded={pickerOpen}
          aria-controls={
            pickerOpen ? `quick-link-icon-picker-${pickerId}` : undefined
          }
          onClick={(event) =>
            toggleIconPicker(pickerId, link.id, event.currentTarget)
          }
        >
          <QuickLinkIcon iconId={link.iconId} />
        </button>
      </div>
    );
  }

  const iconPickerPopover =
    openIconPicker &&
    activeIconPickerLink &&
    iconPickerPosition &&
    typeof document !== "undefined"
      ? createPortal(
          <div
            id={`quick-link-icon-picker-${openIconPicker.pickerId}`}
            className="quick-link-icon-picker"
            ref={iconPickerRef}
            role="menu"
            aria-label={`Icon choices for ${activeIconPickerLink.label}`}
            data-placement={iconPickerPosition.placement}
            style={{
              top: `${iconPickerPosition.top}px`,
              left: `${iconPickerPosition.left}px`,
              width: `${iconPickerPosition.width}px`,
              maxHeight: `${iconPickerPosition.maxHeight}px`,
            }}
            onKeyDown={handleIconPickerKeyDown}
          >
            <div className="quick-link-icon-grid">
              {quickLinkIconCatalog.map((icon) => (
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={activeIconPickerLink.iconId === icon.id}
                  aria-label={icon.label}
                  className={
                    activeIconPickerLink.iconId === icon.id ? "active" : ""
                  }
                  key={icon.id}
                  title={icon.label}
                  onClick={() =>
                    updateLinkIcon(activeIconPickerLink.id, icon.id)
                  }
                >
                  <QuickLinkIcon iconId={icon.id} />
                  <span>{icon.label}</span>
                </button>
              ))}
            </div>

            {activeIconPickerLink.type === "preset" && (
              <button
                type="button"
                role="menuitem"
                className="quick-link-icon-default"
                onClick={() =>
                  updateLinkIcon(
                    activeIconPickerLink.id,
                    activeIconPickerLink.defaultIconId || "globe"
                  )
                }
              >
                Restore default icon
              </button>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="quick-links-settings">
      <section className="panel quick-links-panel">
        <div className="quick-links-panel-intro">
          <div>
            <h3>Sidebar shortcuts</h3>
            <p>
              Pin up to {QUICK_LINK_PIN_LIMIT} school websites. Links open in a
              new tab.
            </p>
          </div>
          <span>{pinnedLinks.length}/{QUICK_LINK_PIN_LIMIT} pinned</span>
        </div>

        {message && <p className="quick-links-message">{message}</p>}

        <section className="quick-links-section">
          <div className="quick-links-section-heading">
            <h4>Pinned links</h4>
            <p>These appear in the sidebar in this order.</p>
          </div>

          {pinnedLinks.length > 0 ? (
            <div className="quick-links-pinned-list">
              {pinnedLinks.map((link, index) => (
                <div className="quick-link-row" key={link.id}>
                  {renderIconPicker(link, `pinned-${link.id}`)}
                  <label className="quick-link-label-field">
                    <span className="quick-link-label-caption">
                      Display name
                    </span>
                    <input
                      value={link.label}
                      title={link.label}
                      aria-label={`Display name for ${link.label}`}
                      onChange={(event) =>
                        updateLink(link.id, { label: event.target.value })
                      }
                    />
                  </label>
                  <div className="quick-link-row-actions">
                    <button
                      type="button"
                      className="small-button secondary"
                      disabled={index === 0}
                      onClick={() => movePinnedLink(link.id, -1)}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="small-button secondary"
                      disabled={index === pinnedLinks.length - 1}
                      onClick={() => movePinnedLink(link.id, 1)}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="small-button secondary"
                      onClick={() => unpinLink(link.id)}
                    >
                      Unpin
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="quick-links-empty">No quick links pinned yet.</p>
          )}
        </section>

        <section className="quick-links-section">
          <div className="quick-links-section-heading">
            <h4>Available links</h4>
            <p>Pick the school tools you use most.</p>
          </div>

          <div className="quick-links-preset-grid">
            {presetLinks.map((link) => {
              const isPowerSchool = link.id === "powerschool";
              const canPin = Boolean(link.url);

              return (
                <div className="quick-link-preset-card" key={link.id}>
                  <div className="quick-link-preset-title">
                    {renderIconPicker(link, `preset-${link.id}`)}
                    <div>
                      <strong>{link.label}</strong>
                      <small>
                        {link.pinned ? "Pinned" : canPin ? "Available" : "Add URL"}
                      </small>
                    </div>
                  </div>

                  {isPowerSchool && (
                    <div className="quick-link-powerschool-field">
                      <input
                        type="url"
                        value={powerSchoolDraft}
                        placeholder="https://your-school.powerschool.com"
                        onChange={(event) =>
                          setPowerSchoolDraft(event.target.value)
                        }
                      />
                      <button
                        type="button"
                        className="small-button secondary"
                        onClick={savePowerSchoolUrl}
                      >
                        Save URL
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    className={
                      link.pinned
                        ? "small-button secondary"
                        : "small-button quick-link-pin-button"
                    }
                    disabled={!link.pinned && !canPin}
                    onClick={() =>
                      link.pinned ? unpinLink(link.id) : pinLink(link.id)
                    }
                  >
                    {link.pinned ? "Unpin" : "Pin"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="quick-links-section">
          <div className="quick-links-section-heading">
            <h4>AI shortcut</h4>
            <p>This opens an external assistant. It is not DayLo AI.</p>
          </div>
          <div
            className="quick-links-ai-choice"
            role="group"
            aria-label="AI assistant shortcut"
          >
            {quickLinkPresets
              .filter((preset) => preset.aiAssistant)
              .map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={
                    preferences.aiAssistantPreference === preset.id
                      ? "active"
                      : ""
                  }
                  aria-pressed={preferences.aiAssistantPreference === preset.id}
                  onClick={() => chooseAiAssistant(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
          </div>
        </section>

        <section className="quick-links-section">
          <div className="quick-links-section-heading">
            <h4>Custom website</h4>
            <p>Add one school site without turning this into a bookmarks page.</p>
          </div>

          <form className="quick-links-custom-form" onSubmit={addCustomLink}>
            <div className="quick-link-custom-icon-field">
              <span>Icon</span>
              <div className="quick-link-custom-icon-control">
                {renderIconPicker(
                  {
                    id: "__custom-draft",
                    label: customDraft.label || "Custom website",
                    iconId: customDraft.iconId || "globe",
                    defaultIconId: "globe",
                    type: "custom",
                  },
                  "custom-draft"
                )}
              </div>
            </div>
            <label>
              <span>Name</span>
              <input
                value={customDraft.label}
                onChange={(event) =>
                  setCustomDraft({ ...customDraft, label: event.target.value })
                }
                placeholder="Library"
              />
            </label>
            <label>
              <span>Website address</span>
              <input
                value={customDraft.url}
                onChange={(event) =>
                  setCustomDraft({ ...customDraft, url: event.target.value })
                }
                placeholder="library.school.edu"
              />
            </label>
            <button className="primary-button" type="submit">
              Add website
            </button>
          </form>

          {customError && (
            <p className="quick-links-error" role="alert">
              {customError}
            </p>
          )}

          {customLinks.length > 0 && (
            <div className="quick-links-custom-list">
              {customLinks.map((link) => (
                <div className="quick-link-row" key={link.id}>
                  {renderIconPicker(link, `custom-${link.id}`)}
                  <span className="quick-link-custom-copy">
                    <strong>{link.label}</strong>
                    <small>{link.url}</small>
                  </span>
                  <div className="quick-link-row-actions">
                    <button
                      type="button"
                      className="small-button secondary"
                      onClick={() =>
                        link.pinned ? unpinLink(link.id) : pinLink(link.id)
                      }
                    >
                      {link.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button
                      type="button"
                      className="small-button secondary"
                      onClick={() => removeCustomLink(link.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
      </div>
      {iconPickerPopover}
    </>
  );
}

function getHelpTourStatusClassName(status) {
  return `help-tour-status-${status.toLocaleLowerCase().replace(/\s+/g, "-")}`;
}

function HelpSettings({
  theme,
  classroomConnected,
  calendarConnected,
  smartPlannerStatus,
  onReplayTour,
}) {
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [supportMode, setSupportMode] = useState(null);
  const [tourProgress, setTourProgress] = useState(loadGuidedTourProgress);
  const [resetConfirmationOpen, setResetConfirmationOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const pageHeadingRef = useRef(null);
  const resetDialogRef = useRef(null);
  const resetLauncherRef = useRef(null);
  const selectedTopic = getHelpTopic(selectedTopicId);
  const gettingStartedTour = getGuidedTourDefinition("getting-started");
  const gettingStartedStatus = getGuidedTourDisplayStatus(
    gettingStartedTour,
    tourProgress
  );
  const gettingStartedActionLabel = getGuidedTourActionLabel(
    gettingStartedStatus
  );

  useEffect(() => {
    if (selectedTopic || supportMode) {
      pageHeadingRef.current?.focus();
    }
  }, [selectedTopic, supportMode]);

  useEffect(() => {
    if (!resetConfirmationOpen) return undefined;

    const dialog = resetDialogRef.current;
    const focusable = dialog?.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusable?.[0];
    const lastFocusable = focusable?.[focusable.length - 1];
    firstFocusable?.focus();

    function handleDialogKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setResetConfirmationOpen(false);
        requestAnimationFrame(() => resetLauncherRef.current?.focus());
        return;
      }

      if (event.key !== "Tab" || !firstFocusable || !lastFocusable) return;

      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKeyDown);
    return () => document.removeEventListener("keydown", handleDialogKeyDown);
  }, [resetConfirmationOpen]);

  function closeResetConfirmation() {
    setResetConfirmationOpen(false);
    requestAnimationFrame(() => resetLauncherRef.current?.focus());
  }

  function confirmTourReset() {
    resetGuidedTourProgress();
    setTourProgress(loadGuidedTourProgress());
    setNotice(
      "Tour progress reset. Getting started can appear again on a future eligible visit."
    );
    closeResetConfirmation();
  }

  function replayTour(tourId, starterElement) {
    if (!tourId || !onReplayTour) return;
    onReplayTour(tourId, starterElement);
  }

  if (selectedTopic) {
    const topicTour = selectedTopic.tourId
      ? getGuidedTourDefinition(selectedTopic.tourId)
      : null;
    const topicStatus = topicTour
      ? getGuidedTourDisplayStatus(topicTour, tourProgress)
      : "Not started";
    const topicTourActionLabel = getGuidedTourActionLabel(topicStatus);

    return (
      <div className="help-settings help-guide-page">
        <button
          type="button"
          className="settings-back-button"
          onClick={() => setSelectedTopicId(null)}
        >
          ← Back to Help & tours
        </button>

        <article className="panel help-guide">
          <header className="help-guide-header">
            <div>
              <p className="settings-group-label">Guide</p>
              <h2 ref={pageHeadingRef} tabIndex="-1">
                {selectedTopic.title}
              </h2>
              <p>{selectedTopic.summary}</p>
            </div>
            {topicTour && (
              <button
                type="button"
                className="help-tour-action"
                aria-label={`${topicTourActionLabel}: ${selectedTopic.title}`}
                onClick={(event) =>
                  replayTour(selectedTopic.tourId, event.currentTarget)
                }
              >
                {topicTourActionLabel}
              </button>
            )}
          </header>

          <div className="help-guide-sections">
            {selectedTopic.sections.map((section) => (
              <section className="help-guide-section" key={section.title}>
                <h3>{section.title}</h3>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets && (
                  <ul>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </article>
      </div>
    );
  }

  if (supportMode) {
    return (
      <HelpSupportForm
        mode={supportMode}
        theme={theme}
        classroomConnected={classroomConnected}
        calendarConnected={calendarConnected}
        smartPlannerStatus={smartPlannerStatus}
        headingRef={pageHeadingRef}
        onBack={() => setSupportMode(null)}
      />
    );
  }

  return (
    <div className="help-settings">
      <section className="panel help-tour-summary">
        <div className="help-tour-summary-copy">
          <span
            className={`help-tour-status ${getHelpTourStatusClassName(
              gettingStartedStatus
            )}`}
            aria-label={`Tour status: ${gettingStartedStatus}`}
          >
            {gettingStartedStatus}
          </span>
          <div>
            <p className="settings-group-label">Getting-started tour</p>
            <h2>Start with the essentials</h2>
            <p>
              A short walkthrough of tasks, Subjects, Calendar and planning.
            </p>
          </div>
        </div>
        <div className="help-tour-summary-actions">
          <button
            type="button"
            className="help-summary-tour-action"
            aria-label={`${gettingStartedActionLabel}: Getting started`}
            onClick={(event) =>
              replayTour("getting-started", event.currentTarget)
            }
          >
            {gettingStartedActionLabel}
          </button>
          <button
            ref={resetLauncherRef}
            type="button"
            className="help-quiet-action"
            onClick={() => {
              setNotice("");
              setResetConfirmationOpen(true);
            }}
          >
            Reset all tour progress
          </button>
        </div>
      </section>

      {notice && (
        <p className="help-notice" role="status">
          {notice}
        </p>
      )}

      <section aria-labelledby="help-guides-title">
        <div className="help-section-heading">
          <div>
            <p className="settings-group-label">Guides</p>
            <h2 id="help-guides-title">Learn DayLo</h2>
          </div>
          <p>Short, practical help for each part of your workspace.</p>
        </div>

        <div className="help-topic-grid">
          {helpTopics.map((topic) => {
            const topicTour = topic.tourId
              ? getGuidedTourDefinition(topic.tourId)
              : null;
            const topicStatus = topicTour
              ? getGuidedTourDisplayStatus(topicTour, tourProgress)
              : "Not started";
            const topicTourActionLabel = getGuidedTourActionLabel(topicStatus);

            return (
              <article className="help-topic-card" key={topic.id}>
                <div className="help-topic-card-copy">
                  <div className="help-topic-title-row">
                    <h3>{topic.title}</h3>
                    <span
                      className={`help-tour-status ${getHelpTourStatusClassName(
                        topicStatus
                      )}`}
                      aria-label={`Tour status: ${topicStatus}`}
                    >
                      {topicStatus}
                    </span>
                  </div>
                  <p>{topic.summary}</p>
                </div>
                <div className="help-topic-actions">
                  <button
                    type="button"
                    className="help-guide-action"
                    aria-label={`Read ${topic.title} guide`}
                    onClick={() => setSelectedTopicId(topic.id)}
                  >
                    Read guide
                  </button>
                  <button
                    type="button"
                    className="help-tour-action"
                    aria-label={`${topicTourActionLabel}: ${topic.title}`}
                    onClick={(event) =>
                      replayTour(topic.tourId, event.currentTarget)
                    }
                  >
                    {topicTourActionLabel}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel help-support-card">
        <div>
          <p className="settings-group-label">Feedback & problems</p>
          <h2>Tell us what is confusing, broken or missing.</h2>
          <p>
            Nothing is sent automatically. You can copy your message or open
            your email app.
          </p>
        </div>
        <div className="help-support-card-actions">
          <button
            type="button"
            className="help-feedback-primary"
            onClick={() => setSupportMode("feedback")}
          >
            Send feedback
          </button>
          <button
            type="button"
            className="help-feedback-secondary"
            onClick={() => setSupportMode("problem")}
          >
            Report a problem
          </button>
        </div>
      </section>

      {resetConfirmationOpen && (
        <div
          className="data-confirmation-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeResetConfirmation();
          }}
        >
          <section
            ref={resetDialogRef}
            className="data-confirmation"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="help-reset-title"
            aria-describedby="help-reset-description"
          >
            <div>
              <h3 id="help-reset-title">Reset all tour progress?</h3>
              <p id="help-reset-description">
                This clears only guided-tour progress. Tasks, plans, Subjects,
                themes and connections stay unchanged.
              </p>
            </div>
            <div className="data-confirmation-actions">
              <button
                type="button"
                className="data-cancel-button"
                onClick={closeResetConfirmation}
              >
                Cancel
              </button>
              <button
                type="button"
                className="data-confirm-button"
                onClick={confirmTourReset}
              >
                Reset tour progress
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function HelpSupportForm({
  mode,
  theme,
  classroomConnected,
  calendarConnected,
  smartPlannerStatus,
  headingRef,
  onBack,
}) {
  const [draft, setDraft] = useState({
    feedbackType: "Idea",
    message: "",
    whatHappened: "",
    expected: "",
    steps: "",
    replyEmail: "",
  });
  const [includeDiagnostics, setIncludeDiagnostics] = useState(
    mode === "problem"
  );
  const [validationMessage, setValidationMessage] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const plannerAllowance = Number.isInteger(
    smartPlannerStatus?.remainingGenerations
  )
    ? smartPlannerStatus.remainingGenerations
    : undefined;
  const diagnostics = buildSafeDiagnosticDetails({
    appVersion: STUDENT_HUB_BUILD_ID,
    currentPage: "Settings / Help & tours",
    userAgent:
      typeof navigator === "undefined" ? "" : navigator.userAgent,
    viewportWidth: typeof window === "undefined" ? 0 : window.innerWidth,
    viewportHeight: typeof window === "undefined" ? 0 : window.innerHeight,
    theme,
    online: typeof navigator === "undefined" ? undefined : navigator.onLine,
    classroomConnected,
    calendarConnected,
    smartPlannerStatus: smartPlannerStatus?.status,
    remainingAllowance: plannerAllowance,
  });
  const supportMessage = buildSupportMessage({
    mode,
    draft,
    diagnostics,
    includeDiagnostics: mode === "problem" && includeDiagnostics,
  });
  const isProblem = mode === "problem";

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setValidationMessage("");
    setCopyStatus("");
  }

  function validate() {
    const message = validateSupportDraft(mode, draft);
    setValidationMessage(message);
    return !message;
  }

  async function copyMessage() {
    if (!validate()) return;

    const copied = await copySupportMessage(supportMessage);
    setCopyStatus(
      copied
        ? isProblem
          ? "Problem report copied."
          : "Feedback message copied."
        : "Could not copy automatically. Select the message and copy it manually."
    );
  }

  async function copyDiagnostics() {
    const copied = await copySupportMessage(diagnostics);
    setCopyStatus(
      copied
        ? "Diagnostic details copied."
        : "Could not copy diagnostic details automatically."
    );
  }

  function openEmailApp() {
    if (!validate()) return;

    const mailto = buildSupportMailto({
      supportEmail: STUDENT_HUB_SUPPORT_EMAIL,
      mode,
      draft,
      diagnostics,
      includeDiagnostics: isProblem && includeDiagnostics,
    });

    if (mailto) window.location.href = mailto;
  }

  return (
    <div className="help-settings help-support-page">
      <button type="button" className="settings-back-button" onClick={onBack}>
        ← Back to Help & tours
      </button>

      <section className="panel help-support-form-panel">
        <header className="help-support-form-header">
          <p className="settings-group-label">Feedback & problems</p>
          <h2 ref={headingRef} tabIndex="-1">
            {isProblem ? "Report a problem" : "Send feedback"}
          </h2>
          <p>
            {isProblem
              ? "Describe what went wrong. You choose what to copy or email."
              : "Share an idea or tell us what could be clearer."}
          </p>
        </header>

        <form
          className="help-support-form"
          onSubmit={(event) => event.preventDefault()}
        >
          {!isProblem ? (
            <>
              <label>
                <span>Feedback type</span>
                <select
                  value={draft.feedbackType}
                  onChange={(event) =>
                    updateDraft("feedbackType", event.target.value)
                  }
                >
                  <option>Idea</option>
                  <option>Confusing experience</option>
                  <option>General feedback</option>
                </select>
              </label>
              <label>
                <span>Message</span>
                <textarea
                  value={draft.message}
                  maxLength={SUPPORT_FIELD_LIMITS.feedbackMessage}
                  rows="7"
                  onChange={(event) =>
                    updateDraft("message", event.target.value)
                  }
                  required
                />
                <small>
                  {draft.message.length}/{SUPPORT_FIELD_LIMITS.feedbackMessage}
                </small>
              </label>
            </>
          ) : (
            <>
              <label>
                <span>What happened?</span>
                <textarea
                  value={draft.whatHappened}
                  maxLength={SUPPORT_FIELD_LIMITS.problemDescription}
                  rows="5"
                  onChange={(event) =>
                    updateDraft("whatHappened", event.target.value)
                  }
                  required
                />
              </label>
              <label>
                <span>What did you expect?</span>
                <textarea
                  value={draft.expected}
                  maxLength={SUPPORT_FIELD_LIMITS.expectedOutcome}
                  rows="4"
                  onChange={(event) =>
                    updateDraft("expected", event.target.value)
                  }
                />
              </label>
              <label>
                <span>Steps to reproduce</span>
                <textarea
                  value={draft.steps}
                  maxLength={SUPPORT_FIELD_LIMITS.reproductionSteps}
                  rows="5"
                  onChange={(event) =>
                    updateDraft("steps", event.target.value)
                  }
                />
              </label>
            </>
          )}

          <label>
            <span>Reply email <small>(optional)</small></span>
            <input
              type="email"
              value={draft.replyEmail}
              maxLength={SUPPORT_FIELD_LIMITS.replyEmail}
              autoComplete="email"
              onChange={(event) =>
                updateDraft("replyEmail", event.target.value)
              }
            />
          </label>

          {isProblem && (
            <section className="help-diagnostics">
              <label className="help-diagnostics-toggle">
                <input
                  type="checkbox"
                  checked={includeDiagnostics}
                  onChange={(event) =>
                    setIncludeDiagnostics(event.target.checked)
                  }
                />
                <span>Include diagnostic details</span>
              </label>
              {includeDiagnostics && (
                <>
                  <p>Only the information shown below will be included.</p>
                  <pre
                    tabIndex="0"
                    aria-label="Diagnostic details preview"
                  >
                    {diagnostics}
                  </pre>
                  <button
                    type="button"
                    className="small-button secondary help-copy-diagnostics"
                    onClick={copyDiagnostics}
                  >
                    Copy diagnostic details
                  </button>
                </>
              )}
            </section>
          )}

          {validationMessage && (
            <p className="help-form-message error" role="alert">
              {validationMessage}
            </p>
          )}
          <p className="help-form-message" aria-live="polite">
            {copyStatus}
          </p>

          {!STUDENT_HUB_SUPPORT_EMAIL && (
            <p className="help-email-unavailable">
              Email feedback is not configured yet. You can still copy your
              message.
            </p>
          )}

          <div className="help-support-actions">
            <button
              type="button"
              className="small-button secondary"
              onClick={copyMessage}
            >
              {isProblem ? "Copy report" : "Copy message"}
            </button>
            {STUDENT_HUB_SUPPORT_EMAIL && (
              <button
                type="button"
                className="primary-button"
                onClick={openEmailApp}
              >
                Open email app
              </button>
            )}
          </div>
        </form>
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
  const setupOptions = [
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
    {
      id: "appearance",
      title: "Reset appearance",
      description: "Restore theme colours, logo appearance, background, and density.",
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
  ];
  const dataResetOptions = [
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
      id: "all",
      title: "Clear all local app data",
      description: "Return DayLo to a clean first-time state.",
      confirmation:
        "This removes locally stored DayLo data from this browser, including tasks and completed history, Subjects, Today’s Plan, your local profile, appearance preferences, onboarding state, and locally stored integration preferences. It does not delete data from Google Classroom, Google Calendar, your Google account, or any external service.",
      confirmLabel: "Clear all data",
      actionLabel: "Clear all data",
      action: clearAllStudentHubData,
      destructive: true,
      strongestDestructive: true,
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

  function renderResetOption(option) {
    return (
      <div
        className={`data-reset-row ${option.destructive ? "destructive" : ""} ${
          option.strongestDestructive ? "strongest-destructive" : ""
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
            (option.id === "onboarding" ? "Restart" : "Reset")}
        </button>
      </div>
    );
  }

  return (
    <div className="data-settings">
      <section className="panel data-panel">
        <div className="data-panel-intro">
          <div>
            <p className="settings-group-label">Stored on this device</p>
            <h3>Local workspace data</h3>
            <p>
              These controls only affect DayLo data saved in this
              browser. Other site data is never touched.
            </p>
          </div>
          <span>Local only</span>
        </div>

        <div className="data-reset-list">
          {setupOptions.map(renderResetOption)}
          <div className="data-reset-section-heading">
            <h3>Data resets</h3>
          </div>
          {dataResetOptions.map(renderResetOption)}
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
  const [subjectDraft, setSubjectDraft] = useState(() =>
    createSubjectDraft("IB", subjects)
  );
  const [subjectColourManuallySelected, setSubjectColourManuallySelected] =
    useState(false);
  const [subjectFormError, setSubjectFormError] = useState("");

  function openAddSubject() {
    setEditingSubjectId(null);
    setSubjectDraft(createSubjectDraft("IB", subjects));
    setSubjectColourManuallySelected(false);
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
    setSubjectColourManuallySelected(true);
    setSubjectFormError("");
    setShowSubjectForm(true);
  }

  function closeSubjectForm() {
    setShowSubjectForm(false);
    setEditingSubjectId(null);
    setSubjectColourManuallySelected(false);
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
                  onChange={(event) => {
                    const name = event.target.value;

                    setSubjectDraft((currentDraft) => ({
                      ...currentDraft,
                      name,
                      colour: suggestSubjectDraftColour({
                        subjectName: name,
                        currentColour: currentDraft.colour,
                        existingSubjects: subjects,
                        manuallySelected: subjectColourManuallySelected,
                      }),
                    }));
                  }}
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
                    onChange={(event) => {
                      setSubjectColourManuallySelected(true);
                      setSubjectDraft({
                        ...subjectDraft,
                        colour: event.target.value,
                      });
                    }}
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
