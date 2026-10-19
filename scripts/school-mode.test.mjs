// School mode, after-school plan and home chores (docs/plans/2026-10-19-school-mode-chores/).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const School = require("../js/school-data.js");
const Gate = require("../js/games-gate-core.js");
const SQPoints = require("../js/points.js");

const zh = /[㐀-鿿]/;
const pair = (p, where) => {
  assert.ok(Array.isArray(p) && p.length === 2 && p[0] && p[1], where + " has EN + 中文");
  assert.match(p[1], zh, where + " 中文 is Chinese");
};

test("mode: holiday by default, school only Monday to Friday", () => {
  assert.equal(School.parseMode(undefined).mode, "holiday");
  assert.equal(School.parseMode("junk").mode, "holiday");
  assert.equal(School.parseMode(JSON.stringify({ mode: "school" })).mode, "school");
  const fs = { day_mode_v1: JSON.stringify({ mode: "school" }) };
  assert.equal(School.modeFor("2026-10-19", fs), "school"); // Monday
  assert.equal(School.modeFor("2026-10-23", fs), "school"); // Friday
  assert.equal(School.modeFor("2026-10-24", fs), "holiday"); // Saturday
  assert.equal(School.modeFor("2026-10-25", fs), "holiday"); // Sunday
  assert.equal(School.modeFor("2026-10-19", {}), "holiday");
});

test("after-school plan: ordered times, every line bilingual for every kid", () => {
  let last = -1;
  School.SCHEDULE.forEach((r, i) => {
    const m = School.mins(r.t);
    assert.ok(m > last, "row " + i + " is after the one before");
    last = m;
    pair(r.title, "row " + i);
    for (const kid of School.KIDS) pair(r.txt[kid], "row " + i + " " + kid);
  });
  assert.equal(School.currentRow(School.mins("15:00")), -1);
  assert.equal(School.currentRow(School.mins("16:25")), 1);
  assert.ok(School.SCHEDULE.some((r) => r.gate === "screen"), "screen time row says when it opens");
});

test("chores: Papa's list, real points kinds, bilingual, unique identities", () => {
  assert.equal(School.CHORES.length, 15);
  const ids = new Set(), identities = new Set();
  for (const c of School.CHORES) {
    assert.ok(SQPoints.rules[c.kind], c.id + " resolves to a points kind");
    assert.equal(SQPoints.rules[c.kind].category, "help");
    pair(c.label, c.id);
    pair(SQPoints.rules[c.kind].label, c.kind);
    assert.ok(!ids.has(c.id)); ids.add(c.id);
    const key = c.kind + ":" + (c.slot || "default");
    assert.ok(!identities.has(key), key + " pays once"); identities.add(key);
    assert.doesNotThrow(() => SQPoints.claim("lili", "2026-10-19", c.kind, { slot: c.slot }));
  }
  for (const k of ["rice_wash", "dishwasher_load", "dishwasher_unload", "desk_tidy", "bed_prepare", "floor_toys", "garden_toys", "garlic_peel", "bowls_tidy", "altar_water", "vacuum_floor", "laundry_in"])
    assert.equal(SQPoints.rules[k].parent, true, k + " is Papa-checked");
  for (const t of Object.keys(School.TEXT)) pair(School.TEXT[t], "TEXT." + t);
});

test("chore state: todo, waiting (queued/pending), confirmed, denied", () => {
  const day = "2026-10-19", rice = School.CHORES.find((c) => c.id === "rice"), table = School.CHORES.find((c) => c.id === "table");
  assert.equal(School.choreState("lili", day, rice, {}), "todo");
  assert.equal(School.choreState("lili", day, rice, { queue: [{ type: "pointClaim", claim: { kid_id: "lili", day, kind: "rice_wash", slot: "default" } }] }), "waiting");
  assert.equal(School.choreState("lili", day, rice, { claims: [{ kid_id: "lili", day, kind: "rice_wash", slot: "default", status: "pending" }] }), "waiting");
  assert.equal(School.choreState("lili", day, rice, { claims: [{ kid_id: "lili", day, kind: "rice_wash", slot: "default", status: "confirmed" }] }), "confirmed");
  assert.equal(School.choreState("lili", day, rice, { claims: [{ kid_id: "lili", day, kind: "rice_wash", slot: "default", status: "denied" }] }), "denied");
  assert.equal(School.choreState("luis", day, rice, { claims: [{ kid_id: "lili", day, kind: "rice_wash", slot: "default", status: "confirmed" }] }), "todo");
  assert.equal(School.choreState("lili", day, table, { claims: [{ kid_id: "lili", day, kind: "table_helper", slot: "lunch", status: "confirmed" }] }), "todo", "lunch table is not the dinner chore");
});

test("gate: school-day thresholds are separate and default to the holiday ones", () => {
  const d = Gate.parseSettings(undefined);
  assert.deepEqual(d.schoolThreshold, d.threshold);
  const s = { enabled: true, threshold: { luis: 50, lili: 50, lucien: 40 }, schoolThreshold: { luis: 35, lili: 33, lucien: 0 } };
  assert.deepEqual(Gate.parseSettings(s).schoolThreshold, { luis: 35, lili: 35, lucien: 0 });
  assert.equal(Gate.state("luis", { settings: s, mode: "school", today: 35 }).open, true);
  assert.equal(Gate.state("luis", { settings: s, mode: "holiday", today: 35 }).open, false);
  assert.equal(Gate.state("lucien", { settings: s, mode: "school", today: 0 }).reason, "off");
  const legacy = { enabled: true, threshold: { luis: 60 } };
  assert.equal(Gate.parseSettings(legacy).schoolThreshold.luis, 60, "an old setting keeps one bar for both");
});

test("server migration carries every new chore kind with the client amount", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261019_school_chores_kinds.sql", import.meta.url), "utf8");
  for (const c of School.CHORES) {
    const r = SQPoints.rules[c.kind];
    assert.match(sql, new RegExp(`"${c.kind}":\\[${r.points},${r.limit},"helping","${r.parent ? "parent" : "self"}"\\]`), c.kind + " in points_policy");
    assert.match(sql, new RegExp(`when '${c.kind}' then ${r.points}\\b`), c.kind + " in the snapshot defaults");
  }
});

test("bonus tasks: Papa-checked extra points that never open Games", () => {
  assert.deepEqual(School.BONUS.map((b) => b.kind), ["gym_exercise", "music_bonus"]);
  assert.deepEqual(SQPoints.extraKinds().sort(), ["gym_exercise", "music_bonus"]);
  for (const b of School.BONUS) { pair(b.label, b.id); assert.equal(SQPoints.rules[b.kind].parent, true); }
  const day = "2026-10-19";
  const claims = [
    { kid_id: "lili", day, kind: "gym_exercise", slot: "default", amount: 20, status: "pending" },
    { kid_id: "lili", day, kind: "rice_wash", slot: "default", amount: 5, status: "pending" }
  ];
  assert.equal(Gate.todayPoints("lili", day, { claims, exclude: SQPoints.extraKinds() }), 5);
  assert.equal(Gate.todayPoints("lili", day, { claims }), 25, "without exclude every kind counts, as before");
  const sql = readFileSync(new URL("../supabase/migrations/20261019_school_chores_kinds.sql", import.meta.url), "utf8");
  assert.match(sql, /"gym_exercise":\[20,1,"movement","parent"\]/);
  assert.match(sql, /"music_bonus":\[15,1,"learning","parent"\]/);
  assert.match(sql, /when 'gym_exercise' then 20 when 'music_bonus' then 15/);
});

// ---- Papa's chore editor (D8) ----
const Help = require("../js/home-help-data.js");
const { choreMap, CHORES: FN_CHORES } = await import("../supabase/functions/games-guide/items.mjs");
const Guide = await import("../supabase/functions/games-guide/guide.mjs");
const Chat = await import("../supabase/functions/kid-chat/chat.mjs");
const saved = (items) => ({ chores_v1: JSON.stringify({ version: 1, items }) });

test("chore list: built-ins by default, Papa's renames, switches, kids and own chores", () => {
  const def = School.choreList({});
  assert.equal(def.length, School.CHORES.length + School.BONUS.length);
  assert.ok(def.every((c) => c.builtin && c.enabled && c.kids.length === 3));
  const fs = saved([
    { id: "c_water_plants", icon: "🪴", label: ["Water the plants", "澆花"], points: 15, check: "self", kids: ["lili"], enabled: true },
    { id: "rice", label: ["Rinse the rice", "洗米"], enabled: true, kids: ["luis", "lili"] },
    { id: "garlic", label: ["Peel the garlic", "剝大蒜"], enabled: false },
    { id: "c_bad id", label: ["x", "叉"] },
    { id: "c_no_zh", label: ["Only English", ""] },
    { id: "c_extra_gym", label: ["Swim", "游泳"], points: 7, bonus: true }
  ]);
  const list = School.choreList(fs);
  assert.deepEqual(list.slice(0, 4).map((c) => c.id), ["c_water_plants", "rice", "garlic", "c_extra_gym"], "Papa's order first");
  assert.equal(list.length, 4 + School.CHORES.length + School.BONUS.length - 2, "missing built-ins are appended");
  const water = list[0];
  assert.deepEqual([water.kind, water.slot, water.points, water.check, water.bonus], ["family_chore", "c_water_plants", 15, "self", false]);
  assert.equal(list[3].points, 5, "points off the 5-step fall back to 5");
  assert.deepEqual(list[1].label, ["Rinse the rice", "洗米"]);
  assert.equal(list[1].kind, "rice_wash", "a renamed built-in keeps its points kind");
  assert.deepEqual(School.choresFor("lucien", fs, false).map((c) => c.id).includes("rice"), false);
  assert.ok(!School.choresFor("lili", fs, false).some((c) => c.id === "garlic"), "switched off");
  assert.ok(School.choresFor("lili", fs, false).some((c) => c.id === "c_water_plants"));
  assert.ok(!School.choresFor("luis", fs, false).some((c) => c.id === "c_water_plants"), "kept to Lili");
  assert.deepEqual(School.bonusIdentities(fs), ["family_chore:c_extra_gym"]);
  const round = School.choreList({ chores_v1: JSON.stringify(School.serialize(list)) });
  assert.deepEqual(round, list, "save and load give the same list");
  assert.equal(School.newId("Water the plants!", list), "c_water_the_plants");
  assert.equal(School.newId("Water plants", list), "c_water_plants_2");
  assert.equal(School.newId("澆花", list), "c_chore");
});

test("family_chore: amount from Papa's list, one claim per chore, bonus kept out of the gate", () => {
  const fs = saved([{ id: "c_water_plants", label: ["Water the plants", "澆花"], points: 15 }]);
  assert.equal(SQPoints.amount("family_chore", fs, "c_water_plants"), 15);
  assert.equal(SQPoints.amount("family_chore", fs, "c_unknown"), 0);
  const claim = SQPoints.claim("lili", "2026-10-19", "family_chore", { slot: "c_water_plants" }, fs);
  assert.deepEqual([claim.slot, claim.amount, claim.work_id], ["c_water_plants", 15, "family_chore:c_water_plants"]);
  assert.throws(() => SQPoints.claim("lili", "2026-10-19", "family_chore", { slot: "default" }, fs));
  const day = "2026-10-19";
  const claims = [
    { kid_id: "lili", day, kind: "family_chore", slot: "c_water_plants", amount: 15, status: "pending" },
    { kid_id: "lili", day, kind: "family_chore", slot: "c_swim", amount: 20, status: "pending" }
  ];
  assert.equal(Gate.todayPoints("lili", day, { claims, exclude: ["family_chore:c_swim"] }), 15);
});

test("guide ranks Papa's chores with the eight; several family chores in one day", () => {
  const extra = [
    { id: "chore:c_a", kind: "family_chore", slot: "c_a", icon: "🪴", minutes: 5, label: ["A", "甲"], windows: [["8:00", "20:30"]], goal: {} },
    { id: "chore:c_b", kind: "family_chore", slot: "c_b", icon: "🪴", minutes: 5, label: ["B", "乙"], windows: [["8:00", "20:30"]], goal: {} }
  ];
  const ctx = {
    minutes: 17 * 60, meals: [], extra,
    known: (kind) => !!SQPoints.rules[kind],
    claimed: (kind, slot) => kind === "family_chore" && slot === "c_a",
    atLimit: (kind) => kind === "family_chore",
    amount: (kind, slot) => (slot === "c_b" ? 10 : SQPoints.amount(kind, {}))
  };
  const ids = Help.available(ctx).map((x) => x.item.id);
  assert.ok(!ids.includes("chore:c_a"), "a chore claimed today drops out");
  assert.ok(ids.includes("chore:c_b"), "another family chore is still offered");
  assert.equal(Help.available(ctx).find((x) => x.item.id === "chore:c_b").points, 10);
  const dec = { picks: [{ id: "chore:c_b", line: ["B", "乙"] }], started_id: null };
  assert.equal(Help.view(dec, [], () => "check", extra)[0].item.label[0], "B");
});

test("Edge Functions: built-in chore copy matches, AI may only pick chores Papa has on", () => {
  assert.deepEqual(FN_CHORES, School.CHORES.map((c) => ({ id: c.id, label: c.label })));
  const value = JSON.stringify({ version: 1, items: [
    { id: "garlic", enabled: false, label: ["Peel the garlic", "剝大蒜"] },
    { id: "rice", label: ["Rinse the rice", "洗米"] },
    { id: "c_water_plants", label: ["Water the plants", "澆花"], minutes: 5 },
    { id: "c_swim", label: ["Swim", "游泳"], bonus: true }
  ] });
  const map = choreMap(value);
  assert.ok(!map.has("chore:garlic") && !map.has("chore:c_swim"));
  assert.deepEqual(map.get("chore:rice").label, ["Rinse the rice", "洗米"]);
  assert.equal(map.get("chore:c_water_plants").minutes, 5);
  assert.ok(choreMap(null).has("chore:altar"), "with nothing saved the built-ins are offered");
  const now = new Date("2026-10-19T09:00:00Z"); // 17:00 Taipei
  const body = { kid: "lili", day: "2026-10-19", slot: "evening", reroll: 0, answers: { done: [], time: "some" }, candidates: ["shoes", "chore:rice", "chore:c_water_plants"], need: 20 };
  assert.equal(Guide.validate(body, now, map), null);
  assert.equal(Guide.validate(body, now, null), "candidates", "chore ids need Papa's list");
  assert.equal(Guide.validate({ ...body, candidates: ["shoes", "chore:garlic", "chore:rice"] }, now, map), "candidates");
  const req = JSON.parse(Guide.request(body, now, map).input);
  assert.deepEqual(req.candidates.map((c) => c.label), ["Tidy the shoes", "Rinse the rice", "Water the plants"]);
  const line = Chat.choreLine(value);
  assert.match(line, /Water the plants \(澆花\)/);
  assert.doesNotMatch(line, /Swim|Peel the garlic/);
  assert.match(Chat.request({ kid: "lili", messages: [{ role: "kid", text: "hi" }] }, line).instructions, /Rinse the rice/);
});

test("family_chore migration reads Papa's list on the server and limits per chore", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261019b_family_chores.sql", import.meta.url), "utf8");
  assert.match(sql, /"family_chore":\[0,1,"helping","parent"\]/);
  assert.match(sql, /where s\.key='chores_v1' and x->>'id'=slot/);
  assert.match(sql, /amount<0 or amount>100 or amount%5<>0/);
  assert.match(sql, /\(kind<>'family_chore' or points_claims\.slot=slot\)/);
  assert.match(sql, /snapshot is not null and kind<>'family_chore'/);
  assert.match(sql, /not in \('table_helper','learning','brain','family_chore'\) then slot:='default'/);
});
