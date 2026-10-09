// games-guide logic (docs/plans/2026-10-08-games-gate-ai-guide/ slice 05, design D8/D9).
// Plain JavaScript with no Deno APIs, so scripts/games-guide-fn.test.mjs runs it in Node.
// index.ts wires it to HTTP, the database and the OpenAI key.
//
// Spend caps (design D10) were removed by Papa on 2026-10-09. What still bounds
// the calls: one decision per kid / Taipei day / slot / reroll, the day and slot
// must be now, and reroll ≤ games_gate_v1.rerollsPerSlot.
import { ITEMS, SLOTS } from "./items.mjs";

export const MODEL = "gpt-6-luna";
export const ENDPOINT = "https://api.openai.com/v1/responses";
export const TIMEOUT_MS = 6000;                       // under the tablet's 6.5 s
export const PRICE = { input: 0.10 / 1e6, output: 0.50 / 1e6 };   // USD per token, gpt-6-luna standard
const AGE_BAND = { lucien: "preschool (4)", lili: "early primary (7)", luis: "primary (9)" };
const TIMES = { little: "about 5 minutes", some: "about 15 minutes", lots: "30 minutes or more" };
const IDS = ITEMS.map((i) => i.id);

export const INSTRUCTIONS = [
  "You are a warm guide in a family helping game for children in Taiwan.",
  "Choose exactly 3 of the candidate home-help activities that best fit the time of day, the time the child has, and the points still needed.",
  "For each, write one short, kind, encouraging line in English (max 90 characters) and in Traditional Chinese as used in Taiwan (max 45 characters), suited to the child's age band.",
  "Never shame, never mention lateness or what was not done, never compare children. No other content.",
].join(" ");

export function taipei(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}
export function slotAt(minutes) {
  let id = SLOTS[0][0];
  for (const [slot, from] of SLOTS) if (minutes >= from) id = slot;
  return id;
}
export function parseSettings(value) {
  let v = value;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { v = null; } }
  const ai = v && typeof v.ai === "object" && v.ai ? v.ai : {};
  const rerolls = Number(v && v.rerollsPerSlot);
  return { aiEnabled: ai.enabled === true, rerollsPerSlot: Number.isFinite(rerolls) ? Math.max(0, Math.min(10, Math.round(rerolls))) : 3 };
}

/* Request: {kid, day, slot, reroll, answers:{done, time}, candidates:[3..6 ids], need, points?:{id: n}} */
export function validate(body, now) {
  if (!body || typeof body !== "object") return "body";
  const { kid, day, slot, reroll, answers, candidates, need, points } = body;
  if (!Object.hasOwn(AGE_BAND, kid)) return "kid";
  const t = taipei(now);
  if (day !== t.day) return "day";
  // 10 minutes' grace either side of a slot boundary for a tablet clock that is slightly off
  if (![t.minutes - 10, t.minutes, t.minutes + 10].some((m) => slotAt(Math.max(0, Math.min(1439, m))) === slot)) return "slot";
  if (!Number.isInteger(reroll) || reroll < 0) return "reroll";
  if (!answers || typeof answers !== "object" || !Object.hasOwn(TIMES, answers.time)) return "answers";
  if (!Array.isArray(answers.done) || !answers.done.every((id) => IDS.includes(id))) return "answers";
  if (!Array.isArray(candidates) || candidates.length < 3 || candidates.length > 6) return "candidates";
  if (new Set(candidates).size !== candidates.length || !candidates.every((id) => IDS.includes(id))) return "candidates";
  if (!Number.isFinite(need) || need < 0 || need > 300) return "need";
  if (points != null && (typeof points !== "object" || !Object.values(points).every((n) => Number.isFinite(n) && n >= 0 && n <= 100))) return "points";
  return null;
}

export function schema(candidates) {
  return {
    type: "object", additionalProperties: false, required: ["picks"],
    properties: {
      picks: {
        type: "array", minItems: 3, maxItems: 3,
        items: {
          type: "object", additionalProperties: false, required: ["id", "en", "zh"],
          properties: { id: { type: "string", enum: candidates }, en: { type: "string", maxLength: 90 }, zh: { type: "string", maxLength: 45 } },
        },
      },
    },
  };
}

/* The model sees an age band, the time, the answers and the candidates. No names, no history, no free text. */
export function request(body, now) {
  const t = taipei(now);
  const context = {
    ageBand: AGE_BAND[body.kid], slot: body.slot,
    timeNow: `${String(Math.floor(t.minutes / 60)).padStart(2, "0")}:${String(t.minutes % 60).padStart(2, "0")}`,
    timeAvailable: TIMES[body.answers.time], pointsStillNeeded: body.need,
    candidates: body.candidates.map((id) => {
      const item = ITEMS.find((i) => i.id === id);
      return { id, label: item.label[0], minutes: item.minutes, points: body.points && Number.isFinite(body.points[id]) ? body.points[id] : null };
    }),
  };
  return {
    model: MODEL, reasoning: { effort: "low" }, instructions: INSTRUCTIONS, input: JSON.stringify(context), max_output_tokens: 700,
    text: { format: { type: "json_schema", name: "games_guide_picks", strict: true, schema: schema(body.candidates) } },
  };
}

function outputText(raw) {
  if (typeof raw.output_text === "string") return raw.output_text;
  for (const item of Array.isArray(raw.output) ? raw.output : []) {
    for (const part of item && Array.isArray(item.content) ? item.content : []) {
      if (part && part.type === "refusal") return null;
      if (part && typeof part.text === "string") return part.text;
    }
  }
  return null;
}
const clean = (s) => String(s == null ? "" : s).replace(/[<>\u0000-\u001f\u007f]/g, "").trim();

/* Exactly 3 distinct candidate ids, each with a non-empty English line ≤ 90 and a 中文 line ≤ 45; else null. */
export function readPicks(raw, candidates) {
  if (!raw || raw.status === "incomplete") return null;
  for (const item of Array.isArray(raw.output) ? raw.output : []) {
    if (item && Array.isArray(item.content) && item.content.some((p) => p && p.type === "refusal")) return null;
  }
  const text = outputText(raw);
  if (text == null) return null;
  let parsed;
  try { parsed = JSON.parse(text); } catch { return null; }
  const picks = parsed && Array.isArray(parsed.picks) ? parsed.picks : null;
  if (!picks || picks.length !== 3) return null;
  const out = picks.map((p) => ({ id: p && p.id, line: [clean(p && p.en), clean(p && p.zh)] }));
  if (new Set(out.map((p) => p.id)).size !== 3 || !out.every((p) => candidates.includes(p.id))) return null;
  if (!out.every((p) => p.line[0] && p.line[0].length <= 90 && p.line[1] && p.line[1].length <= 45 && /[㐀-鿿]/.test(p.line[1]))) return null;
  return out;
}

const fallback = (reason) => ({ status: 200, body: { fallback: true, reason } });
const tokens = (n) => (Number.isFinite(Number(n)) ? Math.max(0, Math.round(Number(n))) : 0);

/* deps: {fetch, apiKey, now?, db:{get(key), insert(row), settings()}} → {status, body} */
export async function handle(body, deps) {
  const now = deps.now ? deps.now() : new Date();
  const bad = validate(body, now);
  if (bad) return { status: 400, body: { fallback: true, reason: "invalid " + bad } };
  const key = { kid_id: body.kid, day: body.day, slot: body.slot, reroll: body.reroll };
  const saved = await deps.db.get(key);
  if (saved) return { status: 200, body: { ...saved, cached: true } };
  const settings = parseSettings(await deps.db.settings());
  if (!settings.aiEnabled) return fallback("off");
  if (body.reroll > settings.rerollsPerSlot) return fallback("rerolls");
  if (!deps.apiKey) return fallback("no key");
  let raw;
  try {
    const res = await deps.fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${deps.apiKey}` },
      body: JSON.stringify(request(body, now)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return fallback("http " + res.status);
    raw = await res.json();
  } catch (error) {
    return fallback(error && (error.name === "TimeoutError" || error.name === "AbortError") ? "timeout" : "network");
  }
  const picks = readPicks(raw, body.candidates);
  if (!picks) return fallback("output");
  const usage = raw.usage || {};
  const input = tokens(usage.input_tokens), output = tokens(usage.output_tokens);
  const row = {
    ...key, answers: { done: body.answers.done, time: body.answers.time }, picks, source: "ai", model: MODEL,
    input_tokens: input, output_tokens: output, cost_usd: Number((input * PRICE.input + output * PRICE.output).toFixed(6)), started_id: null,
  };
  // two racing requests for one key: the first row stored wins and both get it
  const stored = await deps.db.insert(row);
  return { status: 200, body: stored || row };
}
