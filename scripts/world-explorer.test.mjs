import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
// Normalise CRLF: with core.autocrlf a Windows checkout has CRLF, and the vm tests slice source on "\n".
const read = (path) => readFileSync(resolve(root, path), "utf8").replace(/\r\n/g, "\n");
const WORLD_MODULES = ["world-explorer", "planet-palette", "planet-map", "planet-globe", "planet-sprites", "planet-toys", "planet-minigames"];

test("miniature world is a real root-runtime surface, not a wrapper", () => {
  const html = read("index.html");
  assert.match(html, /<section id="world" class="hidden"/);
  assert.match(html, /id="worldMount"/);
  assert.match(html, /function openWorld\(id\)/);
  assert.match(html, /resetQuestSession\(id\);openWorld\(id\)/);
  assert.match(html, /\["home","world","game","hub","act","book","music"\]/);
  assert.doesNotMatch(html, /<iframe[^>]+world/i);
});

test("world is a pixel planet on a 2D canvas and launches content through the registry only", () => {
  const source = read("js/world/world-explorer.js");
  assert.match(source, /from "\.\/planet-globe\.js"/);
  assert.match(source, /getContext\("2d"\)/);
  assert.match(source, /dataset\.sqWorld="planet"/);
  assert.match(source, /registry\.open\(selected\.id,\{origin:"world"\}\)/);
  assert.doesNotMatch(source, /three\.module|OrbitControls|WebGLRenderer|Raycaster/);
  assert.doesNotMatch(source, /iframe|legacy\.html|apps\/kid/);
  assert.doesNotMatch(source, /window\.location|location\.href/);
  for (const name of WORLD_MODULES.slice(1)) {
    assert.doesNotMatch(read(`js/world/${name}.js`), /document\.cookie|localStorage|addStars|stars_ledger|registry\.open/, `${name} stays out of family state`);
  }
});

test("world exposes physical destinations and featured real content", () => {
  const map = read("js/world/planet-map.js");
  for (const id of ["section:quests","section:games","section:acts","section:learn","section:books","section:music","section:day","section:rewards",
    "game:monster-truck","game:solar","book:space","game:paint","game:kitchen"]) {
    assert.match(map, new RegExp(`"${id.replace(":", "\\:")}"`));
  }
});

test("content opened from the world can return to that same surface", () => {
  const html = read("index.html");
  assert.match(html, /function rememberContentReturn\(\)/);
  assert.match(html, /contentReturnSurface=worldVisible\(\)\?"world":"hub"/);
  assert.match(html, /if\(contentReturnSurface==="world"\).*openWorld\(id\)/s);
  assert.match(html, /returnAfterContent\("books"\)/);
  assert.match(html, /returnAfterContent\("music"\)/);
  assert.match(html, /returnAfterContent\(String\(actIdx\).*"learn":"acts"/);
  assert.match(html, /hubReturnSurface==="world"/);
});

test("native Back ends a planet mini-game before leaving the world, and toys use the app's muted-aware beep", () => {
  const html = read("index.html");
  assert.match(html, /worldExplorerModule&&worldExplorerModule\.back&&worldExplorerModule\.back\(\)/);
  assert.match(html, /beep:beep/);
  assert.match(html, /Tap a place 點一個地方/);
});

test("world runtime is packaged offline for PWA and Android", () => {
  const sw = read("sw.js");
  assert.match(sw, /const CACHE_NAME\s*=\s*["']summer-quest-/);
  assert.match(sw, /\.\/css\/world-explorer\.css/);
  for (const name of WORLD_MODULES) {
    assert.match(sw, new RegExp(`\\./js/world/${name}\\.js`), `${name} precached`);
    assert.equal(existsSync(resolve(root, `js/world/${name}.js`)), true);
  }
  assert.match(sw, /\.\/js\/vendor\/three\.module\.min\.js/, "Solar still needs Three.js offline");
  assert.equal(existsSync(resolve(root, "css/world-explorer.css")), true);
  assert.match(read("css/world-explorer.css"), /image-rendering:pixelated/);
});

test("world persistence accepts a unit quaternion + zoom and rejects corrupt or old saved views", () => {
  const source = read("js/world/world-explorer.js");
  let stored = null;
  const context = { savedViews: new Map(), window: { localStorage: { getItem: () => stored } } };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("function readView("), source.indexOf("function clamp(")), context);
  stored = JSON.stringify({ rotation: [0, 0.2, 0, 0.98], zoom: 1.4, selected: "section:books" });
  const view = context.readView("lucien");
  assert.equal(view.selected, "section:books");
  assert.equal(view.zoom, 1.4);
  assert.ok(Math.abs(Math.hypot(...view.rotation) - 1) < 1e-9, "rotation re-normalised");
  for (const value of [
    "broken JSON", "null",
    JSON.stringify({ camera: [9, 7, 10], target: [0, 1, 0], selected: "section:books" }),
    JSON.stringify({ rotation: [0, 0, 0], zoom: 1 }),
    JSON.stringify({ rotation: [0, 0, 0, 2], zoom: 1 }),
    JSON.stringify({ rotation: [0, 0, 0, 0.5], zoom: 1 }),
    JSON.stringify({ rotation: [0, 0, 0, "1"], zoom: 1 }),
    JSON.stringify({ rotation: [0, 0, 0, 1], zoom: 3 }),
    JSON.stringify({ rotation: [0, 0, 0, 1] })
  ]) {
    stored = value;
    assert.equal(context.readView("lucien"), null, value);
  }
});

test("the selection card subtitle carries the Chinese blurb, not only the English one", () => {
  const source = read("js/world/world-explorer.js");
  const context = {};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("function selectionSubtitle("), source.indexOf("function readView(")), context);
  assert.equal(context.selectionSubtitle({ title: ["Star Catch", "接星星"], blurb: ["Catch the falling stars!", "接住掉下來的星星！"] }),
    "Catch the falling stars!\n接星星 · 接住掉下來的星星！");
  assert.equal(context.selectionSubtitle({ title: ["Paint", ""], blurb: ["", ""] }), "");
  assert.equal(context.selectionSubtitle({ title: ["Paint", "畫畫"], blurb: ["Make art", ""] }), "Make art\n畫畫");
  assert.equal(context.selectionSubtitle({ available: false, title: ["Books", "書籍"], blurb: ["Reading world", "閱讀世界"] }),
    "Not available right now · 現在暫時無法開啟");
  assert.match(read("css/world-explorer.css"), /\.world-selection__copy span\{[^}]*white-space:pre[;}]/, "subtitle keeps its two lines");
});

test("each kid's hero takes that kid's own colour, snapped to the palette", async () => {
  const { nearestIndex } = await import("../js/world/planet-palette.js");
  const raws = [...read("index.html").matchAll(/^\s*(lucien|lili|luis):\s*\{[^}]*raw:"(#[0-9A-Fa-f]{6})"/gm)].map((m) => m[2]);
  assert.equal(raws.length, 3, "three kids with a hex raw colour");
  assert.equal(new Set(raws.map(nearestIndex)).size, 3, "three distinct hero colours");
  assert.ok(/nearestIndex\(\(options\.kid&&\(options\.kid\.raw\|\|options\.kid\.color\)\)/.test(read("js/world/world-explorer.js")),
    "hero colour reads kid.raw (kid.color is a CSS var the palette cannot snap)");
});

test("a mini-game hides the planet's ambient sparks: they stay under the dim overlay and stop spawning", () => {
  const source = read("js/world/world-explorer.js");
  const body = (name) => { const at = source.indexOf(`function ${name}(`); return source.slice(at, source.indexOf("\n  function ", at + 1)); };
  const log = [];
  const context = {
    log, HEX: [], C: { space: 0 }, bw: 10, bh: 10, moon: { z: 0 }, surface: [], globeCanvas: {}, dim: 1, focus: { item: {} },
    drawFocus: () => log.push("focus"),
    minigame: { draw: () => log.push("game") },
    ctx: { set fillStyle(v) {}, set globalAlpha(v) {}, drawImage: () => log.push("globe"), fillRect: () => log.push("fill") },
    drawStars: () => log.push("stars"), drawItem: () => {}, drawParticles: () => log.push("sparks"), drawConfetti: () => log.push("confetti")
  };
  vm.createContext(context);
  vm.runInContext(body("composite"), context);
  vm.runInContext("composite()", context);
  assert.equal(log.filter((x) => x === "sparks").length, 1, "sparks drawn once");
  assert.ok(log.indexOf("sparks") < log.lastIndexOf("fill"), "sparks sit under the dim overlay");
  assert.ok(log.indexOf("game") < log.indexOf("confetti"), "the win confetti still lands on top of the game");
  assert.ok(!log.includes("focus"), "a mini-game replaces focus mode, never stacks on it");
  assert.match(body("ambient"), /if\(reduced\|\|minigame\)return;/, "no new landmark sparks during a game");
});

test("a view saved mid-pinch past the zoom limit is still accepted on the next launch", () => {
  const source = read("js/world/world-explorer.js");
  let stored = null;
  const context = {
    savedViews: new Map(), MIN_ZOOM: 1, MAX_ZOOM: 2, rotation: [0, 0.2, 0, Math.sqrt(1 - 0.04)], zoom: 2.12, selected: null, viewDirty: true,
    options: { kidId: "lili" }, window: { localStorage: { getItem: () => stored, setItem: (k, v) => { stored = v; } } }
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("function readView("), source.indexOf("function clamp(")), context);
  vm.runInContext(source.slice(source.indexOf("function clamp("), source.indexOf("\n", source.indexOf("function clamp("))), context);
  const at = source.indexOf("function saveView(");
  vm.runInContext(source.slice(at, source.indexOf("\n  }\n", at) + 4), context);
  vm.runInContext("saveView()", context);
  context.savedViews.clear();
  const view = context.readView("lili");
  assert.ok(view, "saved view survives");
  assert.equal(view.zoom, 2);
});

test("switching kids reuses the planet map, clouds and each hero colour's sprite atlas", () => {
  const source = read("js/world/world-explorer.js");
  const built = { map: 0, clouds: 0, atlas: [] };
  const context = {
    DEFAULT_SEED: 7,
    buildPlanetMap: () => { built.map++; return { color: [] }; },
    buildCloudMap: () => { built.clouds++; return []; },
    buildAtlas: (hero) => { built.atlas.push(hero); return { hero }; }
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("var planetArt="), source.indexOf("var MIN_ZOOM=")), context);
  const a = context.worldArt(21), b = context.worldArt(6), c = context.worldArt(21);
  assert.equal(built.map, 1); assert.equal(built.clouds, 1);
  assert.deepEqual(built.atlas, [21, 6]);
  assert.equal(a.map, b.map); assert.equal(a.atlas, c.atlas); assert.notEqual(a.atlas, b.atlas);
  assert.match(source, /var art=worldArt\(heroIndex\),map=art\.map,clouds=art\.clouds,atlas=art\.atlas;/);
});

test("a lost 2D canvas is reported and fully redrawn, crisp, when the browser restores it", () => {
  const source = read("js/world/world-explorer.js");
  const at = source.indexOf("/* ---------- canvas context loss ---------- */");
  assert.ok(at > 0, "context-loss block exists");
  const block = source.slice(at, source.indexOf("\n\n", at));
  const on = { addEventListener() {} }, canvas = { id: "main", ...on }, globeCanvas = { id: "globe", ...on }, rebuilt = [];
  const context = {
    canvas, globeCanvas, heroIndex: 21, dirty: false, atlas: "old", gameEnv: { atlas: "old" },
    ctx: { imageSmoothingEnabled: true }, atlases: new Map([[21, "old"]]),
    worldArt: (hero) => { rebuilt.push(hero); return { atlas: "new" }; }
  };
  vm.createContext(context);
  vm.runInContext(block, context);
  context.onContextLost({ target: canvas });
  context.onContextLost({ target: globeCanvas });
  assert.equal(vm.runInContext("lostCanvases.size", context), 2, "both losses reported");
  context.onContextRestored({ target: globeCanvas });
  assert.equal(context.dirty, true, "globe repainted");
  assert.deepEqual(rebuilt, [], "atlas rebuilt only for the main canvas");
  context.onContextRestored({ target: canvas });
  assert.equal(vm.runInContext("lostCanvases.size", context), 0);
  assert.equal(context.ctx.imageSmoothingEnabled, false, "pixels stay crisp after restore");
  assert.equal(context.atlases.has(21), false, "stale cached atlas dropped");
  assert.equal(context.atlas, "new"); assert.equal(context.gameEnv.atlas, "new");
  assert.match(source, /contextLost:lostCanvases\.size>0/);
  for (const name of ["contextlost", "contextrestored"]) {
    assert.ok(source.includes(`globeCanvas.addEventListener("${name}"`), `globe canvas listens for ${name}`);
    assert.equal(source.split(`anvas.addEventListener("${name}"`).length, 3, `main and globe canvas both listen for ${name}`);
    assert.ok(source.includes(`globeCanvas.removeEventListener("${name}"`), `${name} listener removed on destroy`);
  }
});

test("on narrow screens the selection card stops short of the floating companion", () => {
  const css = read("css/world-explorer.css");
  const narrow = css.match(/@media\(max-width:700px\)\{\.world-selection\{([^}]*)\}\}/);
  assert.ok(narrow, "a narrow-screen rule for the card");
  assert.match(narrow[1], /right:calc\(max\(14px,var\(--sq-safe-right,0px\)\) \+ 74px\)/, "clears the 64px companion plus a gap");
  assert.match(narrow[1], /transform:none/);
});

test("planet art is drawn 50% bigger than the original 4/3-pixel scale (design amendment 2026-10-03)", () => {
  const source = read("js/world/world-explorer.js");
  const line = source.match(/scale=Math\.max\(1,Math\.round\(\(Math\.min\(w,h\)<600\?4\.5:6\)\*dpr\)\)\/dpr;/);
  assert.ok(line, "6 screen px per art px, 4.5 on small screens, rounded to whole device pixels");
  for (const dpr of [1, 1.333, 1.5, 2, 2.25, 2.625, 3]) for (const short of [480, 800]) {
    const context = { dpr, w: short * 1.6, h: short, scale: 0 };
    vm.createContext(context); vm.runInContext(line[0], context);
    const device = context.scale * dpr;
    assert.ok(Math.abs(device - Math.round(device)) < 1e-9, `whole device px at dpr ${dpr}`);
    assert.ok(Math.abs(context.scale - (short < 600 ? 4.5 : 6)) <= 0.5 / dpr + 1e-9, `CSS size kept at dpr ${dpr}`);
  }
  assert.ok(source.includes("Math.min(bw,bh)*0.45*zoom"), "planet grows with the pixels so sprites do not crowd it");
});

test("a released pinch keeps its zoom: clamped while the fingers are down, no rubber band to spring back", () => {
  const source = read("js/world/world-explorer.js");
  assert.match(source, /zoom=clamp\(pinch\.zoom\*pinchDistance\(\)\/pinch\.distance,MIN_ZOOM,MAX_ZOOM\)/);
  assert.doesNotMatch(source, /rubber\(/);
});

test("focus mode hangs the card off the chosen sprite, below it, or above when the bottom is too close", () => {
  const source = read("js/world/world-explorer.js");
  const body = (name) => { const at = source.indexOf(`function ${name}(`); return source.slice(at, source.indexOf("\n  function ", at + 1)); };
  const props = {}, classes = new Set();
  const selectionEl = { offsetWidth: 300, offsetHeight: 100, style: { setProperty: (k, v) => { props[k] = v; } },
    classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) } };
  const context = {
    selectionEl, shell: { clientWidth: 1280, clientHeight: 800 }, scale: 6, minigame: null, cardKey: "",
    atlas: { house: { normal: [{ width: 14, height: 16 }] } }, reactionPose: () => ({ dy: 0 }), clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    focus: { item: { kind: "place", sprite: "house", x: 107, y: 70 }, t: 1 }
  };
  vm.createContext(context);
  for (const name of ["focusScale", "focusBox", "placeCard"]) vm.runInContext(body(name), context);
  vm.runInContext("placeCard()", context);
  // 2× sprite: 28 wide centred on x=107 (642 CSS px); bottom at 70+4 → 444 CSS px, card 16 px under it.
  assert.equal(selectionEl.style.left, "492px"); assert.equal(selectionEl.style.top, "460px");
  assert.equal(props["--tail-x"], "150px"); assert.equal(classes.has("is-above"), false);
  context.focus.item.y = 118; context.cardKey = "";
  vm.runInContext("placeCard()", context);
  assert.equal(classes.has("is-above"), true, "no room below: card flips above the sprite");
  assert.ok(parseInt(selectionEl.style.top) + 100 <= (118 - 28) * 6, "card sits above the 2× sprite top");
});

test("a press outside the focused sprite leaves focus without also tapping; Back leaves focus too", () => {
  const source = read("js/world/world-explorer.js");
  assert.match(source, /if\(inFocus\(at\.x,at\.y\)\)gesture\.focusTap=true;else\{gesture\.spent=true;showSelection\(null\);\}/);
  assert.match(source, /if\(g\.spent\)return;\s*if\(g\.focusTap&&focus\)\{go\(\);return;\}/);
  assert.match(source, /if\(focus\)\{showSelection\(null\);return true;\}/);
  assert.match(read("index.html"), /Tap GO or tap it again · 點「出發」或再點一次/);
});
