import { useEffect, useState } from "react";
import {
  subjectCourseSystems,
  subjectLevels,
  accentColorPresets,
  getContrastText,
  createSubjectDraft,
  getWidgetsForArea,
} from "../utils/appUtils.js";

function SettingsPage({
  subjects,
  setSubjects,
  theme,
  setTheme,
  accentColor,
  setAccentColor,
  layoutDensity,
  setLayoutDensity,
  homeLayout,
  setHomeLayout,
  rightRailVisible,
  setRightRailVisible,
  widgetConfig,
  setWidgetConfig,
  openHomeEditMode,
  restartOnboarding,
  resetTasks,
  resetSubjects,
  resetAppearancePreferences,
  clearAllStudentHubData,
}) {
  const [settingsView, setSettingsView] = useState("hub");
  const viewCopy = {
    hub: {
      eyebrow: "Settings",
      title: "Settings",
      description: "Manage your workspace preferences and future connections.",
    },
    appearance: {
      eyebrow: "Settings / Appearance",
      title: "Appearance",
      description: "Personalise how Student Hub looks and feels.",
    },
    subjects: {
      eyebrow: "Settings / Subjects",
      title: "Subjects",
      description: "Keep your courses and grade goals organised in one place.",
    },
    data: {
      eyebrow: "Settings / Data",
      title: "Data & reset",
      description: "Manage local Student Hub data and workspace defaults.",
    },
  };
  const currentViewCopy = viewCopy[settingsView];

  const rightRailWidgets = getWidgetsForArea(
    widgetConfig,
    "rightRail",
    false
  );

  function updateWidget(widgetId, updates) {
    setWidgetConfig((currentConfig) =>
      currentConfig.map((widget) =>
        widget.id === widgetId ? { ...widget, ...updates } : widget
      )
    );
  }

  return (
    <div className={`page settings-page settings-view-${settingsView}`}>
      <header className="page-header">
        {settingsView !== "hub" && (
          <button
            type="button"
            className="settings-back-button"
            onClick={() => setSettingsView("hub")}
          >
            ← Settings
          </button>
        )}
        <p className="eyebrow">{currentViewCopy.eyebrow}</p>
        <h2>{currentViewCopy.title}</h2>
        <p>{currentViewCopy.description}</p>
      </header>

      {settingsView === "hub" ? (
        <div className="settings-hub-grid">
          <button
            type="button"
            className="settings-hub-card"
            onClick={() => setSettingsView("appearance")}
          >
            <span>
              <strong>Appearance</strong>
              <small>Theme, colour, density, and workspace layout</small>
            </span>
            <span className="settings-hub-arrow" aria-hidden="true">
              →
            </span>
          </button>

          <button
            type="button"
            className="settings-hub-card"
            onClick={() => setSettingsView("subjects")}
          >
            <span>
              <strong>Subjects</strong>
              <small>Courses, levels, grade goals, and colours</small>
            </span>
            <span className="settings-hub-arrow" aria-hidden="true">
              →
            </span>
          </button>

          <button
            type="button"
            className="settings-hub-card"
            onClick={() => setSettingsView("data")}
          >
            <span>
              <strong>Data & reset</strong>
              <small>Local data, workspace resets, and onboarding</small>
            </span>
            <span className="settings-hub-arrow" aria-hidden="true">
              →
            </span>
          </button>

          {[
            ["Account", "Profile and sign-in preferences"],
            ["Integrations", "Connected services and data sources"],
            ["Help / FAQ", "Guidance and common questions"],
          ].map(([title, description]) => (
            <button
              key={title}
              type="button"
              className="settings-hub-card coming-soon"
              disabled
            >
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <span className="settings-coming-soon">Coming soon</span>
            </button>
          ))}
        </div>
      ) : settingsView === "appearance" ? (
        <div className="panel appearance-panel">
          <section className="appearance-group">
            <p className="settings-group-label">Visual</p>

            <div className="theme-setting">
              <div>
                <h3>Theme</h3>
                <p>Choose the appearance that feels most comfortable.</p>
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

            <div className="theme-setting accent-setting">
              <div>
                <h3>Accent colour</h3>
                <p>Personalise highlights while keeping statuses distinct.</p>
              </div>

              <div className="accent-controls">
                <div
                  className="accent-presets"
                  aria-label="Accent colour presets"
                >
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
                      aria-pressed={accentColor === preset.value}
                      title={preset.label}
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
                    aria-label="Custom accent colour"
                    onChange={(event) => setAccentColor(event.target.value)}
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="appearance-group">
            <p className="settings-group-label">Layout</p>

            <div className="theme-setting density-setting">
              <div>
                <h3>Layout density</h3>
                <p>Choose between breathing room and a tighter workspace.</p>
              </div>

              <div
                className="theme-toggle density-toggle"
                role="group"
                aria-label="Layout density"
              >
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

            <div className="theme-setting home-layout-setting">
              <div>
                <h3>Home layout</h3>
                <p>Choose a focused workspace or a fuller task overview.</p>
              </div>

              <div
                className="theme-toggle home-layout-toggle"
                role="group"
                aria-label="Home layout"
              >
                {["focused", "dashboard"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={homeLayout === option ? "active" : ""}
                    aria-pressed={homeLayout === option}
                    onClick={() => setHomeLayout(option)}
                  >
                    {option === "focused" ? "Focused" : "Dashboard"}
                  </button>
                ))}
              </div>
            </div>

            <div className="theme-setting right-rail-setting">
              <div>
                <h3>Right rail</h3>
                <p>Show compact school context beside the workspace.</p>
              </div>

              <div
                className="theme-toggle right-rail-toggle"
                role="group"
                aria-label="Right rail"
              >
                {[
                  ["On", true],
                  ["Off", false],
                ].map(([label, value]) => (
                  <button
                    key={label}
                    type="button"
                    className={rightRailVisible === value ? "active" : ""}
                    aria-pressed={rightRailVisible === value}
                    onClick={() => setRightRailVisible(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="theme-setting home-edit-launch-setting">
              <div>
                <h3>Home page</h3>
                <p>Customise the blocks that appear on your Home dashboard.</p>
              </div>

              <button
                type="button"
                className="secondary-button settings-edit-home-button"
                onClick={openHomeEditMode}
              >
                Edit Home Page
              </button>
            </div>

            <div className="theme-setting rail-widgets-setting">
              <div>
                <h3>Rail widgets</h3>
                <p>Choose the school context shown in the right rail.</p>
              </div>

              <div className="rail-widget-options">
                {rightRailWidgets.map((widget) => (
                  <label className="rail-widget-option" key={widget.id}>
                    <input
                      type="checkbox"
                      checked={widget.visible}
                      onChange={() =>
                        updateWidget(widget.id, {
                          visible: !widget.visible,
                        })
                      }
                    />
                    <span>{widget.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : settingsView === "subjects" ? (
        <SubjectsSettings subjects={subjects} setSubjects={setSubjects} />
      ) : (
        <DataSettings
          resetTasks={resetTasks}
          resetSubjects={resetSubjects}
          resetAppearancePreferences={resetAppearancePreferences}
          restartOnboarding={restartOnboarding}
          clearAllStudentHubData={clearAllStudentHubData}
        />
      )}
    </div>
  );
}

function DataSettings({
  resetTasks,
  resetSubjects,
  resetAppearancePreferences,
  restartOnboarding,
  clearAllStudentHubData,
}) {
  const [pendingReset, setPendingReset] = useState(null);
  const resetOptions = [
    {
      id: "tasks",
      title: "Reset tasks",
      description: "Remove all tasks and clear the current generated plan.",
      confirmation: "All active, backlog, and completed tasks will be removed.",
      confirmLabel: "Reset tasks",
      action: resetTasks,
      destructive: true,
    },
    {
      id: "subjects",
      title: "Reset subjects",
      description: "Remove Subject Profiles without deleting any tasks.",
      confirmation:
        "Saved subjects, course details, grades, and subject colours will be removed. Existing task subject names will remain.",
      confirmLabel: "Reset subjects",
      action: resetSubjects,
      destructive: true,
    },
    {
      id: "appearance",
      title: "Reset appearance",
      description: "Restore theme, accent, density, Home, and rail defaults.",
      confirmation:
        "Your visual and workspace layout preferences will return to their default values. Tasks and subjects will stay untouched.",
      confirmLabel: "Reset appearance",
      action: resetAppearancePreferences,
    },
    {
      id: "onboarding",
      title: "Restart onboarding",
      description: "Run local workspace setup again without deleting your work.",
      confirmation:
        "Onboarding will open again. Your tasks, subjects, and current preferences will remain available.",
      confirmLabel: "Restart onboarding",
      action: restartOnboarding,
    },
    {
      id: "all",
      title: "Clear all local app data",
      description: "Return Student Hub to a clean first-time state.",
      confirmation:
        "Tasks, subjects, profile, onboarding status, preferences, and the current plan will all be removed from this device.",
      confirmLabel: "Clear all data",
      action: clearAllStudentHubData,
      destructive: true,
    },
  ];

  useEffect(() => {
    if (!pendingReset) return undefined;

    function closeOnEscape(event) {
      if (event.key === "Escape") setPendingReset(null);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [pendingReset]);

  function confirmReset() {
    if (!pendingReset) return;

    pendingReset.action();
    setPendingReset(null);
  }

  return (
    <div className="data-settings">
      <section className="panel data-panel">
        <div className="data-panel-intro">
          <div>
            <p className="settings-group-label">Stored on this device</p>
            <h3>Local workspace data</h3>
            <p>
              These controls only affect Student Hub data saved in this
              browser. Other site data is never touched.
            </p>
          </div>
          <span>Local only</span>
        </div>

        <div className="data-reset-list">
          {resetOptions.map((option) => (
            <div
              className={`data-reset-row ${
                option.destructive ? "destructive" : ""
              }`}
              key={option.id}
            >
              <div>
                <h3>{option.title}</h3>
                <p>{option.description}</p>
              </div>
              <button type="button" onClick={() => setPendingReset(option)}>
                {option.id === "onboarding"
                  ? "Restart"
                  : option.id === "all"
                    ? "Clear"
                    : "Reset"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {pendingReset && (
        <div
          className="data-confirmation-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPendingReset(null);
          }}
        >
          <section
            className={`data-confirmation ${
              pendingReset.destructive ? "destructive" : ""
            }`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="data-confirmation-title"
            aria-describedby="data-confirmation-description"
          >
            <div>
              <p className="settings-group-label">Confirm action</p>
              <h3 id="data-confirmation-title">{pendingReset.title}?</h3>
              <p id="data-confirmation-description">
                {pendingReset.confirmation}
              </p>
            </div>
            <div className="data-confirmation-actions">
              <button
                type="button"
                className="data-cancel-button"
                autoFocus
                onClick={() => setPendingReset(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="data-confirm-button"
                onClick={confirmReset}
              >
                {pendingReset.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SubjectsSettings({ subjects, setSubjects }) {
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [subjectDraft, setSubjectDraft] = useState(createSubjectDraft);
  const [subjectFormError, setSubjectFormError] = useState("");

  function openAddSubject() {
    setEditingSubjectId(null);
    setSubjectDraft(createSubjectDraft());
    setSubjectFormError("");
    setShowSubjectForm(true);
  }

  function openEditSubject(subject) {
    setEditingSubjectId(subject.id);
    setSubjectDraft({
      name: subject.name,
      courseSystem: subject.courseSystem,
      level: subject.level,
      currentGrade: subject.currentGrade,
      targetGrade: subject.targetGrade,
      colour: subject.colour,
    });
    setSubjectFormError("");
    setShowSubjectForm(true);
  }

  function closeSubjectForm() {
    setShowSubjectForm(false);
    setEditingSubjectId(null);
    setSubjectFormError("");
  }

  function saveSubject(event) {
    event.preventDefault();
    const name = subjectDraft.name.trim();
    const duplicateSubject = subjects.some(
      (subject) =>
        subject.id !== editingSubjectId &&
        subject.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase()
    );

    if (!name) return;

    if (duplicateSubject) {
      setSubjectFormError("A subject with this name already exists.");
      return;
    }

    if (editingSubjectId) {
      setSubjects((currentSubjects) =>
        currentSubjects.map((subject) =>
          subject.id === editingSubjectId
            ? { ...subject, ...subjectDraft, name, source: subject.source || "manual" }
            : subject
        )
      );
    } else {
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
    }

    closeSubjectForm();
  }

  function deleteSubject(subjectId) {
    setSubjects((currentSubjects) =>
      currentSubjects.filter((subject) => subject.id !== subjectId)
    );

    if (editingSubjectId === subjectId) closeSubjectForm();
  }

  return (
    <div className="subjects-settings">
      <div className="panel subjects-panel">
        <div className="panel-header subjects-panel-header">
          <div>
            <h3>Subject profiles</h3>
            <p>Task names stay compatible even if a profile is removed.</p>
          </div>
          <button className="small-button" type="button" onClick={openAddSubject}>
            + Add subject
          </button>
        </div>

        {showSubjectForm && (
          <form className="subject-profile-form" onSubmit={saveSubject}>
            <div className="subject-form-grid">
              <label>
                <span>Subject name</span>
                <input
                  type="text"
                  value={subjectDraft.name}
                  placeholder="e.g. Biology"
                  required
                  onChange={(event) =>
                    setSubjectDraft({ ...subjectDraft, name: event.target.value })
                  }
                />
              </label>

              <label>
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
                  {subjectCourseSystems.map((courseSystem) => (
                    <option key={courseSystem} value={courseSystem}>
                      {courseSystem}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Level</span>
                <select
                  value={subjectDraft.level}
                  onChange={(event) =>
                    setSubjectDraft({ ...subjectDraft, level: event.target.value })
                  }
                >
                  {subjectLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Current grade</span>
                <input
                  type="text"
                  value={subjectDraft.currentGrade}
                  placeholder="e.g. 5, B, 82%"
                  onChange={(event) =>
                    setSubjectDraft({
                      ...subjectDraft,
                      currentGrade: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>Target grade</span>
                <input
                  type="text"
                  value={subjectDraft.targetGrade}
                  placeholder="e.g. 7, A, 90%"
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
                    aria-label="Subject colour"
                    onChange={(event) =>
                      setSubjectDraft({
                        ...subjectDraft,
                        colour: event.target.value,
                      })
                    }
                  />
                  <strong>{subjectDraft.colour.toUpperCase()}</strong>
                </span>
              </label>
            </div>

            {subjectFormError && (
              <p className="subject-form-error">{subjectFormError}</p>
            )}

            <div className="subject-form-actions">
              <button className="primary-button" type="submit">
                {editingSubjectId ? "Save changes" : "Add subject"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={closeSubjectForm}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {subjects.length > 0 ? (
          <div className="subject-profile-list">
            {subjects.map((subject) => (
              <article
                className="subject-profile-card"
                key={subject.id}
                style={{ "--subject-color": subject.colour }}
              >
                <span className="subject-profile-colour" aria-hidden="true" />
                <div className="subject-profile-copy">
                  <div>
                    <h3>{subject.name}</h3>
                    <span>
                      {subject.courseSystem} · {subject.level}
                    </span>
                  </div>
                  <p>
                    Current <strong>{subject.currentGrade || "Not set"}</strong>
                    <i aria-hidden="true">→</i>
                    Target <strong>{subject.targetGrade || "Not set"}</strong>
                  </p>
                </div>
                <div className="subject-profile-actions">
                  <button type="button" onClick={() => openEditSubject(subject)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="subject-delete-button"
                    onClick={() => deleteSubject(subject.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="subject-empty-state">
            <h3>No subject profiles yet.</h3>
            <p>Add a course to use it across tasks and school calendars.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default SettingsPage;
