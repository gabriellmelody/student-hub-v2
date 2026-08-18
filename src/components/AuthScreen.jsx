import { useEffect, useRef, useState } from "react";
import DayloMark from "./DayloMark.jsx";
import PasswordStrength from "./PasswordStrength.jsx";
import {
  AUTH_PASSWORD_MIN_LENGTH,
  clearOAuthReturnError,
  getFriendlyAuthError,
  getOAuthReturnError,
  getRecoveryReturnError,
  isEmailNotConfirmedError,
  validateEmailPassword,
  validateNewPassword,
} from "../utils/authUtils.js";
import "../styles/auth.css";

function AuthLoadingScreen() {
  return (
    <main className="auth-page auth-page-loading" aria-busy="true">
      <DayloMark className="auth-logo" appearance="brand" />
      <p>Opening DayLo…</p>
    </main>
  );
}

function AuthScreen({ signIn, signUp, signInWithGoogle, sendPasswordReset, resendVerification }) {
  const authPageRef = useRef(null);
  const googleSubmittingRef = useRef(false);
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const creating = mode === "signup";
  const recovering = mode === "forgot";
  const checkingEmail = mode === "check-email";

  useEffect(() => {
    const oauthError = getRecoveryReturnError() || getOAuthReturnError();
    if (!oauthError) return;
    setError(oauthError);
    clearOAuthReturnError();
  }, []);

  async function handleGoogleSignIn() {
    if (googleSubmittingRef.current || submitting) return;
    googleSubmittingRef.current = true;
    setSubmitting(true);
    setGoogleSubmitting(true);
    setError("");
    setMessage("");
    try {
      await signInWithGoogle();
    } catch (authError) {
      googleSubmittingRef.current = false;
      setSubmitting(false);
      setGoogleSubmitting(false);
      setError(getFriendlyAuthError(authError, { provider: "google" }));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setError("");
    setMessage("");

    if (recovering) {
      const normalizedEmail = email.trim();
      if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
        setError("Enter a valid email address.");
        return;
      }
      setSubmitting(true);
      try {
        await sendPasswordReset(normalizedEmail);
        setMode("reset-sent");
      } catch (authError) {
        setError(getFriendlyAuthError(authError));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const validation = validateEmailPassword({
      email,
      password,
      confirmPassword: creating ? confirmPassword : null,
      enforcePasswordMinimum: creating,
    });

    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setSubmitting(true);

    try {
      const result = creating
        ? await signUp({ email: validation.email, password: validation.password })
        : await signIn({ email: validation.email, password: validation.password });

      if (creating && result?.user && !result?.session) {
        setMode("check-email");
      }
    } catch (authError) {
      setError(getFriendlyAuthError(authError));
      if (isEmailNotConfirmedError(authError)) setMode("unconfirmed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await resendVerification(email);
      setMessage("Confirmation email sent.");
    } catch (authError) {
      setError(getFriendlyAuthError(authError));
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  function canUsePointerGlow() {
    if (typeof window === "undefined") return false;

    return (
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function updatePointerGlow(event) {
    if (!canUsePointerGlow()) return;

    const surface = authPageRef.current;
    if (!surface) return;

    const rect = surface.getBoundingClientRect();
    surface.classList.add("is-pointer-glowing");
    surface.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
    surface.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
  }

  function clearPointerGlow() {
    const surface = authPageRef.current;
    if (!surface) return;

    surface.classList.remove("is-pointer-glowing");
  }

  return (
    <main
      className="auth-page auth-glow-surface"
      ref={authPageRef}
      onPointerMove={updatePointerGlow}
      onPointerEnter={updatePointerGlow}
      onPointerLeave={clearPointerGlow}
    >
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-brand">
          <DayloMark className="auth-logo" appearance="brand" />
          <div>
            <p className="eyebrow">DayLo account</p>
            <h1 id="auth-title">{recovering ? "Reset your password" : mode === "reset-sent" || checkingEmail || mode === "unconfirmed" ? "Check your email" : "Welcome to DayLo"}</h1>
          </div>
        </div>
        <p className="auth-intro">{recovering ? "Enter your email and we'll send you a reset link." : mode === "reset-sent" ? "If a DayLo account exists for that email, we've sent a password reset link." : checkingEmail ? `We sent a confirmation link to ${email}.` : mode === "unconfirmed" ? "Confirm your email first. Check your inbox for the DayLo confirmation email." : "Keep your schoolwork and plans synced across your devices."}</p>

        {!recovering && mode !== "reset-sent" && !checkingEmail && mode !== "unconfirmed" && <><button type="button" className="auth-google-button" onClick={handleGoogleSignIn} disabled={submitting}>
          <svg className="auth-google-mark" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.87h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.31 2.98-7.35Z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.42l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.06v2.59A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.4 13.9A6 6 0 0 1 6.08 12c0-.66.11-1.3.32-1.9V7.51H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.49L6.4 13.9Z" />
            <path fill="#EA4335" d="M12 5.97c1.47 0 2.79.51 3.82 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.94 5.51L6.4 10.1c.79-2.37 3-4.13 5.6-4.13Z" />
          </svg>
          <span>{googleSubmitting ? "Opening Google…" : "Continue with Google"}</span>
          <span className="auth-google-spacer" aria-hidden="true" />
        </button>

        <div className="auth-divider"><span>or</span></div></>}

        {(recovering || (!checkingEmail && mode !== "reset-sent" && mode !== "unconfirmed")) && <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              autoComplete={creating ? "email" : "username"}
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {!recovering && <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              autoComplete={creating ? "new-password" : "current-password"}
              required
              minLength={creating ? AUTH_PASSWORD_MIN_LENGTH : undefined}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>}
          {!creating && !recovering && <button type="button" className="auth-inline-action" onClick={() => switchMode("forgot")}>Forgot password?</button>}
          {creating && (
            <><PasswordStrength password={password} /><label>
              <span>Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                autoComplete="new-password"
                required
                minLength={AUTH_PASSWORD_MIN_LENGTH}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label></>
          )}

          {error && <p className="auth-message auth-message-error" role="alert">{error}</p>}
          {message && <p className="auth-message auth-message-success" role="status">{message}</p>}

          <button type="submit" className="primary-button auth-submit" disabled={submitting}>
            {submitting ? "Working…" : recovering ? "Send reset link" : creating ? "Create account" : "Sign in"}
          </button>
        </form>}

        {(checkingEmail || mode === "unconfirmed") && <button type="button" className="primary-button auth-submit" disabled={submitting} onClick={handleResend}>{submitting ? "Sending…" : "Resend email"}</button>}
        {(recovering || mode === "reset-sent" || checkingEmail || mode === "unconfirmed") && <button type="button" className="auth-secondary-action" onClick={() => switchMode("signin")}>Back to sign in</button>}

        {!recovering && mode !== "reset-sent" && !checkingEmail && mode !== "unconfirmed" && <p className="auth-switch">
          {creating ? "Already have an account?" : "Don’t have an account?"}{" "}
          <button
            type="button"
            onClick={() => switchMode(creating ? "signin" : "signup")}
          >
            {creating ? "Sign in" : "Create account"}
          </button>
        </p>}
      </section>
    </main>
  );
}

function PasswordRecoveryScreen({ completePasswordRecovery }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    const validation = validateNewPassword(password, confirmation);
    if (!validation.ok) return setError(validation.message);
    setSubmitting(true);
    setError("");
    try {
      await completePasswordRecovery(validation.password);
    } catch (authError) {
      setError(getFriendlyAuthError(authError));
      setSubmitting(false);
    }
  }

  return <main className="auth-page"><section className="auth-panel"><div className="auth-brand"><DayloMark className="auth-logo" appearance="brand" /><div><p className="eyebrow">DayLo account</p><h1>Choose a new password</h1></div></div><form className="auth-form" onSubmit={submit}><label><span>New password</span><input type="password" autoComplete="new-password" minLength={AUTH_PASSWORD_MIN_LENGTH} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><PasswordStrength password={password} /><label><span>Confirm new password</span><input type="password" autoComplete="new-password" minLength={AUTH_PASSWORD_MIN_LENGTH} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>{error && <p className="auth-message auth-message-error" role="alert">{error}</p>}<button className="primary-button auth-submit" disabled={submitting}>{submitting ? "Updating…" : "Update password"}</button></form></section></main>;
}

export { AuthLoadingScreen, PasswordRecoveryScreen };
export default AuthScreen;
