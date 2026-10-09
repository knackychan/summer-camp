// kid-chat logic (docs/plans/2026-10-09-summer-chat-crash-test/). Plain JavaScript,
// no Deno APIs, so scripts/kid-chat-fn.test.mjs runs it in Node; index.ts wires it
// to HTTP, the database and the OpenAI key. No caps by Papa's choice (design D2).
export const MODEL = "gpt-6-luna";
export const ENDPOINT = "https://api.openai.com/v1/responses";
export const MODERATION = "https://api.openai.com/v1/moderations";
export const TIMEOUT_MS = 20000;
export const PRICE = { input: 0.10 / 1e6, output: 0.50 / 1e6 };   // USD per token, gpt-6-luna standard
export const MAX_MESSAGES = 20, MAX_CHARS = 1000;
const AGE_BAND = { lucien: "4 years old (cannot read yet; an adult may read aloud)", lili: "7 years old", luis: "9 years old" };

export const INSTRUCTIONS = [
  "You are Summer, a warm, playful sun-shaped helper in a family summer app, chatting with one child in Taiwan.",
  "Answer in short, simple sentences that fit the child's age. Be kind, curious and encouraging; you can play pretend, tell gentle stories, answer questions and help with learning.",
  "Always give the same reply twice: `en` in English and `zh` in Traditional Chinese as used in Taiwan (for example 公車, 起司, 腳踏車).",
  "Never include violence, scary, sexual, hateful or adult content, and never give dangerous instructions.",
  "Never ask for or repeat personal details (full name, address, school, phone number, passwords, photos). Never suggest meeting anyone or keeping secrets from parents.",
  "If the child talks about feeling sad, scared, hurt or unsafe, or about health or safety, answer kindly and suggest telling Papa or another trusted grown-up.",
  "Do not help get around the app's locks or the family's rules. Never shame the child. If asked, say honestly that you are an AI helper, not a person.",
].join(" ");
export const SAFE_REPLY = { en: "That sounds like something to talk about with Papa. Do you want to tell him?", zh: "這個可以跟爸爸聊聊，要不要告訴他？" };
export const RESTING = { en: "Summer is resting right now. Ask Papa!", zh: "Summer 現在在休息，問問爸爸吧！" };
export const RETRY = { en: "Hmm, my sunshine flickered. Can you say that again?", zh: "嗯，我的陽光閃了一下，可以再說一次嗎？" };

export function schema() {
  return { type: "object", additionalProperties: false, required: ["en", "zh"],
    properties: { en: { type: "string", maxLength: 600 }, zh: { type: "string", maxLength: 300 } } };
}
const clean = (s) => String(s == null ? "" : s).replace(/[<>\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();

/* {kid, session, messages:[{role:"kid"|"summer", text}]} — the last message is the kid's */
export function validate(body) {
  if (!body || typeof body !== "object") return "body";
  if (!Object.hasOwn(AGE_BAND, body.kid)) return "kid";
  if (typeof body.session !== "string" || !/^[A-Za-z0-9_-]{6,64}$/.test(body.session)) return "session";
  const m = body.messages;
  if (!Array.isArray(m) || !m.length || m.length > MAX_MESSAGES) return "messages";
  if (!m.every((x) => x && (x.role === "kid" || x.role === "summer") && typeof x.text === "string" && x.text.length <= MAX_CHARS)) return "messages";
  if (m[m.length - 1].role !== "kid" || !clean(m[m.length - 1].text)) return "messages";
  return null;
}
export function parseSwitch(value) {
  let v = value;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { v = null; } }
  return !(v && v.enabled === false);
}
export function request(body) {
  return {
    model: MODEL, reasoning: { effort: "low" }, max_output_tokens: 900,
    instructions: INSTRUCTIONS + " The child is " + AGE_BAND[body.kid] + ".",
    input: body.messages.map((x) => ({ role: x.role === "kid" ? "user" : "assistant", content: clean(x.text) })),
    text: { format: { type: "json_schema", name: "summer_reply", strict: true, schema: schema() } },
  };
}
export function readReply(raw) {
  if (!raw || raw.status === "incomplete") return null;
  let text = typeof raw.output_text === "string" ? raw.output_text : null;
  for (const item of Array.isArray(raw.output) ? raw.output : []) {
    for (const part of item && Array.isArray(item.content) ? item.content : []) {
      if (part && part.type === "refusal") return null;
      if (text == null && part && typeof part.text === "string") text = part.text;
    }
  }
  try {
    const v = JSON.parse(text);
    const en = clean(v.en), zh = clean(v.zh);
    return en && zh && /[㐀-鿿]/.test(zh) ? { en, zh } : null;
  } catch { return null; }
}
async function flagged(deps, text) {
  const res = await deps.fetch(MODERATION, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${deps.apiKey}` },
    body: JSON.stringify({ model: "omni-moderation-latest", input: text }), signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("moderation " + res.status);
  const v = await res.json();
  return !!(v && Array.isArray(v.results) && v.results.some((r) => r && r.flagged));
}
/* a transcript that can't be saved never hides the reply (it is logged instead) */
async function save(deps, row) {
  try { await deps.db.save(row); } catch (error) { console.error("kid-chat save", error && error.message); }
}
const tokens = (n) => (Number.isFinite(Number(n)) ? Math.max(0, Math.round(Number(n))) : 0);

/* deps: {fetch, apiKey, db:{settings(), save(row)}} → {status, body:{en, zh, flagged?, fallback?}} */
export async function handle(body, deps) {
  const bad = validate(body);
  if (bad) return { status: 400, body: { ...RETRY, fallback: true, reason: "invalid " + bad } };
  if (!parseSwitch(await deps.db.settings())) return { status: 200, body: { ...RESTING, fallback: true, reason: "off" } };
  if (!deps.apiKey) return { status: 200, body: { ...RETRY, fallback: true, reason: "no key" } };
  const kidText = clean(body.messages[body.messages.length - 1].text);
  const row = { kid_id: body.kid, session_id: body.session, kid_text: kidText, flagged: false, model: null, input_tokens: null, output_tokens: null, cost_usd: null };
  try {
    if (await flagged(deps, kidText)) {
      await save(deps, { ...row, reply_en: SAFE_REPLY.en, reply_zh: SAFE_REPLY.zh, flagged: true });
      return { status: 200, body: { ...SAFE_REPLY, flagged: true } };
    }
    const res = await deps.fetch(ENDPOINT, {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${deps.apiKey}` },
      body: JSON.stringify(request(body)), signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { status: 200, body: { ...RETRY, fallback: true, reason: "http " + res.status } };
    const raw = await res.json();
    let reply = readReply(raw);
    if (!reply) return { status: 200, body: { ...RETRY, fallback: true, reason: "output" } };
    const usage = raw.usage || {}, input = tokens(usage.input_tokens), output = tokens(usage.output_tokens);
    const replyFlagged = await flagged(deps, reply.en + "\n" + reply.zh);
    if (replyFlagged) reply = SAFE_REPLY;
    await save(deps, { ...row, reply_en: reply.en, reply_zh: reply.zh, flagged: replyFlagged, model: MODEL,
      input_tokens: input, output_tokens: output, cost_usd: Number((input * PRICE.input + output * PRICE.output).toFixed(6)) });
    return { status: 200, body: { ...reply, flagged: replyFlagged } };
  } catch (error) {
    return { status: 200, body: { ...RETRY, fallback: true, reason: error && (error.name === "TimeoutError" || error.name === "AbortError") ? "timeout" : "server" } };
  }
}
