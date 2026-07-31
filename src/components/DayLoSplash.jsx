import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import {
  dayloSplashSession,
  getDayloSplashSafetyDuration,
} from "../utils/dayloSplashSession.js";
import "../styles/daylo-splash.css";

function DayLoSplash({ onComplete }) {
  const completedRef = useRef(false);

  useLayoutEffect(() => {
    document.documentElement.classList.add("daylo-splash-active");
    document.body.classList.add("daylo-splash-active");

    return () => {
      document.documentElement.classList.remove("daylo-splash-active");
      document.body.classList.remove("daylo-splash-active");
    };
  }, []);

  const finishSplash = useCallback(() => {
    if (completedRef.current) return;

    completedRef.current = true;
    dayloSplashSession.complete();
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const safetyTimer = window.setTimeout(
      finishSplash,
      getDayloSplashSafetyDuration(reducedMotion)
    );

    return () => window.clearTimeout(safetyTimer);
  }, [finishSplash]);

  function handleAnimationEnd(event) {
    if (
      event.target === event.currentTarget &&
      event.animationName === "daylo-splash-lifecycle"
    ) {
      finishSplash();
    }
  }

  return (
    <div
      className="daylo-opening-splash"
      role="img"
      aria-label="DayLo"
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="daylo-opening-splash__lockup" aria-hidden="true">
        <svg
          className="daylo-opening-splash__mark"
          viewBox="0 0 64 64"
          focusable="false"
        >
          <defs>
            <linearGradient
              id="daylo-splash-peach"
              x1="11"
              y1="11"
              x2="51"
              y2="49"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FFA36B" />
              <stop offset=".56" stopColor="#FFC19A" />
              <stop offset="1" stopColor="#FFA36B" />
            </linearGradient>
            <linearGradient
              id="daylo-splash-blue"
              x1="10"
              y1="39"
              x2="53"
              y2="57"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#73A8DF" />
              <stop offset=".55" stopColor="#91B9E2" />
              <stop offset="1" stopColor="#73A8DF" />
            </linearGradient>
          </defs>
          <path
            className="daylo-opening-splash__arch"
            fill="url(#daylo-splash-peach)"
            d="M8 32A24 24 0 0 1 56 32H46A14 14 0 0 0 18 32Z"
          />
          <path
            className="daylo-opening-splash__sun"
            fill="url(#daylo-splash-peach)"
            d="M23 40a9 9 0 0 1 18 0c0 1.6-.6 3.1-1.7 4.2l-5.5 5.5a2.6 2.6 0 0 1-3.6 0l-5.5-5.5A5.9 5.9 0 0 1 23 40Z"
          />
          <path
            className="daylo-opening-splash__horizon"
            fill="url(#daylo-splash-blue)"
            d="M8 36.5c9 .4 17 4.6 24 12.5 7-7.9 15-12.1 24-12.5C54 49.5 44 58 32 58S10 49.5 8 36.5Z"
          />
        </svg>

        <img
          className="daylo-opening-splash__wordmark"
          src="/brand/daylo-wordmark.svg"
          alt=""
        />
      </div>
    </div>
  );
}

export default DayLoSplash;
