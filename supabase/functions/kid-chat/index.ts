// Supabase Edge Function `kid-chat` (docs/plans/2026-10-09-summer-chat-crash-test/).
// Free chat with Summer for the kids. The OpenAI key comes from the project's
// secrets; the database key is the one Supabase injects into hosted functions.
// Neither is ever written to this repo.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { handle } from "./chat.mjs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const deps = {
  fetch,
  apiKey: Deno.env.get("OPENAI_API_KEY") || "",
  db: {
    async settings() {
      const { data, error } = await db.from("family_settings").select("value").eq("key", "kid_chat_v1").maybeSingle();
      if (error) throw error;
      return data ? data.value : null;
    },
    async save(row: Record<string, unknown>) {
      const { error } = await db.from("kid_chats").insert(row);
      if (error) throw error;
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
    console.error("kid-chat", error instanceof Error ? error.message : error);
    result = { status: 200, body: { en: "Hmm, my sunshine flickered. Can you say that again?", zh: "嗯，我的陽光閃了一下，可以再說一次嗎？", fallback: true, reason: "server" } };
  }
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { ...CORS, "content-type": "application/json" },
  });
});
