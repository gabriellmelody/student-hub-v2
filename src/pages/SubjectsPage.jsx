import { useState } from "react";
import TaskSourceBadge from "../components/TaskSourceBadge.jsx";
import {
  getDaysLeft,
  getEffortLabel,
  getTaskSignalBadges,
  getUrgencyClass,
  getUrgencyLabel,
  parseDateKey,
  sortTasksForDisplay,
} from "../utils/appUtils.js";

function normalizeSubjectName(subjectName) {
  return String(subjectName || "").trim().toLocaleLowerCase();
}

function formatDueDate(dueDate) {
  if (!dueDate) return "No deadline";

  return parseDateKey(dueDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatCompletedDate(completedAt) {
  return new Date(completedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year:
      new Date(completedAt).getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  });
}

function SubjectsPage({
  subjects,
  tasks,
  completedTaskHistory,
  setActivePage,
  openSettings,
}) {
  const [selectedScope, setSelectedScope] = useState("all");
  const activeTasks = tasks.filter((task) => !task.completed);
  const selectedSubject = subjects.find(
    (subject) => subject.id === selectedScope
  );

  function matchesScope(subjectName) {
    const normalizedName = normalizeSubjectName(subjectName);

    if (selectedScope === "all") return true;
    if (selectedScope === "unassigned") return !normalizedName;

    return normalizedName === normalizeSubjectName(selectedSubject?.name);
  }

  const visibleActiveTasks = sortTasksForDisplay(
    activeTasks.filter((task) => matchesScope(task.subject))
  );
  const filteredHistory = completedTaskHistory.filter((record) =>
    matchesScope(record.subject)
  );
  const visibleHistory = filteredHistory.slice(0, 12);
  const nextDueTask = visibleActiveTasks.find((task) => task.dueDate);
  const scopeTitle =
    selectedScope === "all"
      ? "All subjects"
      : selectedScope === "unassigned"
        ? "Unassigned"
        : selectedSubject?.name || "Subject";

  function getSubjectSummary(subject) {
    const subjectName = normalizeSubjectName(subject.name);
    const subjectTasks = activeTasks.filter(
      (task) => normalizeSubjectName(task.subject) === subjectName
    );
    const subjectHistory = completedTaskHistory.filter(
      (record) => normalizeSubjectName(record.subject) === subjectName
    );
    const nextTask = sortTasksForDisplay(subjectTasks).find(
      (task) => task.dueDate
    );

    return {
      activeCount: subjectTasks.length,
      completedCount: subjectHistory.length,
      nextTask,
    };
  }

  return (
    <div className="page subjects-page">
      <header className="page-header subjects-page-header">
        <div className="subjects-page-header-copy">
          <p className="eyebrow">SUBJECTS</p>
          <h1>Your subjects</h1>
          <p>Workload, grades, and history by class.</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          data-tour="subject-add"
          aria-label="Manage subjects in Settings"
          onClick={() =>
            typeof openSettings === "function"
              ? openSettings("subjects")
              : setActivePage("settings")
          }
        >
          Manage in Settings
        </button>
      </header>

      {subjects.length === 0 ? (
        <section className="panel subjects-hub-empty">
          <h3>No subjects yet.</h3>
          <p>Add subjects to organise work by class.</p>
          <button
            type="button"
            className="primary-button"
            data-tour="subject-empty-add"
            onClick={() =>
              typeof openSettings === "function"
                ? openSettings("subjects")
                : setActivePage("settings")
            }
          >
            Open Settings
          </button>
        </section>
      ) : (
        <>
          <section
            className="subjects-overview"
            aria-label="Subject overview"
            data-tour="subjects-overview"
          >
            {subjects.map((subject) => {
              const summary = getSubjectSummary(subject);
              const isSelected = selectedScope === subject.id;

              return (
                <button
                  type="button"
                  className={`subject-overview-card ${
                    isSelected ? "active" : ""
                  }`}
                  key={subject.id}
                  aria-pressed={isSelected}
                  aria-label={`${subject.name}, ${summary.activeCount} active, ${summary.completedCount} completed${isSelected ? ", selected" : ""}`}
                  style={{ "--subject-color": subject.colour }}
                  onClick={() => setSelectedScope(subject.id)}
                >
                  <span className="subject-overview-colour" aria-hidden="true" />
                  <span className="subject-overview-heading">
                    <strong>{subject.name}</strong>
                    <small>
                      {subject.courseSystem} · {subject.level}
                    </small>
                  </span>
                  <span className="subject-overview-grades">
                    <small>Current</small>
                    <strong data-tour="subject-current-grade">
                      {subject.currentGrade || "Not set"}
                    </strong>
                    <i aria-hidden="true">→</i>
                    <small>Target</small>
                    <strong data-tour="subject-target-grade">
                      {subject.targetGrade || "Not set"}
                    </strong>
                  </span>
                  <span className="subject-overview-counts">
                    <span>
                      <strong>{summary.activeCount}</strong> active
                    </span>
                    <span>
                      <strong>{summary.completedCount}</strong> completed
                    </span>
                  </span>
                  <span className="subject-overview-next">
                    <small>Next due</small>
                    <strong>
                      {summary.nextTask
                        ? `${summary.nextTask.title} · ${formatDueDate(
                            summary.nextTask.dueDate
                          )}`
                        : "Nothing scheduled"}
                    </strong>
                  </span>
                </button>
              );
            })}
          </section>

          <section className="panel subject-detail-panel">
            <div className="subject-scope-row" aria-label="Subject filter">
              <button
                type="button"
                className={selectedScope === "all" ? "active" : ""}
                aria-pressed={selectedScope === "all"}
                onClick={() => setSelectedScope("all")}
              >
                All subjects
              </button>
              <button
                type="button"
                className={selectedScope === "unassigned" ? "active" : ""}
                aria-pressed={selectedScope === "unassigned"}
                onClick={() => setSelectedScope("unassigned")}
              >
                Unassigned
              </button>
            </div>

            <div className="subject-detail-header">
              <div>
                <p className="section-label">Current view</p>
                <h3>{scopeTitle}</h3>
              </div>
              <div className="subject-workload-summary">
                <span>
                  <strong>{visibleActiveTasks.length}</strong> active
                </span>
                <span>
                  <strong>{filteredHistory.length}</strong> completed
                </span>
                <span>
                  <strong>{nextDueTask ? formatDueDate(nextDueTask.dueDate) : "—"}</strong>
                  next due
                </span>
              </div>
            </div>

            <div className="subject-detail-grid">
              <section className="subject-task-section">
                <div className="subject-section-heading">
                  <h3>Active tasks</h3>
                  <button type="button" onClick={() => setActivePage("tasks")}>
                    Open tasks
                  </button>
                </div>

                {visibleActiveTasks.length > 0 ? (
                  <div className="subject-task-list">
                    {visibleActiveTasks.slice(0, 8).map((task) => {
                      const daysLeft = getDaysLeft(task.dueDate);

                      return (
                        <button
                          type="button"
                          className="subject-task-row"
                          key={task.id}
                          onClick={() => setActivePage("tasks")}
                        >
                          <span>
                            {selectedScope === "all" && (
                              <small>{task.subject || "Unassigned"}</small>
                            )}
                            <strong>{task.title}</strong>
                            <span className="task-signal-badges">
                              <TaskSourceBadge task={task} />
                              {getTaskSignalBadges(task)
                                .slice(0, 1)
                                .map((badge) => (
                                  <span
                                    className={`task-signal-badge task-signal-${badge.tone}`}
                                    key={`${badge.tone}-${badge.label}`}
                                  >
                                    {badge.label}
                                  </span>
                                ))}
                            </span>
                          </span>
                          <span>
                            <small>{getEffortLabel(task.effort)} effort</small>
                            <strong
                              className={
                                task.dueDate
                                  ? `urgency ${getUrgencyClass(daysLeft)}`
                                  : ""
                              }
                            >
                              {task.dueDate
                                ? getUrgencyLabel(daysLeft)
                                : "No deadline"}
                            </strong>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="subject-detail-empty">
                    <p>
                      {selectedScope === "all"
                        ? "Nothing active right now."
                        : "Nothing active for this subject."}
                    </p>
                  </div>
                )}
              </section>

              <section className="subject-history-section">
                <div className="subject-section-heading">
                  <h3>Completed recently</h3>
                </div>

                {visibleHistory.length > 0 ? (
                  <div className="subject-history-list">
                    {visibleHistory.map((record) => (
                      <div className="subject-history-row" key={record.id}>
                        <span>
                          {selectedScope === "all" && (
                            <small>{record.subject || "Unassigned"}</small>
                          )}
                          <strong>{record.title}</strong>
                          <span className="task-signal-badges">
                            <TaskSourceBadge task={record} />
                            {getTaskSignalBadges(record)
                              .slice(0, 1)
                              .map((badge) => (
                                <span
                                  className={`task-signal-badge task-signal-${badge.tone}`}
                                  key={`${badge.tone}-${badge.label}`}
                                >
                                  {badge.label}
                                </span>
                              ))}
                          </span>
                        </span>
                        <time dateTime={new Date(record.completedAt).toISOString()}>
                          {formatCompletedDate(record.completedAt)}
                        </time>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="subject-detail-empty">
                    <p>
                      {selectedScope === "all"
                        ? "No completed work yet."
                        : "No completed work here yet."}
                    </p>
                  </div>
                )}
              </section>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default SubjectsPage;
