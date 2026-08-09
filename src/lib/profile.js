import {
  DEFAULT_LOCAL_PROFILE,
  LOCAL_PROFILE_AVATAR_IDS,
  isValidLocalProfileName,
} from "../utils/localProfileUtils.js";

export const PROFILE_COLUMNS =
  "id, display_name, avatar_id, school_system, onboarding_completed";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function mapCloudProfile(row = {}) {
  const displayName = cleanString(row.display_name);
  const avatarId = LOCAL_PROFILE_AVATAR_IDS.includes(row.avatar_id)
    ? row.avatar_id
    : DEFAULT_LOCAL_PROFILE.avatarId;

  return {
    id: String(row.id || ""),
    displayName:
      displayName && displayName.length <= 40
        ? displayName
        : DEFAULT_LOCAL_PROFILE.displayName,
    avatarId,
    schoolSystem: cleanString(row.school_system),
    onboardingCompleted: row.onboarding_completed === true,
  };
}

export function mapProfileForUpdate(updates = {}) {
  const payload = {};

  if (Object.hasOwn(updates, "displayName")) {
    if (!isValidLocalProfileName(updates.displayName)) {
      throw new Error("Enter a display name of up to 40 characters.");
    }
    payload.display_name = updates.displayName.trim();
  }
  if (Object.hasOwn(updates, "avatarId")) {
    if (!LOCAL_PROFILE_AVATAR_IDS.includes(updates.avatarId)) {
      throw new Error("Choose a valid DayLo avatar.");
    }
    payload.avatar_id = updates.avatarId;
  }
  if (Object.hasOwn(updates, "schoolSystem")) {
    payload.school_system = cleanString(updates.schoolSystem);
  }
  if (Object.hasOwn(updates, "onboardingCompleted")) {
    payload.onboarding_completed = updates.onboardingCompleted === true;
  }

  return payload;
}

export function getProfileForAuthenticatedUser(profileState, userId) {
  return profileState?.id === userId ? profileState : null;
}

export function getProfileDisplayName(user) {
  const metadataName =
    typeof user?.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";
  if (metadataName) return metadataName.slice(0, 40);

  const emailName = String(user?.email || "").split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (emailName) {
    return emailName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toLocaleUpperCase()}${part.slice(1)}`)
      .join(" ")
      .slice(0, 40);
  }

  return "Student";
}

export function createDefaultProfile(user) {
  if (!user?.id) throw new Error("Cannot create a profile without an authenticated user.");

  return {
    id: user.id,
    display_name: getProfileDisplayName(user),
    avatar_id: "initials",
    school_system: "",
    onboarding_completed: false,
  };
}

export async function selectUserProfile(client, userId) {
  return client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
}

export async function insertUserProfile(client, profile) {
  return client
    .from("profiles")
    .insert(profile)
    .select(PROFILE_COLUMNS)
    .single();
}

export async function updateUserProfile(client, userId, updates) {
  return client
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .single();
}

export async function fetchUserProfile(client, userId) {
  if (!userId) return null;
  const result = await selectUserProfile(client, userId);
  if (result.error) throw result.error;
  return result.data ? mapCloudProfile(result.data) : null;
}

export async function saveUserProfile(client, userId, updates) {
  if (!userId) throw new Error("Cannot update a profile without an authenticated user.");
  const payload = mapProfileForUpdate(updates);
  if (Object.keys(payload).length === 0) return fetchUserProfile(client, userId);

  const result = await updateUserProfile(client, userId, payload);
  if (result.error) throw result.error;
  if (!result.data || result.data.id !== userId) {
    throw new Error("DayLo could not verify the updated profile.");
  }
  return mapCloudProfile(result.data);
}

export function subscribeToUserProfileChanges(client, userId, onChange) {
  if (!userId || typeof client?.channel !== "function") return () => {};

  const channel = client
    .channel(`profile:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `id=eq.${userId}`,
      },
      onChange
    )
    .subscribe();

  return () => {
    if (typeof client.removeChannel === "function") {
      client.removeChannel(channel);
      return;
    }
    channel?.unsubscribe?.();
  };
}

export function isDuplicateProfileError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();

  return code === "23505" || message.includes("duplicate key");
}


export async function bootstrapUserProfile({
  ensureProfile,
  user,
  retry = true,
  retryDelayMs = 650,
  waitForRetry = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
  shouldContinue = () => true,
} = {}) {
  if (!user?.id || typeof ensureProfile !== "function") return null;

  try {
    return await ensureProfile(user);
  } catch (firstError) {
    if (!retry) throw firstError;

    await waitForRetry(retryDelayMs);
    if (!shouldContinue(user.id)) return null;

    return ensureProfile(user);
  }
}

export async function ensureUserProfile(client, user) {
  const existing = await selectUserProfile(client, user.id);

  if (existing.error && existing.error.code !== "PGRST116") {
    throw existing.error;
  }

  if (existing.data) return mapCloudProfile(existing.data);

  const inserted = await insertUserProfile(client, createDefaultProfile(user));
  if (!inserted.error) return mapCloudProfile(inserted.data);

  if (!isDuplicateProfileError(inserted.error)) {
    throw inserted.error;
  }

  const racedProfile = await selectUserProfile(client, user.id);
  if (racedProfile.error) throw racedProfile.error;
  if (!racedProfile.data) throw inserted.error;

  return mapCloudProfile(racedProfile.data);
}
