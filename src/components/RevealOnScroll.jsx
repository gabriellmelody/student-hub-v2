import { createElement, useEffect, useRef, useState } from "react";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function getRevealDelay(index, delayStep, maxDelay) {
  return Math.min(Math.max(index, 0) * delayStep, maxDelay);
}

function RevealOnScroll({
  as = "div",
  children,
  className = "",
  index = 0,
  delayStep = 32,
  maxDelay = 160,
  initiallyVisible = false,
  disabled = false,
  rootMargin = "0px 0px -12% 0px",
  threshold = 0.08,
  style,
  ...props
}) {
  const nodeRef = useRef(null);
  const [visible, setVisible] = useState(
    initiallyVisible || disabled || prefersReducedMotion()
  );

  useEffect(() => {
    if (disabled) {
      setVisible(true);
      return undefined;
    }

    if (visible) return undefined;
    if (prefersReducedMotion()) {
      setVisible(true);
      return undefined;
    }
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }

    const node = nodeRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;

        setVisible(true);
        observer.disconnect();
      },
      { rootMargin, threshold }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [disabled, rootMargin, threshold, visible]);

  const revealClassName = [
    "scroll-reveal",
    visible ? "is-visible" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return createElement(
    as,
    {
      ...props,
      ref: nodeRef,
      className: revealClassName,
      style: {
        ...style,
        "--scroll-reveal-delay": `${getRevealDelay(
          index,
          delayStep,
          maxDelay
        )}ms`,
      },
      onFocusCapture: (event) => {
        setVisible(true);
        props.onFocusCapture?.(event);
      },
    },
    children
  );
}

export default RevealOnScroll;
