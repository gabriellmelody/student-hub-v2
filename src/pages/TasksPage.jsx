import { useEffect, useRef, useState } from "react";
import SubjectField from "../components/SubjectField.jsx";
import TaskClassificationFields from "../components/TaskClassificationFields.jsx";
import TaskCard from "../components/TaskCard.jsx";
import {
  getDaysLeft,
  getEffortClass,
  formatDateKey,
  parseDateKey,
  taskSortOptions,
  sortTasksByMode,
  updateTaskTitleWithDetection,
} from "../utils/appUtils.js";

function TasksPage({
  subjects,
  activeTasks,
  backlogTasks = [],
  visibleBacklog,
  hiddenBacklogCount,
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
}) {
  const [taskSortMode, setTaskSortMode] = useState("smart");
  const [completedOpen, setCompletedOpen] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [dueDateSelection, setDueDateSelection] = useState("today");
  const [openMenuTaskId, setOpenMenuTaskId] = useState(null);
  const titleInputRef = useRef(null);
  const allActiveTasks = mergeUniqueTasks([
    ...activeTasks,
    ...backlogTasks,
    ...visibleBacklog,
    ...noDeadlineTasks,
  ]);
  const sortedActiveTasks = sortTasksByMode(activeTasks, taskSortMode);
  const sortedBacklogTasks = sortTasksByMode(
    backlogTasks.length > 0 ? backlogTasks : visibleBacklog,
    taskSortMode
  );
  const sortedNoDeadlineTasks = sortTasksByMode(noDeadlineTasks, taskSortMode);
  const sortedCompletedTasks = sortTasksByMode(completedTasks, taskSortMode);
  const recommendedGroups = getRecommendedGroups(allActiveTasks);
  const dueDateOptions = getRollingDueDateOptions(allActiveTasks);
  const selectedDueOption =
    dueDateOptions.find((option) => option.id === dueDateSelection) ||
    dueDateOptions[1];
  const selectedDueTasks = selectedDueOption
    ? sortTasksByMode(
        getTasksForDueDateSelection(allActiveTasks, selectedDueOption),
        "dueDate"
      )
    : [];
  const activeCount = allActiveTasks.length;
  const overdueCount = allActiveTasks.filter(
    (task) => getDaysLeft(task.dueDate) !== null && getDaysLeft(task.dueDate) < 0
  ).length;
  const dueTodayCount = allActiveTasks.filter(
    (task) => getDaysLeft(task.dueDate) === 0
  ).length;
  const hasActiveTasks = allActiveTasks.length > 0;
  const addTaskSubmit = (event) => {
    addTask(event);
    setShowMoreOptions(false);
  };

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
        <div>
          <h2>Your tasks</h2>
          <p className="task-live-counts">
            {formatCount(activeCount, "active")} ·{" "}
            {formatCount(overdueCount, "overdue")}
            {dueTodayCount > 0 && <> · {formatCount(dueTodayCount, "due today")}</>}
          </p>
        </div>
        <button
          className="primary-button task-add-trigger"
          type="button"
          onClick={() => setShowAddTask(true)}
        >
          + Add task
        </button>
      </header>

      <div className="panel tasks-panel">
        <div className="task-sort-row" aria-label="Organise tasks">
          {taskSortOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                taskSortMode === option.value
                  ? "small-button sort-button active"
                  : "small-button sort-button"
              }
              aria-pressed={taskSortMode === option.value}
              onClick={() => setTaskSortMode(option.value)}
            >
              {option.value === "smart" ? "Priority" : option.label}
            </button>
          ))}
        </div>

        {!hasActiveTasks && (
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
        )}

        {hasActiveTasks && taskSortMode === "smart" && (
          <div className="task-group-stack">
            {recommendedGroups.map((group) => (
              <TaskGroup
                key={group.id}
                title={group.title}
                tasks={group.tasks}
                subjects={subjects}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onUpdate={updateTask}
                openMenuTaskId={openMenuTaskId}
                setOpenMenuTaskId={setOpenMenuTaskId}
              />
            ))}
          </div>
        )}

        {hasActiveTasks && taskSortMode === "dueDate" && (
          <div className="task-due-view">
            <RollingDueDateSelector
              options={dueDateOptions}
              selectedId={selectedDueOption?.id}
              onSelect={setDueDateSelection}
            />

            <section className="task-section">
              <h3 className="section-label">
                {getDueDateSelectionHeading(selectedDueOption, selectedDueTasks.length)}
              </h3>

              {selectedDueTasks.length > 0 ? (
                <div className="task-list">
                  {selectedDueTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      subjects={subjects}
                      onToggle={toggleTask}
                      onDelete={deleteTask}
                      onUpdate={updateTask}
                      openMenuTaskId={openMenuTaskId}
                      setOpenMenuTaskId={setOpenMenuTaskId}
                    />
                  ))}
                </div>
              ) : (
                <div className="task-date-empty">
                  <h3>Nothing here.</h3>
                  <p>Choose another day or add a task when something comes in.</p>
                </div>
              )}
            </section>
          </div>
        )}

        {hasActiveTasks && !["smart", "dueDate"].includes(taskSortMode) && (
          <div className="task-group-stack">
            {sortedActiveTasks.length > 0 && (
              <TaskGroup
                title="Active"
                tasks={sortedActiveTasks}
                subjects={subjects}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onUpdate={updateTask}
                openMenuTaskId={openMenuTaskId}
                setOpenMenuTaskId={setOpenMenuTaskId}
              />
            )}

            {sortedBacklogTasks.length > 0 && (
              <TaskGroup
                title="Later"
                tasks={sortedBacklogTasks}
                subjects={subjects}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onUpdate={updateTask}
                openMenuTaskId={openMenuTaskId}
                setOpenMenuTaskId={setOpenMenuTaskId}
              />
            )}

            {hiddenBacklogCount > 0 && backlogTasks.length === 0 && (
              <p className="muted-text">
                + {hiddenBacklogCount} more task
                {hiddenBacklogCount === 1 ? "" : "s"} in backlog
              </p>
            )}

            {sortedNoDeadlineTasks.length > 0 && (
              <TaskGroup
                title="No deadline"
                tasks={sortedNoDeadlineTasks}
                subjects={subjects}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onUpdate={updateTask}
                openMenuTaskId={openMenuTaskId}
                setOpenMenuTaskId={setOpenMenuTaskId}
              />
            )}
          </div>
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
            <div className="task-group-stack task-completed-list">
              {sortedCompletedTasks.length > 0 ? (
                <TaskGroup
                  title="Completed"
                  tasks={sortedCompletedTasks}
                  subjects={subjects}
                  onToggle={toggleTask}
                  onDelete={deleteTask}
                  onUpdate={updateTask}
                  completed
                  hideHeading
                  openMenuTaskId={openMenuTaskId}
                  setOpenMenuTaskId={setOpenMenuTaskId}
                />
              ) : (
                <p className="task-completed-empty">No completed tasks yet.</p>
              )}
            </div>
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
                  setNewTask(
                    updateTaskTitleWithDetection(newTask, event.target.value)
                  )
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

            <label className="task-form-field">
              <span>Due date</span>
              <input
                type="date"
                value={newTask.dueDate}
                onChange={(event) =>
                  setNewTask({ ...newTask, dueDate: event.target.value })
                }
              />
            </label>

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
    </div>
  );
}

function TaskGroup({
  title,
  tasks,
  subjects,
  onToggle,
  onDelete,
  onUpdate,
  completed = false,
  hideHeading = false,
  openMenuTaskId,
  setOpenMenuTaskId,
}) {
  if (tasks.length === 0) return null;

  return (
    <section className="task-section">
      {!hideHeading && (
        <h3 className="section-label">
          {title} <span>· {tasks.length}</span>
        </h3>
      )}

      <div className="task-list">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            subjects={subjects}
            onToggle={onToggle}
            onDelete={onDelete}
            onUpdate={onUpdate}
            completed={completed}
            openMenuTaskId={openMenuTaskId}
            setOpenMenuTaskId={setOpenMenuTaskId}
          />
        ))}
      </div>
    </section>
  );
}

function getRecommendedGroups(tasks) {
  const buckets = [
    { id: "overdue", title: "Overdue", tasks: [] },
    { id: "today", title: "Due today", tasks: [] },
    { id: "week", title: "Next 7 days", tasks: [] },
    { id: "later", title: "Later", tasks: [] },
    { id: "none", title: "No deadline", tasks: [] },
  ];

  tasks.forEach((task) => {
    const daysLeft = getDaysLeft(task.dueDate);

    if (daysLeft === null) {
      buckets[4].tasks.push(task);
    } else if (daysLeft < 0) {
      buckets[0].tasks.push(task);
    } else if (daysLeft === 0) {
      buckets[1].tasks.push(task);
    } else if (daysLeft <= 7) {
      buckets[2].tasks.push(task);
    } else {
      buckets[3].tasks.push(task);
    }
  });

  return buckets
    .map((group) => ({ ...group, tasks: sortTasksByMode(group.tasks, "smart") }))
    .filter((group) => group.tasks.length > 0);
}

function RollingDueDateSelector({ options, selectedId, onSelect }) {
  return (
    <div className="task-date-selector" aria-label="Choose due date">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`task-date-chip${option.id === selectedId ? " active" : ""}${
            option.kind === "overdue" ? " overdue" : ""
          }${option.hasTasks ? " has-tasks" : ""}`}
          aria-pressed={option.id === selectedId}
          aria-label={option.ariaLabel}
          onClick={() => onSelect(option.id)}
        >
          <span>{option.label}</span>
          {option.meta && <strong>{option.meta}</strong>}
          {option.count > 0 && (
            <em className={`task-date-count task-date-count-${option.kind}`}>
              {option.kind === "overdue" ? (
                <>
                  <i aria-hidden="true" className="task-date-overdue-marker">
                    Late
                  </i>
                  <span className="task-date-a11y">
                    {option.count} overdue task
                    {option.count === 1 ? "" : "s"}
                  </span>
                </>
              ) : option.hasAssessment ? (
                <>
                  <i aria-hidden="true" className="task-date-assessment-marker" />
                  <span className="task-date-a11y">
                    {option.count} task
                    {option.count === 1 ? "" : "s"}, assessment due
                  </span>
                </>
              ) : (
                option.kind === "date" && (
                  <i aria-hidden="true" className="task-date-deadline-dot" />
                )
              )}
              {option.count}
            </em>
          )}
        </button>
      ))}
    </div>
  );
}

function getRollingDueDateOptions(tasks) {
  const today = getStartOfDay(new Date());
  const todayKey = formatDateKey(today);
  const visibleDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return date;
  });
  const lastVisibleDate = visibleDates[visibleDates.length - 1];
  const overdueTasks = tasks.filter((task) => {
    const daysLeft = getDaysLeft(task.dueDate);
    return daysLeft !== null && daysLeft < 0;
  });
  const laterTasks = tasks.filter((task) => {
    const dueDate = getTaskDate(task);
    return dueDate && dueDate > lastVisibleDate;
  });
  const noDateTasks = tasks.filter((task) => !task.dueDate);

  return [
    {
      id: "overdue",
      kind: "overdue",
      label: "Overdue",
      meta: null,
      count: overdueTasks.length,
      hasAssessment: overdueTasks.some(isAssessmentTask),
      hasTasks: overdueTasks.length > 0,
      ariaLabel: `Overdue, ${formatTaskCount(overdueTasks.length)}`,
    },
    ...visibleDates.map((date, index) => {
      const dateKey = formatDateKey(date);
      const dateTasks = tasks.filter((task) => task.dueDate === dateKey);
      const label =
        dateKey === todayKey
          ? "Today"
          : date.toLocaleDateString(undefined, { weekday: "short" });

      return {
        id: `date:${dateKey}`,
        kind: "date",
        label,
        meta: String(date.getDate()),
        dateKey,
        date,
        count: dateTasks.length,
        hasAssessment: dateTasks.some(isAssessmentTask),
        hasTasks: dateTasks.length > 0,
        ariaLabel: `${label} ${date.getDate()}, ${formatTaskCount(
          dateTasks.length
        )}${dateTasks.some(isAssessmentTask) ? ", includes assessment work" : ""}`,
      };
    }),
    {
      id: "later",
      kind: "later",
      label: "Later",
      meta: null,
      count: laterTasks.length,
      hasAssessment: laterTasks.some(isAssessmentTask),
      hasTasks: laterTasks.length > 0,
      ariaLabel: `Later, ${formatTaskCount(laterTasks.length)}`,
    },
    {
      id: "no-date",
      kind: "no-date",
      label: "No deadline",
      meta: null,
      count: noDateTasks.length,
      hasAssessment: noDateTasks.some(isAssessmentTask),
      hasTasks: noDateTasks.length > 0,
      ariaLabel: `No deadline, ${formatTaskCount(noDateTasks.length)}`,
    },
  ];
}

function getTasksForDueDateSelection(tasks, option) {
  if (!option) return [];

  if (option.kind === "overdue") {
    return tasks.filter((task) => {
      const daysLeft = getDaysLeft(task.dueDate);
      return daysLeft !== null && daysLeft < 0;
    });
  }

  if (option.kind === "date") {
    return tasks.filter((task) => task.dueDate === option.dateKey);
  }

  if (option.kind === "later") {
    const dateOptions = getRollingDueDateOptions(tasks).filter(
      (nextOption) => nextOption.kind === "date"
    );
    const lastVisibleDate = dateOptions[dateOptions.length - 1]?.date;
    return tasks.filter((task) => {
      const dueDate = getTaskDate(task);
      return dueDate && lastVisibleDate && dueDate > lastVisibleDate;
    });
  }

  if (option.kind === "no-date") {
    return tasks.filter((task) => !task.dueDate);
  }

  return [];
}

function getDueDateSelectionHeading(option, count) {
  if (!option) return `Due date · ${formatTaskCount(count)}`;

  if (option.kind === "overdue") return `Overdue · ${formatTaskCount(count)}`;
  if (option.kind === "later") return `Later · ${formatTaskCount(count)}`;
  if (option.kind === "no-date") return `No deadline · ${formatTaskCount(count)}`;

  return `${option.date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })} · ${formatTaskCount(count)}`;
}

function getTaskDate(task) {
  if (!task.dueDate) return null;

  const date = parseDateKey(task.dueDate);
  if (Number.isNaN(date.getTime())) return null;

  return getStartOfDay(date);
}

function getStartOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function isAssessmentTask(task) {
  const tagText = [
    task.taskType,
    task.importance,
    ...(Array.isArray(task.detectedTags) ? task.detectedTags : []),
    task.title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /\b(assessment|test|quiz|exam|summative|formative|ia|mock)\b/.test(
    tagText
  );
}

function formatTaskCount(count) {
  return `${count} task${count === 1 ? "" : "s"}`;
}

function mergeUniqueTasks(taskList) {
  const taskMap = new Map();

  taskList.forEach((task) => {
    if (!task.completed && !taskMap.has(task.id)) {
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
