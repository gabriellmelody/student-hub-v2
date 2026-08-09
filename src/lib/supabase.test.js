import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));
const srcRoot = fileURLToPath(new URL("../", import.meta.url));
const supabaseSource = readFileSync(new URL("./supabase.js", import.meta.url), "utf8");

function readSourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) return readSourceFiles(path);
    if (path.endsWith(".test.js") || path.endsWith(".test.jsx")) return [];
    return path.endsWith(".js") || path.endsWith(".jsx") ? [path] : [];
  });
}

test("shared Supabase client is initialized from Vite environment variables", () => {
  assert.match(supabaseSource, /import \{ createClient \} from "@supabase\/supabase-js"/);
  assert.match(supabaseSource, /import\.meta\.env\.VITE_SUPABASE_URL/);
  assert.match(supabaseSource, /import\.meta\.env\.VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(supabaseSource, /export const supabase = createClient\(supabaseUrl, supabasePublishableKey\)/);
});

test("missing Supabase env errors name variables without logging values", () => {
  assert.match(supabaseSource, /Missing required Supabase environment variable: \$\{name\}/);
  assert.doesNotMatch(supabaseSource, /supabase\.co/);
  assert.doesNotMatch(supabaseSource, /service[_-]?role/i);
});

test("createClient is only called by the shared Supabase module", () => {
  const sourceFiles = readSourceFiles(srcRoot);
  const callers = sourceFiles.filter((file) => {
    const source = readFileSync(file, "utf8");
    return /createClient\s*\(/.test(source);
  });

  assert.deepEqual(
    callers.map((file) => relative(workspaceRoot, file)).sort(),
    ["src/lib/supabase.js"]
  );
});
