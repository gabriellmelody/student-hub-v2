import { createClient } from "@supabase/supabase-js";

function requireSupabaseEnv(name, value) {
  if (typeof value === "string" && value.trim()) return value;

  throw new Error(`Missing required Supabase environment variable: ${name}`);
}

const supabaseUrl = requireSupabaseEnv(
  "VITE_SUPABASE_URL",
  import.meta.env.VITE_SUPABASE_URL
);
const supabasePublishableKey = requireSupabaseEnv(
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
