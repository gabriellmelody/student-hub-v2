import { useRef, useState } from "react";
import {
  subjectCourseSystems,
  subjectLevels,
  accentColorPresets,
  getContrastText,
  createSubjectDraft,
} from "../utils/appUtils.js";
import { suggestSubjectDraftColour } from "../utils/subjectColourUtils.js";
import DayloMark from "../components/DayloMark.jsx";

const onboardingSteps = [
  "Welcome",
  "Appearance",
  "School system",
  "Subjects",
  "Finish",
];

function OnboardingFlow({
  studentProfile,
  setStudentProfile,
  subjects,
  setSubjects,
  theme,
  setTheme,
  logoAppearance,
  accentColor,
  setAccentColor,
  layoutDensity,
  setLayoutDensity,
  onComplete,
}) {
  const [step, setStep] = useState(0);
  const [subjectDraft, setSubjectDraft] = useState(() =>
    createSubjectDraft(studentProfile.schoolSystem || "Other", subjects)
  );
  const [subjectColourManuallySelected, setSubjectColourManuallySelected] =
    useState(false);
  const [subjectError, setSubjectError] = useState("");
  const subjectNameInputRef = useRef(null);

  function selectSchoolSystem(schoolSystem) {
    setStudentProfile((currentProfile) => ({
      ...currentProfile,
      schoolSystem,
      source: "manual",
    }));
    setSubjectDraft((currentDraft) => ({
      ...currentDraft,
      courseSystem: schoolSystem,
      level:
        schoolSystem === "IB"
          ? "HL"
          : schoolSystem === "AP"
            ? "AP"
            : schoolSystem === "GCSE" || schoolSystem === "A-level"
              ? "Higher"
              : "Standard",
    }));
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
      setSubjectError("That subject is already in your workspace.");
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

  function goForward() {
    if (step === 2 && !studentProfile.schoolSystem) {
      selectSchoolSystem("Other");
    }

    setStep((currentStep) => Math.min(currentStep + 1, onboardingSteps.length - 1));
  }

  return (
    <main className="onboarding-shell">
      <section className="onboarding-frame">
        <header className="onboarding-topbar">
          <div className="onboarding-brand">
            <DayloMark
              className="onboarding-brand-mark"
              appearance={logoAppearance}
            />
            <div>
              <strong>DayLo</strong>
              <small>Student Hub</small>
            </div>
          </div>
          {step < onboardingSteps.length - 1 && (
            <button type="button" onClick={onComplete}>
              Skip setup
            </button>
          )}
        </header>

        <div className="onboarding-progress" aria-label="Onboarding progress">
          {onboardingSteps.map((label, index) => (
            <span
              key={label}
              className={`${index === step ? "active" : ""} ${
                index < step ? "complete" : ""
              }`}
              aria-current={index === step ? "step" : undefined}
            >
              <i>{index + 1}</i>
              <small>{label}</small>
            </span>
          ))}
        </div>

        <div className="onboarding-content" key={step}>
          {step === 0 && (
            <div className="onboarding-welcome">
              <p className="eyebrow">Welcome</p>
              <h1>Set up school around the way you work.</h1>
              <p>
                Plan schoolwork, deadlines, subjects, and study time in one
                calm workspace. This setup stays on this device.
              </p>
              <div className="onboarding-value-grid">
                <div>
                  <strong>See what matters</strong>
                  <span>Keep tasks, deadlines, and plans together.</span>
                </div>
                <div>
                  <strong>Make it yours</strong>
                  <span>Choose the layout and subjects that fit you.</span>
                </div>
                <div>
                  <strong>Ready for later</strong>
                  <span>Your local setup can support future school tools.</span>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="onboarding-step">
              <div className="onboarding-step-heading">
                <p className="eyebrow">Appearance</p>
                <h2>Choose a workspace that feels comfortable.</h2>
                <p>These are the same controls you can change in Settings.</p>
              </div>

              <div className="onboarding-setting-row">
                <div>
                  <strong>Theme</strong>
                  <span>Set the overall surface and contrast.</span>
                </div>
                <div className="theme-toggle" role="group" aria-label="Theme">
                  {["light", "dark"].map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={theme === option ? "active" : ""}
                      aria-pressed={theme === option}
                      onClick={() => setTheme(option)}
                    >
                      {option === "light" ? "Light" : "Dark"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="onboarding-setting-row">
                <div>
                  <strong>Accent colour</strong>
                  <span>Used for actions and selected states.</span>
                </div>
                <div className="accent-controls">
                  <div className="accent-presets">
                    {accentColorPresets.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        className={accentColor === preset.value ? "active" : ""}
                        style={{
                          "--preset-color": preset.value,
                          "--preset-contrast": getContrastText(preset.value),
                        }}
                        aria-label={`${preset.label} accent`}
                        onClick={() => setAccentColor(preset.value)}
                      >
                        <span aria-hidden="true">✓</span>
                      </button>
                    ))}
                  </div>
                  <label className="accent-picker">
                    <span>Custom</span>
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(event) => setAccentColor(event.target.value)}
                    />
                  </label>
                </div>
              </div>

              <div className="onboarding-setting-row">
                <div>
                  <strong>Layout density</strong>
                  <span>Choose breathing room or a tighter workspace.</span>
                </div>
                <div className="theme-toggle" role="group" aria-label="Density">
                  {["comfortable", "compact"].map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={layoutDensity === option ? "active" : ""}
                      aria-pressed={layoutDensity === option}
                      onClick={() => setLayoutDensity(option)}
                    >
                      {option === "comfortable" ? "Comfortable" : "Compact"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="onboarding-step">
              <div className="onboarding-step-heading">
                <p className="eyebrow">School system</p>
                <h2>What course system do you use?</h2>
                <p>This gives new subjects a useful default. You can mix systems later.</p>
              </div>
              <div className="onboarding-choice-grid">
                {subjectCourseSystems.map((schoolSystem) => (
                  <button
                    key={schoolSystem}
                    type="button"
                    className={
                      studentProfile.schoolSystem === schoolSystem ? "active" : ""
                    }
                    aria-pressed={studentProfile.schoolSystem === schoolSystem}
                    onClick={() => selectSchoolSystem(schoolSystem)}
                  >
                    <strong>{schoolSystem}</strong>
                    <span>{getSchoolSystemDescription(schoolSystem)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="onboarding-step onboarding-subjects-step">
              <div className="onboarding-step-heading">
                <p className="eyebrow">Subjects</p>
                <h2>Add the classes you are studying.</h2>
                <p>Add your main subjects now, or finish setup and add them later.</p>
              </div>

              <form className="onboarding-subject-form" onSubmit={addOnboardingSubject}>
                <div className="onboarding-subject-form-heading">
                  <div>
                    <strong>New subject</strong>
                    <span>Grades are optional and can be updated later.</span>
                  </div>
                  <span
                    className="onboarding-subject-colour-preview"
                    style={{ "--subject-color": subjectDraft.colour }}
                    aria-hidden="true"
                  />
                </div>
                <div className="subject-form-grid">
                  <label className="onboarding-subject-name-field">
                    <span>Subject name</span>
                    <input
                      ref={subjectNameInputRef}
                      type="text"
                      value={subjectDraft.name}
                      placeholder="e.g. Biology"
                      onChange={(event) => {
                        const name = event.target.value;

                        setSubjectDraft((currentDraft) => ({
                          ...currentDraft,
                          name,
                          colour: suggestSubjectDraftColour({
                            subjectName: name,
                            currentColour: currentDraft.colour,
                            existingSubjects: subjects,
                            manuallySelected: subjectColourManuallySelected,
                          }),
                        }));
                      }}
                    />
                  </label>
                  <label className="onboarding-subject-system-field">
                    <span>Course system</span>
                    <select
                      value={subjectDraft.courseSystem}
                      onChange={(event) =>
                        setSubjectDraft({
                          ...subjectDraft,
                          courseSystem: event.target.value,
                        })
                      }
                    >
                      {subjectCourseSystems.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label className="onboarding-subject-level-field">
                    <span>Level</span>
                    <select
                      value={subjectDraft.level}
                      onChange={(event) =>
                        setSubjectDraft({ ...subjectDraft, level: event.target.value })
                      }
                    >
                      {subjectLevels.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label className="onboarding-subject-grade-field">
                    <span>Current grade</span>
                    <input
                      type="text"
                      value={subjectDraft.currentGrade}
                      placeholder="Optional"
                      onChange={(event) =>
                        setSubjectDraft({
                          ...subjectDraft,
                          currentGrade: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="onboarding-subject-grade-field">
                    <span>Target grade</span>
                    <input
                      type="text"
                      value={subjectDraft.targetGrade}
                      placeholder="Optional"
                      onChange={(event) =>
                        setSubjectDraft({
                          ...subjectDraft,
                          targetGrade: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="subject-colour-field">
                    <span>Subject colour</span>
                    <span>
                      <input
                        type="color"
                        value={subjectDraft.colour}
                        onChange={(event) => {
                          setSubjectColourManuallySelected(true);
                          setSubjectDraft({
                            ...subjectDraft,
                            colour: event.target.value,
                          });
                        }}
                      />
                      <strong>{subjectDraft.colour.toUpperCase()}</strong>
                    </span>
                  </label>
                </div>
                {subjectError && <p className="subject-form-error">{subjectError}</p>}
                <div className="onboarding-subject-form-actions">
                  <span>Saved to Subject Profiles</span>
                  <button className="small-button" type="submit">
                    + Add subject
                  </button>
                </div>
              </form>

              <div className="onboarding-subject-results" aria-live="polite">
                <div className="onboarding-subject-results-heading">
                  <strong>Your subjects</strong>
                  <span>{subjects.length} added</span>
                </div>
                <div className="onboarding-subject-list">
                  {subjects.length > 0 ? (
                    subjects.map((subject) => (
                      <span
                        key={subject.id}
                        style={{ "--subject-color": subject.colour }}
                      >
                        <i />
                        <strong>{subject.name}</strong>
                        <small>
                          {subject.courseSystem} · {subject.level}
                        </small>
                      </span>
                    ))
                  ) : (
                    <p>
                      Add your main subjects now, or finish setup and add them
                      later in Settings.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="onboarding-finish">
              <span className="onboarding-finish-mark">✓</span>
              <p className="eyebrow">Ready</p>
              <h2>Your workspace is set up.</h2>
              <p>You can change any of these choices later in Settings.</p>
              <div className="onboarding-summary">
                <span><small>School system</small><strong>{studentProfile.schoolSystem || "Other"}</strong></span>
                <span><small>Subjects</small><strong>{subjects.length}</strong></span>
              </div>
            </div>
          )}
        </div>

        <footer className="onboarding-actions">
          <button
            type="button"
            className="onboarding-back"
            disabled={step === 0}
            onClick={() => setStep((currentStep) => Math.max(0, currentStep - 1))}
          >
            Back
          </button>
          <span>Step {step + 1} of {onboardingSteps.length}</span>
          <button
            type="button"
            className="onboarding-next"
            onClick={step === onboardingSteps.length - 1 ? onComplete : goForward}
          >
            {step === 0
              ? "Get started"
              : step === onboardingSteps.length - 1
                ? "Enter DayLo"
                : "Continue"}
          </button>
        </footer>
      </section>
    </main>
  );
}

function getSchoolSystemDescription(schoolSystem) {
  const descriptions = {
    IB: "International Baccalaureate",
    AP: "Advanced Placement",
    GCSE: "GCSE courses",
    "A-level": "A-level courses",
    Other: "Another school system",
  };

  return descriptions[schoolSystem];
}

export default OnboardingFlow;
