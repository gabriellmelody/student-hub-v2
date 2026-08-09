export const MOBILE_SWIPE_PAGES = ["tasks", "plan", "home", "calendar"];
export const MOBILE_SWIPE_THRESHOLD_PX = 56;
export const MOBILE_SWIPE_INTENT_PX = 10;
export const MOBILE_SWIPE_COMMIT_RATIO = 0.28;
export const MOBILE_SWIPE_VELOCITY_PX_MS = 0.55;
export const MOBILE_SWIPE_EDGE_GUARD_PX = 18;

export function getMobilePageIndex(page) {
  return MOBILE_SWIPE_PAGES.indexOf(page);
}


export function getAdjacentMobilePage(currentPage, direction) {
  const currentIndex = getMobilePageIndex(currentPage);
  if (currentIndex === -1) return null;

  const nextIndex = direction === "forward" ? currentIndex + 1 : currentIndex - 1;
  return MOBILE_SWIPE_PAGES[nextIndex] || null;
}

export function getSwipeIntent({
  deltaX,
  deltaY,
  intentThreshold = MOBILE_SWIPE_INTENT_PX,
} = {}) {
  const absX = Math.abs(deltaX || 0);
  const absY = Math.abs(deltaY || 0);

  if (absX < intentThreshold && absY < intentThreshold) return "pending";
  if (absX > intentThreshold && absX > absY * 1.25) return "horizontal";
  if (absY > intentThreshold && absY >= absX) return "vertical";
  return "pending";
}

export function getPagerDragState({ currentPage, deltaX = 0, viewportWidth = 0 } = {}) {
  const direction = deltaX < 0 ? "forward" : "back";
  const adjacentPage = getAdjacentMobilePage(currentPage, direction);
  const width = Math.max(1, viewportWidth || 1);

  if (!adjacentPage) {
    const resistedOffset = Math.sign(deltaX) * Math.min(Math.abs(deltaX) * 0.22, 28);
    return {
      adjacentPage: null,
      direction: "none",
      offset: resistedOffset,
      progress: 0,
      boundary: true,
    };
  }

  const clampedOffset = Math.sign(deltaX) * Math.min(Math.abs(deltaX), width);

  return {
    adjacentPage,
    direction,
    offset: clampedOffset,
    progress: Math.min(Math.abs(clampedOffset) / width, 1),
    boundary: false,
  };
}

export function shouldCommitPagerNavigation({
  offset = 0,
  viewportWidth = 0,
  velocityX = 0,
  commitRatio = MOBILE_SWIPE_COMMIT_RATIO,
  velocityThreshold = MOBILE_SWIPE_VELOCITY_PX_MS,
} = {}) {
  const width = Math.max(1, viewportWidth || 1);
  const distanceCommit = Math.abs(offset) >= width * commitRatio;
  const velocityCommit =
    Math.abs(velocityX) >= velocityThreshold && Math.sign(velocityX) === Math.sign(offset);

  return distanceCommit || velocityCommit;
}

export function getPagerSettleDuration({
  currentOffset = 0,
  targetOffset = 0,
  viewportWidth = 0,
  reducedMotion = false,
} = {}) {
  if (reducedMotion) return 1;

  const width = Math.max(1, viewportWidth || 1);
  const remainingRatio = Math.min(Math.abs(targetOffset - currentOffset) / width, 1);
  return Math.round(150 + remainingRatio * 110);
}

export function getPagerPanelTransforms({
  direction = "none",
  offset = 0,
  viewportWidth = 0,
} = {}) {
  const width = Math.max(1, viewportWidth || 1);
  const adjacentBase =
    direction === "forward" ? width : direction === "back" ? -width : null;

  return {
    currentX: offset,
    adjacentX: adjacentBase === null ? null : adjacentBase + offset,
  };
}

export function getPagerSettleTargets({
  direction = "none",
  commit = false,
  viewportWidth = 0,
} = {}) {
  const width = Math.max(1, viewportWidth || 1);

  if (direction === "forward") {
    return {
      currentX: commit ? -width : 0,
      adjacentX: commit ? 0 : width,
    };
  }

  if (direction === "back") {
    return {
      currentX: commit ? width : 0,
      adjacentX: commit ? 0 : -width,
    };
  }

  return {
    currentX: 0,
    adjacentX: null,
  };
}

export function getPagerCleanupPage({ from, to, commit = false } = {}) {
  return commit && to ? to : from;
}

export function getNavigationDirection(fromPage, toPage) {
  const fromIndex = getMobilePageIndex(fromPage);
  const toIndex = getMobilePageIndex(toPage);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return "none";
  return toIndex > fromIndex ? "forward" : "back";
}

export function resolveSwipeNavigation(currentPage, deltaX) {
  const currentIndex = getMobilePageIndex(currentPage);

  if (currentIndex === -1) return null;

  const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
  return MOBILE_SWIPE_PAGES[nextIndex] || null;
}

export function evaluateMobileSwipe({
  currentPage,
  startX,
  startY,
  endX,
  endY,
  viewportWidth = 0,
  threshold = MOBILE_SWIPE_THRESHOLD_PX,
  edgeGuard = MOBILE_SWIPE_EDGE_GUARD_PX,
} = {}) {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (startX <= edgeGuard || (viewportWidth && startX >= viewportWidth - edgeGuard)) {
    return { page: null, direction: "none", reason: "edge" };
  }

  if (absX < threshold) return { page: null, direction: "none", reason: "threshold" };
  if (absX < absY * 1.35) return { page: null, direction: "none", reason: "vertical" };

  const page = resolveSwipeNavigation(currentPage, deltaX);
  if (!page) return { page: null, direction: "none", reason: "boundary" };

  return {
    page,
    direction: getNavigationDirection(currentPage, page),
    reason: "swipe",
  };
}

export function shouldIgnorePageSwipeTarget(target) {
  if (!target?.closest) return false;

  return Boolean(
    target.closest(
      [
        "input",
        "textarea",
        "select",
        "button",
        "a",
        "[role='button']",
        "[role='dialog']",
        "[aria-modal='true']",
        ".mobile-more-layer",
        ".mobile-more-sheet",
        ".quick-add-form",
        ".task-modal",
        ".task-card-actions",
        ".home-week-strip",
        ".calendar-week-scroll",
        ".calendar-week-grid",
        ".subject-reorder-handle",
        "[draggable='true']",
        "[data-page-swipe-ignore]",
      ].join(",")
    )
  );
}
