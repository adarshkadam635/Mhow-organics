const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before starting the server. See .env.example."
    );
  }
  // Local development without Supabase: use a JSON-file database (see lib/localDb.js).
  console.warn("[dev] SUPABASE_SERVICE_ROLE_KEY is not set - using the local file database in ./data. Data will NOT reach Supabase.");
  module.exports = require("./localDb");
} else {
  module.exports = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
