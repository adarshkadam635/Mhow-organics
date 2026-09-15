/* =============================================================
   SUPABASE CONNECTION SETTINGS — EDIT THIS FILE
   -------------------------------------------------------------
   1. Create a free project at https://supabase.com
   2. Open  Project Settings → API  and copy the two values below:
        Project URL   ->  url
        anon public   ->  anonKey
   3. Paste them here and save. Nothing else needs to change.

   The anon key is a public, browser-safe key. Never paste the
   "service_role" key here — that one must stay on the server.

   PASSWORD RESET EMAILS
   ---------------------
   In the Supabase dashboard open
        Authentication → URL Configuration
   and add these to "Redirect URLs" so the emailed reset link is
   allowed to come back to this site:
        http://localhost:3000/store/reset-password.html
        https://YOUR-LIVE-DOMAIN/store/reset-password.html
   Set "Site URL" to your live domain as well.

   The reset email itself is sent by Supabase — no SMTP setup is
   needed to start, though Supabase's built-in mailer is rate
   limited, so add your own SMTP under
        Project Settings → Authentication → SMTP Settings
   before going live.
   ============================================================= */
window.SUPABASE_CONFIG = {
  url: "YOUR_SUPABASE_PROJECT_URL",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
  // Where the emailed password-reset link should land. Leave as is
  // to use this site's own reset page on whatever domain it runs on.
  resetRedirectPath: "/store/reset-password.html",
};
