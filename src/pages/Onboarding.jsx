import { useEffect, useMemo, useRef, useState } from "react";
import {
  REAL_CLASSROOM_COURSE_LINKS_STORAGE_KEY,
  createSubjectDraft,
  subjectCourseSystems,
  getDefaultSubjectLevel,
  getSubjectLevelOptions,
} from "../utils/appUtils.js";
import {
  createRealClassroomCourseLink,
  findBestSubjectForClassroomCourse,
  getRealClassroomCourseId,
} from "../utils/classroomCourseUtils.js";
import {
  DEFAULT_ONBOARDING_PLANNING_PREFERENCES,
  REAL_CLASSROOM_COURSE_SELECTIONS_KEY,
  clearOnboardingDraft,
  advanceOnboardingStep,
  isPlanningFinishNextDay,
  loadOnboardingDraft,
  loadRealClassroomCourseLinks,
  loadRealClassroomCourseSelections,
  mergeIncludedClassroomSubjects,
  saveOnboardingDraft,
} from "../utils/onboardingUtils.js";
import { suggestSubjectDraftColour } from "../utils/subjectColourUtils.js";
import DayloMark from "../components/DayloMark.jsx";

const onboardingSteps = [
  "Welcome",
  "Schoolwork",
  "Calendar",
  "Planning",
  "Finish",
];

const planningStyles = [
  { value: "lighter", label: "Lighter" },
  { value: "balanced", label: "Balanced" },
  { value: "maximum", label: "Maximum progress" },
];

function getCallbackState() {
  if (typeof window === "undefined") return { classroom: "", calendar: "" };

  const params = new URLSearchParams(window.location.search);
  return {
    classroom: params.get("classroom") || "",
    calendar: params.get("googleCalendar") || "",
  };
}

function OnboardingFlow({
  studentProfile,
  setStudentProfile,
  subjects,
  setSubjects,
  theme,
  setTheme,
  themeColors,
  saveThemeColorPreferences,
  themeColorPalettes,
  logoAppearance,
  onComplete,
  planningPreferences: cloudPlanningPreferences,
  onUpdatePlanningPreferences,
  planningSyncError,
}) {
  const [callbackState] = useState(getCallbackState);
  const [initialDraft] = useState(loadOnboardingDraft);
  const [step, setStep] = useState(() =>
    callbackState.calendar
      ? 2
      : callbackState.classroom
        ? 1
        : initialDraft.step
  );
  const [setupRoute, setSetupRoute] = useState(() =>
    callbackState.classroom ? "classroom" : initialDraft.setupRoute
  );
  const [showCompletion, setShowCompletion] = useState(false);
  const [subjectDraft, setSubjectDraft] = useState(() =>
    createSubjectDraft(studentProfile.schoolSystem || "Other", subjects)
  );
  const [subjectColourManuallySelected, setSubjectColourManuallySelected] =
    useState(false);
  const [subjectError, setSubjectError] = useState("");
  const [courseSelections, setCourseSelections] = useState(
    loadRealClassroomCourseSelections
  );
  const [courseLinks, setCourseLinks] = useState(loadRealClassroomCourseLinks);
  const [classroomState, setClassroomState] = useState({
    checking: false,
    connected: callbackState.classroom === "connected",
    loading: false,
    courses: [],
    message:
      callbackState.classroom === "error"
        ? "Classroom could not connect. Try again or set up manually."
        : "",
    error: callbackState.classroom === "error",
  });
  const [calendarState, setCalendarState] = useState({
    checking: false,
    connected: callbackState.calendar === "connected",
    message:
      callbackState.calendar === "error"
        ? "Google Calendar could not connect. You can retry or do this later."
        : "",
    error: callbackState.calendar === "error",
  });
  const [planningPreferences, setPlanningPreferences] = useState(
    cloudPlanningPreferences || DEFAULT_ONBOARDING_PLANNING_PREFERENCES
  );
  const subjectNameInputRef = useRef(null);
  const classroomCheckStartedRef = useRef(false);
  const calendarCheckStartedRef = useRef(false);

  const includedCourses = useMemo(
    () =>
      classroomState.courses.filter(
        (course) =>
          courseSelections[getRealClassroomCourseId(course)] === "included"
      ),
    [classroomState.courses, courseSelections]
  );
  const linkedIncludedCount = includedCourses.filter(
    (course) => courseLinks[getRealClassroomCourseId(course)]?.subjectId
  ).length;
  const finishIsNextDay = isPlanningFinishNextDay(planningPreferences);

  useEffect(() => {
    if (cloudPlanningPreferences) setPlanningPreferences(cloudPlanningPreferences);
  }, [cloudPlanningPreferences]);

  useEffect(() => {
    saveOnboardingDraft({ step, setupRoute });
  }, [step, setupRoute]);

  useEffect(() => {
    if (!callbackState.classroom && !callbackState.calendar) return;

    const nextUrl = new URL(window.location.href);
    [
      "tab",
      "classroom",
      "classroomStatus",
      "googleCalendar",
      "googleCalendarStatus",
    ].forEach((key) => nextUrl.searchParams.delete(key));
    window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.hash}`);
  }, [callbackState]);

  useEffect(() => {
    if (step !== 1 || setupRoute !== "classroom") return;
    if (classroomCheckStartedRef.current) return;
    classroomCheckStartedRef.current = true;
    checkClassroomSession();
  }, [step, setupRoute]);

  useEffect(() => {
    if (step !== 2 || calendarCheckStartedRef.current) return;
    calendarCheckStartedRef.current = true;
    checkCalendarSession();
  }, [step]);

  function persistCourseSelections(nextSelections) {
    setCourseSelections(nextSelections);
    localStorage.setItem(
      REAL_CLASSROOM_COURSE_SELECTIONS_KEY,
      JSON.stringify(nextSelections)
    );
  }

  function persistCourseLinks(nextLinks) {
    setCourseLinks(nextLinks);
    localStorage.setItem(
      REAL_CLASSROOM_COURSE_LINKS_STORAGE_KEY,
      JSON.stringify(nextLinks)
    );
  }

  async function checkClassroomSession() {
    setClassroomState((current) => ({ ...current, checking: true }));

    try {
      const response = await fetch("/api/google-classroom/session", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const result = await response.json();
      const connected = response.ok && result.connected === true;

      setClassroomState((current) => ({
        ...current,
        checking: false,
        connected,
        message: connected ? "Classroom connected." : "No Classroom connection yet.",
        error: false,
      }));
      if (connected) await loadClassroomCourses();
    } catch {
      setClassroomState((current) => ({
        ...current,
        checking: false,
        connected: false,
        message: "Classroom is unavailable right now. Try again or set up manually.",
        error: true,
      }));
    }
  }

  async function loadClassroomCourses() {
    setClassroomState((current) => ({
      ...current,
      loading: true,
      error: false,
      message: "Loading classes...",
    }));

    try {
      const response = await fetch("/api/google-classroom/courses", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const result = await response.json();

      if (!response.ok || result.ok !== true) throw new Error("courses_unavailable");
      const courses = Array.isArray(result.courses) ? result.courses : [];

      setClassroomState((current) => ({
        ...current,
        connected: true,
        loading: false,
        courses,
        message:
          courses.length > 0
            ? `${courses.length} class${courses.length === 1 ? "" : "es"} found.`
            : "No active classes were found.",
        error: false,
      }));
    } catch {
      setClassroomState((current) => ({
        ...current,
        loading: false,
        message: "Classes could not be loaded. Try again or set up manually.",
        error: true,
      }));
    }
  }

  async function checkCalendarSession() {
    setCalendarState((current) => ({ ...current, checking: true }));

    try {
      const response = await fetch("/api/google-calendar/session", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const result = await response.json();
      const connected = response.ok && result.connected === true;

      setCalendarState({
        checking: false,
        connected,
        message: connected
          ? "Google Calendar connected."
          : "Connect now or add it later in Integrations.",
        error: false,
      });
    } catch {
      setCalendarState({
        checking: false,
        connected: false,
        message: "Calendar is unavailable right now. You can do this later.",
        error: true,
      });
    }
  }

  function beginGoogleConnection(provider) {
    saveOnboardingDraft({
      step: provider === "classroom" ? 1 : 2,
      setupRoute: provider === "classroom" ? "classroom" : setupRoute,
    });
    window.location.assign(`/api/google-${provider}/connect`);
  }

  function chooseSetupRoute(route) {
    setSetupRoute(route);
    setSubjectError("");
    if (route === "classroom") {
      classroomCheckStartedRef.current = false;
    }
  }

  function addOnboardingSubject(event) {
    event.preventDefault();
    const name = subjectDraft.name.trim();
    const duplicateSubject = subjects.some(
      (subject) =>
        subject.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase()
    );

    if (!name) return;
    if (duplicateSubject) {
      setSubjectError("That Subject is already in DayLo.");
      return;
    }

    setSubjects((currentSubjects) => [
      ...currentSubjects,
      {
        id: `subject-${Date.now()}`,
        ...subjectDraft,
        name,
        source: "manual",
        classroomCourseId: null,
        externalId: null,
        importedAt: null,
        lastSyncedAt: null,
      },
    ]);
    setStudentProfile((currentProfile) => ({
      ...currentProfile,
      schoolSystem: currentProfile.schoolSystem || subjectDraft.courseSystem,
      source: currentProfile.source || "manual",
    }));
    setSubjectDraft(
      createSubjectDraft(studentProfile.schoolSystem || "Other", [
        ...subjects,
        { ...subjectDraft, name },
      ])
    );
    setSubjectColourManuallySelected(false);
    setSubjectError("");
    requestAnimationFrame(() => subjectNameInputRef.current?.focus());
  }

  function updateCourseSelection(course, selection) {
    const courseId = getRealClassroomCourseId(course);
    if (!courseId) return;

    const nextSelections = { ...courseSelections, [courseId]: selection };
    persistCourseSelections(nextSelections);

    if (selection === "ignored") {
      const nextLinks = { ...courseLinks };
      delete nextLinks[courseId];
      persistCourseLinks(nextLinks);
      return;
    }

    const matchingSubject = findBestSubjectForClassroomCourse(subjects, course);
    if (matchingSubject && !courseLinks[courseId]) {
      persistCourseLinks({
        ...courseLinks,
        [courseId]: createRealClassroomCourseLink(course, matchingSubject),
      });
    }
  }

  function createAndLinkIncludedSubjects() {
    const merged = mergeIncludedClassroomSubjects({
      courses: classroomState.courses,
      selections: courseSelections,
      subjects,
      links: courseLinks,
    });
    setSubjects(merged.subjects);
    persistCourseLinks(merged.links);
  }

  function linkCourseToSubject(course, subjectId) {
    const courseId = getRealClassroomCourseId(course);
    const subject = subjects.find((item) => item.id === subjectId);
    const nextLinks = { ...courseLinks };

    if (subject) {
      nextLinks[courseId] = createRealClassroomCourseLink(course, subject);
    } else {
      delete nextLinks[courseId];
    }
    persistCourseLinks(nextLinks);
  }

  function updateSubjectGrade(subjectId, field, value) {
    setSubjects((currentSubjects) =>
      currentSubjects.map((subject) =>
        subject.id === subjectId ? { ...subject, [field]: value } : subject
      )
    );
  }

  function updatePlanningPreference(field, value) {
    const nextPreferences = {
      ...planningPreferences,
      [field]: value,
    };
    setPlanningPreferences(nextPreferences);
    void onUpdatePlanningPreferences?.(nextPreferences);
  }

  function chooseThemePalette(palette) {
    saveThemeColorPreferences({
      ...themeColors,
      paletteId: palette.id,
      primary: palette.primary,
      secondary: palette.secondary,
      tertiary: palette.tertiary,
    });
  }

  function finishOnboarding() {
    clearOnboardingDraft();
    onComplete();
  }

  function goForward() {
    if (step === onboardingSteps.length - 1) {
      if (!showCompletion) {
        setShowCompletion(true);
      } else {
        finishOnboarding();
      }
      return;
    }
    setStep(advanceOnboardingStep);
  }

  function goBack() {
    if (showCompletion) {
      setShowCompletion(false);
      return;
    }
    setStep((currentStep) => Math.max(0, currentStep - 1));
  }

  const nextLabel =
    step === 0
      ? "Get started"
      : step === 2 && !calendarState.connected
        ? "Do this later"
        : step === 4
          ? showCompletion
            ? "Enter DayLo"
            : "Finish setup"
          : "Continue";

  return (
    <main className="onboarding-shell">
      <section className="onboarding-frame">
        <header className="onboarding-topbar">
          <div className="onboarding-brand">
            <DayloMark className="onboarding-brand-mark" appearance={logoAppearance} />
            <div><strong>DayLo</strong><small>Student Hub</small></div>
          </div>
          {!showCompletion && (
            <button type="button" onClick={finishOnboarding}>Skip setup</button>
          )}
        </header>

        <div className="onboarding-progress" aria-label="Onboarding progress">
          {onboardingSteps.map((label, index) => (
            <span
              key={label}
              className={`${index === step ? "active" : ""} ${index < step ? "complete" : ""}`}
              aria-current={index === step ? "step" : undefined}
            >
              <i>{index < step ? "✓" : index + 1}</i><small>{label}</small>
            </span>
          ))}
        </div>

        <div className="onboarding-content" key={`${step}-${showCompletion}`}>
          {step === 0 && (
            <div className="onboarding-welcome">
              <p className="eyebrow">Welcome to DayLo</p>
              <h1>School, organised around your day.</h1>
              <p>Collect schoolwork, see deadlines and events, and build a realistic study plan.</p>
              <div className="onboarding-value-grid" aria-label="What DayLo helps with">
                <div><strong>Schoolwork</strong><span>Keep tasks in one place.</span></div>
                <div><strong>Deadlines</strong><span>See what is coming.</span></div>
                <div><strong>Study plans</strong><span>Plan time you can use.</span></div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="onboarding-step onboarding-schoolwork-step">
              <div className="onboarding-step-heading">
                <p className="eyebrow">Schoolwork</p>
                <h2>How would you like to add your classes?</h2>
                <p>Connect Classroom or start with Subjects of your own.</p>
              </div>

              <div className="onboarding-route-grid">
                <button
                  type="button"
                  className={setupRoute === "classroom" ? "active" : ""}
                  aria-pressed={setupRoute === "classroom"}
                  onClick={() => chooseSetupRoute("classroom")}
                >
                  <strong>Connect Google Classroom</strong>
                  <span>Bring in classes now. Assignments come later.</span>
                </button>
                <button
                  type="button"
                  className={setupRoute === "manual" ? "active" : ""}
                  aria-pressed={setupRoute === "manual"}
                  onClick={() => chooseSetupRoute("manual")}
                >
                  <strong>Set up manually</strong>
                  <span>Add one Subject or continue without any.</span>
                </button>
              </div>

              {setupRoute === "classroom" && (
                <div className="onboarding-route-panel">
                  <div className="onboarding-connection-row">
                    <div>
                      <strong>{classroomState.connected ? "Classroom connected" : "Google Classroom"}</strong>
                      <span className={classroomState.error ? "is-error" : ""} aria-live="polite">
                        {classroomState.checking ? "Checking connection..." : classroomState.message || "Connect to load your classes."}
                      </span>
                    </div>
                    {classroomState.connected ? (
                      <button type="button" className="small-button" onClick={loadClassroomCourses} disabled={classroomState.loading}>
                        {classroomState.loading ? "Loading..." : "Reload classes"}
                      </button>
                    ) : (
                      <button type="button" className="small-button primary" onClick={() => beginGoogleConnection("classroom")}>
                        Connect Classroom
                      </button>
                    )}
                  </div>

                  {classroomState.courses.length > 0 && (
                    <>
                      <div className="onboarding-course-summary">
                        <span>{classroomState.courses.length} found</span>
                        <span>{includedCourses.length} included</span>
                        <span>{linkedIncludedCount} linked</span>
                      </div>
                      <div className="onboarding-course-list">
                        {classroomState.courses.map((course) => {
                          const courseId = getRealClassroomCourseId(course);
                          const selection = courseSelections[courseId] || "review";
                          const link = courseLinks[courseId];
                          const linkedSubject = subjects.find((subject) => subject.id === link?.subjectId);

                          return (
                            <article key={courseId} className="onboarding-course-row">
                              <div className="onboarding-course-copy">
                                <strong>{course.name || "Untitled class"}</strong>
                                {course.section && <span>{course.section}</span>}
                              </div>
                              <div className="onboarding-course-choice" role="group" aria-label={`${course.name} choice`}>
                                <button type="button" className={selection === "included" ? "active" : ""} aria-pressed={selection === "included"} onClick={() => updateCourseSelection(course, "included")}>Include</button>
                                <button type="button" className={selection === "ignored" ? "active" : ""} aria-pressed={selection === "ignored"} onClick={() => updateCourseSelection(course, "ignored")}>Ignore</button>
                              </div>
                              {selection === "included" && (
                                <div className="onboarding-course-link">
                                  <label>
                                    <span>DayLo Subject</span>
                                    <select value={link?.subjectId || ""} onChange={(event) => linkCourseToSubject(course, event.target.value)}>
                                      <option value="">Choose a Subject</option>
                                      {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                                    </select>
                                  </label>
                                  {linkedSubject && (
                                    <div className="onboarding-grade-pair">
                                      <label><span>Current</span><input value={linkedSubject.currentGrade || ""} placeholder="Optional" onChange={(event) => updateSubjectGrade(linkedSubject.id, "currentGrade", event.target.value)} /></label>
                                      <label><span>Target</span><input value={linkedSubject.targetGrade || ""} placeholder="Optional" onChange={(event) => updateSubjectGrade(linkedSubject.id, "targetGrade", event.target.value)} /></label>
                                    </div>
                                  )}
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>
                      <button type="button" className="onboarding-link-subjects" disabled={includedCourses.length === 0} onClick={createAndLinkIncludedSubjects}>
                        Create and link included Subjects
                      </button>
                    </>
                  )}
                  <button type="button" className="onboarding-text-action" onClick={() => chooseSetupRoute("manual")}>Add a manual Subject instead</button>
                </div>
              )}

              {setupRoute === "manual" && (
                <ManualSubjectForm
                  subjectDraft={subjectDraft}
                  setSubjectDraft={setSubjectDraft}
                  subjects={subjects}
                  subjectError={subjectError}
                  subjectNameInputRef={subjectNameInputRef}
                  subjectColourManuallySelected={subjectColourManuallySelected}
                  setSubjectColourManuallySelected={setSubjectColourManuallySelected}
                  onSubmit={addOnboardingSubject}
                />
              )}

              {setupRoute && <SubjectList subjects={subjects} />}
            </div>
          )}

          {step === 2 && (
            <div className="onboarding-step onboarding-calendar-step">
              <div className="onboarding-step-heading">
                <p className="eyebrow">Calendar</p>
                <h2>Keep real events beside your deadlines.</h2>
                <p>DayLo can protect busy time when it builds a plan.</p>
              </div>
              <div className={`onboarding-service-card ${calendarState.connected ? "is-connected" : ""}`}>
                <span className="onboarding-service-icon" aria-hidden="true">G</span>
                <div>
                  <strong>{calendarState.connected ? "Google Calendar connected" : "Google Calendar"}</strong>
                  <p className={calendarState.error ? "is-error" : ""} aria-live="polite">
                    {calendarState.checking ? "Checking connection..." : calendarState.message}
                  </p>
                </div>
                {!calendarState.connected && (
                  <button type="button" className="onboarding-service-action" onClick={() => beginGoogleConnection("calendar")}>Connect Google Calendar</button>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="onboarding-step">
              <div className="onboarding-step-heading">
                <p className="eyebrow">Planning</p>
                <h2>When do you usually study?</h2>
                <p>These become your starting defaults. You can change them any time.</p>
              </div>
              <div className="onboarding-planning-grid">
                <label><span>Typical start</span><input type="time" value={planningPreferences.startTime} onChange={(event) => updatePlanningPreference("startTime", event.target.value)} /></label>
                <label>
                  <span>Typical finish</span>
                  <input type="time" value={planningPreferences.endTime} onChange={(event) => updatePlanningPreference("endTime", event.target.value)} />
                  {finishIsNextDay && <small>Next day</small>}
                </label>
              </div>
              {planningSyncError && <p className="settings-inline-error" role="alert">Planning preferences could not sync. Try again.</p>}
              <fieldset className="onboarding-plan-style">
                <legend>Planning style</legend>
                <div className="onboarding-segmented-control">
                  {planningStyles.map((option) => (
                    <button key={option.value} type="button" className={planningPreferences.planStyle === option.value ? "active" : ""} aria-pressed={planningPreferences.planStyle === option.value} onClick={() => updatePlanningPreference("planStyle", option.value)}>{option.label}</button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {step === 4 && !showCompletion && (
            <div className="onboarding-step">
              <div className="onboarding-step-heading">
                <p className="eyebrow">Appearance</p>
                <h2>Make DayLo feel like yours.</h2>
                <p>Choose a mode and one colour palette.</p>
              </div>
              <div className="onboarding-appearance-section">
                <div className="onboarding-setting-label"><strong>Mode</strong></div>
                <div className="onboarding-segmented-control" role="group" aria-label="Appearance mode">
                  {["light", "dark", "system"].map((option) => (
                    <button key={option} type="button" className={theme === option ? "active" : ""} aria-pressed={theme === option} onClick={() => setTheme(option)}>{option[0].toUpperCase() + option.slice(1)}</button>
                  ))}
                </div>
              </div>
              <div className="onboarding-palette-section">
                <strong>Theme palette</strong>
                <div className="onboarding-palette-grid">
                  {themeColorPalettes.map((palette) => {
                    const selected = themeColors.paletteId === palette.id;
                    return (
                      <button key={palette.id} type="button" className={selected ? "active" : ""} aria-pressed={selected} onClick={() => chooseThemePalette(palette)}>
                        <span className="onboarding-palette-swatches" aria-hidden="true"><i style={{ background: palette.primary }} /><i style={{ background: palette.secondary }} /><i style={{ background: palette.tertiary }} /></span>
                        <span>{palette.label}</span>{selected && <b aria-hidden="true">✓</b>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 4 && showCompletion && (
            <div className="onboarding-finish" role="status" aria-live="polite">
              <span className="onboarding-finish-mark" aria-hidden="true">✓</span>
              <p className="eyebrow">Ready</p>
              <h2>DayLo is ready.</h2>
              <p>Your schoolwork, calendar, and planning choices can all be changed later.</p>
              <div className="onboarding-summary">
                <span><small>Subjects</small><strong>{subjects.length}</strong></span>
                <span><small>Classroom</small><strong>{classroomState.connected ? "Connected" : "Later"}</strong></span>
                <span><small>Calendar</small><strong>{calendarState.connected ? "Connected" : "Later"}</strong></span>
              </div>
            </div>
          )}
        </div>

        <footer className="onboarding-actions">
          <button type="button" className="onboarding-back" disabled={step === 0} onClick={goBack}>Back</button>
          <span>Step {step + 1} of {onboardingSteps.length}</span>
          <button type="button" className="onboarding-next" onClick={goForward}>{nextLabel}</button>
        </footer>
      </section>
    </main>
  );
}

function ManualSubjectForm({
  subjectDraft,
  setSubjectDraft,
  subjects,
  subjectError,
  subjectNameInputRef,
  subjectColourManuallySelected,
  setSubjectColourManuallySelected,
  onSubmit,
}) {
  return (
    <form className="onboarding-subject-form" onSubmit={onSubmit}>
      <div className="onboarding-subject-form-heading">
        <div><strong>Add a Subject</strong><span>Grades are optional.</span></div>
        <span className="onboarding-subject-colour-preview" style={{ "--subject-color": subjectDraft.colour }} aria-hidden="true" />
      </div>
      <div className="subject-form-grid">
        <label className="onboarding-subject-name-field">
          <span>Subject name</span>
          <input ref={subjectNameInputRef} value={subjectDraft.name} placeholder="e.g. Biology" onChange={(event) => {
            const name = event.target.value;
            setSubjectDraft((currentDraft) => ({ ...currentDraft, name, colour: suggestSubjectDraftColour({ subjectName: name, currentColour: currentDraft.colour, existingSubjects: subjects, manuallySelected: subjectColourManuallySelected }) }));
          }} />
        </label>
        <label className="onboarding-subject-system-field"><span>Course system</span><select value={subjectDraft.courseSystem} onChange={(event) => setSubjectDraft({ ...subjectDraft, courseSystem: event.target.value, level: getDefaultSubjectLevel(event.target.value) })}>{subjectCourseSystems.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label className="onboarding-subject-level-field"><span>{subjectDraft.courseSystem === "IB" ? "IB course level" : "Course level"}</span><select value={subjectDraft.level} onChange={(event) => setSubjectDraft({ ...subjectDraft, level: event.target.value })}>{getSubjectLevelOptions(subjectDraft.courseSystem).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="onboarding-subject-grade-field"><span>Current grade</span><input value={subjectDraft.currentGrade} placeholder="Optional" onChange={(event) => setSubjectDraft({ ...subjectDraft, currentGrade: event.target.value })} /></label>
        <label className="onboarding-subject-grade-field"><span>Target grade</span><input value={subjectDraft.targetGrade} placeholder="Optional" onChange={(event) => setSubjectDraft({ ...subjectDraft, targetGrade: event.target.value })} /></label>
        <label className="subject-colour-field"><span>Colour</span><span><input type="color" value={subjectDraft.colour} onChange={(event) => { setSubjectColourManuallySelected(true); setSubjectDraft({ ...subjectDraft, colour: event.target.value }); }} /><strong>{subjectDraft.colour.toUpperCase()}</strong></span></label>
      </div>
      {subjectError && <p className="subject-form-error">{subjectError}</p>}
      <div className="onboarding-subject-form-actions"><span>You can continue without adding one.</span><button className="small-button" type="submit">Add Subject</button></div>
    </form>
  );
}

function SubjectList({ subjects }) {
  if (subjects.length === 0) return null;
  return (
    <div className="onboarding-subject-results" aria-live="polite">
      <div className="onboarding-subject-results-heading"><strong>Your Subjects</strong><span>{subjects.length} added</span></div>
      <div className="onboarding-subject-list">
        {subjects.map((subject) => <span key={subject.id} style={{ "--subject-color": subject.colour }}><i /><strong>{subject.name}</strong>{(subject.currentGrade || subject.targetGrade) && <small>{subject.currentGrade || "–"} → {subject.targetGrade || "–"}</small>}</span>)}
      </div>
    </div>
  );
}

export default OnboardingFlow;
