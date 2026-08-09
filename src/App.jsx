import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import "./App.css";
import {
  AccountMenu,
  MobileBottomNav,
  MobileMoreSheet,
  MobileTopBar,
  NavButton,
  QuickLinksNav,
  SettingsShortcut,
} from "./components/AppChrome.jsx";
import SmartPlannerModal from "./components/SmartPlannerModal.jsx";
import GuidedTour from "./components/GuidedTour.jsx";
import ReleaseWelcomeModal from "./components/ReleaseWelcomeModal.jsx";
import EditLocalProfileModal from "./components/EditLocalProfileModal.jsx";
import DayloMark from "./components/DayloMark.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import OnboardingFlow from "./pages/Onboarding.jsx";
import PlanPage from "./pages/PlanPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import SubjectsPage from "./pages/SubjectsPage.jsx";
import TasksPage from "./pages/TasksPage.jsx";
import {
  COMPLETED_HISTORY_STORAGE_KEY,
  DEFAULT_THEME_COLORS,
  themeColorPalettes,
  STUDENT_HUB_STORAGE_KEYS,
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
  loadSubjects,
  loadStudentProfile,
  getDaysLeft,
  hasRealDueDate,
  formatTime,
  getTaskTip,
  sortTasksForDisplay,
  cleanPlanSequence,
  recalculatePlanTimes,
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
  createQuickTaskDraft,
  getExternalSourceKey,
} from "./utils/appUtils.js";
import { createTaskFromMockAssignment } from "./utils/classroomMockUtils.js";
import {
  getBusyGoogleCalendarIdsFromStorage,
  loadGoogleCalendarAccountMeta,
} from "./utils/googleCalendarStorage.js";
import {
  buildSmartPlannerTaskPayload,
  buildSmartPlannerSubjectProfiles,
  formatLocalDate,
  formatPlannerPreviewTime,
  getDefaultSmartPlannerDraft,
  getSmartPlannerLocalContext,
  shouldRequestSmartPlannerAi,
  timeStringToMinute,
} from "./utils/smartPlannerUtils.js";
import {
  clearOnboardingDraft,
  completeOnboardingProfile,
  loadOnboardingPlanningPreferences,
  shouldShowOnboarding,
} from "./utils/onboardingUtils.js";
import useGuidedTour from "./hooks/useGuidedTour.js";
import usePwaInstall from "./hooks/usePwaInstall.js";
import usePwaUpdate from "./hooks/usePwaUpdate.js";
import { getGuidedTourDefinition } from "./data/guidedTours.js";
import {
  CURRENT_DAYLO_VERSION,
  currentDayloRelease,
} from "./data/releaseNotes.js";
import {
  claimGuidedTourStartup,
  removeTourRequestFromUrl,
  resolveForcedTourRequest,
  shouldCloseTourOpenedModal,
} from "./utils/guidedTourUtils.js";
import {
  isGuidedTourEligible,
  loadGuidedTourProgress,
  saveGuidedTourOutcome,
  shouldAutomaticallyStartGettingStarted,
} from "./utils/guidedTourStorage.js";
import {
  acknowledgeReleaseVersion,
  getInitialTourExitAction,
  loadAcknowledgedReleaseVersion,
  shouldShowReleaseWelcome,
} from "./utils/releaseWelcomeUtils.js";
import {
  getInstallActionLabel,
  getInstallStatusLabel,
  getOfflineMessage,
  shouldShowInstallSuggestion,
} from "./utils/pwaInstallUtils.js";
import { getUpdateErrorMessage, shouldShowUpdatePrompt } from "./utils/pwaUpdateUtils.js";
import {
  MOBILE_SWIPE_EDGE_GUARD_PX,
  MOBILE_SWIPE_PAGES,
  getNavigationDirection,
  getPagerCleanupPage,
  getPagerDragState,
  getPagerPanelTransforms,
  getPagerSettleDuration,
  getPagerSettleTargets,
  getSwipeIntent,
  shouldCommitPagerNavigation,
  shouldIgnorePageSwipeTarget,
} from "./utils/mobileNavigationUtils.js";
import {
  CLASSROOM_SETUP_TOUR_ID,
  clearClassroomSetupResume,
  markClassroomSetupIntroSeen,
} from "./utils/classroomSetupTourUtils.js";
import {
  clearLocalProfile,
  loadLocalProfile,
  saveLocalProfile,
} from "./utils/localProfileUtils.js";

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

function getPreferredSmartPlannerDraft(options = {}) {
  const draft = getDefaultSmartPlannerDraft(options);
  const preferences = loadOnboardingPlanningPreferences();

  if (!preferences) return draft;

  return {
    ...draft,
    startTime: preferences.startTime,
    endTime: preferences.endTime,
    planStyle: preferences.planStyle,
    noTimeLeftToday: false,
  };
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [mobilePager, setMobilePager] = useState(null);
  const [suppressMobilePageEnter, setSuppressMobilePageEnter] = useState(false);
  const mainContentRef = useRef(null);
  const mobileSwipeStartRef = useRef(null);
  const mobilePagerRef = useRef(null);
  const mobilePagerTimerRef = useRef(null);
  const mobilePagerCurrentRef = useRef(null);
  const mobilePagerAdjacentRef = useRef(null);
  const mobilePagerFrameRef = useRef(null);
  const mobilePagerRafRef = useRef(null);
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
  const [subjects, setSubjects] = useState(loadSubjects);
  const [studentProfile, setStudentProfile] = useState(loadStudentProfile);
  const [localProfile, setLocalProfile] = useState(loadLocalProfile);
  const [localProfileEditorOpen, setLocalProfileEditorOpen] = useState(false);
  const [lastSeenDayloVersion, setLastSeenDayloVersion] = useState(
    loadAcknowledgedReleaseVersion
  );
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
    getPreferredSmartPlannerDraft()
  );
  const [smartPlannerError, setSmartPlannerError] = useState("");
  const [smartPlannerPreview, setSmartPlannerPreview] = useState(null);
  const [smartPlannerNeedsReplace, setSmartPlannerNeedsReplace] =
    useState(false);
  const [smartPlannerLoading, setSmartPlannerLoading] = useState(false);
  const [smartPlannerQuota, setSmartPlannerQuota] = useState({
    remainingGenerations: null,
    dailyLimit: 3,
    resetAt: null,
    configured: null,
    status: "unknown",
    loading: false,
    error: "",
  });
  const smartPlannerRequestRef = useRef({ id: 0, controller: null });
  const smartPlannerStatusRequestRef = useRef(null);
  const [eveningPlanSuccess, setEveningPlanSuccess] = useState(null);
  const eveningPlanSuccessTimerRef = useRef(null);
  const smartPlannerTourOpenedModalRef = useRef(false);
  const tourStartPendingRef = useRef(false);
  const [releaseWelcomeOpen, setReleaseWelcomeOpen] = useState(false);
  const [installInstructionsOpen, setInstallInstructionsOpen] = useState(false);
  const [installSuggestionReady, setInstallSuggestionReady] = useState(false);
  const [textEntryActive, setTextEntryActive] = useState(false);
  const [classroomSetupTourRequest, setClassroomSetupTourRequest] = useState(0);
  const classroomSetupTourStarterRef = useRef(null);
  const pwaInstall = usePwaInstall();
  const pwaUpdate = usePwaUpdate();
  const guidedTour = useGuidedTour({
    onExit: ({ tour, status }) => {
      if (tour?.persistOutcome !== false) {
        saveGuidedTourOutcome(tour, status);
      }

      const initialTourExit = getInitialTourExitAction(tour, status);

      if (initialTourExit.returnHome) {
        setMobileMoreOpen(false);
        setActivePage("home");
      }

      if (
        tour?.id === "smart-planner" &&
        shouldCloseTourOpenedModal(smartPlannerTourOpenedModalRef.current)
      ) {
        smartPlannerTourOpenedModalRef.current = false;
        closeSmartPlanner();
      }

      if (tour?.id === CLASSROOM_SETUP_TOUR_ID) {
        clearClassroomSetupResume();
      }
    },
  });
  const startGuidedTourBase = guidedTour.startTour;
  const startGuidedTour = useCallback(
    (tour, starterElement) => {
      tourStartPendingRef.current = true;
      const started = startGuidedTourBase(tour, starterElement);

      if (!started) tourStartPendingRef.current = false;
      return started;
    },
    [startGuidedTourBase]
  );
  const guidedTourRequestHandledRef = useRef(false);

  useEffect(() => {
    if (guidedTour.isTourActive) tourStartPendingRef.current = false;
  }, [guidedTour.isTourActive]);

  const applySmartPlannerQuotaResponse = useCallback((result) => {
    if (!result || typeof result !== "object") return;

    setSmartPlannerQuota((current) => {
      const remainingGenerations = Number.isInteger(result.remainingGenerations)
        ? Math.max(0, result.remainingGenerations)
        : current.remainingGenerations;
      const dailyLimit = Number.isInteger(result.dailyLimit)
        ? Math.max(1, result.dailyLimit)
        : current.dailyLimit;
      const safeStatuses = new Set([
        "ready",
        "daily_limit_reached",
        "unavailable",
        "configuration_error",
      ]);
      let status = safeStatuses.has(result.status)
        ? result.status
        : current.status;

      if (result.status === "plan_ready") {
        status = remainingGenerations === 0 ? "daily_limit_reached" : "ready";
      }

      return {
        ...current,
        remainingGenerations,
        dailyLimit,
        resetAt:
          typeof result.resetAt === "string" || result.resetAt === null
            ? result.resetAt
            : current.resetAt,
        configured:
          typeof result.configured === "boolean"
            ? result.configured
            : current.configured,
        status,
        error: "",
      };
    });
  }, []);

  const refreshSmartPlannerStatus = useCallback(({ forceFresh = false } = {}) => {
    if (smartPlannerStatusRequestRef.current) {
      if (forceFresh) {
        return smartPlannerStatusRequestRef.current.then(() =>
          refreshSmartPlannerStatus()
        );
      }
      return smartPlannerStatusRequestRef.current;
    }

    setSmartPlannerQuota((current) => ({
      ...current,
      loading: true,
      error: "",
    }));

    const pendingRequest = (async () => {
      try {
        const response = await fetch("/api/smart-planner/generate", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Student-Hub-Request": "smart-planner",
          },
          body: JSON.stringify({ action: "status" }),
        });
        const result = await response.json().catch(() => null);

        if (!response.ok || result?.ok !== true) {
          throw new Error("status_unavailable");
        }

        applySmartPlannerQuotaResponse(result);
        setSmartPlannerQuota((current) => ({
          ...current,
          loading: false,
          error: "",
        }));
        return result;
      } catch {
        setSmartPlannerQuota((current) => ({
          ...current,
          loading: false,
          error: "Smart Planner status could not be refreshed.",
        }));
        return null;
      }
    })();

    smartPlannerStatusRequestRef.current = pendingRequest;
    pendingRequest.finally(() => {
      if (smartPlannerStatusRequestRef.current === pendingRequest) {
        smartPlannerStatusRequestRef.current = null;
      }
    });
    return pendingRequest;
  }, [applySmartPlannerQuotaResponse]);

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

  const calendarBusyTimeIsAvailable = useCallback(
    () =>
      getBusyGoogleCalendarIds().length > 0 &&
      Boolean(loadGoogleCalendarAccountMeta()?.accountId),
    []
  );

  const openSmartPlanner = useCallback(() => {
    const calendarAvailable = calendarBusyTimeIsAvailable();

    setEveningPlanSuccess(null);
    setSmartPlannerDraft(
      getPreferredSmartPlannerDraft({ calendarAvailable })
    );
    setSmartPlannerError("");
    setSmartPlannerPreview(null);
    setSmartPlannerNeedsReplace(false);
    setSmartPlannerLoading(false);
    setSmartPlannerOpen(true);
  }, [calendarBusyTimeIsAvailable]);

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

  useEffect(() => {
    if (guidedTourRequestHandledRef.current) return;

    const forcedRequest = resolveForcedTourRequest(
      window.location.search,
      getGuidedTourDefinition
    );
    const requestedTourId = forcedRequest.id;
    const requestedTour = forcedRequest.tour;
    const blockingUiOpen = Boolean(
      mobileMoreOpen || eveningPlanSuccess || showAddTask || releaseWelcomeOpen
    );

    if (requestedTourId) {
      if (!requestedTour) {
        claimGuidedTourStartup(guidedTourRequestHandledRef);
        window.history.replaceState(
          window.history.state,
          "",
          removeTourRequestFromUrl(window.location.href)
        );
        return;
      }

      if (
        !studentProfile.onboardingCompleted ||
        blockingUiOpen ||
        (smartPlannerOpen && requestedTour.id !== "smart-planner")
      ) {
        return;
      }

      let tourToStart = requestedTour;

      if (requestedTour.id === "smart-planner") {
        const plannerWasAlreadyOpen = smartPlannerOpen;
        smartPlannerTourOpenedModalRef.current = false;
        tourToStart = {
          ...requestedTour,
          steps: requestedTour.steps.map((step, index) =>
            index === 0
              ? {
                  ...step,
                  beforeShow: () => {
                    if (!plannerWasAlreadyOpen) {
                      smartPlannerTourOpenedModalRef.current = true;
                      openSmartPlanner();
                    }
                  },
                }
              : step
          ),
        };
      }

      if (!claimGuidedTourStartup(guidedTourRequestHandledRef)) return;
      window.history.replaceState(
        window.history.state,
        "",
        removeTourRequestFromUrl(window.location.href)
      );
      startGuidedTour(tourToStart);
      return;
    }

    const gettingStartedTour = getGuidedTourDefinition("getting-started");
    const eligible = isGuidedTourEligible(
      gettingStartedTour,
      loadGuidedTourProgress()
    );

    if (
      !shouldAutomaticallyStartGettingStarted({
        onboardingCompleted: studentProfile.onboardingCompleted,
        blockingUiOpen: blockingUiOpen || smartPlannerOpen,
        oauthCallbackActive: Boolean(
          initialNavigation.classroomCallbackStatus ||
            initialNavigation.googleCalendarCallbackStatus
        ),
        tourAlreadyActive: guidedTour.isTourActive,
        eligible,
      })
    ) {
      if (studentProfile.onboardingCompleted && !eligible) {
        claimGuidedTourStartup(guidedTourRequestHandledRef);
      }
      return;
    }

    if (!claimGuidedTourStartup(guidedTourRequestHandledRef)) return;
    startGuidedTour(gettingStartedTour);
  }, [
    eveningPlanSuccess,
    guidedTour.isTourActive,
    initialNavigation.classroomCallbackStatus,
    initialNavigation.googleCalendarCallbackStatus,
    mobileMoreOpen,
    openSmartPlanner,
    releaseWelcomeOpen,
    showAddTask,
    smartPlannerOpen,
    startGuidedTour,
    studentProfile.onboardingCompleted,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => setInstallSuggestionReady(true), 18000);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    function syncTextEntryActive() {
      const activeElement = document.activeElement;
      setTextEntryActive(
        Boolean(
          activeElement?.matches?.(
            "input, textarea, select, [contenteditable='true']"
          )
        )
      );
    }

    document.addEventListener("focusin", syncTextEntryActive);
    document.addEventListener("focusout", syncTextEntryActive);

    return () => {
      document.removeEventListener("focusin", syncTextEntryActive);
      document.removeEventListener("focusout", syncTextEntryActive);
    };
  }, []);

  const installBlockingUiOpen = Boolean(
    mobileMoreOpen ||
      showAddTask ||
      eveningPlanSuccess ||
      smartPlannerOpen ||
      releaseWelcomeOpen ||
      localProfileEditorOpen ||
      installInstructionsOpen ||
      guidedTour.isTourActive
  );
  const showInstallSuggestion = shouldShowInstallSuggestion({
    capability: pwaInstall.capability,
    dismissed: pwaInstall.suggestionDismissed,
    onboardingCompleted: studentProfile.onboardingCompleted,
    blockingUiOpen: installBlockingUiOpen,
    standalone: pwaInstall.installed,
    elapsedMs: installSuggestionReady ? 18000 : 0,
  });
  const offlineMessage = getOfflineMessage(pwaInstall.online);
  const updateBlockingUiOpen = Boolean(
    installBlockingUiOpen || textEntryActive || showInstallSuggestion
  );
  const showUpdatePrompt = shouldShowUpdatePrompt({
    needRefresh: pwaUpdate.needRefresh,
    blockingUiOpen: updateBlockingUiOpen,
    sessionDismissed: pwaUpdate.sessionDismissed,
    supported: pwaUpdate.supported,
  });
  const updateErrorMessage = getUpdateErrorMessage(pwaUpdate.updateError);


  const installControl = useMemo(
    () => ({
      capability: pwaInstall.capability,
      actionLabel: getInstallActionLabel(pwaInstall.capability),
      statusLabel: getInstallStatusLabel(pwaInstall.capability),
    }),
    [pwaInstall.capability]
  );

  const startInstallFlow = useCallback(async () => {
    if (pwaInstall.capability === "ios-instructions") {
      setInstallInstructionsOpen(true);
      return;
    }

    await pwaInstall.requestInstall();
  }, [pwaInstall]);

  const prefersReducedMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const getMobilePagerViewportWidth = useCallback(() => {
    const width = mainContentRef.current?.getBoundingClientRect().width;
    return Math.max(1, Math.round(width || window.innerWidth || 1));
  }, []);

  const writeMobilePagerTransforms = useCallback(({ currentX = 0, adjacentX = null, transitionMs = 0 }) => {
    const transition = transitionMs
      ? `transform ${transitionMs}ms cubic-bezier(0.22, 1, 0.36, 1)`
      : "none";

    if (mobilePagerCurrentRef.current) {
      mobilePagerCurrentRef.current.style.transition = transition;
      mobilePagerCurrentRef.current.style.transform = `translate3d(${currentX}px, 0, 0)`;
    }

    if (mobilePagerAdjacentRef.current && adjacentX !== null) {
      mobilePagerAdjacentRef.current.style.transition = transition;
      mobilePagerAdjacentRef.current.style.transform = `translate3d(${adjacentX}px, 0, 0)`;
    }
  }, []);

  const scheduleMobilePagerTransforms = useCallback(
    (transforms) => {
      mobilePagerFrameRef.current = transforms;
      if (mobilePagerRafRef.current) return;

      mobilePagerRafRef.current = requestAnimationFrame(() => {
        mobilePagerRafRef.current = null;
        if (mobilePagerFrameRef.current) {
          writeMobilePagerTransforms(mobilePagerFrameRef.current);
        }
      });
    },
    [writeMobilePagerTransforms]
  );

  const finishMobilePager = useCallback((pager = mobilePagerRef.current) => {
    if (!pager) return;

    window.clearTimeout(mobilePagerTimerRef.current);
    const nextPage = getPagerCleanupPage(pager);

    if (pager.commit && nextPage) {
      setActivePage(nextPage);
      setSuppressMobilePageEnter(true);
      requestAnimationFrame(() => {
        setMobilePager(null);
        requestAnimationFrame(() => setSuppressMobilePageEnter(false));
      });
      return;
    }

    setMobilePager(null);
  }, []);

  const settleMobilePager = useCallback(
    ({ from, to, direction, currentOffset = 0, commit, viewportWidth }) => {
      const width = viewportWidth || getMobilePagerViewportWidth();
      const targets = getPagerSettleTargets({ direction, commit, viewportWidth: width });
      const transitionMs = getPagerSettleDuration({
        currentOffset,
        targetOffset: targets.currentX,
        viewportWidth: width,
        reducedMotion: prefersReducedMotion(),
      });
      const nextPager = {
        from,
        to,
        direction,
        viewportWidth: width,
        currentX: targets.currentX,
        adjacentX: targets.adjacentX,
        transitionMs,
        settling: true,
        commit,
      };

      setMobilePager(nextPager);
      requestAnimationFrame(() => writeMobilePagerTransforms({ ...targets, transitionMs }));

      window.clearTimeout(mobilePagerTimerRef.current);
      mobilePagerTimerRef.current = window.setTimeout(() => {
        finishMobilePager(nextPager);
      }, transitionMs + 60);
    },
    [finishMobilePager, getMobilePagerViewportWidth, writeMobilePagerTransforms]
  );

  const startMobilePagerNavigation = useCallback(
    (page) => {
      const direction = getNavigationDirection(activePage, page);
      if (direction === "none") return false;

      const viewportWidth = getMobilePagerViewportWidth();
      const initial = getPagerPanelTransforms({ direction, offset: 0, viewportWidth });

      setMobileMoreOpen(false);
      setMobilePager({
        from: activePage,
        to: page,
        direction,
        viewportWidth,
        currentX: initial.currentX,
        adjacentX: initial.adjacentX,
        transitionMs: 0,
        settling: false,
        boundary: false,
        commit: false,
      });

      requestAnimationFrame(() => {
        writeMobilePagerTransforms({ ...initial, transitionMs: 0 });
        requestAnimationFrame(() => {
          settleMobilePager({
            from: activePage,
            to: page,
            direction,
            currentOffset: 0,
            commit: true,
            viewportWidth,
          });
        });
      });
      return true;
    },
    [activePage, getMobilePagerViewportWidth, settleMobilePager, writeMobilePagerTransforms]
  );

  useEffect(() => {
    mobilePagerRef.current = mobilePager;
  }, [mobilePager]);

  useLayoutEffect(() => {
    if (!mobilePager) return;
    writeMobilePagerTransforms({
      currentX: mobilePager.currentX || 0,
      adjacentX: mobilePager.adjacentX ?? null,
      transitionMs: mobilePager.transitionMs || 0,
    });
  }, [mobilePager, writeMobilePagerTransforms]);

  useEffect(() => {
    return () => {
      window.clearTimeout(mobilePagerTimerRef.current);
      if (mobilePagerRafRef.current) cancelAnimationFrame(mobilePagerRafRef.current);
    };
  }, []);

  const navigateGuidedTour = useCallback((page, nextSettingsView) => {
    setMobileMoreOpen(false);
    if (page === "settings" && nextSettingsView) {
      setSettingsView(nextSettingsView);
      setSettingsNavigationRequest((request) => request + 1);
    }
    setActivePage(page);
  }, []);

  const startClassroomSetupTour = useCallback(
    (context = {}, resumePhase = "") => {
      if (guidedTour.isTourActive || releaseWelcomeOpen) return false;

      const tour = getGuidedTourDefinition(
        CLASSROOM_SETUP_TOUR_ID,
        context,
        resumePhase
      );
      const starterElement = classroomSetupTourStarterRef.current;
      classroomSetupTourStarterRef.current = null;
      return startGuidedTour(tour, starterElement);
    },
    [guidedTour.isTourActive, releaseWelcomeOpen, startGuidedTour]
  );

  const replayGuidedTour = useCallback(
    (tourId, starterElement) => {
      if (guidedTour.isTourActive || releaseWelcomeOpen) return false;

      if (tourId === CLASSROOM_SETUP_TOUR_ID) {
        markClassroomSetupIntroSeen();
        classroomSetupTourStarterRef.current = starterElement || null;
        setMobileMoreOpen(false);
        setSettingsView("integrations");
        setSettingsNavigationRequest((request) => request + 1);
        setActivePage("settings");
        setClassroomSetupTourRequest((request) => request + 1);
        return true;
      }

      const requestedTour = getGuidedTourDefinition(tourId);
      if (!requestedTour) return false;

      let tourToStart = requestedTour;

      if (requestedTour.id === "smart-planner") {
        const plannerWasAlreadyOpen = smartPlannerOpen;
        smartPlannerTourOpenedModalRef.current = false;
        tourToStart = {
          ...requestedTour,
          steps: requestedTour.steps.map((step, index) =>
            index === 0
              ? {
                  ...step,
                  beforeShow: () => {
                    if (!plannerWasAlreadyOpen) {
                      smartPlannerTourOpenedModalRef.current = true;
                      openSmartPlanner();
                    }
                  },
                }
              : step
          ),
        };
      }

      return startGuidedTour(tourToStart, starterElement);
    },
    [
      guidedTour.isTourActive,
      openSmartPlanner,
      releaseWelcomeOpen,
      smartPlannerOpen,
      startGuidedTour,
    ]
  );

  useEffect(() => {
    const gettingStartedTour = getGuidedTourDefinition("getting-started");
    const gettingStartedTourSettled = Boolean(
      gettingStartedTour &&
        !isGuidedTourEligible(
          gettingStartedTour,
          loadGuidedTourProgress()
        )
    );
    const blockingUiOpen = Boolean(
      mobileMoreOpen ||
        showAddTask ||
        eveningPlanSuccess ||
        smartPlannerOpen ||
        releaseWelcomeOpen
    );

    if (
      shouldShowReleaseWelcome({
        currentVersion: CURRENT_DAYLO_VERSION,
        lastSeenVersion: lastSeenDayloVersion,
        activePage,
        onboardingCompleted: studentProfile.onboardingCompleted,
        guidedTourActive: guidedTour.isTourActive,
        gettingStartedTourSettled,
        blockingUiOpen,
        tourStartPending: tourStartPendingRef.current,
      })
    ) {
      setReleaseWelcomeOpen(true);
    }
  }, [
    activePage,
    eveningPlanSuccess,
    guidedTour.isTourActive,
    guidedTour.lastExitReason,
    lastSeenDayloVersion,
    mobileMoreOpen,
    releaseWelcomeOpen,
    showAddTask,
    smartPlannerOpen,
    studentProfile.onboardingCompleted,
  ]);

  const dismissReleaseWelcome = useCallback(() => {
    acknowledgeReleaseVersion(CURRENT_DAYLO_VERSION);
    setLastSeenDayloVersion(CURRENT_DAYLO_VERSION);
    setReleaseWelcomeOpen(false);
  }, []);

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
    if (startMobilePagerNavigation(page)) return;

    setMobileMoreOpen(false);
    setActivePage(page);
  }


  function mobileSwipeIsBlocked() {
    return Boolean(
      mobileMoreOpen ||
        showAddTask ||
        eveningPlanSuccess ||
        smartPlannerOpen ||
        releaseWelcomeOpen ||
        localProfileEditorOpen ||
        installInstructionsOpen ||
        guidedTour.isTourActive ||
        mobilePager?.settling ||
        !MOBILE_SWIPE_PAGES.includes(activePage)
    );
  }

  function handleMobilePagePointerDown(event) {
    if (event.pointerType === "mouse") return;
    const viewportWidth = getMobilePagerViewportWidth();
    if (
      event.clientX <= MOBILE_SWIPE_EDGE_GUARD_PX ||
      event.clientX >= viewportWidth - MOBILE_SWIPE_EDGE_GUARD_PX
    ) {
      return;
    }
    if (mobileSwipeIsBlocked()) return;
    if (shouldIgnorePageSwipeTarget(event.target)) return;

    mobileSwipeStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastTime: event.timeStamp || performance.now(),
      time: event.timeStamp || performance.now(),
      intent: "pending",
      destination: null,
      direction: "none",
      viewportWidth,
      offset: 0,
    };
  }

  function handleMobilePagePointerMove(event) {
    const start = mobileSwipeStartRef.current;
    if (!start || start.pointerId !== event.pointerId || mobileSwipeIsBlocked()) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;

    if (start.intent === "pending") {
      start.intent = getSwipeIntent({ deltaX, deltaY });
      if (start.intent === "vertical") {
        mobileSwipeStartRef.current = null;
        return;
      }
      if (start.intent !== "horizontal") return;
    }

    const drag = getPagerDragState({
      currentPage: activePage,
      deltaX,
      viewportWidth: start.viewportWidth,
    });
    const transforms = getPagerPanelTransforms({
      direction: drag.direction,
      offset: drag.offset,
      viewportWidth: start.viewportWidth,
    });

    start.lastX = event.clientX;
    start.lastTime = event.timeStamp || performance.now();
    start.destination = drag.adjacentPage;
    start.direction = drag.direction;
    start.offset = drag.offset;

    if (!mobilePager || mobilePager.from !== activePage || mobilePager.to !== drag.adjacentPage) {
      setMobilePager({
        from: activePage,
        to: drag.adjacentPage,
        direction: drag.direction,
        viewportWidth: start.viewportWidth,
        currentX: transforms.currentX,
        adjacentX: transforms.adjacentX,
        transitionMs: 0,
        settling: false,
        boundary: drag.boundary,
        commit: false,
      });
    }

    scheduleMobilePagerTransforms({ ...transforms, transitionMs: 0 });

    if (event.cancelable) event.preventDefault();
  }

  function handleMobilePagePointerUp(event) {
    const start = mobileSwipeStartRef.current;
    mobileSwipeStartRef.current = null;

    if (!start || start.pointerId !== event.pointerId || mobileSwipeIsBlocked()) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const intent = start.intent === "pending" ? getSwipeIntent({ deltaX, deltaY }) : start.intent;

    if (intent !== "horizontal") {
      setMobilePager(null);
      return;
    }

    const drag = getPagerDragState({
      currentPage: activePage,
      deltaX,
      viewportWidth: start.viewportWidth,
    });

    if (!drag.adjacentPage) {
      settleMobilePager({
        from: activePage,
        to: null,
        direction: "none",
        currentOffset: drag.offset,
        commit: false,
        viewportWidth: start.viewportWidth,
      });
      return;
    }

    const elapsed = Math.max(1, (event.timeStamp || performance.now()) - start.time);
    const velocityX = deltaX / elapsed;
    const commit = shouldCommitPagerNavigation({
      offset: drag.offset,
      viewportWidth: start.viewportWidth,
      velocityX,
    });

    settleMobilePager({
      from: activePage,
      to: drag.adjacentPage,
      direction: drag.direction,
      currentOffset: drag.offset,
      commit,
      viewportWidth: start.viewportWidth,
    });
  }

  function handleMobilePagePointerCancel() {
    const pager = mobilePager;
    mobileSwipeStartRef.current = null;

    if (!pager || pager.settling) return;
    settleMobilePager({
      from: pager.from || activePage,
      to: pager.to,
      direction: pager.direction,
      currentOffset: mobilePagerFrameRef.current?.currentX ?? pager.currentX ?? 0,
      commit: false,
      viewportWidth: pager.viewportWidth,
    });
  }

  function handleMobilePagerTransitionEnd(event) {
    if (event.target !== mobilePagerCurrentRef.current || !mobilePagerRef.current?.settling) return;
    finishMobilePager(mobilePagerRef.current);
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
    if (!taskInput.title.trim()) {
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

  function addQuickTask(title) {
    return addTaskToList(createQuickTaskDraft(title));
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

  function closeSmartPlannerFromUi() {
    if (guidedTour.activeTour?.id === "smart-planner") {
      guidedTour.skipTour();
    }
    closeSmartPlanner();
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
    const shouldRequestAi = shouldRequestSmartPlannerAi({
      basic,
      remainingGenerations: smartPlannerQuota.remainingGenerations,
    });
    const basicFinishMinute =
      context.startMinute !== null &&
      context.finishMinute !== null &&
      context.finishMinute <= context.startMinute
        ? context.finishMinute + 24 * 60
        : context.finishMinute;
    const validatedFinishMinute = shouldRequestAi
      ? context.finishMinute
      : basicFinishMinute;

    if (
      context.startMinute === null ||
      validatedFinishMinute === null ||
      (shouldRequestAi && validatedFinishMinute <= context.startMinute)
    ) {
      setSmartPlannerError("Choose a finish time after your start time.");
      return;
    }

    if (context.startMinute < context.currentMinute) {
      setSmartPlannerError("Choose a start time that has not passed.");
      return;
    }

    if (validatedFinishMinute - context.startMinute < 15) {
      setSmartPlannerError("There isn’t enough time left to build today’s plan.");
      return;
    }

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

    const subjectProfiles = buildSmartPlannerSubjectProfiles(
      subjects,
      eligibleTasks
    );

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
          subjectProfiles,
          busyIntervals: busyIntervals.map((interval) => ({
            startMinute: interval.startMinutes,
            endMinute: interval.endMinutes,
          })),
        }),
      });
      const result = await response.json().catch(() => null);

      if (smartPlannerRequestRef.current.id !== requestId) return;

      applySmartPlannerQuotaResponse(result);

      if (!response.ok || result?.ok !== true || !result.plan) {
        if (result?.status === "daily_limit_reached") {
          void refreshSmartPlannerStatus({ forceFresh: true });
        }
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
      void refreshSmartPlannerStatus({ forceFresh: true });
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
    const savedFinishMinutes =
      smartPlannerPreview.source === "basic" &&
      startMinutes !== null &&
      finishMinutes !== null &&
      finishMinutes <= startMinutes
        ? finishMinutes + 24 * 60
        : finishMinutes;
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
      Number((((savedFinishMinutes || 0) - (startMinutes || 0)) / 60).toFixed(2))
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
    const completedProfile = completeOnboardingProfile(studentProfile);

    setStudentProfile(completedProfile);
    localStorage.setItem(
      "student-hub-student-profile",
      JSON.stringify(completedProfile)
    );
    setActivePage("home");
  }

  function restartOnboarding() {
    clearOnboardingDraft();
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
      "student-hub-widget-config",
    ].forEach((storageKey) => localStorage.removeItem(storageKey));

    setTheme("light");
    setThemeColors(DEFAULT_THEME_COLORS);
    setLayoutDensity("compact");
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
    setHoursAvailable(2);
    setStartTime("16:00");
    setSidebarCollapsed(false);
    setActivePage("home");
    setQuickLinksPreferences(loadQuickLinksPreferences());
    setLastSeenDayloVersion("");
    setReleaseWelcomeOpen(false);
    setLocalProfile(clearLocalProfile());
    setLocalProfileEditorOpen(false);
    setStudentProfile({
      schoolSystem: "",
      onboardingCompleted: false,
      source: "manual",
    });
  }

  function renderAppPage(page) {
    if (page === "home") {
      return (
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
        />
      );
    }

    if (page === "tasks") {
      return (
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
          addQuickTask={addQuickTask}
          toggleTask={toggleTask}
          deleteTask={deleteTask}
          updateTask={updateTask}
        />
      );
    }

    if (page === "plan") {
      return (
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
      );
    }

    if (page === "calendar") {
      return (
        <CalendarPage
          tasks={visibleTasks}
          subjects={subjects}
          setActivePage={setActivePage}
          addTaskToList={addTaskToList}
        />
      );
    }

    if (page === "subjects") {
      return (
        <SubjectsPage
          subjects={subjects}
          tasks={visibleTasks}
          completedTaskHistory={completedTaskHistory}
          setActivePage={setActivePage}
          openSettings={openSettings}
        />
      );
    }

    if (page === "settings") {
      return (
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
          smartPlannerStatus={smartPlannerQuota}
          onRefreshSmartPlannerStatus={refreshSmartPlannerStatus}
          onOpenSmartPlanner={openSmartPlanner}
          onReplayTour={replayGuidedTour}
          activeGuidedTourId={guidedTour.activeTour?.id || ""}
          releaseWelcomeOpen={releaseWelcomeOpen}
          classroomSetupTourRequest={classroomSetupTourRequest}
          onStartClassroomSetupTour={startClassroomSetupTour}
          navigationRequest={settingsNavigationRequest}
          installControl={installControl}
          onInstallDayLo={startInstallFlow}
        />
      );
    }

    return null;
  }

  if (shouldShowOnboarding(studentProfile)) {
    return (
      <OnboardingFlow
        studentProfile={studentProfile}
        setStudentProfile={setStudentProfile}
        subjects={subjects}
        setSubjects={setSubjects}
        theme={theme}
        setTheme={setTheme}
        themeColors={themeColors}
        saveThemeColorPreferences={saveThemeColorPreferences}
        themeColorPalettes={themeColorPalettes}
        logoAppearance={themeColors.logoAppearance}
        onComplete={completeOnboarding}
      />
    );
  }

  return (
    <main
      className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
    >
      <MobileTopBar
        activePage={activePage}
        settingsView={settingsView}
        logoAppearance={themeColors.logoAppearance}
        openSettings={openSettings}
      />

      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="brand-row">
          <div className="brand">
            <DayloMark
              className="brand-mark"
              appearance={themeColors.logoAppearance}
            />
            <div className="brand-text">
              <h1>DayLo</h1>
              <p>Student Hub</p>
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

        <SettingsShortcut
          collapsed={sidebarCollapsed}
          active={activePage === "settings"}
          openSettings={openSettings}
        />

        <AccountMenu
          collapsed={sidebarCollapsed}
          active={activePage === "settings"}
          openSettings={openSettings}
          localProfile={localProfile}
          onEditProfile={() => setLocalProfileEditorOpen(true)}
          theme={theme}
          setTheme={setTheme}
          themeColors={themeColors}
        />
      </aside>

      <section
        ref={mainContentRef}
        className={`main-content ${mobilePager ? "mobile-pager-active" : ""} ${
          suppressMobilePageEnter ? "mobile-page-no-enter" : ""
        }`}
        onPointerDown={handleMobilePagePointerDown}
        onPointerMove={handleMobilePagePointerMove}
        onPointerUp={handleMobilePagePointerUp}
        onPointerCancel={handleMobilePagePointerCancel}
      >
        {mobilePager ? (
          <div className="mobile-page-viewport">
            <div
              ref={mobilePagerCurrentRef}
              className="mobile-page-panel mobile-page-panel-current"
              onTransitionEnd={handleMobilePagerTransitionEnd}
            >
              {renderAppPage(mobilePager.from)}
            </div>
            {mobilePager.to && (
              <div
                ref={mobilePagerAdjacentRef}
                className="mobile-page-panel mobile-page-panel-adjacent"
              >
                {renderAppPage(mobilePager.to)}
              </div>
            )}
          </div>
        ) : (
          renderAppPage(activePage)
        )}
      </section>

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
        localProfile={localProfile}
        onEditProfile={() => setLocalProfileEditorOpen(true)}
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
          onClose={closeSmartPlannerFromUi}
          onGenerate={() => generateSmartPlannerPreview()}
          onPlanWithoutAi={() => generateSmartPlannerPreview({ basic: true })}
          onEditSettings={editSmartPlannerSettings}
          onUsePlan={useSmartPlannerPreview}
          guidedTourActive={guidedTour.activeTour?.id === "smart-planner"}
        />
      )}

      {activePage === "plan" && eveningPlanSuccess && (
        <EveningPlanSuccessToast
          title={eveningPlanSuccess.title}
          summary={eveningPlanSuccess.summary}
          onClose={() => setEveningPlanSuccess(null)}
        />
      )}

      {releaseWelcomeOpen && (
        <ReleaseWelcomeModal
          release={currentDayloRelease}
          onDismiss={dismissReleaseWelcome}
        />
      )}

      {localProfileEditorOpen && (
        <EditLocalProfileModal
          profile={localProfile}
          onClose={() => setLocalProfileEditorOpen(false)}
          onSave={(nextProfile) => {
            setLocalProfile(saveLocalProfile(nextProfile));
            setLocalProfileEditorOpen(false);
          }}
        />
      )}

      {showInstallSuggestion && (
        <InstallSuggestionToast
          actionLabel={installControl.actionLabel}
          onInstall={startInstallFlow}
          onDismiss={pwaInstall.dismissSuggestion}
        />
      )}

      {offlineMessage && <OfflineIndicator message={offlineMessage} />}

      {(showUpdatePrompt || updateErrorMessage) && (
        <DayLoUpdateToast
          errorMessage={updateErrorMessage}
          updating={pwaUpdate.updating}
          onUpdate={pwaUpdate.updateNow}
          onLater={pwaUpdate.dismissForSession}
        />
      )}

      {installInstructionsOpen && (
        <InstallInstructionsModal onClose={() => setInstallInstructionsOpen(false)} />
      )}

      <GuidedTour
        activePage={activePage}
        activeSettingsView={settingsView}
        activeStepIndex={guidedTour.activeStepIndex}
        activeTour={guidedTour.activeTour}
        blocked={
          mobileMoreOpen ||
          showAddTask ||
          Boolean(eveningPlanSuccess) ||
          localProfileEditorOpen ||
          (smartPlannerOpen && guidedTour.activeTour?.id !== "smart-planner")
        }
        finishTour={guidedTour.finishTour}
        isTourActive={guidedTour.isTourActive}
        nextStep={guidedTour.nextStep}
        onNavigate={navigateGuidedTour}
        previousStep={guidedTour.previousStep}
        skipTour={guidedTour.skipTour}
      />
      <Analytics />
    </main>
  );
}

function InstallSuggestionToast({ actionLabel, onInstall, onDismiss }) {
  return (
    <div className="app-install-toast" role="status" aria-live="polite">
      <div>
        <strong>Install DayLo</strong>
        <p>Add DayLo to your device for quicker access and an app-like experience.</p>
      </div>
      <div className="app-install-toast-actions">
        {actionLabel && (
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              onInstall();
              onDismiss();
            }}
          >
            {actionLabel}
          </button>
        )}
        <button type="button" className="small-button" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}

function OfflineIndicator({ message }) {
  return (
    <div className="app-offline-indicator" role="status" aria-live="polite">
      {message}
    </div>
  );
}

function DayLoUpdateToast({ errorMessage, updating, onUpdate, onLater }) {
  return (
    <div className="app-update-toast" role="status" aria-live="polite">
      <div>
        <strong>DayLo update available</strong>
        <p>{errorMessage || "A newer version is ready."}</p>
      </div>
      <div className="app-install-toast-actions">
        <button
          type="button"
          className="primary-button"
          disabled={updating}
          onClick={onUpdate}
        >
          {updating ? "Updating…" : "Update now"}
        </button>
        <button
          type="button"
          className="small-button"
          disabled={updating}
          onClick={onLater}
        >
          Later
        </button>
      </div>
    </div>
  );
}

function InstallInstructionsModal({ onClose }) {
  return (
    <div className="install-instructions-layer" role="presentation">
      <button
        type="button"
        className="install-instructions-backdrop"
        aria-label="Close install instructions"
        onClick={onClose}
      />
      <section
        className="install-instructions-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-instructions-title"
      >
        <div className="install-instructions-copy">
          <p className="eyebrow">Add DayLo to your device</p>
          <h2 id="install-instructions-title">Install DayLo</h2>
          <ol>
            <li>Open DayLo in Safari.</li>
            <li>Tap the Share button.</li>
            <li>Choose Add to Home Screen.</li>
            <li>Tap Add.</li>
          </ol>
          <p>DayLo will appear on your Home Screen and open like an app.</p>
        </div>
        <div className="install-instructions-actions">
          <button type="button" className="primary-button" onClick={onClose}>
            Done
          </button>
        </div>
      </section>
    </div>
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
