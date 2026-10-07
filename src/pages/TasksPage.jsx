import { useEffect, useMemo, useRef, useState } from "react";
import DueDateField from "../components/DueDateField.jsx";
import SubjectField from "../components/SubjectField.jsx";
import TaskCard from "../components/TaskCard.jsx";
import TaskClassificationFields from "../components/TaskClassificationFields.jsx";
import TaskDetailsModal from "../components/TaskDetailsModal.jsx";
import RevealOnScroll from "../components/RevealOnScroll.jsx";
import {
  getEffortClass,
  sortTasksByMode,
  updateTaskTitleWithDetection,
} from "../utils/appUtils.js";
import {
  createDueDateBoardColumns,
  createPriorityBoardColumns,
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
  addQuickTask,
  toggleTask,
  deleteTask,
  updateTask,
  taskSyncError = null,
  retryTaskSync,
}) {
  const [taskView, setTaskView] = useState("dueDate");
  const [completedOpen, setCompletedOpen] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const titleInputRef = useRef(null);
  const taskReturnFocusRef = useRef(null);
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
  const selectedTask = [...allActiveTasks, ...completedTasks].find(
    (task) => String(task.id) === String(selectedTaskId)
  );
  const overdueCount =
    dueDateColumns.find((column) => column.id === "overdue")?.tasks.length || 0;
  const dueTodayCount =
    dueDateColumns.find((column) => column.label === "Today")?.tasks.length || 0;
  const hasActiveTasks = allActiveTasks.length > 0;

  const addTaskSubmit = async (event) => {
    await addTask(event);
    setShowMoreOptions(false);
  };

  async function submitQuickTask(event) {
    event.preventDefault();
    if (!(await addQuickTask(quickTaskTitle))) return;
    setQuickTaskTitle("");
  }

  function openQuickTaskDetails() {
    const title = quickTaskTitle.trim();
    if (title) setNewTask(updateTaskTitleWithDetection(newTask, title));
    setShowAddTask(true);
  }

  function openTaskDetails(taskId, returnFocusElement) {
    taskReturnFocusRef.current = returnFocusElement || document.activeElement;
    setSelectedTaskId(taskId);
  }

  function closeTaskDetails() {
    setSelectedTaskId(null);
  }

  useEffect(() => {
    if (!showAddTask) return undefined;
    window.requestAnimationFrame(() => titleInputRef.current?.focus());

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setShowAddTask(false);
        setShowMoreOptions(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showAddTask, setShowAddTask]);

  function closeAddTaskSheet() {
    setShowAddTask(false);
    setShowMoreOptions(false);
  }

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
            onClick={() => setShowAddTask(true)}
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

        <form className="task-quick-add" aria-label="Quick add task" onSubmit={submitQuickTask}>
          <label className="task-quick-add-field">
            <span className="sr-only">Task title</span>
            <input
              type="text"
              value={quickTaskTitle}
              placeholder="Add a task..."
              onChange={(event) => setQuickTaskTitle(event.target.value)}
            />
          </label>
          <button className="primary-button task-quick-add-submit" type="submit">
            Add
          </button>
          <button
            className="quiet-button task-quick-add-details"
            type="button"
            onClick={openQuickTaskDetails}
          >
            More details
          </button>
        </form>

        {!hasActiveTasks ? (
          <div className="task-empty-state">
            <h3>You’re caught up.</h3>
            <p>Add a task when new school work comes in.</p>
            <button
              className="secondary-button task-empty-action"
              type="button"
              onClick={() => setShowAddTask(true)}
            >
              + Add task
            </button>
          </div>
        ) : (
          <TaskBoard
            columns={taskView === "dueDate" ? dueDateColumns : priorityColumns}
            subjects={subjects}
            onOpenTask={openTaskDetails}
            label={taskView === "dueDate" ? "Tasks by due date" : "Tasks by priority"}
          />
        )}

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

      {showAddTask && (
        <div className="task-sheet-layer" role="presentation">
          <button
            className="task-sheet-backdrop"
            type="button"
            aria-label="Close add task"
            onClick={closeAddTaskSheet}
          />
          <form
            className="add-task-form task-add-sheet"
            aria-label="Add task"
            onSubmit={addTaskSubmit}
          >
            <div className="task-sheet-header">
              <div>
                <h3>Add task</h3>
                <p>Capture the work, then keep moving.</p>
              </div>
              <button
                type="button"
                className="small-button secondary"
                onClick={closeAddTaskSheet}
              >
                Cancel
              </button>
            </div>

            <label className="task-form-field">
              <span>Task title</span>
              <input
                ref={titleInputRef}
                type="text"
                placeholder="What needs doing?"
                value={newTask.title}
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
                onChange={(dueDate) => setNewTask({ ...newTask, dueDate })}
              />
              <label className="task-form-field">
                <span>Due time (optional)</span>
                <input
                  type="time"
                  value={newTask.dueTime || ""}
                  onChange={(event) =>
                    setNewTask({ ...newTask, dueTime: event.target.value })
                  }
                />
              </label>
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
                <div className="effort-row">
                  <span>Effort</span>
                  {[1, 2, 3, 4, 5].map((number) => (
                    <button
                      key={number}
                      type="button"
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
              </div>
            )}

            <button className="primary-button" type="submit">
              Add task
            </button>
          </form>
        </div>
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
        />
      )}
    </div>
  );
}

function TaskBoard({ columns, subjects, onOpenTask, label }) {
  return (
    <div className="task-board-scroll" role="region" aria-label={label} tabIndex={0}>
      <div className="task-board">
        {columns.map((column) => (
          <section
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

            <div className="task-board-column-list">
              {column.tasks.length > 0 ? (
                column.tasks.map((task) => (
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
            </div>
          </section>
        ))}
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
