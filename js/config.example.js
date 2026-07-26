// Copy to js/config.js and fill in. js/config.js is gitignored.
window.SQ_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-KEY",   // anon/public key ONLY — never service_role
  FAMILY_TZ: "Asia/Taipei",
  NTFY_TOPIC: ""                        // optional: ntfy.sh topic for urgent pings (P1)
};
// If this file is missing at runtime, the app must run in local-only mode (no sync).
