import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  blockGuidedTourBackground,
  getFocusableTourElements,
  getTourFocusTrapTarget,
  restoreTourFocus,
} from "../utils/guidedTourUtils.js";

export default function ClassroomSetupIntroModal({ onStart, onNotNow }) {
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
        onNotNow();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      const focusableElements = getFocusableTourElements(dialog);
      const focusTarget = getTourFocusTrapTarget({
        focusableElements,
        activeElement: document.activeElement,
        shiftKey: event.shiftKey,
        focusIsInside: dialog?.contains(document.activeElement),
      });

      if (!focusTarget) return;

      event.preventDefault();
      focusTarget.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onNotNow]);

  return createPortal(
    <div
      className="release-welcome-layer classroom-setup-intro-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onNotNow();
      }}
    >
      <section
        ref={dialogRef}
        className="release-welcome-dialog classroom-setup-intro-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="classroom-setup-intro-title"
        aria-describedby="classroom-setup-intro-description"
        tabIndex={-1}
      >
        <div className="classroom-setup-intro-copy">
          <span className="eyebrow">Google Classroom</span>
          <h2 id="classroom-setup-intro-title">Set up Google Classroom</h2>
          <p id="classroom-setup-intro-description">
            We’ll show you how to connect your account, choose classes, create
            Subjects and import assignments.
          </p>
        </div>
        <div className="release-welcome-actions classroom-setup-intro-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onNotNow}
          >
            Not now
          </button>
          <button
            ref={primaryActionRef}
            type="button"
            className="primary-button"
            onClick={onStart}
          >
            Start setup
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
