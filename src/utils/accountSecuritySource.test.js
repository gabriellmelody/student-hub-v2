import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const authScreen = readFileSync(new URL("../components/AuthScreen.jsx", import.meta.url), "utf8");
const authHook = readFileSync(new URL("../hooks/useAuth.jsx", import.meta.url), "utf8");
const main = readFileSync(new URL("../main.jsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../pages/SettingsPage.jsx", import.meta.url), "utf8");

test("forgot-password UI is reachable and uses non-enumerating success copy", () => {
  assert.match(authScreen, /Forgot password\?/);
  assert.match(authScreen, /If a DayLo account exists for that email/);
  assert.match(authHook, /requestPasswordReset\(supabase\.auth, email\)/);
});

test("PASSWORD_RECOVERY takes priority over the authenticated app and clears after update", () => {
  assert.match(authHook, /event === "PASSWORD_RECOVERY"/);
  assert.match(authHook, /setRecoveryMode\(false\)/);
  assert.ok(main.indexOf("auth.recoveryMode") < main.indexOf("!auth.user"));
  assert.match(authHook, /updateUser\(\{ password \}\)/);
});

test("verification resend is protected and account password controls are identity-aware", () => {
  assert.match(authScreen, /if \(submitting\) return/);
  assert.match(authHook, /resendSignupConfirmation/);
  assert.match(settings, /hasPasswordIdentity\(user\)/);
  assert.match(authHook, /current_password/);
});
