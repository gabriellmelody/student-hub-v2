import { useRef, useState } from "react";
import DayloMark from "./DayloMark.jsx";
import { getFriendlyAuthError, validateEmailPassword } from "../utils/authUtils.js";
import "../styles/auth.css";

function AuthLoadingScreen() {
  return (
    <main className="auth-page auth-page-loading" aria-busy="true">
      <DayloMark className="auth-logo" appearance="brand" />
      <p>Opening DayLo…</p>
    </main>
  );
}

function AuthScreen({ signIn, signUp }) {
  const authPageRef = useRef(null);
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const creating = mode === "signup";

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setError("");
    setMessage("");

    const validation = validateEmailPassword({
      email,
      password,
      confirmPassword: creating ? confirmPassword : null,
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
        setMessage("Check your email. We sent you a link to confirm your DayLo account.");
      }
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
            <h1 id="auth-title">Welcome to DayLo</h1>
          </div>
        </div>
        <p className="auth-intro">Keep your schoolwork and plans synced across your devices.</p>

        <button type="button" className="auth-google-button" disabled>
          <span>Continue with Google</span>
          <small>Coming next</small>
        </button>

        <div className="auth-divider"><span>or</span></div>

        <form className="auth-form" onSubmit={handleSubmit}>
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
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              autoComplete={creating ? "new-password" : "current-password"}
              required
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {creating && (
            <label>
              <span>Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                autoComplete="new-password"
                required
                minLength={6}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
          )}

          {error && <p className="auth-message auth-message-error" role="alert">{error}</p>}
          {message && <p className="auth-message auth-message-success" role="status">{message}</p>}

          <button type="submit" className="primary-button auth-submit" disabled={submitting}>
            {submitting ? "Working…" : creating ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          {creating ? "Already have an account?" : "Don’t have an account?"}{" "}
          <button
            type="button"
            onClick={() => switchMode(creating ? "signin" : "signup")}
          >
            {creating ? "Sign in" : "Create account"}
          </button>
        </p>
      </section>
    </main>
  );
}

export { AuthLoadingScreen };
export default AuthScreen;
