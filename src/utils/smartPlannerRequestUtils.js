export const SMART_PLANNER_BROWSER_TIMEOUT_MS = 30000;

export function startRequestDeadline(
  controller,
  timeoutMs = SMART_PLANNER_BROWSER_TIMEOUT_MS,
  schedule = setTimeout,
  cancelScheduled = clearTimeout
) {
  let timedOut = false;
  const timer = schedule(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    cancel() {
      cancelScheduled(timer);
    },
    didTimeOut() {
      return timedOut;
    },
  };
}

export function getSmartPlannerFallback(status = "") {
  if (status === "timeout") {
    return {
      reason: "timeout",
      title: "Smart Planner timed out",
      message: "We made you a Basic plan instead.",
    };
  }
  return {
    reason: status || "unavailable",
    title: "Smart Planner was unavailable",
    message: "We made you a Basic plan instead.",
  };
}
