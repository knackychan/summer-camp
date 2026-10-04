import test from 'node:test';
import assert from 'node:assert/strict';
import { LAB_W, LAB_H, LAB_MAX_W, LAB_MAX_H, fitLab, drawLab, hitAt, labLayout } from '../js/games/codequest/lab/lab-view.js';
import { SHELF_IDS, BAG_IDS } from '../js/games/codequest/lab/ingredients.js';
import { CQ_HEX, Q } from '../js/games/codequest/palette.js';

class FakeContext {
  constructor() { this.fillStyle = ''; this.globalAlpha = 1; this.imageSmoothingEnabled = true; this.ops = 0; this.bad = []; }
  fillRect(x, y, w, h) { this.ops++; if (![x, y, w, h].every(Number.isFinite)) this.bad.push([x, y, w, h]); if (!CQ_HEX.includes(this.fillStyle)) this.bad.push(this.fillStyle); }
  setTransform() {} save() {} restore() {}
}
class FakeCanvas {
  constructor() { this.width = 0; this.height = 0; this.ctx = new FakeContext(); }
  getContext(kind) { return kind === '2d' ? this.ctx : null; }
}

// Stage boxes the Lab can get: 1024×600, 1280×600, 1280×800 and 1366×768 screens minus host bar and strip.
const STAGES = [[1280, 440, 1], [1280, 640, 1], [1280, 440, 2], [1024, 520, 1.5], [1014, 440, 1], [1270, 630, 1], [1270, 630, 1.5], [1356, 560, 1]];
const EXPECTED = [
  ...SHELF_IDS.map(id => 'jar:' + id), ...BAG_IDS.map(id => 'bag:' + id),
  'cauldron', 'prop:grind', 'prop:heat', 'prop:stir', 'prop:cool', 'book', 'scroll', 'owl'
];
const draw = (w, h, dpr, extra = {}) => {
  const canvas = new FakeCanvas();
  const out = drawLab(canvas, { cssWidth: w, cssHeight: h, dpr, time: 1.5, ...extra });
  return { canvas, out };
};
// 0.01 px slack: CSS rects at fractional dpr carry float rounding on shared edges.
const overlap = (a, b, e = 0.01) => a.x < b.x + b.w - e && b.x < a.x + a.w - e && a.y < b.y + b.h - e && b.y < a.y + a.h - e;

test('fitLab: whole device pixels, the room widens to fill the box (capped), centred, never below 1', () => {
  const fit = fitLab(1280, 440, 1);
  assert.equal(fit.device, 2);
  assert.deepEqual([fit.W, fit.H], [LAB_MAX_W, 220]);
  assert.equal(fit.ox, Math.floor((1280 - fit.W * 2) / 2));
  assert.equal(fit.oy, 0);
  assert.equal(fitLab(1280, 640, 1).device, 3);
  assert.equal(fitLab(1280, 440, 2).device, 4);
  assert.equal(fitLab(100, 50, 1).device, 1);
  // 1280×800 at 1× and 1.5×, 1024×600 at 1× (lab-feel design D1 examples).
  const at = (w, h, dpr) => { const f = fitLab(w, h, dpr); return [f.device, f.W, f.H]; };
  assert.deepEqual(at(1270, 630, 1), [3, 423, 210]);
  assert.deepEqual(at(1270, 630, 1.5), [5, 381, 189]);
  assert.deepEqual(at(1014, 440, 1), [2, 480, 220]);
  for (const [w, h, dpr] of STAGES) {
    const f = fitLab(w, h, dpr);
    // Below the caps the room leaves less than one device step of the box on each axis.
    if (f.W < LAB_MAX_W) assert.ok(f.canvasW - f.W * f.device < f.device, w + 'x' + h + '@' + dpr + ' width');
    if (f.H < LAB_MAX_H) assert.ok(f.canvasH - f.H * f.device < f.device, w + 'x' + h + '@' + dpr + ' height');
    assert.ok(f.W >= LAB_W && f.H >= LAB_H && f.W <= LAB_MAX_W && f.H <= LAB_MAX_H);
  }
});

test('labLayout: the core is the old layout; groups pin left, centre and right at every room size', () => {
  const core = labLayout(LAB_W, LAB_H).hits;
  const old = {
    cauldron: [128, 76, 64, 52], 'prop:heat': [136, 129, 48, 24], 'prop:grind': [100, 152, 26, 26], 'prop:stir': [194, 152, 26, 26],
    'prop:cool': [222, 152, 26, 26], scroll: [252, 152, 26, 26], book: [14, 114, 62, 34], owl: [16, 68, 32, 26],
    'jar:redMushroom': [208, 24, 25, 28], 'bag:sunHerb': [2, 152, 24, 26]
  };
  for (const [id, rect] of Object.entries(old)) {
    const hit = core.find(h => h.id === id);
    assert.deepEqual([hit.x, hit.y, hit.w, hit.h], rect, id);
  }
  for (const [W, H] of [[320, 180], [381, 189], [400, 200], [423, 210], [455, 186], [480, 220], [480, 240]]) {
    const { hits } = labLayout(W, H);
    assert.deepEqual(hits.map(h => h.id).sort(), [...EXPECTED].sort());
    for (const hit of hits) {
      assert.ok(Math.min(hit.w, hit.h) >= 24, hit.id);
      assert.ok(hit.x >= 0 && hit.y >= 0 && hit.x + hit.w <= W && hit.y + hit.h <= H, `${hit.id} inside ${W}x${H}`);
    }
    for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) assert.ok(!overlap(hits[i], hits[j]), `${hits[i].id} overlaps ${hits[j].id} at ${W}x${H}`);
    const at = id => hits.find(h => h.id === id);
    assert.equal(at('bag:sunHerb').x, 2, 'left group pinned left');
    assert.equal(at('jar:redMushroom').x, 208 + W - 320, 'right group pinned right');
    assert.equal(at('cauldron').x, 128 + Math.floor((W - 320) / 2), 'centre group centred');
    assert.equal(at('book').y, 114 + H - 180, 'everything sits on the bench');
  }
});

test('the box beyond the room is wall and bench, never the black backdrop', () => {
  for (const [w, h, dpr] of [[1280, 440, 1], [1356, 560, 1], [2000, 500, 1]]) {
    const canvas = new FakeCanvas(), first = [];
    const fillRect = canvas.ctx.fillRect.bind(canvas.ctx);
    canvas.ctx.fillRect = (...rect) => { if (first.length < 2) first.push(canvas.ctx.fillStyle); fillRect(...rect); };
    drawLab(canvas, { cssWidth: w, cssHeight: h, dpr, time: 1 });
    assert.ok(!first.includes(CQ_HEX[Q.deep]), `${w}x${h} backdrop is ${first}`);
  }
});

test('drawLab returns a hit for every interactive object', () => {
  for (const [w, h, dpr] of STAGES) {
    const { canvas, out } = draw(w, h, dpr);
    assert.deepEqual(out.hits.map(hit => hit.id).sort(), [...EXPECTED].sort(), w + 'x' + h);
    assert.equal(canvas.width, Math.round(w * dpr));
    assert.equal(canvas.height, Math.round(h * dpr));
    assert.ok(canvas.ctx.ops > 400, 'scene should paint a substantial picture');
    assert.deepEqual(canvas.ctx.bad, [], 'every fill is a palette colour at a finite rect');
  }
});

test('hit rects never overlap and are tablet-sized (≥ 48 CSS px)', () => {
  for (const [w, h, dpr] of STAGES) {
    const { hits } = draw(w, h, dpr).out;
    for (const hit of hits) {
      assert.ok(Math.min(hit.w, hit.h) >= 48, hit.id + ' is ' + hit.w + '×' + hit.h + ' at ' + w + 'x' + h + '@' + dpr);
      assert.ok(hit.x >= 0 && hit.y >= 0 && hit.x + hit.w <= w + 0.5 && hit.y + hit.h <= h + 0.5, hit.id + ' inside the stage');
    }
    for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) {
      assert.ok(!overlap(hits[i], hits[j]), hits[i].id + ' overlaps ' + hits[j].id);
    }
  }
});

test('hitAt finds the object under a point and nothing in empty wall', () => {
  const { hits } = draw(1280, 440, 1).out;
  const cauldron = hits.find(hit => hit.id === 'cauldron');
  assert.equal(hitAt(hits, cauldron.x + cauldron.w / 2, cauldron.y + cauldron.h / 2).id, 'cauldron');
  assert.equal(hitAt(hits, 1, 1), null);
});

test('hits carry kinds the screen controller dispatches on', () => {
  const { hits } = draw(1280, 440, 1).out;
  const kind = id => hits.find(hit => hit.id === id).kind;
  assert.equal(kind('jar:echoCrystal'), 'jar');
  assert.equal(kind('bag:sunHerb'), 'bag');
  assert.equal(kind('prop:heat'), 'prop');
  assert.equal(hits.find(hit => hit.id === 'jar:echoCrystal').ingredient, 'echoCrystal');
  assert.equal(hits.find(hit => hit.id === 'prop:stir').step, 'stir');
});

test('mix, tint, selection, shake, paused and reduced motion all draw cleanly with the same hits', () => {
  const base = draw(1280, 440, 1).out.hits;
  for (const extra of [
    { mix: ['echoCrystal', 'redMushroom'], tint: 'echo', selection: 'jar:echoCrystal' },
    { mix: ['voidDust', 'emberSeed'], tint: 'space', shaky: true, steps: ['heat'] },
    { paused: true }, { reduced: true, shaky: true }, { time: 9999.75, selection: 'bag:emberRoot' }
  ]) {
    const { canvas, out } = draw(1280, 440, 1, extra);
    assert.deepEqual(canvas.ctx.bad, [], JSON.stringify(extra));
    assert.deepEqual(out.hits, base, JSON.stringify(extra));
  }
});

test('idle life animates, but not while paused or under reduced motion', () => {
  const ops = extra => { const { canvas } = draw(1280, 440, 1, extra); return canvas.ctx.ops; };
  const frames = t => draw(1280, 440, 1, { time: t }).canvas.ctx.ops;
  assert.ok(new Set([0, 0.3, 0.6, 0.9, 1.2, 4.1].map(frames)).size > 1, 'some idle frame differs');
  assert.equal(ops({ paused: true, time: 0.3 }), ops({ paused: true, time: 4.1 }));
  assert.equal(ops({ reduced: true, time: 0.3 }), ops({ reduced: true, time: 4.1 }));
});

/* ---------- slice 05: reaction effects ---------- */
import { FX_IDS, FX_LINGER, FX_BEAT, fxPose } from '../js/games/codequest/lab/lab-fx.js';

const fxDraw = (ruleId, t, extra = {}) => draw(1280, 440, 1, {
  now: 50000 + t, mix: ['echoCrystal', 'redMushroom'], ...extra,
  effect: { ruleId, intensity: extra.intensity || 2, start: 50000, potionId: 'focus', lastIngredient: 'voidDust' }
});

test('every outcome draws at start, mid, end and lingering, with the hits unchanged', () => {
  assert.equal(FX_IDS.length, 19, 'potion + all 18 rules have an effect');
  const base = draw(1280, 440, 1).out.hits;
  for (const id of FX_IDS) for (const intensity of [1, 2, 3]) for (const reduced of [false, true]) {
    for (const t of [0, FX_BEAT / 2, FX_BEAT - 1, FX_BEAT * 3]) {
      const { canvas, out } = fxDraw(id, t, { intensity, reduced });
      assert.deepEqual(canvas.ctx.bad, [], `${id} k=${intensity} t=${t} reduced=${reduced}`);
      assert.deepEqual(out.hits, base, `${id} moved a tap target`);
    }
  }
});

test('each outcome paints something mid-beat; only the lingering ones stay after it', () => {
  const plain = t => draw(1280, 440, 1, { now: 50000 + t, mix: ['echoCrystal', 'redMushroom'] }).canvas.ctx.ops;
  for (const id of FX_IDS) {
    const mid = id === 'fizzle' ? 300 : 900;
    assert.ok(fxDraw(id, mid).canvas.ctx.ops > plain(mid), id + ' shows nothing mid-beat');
    const after = fxDraw(id, FX_BEAT * 3).canvas.ctx.ops, idle = plain(FX_BEAT * 3);
    if (FX_LINGER.includes(id)) assert.ok(after > idle, id + ' should linger');
    else assert.equal(after, idle, id + ' should be gone after its beat');
  }
});

test('reduced motion: no shake, no hop, no leap; the explosion is a puff without the flash', () => {
  for (const id of FX_IDS) for (const t of [0, 120, 400, 800]) {
    const pose = fxPose({ ruleId: id, intensity: 3, start: 0 }, t, true);
    assert.equal(pose.shakeX + pose.shakeY + pose.owlDy + pose.catDy, 0, id + ' moves under reduced motion');
  }
  assert.notEqual(fxPose({ ruleId: 'explosion', intensity: 2 }, 60, false).shakeX, 0);
  assert.ok(fxPose({ ruleId: 'fireball', intensity: 1 }, 450, false).catDy < 0, 'the cat leaps at a fireball');
  assert.equal(fxPose({ ruleId: 'explosion', intensity: 1 }, 9000, true).soot, true, 'soot stays');
  assert.ok(fxDraw('explosion', 50, { reduced: true }).canvas.ctx.ops < fxDraw('explosion', 50).canvas.ctx.ops, 'reduced draws fewer particles');
});

/* ---------- Phase 2 slice 03: ingredient forms and tool use ---------- */
test('every ingredient in every state draws lifted, in the cauldron and with a tool, hits unchanged', () => {
  const base = draw(1280, 440, 1).out.hits;
  for (const id of [...SHELF_IDS, ...BAG_IDS]) for (const state of ['raw', 'crushed', 'heated', 'frozen']) {
    const key = state === 'raw' ? id : id + ':' + state;
    for (const step of ['grind', 'heat', 'cool', 'stir']) for (const reduced of [false, true]) {
      const { canvas, out } = draw(1280, 440, 1, { now: 2000, selection: (SHELF_IDS.includes(id) ? 'jar:' : 'bag:') + id, held: key, mix: [key, 'sunHerb:frozen'], tool: { step, start: 1800 }, reduced });
      assert.deepEqual(canvas.ctx.bad, [], `${key} ${step}`);
      assert.deepEqual(out.hits, base, `${key} moved a tap target`);
    }
  }
});

test('a changed form looks different from the fresh one, and a tool use shows then fades', () => {
  const ops = extra => draw(1280, 440, 1, { now: 2000, ...extra }).canvas.ctx.ops;
  const fresh = ops({ selection: 'jar:redMushroom', held: 'redMushroom' });
  for (const state of ['crushed', 'heated', 'frozen']) assert.notEqual(ops({ selection: 'jar:redMushroom', held: 'redMushroom:' + state }), fresh, state);
  // A frozen bit in the cauldron changes colour, not the number of fills: compare what is painted.
  const fills = extra => {
    const canvas = new FakeCanvas(), log = [], fillRect = canvas.ctx.fillRect.bind(canvas.ctx);
    canvas.ctx.fillRect = (...rect) => { log.push(canvas.ctx.fillStyle + rect.join(',')); fillRect(...rect); };
    drawLab(canvas, { cssWidth: 1280, cssHeight: 440, dpr: 1, now: 2000, ...extra });
    return log.join(';');
  };
  assert.notEqual(fills({ mix: ['redMushroom:frozen'] }), fills({ mix: ['redMushroom'] }));
  assert.ok(ops({ tool: { step: 'cool', start: 1900 } }) > ops({}));
  assert.equal(ops({ tool: { step: 'cool', start: 0 } }), ops({}), 'gone after 600 ms');
});

/* ---------- lab-feel slice 01: effects in the core room and the biggest room ---------- */
test('every effect draws palette-only in a 320×180 and a 480×240 room, hits unchanged', () => {
  for (const [w, h] of [[640, 360], [960, 480]]) {
    const fit = fitLab(w, h, 1), base = draw(w, h, 1).out.hits;
    assert.deepEqual([fit.W, fit.H], w === 640 ? [320, 180] : [480, 240]);
    for (const id of FX_IDS) for (const t of [0, 150, FX_BEAT / 2, FX_BEAT * 3]) {
      const { canvas, out } = draw(w, h, 1, { now: 50000 + t, mix: ['redMushroom'], effect: { ruleId: id, intensity: 3, start: 50000, potionId: 'focus', lastIngredient: 'voidDust' } });
      assert.deepEqual(canvas.ctx.bad, [], `${id} t=${t} at ${w}x${h}`);
      assert.deepEqual(out.hits, base, `${id} moved a tap target`);
    }
  }
});

/* ---------- lab-feel slice 02: depth look ---------- */
import { bayer, ramp, sphereLight, cylinderLight, LAB_LIGHTS } from '../js/games/codequest/lab/lab-art.js';
import { parallaxOf, PARALLAX_MAX } from '../js/games/codequest/lab/lab-view.js';

test('shading helpers: ramp picks only its own palette steps, deterministically; lit sides are brighter', () => {
  const steps = [Q.stoneDark, Q.stone, Q.stoneMid];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    assert.ok(bayer(x, y) > 0 && bayer(x, y) < 1);
    for (const level of [-1, 0, 0.2, 0.5, 0.77, 1, 2]) {
      const a = ramp(level, x, y, steps);
      assert.ok(steps.includes(a) && CQ_HEX[a], `level ${level}`);
      assert.equal(a, ramp(level, x, y, steps));
    }
  }
  assert.equal(ramp(0, 3, 3, steps), Q.stoneDark);
  assert.equal(ramp(1, 3, 3, steps), Q.stoneMid);
  const [mx, my, mz] = LAB_LIGHTS.moon.dir;
  assert.ok(sphereLight(mx, my, mz) > sphereLight(-mx, -my, mz), 'the moon side of a sphere is brighter');
  assert.ok(sphereLight(0, 0.9, 0.4, [LAB_LIGHTS.fire]) > sphereLight(0, -0.9, 0.4, [LAB_LIGHTS.fire]), 'the fire lights from below');
  assert.ok(cylinderLight(-0.6) >= 0 && cylinderLight(0.6) <= 1);
});

test('parallax leans the back layer only: hits never move, reduced motion and pause hold it at 0', () => {
  assert.deepEqual(parallaxOf({ x: 9, y: -9 }, 0, false), { x: PARALLAX_MAX, y: -PARALLAX_MAX });
  assert.deepEqual(parallaxOf({ x: 3, y: 1 }, 0, true), { x: 0, y: 0 });
  const fills = extra => {
    const canvas = new FakeCanvas(), log = [], fillRect = canvas.ctx.fillRect.bind(canvas.ctx);
    let transform = '';
    canvas.ctx.setTransform = (...m) => { transform = m.join(','); };
    canvas.ctx.fillRect = (...rect) => { log.push(transform + '|' + canvas.ctx.fillStyle + rect.join(',')); fillRect(...rect); };
    const out = drawLab(canvas, { cssWidth: 1280, cssHeight: 640, dpr: 1, now: 1500, ...extra });
    return { log: log.join(';'), hits: out.hits, bad: canvas.ctx.bad };
  };
  const plain = fills({}), leaned = fills({ parallax: { x: 4, y: 2 } });
  assert.notEqual(leaned.log, plain.log, 'the back layer moves');
  assert.deepEqual(leaned.hits, plain.hits, 'tap targets stay put');
  assert.deepEqual(leaned.bad, []);
  assert.equal(fills({ reduced: true, parallax: { x: 4, y: 2 } }).log, fills({ reduced: true }).log, 'reduced motion ignores the lean');
  assert.equal(fills({ paused: true, parallax: { x: -4, y: 0 } }).log, fills({ paused: true }).log, 'paused ignores the lean');
});
