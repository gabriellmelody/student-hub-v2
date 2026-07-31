export const GUIDED_TOUR_QUERY_KEY = "tour";

export const initialGuidedTourState = {
  activeTour: null,
  activeStepIndex: -1,
  isTourActive: false,
  lastExitReason: null,
};

export function isValidTourDefinition(tourDefinition) {
  return Boolean(
    tourDefinition?.id &&
      Array.isArray(tourDefinition.steps) &&
      tourDefinition.steps.length > 0 &&
      tourDefinition.steps.every(
        (step) => step?.id && step?.target && step?.title && step?.description
      )
  );
}

export function guidedTourReducer(state, action) {
  switch (action.type) {
    case "start":
      if (!isValidTourDefinition(action.tour)) return state;

      return {
        activeTour: action.tour,
        activeStepIndex: 0,
        isTourActive: true,
        lastExitReason: null,
      };
    case "next":
      if (!state.isTourActive) return state;
      if (state.activeStepIndex >= state.activeTour.steps.length - 1) {
        return {
          ...initialGuidedTourState,
          lastExitReason: "finished",
        };
      }

      return {
        ...state,
        activeStepIndex: state.activeStepIndex + 1,
      };
    case "previous":
      if (!state.isTourActive || state.activeStepIndex <= 0) return state;

      return {
        ...state,
        activeStepIndex: state.activeStepIndex - 1,
      };
    case "finish":
      return state.isTourActive
        ? { ...initialGuidedTourState, lastExitReason: "finished" }
        : state;
    case "skip":
      return state.isTourActive
        ? { ...initialGuidedTourState, lastExitReason: "skipped" }
        : state;
    default:
      return state;
  }
}

export function getTourRequestFromSearch(search = "") {
  return new URLSearchParams(search).get(GUIDED_TOUR_QUERY_KEY);
}

export function removeTourRequestFromUrl(urlValue, baseUrl = "http://localhost") {
  const url = new URL(urlValue, baseUrl);

  url.searchParams.delete(GUIDED_TOUR_QUERY_KEY);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function resolveForcedTourRequest(search, getDefinition) {
  const id = getTourRequestFromSearch(search);

  return {
    id,
    requested: Boolean(id),
    tour: id && typeof getDefinition === "function" ? getDefinition(id) : null,
  };
}

export function claimGuidedTourStartup(handledRef) {
  if (!handledRef || handledRef.current) return false;
  handledRef.current = true;
  return true;
}

export function claimGuidedTourExit(handledRef) {
  if (!handledRef || handledRef.current) return false;
  handledRef.current = true;
  return true;
}

export function shouldCloseTourOpenedModal(openedByTour) {
  return openedByTour === true;
}

export function isTourTooltipReady(status, spotlightRect, cardPosition) {
  return status === "ready" && Boolean(spotlightRect) && Boolean(cardPosition);
}

export function getTourNavigationRequest(activePage, step, activeSettingsView) {
  const settingsViewChanged =
    step?.page === "settings" &&
    step?.settingsView &&
    step.settingsView !== activeSettingsView;

  return step?.page && (step.page !== activePage || settingsViewChanged)
    ? step.page
    : null;
}

export function getStepTargetSelectors(step, isMobile = false) {
  return [
    isMobile && step?.mobileTarget ? step.mobileTarget : step?.target,
    step?.fallbackTarget,
  ].filter(Boolean);
}

export function findTourTarget(step, options = {}) {
  const {
    documentRef = typeof document === "undefined" ? null : document,
    isMobile = false,
  } = options;
  const selectors = getStepTargetSelectors(step, isMobile);

  if (!documentRef || selectors.length === 0) return null;

  for (const selector of selectors) {
    try {
      const target = documentRef.querySelector(selector);
      const bounds = target?.getBoundingClientRect?.();

      if (!target || !bounds || bounds.width <= 0 || bounds.height <= 0) {
        continue;
      }

      return target;
    } catch {
      continue;
    }
  }

  return null;
}

export function waitForTourTarget({
  step,
  documentRef = typeof document === "undefined" ? null : document,
  isMobile = false,
  signal,
  timeoutMs = 2400,
  now = () => Date.now(),
  requestFrame = (callback) => requestAnimationFrame(callback),
  cancelFrame = (frameId) => cancelAnimationFrame(frameId),
  createObserver = (callback) =>
    typeof MutationObserver === "undefined" ? null : new MutationObserver(callback),
}) {
  return new Promise((resolve) => {
    const startedAt = now();
    let frameId = null;
    let observer = null;
    let settled = false;

    function cleanup() {
      settled = true;
      if (frameId !== null) cancelFrame(frameId);
      observer?.disconnect();
      signal?.removeEventListener("abort", handleAbort);
    }

    function finish(target) {
      if (settled) return;
      cleanup();
      resolve(target);
    }

    function handleAbort() {
      finish(null);
    }

    function checkForTarget() {
      if (settled || signal?.aborted) {
        finish(null);
        return;
      }

      const target = findTourTarget(step, { documentRef, isMobile });

      if (target) {
        finish(target);
        return;
      }

      if (now() - startedAt >= timeoutMs) {
        finish(null);
        return;
      }

      frameId = requestFrame(checkForTarget);
    }

    signal?.addEventListener("abort", handleAbort, { once: true });
    observer = createObserver(checkForTarget);
    observer?.observe(documentRef?.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "style"],
    });
    checkForTarget();
  });
}

export function getTourViewportMetrics(
  windowRef,
  safeArea = {},
  mobileBreakpoint = 700
) {
  const visualViewport = windowRef?.visualViewport;
  const width = visualViewport?.width || windowRef?.innerWidth || 0;
  const height = visualViewport?.height || windowRef?.innerHeight || 0;
  const mobile = width <= mobileBreakpoint;

  return {
    mobile,
    width,
    height,
    left: visualViewport?.offsetLeft || 0,
    top: visualViewport?.offsetTop || 0,
    safeArea,
    leftInset: safeArea.left || 0,
    rightInset: safeArea.right || 0,
    topInset: (mobile ? 64 : 16) + (safeArea.top || 0),
    bottomInset: (mobile ? 88 : 16) + (safeArea.bottom || 0),
    cardBottomInset: mobile ? 72 : 0,
  };
}

export function getSpotlightRect(targetRect, padding = 8, viewport = {}) {
  const width =
    viewport.width ?? (typeof window === "undefined" ? 0 : window.innerWidth);
  const height =
    viewport.height ?? (typeof window === "undefined" ? 0 : window.innerHeight);
  const viewportLeft = viewport.left || 0;
  const viewportTop = viewport.top || 0;
  const safePadding = Math.min(
    Math.max(0, Number(padding) || 0),
    Math.max(0, width / 2),
    Math.max(0, height / 2)
  );
  const minimumLeft = viewportLeft + (viewport.leftInset || 0);
  const minimumTop = viewportTop + (viewport.topInset || 0);
  const maximumRight =
    viewportLeft + width - (viewport.rightInset || 0);
  const maximumBottom =
    viewportTop + height - (viewport.bottomInset || 0);
  const left = Math.max(minimumLeft, targetRect.left - safePadding);
  const top = Math.max(minimumTop, targetRect.top - safePadding);
  const right = Math.max(left, Math.min(
    maximumRight,
    targetRect.right + safePadding
  ));
  const bottom = Math.max(top, Math.min(
    maximumBottom,
    targetRect.bottom + safePadding
  ));

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function getPlacementOrder(preferredPlacement) {
  const preferred = ["top", "bottom", "left", "right"].includes(
    preferredPlacement
  )
    ? preferredPlacement
    : "bottom";
  const opposite = {
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left",
  }[preferred];
  const remaining = ["bottom", "top", "right", "left"].filter(
    (placement) => placement !== preferred && placement !== opposite
  );

  return [preferred, opposite, ...remaining];
}

function getPlacementCoordinates(placement, targetRect, cardSize, gap) {
  if (placement === "top") {
    return {
      left: targetRect.left + (targetRect.width - cardSize.width) / 2,
      top: targetRect.top - cardSize.height - gap,
    };
  }

  if (placement === "left") {
    return {
      left: targetRect.left - cardSize.width - gap,
      top: targetRect.top + (targetRect.height - cardSize.height) / 2,
    };
  }

  if (placement === "right") {
    return {
      left: targetRect.right + gap,
      top: targetRect.top + (targetRect.height - cardSize.height) / 2,
    };
  }

  return {
    left: targetRect.left + (targetRect.width - cardSize.width) / 2,
    top: targetRect.bottom + gap,
  };
}

function getOverflowScore(position, cardSize, bounds) {
  return (
    Math.max(0, bounds.left - position.left) +
    Math.max(0, position.left + cardSize.width - bounds.right) +
    Math.max(0, bounds.top - position.top) +
    Math.max(0, position.top + cardSize.height - bounds.bottom)
  );
}

export function computeTourCardPosition({
  targetRect,
  cardSize,
  preferredPlacement = "auto",
  viewport,
  margin = 12,
  gap = 14,
  bottomInset = 0,
}) {
  const viewportLeft = viewport.left || 0;
  const viewportTop = viewport.top || 0;
  const safeArea = viewport.safeArea || {};
  const leftMargin = Math.max(margin, safeArea.left || 0);
  const rightMargin = Math.max(margin, safeArea.right || 0);
  const topMargin = Math.max(margin, safeArea.top || 0);
  const bottomMargin = Math.max(margin, safeArea.bottom || 0);
  const bounds = {
    left: viewportLeft + leftMargin,
    top: viewportTop + topMargin,
    right: Math.max(
      viewportLeft + leftMargin,
      viewportLeft + viewport.width - rightMargin
    ),
    bottom: Math.max(
      viewportTop + topMargin,
      viewportTop + viewport.height - bottomMargin - bottomInset
    ),
  };
  const placements =
    preferredPlacement === "auto"
      ? ["bottom", "top", "right", "left"]
      : getPlacementOrder(preferredPlacement);
  const candidates = placements.map((placement) => ({
    placement,
    ...getPlacementCoordinates(placement, targetRect, cardSize, gap),
  }));
  const fittingCandidate = candidates.find((candidate) => {
    if (candidate.placement === "top") return candidate.top >= bounds.top;
    if (candidate.placement === "bottom") {
      return candidate.top + cardSize.height <= bounds.bottom;
    }
    if (candidate.placement === "left") return candidate.left >= bounds.left;
    return candidate.left + cardSize.width <= bounds.right;
  });
  const bestCandidate =
    fittingCandidate ||
    candidates.reduce((best, candidate) =>
      getOverflowScore(candidate, cardSize, bounds) <
      getOverflowScore(best, cardSize, bounds)
        ? candidate
        : best
    );
  const maximumLeft = Math.max(bounds.left, bounds.right - cardSize.width);
  const maximumTop = Math.max(bounds.top, bounds.bottom - cardSize.height);

  const left = Math.min(Math.max(bestCandidate.left, bounds.left), maximumLeft);
  const top = Math.min(Math.max(bestCandidate.top, bounds.top), maximumTop);
  const arrowOffset = ["top", "bottom"].includes(bestCandidate.placement)
    ? Math.min(
        Math.max(targetRect.left + targetRect.width / 2 - left, 24),
        cardSize.width - 24
      )
    : Math.min(
        Math.max(targetRect.top + targetRect.height / 2 - top, 24),
        cardSize.height - 24
      );

  return {
    placement: bestCandidate.placement,
    left,
    top,
    arrowOffset,
  };
}

export function targetNeedsTourScroll(
  targetRect,
  {
    width,
    height,
    left = 0,
    top = 0,
    topInset = 16,
    rightInset = 0,
    bottomInset = 16,
    leftInset = 0,
  }
) {
  const visibleLeft = left + leftInset;
  const visibleTop = top + topInset;
  const visibleRight = left + width - rightInset;
  const visibleBottom = top + height - bottomInset;
  const visibleWidth = Math.max(
    0,
    Math.min(targetRect.right, visibleRight) -
      Math.max(targetRect.left, visibleLeft)
  );
  const visibleHeight = Math.max(
    0,
    Math.min(targetRect.bottom, visibleBottom) -
      Math.max(targetRect.top, visibleTop)
  );
  const usefulWidth = Math.max(0, visibleRight - visibleLeft);
  const usefulHeight = Math.max(0, visibleBottom - visibleTop);
  const requiredWidth = Math.min(
    targetRect.width,
    Math.max(32, usefulWidth * 0.35)
  );
  const requiredHeight = Math.min(
    targetRect.height,
    Math.max(32, usefulHeight * 0.35)
  );

  return visibleWidth < requiredWidth || visibleHeight < requiredHeight;
}

export function getTourScrollBehavior(reducedMotion) {
  return reducedMotion ? "auto" : "smooth";
}

export function getFocusableTourElements(container) {
  if (!container?.querySelectorAll) return [];

  return Array.from(
    container.querySelectorAll(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
}

export function restoreTourFocus(
  element,
  documentRef = typeof document === "undefined" ? null : document
) {
  const isDocumentRoot =
    element === documentRef?.body || element === documentRef?.documentElement;

  if (element?.focus && element.isConnected !== false && !isDocumentRoot) {
    element.focus();
    if (!documentRef?.activeElement || documentRef.activeElement === element) {
      return true;
    }
  }

  const fallback = [".page h1", ".page h2", "main h1", "main h2", "main"]
    .map((selector) => documentRef?.querySelector?.(selector))
    .find(Boolean);

  if (!fallback?.focus) return false;

  const hadTabIndex = fallback.hasAttribute?.("tabindex");
  if (!hadTabIndex) fallback.setAttribute?.("tabindex", "-1");
  fallback.focus();
  if (!hadTabIndex) {
    fallback.addEventListener?.(
      "blur",
      () => fallback.removeAttribute?.("tabindex"),
      { once: true }
    );
  }
  return true;
}

export function tourGeometryMatches(first, second, tolerance = 0.5) {
  if (!first || !second) return first === second;

  return ["left", "top", "right", "bottom", "width", "height"].every(
    (key) =>
      key in first && key in second
        ? Math.abs(first[key] - second[key]) <= tolerance
        : true
  );
}

export function isTourExitKey(event) {
  return event?.key === "Escape";
}
