import { useState } from "react";
import SubjectField from "../components/SubjectField.jsx";
import TaskCard from "../components/TaskCard.jsx";
import {
  getEffortClass,
  taskSortOptions,
  sortTasksByMode,
} from "../utils/appUtils.js";

function TasksPage({
  subjects,
  activeTasks,
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
  const sortedActiveTasks = sortTasksByMode(activeTasks, taskSortMode);
  const sortedVisibleBacklog = sortTasksByMode(visibleBacklog, taskSortMode);
  const sortedNoDeadlineTasks = sortTasksByMode(noDeadlineTasks, taskSortMode);
  const sortedCompletedTasks = sortTasksByMode(completedTasks, taskSortMode);
  const hasActiveTasks =
    sortedActiveTasks.length > 0 ||
    sortedVisibleBacklog.length > 0 ||
    sortedNoDeadlineTasks.length > 0;

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">To-do list</p>
        <h2>Your tasks</h2>
        <p>Active work stays visible. Future work appears when your list clears.</p>
      </header>

      <div className="panel">
        <div className="panel-header">
          <h3>Tasks</h3>
          <button
            className="small-button"
            onClick={() => setShowAddTask(!showAddTask)}
          >
            {showAddTask ? "Cancel" : "+ Add task"}
          </button>
        </div>

        <div className="task-sort-row" aria-label="Sort tasks">
          {taskSortOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                taskSortMode === option.value
                  ? "small-button sort-button active"
                  : "small-button sort-button"
              }
              onClick={() => setTaskSortMode(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {showAddTask && (
          <form className="add-task-form" onSubmit={addTask}>
            <SubjectField
              subjects={subjects}
              placeholder="Subject, e.g. Chemistry"
              value={newTask.subject}
              onChange={(subject) =>
                setNewTask({ ...newTask, subject })
              }
            />

            <input
              type="text"
              placeholder="Task title"
              value={newTask.title}
              onChange={(event) =>
                setNewTask({ ...newTask, title: event.target.value })
              }
            />

            <input
              type="date"
              value={newTask.dueDate}
              onChange={(event) =>
                setNewTask({ ...newTask, dueDate: event.target.value })
              }
            />

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

            <button className="primary-button" type="submit">
              Add task
            </button>
          </form>
        )}

        {!hasActiveTasks && (
          <div className="task-empty-state">
            <h3>
              {sortedCompletedTasks.length > 0
                ? "All caught up."
                : "No tasks yet."}
            </h3>
            <p>
              {sortedCompletedTasks.length > 0
                ? "Your current tasks are complete. Add another when you’re ready."
                : "Add your first assignment."}
            </p>
          </div>
        )}

        {sortedActiveTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            subjects={subjects}
            onToggle={toggleTask}
            onDelete={deleteTask}
            onUpdate={updateTask}
          />
        ))}

        {sortedVisibleBacklog.length > 0 && (
          <div className="task-section">
            <p className="section-label">Coming up</p>
            {sortedVisibleBacklog.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                subjects={subjects}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onUpdate={updateTask}
              />
            ))}
          </div>
        )}

        {hiddenBacklogCount > 0 && (
          <p className="muted-text">
            + {hiddenBacklogCount} more task
            {hiddenBacklogCount === 1 ? "" : "s"} in backlog
          </p>
        )}

        {sortedNoDeadlineTasks.length > 0 && (
          <div className="task-section">
            <p className="section-label">No deadline</p>
            {sortedNoDeadlineTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                subjects={subjects}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onUpdate={updateTask}
              />
            ))}
          </div>
        )}

        {sortedCompletedTasks.length > 0 && (
          <div className="task-section">
            <p className="section-label">Completed</p>
            {sortedCompletedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                subjects={subjects}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onUpdate={updateTask}
                completed
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TasksPage;
