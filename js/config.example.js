// Copy to js/config.js and fill in. js/config.js is gitignored.
window.SQ_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-KEY",   // anon/public key ONLY — never service_role
  FAMILY_TZ: "Asia/Taipei",
  NTFY_TOPIC: "",                       // optional: ntfy.sh topic for urgent pings (P1)
  SUMMER_AGENT_ENDPOINT: "",            // optional protected backend endpoint, e.g. /api/summer-agent
  SUMMER_AGENT_HEALTH_ENDPOINT: "",     // optional health/status endpoint used by Operations → AI Lab
  SUMMER_LEARNING_TELEMETRY_ENDPOINT: "", // optional family-PC collector, e.g. /api/learning-telemetry
  SUMMER_AGENT_PROFILE: "openai-luna-cheap", // manual profile hint; protected server remains authoritative
  SUMMER_AGENT_TIMEOUT_MS: 6500          // no OpenAI/model secret belongs in this client
};
// If this file is missing at runtime, the app must run in local-only mode (no sync).
