import { useEffect, useState } from "react";
import "./App.css";

const defaultTasks = [
  {
    id: 1,
    subject: "English",
    title: "Essay draft",
    dueDate: "2026-06-22",
    effort: 3,
    completed: false,
  },
  {
    id: 2,
    subject: "Maths",
    title: "Problem set",
    dueDate: "2026-06-25",
    effort: 2,
    completed: false,
  },
  {
    id: 3,
    subject: "Biology",
    title: "Lab report",
    dueDate: "2026-07-02",
    effort: 4,
    completed: false,
  },
  {
    id: 4,
    subject: "History",
    title: "Chapter reading",
    dueDate: "",
    effort: 1,
    completed: false,
  },
];

function getDaysLeft(dueDate) {
  if (!dueDate) return null;

  const today = new Date();
  const due = new Date(dueDate);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
}

function getUrgencyLabel(daysLeft) {
  if (daysLeft === null) return "No deadline";
  if (daysLeft < 0) return "Overdue";
  if (daysLeft === 0) return "Due today";
  if (daysLeft === 1) return "Due tomorrow";
  return `${daysLeft} days left`;
}

function getUrgencyClass(daysLeft) {
  if (daysLeft === null) return "neutral";
  if (daysLeft <= 1) return "urgent";
  if (daysLeft <= 5) return "soon";
  return "safe";
}

function formatTime(startTime, minutesToAdd) {
  const [hours, minutes] = startTime.split(":").map(Number);

  const date = new Date();
  date.setHours(hours, minutes + minutesToAdd, 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTaskTip(task) {
  const daysLeft = getDaysLeft(task.dueDate);

  if (daysLeft !== null && daysLeft < 0) {
    return "This is overdue. Aim to finish the minimum acceptable version first.";
  }

  if (daysLeft !== null && daysLeft <= 1) {
    return "Focus on completion first, polish later.";
  }

  if (task.effort >= 4) {
    return "Break this into one clear section rather than trying to finish everything.";
  }

  if (!task.dueDate) {
    return "Do this only if it is quick or blocking something else.";
  }

  return "Make steady progress and stop when the block ends.";
}

function App() {
  const [tasks, setTasks] = useState(() => {
    const savedTasks = localStorage.getItem("student-hub-tasks");
    return savedTasks ? JSON.parse(savedTasks) : defaultTasks;
  });

  const [hoursAvailable, setHoursAvailable] = useState(() => {
    return localStorage.getItem("student-hub-hours") || 2;
  });

  const [startTime, setStartTime] = useState(() => {
    return localStorage.getItem("student-hub-start-time") || "16:00";
  });

  const [showAddTask, setShowAddTask] = useState(false);
  const [planBlocks, setPlanBlocks] = useState([]);

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
    localStorage.setItem("student-hub-hours", hoursAvailable);
  }, [hoursAvailable]);

  useEffect(() => {
    localStorage.setItem("student-hub-start-time", startTime);
  }, [startTime]);

  const activeTasks = tasks.filter((task) => {
    const daysLeft = getDaysLeft(task.dueDate);
    return !task.completed && daysLeft !== null && daysLeft <= 14;
  });

  const backlogTasks = tasks
    .filter((task) => {
      const daysLeft = getDaysLeft(task.dueDate);
      return !task.completed && daysLeft !== null && daysLeft > 14;
    })
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

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

  function toggleTask(taskId) {
    const taskBeingChanged = tasks.find((task) => task.id === taskId);

    setTasks(
      tasks.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );

    if (taskBeingChanged && !taskBeingChanged.completed) {
      setPlanBlocks(planBlocks.filter((block) => block.taskId !== taskId));
    }
  }

  function completeTaskFromPlan(taskId) {
    setTasks(
      tasks.map((task) =>
        task.id === taskId ? { ...task, completed: true } : task
      )
    );

    setPlanBlocks(planBlocks.filter((block) => block.taskId !== taskId));
  }

  function deleteTask(taskId) {
    setTasks(tasks.filter((task) => task.id !== taskId));
    setPlanBlocks(planBlocks.filter((block) => block.taskId !== taskId));
  }

  function clearPlan() {
    setPlanBlocks([]);
  }

  function addTask(event) {
    event.preventDefault();

    if (!newTask.subject.trim() || !newTask.title.trim()) {
      return;
    }

    const taskToAdd = {
      id: Date.now(),
      subject: newTask.subject.trim(),
      title: newTask.title.trim(),
      dueDate: newTask.dueDate,
      effort: Number(newTask.effort),
      completed: false,
    };

    setTasks([...tasks, taskToAdd]);

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
      return;
    }

    const sortedTasks = [...candidateTasks].sort((a, b) => {
      const aDays = getDaysLeft(a.dueDate);
      const bDays = getDaysLeft(b.dueDate);

      const safeADays = aDays === null ? 999 : aDays;
      const safeBDays = bDays === null ? 999 : bDays;

      if (safeADays !== safeBDays) {
        return safeADays - safeBDays;
      }

      return b.effort - a.effort;
    });

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
        taskId: task.id,
        subject: task.subject,
        title: task.title,
        start: formatTime(startTime, currentOffset),
        end: formatTime(startTime, currentOffset + duration),
        duration,
        tip: getTaskTip(task),
      });

      currentOffset += duration;
      remainingMinutes -= duration;

      if (remainingMinutes >= 30) {
        newPlan.push({
          id: `break-${currentOffset}`,
          type: "break",
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

    setPlanBlocks(newPlan);
  }

  const progressPercentage =
    tasks.length === 0
      ? 0
      : Math.round((completedTasks.length / tasks.length) * 100);

  return (
    <main className="app">
      <section className="hero">
        <div>
          <p className="eyebrow">Student Hub</p>
          <h1>Your school day, organised.</h1>
          <p className="subtitle">
            A self-filling student workspace for tasks, deadlines, and study
            planning.
          </p>
        </div>

        <div className="capacity-card">
          <span>Hours available today</span>
          <input
            type="number"
            min="0"
            max="12"
            value={hoursAvailable}
            onChange={(event) => setHoursAvailable(event.target.value)}
          />
        </div>
      </section>

      <section className="progress-card">
        <div className="progress-header">
          <span>Progress</span>
          <span>
            {completedTasks.length}/{tasks.length} done
          </span>
        </div>

        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        <p>{progressPercentage}% complete</p>
      </section>

      <section className="dashboard">
        <div className="panel">
          <div className="panel-header">
            <h2>Tasks</h2>
            <button
              className="small-button"
              onClick={() => setShowAddTask(!showAddTask)}
            >
              {showAddTask ? "Cancel" : "+ Add task"}
            </button>
          </div>

          {showAddTask && (
            <form className="add-task-form" onSubmit={addTask}>
              <input
                type="text"
                placeholder="Subject, e.g. Chemistry"
                value={newTask.subject}
                onChange={(event) =>
                  setNewTask({ ...newTask, subject: event.target.value })
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
                        ? "effort-button selected"
                        : "effort-button"
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

          {activeTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={toggleTask}
              onDelete={deleteTask}
            />
          ))}

          {visibleBacklog.length > 0 && (
            <div className="task-section">
              <p className="section-label">Coming up</p>
              {visibleBacklog.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={toggleTask}
                  onDelete={deleteTask}
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

          {noDeadlineTasks.length > 0 && (
            <div className="task-section">
              <p className="section-label">No deadline</p>
              {noDeadlineTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={toggleTask}
                  onDelete={deleteTask}
                />
              ))}
            </div>
          )}

          {completedTasks.length > 0 && (
            <div className="task-section">
              <p className="section-label">Completed</p>
              {completedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={toggleTask}
                  onDelete={deleteTask}
                  completed
                />
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Today’s plan</h2>

            <div className="plan-actions">
              {planBlocks.length > 0 && (
                <button className="small-button secondary" onClick={clearPlan}>
                  Clear
                </button>
              )}

              <button className="small-button" onClick={generatePlan}>
                {planBlocks.length > 0 ? "Regenerate" : "Plan my day"}
              </button>
            </div>
          </div>

          <div className="plan-controls">
            <label>
              <span>Start time</span>
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </label>
          </div>

          {planBlocks.length === 0 && (
            <div className="empty-plan">
              <h3>Ready when you are.</h3>
              <p>
                Set your available hours, choose a start time, then generate a
                simple study plan.
              </p>
            </div>
          )}

          {planBlocks.map((block) => {
            if (block.type === "message") {
              return (
                <div className="empty-plan" key={block.id}>
                  <h3>{block.title}</h3>
                  <p>{block.note}</p>
                </div>
              );
            }

            return (
              <div
                className={
                  block.type === "break"
                    ? "plan-block break-block"
                    : "plan-block"
                }
                key={block.id}
              >
                <div className="plan-time">
                  {block.start} – {block.end}
                </div>

                {block.type === "study" && (
                  <p className="plan-subject">{block.subject}</p>
                )}

                <h3>{block.title}</h3>
                <p>{block.tip}</p>

                {block.type === "study" && (
                  <button
                    className="complete-plan-button"
                    onClick={() => completeTaskFromPlan(block.taskId)}
                  >
                    Mark task done
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function TaskCard({ task, onToggle, onDelete, completed = false }) {
  const daysLeft = getDaysLeft(task.dueDate);
  const urgencyClass = getUrgencyClass(daysLeft);
  const urgencyLabel = getUrgencyLabel(daysLeft);

  return (
    <div className={`task-card ${completed ? "completed" : ""}`}>
      <button className="task-main" onClick={() => onToggle(task.id)}>
        <span className={`check-circle ${completed ? "checked" : ""}`}>
          {completed ? "✓" : ""}
        </span>

        <div className="task-content">
          <div className="task-topline">
            <span>{task.subject}</span>
            <span className={`urgency ${urgencyClass}`}>{urgencyLabel}</span>
          </div>

          <h3>{task.title}</h3>
          <p>Effort level {task.effort}/5</p>
        </div>
      </button>

      <button
        className="delete-button"
        onClick={() => onDelete(task.id)}
        aria-label={`Delete ${task.title}`}
      >
        ×
      </button>
    </div>
  );
}

export default App;