export const LOCAL_PROFILE_STORAGE_KEY = "daylo-local-profile";

export const LOCAL_PROFILE_AVATAR_IDS = [
  "initials",
  "sunrise",
  "book",
  "star",
  "bolt",
  "headphones",
  "planet",
  "wave",
];

export const DEFAULT_LOCAL_PROFILE = Object.freeze({
  displayName: "Student",
  avatarId: "initials",
});

export function normalizeLocalProfile(value) {
  const rawName = typeof value?.displayName === "string" ? value.displayName : "";
  const displayName = rawName.trim();
  const avatarId = LOCAL_PROFILE_AVATAR_IDS.includes(value?.avatarId)
    ? value.avatarId
    : DEFAULT_LOCAL_PROFILE.avatarId;

  return {
    displayName:
      displayName && displayName.length <= 40
        ? displayName
        : DEFAULT_LOCAL_PROFILE.displayName,
    avatarId,
  };
}

export function isValidLocalProfileName(value) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 40;
}

export function getLocalProfileInitials(displayName) {
  const normalizedName =
    typeof displayName === "string" && displayName.trim()
      ? displayName.trim()
      : DEFAULT_LOCAL_PROFILE.displayName;
  const words = normalizedName.split(/\s+/u).filter(Boolean);
  const selectedWords = words.length > 1 ? [words[0], words.at(-1)] : words.slice(0, 1);

  return (
    selectedWords
      .map((word) => Array.from(word)[0] || "")
      .join("")
      .toLocaleUpperCase() || "S"
  );
}

export function loadLocalProfile(storage = globalThis.localStorage) {
  if (!storage) return { ...DEFAULT_LOCAL_PROFILE };

  try {
    const savedValue = JSON.parse(storage.getItem(LOCAL_PROFILE_STORAGE_KEY) || "null");
    return normalizeLocalProfile(savedValue);
  } catch {
    return { ...DEFAULT_LOCAL_PROFILE };
  }
}

export function saveLocalProfile(profile, storage = globalThis.localStorage) {
  const normalizedProfile = normalizeLocalProfile(profile);

  if (storage) {
    storage.setItem(LOCAL_PROFILE_STORAGE_KEY, JSON.stringify(normalizedProfile));
  }

  return normalizedProfile;
}

export function clearLocalProfile(storage = globalThis.localStorage) {
  storage?.removeItem(LOCAL_PROFILE_STORAGE_KEY);
  return { ...DEFAULT_LOCAL_PROFILE };
}

