import { ProgramRunner } from './interpreter.js';
import { normalizeProgram, normalizeFunctions, combinedBlockCount, containsNodeType, containsElseBranch, containsExpressionType, functionDescriptor } from './ast.js';

const DIRS = Object.freeze({
  N: Object.freeze({ x: 0, y: -1 }), E: Object.freeze({ x: 1, y: 0 }),
  S: Object.freeze({ x: 0, y: 1 }), W: Object.freeze({ x: -1, y: 0 })
});
const LEFT = Object.freeze({ N: 'W', W: 'S', S: 'E', E: 'N' });
const RIGHT = Object.freeze({ N: 'E', E: 'S', S: 'W', W: 'N' });
const ACTOR_STATES = Object.freeze(['explore','defend','attack','regroup','wait','escape']);
const MAX_MESSAGE_QUEUE = 8;
const MAX_TRACE = 32;
const ENEMY_STATS = Object.freeze({
  S: Object.freeze({ type: 'slime', hp: 1, damage: 1, behavior: 'melee', armor: 0 }),
  G: Object.freeze({ type: 'goblin', hp: 2, damage: 1, behavior: 'melee', armor: 0 }),
  O: Object.freeze({ type: 'golem', hp: 4, damage: 2, behavior: 'melee', armor: 0 }),
  B: Object.freeze({ type: 'bulwark', hp: 3, damage: 1, behavior: 'melee', armor: 1 }),
  V: Object.freeze({ type: 'viper', hp: 2, damage: 1, behavior: 'venom', armor: 0 }),
  A: Object.freeze({ type: 'archer', hp: 2, damage: 1, behavior: 'archer', armor: 0, range: 4 }),
  W: Object.freeze({ type: 'runeWarden', hp: 6, damage: 2, behavior: 'warden', armor: 1, range: 4 }),
  F: Object.freeze({ type: 'emberImp', hp: 2, damage: 1, behavior: 'melee', armor: 0, element: 'fire', weakTo: 'frost' }),
  I: Object.freeze({ type: 'frostMite', hp: 2, damage: 1, behavior: 'melee', armor: 0, element: 'frost', weakTo: 'fire' }),
  X: Object.freeze({ type: 'relicHydra', hp: 8, damage: 2, behavior: 'relicBoss', armor: 2, range: 4, element: 'neutral', weakTo: 'frost' }),
  Y: Object.freeze({ type: 'circuitGuardian', hp: 8, damage: 2, behavior: 'mechanismBoss', armor: 2, range: 2, element: 'neutral', weakTo: null })
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function key(x, y) { return x + ',' + y; }
function manhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function bounded(value, min, max, fallback = min) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}

function parseLevel(level) {
  if (!level || !Array.isArray(level.map) || !level.map.length) throw new Error('Code Quest level has no map');
  const width = level.map[0].length, height = level.map.length;
  if (width < 3 || width > 24 || height < 3 || height > 16 || level.map.some(row => typeof row !== 'string' || row.length !== width)) {
    throw new Error('Code Quest level map must be a bounded rectangle');
  }
  let hero = null, companion = null, exit = null, enemyNo = 0, chestNo = 0, doorNo = 0, keyNo = 0, trapNo = 0, cycleTrapNo = 0, leverNo = 0, plateNo = 0, gateNo = 0, crateNo = 0, npcNo = 0, pushNo = 0, tokenNo = 0, orbNo = 0;
  const walls = new Set(), pits = new Set(), enemies = [], chests = [], doors = [], keys = [], traps = [], cycleTraps = [], levers = [], plates = [], runeGates = [], crates = [], npcs = [], pushBlocks = [], questTokens = [], orbs = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = level.map[y][x];
      if (cell === '#') walls.add(key(x, y));
      else if (cell === 'H') hero = { x, y };
      else if (cell === 'c') companion = { x, y };
      else if (cell === 'E') exit = { x, y, kind: 'portal' };
      else if (cell === '>') exit = { x, y, kind: 'stairs' };
      else if (ENEMY_STATS[cell]) {
        const stat = ENEMY_STATS[cell];
        enemies.push({
          id: 'enemy-' + (++enemyNo), type: stat.type, behavior: stat.behavior, x, y,
          hp: stat.hp, maxHp: stat.hp, damage: stat.damage, armor: stat.armor || 0,
          range: stat.range || 1, intent: null, element: stat.element || 'neutral', weakTo: stat.weakTo || null,
          statuses: { burn: 0, freeze: 0 }
        });
      } else if (cell === 'C') chests.push({ id: 'chest-' + (++chestNo), x, y, open: false });
      else if (cell === 'D') doors.push({ id: 'door-' + (++doorNo), x, y, open: false });
      else if (cell === 'K') keys.push({ id: 'key-' + (++keyNo), x, y, collected: false });
      else if (cell === '^') traps.push({ id: 'trap-' + (++trapNo), x, y, disarmed: false });
      else if (cell === 'T') cycleTraps.push({ id: 'cycle-trap-' + (++cycleTrapNo), x, y, period: 2, phase: (cycleTrapNo - 1) % 2 });
      else if (cell === 'L') levers.push({ id: 'lever-' + (++leverNo), x, y, active: false });
      else if (cell === 'P') plates.push({ id: 'plate-' + (++plateNo), x, y, active: false });
      else if (cell === 'Z') runeGates.push({ id: 'rune-gate-' + (++gateNo), x, y, open: false });
      else if (cell === 'Q') crates.push({ id: 'crate-' + (++crateNo), x, y, broken: false });
      else if (cell === 'N') npcs.push({ id: 'npc-' + (++npcNo), x, y, helped: false, questState: 'idle' });
      else if (cell === 'U') pushBlocks.push({ id: 'push-' + (++pushNo), x, y, moved: 0 });
      else if (cell === '*') questTokens.push({ id: 'quest-token-' + (++tokenNo), x, y, collected: false });
      else if (cell === 'o') orbs.push({ id: 'orb-' + (++orbNo), x, y, heldBy: null, throws: 0 });
      else if (cell === '~') pits.add(key(x, y));
    }
  }
  if (!hero) throw new Error('Code Quest level needs H');
  const movingPlatforms = [];
  for (const raw of Array.isArray(level.movingPlatforms) ? level.movingPlatforms.slice(0, 4) : []) {
    const path = (Array.isArray(raw && raw.path) ? raw.path : []).slice(0, 6).map(point => ({ x: bounded(point && point.x, 0, width - 1, 0), y: bounded(point && point.y, 0, height - 1, 0) }));
    if (path.length < 2 || path.some(point => walls.has(key(point.x, point.y)))) continue;
    const startIndex = bounded(raw && raw.startIndex, 0, path.length - 1, 0);
    movingPlatforms.push({ id: 'platform-' + (movingPlatforms.length + 1), path, index: startIndex, x: path[startIndex].x, y: path[startIndex].y, moves: 0 });
  }
  return { width, height, walls, pits, hero, companion, exit, enemies, chests, doors, keys, traps, cycleTraps, levers, plates, runeGates, crates, npcs, pushBlocks, questTokens, orbs, movingPlatforms };
}

export function requirementPresent(program, functions, requirement) {
  const safeFns = normalizeFunctions(functions);
  const bodies = [program, ...Object.values(safeFns).map(value => functionDescriptor(value).body)];
  if (requirement === 'repeat' || requirement === 'if' || requirement === 'call' || requirement === 'let' || requirement === 'return' || requirement === 'target' || requirement === 'forOf' || requirement === 'on' || requirement === 'signal' || requirement === 'state') return bodies.some(body => containsNodeType(body, requirement));
  if (requirement === 'else') return bodies.some(body => containsElseBranch(body));
  if (requirement === 'property') return bodies.some(body => containsExpressionType(body, 'property'));
  if (requirement === 'member') return bodies.some(body => containsExpressionType(body, 'member'));
  if (requirement === 'expression') return bodies.some(body => containsExpressionType(body, 'binary'));
  if (requirement === 'params') return Object.values(safeFns).some(value => functionDescriptor(value).params.length > 0);
  if (requirement === 'companion') {
    let found = false;
    const walk = nodes => { for (const node of normalizeProgram(nodes)) { if ((node.type === 'action' && String(node.op).startsWith('companion')) || (node.type === 'signal' && node.actor === 'companion') || (node.type === 'state' && node.actor === 'companion')) { found = true; return; } if (node.type === 'repeat' || node.type === 'forOf') walk(node.body); else if (node.type === 'if') { walk(node.then); walk(node.else); } if (found) return; } };
    bodies.forEach(body => { if (!found) walk(body); }); return found;
  }
  if (requirement === 'arguments') {
    let found = false;
    const walk = nodes => { for (const node of normalizeProgram(nodes)) { if (node.type === 'call' && node.args && node.args.length) { found = true; return; } if (node.type === 'repeat' || node.type === 'forOf') walk(node.body); else if (node.type === 'if') { walk(node.then); walk(node.else); } if (found) return; } };
    bodies.forEach(body => { if (!found) walk(body); }); return found;
  }
  return true;
}

export class CodeQuestModel {
  constructor(level, options = {}) {
    this.level = level;
    this.weaponDamage = bounded(options.weaponDamage, 1, 9, 1);
    this.spellDamage = bounded(options.spellDamage, 0, 9, bounded(level.practiceSpellDamage, 0, 9, 0));
    this.weaponRange = bounded(options.weaponRange, 1, 6, bounded(level.practiceRange, 1, 6, 1));
    this.weaponElement = ['fire','frost'].includes(options.weaponElement) ? options.weaponElement : (['fire','frost'].includes(level.practiceElement) ? level.practiceElement : 'neutral');
    this.defense = bounded(options.defense, 0, 4, 0);
    this.maxHp = bounded(options.maxHp, 3, 12, 5);
    this.wardBonus = bounded(options.wardBonus, 0, 3, 0);
    this.weaponRarityRank = bounded(options.weaponRarityRank, 1, 4, 1);
    this.weaponAffixCount = bounded(options.weaponAffixCount, 0, 3, 0);
    this.armorRarityRank = bounded(options.armorRarityRank, 0, 4, 0);
    this.charmRarityRank = bounded(options.charmRarityRank, 0, 4, 0);
    this.setBonusCount = bounded(options.setBonusCount, 0, 3, 0);
    this.switchesRequired = bounded(level.switchesRequired, 0, 9, Math.max(0, (level.map || []).join('').split('').filter(ch => ch === 'L' || ch === 'P').length));
    this.circuitMode = ['all','any','exact','odd'].includes(level.circuitMode) ? level.circuitMode : 'all';
    this.toggleLevers = level.toggleLevers === true;
    this.dynamicCircuit = level.dynamicCircuit === true || this.toggleLevers || this.circuitMode !== 'all';
    this.livePlates = level.livePlates === true;
    this.npcReward = ['key','healing','ward'].includes(level.npcReward) ? level.npcReward : 'key';
    this.npcQuest = level.npcQuest === true;
    this.clockStart = bounded(level.clockStart, 0, 1, 0);
    this.runState = Object.freeze({
      sigils:bounded(level.expeditionSigils,0,5,0), roomsCleared:bounded(level.expeditionRoomsCleared,0,13,0),
      coins:bounded(level.expeditionCoins,0,99,0), hazardActive:level.expeditionHazardActive === true
    });
    this.consumables = {
      healing: bounded(options.consumables && options.consumables.healing, 0, 9, 0),
      antidote: bounded(options.consumables && options.consumables.antidote, 0, 9, 0),
      ward: bounded(options.consumables && options.consumables.ward, 0, 9, 0),
      focus: bounded(options.consumables && options.consumables.focus, 0, 9, 0)
    };
    this._start = parseLevel(level);
    this.reset();
  }

  reset() {
    const src = this._start;
    this.hero = {
      x: src.hero.x, y: src.hero.y, dir: DIRS[this.level.heroDir] ? this.level.heroDir : 'E',
      hp: Math.max(1, Math.min(this.maxHp, bounded(this.level.heroHp, 1, this.maxHp, this.maxHp))), maxHp: this.maxHp,
      keys: bounded(this.level.practiceKeys, 0, 9, 0), guarding: false, targetId: null, carrying: null, state: ACTOR_STATES.includes(this.level.heroState) ? this.level.heroState : 'explore',
      statuses: { poison: bounded(this.level.heroPoison, 0, 9, 0), ward: bounded(this.level.heroWard, 0, 9, 0) },
      consumables: {
        healing: Math.min(9, this.consumables.healing + bounded(this.level.practicePotions, 0, 9, 0)),
        antidote: Math.min(9, this.consumables.antidote + bounded(this.level.practiceAntidotes, 0, 9, 0)),
        ward: Math.min(9, this.consumables.ward + bounded(this.level.practiceWards, 0, 9, 0)),
        focus: this.consumables.focus
      },
      practiceConsumables: {
        healing: bounded(this.level.practicePotions, 0, 9, 0),
        antidote: bounded(this.level.practiceAntidotes, 0, 9, 0),
        ward: bounded(this.level.practiceWards, 0, 9, 0), focus: 0
      }
    };
    this.enemies = clone(src.enemies);
    this.chests = clone(src.chests);
    this.doors = clone(src.doors);
    this.keys = clone(src.keys);
    this.traps = clone(src.traps);
    this.cycleTraps = clone(src.cycleTraps);
    this.levers = clone(src.levers);
    this.plates = clone(src.plates);
    this.runeGates = clone(src.runeGates);
    this.crates = clone(src.crates);
    this.npcs = clone(src.npcs);
    this.pushBlocks = clone(src.pushBlocks);
    this.questTokens = clone(src.questTokens);
    this.orbs = clone(src.orbs || []);
    this.movingPlatforms = clone(src.movingPlatforms);
    this.clockPhase = this.clockStart;
    this.companion = src.companion ? { x:src.companion.x, y:src.companion.y, dir:DIRS[this.level.companionDir] ? this.level.companionDir : (DIRS[this.level.heroDir] ? this.level.heroDir : 'E'), mode:'follow', guarding:false, assists:0, carrying:null, state: ACTOR_STATES.includes(this.level.companionState) ? this.level.companionState : 'wait' } : null;
    this.phase = 'programming';
    this.turn = 1;
    this.runner = null;
    this.program = Object.freeze([]);
    this.functions = Object.freeze({});
    this.eventHandlers = Object.create(null);
    this.callbackQueue = []; this.callbackActive = false; this.callbackName = null; this.callbackOwner = null; this.activeMessage = null;
    this.lastSignal = { channel:'none', from:'none', to:'none', id:null }; this.messageQueue = []; this.messageSerial = 0;
    this.signalSequence = []; this.deliveredSignals = []; this.receivedSignalChannels = []; this._deliveredMessageIds = new Set();
    this.traceLog = []; this.traceSerial = 0;
    const gateChannels = Array.isArray(this.level.signalGateChannels) ? this.level.signalGateChannels : (this.level.signalGateChannel ? [this.level.signalGateChannel] : []);
    this.signalGateChannels = [...new Set(gateChannels.filter(channel => ['ready','help','switch','retreat'].includes(channel)).slice(0,4))];
    this.signalGateChannel = this.signalGateChannels.length === 1 ? this.signalGateChannels[0] : null;
    this.lastError = null;
    this.stats = {
      actions: 0, turns: 0, blocked: 0, damageDealt: 0, damageTaken: 0, damageBlocked: 0,
      potionsUsed: 0, antidotesUsed: 0, wardsUsed: 0, guardsUsed: 0,
      chestsOpened: 0, keysCollected: 0, doorsOpened: 0, trapsDisarmed: 0, trapsTriggered: 0,
      poisonTicks: 0, heavyAttacks: 0, casts: 0, targetsSelected: 0, elementalWeakHits: 0,
      burnTicks: 0, frozenTurns: 0, leversActivated: 0, leversDeactivated: 0, platesActivated: 0, runeGatesOpened: 0, runeGatesClosed: 0, cratesBroken: 0, npcsHelped: 0,
      pushes: 0, cycleTrapHits: 0, platformMoves: 0, questTokens: 0, questsStarted: 0, questsCompleted: 0, companionAssists: 0, companionGuards: 0,
      companionMoves: 0, companionInteractions: 0, carries: 0, throws: 0, callbacksRegistered: 0, callbacksTriggered: 0, signalsSent: 0, messagesDropped: 0, stateChanges: 0
    };
    this.sessionLoot = { chests: 0, keys: 0, crates: 0, npcRewards: 0, questTokens: 0 };
    if (this.livePlates) this._refreshLivePlates();
    return this.snapshot();
  }

  _wall(x, y) { return this._start.walls.has(key(x, y)); }
  _enemyAt(x, y) { return this.enemies.find(enemy => enemy.hp > 0 && enemy.x === x && enemy.y === y) || null; }
  _chestAt(x, y) { return this.chests.find(chest => chest.x === x && chest.y === y) || null; }
  _doorAt(x, y) { return this.doors.find(door => door.x === x && door.y === y) || null; }
  _keyAt(x, y) { return this.keys.find(item => !item.collected && item.x === x && item.y === y) || null; }
  _trapAt(x, y) { return this.traps.find(trap => trap.x === x && trap.y === y) || null; }
  _leverAt(x, y) { return this.levers.find(item => item.x === x && item.y === y) || null; }
  _plateAt(x, y) { return this.plates.find(item => item.x === x && item.y === y) || null; }
  _runeGateAt(x, y) { return this.runeGates.find(item => item.x === x && item.y === y) || null; }
  _crateAt(x, y) { return this.crates.find(item => item.x === x && item.y === y) || null; }
  _npcAt(x, y) { return this.npcs.find(item => item.x === x && item.y === y) || null; }
  _cycleTrapAt(x, y) { return this.cycleTraps.find(item => item.x === x && item.y === y) || null; }
  _pushBlockAt(x, y) { return this.pushBlocks.find(item => item.x === x && item.y === y) || null; }
  _questTokenAt(x, y) { return this.questTokens.find(item => !item.collected && item.x === x && item.y === y) || null; }
  _orbAt(x, y) { return this.orbs.find(item => !item.heldBy && item.x === x && item.y === y) || null; }
  _platformAt(x, y) { return this.movingPlatforms.find(item => item.x === x && item.y === y) || null; }
  _activeSwitches() { return this.levers.filter(item => item.active).length + this.plates.filter(item => item.active).length; }
  _plateOccupied(plate) {
    if (!plate) return false;
    if (this.hero && this.hero.x === plate.x && this.hero.y === plate.y) return true;
    if (this.companion && this.companion.x === plate.x && this.companion.y === plate.y) return true;
    if (this.pushBlocks && this.pushBlocks.some(item => item.x === plate.x && item.y === plate.y)) return true;
    if (this.orbs && this.orbs.some(item => !item.heldBy && item.x === plate.x && item.y === plate.y)) return true;
    return false;
  }
  _refreshLivePlates() {
    if (!this.livePlates) return { changed:false, opened:[] };
    let changed = false;
    for (const plate of this.plates) { const next = this._plateOccupied(plate); if (next !== plate.active) { if (next) this.stats.platesActivated++; plate.active = next; changed = true; } }
    const opened = this._refreshRuneGates();
    return { changed, opened };
  }
  _mechanismsReady() {
    const active = this._activeSwitches();
    if (this.switchesRequired <= 0) return true;
    if (this.circuitMode === 'any') return active > 0;
    if (this.circuitMode === 'exact') return active === this.switchesRequired;
    if (this.circuitMode === 'odd') return active > 0 && active % 2 === 1;
    return active >= this.switchesRequired;
  }
  _refreshRuneGates() {
    const ready = this._mechanismsReady(), opened = [];
    for (const gate of this.runeGates) {
      if (ready && !gate.open) { gate.open = true; opened.push(gate.id); this.stats.runeGatesOpened++; }
      else if (this.dynamicCircuit && !ready && gate.open) { gate.open = false; this.stats.runeGatesClosed++; }
    }
    for (const enemy of this.enemies) if (enemy.behavior === 'mechanismBoss' && enemy.hp > 0) enemy.armor = ready ? 0 : 2;
    return opened;
  }
  _activatePlateAt(x, y) {
    const plate = this._plateAt(x, y);
    if (!plate) return null;
    if (this.livePlates) { const state = this._refreshLivePlates(); return plate.active ? { id:plate.id, opened:state.opened } : null; }
    if (plate.active) return null;
    plate.active = true; this.stats.platesActivated++; const opened = this._refreshRuneGates();
    return { id: plate.id, opened };
  }
  _activatePlateAtHero() { return this._activatePlateAt(this.hero.x, this.hero.y); }
  _cycleTrapActive(item) { return !!item && ((this.clockPhase + bounded(item.phase,0,1,0)) % Math.max(2, bounded(item.period,2,4,2)) === 0); }
  _onPlatform() { return !!this._platformAt(this.hero.x, this.hero.y); }
  _blockingAt(x, y, ignoreEnemyId, ignorePushId) {
    if (this._wall(x, y)) return true;
    if (this._start.pits.has(key(x, y)) && !this._platformAt(x, y)) return true;
    const door = this._doorAt(x, y);
    if (door && !door.open) return true;
    const enemy = this._enemyAt(x, y);
    if (enemy && enemy.id !== ignoreEnemyId) return true;
    const chest = this._chestAt(x, y);
    if (chest && !chest.open) return true;
    const gate = this._runeGateAt(x, y); if (gate && !gate.open) return true;
    const crate = this._crateAt(x, y); if (crate && !crate.broken) return true;
    const npc = this._npcAt(x, y); if (npc && !npc.helped && !this.npcQuest) return true;
    const push = this._pushBlockAt(x, y); if (push && push.id !== ignorePushId) return true;
    if (this.companion && this.companion.x === x && this.companion.y === y) return true;
    return false;
  }
  _front() {
    const d = DIRS[this.hero.dir];
    return { x: this.hero.x + d.x, y: this.hero.y + d.y };
  }
  _companionFront() {
    if (!this.companion) return null;
    const d = DIRS[this.companion.dir] || DIRS.E; return { x:this.companion.x+d.x, y:this.companion.y+d.y };
  }
  _syncCarriedOrb(actor) {
    const holder = actor === 'companion' ? this.companion : this.hero; if (!holder || !holder.carrying) return;
    const orb = this.orbs.find(item => item.id === holder.carrying); if (orb) { orb.x = holder.x; orb.y = holder.y; orb.heldBy = actor; }
  }
  _takeOrb(actor) {
    const holder = actor === 'companion' ? this.companion : this.hero; if (!holder) return { result:'no-companion' }; if (holder.carrying) return { result:'already-carrying' };
    const front = actor === 'companion' ? this._companionFront() : this._front(), orb = front ? this._orbAt(front.x,front.y) : null;
    if (!orb) return { result:'no-carryable' }; holder.carrying = orb.id; orb.heldBy = actor; orb.x = holder.x; orb.y = holder.y; this.stats.carries++; if (this.livePlates) this._refreshLivePlates();
    return { result:'taken', target:orb.id };
  }
  _throwOrb(actor) {
    const holder = actor === 'companion' ? this.companion : this.hero; if (!holder) return { result:'no-companion' }; if (!holder.carrying) return { result:'not-carrying' };
    const front = actor === 'companion' ? this._companionFront() : this._front(); if (!front) return { result:'throw-blocked' };
    const occupiedHero = actor === 'companion' && this.hero.x === front.x && this.hero.y === front.y;
    if (occupiedHero || this._blockingAt(front.x,front.y,null,null)) return { result:'throw-blocked', target:holder.carrying };
    const orb = this.orbs.find(item => item.id === holder.carrying); if (!orb) { holder.carrying = null; return { result:'no-carryable' }; }
    orb.heldBy = null; orb.x = front.x; orb.y = front.y; orb.throws = (orb.throws||0)+1; holder.carrying = null; this.stats.throws++; const live = this.livePlates ? this._refreshLivePlates() : null;
    return { result:this._plateAt(front.x,front.y) ? 'thrown-to-plate' : 'thrown', target:orb.id, detail:{ to:{...front}, opened:live ? live.opened : [] } };
  }

  _livingEnemies() {
    return this.enemies.filter(enemy => enemy.hp > 0).sort((a, b) => a.id.localeCompare(b.id));
  }
  _selectedEnemy() {
    return this.hero.targetId ? this.enemies.find(enemy => enemy.id === this.hero.targetId && enemy.hp > 0) || null : null;
  }
  _targetEnemy() {
    const selected = this._selectedEnemy();
    if (selected) return selected;
    const front = this._front(), direct = this._enemyAt(front.x, front.y);
    if (direct) return direct;
    const living = this._livingEnemies().slice();
    living.sort((a, b) => manhattan(a, this.hero) - manhattan(b, this.hero) || a.id.localeCompare(b.id));
    return living[0] || null;
  }
  _enemyByCollectionIndex(index) {
    const living = this._livingEnemies();
    const i = Math.floor(Number(index));
    return Number.isFinite(i) && i >= 0 && i < living.length ? living[i] : null;
  }
  _selectEnemy(enemy) {
    this.hero.targetId = enemy && enemy.hp > 0 ? enemy.id : null;
    if (this.hero.targetId) this.stats.targetsSelected++;
    return enemy || null;
  }

  _trace(kind, data = {}) {
    const entry = Object.freeze({ n: ++this.traceSerial, turn: this.turn, kind, ...data });
    this.traceLog.push(entry); if (this.traceLog.length > MAX_TRACE) this.traceLog.shift(); return entry;
  }

  _registerHandler(event, name, owner = 'main', functions = this.functions, source = 'program') {
    const list = this.eventHandlers[event] || (this.eventHandlers[event] = []);
    if (Object.values(this.eventHandlers).reduce((sum, entries) => sum + entries.length, 0) >= 8) return false;
    if (list.some(entry => entry.name === name && entry.owner === owner && entry.source === source)) return true;
    list.push({ event, name, owner, functions, source });
    this.stats.callbacksRegistered++; this._trace('handler', { event, name, actor:owner, source }); return true;
  }

  _applyState(actor, state) {
    const who = actor === 'companion' ? 'companion' : 'hero';
    const target = who === 'companion' ? this.companion : this.hero;
    if (!target) return { type:'state', actor:who, state, result:'no-companion' };
    const before = target.state; target.state = ACTOR_STATES.includes(state) ? state : before;
    if (before !== target.state) this.stats.stateChanges++;
    this._trace('state', { actor:who, from:before, to:target.state });
    return { type:'state', actor:who, state:target.state, before, result: before === target.state ? 'unchanged' : 'changed' };
  }

  read(path) {
    const enemy = this._targetEnemy(), target = this._selectedEnemy() || enemy, living = this._livingEnemies();
    if (path === 'hero.hp') return this.hero.hp;
    if (path === 'hero.maxHp') return this.hero.maxHp;
    if (path === 'hero.keys') return this.hero.keys;
    if (path === 'hero.weapon.damage') return this.weaponDamage;
    if (path === 'hero.weapon.range') return this.weaponRange;
    if (path === 'hero.weapon.spellDamage') return this.spellDamage;
    if (path === 'hero.weapon.element') return this.weaponElement;
    if (path === 'hero.weapon.rarityRank') return this.weaponRarityRank;
    if (path === 'hero.weapon.affixCount') return this.weaponAffixCount;
    if (path === 'hero.build.synergyCount') return this.setBonusCount;
    if (path === 'hero.armor.defense') return this.defense;
    if (path === 'hero.armor.rarityRank') return this.armorRarityRank;
    if (path === 'hero.charm.rarityRank') return this.charmRarityRank;
    if (path === 'hero.inventory.healing') return this.hero.consumables.healing;
    if (path === 'hero.inventory.focus') return this.hero.consumables.focus;
    if (path === 'hero.inventory.antidote') return this.hero.consumables.antidote;
    if (path === 'hero.inventory.ward') return this.hero.consumables.ward;
    if (path === 'hero.run.sigils') return this.runState.sigils;
    if (path === 'hero.run.roomsCleared') return this.runState.roomsCleared;
    if (path === 'hero.run.coins') return this.runState.coins;
    if (path === 'hero.run.hazardActive') return this.runState.hazardActive;
    if (path === 'hero.world.switchesActive') return this._activeSwitches();
    if (path === 'hero.world.switchesRequired') return this.switchesRequired;
    if (path === 'hero.world.circuitSatisfied') return this._mechanismsReady();
    if (path === 'hero.world.gatesOpen') return this.runeGates.filter(item => item.open).length;
    if (path === 'hero.world.cratesRemaining') return this.crates.filter(item => !item.broken).length;
    if (path === 'hero.world.npcsHelped') return this.npcs.filter(item => item.helped).length;
    if (path === 'hero.world.pushablesMoved') return this.stats.pushes;
    if (path === 'hero.world.pushablesOnPlates') return this.pushBlocks.filter(item => !!this._plateAt(item.x,item.y)).length;
    if (path === 'hero.world.clockPhase') return this.clockPhase;
    if (path === 'hero.world.activeCycleTraps') return this.cycleTraps.filter(item => this._cycleTrapActive(item)).length;
    if (path === 'hero.world.platformPhase') return this.movingPlatforms.length ? this.movingPlatforms[0].index : 0;
    if (path === 'hero.world.questsStarted') return this.npcs.filter(item => item.questState === 'started' || item.questState === 'complete').length;
    if (path === 'hero.world.questTokens') return this.questTokens.filter(item => item.collected).length;
    if (path === 'hero.world.questsCompleted') return this.npcs.filter(item => item.questState === 'complete').length;
    if (path === 'hero.world.orbsRemaining') return this.orbs.filter(item => !item.heldBy).length;
    if (path === 'hero.world.orbsOnPlates') return this.orbs.filter(item => !item.heldBy && !!this._plateAt(item.x,item.y)).length;
    if (path === 'hero.world.livePlates') return this.plates.filter(item => item.active).length;
    if (path === 'hero.world.callbacksTriggered') return this.stats.callbacksTriggered;
    if (path === 'hero.state') return this.hero.state;
    if (path === 'hero.signal.last') return this.lastSignal.channel;
    if (path === 'hero.signal.from') return this.lastSignal.from;
    if (path === 'hero.signal.count') return this.stats.signalsSent;
    if (path === 'hero.signal.pending') return this.messageQueue.filter(item => item.to === 'hero').length;
    if (path === 'companion.state') return this.companion ? this.companion.state : 'wait';
    if (path === 'companion.signal.last') return this.lastSignal.channel;
    if (path === 'companion.signal.from') return this.lastSignal.from;
    if (path === 'companion.signal.count') return this.stats.signalsSent;
    if (path === 'companion.signal.pending') return this.messageQueue.filter(item => item.to === 'companion').length;
    if (path === 'hero.carrying') return this.hero.carrying || 'none';
    if (path === 'companion.mode') return this.companion ? this.companion.mode : 'none';
    if (path === 'companion.dir') return this.companion ? this.companion.dir : 'none';
    if (path === 'companion.distance') return this.companion ? manhattan(this.companion,this.hero) : 99;
    if (path === 'companion.guarding') return !!(this.companion && this.companion.guarding);
    if (path === 'companion.assists') return this.companion ? this.companion.assists : 0;
    if (path === 'companion.carrying') return this.companion && this.companion.carrying ? this.companion.carrying : 'none';
    if (path === 'hero.target.hp') return target ? target.hp : 0;
    if (path === 'hero.target.maxHp') return target ? target.maxHp : 0;
    if (path === 'hero.target.armor') return target ? target.armor || 0 : 0;
    if (path === 'hero.target.distance') return target ? manhattan(target, this.hero) : 99;
    if (path === 'hero.target.element') return target ? target.element || 'neutral' : 'none';
    if (path === 'enemy.hp') return enemy ? enemy.hp : 0;
    if (path === 'enemy.maxHp') return enemy ? enemy.maxHp : 0;
    if (path === 'enemy.armor') return enemy ? enemy.armor || 0 : 0;
    if (path === 'enemy.distance') return enemy ? manhattan(enemy, this.hero) : 99;
    if (path === 'enemy.incoming') return !!(enemy && enemy.intent === 'shot');
    if (path === 'enemy.element') return enemy ? enemy.element || 'neutral' : 'none';
    if (path === 'enemies.length') return living.length;
    if (path === 'enemies.armoredCount') return living.filter(entry => (entry.armor || 0) > 0).length;
    if (path === 'enemies.weakCount') return living.filter(entry => entry.hp <= Math.max(1, this.weaponDamage)).length;
    if (path === 'enemies.burningCount') return living.filter(entry => entry.statuses && entry.statuses.burn > 0).length;
    if (path === 'enemies.frozenCount') return living.filter(entry => entry.statuses && entry.statuses.freeze > 0).length;
    const indexed = /^enemies\.(\d+)\.(hp|maxHp|armor|distance|element|alive)$/.exec(path);
    if (indexed) {
      const entry = this._enemyByCollectionIndex(Number(indexed[1]));
      if (!entry) return indexed[2] === 'alive' ? false : indexed[2] === 'element' ? 'none' : 0;
      if (indexed[2] === 'distance') return manhattan(entry, this.hero);
      if (indexed[2] === 'alive') return entry.hp > 0;
      return indexed[2] === 'armor' ? entry.armor || 0 : entry[indexed[2]];
    }
    return 0;
  }


  collection(name) {
    if (name !== 'enemies') return Object.freeze([]);
    return Object.freeze(this._livingEnemies().slice(0, 4).map(enemy => Object.freeze({
      id: enemy.id, hp: enemy.hp, maxHp: enemy.maxHp, armor: enemy.armor || 0,
      distance: manhattan(enemy, this.hero), element: enemy.element || 'neutral', alive: enemy.hp > 0,
      weakTo: enemy.weakTo || 'none', burning: !!(enemy.statuses && enemy.statuses.burn > 0),
      frozen: !!(enemy.statuses && enemy.statuses.freeze > 0)
    })));
  }

  test(condition) {
    const front = this._front(), enemy = this._enemyAt(front.x, front.y);
    if (condition === 'enemyAhead') return !!enemy;
    if (condition === 'enemyArmoredAhead') return !!(enemy && enemy.armor > 0);
    if (condition === 'enemyWeakAhead') return !!(enemy && enemy.hp <= Math.max(1, this.weaponDamage));
    if (condition === 'dangerIncoming') return this.enemies.some(entry => entry.hp > 0 && entry.intent === 'shot');
    if (condition === 'heroPoisoned') return this.hero.statuses.poison > 0;
    if (condition === 'chestAhead') { const chest = this._chestAt(front.x, front.y); return !!(chest && !chest.open); }
    if (condition === 'doorAhead') { const door = this._doorAt(front.x, front.y); return !!(door && !door.open); }
    if (condition === 'trapAhead') { const trap = this._trapAt(front.x, front.y); return !!(trap && !trap.disarmed); }
    if (condition === 'blockedAhead') return this._blockingAt(front.x, front.y);
    if (condition === 'hasKey') return this.hero.keys > 0;
    if (condition === 'hpLow') return this.hero.hp <= this.hero.maxHp / 2;
    if (condition === 'onExit') return !!this._start.exit && this.hero.x === this._start.exit.x && this.hero.y === this._start.exit.y;
    if (condition === 'leverAhead') { const item = this._leverAt(front.x, front.y); return !!(item && (this.toggleLevers || !item.active)); }
    if (condition === 'breakableAhead') { const item = this._crateAt(front.x, front.y); return !!(item && !item.broken); }
    if (condition === 'npcAhead') { const item = this._npcAt(front.x, front.y); return !!(item && (!item.helped || this.npcQuest)); }
    if (condition === 'runeGateAhead') { const item = this._runeGateAt(front.x, front.y); return !!(item && !item.open); }
    if (condition === 'pushableAhead') return !!this._pushBlockAt(front.x, front.y);
    if (condition === 'cycleTrapAhead') return !!this._cycleTrapAt(front.x, front.y);
    if (condition === 'cycleTrapActiveAhead') { const item = this._cycleTrapAt(front.x, front.y); return this._cycleTrapActive(item); }
    if (condition === 'platformAhead') return !!this._platformAt(front.x, front.y);
    if (condition === 'onPlatform') return this._onPlatform();
    if (condition === 'questTokenAhead') return !!this._questTokenAt(front.x, front.y);
    if (condition === 'companionNear') return !!this.companion && manhattan(this.companion,this.hero) <= 1;
    if (condition === 'carryableAhead') { const p=this._front(); return !!this._orbAt(p.x,p.y); }
    if (condition === 'heroCarrying') return !!this.hero.carrying;
    if (condition === 'heroOnPlate') return !!this._plateAt(this.hero.x,this.hero.y);
    if (condition === 'companionCarryableAhead') { const p=this._companionFront(); return !!(p && this._orbAt(p.x,p.y)); }
    if (condition === 'companionCarrying') return !!(this.companion && this.companion.carrying);
    if (condition === 'companionOnPlate') return !!(this.companion && this._plateAt(this.companion.x,this.companion.y));
    const target = this._selectedEnemy() || this._targetEnemy();
    if (condition === 'multipleEnemies') return this._livingEnemies().length > 1;
    if (condition === 'targetInRange') return !!target && manhattan(target, this.hero) <= this.weaponRange;
    if (condition === 'targetWeak') return !!target && target.hp <= Math.max(1, this.spellDamage || this.weaponDamage);
    if (condition === 'targetArmored') return !!target && (target.armor || 0) > 0;
    if (condition === 'targetElementWeak') return !!target && target.weakTo === this.weaponElement;
    return false;
  }

  objectiveComplete() {
    const objective = this.level.objective || {};
    if (objective.reachExit && !this.test('onExit')) return false;
    if (objective.defeatAll && this.enemies.some(enemy => enemy.hp > 0)) return false;
    if (objective.openAllChests && this.chests.some(chest => !chest.open)) return false;
    if (objective.unlockAllDoors && this.doors.some(door => !door.open)) return false;
    if (objective.disarmAllTraps && this.traps.some(trap => !trap.disarmed)) return false;
    if (objective.activateAllLevers && this.levers.some(item => !item.active)) return false;
    if (objective.activateAllPlates && this.plates.some(item => !item.active)) return false;
    if (objective.openAllRuneGates && this.runeGates.some(item => !item.open)) return false;
    if (objective.satisfyCircuit && !this._mechanismsReady()) return false;
    if (objective.breakAllCrates && this.crates.some(item => !item.broken)) return false;
    if (objective.helpAllNpcs && this.npcs.some(item => !item.helped)) return false;
    if (objective.pushAllOntoPlates && this.pushBlocks.some(item => !this._plateAt(item.x,item.y))) return false;
    if (objective.collectAllQuestTokens && this.questTokens.some(item => !item.collected)) return false;
    if (objective.completeNpcQuests && this.npcs.some(item => item.questState !== 'complete')) return false;
    if (objective.companionAssists && this.stats.companionAssists < objective.companionAssists) return false;
    if (objective.companionMoves && this.stats.companionMoves < objective.companionMoves) return false;
    if (objective.placeAllOrbsOnPlates && this.orbs.some(item => item.heldBy || !this._plateAt(item.x,item.y))) return false;
    if (objective.callbacksTriggered && this.stats.callbacksTriggered < objective.callbacksTriggered) return false;
    if (objective.signalsSent && this.stats.signalsSent < objective.signalsSent) return false;
    if (objective.signalChannel && this.lastSignal.channel !== objective.signalChannel) return false;
    if (objective.stateChanges && this.stats.stateChanges < objective.stateChanges) return false;
    if (objective.heroState && this.hero.state !== objective.heroState) return false;
    if (objective.companionState && (!this.companion || this.companion.state !== objective.companionState)) return false;
    if (objective.companionInteractions && this.stats.companionInteractions < objective.companionInteractions) return false;
    if (Array.isArray(objective.messageSequence)) { const expected=objective.messageSequence; if (this.deliveredSignals.length < expected.length || expected.some((value,index)=>this.deliveredSignals[index] !== value)) return false; }
    if (objective.collectAllKeys && this.keys.some(item => !item.collected)) return false;
    if (objective.minHp && this.hero.hp < objective.minHp) return false;
    if (objective.finishUnpoisoned && this.hero.statuses.poison > 0) return false;
    if (objective.surviveTurns && this.stats.turns < objective.surviveTurns) return false;
    return !!Object.keys(objective).length;
  }

  begin(program, functions = {}, behaviors = []) {
    if (this.phase === 'won' || this.phase === 'resting') return { ok: false, reason: this.phase };
    const safeProgram = normalizeProgram(program), safeFunctions = normalizeFunctions(functions);
    if (!safeProgram.length) return { ok: false, reason: 'empty-program' };
    const blocks = combinedBlockCount(safeProgram, safeFunctions);
    if (blocks > (this.level.maxBlocks || 96)) return { ok: false, reason: 'too-many-blocks', blocks, maxBlocks: this.level.maxBlocks || 96 };
    for (const required of this.level.requires || []) {
      if (!requirementPresent(safeProgram, safeFunctions, required)) return { ok: false, reason: 'missing-concept', concept: required };
    }
    this.program = safeProgram;
    this.functions = safeFunctions;
    this.eventHandlers = Object.create(null); this.callbackQueue = []; this.callbackActive = false; this.callbackName = null; this.callbackOwner = null; this.activeMessage = null;
    for (const raw of Array.isArray(behaviors) ? behaviors.slice(0,2) : []) {
      const owner = raw && raw.owner === 'companion' ? 'companion' : 'hero';
      const behaviorProgram = normalizeProgram(raw && raw.program), behaviorFunctions = normalizeFunctions(raw && raw.functions);
      if (!behaviorProgram.length || behaviorProgram.some(node => node.type !== 'on')) continue;
      for (const node of behaviorProgram) {
        const desc = functionDescriptor(behaviorFunctions[node.name]); if (!desc.body.length || desc.params.length) continue;
        this._registerHandler(node.event, node.name, owner, behaviorFunctions, 'persistent');
      }
    }
    this.runner = new ProgramRunner(safeProgram, safeFunctions, { budget: 384 });
    this.phase = 'executing';
    this.lastError = null; this._trace('program', { actor:'main', blocks });
    return { ok: true, blocks };
  }

  _collectKeyAtHero() {
    const item = this._keyAt(this.hero.x, this.hero.y);
    if (!item) return null;
    item.collected = true; this.hero.keys = Math.min(9, this.hero.keys + 1);
    this.stats.keysCollected++; this.sessionLoot.keys++; return item.id;
  }
  _collectQuestTokenAtHero() {
    const item = this._questTokenAt(this.hero.x, this.hero.y);
    if (!item) return null;
    item.collected = true; this.stats.questTokens++; this.sessionLoot.questTokens++;
    return item.id;
  }
  _triggerTrapAtHero() {
    const trap = this._trapAt(this.hero.x, this.hero.y);
    if (trap && !trap.disarmed) {
      const hit = this._hurtHero(1, 'trap', false); this.stats.trapsTriggered++;
      return { id: trap.id, damage: hit.damage, blocked: hit.blocked };
    }
    const cycle = this._cycleTrapAt(this.hero.x, this.hero.y);
    if (!cycle || !this._cycleTrapActive(cycle)) return null;
    const hit = this._hurtHero(1, 'cycle-trap', false); this.stats.cycleTrapHits++;
    return { id: cycle.id, damage: hit.damage, blocked: hit.blocked, cycle:true };
  }
  _consume(item) {
    if (!this.hero.consumables[item]) return null;
    this.hero.consumables[item]--;
    let source = 'inventory';
    if (this.hero.practiceConsumables[item] > 0) { this.hero.practiceConsumables[item]--; source = 'practice'; }
    return { item, source };
  }

  _applyTargetId(id) {
    const before = this._heroView();
    const enemy = this.enemies.find(entry => entry.hp > 0 && entry.id === id) || null;
    this._selectEnemy(enemy);
    return { type: 'target-ref', id, result: enemy ? 'targeted' : 'no-target', target: enemy ? enemy.id : null, before, after: this._heroView() };
  }

  _applyTarget(index) {
    const before = this._heroView();
    const enemy = this._enemyByCollectionIndex(index);
    this._selectEnemy(enemy);
    return {
      type: 'target', index, result: enemy ? 'targeted' : 'no-target',
      target: enemy ? enemy.id : null, before, after: this._heroView()
    };
  }

  _hurtHero(base, source, mitigated = true) {
    const guard = mitigated && this.hero.guarding ? 1 : 0;
    const companionGuard = mitigated && this.companion && this.companion.guarding ? 1 : 0;
    const ward = mitigated && this.hero.statuses.ward > 0 ? 1 : 0;
    const defense = mitigated ? this.defense : 0;
    const damage = Math.max(0, Math.min(this.hero.hp, Math.max(0, base - defense - guard - companionGuard - ward)));
    const blocked = Math.max(0, base - damage);
    this.hero.hp = Math.max(0, this.hero.hp - damage);
    if (companionGuard && blocked > 0) this.companion.guarding = false;
    this.stats.damageTaken += damage; this.stats.damageBlocked += blocked;
    return { damage, blocked, source };
  }

  _applyAction(op) {
    const before = this._heroView();
    let result = 'ok', target = null, detail = null;
    if (op === 'move') {
      const front = this._front();
      if (this._blockingAt(front.x, front.y)) { result = 'blocked'; this.stats.blocked++; }
      else {
        const previous = { x:this.hero.x, y:this.hero.y };
        this.hero.x = front.x; this.hero.y = front.y;
        if (this.companion && this.companion.mode === 'follow') { this.companion.x = previous.x; this.companion.y = previous.y; this._syncCarriedOrb('companion'); }
        this._syncCarriedOrb('hero'); if (this.livePlates) this._refreshLivePlates();
        const collected = this._collectKeyAtHero(), questToken = this._collectQuestTokenAtHero(), trap = this._triggerTrapAtHero(), plate = this._activatePlateAtHero();
        if (trap) { result = 'trap-hit'; target = trap.id; detail = trap; }
        else if (collected) { result = 'key-collected'; target = collected; }
        else if (questToken) { result = 'quest-token-collected'; target = questToken; }
        else if (plate) { result = 'plate-activated'; target = plate.id; detail = plate; }
      }
    } else if (op === 'turnLeft') this.hero.dir = LEFT[this.hero.dir];
    else if (op === 'turnRight') this.hero.dir = RIGHT[this.hero.dir];
    else if (op === 'attack' || op === 'heavyAttack') {
      const front = this._front(), enemy = this._enemyAt(front.x, front.y);
      if (!enemy) result = 'no-target';
      else {
        target = enemy.id;
        if (enemy.behavior === 'relicBoss') enemy.armor = this._livingEnemies().some(entry => entry.id !== enemy.id) ? 2 : 0;
        if (enemy.behavior === 'mechanismBoss') enemy.armor = this._mechanismsReady() ? 0 : 2;
        const raw = op === 'heavyAttack' ? this.weaponDamage + 1 : this.weaponDamage;
        const effective = op === 'heavyAttack' ? raw : Math.max(0, raw - (enemy.armor || 0));
        const damage = Math.min(enemy.hp, effective);
        enemy.hp = Math.max(0, enemy.hp - effective);
        if (enemy.behavior === 'warden') enemy.armor = enemy.hp > 4 ? 1 : 0;
        this.stats.damageDealt += damage;
        if (op === 'heavyAttack') this.stats.heavyAttacks++;
        detail = { damage, armor: enemy.armor || 0 };
        result = effective <= 0 ? 'armored' : enemy.hp <= 0 ? 'defeated' : 'hit';
      }
    } else if (op === 'targetNearest' || op === 'targetWeakest' || op === 'targetArmored' || op === 'targetElementWeak') {
      const living = this._livingEnemies().slice();
      let enemy = null;
      if (op === 'targetNearest') enemy = living.sort((a,b) => manhattan(a,this.hero)-manhattan(b,this.hero) || a.id.localeCompare(b.id))[0] || null;
      else if (op === 'targetWeakest') enemy = living.sort((a,b) => a.hp-b.hp || manhattan(a,this.hero)-manhattan(b,this.hero) || a.id.localeCompare(b.id))[0] || null;
      else if (op === 'targetArmored') enemy = living.filter(entry => (entry.armor||0)>0).sort((a,b)=>manhattan(a,this.hero)-manhattan(b,this.hero)||a.id.localeCompare(b.id))[0] || null;
      else enemy = living.filter(entry => entry.weakTo === this.weaponElement).sort((a,b)=>manhattan(a,this.hero)-manhattan(b,this.hero)||a.id.localeCompare(b.id))[0] || null;
      this._selectEnemy(enemy); target = enemy ? enemy.id : null; result = enemy ? 'targeted' : 'no-target';
    } else if (op === 'cast') {
      const enemy = this._selectedEnemy() || this._targetEnemy();
      if (!enemy) result = 'no-target';
      else if (this.spellDamage <= 0 || this.weaponRange <= 1 && this.weaponElement === 'neutral') { result = 'no-magic'; target = enemy.id; }
      else if (manhattan(enemy, this.hero) > this.weaponRange) { result = 'out-of-range'; target = enemy.id; }
      else {
        target = enemy.id;
        if (enemy.behavior === 'relicBoss') enemy.armor = this._livingEnemies().some(entry => entry.id !== enemy.id) ? 2 : 0;
        if (enemy.behavior === 'mechanismBoss') enemy.armor = this._mechanismsReady() ? 0 : 2;
        let effective = Math.max(1, this.spellDamage || 1), elemental = 'normal';
        if (enemy.weakTo && enemy.weakTo === this.weaponElement) { effective += 1; elemental = 'weak'; this.stats.elementalWeakHits++; }
        if ((enemy.behavior === 'relicBoss' || enemy.behavior === 'mechanismBoss') && enemy.armor > 0) { effective = Math.max(0, effective - enemy.armor); elemental = 'shielded'; }
        else if (enemy.element && enemy.element === this.weaponElement && this.weaponElement !== 'neutral') { effective = Math.max(0, effective - 1); elemental = 'resist'; }
        const damage = Math.min(enemy.hp, effective); enemy.hp = Math.max(0, enemy.hp - effective);
        if (enemy.hp > 0 && this.weaponElement === 'fire') enemy.statuses.burn = Math.max(enemy.statuses.burn || 0, 2);
        if (enemy.hp > 0 && this.weaponElement === 'frost') enemy.statuses.freeze = Math.max(enemy.statuses.freeze || 0, 1);
        this.stats.damageDealt += damage; this.stats.casts++;
        detail = { damage, element: this.weaponElement, elemental, range: this.weaponRange };
        result = effective <= 0 ? 'resisted' : enemy.hp <= 0 ? 'defeated' : elemental === 'weak' ? 'element-weak' : elemental === 'resist' ? 'element-resist' : 'hit';
      }
    } else if (op === 'guard') {
      this.hero.guarding = true; this.stats.guardsUsed++; result = 'guarding';
    } else if (op === 'open') {
      const front = this._front(), chest = this._chestAt(front.x, front.y), door = this._doorAt(front.x, front.y);
      if (chest) {
        if (chest.open) result = 'already-open';
        else { chest.open = true; target = chest.id; this.stats.chestsOpened++; this.sessionLoot.chests++; result = 'opened'; }
      } else if (door) {
        if (door.open) result = 'already-open';
        else if (this.hero.keys <= 0) { result = 'locked-door'; target = door.id; }
        else { this.hero.keys--; door.open = true; target = door.id; this.stats.doorsOpened++; result = 'door-opened'; }
      } else result = 'nothing-to-open';
    } else if (op === 'disarm') {
      const front = this._front(), trap = this._trapAt(front.x, front.y);
      if (!trap) result = 'no-trap';
      else if (trap.disarmed) result = 'already-disarmed';
      else { trap.disarmed = true; target = trap.id; this.stats.trapsDisarmed++; result = 'disarmed'; }
    } else if (op === 'interact') {
      const front = this._front(), lever = this._leverAt(front.x, front.y), npc = this._npcAt(front.x, front.y);
      if (lever) {
        target = lever.id;
        if (this.toggleLevers) {
          lever.active = !lever.active;
          if (lever.active) this.stats.leversActivated++; else this.stats.leversDeactivated++;
          const opened = this._refreshRuneGates(); detail = { opened, active:lever.active, satisfied:this._mechanismsReady() }; result = lever.active ? 'lever-activated' : 'lever-deactivated';
        } else if (lever.active) result = 'already-active';
        else { lever.active = true; this.stats.leversActivated++; const opened = this._refreshRuneGates(); detail = { opened }; result = 'lever-activated'; }
      } else if (npc) {
        target = npc.id;
        if (this.npcQuest) {
          if (npc.questState === 'idle') { npc.questState = 'started'; this.stats.questsStarted++; result = 'quest-started'; }
          else if (npc.questState === 'started' && this.questTokens.some(item => item.collected)) {
            npc.questState = 'complete'; npc.helped = true; this.stats.questsCompleted++; this.stats.npcsHelped++; this.sessionLoot.npcRewards++;
            if (this.npcReward === 'key') this.hero.keys = Math.min(9, this.hero.keys + 1);
            else if (this.npcReward === 'healing') this.hero.consumables.healing = Math.min(9, this.hero.consumables.healing + 1);
            else if (this.npcReward === 'ward') this.hero.consumables.ward = Math.min(9, this.hero.consumables.ward + 1);
            detail = { reward:this.npcReward }; result = 'quest-completed';
          } else if (npc.questState === 'started') result = 'quest-waiting';
          else result = 'npc-already-helped';
        } else if (npc.helped) result = 'npc-already-helped';
        else {
          npc.helped = true; npc.questState = 'complete'; this.stats.npcsHelped++; this.sessionLoot.npcRewards++;
          if (this.npcReward === 'key') this.hero.keys = Math.min(9, this.hero.keys + 1);
          else if (this.npcReward === 'healing') this.hero.consumables.healing = Math.min(9, this.hero.consumables.healing + 1);
          else if (this.npcReward === 'ward') this.hero.consumables.ward = Math.min(9, this.hero.consumables.ward + 1);
          detail = { reward: this.npcReward }; result = 'npc-helped';
        }
      } else result = 'nothing-to-interact';
    } else if (op === 'smash') {
      const front = this._front(), crate = this._crateAt(front.x, front.y);
      if (!crate) result = 'no-breakable';
      else if (crate.broken) result = 'already-broken';
      else { crate.broken = true; target = crate.id; this.stats.cratesBroken++; this.sessionLoot.crates++; result = 'crate-broken'; }
    } else if (op === 'push') {
      const front = this._front(), block = this._pushBlockAt(front.x, front.y), d = DIRS[this.hero.dir];
      if (!block) result = 'no-pushable';
      else {
        const next = { x:block.x + d.x, y:block.y + d.y };
        if (this._blockingAt(next.x,next.y,null,block.id)) { result = 'push-blocked'; target = block.id; }
        else {
          const heroFrom = { x:this.hero.x, y:this.hero.y }, blockFrom = { x:block.x, y:block.y };
          block.x = next.x; block.y = next.y; block.moved++; this.stats.pushes++; target = block.id;
          this.hero.x = blockFrom.x; this.hero.y = blockFrom.y;
          if (this.companion && this.companion.mode === 'follow') { this.companion.x = heroFrom.x; this.companion.y = heroFrom.y; this._syncCarriedOrb('companion'); }
          this._syncCarriedOrb('hero'); if (this.livePlates) this._refreshLivePlates();
          const plate = this._activatePlateAt(block.x,block.y); detail = { plate:plate ? plate.id : null, opened:plate ? plate.opened : [], from:blockFrom, to:next }; result = plate ? 'push-plate' : 'pushed';
        }
      }
    } else if (op === 'take') { const out=this._takeOrb('hero'); result=out.result; target=out.target||null; detail=out.detail||null;
    } else if (op === 'throw') { const out=this._throwOrb('hero'); result=out.result; target=out.target||null; detail=out.detail||null;
    } else if (op === 'companionFollow' || op === 'companionHold' || op === 'companionGuard' || op === 'companionAssist' || op === 'companionMove' || op === 'companionTurnLeft' || op === 'companionTurnRight' || op === 'companionInteract' || op === 'companionPush' || op === 'companionTake' || op === 'companionThrow') {
      if (!this.companion) result = 'no-companion';
      else if (op === 'companionFollow') { this.companion.mode = 'follow'; result = 'companion-follow'; }
      else if (op === 'companionHold') { this.companion.mode = 'hold'; result = 'companion-hold'; }
      else if (op === 'companionGuard') { this.companion.guarding = true; this.stats.companionGuards++; result = 'companion-guard'; }
      else if (op === 'companionTurnLeft') { this.companion.dir = LEFT[this.companion.dir] || 'N'; this.companion.mode='hold'; result='companion-turned'; }
      else if (op === 'companionTurnRight') { this.companion.dir = RIGHT[this.companion.dir] || 'S'; this.companion.mode='hold'; result='companion-turned'; }
      else if (op === 'companionMove') {
        const front=this._companionFront();
        if (!front || (this.hero.x===front.x&&this.hero.y===front.y) || this._blockingAt(front.x,front.y)) { result='companion-blocked'; this.stats.blocked++; }
        else { this.companion.x=front.x; this.companion.y=front.y; this.companion.mode='hold'; this.stats.companionMoves++; this._syncCarriedOrb('companion'); if(this.livePlates)this._refreshLivePlates(); result='companion-moved'; }
      } else if (op === 'companionInteract') {
        const front=this._companionFront(), lever=front?this._leverAt(front.x,front.y):null;
        if(!lever) result='nothing-to-interact';
        else { target=lever.id; if(this.toggleLevers) lever.active=!lever.active; else lever.active=true; this.stats.companionInteractions++; if(lever.active)this.stats.leversActivated++; const opened=this._refreshRuneGates(); detail={opened,active:lever.active}; result=lever.active?'lever-activated':'lever-deactivated'; }
      } else if (op === 'companionPush') {
        const front=this._companionFront(), block=front?this._pushBlockAt(front.x,front.y):null, d=DIRS[this.companion.dir];
        if(!block) result='no-pushable';
        else { const next={x:block.x+d.x,y:block.y+d.y}; if((this.hero.x===next.x&&this.hero.y===next.y)||this._blockingAt(next.x,next.y,null,block.id)){result='push-blocked';target=block.id;} else { const old={x:block.x,y:block.y}; block.x=next.x;block.y=next.y;block.moved++;this.stats.pushes++;this.companion.x=old.x;this.companion.y=old.y;this.companion.mode='hold';this.stats.companionMoves++;target=block.id;this._syncCarriedOrb('companion');if(this.livePlates)this._refreshLivePlates();const plate=this._activatePlateAt(block.x,block.y);detail={plate:plate?plate.id:null,opened:plate?plate.opened:[],from:old,to:next};result=plate?'push-plate':'pushed';} }
      } else if (op === 'companionTake') { const out=this._takeOrb('companion'); result=out.result;target=out.target||null;detail=out.detail||null; }
      else if (op === 'companionThrow') { const out=this._throwOrb('companion'); result=out.result;target=out.target||null;detail=out.detail||null; }
      else {
        const enemy = this._selectedEnemy() || this._targetEnemy();
        if (!enemy) result = 'no-target';
        else if (manhattan(this.companion,enemy) > 3) { target = enemy.id; result = 'companion-out-of-range'; }
        else {
          target = enemy.id; const effective = Math.max(0, 1 - (enemy.armor || 0)), damage = Math.min(enemy.hp,effective); enemy.hp = Math.max(0,enemy.hp-effective);
          this.stats.damageDealt += damage; this.stats.companionAssists++; this.companion.assists++; detail = { damage }; result = effective <= 0 ? 'armored' : enemy.hp <= 0 ? 'defeated' : 'companion-hit';
        }
      }
    } else if (op === 'usePotion') {
      if (this.hero.consumables.healing <= 0) result = 'no-potion';
      else if (this.hero.hp >= this.hero.maxHp) result = 'full-health';
      else { detail = this._consume('healing'); this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + 3); this.stats.potionsUsed++; result = 'healed'; }
    } else if (op === 'useAntidote') {
      if (this.hero.consumables.antidote <= 0) result = 'no-antidote';
      else if (this.hero.statuses.poison <= 0) result = 'not-poisoned';
      else { detail = this._consume('antidote'); this.hero.statuses.poison = 0; this.stats.antidotesUsed++; result = 'cured'; }
    } else if (op === 'useWard') {
      if (this.hero.consumables.ward <= 0) result = 'no-ward';
      else { detail = this._consume('ward'); this.hero.statuses.ward = Math.max(this.hero.statuses.ward, 2 + this.wardBonus); this.stats.wardsUsed++; result = 'warded'; }
    } else if (op === 'wait') result = 'waited';
    else result = 'unknown-action';
    this.stats.actions++;
    return { type: 'action', op, result, target, detail, before, after: this._heroView() };
  }

  _heroView() {
    return {
      x: this.hero.x, y: this.hero.y, dir: this.hero.dir, hp: this.hero.hp, maxHp: this.hero.maxHp,
      keys: this.hero.keys, guarding: this.hero.guarding, targetId: this.hero.targetId, carrying:this.hero.carrying, state:this.hero.state, statuses: { ...this.hero.statuses }, consumables: { ...this.hero.consumables }, practiceConsumables: { ...this.hero.practiceConsumables },
      potions: this.hero.consumables.healing, antidotes: this.hero.consumables.antidote, wards: this.hero.consumables.ward
    };
  }

  _nextEnemyStep(enemy) {
    const start = { x: enemy.x, y: enemy.y }, goal = { x: this.hero.x, y: this.hero.y };
    const queue = [start], previous = new Map([[key(start.x, start.y), null]]), order = [DIRS.N, DIRS.E, DIRS.S, DIRS.W];
    while (queue.length) {
      const here = queue.shift();
      if (here.x === goal.x && here.y === goal.y) break;
      for (const d of order) {
        const next = { x: here.x + d.x, y: here.y + d.y }, k = key(next.x, next.y);
        if (previous.has(k) || this._wall(next.x, next.y) || (this._start.pits.has(k) && !this._platformAt(next.x,next.y))) continue;
        const door = this._doorAt(next.x, next.y); if (door && !door.open) continue;
        const chest = this._chestAt(next.x, next.y); if (chest && !chest.open) continue;
        const gate = this._runeGateAt(next.x, next.y); if (gate && !gate.open) continue;
        const crate = this._crateAt(next.x, next.y); if (crate && !crate.broken) continue;
        const npc = this._npcAt(next.x, next.y); if (npc && !npc.helped && !this.npcQuest) continue;
        const push = this._pushBlockAt(next.x,next.y); if (push) continue;
        const occupied = this._enemyAt(next.x, next.y); if (occupied && occupied.id !== enemy.id) continue;
        previous.set(k, here); queue.push(next);
      }
    }
    const goalKey = key(goal.x, goal.y); if (!previous.has(goalKey)) return null;
    let cursor = goal, parent = previous.get(goalKey);
    while (parent && !(parent.x === start.x && parent.y === start.y)) { cursor = parent; parent = previous.get(key(cursor.x, cursor.y)); }
    if (cursor.x === goal.x && cursor.y === goal.y) return null;
    return cursor;
  }

  _enemyAttack(enemy, events, ranged = false) {
    const hit = this._hurtHero(enemy.damage, enemy.id, true);
    events.push({ type: ranged ? 'enemy-shot' : 'enemy-attack', enemy: enemy.id, damage: hit.damage, blocked: hit.blocked });
    if (enemy.behavior === 'venom' && hit.damage > 0 && this.hero.hp > 0) {
      this.hero.statuses.poison = Math.max(this.hero.statuses.poison, 2);
      events.push({ type: 'status-applied', enemy: enemy.id, status: 'poison', turns: 2 });
    }
  }

  _advancePlatforms(events) {
    for (const platform of this.movingPlatforms) {
      if (!platform.path || platform.path.length < 2) continue;
      const from = { x:platform.x, y:platform.y }, nextIndex = (platform.index + 1) % platform.path.length, next = platform.path[nextIndex];
      const carriesHero = this.hero.x === from.x && this.hero.y === from.y;
      const carriesCompanion = this.companion && this.companion.x === from.x && this.companion.y === from.y;
      platform.index = nextIndex; platform.x = next.x; platform.y = next.y; platform.moves++; this.stats.platformMoves++;
      if (carriesHero) { this.hero.x = next.x; this.hero.y = next.y; this._syncCarriedOrb('hero'); }
      if (carriesCompanion) { this.companion.x = next.x; this.companion.y = next.y; this._syncCarriedOrb('companion'); }
      events.push({ type:'platform-move', platform:platform.id, from, to:{ x:next.x, y:next.y }, carriedHero:carriesHero });
    }
    if (this.livePlates) this._refreshLivePlates();
  }

  _applySignal(actor, channel) {
    const from = actor === 'companion' ? 'companion' : 'hero';
    const to = from === 'hero' ? (this.companion ? 'companion' : 'dungeon') : 'hero';
    const message = { id:'msg-' + (++this.messageSerial), channel, from, to, turn:this.turn, scheduled:false };
    this.lastSignal = { channel, from, to, id:message.id }; this.stats.signalsSent++; this.signalSequence.push(channel); if (this.signalSequence.length > 16) this.signalSequence.shift();
    let queued = true;
    if (this.messageQueue.length >= MAX_MESSAGE_QUEUE) { queued = false; this.stats.messagesDropped++; } else this.messageQueue.push(message);
    if (!this.receivedSignalChannels.includes(channel)) this.receivedSignalChannels.push(channel);
    const opened = [], required = this.signalGateChannels;
    if (required.length && required.every(item => this.receivedSignalChannels.includes(item))) {
      for (const gate of this.runeGates) if (!gate.open) { gate.open = true; opened.push(gate.id); this.stats.runeGatesOpened++; }
    }
    this._trace('signal', { actor:from, channel, to, queued, opened:[...opened] });
    return { type:'signal', actor:from, channel, to, queued, pending:this.messageQueue.length, opened };
  }

  _eventNames(events) {
    const names=[];
    if ((events||[]).some(event=>event.type==='enemy-intent'&&event.intent==='shot')) names.push('danger');
    if (this.hero.statuses.poison>0) names.push('poisoned');
    if (this._mechanismsReady()) names.push('circuitReady');
    if (this.companion && manhattan(this.companion,this.hero)>2) names.push('companionFar');
    return [...new Set(names)];
  }

  _queueCallbacks(events) {
    const queued=[];
    for (const message of this.messageQueue.filter(item => !item.scheduled)) {
      message.scheduled = true;
      // Main-program signal handlers keep the original global v0.13 semantics. Actor-owned
      // persistent handlers are mailbox-scoped: Hero consumes messages addressed to Hero,
      // Companion consumes messages addressed to Companion. This makes the two persistent
      // behavior programs genuinely independent without introducing a second interpreter.
      const handlers = (this.eventHandlers.signal || []).filter(handler => handler.owner === 'main' || handler.owner === message.to);
      if (!handlers.length) {
        if (!this._deliveredMessageIds.has(message.id)) { this._deliveredMessageIds.add(message.id); this.deliveredSignals.push(message.channel); }
        this.messageQueue = this.messageQueue.filter(item => item.id !== message.id);
        this._trace('message-delivered', { channel:message.channel, actor:message.from, to:message.to, handler:null });
        continue;
      }
      for (const handler of handlers) queued.push({ ...handler, message:{...message} });
    }
    for (const event of this._eventNames(events)) for (const handler of this.eventHandlers[event] || []) queued.push({ ...handler, message:null });
    this.callbackQueue = queued.slice(0,16);
    return this.callbackQueue.map(entry => ({ event:entry.event, name:entry.name, owner:entry.owner, message:entry.message ? { ...entry.message } : null }));
  }

  _startNextCallback() {
    const next=this.callbackQueue.shift(); if(!next)return false; const value=next.functions && next.functions[next.name]; if(!value)return false; const desc=functionDescriptor(value);
    if(desc.params.length)return false;
    this.callbackActive=true; this.callbackName=next.name; this.callbackOwner=next.owner || 'main'; this.activeMessage=next.message ? { ...next.message } : null;
    if (this.activeMessage) {
      this.lastSignal = { channel:this.activeMessage.channel, from:this.activeMessage.from, to:this.activeMessage.to, id:this.activeMessage.id };
      if (!this._deliveredMessageIds.has(this.activeMessage.id)) { this._deliveredMessageIds.add(this.activeMessage.id); this.deliveredSignals.push(this.activeMessage.channel); }
      this.messageQueue = this.messageQueue.filter(item => item.id !== this.activeMessage.id);
    }
    this.runner=new ProgramRunner(desc.body,next.functions,{budget:192}); this.stats.callbacksTriggered++; this.phase='executing';
    this._trace('callback-start',{ event:next.event, name:next.name, actor:this.callbackOwner, channel:this.activeMessage ? this.activeMessage.channel : null });
    return true;
  }

  _worldTurn() {
    const events = [];
    this.clockPhase = (this.clockPhase + 1) % 2;
    if (this.cycleTraps.length) events.push({ type:'mechanism-clock', phase:this.clockPhase, active:this.cycleTraps.filter(item=>this._cycleTrapActive(item)).map(item=>item.id) });
    this._advancePlatforms(events);
    if (this.livePlates) this._refreshLivePlates();
    for (const enemy of this.enemies.filter(entry => entry.hp > 0).sort((a, b) => a.id.localeCompare(b.id))) {
      if (this.hero.hp <= 0) break;
      if (enemy.statuses && enemy.statuses.burn > 0) {
        const damage = Math.min(1, enemy.hp); enemy.hp = Math.max(0, enemy.hp - 1); enemy.statuses.burn--; this.stats.burnTicks++;
        events.push({ type: 'enemy-status-tick', enemy: enemy.id, status: 'burn', damage, remaining: enemy.statuses.burn });
        if (enemy.hp <= 0) continue;
      }
      if (enemy.statuses && enemy.statuses.freeze > 0) {
        enemy.statuses.freeze--; this.stats.frozenTurns++;
        events.push({ type: 'enemy-status-skip', enemy: enemy.id, status: 'freeze', remaining: enemy.statuses.freeze });
        continue;
      }
      const distance = manhattan(enemy, this.hero);
      if (enemy.behavior === 'mechanismBoss') enemy.armor = this._mechanismsReady() ? 0 : 2;
      if (enemy.behavior === 'relicBoss') {
        enemy.armor = this._livingEnemies().some(entry => entry.id !== enemy.id) ? 2 : 0;
        if (enemy.hp <= 5 && distance <= enemy.range) {
          if (enemy.intent === 'shot') { enemy.intent = null; this._enemyAttack(enemy, events, true); continue; }
          enemy.intent = 'shot'; events.push({ type: 'enemy-intent', enemy: enemy.id, intent: 'shot' }); continue;
        }
      }
      if (enemy.behavior === 'warden' && enemy.hp > 2 && enemy.hp <= 4) {
        if (enemy.intent === 'shot') { enemy.intent = null; if (distance <= enemy.range + 1) this._enemyAttack(enemy, events, true); continue; }
        if (distance <= enemy.range) { enemy.intent = 'shot'; events.push({ type: 'enemy-intent', enemy: enemy.id, intent: 'shot' }); continue; }
      }
      if (enemy.behavior === 'archer' && enemy.intent === 'shot') {
        enemy.intent = null;
        if (distance <= enemy.range + 1) this._enemyAttack(enemy, events, true);
        continue;
      }
      if (distance === 1) {
        enemy.intent = null; this._enemyAttack(enemy, events, false); continue;
      }
      if (enemy.behavior === 'archer' && distance <= enemy.range) {
        enemy.intent = 'shot'; events.push({ type: 'enemy-intent', enemy: enemy.id, intent: 'shot' }); continue;
      }
      enemy.intent = null;
      const next = this._nextEnemyStep(enemy);
      if (next && !(next.x === this.hero.x && next.y === this.hero.y)) {
        const from = { x: enemy.x, y: enemy.y }; enemy.x = next.x; enemy.y = next.y;
        events.push({ type: 'enemy-move', enemy: enemy.id, from, to: { x: enemy.x, y: enemy.y } });
      }
    }
    if (this.hero.hp > 0 && this.hero.statuses.poison > 0) {
      const hit = this._hurtHero(1, 'poison', false);
      this.hero.statuses.poison = Math.max(0, this.hero.statuses.poison - 1); this.stats.poisonTicks++;
      events.push({ type: 'status-tick', status: 'poison', damage: hit.damage, remaining: this.hero.statuses.poison });
    }
    if (this.hero.statuses.ward > 0) this.hero.statuses.ward--;
    this.hero.guarding = false;
    if (this.companion) this.companion.guarding = false;
    this.stats.turns++;
    return events;
  }

  step() {
    if (this.phase !== 'executing' || !this.runner) return { type: 'idle', phase: this.phase };
    const interpreted = this.runner.step({ test: condition => this.test(condition), read: path => this.read(path), collection: name => this.collection(name) });
    if (interpreted.type === 'handler') {
      if (!this._registerHandler(interpreted.event, interpreted.name, 'main', this.functions, 'program')) { this.lastError='too-many-handlers';this.runner=null;this.phase='programming';return {type:'program-error',reason:'too-many-handlers'}; }
      return {type:'handler',event:interpreted.event,name:interpreted.name,owner:'main',uid:interpreted.uid};
    }
    if (interpreted.type === 'signal') {
      const event = this._applySignal(interpreted.actor, interpreted.channel); event.uid = interpreted.uid; return event;
    }
    if (interpreted.type === 'state') {
      const event = this._applyState(interpreted.actor, interpreted.state); event.uid = interpreted.uid; return event;
    }
    if (interpreted.type === 'target-ref') {
      const event = this._applyTargetId(interpreted.id); event.uid = interpreted.uid;
      return event;
    }
    if (interpreted.type === 'target') {
      const event = this._applyTarget(interpreted.index); event.uid = interpreted.uid;
      return event;
    }
    if (interpreted.type === 'action') {
      const event = this._applyAction(interpreted.op); event.uid = interpreted.uid; this._trace('action',{ actor:String(interpreted.op).startsWith('companion')?'companion':'hero', op:interpreted.op, result:event.result });
      if (this.hero.hp <= 0) { this.phase = 'resting'; this.runner = null; event.resting = true; }
      else if (this.objectiveComplete()) { this.phase = 'won'; this.runner = null; event.won = true; }
      return event;
    }
    if (interpreted.type === 'error') {
      this.lastError = interpreted.reason; this.runner = null; this.phase = 'programming';
      return { type: 'program-error', reason: interpreted.reason, name: interpreted.name };
    }
    if (interpreted.type === 'done') {
      this.runner = null;
      if (this.callbackActive) {
        const name=this.callbackName, owner=this.callbackOwner; this.callbackActive=false; this.callbackName=null; this.callbackOwner=null; this.activeMessage=null; this._trace('callback-done',{name,actor:owner});
        if (this.hero.hp <= 0) this.phase='resting';
        else if (this.objectiveComplete()) this.phase='won';
        else if (this._startNextCallback()) return {type:'callback-next',name:this.callbackName,owner:this.callbackOwner,phase:this.phase};
        else this.phase='programming';
        return {type:'callback-done',name,owner,phase:this.phase};
      }
      if (this.objectiveComplete()) { this.phase = 'won'; return { type: 'won' }; }
      const events = this._worldTurn(); this.turn++; this._trace('world-turn',{events:(events||[]).map(event=>event.type)});
      const triggered=this._queueCallbacks(events);
      if (this.hero.hp <= 0) this.phase = 'resting';
      else if (this.objectiveComplete()) this.phase = 'won';
      else if (!this._startNextCallback()) this.phase = 'programming';
      return { type: 'world-turn', events, callbacks:triggered, messageQueue:this.messageQueue.map(item=>({ ...item })), phase: this.phase };
    }
    return { type: 'idle', phase: this.phase };
  }

  snapshot() {
    return {
      levelId: this.level.id, width: this._start.width, height: this._start.height, walls: [...this._start.walls], pits:[...this._start.pits],
      exit: this._start.exit ? { ...this._start.exit } : null, hero: this._heroView(),
      enemies: this.enemies.map(enemy => ({ ...enemy })), chests: this.chests.map(chest => ({ ...chest })),
      doors: this.doors.map(door => ({ ...door })), keys: this.keys.map(item => ({ ...item })), traps: this.traps.map(trap => ({ ...trap })), cycleTraps:this.cycleTraps.map(item=>({ ...item, active:this._cycleTrapActive(item) })),
      levers: this.levers.map(item => ({ ...item })), plates: this.plates.map(item => ({ ...item })), runeGates: this.runeGates.map(item => ({ ...item })), crates: this.crates.map(item => ({ ...item })), npcs: this.npcs.map(item => ({ ...item })),
      pushBlocks:this.pushBlocks.map(item=>({ ...item })), questTokens:this.questTokens.map(item=>({ ...item })), orbs:this.orbs.map(item=>({ ...item })), movingPlatforms:this.movingPlatforms.map(item=>({ ...item, path:item.path.map(point=>({ ...point })) })), companion:this.companion ? { ...this.companion } : null, clockPhase:this.clockPhase, eventHandlers:Object.fromEntries(Object.entries(this.eventHandlers).map(([event,entries])=>[event,entries.map(item=>({event:item.event,name:item.name,owner:item.owner,source:item.source}))])), callbackActive:this.callbackActive, callbackOwner:this.callbackOwner, activeMessage:this.activeMessage ? { ...this.activeMessage } : null, lastSignal:{...this.lastSignal},
      messageQueue:this.messageQueue.map(item=>({ ...item })), callbackQueue:this.callbackQueue.map(item=>({event:item.event,name:item.name,owner:item.owner,message:item.message?{...item.message}:null})), signalSequence:[...this.signalSequence], deliveredSignals:[...this.deliveredSignals], receivedSignalChannels:[...this.receivedSignalChannels], trace:[...this.traceLog],
      phase: this.phase, turn: this.turn, objectiveComplete: this.objectiveComplete(), stats: { ...this.stats }, sessionLoot: { ...this.sessionLoot },
      lastError: this.lastError, runner: this.runner ? this.runner.snapshot() : null,
      combat: { weaponDamage: this.weaponDamage, spellDamage: this.spellDamage, weaponRange: this.weaponRange, weaponElement: this.weaponElement, defense: this.defense, wardBonus: this.wardBonus, weaponRarityRank: this.weaponRarityRank, weaponAffixCount: this.weaponAffixCount, armorRarityRank: this.armorRarityRank, charmRarityRank: this.charmRarityRank, setBonusCount:this.setBonusCount }
    };
  }
}

export function solveLevel(level, options = {}) {
  const model = new CodeQuestModel(level, options);
  for (let turn = 0; turn < 32 && model.phase !== 'won' && model.phase !== 'resting'; turn++) {
    if (model.phase === 'programming') {
      const started = model.begin(level.reference.main, level.reference.functions || {});
      if (!started.ok) return { solved: false, reason: started.reason, model };
    }
    for (let i = 0; i < 768 && model.phase === 'executing'; i++) model.step();
  }
  return { solved: model.phase === 'won', reason: model.phase, model };
}
