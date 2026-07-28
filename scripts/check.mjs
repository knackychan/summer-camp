import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, globSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
// Discovered, not listed. The hand-maintained array meant every new js/ file
// skipped syntax, legacy-syntax and secret scanning until someone remembered to
// append it — and splitting index.html adds files by the dozen.
const runtimeFiles = ["index.html", "admin.html", "sw.js"].concat(
  globSync("js/**/*.js", { cwd: fileURLToPath(root) })
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => file !== "js/config.js" && file !== "js/config.example.js") // gitignored; absent on a fresh clone
    .filter((file) => !file.startsWith("js/vendor/")) // third-party; not subject to legacy-syntax scan
    .sort()
);
const bookHtmlFiles = globSync("books/*.html", { cwd: fileURLToPath(root) })
  .map((file) => file.replaceAll("\\", "/"))
  .sort();
const bookDataFiles = globSync("js/books/*-data.js", { cwd: fileURLToPath(root) })
  .map((file) => file.replaceAll("\\", "/"))
  .sort();

const scriptMatches = [...indexHtml.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
if (!scriptMatches.length) {
  fail("script extraction", "index.html has no inline script");
}

// Every inline block, concatenated — the old "expected exactly 1" made the
// monolith a structural requirement of its own verifier.
// ponytail: classic scripts only. An inline type="module" block would fail the
// `node --check` below; move module code to js/ rather than inlining it.
const appScript = scriptMatches.map((match) => match[1]).join("\n");
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

// Every shipped .js must actually parse. Only index.html's inline script was
// checked before, which is how a stray `:` in js/admin.js shipped green and
// killed the whole admin app while this script said "passed".
for (const file of runtimeFiles.filter((f) => f.endsWith(".js"))) {
  const parsed = spawnSync(process.execPath, ["--check", fileURLToPath(new URL(file, root))], { encoding: "utf8" });
  if (parsed.status !== 0) {
    fail("syntax", `${file}: ${(parsed.stderr || parsed.stdout || "node --check failed").trim().split("\n").slice(0, 4).join(" ")}`);
  }
}

// Offline-first is a non-negotiable: a script the app loads but sw.js never
// precaches works on wifi and dies without it. Only files something actually
// references are required — a module written ahead of the slice that ships it
// is not yet a shell file. Games loaded by dynamic import are covered by the
// MANIFEST check further down instead, since their path is built from an id.
{
  const swText = readFileSync(new URL("sw.js", root), "utf8");
  const loaders = indexHtml + adminHtml + readFileSync(new URL("js/main.js", root), "utf8");
  for (const file of runtimeFiles.filter((f) => f.startsWith("js/"))) {
    if (!loaders.includes(file)) continue;
    if (!swText.includes(`./${file}`)) fail("offline", `${file} is loaded but missing from sw.js APP_SHELL`);
  }
}

// Standalone books are not loaded by index.html, so the generic app-shell checks
// above cannot see them. Keep the guard mechanical: shell/data pairing for every
// book, and full image/offline enforcement only once the shelf marks it ready.
{
  const swText = readFileSync(new URL("sw.js", root), "utf8");
  const shelfMatch = indexHtml.match(/var BOOK_SHELF = \[([\s\S]*?)\];/);
  let shelf = [];
  try {
    if (!shelfMatch) throw new Error("missing BOOK_SHELF");
    shelf = new Function(`${shelfMatch[0]}\nreturn BOOK_SHELF;`)();
  } catch (error) {
    fail("books", `BOOK_SHELF did not parse: ${error.message}`);
  }
  if (/window\.open\(\s*b\.file/.test(indexHtml)) fail("books", "Books shelf must open the in-app reader, not a new page");
  const shelfById = new Map(shelf.map((book) => [book.id, book]));
  const dataByTopic = new Map();

  for (const file of bookDataFiles) {
    const topic = file.slice("js/books/".length, -"data.js".length - 1);
    const text = readFileSync(new URL(file, root), "utf8");
    const globalMatch = text.match(/\bvar\s+([A-Z0-9_]+)\s*=\s*\[/);
    if (!globalMatch) {
      fail("books", `${file} must declare var TOPIC_CARDS = [...]`);
      continue;
    }
    let cards = [];
    try {
      cards = new Function(`${text}\nreturn ${globalMatch[1]};`)();
    } catch (error) {
      fail("books", `${file} did not load: ${error.message}`);
      continue;
    }
    if (!Array.isArray(cards) || !cards.length) fail("books", `${file} must export a non-empty card array`);
    const isSpread = !!cards[0] && Array.isArray(cards[0].blocks);
    dataByTopic.set(topic, { file, globalName: globalMatch[1], cards, isSpread });
    const seen = new Set();
    cards.forEach((card, i) => {
      const where = `${file}[${card && card.id ? card.id : i}]`;
      if (isSpread) {
        if (!card || !card.id) fail("books", `${where} missing id`);
        if (!card || !card.titleEN) fail("books", `${where} missing titleEN`);
        if (!card || !card.titleZH) fail("books", `${where} missing titleZH`);
        if (!card || !Array.isArray(card.blocks) || card.blocks.length !== 4) {
          fail("books", `${where} must have exactly 4 blocks`);
        } else {
          card.blocks.forEach(function(blk, bi){
            if (!blk.en || !blk.zh) fail("books", `${where}.blocks[${bi}] must have en + zh`);
          });
        }
        if (card && seen.has(card.id)) fail("books", `${file} duplicate id ${card.id}`);
        if (card) seen.add(card.id);
        return;
      }
      ["id", "emoji", "nameEN", "nameZH", "photo", "typeEN", "typeZH"].forEach((field) => {
        if (!card || !card[field]) fail("books", `${where} missing ${field}`);
      });
      if (card && seen.has(card.id)) fail("books", `${file} duplicate id ${card.id}`);
      if (card) seen.add(card.id);
      if (!card || !Array.isArray(card.facts) || card.facts.length !== 3) {
        fail("books", `${where} must have exactly 3 facts`);
        return;
      }
      card.facts.forEach((fact, factIndex) => {
        if (!fact.en || !fact.tz) fail("books", `${where}.facts[${factIndex}] must have en + tz`);
      });
    });
  }

  for (const file of bookHtmlFiles) {
    const topic = file.slice("books/".length, -".html".length);
    const data = dataByTopic.get(topic);
    const html = readFileSync(new URL(file, root), "utf8");
    if (!swText.includes(`./${file}`)) fail("books", `${file} missing from sw.js APP_SHELL`);
    for (const match of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        new Function(match[1]);
      } catch (error) {
        fail("books", `${file} inline script did not parse: ${error.message}`);
      }
    }
    if (!data) {
      fail("books", `${file} has no matching js/books/${topic}-data.js`);
      continue;
    }
    if (!html.includes(`../${data.file}`)) fail("books", `${file} must load ../${data.file}`);
    if (!html.includes(data.globalName)) fail("books", `${file} does not reference ${data.globalName}`);
    if (!swText.includes(`./${data.file}`)) fail("books", `${data.file} missing from sw.js APP_SHELL`);
  }

  for (const book of shelf) {
    if (!book.id || !book.titleEN || !book.titleZH || !book.data) fail("books", `BOOK_SHELF entry ${book.id || "?"} is incomplete`);
    if (!book.file && book.layout !== "spread") fail("books", `BOOK_SHELF entry ${book.id} has no file and is not a spread book`);
    const topic = book.id;
    const data = dataByTopic.get(topic);
    if (!data) {
      fail("books", `${topic} has no data file`);
      continue;
    }
    var isSpread = book.layout === "spread" || (data && data.isSpread);
    if (!isSpread) {
      if (!existsSync(new URL(book.file, root))) fail("books", `${topic} points to missing ${book.file}`);
      if (!swText.includes(`./${book.file}`)) fail("books", `${topic} shell ${book.file} is not precached`);
    }
    if (book.data !== data.globalName) fail("books", `${topic} shelf data ${book.data} must match ${data.globalName}`);
    if (!indexHtml.includes(`js/books/${topic}-data.js`)) fail("books", `${topic} data script is not loaded by index.html`);
    if (!book.ready) continue;
    if (isSpread) {
      if (!swText.includes(`./js/books/${topic}-data.js`)) fail("books", `${topic} data file js/books/${topic}-data.js missing from sw.js APP_SHELL`);
      continue;
    }
    for (const card of data.cards) {
      if (!card.photo) continue;
      const photo = card.photo.replace(/^\.\.\//, "");
      if (!existsSync(new URL(photo, root))) fail("books", `${topic}/${card.id} missing photo ${card.photo}`);
      if (!swText.includes(`./${photo}`)) fail("books", `${topic}/${card.id} photo missing from sw.js APP_SHELL`);
    }
  }

  for (const file of bookHtmlFiles) {
    const topic = file.slice("books/".length, -".html".length);
    if (!shelfById.has(topic)) fail("books", `${file} has no BOOK_SHELF entry`);
  }
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
  const learnDataJs = readFileSync(new URL("js/learn-data.js", root), "utf8");
  const data = new Function(`const window={};
${dayDataJs}
${actDataJs}
${learnDataJs}
${dataScript}
return { ALL_WORDS, SENT, MISSIONS, BANK, ACT_GUIDE, BANK_POOL, DAY, PHOTO_POOL, PHOTO_TRICKS, LEARN_GUIDES, LEARN_BASE, LEARN_KEYS, learnActIdx };`)();

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

  // Learn guides sync through act_done.act_idx (an int column), in a reserved
  // band above every BANK index. A collision would make revoking a learn star
  // un-tick a real activity instead.
  if (!(data.LEARN_BASE > data.BANK.length)) {
    fail("LEARN", `LEARN_BASE(${data.LEARN_BASE}) must sit above BANK length(${data.BANK.length})`);
  }
  data.LEARN_KEYS.forEach((key) => {
    const idx = data.learnActIdx(key);
    if (!Number.isInteger(idx)) fail("LEARN", `${key} has no integer act index`);
  });
  if (data.LEARN_KEYS.length !== Object.keys(data.LEARN_GUIDES).length) {
    fail("LEARN", "LEARN_KEYS out of sync with LEARN_GUIDES");
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

// Brain Gym sprite atlases. A manifest whose frame boxes run past the edge of the
// atlas fails as a silently blank sprite in the browser, so the coordinates are
// checked against the real PNG header here rather than discovered on a tablet.
// Also enforces the pack budgets and the offline rule: an atlas that a runtime file
// actually references MUST be precached in APP_SHELL.
{
  const manifestUrl = new URL("assets/brain/sprites/manifest.json", root);
  if (existsSync(manifestUrl)) {
    try {
      const pack = JSON.parse(readFileSync(manifestUrl, "utf8"));
      const swText = readFileSync(new URL("sw.js", root), "utf8");
      const runtimeText = runtimeFiles
        .map((f) => readFileSync(new URL(f, root), "utf8"))
        .join("\n");
      let packBytes = 0;

      Object.entries(pack.atlases || {}).forEach(([file, atlas]) => {
        const url = new URL(`assets/brain/sprites/${file}`, root);
        if (!existsSync(url)) {
          fail("sprites", `manifest lists ${file} but the file is missing`);
          return;
        }
        const png = readFileSync(url);
        packBytes += png.length;
        if (png.length > 256 * 1024) {
          fail("sprites", `${file} is ${Math.round(png.length / 1024)} KB, over the 256 KB per-atlas budget`);
        }
        // PNG IHDR: 8-byte signature, 4-byte length, "IHDR", then width and height.
        const width = png.readUInt32BE(16);
        const height = png.readUInt32BE(20);
        if (width !== atlas.width || height !== atlas.height) {
          fail("sprites", `${file} is ${width}x${height} but the manifest says ${atlas.width}x${atlas.height}`);
        }

        Object.entries(atlas.sprites || {}).forEach(([id, s]) => {
          const frames = s.frames || 1;
          const right = s.x + (frames - 1) * (s.step || 0) + s.w;
          const bottom = s.y + s.h;
          if (s.x < 0 || s.y < 0 || right > width || bottom > height) {
            fail("sprites", `${file}#${id} frame box runs to ${right}x${bottom}, outside the ${width}x${height} atlas`);
          }
          if (!Array.isArray(s.ramp) || !s.ramp.length) {
            fail("sprites", `${file}#${id} records no palette ramp`);
          } else {
            s.ramp.forEach((hex) => {
              if (!/^#[0-9a-fA-F]{6}$/.test(hex)) fail("sprites", `${file}#${id} ramp entry ${hex} is not a hex colour`);
            });
            if (s.ramp.length > 10) fail("sprites", `${file}#${id} uses ${s.ramp.length} colours, over the 10-colour budget`);
          }
          if (!s.provenance) fail("sprites", `${file}#${id} has no SPRITE-PROMPTS.md provenance id`);
        });

        // Only demand precaching once something shipped actually loads the atlas.
        const referenced = runtimeText.includes(`assets/brain/sprites/${file}`);
        if (referenced && !swText.includes(`assets/brain/sprites/${file}`)) {
          fail("sprites", `${file} is used at runtime but is not in APP_SHELL`);
        }
      });

      if (packBytes > 900 * 1024) {
        fail("sprites", `sprite pack is ${Math.round(packBytes / 1024)} KB, over the 900 KB budget`);
      }
      if (!existsSync(new URL("assets/brain/SPRITE-PROMPTS.md", root))) {
        fail("sprites", "assets/brain/SPRITE-PROMPTS.md is missing; every sprite needs recorded provenance");
      }
    } catch (error) {
      fail("sprites", error.message);
    }
  }
}

// Brain Gym placeholder sound pack. The cue list in js/brain-audio-cues.js and the cue
// table in assets/audio/brain/README.md are the same list written twice; drift between
// them is how a scene ends up calling a cue nobody ever recorded. Checked here so the
// pair stays in step when the synthesized placeholders are swapped for real MP3s.
{
  const cuesFile = new URL("js/brain-audio-cues.js", root);
  if (existsSync(cuesFile)) {
    try {
      const { createRequire } = await import("node:module");
      const cues = createRequire(import.meta.url)("../js/brain-audio-cues.js");
      const readme = readFileSync(new URL("assets/audio/brain/README.md", root), "utf8");
      const documented = [...readme.matchAll(/^\| `([a-z0-9-]+)` \|/gm)].map((m) => m[1]);

      documented.forEach((cue) => {
        if (!cues.CUES[cue]) fail("audio cues", `README documents "${cue}" but no recipe exists`);
      });
      cues.CUE_NAMES.forEach((cue) => {
        if (!documented.includes(cue)) fail("audio cues", `recipe "${cue}" is not in the README cue table`);
      });

      cues.CUE_NAMES.forEach((cue) => {
        const layers = cues.CUES[cue];
        if (!Array.isArray(layers) || !layers.length) {
          fail("audio cues", `${cue}: empty recipe`);
          return;
        }
        layers.forEach((layer, i) => {
          const where = `${cue} layer ${i}`;
          if (layer.t !== "tone" && layer.t !== "noise") fail("audio cues", `${where}: unknown layer type ${layer.t}`);
          if (!(layer.dur > 0)) fail("audio cues", `${where}: duration must be positive`);
          if (!(layer.gain > 0)) fail("audio cues", `${where}: gain must be positive`);
          // exponentialRampToValueAtTime cannot ramp to or from zero
          if (layer.t === "tone" && !(layer.f0 > 0 && layer.f1 > 0)) fail("audio cues", `${where}: frequencies must be > 0`);
          if (layer.t === "noise" && !(layer.hz > 0 && layer.q > 0)) fail("audio cues", `${where}: noise needs hz and q`);
        });
        // §8.2: nothing loops and decorative motion lives no longer than 640ms, so a
        // single cue that outlasts its animation would be audible after the visual ends.
        const seconds = cues.cueDuration(cue);
        if (seconds > 0.64) fail("audio cues", `${cue} runs ${Math.round(seconds * 1000)}ms, over the 640ms ceiling`);
        if (Math.max(...layers.map((l) => l.gain)) > 0.14) fail("audio cues", `${cue} is louder than the 0.14 placeholder ceiling`);
      });
    } catch (error) {
      fail("audio cues", error.message);
    }
  }
}

// Star provenance: every local `stars` bump must name what earned it, or the
// diff in sync.js has nothing to attach and the row lands in the "Unlabelled"
// bucket. Checked as "a noteStars() call within 2 lines", which is how all
// existing grant sites are written.
{
  const appLines = appScript.split("\n");
  appLines.forEach((line, i) => {
    if (!/progress\[[^\]]+\]\.stars\s*(\+=|=\s*\(?progress)/.test(line)) return;
    const window = appLines.slice(i, i + 3).join("\n");
    if (!window.includes("noteStars(")) {
      fail("star provenance", `index.html line ~${i + 1} changes stars with no noteStars() reason`);
    }
  });
  if (/App progress/.test(readFileSync(new URL("js/sync.js", root), "utf8"))) {
    fail("star provenance", "sync.js still has the anonymous 'App progress' bucket");
  }
}

// Brain gate (plan 2026-07-26-brain-gym slice 11): the daily three are the door to the games
if (!schemaSql.includes("create table if not exists brain_done")) {
  fail("brain gate", "schema missing brain_done table");
}
if (!schemaSql.includes("kid braingate")) {
  fail("brain gate", "schema missing the anon braingate policy");
}
if (!indexHtml.includes("brainGate") || !indexHtml.includes("brainTrio")) {
  fail("brain gate", "kid app missing gate wiring");
}
if (!indexHtml.includes('reason==="brain"')) {
  fail("brain gate", "lock overlay does not handle the brain reason");
}
if (!indexHtml.includes("brainNudge")) {
  fail("brain gate", "day tab missing the Brain Gym prompt — kids would never see the routine");
}
// the gate hides the rest of the row; hiding the brain games too would deadlock the kid
if (!indexHtml.includes(".brainlocked #gameRow .gamecard:not(.brain)")) {
  fail("brain gate", "brain games are not exempt from the locked-row rule");
}
if (!/先做頭腦體操/.test(indexHtml)) {
  fail("brain gate", "gate copy is missing its 中文 half");
}

if (!schemaSql.includes("create table if not exists help_claims")) {
  fail("captain", "schema missing help_claims table");
}
if (!indexHtml.includes('data-t="captain"') || !indexHtml.includes("renderCaptain")) {
  fail("captain", "kid app missing Captain tab wiring");
}
if (!adminHtml.includes("helpClaims") && !/helpClaims/.test(readFileSync(new URL("js/admin.js", root), "utf8"))) {
  fail("captain", "admin missing help claims queue or code");
}
// Admin routes: orphan control — every $("…") reference in admin.js must exist in admin.html
{
  const adminJs = readFileSync(new URL("js/admin.js", root), "utf8");
  const adminNavJs = existsSync(new URL("js/admin-nav.js", root)) ? readFileSync(new URL("js/admin-nav.js", root), "utf8") : "";
  const allJs = adminJs + "\n" + adminNavJs;
  // show("id", on) resolves through $() too, so its literals need the same
  // check — that gap let show("logoutBtn") survive the shell rebuild that
  // deleted the element.
  const idRefs = [...allJs.matchAll(/\$\("([^"]+)"\)/g)].map(m => m[1])
    .concat([...allJs.matchAll(/\bshow\("([^"]+)"/g)].map(m => m[1]));
  const uniqueIds = [...new Set(idRefs)];
  const adminHtmlLower = adminHtml.toLowerCase();
  for (const id of uniqueIds) {
    // Skip dynamic IDs with interpolation
    if (id.includes("${") || id.includes("+")) continue;
    // Skip synthetic ids created by JS itself (render functions that build DOM dynamically)
    if (/^(exportCsv|ledgerRange|dangerResetDay|dangerPauseAll|notifyCheck|chatClearFilters|settingsLogout|noteBodyZh|saveNoteBtn|saveAdminPinBtn|noteBody|noteStatus|noteDay|adminPin|removedCredited|queueKidFilter|adminPinStatus|pin-.+|recstatus-.+|answer-.+|pinmsg-.+|themeSelect)$/.test(id)) continue;
    if (!adminHtmlLower.includes(`id="${id.toLowerCase()}"`) && !adminHtmlLower.includes(`id='${id.toLowerCase()}'`)) {
      fail("admin routes: orphan control", `$("${id}") in JS has no matching id in admin.html`);
    }
  }
}

// Admin dead controls: a button rendered with a data-* handle that nothing ever
// queries is a control Papa can click forever with no effect. data-queuekid
// (three kid chips on the Today queue) shipped exactly like that.
{
  const adminJs = readFileSync(new URL("js/admin.js", root), "utf8");
  const adminNavJs = existsSync(new URL("js/admin-nav.js", root)) ? readFileSync(new URL("js/admin-nav.js", root), "utf8") : "";
  const all = adminJs + "\n" + adminNavJs + "\n" + adminHtml;
  // Presentational hooks read by CSS only, not by script.
  const cssOnly = new Set(["l", "zero", "kid", "block", "paused", "locked", "delta", "admin"]);
  const emitted = new Set([...all.matchAll(/\sdata-([a-z0-9]+)=/g)].map((m) => m[1]));
  const queried = new Set([
    ...[...all.matchAll(/\[data-([a-z0-9]+)[\]=]/g)].map((m) => m[1]),
    ...[...all.matchAll(/dataset\.([a-zA-Z0-9]+)/g)].map((m) => m[1].toLowerCase())
  ]);
  for (const attr of emitted) {
    if (cssOnly.has(attr) || queried.has(attr)) continue;
    fail("admin dead control", `data-${attr} is rendered but never queried — the control does nothing`);
  }
}

// Admin dead elements: an id in admin.html that no script and no stylesheet
// mentions is markup nothing can fill. #reportMetrics was an empty labelled
// chip group; #notifyToggleBtn was a bell with no handler.
{
  const adminJs = readFileSync(new URL("js/admin.js", root), "utf8");
  const adminNavJs = existsSync(new URL("js/admin-nav.js", root)) ? readFileSync(new URL("js/admin-nav.js", root), "utf8") : "";
  const js = adminJs + "\n" + adminNavJs;
  const cssDir = new URL("css/", root);
  const css = existsSync(cssDir)
    ? readdirSync(cssDir).filter((f) => /^admin.*\.css$/.test(f)).map((f) => readFileSync(new URL(`css/${f}`, root), "utf8")).join("\n")
    : "";
  // Built from a template literal (`view-` + route) rather than named outright.
  const composed = /^view-/;
  for (const id of new Set([...adminHtml.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))) {
    if (composed.test(id)) continue;
    if (js.includes(`"${id}"`) || js.includes(`'${id}'`) || css.includes(`#${id}`)) continue;
    if (adminHtml.includes(`for="${id}"`) || adminHtml.includes(`aria-controls="${id}"`)) continue;
    fail("admin dead element", `#${id} in admin.html is referenced by no script and no stylesheet`);
  }
}

// Every test file, discovered. Three were named here by hand while five others
// (registry, solar-data, solar-sim, solar-explore, solar-quiz) sat in scripts/
// passing but never run by the gate — a test nobody runs is a test nobody has.
{
  const testFiles = globSync("scripts/*.test.mjs", { cwd: fileURLToPath(root) })
    .map((file) => file.replaceAll("\\", "/"))
    .sort();
  if (!testFiles.length) fail("tests", "no scripts/*.test.mjs found");
  const run = spawnSync(process.execPath, ["--test", ...testFiles], { cwd: root, encoding: "utf8" });
  if (run.status !== 0) {
    const out = (run.stdout || "") + (run.stderr || "");
    // Cut at node's "failing tests:" summary — it repeats every ✖ line already
    // printed above it, which is how one failure reported itself three times.
    const failing = [...new Set(
      out.split("failing tests:")[0].split("\n").filter((line) => /^✖\s*\S/.test(line))
    )].slice(0, 6);
    fail("tests", failing.length ? failing.join(" | ") : out.trim().split("\n").slice(-8).join("\n"));
  }
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

// L1 token leak: no --p-* outside admin-tokens.css
{
  const cssDir = new URL("css/", root);
  if (existsSync(cssDir)) {
    const cssFiles = readdirSync(cssDir).filter(f => /^admin.*\.css$/.test(f));
    for (const file of cssFiles) {
      if (file.includes("admin-tokens")) continue;
      const text = readFileSync(new URL(`css/${file}`, root), "utf8");
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        if (/--p-[a-z0-9-]+/.test(line)) {
          fail("admin tokens: L1 leak", `css/${file}:${i + 1} references --p-*`);
        }
      });
    }
  }
}

// Colour literals in admin CSS (outside tokens file)
{
  const cssDir = new URL("css/", root);
  if (existsSync(cssDir)) {
    const cssFiles = readdirSync(cssDir).filter(f => /^admin.*\.css$/.test(f));
    for (const file of cssFiles) {
      if (file.includes("admin-tokens")) continue;
      const text = readFileSync(new URL(`css/${file}`, root), "utf8");
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        if (/#[0-9A-Fa-f]{3,8}\b/.test(line) || /\brgba?\(/.test(line) || /\bhsla?\(/.test(line)) {
          if (/color-mix\(in srgb,\s*var\(--/.test(line)) return;
          fail("admin tokens: colour literal in CSS", `css/${file}:${i + 1} "${line.trim()}"`);
        }
      });
    }
  }
}

// Colour literals in admin JS
{
  const adminJsPath = new URL("js/admin.js", root);
  if (existsSync(adminJsPath)) {
    const text = readFileSync(adminJsPath, "utf8");
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (/#[0-9A-Fa-f]{3,8}\b/.test(line) || /\brgba?\(/.test(line) || /\bhsla?\(/.test(line)) {
        if (/color-mix\(in srgb,\s*var\(--/.test(line)) return;
        fail("admin tokens: colour literal in JS", `js/admin.js:${i + 1} "${line.trim()}"`);
      }
    });
  }
}

// Admin tokens: WCAG contrast gate
{
  function hexToRgb(hex) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function srgb(rgb) {
    return rgb.map(function(c) {
      c = c / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
  }
  function luminance(rgb) {
    var s = srgb(rgb);
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  }
  function contrast(a, b) {
    var l1 = luminance(a), l2 = luminance(b);
    var lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function parseTokens(cssText) {
    var variables = {};
    var currentTheme = "root";
    var currentScheme = "light";
    var lines = cssText.split("\n");
    var themeDepth = -1, schemeDepth = -1, depth = 0;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (/\[data-admin-theme/.test(line)) {
        var m = line.match(/"([^"]+)"/);
        currentTheme = m ? m[1] : "root";
        themeDepth = depth;
      } else if (/@media\s*\(prefers-color-scheme:\s*dark\)/.test(line)) {
        currentScheme = "dark";
        schemeDepth = depth;
      }
      var vMatch = line.match(/--p-([a-z0-9-]+)\s*:\s*([^;]+);/);
      if (vMatch) {
        if (!variables[currentTheme]) variables[currentTheme] = {};
        if (!variables[currentTheme][currentScheme]) variables[currentTheme][currentScheme] = {};
        variables[currentTheme][currentScheme][vMatch[1]] = vMatch[2].trim();
      }
      // Track brace depth so a theme/scheme block ends where it actually ends.
      // The old "reset on a bare }" heuristic left currentTheme pinned to the
      // last theme seen, silently misfiling every L1 default declared after it.
      depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (themeDepth >= 0 && depth <= themeDepth) { currentTheme = "root"; themeDepth = -1; }
      if (schemeDepth >= 0 && depth <= schemeDepth) { currentScheme = "light"; schemeDepth = -1; }
    }
    return variables;
  }

  function resolveL1(themeVars, name) {
    var v = themeVars[name];
    if (v && v.startsWith("var(--p-")) {
      var ref = v.match(/var\(--p-([a-z0-9-]+)\)/);
      if (ref) return resolveL1(themeVars, ref[1]);
    }
    return v;
  }

  function colorValue(tokenVal, themeVars) {
    if (!tokenVal) return null;
    if (tokenVal.startsWith("#") && /^#[0-9A-Fa-f]{3,8}$/.test(tokenVal)) return hexToRgb(tokenVal);
    if (tokenVal.startsWith("var(--p-")) {
      var m = tokenVal.match(/var\(--p-([a-z0-9-]+)\)/);
      if (m) return colorValue(resolveL1(themeVars, m[1]), themeVars);
    }
    if (tokenVal.startsWith("rgba(")) {
      var rgba = tokenVal.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (rgba) return [parseInt(rgba[1]), parseInt(rgba[2]), parseInt(rgba[3])];
    }
    if (tokenVal.startsWith("color-mix")) {
      var hex = tokenVal.match(/#[0-9A-Fa-f]{3,8}/);
      if (hex) return hexToRgb(hex[0]);
      // color-mix with var(--backdrop) — approximate from backdrop token
      if (tokenVal.includes("--backdrop")) return null;
    }
    return null;
  }

  function resolveL2(l2Name, themeVars) {
    // L2 semantic names are in :root level of tokens.css
    // They map var(--surface-page) → var(--p-ground) etc.
    // We need to resolve them through the theme's L1 values
    var map = {
      "surface-page": "ground",
      "surface-sheet": "sheet",
      "surface-sheet-2": "sheet-2",
      "surface-inset": "sheet-3",
      "text-1": "ink",
      "text-2": "ink-2",
      "text-3": "ink-3",
      "action-bg": "signal",
      "action-fg": "signal-ink",
      "status-late": "alert",
      "status-late-bg": "alert-bg",
      "status-now": "warn",
      "status-now-bg": "warn-bg",
      "status-done": "good",
      "status-done-bg": "good-bg",
      "star": "star",
      "kid-lucien": "kid-1",
      "kid-lili": "kid-2",
      "kid-luis": "kid-3",
      "text-invert": "invert-ink"
    };
    var pName = map[l2Name];
    if (!pName) return null;
    var val = themeVars[pName];
    if (!val) return null;
    if (val.startsWith("var(--p-")) {
      var m = val.match(/var\(--p-([a-z0-9-]+)\)/);
      if (m) val = resolveL1(themeVars, m[1]);
    }
    return colorValue(val, themeVars);
  }

  function checkThemePair(fgL2, bgL2, desc, theme, scheme, vars) {
    var fg = resolveL2(fgL2, vars);
    var bg = resolveL2(bgL2, vars);
    // A pair that cannot be resolved used to skip in silence, which is how the
    // gate could report green while checking nothing. Say so instead.
    if (!fg || !bg) {
      fail("admin tokens: contrast", theme + "/" + scheme + " " + desc + " — could not resolve " + (fg ? bgL2 : fgL2) + " to a colour");
      return;
    }
    var ratio = contrast(fg, bg);
    var threshold = desc.includes("large") ? 3 : 4.5;
    if (ratio < threshold) {
      fail("admin tokens: contrast",
        theme + "/" + scheme + " " + desc + " (" + fgL2 + " on " + bgL2 + ") ratio " + ratio.toFixed(2) + " < " + threshold + ":1");
    }
  }

  var tokensPath = new URL("css/admin-tokens.css", root);
  if (existsSync(tokensPath)) {
    var tokensText = readFileSync(tokensPath, "utf8");
    var allVars = parseTokens(tokensText);
    var themes = Object.keys(allVars);

    themes.forEach(function(theme) {
      var schemes = Object.keys(allVars[theme] || {});
      schemes.forEach(function(scheme) {
        var vars = allVars[theme][scheme] || {};

        // Body text on page, sheet, inset
        checkThemePair("text-1", "surface-page", "body text on page", theme, scheme, vars);
        checkThemePair("text-1", "surface-sheet", "body text on sheet", theme, scheme, vars);
        checkThemePair("text-1", "surface-inset", "body text on inset", theme, scheme, vars);

        // Muted text
        checkThemePair("text-2", "surface-sheet", "muted text on sheet", theme, scheme, vars);

        // Subdued text
        checkThemePair("text-3", "surface-sheet", "subdued text on sheet (large)", theme, scheme, vars);

        // Action button
        checkThemePair("action-fg", "action-bg", "action button text", theme, scheme, vars);

        // Status tags on sheet
        checkThemePair("status-late", "surface-sheet", "late status on sheet (large)", theme, scheme, vars);
        checkThemePair("status-now", "surface-sheet", "now status on sheet (large)", theme, scheme, vars);
        checkThemePair("status-done", "surface-sheet", "done status on sheet (large)", theme, scheme, vars);
        checkThemePair("star", "surface-sheet", "star text on sheet (large)", theme, scheme, vars);

        // Kid hues on sheet
        checkThemePair("kid-lucien", "surface-sheet", "Lucien hue on sheet (large)", theme, scheme, vars);
        checkThemePair("kid-lili", "surface-sheet", "Lili hue on sheet (large)", theme, scheme, vars);
        checkThemePair("kid-luis", "surface-sheet", "Luis hue on sheet (large)", theme, scheme, vars);

        // Ink laid ON a strong coloured fill: the initial in .who__m, the
        // .btn--danger hover, the .btn__count pill. Nothing checked these pairs
        // before, which is how white-on-#46E0A0 (1.69:1) shipped through a gate
        // called "contrast".
        checkThemePair("text-invert", "kid-lucien", "Lucien initial on hue (large)", theme, scheme, vars);
        checkThemePair("text-invert", "kid-lili", "Lili initial on hue (large)", theme, scheme, vars);
        checkThemePair("text-invert", "kid-luis", "Luis initial on hue (large)", theme, scheme, vars);
        checkThemePair("text-invert", "status-late", "invert ink on late fill", theme, scheme, vars);
        checkThemePair("text-invert", "status-now", "invert ink on now fill", theme, scheme, vars);

        // Backgrounds of status tags (tag text on tag bg)
        checkThemePair("text-1", "surface-sheet-2", "text on sheet-2", theme, scheme, vars);
      });
    });
  }
}

try {
  var manifestMod = await import(new URL("js/games/index.js", root));
  var MANIFEST_D = manifestMod.MANIFEST;
  var seenMan = new Set();
  for (var ei = 0; ei < MANIFEST_D.length; ei++) {
    var entry = MANIFEST_D[ei];
    if (!entry.id) fail("manifest", "entry with no id");
    if (seenMan.has(entry.id)) fail("manifest", "duplicate id " + entry.id);
    seenMan.add(entry.id);
    if (!entry.meta || !entry.meta.icon) fail("manifest", entry.id + ": missing icon");
    assertPair([entry.meta.title, entry.meta.tz], "manifest." + entry.id + ".title");
    if (!entry.meta.blurb) fail("manifest", entry.id + ": missing blurb");
    if (typeof entry.keyboard !== "boolean") fail("manifest", entry.id + ": keyboard must be boolean");
    if (!entry.brain && entry.legacy !== false) {
      if (!new RegExp("\\b" + entry.id + "\\s*:\\s*\\{").test(indexHtml)) {
        fail("manifest", entry.id + ": no matching LEVELS entry in index.html");
      }
    }
  }
  var bestKeysM = MANIFEST_D.map(function (e) { return e.bestKey; }).filter(Boolean);
  if (new Set(bestKeysM).size !== bestKeysM.length) fail("manifest", "duplicate bestKey");
  if (!indexHtml.includes('<script type="module" src="js/main.js">')) {
    fail("manifest", "index.html is not loading js/main.js as a module");
  }
  var swText = readFileSync(new URL("sw.js", root), "utf8");
  for (var ei2 = 0; ei2 < MANIFEST_D.length; ei2++) {
    var ev = MANIFEST_D[ei2];
    if (ev.brain || ev.legacy !== false) continue;
    if (!swText.includes("./js/games/" + ev.id + ".js")) {
      fail("manifest", ev.id + ": migrated game missing from sw.js APP_SHELL");
    }
  }

  // Import-graph precache guard (solar-system tech-spec §16.1). The manifest
  // guard above only proves a shipped game's *entry* module is precached; it
  // says nothing about what that module then imports. solar.js statically pulls
  // ./solar-data.js / ./solar-sim.js / ./solar-quiz.js and dynamically pulls
  // ../vendor/three.module.min.js / ../vendor/OrbitControls.js — all five were
  // precached by hand until this walk made the imports prove it. One level deep
  // (each registered game module → its direct relative specifiers). Bare
  // specifiers ("three") and interpolated import("./games/" + id + ".js")
  // can't be a cache path, so they're skipped by construction.
  var IMPORT_RE = /\bimport\b[^'";`\n]*?["'`](\.\.?\/[^"'`\n]+\.(?:js|mjs))["'`]/g;
  var resolveImport = function (fromFile, spec) {
    var dir = fromFile.slice(0, fromFile.lastIndexOf("/") + 1);
    var out = [];
    for (var parts = (dir + spec).split("/"), i = 0; i < parts.length; i++) {
      if (!parts[i] || parts[i] === ".") continue;
      if (parts[i] === "..") { out.pop(); continue; }
      out.push(parts[i]);
    }
    return out.join("/");
  };
  for (var ei3 = 0; ei3 < MANIFEST_D.length; ei3++) {
    var ev3 = MANIFEST_D[ei3];
    if (ev3.brain || ev3.legacy !== false) continue;
    var gameFile = "js/games/" + ev3.id + ".js";
    if (!existsSync(new URL(gameFile, root))) continue;
    var gameText = readFileSync(new URL(gameFile, root), "utf8");
    var im;
    while ((im = IMPORT_RE.exec(gameText)) !== null) {
      var resolved = resolveImport(gameFile, im[1]);
      if (!swText.includes("./" + resolved)) {
        fail("offline imports", gameFile + " imports " + im[1] + " \u2192 " + resolved + " missing from sw.js APP_SHELL");
      }
    }
  }
} catch (error) {
  fail("manifest load", error.message);
}

try {
  var threeCoreUrl = new URL("js/vendor/three.core.min.js", root);
  var threeUrl = new URL("js/vendor/three.module.min.js", root);
  var orbitUrl = new URL("js/vendor/OrbitControls.js", root);
  if (!existsSync(threeCoreUrl)) fail("vendor", "js/vendor/three.core.min.js is missing");
  if (!existsSync(threeUrl)) fail("vendor", "js/vendor/three.module.min.js is missing");
  if (!existsSync(orbitUrl)) fail("vendor", "js/vendor/OrbitControls.js is missing");
  var swTextVendor = readFileSync(new URL("sw.js", root), "utf8");
  ["three.core.min.js", "three.module.min.js", "OrbitControls.js"].forEach(function (file) {
    if (!swTextVendor.includes("./js/vendor/" + file)) fail("vendor", "js/vendor/" + file + " missing from sw.js APP_SHELL");
  });
  var threeText = readFileSync(threeUrl, "utf8");
  if (!/from\s*["']\.\/three\.core\.min\.js["']/.test(threeText)) {
    fail("vendor", "three.module.min.js no longer imports ./three.core.min.js; update the vendor guard");
  }
  var orbitText = readFileSync(orbitUrl, "utf8");
  if (/from\s+['"]three['"]/.test(orbitText) && !/from\s+['"]\.\/three\.module\.min\.js['"]/.test(orbitText)) {
    fail("vendor", "OrbitControls.js still has a bare 'three' import specifier");
  }
} catch (error) {
  fail("vendor", error.message);
}

try {
  var solarMod = await import(new URL("js/games/solar-data.js", root));
  var SOLAR_D = solarMod.SOLAR;
  var PLANETS_D = solarMod.PLANETS;
  assertPair([SOLAR_D.name, SOLAR_D.tz], "solar.sun.name");
  SOLAR_D.facts.forEach(function (f, i) { assertPair([f.en, f.tz], "solar.sun.fact" + i); });
  if (PLANETS_D.length !== 8) fail("solar", "expected 8 planets, got " + PLANETS_D.length);
  var seenSolar = new Set();
  for (var pi = 0; pi < PLANETS_D.length; pi++) {
    var pv = PLANETS_D[pi];
    if (seenSolar.has(pv.id)) fail("solar", "duplicate planet id " + pv.id);
    seenSolar.add(pv.id);
    assertPair([pv.name, pv.tz], "solar." + pv.id + ".name");
    if (pv.type) assertPair([pv.type.en, pv.type.tz], "solar." + pv.id + ".type");
    if (pv.desc) assertPair([pv.desc.en, pv.desc.tz], "solar." + pv.id + ".desc");
    (pv.facts || []).forEach(function (f, i) { assertPair([f.en, f.tz], "solar." + pv.id + ".fact" + i); });
    if ((pv.facts || []).length !== 3) fail("solar", pv.id + ": exactly 3 facts required");
  }
} catch (error) {
  fail("solar data load", error.message);
}

// Brain Gym presentation runtime (slice 34 task 9; implementation-guidelines.md §12.3,
// §12.4, §14). SCENE_LOADERS is the one place allowed to name a scene module, so its
// keys/targets are checked against brain-data.GAMES and sw.js APP_SHELL here instead of
// discovered on a tablet as a blank round.
try {
  var { createRequire: createRequireBrain } = await import("node:module");
  var requireBrain = createRequireBrain(import.meta.url);
  var brainDataForScenes = requireBrain("../js/brain-data.js");
  var sceneIndexText = readFileSync(new URL("js/brain/scenes/index.js", root), "utf8");
  var swTextBrain = readFileSync(new URL("sw.js", root), "utf8");
  var loaderRe = /(\w+):\s*function\s*\(\)\s*\{\s*return\s*import\(["']\.\/([\w.-]+)["']\)/g;
  var loaderMatch, loaderKeys = [];
  while ((loaderMatch = loaderRe.exec(sceneIndexText)) !== null) {
    var sceneKey = loaderMatch[1], sceneFile = loaderMatch[2];
    loaderKeys.push(sceneKey);
    if (!brainDataForScenes.GAMES[sceneKey]) {
      fail("brain scenes", "SCENE_LOADERS." + sceneKey + " has no matching brain-data.GAMES entry");
    }
    var sceneRel = "js/brain/scenes/" + sceneFile;
    if (!swTextBrain.includes("./" + sceneRel)) {
      fail("brain scenes", sceneRel + " is a scene loader target but missing from sw.js APP_SHELL");
    }
  }
  var sceneMod = await import(new URL("js/brain/scenes/index.js", root));
  for (var si = 0; si < loaderKeys.length; si++) {
    var loadedScene = await sceneMod.SCENE_LOADERS[loaderKeys[si]]();
    var sceneDefault = loadedScene.default;
    if (!sceneDefault || sceneDefault.id !== loaderKeys[si]) {
      fail("brain scenes", "scene module for \"" + loaderKeys[si] + "\" reports id \"" + (sceneDefault && sceneDefault.id) + "\"");
    }
    if (!sceneDefault || typeof sceneDefault.create !== "function") {
      fail("brain scenes", "scene \"" + loaderKeys[si] + "\" has no create()");
    }
  }

  // §12.4: a scene module must never call these directly — only the shared
  // game-services own scheduling/audio, so a scene can guarantee zero live
  // resources after destroy() without reimplementing that bookkeeping itself.
  var forbiddenApis = [/\bsetTimeout\s*\(/, /\bsetInterval\s*\(/, /\brequestAnimationFrame\s*\(/,
    /\bspeechSynthesis\b/, /\bnew\s+Audio\s*\(/, /\bfetch\s*\(/, /\blocalStorage\b/];
  var sceneFiles = globSync("js/brain/scenes/*.js", { cwd: fileURLToPath(root) })
    .map(function (f) { return f.replaceAll("\\", "/"); })
    .filter(function (f) { return f !== "js/brain/scenes/index.js"; });
  sceneFiles.forEach(function (f) {
    var text = readFileSync(new URL(f, root), "utf8");
    forbiddenApis.forEach(function (re) {
      if (re.test(text)) fail("brain scenes", f + " calls a forbidden direct API matching " + re);
    });
  });

  // SHOP_PRODUCTS (slice 35): the fixed bilingual catalog Change Maker draws from.
  var shopProducts = brainDataForScenes.SHOP_PRODUCTS || [];
  if (shopProducts.length !== 10) fail("BRAIN change", "SHOP_PRODUCTS must have exactly 10 products, has " + shopProducts.length);
  var seenProductIds = new Set();
  shopProducts.forEach(function (p) {
    if (seenProductIds.has(p.id)) fail("BRAIN change", "duplicate SHOP_PRODUCTS id " + p.id);
    seenProductIds.add(p.id);
    assertPair(p.name, "SHOP_PRODUCTS." + p.id + ".name");
  });
} catch (error) {
  fail("brain scenes", error.message);
}

// Brain scene CSS colour tokens (implementation-guidelines.md §4.1, §17): a scene
// must consume --brain-* tokens, never scatter a literal colour through scene CSS.
// The :root block in brain-shell.css is where those literals are declared, so it is
// excluded; everything else in either file must resolve through var(--brain-*).
{
  ["css/brain-shell.css", "css/brain-scenes.css"].forEach(function (file) {
    var text = readFileSync(new URL(file, root), "utf8");
    var rootBlock = text.match(/:root\s*\{[\s\S]*?\n\}\n/);
    var scannable = rootBlock ? text.slice(0, rootBlock.index) + text.slice(rootBlock.index + rootBlock[0].length) : text;
    scannable.split("\n").forEach(function (line, i) {
      if (/color-mix\(in srgb,\s*var\(--/.test(line)) return;
      if (/#[0-9A-Fa-f]{3,8}\b/.test(line) || /\brgba?\(/.test(line) || /\bhsla?\(/.test(line)) {
        fail("brain tokens: colour literal in CSS", file + " ~line " + (i + 1) + ' "' + line.trim() + '"');
      }
    });
  });
}

// Game shell contract (unified-game-shell-remediation-plan.md).
// Every migrated game must use ctx.stage, not document.getElementById("stage").
// balloon.js and solar.js are the explicit reference games — exempt.
// Pending migration: hunt, machines, orc, race, vocab (Step 9 audit).
var GAME_CONTRACT_EXEMPT = new Set(["balloon", "solar", "hunt", "machines", "orc", "race", "vocab"]);
var gameFiles = globSync("js/games/*.js", { cwd: fileURLToPath(root) })
  .map(function (f) { return f.replaceAll("\\", "/"); })
  .filter(function (f) {
    if (f === "js/games/index.js" || f === "js/games/registry.js") return false;
    return true;
  });

gameFiles.forEach(function (file) {
  var gameId = file.replace(/^js\/games\//, "").replace(/\.js$/, "");
  var text = readFileSync(new URL(file, root), "utf8");
  if (GAME_CONTRACT_EXEMPT.has(gameId)) return;

  if (/document\.getElementById\("stage"\)/.test(text)) {
    fail("game contract", file + ' uses document.getElementById("stage") — use ctx.stage instead');
  }
  // Only flag body.appendChild for non-modal uses. Finish overlays
  // (city, dig) follow the same overlay pattern as showBrainResult in index.html.
  if (!/finish(City|Dig)\b/.test(text) && /document\.body\.appendChild/.test(text)) {
    fail("game contract", file + ' calls document.body.appendChild — route through host overlay or render inside stage');
  }
  if (/position:\s*fixed/.test(text)) {
    fail("game contract", file + ' has inline position:fixed — game content must stay inside the stage');
  }
  if (/\d+vh\b/.test(text)) {
    fail("game contract", file + ' uses vh CSS unit — size from the stage wrapper, not the viewport');
  }
});

if (failures.length) {
  console.error(`Summer Quest check failed (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Summer Quest check passed: syntax, bilingual data, pool alignment, and tracked-file secret scan are green.");
