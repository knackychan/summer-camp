// The server's Brain Gym trio (points_brain_trio) must pick exactly what the
// tablet's SQBrainCore.dailyThree picks, or real Brain Gym points are refused.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const D = require("../js/brain-data.js");
const core = require("../js/brain-core.js");

function newestTrioSql() {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  return readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
    .map((f) => readFileSync(new URL(f, dir), "utf8"))
    .filter((t) => t.includes("function public.points_brain_trio(")).pop();
}

test("SQL trio list and skills match the tablet's Brain Gym catalog", () => {
  const sql = newestTrioSql();
  const ids = [...sql.match(/declare ids text\[\]:=array\[([^\]]*)\]/)[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  const skills = JSON.parse(sql.match(/skills jsonb:='([^']*)'/)[1]);
  const live = Object.keys(D.GAMES).filter((id) => !D.GAMES[id].retired);
  // SQL has no tiers: it is only exact while every live exercise exists in every tier
  for (const id of live) for (const tier of D.TIERS) assert.ok(D.GAMES[id].tiers[tier], `${id} lacks tier ${tier}; teach points_brain_trio tiers first`);
  assert.deepEqual(ids, live, "regenerate points_brain_trio's list from js/brain-data.js (non-retired, key order)");
  for (const id of live) assert.equal(skills[id], D.GAMES[id].skill, id + " skill");
  // replay the SQL algorithm (seeded shuffle, skill pass, fill pass) over real days
  for (let d = 0; d < 90; d++) {
    const day = new Date(Date.UTC(2026, 6, 1 + d)).toISOString().slice(0, 10);
    for (const kid of ["lucien", "lili", "luis"]) {
      const order = core.seededShuffle(ids, core.mulberry32(core.dseed("brain" + day + kid)));
      const picked = [], seen = new Set();
      for (const id of order) { if (picked.length === 3) break; if (!seen.has(skills[id])) { seen.add(skills[id]); picked.push(id); } }
      for (const id of order) { if (picked.length === 3) break; if (!picked.includes(id)) picked.push(id); }
      assert.deepEqual(picked, core.dailyThree(kid, day, {}), `${kid} ${day}`);
    }
  }
});
