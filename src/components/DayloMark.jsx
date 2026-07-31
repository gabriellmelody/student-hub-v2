function DayloMark({ appearance = "brand", className = "" }) {
  const safeAppearance = appearance === "single" ? "single" : "brand";
  const classes = `daylo-mark daylo-mark--${safeAppearance} ${className}`.trim();

  if (safeAppearance === "single") {
    return <span className={classes} aria-hidden="true" />;
  }

  return (
    <img
      className={classes}
      src="/brand/daylo-icon.svg"
      alt=""
      aria-hidden="true"
    />
  );
}

export default DayloMark;
