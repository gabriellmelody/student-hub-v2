export const AUTH_PASSWORD_MIN_LENGTH = 8;

export function getAuthRedirectUrl(location = globalThis.location) {
  const origin = String(location?.origin || "").trim();
  if (!/^https?:\/\/[^/]+$/i.test(origin)) {
    throw new Error("DayLo could not determine a safe sign-in return URL.");
  }
  return `${origin}/`;
}

export async function startGoogleOAuth(authClient, location = globalThis.location) {
  const result = await authClient.signInWithOAuth({
    provider: "google",
    options: { redirectTo: getAuthRedirectUrl(location) },
  });
  if (result.error) throw result.error;
  return result.data;
}

export async function requestPasswordReset(authClient, email, location = globalThis.location) {
  const result = await authClient.resetPasswordForEmail(String(email || "").trim(), {
    redirectTo: getAuthRedirectUrl(location),
  });
  if (result.error) throw result.error;
  return result.data;
}

export async function resendSignupConfirmation(authClient, email, location = globalThis.location) {
  const result = await authClient.resend({
    type: "signup",
    email: String(email || "").trim(),
    options: { emailRedirectTo: getAuthRedirectUrl(location) },
  });
  if (result.error) throw result.error;
  return result.data;
}

export function getPasswordStrength(password = "") {
  const value = String(password || "");
  if (value.length < AUTH_PASSWORD_MIN_LENGTH) return { level: 0, label: "Too short", valid: false };
  let score = value.length >= 12 ? 1 : 0;
  score += [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(value)).length;
  if (/(.)\1{3,}/.test(value)) score -= 1;
  if (score >= 4) return { level: 3, label: "Strong", valid: true };
  if (score >= 2) return { level: 2, label: "Good", valid: true };
  return { level: 1, label: "Weak", valid: true };
}

export function validateNewPassword(password = "", confirmPassword = "") {
  const normalizedPassword = String(password || "");
  if (normalizedPassword.length < AUTH_PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `Use at least ${AUTH_PASSWORD_MIN_LENGTH} characters for your password.` };
  }
  if (normalizedPassword !== String(confirmPassword || "")) {
    return { ok: false, message: "Passwords don't match." };
  }
  return { ok: true, password: normalizedPassword };
}

export function hasPasswordIdentity(user) {
  const providers = new Set([
    ...(Array.isArray(user?.identities) ? user.identities.map((identity) => identity?.provider) : []),
    ...(Array.isArray(user?.app_metadata?.providers) ? user.app_metadata.providers : []),
  ]);
  return providers.has("email");
}

export function isEmailNotConfirmedError(error) {
  const detail = `${error?.code || ""} ${error?.message || error || ""}`.toLowerCase();
  return detail.includes("email_not_confirmed") || detail.includes("email not confirmed");
}

export function getRecoveryReturnError(location = globalThis.location) {
  const search = new URLSearchParams(String(location?.search || ""));
  const hash = new URLSearchParams(String(location?.hash || "").replace(/^#/, ""));
  const detail = ["error", "error_code", "error_description"]
    .map((key) => search.get(key) || hash.get(key) || "")
    .join(" ")
    .toLowerCase();
  if (!detail || (!detail.includes("expired") && !detail.includes("invalid") && !detail.includes("otp"))) return "";
  return "This reset link has expired.";
}

export function getOAuthReturnError(location = globalThis.location) {
  const search = new URLSearchParams(String(location?.search || ""));
  const hash = new URLSearchParams(String(location?.hash || "").replace(/^#/, ""));
  const error = search.get("error") || hash.get("error");
  const description = search.get("error_description") || hash.get("error_description") || "";
  if (!error && !description) return "";
  const detail = `${error || ""} ${description}`.toLowerCase();
  return detail.includes("access_denied") || detail.includes("cancel")
    ? "Google sign-in was cancelled."
    : "We couldn't sign you in with Google. Try again.";
}

export function clearOAuthReturnError(location = globalThis.location, history = globalThis.history) {
  const url = new URL(location.href);
  ["error", "error_code", "error_description"].forEach((key) => url.searchParams.delete(key));
  if (/error(?:_description|_code)?=/.test(url.hash)) url.hash = "";
  history?.replaceState?.({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function validateEmailPassword({ email = "", password = "", confirmPassword = null, enforcePasswordMinimum = true } = {}) {
  const normalizedEmail = String(email || "").trim();
  const normalizedPassword = String(password || "");

  if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  if (!normalizedPassword || (enforcePasswordMinimum && normalizedPassword.length < AUTH_PASSWORD_MIN_LENGTH)) {
    return { ok: false, message: `Use at least ${AUTH_PASSWORD_MIN_LENGTH} characters for your password.` };
  }

  if (confirmPassword !== null && normalizedPassword !== String(confirmPassword || "")) {
    return { ok: false, message: "Passwords don't match." };
  }

  return { ok: true, email: normalizedEmail, password: normalizedPassword };
}

export function getFriendlyAuthError(error, { provider = "password" } = {}) {
  const message = String(error?.message || error || "").toLowerCase();

  if (provider === "google") {
    if (message.includes("cancel") || message.includes("access_denied")) {
      return "Google sign-in was cancelled.";
    }
    if (message.includes("network") || message.includes("failed to fetch")) {
      return "DayLo could not connect. Check your internet and try again.";
    }
    return "We couldn't sign you in with Google. Try again.";
  }
  if (!message) return "Something went wrong. Try again.";
  if (message.includes("invalid login") || message.includes("invalid credentials")) {
    return "That email or password is not right.";
  }
  if (message.includes("email not confirmed") || message.includes("not confirmed")) {
    return "Confirm your email first. Check your inbox for the DayLo confirmation email.";
  }
  if (message.includes("already registered") || message.includes("already exists")) {
    return "An account already exists for that email. Try signing in.";
  }
  if (message.includes("network") || message.includes("failed to fetch")) {
    return "DayLo could not connect. Check your internet and try again.";
  }
  if (message.includes("rate") || message.includes("too many") || error?.status === 429) {
    return "Too many attempts. Wait a moment, then try again.";
  }
  if (message.includes("expired") || message.includes("invalid token") || message.includes("otp_expired")) {
    return "This reset link has expired. Send a new reset link.";
  }
  if (message.includes("password")) {
    return "That password does not meet the account requirements.";
  }

  return "Something went wrong. Try again.";
}

export function shouldShowAuthenticatedApp({ loading = false, user = null } = {}) {
  return Boolean(!loading && user);
}

export function getAuthGateState({ loading = false, user = null } = {}) {
  if (loading) return "loading";
  return user ? "authenticated" : "unauthenticated";
}
