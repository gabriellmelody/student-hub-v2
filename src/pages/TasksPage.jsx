import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DueDateField from "../components/DueDateField.jsx";
import SubjectField from "../components/SubjectField.jsx";
import TaskClassificationFields from "../components/TaskClassificationFields.jsx";
import TaskDetailsModal from "../components/TaskDetailsModal.jsx";
import RevealOnScroll from "../components/RevealOnScroll.jsx";
import TaskSourceBadge from "../components/TaskSourceBadge.jsx";
import {
  blockGuidedTourBackground,
  getFocusableTourElements,
  getTourFocusTrapTarget,
  restoreTourFocus,
} from "../utils/guidedTourUtils.js";
import {
  findSubjectProfile,
  getEffortLabel,
  getEffortClass,
  sortTasksByMode,
  updateTaskTitleWithDetection,
} from "../utils/appUtils.js";
import {
  createDueDateBoardColumns,
  createEmptyTaskDraft,
  createPriorityBoardColumns,
  createTaskDraftForBoardColumn,
  formatTaskCompletionLabel,
  formatTaskDueLabel,
  getTaskAcademicLabel,
} from "../utils/taskBoardUtils.js";
import {
  createManualTaskStudyRecommendation,
  createRecommendationOverride,
  getNextAvailableOverrideSlot,
  getValidTaskStudyDates,
} from "../utils/studyRecommendations.js";

function TasksPage({
  subjects,
  activeTasks,
  backlogTasks = [],
  visibleBacklog,
  noDeadlineTasks,
  completedTasks,
  showAddTask,
  setShowAddTask,
  newTask,
  setNewTask,
  addTask,
  toggleTask,
  deleteTask,
  updateTask,
  planningPreferences,
  updatePlanningPreferences,
  taskSyncError = null,
  retryTaskSync,
  scheduleTaskInCalendar,
  removeTaskFromCalendar,
  openCalendarSettings,
  requestedTaskId = "",
  onTaskDetailsRequestHandled,
}) {
  const [taskView, setTaskView] = useState("dueDate");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState(
    () => new Set(["later", "unscheduled"])
  );
  const [completedOpen, setCompletedOpen] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [dueTimeEnabled, setDueTimeEnabled] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [completionToast, setCompletionToast] = useState("");
  const titleInputRef = useRef(null);
  const addTaskDialogRef = useRef(null);
  const addTaskReturnFocusRef = useRef(null);
  const taskReturnFocusRef = useRef(null);
  const deepLinkedTaskIdRef = useRef(
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("task") || ""
  );
  const allActiveTasks = mergeUniqueTasks([
    ...activeTasks,
    ...backlogTasks,
    ...visibleBacklog,
    ...noDeadlineTasks,
  ]);
  const dueDateColumns = useMemo(
    () => createDueDateBoardColumns(allActiveTasks),
    [allActiveTasks]
  );
  const priorityColumns = useMemo(
    () => createPriorityBoardColumns(allActiveTasks),
    [allActiveTasks]
  );
  const visibleColumns = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const columns = taskView === "dueDate" ? dueDateColumns : priorityColumns;
    if (!query) return columns;
    return columns.map((column) => ({
      ...column,
      tasks: column.tasks.filter((task) =>
        [task.title, task.subject, task.description]
          .some((value) => String(value || "").toLowerCase().includes(query))
      ),
    }));
  }, [dueDateColumns, priorityColumns, searchQuery, taskView]);
  const sortedCompletedTasks = sortTasksByMode(completedTasks, "dueDate");
  const effectiveSelectedTaskId = requestedTaskId || selectedTaskId;
  const selectedTask = [...allActiveTasks, ...completedTasks].find(
    (task) => String(task.id) === String(effectiveSelectedTaskId)
  );
  const overdueCount =
    dueDateColumns.find((column) => column.id === "overdue")?.tasks.length || 0;
  const dueTodayCount =
    dueDateColumns.find((column) => column.label === "Today")?.tasks.length || 0;
  const hasActiveTasks = allActiveTasks.length > 0;
  const validStudyDates = useMemo(
    () => selectedTask && !selectedTask.completed ? getValidTaskStudyDates(selectedTask) : [],
    [selectedTask]
  );

  useEffect(() => {
    if (!completionToast) return undefined;
    const timer = window.setTimeout(() => setCompletionToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [completionToast]);

  useEffect(() => {
    const taskId = deepLinkedTaskIdRef.current;
    if (!taskId) return;
    const linkedTask = [...allActiveTasks, ...completedTasks].find(
      (task) => String(task.id) === taskId
    );
    if (!linkedTask) return;
    deepLinkedTaskIdRef.current = "";
    setSelectedTaskId(linkedTask.id);
  }, [allActiveTasks, completedTasks]);

  const addTaskSubmit = async (event) => {
    if (await addTask(event)) {
      setShowMoreOptions(false);
      setDueTimeEnabled(false);
    }
  };

  function openAddTask(column, returnFocusElement) {
    addTaskReturnFocusRef.current = returnFocusElement || document.activeElement;
    setNewTask(createTaskDraftForBoardColumn(column, taskView));
    setDueTimeEnabled(false);
    setShowMoreOptions(false);
    setShowAddTask(true);
  }

  function openTaskDetails(taskId, returnFocusElement) {
    taskReturnFocusRef.current = returnFocusElement || document.activeElement;
    setSelectedTaskId(taskId);
  }

  function closeTaskDetails() {
    setSelectedTaskId(null);
    onTaskDetailsRequestHandled?.();
    if (typeof window !== "undefined") {
      const nextUrl = new URL(window.location.href);
      if (nextUrl.searchParams.has("task")) {
        nextUrl.searchParams.delete("task");
        window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      }
    }
  }

  async function handleToggleTask(taskId) {
    const task = [...allActiveTasks, ...completedTasks].find((item) => item.id === taskId);
    const saved = await toggleTask(taskId);
    if (saved && task && !task.completed) {
      setCompletionToast(`${task.title} completed`);
    }
    return saved;
  }

  async function handleSetStudyBlock(task, dateKey) {
    if (!task || task.completed || task.archived || !updatePlanningPreferences) return false;
    const recommendation = createManualTaskStudyRecommendation(task, dateKey);
    if (!recommendation) return false;
    const overrides = planningPreferences?.recommendationOverrides || [];
    const slotIndex = getNextAvailableOverrideSlot(overrides, dateKey);
    if (slotIndex === null) return false;
    const block = createRecommendationOverride({
      dateKey,
      slotIndex,
      recommendation,
      manual: true,
      added: true,
      originDateKey: dateKey,
      originSlotIndex: slotIndex,
      durationMinutes: planningPreferences?.blockDurationMinutes || 45,
    });
    if (!block) return false;
    return Boolean(await updatePlanningPreferences({
      recommendationOverrides: [...overrides, block],
    }));
  }

  const closeAddTaskModal = useCallback(() => {
    setShowAddTask(false);
    setShowMoreOptions(false);
    setDueTimeEnabled(false);
    setNewTask(createEmptyTaskDraft());
  }, [setNewTask, setShowAddTask]);

  useLayoutEffect(() => {
    if (!showAddTask) return undefined;
    const returnFocusElement = addTaskReturnFocusRef.current;
    const restoreBackground = blockGuidedTourBackground(
      document.querySelector(".app-shell")
    );
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => titleInputRef.current?.focus());

    function handleFocusIn(event) {
      if (addTaskDialogRef.current?.contains(event.target)) return;
      titleInputRef.current?.focus();
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAddTaskModal();
        return;
      }
      if (event.key !== "Tab") return;
      const focusableElements = getFocusableTourElements(addTaskDialogRef.current);
      const focusTarget = getTourFocusTrapTarget({
        focusableElements,
        activeElement: document.activeElement,
        shiftKey: event.shiftKey,
        focusIsInside: addTaskDialogRef.current?.contains(document.activeElement),
      });
      if (!focusTarget) return;
      event.preventDefault();
      focusTarget.focus();
    }

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreBackground();
      window.requestAnimationFrame(() => restoreTourFocus(returnFocusElement));
    };
  }, [closeAddTaskModal, showAddTask]);

  return (
    <div className="page tasks-page">
      <header className="page-header tasks-page-header">
        <div className="tasks-header-copy">
          <p className="eyebrow">To-do</p>
          <h1>To-do list</h1>
          <p>All your active schoolwork in one place.</p>
          <p className="task-live-counts" data-tour="todo-due-navigation">
            {formatCount(allActiveTasks.length, "active")} · {formatCount(overdueCount, "overdue")}
            {dueTodayCount > 0 && <> · {formatCount(dueTodayCount, "due today")}</>}
          </p>
        </div>

        <div className="tasks-header-actions">
          <div className="task-header-search-row">
            <label className="task-search-field">
              <span className="sr-only">Search tasks</span>
              <input
                type="search"
                placeholder="Search tasks…"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <button
              className="primary-button task-add-trigger"
              type="button"
              data-tour="todo-add-task"
              onClick={(event) => openAddTask(null, event.currentTarget)}
            >
              + Add task
            </button>
          </div>

          <div
            className="task-view-tabs"
            role="group"
            aria-label="Choose task board"
            data-tour="todo-organise"
          >
            <button
              type="button"
              className={taskView === "dueDate" ? "active" : ""}
              aria-pressed={taskView === "dueDate"}
              onClick={() => setTaskView("dueDate")}
            >
              Due date
            </button>
            <button
              type="button"
              className={taskView === "priority" ? "active" : ""}
              aria-pressed={taskView === "priority"}
              onClick={() => setTaskView("priority")}
            >
              Priority
            </button>
          </div>
        </div>
      </header>

      <div className="panel tasks-panel" data-tour="todo-overview" tabIndex={-1}>
        {taskSyncError && (
          <div className="task-sync-error" role="alert">
            <span>Tasks could not sync. Check your connection and try again.</span>
            <button type="button" className="quiet-button" onClick={retryTaskSync}>
              Try again
            </button>
          </div>
        )}

        {!hasActiveTasks && (
          <div className="task-list-empty-intro" role="status">
            <strong>You’re caught up.</strong>
            <span>Add a task when something new comes up.</span>
          </div>
        )}

        <TaskGroupList
          columns={visibleColumns}
          subjects={subjects}
          onOpenTask={openTaskDetails}
          onToggleTask={handleToggleTask}
          collapsedGroups={collapsedGroups}
          onToggleGroup={(groupId) => setCollapsedGroups((current) => {
            const next = new Set(current);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
          })}
          emptyMessage={searchQuery.trim() ? "No tasks match your search." : "No active tasks."}
        />

        <section className={`task-list-section task-completed-section${completedOpen ? "" : " is-collapsed"}`}>
          <h2>
            <button
              className="task-completed-toggle"
              type="button"
              aria-expanded={completedOpen}
              aria-controls="task-list-group-completed"
              onClick={() => setCompletedOpen((open) => !open)}
            >
              <span className="task-list-chevron" aria-hidden="true">⌄</span>
              <span>Completed</span>
              <small>· {completedTasks.length} task{completedTasks.length === 1 ? "" : "s"}</small>
            </button>
          </h2>

          {completedOpen && (
            <RevealOnScroll as="div" className="task-completed-list" id="task-list-group-completed" maxDelay={80}>
              {sortedCompletedTasks.length > 0 ? (
                <div className="task-list-group">
                  {sortedCompletedTasks.map((task) => (
                    <TaskListRow
                      key={task.id}
                      task={task}
                      subjects={subjects}
                      onOpenTask={openTaskDetails}
                      onToggleTask={handleToggleTask}
                      completed
                    />
                  ))}
                </div>
              ) : (
                <p className="task-completed-empty">No completed tasks yet.</p>
              )}
            </RevealOnScroll>
          )}
        </section>
      </div>

      {showAddTask && createPortal(
        <div className="task-details-layer" role="presentation">
          <button
            className="task-details-backdrop"
            type="button"
            aria-label="Close add task"
            onClick={closeAddTaskModal}
          />
          <form
            ref={addTaskDialogRef}
            className="task-details-dialog task-add-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-task-title"
            aria-describedby="add-task-description"
            onSubmit={addTaskSubmit}
          >
            <header className="task-details-header">
              <div>
                <span className="eyebrow">New task</span>
                <h2 id="add-task-title">Add task</h2>
                <p id="add-task-description">Capture the work, then keep moving.</p>
              </div>
              <button
                type="button"
                className="task-details-close"
                aria-label="Close add task"
                onClick={closeAddTaskModal}
              >
                ×
              </button>
            </header>

            <div className="task-details-scroll">
              <label className="task-form-field task-details-title-field">
                <span>Task title</span>
                <input
                  ref={titleInputRef}
                  type="text"
                  placeholder="What needs doing?"
                  value={newTask.title}
                  required
                  onChange={(event) =>
                    setNewTask(updateTaskTitleWithDetection(newTask, event.target.value))
                  }
                />
              </label>

              <label className="task-form-field">
                <span>Description (optional)</span>
                <textarea
                  rows={3}
                  placeholder="Add details, instructions, or notes…"
                  value={newTask.description}
                  onChange={(event) =>
                    setNewTask({ ...newTask, description: event.target.value })
                  }
                />
              </label>

              <label className="task-form-field">
                <span>Subject</span>
                <SubjectField
                  subjects={subjects}
                  placeholder="Subject, e.g. Chemistry"
                  value={newTask.subject}
                  onChange={(subject) => setNewTask({ ...newTask, subject })}
                />
              </label>

              <div className="task-create-deadline-grid">
                <DueDateField
                  value={newTask.dueDate}
                  onChange={(dueDate) => {
                    if (!dueDate) setDueTimeEnabled(false);
                    setNewTask({
                      ...newTask,
                      dueDate,
                      ...(!dueDate ? { dueTime: "" } : {}),
                    });
                  }}
                />
                <div className="task-form-field task-create-time-field">
                  <span>Due time</span>
                  {dueTimeEnabled ? (
                    <div className="task-create-time-input">
                      <input
                        type="time"
                        aria-label="Due time"
                        value={newTask.dueTime || ""}
                        onChange={(event) =>
                          setNewTask({ ...newTask, dueTime: event.target.value })
                        }
                      />
                      <button
                        type="button"
                        className="quiet-button"
                        onClick={() => {
                          setDueTimeEnabled(false);
                          setNewTask({ ...newTask, dueTime: "" });
                        }}
                      >
                        Remove time
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="secondary-button task-add-time"
                      disabled={!newTask.dueDate}
                      onClick={() => setDueTimeEnabled(true)}
                    >
                      Add time <span className="sr-only">to this due date</span>
                    </button>
                  )}
                </div>
              </div>

              <button
                className="quiet-button task-more-options"
                type="button"
                aria-expanded={showMoreOptions}
                onClick={() => setShowMoreOptions((open) => !open)}
              >
                More options <span aria-hidden="true">{showMoreOptions ? "⌃" : "⌄"}</span>
              </button>

              {showMoreOptions && (
                <div className="task-advanced-fields">
                  <TaskClassificationFields task={newTask} onChange={setNewTask} />
                  <fieldset className="task-details-effort">
                    <legend>Effort</legend>
                    <div className="effort-row">
                      {[1, 2, 3, 4, 5].map((number) => (
                        <button
                          key={number}
                          type="button"
                          aria-pressed={newTask.effort === number}
                          className={
                            newTask.effort === number
                              ? `effort-button selected ${getEffortClass(number)}`
                              : `effort-button ${getEffortClass(number)}`
                          }
                          onClick={() => setNewTask({ ...newTask, effort: number })}
                        >
                          {number}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}
            </div>

            <footer className="task-details-actions task-add-actions">
              <button className="secondary-button" type="button" onClick={closeAddTaskModal}>
                Cancel
              </button>
              <button className="primary-button" type="submit" disabled={!newTask.title.trim()}>
                Add task
              </button>
            </footer>
          </form>
        </div>,
        document.body
      )}

      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          subjects={subjects}
          onSave={updateTask}
          onToggle={handleToggleTask}
          onDelete={deleteTask}
          onClose={closeTaskDetails}
          returnFocusRef={taskReturnFocusRef}
          onScheduleCalendar={scheduleTaskInCalendar}
          onRemoveCalendar={removeTaskFromCalendar}
          onOpenCalendarSettings={openCalendarSettings}
          validStudyDates={validStudyDates}
          defaultStudyDuration={planningPreferences?.blockDurationMinutes || 45}
          onSetStudyBlock={(dateKey) => handleSetStudyBlock(selectedTask, dateKey)}
        />
      )}
      {completionToast && (
        <div className="task-completion-toast" role="status" aria-live="polite">
          <span aria-hidden="true">✓</span>
          <span>{completionToast}</span>
        </div>
      )}
    </div>
  );
}

function TaskGroupList({
  columns,
  subjects,
  onOpenTask,
  onToggleTask,
  collapsedGroups,
  onToggleGroup,
  emptyMessage,
}) {
  const populatedColumns = columns.filter((column) => column.tasks.length > 0);
  if (populatedColumns.length === 0) {
    return <p className="task-list-search-empty" role="status">{emptyMessage}</p>;
  }
  return (
    <div className="task-grouped-list">
      {populatedColumns.map((column) => {
        const collapsed = collapsedGroups.has(column.id);
        const contentId = `task-list-group-${column.id.replace(/[^a-z0-9_-]/gi, "-")}`;
        return (
          <section className={`task-list-section is-${column.kind || column.id}${collapsed ? " is-collapsed" : ""}`} key={column.id}>
            <h2>
              <button
                type="button"
                aria-expanded={!collapsed}
                aria-controls={contentId}
                onClick={() => onToggleGroup(column.id)}
              >
                <span className="task-list-chevron" aria-hidden="true">⌄</span>
                <span>{column.label}</span>
                <small>· {column.tasks.length} task{column.tasks.length === 1 ? "" : "s"}</small>
              </button>
            </h2>
            {!collapsed && (
              <div className="task-list-group" id={contentId}>
                {column.tasks.map((task) => (
                  <TaskListRow
                    key={task.id}
                    task={task}
                    subjects={subjects}
                    onOpenTask={onOpenTask}
                    onToggleTask={onToggleTask}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function TaskListRow({ task, subjects, onOpenTask, onToggleTask, completed = false }) {
  const subject = findSubjectProfile(subjects, task.subject);
  const academicLabel = getTaskAcademicLabel(task);
  const classification = academicLabel || formatTaskType(task.taskType);
  const classificationTone = getClassificationTone(academicLabel);
  const subjectStyle = subject ? { "--task-list-subject": subject.colour || subject.color } : undefined;
  const dueLabel = completed ? formatTaskCompletionLabel(task) : formatTaskDueLabel(task);

  async function toggleFromRow(event) {
    const controls = [...document.querySelectorAll(".task-list-complete")];
    const currentIndex = controls.indexOf(event.currentTarget);
    const focusTarget = controls[currentIndex + 1] || controls[currentIndex - 1] || document.querySelector(".tasks-panel");
    const saved = await onToggleTask(task.id);
    if (saved) window.requestAnimationFrame(() => focusTarget?.focus());
  }

  return (
    <article className={`task-list-row${completed ? " is-completed" : ""}`} style={subjectStyle}>
      <button
        type="button"
        className="task-list-complete"
        aria-label={`${completed ? "Reopen" : "Mark"} ${task.title} ${completed ? "" : "complete"}`.trim()}
        aria-pressed={completed}
        onClick={(event) => void toggleFromRow(event)}
      >
        <span aria-hidden="true">{completed ? "✓" : ""}</span>
      </button>
      <button
        type="button"
        className="task-list-row-main"
        onClick={(event) => onOpenTask(task.id, event.currentTarget)}
        aria-label={`Open task details for ${task.title}`}
        data-tour="todo-task-actions"
      >
        <span className="task-list-subject">
          <i aria-hidden="true" />
          {task.subject || "No subject"}
        </span>
        <strong>{task.title}</strong>
        <span className={`task-list-classification ${classificationTone}`}>{classification}</span>
        <span className={`task-list-due ${completed ? "is-completed" : getDueTone(task)}`}>{dueLabel}</span>
        <span className="task-list-effort">{getEffortLabel(Number(task.effort) || 2)} effort</span>
        <span className="task-list-source">
          {task.source === "classroom" && <TaskSourceBadge task={task} />}
        </span>
      </button>
      <button
        type="button"
        className="task-list-details"
        aria-label={`More options for ${task.title}`}
        onClick={(event) => onOpenTask(task.id, event.currentTarget)}
      >
        ⋯
      </button>
    </article>
  );
}

function getClassificationTone(label) {
  if (label === "Summative") return "is-summative";
  if (label === "Formative") return "is-formative";
  if (label === "CFA") return "is-cfa";
  return "";
}

function formatTaskType(value) {
  const normalized = String(value || "homework").replace(/[-_]+/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function parseLocalDate(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

function getDueDayDifference(task, now = new Date()) {
  const dueDate = parseLocalDate(task.dueDate);
  if (!dueDate) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((dueDate - today) / 86400000);
}

function getDueTone(task) {
  const difference = getDueDayDifference(task);
  if (difference === null || difference > 1) return "is-future";
  if (difference < 0) return "is-overdue";
  return difference === 0 ? "is-today" : "is-tomorrow";
}

function mergeUniqueTasks(taskList) {
  const taskMap = new Map();
  taskList.forEach((task) => {
    if (!task.completed && !task.archived && !taskMap.has(task.id)) {
      taskMap.set(task.id, task);
    }
  });
  return [...taskMap.values()];
}

function formatCount(count, label) {
  if (label === "overdue") return `${count} overdue`;
  if (label === "due today") return `${count} due today`;
  return `${count} ${label}`;
}

export default TasksPage;
