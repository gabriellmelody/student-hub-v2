import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ProfileAvatar, { getProfileAvatarLabel } from "./ProfileAvatar.jsx";
import {
  LOCAL_PROFILE_AVATAR_IDS,
  getLocalProfileInitials,
  isValidLocalProfileName,
  normalizeLocalProfile,
} from "../utils/localProfileUtils.js";
import {
  blockGuidedTourBackground,
  getFocusableTourElements,
  getTourFocusTrapTarget,
  restoreTourFocus,
} from "../utils/guidedTourUtils.js";

export default function EditLocalProfileModal({ profile, onSave, onClose }) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [avatarId, setAvatarId] = useState(profile.avatarId);
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const returnFocusRef = useRef(null);
  const nameIsValid = isValidLocalProfileName(displayName);
  const previewProfile = normalizeLocalProfile({
    displayName: nameIsValid ? displayName : "Student",
    avatarId,
  });

  useLayoutEffect(() => {
    returnFocusRef.current = document.activeElement;
    const restoreBackground = blockGuidedTourBackground(
      document.querySelector(".app-shell")
    );
    const focusFrame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    function keepFocusInside(event) {
      if (dialogRef.current?.contains(event.target)) return;
      inputRef.current?.focus();
    }

    document.addEventListener("focusin", keepFocusInside);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("focusin", keepFocusInside);
      restoreBackground();
      requestAnimationFrame(() => {
        const returnTarget = returnFocusRef.current?.isConnected
          ? returnFocusRef.current
          : document.querySelector(
              ".sidebar-account-button, .mobile-bottom-nav-item:last-child"
            );
        restoreTourFocus(returnTarget);
      });
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = getFocusableTourElements(dialogRef.current);
      const focusTarget = getTourFocusTrapTarget({
        focusableElements,
        activeElement: document.activeElement,
        shiftKey: event.shiftKey,
        focusIsInside: dialogRef.current?.contains(document.activeElement),
      });

      if (!focusTarget) return;
      event.preventDefault();
      focusTarget.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function submitProfile(event) {
    event.preventDefault();
    if (!nameIsValid) return;
    onSave({ displayName: displayName.trim(), avatarId });
  }

  return createPortal(
    <div
      className="local-profile-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="local-profile-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="local-profile-title"
        aria-describedby="local-profile-description"
        tabIndex={-1}
      >
        <form onSubmit={submitProfile}>
          <div className="local-profile-scroll">
            <div className="local-profile-heading">
              <span className="eyebrow">Local workspace</span>
              <h2 id="local-profile-title">Edit profile</h2>
              <p id="local-profile-description">
                Choose how your name and avatar appear in this browser.
              </p>
            </div>

            <label className="local-profile-name-field">
              <span>Display name</span>
              <input
                ref={inputRef}
                type="text"
                value={displayName}
                maxLength={40}
                autoComplete="name"
                aria-invalid={!nameIsValid}
                aria-describedby="local-profile-name-help"
                onChange={(event) => setDisplayName(event.target.value)}
              />
              <small id="local-profile-name-help">
                {!displayName.trim() ? "Enter a display name." : `${displayName.length}/40`}
              </small>
            </label>

            <div className="local-profile-preview" aria-label="Current profile preview">
              <ProfileAvatar profile={previewProfile} className="local-profile-preview-avatar" />
              <span>
                <strong>{nameIsValid ? displayName.trim() : "Student"}</strong>
                <small>Local workspace</small>
                <small>
                  Initials preview: {getLocalProfileInitials(previewProfile.displayName)}
                </small>
              </span>
            </div>

            <fieldset className="local-profile-avatar-fieldset">
              <legend>Avatar</legend>
              <div className="local-profile-avatar-grid">
                {LOCAL_PROFILE_AVATAR_IDS.map((optionId) => {
                  const label = getProfileAvatarLabel(optionId);
                  const optionProfile = { ...previewProfile, avatarId: optionId };

                  return (
                    <button
                      key={optionId}
                      type="button"
                      className={avatarId === optionId ? "is-selected" : ""}
                      aria-label={`${label} avatar`}
                      aria-pressed={avatarId === optionId}
                      onClick={() => setAvatarId(optionId)}
                    >
                      <ProfileAvatar profile={optionProfile} />
                      <span>{label}</span>
                      {avatarId === optionId && (
                        <span className="local-profile-avatar-check" aria-hidden="true">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <div className="local-profile-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={!nameIsValid}>
              Save
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body
  );
}
