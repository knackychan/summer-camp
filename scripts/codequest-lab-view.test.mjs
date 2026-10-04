import test from 'node:test';
import assert from 'node:assert/strict';
import { LAB_W, LAB_H, fitLab, drawLab, hitAt } from '../js/games/codequest/lab/lab-view.js';
import { SHELF_IDS, BAG_IDS } from '../js/games/codequest/lab/ingredients.js';
import { CQ_HEX } from '../js/games/codequest/palette.js';

class FakeContext {
  constructor() { this.fillStyle = ''; this.globalAlpha = 1; this.imageSmoothingEnabled = true; this.ops = 0; this.bad = []; }
  fillRect(x, y, w, h) { this.ops++; if (![x, y, w, h].every(Number.isFinite)) this.bad.push([x, y, w, h]); if (!CQ_HEX.includes(this.fillStyle)) this.bad.push(this.fillStyle); }
  setTransform() {} save() {} restore() {}
}
class FakeCanvas {
  constructor() { this.width = 0; this.height = 0; this.ctx = new FakeContext(); }
  getContext(kind) { return kind === '2d' ? this.ctx : null; }
}

// Stage boxes the Lab can get: 1280×600 and 1280×800 screens minus host bar and strip.
const STAGES = [[1280, 440, 1], [1280, 640, 1], [1280, 440, 2], [1024, 520, 1.5]];
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

test('fitLab: whole device pixels, centred, never below 1', () => {
  const fit = fitLab(1280, 440, 1);
  assert.equal(fit.device, 2);
  assert.equal(fit.ox, Math.floor((1280 - LAB_W * 2) / 2));
  assert.equal(fit.oy, Math.floor((440 - LAB_H * 2) / 2));
  assert.equal(fitLab(1280, 640, 1).device, 3);
  assert.equal(fitLab(1280, 440, 2).device, 4);
  assert.equal(fitLab(100, 50, 1).device, 1);
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
