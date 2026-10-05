import assert from 'node:assert/strict';
import { drawDungeonWorld, WIDTH, HEIGHT, DUNGEON_VIEW } from '../js/games/codequest/dungeon-view.js';
import { CodeQuestModel } from '../js/games/codequest/model.js';
import { LEVELS } from '../js/games/codequest/levels.js';
import { legacyLevel } from './fixtures/codequest-legacy-rooms.mjs';
import { CODEQUEST_SPRITE_IDS } from '../js/games/codequest/pixel-art.js';
import { createDungeonRun, normalizeDungeonRun, expeditionLevel } from '../js/games/codequest/run.js';

class FakeContext {
  constructor(){ this.fillStyle=''; this.strokeStyle=''; this.lineWidth=1; this.globalAlpha=1; this.imageSmoothingEnabled=true; this.ops=0; }
  fillRect(){ this.ops++; } save(){ this.ops++; } restore(){ this.ops++; }
  beginPath(){ this.ops++; } moveTo(){ this.ops++; } lineTo(){ this.ops++; }
  closePath(){ this.ops++; } fill(){ this.ops++; } stroke(){ this.ops++; } arc(){ this.ops++; }
}
class FakeCanvas {
  constructor(){ this.width=0; this.height=0; this.ctx=new FakeContext(); }
  getContext(kind){ return kind==='2d' ? this.ctx : null; }
}

for (const sprite of ['bulwark','viper','archer','runeWarden','relicHydra','emberImp','frostMite','antidote','ward','guardCape','alchemistApron','signalCharm','wardenCrest','emberWand','frostScepter','seekerLens','lever-off','lever-on','plate-off','plate-on','rune-gate-closed','rune-gate-open','crate','npc','stairs','circuitGuardian','cycle-trap-active','cycle-trap-safe','push-block','moving-platform','quest-token','rune-core','companion']) {
  assert.equal(CODEQUEST_SPRITE_IDS.includes(sprite), true, 'missing Code Quest sprite ' + sprite);
}

const level = legacyLevel('q20');
const model = new CodeQuestModel(level, { weaponDamage: 1 });
const canvas = new FakeCanvas();
drawDungeonWorld(canvas, model.snapshot(), { time: 1.25, now: 1250, kidColor: '#39d0c8', heroState: 'idle' });
assert.equal(canvas.width, WIDTH);
assert.equal(canvas.height, HEIGHT);
assert.ok(canvas.ctx.ops > 100, 'dungeon renderer should paint a substantial scene');
assert.ok(DUNGEON_VIEW.geometry(model.snapshot()).tileW >= 28);

// Render the telegraphed-archer state from q18.
const signal = new CodeQuestModel(legacyLevel('q18'));
assert.equal(signal.begin(signal.level.reference.main).ok, true);
const move = signal.step(); signal.step();
assert.equal(signal.snapshot().enemies.some(enemy => enemy.intent === 'shot'), true);
drawDungeonWorld(canvas, signal.snapshot(), {
  time: 2, now: 2000, kidColor: '#39d0c8', heroState: 'walk',
  heroMotion: { from: move.before, to: move.after, start: 1900, duration: 300 },
  fx: { kind: 'shot', target: 'hero', start: 1900, duration: 340 }
});

// Render poison + ward + guard states so their canvas paths stay covered.
const statusLevel = { ...legacyLevel('q17'), heroWard: 2 };
const status = new CodeQuestModel(statusLevel);
status.hero.guarding = true;
drawDungeonWorld(canvas, status.snapshot(), { time: 3, now: 3000, kidColor: '#39d0c8', heroState: 'idle', fx: { kind: 'poison', target: 'hero', start: 2900, duration: 360 } });
assert.ok(canvas.ctx.ops > 250, 'v0.3 status rendering should add substantial canvas work');

// Render the v0.5 Rune Warden at boss scale.
const boss = new CodeQuestModel(legacyLevel('q30'));
drawDungeonWorld(canvas, boss.snapshot(), { time: 4, now: 4000, kidColor: '#39d0c8', heroState: 'idle' });
assert.equal(boss.snapshot().enemies[0].type, 'runeWarden');
assert.ok(canvas.ctx.ops > 350, 'v0.5 boss rendering should remain substantial');

// Render v0.6 multi-enemy targeting plus elemental status/FX.
const nexus = new CodeQuestModel(legacyLevel('q33'));
assert.equal(nexus.begin([{ type:'action', op:'targetElementWeak' }, { type:'action', op:'cast' }]).reason, 'missing-concept');
const nexusFree = new CodeQuestModel({ ...legacyLevel('q33'), requires: [], maxBlocks: 96 });
assert.equal(nexusFree.begin([{ type:'action', op:'targetElementWeak' }, { type:'action', op:'cast' }]).ok, true);
const target = nexusFree.step(); const cast = nexusFree.step();
assert.equal(target.type, 'action'); // selector is a visual action card
assert.equal(cast.op, 'cast');
drawDungeonWorld(canvas, nexusFree.snapshot(), { time: 5, now: 5000, kidColor: '#39d0c8', heroState: 'attack', fx: { kind:'fire', target:cast.target, start:4900, duration:420 } });
assert.ok(canvas.ctx.ops > 450, 'v0.6 target ring/elemental rendering should remain substantial');

// Render the inherited v0.7 Relic Hydra with its escort party.
const relicBoss = new CodeQuestModel(legacyLevel('q42'));
drawDungeonWorld(canvas, relicBoss.snapshot(), { time:6, now:6000, kidColor:'#39d0c8', heroState:'idle' });
assert.equal(relicBoss.snapshot().enemies.some(enemy => enemy.type === 'relicHydra'), true);
assert.ok(canvas.ctx.ops > 550, 'v0.7 Relic Hydra party rendering should remain substantial');

// Render the v0.8 connected-run final sanctum through the same renderer/model contract.
const runBoss = normalizeDungeonRun({ ...createDungeonRun('render-run',5), current:'r5', route:['r0','r1b','r2','r3a','r4','r5'], cleared:['r0','r1b','r2','r3a','r4'] });
const runBossModel = new CodeQuestModel(expeditionLevel(runBoss), { weaponDamage:2, spellDamage:4, weaponRange:6, weaponElement:'frost', maxHp:5 });
drawDungeonWorld(canvas, runBossModel.snapshot(), { time:7, now:7000, kidColor:'#39d0c8', heroState:'idle' });
assert.equal(runBossModel.snapshot().enemies.length, 3);
assert.equal(runBossModel.snapshot().enemies.some(enemy=>enemy.type==='circuitGuardian'), true);
assert.equal(runBossModel.snapshot().levers.length, 1);
assert.equal(runBossModel.snapshot().plates.length, 1);
assert.equal(runBossModel.snapshot().runeGates.length, 1);
assert.ok(canvas.ctx.ops > 650, 'v0.10 mechanism expedition sanctum rendering should remain substantial');

// Render the v0.10 Mechanism Depths boss room with every new physical object family.
const mechanism = new CodeQuestModel(legacyLevel('q48'));
drawDungeonWorld(canvas, mechanism.snapshot(), { time:8, now:8000, kidColor:'#39d0c8', heroState:'idle' });
assert.equal(mechanism.snapshot().levers.length, 1);
assert.equal(mechanism.snapshot().plates.length, 1);
assert.equal(mechanism.snapshot().runeGates.length, 1);
assert.equal(mechanism.snapshot().enemies.some(enemy=>enemy.type==='circuitGuardian'), true);
assert.ok(canvas.ctx.ops > 750, 'v0.10 physical mechanism rendering should remain substantial');

// v0.11 renders environmental logic objects in the same angled dungeon projection.
const pushRoom = new CodeQuestModel(legacyLevel('q51'));
drawDungeonWorld(canvas, pushRoom.snapshot(), { time:9, now:9000, kidColor:'#39d0c8', heroState:'idle' });
assert.equal(pushRoom.snapshot().pushBlocks.length, 1);
assert.ok(canvas.ctx.ops > 850, 'v0.11 push-block room should render substantial world detail');

const bridgeRoom = new CodeQuestModel(legacyLevel('q52'));
drawDungeonWorld(canvas, bridgeRoom.snapshot(), { time:10, now:10000, kidColor:'#39d0c8', heroState:'idle' });
assert.equal(bridgeRoom.snapshot().pits.length, 2);
assert.equal(bridgeRoom.snapshot().movingPlatforms.length, 1);
assert.ok(canvas.ctx.ops > 950, 'v0.11 moving bridge/pit rendering should remain substantial');

const questRoom = new CodeQuestModel(legacyLevel('q53'));
drawDungeonWorld(canvas, questRoom.snapshot(), { time:11, now:11000, kidColor:'#39d0c8', heroState:'idle' });
assert.equal(questRoom.snapshot().questTokens.length, 1);
assert.equal(questRoom.snapshot().npcs.length, 1);

const companionRoom = new CodeQuestModel(legacyLevel('q54'));
drawDungeonWorld(canvas, companionRoom.snapshot(), { time:12, now:12000, kidColor:'#39d0c8', heroState:'idle' });
assert.ok(companionRoom.snapshot().companion);
assert.ok(canvas.ctx.ops > 1100, 'v0.11 companion rendering should remain substantial');

// v0.12 renders cooperative actors plus a carryable Rune Core in the same 2.5D scene.
const coopRoom = new CodeQuestModel(legacyLevel('q60'));
drawDungeonWorld(canvas, coopRoom.snapshot(), { time:13, now:13000, kidColor:'#39d0c8', heroState:'idle' });
assert.ok(coopRoom.snapshot().companion);
assert.equal(coopRoom.snapshot().orbs.length, 1);
assert.equal(coopRoom.snapshot().plates.length, 2);
assert.equal(coopRoom.snapshot().runeGates.length, 1);
assert.ok(canvas.ctx.ops > 1200, 'v0.12 cooperative Rune Core room should render substantial world detail');

// v0.13 signal-controlled mechanisms reuse the same rune-gate projection.
const signalRoom = new CodeQuestModel(legacyLevel('q61'));
drawDungeonWorld(canvas, signalRoom.snapshot(), { time:14, now:14000, kidColor:'#39d0c8', heroState:'idle' });
assert.equal(signalRoom.snapshot().runeGates.length, 1);
assert.equal(signalRoom.snapshot().runeGates[0].open, false);
assert.ok(canvas.ctx.ops > 1250, 'v0.13 signal gate room should render substantial world detail');

// v0.14 keeps protocols physical: separated actors, paired gate receiver, rune pulse and state transition FX.
const protocolRoom = new CodeQuestModel(legacyLevel('q70'));
const protocolSnap = protocolRoom.snapshot(), protocolGate = protocolSnap.runeGates[0];
drawDungeonWorld(canvas, protocolSnap, {
  time:15, now:15000, kidColor:'#39d0c8', heroState:'idle',
  fx:{ kind:'signal', actor:'hero', to:'companion', target:protocolGate.id, channel:'ready', start:14900, duration:460 }
});
assert.ok(protocolSnap.companion);
assert.equal(protocolSnap.runeGates.length,1);
assert.ok(canvas.ctx.ops > 1350, 'v0.14 split-corridor signal pulse should add visible protocol work');

const stateBoss = new CodeQuestModel(legacyLevel('q72'));
drawDungeonWorld(canvas, stateBoss.snapshot(), {
  time:16, now:16000, kidColor:'#39d0c8', heroState:'idle',
  fx:{ kind:'state', target:'hero', start:15900, duration:360 }
});
assert.equal(stateBoss.snapshot().hero.state,'explore');
assert.equal(stateBoss.snapshot().companion.state,'wait');
assert.ok(canvas.ctx.ops > 1450, 'v0.14 state-machine boss should render with actor state FX');

console.log('Code Quest v0.14: 2.5D renderer covers state transitions, signal pulses and all inherited cooperative dungeon systems.');

// ---- Redesign slice 01: Code Quest palette + 16 px world atlas ----
import { HEX as PLANET_HEX } from '../js/world/planet-palette.js';
import { CQ_HEX, Q } from '../js/games/codequest/palette.js';
import { spriteSize, spriteBitmap, spriteChars } from '../js/games/codequest/pixel-art.js';
PLANET_HEX.forEach((hex, i) => assert.equal(CQ_HEX[i], hex, 'planet palette index ' + i + ' must not move'));
for (const k of ['deep','stoneDark','stone','stoneMid','stoneLit','warmDark','warm','warmLit','skin','skinShade']) assert.ok(/^#[0-9a-f]{6}$/.test(CQ_HEX[Q[k]]), 'palette key ' + k);
const SIZES = {
  '16x24': ['hero-s-idle','hero-s-walk-1','hero-s-walk-2','hero-s-attack','hero-s-hurt','hero-n-idle','hero-n-walk-1','hero-n-walk-2','hero-n-attack','hero-n-hurt','hero-e-idle','hero-e-walk-1','hero-e-walk-2','hero-e-attack','hero-e-hurt','hero-idle','goblin-0','goblin-1','archer-0','archer-1','bulwark-0','bulwark-1','emberImp-0','emberImp-1','frostMite-0','frostMite-1','companion','npc','npc-helped','door-closed','door-open','rune-gate-closed','rune-gate-open'],
  '16x16': ['slime-0','slime-1','viper-0','viper-1','chest-closed','chest-open','key','trap-active','trap-safe','cycle-trap-active','cycle-trap-safe','lever-off','lever-on','plate-off','plate-on','crate','crate-broken','push-block','moving-platform','quest-token','rune-core','exit','stairs','rubble','skull'],
  '24x24': ['golem-0','golem-1','runeWarden-0','runeWarden-1','circuitGuardian-0','circuitGuardian-1'],
  '32x24': ['relicHydra-0','relicHydra-1'],
  '8x16': ['torch','torch-1','banner']
};
for (const [size, ids] of Object.entries(SIZES)) {
  const [width, height] = size.split('x').map(Number);
  for (const id of ids) {
    assert.ok(CODEQUEST_SPRITE_IDS.includes(id), 'missing world sprite ' + id);
    assert.deepEqual(spriteSize(id), { width, height }, id + ' must be ' + size);
    assert.ok(spriteBitmap(id).every(row => row.length === width), id + ' has a ragged row');
  }
}
for (const id of CODEQUEST_SPRITE_IDS) {
  const chars = spriteChars(id);
  for (const row of spriteBitmap(id)) for (const ch of row) assert.ok(ch === '.' || ch === 'A' || ch === 'a' || ch in chars, id + ' uses unknown colour key ' + ch);
}
console.log('Code Quest redesign atlas: palette + world sprite sizes verified.');

// ---- Redesign slice 02: high 3/4 top-down room renderer ----
import { drawRoom, fitRoom, TILE } from '../js/games/codequest/room-view.js';
for (const dpr of [1, 1.5, 2, 2.625]) {
  const fit = fitRoom({ width: 9, height: 7 }, 1240, 500, dpr);
  assert.equal(fit.device, Math.round(fit.device), 'whole device pixels per art pixel at dpr ' + dpr);
  assert.ok(Math.abs(fit.scale * dpr - fit.device) < 1e-9);
  assert.ok(fit.scale * TILE >= 48, '9×7 room tiles must be ≥ 48 CSS px at dpr ' + dpr + ' (got ' + fit.scale * TILE + ')');
}
assert.ok(fitRoom({ width: 9, height: 7 }, 100, 80, 1).device >= 1, 'tiny boxes still draw at 1×');
class RoomContext extends FakeContext { setTransform(){ this.ops++; } drawImage(){ this.ops++; } }
class RoomCanvas extends FakeCanvas { constructor(){ super(); this.ctx = new RoomContext(); } }
const roomCases = [new CodeQuestModel(LEVELS.find(l => l.id === 'q01')), new CodeQuestModel(LEVELS.find(l => l.id === 'q20')), new CodeQuestModel(LEVELS.find(l => l.id === 'q42')), runBossModel];
for (const m of roomCases) {
  const rc = new RoomCanvas();
  const out = drawRoom(rc, m.snapshot(), { time: 1.5, now: 1500, cssWidth: 900, cssHeight: 420, dpr: 2, kidColor: '#ff5fa2', heroState: 'walk', fx: { kind: 'attack', target: 'hero', start: 1400, duration: 300 }, preview: [{ x: 1, y: 1, dir: 'E' }, { x: 2, y: 1, dir: 'E' }] });
  assert.equal(rc.width, 1800); assert.equal(rc.height, 840);
  assert.ok(rc.ctx.ops > 200, m.level.id + ' room should paint a substantial scene');
  assert.ok(out.anchors.has('hero'), m.level.id + ' hero anchor');
  const h = out.anchors.get('hero');
  assert.ok(h.x > 0 && h.x < 900 && h.y > 0 && h.y < 420, m.level.id + ' hero anchor inside the canvas box');
}
drawRoom(new RoomCanvas(), signal.snapshot(), { time: 2, now: 2000, cssWidth: 640, cssHeight: 360, dpr: 1, reducedMotion: true, paused: true });
console.log('Code Quest redesign room view: fit + projection verified.');

// ---- UX polish slice 07: speech bubble placement ----
import { placeBubbleRect } from '../js/games/codequest/bubble.js';
{
  const box = { w: 1000, h: 400 }, size = { w: 220, h: 60 };
  const hud = [{ x: 10, y: 10, w: 400, h: 44 }, { x: 860, y: 10, w: 130, h: 40 }];
  const inside = r => r.x >= 8 && r.y >= 8 && r.x + size.w <= box.w - 8 && r.y + size.h <= box.h - 8;
  const hits = (r, o) => Math.min(r.x + size.w, o.x + o.w) > Math.max(r.x, o.x) && Math.min(r.y + size.h, o.y + o.h) > Math.max(r.y, o.y);
  // Room for it above: above wins.
  const mid = { box: { x: 480, y: 200, w: 40, h: 60 } };
  assert.equal(placeBubbleRect({ box, size, hero: mid, hard: hud }).side, 'above');
  // Hero on the top row, under the goal pill: never above into the HUD.
  const top = { box: { x: 100, y: 60, w: 40, h: 60 } };
  const t = placeBubbleRect({ box, size, hero: top, hard: hud });
  assert.notEqual(t.side, 'above');
  assert.ok(inside(t) && !hud.concat([top.box]).some(o => hits(t, o)), 'top-row bubble clear of HUD and hero');
  // The tile ahead is soft: above is covered by it, so another clear side wins.
  const ahead = { x: 380, y: 120, w: 240, h: 80 };
  assert.notEqual(placeBubbleRect({ box, size, hero: mid, hard: hud, soft: [ahead] }).side, 'above');
  // Corner with the debug panel open: every pick stays clear of every hard rect.
  const debug = [{ x: 540, y: 60, w: 450, h: 280 }, { x: 930, y: 340, w: 56, h: 52 }];
  const corner = { box: { x: 900, y: 300, w: 40, h: 60 } };
  const c = placeBubbleRect({ box, size, hero: corner, hard: hud.concat(debug) });
  assert.ok(inside(c) && !hud.concat(debug, [corner.box]).some(o => hits(c, o)), 'corner bubble clear: ' + c.side);
  // Nothing fits: caption on the bottom edge, inside the scene.
  const tiny = { w: 260, h: 120 };
  const cap = placeBubbleRect({ box: tiny, size, hero: { box: { x: 110, y: 30, w: 40, h: 60 } } });
  assert.equal(cap.side, 'caption');
  assert.ok(cap.x >= 8 && cap.y >= 8 && cap.y + size.h <= tiny.h - 8 + 1);
  // Sticky: a still-valid previous side survives a one-tile move.
  const moved = { box: { x: 528, y: 200, w: 40, h: 60 } };
  assert.equal(placeBubbleRect({ box, size, hero: moved, hard: hud, previous: 'right' }).side, 'right');
  // Missing hero: caption, never a throw.
  assert.equal(placeBubbleRect({ box, size, hero: null }).side, 'caption');
  // The renderer hands over the hero box and the focus tiles in CSS px.
  const q = new CodeQuestModel(LEVELS.find(l => l.id === 'q01'));
  const out = drawRoom(new RoomCanvas(), q.snapshot(), { time: 1, now: 1000, cssWidth: 900, cssHeight: 420, dpr: 2, preview: [{ x: 1, y: 1, dir: 'E' }] });
  assert.ok(out.heroBox && out.heroBox.w > 0 && out.heroBox.h > out.heroBox.w, 'hero box is an upright sprite box');
  const head = out.anchors.get('hero-head');
  assert.ok(Math.abs(out.heroBox.y - head.y) < 1e-6, 'hero box starts at the head anchor');
  assert.ok(out.focus.length >= 2, 'tile ahead + exit (+ preview) are focus rects');
  assert.ok(out.focus.every(r => r.w > 0 && r.h > 0));
}
console.log('Code Quest UX polish: bubble placement verified.');

// ---- UX polish slice 09: zoom in, pan, x-ray silhouettes ----
{
  const sizes = [[1240, 330], [1240, 520], [900, 420]];
  for (const level of LEVELS) for (const [w, h] of sizes) for (const dpr of [1, 2]) {
    const plain = fitRoom(new CodeQuestModel(level).snapshot(), w, h, dpr);
    const home = fitRoom(new CodeQuestModel(level).snapshot(), w, h, dpr, { zoom: 0, cx: 3, cy: 900 });
    for (const k of ['device', 'ox', 'oy', 'canvasW', 'canvasH']) assert.equal(home[k], plain[k], level.id + ' zoom 0 must equal the whole-room fit (' + k + ')');
  }
  const room = new CodeQuestModel(LEVELS.find(l => l.id === 'q01')).snapshot();
  const base = fitRoom(room, 1240, 330, 1);
  for (const zoom of [1, 2]) {
    const z = fitRoom(room, 1240, 330, 1, { zoom, cx: base.bufW / 2, cy: base.bufH / 2 });
    assert.equal(z.device, base.device + zoom, 'zoom ' + zoom + ' adds whole device pixels');
    // Pan far past every edge: the buffer still covers the canvas on any axis where it is bigger.
    for (const [cx, cy] of [[-999, -999], [999, 999], [-999, 999]]) {
      const p = fitRoom(room, 1240, 330, 1, { zoom, cx, cy });
      const left = p.ox - 4 * p.device, top = p.oy - (4 + 16) * p.device;
      if (p.bufH * p.device > p.canvasH) assert.ok(top <= 0 && top + p.bufH * p.device >= p.canvasH, 'vertical pan clamps (zoom ' + zoom + ')');
      if (p.bufW * p.device > p.canvasW) assert.ok(left <= 0 && left + p.bufW * p.device >= p.canvasW, 'horizontal pan clamps (zoom ' + zoom + ')');
    }
  }
  assert.equal(fitRoom(room, 1240, 330, 1, { zoom: 9 }).zoom, 2, 'zoom is capped at +2');
  assert.equal(fitRoom(room, 1240, 330, 1, { zoom: -3 }).zoom, 0, 'no zooming out past the whole room');
  // X-ray: a key directly north of an interior wall gets its covered outline redrawn.
  let spot = null, xroom = null;
  for (const level of LEVELS) {
    const snap = new CodeQuestModel(level).snapshot(), walls = new Set(snap.walls);
    for (let y = 1; y < snap.height - 2 && !spot; y++) for (let x = 1; x < snap.width - 1 && !spot; x++) {
      if (!walls.has(x + ',' + y) && walls.has(x + ',' + (y + 1)) && !walls.has(x + ',' + (y + 2)) && !(snap.hero.x === x && snap.hero.y === y)) { spot = { x, y }; xroom = snap; }
    }
    if (spot) break;
  }
  assert.ok(spot, 'some authored room has a floor tile north of an interior wall');
  class XrayContext extends RoomContext { constructor(){ super(); this.xray = 0; } fillRect(){ super.fillRect(); if (this.globalAlpha === .6 && this.fillStyle === CQ_HEX[Q.sandLit]) this.xray++; } }
  const xc = new RoomCanvas(); xc.ctx = new XrayContext();
  drawRoom(xc, { ...xroom, keys: [{ id: 'k-x', x: spot.x, y: spot.y, collected: false }] }, { time: 0, now: 0, cssWidth: 900, cssHeight: 420, dpr: 1, reducedMotion: true });
  const without = new RoomCanvas(); without.ctx = new XrayContext();
  drawRoom(without, xroom, { time: 0, now: 0, cssWidth: 900, cssHeight: 420, dpr: 1, reducedMotion: true });
  assert.ok(xc.ctx.xray - without.ctx.xray > 4, 'covered key outline drawn over the wall (' + (xc.ctx.xray - without.ctx.xray) + ' px)');
  const zoomed = drawRoom(new RoomCanvas(), room, { time: 0, now: 0, cssWidth: 900, cssHeight: 420, dpr: 1, camera: { zoom: 1, cx: 0, cy: 0 } });
  assert.equal(zoomed.camera.zoom, 1); assert.ok(zoomed.anchors.has('hero'));
}
console.log('Code Quest UX polish: zoom, pan clamp and x-ray verified.');

// ---- Facing + Rune plan slice 02: facing chevron and turn beat ----
{
  const { facingMarker } = await import('../js/games/codequest/room-view.js');
  const q02 = new CodeQuestModel(LEVELS.find(l => l.id === 'q02'));
  const base = q02.snapshot(), hero = base.hero;
  const at = dir => facingMarker({ ...base, hero: { ...hero, dir } }, { now: 1000 });
  const steps = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  for (const dir of ['N', 'E', 'S', 'W']) {
    const m = at(dir), ax = hero.x + steps[dir][0], ay = hero.y + steps[dir][1];
    assert.ok(m && m.dir === dir, 'marker for ' + dir);
    assert.equal(Math.floor(m.x / TILE), ax, dir + ' marker sits on the tile ahead (x)');
    assert.equal(Math.floor(m.y / TILE), ay, dir + ' marker sits on the tile ahead (y)');
    const walls = new Set(base.walls);
    assert.equal(m.dim, ax < 0 || ay < 0 || ax >= base.width || ay >= base.height || walls.has(ax + ',' + ay), dir + ' dim only against a wall');
  }
  assert.ok([...'NESW'].some(dir => at(dir).dim) && [...'NESW'].some(dir => !at(dir).dim), 'q02 start has both an open and a walled side');
  const motion = { from: { x: hero.x - 1, y: hero.y }, to: { x: hero.x, y: hero.y }, start: 900, duration: 300 };
  assert.equal(facingMarker(base, { now: 1000, heroMotion: motion }), null, 'hidden mid-move');
  assert.ok(facingMarker(base, { now: 1300, heroMotion: motion }), 'back once the move ends');
  const turn = { kind: 'turn', target: 'hero', from: 'E', to: 'S', side: 'right', start: 900, duration: 320 };
  assert.equal(facingMarker(base, { now: 1000, fx: turn }), null, 'hidden mid-turn');
  assert.ok(facingMarker(base, { now: 1000, fx: { ...turn, target: 'companion' } }), 'a companion turn keeps the hero marker');
  assert.equal(facingMarker({ ...base, phase: 'won' }, { now: 1000 }), null, 'hidden once won');
  for (const [dpr, now, reducedMotion] of [[1, 1000, false], [2, 1100, false], [2.625, 1000, true]]) {
    for (const fx of [turn, { ...turn, from: 'S', to: 'E', side: 'left' }, { ...turn, from: 'N', to: 'W', side: 'left' }]) {
      const rc = new RoomCanvas();
      drawRoom(rc, base, { time: now / 1000, now, cssWidth: 900, cssHeight: 420, dpr, reducedMotion, fx });
      assert.ok(rc.ctx.ops > 200, 'turn beat draws at dpr ' + dpr);
    }
  }
  const plain = new RoomCanvas(), marked = new RoomCanvas();
  drawRoom(plain, { ...base, phase: 'won' }, { time: 1, now: 1000, cssWidth: 900, cssHeight: 420, dpr: 1 });
  drawRoom(marked, base, { time: 1, now: 1000, cssWidth: 900, cssHeight: 420, dpr: 1 });
  assert.ok(marked.ctx.ops > plain.ctx.ops + 16, 'the facing chevron paints');
}
console.log('Code Quest facing: chevron placement, hiding and turn beat verified.');
