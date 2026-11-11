import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DueDateField from "../components/DueDateField.jsx";
import SubjectField from "../components/SubjectField.jsx";
import TaskCard from "../components/TaskCard.jsx";
import TaskClassificationFields from "../components/TaskClassificationFields.jsx";
import TaskDetailsModal from "../components/TaskDetailsModal.jsx";
import RevealOnScroll from "../components/RevealOnScroll.jsx";
import {
  blockGuidedTourBackground,
  getFocusableTourElements,
  getTourFocusTrapTarget,
  restoreTourFocus,
} from "../utils/guidedTourUtils.js";
import {
  getEffortClass,
  sortTasksByMode,
  updateTaskTitleWithDetection,
} from "../utils/appUtils.js";
import {
  createDueDateBoardColumns,
  createEmptyTaskDraft,
  createPriorityBoardColumns,
  createTaskDraftForBoardColumn,
  getVisibleTaskColumnItems,
  TASK_BOARD_VISIBLE_LIMIT,
} from "../utils/taskBoardUtils.js";

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
  taskSyncError = null,
  retryTaskSync,
  scheduleTaskInCalendar,
  removeTaskFromCalendar,
  openCalendarSettings,
  requestedTaskId = "",
  onTaskDetailsRequestHandled,
}) {
  const [taskView, setTaskView] = useState("dueDate");
  const [completedOpen, setCompletedOpen] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [dueTimeEnabled, setDueTimeEnabled] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
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
          <h1>To-do board</h1>
          <p>Scan deadlines first, then open a task when you need the details.</p>
          <p className="task-live-counts" data-tour="todo-due-navigation">
            {formatCount(allActiveTasks.length, "active")} · {formatCount(overdueCount, "overdue")}
            {dueTodayCount > 0 && <> · {formatCount(dueTodayCount, "due today")}</>}
          </p>
        </div>

        <div className="tasks-header-actions">
          <button
            className="primary-button task-add-trigger"
            type="button"
            data-tour="todo-add-task"
            onClick={(event) => openAddTask(null, event.currentTarget)}
          >
            + Add task
          </button>

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

      <div className="panel tasks-panel" data-tour="todo-overview">
        {taskSyncError && (
          <div className="task-sync-error" role="alert">
            <span>Tasks could not sync. Check your connection and try again.</span>
            <button type="button" className="quiet-button" onClick={retryTaskSync}>
              Try again
            </button>
          </div>
        )}

        {!hasActiveTasks && (
          <div className="task-board-empty-intro" role="status">
            <strong>You’re caught up.</strong>
            <span>Add a task in the column where it belongs.</span>
          </div>
        )}

        <TaskBoard
          columns={taskView === "dueDate" ? dueDateColumns : priorityColumns}
          subjects={subjects}
          onOpenTask={openTaskDetails}
          onAddTask={openAddTask}
          boardMode={taskView}
          label={taskView === "dueDate" ? "Tasks by due date" : "Tasks by priority"}
        />

        <section className="task-completed-section">
          <button
            className="task-completed-toggle"
            type="button"
            aria-expanded={completedOpen}
            onClick={() => setCompletedOpen((open) => !open)}
          >
            <span>Completed · {completedTasks.length}</span>
            <span aria-hidden="true">{completedOpen ? "⌃" : "⌄"}</span>
          </button>

          {completedOpen && (
            <RevealOnScroll as="div" className="task-completed-list" maxDelay={80}>
              {sortedCompletedTasks.length > 0 ? (
                <div className="task-completed-grid">
                  {sortedCompletedTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      subjects={subjects}
                      onOpen={openTaskDetails}
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
          onToggle={toggleTask}
          onDelete={deleteTask}
          onClose={closeTaskDetails}
          returnFocusRef={taskReturnFocusRef}
          onScheduleCalendar={scheduleTaskInCalendar}
          onRemoveCalendar={removeTaskFromCalendar}
          onOpenCalendarSettings={openCalendarSettings}
        />
      )}
    </div>
  );
}

function TaskBoard({ columns, subjects, onOpenTask, onAddTask, boardMode, label }) {
  const [expandedColumns, setExpandedColumns] = useState(() => new Set());

  function toggleColumn(columnKey) {
    setExpandedColumns((current) => {
      const next = new Set(current);
      if (next.has(columnKey)) next.delete(columnKey);
      else next.add(columnKey);
      return next;
    });
  }

  return (
    <div className="task-board-scroll" role="region" aria-label={label} tabIndex={0}>
      <div className="task-board">
        {columns.map((column) => {
          const columnKey = `${boardMode}:${column.id}`;
          const expanded = expandedColumns.has(columnKey);
          const visibleTasks = getVisibleTaskColumnItems(column.tasks, expanded);
          const hiddenCount = Math.max(0, column.tasks.length - TASK_BOARD_VISIBLE_LIMIT);
          const listId = `task-column-${columnKey.replace(/[^a-z0-9_-]/gi, "-")}`;

          return <section
            className={`task-board-column task-board-column-${column.kind || column.id}`}
            key={column.id}
          >
            <header className="task-board-column-header">
              <div>
                <h2>{column.label}</h2>
                {column.dateLabel && <span>{column.dateLabel}</span>}
              </div>
              <span aria-label={`${column.tasks.length} tasks`}>{column.tasks.length}</span>
            </header>

            <div className="task-board-column-list" id={listId}>
              {column.tasks.length > 0 ? (
                visibleTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    subjects={subjects}
                    onOpen={onOpenTask}
                  />
                ))
              ) : (
                <p className="task-board-column-empty">No tasks</p>
              )}
              {column.tasks.length > TASK_BOARD_VISIBLE_LIMIT && (
                <button
                  className="task-board-show-more"
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={listId}
                  onClick={() => toggleColumn(columnKey)}
                >
                  {expanded ? "Show less" : `Show ${hiddenCount} more`}
                </button>
              )}
            </div>
            <button
              className="task-board-add-task"
              type="button"
              aria-label={`Add task to ${column.label}`}
              onClick={(event) => onAddTask(column, event.currentTarget)}
            >
              <span aria-hidden="true">+</span> Add task
            </button>
          </section>
        })}
      </div>
    </div>
  );
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
