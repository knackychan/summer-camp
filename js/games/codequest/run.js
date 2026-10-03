/* Code Quest v0.11 environmental-logic algorithmic expedition.
   Connected expedition runs are deterministic from a bounded seed. The dungeon
   graph, run hazard and elite modifiers are regenerated/validated from that seed;
   combat rooms remain ordinary CodeQuestModel levels so there is still one RPG engine. */

import { action as A, repeat as R, ifNode as IF, forOfNode as FOR, targetNode as T, literal as L, variableRef as V } from './ast.js';

const MAX_COINS = 99;
const MAX_PROVISIONS = 9;
const MAX_BOON = 3;
const MAX_SIGILS = 5;
const SIGILS_REQUIRED = 3;
const MAX_LOADOUTS = 3;
const MAX_CODE = 16000;
const ROOM_IDS = Object.freeze(['r0','r1a','r1b','r2','r2b','r2c','r3a','r3b','r3c','r4','r4a','r4b','r5']);
const TYPES = Object.freeze(['combat','elite','event','rest','shop','treasure','sigil','hazard','boss']);
const HAZARDS = Object.freeze(['miasma','static','rust']);
const ELITE_MODIFIERS = Object.freeze(['armored','venom','ranged','elemental']);

const LAYOUTS = Object.freeze({
  alpha:Object.freeze({
    r0:Object.freeze(['r1a','r1b']), r1a:Object.freeze(['r2','r2b']), r1b:Object.freeze(['r2b','r2c']),
    r2:Object.freeze(['r3a','r3b']), r2b:Object.freeze(['r3b','r3c']), r2c:Object.freeze(['r3a','r3c']),
    r3a:Object.freeze(['r4','r4a']), r3b:Object.freeze(['r4a','r4b']), r3c:Object.freeze(['r4','r4b']),
    r4:Object.freeze(['r5']), r4a:Object.freeze(['r5']), r4b:Object.freeze(['r5']), r5:Object.freeze([])
  }),
  beta:Object.freeze({
    r0:Object.freeze(['r1a','r1b']), r1a:Object.freeze(['r2b','r2c']), r1b:Object.freeze(['r2','r2b']),
    r2:Object.freeze(['r3b','r3c']), r2b:Object.freeze(['r3a','r3c']), r2c:Object.freeze(['r3a','r3b']),
    r3a:Object.freeze(['r4a','r4b']), r3b:Object.freeze(['r4','r4a']), r3c:Object.freeze(['r4','r4b']),
    r4:Object.freeze(['r5']), r4a:Object.freeze(['r5']), r4b:Object.freeze(['r5']), r5:Object.freeze([])
  }),
  gamma:Object.freeze({
    r0:Object.freeze(['r1a','r1b']), r1a:Object.freeze(['r2','r2c']), r1b:Object.freeze(['r2','r2b']),
    r2:Object.freeze(['r3a','r3c']), r2b:Object.freeze(['r3a','r3b']), r2c:Object.freeze(['r3b','r3c']),
    r3a:Object.freeze(['r4','r4b']), r3b:Object.freeze(['r4','r4a']), r3c:Object.freeze(['r4a','r4b']),
    r4:Object.freeze(['r5']), r4a:Object.freeze(['r5']), r4b:Object.freeze(['r5']), r5:Object.freeze([])
  })
});
const LAYOUT_IDS = Object.freeze(Object.keys(LAYOUTS));

const META = Object.freeze({
  r0: Object.freeze({ type:'combat', x:0, y:2, label:Object.freeze(['Gate Hall','入口長廊']) }),
  r1a:Object.freeze({ type:'event', x:1, y:1, label:Object.freeze(['Rune Fountain','符文泉']) }),
  r1b:Object.freeze({ type:'combat', x:1, y:3, label:Object.freeze(['Bug Gallery','錯誤迴廊']) }),
  r2: Object.freeze({ type:'elite', x:2, y:0, grantsSigil:true, label:Object.freeze(['Sentinel Stack','哨兵堆疊']) }),
  r2b:Object.freeze({ type:'hazard', x:2, y:2, label:Object.freeze(['Stabilizer Core','穩定核心']) }),
  r2c:Object.freeze({ type:'event', x:2, y:4, label:Object.freeze(['Index Observatory','索引觀測站']) }),
  r3a:Object.freeze({ type:'rest', x:3, y:0, label:Object.freeze(['Quiet Camp','靜謐營地']) }),
  r3b:Object.freeze({ type:'shop', x:3, y:2, label:Object.freeze(['Patch Market','補丁市集']) }),
  r3c:Object.freeze({ type:'sigil', x:3, y:4, label:Object.freeze(['Compiler Archive','編譯者檔案庫']) }),
  r4: Object.freeze({ type:'treasure', x:4, y:0, label:Object.freeze(['Relic Reliquary','遺物聖庫']) }),
  r4a:Object.freeze({ type:'elite', x:4, y:2, grantsSigil:true, label:Object.freeze(['Guardian Fork','守衛分岔口']) }),
  r4b:Object.freeze({ type:'sigil', x:4, y:4, label:Object.freeze(['Key Compiler','金鑰編譯器']) }),
  r5: Object.freeze({ type:'boss', x:5, y:2, label:Object.freeze(['Root Compiler','根編譯器']) })
});

function clamp(value, min, max, fallback = min) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}
function text(value, max = 80) { return typeof value === 'string' ? value.slice(0, max) : ''; }
function bool(value) { return value === true; }
function seedHash(value) {
  const s = text(value || 'expedition',64) || 'expedition'; let h = 2166136261 >>> 0;
  for (let i=0;i<s.length;i++) { h ^= s.charCodeAt(i); h = Math.imul(h,16777619) >>> 0; }
  return h >>> 0;
}
function uniqRooms(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(id => ROOM_IDS.includes(id)))].slice(0, ROOM_IDS.length);
}
function normalizeProvisions(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return Object.freeze({
    healing:clamp(src.healing,0,MAX_PROVISIONS,0), antidote:clamp(src.antidote,0,MAX_PROVISIONS,0),
    ward:clamp(src.ward,0,MAX_PROVISIONS,0), focus:clamp(src.focus,0,MAX_PROVISIONS,0)
  });
}
function normalizeBoons(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return Object.freeze({
    attack:clamp(src.attack,0,MAX_BOON,0), spell:clamp(src.spell,0,MAX_BOON,0),
    defense:clamp(src.defense,0,MAX_BOON,0), maxHp:clamp(src.maxHp,0,MAX_BOON,0)
  });
}
function generatedRunTraits(seed) {
  const h = seedHash(seed), layoutId = LAYOUT_IDS[h % LAYOUT_IDS.length], hazardId = HAZARDS[(h >>> 5) % HAZARDS.length];
  return Object.freeze({
    layoutId, hazardId,
    eliteR2:ELITE_MODIFIERS[(h >>> 9) % ELITE_MODIFIERS.length],
    eliteR4a:ELITE_MODIFIERS[(h >>> 13) % ELITE_MODIFIERS.length]
  });
}
function normalizeLoadouts(raw) {
  const src = Array.isArray(raw) ? raw : [];
  return Object.freeze(Array.from({length:MAX_LOADOUTS},(_,i)=>text(src[i] || '',MAX_CODE)));
}

export function normalizeDungeonRun(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const seed = text(raw.seed || 'expedition',64) || 'expedition', traits = generatedRunTraits(seed);
  const oldVersion = clamp(raw.version,0,2,0), cleared = uniqRooms(raw.cleared), route = uniqRooms(raw.route);
  const current = ROOM_IDS.includes(raw.current) ? raw.current : 'r0', maxHp = clamp(raw.maxHp,3,12,5);
  const inferredLegacySigils = oldVersion <= 1 ? Math.min(SIGILS_REQUIRED, Math.floor(cleared.length / 2) + (current === 'r5' ? SIGILS_REQUIRED : 0)) : 0;
  const hazardRaw = raw.hazard && typeof raw.hazard === 'object' ? raw.hazard : {};
  const eliteRaw = raw.eliteModifiers && typeof raw.eliteModifiers === 'object' ? raw.eliteModifiers : {};
  return Object.freeze({
    version:2, seed,
    layoutId:LAYOUT_IDS.includes(raw.layoutId) ? raw.layoutId : traits.layoutId,
    code:text(raw.code || '',MAX_CODE), current, cleared:Object.freeze(cleared), route:Object.freeze(route.length ? route : ['r0']),
    hp:clamp(raw.hp,0,maxHp,maxHp), maxHp, coins:clamp(raw.coins,0,MAX_COINS,0),
    provisions:normalizeProvisions(raw.provisions), boons:normalizeBoons(raw.boons),
    sigils:clamp(raw.sigils,0,MAX_SIGILS,inferredLegacySigils),
    hazard:Object.freeze({ id:HAZARDS.includes(hazardRaw.id) ? hazardRaw.id : traits.hazardId, cleared:bool(hazardRaw.cleared) }),
    eliteModifiers:Object.freeze({
      r2:ELITE_MODIFIERS.includes(eliteRaw.r2) ? eliteRaw.r2 : traits.eliteR2,
      r4a:ELITE_MODIFIERS.includes(eliteRaw.r4a) ? eliteRaw.r4a : traits.eliteR4a
    }),
    runeLoadouts:normalizeLoadouts(raw.runeLoadouts), activeLoadout:clamp(raw.activeLoadout,0,MAX_LOADOUTS-1,0),
    shop:Object.freeze({
      healBought:bool(raw.shop && raw.shop.healBought), wardBought:bool(raw.shop && raw.shop.wardBought),
      forgeBought:bool(raw.shop && raw.shop.forgeBought), patchBought:bool(raw.shop && raw.shop.patchBought),
      sigilBought:bool(raw.shop && raw.shop.sigilBought)
    }),
    flags:Object.freeze({
      fountain:bool(raw.flags && raw.flags.fountain), observatory:bool(raw.flags && raw.flags.observatory),
      stabilizer:bool(raw.flags && raw.flags.stabilizer), archive:bool(raw.flags && raw.flags.archive),
      keyCompiler:bool(raw.flags && raw.flags.keyCompiler), treasure:bool(raw.flags && raw.flags.treasure)
    }),
    finished:bool(raw.finished), failed:bool(raw.failed)
  });
}

export function createDungeonRun(seed, maxHp = 5) {
  const hp = clamp(maxHp,3,12,5), traits = generatedRunTraits(seed);
  return normalizeDungeonRun({
    version:2, seed:text(seed || 'expedition',64), layoutId:traits.layoutId, code:'', current:'r0', cleared:[], route:['r0'], hp, maxHp:hp, coins:0,
    provisions:{ healing:2, antidote:1, ward:1, focus:0 }, boons:{ attack:0, spell:0, defense:0, maxHp:0 }, sigils:0,
    hazard:{ id:traits.hazardId, cleared:false }, eliteModifiers:{ r2:traits.eliteR2, r4a:traits.eliteR4a }, runeLoadouts:['','',''], activeLoadout:0,
    shop:{}, flags:{}, finished:false, failed:false
  });
}

export function roomMeta(id) { return META[id] || null; }
export function roomGraph(raw) {
  const run = normalizeDungeonRun(raw);
  return LAYOUTS[run ? run.layoutId : 'alpha'];
}
export function sigilsRequired() { return SIGILS_REQUIRED; }
export function hazardInfo(raw) {
  const run = normalizeDungeonRun(raw); if (!run) return null;
  const labels = {
    miasma:Object.freeze(['Memory Miasma · lose 1 HP after combat until stabilized','記憶瘴氣・穩定前每場戰鬥後損失 1 生命']),
    static:Object.freeze(['Static Noise · spell power −1 until stabilized','靜電雜訊・穩定前法術威力 −1']),
    rust:Object.freeze(['Rust Protocol · melee power −1 until stabilized','鏽蝕協定・穩定前近戰威力 −1'])
  };
  return Object.freeze({ id:run.hazard.id, cleared:run.hazard.cleared, label:labels[run.hazard.id] });
}

function frontier(raw) {
  const run = normalizeDungeonRun(raw); if (!run || run.finished || run.failed || !run.cleared.includes(run.current)) return [];
  const graph = roomGraph(run), found = new Set();
  for (const from of run.cleared) for (const id of graph[from] || []) if (!run.cleared.includes(id)) found.add(id);
  if (run.sigils < SIGILS_REQUIRED) found.delete('r5');
  return ROOM_IDS.filter(id => found.has(id));
}
export function nextRooms(raw) { return Object.freeze(frontier(raw)); }
export function canEnterRoom(raw, roomId) {
  const run = normalizeDungeonRun(raw); if (!run || !ROOM_IDS.includes(roomId) || run.finished || run.failed) return false;
  if (roomId === run.current && !run.cleared.includes(roomId)) return true;
  return frontier(run).includes(roomId);
}
export function enterDungeonRoom(raw, roomId) {
  const run = normalizeDungeonRun(raw); if (!canEnterRoom(run, roomId)) return { ok:false, run, reason:roomId === 'r5' && run && run.sigils < SIGILS_REQUIRED ? 'sigils' : 'not-connected' };
  const route = run.route.includes(roomId) ? [...run.route] : run.route.concat(roomId);
  return { ok:true, run:normalizeDungeonRun({ ...run, current:roomId, route }) };
}

function withProvision(run, id, delta) {
  return normalizeDungeonRun({ ...run, provisions:{ ...run.provisions, [id]:clamp(run.provisions[id] + delta,0,MAX_PROVISIONS,0) } });
}
function withBoon(run, id, delta) {
  const boons = { ...run.boons, [id]:clamp(run.boons[id] + delta,0,MAX_BOON,0) };
  const maxHp = clamp(run.maxHp + (id === 'maxHp' ? delta : 0),3,12,run.maxHp);
  const hp = id === 'maxHp' && delta > 0 ? Math.min(maxHp, run.hp + delta) : Math.min(maxHp, run.hp);
  return normalizeDungeonRun({ ...run, boons, maxHp, hp });
}
function withSigil(run, delta = 1) { return normalizeDungeonRun({ ...run, sigils:clamp(run.sigils + delta,0,MAX_SIGILS,run.sigils) }); }
function finishRoom(run) {
  return normalizeDungeonRun({ ...run, cleared:run.cleared.includes(run.current) ? run.cleared : run.cleared.concat(run.current) });
}

export function resolveRunChoice(raw, choice) {
  let run = normalizeDungeonRun(raw); if (!run) return { ok:false, run:null, reason:'no-run' };
  const meta = META[run.current]; if (!meta || run.cleared.includes(run.current)) return { ok:false, run, reason:'room-complete' };
  if (meta.type === 'event' && run.current === 'r1a') {
    if (choice === 'fountain:heal') run = finishRoom(normalizeDungeonRun({ ...run, hp:Math.min(run.maxHp, run.hp + 3), flags:{ ...run.flags, fountain:true } }));
    else if (choice === 'fountain:power') run = finishRoom(withBoon(normalizeDungeonRun({ ...run, hp:Math.max(1, run.hp - 1), flags:{ ...run.flags, fountain:true } }), 'spell', 1));
    else return { ok:false, run, reason:'choice' };
    return { ok:true, run, result:choice };
  }
  if (meta.type === 'event' && run.current === 'r2c') {
    if (choice === 'observatory:coins') run = finishRoom(normalizeDungeonRun({ ...run, coins:run.coins + 5, flags:{ ...run.flags, observatory:true } }));
    else if (choice === 'observatory:supply') run = finishRoom(withProvision(normalizeDungeonRun({ ...run, flags:{ ...run.flags, observatory:true } }), 'healing', 1));
    else return { ok:false, run, reason:'choice' };
    return { ok:true, run, result:choice };
  }
  if (meta.type === 'hazard') {
    if (choice === 'hazard:stabilize') {
      if (run.coins >= 4) run = normalizeDungeonRun({ ...run, coins:run.coins-4 });
      else if (run.provisions.ward > 0) run = withProvision(run,'ward',-1);
      else return { ok:false, run, reason:'cannot-stabilize' };
      run = finishRoom(withSigil(normalizeDungeonRun({ ...run, hazard:{ ...run.hazard, cleared:true }, flags:{ ...run.flags, stabilizer:true } }),1));
    } else if (choice === 'hazard:ignore') run = finishRoom(run);
    else return { ok:false, run, reason:'choice' };
    return { ok:true, run, result:choice };
  }
  if (meta.type === 'rest') {
    if (choice === 'rest:heal') run = finishRoom(normalizeDungeonRun({ ...run, hp:run.maxHp }));
    else if (choice === 'rest:brew') run = finishRoom(withProvision(run,'healing',1));
    else return { ok:false, run, reason:'choice' };
    return { ok:true, run, result:choice };
  }
  if (meta.type === 'treasure') {
    if (choice === 'treasure:blade') run = finishRoom(withBoon(normalizeDungeonRun({ ...run, flags:{ ...run.flags, treasure:true } }), 'attack', 1));
    else if (choice === 'treasure:focus') run = finishRoom(withBoon(normalizeDungeonRun({ ...run, flags:{ ...run.flags, treasure:true } }), 'spell', 1));
    else if (choice === 'treasure:guard') run = finishRoom(withBoon(normalizeDungeonRun({ ...run, flags:{ ...run.flags, treasure:true } }), 'defense', 1));
    else return { ok:false, run, reason:'choice' };
    return { ok:true, run, result:choice };
  }
  if (meta.type === 'sigil') {
    const flag = run.current === 'r3c' ? 'archive' : 'keyCompiler';
    if (choice === 'sigil:attack') run = finishRoom(withBoon(withSigil(normalizeDungeonRun({ ...run, flags:{ ...run.flags, [flag]:true } }),1),'attack',1));
    else if (choice === 'sigil:spell') run = finishRoom(withBoon(withSigil(normalizeDungeonRun({ ...run, flags:{ ...run.flags, [flag]:true } }),1),'spell',1));
    else return { ok:false, run, reason:'choice' };
    return { ok:true, run, result:choice };
  }
  if (meta.type === 'shop') {
    if (choice === 'shop:healing' && !run.shop.healBought && run.coins >= 6) {
      run = withProvision(normalizeDungeonRun({ ...run, coins:run.coins-6, shop:{ ...run.shop, healBought:true } }), 'healing', 1);
    } else if (choice === 'shop:ward' && !run.shop.wardBought && run.coins >= 7) {
      run = withProvision(normalizeDungeonRun({ ...run, coins:run.coins-7, shop:{ ...run.shop, wardBought:true } }), 'ward', 1);
    } else if (choice === 'shop:forge' && !run.shop.forgeBought && run.coins >= 10) {
      run = withBoon(normalizeDungeonRun({ ...run, coins:run.coins-10, shop:{ ...run.shop, forgeBought:true } }), 'attack', 1);
    } else if (choice === 'shop:patch' && !run.shop.patchBought && run.coins >= 8) {
      run = withBoon(normalizeDungeonRun({ ...run, coins:run.coins-8, shop:{ ...run.shop, patchBought:true } }), 'maxHp', 1);
    } else if (choice === 'shop:sigil' && !run.shop.sigilBought && run.coins >= 12) {
      run = withSigil(normalizeDungeonRun({ ...run, coins:run.coins-12, shop:{ ...run.shop, sigilBought:true } }),1);
    } else if (choice === 'shop:leave') {
      run = finishRoom(run); return { ok:true, run, result:choice };
    } else return { ok:false, run, reason:'cannot-buy' };
    return { ok:true, run, result:choice };
  }
  return { ok:false, run, reason:'combat-room' };
}

export function completeCombatRoom(raw, snapshot) {
  let run = normalizeDungeonRun(raw); if (!run) return { ok:false, run:null, reason:'no-run' };
  const meta = META[run.current]; if (!meta || !['combat','elite','boss'].includes(meta.type)) return { ok:false, run, reason:'not-combat' };
  if (meta.type === 'boss' && run.sigils < SIGILS_REQUIRED) return { ok:false, run, reason:'sigils' };
  if (!snapshot || snapshot.phase !== 'won') return { ok:false, run, reason:'not-won' };
  const hero = snapshot.hero || {}, provisions = hero.practiceConsumables || hero.consumables || run.provisions;
  const reward = meta.type === 'elite' ? 12 : meta.type === 'boss' ? 24 : 6;
  let hp = clamp(hero.hp,0,run.maxHp,run.hp), sigils = run.sigils;
  if (meta.grantsSigil) sigils = clamp(sigils + 1,0,MAX_SIGILS,sigils);
  if (run.hazard.id === 'miasma' && !run.hazard.cleared && meta.type !== 'boss') hp = Math.max(1,hp-1);
  const cleared = run.cleared.includes(run.current) ? run.cleared : run.cleared.concat(run.current);
  run = normalizeDungeonRun({
    ...run, cleared, hp, sigils, coins:run.coins + reward,
    provisions:{
      healing:clamp(provisions.healing,0,MAX_PROVISIONS,run.provisions.healing), antidote:clamp(provisions.antidote,0,MAX_PROVISIONS,run.provisions.antidote),
      ward:clamp(provisions.ward,0,MAX_PROVISIONS,run.provisions.ward), focus:clamp(provisions.focus,0,MAX_PROVISIONS,run.provisions.focus)
    },
    finished:meta.type === 'boss'
  });
  return { ok:true, run, coins:reward, sigil:!!meta.grantsSigil, hazardTick:run.hazard.id === 'miasma' && !run.hazard.cleared && meta.type !== 'boss', finished:run.finished };
}

export function failDungeonRun(raw) {
  const run = normalizeDungeonRun(raw); return run ? normalizeDungeonRun({ ...run, hp:0, failed:true }) : null;
}

export function saveRunLoadout(raw, index, source) {
  const run = normalizeDungeonRun(raw); if (!run) return { ok:false, run:null, reason:'no-run' };
  const rawIndex=Number(index), i=Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex < MAX_LOADOUTS ? rawIndex : -1; if (i < 0) return { ok:false, run, reason:'slot' };
  const code = text(source || '',MAX_CODE); if (!code.trim()) return { ok:false, run, reason:'empty' };
  const runeLoadouts = [...run.runeLoadouts]; runeLoadouts[i] = code;
  return { ok:true, run:normalizeDungeonRun({ ...run, runeLoadouts, activeLoadout:i, code }), code };
}
export function activateRunLoadout(raw, index) {
  const run = normalizeDungeonRun(raw); if (!run) return { ok:false, run:null, reason:'no-run' };
  const rawIndex=Number(index), i=Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex < MAX_LOADOUTS ? rawIndex : -1, code = i >= 0 ? run.runeLoadouts[i] : '';
  if (!code || !code.trim()) return { ok:false, run, reason:'empty' };
  return { ok:true, run:normalizeDungeonRun({ ...run, activeLoadout:i, code }), code };
}

function encounterBase(run, id, map, objective, reference, extras = {}) {
  return Object.freeze({
    id:'expedition-' + run.seed.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,16) + '-' + id,
    expedition:true, runRoom:id, floor:run.route.length, region:Object.freeze({ id:'expedition', label:Object.freeze(['Compiler Catacombs','編譯者地下城']) }),
    title:META[id].label, concept:Object.freeze(['Algorithmic dungeon run','演算法地下城遠征']),
    objectiveText:Object.freeze(extras.objectiveText || ['Clear the room and keep your Rune library for the next chamber.','清除房間，並把符文函式帶到下一間。']),
    map:Object.freeze(map), heroDir:'E', heroHp:run.hp,
    expeditionSigils:run.sigils, expeditionRoomsCleared:run.cleared.length, expeditionCoins:run.coins, expeditionHazardActive:!run.hazard.cleared,
    practicePotions:run.provisions.healing, practiceAntidotes:run.provisions.antidote, practiceWards:run.provisions.ward,
    objective:Object.freeze(objective),
    available:Object.freeze({ actions:Object.freeze(['move','turnLeft','turnRight','attack','heavyAttack','guard','open','disarm','interact','smash','push','usePotion','useAntidote','useWard','wait','targetNearest','targetWeakest','targetArmored','targetElementWeak','cast']), logic:Object.freeze(['repeat2','repeat3','repeat5','ifEnemy','ifArmored','ifWeak','ifDanger','ifPoisoned','ifChest','ifDoor','ifTrap','ifKey','ifHpLow','ifLever','ifBreakable','ifNpc','ifRuneGate','ifPushable','ifCycleTrap','ifCycleTrapActive','ifPlatform','ifOnPlatform','ifQuestToken','callRune']) }),
    requires:Object.freeze([]), maxBlocks:96, parBlocks:extras.parBlocks || 8,
    reward:Object.freeze({ ingredients:Object.freeze({}), potions:Object.freeze({}) }),
    reference:Object.freeze({ main:reference.main, functions:Object.freeze(reference.functions || {}) }),
    ...extras
  });
}

function eliteMap(modifier, wide = false) {
  const pair = modifier === 'armored' ? 'B..G' : modifier === 'venom' ? 'V..G' : modifier === 'ranged' ? 'A..A' : 'F..I';
  return wide ? ['##############','#H..........E#','#..' + pair + '......#','##############'] : ['############','#H........E#','#..' + pair + '....#','############'];
}
function eliteReference() {
  return { main:[IF('dangerIncoming',[A('guard')]),A('targetArmored'),A('heavyAttack'),A('targetElementWeak'),A('cast'),A('targetWeakest'),R(L(2),[A('attack')]),R(L(9),[A('move')])], functions:{} };
}

export function expeditionLevel(raw) {
  const run = normalizeDungeonRun(raw); if (!run) return null;
  const id = run.current, meta = META[id]; if (!meta || !['combat','elite','boss'].includes(meta.type)) return null;
  if (id === 'r0') return encounterBase(run,id,
    ['############','#H.LZG...E.#','#..........#','############'],
    { activateAllLevers:true, openAllRuneGates:true, defeatAll:true, reachExit:true },
    { main:[A('move'),IF('leverAhead',[A('interact')]),R(L(2),[A('move')]),R(L(2),[A('attack')]),R(L(5),[A('move')])], functions:{} },
    { switchesRequired:1, parBlocks:9, objectiveText:['Power the Gate Hall rune circuit, clear its guardian, and keep the carried program for the expedition.','啟動入口長廊符文迴路、清除守衛，並把程式帶入本次遠征。'] }
  );
  if (id === 'r1b') return encounterBase(run,id,
    ['############','#H........E#','#...F..I...#','############'],
    { defeatAll:true, reachExit:true },
    { main:[FOR('foe',[T(V('foe')),A('cast')]),R(L(9),[A('move')])], functions:{} },
    { practiceSpellDamage:3, practiceRange:6, practiceElement:'fire', parBlocks:5, objectiveText:['Clear a party while preserving a reusable collection program.','保留可重複使用的集合程式並清除敵人小隊。'] }
  );
  if (id === 'r2' || id === 'r4a') {
    const modifier = run.eliteModifiers[id];
    return encounterBase(run,id,eliteMap(modifier,id === 'r4a'),{ defeatAll:true, reachExit:true, minHp:1 },eliteReference(),{
      practiceSpellDamage:4, practiceRange:6, practiceElement:'frost', parBlocks:10,
      eliteModifier:modifier,
      objectiveText:['Elite modifier: ' + modifier + '. Adapt the carried program instead of memorizing one sequence.','菁英修飾：' + modifier + '。調整沿用的程式，而不是背固定步驟。']
    });
  }
  return encounterBase(run,'r5',
    ['##############','#H.L.PZ....E.#','#..S..Y..I...#','#............#','##############'],
    { activateAllLevers:true, activateAllPlates:true, openAllRuneGates:true, defeatAll:true, reachExit:true, minHp:1 },
    { main:[A('move'),IF('leverAhead',[A('interact')]),R(L(3),[A('move')]),FOR('foe',[T(V('foe')),R(L(2),[A('cast')])]),R(L(6),[A('move')])], functions:{} },
    { switchesRequired:2, practiceSpellDamage:4, practiceRange:6, practiceElement:'frost', parBlocks:12, objectiveText:['Spend three compiler sigils, power both sanctum mechanisms, then defeat the shielded Root Compiler party and escape.','花費三枚編譯符印、啟動聖所兩個機關，再擊敗帶護盾的根編譯器隊伍並逃離。'] }
  );
}

export function dungeonRunSummary(raw) {
  const run = normalizeDungeonRun(raw); if (!run) return null;
  return Object.freeze({
    roomsCleared:run.cleared.length, routeLength:run.route.length, hp:run.hp, maxHp:run.maxHp, coins:run.coins,
    provisions:run.provisions, boons:run.boons, sigils:run.sigils, sigilsRequired:SIGILS_REQUIRED,
    layoutId:run.layoutId, hazard:hazardInfo(run), frontier:Object.freeze(frontier(run)),
    savedLoadouts:run.runeLoadouts.filter(Boolean).length, finished:run.finished, failed:run.failed
  });
}

export const DUNGEON_RUN_ROOM_IDS = ROOM_IDS;
export const DUNGEON_RUN_TYPES = TYPES;
