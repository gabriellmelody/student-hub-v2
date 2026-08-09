export const MOBILE_SWIPE_PAGES = ["tasks", "plan", "home", "calendar"];
export const MOBILE_SWIPE_THRESHOLD_PX = 56;
export const MOBILE_SWIPE_EDGE_GUARD_PX = 18;

export function getMobilePageIndex(page) {
  return MOBILE_SWIPE_PAGES.indexOf(page);
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
        ".task-card-actions",
        ".subject-reorder-handle",
        "[draggable='true']",
        "[data-page-swipe-ignore]",
      ].join(",")
    )
  );
}
