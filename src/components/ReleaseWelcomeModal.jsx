import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  blockGuidedTourBackground,
  getFocusableTourElements,
  getTourFocusTrapTarget,
  restoreTourFocus,
} from "../utils/guidedTourUtils.js";

export default function ReleaseWelcomeModal({ release, onDismiss }) {
  const dialogRef = useRef(null);
  const primaryActionRef = useRef(null);
  const returnFocusRef = useRef(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return undefined;

    returnFocusRef.current = document.activeElement;
    const restoreBackground = blockGuidedTourBackground(
      document.querySelector(".app-shell")
    );
    const focusFrame = requestAnimationFrame(() => {
      primaryActionRef.current?.focus();
    });

    function keepFocusInside(event) {
      if (dialog.contains(event.target)) return;
      primaryActionRef.current?.focus();
    }

    document.addEventListener("focusin", keepFocusInside);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("focusin", keepFocusInside);
      restoreBackground();
      requestAnimationFrame(() => restoreTourFocus(returnFocusRef.current));
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      const focusableElements = getFocusableTourElements(dialog);
      const target = getTourFocusTrapTarget({
        focusableElements,
        activeElement: document.activeElement,
        shiftKey: event.shiftKey,
        focusIsInside: dialog?.contains(document.activeElement),
      });

      if (!target) return;

      event.preventDefault();
      target.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  if (!release) return null;

  return createPortal(
    <div
      className="release-welcome-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <section
        ref={dialogRef}
        className="release-welcome-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-welcome-title"
        aria-describedby="release-welcome-intro"
        tabIndex={-1}
      >
        <div className="release-welcome-scroll">
          <div className="release-welcome-check" aria-hidden="true">
            <span>✓</span>
          </div>

          <div className="release-welcome-heading">
            <span className="eyebrow">DayLo update</span>
            <h2 id="release-welcome-title">
              Welcome to DayLo {release.version}
            </h2>
            <p id="release-welcome-intro">
              DayLo is ready to help you organise schoolwork, understand what is
              due, and build a realistic plan.
            </p>
          </div>

          <div className="release-welcome-notes" aria-label="Release updates">
            {release.sections.map((section) => (
              <section key={section.id} className="release-welcome-section">
                <h3>{section.title}</h3>
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>

        <div className="release-welcome-actions">
          <button
            ref={primaryActionRef}
            type="button"
            className="primary-button release-welcome-primary"
            onClick={onDismiss}
          >
            Start using DayLo
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
