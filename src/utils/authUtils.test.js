import assert from "node:assert/strict";
import test from "node:test";
import {
  getAuthGateState,
  getFriendlyAuthError,
  getAuthRedirectUrl,
  getOAuthReturnError,
  startGoogleOAuth,
  shouldShowAuthenticatedApp,
  validateEmailPassword,
} from "./authUtils.js";

test("unauthenticated state shows auth gate", () => {
  assert.equal(getAuthGateState({ loading: false, user: null }), "unauthenticated");
  assert.equal(shouldShowAuthenticatedApp({ loading: false, user: null }), false);
});

test("authenticated state permits app", () => {
  assert.equal(getAuthGateState({ loading: false, user: { id: "user-1" } }), "authenticated");
  assert.equal(shouldShowAuthenticatedApp({ loading: false, user: { id: "user-1" } }), true);
});

test("auth loading state avoids UI flash", () => {
  assert.equal(getAuthGateState({ loading: true, user: null }), "loading");
  assert.equal(shouldShowAuthenticatedApp({ loading: true, user: { id: "user-1" } }), false);
});

test("signup validation requires email and minimum password length", () => {
  assert.equal(validateEmailPassword({ email: "", password: "123456" }).ok, false);
  assert.equal(validateEmailPassword({ email: "student@example.com", password: "123" }).ok, false);
  assert.deepEqual(validateEmailPassword({ email: " student@example.com ", password: "123456" }), {
    ok: true,
    email: "student@example.com",
    password: "123456",
  });
});

test("password confirmation mismatch is rejected", () => {
  assert.deepEqual(
    validateEmailPassword({
      email: "student@example.com",
      password: "123456",
      confirmPassword: "654321",
    }),
    { ok: false, message: "Passwords do not match." }
  );
});

test("sign-in errors use student-friendly copy", () => {
  assert.equal(
    getFriendlyAuthError({ message: "Invalid login credentials" }),
    "That email or password is not right."
  );
  assert.equal(
    getFriendlyAuthError({ message: "Email not confirmed" }),
    "Check your email to confirm your DayLo account first."
  );
});

test("Google OAuth uses the current origin and invokes Supabase once", async () => {
  const calls = [];
  const auth = { async signInWithOAuth(options) { calls.push(options); return { data: { url: "https://accounts.google.com" }, error: null }; } };
  await startGoogleOAuth(auth, { origin: "http://localhost:5173" });
  assert.deepEqual(calls, [{ provider: "google", options: { redirectTo: "http://localhost:5173/" } }]);
  assert.equal(getAuthRedirectUrl({ origin: "https://daylo-student.vercel.app" }), "https://daylo-student.vercel.app/");
});

test("Google OAuth failures are concise and cancelled callbacks are recognized", async () => {
  await assert.rejects(
    startGoogleOAuth({ async signInWithOAuth() { return { data: null, error: new Error("provider disabled") }; } }, { origin: "https://daylo-student.vercel.app" })
  );
  assert.equal(getFriendlyAuthError(new Error("provider disabled"), { provider: "google" }), "We couldn't sign you in with Google. Try again.");
  assert.equal(getOAuthReturnError({ search: "?error=access_denied", hash: "" }), "Google sign-in was cancelled.");
});
