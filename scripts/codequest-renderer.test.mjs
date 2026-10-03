import assert from 'node:assert/strict';
import { drawDungeonWorld, WIDTH, HEIGHT, DUNGEON_VIEW } from '../js/games/codequest/dungeon-view.js';
import { CodeQuestModel } from '../js/games/codequest/model.js';
import { LEVELS } from '../js/games/codequest/levels.js';
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

const level = LEVELS.find(entry => entry.id === 'q20');
const model = new CodeQuestModel(level, { weaponDamage: 1 });
const canvas = new FakeCanvas();
drawDungeonWorld(canvas, model.snapshot(), { time: 1.25, now: 1250, kidColor: '#39d0c8', heroState: 'idle' });
assert.equal(canvas.width, WIDTH);
assert.equal(canvas.height, HEIGHT);
assert.ok(canvas.ctx.ops > 100, 'dungeon renderer should paint a substantial scene');
assert.ok(DUNGEON_VIEW.geometry(model.snapshot()).tileW >= 28);

// Render the telegraphed-archer state from q18.
const signal = new CodeQuestModel(LEVELS.find(entry => entry.id === 'q18'));
assert.equal(signal.begin(signal.level.reference.main).ok, true);
const move = signal.step(); signal.step();
assert.equal(signal.snapshot().enemies.some(enemy => enemy.intent === 'shot'), true);
drawDungeonWorld(canvas, signal.snapshot(), {
  time: 2, now: 2000, kidColor: '#39d0c8', heroState: 'walk',
  heroMotion: { from: move.before, to: move.after, start: 1900, duration: 300 },
  fx: { kind: 'shot', target: 'hero', start: 1900, duration: 340 }
});

// Render poison + ward + guard states so their canvas paths stay covered.
const statusLevel = { ...LEVELS.find(entry => entry.id === 'q17'), heroWard: 2 };
const status = new CodeQuestModel(statusLevel);
status.hero.guarding = true;
drawDungeonWorld(canvas, status.snapshot(), { time: 3, now: 3000, kidColor: '#39d0c8', heroState: 'idle', fx: { kind: 'poison', target: 'hero', start: 2900, duration: 360 } });
assert.ok(canvas.ctx.ops > 250, 'v0.3 status rendering should add substantial canvas work');

// Render the v0.5 Rune Warden at boss scale.
const boss = new CodeQuestModel(LEVELS.find(entry => entry.id === 'q30'));
drawDungeonWorld(canvas, boss.snapshot(), { time: 4, now: 4000, kidColor: '#39d0c8', heroState: 'idle' });
assert.equal(boss.snapshot().enemies[0].type, 'runeWarden');
assert.ok(canvas.ctx.ops > 350, 'v0.5 boss rendering should remain substantial');

// Render v0.6 multi-enemy targeting plus elemental status/FX.
const nexus = new CodeQuestModel(LEVELS.find(entry => entry.id === 'q33'));
assert.equal(nexus.begin([{ type:'action', op:'targetElementWeak' }, { type:'action', op:'cast' }]).reason, 'missing-concept');
const nexusFree = new CodeQuestModel({ ...LEVELS.find(entry => entry.id === 'q33'), requires: [], maxBlocks: 96 });
assert.equal(nexusFree.begin([{ type:'action', op:'targetElementWeak' }, { type:'action', op:'cast' }]).ok, true);
const target = nexusFree.step(); const cast = nexusFree.step();
assert.equal(target.type, 'action'); // selector is a visual action card
assert.equal(cast.op, 'cast');
drawDungeonWorld(canvas, nexusFree.snapshot(), { time: 5, now: 5000, kidColor: '#39d0c8', heroState: 'attack', fx: { kind:'fire', target:cast.target, start:4900, duration:420 } });
assert.ok(canvas.ctx.ops > 450, 'v0.6 target ring/elemental rendering should remain substantial');

// Render the inherited v0.7 Relic Hydra with its escort party.
const relicBoss = new CodeQuestModel(LEVELS.find(entry => entry.id === 'q42'));
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
const mechanism = new CodeQuestModel(LEVELS.find(entry => entry.id === 'q48'));
drawDungeonWorld(canvas, mechanism.snapshot(), { time:8, now:8000, kidColor:'#39d0c8', heroState:'idle' });
assert.equal(mechanism.snapshot().levers.length, 1);
assert.equal(mechanism.snapshot().plates.length, 1);
assert.equal(mechanism.snapshot().runeGates.length, 1);
assert.equal(mechanism.snapshot().enemies.some(enemy=>enemy.type==='circuitGuardian'), true);
assert.ok(canvas.ctx.ops > 750, 'v0.10 physical mechanism rendering should remain substantial');

// v0.11 renders environmental logic objects in the same angled dungeon projection.
const pushRoom = new CodeQuestModel(LEVELS.find(entry => entry.id === 'q51'));
drawDungeonWorld(canvas, pushRoom.snapshot(), { time:9, now:9000, kidColor:'#39d0c8', heroState:'idle' });
assert.equal(pushRoom.snapshot().pushBlocks.length, 1);
assert.ok(canvas.ctx.ops > 850, 'v0.11 push-block room should render substantial world detail');

const bridgeRoom = new CodeQuestModel(LEVELS.find(entry => entry.id === 'q52'));
drawDungeonWorld(canvas, bridgeRoom.snapshot(), { time:10, now:10000, kidColor:'#39d0c8', heroState:'idle' });
assert.equal(bridgeRoom.snapshot().pits.length, 2);
assert.equal(bridgeRoom.snapshot().movingPlatforms.length, 1);
assert.ok(canvas.ctx.ops > 950, 'v0.11 moving bridge/pit rendering should remain substantial');

const questRoom = new CodeQuestModel(LEVELS.find(entry => entry.id === 'q53'));
drawDungeonWorld(canvas, questRoom.snapshot(), { time:11, now:11000, kidColor:'#39d0c8', heroState:'idle' });
assert.equal(questRoom.snapshot().questTokens.length, 1);
assert.equal(questRoom.snapshot().npcs.length, 1);

const companionRoom = new CodeQuestModel(LEVELS.find(entry => entry.id === 'q54'));
drawDungeonWorld(canvas, companionRoom.snapshot(), { time:12, now:12000, kidColor:'#39d0c8', heroState:'idle' });
assert.ok(companionRoom.snapshot().companion);
assert.ok(canvas.ctx.ops > 1100, 'v0.11 companion rendering should remain substantial');

// v0.12 renders cooperative actors plus a carryable Rune Core in the same 2.5D scene.
const coopRoom = new CodeQuestModel(LEVELS.find(entry => entry.id === 'q60'));
drawDungeonWorld(canvas, coopRoom.snapshot(), { time:13, now:13000, kidColor:'#39d0c8', heroState:'idle' });
assert.ok(coopRoom.snapshot().companion);
assert.equal(coopRoom.snapshot().orbs.length, 1);
assert.equal(coopRoom.snapshot().plates.length, 2);
assert.equal(coopRoom.snapshot().runeGates.length, 1);
assert.ok(canvas.ctx.ops > 1200, 'v0.12 cooperative Rune Core room should render substantial world detail');

// v0.13 signal-controlled mechanisms reuse the same rune-gate projection.
const signalRoom = new CodeQuestModel(LEVELS.find(entry => entry.id === 'q61'));
drawDungeonWorld(canvas, signalRoom.snapshot(), { time:14, now:14000, kidColor:'#39d0c8', heroState:'idle' });
assert.equal(signalRoom.snapshot().runeGates.length, 1);
assert.equal(signalRoom.snapshot().runeGates[0].open, false);
assert.ok(canvas.ctx.ops > 1250, 'v0.13 signal gate room should render substantial world detail');

// v0.14 keeps protocols physical: separated actors, paired gate receiver, rune pulse and state transition FX.
const protocolRoom = new CodeQuestModel(LEVELS.find(entry => entry.id === 'q70'));
const protocolSnap = protocolRoom.snapshot(), protocolGate = protocolSnap.runeGates[0];
drawDungeonWorld(canvas, protocolSnap, {
  time:15, now:15000, kidColor:'#39d0c8', heroState:'idle',
  fx:{ kind:'signal', actor:'hero', to:'companion', target:protocolGate.id, channel:'ready', start:14900, duration:460 }
});
assert.ok(protocolSnap.companion);
assert.equal(protocolSnap.runeGates.length,1);
assert.ok(canvas.ctx.ops > 1350, 'v0.14 split-corridor signal pulse should add visible protocol work');

const stateBoss = new CodeQuestModel(LEVELS.find(entry => entry.id === 'q72'));
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
