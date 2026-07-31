import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import DayLoSplash from "./components/DayLoSplash.jsx";
import { dayloSplashSession } from "./utils/dayloSplashSession.js";
import { inject } from '@vercel/analytics';

inject();

const showOpeningSplash = dayloSplashSession.shouldShow();

function DayLoRoot() {
  const [splashVisible, setSplashVisible] = useState(showOpeningSplash);

  return (
    <>
      <div
        className="daylo-app-startup-layer"
        inert={splashVisible ? true : undefined}
        aria-hidden={splashVisible ? "true" : undefined}
      >
        <App />
      </div>
      {splashVisible && (
        <DayLoSplash onComplete={() => setSplashVisible(false)} />
      )}
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <DayLoRoot />
  </StrictMode>,
);
