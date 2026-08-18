import assert from "node:assert/strict";
import test from "node:test";
import {
  getAuthGateState,
  getFriendlyAuthError,
  getAuthRedirectUrl,
  getPasswordStrength,
  hasPasswordIdentity,
  getOAuthReturnError,
  startGoogleOAuth,
  shouldShowAuthenticatedApp,
  validateEmailPassword,
  validateNewPassword,
  requestPasswordReset,
  resendSignupConfirmation,
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
  assert.deepEqual(validateEmailPassword({ email: " student@example.com ", password: "12345678" }), {
    ok: true,
    email: "student@example.com",
    password: "12345678",
  });
});

test("password confirmation mismatch is rejected", () => {
  assert.deepEqual(
    validateEmailPassword({
      email: "student@example.com",
      password: "12345678",
      confirmPassword: "87654321",
    }),
    { ok: false, message: "Passwords don't match." }
  );
});

test("sign-in accepts an existing password without applying the new signup minimum", () => {
  assert.equal(validateEmailPassword({ email: "student@example.com", password: "legacy7", enforcePasswordMinimum: false }).ok, true);
});

test("sign-in errors use student-friendly copy", () => {
  assert.equal(
    getFriendlyAuthError({ message: "Invalid login credentials" }),
    "That email or password is not right."
  );
  assert.equal(
    getFriendlyAuthError({ message: "Email not confirmed" }),
    "Confirm your email first. Check your inbox for the DayLo confirmation email."
  );
});

test("password policy reports short, valid, and strong values", () => {
  assert.deepEqual(getPasswordStrength("1234567"), { level: 0, label: "Too short", valid: false });
  assert.equal(getPasswordStrength("abcdefgh").valid, true);
  assert.equal(getPasswordStrength("DayLo-Strong-2026!").label, "Strong");
  assert.equal(validateNewPassword("1234567", "1234567").ok, false);
  assert.deepEqual(validateNewPassword("12345678", "87654321"), { ok: false, message: "Passwords don't match." });
});

test("password identities include linked email accounts but exclude Google-only accounts", () => {
  assert.equal(hasPasswordIdentity({ identities: [{ provider: "google" }] }), false);
  assert.equal(hasPasswordIdentity({ identities: [{ provider: "email" }, { provider: "google" }] }), true);
});

test("password reset and verification resend use supported Supabase methods once", async () => {
  const resetCalls = [];
  const resendCalls = [];
  const auth = {
    async resetPasswordForEmail(...args) { resetCalls.push(args); return { data: {}, error: null }; },
    async resend(args) { resendCalls.push(args); return { data: {}, error: null }; },
  };
  const location = { origin: "https://daylo-student.vercel.app" };
  await requestPasswordReset(auth, " student@example.com ", location);
  await resendSignupConfirmation(auth, "student@example.com", location);
  assert.deepEqual(resetCalls, [["student@example.com", { redirectTo: "https://daylo-student.vercel.app/" }]]);
  assert.deepEqual(resendCalls, [{ type: "signup", email: "student@example.com", options: { emailRedirectTo: "https://daylo-student.vercel.app/" } }]);
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
