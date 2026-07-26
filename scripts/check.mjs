import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
const failures = [];

const fail = (name, detail) => failures.push(`${name}: ${detail}`);
const assertPair = (value, where) => {
  if (!Array.isArray(value) || value.length !== 2 || !value[0] || !value[1]) {
    fail("bilingual pair", `${where} must be [en, zh]`);
  }
};

const indexHtml = readFileSync(new URL("index.html", root), "utf8");
const adminHtml = readFileSync(new URL("admin.html", root), "utf8");
const schemaSql = readFileSync(new URL("supabase/schema.sql", root), "utf8");
const runtimeFiles = ["index.html", "admin.html", "js/day.js", "js/day-data.js", "js/act-data.js", "js/time-core.js", "js/lock-core.js", "js/pinpad.js", "js/papa-tools.js", "js/drills.js", "js/brain-data.js", "js/brain-core.js", "js/brain-ui.js", "js/sync.js", "js/admin.js", "sw.js"];
const scriptMatches = [...indexHtml.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
if (scriptMatches.length !== 1) {
  fail("script extraction", `expected 1 inline script, found ${scriptMatches.length}`);
}

const appScript = scriptMatches[0]?.[1] ?? "";
const tmp = mkdtempSync(join(tmpdir(), "summer-quest-check-"));
try {
  const scriptPath = join(tmp, "index-script.js");
  writeFileSync(scriptPath, appScript);
  const syntax = spawnSync(process.execPath, ["--check", scriptPath], { encoding: "utf8" });
  if (syntax.status !== 0) {
    fail("syntax", (syntax.stderr || syntax.stdout || "node --check failed").trim());
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

for (const file of runtimeFiles) {
  const text = readFileSync(new URL(file, root), "utf8");
  if (/\?\./.test(text)) fail("android 8 syntax", `${file} contains optional chaining`);
  if (/\?\?/.test(text)) fail("android 8 syntax", `${file} contains nullish coalescing`);
  if (/\.flatMap\s*\(/.test(text)) fail("android 8 syntax", `${file} contains Array.prototype.flatMap`);
}

try {
  const marker = "/* finger map";
  const markerIndex = appScript.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`missing ${marker} marker`);
  }
  const dataScript = appScript.slice(0, markerIndex);
  const dayDataJs = readFileSync(new URL("js/day-data.js", root), "utf8");
  const actDataJs = readFileSync(new URL("js/act-data.js", root), "utf8");
  const data = new Function(`const window={};
${dayDataJs}
${actDataJs}
${dataScript}
return { ALL_WORDS, SENT, MISSIONS, BANK, ACT_GUIDE, BANK_POOL, DAY, PHOTO_POOL, PHOTO_TRICKS, LEARN_GUIDES };`)();

  const seenWords = new Set();
  for (const [i, word] of data.ALL_WORDS.entries()) {
    if (!Array.isArray(word) || word.length !== 4 || !word[3]) {
      fail("ALL_WORDS", `entry ${i} must have 4 fields with non-empty zh`);
    }
    const key = String(word[0] ?? "").trim().toLowerCase();
    if (seenWords.has(key)) fail("ALL_WORDS", `duplicate English key "${word[0]}"`);
    seenWords.add(key);
  }

  for (const [i, sentence] of data.SENT.entries()) {
    if (!Array.isArray(sentence) || sentence.length !== 4 || !sentence[3]) {
      fail("SENT", `entry ${i} must have 4 fields with non-empty zh`);
    }
  }

  for (const [pool, kids] of Object.entries(data.MISSIONS)) {
    for (const kid of ["lucien", "lili", "luis"]) {
      if (!Array.isArray(kids?.[kid])) {
        fail("MISSIONS", `${pool}.${kid} must be an array`);
        continue;
      }
      kids[kid].forEach((mission, i) => assertPair(mission, `MISSIONS.${pool}.${kid}[${i}]`));
    }
  }

  if (data.BANK.length !== data.ACT_GUIDE.length || data.BANK.length !== data.BANK_POOL.length) {
    fail("activity bank", `BANK(${data.BANK.length}) ACT_GUIDE(${data.ACT_GUIDE.length}) BANK_POOL(${data.BANK_POOL.length}) lengths differ`);
  }

  data.DAY.forEach((block, i) => {
    if (!block?.tz) fail("DAY", `block ${i} missing tz`);
    if (block?.kind === "routine" && !block.txtz) fail("DAY", `routine block ${i} missing txtz`);
  });

  data.ACT_GUIDE.forEach((guide, guideIndex) => {
    if (!Array.isArray(guide?.steps)) {
      fail("ACT_GUIDE", `entry ${guideIndex} missing steps`);
      return;
    }
    guide.steps.forEach((step, stepIndex) => assertPair(step, `ACT_GUIDE[${guideIndex}].steps[${stepIndex}]`));
  });

  for (const [guideKey, guide] of Object.entries(data.LEARN_GUIDES)) {
    for (const kid of ["lucien", "lili", "luis"]) {
      if (!Array.isArray(guide?.[kid])) {
        fail("LEARN_GUIDES", `${guideKey}.${kid} must be an array`);
        continue;
      }
      guide[kid].forEach((step, stepIndex) => assertPair(step, `LEARN_GUIDES.${guideKey}.${kid}[${stepIndex}]`));
    }
  }

  for (const [kid, entries] of Object.entries(data.PHOTO_POOL)) {
    entries.forEach((entry, i) => {
      if (!Array.isArray(entry) || entry.length !== 4 || entry.some((field) => !field)) {
        fail("PHOTO_POOL", `${kid}[${i}] must have 4 non-empty fields`);
      }
    });
  }

  data.PHOTO_TRICKS.forEach((entry, i) => {
    if (!Array.isArray(entry) || entry.length !== 2 || entry.some((field) => !field)) {
      fail("PHOTO_TRICKS", `entry ${i} must have 2 non-empty fields`);
    }
  });
} catch (error) {
  fail("data load", error.message);
}

try {
  const { createRequire } = await import("node:module");
  const requireCjs = createRequire(import.meta.url);
  const drills = requireCjs("../js/drills.js");
  for (const kid of ["lucien", "lili", "luis"]) {
    if (!Array.isArray(drills.DRILL_PLAN[kid]) || !drills.DRILL_PLAN[kid].length) {
      fail("DRILLS", `DRILL_PLAN.${kid} missing`);
    }
    drills.DRILL_PLAN[kid].forEach(d => { if (!drills.DRILLS[d]) fail("DRILLS", `discipline ${d} not in DRILLS`); });
  }
  for (const [disc, list] of Object.entries(drills.DRILLS)) {
    list.forEach((drill, di) => {
      if (!drill.name || !drill.name[0] || !drill.name[1]) fail("DRILLS", `${disc}[${di}] name must be bilingual`);
      drill.steps.forEach((s, si) => assertPair(s, `DRILLS.${disc}[${di}].steps[${si}]`));
    });
  }
} catch (error) {
  fail("DRILLS load", error.message);
}

try {
  const { createRequire } = await import("node:module");
  const requireCjs = createRequire(import.meta.url);
  const brainData = requireCjs("../js/brain-data.js");
  const brainCore = requireCjs("../js/brain-core.js");
  const ids = Object.keys(brainData.GAMES);
  if (!ids.length) fail("BRAIN", "no games defined");
  for (const id of ids) {
    const g = brainData.GAMES[id];
    if (g.id !== id) fail("BRAIN", `${id}: id field does not match its key`);
    assertPair(g.title, `BRAIN.${id}.title`);
    assertPair(g.blurb, `BRAIN.${id}.blurb`);
    if (!g.icon) fail("BRAIN", `${id}: missing icon`);
    if (!g.skill) fail("BRAIN", `${id}: missing skill tag`);
    const tiers = Object.keys(g.tiers || {});
    if (!tiers.length) fail("BRAIN", `${id}: defines no tiers`);
    for (const t of tiers) {
      if (!brainData.TIERS.includes(t)) fail("BRAIN", `${id}: unknown tier ${t}`);
      const cfg = g.tiers[t];
      if (!(cfg.items > 0)) fail("BRAIN", `${id}.${t}: items must be > 0`);
      if (typeof cfg.clock !== "boolean") fail("BRAIN", `${id}.${t}: clock must be boolean`);
      if (!["keypad", "choice", "grid", "type"].includes(cfg.pad)) fail("BRAIN", `${id}.${t}: unknown pad ${cfg.pad}`);
      if (typeof cfg.gen !== "function" && typeof cfg.build !== "function") {
        fail("BRAIN", `${id}.${t}: needs gen() or build()`);
      }
    }
    if (g.tiers.tot && g.tiers.tot.clock !== false) fail("BRAIN", `${id}: tot tier must be unclocked`);
    if (!new RegExp(`\\b${id}\\s*:\\s*\\{[^}]*brain\\s*:\\s*true`).test(indexHtml)) {
      fail("BRAIN", `${id}: missing a LEVELS entry with brain:true in index.html`);
    }
  }
  for (const kid of ["lucien", "lili", "luis"]) {
    const trio = brainCore.dailyThree(kid, "2026-07-27", {});
    const again = brainCore.dailyThree(kid, "2026-07-27", {});
    if (trio.join() !== again.join()) fail("BRAIN", `dailyThree not deterministic for ${kid}`);
    if (new Set(trio).size !== trio.length) fail("BRAIN", `dailyThree repeated a game for ${kid}`);
  }
} catch (error) {
  fail("BRAIN load", error.message);
}

try {
  const manifestUrl = new URL("manifest.webmanifest", root);
  const manifest = JSON.parse(readFileSync(manifestUrl, "utf8"));
  if (manifest.name !== "Summer Quest") fail("manifest", "name must be Summer Quest");
  if (manifest.display !== "standalone") fail("manifest", "display must be standalone");
  if (!manifest.start_url) fail("manifest", "missing start_url");
  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  if (!icons.length) fail("manifest", "missing icons");
  icons.forEach((icon, i) => {
    if (!icon.src || !existsSync(new URL(icon.src, root))) {
      fail("manifest", `icon ${i} missing file ${icon.src || ""}`);
    }
  });
  if (!existsSync(new URL("sw.js", root))) fail("pwa", "missing sw.js");
  if (!indexHtml.includes('rel="manifest"') || !adminHtml.includes('rel="manifest"')) {
    fail("pwa", "index/admin must link manifest");
  }
  if (!indexHtml.includes("serviceWorker") || !adminHtml.includes("serviceWorker")) {
    fail("pwa", "index/admin must register service worker");
  }
} catch (error) {
  fail("pwa", error.message);
}

if (!schemaSql.includes("create table if not exists help_claims")) {
  fail("captain", "schema missing help_claims table");
}
if (!indexHtml.includes('data-t="captain"') || !indexHtml.includes("renderCaptain")) {
  fail("captain", "kid app missing Captain tab wiring");
}
if (!adminHtml.includes("helpClaims")) {
  fail("captain", "admin missing help claims queue");
}

const syncTest = spawnSync(process.execPath, [fileURLToPath(new URL("sync.test.mjs", import.meta.url))], { encoding: "utf8" });
if (syncTest.status !== 0) {
  fail("sync tests", (syncTest.stderr || syncTest.stdout || "sync.test.mjs failed").trim());
}

const coreTest = spawnSync(process.execPath, ["--test", "scripts/core.test.mjs"], { cwd: root, encoding: "utf8" });
if (coreTest.status !== 0) {
  fail("core tests", (coreTest.stderr || coreTest.stdout || "node --test scripts/core.test.mjs failed").trim().split("\n").slice(-8).join("\n"));
}

try {
  const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
  const serviceRolePattern = ["service", "role"].join("_");
  const jwtPattern = ["e", "y", "J"].join("");
  const allowedServiceRoleFiles = new Set([".claude/commands/ship.md", "CLAUDE.md", "js/config.example.js"]);
  const allowedJwtFiles = new Set([".claude/commands/ship.md"]);
  const textLike = /\.(css|html|js|json|md|mjs|sql|svg|txt|webmanifest|yml)$/i;
  for (const file of tracked) {
    const normalizedFile = file.replaceAll("\\", "/");
    const fileUrl = new URL(file, root);
    if (!existsSync(fileUrl)) continue;
    if (!textLike.test(normalizedFile)) continue;
    const text = readFileSync(fileUrl, "utf8");
    if (text.includes(jwtPattern) && !allowedJwtFiles.has(normalizedFile)) {
      fail("secrets", `${file} contains JWT prefix ${jwtPattern}`);
    }
    if (text.includes(serviceRolePattern) && !allowedServiceRoleFiles.has(normalizedFile)) {
      fail("secrets", `${file} contains ${serviceRolePattern}`);
    }
  }
} catch (error) {
  fail("git scan", error.message);
}

if (failures.length) {
  console.error(`Summer Quest check failed (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Summer Quest check passed: syntax, bilingual data, pool alignment, and tracked-file secret scan are green.");
