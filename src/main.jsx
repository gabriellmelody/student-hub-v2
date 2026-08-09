import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import AuthScreen, { AuthLoadingScreen } from "./components/AuthScreen.jsx";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import DayLoSplash from "./components/DayLoSplash.jsx";
import { dayloSplashSession } from "./utils/dayloSplashSession.js";

const showOpeningSplash = dayloSplashSession.shouldShow();

function AuthGate() {
  const auth = useAuth();

  if (auth.loading) return <AuthLoadingScreen />;
  if (!auth.user) return <AuthScreen signIn={auth.signIn} signUp={auth.signUp} />;
  if (auth.profileLoading && !auth.profile) return <AuthLoadingScreen />;
  if (auth.profileError) {
    return (
      <main className="auth-page">
        <section className="auth-panel auth-error-panel">
          <h1>DayLo could not finish opening your account.</h1>
          <p>Try again in a moment.</p>
          <button type="button" className="primary-button" onClick={auth.retryProfile}>
            Try again
          </button>
          <button type="button" className="small-button" onClick={auth.signOut}>
            Sign out
          </button>
        </section>
      </main>
    );
  }

  return <App />;
}

function DayLoRoot() {
  const [splashVisible, setSplashVisible] = useState(showOpeningSplash);

  return (
    <>
      <div
        className="daylo-app-startup-layer"
        inert={splashVisible ? true : undefined}
        aria-hidden={splashVisible ? "true" : undefined}
      >
        <AuthGate />
      </div>
      {splashVisible && (
        <DayLoSplash onComplete={() => setSplashVisible(false)} />
      )}
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <DayLoRoot />
    </AuthProvider>
  </StrictMode>,
);
