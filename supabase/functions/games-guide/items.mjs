// Copy of the home-help list the guide may choose from (js/home-help-data.js).
// scripts/check.mjs fails if ids, labels or minutes drift from SQHomeHelp.ITEMS.
export const ITEMS = [
  { id: "homework", label: ["Homework practice", "作業練習"], minutes: 30 },
  { id: "room", label: ["Clean my room", "整理房間"], minutes: 10 },
  { id: "clothes", label: ["Tidy my clothes", "整理衣服"], minutes: 10 },
  { id: "table", label: ["Help clean the table", "幫忙清理餐桌"], minutes: 5 },
  { id: "shoes", label: ["Tidy the shoes", "整理鞋子"], minutes: 5 },
  { id: "garden", label: ["Tidy the garden", "整理花園"], minutes: 15 },
  { id: "living", label: ["Tidy the living room", "整理客廳"], minutes: 10 },
  { id: "office", label: ["Tidy the office", "整理辦公室"], minutes: 10 },
];
// Same slot boundaries as SQHomeHelp.SLOTS (Taipei time).
export const SLOTS = [["morning", 0], ["afternoon", 12 * 60], ["evening", 17 * 60]];
// Copy of the built-in home chores (js/school-data.js SQSchool.CHORES, ids and
// labels; school-mode-chores D8). Papa's renames, switches and own chores come
// from family_settings.chores_v1. scripts/games-guide-fn.test.mjs fails on drift.
export const CHORES = [
  { id: "rice", label: ["Wash the rice", "洗米"] },
  { id: "dish_in", label: ["Fill the dishwasher", "把碗盤放進洗碗機"] },
  { id: "dish_out", label: ["Empty the dishwasher", "把洗碗機的碗盤拿出來"] },
  { id: "table", label: ["Clean the table and set it for dinner", "擦桌子，準備晚餐"] },
  { id: "clothes", label: ["Tidy up your clothes", "整理衣服"] },
  { id: "desk", label: ["Tidy up your desk", "整理書桌"] },
  { id: "bed", label: ["Get your bed ready", "整理床鋪"] },
  { id: "toys", label: ["Pick up toys from the floor", "把地上的玩具撿起來"] },
  { id: "garden", label: ["Put away garden toys and bikes", "收好花園玩具和腳踏車"] },
  { id: "garlic", label: ["Peel the garlic", "剝大蒜"] },
  { id: "bowls", label: ["Put away your after-school bowl", "收好放學後的碗"] },
  { id: "shoes", label: ["Tidy up the shoes", "整理鞋子"] },
  { id: "laundry_in", label: ["Bring in the dry laundry", "把曬乾的衣服收進來"] },
  { id: "vacuum", label: ["Vacuum the floor", "用吸塵器吸地"] },
  { id: "altar", label: ["Change the water for the Gohonzon", "幫御本尊換水"] },
];

/* Papa's chores the guide may suggest (school-mode-chores D8), keyed "chore:<id>":
   built-ins with Papa's renames, plus his own; switched-off and bonus chores are left out.
   Labels come from family_settings (parent-written), never from the tablet. */
export function choreMap(value) {
  let v = value;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { v = null; } }
  const saved = v && Array.isArray(v.items) ? v.items : [];
  const pair = (p) => Array.isArray(p) && typeof p[0] === "string" && typeof p[1] === "string" && p[0].trim() && p[1].trim()
    ? [p[0].trim().slice(0, 60), p[1].trim().slice(0, 40)] : null;
  const out = new Map();
  for (const c of CHORES) {
    const s = saved.find((x) => x && x.id === c.id);
    if (s && s.enabled === false) continue;
    out.set("chore:" + c.id, { label: (s && pair(s.label)) || c.label, minutes: 10 });
  }
  for (const s of saved) {
    if (!s || typeof s.id !== "string" || !/^c_[a-z0-9_]{1,24}$/.test(s.id) || s.enabled === false || s.bonus === true) continue;
    const label = pair(s.label);
    if (label) out.set("chore:" + s.id, { label, minutes: Math.max(1, Math.min(60, Math.round(Number(s.minutes) || 10))) });
  }
  return out;
}

