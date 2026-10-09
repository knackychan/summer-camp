// Supabase Edge Function `games-guide` (docs/plans/2026-10-08-games-gate-ai-guide/ slice 05).
// The only code that talks to OpenAI. The key comes from the project's secrets
// (`supabase secrets set OPENAI_API_KEY=...`); the database key is the one Supabase
// injects into every hosted function. Neither is ever written to this repo.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { handle } from "./guide.mjs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
type Key = { kid_id: string; day: string; slot: string; reroll: number };

async function get(key: Key) {
  const { data, error } = await db.from("guide_decisions").select("*")
    .eq("kid_id", key.kid_id).eq("day", key.day).eq("slot", key.slot).eq("reroll", key.reroll).maybeSingle();
  if (error) throw error;
  return data;
}
const deps = {
  fetch,
  apiKey: Deno.env.get("OPENAI_API_KEY") || "",
  db: {
    get,
    async insert(row: Key & Record<string, unknown>) {
      const { error } = await db.from("guide_decisions").upsert(row, { onConflict: "kid_id,day,slot,reroll", ignoreDuplicates: true });
      if (error) throw error;
      return get(row);
    },
    async settings() {
      const { data, error } = await db.from("family_settings").select("value").eq("key", "games_gate_v1").maybeSingle();
      if (error) throw error;
      return data ? data.value : null;
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let result;
  try {
    if (req.method !== "POST") result = { status: 405, body: { fallback: true, reason: "method" } };
    else result = await handle(await req.json().catch(() => null), deps);
  } catch (error) {
    console.error("games-guide", error instanceof Error ? error.message : error);
    result = { status: 200, body: { fallback: true, reason: "server" } };
  }
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { ...CORS, "content-type": "application/json" },
  });
});
