import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  blockGuidedTourBackground,
  computeTourCardPosition,
  findTourTarget,
  getFocusableTourElements,
  getSpotlightRect,
  getTourFocusTrapTarget,
  getTourNavigationRequest,
  getTourScrollBehavior,
  getTourTargetPaddingBlockers,
  getTourViewportMetrics,
  isTourTooltipReady,
  isTourExitKey,
  targetNeedsTourScroll,
  tourGeometryMatches,
  waitForTourTarget,
} from "../utils/guidedTourUtils.js";

const MOBILE_BREAKPOINT = 700;
const TARGET_WAIT_TIMEOUT_MS = 2400;

function getTargetBorderRadius(target, padding) {
  const computedRadius = Number.parseFloat(
    window.getComputedStyle(target).borderTopLeftRadius
  );

  return Number.isFinite(computedRadius)
    ? Math.max(8, computedRadius + padding)
    : 14;
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    function updatePreference(event) {
      setReducedMotion(event.matches);
    }

    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  return reducedMotion;
}

function waitForTargetToSettle(target, { signal, reducedMotion }) {
  return new Promise((resolve) => {
    let frameId = null;
    let previousRect = null;
    let stableFrames = 0;
    const startedAt = performance.now();

    function finish() {
      if (frameId !== null) cancelAnimationFrame(frameId);
      signal?.removeEventListener("abort", finish);
      resolve();
    }

    function checkPosition() {
      if (signal?.aborted || !target.isConnected) {
        finish();
        return;
      }

      const currentRect = target.getBoundingClientRect();
      const isStable =
        previousRect &&
        Math.abs(currentRect.top - previousRect.top) < 0.5 &&
        Math.abs(currentRect.left - previousRect.left) < 0.5;

      stableFrames = isStable ? stableFrames + 1 : 0;
      previousRect = currentRect;

      if (reducedMotion || stableFrames >= 3 || performance.now() - startedAt > 850) {
        finish();
        return;
      }

      frameId = requestAnimationFrame(checkPosition);
    }

    signal?.addEventListener("abort", finish, { once: true });
    frameId = requestAnimationFrame(checkPosition);
  });
}

function getSafeAreaInsets(probe) {
  if (!probe) return { top: 0, right: 0, bottom: 0, left: 0 };

  const styles = window.getComputedStyle(probe);
  return {
    top: Number.parseFloat(styles.paddingTop) || 0,
    right: Number.parseFloat(styles.paddingRight) || 0,
    bottom: Number.parseFloat(styles.paddingBottom) || 0,
    left: Number.parseFloat(styles.paddingLeft) || 0,
  };
}

function getViewportMetrics(safeAreaProbe) {
  const safeArea = getSafeAreaInsets(safeAreaProbe);
  return getTourViewportMetrics(window, safeArea, MOBILE_BREAKPOINT);
}

function getCenteredCardPosition(viewport = getViewportMetrics()) {
  const safeArea = viewport.safeArea || {};
  const leftEdge = viewport.left + Math.max(12, safeArea.left || 0);
  const rightEdge =
    viewport.left + viewport.width - Math.max(12, safeArea.right || 0);
  const cardWidth = Math.min(360, Math.max(0, rightEdge - leftEdge));
  return {
    left: Math.max(leftEdge, viewport.left + (viewport.width - cardWidth) / 2),
    top: Math.max(
      viewport.top + Math.max(12, safeArea.top || 0),
      viewport.top + viewport.height / 2 - 150
    ),
    placement: "center",
  };
}

function positionsMatch(first, second) {
  return (
    first?.placement === second?.placement &&
    Math.abs((first?.left || 0) - (second?.left || 0)) <= 0.5 &&
    Math.abs((first?.top || 0) - (second?.top || 0)) <= 0.5 &&
    Math.abs((first?.arrowOffset || 0) - (second?.arrowOffset || 0)) <= 0.5
  );
}

function getInteractiveTargetElements(target) {
  if (!target) return [];

  const elements = getFocusableTourElements(target);
  const targetIsFocusable = target.matches?.(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  return targetIsFocusable ? [target, ...elements] : elements;
}

export default function GuidedTour({
  activePage,
  activeSettingsView,
  activeStepIndex,
  activeTour,
  blocked = false,
  finishTour,
  isTourActive,
  nextStep,
  onNavigate,
  previousStep,
  skipTour,
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [renderState, setRenderState] = useState({
    status: "locating",
    spotlightRect: null,
    targetRect: null,
    spotlightRadius: 14,
  });
  const [cardPosition, setCardPosition] = useState(null);
  const [showLoading, setShowLoading] = useState(false);
  const [navigationAnnouncement, setNavigationAnnouncement] = useState("");
  const targetRef = useRef(null);
  const cardRef = useRef(null);
  const primaryActionRef = useRef(null);
  const safeAreaProbeRef = useRef(null);
  const preparedStepRef = useRef(null);
  const geometryFrameRef = useRef(null);
  const geometryStepRef = useRef(null);
  const activeStep = activeTour?.steps?.[activeStepIndex] || null;
  const stepKey = activeStep
    ? `${activeTour.id}:${activeStep.id}:${activeStepIndex}`
    : "inactive";

  const updateGeometry = useCallback(() => {
    if (geometryStepRef.current !== stepKey) return;
    const target = targetRef.current;

    if (!target?.isConnected) {
      setRenderState({ status: "missing", spotlightRect: null });
      setCardPosition(getCenteredCardPosition(getViewportMetrics(safeAreaProbeRef.current)));
      return;
    }

    const viewport = getViewportMetrics(safeAreaProbeRef.current);
    const spotlightPadding = activeStep?.spotlightPadding ?? 8;
    const targetRect = target.getBoundingClientRect();
    const spotlightRect = getSpotlightRect(
      targetRect,
      spotlightPadding,
      viewport
    );
    const spotlightRadius = getTargetBorderRadius(target, spotlightPadding);

    const card = cardRef.current;

    if (!card) {
      setRenderState({
        status: "measuring",
        spotlightRect,
        targetRect,
        spotlightRadius,
      });
      return;
    }

    const cardRect = card.getBoundingClientRect();
    const preferredPlacement =
      viewport.mobile && activeStep?.mobilePlacement
        ? activeStep.mobilePlacement
        : activeStep?.placement || "auto";

    const nextPosition = computeTourCardPosition({
      targetRect: spotlightRect,
      cardSize: {
        width: cardRect.width,
        height: cardRect.height,
      },
      preferredPlacement,
      viewport,
      bottomInset: viewport.cardBottomInset,
    });

    setCardPosition((current) =>
      positionsMatch(current, nextPosition) ? current : nextPosition
    );
    setRenderState((current) =>
      current.status === "ready" &&
      tourGeometryMatches(current.spotlightRect, spotlightRect) &&
      tourGeometryMatches(current.targetRect, targetRect) &&
      Math.abs((current.spotlightRadius || 0) - spotlightRadius) <= 0.5
        ? current
        : {
            status: "ready",
            spotlightRect,
            targetRect,
            spotlightRadius,
          }
    );
  }, [activeStep, stepKey]);

  const scheduleGeometry = useCallback(() => {
    if (geometryFrameRef.current !== null) return;
    geometryFrameRef.current = requestAnimationFrame(() => {
      geometryFrameRef.current = null;
      updateGeometry();
    });
  }, [updateGeometry]);

  useEffect(() => {
    if (!isTourActive) preparedStepRef.current = null;
  }, [isTourActive]);

  useEffect(() => {
    if (!isTourActive || !blocked) return undefined;

    const frame = requestAnimationFrame(skipTour);
    return () => cancelAnimationFrame(frame);
  }, [blocked, isTourActive, skipTour]);

  useEffect(() => {
    if (!isTourActive || blocked || renderState.status !== "locating") return undefined;

    const timer = window.setTimeout(() => setShowLoading(true), 360);
    return () => window.clearTimeout(timer);
  }, [blocked, isTourActive, renderState.status, stepKey]);

  useEffect(() => {
    if (!isTourActive || !activeStep || blocked) return undefined;

    const controller = new AbortController();
    let targetObserver = null;

    async function prepareStep() {
      geometryStepRef.current = stepKey;
      if (geometryFrameRef.current !== null) {
        cancelAnimationFrame(geometryFrameRef.current);
        geometryFrameRef.current = null;
      }
      setShowLoading(false);
      setRenderState({ status: "locating", spotlightRect: null });
      setCardPosition(null);
      setNavigationAnnouncement("");
      targetRef.current = null;

      if (preparedStepRef.current !== stepKey) {
        preparedStepRef.current = stepKey;

        try {
          await activeStep.beforeShow?.({
            activePage,
            navigate: onNavigate,
            signal: controller.signal,
          });
        } catch {
          if (!controller.signal.aborted) {
            setRenderState({ status: "missing", spotlightRect: null });
          }
          return;
        }
      }

      if (controller.signal.aborted) return;

      const nextPage = getTourNavigationRequest(
        activePage,
        activeStep,
        activeSettingsView
      );

      if (nextPage) {
        setNavigationAnnouncement(`Opening ${activeStep.pageLabel || nextPage}.`);
        onNavigate(nextPage, activeStep.settingsView);
      }

      const viewport = getViewportMetrics(safeAreaProbeRef.current);
      const target = await waitForTourTarget({
        step: activeStep,
        isMobile: viewport.mobile,
        signal: controller.signal,
        timeoutMs: TARGET_WAIT_TIMEOUT_MS,
      });

      if (controller.signal.aborted) return;

      if (!target) {
        setRenderState({ status: "missing", spotlightRect: null });
        setCardPosition(
          getCenteredCardPosition(getViewportMetrics(safeAreaProbeRef.current))
        );
        return;
      }

      targetRef.current = target;
      const targetRect = target.getBoundingClientRect();
      const spotlightPadding = activeStep?.spotlightPadding ?? 8;

      if (targetNeedsTourScroll(targetRect, viewport, spotlightPadding)) {
        target.scrollIntoView({
          behavior: getTourScrollBehavior(reducedMotion),
          block: "center",
          inline: "nearest",
        });
        await waitForTargetToSettle(target, {
          signal: controller.signal,
          reducedMotion,
        });
      }

      if (controller.signal.aborted || !target.isConnected) return;

      const viewportAfterScroll = getViewportMetrics(safeAreaProbeRef.current);
      const settledTargetRect = target.getBoundingClientRect();
      setRenderState({
        status: "measuring",
        spotlightRect: getSpotlightRect(
          settledTargetRect,
          spotlightPadding,
          viewportAfterScroll
        ),
        targetRect: settledTargetRect,
        spotlightRadius: getTargetBorderRadius(target, spotlightPadding),
      });
      targetObserver = new MutationObserver(() => {
        if (!target.isConnected || !findTourTarget(activeStep, {
          isMobile: getViewportMetrics(safeAreaProbeRef.current).mobile,
        })) {
          setRenderState({ status: "missing", spotlightRect: null });
          setCardPosition(
            getCenteredCardPosition(getViewportMetrics(safeAreaProbeRef.current))
          );
          return;
        }
        scheduleGeometry();
      });
      targetObserver.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class", "hidden", "style"],
      });
    }

    prepareStep();

    return () => {
      controller.abort();
      targetObserver?.disconnect();
      targetRef.current = null;
      if (geometryStepRef.current === stepKey) geometryStepRef.current = null;
      if (geometryFrameRef.current !== null) {
        cancelAnimationFrame(geometryFrameRef.current);
        geometryFrameRef.current = null;
      }
    };
  }, [
    activePage,
    activeSettingsView,
    activeStep,
    blocked,
    isTourActive,
    onNavigate,
    reducedMotion,
    stepKey,
    scheduleGeometry,
    updateGeometry,
  ]);

  useLayoutEffect(() => {
    if (!isTourActive || renderState.status !== "measuring") return;
    updateGeometry();
  }, [isTourActive, renderState.status, updateGeometry]);

  useLayoutEffect(() => {
    if (!isTourActive || renderState.status !== "ready") return undefined;

    const frame = requestAnimationFrame(scheduleGeometry);
    let cancelled = false;
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleGeometry);
    const visualViewport = window.visualViewport;
    const settleTimers = [80, 240, 600].map((delay) =>
      window.setTimeout(scheduleGeometry, delay)
    );

    let observedElement = targetRef.current;
    while (observedElement && observedElement !== document.body) {
      resizeObserver?.observe(observedElement);
      observedElement = observedElement.parentElement;
    }
    if (cardRef.current) resizeObserver?.observe(cardRef.current);

    window.addEventListener("resize", scheduleGeometry);
    window.addEventListener("orientationchange", scheduleGeometry);
    window.addEventListener("scroll", scheduleGeometry, true);
    visualViewport?.addEventListener("resize", scheduleGeometry);
    visualViewport?.addEventListener("scroll", scheduleGeometry);
    document.fonts?.addEventListener?.("loadingdone", scheduleGeometry);
    document.fonts?.ready?.then(() => {
      if (!cancelled) scheduleGeometry();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      settleTimers.forEach((timer) => window.clearTimeout(timer));
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleGeometry);
      window.removeEventListener("orientationchange", scheduleGeometry);
      window.removeEventListener("scroll", scheduleGeometry, true);
      visualViewport?.removeEventListener("resize", scheduleGeometry);
      visualViewport?.removeEventListener("scroll", scheduleGeometry);
      document.fonts?.removeEventListener?.("loadingdone", scheduleGeometry);
      if (geometryFrameRef.current !== null) {
        cancelAnimationFrame(geometryFrameRef.current);
        geometryFrameRef.current = null;
      }
    };
  }, [isTourActive, renderState.status, scheduleGeometry]);

  useEffect(() => {
    if (!isTourActive || blocked) return undefined;

    const appRoot = document.querySelector(".app-shell");
    if (!appRoot || activeStep?.allowTargetInteraction) return undefined;

    return blockGuidedTourBackground(appRoot);
  }, [activeStep?.allowTargetInteraction, blocked, isTourActive]);

  useEffect(() => {
    if (!isTourActive || blocked) return undefined;

    const canFocusStep = ["ready", "missing"].includes(renderState.status);
    const frame = canFocusStep
      ? requestAnimationFrame(() => primaryActionRef.current?.focus())
      : null;

    function handleKeyDown(event) {
      if (isTourExitKey(event)) {
        event.preventDefault();
        skipTour();
        return;
      }

      if (event.key !== "Tab" || !cardRef.current) return;

      const targetElements = activeStep?.allowTargetInteraction
        ? getInteractiveTargetElements(targetRef.current)
        : [];
      const focusableElements = [
        ...targetElements,
        ...getFocusableTourElements(cardRef.current),
      ];

      if (focusableElements.length === 0) {
        event.preventDefault();
        primaryActionRef.current?.focus();
        return;
      }

      const focusIsInsideTarget = targetRef.current?.contains(
        document.activeElement
      );
      const focusIsInsideSystem =
        cardRef.current.contains(document.activeElement) || focusIsInsideTarget;
      const focusTarget = getTourFocusTrapTarget({
        focusableElements,
        activeElement: document.activeElement,
        shiftKey: event.shiftKey,
        focusIsInside: focusIsInsideSystem,
      });

      if (focusTarget) {
        event.preventDefault();
        focusTarget.focus();
      }
    }

    function handleFocusIn(event) {
      if (
        !canFocusStep ||
        !cardRef.current ||
        cardRef.current.contains(event.target) ||
        (activeStep?.allowTargetInteraction &&
          targetRef.current?.contains(event.target))
      ) {
        return;
      }

      const focusableElements = getFocusableTourElements(cardRef.current);
      (focusableElements[0] || primaryActionRef.current)?.focus();
    }

    function handleBrowserBack() {
      skipTour();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    window.addEventListener("popstate", handleBrowserBack);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("popstate", handleBrowserBack);
    };
  }, [
    activeStep?.allowTargetInteraction,
    blocked,
    isTourActive,
    renderState.status,
    skipTour,
    stepKey,
  ]);

  if (
    !isTourActive ||
    !activeTour ||
    !activeStep ||
    blocked ||
    typeof document === "undefined"
  ) {
    return null;
  }

  const isFinalStep = activeStepIndex === activeTour.steps.length - 1;
  const spotlightRect = renderState.spotlightRect;
  const targetRect = renderState.targetRect;
  const ready = isTourTooltipReady(
    renderState.status,
    spotlightRect,
    cardPosition
  );
  const measuring = renderState.status === "measuring";
  const missing = renderState.status === "missing";
  const position =
    cardPosition ||
    getCenteredCardPosition(
      getTourViewportMetrics(window, {}, MOBILE_BREAKPOINT)
    );
  const cardPlacement = ready ? position.placement : "center";
  const showCard = ready || measuring || missing;
  const targetPaddingBlockers = activeStep.allowTargetInteraction
    ? getTourTargetPaddingBlockers(spotlightRect, targetRect)
    : [];

  return createPortal(
    <div
      className={`guided-tour-layer${
        activeStep.allowTargetInteraction ? " allows-target-interaction" : ""
      }${reducedMotion ? " is-reduced-motion" : ""}`}
      data-tour-state={renderState.status}
    >
      <span
        className="guided-tour-safe-area-probe"
        ref={safeAreaProbeRef}
        aria-hidden="true"
      />
      <span className="sr-only" role="status" aria-live="polite">
        {navigationAnnouncement}
      </span>
      {ready ? (
        <>
          <div
            className="guided-tour-dim guided-tour-dim-top"
            style={{ height: spotlightRect.top }}
          />
          <div
            className="guided-tour-dim guided-tour-dim-left"
            style={{
              top: spotlightRect.top,
              width: spotlightRect.left,
              height: spotlightRect.height,
            }}
          />
          <div
            className="guided-tour-dim guided-tour-dim-right"
            style={{
              top: spotlightRect.top,
              left: spotlightRect.right,
              height: spotlightRect.height,
            }}
          />
          <div
            className="guided-tour-dim guided-tour-dim-bottom"
            style={{ top: spotlightRect.bottom }}
          />
          <div
            className="guided-tour-spotlight"
            aria-hidden="true"
            style={{
              top: spotlightRect.top,
              left: spotlightRect.left,
              width: spotlightRect.width,
              height: spotlightRect.height,
              borderRadius: `${renderState.spotlightRadius || 14}px`,
            }}
          />
          {!activeStep.allowTargetInteraction ? (
            <div
              className="guided-tour-target-blocker"
              aria-hidden="true"
              style={{
                top: spotlightRect.top,
                left: spotlightRect.left,
                width: spotlightRect.width,
                height: spotlightRect.height,
              }}
            />
          ) : (
            targetPaddingBlockers.map((blocker, index) => (
              <div
                className="guided-tour-target-blocker"
                aria-hidden="true"
                key={`target-padding-${index}`}
                style={blocker}
              />
            ))
          )}
        </>
      ) : (
        <div className="guided-tour-full-backdrop" aria-hidden="true" />
      )}

      {showLoading && !showCard && (
        <div className="guided-tour-loading" role="status">
          Getting the next step ready…
        </div>
      )}

      {showCard && <section
        className={`guided-tour-card guided-tour-card-${cardPlacement}`}
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-hidden={measuring ? "true" : undefined}
        aria-labelledby="guided-tour-step-title"
        aria-describedby="guided-tour-step-progress guided-tour-step-description"
        style={{
          left: position.left,
          top: position.top,
          "--guided-tour-arrow-offset": `${position.arrowOffset || 28}px`,
        }}
      >
        {ready && <span className="guided-tour-arrow" aria-hidden="true" />}
        <div className="guided-tour-card-surface">
          <p
            className="guided-tour-progress"
            id="guided-tour-step-progress"
            aria-live="polite"
          >
            {activeStepIndex + 1} of {activeTour.steps.length}
          </p>
          <h2 id="guided-tour-step-title">
            {missing ? "This step isn’t available" : activeStep.title}
          </h2>
          <div className="guided-tour-card-body">
            <p id="guided-tour-step-description">
              {missing
                ? "The highlighted area could not be found. Continue or close the tour."
                : activeStep.description}
            </p>
          </div>

          <div className="guided-tour-actions">
            <button
              type="button"
              className="secondary-button guided-tour-back"
              disabled={activeStepIndex === 0}
              onClick={previousStep}
            >
              Back
            </button>
            <button
              type="button"
              className="guided-tour-skip"
              onClick={skipTour}
            >
              Skip tour
            </button>
            <button
              type="button"
              className="primary-button guided-tour-next"
              ref={primaryActionRef}
              onClick={isFinalStep ? finishTour : nextStep}
            >
              {isFinalStep ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </section>}
    </div>,
    document.body
  );
}
