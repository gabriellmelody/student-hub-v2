import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./App.css";
import { NavButton, RightRail } from "./components/AppChrome.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import OnboardingFlow from "./pages/Onboarding.jsx";
import PlanPage from "./pages/PlanPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import TasksPage from "./pages/TasksPage.jsx";
import {
  COMPLETED_TASK_RETENTION_MS,
  DEFAULT_ACCENT_COLOR,
  STUDENT_HUB_STORAGE_KEYS,
  rightRailWidgetOptions,
  normalizeHexColor,
  mixColors,
  getContrastText,
  getReadableAccent,
  colorToRgba,
  loadTasks,
  loadRightRailWidgets,
  loadSubjects,
  loadStudentProfile,
  getDaysLeft,
  formatTime,
  getTaskTip,
  sortTasksForDisplay,
  cleanPlanSequence,
  recalculatePlanTimes,
} from "./utils/appUtils.js";

function App() {
  const [activePage, setActivePage] = useState("home");
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
  const [rightRailWidgets, setRightRailWidgets] = useState(loadRightRailWidgets);
  const [subjects, setSubjects] = useState(loadSubjects);
  const [studentProfile, setStudentProfile] = useState(loadStudentProfile);

  const [tasks, setTasks] = useState(loadTasks);

  const [hoursAvailable, setHoursAvailable] = useState(() => {
    return localStorage.getItem("student-hub-hours") || 2;
  });

  const [startTime, setStartTime] = useState(() => {
    return localStorage.getItem("student-hub-start-time") || "16:00";
  });

  const [showAddTask, setShowAddTask] = useState(false);
  const [planBlocks, setPlanBlocks] = useState([]);
  const [planMoveFeedback, setPlanMoveFeedback] = useState(null);
  const planMoveFeedbackTimerRef = useRef(null);

  const [newTask, setNewTask] = useState({
    subject: "",
    title: "",
    dueDate: "",
    effort: 2,
  });

  useEffect(() => {
    localStorage.setItem("student-hub-tasks", JSON.stringify(tasks));
  }, [tasks]);

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
      "student-hub-right-rail-widgets",
      JSON.stringify(rightRailWidgets)
    );
  }, [rightRailWidgets]);

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

  const activeTasks = sortTasksForDisplay(
    tasks.filter((task) => {
      const daysLeft = getDaysLeft(task.dueDate);
      return !task.completed && daysLeft !== null && daysLeft <= 14;
    })
  );

  const backlogTasks = sortTasksForDisplay(
    tasks.filter((task) => {
      const daysLeft = getDaysLeft(task.dueDate);
      return !task.completed && daysLeft !== null && daysLeft > 14;
    })
  );

  const noDeadlineTasks = tasks.filter(
    (task) => !task.completed && !task.dueDate
  );

  const completedTasks = tasks.filter((task) => task.completed);

  let visibleBacklog = [];

  if (activeTasks.length === 0) {
    visibleBacklog = backlogTasks;
  } else if (activeTasks.length <= 2) {
    visibleBacklog = backlogTasks.slice(0, 2);
  }

  const hiddenBacklogCount = backlogTasks.length - visibleBacklog.length;

  const progressPercentage =
    tasks.length === 0
      ? 0
      : Math.round((completedTasks.length / tasks.length) * 100);

  const nextTask = [...activeTasks, ...visibleBacklog][0];

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
      setPlanBlocks((currentBlocks) =>
        recalculatePlanTimes(
          cleanPlanSequence(
            currentBlocks.filter((block) => block.taskId !== taskId)
          ),
          startTime
        )
      );
    }
  }

  function completeTaskFromPlan(taskId) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? { ...task, completed: true, completedAt: Date.now() }
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
      tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              subject: updatedTask.subject.trim(),
              title: updatedTask.title.trim(),
              dueDate: updatedTask.dueDate,
              effort: Number(updatedTask.effort),
            }
          : task
      )
    );

    setPlanBlocks([]);
  }

  function clearPlan() {
    setPlanBlocks([]);
  }

  function addTaskToList(taskInput) {
    if (!taskInput.subject.trim() || !taskInput.title.trim()) {
      return false;
    }

    const taskToAdd = {
      id: Date.now(),
      subject: taskInput.subject.trim(),
      title: taskInput.title.trim(),
      dueDate: taskInput.dueDate,
      effort: Number(taskInput.effort),
      completed: false,
    };

    setTasks((currentTasks) => [...currentTasks, taskToAdd]);
    return true;
  }

  function addTask(event) {
    event.preventDefault();

    if (!addTaskToList(newTask)) return;

    setNewTask({
      subject: "",
      title: "",
      dueDate: "",
      effort: 2,
    });

    setShowAddTask(false);
  }

  function generatePlan() {
    const availableMinutes = Math.round(Number(hoursAvailable) * 60);

    if (!availableMinutes || availableMinutes < 20) {
      setPlanBlocks([
        {
          id: "not-enough-time",
          type: "message",
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
          title: "No tasks to plan.",
          note: "You are clear for now.",
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
        taskId: task.id,
        subject: task.subject,
        title: task.title,
        start: formatTime(startTime, currentOffset),
        end: formatTime(startTime, currentOffset + duration),
        duration,
        effort: task.effort,
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

  function movePlanStudyBlock(taskId, direction) {
    const studyPositions = planBlocks.reduce((positions, block, index) => {
      if (block.type === "study") positions.push(index);
      return positions;
    }, []);
    const currentStudyIndex = studyPositions.findIndex(
      (blockIndex) => planBlocks[blockIndex].taskId === taskId
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
    [reorderedPlan[currentPosition], reorderedPlan[nextPosition]] = [
      reorderedPlan[nextPosition],
      reorderedPlan[currentPosition],
    ];

    setPlanBlocks(recalculatePlanTimes(reorderedPlan, startTime));
    setPlanMoveFeedback((currentFeedback) => ({
      taskId,
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
    setPlanBlocks((currentBlocks) =>
      recalculatePlanTimes(
        cleanPlanSequence(
          currentBlocks.filter((block) => block.id !== blockId)
        ),
        startTime
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
    setActivePage("home");
  }

  function resetTasks() {
    localStorage.removeItem("student-hub-tasks");
    setTasks([]);
    setPlanBlocks([]);
    setPlanMoveFeedback(null);
    setShowAddTask(false);
  }

  function resetSubjects() {
    localStorage.removeItem("student-hub-subjects");
    setSubjects([]);
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
    ].forEach((storageKey) => localStorage.removeItem(storageKey));

    setTheme("light");
    setAccentColor(DEFAULT_ACCENT_COLOR);
    setLayoutDensity("compact");
    setHomeLayout("focused");
    setRightRailVisible(true);
    setRightRailCollapsed(false);
    setRightRailWidgets(
      rightRailWidgetOptions.map((option) => option.value)
    );
  }

  function clearAllStudentHubData() {
    STUDENT_HUB_STORAGE_KEYS.forEach((storageKey) =>
      localStorage.removeItem(storageKey)
    );

    setTasks([]);
    setSubjects([]);
    setPlanBlocks([]);
    setPlanMoveFeedback(null);
    setShowAddTask(false);
    setNewTask({ subject: "", title: "", dueDate: "", effort: 2 });
    setTheme("light");
    setAccentColor(DEFAULT_ACCENT_COLOR);
    setLayoutDensity("compact");
    setHomeLayout("focused");
    setRightRailVisible(true);
    setRightRailCollapsed(false);
    setRightRailWidgets(
      rightRailWidgetOptions.map((option) => option.value)
    );
    setHoursAvailable(2);
    setStartTime("16:00");
    setSidebarCollapsed(false);
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
        setHomeLayout={setHomeLayout}
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

        <nav className={`nav nav-${activePage}`}>
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
            label="Today’s plan"
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
            label="Settings"
            icon="⚙"
            active={activePage === "settings"}
            onClick={() => setActivePage("settings")}
          />
        </nav>

        <div className="sidebar-footer">
          <p>
            {completedTasks.length}/{tasks.length} tasks done
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
            tasks={tasks}
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
            setActivePage={setActivePage}
            homeLayout={homeLayout}
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
            movePlanStudyBlock={movePlanStudyBlock}
            updatePlanBlockDuration={updatePlanBlockDuration}
            removePlanBlock={removePlanBlock}
            reorderPlanBlock={reorderPlanBlock}
            planMoveFeedback={planMoveFeedback}
            completeTaskFromPlan={completeTaskFromPlan}
            hoursAvailable={hoursAvailable}
            setHoursAvailable={setHoursAvailable}
          />
        )}

        {activePage === "calendar" && (
          <CalendarPage
            tasks={tasks}
            subjects={subjects}
            setActivePage={setActivePage}
            addTaskToList={addTaskToList}
          />
        )}

        {activePage === "settings" && (
          <SettingsPage
            subjects={subjects}
            setSubjects={setSubjects}
            theme={theme}
            setTheme={setTheme}
            accentColor={accentColor}
            setAccentColor={setAccentColor}
            layoutDensity={layoutDensity}
            setLayoutDensity={setLayoutDensity}
            homeLayout={homeLayout}
            setHomeLayout={setHomeLayout}
            rightRailVisible={rightRailVisible}
            setRightRailVisible={setRightRailVisible}
            rightRailWidgets={rightRailWidgets}
            setRightRailWidgets={setRightRailWidgets}
            restartOnboarding={restartOnboarding}
            resetTasks={resetTasks}
            resetSubjects={resetSubjects}
            resetAppearancePreferences={resetAppearancePreferences}
            clearAllStudentHubData={clearAllStudentHubData}
          />
        )}
      </section>

      {rightRailVisible && (
        <RightRail
          tasks={tasks}
          planBlocks={planBlocks}
          setActivePage={setActivePage}
          collapsed={rightRailCollapsed}
          setCollapsed={setRightRailCollapsed}
          enabledWidgets={rightRailWidgets}
        />
      )}
    </main>
  );
}

export default App;
