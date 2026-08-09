export const AUTH_PASSWORD_MIN_LENGTH = 6;

export function validateEmailPassword({ email = "", password = "", confirmPassword = null } = {}) {
  const normalizedEmail = String(email || "").trim();
  const normalizedPassword = String(password || "");

  if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  if (normalizedPassword.length < AUTH_PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `Use at least ${AUTH_PASSWORD_MIN_LENGTH} characters for your password.` };
  }

  if (confirmPassword !== null && normalizedPassword !== String(confirmPassword || "")) {
    return { ok: false, message: "Passwords do not match." };
  }

  return { ok: true, email: normalizedEmail, password: normalizedPassword };
}

export function getFriendlyAuthError(error) {
  const message = String(error?.message || error || "").toLowerCase();

  if (!message) return "Something went wrong. Try again.";
  if (message.includes("invalid login") || message.includes("invalid credentials")) {
    return "That email or password is not right.";
  }
  if (message.includes("email not confirmed") || message.includes("not confirmed")) {
    return "Check your email to confirm your DayLo account first.";
  }
  if (message.includes("already registered") || message.includes("already exists")) {
    return "An account already exists for that email. Try signing in.";
  }
  if (message.includes("network") || message.includes("failed to fetch")) {
    return "DayLo could not connect. Check your internet and try again.";
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
