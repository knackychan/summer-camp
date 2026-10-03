import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { buildAtlas, SPRITES, spritePixels, frameCount } from "../js/world/planet-sprites.js";
import { C, RGBA } from "../js/world/planet-palette.js";

const source = readFileSync(new URL("../js/world/world-explorer.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
function body(name) {
  const at = source.indexOf(`function ${name}(`);
  return source.slice(at, source.indexOf("\n  function ", at + 1));
}

test("sprite variants are rasterised on demand, cached and pixel-identical", (t) => {
  const original = globalThis.document;
  t.after(() => { if (original === undefined) delete globalThis.document; else globalThis.document = original; });
  let canvases = 0;
  globalThis.document = { createElement() {
    canvases++;
    const canvas = { getContext: () => ({
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: (image) => { canvas.pixels = new Uint32Array(image.data.buffer); }
    }) };
    return canvas;
  } };
  const atlas = buildAtlas(C.purple);
  assert.equal(canvases, 0, "creating an atlas does not rasterise hidden art");
  const hero = atlas.hero.normal;
  assert.equal(canvases, frameCount("hero"));
  assert.equal(atlas.hero.normal, hero, "the same frames are reused");
  assert.equal(canvases, frameCount("hero"));
  for (const name of Object.keys(SPRITES)) for (const variant of ["normal", "dark", "sleep"]) {
    const frames = atlas[name][variant];
    for (let f = 0; f < frames.length; f++) {
      const expected = spritePixels(name, f, variant, C.purple);
      assert.equal(frames[f].width, expected.width);
      assert.equal(frames[f].height, expected.height);
      assert.deepEqual(frames[f].pixels, Uint32Array.from(expected.pixels, p => p < 0 ? 0 : RGBA[p]));
    }
  }
});

test("an unchanged world size preserves the rendered globe and backing buffers", () => {
  let allocations = 0;
  const context = {
    mount: { clientWidth: 1024, clientHeight: 768 },
    canvas: { width: 171, height: 128, style: {} }, globeCanvas: {},
    globeImage: {}, globeData: null, scale: 6, bw: 171, bh: 128, cx: 85, cy: 66,
    dirty: false, ctx: {}, minigame: null, window: { devicePixelRatio: 1 },
    gctx: { createImageData: (w, h) => { allocations++; return { data: new Uint8ClampedArray(w * h * 4) }; } }
  };
  vm.createContext(context);
  vm.runInContext(body("resize"), context);
  context.resize();
  assert.equal(allocations, 0);
  assert.equal(context.dirty, false, "resize observer does not invalidate an unchanged frame");
  context.mount.clientWidth = 768; context.mount.clientHeight = 1024;
  context.resize();
  assert.equal(allocations, 1);
  assert.equal(context.dirty, true);
  assert.equal(context.canvas.width, 128);
  assert.equal(context.canvas.height, 171);
});

test("each registry refresh builds one catalog for all landmarks and keeps access current", () => {
  let reads = 0;
  const places = Array.from({ length: 13 }, (_, i) => ({ id: "place:" + i, entry: null }));
  let entries = places.map(mark => ({ id: mark.id, available: true }));
  const context = {
    places, selected: null, dirty: false,
    registry: { list() { reads++; return entries; }, get() { assert.fail("get would rebuild the whole catalog for each landmark"); } }
  };
  vm.createContext(context);
  const start = source.indexOf("function refreshRegistry(");
  vm.runInContext(source.slice(start, source.indexOf("\n  }", start) + 4), context);
  context.refreshRegistry();
  assert.equal(reads, 1);
  assert.ok(places.every(mark => mark.entry.available));
  entries = entries.slice(1).map(entry => ({ ...entry, available: false }));
  context.refreshRegistry();
  assert.equal(reads, 2);
  assert.equal(places[0].entry, null, "removed destinations disappear");
  assert.ok(places.slice(1).every(mark => mark.entry.available === false), "new locks are visible");
  context.registry = { get: id => ({ id, available: true }) };
  context.refreshRegistry();
  assert.ok(places.every(mark => mark.entry.available), "get-only embedders remain supported");
});

test("reduced-motion worlds skip unchanged frames and still redraw interactions", () => {
  let draws = 0, scheduled = 0;
  const context = {
    active: true, last: 0, clock: 0, dirty: false, reduced: true, particles: [], confetti: [],
    minigame: null, focus: null, moon: {}, surface: [], cloudOffset: 0, cloudDrawn: 0, MAP_W: 256,
    frames: 0, raf: 0, clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    requestAnimationFrame: () => ++scheduled, updateMotion() {},
    renderGlobe() { context.dirty = false; }, layout() {}, stepReactions() {}, stepFocus() {}, ambient() {}, stepMinigame() {},
    composite() { draws++; }, pause() { assert.fail("frame should not fail"); }, console, options: {}
  };
  vm.createContext(context);
  vm.runInContext(body("frame"), context);
  context.frame(16);
  assert.equal(draws, 0);
  assert.equal(scheduled, 1, "input can still wake the next animation frame");
  for (const changes of [{ dirty: true }, { particles: [{}] }, { confetti: [{}] }, { surface: [{ react: {} }] }, { moon: { react: {} } }, { minigame: {} }, { focus: {} }, { reduced: false }]) {
    Object.assign(context, { dirty: false, particles: [], confetti: [], surface: [], moon: {}, minigame: null, focus: null, reduced: true }, changes);
    const before = draws;
    context.frame(context.last + 16);
    assert.equal(draws, before + 1, JSON.stringify(changes));
  }
  Object.assign(context, { minigame: {}, dirty: false, goEl: {}, goText: "Go", showSelection() {} });
  vm.runInContext(body("endMinigame"), context);
  context.endMinigame();
  assert.equal(context.dirty, true, "closing a game clears its last frame even with reduced motion");
});
