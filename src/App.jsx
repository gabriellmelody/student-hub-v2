import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./App.css";
import {
  AccountMenu,
  MobileBottomNav,
  MobileMoreSheet,
  MobileTopBar,
  NavButton,
  QuickLinksNav,
  RightRail,
} from "./components/AppChrome.jsx";
import SmartPlannerModal from "./components/SmartPlannerModal.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import OnboardingFlow from "./pages/Onboarding.jsx";
import PlanPage from "./pages/PlanPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import SubjectsPage from "./pages/SubjectsPage.jsx";
import TasksPage from "./pages/TasksPage.jsx";
import {
  COMPLETED_HISTORY_STORAGE_KEY,
  COMPLETED_TASK_RETENTION_MS,
  DEFAULT_THEME_COLORS,
  themeColorPalettes,
  STUDENT_HUB_STORAGE_KEYS,
  WIDGET_CONFIG_STORAGE_KEY,
  TODAY_PLAN_STORAGE_KEY,
  normalizeThemeColors,
  loadThemeColors,
  saveThemeColors,
  deriveThemeBackground,
  mixColors,
  getContrastText,
  getReadableAccent,
  colorToRgba,
  loadTasks,
  loadWidgetConfig,
  loadSubjects,
  loadStudentProfile,
  getDaysLeft,
  hasRealDueDate,
  formatTime,
  getTaskTip,
  sortTasksForDisplay,
  cleanPlanSequence,
  recalculatePlanTimes,
  getDefaultWidgetConfig,
  getWidgetsForArea,
  loadSavedPlanSnapshot,
  isSavedPlanForToday,
  restoreSavedPlanBlocks,
  saveTodayPlanSnapshot,
  loadQuickLinksPreferences,
  saveQuickLinksPreferences,
  buildEveningPlan,
  timeToMinutes,
  createDemoTasks,
  loadCompletedTaskHistory,
  upsertCompletedTaskHistory,
  removeTaskFromCompletedHistory,
  normalizeTask,
  getExternalSourceKey,
} from "./utils/appUtils.js";
import { createTaskFromMockAssignment } from "./utils/classroomMockUtils.js";
import {
  getBusyGoogleCalendarIdsFromStorage,
  loadGoogleCalendarAccountMeta,
} from "./utils/googleCalendarStorage.js";
import {
  buildSmartPlannerTaskPayload,
  formatLocalDate,
  formatPlannerPreviewTime,
  getDefaultSmartPlannerDraft,
  getSmartPlannerLocalContext,
  shouldRequestSmartPlannerAi,
  timeStringToMinute,
} from "./utils/smartPlannerUtils.js";

function resolveThemePreference(themePreference) {
  if (themePreference !== "system") return themePreference === "dark" ? "dark" : "light";

  if (typeof window === "undefined") return "light";

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function createEmptyTaskDraft() {
  return {
    subject: "",
    title: "",
    dueDate: "",
    effort: 2,
    taskType: "homework",
    importance: "normal",
    detectedTags: [],
    importanceSource: "auto",
  };
}

function getBusyGoogleCalendarIds() {
  return getBusyGoogleCalendarIdsFromStorage();
}

function getPlanningDate() {
  const planningDate = new Date();

  planningDate.setHours(0, 0, 0, 0);
  return planningDate;
}

function getPlanningDateTime(planningDate, minutes) {
  const date = new Date(planningDate);

  date.setMinutes(minutes);
  return date;
}

function getEventBusyIntervals(events, planningDate, startMinutes, endMinutes) {
  const dayStart = new Date(planningDate);
  const windowStart = getPlanningDateTime(planningDate, startMinutes).getTime();
  const windowEnd = getPlanningDateTime(planningDate, endMinutes).getTime();

  return (Array.isArray(events) ? events : [])
    .filter((event) => event && event.allDay !== true)
    .map((event) => {
      const eventStart = Date.parse(event.start);
      const eventEnd = Date.parse(event.end || event.start);

      if (!Number.isFinite(eventStart) || !Number.isFinite(eventEnd)) {
        return null;
      }

      const clippedStart = Math.max(windowStart, eventStart);
      const clippedEnd = Math.min(windowEnd, eventEnd);

      if (clippedEnd <= clippedStart) return null;

      return {
        startMinutes: Math.round((clippedStart - dayStart.getTime()) / 60000),
        endMinutes: Math.round((clippedEnd - dayStart.getTime()) / 60000),
      };
    })
    .filter(Boolean);
}

function formatPlannerMinutes(minutes) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
}

function getInitialNavigationState() {
  const fallbackState = {
    activePage: "home",
    settingsView: "hub",
    classroomCallbackStatus: null,
    googleCalendarCallbackStatus: null,
  };

  if (typeof window === "undefined") return fallbackState;

  const params = new URLSearchParams(window.location.search);
  const classroomResult = params.get("classroom");
  const googleCalendarResult = params.get("googleCalendar");
  const settingsTab = params.get("tab");
  const opensIntegrations =
    params.get("settings") === "integrations" ||
    settingsTab === "integrations" ||
    classroomResult === "connected" ||
    classroomResult === "error" ||
    googleCalendarResult === "connected" ||
    googleCalendarResult === "error";
  const opensSettings = window.location.pathname === "/settings";

  return {
    activePage: opensIntegrations || opensSettings ? "settings" : "home",
    settingsView: opensIntegrations ? "integrations" : "hub",
    classroomCallbackStatus:
      classroomResult === "connected" || classroomResult === "error"
        ? {
            result: classroomResult,
            status: params.get("classroomStatus") || "",
          }
        : null,
    googleCalendarCallbackStatus:
      googleCalendarResult === "connected" || googleCalendarResult === "error"
        ? {
            result: googleCalendarResult,
            status: params.get("googleCalendarStatus") || "",
          }
        : null,
  };
}

function App() {
  const [initialNavigation] = useState(getInitialNavigationState);
  const [activePage, setActivePage] = useState(initialNavigation.activePage);
  const [settingsView, setSettingsView] = useState(
    initialNavigation.settingsView
  );
  const [settingsNavigationRequest, setSettingsNavigationRequest] = useState(0);
  const [homeEditMode, setHomeEditMode] = useState(false);
  const [rightRailEditMode, setRightRailEditMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("student-hub-theme");
    return savedTheme === "dark" || savedTheme === "system" ? savedTheme : "light";
  });
  const [resolvedTheme, setResolvedTheme] = useState(() =>
    resolveThemePreference(theme)
  );
  const [themeColors, setThemeColorsState] = useState(loadThemeColors);
  const accentColor = themeColors.primary;
  const [layoutDensity, setLayoutDensity] = useState(() => {
    return localStorage.getItem("student-hub-density") === "comfortable"
      ? "comfortable"
      : "compact";
  });
  const [homeLayout, setHomeLayout] = useState(() => {
    return localStorage.getItem("student-hub-home-layout") === "dashboard"
      ? "dashboard"
      : "focused";
  });
  const [rightRailVisible, setRightRailVisible] = useState(() => {
    return localStorage.getItem("student-hub-right-rail") !== "off";
  });
  const [rightRailCollapsed, setRightRailCollapsed] = useState(() => {
    return localStorage.getItem("student-hub-right-rail-state") === "collapsed";
  });
  const [widgetConfig, setWidgetConfig] = useState(() =>
    loadWidgetConfig(homeLayout)
  );
  const [subjects, setSubjects] = useState(loadSubjects);
  const [studentProfile, setStudentProfile] = useState(loadStudentProfile);
  const [quickLinksPreferences, setQuickLinksPreferences] = useState(
    loadQuickLinksPreferences
  );

  const [tasks, setTasks] = useState(loadTasks);
  const [completedTaskHistory, setCompletedTaskHistory] = useState(() =>
    loadCompletedTaskHistory(tasks)
  );
  const [initialSavedPlan] = useState(loadSavedPlanSnapshot);
  const savedPlanIsForToday = isSavedPlanForToday(initialSavedPlan);

  const [hoursAvailable, setHoursAvailable] = useState(() => {
    if (savedPlanIsForToday && initialSavedPlan.hoursAvailable != null) {
      return initialSavedPlan.hoursAvailable;
    }

    return localStorage.getItem("student-hub-hours") || 2;
  });

  const [startTime, setStartTime] = useState(() => {
    if (
      savedPlanIsForToday &&
      /^\d{2}:\d{2}$/.test(initialSavedPlan.startTime || "")
    ) {
      return initialSavedPlan.startTime;
    }

    return localStorage.getItem("student-hub-start-time") || "16:00";
  });

  const [showAddTask, setShowAddTask] = useState(false);
  const [planBlocks, setPlanBlocks] = useState(() =>
    savedPlanIsForToday
      ? restoreSavedPlanBlocks(
          initialSavedPlan,
          tasks.filter((task) => !task.archived),
          startTime
        )
      : []
  );
  const [planMetadata, setPlanMetadata] = useState(() =>
    savedPlanIsForToday && initialSavedPlan?.metadata
      ? initialSavedPlan.metadata
      : null
  );
  const [stalePlanDate, setStalePlanDate] = useState(() =>
    initialSavedPlan && !savedPlanIsForToday
      ? initialSavedPlan.generatedDate
      : null
  );
  const [planMoveFeedback, setPlanMoveFeedback] = useState(null);
  const planMoveFeedbackTimerRef = useRef(null);
  const [smartPlannerOpen, setSmartPlannerOpen] = useState(false);
  const [smartPlannerDraft, setSmartPlannerDraft] = useState(() =>
    getDefaultSmartPlannerDraft()
  );
  const [smartPlannerError, setSmartPlannerError] = useState("");
  const [smartPlannerPreview, setSmartPlannerPreview] = useState(null);
  const [smartPlannerNeedsReplace, setSmartPlannerNeedsReplace] =
    useState(false);
  const [smartPlannerLoading, setSmartPlannerLoading] = useState(false);
  const [smartPlannerQuota, setSmartPlannerQuota] = useState({
    remainingGenerations: null,
    resetAt: "",
  });
  const smartPlannerRequestRef = useRef({ id: 0, controller: null });
  const [eveningPlanSuccess, setEveningPlanSuccess] = useState(null);
  const eveningPlanSuccessTimerRef = useRef(null);

  function setThemeColors(nextThemeColors, options = {}) {
    const normalizedThemeColors = normalizeThemeColors(nextThemeColors);

    setThemeColorsState(normalizedThemeColors);

    if (options.persist) saveThemeColors(normalizedThemeColors);
  }

  function saveThemeColorPreferences(nextThemeColors) {
    setThemeColors(nextThemeColors, { persist: true });
  }

  function setAccentColor(nextAccentColor) {
    setThemeColors(
      {
        ...themeColors,
        paletteId: "custom",
        primary: nextAccentColor,
      },
      { persist: true }
    );
  }

  const [newTask, setNewTask] = useState(createEmptyTaskDraft);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      initialNavigation.classroomCallbackStatus
    ) {
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${window.location.hash}`
      );
    }
  }, [initialNavigation.classroomCallbackStatus]);

  useEffect(() => {
    function syncNavigationFromHistory() {
      const nextNavigation = getInitialNavigationState();

      setActivePage(nextNavigation.activePage);
      setSettingsView(nextNavigation.settingsView);
      setSettingsNavigationRequest((currentRequest) => currentRequest + 1);
    }

    window.addEventListener("popstate", syncNavigationFromHistory);

    return () =>
      window.removeEventListener("popstate", syncNavigationFromHistory);
  }, []);

  useEffect(() => {
    function closeMobileMoreOnDesktop() {
      if (window.innerWidth > 700) setMobileMoreOpen(false);
    }

    closeMobileMoreOnDesktop();
    window.addEventListener("resize", closeMobileMoreOnDesktop);

    return () => window.removeEventListener("resize", closeMobileMoreOnDesktop);
  }, []);

  const rightRailWidgets = getWidgetsForArea(
    widgetConfig,
    "rightRail"
  ).map((widget) => widget.type);

  function setRightRailWidgets(nextWidgetsOrUpdater) {
    setWidgetConfig((currentConfig) => {
      const currentWidgets = getWidgetsForArea(
        currentConfig,
        "rightRail"
      ).map((widget) => widget.type);
      const nextWidgets =
        typeof nextWidgetsOrUpdater === "function"
          ? nextWidgetsOrUpdater(currentWidgets)
          : nextWidgetsOrUpdater;

      return currentConfig.map((widget) =>
        widget.area === "rightRail"
          ? { ...widget, visible: nextWidgets.includes(widget.type) }
          : widget
      );
    });
  }

  function updateHomeLayout(nextLayout) {
    setHomeLayout(nextLayout);
    setWidgetConfig((currentConfig) =>
      currentConfig.map((widget) => {
        if (
          widget.area !== "home" ||
          !["schoolCalendar", "progress"].includes(widget.type)
        ) {
          return widget;
        }

        return {
          ...widget,
          size: nextLayout === "dashboard" ? "expanded" : "compact",
        };
      })
    );
  }

  function openHomeEditMode() {
    setActivePage("home");
    setRightRailEditMode(false);
    setHomeEditMode(true);
  }

  function openRightRailEditMode() {
    setActivePage("home");
    setHomeEditMode(false);
    setRightRailVisible(true);
    setRightRailCollapsed(false);
    setRightRailEditMode(true);
  }

  function openSettings(view = "hub", sectionId = "") {
    const nextView = view || "hub";

    setSettingsView(nextView);
    setSettingsNavigationRequest((currentRequest) => currentRequest + 1);
    setActivePage("settings");

    if (typeof window !== "undefined") {
      const nextUrl = new URL(window.location.href);

      nextUrl.searchParams.delete("settings");
      nextUrl.searchParams.delete("googleCalendarManager");
      nextUrl.searchParams.delete("googleClassroomManager");
      nextUrl.searchParams.delete("classroom");
      nextUrl.searchParams.delete("classroomStatus");
      nextUrl.searchParams.delete("googleCalendar");
      nextUrl.searchParams.delete("googleCalendarStatus");

      if (nextView === "integrations") {
        nextUrl.searchParams.set("tab", "integrations");
      } else {
        nextUrl.searchParams.delete("tab");
      }

      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      if (nextPath !== currentPath) {
        window.history.pushState({}, "", nextPath);
      }
    }

    if (sectionId) {
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
      }, 0);
    }
  }

  function navigateMobilePage(page) {
    setMobileMoreOpen(false);
    setActivePage(page);
  }

  function updateRightRailVisibility(nextVisible) {
    setRightRailVisible(nextVisible);

    if (!nextVisible) setRightRailEditMode(false);
  }

  useEffect(() => {
    localStorage.setItem("student-hub-tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(
      COMPLETED_HISTORY_STORAGE_KEY,
      JSON.stringify(completedTaskHistory)
    );
  }, [completedTaskHistory]);

  useEffect(() => {
    localStorage.setItem("student-hub-subjects", JSON.stringify(subjects));
  }, [subjects]);

  useEffect(() => {
    localStorage.setItem(
      "student-hub-student-profile",
      JSON.stringify(studentProfile)
    );
  }, [studentProfile]);

  useEffect(() => {
    saveQuickLinksPreferences(quickLinksPreferences);
  }, [quickLinksPreferences]);

  useLayoutEffect(() => {
    function applyThemePreference() {
      const nextResolvedTheme = resolveThemePreference(theme);

      document.documentElement.dataset.theme = nextResolvedTheme;
      setResolvedTheme(nextResolvedTheme);
    }

    applyThemePreference();
    localStorage.setItem("student-hub-theme", theme);

    if (theme !== "system") return undefined;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", applyThemePreference);

    return () => mediaQuery.removeEventListener("change", applyThemePreference);
  }, [theme]);

  useLayoutEffect(() => {
    document.documentElement.dataset.density = layoutDensity;
    localStorage.setItem("student-hub-density", layoutDensity);
  }, [layoutDensity]);

  useEffect(() => {
    localStorage.setItem("student-hub-home-layout", homeLayout);
  }, [homeLayout]);

  useEffect(() => {
    localStorage.setItem(
      "student-hub-right-rail",
      rightRailVisible ? "on" : "off"
    );
  }, [rightRailVisible]);

  useEffect(() => {
    localStorage.setItem(
      "student-hub-right-rail-state",
      rightRailCollapsed ? "collapsed" : "expanded"
    );
  }, [rightRailCollapsed]);

  useEffect(() => {
    localStorage.setItem(
      WIDGET_CONFIG_STORAGE_KEY,
      JSON.stringify(widgetConfig)
    );
    localStorage.setItem(
      "student-hub-right-rail-widgets",
      JSON.stringify(
        getWidgetsForArea(widgetConfig, "rightRail").map(
          (widget) => widget.type
        )
      )
    );
  }, [widgetConfig]);

  useEffect(() => {
    if (stalePlanDate) return;

    if (planBlocks.length === 0) {
      localStorage.removeItem(TODAY_PLAN_STORAGE_KEY);
      return;
    }

    saveTodayPlanSnapshot({
      blocks: planBlocks,
      startTime,
      hoursAvailable,
      metadata: planMetadata,
    });
  }, [planBlocks, startTime, hoursAvailable, stalePlanDate, planMetadata]);

  useEffect(() => {
    if (planBlocks.length > 0 || !planMetadata) return undefined;

    const clearMetadataTimer = setTimeout(() => setPlanMetadata(null), 0);
    return () => clearTimeout(clearMetadataTimer);
  }, [planBlocks.length, planMetadata]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const primaryColor = themeColors.primary;
    const secondaryColor = themeColors.secondary;
    const tertiaryColor = themeColors.tertiary;
    const backgroundTheme = deriveThemeBackground(themeColors, resolvedTheme);
    const readableAccent = getReadableAccent(primaryColor, resolvedTheme);
    const hoverTarget = resolvedTheme === "dark" ? "#ffffff" : "#18181b";
    const movedSurface = resolvedTheme === "dark" ? "#202024" : "#ffffff";
    const tintAlpha = resolvedTheme === "dark" ? 0.14 : 0.09;
    const strongTintAlpha = resolvedTheme === "dark" ? 0.2 : 0.14;
    const borderAlpha = resolvedTheme === "dark" ? 0.3 : 0.2;

    root.style.setProperty("--background-canvas", backgroundTheme.canvas);
    root.style.setProperty("--background-surface", backgroundTheme.surface);
    root.style.setProperty("--background-elevated", backgroundTheme.elevated);
    root.style.setProperty("--background-border", backgroundTheme.border);
    root.style.setProperty("--background-hover", backgroundTheme.hover);
    root.style.setProperty("--app-bg", backgroundTheme.canvas);
    root.style.setProperty("--sidebar-bg", backgroundTheme.sidebar);
    root.style.setProperty("--surface", backgroundTheme.surface);
    root.style.setProperty("--surface-raised", backgroundTheme.elevated);
    root.style.setProperty("--surface-subtle", backgroundTheme.subtle);
    root.style.setProperty("--surface-input", backgroundTheme.input);
    root.style.setProperty("--surface-hover", backgroundTheme.hover);
    root.style.setProperty("--control-bg", backgroundTheme.control);
    root.style.setProperty("--control-hover", backgroundTheme.controlHover);
    root.style.setProperty("--border", backgroundTheme.border);
    root.style.setProperty("--border-raised", backgroundTheme.borderRaised);
    root.style.setProperty("--border-strong", backgroundTheme.borderStrong);
    root.style.setProperty("--border-hover", backgroundTheme.borderHover);
    root.style.setProperty("--indicator-border", backgroundTheme.indicatorBorder);
    root.style.setProperty("--border-soft", backgroundTheme.borderSoft);

    function setThemeRoleVariables(role, color) {
      root.style.setProperty(`--accent-${role}`, color);
      root.style.setProperty(
        `--accent-${role}-hover`,
        mixColors(color, hoverTarget, 0.12)
      );
      root.style.setProperty(
        `--accent-${role}-soft`,
        getReadableAccent(color, resolvedTheme)
      );
      root.style.setProperty(
        `--accent-${role}-contrast`,
        getContrastText(color)
      );
      root.style.setProperty(
        `--accent-${role}-tint`,
        colorToRgba(color, tintAlpha)
      );
      root.style.setProperty(
        `--accent-${role}-tint-strong`,
        colorToRgba(color, strongTintAlpha)
      );
      root.style.setProperty(
        `--accent-${role}-border`,
        colorToRgba(color, borderAlpha)
      );
    }

    setThemeRoleVariables("primary", primaryColor);
    setThemeRoleVariables("secondary", secondaryColor);
    setThemeRoleVariables("tertiary", tertiaryColor);

    root.style.setProperty("--accent", primaryColor);
    root.style.setProperty("--accent-color", primaryColor);
    root.style.setProperty(
      "--accent-hover",
      mixColors(primaryColor, hoverTarget, 0.12)
    );
    root.style.setProperty("--accent-soft", readableAccent);
    root.style.setProperty("--accent-contrast", getContrastText(primaryColor));
    root.style.setProperty(
      "--accent-tint",
      colorToRgba(primaryColor, tintAlpha)
    );
    root.style.setProperty(
      "--accent-tint-strong",
      colorToRgba(primaryColor, strongTintAlpha)
    );
    root.style.setProperty(
      "--accent-border",
      colorToRgba(primaryColor, borderAlpha)
    );
    root.style.setProperty(
      "--moved-border",
      colorToRgba(primaryColor, resolvedTheme === "dark" ? 0.72 : 0.48)
    );
    root.style.setProperty(
      "--moved-bg",
      mixColors(movedSurface, primaryColor, resolvedTheme === "dark" ? 0.1 : 0.06)
    );
    root.style.setProperty(
      "--moved-shadow",
      colorToRgba(primaryColor, resolvedTheme === "dark" ? 0.16 : 0.12)
    );
  }, [themeColors, resolvedTheme]);

  useEffect(() => {
    const completedTimestamps = tasks
      .filter((task) => task.completed)
      .map((task) => Number(task.completedAt))
      .filter(Number.isFinite);

    if (completedTimestamps.length === 0) return undefined;

    const nextExpiry =
      Math.min(...completedTimestamps) + COMPLETED_TASK_RETENTION_MS;
    const expiryTimer = setTimeout(() => {
      const now = Date.now();

      setTasks((currentTasks) =>
        currentTasks.filter((task) => {
          if (!task.completed) return true;

          const completedAt = Number(task.completedAt);
          return (
            !Number.isFinite(completedAt) ||
            now - completedAt < COMPLETED_TASK_RETENTION_MS
          );
        })
      );
    }, Math.max(0, nextExpiry - Date.now()));

    return () => clearTimeout(expiryTimer);
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem("student-hub-hours", hoursAvailable);
  }, [hoursAvailable]);

  useEffect(() => {
    localStorage.setItem("student-hub-start-time", startTime);
  }, [startTime]);

  useEffect(() => {
    return () => clearTimeout(planMoveFeedbackTimerRef.current);
  }, []);

  useEffect(() => {
    if (!eveningPlanSuccess) return undefined;

    clearTimeout(eveningPlanSuccessTimerRef.current);
    eveningPlanSuccessTimerRef.current = setTimeout(() => {
      setEveningPlanSuccess(null);
    }, 1800);

    return () => clearTimeout(eveningPlanSuccessTimerRef.current);
  }, [eveningPlanSuccess]);

  useEffect(() => {
    if (activePage === "plan" || !eveningPlanSuccess) return;

    clearTimeout(eveningPlanSuccessTimerRef.current);
    setEveningPlanSuccess(null);
  }, [activePage, eveningPlanSuccess]);

  function isCompletedInClassroom(task) {
    return (
      task.source === "classroom" &&
      ["done", "returned"].includes(task.classroomStatusCategory)
    );
  }

  const visibleTasks = tasks.filter(
    (task) => !task.archived && !isCompletedInClassroom(task)
  );

  const activeTasks = sortTasksForDisplay(
    visibleTasks.filter((task) => {
      const daysLeft = getDaysLeft(task.dueDate);
      return !task.completed && daysLeft !== null && daysLeft <= 14;
    })
  );

  const backlogTasks = sortTasksForDisplay(
    visibleTasks.filter((task) => {
      const daysLeft = getDaysLeft(task.dueDate);
      return !task.completed && daysLeft !== null && daysLeft > 14;
    })
  );

  const noDeadlineTasks = visibleTasks.filter(
    (task) => !task.completed && !task.dueDate
  );

  const completedTasks = visibleTasks.filter((task) => task.completed);

  let visibleBacklog = [];

  if (activeTasks.length === 0) {
    visibleBacklog = backlogTasks;
  } else if (activeTasks.length <= 2) {
    visibleBacklog = backlogTasks.slice(0, 2);
  }

  const hiddenBacklogCount = backlogTasks.length - visibleBacklog.length;

  const progressPercentage =
    visibleTasks.length === 0
      ? 0
      : Math.round((completedTasks.length / visibleTasks.length) * 100);

  const nextTask = [...activeTasks, ...visibleBacklog][0];
  const hasDemoTasks = tasks.some((task) => task.source === "demo");
  const hasDemoData =
    hasDemoTasks ||
    subjects.some((subject) => subject.source === "demo") ||
    completedTaskHistory.some((record) => record.source === "demo");

  function toggleTask(taskId) {
    const taskBeingChanged = tasks.find((task) => task.id === taskId);
    const completedAt = Date.now();

    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              completed: !task.completed,
              completedAt: task.completed ? null : completedAt,
            }
          : task
      )
    );

    if (taskBeingChanged && !taskBeingChanged.completed) {
      setCompletedTaskHistory((currentHistory) =>
        upsertCompletedTaskHistory(
          currentHistory,
          taskBeingChanged,
          completedAt
        )
      );
      setPlanBlocks((currentBlocks) =>
        recalculatePlanTimes(
          cleanPlanSequence(
            currentBlocks.filter((block) => block.taskId !== taskId)
          ),
          startTime
        )
      );
    } else if (taskBeingChanged?.completed) {
      setCompletedTaskHistory((currentHistory) =>
        removeTaskFromCompletedHistory(currentHistory, taskId)
      );
    }
  }

  function completeTaskFromPlan(taskId) {
    const linkedPlanBlock = planBlocks.find(
      (block) => block.taskId === taskId
    );

    if (linkedPlanBlock?.locked) return;

    const taskToComplete = tasks.find((task) => task.id === taskId);
    const completedAt = Date.now();

    if (taskToComplete) {
      setCompletedTaskHistory((currentHistory) =>
        upsertCompletedTaskHistory(
          currentHistory,
          taskToComplete,
          completedAt
        )
      );
    }

    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? { ...task, completed: true, completedAt }
          : task
      )
    );

    setPlanBlocks((currentBlocks) =>
      recalculatePlanTimes(
        cleanPlanSequence(
          currentBlocks.filter((block) => block.taskId !== taskId)
        ),
        startTime
      )
    );
  }

  function deleteTask(taskId) {
    setTasks(tasks.filter((task) => task.id !== taskId));
    setPlanBlocks((currentBlocks) =>
      recalculatePlanTimes(
        cleanPlanSequence(
          currentBlocks.filter((block) => block.taskId !== taskId)
        ),
        startTime
      )
    );
  }

  function updateTask(taskId, updatedTask) {
    if (!updatedTask.subject.trim() || !updatedTask.title.trim()) {
      return;
    }

    setTasks(
      tasks.map((task) => {
        if (task.id !== taskId) return task;

        return normalizeTask({
          ...task,
          ...updatedTask,
          subject: updatedTask.subject.trim(),
          title: updatedTask.title.trim(),
          dueDate: updatedTask.dueDate,
          effort: Number(updatedTask.effort),
        });
      })
    );

    setPlanBlocks([]);
    setPlanMetadata(null);
  }

  function clearPlan() {
    setPlanBlocks((currentBlocks) => {
      const remainingBlocks = recalculatePlanTimes(
        currentBlocks.filter((block) => block.locked === true),
        startTime
      );

      if (remainingBlocks.length === 0) setPlanMetadata(null);
      return remainingBlocks;
    });
  }

  function startFreshPlan() {
    localStorage.removeItem(TODAY_PLAN_STORAGE_KEY);
    setStalePlanDate(null);
    setPlanBlocks([]);
    setPlanMetadata(null);
    setPlanMoveFeedback(null);
  }

  function addManualPlanBlock(blockInput) {
    if (planBlocks.length === 0) setPlanMetadata(null);
    setStalePlanDate(null);
    const type = blockInput.type === "break" ? "break" : "study";
    const numericDuration = Number(blockInput.duration);
    const minimumDuration = type === "break" ? 5 : 10;
    const maximumDuration = type === "break" ? 60 : 240;
    const duration = Math.min(
      maximumDuration,
      Math.max(minimumDuration, Math.round(numericDuration || minimumDuration))
    );
    const manualBlock = {
      id: `manual-${type}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      type,
      source: "manual",
      edited: true,
      locked: false,
      taskId: null,
      calendarEventId: null,
      title:
        blockInput.title.trim() ||
        (type === "break" ? "Break" : "Study block"),
      duration,
      ...(type === "study"
        ? { subject: blockInput.subject.trim(), effort: null }
        : {}),
    };

    setPlanBlocks((currentBlocks) =>
      recalculatePlanTimes(
        [
          ...currentBlocks.filter((block) => block.type !== "message"),
          manualBlock,
        ],
        startTime
      )
    );
  }

  function addTaskToList(taskInput) {
    if (!taskInput.subject.trim() || !taskInput.title.trim()) {
      return false;
    }

    const taskToAdd = normalizeTask({
      id: Date.now(),
      subject: taskInput.subject.trim(),
      title: taskInput.title.trim(),
      dueDate: taskInput.dueDate,
      effort: Number(taskInput.effort),
      completed: false,
      source: "manual",
      externalId: null,
      classroomCourseId: null,
      classroomCourseName: null,
      importedAt: null,
      lastSyncedAt: null,
      taskType: taskInput.taskType,
      importance: taskInput.importance,
      detectedTags: taskInput.detectedTags,
      importanceSource: taskInput.importanceSource,
    });

    setTasks((currentTasks) => [...currentTasks, taskToAdd]);
    return true;
  }

  function addTask(event) {
    event.preventDefault();

    if (!addTaskToList(newTask)) return;

    setNewTask(createEmptyTaskDraft());

    setShowAddTask(false);
  }

  function importMockClassroomAssignments(assignments) {
    const requestedAssignments = Array.isArray(assignments) ? assignments : [];
    const existingExternalIds = new Set(
      tasks
        .filter((task) => task.source === "classroom-mock")
        .map((task) => task.externalId)
        .filter(Boolean)
    );
    const uniqueAssignments = [];
    const requestedExternalIds = new Set();

    requestedAssignments.forEach((assignment) => {
      if (
        !assignment?.externalId ||
        existingExternalIds.has(assignment.externalId) ||
        requestedExternalIds.has(assignment.externalId)
      ) {
        return;
      }

      requestedExternalIds.add(assignment.externalId);
      uniqueAssignments.push(assignment);
    });

    const importedAt = new Date().toISOString();
    const importedTasks = uniqueAssignments.map((assignment) =>
      createTaskFromMockAssignment(assignment, subjects, importedAt)
    );

    if (importedTasks.length > 0) {
      setTasks((currentTasks) => {
        const currentExternalIds = new Set(
          currentTasks
            .filter((task) => task.source === "classroom-mock")
            .map((task) => task.externalId)
            .filter(Boolean)
        );
        const tasksToAdd = importedTasks.filter(
          (task) => !currentExternalIds.has(task.externalId)
        );

        return tasksToAdd.length > 0
          ? [...currentTasks, ...tasksToAdd]
          : currentTasks;
      });
    }

    return {
      importedCount: importedTasks.length,
      skippedCount: requestedAssignments.length - importedTasks.length,
    };
  }

  function createTaskFromClassroomPreviewAssignment(assignment, importedAt) {
    return normalizeTask({
      id: `classroom-${String(assignment.externalId || Date.now()).replace(
        /[^a-z0-9-]+/gi,
        "-"
      )}`,
      subject: String(assignment.linkedSubjectName || "").trim(),
      title: String(assignment.title || "Untitled assignment").trim(),
      description: String(assignment.description || "").trim(),
      dueDate: String(assignment.dueDate || ""),
      dueTime: String(assignment.dueTime || ""),
      effort: 2,
      completed: false,
      completedAt: null,
      source: "classroom",
      externalId: assignment.externalId,
      classroomCourseId: assignment.classroomCourseId || null,
      classroomCourseName: assignment.classroomCourseName || null,
      linkedSubjectId: assignment.linkedSubjectId || null,
      linkedSubjectName: assignment.linkedSubjectName || "",
      alternateLink: assignment.alternateLink || "",
      workType: assignment.workType || "",
      state: assignment.state || "",
      submissionId: assignment.submissionId || null,
      submissionState: assignment.submissionState || "",
      classroomStatusCategory: assignment.classroomStatusCategory || "unknown",
      late: assignment.late === true,
      assignedGrade: assignment.assignedGrade ?? null,
      draftGrade: assignment.draftGrade ?? null,
      submissionUpdatedAt: assignment.submissionUpdatedAt || null,
      importedAt,
      sourceUpdatedAt: assignment.updateTime || assignment.sourceUpdatedAt || null,
      lastSyncedAt: importedAt,
      taskType: "homework",
      importance: "normal",
      detectedTags: [],
      importanceSource: "auto",
    });
  }

  function hasClassroomTaskSyncChanges(existingTask, classroomTask) {
    return [
      "title",
      "description",
      "dueDate",
      "dueTime",
      "classroomCourseId",
      "classroomCourseName",
      "linkedSubjectId",
      "linkedSubjectName",
      "alternateLink",
      "workType",
      "state",
      "submissionId",
      "submissionState",
      "classroomStatusCategory",
      "late",
      "assignedGrade",
      "draftGrade",
      "submissionUpdatedAt",
      "sourceUpdatedAt",
    ].some(
      (field) => String(existingTask[field] || "") !== String(classroomTask[field] || "")
    );
  }

  function importRealClassroomAssignments(assignments) {
    const requestedAssignments = Array.isArray(assignments)
      ? assignments.filter(
          (assignment) =>
            assignment?.source === "classroom" &&
            typeof assignment.externalId === "string" &&
            assignment.externalId.trim() &&
            assignment.linkedSubjectId &&
            assignment.linkedSubjectName
        )
      : [];
    const requestedKeys = new Set();
    const uniqueAssignments = requestedAssignments.filter((assignment) => {
      const sourceKey = getExternalSourceKey(assignment);

      if (!sourceKey || requestedKeys.has(sourceKey)) return false;

      requestedKeys.add(sourceKey);
      return true;
    });
    const importedAt = new Date().toISOString();

    if (uniqueAssignments.length === 0) {
      return {
        importedCount: 0,
        updatedCount: 0,
        skippedCount: requestedAssignments.length,
      };
    }

    const taskBySourceKey = new Map(
      tasks
        .map((task) => [getExternalSourceKey(task), task])
        .filter(([sourceKey]) => sourceKey)
    );
    const nextTasks = [...tasks];
    const tasksToAdd = [];
    let importedCount = 0;
    let updatedCount = 0;
    let upToDateCount = 0;

    uniqueAssignments.forEach((assignment) => {
      const sourceKey = getExternalSourceKey(assignment);
      const existingTask = taskBySourceKey.get(sourceKey);
      const classroomTask = createTaskFromClassroomPreviewAssignment(
        assignment,
        importedAt
      );

      if (existingTask) {
        if (!hasClassroomTaskSyncChanges(existingTask, classroomTask)) {
          upToDateCount += 1;
          return;
        }

        updatedCount += 1;
        const existingTaskIndex = nextTasks.findIndex(
          (task) => getExternalSourceKey(task) === sourceKey
        );

        nextTasks[existingTaskIndex] = normalizeTask({
          ...existingTask,
          title: classroomTask.title,
          description: classroomTask.description,
          dueDate: classroomTask.dueDate,
          dueTime: classroomTask.dueTime,
          classroomCourseId: classroomTask.classroomCourseId,
          classroomCourseName: classroomTask.classroomCourseName,
          linkedSubjectId: classroomTask.linkedSubjectId,
          linkedSubjectName: classroomTask.linkedSubjectName,
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
          lastSyncedAt: importedAt,
          subject: existingTask.subject || classroomTask.subject,
        });
        return;
      }

      importedCount += 1;
      taskBySourceKey.set(sourceKey, classroomTask);
      tasksToAdd.push(classroomTask);
    });

    setTasks(tasksToAdd.length > 0 ? [...nextTasks, ...tasksToAdd] : nextTasks);

    return {
      importedCount,
      updatedCount,
      skippedCount:
        requestedAssignments.length - uniqueAssignments.length + upToDateCount,
    };
  }

  function isNoDueDateClassroomArchiveCandidate(task) {
    return (
      task.source === "classroom" &&
      !hasRealDueDate(task.dueDate) &&
      !task.completed &&
      task.archived !== true
    );
  }

  function archiveNoDueDateClassroomTasks() {
    const affectedTaskIds = new Set(
      tasks.filter(isNoDueDateClassroomArchiveCandidate).map((task) => task.id)
    );

    if (affectedTaskIds.size === 0) return 0;

    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        isNoDueDateClassroomArchiveCandidate(task)
          ? { ...task, archived: true, archivedAt: new Date().toISOString() }
          : task
      )
    );
    setPlanBlocks((currentBlocks) =>
      recalculatePlanTimes(
        cleanPlanSequence(
          currentBlocks.filter((block) => !affectedTaskIds.has(block.taskId))
        ),
        startTime
      )
    );

    return affectedTaskIds.size;
  }

  function restoreArchivedClassroomTasks() {
    const affectedTaskIds = new Set(
      tasks
        .filter(
          (task) =>
            task.source === "classroom" &&
            task.archived === true &&
            !task.completed
        )
        .map((task) => task.id)
    );

    if (affectedTaskIds.size === 0) return 0;

    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        affectedTaskIds.has(task.id)
          ? { ...task, archived: false, archivedAt: null }
          : task
      )
    );

    return affectedTaskIds.size;
  }

  function removeMockClassroomTasks() {
    const sampleTaskIds = new Set(
      tasks
        .filter((task) => task.source === "classroom-mock")
        .map((task) => task.id)
    );

    setTasks((currentTasks) =>
      currentTasks.filter((task) => task.source !== "classroom-mock")
    );
    setCompletedTaskHistory((currentHistory) =>
      currentHistory.filter((record) => record.source !== "classroom-mock")
    );
    setPlanBlocks((currentBlocks) =>
      recalculatePlanTimes(
        cleanPlanSequence(
          currentBlocks.filter((block) => !sampleTaskIds.has(block.taskId))
        ),
        startTime
      )
    );

    return sampleTaskIds.size;
  }

  function updateMockClassroomCourseSubject(classroomCourseId, subjectName = "") {
    const safeCourseId = String(classroomCourseId || "").trim();
    const nextSubject = String(subjectName || "").trim();

    if (!safeCourseId) return;

    const affectedTaskIds = new Set(
      tasks
        .filter(
          (task) =>
            task.source === "classroom-mock" &&
            task.classroomCourseId === safeCourseId
        )
        .map((task) => task.id)
    );

    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.source === "classroom-mock" &&
        task.classroomCourseId === safeCourseId
          ? { ...task, subject: nextSubject }
          : task
      )
    );

    setPlanBlocks((currentBlocks) =>
      currentBlocks.map((block) =>
        affectedTaskIds.has(block.taskId)
          ? { ...block, subject: nextSubject }
          : block
      )
    );
  }

  function generatePlan() {
    if (planBlocks.some((block) => block.locked === true)) {
      setActivePage("plan");
      return;
    }

    setStalePlanDate(null);

    const availableMinutes = Math.round(Number(hoursAvailable) * 60);

    if (!availableMinutes || availableMinutes < 20) {
      setPlanBlocks([
        {
          id: "not-enough-time",
          type: "message",
          source: "generated",
          edited: false,
          locked: false,
          taskId: null,
          calendarEventId: null,
          title: "Not enough time to build a proper plan.",
          note: "Try setting at least 20 minutes.",
        },
      ]);
      setActivePage("plan");
      return;
    }

    let candidateTasks = [...activeTasks, ...visibleBacklog];

    if (candidateTasks.length === 0 && noDeadlineTasks.length > 0) {
      candidateTasks = [...noDeadlineTasks];
    }

    if (candidateTasks.length === 0) {
      setPlanBlocks([
        {
          id: "no-tasks",
          type: "message",
          source: "generated",
          edited: false,
          locked: false,
          taskId: null,
          calendarEventId: null,
          title: "No tasks to plan yet.",
          note: "Add a task or create a custom block to get started.",
        },
      ]);
      setActivePage("plan");
      return;
    }

    const sortedTasks = sortTasksForDisplay(candidateTasks);

    const effortDurations = {
      1: 25,
      2: 35,
      3: 50,
      4: 65,
      5: 80,
    };

    const newPlan = [];
    let remainingMinutes = availableMinutes;
    let currentOffset = 0;

    for (const task of sortedTasks) {
      if (remainingMinutes < 20) break;

      const idealDuration = effortDurations[task.effort] || 35;
      const duration = Math.min(idealDuration, remainingMinutes);

      if (duration < 20) break;

      newPlan.push({
        id: `${task.id}-${currentOffset}`,
        type: "study",
        source: "generated",
        edited: false,
        locked: false,
        taskId: task.id,
        calendarEventId: null,
        subject: task.subject,
        title: task.title,
        start: formatTime(startTime, currentOffset),
        end: formatTime(startTime, currentOffset + duration),
        duration,
        effort: task.effort,
        taskType: task.taskType,
        importance: task.importance,
        detectedTags: task.detectedTags,
        importanceSource: task.importanceSource,
        tip: getTaskTip(task),
      });

      currentOffset += duration;
      remainingMinutes -= duration;

      if (remainingMinutes >= 30) {
        newPlan.push({
          id: `break-${currentOffset}`,
          type: "break",
          source: "generated",
          edited: false,
          locked: false,
          taskId: null,
          calendarEventId: null,
          start: formatTime(startTime, currentOffset),
          end: formatTime(startTime, currentOffset + 10),
          duration: 10,
          title: "Break",
          tip: "Step away from the screen for a few minutes.",
        });

        currentOffset += 10;
        remainingMinutes -= 10;
      }
    }

    setPlanBlocks(recalculatePlanTimes(newPlan, startTime));
    setActivePage("plan");
  }

  function calendarBusyTimeIsAvailable() {
    return (
      getBusyGoogleCalendarIds().length > 0 &&
      Boolean(loadGoogleCalendarAccountMeta()?.accountId)
    );
  }

  function openSmartPlanner() {
    const calendarAvailable = calendarBusyTimeIsAvailable();

    setEveningPlanSuccess(null);
    setSmartPlannerDraft(
      getDefaultSmartPlannerDraft({ calendarAvailable })
    );
    setSmartPlannerError("");
    setSmartPlannerPreview(null);
    setSmartPlannerNeedsReplace(false);
    setSmartPlannerLoading(false);
    setSmartPlannerOpen(true);
  }

  function closeSmartPlanner() {
    smartPlannerRequestRef.current.controller?.abort();
    smartPlannerRequestRef.current = {
      id: smartPlannerRequestRef.current.id + 1,
      controller: null,
    };
    setSmartPlannerOpen(false);
    setSmartPlannerError("");
    setSmartPlannerPreview(null);
    setSmartPlannerNeedsReplace(false);
    setSmartPlannerLoading(false);
  }

  async function fetchPlanningBusyIntervals(draft, signal) {
    const busyCalendarIds = getBusyGoogleCalendarIds();
    const googleCalendarAccount = loadGoogleCalendarAccountMeta();

    if (busyCalendarIds.length === 0 || !googleCalendarAccount?.accountId) {
      return [];
    }

    const startMinutes = timeToMinutes(draft.startTime);
    const endMinutes = timeToMinutes(draft.endTime);

    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      return [];
    }

    const planningDate = getPlanningDate();
    const response = await fetch("/api/google-calendar/events", {
      method: "POST",
      credentials: "include",
      signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountId: googleCalendarAccount.accountId,
        selectedCalendarIds: busyCalendarIds,
        timeMin: getPlanningDateTime(planningDate, startMinutes).toISOString(),
        timeMax: getPlanningDateTime(planningDate, endMinutes).toISOString(),
      }),
    });
    const result = await response.json();

    if (!response.ok || result.ok !== true) {
      throw new Error(
        result.status === "no_calendar_session" ||
          result.status === "calendar_session_invalid_or_expired" ||
          result.status === "calendar_session_reconnect_required"
          ? "Reconnect Google Calendar, or continue without Calendar."
          : result.message || "Calendar is unavailable. Continue without Calendar?"
      );
    }

    return getEventBusyIntervals(
      result.events,
      planningDate,
      startMinutes,
      endMinutes
    ).slice(0, 40);
  }

  function buildBasicPlannerPreview(busyIntervals = [], fallbackMessage = "") {
    const result = buildEveningPlan({
      tasks: visibleTasks,
      startTime: smartPlannerDraft.startTime,
      endTime: smartPlannerDraft.endTime,
      energy: "normal",
      includeBreaks: true,
      maxFocusMinutes: 35,
      planStyle:
        smartPlannerDraft.planStyle === "lighter"
          ? "light"
          : smartPlannerDraft.planStyle === "maximum"
            ? "push"
            : "balanced",
      busyIntervals,
    });

    if (!result.ok) {
      if (result.reason === "No active tasks to plan yet.") {
        setSmartPlannerPreview({
          source: "basic",
          status: "no_tasks",
          summary: "Nothing needs planning right now.",
          blocks: [],
          omittedTasks: [],
          warnings: [],
        });
        setSmartPlannerError(fallbackMessage);
        return true;
      }

      setSmartPlannerError(
        [fallbackMessage, result.reason].filter(Boolean).join(" ")
      );
      setSmartPlannerPreview(null);
      return false;
    }

    const eligibleTasks = buildSmartPlannerTaskPayload(
      sortTasksForDisplay(visibleTasks),
      formatLocalDate()
    );
    const scheduledTaskIds = new Set(
      result.blocks
        .filter((block) => block.type === "study")
        .map((block) => String(block.taskId))
    );
    const omittedTasks = eligibleTasks
      .filter((task) => !scheduledTaskIds.has(task.id))
      .map((task) => ({
        taskId: task.id,
        title: task.title,
        reason: "It did not fit after higher-priority work.",
        suggestedNextStep: "Review it when you next update your plan.",
      }));

    setSmartPlannerPreview({
      source: "basic",
      status: "ready",
      summary: `${result.scheduledTaskCount} task${
        result.scheduledTaskCount === 1 ? "" : "s"
      } scheduled with the Basic planner.`,
      blocks: result.blocks.map((block) => ({
        ...block,
        plannerSource: "basic",
      })),
      omittedTasks,
      warnings:
        busyIntervals.length > 0
          ? [`Calendar leaves ${formatPlannerMinutes(result.usableMinutes)} free.`]
          : [],
      windowMinutes: result.windowMinutes,
      usableMinutes: result.usableMinutes,
    });
    setSmartPlannerNeedsReplace(false);
    setSmartPlannerError(fallbackMessage);
    return true;
  }

  function mapSmartPlannerPlan(plan) {
    const taskMap = new Map(visibleTasks.map((task) => [String(task.id), task]));

    return plan.blocks.map((block, index) => {
      if (block.type === "break") {
        return {
          id: `smart-break-${block.startMinute}-${index}`,
          type: "break",
          source: "generated",
          plannerSource: "smart",
          edited: false,
          locked: false,
          taskId: null,
          calendarEventId: null,
          start: formatPlannerPreviewTime(block.startMinute),
          end: formatPlannerPreviewTime(block.endMinute),
          startMinute: block.startMinute,
          endMinute: block.endMinute,
          duration: block.durationMinutes,
          title: block.title || "Break",
          tip: block.goal || "Step away for a few minutes.",
          reason: block.reason || "",
        };
      }

      const task = taskMap.get(String(block.taskId));
      return {
        id: `smart-${block.taskId}-${block.startMinute}-${index}`,
        type: "study",
        source: "generated",
        plannerSource: "smart",
        taskSource: task?.source || "manual",
        edited: false,
        locked: false,
        taskId: task?.id ?? block.taskId,
        calendarEventId: null,
        subject: task?.subject || block.subject || "",
        title: task?.title || block.title,
        start: formatPlannerPreviewTime(block.startMinute),
        end: formatPlannerPreviewTime(block.endMinute),
        startMinute: block.startMinute,
        endMinute: block.endMinute,
        duration: block.durationMinutes,
        effort: task?.effort,
        taskType: task?.taskType,
        importance: task?.importance,
        detectedTags: task?.detectedTags,
        importanceSource: task?.importanceSource,
        classroomCourseId: task?.classroomCourseId || null,
        classroomCourseName: task?.classroomCourseName || "",
        externalId: task?.externalId || null,
        tip: block.goal,
        reason: block.reason,
      };
    });
  }

  async function generateSmartPlannerPreview({ basic = false } = {}) {
    if (smartPlannerLoading) return;

    const context = getSmartPlannerLocalContext(smartPlannerDraft);
    if (
      context.startMinute === null ||
      context.finishMinute === null ||
      context.finishMinute <= context.startMinute
    ) {
      setSmartPlannerError("Choose a finish time after your start time.");
      return;
    }

    if (context.startMinute < context.currentMinute) {
      setSmartPlannerError("Choose a start time that has not passed.");
      return;
    }

    if (context.finishMinute - context.startMinute < 15) {
      setSmartPlannerError("There isn’t enough time left to build today’s plan.");
      return;
    }

    const shouldRequestAi = shouldRequestSmartPlannerAi({
      basic,
      remainingGenerations: smartPlannerQuota.remainingGenerations,
    });
    const useBasicForQuota = !basic && !shouldRequestAi;

    smartPlannerRequestRef.current.controller?.abort();
    const controller = new AbortController();
    const requestId = smartPlannerRequestRef.current.id + 1;
    smartPlannerRequestRef.current = { id: requestId, controller };
    setSmartPlannerLoading(true);
    setSmartPlannerError("");
    setSmartPlannerPreview(null);
    setSmartPlannerNeedsReplace(false);

    let busyIntervals = [];
    if (smartPlannerDraft.useCalendar && calendarBusyTimeIsAvailable()) {
      try {
        busyIntervals = await fetchPlanningBusyIntervals(
          smartPlannerDraft,
          controller.signal
        );
      } catch (error) {
        if (error?.name === "AbortError") return;
        if (smartPlannerRequestRef.current.id !== requestId) return;
        setSmartPlannerLoading(false);
        setSmartPlannerError(
          "Calendar could not be checked. Turn off Calendar consideration or try again."
        );
        return;
      }
    }

    if (smartPlannerRequestRef.current.id !== requestId) return;

    if (!shouldRequestAi) {
      const resetLabel = smartPlannerQuota.resetAt
        ? new Date(smartPlannerQuota.resetAt).toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "later";
      buildBasicPlannerPreview(
        busyIntervals,
        useBasicForQuota
          ? `AI limit reached. It resets ${resetLabel}. Here’s a Basic plan instead.`
          : ""
      );
      setSmartPlannerLoading(false);
      smartPlannerRequestRef.current.controller = null;
      return;
    }

    const eligibleTasks = buildSmartPlannerTaskPayload(
      sortTasksForDisplay(visibleTasks),
      context.localDate
    );

    if (eligibleTasks.length === 0) {
      setSmartPlannerLoading(false);
      setSmartPlannerPreview({
        source: "smart",
        status: "no_tasks",
        summary: "Nothing needs planning right now.",
        blocks: [],
        omittedTasks: [],
        warnings: [],
      });
      smartPlannerRequestRef.current.controller = null;
      return;
    }

    try {
      const response = await fetch("/api/smart-planner/generate", {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Student-Hub-Request": "smart-planner",
        },
        body: JSON.stringify({
          ...context,
          tasks: eligibleTasks,
          busyIntervals: busyIntervals.map((interval) => ({
            startMinute: interval.startMinutes,
            endMinute: interval.endMinutes,
          })),
        }),
      });
      const result = await response.json().catch(() => null);

      if (smartPlannerRequestRef.current.id !== requestId) return;

      if (Number.isInteger(result?.remainingGenerations)) {
        setSmartPlannerQuota({
          remainingGenerations: Math.max(0, result.remainingGenerations),
          resetAt: typeof result.resetAt === "string" ? result.resetAt : "",
        });
      }

      if (!response.ok || result?.ok !== true || !result.plan) {
        buildBasicPlannerPreview(
          busyIntervals,
          `${result?.message || "Smart Planner is unavailable."} Here’s a Basic plan instead.`
        );
        return;
      }

      const mappedBlocks = mapSmartPlannerPlan(result.plan);
      setSmartPlannerPreview({
        source: "smart",
        status: result.plan.status,
        summary: result.plan.summary,
        blocks: mappedBlocks,
        omittedTasks: result.plan.omittedTasks || [],
        warnings: result.plan.warnings || [],
        windowMinutes: context.finishMinute - context.startMinute,
        usableMinutes:
          context.finishMinute -
          context.startMinute -
          busyIntervals.reduce(
            (total, interval) =>
              total + Math.max(0, interval.endMinutes - interval.startMinutes),
            0
          ),
      });
      setSmartPlannerError("");
    } catch (error) {
      if (error?.name === "AbortError") return;
      if (smartPlannerRequestRef.current.id !== requestId) return;
      buildBasicPlannerPreview(
        busyIntervals,
        "Smart Planner could not be reached. Here’s a Basic plan instead."
      );
    } finally {
      if (smartPlannerRequestRef.current.id === requestId) {
        setSmartPlannerLoading(false);
        smartPlannerRequestRef.current.controller = null;
      }
    }
  }

  function editSmartPlannerSettings() {
    setSmartPlannerPreview(null);
    setSmartPlannerNeedsReplace(false);
    setSmartPlannerError("");
  }

  function useSmartPlannerPreview() {
    if (!smartPlannerPreview || smartPlannerPreview.blocks.length === 0) return;

    if (planBlocks.some((block) => block.locked === true)) {
      setSmartPlannerNeedsReplace(true);
      setSmartPlannerError("Unlock locked blocks before replacing this plan.");
      return;
    }

    if (planBlocks.length > 0 && !smartPlannerNeedsReplace) {
      setSmartPlannerNeedsReplace(true);
      setSmartPlannerError("");
      return;
    }

    const replacedExistingPlan = planBlocks.length > 0;
    const startMinutes = timeStringToMinute(smartPlannerDraft.startTime);
    const finishMinutes = timeStringToMinute(smartPlannerDraft.endTime);
    const scheduledTaskCount = new Set(
      smartPlannerPreview.blocks
        .filter((block) => block.type === "study")
        .map((block) => block.taskId)
    ).size;
    const breakCount = smartPlannerPreview.blocks.filter(
      (block) => block.type === "break"
    ).length;

    setStalePlanDate(null);
    setStartTime(smartPlannerDraft.startTime);
    setHoursAvailable(
      Number((((finishMinutes || 0) - (startMinutes || 0)) / 60).toFixed(2))
    );
    setPlanBlocks(smartPlannerPreview.blocks);
    setPlanMetadata({
      source: smartPlannerPreview.source,
      generatedDate: formatLocalDate(),
      generatedAt: new Date().toISOString(),
      summary: String(smartPlannerPreview.summary || "").slice(0, 280),
      omittedTasks: smartPlannerPreview.omittedTasks.map((task) => ({
        taskId: String(task.taskId || "").slice(0, 120),
        title: String(task.title || "").slice(0, 180),
        reason: String(task.reason || "").slice(0, 240),
        suggestedNextStep: String(task.suggestedNextStep || "").slice(0, 240),
      })),
      warnings: smartPlannerPreview.warnings
        .map((warning) => String(warning).slice(0, 240))
        .slice(0, 8),
    });
    setActivePage("plan");
    closeSmartPlanner();
    setEveningPlanSuccess({
      title: replacedExistingPlan ? "Plan updated" : "Plan created",
      summary: `${scheduledTaskCount} task${scheduledTaskCount === 1 ? "" : "s"} scheduled${
        breakCount > 0
          ? ` · ${breakCount} break${breakCount === 1 ? "" : "s"} added`
          : ""
      }`,
    });
  }

  function movePlanStudyBlock(blockId, direction) {
    const studyPositions = planBlocks.reduce((positions, block, index) => {
      if (block.type === "study") positions.push(index);
      return positions;
    }, []);
    const currentStudyIndex = studyPositions.findIndex(
      (blockIndex) => planBlocks[blockIndex].id === blockId
    );
    const nextStudyIndex = currentStudyIndex + direction;

    if (
      currentStudyIndex === -1 ||
      nextStudyIndex < 0 ||
      nextStudyIndex >= studyPositions.length
    ) {
      return;
    }

    const reorderedPlan = [...planBlocks];
    const currentPosition = studyPositions[currentStudyIndex];
    const nextPosition = studyPositions[nextStudyIndex];
    const rangeStart = Math.min(currentPosition, nextPosition);
    const rangeEnd = Math.max(currentPosition, nextPosition);

    if (
      planBlocks[currentPosition].locked ||
      planBlocks
        .slice(rangeStart, rangeEnd + 1)
        .some((block) => block.locked)
    ) {
      return;
    }

    [reorderedPlan[currentPosition], reorderedPlan[nextPosition]] = [
      reorderedPlan[nextPosition],
      reorderedPlan[currentPosition],
    ];

    setPlanBlocks(recalculatePlanTimes(reorderedPlan, startTime));
    setPlanMoveFeedback((currentFeedback) => ({
      blockId,
      direction,
      sequence: (currentFeedback?.sequence || 0) + 1,
    }));

    clearTimeout(planMoveFeedbackTimerRef.current);
    planMoveFeedbackTimerRef.current = setTimeout(() => {
      setPlanMoveFeedback(null);
    }, 700);
  }

  function updatePlanBlockDuration(blockId, nextDuration) {
    setPlanBlocks((currentBlocks) =>
      recalculatePlanTimes(
        currentBlocks.map((block) => {
          if (block.id !== blockId) return block;
          if (block.locked) return block;

          const numericDuration = Number(nextDuration);
          if (!Number.isFinite(numericDuration)) return block;

          const minimumDuration = block.type === "break" ? 5 : 10;
          const maximumDuration = block.type === "break" ? 60 : 240;
          const duration = Math.min(
            maximumDuration,
            Math.max(minimumDuration, Math.round(numericDuration))
          );

          return { ...block, duration, edited: true };
        }),
        startTime
      )
    );
  }

  function removePlanBlock(blockId) {
    setPlanBlocks((currentBlocks) => {
      const blockToRemove = currentBlocks.find(
        (block) => block.id === blockId
      );

      if (blockToRemove?.locked) return currentBlocks;

      return recalculatePlanTimes(
        cleanPlanSequence(
          currentBlocks.filter((block) => block.id !== blockId)
        ),
        startTime
      );
    });
  }

  function togglePlanBlockLocked(blockId) {
    setPlanBlocks((currentBlocks) =>
      currentBlocks.map((block) =>
        block.id === blockId
          ? { ...block, locked: !block.locked }
          : block
      )
    );
  }

  function updatePlanStartTime(nextStartTime) {
    setStartTime(nextStartTime);
    setPlanBlocks((currentBlocks) =>
      recalculatePlanTimes(currentBlocks, nextStartTime)
    );
  }

  function reorderPlanBlock(activeBlockId, overBlockId) {
    if (!activeBlockId || !overBlockId || activeBlockId === overBlockId) return;

    setPlanBlocks((currentBlocks) => {
      const activeIndex = currentBlocks.findIndex(
        (block) => block.id === activeBlockId
      );
      const overIndex = currentBlocks.findIndex(
        (block) => block.id === overBlockId
      );

      if (activeIndex < 0 || overIndex < 0) return currentBlocks;

      const rangeStart = Math.min(activeIndex, overIndex);
      const rangeEnd = Math.max(activeIndex, overIndex);

      if (
        currentBlocks[activeIndex].locked ||
        currentBlocks
          .slice(rangeStart, rangeEnd + 1)
          .some((block) => block.locked)
      ) {
        return currentBlocks;
      }

      const reorderedBlocks = [...currentBlocks];
      const [movedBlock] = reorderedBlocks.splice(activeIndex, 1);
      reorderedBlocks.splice(overIndex, 0, movedBlock);

      return recalculatePlanTimes(reorderedBlocks, startTime);
    });
  }

  function completeOnboarding() {
    const completedProfile = {
      ...studentProfile,
      onboardingCompleted: true,
      source: studentProfile.source || "manual",
    };

    setStudentProfile(completedProfile);
    localStorage.setItem(
      "student-hub-student-profile",
      JSON.stringify(completedProfile)
    );
    setActivePage("home");
  }

  function restartOnboarding() {
    const restartedProfile = {
      ...studentProfile,
      onboardingCompleted: false,
      source: studentProfile.source || "manual",
    };

    setStudentProfile(restartedProfile);
    localStorage.setItem(
      "student-hub-student-profile",
      JSON.stringify(restartedProfile)
    );
    setHomeEditMode(false);
    setRightRailEditMode(false);
    setActivePage("home");
  }

  function resetTasks() {
    localStorage.removeItem("student-hub-tasks");
    localStorage.removeItem(COMPLETED_HISTORY_STORAGE_KEY);
    localStorage.removeItem(TODAY_PLAN_STORAGE_KEY);
    setTasks([]);
    setCompletedTaskHistory([]);
    setPlanBlocks([]);
    setPlanMetadata(null);
    setStalePlanDate(null);
    setPlanMoveFeedback(null);
    setShowAddTask(false);
  }

  function resetSubjects() {
    localStorage.removeItem("student-hub-subjects");
    localStorage.removeItem("student-hub-mock-classroom-course-links");
    setSubjects([]);
  }

  function loadDemoWorkspace() {
    setTasks((currentTasks) => {
      if (currentTasks.some((task) => task.source === "demo")) {
        return currentTasks;
      }

      const existingTaskIds = new Set(currentTasks.map((task) => task.id));
      const existingTaskSignatures = new Set(
        currentTasks.map(
          (task) =>
            `${task.subject.trim().toLocaleLowerCase()}::${task.title
              .trim()
              .toLocaleLowerCase()}`
        )
      );
      const demoTasks = createDemoTasks().filter(
        (task) =>
          !existingTaskIds.has(task.id) &&
          !existingTaskSignatures.has(
            `${task.subject.toLocaleLowerCase()}::${task.title.toLocaleLowerCase()}`
          )
      );

      return [...currentTasks, ...demoTasks];
    });
  }

  function removeDemoData() {
    const demoTaskIds = new Set(
      tasks
        .filter((task) => task.source === "demo")
        .map((task) => task.id)
    );

    setTasks((currentTasks) =>
      currentTasks.filter((task) => task.source !== "demo")
    );
    setSubjects((currentSubjects) =>
      currentSubjects.filter((subject) => subject.source !== "demo")
    );
    setCompletedTaskHistory((currentHistory) =>
      currentHistory.filter((record) => record.source !== "demo")
    );
    setPlanBlocks((currentBlocks) =>
      recalculatePlanTimes(
        cleanPlanSequence(
          currentBlocks.filter(
            (block) => !demoTaskIds.has(block.taskId)
          )
        ),
        startTime
      )
    );
  }

  function resetAppearancePreferences() {
    [
      "student-hub-theme",
      "student-hub-accent",
      "student-hub-theme-colors",
      "student-hub-density",
      "student-hub-home-layout",
      "student-hub-right-rail",
      "student-hub-right-rail-state",
      "student-hub-right-rail-widgets",
      WIDGET_CONFIG_STORAGE_KEY,
    ].forEach((storageKey) => localStorage.removeItem(storageKey));

    setTheme("light");
    setThemeColors(DEFAULT_THEME_COLORS);
    setLayoutDensity("compact");
    setHomeLayout("focused");
    setRightRailVisible(true);
    setRightRailCollapsed(false);
    setWidgetConfig(getDefaultWidgetConfig("focused"));
  }

  function clearAllStudentHubData() {
    STUDENT_HUB_STORAGE_KEYS.forEach((storageKey) =>
      localStorage.removeItem(storageKey)
    );

    setTasks([]);
    setCompletedTaskHistory([]);
    setSubjects([]);
    setPlanBlocks([]);
    setPlanMetadata(null);
    setStalePlanDate(null);
    setPlanMoveFeedback(null);
    setShowAddTask(false);
    setNewTask(createEmptyTaskDraft());
    setTheme("light");
    setThemeColors(DEFAULT_THEME_COLORS);
    setLayoutDensity("compact");
    setHomeLayout("focused");
    setRightRailVisible(true);
    setRightRailCollapsed(false);
    setWidgetConfig(getDefaultWidgetConfig("focused"));
    setHoursAvailable(2);
    setStartTime("16:00");
    setSidebarCollapsed(false);
    setHomeEditMode(false);
    setRightRailEditMode(false);
    setActivePage("home");
    setQuickLinksPreferences(loadQuickLinksPreferences());
    setStudentProfile({
      schoolSystem: "",
      onboardingCompleted: false,
      source: "manual",
    });
  }

  if (!studentProfile.onboardingCompleted) {
    return (
      <OnboardingFlow
        studentProfile={studentProfile}
        setStudentProfile={setStudentProfile}
        subjects={subjects}
        setSubjects={setSubjects}
        theme={theme}
        setTheme={setTheme}
        accentColor={accentColor}
        setAccentColor={setAccentColor}
        layoutDensity={layoutDensity}
        setLayoutDensity={setLayoutDensity}
        homeLayout={homeLayout}
        setHomeLayout={updateHomeLayout}
        rightRailVisible={rightRailVisible}
        setRightRailVisible={setRightRailVisible}
        rightRailWidgets={rightRailWidgets}
        setRightRailWidgets={setRightRailWidgets}
        onComplete={completeOnboarding}
      />
    );
  }

  return (
    <main
      className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${
        rightRailVisible ? "right-rail-visible" : ""
      } ${rightRailCollapsed ? "right-rail-collapsed" : ""}`}
    >
      <MobileTopBar activePage={activePage} settingsView={settingsView} />

      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="brand-row">
          <div className="brand">
            <div className="brand-mark">S</div>
            <div className="brand-text">
              <h1>Student Hub</h1>
              <p>School, organised.</p>
            </div>
          </div>

          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label="Toggle sidebar"
          >
            ←
          </button>
        </div>

        <nav
          className={`nav ${
            activePage === "settings" ? "nav-account" : `nav-${activePage}`
          }`}
        >
          <span className="nav-indicator" />
          
          <NavButton
            label="Home"
            icon="⌂"
            active={activePage === "home"}
            onClick={() => setActivePage("home")}
          />
          <NavButton
            label="To-do list"
            icon="✓"
            active={activePage === "tasks"}
            onClick={() => setActivePage("tasks")}
          />
          <NavButton
            label="Today’s Plan"
            icon="◷"
            active={activePage === "plan"}
            onClick={() => setActivePage("plan")}
          />
          <NavButton
            label="Calendar"
            icon="▦"
            active={activePage === "calendar"}
            onClick={() => setActivePage("calendar")}
          />
          <NavButton
            label="Subjects"
            icon="◈"
            active={activePage === "subjects"}
            onClick={() => setActivePage("subjects")}
          />

          <QuickLinksNav
            collapsed={sidebarCollapsed}
            quickLinksPreferences={quickLinksPreferences}
            openSettings={openSettings}
          />
        </nav>

        <AccountMenu
          collapsed={sidebarCollapsed}
          active={activePage === "settings"}
          openSettings={openSettings}
          displayName={studentProfile.displayName || studentProfile.name || "Student"}
          theme={theme}
          setTheme={setTheme}
          themeColors={themeColors}
        />
      </aside>

      <section className="main-content">
        {activePage === "home" && (
          <HomePage
            tasks={visibleTasks}
            subjects={subjects}
            activeTasks={activeTasks}
            completedTasks={completedTasks}
            noDeadlineTasks={noDeadlineTasks}
            visibleBacklog={visibleBacklog}
            hiddenBacklogCount={hiddenBacklogCount}
            progressPercentage={progressPercentage}
            nextTask={nextTask}
            openSmartPlanner={openSmartPlanner}
            hasPlan={planBlocks.length > 0}
            planBlocks={planBlocks}
            setActivePage={setActivePage}
            homeLayout={homeLayout}
            widgetConfig={widgetConfig}
            setWidgetConfig={setWidgetConfig}
            homeEditMode={homeEditMode}
            setHomeEditMode={setHomeEditMode}
          />
        )}

        {activePage === "tasks" && (
          <TasksPage
            subjects={subjects}
            activeTasks={activeTasks}
            backlogTasks={backlogTasks}
            visibleBacklog={visibleBacklog}
            hiddenBacklogCount={hiddenBacklogCount}
            noDeadlineTasks={noDeadlineTasks}
            completedTasks={completedTasks}
            showAddTask={showAddTask}
            setShowAddTask={setShowAddTask}
            newTask={newTask}
            setNewTask={setNewTask}
            addTask={addTask}
            toggleTask={toggleTask}
            deleteTask={deleteTask}
            updateTask={updateTask}
          />
        )}

        {activePage === "plan" && (
          <PlanPage
            planBlocks={planBlocks}
            planMetadata={planBlocks.length > 0 ? planMetadata : null}
            clearPlan={clearPlan}
            addManualPlanBlock={addManualPlanBlock}
            movePlanStudyBlock={movePlanStudyBlock}
            updatePlanBlockDuration={updatePlanBlockDuration}
            removePlanBlock={removePlanBlock}
            togglePlanBlockLocked={togglePlanBlockLocked}
            reorderPlanBlock={reorderPlanBlock}
            planMoveFeedback={planMoveFeedback}
            completeTaskFromPlan={completeTaskFromPlan}
            stalePlanDate={stalePlanDate}
            startFreshPlan={startFreshPlan}
            openSmartPlanner={openSmartPlanner}
          />
        )}

        {activePage === "calendar" && (
          <CalendarPage
            tasks={visibleTasks}
            subjects={subjects}
            setActivePage={setActivePage}
            addTaskToList={addTaskToList}
          />
        )}

        {activePage === "subjects" && (
          <SubjectsPage
            subjects={subjects}
            tasks={visibleTasks}
            completedTaskHistory={completedTaskHistory}
            setActivePage={setActivePage}
            openSettings={openSettings}
          />
        )}

        {activePage === "settings" && (
          <SettingsPage
            tasks={tasks}
            subjects={subjects}
            setSubjects={setSubjects}
            theme={theme}
            setTheme={setTheme}
            themeColors={themeColors}
            setThemeColors={setThemeColors}
            saveThemeColorPreferences={saveThemeColorPreferences}
            themeColorPalettes={themeColorPalettes}
            layoutDensity={layoutDensity}
            setLayoutDensity={setLayoutDensity}
            homeLayout={homeLayout}
            setHomeLayout={updateHomeLayout}
            rightRailVisible={rightRailVisible}
            setRightRailVisible={updateRightRailVisibility}
            openHomeEditMode={openHomeEditMode}
            openRightRailEditMode={openRightRailEditMode}
            restartOnboarding={restartOnboarding}
            resetTasks={resetTasks}
            resetSubjects={resetSubjects}
            resetAppearancePreferences={resetAppearancePreferences}
            clearAllStudentHubData={clearAllStudentHubData}
            loadDemoWorkspace={loadDemoWorkspace}
            removeDemoData={removeDemoData}
            hasDemoTasks={hasDemoTasks}
            hasDemoData={hasDemoData}
            importMockClassroomAssignments={importMockClassroomAssignments}
            importRealClassroomAssignments={importRealClassroomAssignments}
            removeMockClassroomTasks={removeMockClassroomTasks}
            archiveNoDueDateClassroomTasks={archiveNoDueDateClassroomTasks}
            restoreArchivedClassroomTasks={restoreArchivedClassroomTasks}
            updateMockClassroomCourseSubject={updateMockClassroomCourseSubject}
            quickLinksPreferences={quickLinksPreferences}
            setQuickLinksPreferences={setQuickLinksPreferences}
            initialView={settingsView}
            classroomCallbackStatus={initialNavigation.classroomCallbackStatus}
            googleCalendarCallbackStatus={
              initialNavigation.googleCalendarCallbackStatus
            }
            navigationRequest={settingsNavigationRequest}
          />
        )}
      </section>

      {rightRailVisible && (
        <RightRail
          tasks={visibleTasks}
          planBlocks={planBlocks}
          setActivePage={setActivePage}
          collapsed={rightRailCollapsed}
          setCollapsed={setRightRailCollapsed}
          widgetConfig={widgetConfig}
          setWidgetConfig={setWidgetConfig}
          editMode={rightRailEditMode}
          setEditMode={setRightRailEditMode}
        />
      )}

      <MobileBottomNav
        activePage={activePage}
        moreOpen={mobileMoreOpen}
        onNavigate={navigateMobilePage}
        onToggleMore={() => setMobileMoreOpen((open) => !open)}
      />

      <MobileMoreSheet
        open={mobileMoreOpen}
        onClose={() => setMobileMoreOpen(false)}
        setActivePage={setActivePage}
        openSettings={openSettings}
        quickLinksPreferences={quickLinksPreferences}
        displayName={studentProfile.displayName || studentProfile.name || "Student"}
        theme={theme}
        setTheme={setTheme}
      />

      {smartPlannerOpen && (
        <SmartPlannerModal
          draft={smartPlannerDraft}
          setDraft={setSmartPlannerDraft}
          loading={smartPlannerLoading}
          error={smartPlannerError}
          preview={smartPlannerPreview}
          quota={smartPlannerQuota}
          needsReplace={smartPlannerNeedsReplace}
          hasLockedBlocks={planBlocks.some((block) => block.locked === true)}
          calendarAvailable={calendarBusyTimeIsAvailable()}
          onClose={closeSmartPlanner}
          onGenerate={() => generateSmartPlannerPreview()}
          onPlanWithoutAi={() => generateSmartPlannerPreview({ basic: true })}
          onEditSettings={editSmartPlannerSettings}
          onUsePlan={useSmartPlannerPreview}
        />
      )}

      {activePage === "plan" && eveningPlanSuccess && (
        <EveningPlanSuccessToast
          title={eveningPlanSuccess.title}
          summary={eveningPlanSuccess.summary}
          onClose={() => setEveningPlanSuccess(null)}
        />
      )}
    </main>
  );
}

function EveningPlanSuccessToast({ title, summary, onClose }) {
  return (
    <div className="evening-plan-success-toast" role="status" aria-live="polite">
      <button type="button" aria-label="Dismiss success message" onClick={onClose}>
        ×
      </button>
      <div className="evening-plan-success-check" aria-hidden="true">
        <span>✓</span>
      </div>
      <strong>{title}</strong>
      <p>{summary}</p>
    </div>
  );
}

export default App;
