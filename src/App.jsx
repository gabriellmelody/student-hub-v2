import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./App.css";
import {
  AccountMenu,
  NavButton,
  RightRail,
} from "./components/AppChrome.jsx";
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
  DEFAULT_ACCENT_COLOR,
  STUDENT_HUB_STORAGE_KEYS,
  WIDGET_CONFIG_STORAGE_KEY,
  TODAY_PLAN_STORAGE_KEY,
  normalizeHexColor,
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
  getDefaultEveningPlannerDraft,
  buildEveningPlan,
  createDemoTasks,
  loadCompletedTaskHistory,
  upsertCompletedTaskHistory,
  removeTaskFromCompletedHistory,
  normalizeTask,
  getExternalSourceKey,
} from "./utils/appUtils.js";
import { createTaskFromMockAssignment } from "./utils/classroomMockUtils.js";

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

function getInitialNavigationState() {
  const fallbackState = {
    activePage: "home",
    settingsView: "hub",
    classroomCallbackStatus: null,
  };

  if (typeof window === "undefined") return fallbackState;

  const params = new URLSearchParams(window.location.search);
  const classroomResult = params.get("classroom");
  const opensIntegrations =
    params.get("settings") === "integrations" ||
    classroomResult === "connected" ||
    classroomResult === "error";

  return {
    activePage: opensIntegrations ? "settings" : "home",
    settingsView: opensIntegrations ? "integrations" : "hub",
    classroomCallbackStatus:
      classroomResult === "connected" || classroomResult === "error"
        ? {
            result: classroomResult,
            status: params.get("classroomStatus") || "",
          }
        : null,
  };
}

function App() {
  const [initialNavigation] = useState(getInitialNavigationState);
  const [activePage, setActivePage] = useState(initialNavigation.activePage);
  const [homeEditMode, setHomeEditMode] = useState(false);
  const [rightRailEditMode, setRightRailEditMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("student-hub-theme") === "dark"
      ? "dark"
      : "light";
  });
  const [accentColor, setAccentColor] = useState(() => {
    return normalizeHexColor(localStorage.getItem("student-hub-accent"));
  });
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
  const [stalePlanDate, setStalePlanDate] = useState(() =>
    initialSavedPlan && !savedPlanIsForToday
      ? initialSavedPlan.generatedDate
      : null
  );
  const [planMoveFeedback, setPlanMoveFeedback] = useState(null);
  const planMoveFeedbackTimerRef = useRef(null);
  const [eveningPlannerOpen, setEveningPlannerOpen] = useState(false);
  const [eveningPlannerDraft, setEveningPlannerDraft] = useState(
    getDefaultEveningPlannerDraft
  );
  const [eveningPlannerError, setEveningPlannerError] = useState("");
  const [eveningPlannerNeedsReplace, setEveningPlannerNeedsReplace] =
    useState(false);
  const [eveningPlanSuccess, setEveningPlanSuccess] = useState(null);
  const eveningPlanSuccessTimerRef = useRef(null);

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

  function openSettings() {
    setActivePage("settings");
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

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("student-hub-theme", theme);
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
    });
  }, [planBlocks, startTime, hoursAvailable, stalePlanDate]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const readableAccent = getReadableAccent(accentColor, theme);
    const hoverTarget = theme === "dark" ? "#ffffff" : "#18181b";
    const movedSurface = theme === "dark" ? "#202024" : "#ffffff";

    root.style.setProperty("--accent", accentColor);
    root.style.setProperty(
      "--accent-hover",
      mixColors(accentColor, hoverTarget, 0.12)
    );
    root.style.setProperty("--accent-soft", readableAccent);
    root.style.setProperty("--accent-contrast", getContrastText(accentColor));
    root.style.setProperty(
      "--accent-tint",
      colorToRgba(accentColor, theme === "dark" ? 0.14 : 0.09)
    );
    root.style.setProperty(
      "--accent-border",
      colorToRgba(accentColor, theme === "dark" ? 0.3 : 0.2)
    );
    root.style.setProperty(
      "--moved-border",
      colorToRgba(accentColor, theme === "dark" ? 0.72 : 0.48)
    );
    root.style.setProperty(
      "--moved-bg",
      mixColors(movedSurface, accentColor, theme === "dark" ? 0.1 : 0.06)
    );
    root.style.setProperty(
      "--moved-shadow",
      colorToRgba(accentColor, theme === "dark" ? 0.16 : 0.12)
    );
    localStorage.setItem("student-hub-accent", accentColor);
  }, [accentColor, theme]);

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
    }, 3600);

    return () => clearTimeout(eveningPlanSuccessTimerRef.current);
  }, [eveningPlanSuccess]);

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
  }

  function clearPlan() {
    setPlanBlocks((currentBlocks) =>
      recalculatePlanTimes(
        currentBlocks.filter((block) => block.locked === true),
        startTime
      )
    );
  }

  function startFreshPlan() {
    localStorage.removeItem(TODAY_PLAN_STORAGE_KEY);
    setStalePlanDate(null);
    setPlanBlocks([]);
    setPlanMoveFeedback(null);
  }

  function addManualPlanBlock(blockInput) {
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

  function openEveningPlanner() {
    setEveningPlannerDraft(getDefaultEveningPlannerDraft());
    setEveningPlannerError("");
    setEveningPlannerNeedsReplace(false);
    setEveningPlannerOpen(true);
  }

  function closeEveningPlanner() {
    setEveningPlannerOpen(false);
    setEveningPlannerError("");
    setEveningPlannerNeedsReplace(false);
  }

  function createEveningPlan({ replaceExisting = false } = {}) {
    if (planBlocks.length > 0 && !replaceExisting) {
      setEveningPlannerNeedsReplace(true);
      setEveningPlannerError("");
      return;
    }

    if (replaceExisting && planBlocks.some((block) => block.locked === true)) {
      setEveningPlannerError("Unlock locked blocks before replacing tonight’s plan.");
      setEveningPlannerNeedsReplace(false);
      return;
    }

    const result = buildEveningPlan({
      tasks: visibleTasks,
      startTime: eveningPlannerDraft.startTime,
      endTime: eveningPlannerDraft.endTime,
      energy: eveningPlannerDraft.energy,
      includeBreaks: eveningPlannerDraft.includeBreaks,
      maxFocusMinutes: eveningPlannerDraft.maxFocusMinutes,
      planStyle: eveningPlannerDraft.planStyle,
    });

    if (!result.ok) {
      setEveningPlannerError(result.reason);
      setEveningPlannerNeedsReplace(false);
      return;
    }

    setStalePlanDate(null);
    setStartTime(eveningPlannerDraft.startTime);
    setHoursAvailable(Number((result.windowMinutes / 60).toFixed(2)));
    setPlanBlocks(recalculatePlanTimes(result.blocks, eveningPlannerDraft.startTime));
    setActivePage("plan");
    closeEveningPlanner();
    setEveningPlanSuccess({
      title: "Evening planned",
      summary: `${result.scheduledTaskCount} task${
        result.scheduledTaskCount === 1 ? "" : "s"
      } scheduled`,
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
      "student-hub-density",
      "student-hub-home-layout",
      "student-hub-right-rail",
      "student-hub-right-rail-state",
      "student-hub-right-rail-widgets",
      WIDGET_CONFIG_STORAGE_KEY,
    ].forEach((storageKey) => localStorage.removeItem(storageKey));

    setTheme("light");
    setAccentColor(DEFAULT_ACCENT_COLOR);
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
    setStalePlanDate(null);
    setPlanMoveFeedback(null);
    setShowAddTask(false);
    setNewTask(createEmptyTaskDraft());
    setTheme("light");
    setAccentColor(DEFAULT_ACCENT_COLOR);
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
        </nav>

        <AccountMenu
          collapsed={sidebarCollapsed}
          active={activePage === "settings"}
          openSettings={openSettings}
        />

        <div className="sidebar-footer">
          <p>
            {completedTasks.length}/{visibleTasks.length} tasks done
          </p>
          <div className="mini-progress-track">
            <div
              className="mini-progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
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
            hoursAvailable={hoursAvailable}
            setHoursAvailable={setHoursAvailable}
            startTime={startTime}
            setStartTime={updatePlanStartTime}
            progressPercentage={progressPercentage}
            nextTask={nextTask}
            generatePlan={generatePlan}
            openEveningPlanner={openEveningPlanner}
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
            startTime={startTime}
            setStartTime={updatePlanStartTime}
            generatePlan={generatePlan}
            clearPlan={clearPlan}
            addManualPlanBlock={addManualPlanBlock}
            movePlanStudyBlock={movePlanStudyBlock}
            updatePlanBlockDuration={updatePlanBlockDuration}
            removePlanBlock={removePlanBlock}
            togglePlanBlockLocked={togglePlanBlockLocked}
            reorderPlanBlock={reorderPlanBlock}
            planMoveFeedback={planMoveFeedback}
            completeTaskFromPlan={completeTaskFromPlan}
            hoursAvailable={hoursAvailable}
            setHoursAvailable={setHoursAvailable}
            stalePlanDate={stalePlanDate}
            startFreshPlan={startFreshPlan}
            openEveningPlanner={openEveningPlanner}
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
          />
        )}

        {activePage === "settings" && (
          <SettingsPage
            tasks={tasks}
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
            initialView={initialNavigation.settingsView}
            classroomCallbackStatus={initialNavigation.classroomCallbackStatus}
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

      {eveningPlannerOpen && (
        <EveningPlannerModal
          draft={eveningPlannerDraft}
          setDraft={setEveningPlannerDraft}
          error={eveningPlannerError}
          needsReplace={eveningPlannerNeedsReplace}
          onClose={closeEveningPlanner}
          onPlan={() => createEveningPlan()}
          onReplace={() => createEveningPlan({ replaceExisting: true })}
        />
      )}

      {eveningPlanSuccess && (
        <EveningPlanSuccessToast
          title={eveningPlanSuccess.title}
          summary={eveningPlanSuccess.summary}
          onClose={() => setEveningPlanSuccess(null)}
        />
      )}
    </main>
  );
}

function EveningPlannerModal({
  draft,
  setDraft,
  error,
  needsReplace,
  onClose,
  onPlan,
  onReplace,
}) {
  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function updateDraft(field, value) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  function submitPlan(event) {
    event.preventDefault();
    onPlan();
  }

  return (
    <div
      className="evening-planner-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="evening-planner-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evening-planner-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form onSubmit={submitPlan}>
          <header className="evening-planner-header">
            <div>
              <p className="eyebrow">Tonight</p>
              <h3 id="evening-planner-title">Plan my evening</h3>
              <p>Choose when you’re free. You can edit it after.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close planner">
              ×
            </button>
          </header>

          <div className="evening-planner-fields">
            <label>
              <span>Start</span>
              <input
                type="time"
                value={draft.startTime}
                onChange={(event) => updateDraft("startTime", event.target.value)}
              />
            </label>
            <label>
              <span>End</span>
              <input
                type="time"
                value={draft.endTime}
                onChange={(event) => updateDraft("endTime", event.target.value)}
              />
            </label>
          </div>

          <section className="evening-plan-options">
            <div>
              <strong>Plan options</strong>
              <p>Adjust how intense tonight’s plan should feel.</p>
            </div>

            <label className="evening-break-toggle">
              <span>Include breaks</span>
              <button
                type="button"
                className={draft.includeBreaks ? "active" : ""}
                aria-pressed={draft.includeBreaks}
                onClick={() => updateDraft("includeBreaks", !draft.includeBreaks)}
              >
                {draft.includeBreaks ? "Yes" : "No"}
              </button>
            </label>

            <label>
              <span>Max focus block</span>
              <select
                value={draft.maxFocusMinutes}
                onChange={(event) =>
                  updateDraft("maxFocusMinutes", Number(event.target.value))
                }
              >
                <option value={25}>25 min</option>
                <option value={35}>35 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </label>

            <label>
              <span>Plan style</span>
              <select
                value={draft.planStyle}
                onChange={(event) => updateDraft("planStyle", event.target.value)}
              >
                <option value="light">Light</option>
                <option value="balanced">Balanced</option>
                <option value="push">Push me</option>
              </select>
            </label>
          </section>

          <div className="evening-energy-row" aria-label="Energy level">
            <span>Energy</span>
            {[
              ["low", "Low"],
              ["normal", "Normal"],
              ["high", "High"],
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={draft.energy === value ? "active" : ""}
                aria-pressed={draft.energy === value}
                onClick={() => updateDraft("energy", value)}
              >
                {label}
              </button>
            ))}
          </div>

          {needsReplace && (
            <div className="evening-planner-notice">
              <strong>Replace tonight’s plan?</strong>
              <p>You already have a plan. Replace it with this evening plan?</p>
            </div>
          )}

          {error && <p className="evening-planner-error">{error}</p>}

          <footer className="evening-planner-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            {needsReplace ? (
              <button type="button" className="primary-button" onClick={onReplace}>
                Replace tonight’s plan
              </button>
            ) : (
              <button type="submit" className="primary-button">
                Create evening plan
              </button>
            )}
          </footer>
        </form>
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
