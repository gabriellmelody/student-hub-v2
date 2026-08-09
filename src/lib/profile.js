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
    .select("id, display_name, avatar_id, school_system, onboarding_completed")
    .eq("id", userId)
    .maybeSingle();
}

export async function insertUserProfile(client, profile) {
  return client
    .from("profiles")
    .insert(profile)
    .select("id, display_name, avatar_id, school_system, onboarding_completed")
    .single();
}

export async function updateUserProfile(client, userId, updates) {
  return client
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select("id, display_name, avatar_id, school_system, onboarding_completed")
    .single();
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

  if (existing.data) return existing.data;

  const inserted = await insertUserProfile(client, createDefaultProfile(user));
  if (!inserted.error) return inserted.data;

  if (!isDuplicateProfileError(inserted.error)) {
    throw inserted.error;
  }

  const racedProfile = await selectUserProfile(client, user.id);
  if (racedProfile.error) throw racedProfile.error;
  if (!racedProfile.data) throw inserted.error;

  return racedProfile.data;
}
