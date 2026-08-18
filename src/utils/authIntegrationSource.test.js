import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));
const srcRoot = fileURLToPath(new URL("../", import.meta.url));

function readSourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return readSourceFiles(path);
    if (path.endsWith(".test.js") || path.endsWith(".test.jsx")) return [];
    return path.endsWith(".js") || path.endsWith(".jsx") ? [path] : [];
  });
}

test("no service-role key or second Supabase client is introduced", () => {
  const files = readSourceFiles(srcRoot);
  const serviceRoleMentions = [];
  const createClientCallers = [];

  files.forEach((file) => {
    const source = readFileSync(file, "utf8");
    if (/service[_-]?role/i.test(source)) serviceRoleMentions.push(relative(workspaceRoot, file));
    if (/createClient\s*\(/.test(source)) createClientCallers.push(relative(workspaceRoot, file));
  });

  assert.deepEqual(serviceRoleMentions, []);
  assert.deepEqual(createClientCallers.sort(), ["src/lib/supabase.js"]);
});

test("auth UI enables Continue with Google without replacing password auth", () => {
  const source = readFileSync(new URL("../components/AuthScreen.jsx", import.meta.url), "utf8");
  assert.match(source, /Continue with Google/);
  assert.match(source, /onClick=\{handleGoogleSignIn\}/);
  assert.match(source, /<svg className="auth-google-mark"/);
  assert.match(source, /#4285F4/);
  assert.doesNotMatch(source, /auth-google-mark" aria-hidden="true">G</);
  assert.match(source, /className="auth-form"/);
  assert.doesNotMatch(source, /Coming next/);
});

test("Google account auth remains independent from Classroom and Calendar OAuth", () => {
  const auth = readFileSync(new URL("../hooks/useAuth.jsx", import.meta.url), "utf8");
  assert.match(auth, /startGoogleOAuth\(supabase\.auth\)/);
  assert.doesNotMatch(auth, /google-classroom|google-calendar|provider_token|provider_refresh_token/);
});

test("Google redirect initiation has synchronous repeated-click protection", () => {
  const source = readFileSync(new URL("../components/AuthScreen.jsx", import.meta.url), "utf8");
  assert.match(source, /googleSubmittingRef\.current/);
  assert.match(source, /if \(googleSubmittingRef\.current \|\| submitting\) return/);
});
