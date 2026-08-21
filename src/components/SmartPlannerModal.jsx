import { useEffect, useRef } from "react";
import {
  formatPlannerPreviewTime,
  SMART_PLANNER_CONTEXT_MAX_LENGTH,
  timeStringToMinute,
} from "../utils/smartPlannerUtils.js";

const PLAN_STYLE_OPTIONS = [
  ["balanced", "Balanced", "Realistic progress with breaks"],
  ["lighter", "Lighter", "Less work and more breathing room"],
  ["maximum", "Maximum progress", "Use the available window efficiently"],
];

function PreviewBlock({ block, index }) {
  const startMinute = Number.isInteger(block.startMinute) ? block.startMinute : null;
  const endMinute = Number.isInteger(block.endMinute) ? block.endMinute : null;
  const timeLabel =
    startMinute !== null && endMinute !== null
      ? `${formatPlannerPreviewTime(startMinute)}–${formatPlannerPreviewTime(endMinute)}`
      : `${block.start || ""}–${block.end || ""}`;

  return (
    <li className={`smart-planner-preview-block ${block.type === "break" ? "is-break" : ""}`}>
      <div className="smart-planner-preview-time">
        <span>{timeLabel}</span>
        {(block.startDayOffset > 0 || block.endDayOffset > 0) && (
          <small>Next day</small>
        )}
      </div>
      <div>
        <div className="smart-planner-preview-block-heading">
          <strong>{block.title || (block.type === "break" ? "Break" : "Study block")}</strong>
          {block.type === "study" && block.subject && <span>{block.subject}</span>}
          {block.type === "suggested_study" && <span>Suggested study</span>}
        </div>
        {block.tip &&
          (block.type !== "break" ? (
            <p>
              <span className="smart-planner-preview-detail-label">Goal</span>
              {block.tip}
            </p>
          ) : (
            <p>{block.tip}</p>
          ))}
        {block.reason && block.type !== "break" && (
          <small>
            <span className="smart-planner-preview-detail-label">
              Why this is in your plan
            </span>
            {block.reason}
          </small>
        )}
      </div>
      <span className="sr-only">Plan block {index + 1}</span>
    </li>
  );
}

export default function SmartPlannerModal({
  draft,
  setDraft,
  loading,
  error,
  preview,
  quota,
  needsReplace,
  hasLockedBlocks,
  calendarAvailable,
  onClose,
  onGenerate,
  onPlanWithoutAi,
  onEditSettings,
  onUsePlan,
  guidedTourActive = false,
}) {
  const headingRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    return () => returnFocusRef.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!guidedTourActive) headingRef.current?.focus();
  }, [guidedTourActive, preview]);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape" && !guidedTourActive) onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [guidedTourActive, onClose]);

  function updateDraft(field, value) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    if (!loading) onGenerate();
  }

  const quotaExhausted = quota?.remainingGenerations === 0;
  const quotaResetLabel = quota?.resetAt
    ? new Date(quota.resetAt).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";
  const quotaLabel = quotaExhausted
    ? `AI limit reached — Basic planner is still available${
        quotaResetLabel ? `. Resets ${quotaResetLabel}` : ""
      }`
    : Number.isInteger(quota?.remainingGenerations)
      ? `${quota.remainingGenerations} AI plan${quota.remainingGenerations === 1 ? "" : "s"} remaining`
      : "3 AI plans available every 24 hours";
  const startMinute = timeStringToMinute(draft.startTime);
  const finishMinute = timeStringToMinute(draft.endTime);
  const finishesNextDay =
    startMinute !== null &&
    finishMinute !== null &&
    finishMinute <= startMinute;

  return (
    <div className="smart-planner-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="smart-planner-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="smart-planner-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="smart-planner-header">
          <div>
            <p className="eyebrow">Today’s Plan</p>
            <h2 id="smart-planner-title" ref={headingRef} tabIndex="-1">
              Smart Planner
            </h2>
            <p>
              {preview
                ? "Review the plan before it changes Today’s Plan."
                : "Smart Planner uses AI to suggest today’s study plan."}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close Smart Planner">
            ×
          </button>
        </header>

        {!preview ? (
          <form className="smart-planner-setup" onSubmit={submit}>
            <div className="smart-planner-time-fields" data-tour="smart-planner-time">
              <label>
                <span>Start time</span>
                <input
                  type="time"
                  value={draft.startTime}
                  onChange={(event) => updateDraft("startTime", event.target.value)}
                  disabled={loading || draft.noTimeLeftToday}
                  required
                />
              </label>
              <label>
                <span className="smart-planner-time-label">
                  Finish time
                  {finishesNextDay && <small>Next day</small>}
                </span>
                <input
                  type="time"
                  value={draft.endTime}
                  onChange={(event) => updateDraft("endTime", event.target.value)}
                  disabled={loading || draft.noTimeLeftToday}
                  required
                />
              </label>
            </div>

            <fieldset
              className="smart-planner-style-fieldset"
              data-tour="smart-planner-style"
              disabled={loading}
            >
              <legend>Planning style</legend>
              <div className="smart-planner-style-options">
                {PLAN_STYLE_OPTIONS.map(([value, label, helper]) => (
                  <label key={value} className={draft.planStyle === value ? "is-selected" : ""}>
                    <input
                      type="radio"
                      name="smart-planner-style"
                      value={value}
                      checked={draft.planStyle === value}
                      onChange={() => updateDraft("planStyle", value)}
                    />
                    <span>
                      <strong>{label}</strong>
                      <small>{helper}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className={`smart-planner-calendar-option ${!calendarAvailable ? "is-unavailable" : ""}`}>
              <input
                type="checkbox"
                checked={draft.useCalendar && calendarAvailable}
                disabled={loading || !calendarAvailable}
                onChange={(event) => updateDraft("useCalendar", event.target.checked)}
              />
              <span>
                <strong>Work around Calendar events</strong>
                <small>
                  {calendarAvailable
                    ? "Uses calendars marked Block study time."
                    : "No Calendar busy-time data is available."}
                </small>
              </span>
            </label>

            <label className="smart-planner-context-field" data-tour="smart-planner-context">
              <span>Anything Smart Planner should know?</span>
              <small>Add progress, priorities or details that are not shown on your tasks.</small>
              <textarea
                rows="3"
                maxLength={SMART_PLANNER_CONTEXT_MAX_LENGTH}
                value={draft.plannerContext || ""}
                onChange={(event) => updateDraft("plannerContext", event.target.value)}
                placeholder="My EE is 1,000 of 4,000 words and needs steady progress. I also want to finish the overdue worksheet today."
                disabled={loading}
              />
              <span className="smart-planner-context-count" aria-live="polite">
                {(draft.plannerContext || "").length}/{SMART_PLANNER_CONTEXT_MAX_LENGTH}
              </span>
            </label>

            <p className="smart-planner-grade-note">
              Current and target Subject grades can help Smart Planner balance your priorities.
            </p>

            <p className="smart-planner-quota" data-tour="smart-planner-status" role="status">
              {quotaLabel}
            </p>

            {draft.noTimeLeftToday && (
              <p className="smart-planner-message" role="status">
                There isn’t enough time left to build today’s plan.
              </p>
            )}

            {loading && (
              <div className="smart-planner-loading" role="status" aria-live="polite">
                <span aria-hidden="true" />
                <div>
                  <strong>Building your plan…</strong>
                  <p>Choosing realistic blocks for today.</p>
                </div>
              </div>
            )}

            {error && (
              <p className="smart-planner-error" role="alert">
                {error}
              </p>
            )}

            <footer className="smart-planner-actions" data-tour="smart-planner-actions">
              <button type="button" className="secondary" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button
                type="button"
                className="secondary"
                onClick={onPlanWithoutAi}
                disabled={loading || draft.noTimeLeftToday}
              >
                Plan without AI
              </button>
              <button type="submit" className="primary-button" disabled={loading || draft.noTimeLeftToday}>
                {loading ? "Building your plan…" : "Generate plan"}
              </button>
            </footer>
          </form>
        ) : (
          <div className="smart-planner-preview">
            {preview.fallback && (
              <div className="smart-planner-fallback-notice" role="status">
                <strong>{preview.fallback.title}</strong>
                <p>{preview.fallback.message}</p>
              </div>
            )}
            <div className="smart-planner-preview-intro">
              <span className={`smart-planner-source-badge is-${preview.source}`}>
                {preview.source === "smart" ? "AI plan" : "Basic plan"}
              </span>
              <p>{preview.summary}</p>
            </div>

            <p className="smart-planner-quota" role="status">
              {quotaLabel}
            </p>

            {preview.blocks.length > 0 ? (
              <ol className="smart-planner-preview-blocks" aria-label="Proposed plan blocks">
                {preview.blocks.map((block, index) => (
                  <PreviewBlock block={block} index={index} key={`${block.type}-${block.taskId || "break"}-${index}`} />
                ))}
              </ol>
            ) : (
              <p className="smart-planner-message">
                {preview.status === "no_time"
                  ? "There isn’t enough time left to build today’s plan."
                  : "You do not need to use the whole study window tonight."}
              </p>
            )}

            {preview.omittedTasks.length > 0 && (
              <section className="smart-planner-omitted">
                <h3>Not scheduled today</h3>
                <ul>
                  {preview.omittedTasks.map((task) => (
                    <li key={task.taskId}>
                      <strong>{task.title}</strong>
                      <p>{task.reason}</p>
                      <small>{task.suggestedNextStep}</small>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {preview.warnings.length > 0 && (
              <section className="smart-planner-warnings" aria-label="Plan notes">
                <h3>Plan notes</h3>
                <ul>
                  {preview.warnings.map((warning, index) => (
                    <li key={`${warning}-${index}`}>{warning}</li>
                  ))}
                </ul>
              </section>
            )}

            {error && !preview.fallback && (
              <p className="smart-planner-error" role="alert">
                {error}
              </p>
            )}

            {(needsReplace || hasLockedBlocks) && (
              <div className="smart-planner-replace-notice" role="alert">
                <strong>{hasLockedBlocks ? "Unlock blocks first" : "Replace current plan?"}</strong>
                <p>
                  {hasLockedBlocks
                    ? "Locked blocks must be unlocked before Smart Planner can replace this plan."
                    : "Using this preview will replace the plan already in Today’s Plan."}
                </p>
              </div>
            )}

            <footer className="smart-planner-actions smart-planner-preview-actions">
              {preview.source === "smart" && (
                <button type="button" className="secondary" onClick={onPlanWithoutAi} disabled={loading}>
                  Plan without AI
                </button>
              )}
              <button type="button" className="secondary" onClick={onEditSettings} disabled={loading}>
                Edit settings
              </button>
              {!quotaExhausted && (
                <button type="button" className="secondary" onClick={onGenerate} disabled={loading}>
                  Try again
                </button>
              )}
              <button
                type="button"
                className="primary-button"
                onClick={preview.blocks.length === 0 ? onClose : onUsePlan}
                disabled={loading || hasLockedBlocks}
              >
                {preview.blocks.length === 0
                  ? "Done"
                  : needsReplace
                    ? "Replace current plan"
                    : "Use this plan"}
              </button>
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}
