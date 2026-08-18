export const AUTH_PASSWORD_MIN_LENGTH = 6;

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
