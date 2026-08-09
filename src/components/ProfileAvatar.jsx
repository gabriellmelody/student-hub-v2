import { getLocalProfileInitials } from "../utils/localProfileUtils.js";

const avatarLabels = {
  initials: "Initials",
  sunrise: "Sunrise",
  book: "Open book",
  star: "Star",
  bolt: "Lightning bolt",
  headphones: "Headphones",
  planet: "Planet",
  wave: "Wave",
};

function AvatarArtwork({ avatarId }) {
  if (avatarId === "sunrise") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path className="profile-avatar-peach" d="M10 25a14 14 0 0 1 28 0h-6a8 8 0 0 0-16 0z" />
        <circle className="profile-avatar-peach" cx="24" cy="27" r="5" />
        <path className="profile-avatar-blue" d="M8 29c7 0 11 3 16 8 5-5 9-8 16-8-2 8-8 13-16 13S10 37 8 29z" />
      </svg>
    );
  }

  if (avatarId === "book") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path className="profile-avatar-blue" d="M8 13c7-2 12 0 16 4v22c-4-4-9-6-16-4z" />
        <path className="profile-avatar-peach" d="M40 13c-7-2-12 0-16 4v22c4-4 9-6 16-4z" />
        <path className="profile-avatar-line" d="M24 17v22" />
      </svg>
    );
  }

  if (avatarId === "star") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path className="profile-avatar-peach" d="m24 7 5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" />
        <circle className="profile-avatar-blue" cx="35" cy="12" r="3" />
      </svg>
    );
  }

  if (avatarId === "bolt") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path className="profile-avatar-peach" d="M28 5 12 27h11l-3 16 16-23H25z" />
      </svg>
    );
  }

  if (avatarId === "headphones") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path className="profile-avatar-line profile-avatar-line-blue" d="M10 27v-5a14 14 0 0 1 28 0v5" />
        <rect className="profile-avatar-peach" x="7" y="24" width="9" height="15" rx="4" />
        <rect className="profile-avatar-peach" x="32" y="24" width="9" height="15" rx="4" />
      </svg>
    );
  }

  if (avatarId === "planet") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle className="profile-avatar-blue" cx="25" cy="24" r="12" />
        <path className="profile-avatar-line profile-avatar-line-peach" d="M6 30c5 5 18 3 27-2s11-11 7-14" />
        <circle className="profile-avatar-peach" cx="37" cy="9" r="3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path className="profile-avatar-line profile-avatar-line-blue" d="M6 18c6-6 12-6 18 0s12 6 18 0" />
      <path className="profile-avatar-line profile-avatar-line-peach" d="M6 30c6-6 12-6 18 0s12 6 18 0" />
    </svg>
  );
}

export function getProfileAvatarLabel(avatarId) {
  return avatarLabels[avatarId] || avatarLabels.initials;
}

export default function ProfileAvatar({ profile, className = "" }) {
  const avatarId = profile?.avatarId || "initials";
  const classes = `profile-avatar profile-avatar-${avatarId}${className ? ` ${className}` : ""}`;

  return (
    <span className={classes} aria-hidden="true">
      {avatarId === "initials" ? (
        <span className="profile-avatar-initials-text">
          {getLocalProfileInitials(profile?.displayName)}
        </span>
      ) : (
        <AvatarArtwork avatarId={avatarId} />
      )}
    </span>
  );
}
