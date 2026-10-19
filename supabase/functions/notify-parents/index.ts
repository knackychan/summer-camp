// Supabase Edge Function `notify-parents` (docs/plans/2026-10-19-parent-app/ D4).
// Sends Web Push to the parents' devices. The VAPID private key and the webhook
// secret come from the project's secrets; the database key is the one Supabase
// injects into hosted functions. None of them is ever written to this repo.
// Deploy with --no-verify-jwt: the database calls it with the webhook secret,
// and a parent's "Send a test" is checked here against public.admins.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { handle } from "./notify.mjs";
import { sendPush } from "./webpush.mjs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const vapid = {
  publicKey: Deno.env.get("VAPID_PUBLIC_KEY") || "",
  privateKey: Deno.env.get("VAPID_PRIVATE_KEY") || "",
  subject: Deno.env.get("VAPID_SUBJECT") || "mailto:parents@summer-quest.invalid",
};
async function one(table: string, id: string) {
  const { data, error } = await db.from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
const deps = {
  secret: Deno.env.get("PUSH_WEBHOOK_SECRET") || "",
  now: () => new Date(),
  send: (sub: Record<string, string>, payload: string) => sendPush(fetch, sub, payload, vapid, Math.floor(Date.now() / 1000)),
  db: {
    claim: (id: string) => one("points_claims", id),
    request: (id: string) => one("points_requests", id),
    ask: (id: string) => one("asks", id),
    async kidName(id: string) {
      const { data } = await db.from("kids").select("name").eq("id", id).maybeSingle();
      return data ? data.name : null;
    },
    async subscriptions() {
      const { data, error } = await db.from("parent_push_subscriptions").select("*");
      if (error) throw error;
      const { data: admins } = await db.from("admins").select("user_id");
      const ok = new Set((admins || []).map((a: { user_id: string }) => a.user_id));
      return (data || []).filter((s: { user_id: string }) => ok.has(s.user_id));
    },
    async pendingCount() {
      const a = await db.from("points_claims").select("id", { count: "exact", head: true }).eq("status", "pending");
      const b = await db.from("points_requests").select("id", { count: "exact", head: true }).eq("status", "requested");
      const c = await db.from("asks").select("id", { count: "exact", head: true }).is("answered_at", null)
        .not("kind", "like", "reward:%").gte("created_at", new Date(Date.now() - 12 * 3600 * 1000).toISOString());
      return (a.count || 0) + (b.count || 0) + (c.count || 0);
    },
    async isParent(userId: string) {
      const { data } = await db.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
      return !!data;
    },
    async markOk(id: string) { await db.from("parent_push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", id); },
    async drop(id: string) { await db.from("parent_push_subscriptions").delete().eq("id", id); },
    async markDigest(id: string, day: string) { await db.from("parent_push_subscriptions").update({ last_digest_day: day }).eq("id", id); },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let result;
  try {
    if (req.method !== "POST") result = { status: 405, body: { error: "method" } };
    else {
      let user = null;
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      if (token) {
        const { data } = await db.auth.getUser(token);
        user = data && data.user ? data.user.id : null;
      }
      result = await handle({ secret: req.headers.get("x-push-secret") || "", user, body: await req.json().catch(() => null) }, deps);
    }
  } catch (error) {
    console.error("notify-parents", error instanceof Error ? error.message : error);
    result = { status: 500, body: { error: "server" } };
  }
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { ...CORS, "content-type": "application/json" },
  });
});
