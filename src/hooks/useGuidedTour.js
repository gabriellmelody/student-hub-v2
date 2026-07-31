import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  guidedTourReducer,
  initialGuidedTourState,
  isValidTourDefinition,
  claimGuidedTourExit,
  restoreTourFocus,
} from "../utils/guidedTourUtils.js";

export default function useGuidedTour({ onExit } = {}) {
  const [state, dispatch] = useReducer(
    guidedTourReducer,
    initialGuidedTourState
  );
  const stateRef = useRef(state);
  const starterRef = useRef(null);
  const onExitRef = useRef(onExit);
  const exitRecordedRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  const notifyExit = useCallback((tour, status) => {
    onExitRef.current?.({ tour, status });
  }, []);

  const startTour = useCallback((tourDefinition, starterElement) => {
    if (!isValidTourDefinition(tourDefinition)) return false;

    if (stateRef.current.isTourActive) {
      stateRef.current.activeTour.steps[
        stateRef.current.activeStepIndex
      ]?.afterLeave?.({ reason: "replaced" });
    } else {
      starterRef.current =
        starterElement ||
        (typeof document === "undefined" ? null : document.activeElement);
    }

    exitRecordedRef.current = false;
    dispatch({ type: "start", tour: tourDefinition });
    return true;
  }, []);

  const restoreStarterFocus = useCallback(() => {
    const starterElement = starterRef.current;

    starterRef.current = null;
    requestAnimationFrame(() => restoreTourFocus(starterElement));
  }, []);

  const recordExitOnce = useCallback((tour, status) => {
    if (!claimGuidedTourExit(exitRecordedRef)) return false;
    notifyExit(tour, status);
    return true;
  }, [notifyExit]);

  const nextStep = useCallback(() => {
    const currentState = stateRef.current;

    if (!currentState.isTourActive) return;

    const currentStep =
      currentState.activeTour.steps[currentState.activeStepIndex];
    currentStep?.afterLeave?.({ reason: "next" });

    if (
      currentState.activeStepIndex >=
      currentState.activeTour.steps.length - 1
    ) {
      dispatch({ type: "finish" });
      recordExitOnce(currentState.activeTour, "completed");
      restoreStarterFocus();
      return;
    }

    dispatch({ type: "next" });
  }, [recordExitOnce, restoreStarterFocus]);

  const previousStep = useCallback(() => {
    const currentState = stateRef.current;

    if (!currentState.isTourActive || currentState.activeStepIndex <= 0) return;

    currentState.activeTour.steps[
      currentState.activeStepIndex
    ]?.afterLeave?.({ reason: "previous" });
    dispatch({ type: "previous" });
  }, []);

  const skipTour = useCallback(() => {
    const currentState = stateRef.current;

    if (!currentState.isTourActive) return;

    currentState.activeTour.steps[
      currentState.activeStepIndex
    ]?.afterLeave?.({ reason: "skip" });
    dispatch({ type: "skip" });
    recordExitOnce(currentState.activeTour, "skipped");
    restoreStarterFocus();
  }, [recordExitOnce, restoreStarterFocus]);

  const finishTour = useCallback(() => {
    const currentState = stateRef.current;

    if (!currentState.isTourActive) return;

    currentState.activeTour.steps[
      currentState.activeStepIndex
    ]?.afterLeave?.({ reason: "finish" });
    dispatch({ type: "finish" });
    recordExitOnce(currentState.activeTour, "completed");
    restoreStarterFocus();
  }, [recordExitOnce, restoreStarterFocus]);

  return {
    ...state,
    startTour,
    nextStep,
    previousStep,
    skipTour,
    finishTour,
  };
}
