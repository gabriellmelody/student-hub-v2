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
  filterValidMoveOverrides,
  getDayStudyMinutes,
  getHorizonStudyMinutes,
  getRecommendationDurationMinutes,
  isRecommendationEligibleOnDate,
  PLAN_BLOCK_DURATION_OPTIONS,
} from "../utils/studyRecommendations.js";

const BLOCK_DURATION_OPTIONS = [20, 25, 30, 45, 60, 90];

function formatHorizonRange(startKey, endKey) {
  const start = new Date(`${startKey}T12:00:00`);
  const end = new Date(`${endKey}T12:00:00`);
  const options = { weekday: "short", month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, options)} → ${end.toLocaleDateString(undefined, options)}`;
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
  number = null,
  onSwap,
}) {
  const typeLabel = extra
    ? "Extra work"
    : RECOMMENDATION_TYPE_LABELS[recommendation.kind] || "Study";
  const assessmentIndicator = getAssessmentIndicator(recommendation);
  const className = `study-recommendation-card is-${recommendation.kind}${extra ? " is-extra" : ""}${recommendation.locked ? " is-locked" : ""}${subjectColour ? " has-subject-colour" : ""}${number !== null ? " has-number" : ""}`;

  return (
    <article
      className={className}
      style={subjectColour ? { "--study-subject-colour": subjectColour } : undefined}
    >
      {number !== null && <span className="study-recommendation-number" aria-hidden="true">{number}</span>}
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
      <div className="study-recommendation-actions">
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
        {onSwap && (
          <button type="button" className="study-recommendation-swap" onClick={onSwap}>
            Swap
          </button>
        )}
        <button type="button" className="study-recommendation-more" aria-label={`More details for ${recommendation.title}`} onClick={onOpen}>⋯</button>
      </div>
    </article>
  );
}

function RecommendationList({
  day,
  onOpenRecommendation,
  onToggleLock,
  subjectColours,
  compact = false,
  optionalOpen = false,
  onToggleOptional,
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
      {day.primary.map((recommendation, index) => {
        const slotIndex = recommendation.overrideSlotIndex ?? index;
        return <section
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
            duration={getRecommendationDurationMinutes(recommendation, day.blockDurationMinutes)}
            onOpen={() => onOpenRecommendation(day.dateKey, slotIndex)}
            onToggleLock={() => onToggleLock(day, recommendation, slotIndex)}
            subjectColour={subjectColours.get(recommendation.subject)}
            number={!compact ? index + 1 : null}
            onSwap={() => onOpenRecommendation(day.dateKey, slotIndex)}
          />
        </section>;
      })}

      {day.extra.length > 0 && (
        <section className="study-recommendation-extra" aria-label="Extra work recommended">
          <div>
            <span className="eyebrow">Extra work recommended</span>
            <p>Your normal target is full, but this work still needs attention.</p>
          </div>
          <div className="study-recommendation-extra-grid">
            {day.extra.map((recommendation, index) => {
              const slotIndex = recommendation.overrideSlotIndex ?? index + 3;
              return <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                duration={getRecommendationDurationMinutes(recommendation, day.blockDurationMinutes)}
                onOpen={() => onOpenRecommendation(day.dateKey, slotIndex)}
                onToggleLock={() => onToggleLock(day, recommendation, slotIndex)}
                subjectColour={subjectColours.get(recommendation.subject)}
                extra
              />;
            })}
          </div>
        </section>
      )}

      {day.finishEarly && (
        <section className="study-recommendation-finish-early" aria-label="If you finish early">
          <button
            type="button"
            className="study-optional-toggle"
            aria-expanded={optionalOpen}
            onClick={onToggleOptional}
          >
            <span>{optionalOpen ? "Hide optional" : "+1 more optional"}</span>
            <small>If you finish early</small>
          </button>
          {optionalOpen && (
            <RecommendationCard
              recommendation={day.finishEarly}
              duration={getRecommendationDurationMinutes(day.finishEarly, day.blockDurationMinutes)}
              onOpen={() => onOpenRecommendation(day.dateKey, day.finishEarly.overrideSlotIndex ?? 2)}
              onToggleLock={() => onToggleLock(day, day.finishEarly, day.finishEarly.overrideSlotIndex ?? 2)}
              subjectColour={subjectColours.get(day.finishEarly.subject)}
              onSwap={() => onOpenRecommendation(day.dateKey, day.finishEarly.overrideSlotIndex ?? 2)}
            />
          )}
        </section>
      )}
    </div>
  );
}

function NextSevenRecommendation({
  recommendation,
  duration,
  subjectColour,
  onOpen,
  onDragStart,
  onDragEnd,
  dragging = false,
}) {
  const typeLabel = RECOMMENDATION_TYPE_LABELS[recommendation.kind] || "Study";
  return (
    <button
      type="button"
      className={`study-horizon-recommendation is-${recommendation.kind}${dragging ? " is-dragging" : ""}`}
      style={subjectColour ? { "--study-subject-colour": subjectColour } : undefined}
      onClick={onOpen}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      aria-label={`View recommendation details for ${recommendation.title}`}
    >
      <i aria-hidden="true" />
      <span>
        <strong>{recommendation.subject} · {typeLabel}</strong>
        <small>{recommendation.title}</small>
      </span>
      <b>{duration} min</b>
    </button>
  );
}

function NextSevenDays({
  recommendations,
  subjectColours,
  expandedOptionalDays,
  onToggleOptional,
  onOpenRecommendation,
  onOpenTask,
  draggedSlot,
  onDragStart,
  onDragEnd,
  onDropRecommendation,
  isValidMoveDate,
}) {
  const totalBlocks = recommendations.days.reduce(
    (sum, day) => sum + day.primary.length + day.extra.length,
    0
  );
  const totalMinutes = getHorizonStudyMinutes(recommendations.days);

  return (
    <section className="panel study-horizon-panel" aria-labelledby="study-horizon-title">
      <header className="study-horizon-header">
        <div>
          <h2 id="study-horizon-title">Next 7 Days</h2>
          <p>{formatHorizonRange(recommendations.weekStart, recommendations.weekEnd)}</p>
        </div>
        <span>{totalBlocks} study block{totalBlocks === 1 ? "" : "s"} · {formatDuration(totalMinutes)}</span>
      </header>

      <div className="study-horizon-days">
        {recommendations.days.map((day) => {
          const mainRecommendations = [...day.primary, ...day.extra];
          const optionalOpen = expandedOptionalDays.has(day.dateKey);
          return (
            <section
              className={`study-horizon-day${day.isToday ? " is-today" : ""}${draggedSlot ? (isValidMoveDate(day.dateKey) ? " is-drop-valid" : " is-drop-invalid") : ""}`}
              key={day.dateKey}
              onDragOver={(event) => {
                if (!draggedSlot) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = isValidMoveDate(day.dateKey) ? "move" : "none";
              }}
              onDrop={(event) => {
                event.preventDefault();
                onDropRecommendation(day.dateKey);
              }}
            >
              <header>
                <strong>{day.date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</strong>
                {day.isToday && <span className="study-today-label">Today</span>}
              </header>
              <div className="study-horizon-items">
                {mainRecommendations.map((recommendation, index) => {
                  const slotIndex = recommendation.overrideSlotIndex ?? (index < day.primary.length
                    ? index
                    : index - day.primary.length + 3);
                  return (
                    <NextSevenRecommendation
                      key={recommendation.id}
                      recommendation={recommendation}
                      duration={getRecommendationDurationMinutes(recommendation, day.blockDurationMinutes)}
                      subjectColour={subjectColours.get(recommendation.subject)}
                      onOpen={() => onOpenRecommendation(day.dateKey, slotIndex)}
                      onDragStart={(event) => onDragStart(event, day.dateKey, slotIndex)}
                      onDragEnd={onDragEnd}
                      dragging={draggedSlot?.dateKey === day.dateKey && draggedSlot?.slotIndex === slotIndex}
                    />
                  );
                })}
                {day.finishEarly && (
                  <>
                    <button
                      type="button"
                      className="study-horizon-optional-toggle"
                      aria-expanded={optionalOpen}
                      onClick={() => onToggleOptional(day.dateKey)}
                    >
                      {optionalOpen ? "Hide optional" : "+1 optional"}
                    </button>
                    {optionalOpen && (
                      <NextSevenRecommendation
                        recommendation={day.finishEarly}
                        duration={getRecommendationDurationMinutes(day.finishEarly, day.blockDurationMinutes)}
                        subjectColour={subjectColours.get(day.finishEarly.subject)}
                        onOpen={() => onOpenRecommendation(day.dateKey, day.finishEarly.overrideSlotIndex ?? 2)}
                        onDragStart={(event) => onDragStart(event, day.dateKey, day.finishEarly.overrideSlotIndex ?? 2)}
                        onDragEnd={onDragEnd}
                        dragging={draggedSlot?.dateKey === day.dateKey && draggedSlot?.slotIndex === (day.finishEarly.overrideSlotIndex ?? 2)}
                      />
                    )}
                  </>
                )}
                {day.deadlines?.map((deadline) => (
                  <button
                    type="button"
                    className="study-horizon-deadline"
                    key={deadline.id}
                    onClick={() => onOpenTask(deadline.taskId)}
                  >
                    <span>
                      <strong>{deadline.subject} · {deadline.title}</strong>
                      <small>Assessment date</small>
                    </span>
                    <b>{deadline.assessmentLabel}</b>
                  </button>
                ))}
                {mainRecommendations.length === 0 && !day.finishEarly && day.deadlines?.length === 0 && (
                  <span className="study-horizon-empty">No study blocks recommended.</span>
                )}
              </div>
              <footer>
                <strong>{mainRecommendations.length} block{mainRecommendations.length === 1 ? "" : "s"}</strong>
                <span>{mainRecommendations.length > 0
                  ? formatDuration(getDayStudyMinutes(day))
                  : "Free day"}</span>
              </footer>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function formatDuration(minutes) {
  if (minutes <= 0) return "0 min";
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (!hours) return `${remaining} min`;
  return `${hours}h${remaining ? ` ${remaining}m` : ""}`;
}

function getDayRecommendationSlots(day) {
  if (!day) return [];
  return [
    ...day.primary.map((recommendation, index) => ({
      recommendation,
      slotIndex: recommendation.overrideSlotIndex ?? index,
    })),
    ...(day.finishEarly ? [{
      recommendation: day.finishEarly,
      slotIndex: day.finishEarly.overrideSlotIndex ?? 2,
    }] : []),
    ...day.extra.map((recommendation, index) => ({
      recommendation,
      slotIndex: recommendation.overrideSlotIndex ?? index + 3,
    })),
  ];
}

function getRecommendationForSlot(day, slotIndex) {
  return getDayRecommendationSlots(day)
    .find((entry) => entry.slotIndex === slotIndex)?.recommendation || null;
}

function getNextManualSlot(day) {
  const occupiedSlots = new Set(getDayRecommendationSlots(day).map((entry) => entry.slotIndex));
  for (let slotIndex = 3; slotIndex <= 12; slotIndex += 1) {
    if (!occupiedSlots.has(slotIndex)) return slotIndex;
  }
  return null;
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
  onMove,
  onRemove,
  onDurationChange,
  validMoveDates,
  subjectColours,
}) {
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(document.activeElement);
  const [moveDate, setMoveDate] = useState("");
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
                {recommendation.locked ? "Locked for Redo plan" : "Updates with Redo plan"}
              </span>
            </div>

            <div className="study-detail-manual-controls" aria-label="Manual plan controls">
              <label>
                <span>Duration</span>
                <select
                  value={duration}
                  disabled={saving}
                  onChange={(event) => onDurationChange(Number(event.target.value))}
                >
                  {Array.from(new Set([...PLAN_BLOCK_DURATION_OPTIONS, duration]))
                    .sort((first, second) => first - second)
                    .map((minutes) => (
                      <option key={minutes} value={minutes}>{minutes} min</option>
                    ))}
                </select>
              </label>
              <label>
                <span>Move to…</span>
                <select
                  value={moveDate}
                  disabled={saving || validMoveDates.length === 0}
                  onChange={(event) => setMoveDate(event.target.value)}
                >
                  <option value="">Choose a day</option>
                  {validMoveDates.map((date) => (
                    <option key={date.dateKey} value={date.dateKey}>{date.label}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="secondary-button"
                disabled={saving || !moveDate}
                onClick={() => onMove(moveDate)}
              >
                Move block
              </button>
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
              <button
                type="button"
                className="study-detail-remove"
                disabled={saving}
                onClick={onRemove}
              >
                Remove study block
              </button>
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
  const [expandedOptionalDays, setExpandedOptionalDays] = useState(() => new Set());
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [redoRevision, setRedoRevision] = useState(0);
  const [redoMessage, setRedoMessage] = useState("");
  const [draggedSlot, setDraggedSlot] = useState(null);
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
  const selectedMoveDates = selectedRecommendation
    ? recommendations.days
      .filter((day) =>
        day.dateKey !== selectedDay?.dateKey &&
        isRecommendationEligibleOnDate(selectedRecommendation, day.dateKey, recommendations.todayKey)
      )
      .map((day) => ({
        dateKey: day.dateKey,
        label: day.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
      }))
    : [];

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
    const saved = await updatePlanningPreferences({
      recommendationOverrides: filterValidMoveOverrides(
        nextOverrides,
        tasks,
        recommendations.todayKey
      ),
    });
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
        originDateKey: existing?.originDateKey || recommendation.manualOriginDateKey,
        originSlotIndex: existing?.originSlotIndex ?? recommendation.manualOriginSlotIndex,
        durationMinutes: existing?.durationMinutes || recommendation.durationMinutes,
        added: Boolean(existing?.added || recommendation.manualAdded),
      });
      if (!nextOverride) return false;
      nextOverrides = upsertOverride(overrides, nextOverride);
    }
    return persistRecommendationOverrides(nextOverrides);
  }

  async function handleSwapRecommendation(alternative) {
    if (!selectedDay || !selectedSlot) return false;
    if (!isRecommendationEligibleOnDate(alternative, selectedDay.dateKey, recommendations.todayKey)) {
      setRedoMessage("That recommendation cannot be placed on this day.");
      return false;
    }
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
      originDateKey: existing?.originDateKey || selectedRecommendation.manualOriginDateKey,
      originSlotIndex: existing?.originSlotIndex ?? selectedRecommendation.manualOriginSlotIndex,
      durationMinutes: existing?.durationMinutes || selectedRecommendation.durationMinutes,
      added: Boolean(existing?.added || selectedRecommendation.manualAdded),
    });
    if (!nextOverride) return false;
    return persistRecommendationOverrides(upsertOverride(overrides, nextOverride));
  }

  async function handleMoveRecommendation(sourceDateKey, sourceSlotIndex, destinationDateKey) {
    const sourceDay = recommendations.days.find((day) => day.dateKey === sourceDateKey);
    const destinationDay = recommendations.days.find((day) => day.dateKey === destinationDateKey);
    const recommendation = getRecommendationForSlot(sourceDay, sourceSlotIndex);
    if (!sourceDay || !destinationDay || !recommendation) return false;
    if (
      sourceDateKey === destinationDateKey ||
      !isRecommendationEligibleOnDate(recommendation, destinationDateKey, recommendations.todayKey)
    ) {
      setRedoMessage("That block must stay before its deadline or assessment date.");
      return false;
    }

    const overrides = preferences.recommendationOverrides || [];
    const existing = overrides.find((override) =>
      override.dateKey === sourceDateKey && override.slotIndex === sourceSlotIndex
    );
    const originDateKey = recommendation.manualOriginDateKey || existing?.originDateKey || sourceDateKey;
    const originSlotIndex = recommendation.manualOriginSlotIndex ?? existing?.originSlotIndex ?? sourceSlotIndex;
    const manuallyAdded = Boolean(existing?.added || recommendation.manualAdded);
    const destinationSlotIndex = destinationDateKey === originDateKey
      ? originSlotIndex
      : getNextManualSlot(destinationDay);
    if (destinationSlotIndex === null) {
      setRedoMessage("That day already has the maximum number of manual study blocks.");
      return false;
    }

    let nextOverrides = overrides.filter((override) =>
      !(override.dateKey === sourceDateKey && override.slotIndex === sourceSlotIndex)
    );
    nextOverrides = nextOverrides.filter((override) =>
      !(override.dateKey === originDateKey && override.slotIndex === originSlotIndex)
    );

    if (destinationDateKey !== originDateKey) {
      const removalOverride = createRecommendationOverride({
        dateKey: originDateKey,
        slotIndex: originSlotIndex,
        recommendation,
        locked: Boolean(existing?.locked || recommendation.locked),
        manual: true,
        removed: true,
        added: manuallyAdded,
        originDateKey,
        originSlotIndex,
        durationMinutes: existing?.durationMinutes || recommendation.durationMinutes,
      });
      if (!removalOverride) return false;
      nextOverrides = upsertOverride(nextOverrides, removalOverride);
    }

    const destinationOverride = createRecommendationOverride({
      dateKey: destinationDateKey,
      slotIndex: destinationSlotIndex,
      recommendation,
      locked: Boolean(existing?.locked || recommendation.locked),
      manual: true,
      added: manuallyAdded,
      originDateKey,
      originSlotIndex,
      durationMinutes: existing?.durationMinutes || recommendation.durationMinutes,
    });
    if (!destinationOverride) return false;
    const saved = await persistRecommendationOverrides(upsertOverride(nextOverrides, destinationOverride));
    if (saved) {
      setRedoMessage(`Moved to ${destinationDay.date.toLocaleDateString(undefined, { weekday: "long" })}.`);
      setSelectedSlot(null);
    }
    return saved;
  }

  async function handleDurationChange(durationMinutes) {
    if (!selectedDay || !selectedSlot || !selectedRecommendation) return false;
    const overrides = preferences.recommendationOverrides || [];
    const existing = overrides.find((override) =>
      override.dateKey === selectedDay.dateKey && override.slotIndex === selectedSlot.slotIndex
    );
    const nextOverride = createRecommendationOverride({
      dateKey: selectedDay.dateKey,
      slotIndex: selectedSlot.slotIndex,
      recommendation: selectedRecommendation,
      locked: Boolean(existing?.locked || selectedRecommendation.locked),
      manual: true,
      originDateKey: existing?.originDateKey || selectedRecommendation.manualOriginDateKey,
      originSlotIndex: existing?.originSlotIndex ?? selectedRecommendation.manualOriginSlotIndex,
      durationMinutes,
      added: Boolean(existing?.added || selectedRecommendation.manualAdded),
    });
    if (!nextOverride) return false;
    const saved = await persistRecommendationOverrides(upsertOverride(overrides, nextOverride));
    if (saved) setRedoMessage("Block duration updated.");
    return saved;
  }

  async function handleRemoveRecommendation() {
    if (!selectedDay || !selectedSlot || !selectedRecommendation) return false;
    const overrides = preferences.recommendationOverrides || [];
    const existing = overrides.find((override) =>
      override.dateKey === selectedDay.dateKey && override.slotIndex === selectedSlot.slotIndex
    );
    const originDateKey = selectedRecommendation.manualOriginDateKey || existing?.originDateKey || selectedDay.dateKey;
    const originSlotIndex = selectedRecommendation.manualOriginSlotIndex ?? existing?.originSlotIndex ?? selectedSlot.slotIndex;
    const manuallyAdded = Boolean(existing?.added || selectedRecommendation.manualAdded);
    let nextOverrides = overrides.filter((override) => {
      const isCurrent = override.dateKey === selectedDay.dateKey && override.slotIndex === selectedSlot.slotIndex;
      const isMovePair = override.originDateKey === originDateKey && override.originSlotIndex === originSlotIndex;
      return !isCurrent && !isMovePair;
    });

    if (!manuallyAdded) {
      const removalOverride = createRecommendationOverride({
        dateKey: originDateKey,
        slotIndex: originSlotIndex,
        recommendation: selectedRecommendation,
        manual: true,
        removed: true,
        durationMinutes: existing?.durationMinutes || selectedRecommendation.durationMinutes,
      });
      if (!removalOverride) return false;
      nextOverrides = upsertOverride(nextOverrides, removalOverride);
    }

    const saved = await persistRecommendationOverrides(nextOverrides);
    if (saved) {
      setRedoMessage("Study block removed.");
      setSelectedSlot(null);
    }
    return saved;
  }

  function handleRecommendationDragStart(event, dateKey, slotIndex) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${dateKey}:${slotIndex}`);
    setDraggedSlot({ dateKey, slotIndex });
  }

  function handleRecommendationDragEnd() {
    setDraggedSlot(null);
  }

  async function handleRecommendationDrop(destinationDateKey) {
    if (!draggedSlot) return;
    const source = draggedSlot;
    setDraggedSlot(null);
    await handleMoveRecommendation(source.dateKey, source.slotIndex, destinationDateKey);
  }

  async function handleRedoPlan() {
    const nextOverrides = clearUnlockedFutureRecommendationOverrides(
      preferences.recommendationOverrides,
      recommendations.todayKey
    );
    const saved = await persistRecommendationOverrides(nextOverrides);
    if (!saved) return;
    setRedoRevision((current) => current + 1);
    setRedoMessage("Plan updated");
  }

  function toggleOptionalDay(dateKey) {
    setExpandedOptionalDays((current) => {
      const next = new Set(current);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  }

  function openRecommendationDetails(dateKey, slotIndex) {
    setSelectedSlot({ dateKey, slotIndex });
  }

  function handleViewTabKeyDown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tablist = event.currentTarget.closest('[role="tablist"]');
    const nextView = event.key === "ArrowLeft" || event.key === "Home" ? "today" : "next7";
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
              data-view="next7"
              className={view === "next7" ? "is-active" : ""}
              aria-selected={view === "next7"}
              tabIndex={view === "next7" ? 0 : -1}
              onKeyDown={handleViewTabKeyDown}
              onClick={() => setView("next7")}
            >
              Next 7 Days
            </button>
          </div>
          <div className="study-plan-toolbar-actions">
            <button type="button" className="secondary-button" onClick={() => setPreferencesOpen(true)}>
              Edit preferences
            </button>
            <button type="button" className="secondary-button" disabled={overrideSaving} onClick={handleRedoPlan}>
              {overrideSaving ? "Updating…" : "Redo plan"}
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
            optionalOpen={expandedOptionalDays.has(recommendations.today?.dateKey)}
            onToggleOptional={() => toggleOptionalDay(recommendations.today?.dateKey)}
            emptyTitle="No recommendations today"
            emptyMessage={subjects.length === 0
              ? "Add a Subject or task to start building study recommendations."
              : "You have no active deadline work to focus on today."}
          />
        </section>
      ) : (
        <NextSevenDays
          recommendations={recommendations}
          subjectColours={subjectColours}
          expandedOptionalDays={expandedOptionalDays}
          onToggleOptional={toggleOptionalDay}
          onOpenRecommendation={openRecommendationDetails}
          onOpenTask={openTaskDetails}
          draggedSlot={draggedSlot}
          onDragStart={handleRecommendationDragStart}
          onDragEnd={handleRecommendationDragEnd}
          onDropRecommendation={handleRecommendationDrop}
          isValidMoveDate={(dateKey) => {
            if (!draggedSlot || dateKey === draggedSlot.dateKey) return false;
            const sourceDay = recommendations.days.find((day) => day.dateKey === draggedSlot.dateKey);
            const recommendation = getRecommendationForSlot(sourceDay, draggedSlot.slotIndex);
            return Boolean(recommendation) && isRecommendationEligibleOnDate(
              recommendation,
              dateKey,
              recommendations.todayKey
            );
          }}
        />
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
          duration={getRecommendationDurationMinutes(selectedRecommendation, selectedDay.blockDurationMinutes)}
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
          onMove={(destinationDateKey) => handleMoveRecommendation(
            selectedDay.dateKey,
            selectedSlot.slotIndex,
            destinationDateKey
          )}
          onDurationChange={handleDurationChange}
          onRemove={handleRemoveRecommendation}
          validMoveDates={selectedMoveDates}
          subjectColours={subjectColours}
        />
      )}
    </div>
  );
}

export default PlanPage;
