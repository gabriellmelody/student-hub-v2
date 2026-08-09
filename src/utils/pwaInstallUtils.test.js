import assert from "node:assert/strict";
import test from "node:test";
import {
  INSTALL_PROMOTION_DISMISSED_KEY,
  didBrowserPromptInstall,
  dismissInstallSuggestion,
  getInstallCapability,
  getOfflineMessage,
  isIosLikeDevice,
  isStandaloneDisplay,
  loadInstallSuggestionDismissed,
  shouldShowInstallSuggestion,
} from "./pwaInstallUtils.js";

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("standalone detection uses display-mode and iOS navigator standalone", () => {
  assert.equal(
    isStandaloneDisplay({ matchMedia: () => ({ matches: true }), navigator: {} }),
    true
  );
  assert.equal(
    isStandaloneDisplay({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } }),
    true
  );
  assert.equal(
    isStandaloneDisplay({ matchMedia: () => ({ matches: false }), navigator: {} }),
    false
  );
});

test("native install availability is exposed before unsupported state", () => {
  assert.equal(getInstallCapability({ nativePromptAvailable: true }), "native");
});

test("appinstalled or standalone state hides install actions", () => {
  assert.equal(getInstallCapability({ installed: true, nativePromptAvailable: true }), "installed");
  assert.equal(getInstallCapability({ standalone: true, iosLike: true }), "installed");
});

test("install promotion does not show when standalone", () => {
  assert.equal(
    shouldShowInstallSuggestion({
      capability: "installed",
      onboardingCompleted: true,
      standalone: true,
      elapsedMs: 60000,
    }),
    false
  );
});

test("iOS manual instruction state is available without native prompt", () => {
  assert.equal(isIosLikeDevice({ navigator: { platform: "iPhone" } }), true);
  assert.equal(
    isIosLikeDevice({ navigator: { platform: "MacIntel", maxTouchPoints: 5 } }),
    true
  );
  assert.equal(getInstallCapability({ iosLike: true }), "ios-instructions");
});

test("unsupported browser state does not offer a broken native install", () => {
  assert.equal(getInstallCapability({}), "unsupported");
});

test("dismissal persistence is browser-local and safe", () => {
  const local = storage();

  assert.equal(loadInstallSuggestionDismissed(local), false);
  assert.equal(dismissInstallSuggestion(local), true);
  assert.equal(local.getItem(INSTALL_PROMOTION_DISMISSED_KEY), "true");
  assert.equal(loadInstallSuggestionDismissed(local), true);
});

test("install suggestion waits for onboarding, tours, modals and a short delay", () => {
  assert.equal(
    shouldShowInstallSuggestion({
      capability: "native",
      onboardingCompleted: false,
      elapsedMs: 60000,
    }),
    false
  );
  assert.equal(
    shouldShowInstallSuggestion({
      capability: "native",
      onboardingCompleted: true,
      blockingUiOpen: true,
      elapsedMs: 60000,
    }),
    false
  );
  assert.equal(
    shouldShowInstallSuggestion({
      capability: "native",
      onboardingCompleted: true,
      elapsedMs: 1000,
    }),
    false
  );
  assert.equal(
    shouldShowInstallSuggestion({
      capability: "native",
      onboardingCompleted: true,
      elapsedMs: 60000,
    }),
    true
  );
});

test("offline state message is concise and non-blocking", () => {
  assert.equal(getOfflineMessage(false), "Offline — some Google features may be unavailable");
  assert.equal(getOfflineMessage(true), "");
});

test("browser prompt dismissal does not falsely mark installed", () => {
  assert.equal(didBrowserPromptInstall({ outcome: "dismissed" }), false);
  assert.equal(didBrowserPromptInstall({ outcome: "accepted" }), true);
});
