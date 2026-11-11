import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import TaskSourceBadge from "../components/TaskSourceBadge.jsx";
import {
  DEFAULT_PLANNING_PREFERENCES,
  normalizePlanningPreferences,
} from "../lib/cloudPlanning.js";
import {
  blockGuidedTourBackground,
  getFocusableTourElements,
  getTourFocusTrapTarget,
  restoreTourFocus,
} from "../utils/guidedTourUtils.js";
import {
  buildStudyRecommendations,
  clearUnlockedFutureRecommendationOverrides,
  createRecommendationOverride,
} from "../utils/studyRecommendations.js";

const BLOCK_DURATION_OPTIONS = [20, 25, 30, 45, 60, 90];

function formatWeekRange(startKey, endKey) {
  const start = new Date(`${startKey}T12:00:00`);
  const end = new Date(`${endKey}T12:00:00`);
  const sameMonth =
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear();

  if (sameMonth) {
    return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${end.toLocaleDateString(undefined, { day: "numeric" })}`;
  }

  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function createPreferenceDraft(preferences) {
  return normalizePlanningPreferences(
    preferences || DEFAULT_PLANNING_PREFERENCES
  );
}

const RECOMMENDATION_TYPE_LABELS = {
  assessment: "Assessment prep",
  homework: "Homework",
  routine: "Routine study",
  review: "Review",
};

function getAssessmentIndicator(recommendation) {
  if (recommendation.kind !== "assessment") return null;
  const label = recommendation.assessmentLabel || "Assessment";
  if (label === "Formative") return { short: "F", label };
  if (label === "Summative") return { short: "S", label };
  if (label === "CFA") return { short: "CFA", label };
  return { short: "A", label };
}

function RecommendationCard({
  recommendation,
  duration,
  onOpen,
  onToggleLock,
  subjectColour,
  extra = false,
}) {
  const typeLabel = extra
    ? "Extra work"
    : RECOMMENDATION_TYPE_LABELS[recommendation.kind] || "Study";
  const assessmentIndicator = getAssessmentIndicator(recommendation);
  const className = `study-recommendation-card is-${recommendation.kind}${extra ? " is-extra" : ""}${recommendation.locked ? " is-locked" : ""}${subjectColour ? " has-subject-colour" : ""}`;

  return (
    <article
      className={className}
      style={subjectColour ? { "--study-subject-colour": subjectColour } : undefined}
    >
      <button
        type="button"
        className="study-recommendation-open"
        onClick={onOpen}
        aria-label={`View recommendation details for ${recommendation.title}`}
      >
      <div className="study-recommendation-heading">
        <div>
          <span className="study-recommendation-subject">
            <i
              aria-hidden="true"
              style={{ backgroundColor: subjectColour || "var(--accent)" }}
            />
            {recommendation.subject}
          </span>
          <h3>{recommendation.title}</h3>
        </div>
      </div>
      <div className="study-recommendation-meta">
        {assessmentIndicator && (
          <span
            className="study-assessment-indicator"
            title={assessmentIndicator.label}
            aria-label={assessmentIndicator.label}
          >
            {assessmentIndicator.short}
          </span>
        )}
        <span className="study-recommendation-type">{typeLabel}</span>
        <span>{recommendation.reason} · {duration} min</span>
        {recommendation.source === "classroom" && (
          <TaskSourceBadge task={{ source: "classroom" }} />
        )}
      </div>
      </button>
      <button
        type="button"
        className="study-recommendation-lock"
        aria-label={`${recommendation.locked ? "Unlock" : "Lock"} ${recommendation.title}`}
        aria-pressed={recommendation.locked}
        title={recommendation.locked ? "Unlock recommendation" : "Lock recommendation"}
        onClick={onToggleLock}
      >
        <span className="study-lock-icon" aria-hidden="true" />
        <span>{recommendation.locked ? "Locked" : "Lock"}</span>
      </button>
    </article>
  );
}

function RecommendationList({
  day,
  onOpenRecommendation,
  onToggleLock,
  subjectColours,
  compact = false,
  emptyTitle = "Nothing recommended.",
  emptyMessage = "Add a routine in Study preferences if you want a regular fallback.",
  emptyAction = null,
}) {
  if (!day || (day.primary.length === 0 && day.extra.length === 0)) {
    return (
      <div className="study-recommendation-empty">
        <strong>{emptyTitle}</strong>
        <span>{emptyMessage}</span>
        {emptyAction}
      </div>
    );
  }

  return (
    <div className={compact ? "study-recommendation-list is-compact" : "study-recommendation-list"}>
      {day.primary.map((recommendation, index) => (
        <section
          className={`study-recommendation-row is-priority-${index + 1}`}
          aria-labelledby={!compact ? `${day.dateKey}-priority-${index + 1}` : undefined}
          key={recommendation.id}
        >
          {!compact && (
            <h3
              className="study-priority-label"
              id={`${day.dateKey}-priority-${index + 1}`}
            >
              Priority {index + 1}
            </h3>
          )}
          <RecommendationCard
            recommendation={recommendation}
            duration={day.blockDurationMinutes}
            onOpen={() => onOpenRecommendation(day.dateKey, index)}
            onToggleLock={() => onToggleLock(day, recommendation, index)}
            subjectColour={subjectColours.get(recommendation.subject)}
          />
        </section>
      ))}

      {day.extra.length > 0 && (
        <section className="study-recommendation-extra" aria-label="Extra work recommended">
          <div>
            <span className="eyebrow">Extra work recommended</span>
            <p>Your normal target is full, but this work still needs attention.</p>
          </div>
          <div className="study-recommendation-extra-grid">
            {day.extra.map((recommendation, index) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                duration={day.blockDurationMinutes}
                onOpen={() => onOpenRecommendation(day.dateKey, index + 3)}
                onToggleLock={() => onToggleLock(day, recommendation, index + 3)}
                subjectColour={subjectColours.get(recommendation.subject)}
                extra
              />
            ))}
          </div>
        </section>
      )}

      {day.finishEarly && (
        <section className="study-recommendation-finish-early" aria-label="If you finish early">
          <div>
            <span className="eyebrow">If you finish early</span>
            <p>Optional lower-priority work after your main study target.</p>
          </div>
          <RecommendationCard
            recommendation={day.finishEarly}
            duration={day.blockDurationMinutes}
            onOpen={() => onOpenRecommendation(day.dateKey, 2)}
            onToggleLock={() => onToggleLock(day, day.finishEarly, 2)}
            subjectColour={subjectColours.get(day.finishEarly.subject)}
          />
        </section>
      )}
    </div>
  );
}

function getRecommendationForSlot(day, slotIndex) {
  if (!day) return null;
  if (slotIndex <= 1) return day.primary[slotIndex] || null;
  if (slotIndex === 2) return day.finishEarly || null;
  return day.extra[slotIndex - 3] || null;
}

function formatRecommendationDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function RecommendationDetailsModal({
  day,
  recommendation,
  duration,
  saving,
  onClose,
  onOpenTask,
  onSwap,
  onToggleLock,
  subjectColours,
}) {
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(document.activeElement);
  const typeLabel = RECOMMENDATION_TYPE_LABELS[recommendation.kind] || "Study";

  useEffect(() => {
    const returnFocusElement = returnFocusRef.current;
    const restoreBackground = blockGuidedTourBackground(document.querySelector(".app-shell"));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      getFocusableTourElements(dialogRef.current)[0]?.focus();
    });

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusableTourElements(dialogRef.current);
      const nextTarget = getTourFocusTrapTarget(focusable, document.activeElement, event.shiftKey);
      if (!nextTarget) return;
      event.preventDefault();
      nextTarget.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreBackground();
      restoreTourFocus(returnFocusElement);
    };
  }, [onClose]);

  return createPortal(
    <div className="study-detail-layer" role="presentation">
      <button
        type="button"
        className="study-detail-backdrop"
        aria-label="Close recommendation details"
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        className="study-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="study-detail-title"
      >
        <header className="study-detail-header">
          <div>
            <span
              className="study-detail-subject"
              style={{ "--study-subject-colour": subjectColours.get(recommendation.subject) || "var(--accent)" }}
            >
              <i aria-hidden="true" />
              {recommendation.subject}
            </span>
            <h2 id="study-detail-title">{recommendation.title}</h2>
            <p>{day.label} recommendation</p>
          </div>
          <button type="button" aria-label="Close recommendation details" onClick={onClose}>×</button>
        </header>

        <div className="study-detail-layout">
          <div className="study-detail-main">
            <p className="study-detail-reason">{recommendation.reason} · {duration} min</p>

            {recommendation.description && (
              <section className="study-detail-description">
                <h3>What to work on</h3>
                <p>{recommendation.description}</p>
              </section>
            )}

            <div className="study-detail-context" aria-label="Recommendation details">
              {recommendation.dueDate && (
                <span>{recommendation.kind === "assessment" ? "Assessment" : "Due"} {formatRecommendationDate(recommendation.dueDate)}</span>
              )}
              <span>{recommendation.assessmentLabel || typeLabel}</span>
              <span className={recommendation.locked ? "is-locked" : ""}>
                {recommendation.locked ? "Locked for Redo week" : "Updates with Redo week"}
              </span>
            </div>

            <div className="study-detail-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={saving}
                onClick={onToggleLock}
              >
                <span className="study-lock-icon" aria-hidden="true" />
                {recommendation.locked ? "Unlock recommendation" : "Lock recommendation"}
              </button>
              {recommendation.taskId && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onOpenTask(recommendation.taskId)}
                >
                  Open Task
                </button>
              )}
            </div>
          </div>

          <aside className="study-detail-alternatives" aria-labelledby="study-alternatives-title">
            <div>
              <span className="eyebrow">Swap recommendation</span>
              <h3 id="study-alternatives-title">Other work you could do</h3>
              <p>Choose a different recommendation for this study block.</p>
            </div>
            {day.alternatives.length > 0 ? (
              <div className="study-alternative-list">
                {day.alternatives.map((alternative) => (
                  <button
                    type="button"
                    key={alternative.id}
                    style={{ "--study-subject-colour": subjectColours.get(alternative.subject) || "var(--accent)" }}
                    disabled={saving}
                    onClick={() => onSwap(alternative)}
                  >
                    <span className="study-alternative-subject"><i aria-hidden="true" />{alternative.subject}</span>
                    <strong>{alternative.title}</strong>
                    <small>{alternative.reason}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="study-detail-no-alternatives">No other useful work is available for this slot.</p>
            )}
          </aside>
        </div>
      </section>
    </div>,
    document.body
  );
}

function StudyPreferencesModal({ preferences, onClose, onSave }) {
  const [draft, setDraft] = useState(() => createPreferenceDraft(preferences));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(document.activeElement);

  useEffect(() => {
    const returnFocusElement = returnFocusRef.current;
    const restoreBackground = blockGuidedTourBackground(
      document.querySelector(".app-shell")
    );
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      getFocusableTourElements(dialogRef.current)[0]?.focus();
    });

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusableTourElements(dialogRef.current);
      const nextTarget = getTourFocusTrapTarget(
        focusable,
        document.activeElement,
        event.shiftKey
      );
      if (!nextTarget) return;
      event.preventDefault();
      nextTarget.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreBackground();
      restoreTourFocus(returnFocusElement);
    };
  }, [onClose]);

  function updateDailyBlocks(value) {
    const dailyStudyBlocks = Number(value);
    setDraft((current) => ({ ...current, dailyStudyBlocks }));
  }

  async function submitPreferences(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const saved = await onSave({
      dailyStudyBlocks: draft.dailyStudyBlocks,
      blockDurationMinutes: draft.blockDurationMinutes,
    });
    setSaving(false);
    if (!saved) {
      setError("Study preferences could not be saved. Try again.");
      return;
    }
    onClose();
  }

  return createPortal(
    <div className="study-preferences-layer" role="presentation">
      <button
        className="study-preferences-backdrop"
        type="button"
        aria-label="Close study preferences"
        onClick={onClose}
      />
      <form
        ref={dialogRef}
        className="study-preferences-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="study-preferences-title"
        onSubmit={submitPreferences}
      >
        <header className="study-preferences-header">
          <div>
            <span className="eyebrow">Plan</span>
            <h2 id="study-preferences-title">Study preferences</h2>
            <p>Choose a realistic daily study target.</p>
          </div>
          <button type="button" aria-label="Close study preferences" onClick={onClose}>×</button>
        </header>

        <div className="study-preferences-scroll">
          <div className="study-preferences-capacity">
            <label>
              <span>Daily study blocks</span>
              <select value={draft.dailyStudyBlocks} onChange={(event) => updateDailyBlocks(event.target.value)}>
                {[1, 2, 3, 4, 5, 6].map((count) => (
                  <option key={count} value={count}>{count} block{count === 1 ? "" : "s"}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Block duration</span>
              <select
                value={draft.blockDurationMinutes}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  blockDurationMinutes: Number(event.target.value),
                }))}
              >
                {BLOCK_DURATION_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>{minutes} minutes</option>
                ))}
              </select>
            </label>
          </div>

          {error && <p className="settings-inline-error" role="alert">{error}</p>}
        </div>

        <footer className="study-preferences-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Saving…" : "Save preferences"}
          </button>
        </footer>
      </form>
    </div>,
    document.body
  );
}

function PlanPage({
  tasks = [],
  subjects = [],
  planningPreferences,
  updatePlanningPreferences,
  openTaskDetails,
  loading = false,
  syncError = null,
}) {
  const [view, setView] = useState("today");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [redoRevision, setRedoRevision] = useState(0);
  const [redoMessage, setRedoMessage] = useState("");
  const historicalDaysRef = useRef([]);
  const closePreferences = useCallback(() => setPreferencesOpen(false), []);
  const closeRecommendationDetails = useCallback(() => setSelectedSlot(null), []);
  const preferences = planningPreferences || DEFAULT_PLANNING_PREFERENCES;
  const accountKey = planningPreferences?.userId || "default";
  const historyAccountRef = useRef(accountKey);
  if (historyAccountRef.current !== accountKey) {
    historyAccountRef.current = accountKey;
    historicalDaysRef.current = [];
  }
  const subjectColours = useMemo(
    () => new Map(subjects.map((subject) => [subject.name, subject.colour || subject.color || null])),
    [subjects]
  );
  const recommendations = useMemo(
    () => {
      void redoRevision;
      return buildStudyRecommendations({
        tasks,
        subjects,
        preferences,
        previousDays: historicalDaysRef.current,
      });
    },
    [preferences, redoRevision, subjects, tasks]
  );
  const selectedDay = selectedSlot
    ? recommendations.days.find((day) => day.dateKey === selectedSlot.dateKey)
    : null;
  const selectedRecommendation = selectedDay
    ? getRecommendationForSlot(selectedDay, selectedSlot.slotIndex)
    : null;

  useEffect(() => {
    historicalDaysRef.current = recommendations.days;
  }, [recommendations.days]);

  useEffect(() => {
    setSelectedSlot(null);
    setRedoMessage("");
  }, [accountKey]);

  useEffect(() => {
    if (selectedSlot && !selectedRecommendation) setSelectedSlot(null);
  }, [selectedRecommendation, selectedSlot]);

  async function persistRecommendationOverrides(nextOverrides) {
    setOverrideSaving(true);
    setRedoMessage("");
    const saved = await updatePlanningPreferences({ recommendationOverrides: nextOverrides });
    setOverrideSaving(false);
    return Boolean(saved);
  }

  function upsertOverride(overrides, nextOverride) {
    return [
      ...overrides.filter((override) =>
        !(override.dateKey === nextOverride.dateKey && override.slotIndex === nextOverride.slotIndex)
      ),
      nextOverride,
    ];
  }

  async function handleToggleLock(day, recommendation, slotIndex) {
    const overrides = preferences.recommendationOverrides || [];
    const existing = overrides.find((override) =>
      override.dateKey === day.dateKey && override.slotIndex === slotIndex
    );
    let nextOverrides;
    if (recommendation.locked) {
      nextOverrides = existing?.manual
        ? upsertOverride(overrides, { ...existing, locked: false })
        : overrides.filter((override) => override !== existing);
    } else {
      const nextOverride = createRecommendationOverride({
        dateKey: day.dateKey,
        slotIndex,
        recommendation,
        locked: true,
        manual: Boolean(existing?.manual || recommendation.manualOverride),
      });
      if (!nextOverride) return false;
      nextOverrides = upsertOverride(overrides, nextOverride);
    }
    return persistRecommendationOverrides(nextOverrides);
  }

  async function handleSwapRecommendation(alternative) {
    if (!selectedDay || !selectedSlot) return false;
    const overrides = preferences.recommendationOverrides || [];
    const existing = overrides.find((override) =>
      override.dateKey === selectedDay.dateKey && override.slotIndex === selectedSlot.slotIndex
    );
    const nextOverride = createRecommendationOverride({
      dateKey: selectedDay.dateKey,
      slotIndex: selectedSlot.slotIndex,
      recommendation: alternative,
      locked: Boolean(existing?.locked),
      manual: true,
    });
    if (!nextOverride) return false;
    return persistRecommendationOverrides(upsertOverride(overrides, nextOverride));
  }

  async function handleRedoWeek() {
    const nextOverrides = clearUnlockedFutureRecommendationOverrides(
      preferences.recommendationOverrides,
      recommendations.todayKey
    );
    const saved = await persistRecommendationOverrides(nextOverrides);
    if (!saved) return;
    setRedoRevision((current) => current + 1);
    setRedoMessage("Week updated");
  }

  function openRecommendationDetails(dateKey, slotIndex) {
    setSelectedSlot({ dateKey, slotIndex });
  }

  function handleViewTabKeyDown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tablist = event.currentTarget.closest('[role="tablist"]');
    const nextView = event.key === "ArrowLeft" || event.key === "Home" ? "today" : "week";
    setView(nextView);
    window.requestAnimationFrame(() => {
      tablist
        ?.querySelector(`[data-view="${nextView}"]`)
        ?.focus();
    });
  }

  if (loading) {
    return <section className="plan-page" aria-busy="true"><p>Loading study recommendations…</p></section>;
  }

  return (
    <div className="page plan-page study-plan-page">
      {syncError && (
        <p className="settings-inline-error" role="alert">
          Study preferences could not sync. Your latest change may not be saved.
        </p>
      )}
      <header className="page-header plan-page-header study-plan-header">
        <div className="study-plan-title">
          <h1>Plan</h1>
        </div>
        <div className="study-plan-controls">
          <div className="study-view-toggle" role="tablist" aria-label="Recommendation period">
            <button
              type="button"
              role="tab"
              data-view="today"
              className={view === "today" ? "is-active" : ""}
              aria-selected={view === "today"}
              tabIndex={view === "today" ? 0 : -1}
              onKeyDown={handleViewTabKeyDown}
              onClick={() => setView("today")}
            >
              Today
            </button>
            <button
              type="button"
              role="tab"
              data-view="week"
              className={view === "week" ? "is-active" : ""}
              aria-selected={view === "week"}
              tabIndex={view === "week" ? 0 : -1}
              onKeyDown={handleViewTabKeyDown}
              onClick={() => setView("week")}
            >
              Week
            </button>
          </div>
          <div className="study-plan-toolbar-actions">
            <span>{recommendations.dailyBlockCount} block{recommendations.dailyBlockCount === 1 ? "" : "s"} · {recommendations.blockDurationMinutes} min each</span>
            <button type="button" className="secondary-button" onClick={() => setPreferencesOpen(true)}>
              Edit preferences
            </button>
            <button type="button" className="secondary-button" disabled={overrideSaving} onClick={handleRedoWeek}>
              {overrideSaving ? "Updating…" : "Redo week"}
            </button>
          </div>
        </div>
      </header>
      {redoMessage && <p className="study-plan-status" role="status">{redoMessage}</p>}

      {view === "today" ? (
        <section className="panel study-today-panel" data-tour="todays-plan-overview">
          <header>
            <div>
              <h2>Today</h2>
              <p>{recommendations.today?.date.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}</p>
            </div>
            <div className="study-daily-target" aria-label={`${recommendations.dailyBlockCount} study blocks of ${recommendations.blockDurationMinutes} minutes`}>
              <strong>{recommendations.dailyBlockCount} study block{recommendations.dailyBlockCount === 1 ? "" : "s"}</strong>
              <span>{recommendations.blockDurationMinutes} min each</span>
            </div>
          </header>
          <RecommendationList
            day={recommendations.today}
            onOpenRecommendation={openRecommendationDetails}
            onToggleLock={handleToggleLock}
            subjectColours={subjectColours}
            emptyTitle="No recommendations today"
            emptyMessage={subjects.length === 0
              ? "Add a Subject or task to start building study recommendations."
              : "You have no active deadline work to focus on today."}
          />
        </section>
      ) : (
        <section className="study-week-panel" aria-labelledby="study-week-title">
          <header>
            <div>
              <span className="eyebrow">Week</span>
              <h2 id="study-week-title">{formatWeekRange(recommendations.weekStart, recommendations.weekEnd)}</h2>
            </div>
            <span>Monday–Sunday</span>
          </header>
          <div className="study-week-grid">
            {recommendations.days.map((day) => (
              <section className={`study-week-day${day.isToday ? " is-today" : ""}${day.historical ? " is-past" : ""}`} key={day.dateKey}>
                <header>
                  <div>
                    <h3>{day.label}</h3>
                    <span>{day.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  </div>
                  {day.isToday && <span className="study-today-label">Today</span>}
                </header>
                <RecommendationList
                  day={day}
                  onOpenRecommendation={openRecommendationDetails}
                  onToggleLock={handleToggleLock}
                  subjectColours={subjectColours}
                  compact
                  emptyTitle={day.historical ? "Past day" : "No recommendations"}
                  emptyMessage={day.historical ? "Past recommendations are left unchanged." : "No deadline work or routine study."}
                />
              </section>
            ))}
          </div>
        </section>
      )}

      {preferencesOpen && (
        <StudyPreferencesModal
          preferences={preferences}
          onClose={closePreferences}
          onSave={updatePlanningPreferences}
        />
      )}

      {selectedDay && selectedRecommendation && (
        <RecommendationDetailsModal
          day={selectedDay}
          recommendation={selectedRecommendation}
          duration={selectedDay.blockDurationMinutes}
          saving={overrideSaving}
          onClose={closeRecommendationDetails}
          onOpenTask={(taskId) => {
            closeRecommendationDetails();
            openTaskDetails(taskId);
          }}
          onSwap={handleSwapRecommendation}
          onToggleLock={() => handleToggleLock(
            selectedDay,
            selectedRecommendation,
            selectedSlot.slotIndex
          )}
          subjectColours={subjectColours}
        />
      )}
    </div>
  );
}

export default PlanPage;
