/* Code Quest program AST. Pure and DOM-free so the same structure can back
   picture cards, visual blocks and the restricted written-code editor.

   v0.14 keeps the bounded expression/iteration layer and adds actor-owned state,
   FIFO message protocols, independent persistent behavior ownership and bounded event-handler registration.
   It is still not JavaScript execution. */

export const ACTIONS = Object.freeze([
  'move', 'turnLeft', 'turnRight', 'attack', 'heavyAttack', 'guard', 'open', 'disarm',
  'usePotion', 'useAntidote', 'useWard', 'wait',
  'targetNearest', 'targetWeakest', 'targetArmored', 'targetElementWeak', 'cast',
  'interact', 'smash', 'push', 'take', 'throw',
  'companionFollow', 'companionHold', 'companionGuard', 'companionAssist',
  'companionMove', 'companionTurnLeft', 'companionTurnRight', 'companionInteract', 'companionPush', 'companionTake', 'companionThrow'
]);

export const CONDITIONS = Object.freeze([
  'enemyAhead', 'enemyArmoredAhead', 'enemyWeakAhead', 'dangerIncoming', 'heroPoisoned',
  'chestAhead', 'doorAhead', 'trapAhead', 'blockedAhead', 'hasKey', 'hpLow', 'onExit',
  'multipleEnemies', 'targetInRange', 'targetWeak', 'targetArmored', 'targetElementWeak',
  'leverAhead', 'breakableAhead', 'npcAhead', 'runeGateAhead',
  'pushableAhead', 'cycleTrapAhead', 'cycleTrapActiveAhead', 'platformAhead', 'onPlatform', 'questTokenAhead', 'companionNear',
  'carryableAhead', 'heroCarrying', 'heroOnPlate', 'companionCarryableAhead', 'companionCarrying', 'companionOnPlate'
]);

const INDEXED_ENEMY_PATHS = Object.freeze(
  Array.from({ length: 4 }, (_, index) =>
    ['hp','maxHp','armor','distance','element','alive'].map(field => `enemies.${index}.${field}`)
  ).flat()
);

export const PROPERTY_PATHS = Object.freeze([
  'hero.hp', 'hero.maxHp', 'hero.keys', 'hero.weapon.damage', 'hero.weapon.range',
  'hero.weapon.spellDamage', 'hero.weapon.element', 'hero.weapon.rarityRank', 'hero.weapon.affixCount', 'hero.build.synergyCount', 'hero.armor.defense', 'hero.armor.rarityRank', 'hero.charm.rarityRank',
  'hero.inventory.healing', 'hero.inventory.focus', 'hero.inventory.antidote', 'hero.inventory.ward',
  'hero.run.sigils', 'hero.run.roomsCleared', 'hero.run.coins', 'hero.run.hazardActive',
  'hero.world.switchesActive', 'hero.world.switchesRequired', 'hero.world.circuitSatisfied', 'hero.world.gatesOpen', 'hero.world.cratesRemaining', 'hero.world.npcsHelped',
  'hero.world.pushablesMoved', 'hero.world.pushablesOnPlates', 'hero.world.clockPhase', 'hero.world.activeCycleTraps', 'hero.world.platformPhase',
  'hero.world.questsStarted', 'hero.world.questTokens', 'hero.world.questsCompleted',
  'hero.world.orbsRemaining', 'hero.world.orbsOnPlates', 'hero.world.livePlates', 'hero.world.callbacksTriggered',
  'hero.carrying', 'hero.state', 'hero.signal.last', 'hero.signal.from', 'hero.signal.count', 'hero.signal.pending', 'companion.state', 'companion.signal.last', 'companion.signal.from', 'companion.signal.count', 'companion.signal.pending', 'companion.mode', 'companion.dir', 'companion.distance', 'companion.guarding', 'companion.assists', 'companion.carrying',
  'hero.target.hp', 'hero.target.maxHp', 'hero.target.armor', 'hero.target.distance', 'hero.target.element',
  'enemy.hp', 'enemy.maxHp', 'enemy.armor', 'enemy.distance', 'enemy.incoming', 'enemy.element',
  'enemies.length', 'enemies.armoredCount', 'enemies.weakCount', 'enemies.burningCount', 'enemies.frozenCount',
  ...INDEXED_ENEMY_PATHS
]);

export const EVENTS = Object.freeze(['danger', 'poisoned', 'circuitReady', 'companionFar', 'signal']);
export const SIGNALS = Object.freeze(['ready', 'help', 'switch', 'retreat']);
export const ACTOR_STATES = Object.freeze(['explore', 'defend', 'attack', 'regroup', 'wait', 'escape']);

export const BINARY_OPS = Object.freeze(['+', '-', '*', '/', '<', '<=', '>', '>=', '===', '!==', '&&', '||']);

const MAX_NODES = 128;
const MAX_DEPTH = 10;
const MAX_REPEAT = 12;
const MAX_FUNCTIONS = 6;
const MAX_PARAMS = 3;
const MAX_ARGS = 3;
const MAX_VARIABLES = 12;
const MAX_FOREACH = 4;
const MAX_HANDLERS = 5;
const MAX_SIGNALS = 8;
const ENEMY_ITEM_FIELDS = Object.freeze(['hp','maxHp','armor','distance','element','alive','weakTo','burning','frozen']);

function id(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(value) ? value : undefined;
}
function name(value) {
  return typeof value === 'string' && /^[a-zA-Z][a-zA-Z0-9_]{0,23}$/.test(value) ? value : undefined;
}
function safeScalar(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(-999, Math.min(999, value));
  if (typeof value === 'string' && value.length <= 32) return value;
  if (value === null) return null;
  return 0;
}

export function literal(value) { return Object.freeze({ type: 'literal', value: safeScalar(value) }); }
export function variableRef(variableName) {
  const safe = name(variableName); if (!safe) throw new Error('Invalid Code Quest variable name');
  return Object.freeze({ type: 'var', name: safe });
}
export function propertyRef(path) {
  const safe = String(path || '');
  if (!PROPERTY_PATHS.includes(safe)) throw new Error('Unknown Code Quest property: ' + safe);
  return Object.freeze({ type: 'property', path: safe });
}
export function sensor(test) {
  if (!CONDITIONS.includes(test)) throw new Error('Unknown Code Quest sensor: ' + test);
  return Object.freeze({ type: 'sensor', test });
}
export function binary(op, left, right) {
  if (!BINARY_OPS.includes(op)) throw new Error('Unknown Code Quest operator: ' + op);
  return Object.freeze({ type: 'binary', op, left: normalizeExpression(left), right: normalizeExpression(right) });
}
export function unaryNot(value) { return Object.freeze({ type: 'not', value: normalizeExpression(value) }); }
export function memberRef(variableName, field) {
  const safe = name(variableName);
  if (!safe || !ENEMY_ITEM_FIELDS.includes(field)) throw new Error('Invalid Code Quest collection member');
  return Object.freeze({ type: 'member', name: safe, field });
}

export function normalizeExpression(raw, depth = 0) {
  if (depth > MAX_DEPTH) return literal(0);
  if (typeof raw === 'number' || typeof raw === 'boolean' || typeof raw === 'string' || raw === null) return literal(raw);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return literal(0);
  if (raw.type === 'literal') return literal(raw.value);
  if (raw.type === 'var') { const safe = name(raw.name); return safe ? Object.freeze({ type: 'var', name: safe }) : literal(0); }
  if (raw.type === 'property' && PROPERTY_PATHS.includes(raw.path)) return Object.freeze({ type: 'property', path: raw.path });
  if (raw.type === 'sensor' && CONDITIONS.includes(raw.test)) return Object.freeze({ type: 'sensor', test: raw.test });
  if (raw.type === 'member') { const safe = name(raw.name); return safe && ENEMY_ITEM_FIELDS.includes(raw.field) ? Object.freeze({ type: 'member', name: safe, field: raw.field }) : literal(0); }
  if (raw.type === 'not') return Object.freeze({ type: 'not', value: normalizeExpression(raw.value, depth + 1) });
  if (raw.type === 'binary' && BINARY_OPS.includes(raw.op)) {
    return Object.freeze({ type: 'binary', op: raw.op, left: normalizeExpression(raw.left, depth + 1), right: normalizeExpression(raw.right, depth + 1) });
  }
  return literal(0);
}

function normalizeTest(raw) {
  return typeof raw === 'string' && CONDITIONS.includes(raw) ? raw : normalizeExpression(raw);
}
function normalizeRepeatCount(raw) {
  if (typeof raw === 'number') return Math.max(1, Math.min(MAX_REPEAT, Math.floor(Number(raw) || 1)));
  return normalizeExpression(raw);
}
function normalizeArgs(raw) {
  return Object.freeze((Array.isArray(raw) ? raw : []).slice(0, MAX_ARGS).map(value => normalizeExpression(value)));
}

export function action(op, uid) {
  if (!ACTIONS.includes(op)) throw new Error('Unknown Code Quest action: ' + op);
  return Object.freeze({ type: 'action', op, ...(id(uid) ? { uid: id(uid) } : {}) });
}
export function targetNode(index, uid) {
  return Object.freeze({ type: 'target', index: normalizeExpression(index), ...(id(uid) ? { uid: id(uid) } : {}) });
}
export function repeat(times, body, uid) {
  return Object.freeze({ type: 'repeat', times: normalizeRepeatCount(times), body: cloneProgram(body), ...(id(uid) ? { uid: id(uid) } : {}) });
}
export function ifNode(test, thenBody, elseBody = [], uid) {
  return Object.freeze({ type: 'if', test: normalizeTest(test), then: cloneProgram(thenBody), else: cloneProgram(elseBody), ...(id(uid) ? { uid: id(uid) } : {}) });
}
export function call(functionName, uid, args = [], assign) {
  const safe = name(functionName); if (!safe) throw new Error('Invalid Code Quest function name');
  const target = name(assign);
  return Object.freeze({ type: 'call', name: safe, args: normalizeArgs(args), ...(target ? { assign: target } : {}), ...(id(uid) ? { uid: id(uid) } : {}) });
}
export function letNode(variableName, value, uid) {
  const safe = name(variableName); if (!safe) throw new Error('Invalid Code Quest variable name');
  return Object.freeze({ type: 'let', name: safe, value: normalizeExpression(value), ...(id(uid) ? { uid: id(uid) } : {}) });
}
export function returnNode(value = literal(0), uid) {
  return Object.freeze({ type: 'return', value: normalizeExpression(value), ...(id(uid) ? { uid: id(uid) } : {}) });
}
export function forOfNode(iterator, body, uid) {
  const safe = name(iterator); if (!safe) throw new Error('Invalid Code Quest iterator name');
  return Object.freeze({ type: 'forOf', iterator: safe, collection: 'enemies', body: cloneProgram(body), ...(id(uid) ? { uid: id(uid) } : {}) });
}
export function onNode(eventName, functionName, uid) {
  const event = String(eventName || ''), safe = name(functionName);
  if (!EVENTS.includes(event)) throw new Error('Unknown Code Quest event: ' + event);
  if (!safe) throw new Error('Invalid Code Quest handler name');
  return Object.freeze({ type: 'on', event, name: safe, ...(id(uid) ? { uid: id(uid) } : {}) });
}
export function signalNode(actor, channel, uid) {
  const who = actor === 'companion' ? 'companion' : 'hero', safe = String(channel || '');
  if (!SIGNALS.includes(safe)) throw new Error('Unknown Code Quest signal: ' + safe);
  return Object.freeze({ type:'signal', actor:who, channel:safe, ...(id(uid) ? { uid:id(uid) } : {}) });
}
export function stateNode(actor, state, uid) {
  const who = actor === 'companion' ? 'companion' : 'hero', safe = String(state || '');
  if (!ACTOR_STATES.includes(safe)) throw new Error('Unknown Code Quest actor state: ' + safe);
  return Object.freeze({ type:'state', actor:who, state:safe, ...(id(uid) ? { uid:id(uid) } : {}) });
}

function normalizeNode(raw, depth, counter) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || depth > MAX_DEPTH || counter.count >= MAX_NODES) return null;
  counter.count++;
  const uid = id(raw.uid);
  if (raw.type === 'action' && ACTIONS.includes(raw.op)) return action(raw.op, uid);
  if (raw.type === 'target') return targetNode(raw.index, uid);
  if (raw.type === 'repeat') return Object.freeze({ type: 'repeat', times: normalizeRepeatCount(raw.times), body: normalizeProgramInternal(raw.body, depth + 1, counter), ...(uid ? { uid } : {}) });
  if (raw.type === 'if') return Object.freeze({ type: 'if', test: normalizeTest(raw.test), then: normalizeProgramInternal(raw.then, depth + 1, counter), else: normalizeProgramInternal(raw.else, depth + 1, counter), ...(uid ? { uid } : {}) });
  if (raw.type === 'call') {
    const safe = name(raw.name), target = name(raw.assign);
    if (safe) return Object.freeze({ type: 'call', name: safe, args: normalizeArgs(raw.args), ...(target ? { assign: target } : {}), ...(uid ? { uid } : {}) });
  }
  if (raw.type === 'let') {
    const safe = name(raw.name); if (safe) return Object.freeze({ type: 'let', name: safe, value: normalizeExpression(raw.value), ...(uid ? { uid } : {}) });
  }
  if (raw.type === 'return') return Object.freeze({ type: 'return', value: normalizeExpression(raw.value), ...(uid ? { uid } : {}) });
  if (raw.type === 'forOf') { const safe = name(raw.iterator); if (safe && raw.collection === 'enemies') return Object.freeze({ type: 'forOf', iterator: safe, collection: 'enemies', body: normalizeProgramInternal(raw.body, depth + 1, counter), ...(uid ? { uid } : {}) }); }
  if (raw.type === 'on') { const event = String(raw.event || ''), safe = name(raw.name); if (EVENTS.includes(event) && safe) return Object.freeze({ type:'on', event, name:safe, ...(uid ? { uid } : {}) }); }
  if (raw.type === 'signal') { const actor = raw.actor === 'companion' ? 'companion' : 'hero', channel=String(raw.channel||''); if (SIGNALS.includes(channel)) return Object.freeze({ type:'signal', actor, channel, ...(uid ? { uid } : {}) }); }
  if (raw.type === 'state') { const actor = raw.actor === 'companion' ? 'companion' : 'hero', state=String(raw.state||''); if (ACTOR_STATES.includes(state)) return Object.freeze({ type:'state', actor, state, ...(uid ? { uid } : {}) }); }
  return null;
}

function normalizeProgramInternal(raw, depth, counter) {
  if (!Array.isArray(raw) || depth > MAX_DEPTH || counter.count >= MAX_NODES) return Object.freeze([]);
  const out = [];
  for (const item of raw) {
    if (counter.count >= MAX_NODES) break;
    const node = normalizeNode(item, depth, counter);
    if (node) out.push(node);
  }
  return Object.freeze(out);
}
export function normalizeProgram(raw) { return normalizeProgramInternal(raw, 0, { count: 0 }); }

function normalizeParams(raw) {
  const out = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const safe = name(item);
    if (safe && !out.includes(safe) && out.length < MAX_PARAMS) out.push(safe);
  }
  return Object.freeze(out);
}
export function functionDescriptor(value) {
  if (Array.isArray(value)) return Object.freeze({ params: Object.freeze([]), body: normalizeProgram(value), legacy: true });
  if (value && typeof value === 'object' && !Array.isArray(value)) return Object.freeze({ params: normalizeParams(value.params), body: normalizeProgram(value.body), legacy: false });
  return Object.freeze({ params: Object.freeze([]), body: Object.freeze([]), legacy: true });
}
function normalizedFunctionValue(value) {
  const desc = functionDescriptor(value);
  if (!desc.params.length && (Array.isArray(value) || desc.legacy)) return desc.body;
  return Object.freeze({ params: desc.params, body: desc.body });
}
export function normalizeFunctions(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return Object.freeze({});
  const out = {}; let count = 0;
  for (const [key, value] of Object.entries(raw)) {
    const safe = name(key); if (!safe || count >= MAX_FUNCTIONS) continue;
    out[safe] = normalizedFunctionValue(value); count++;
  }
  return Object.freeze(out);
}
export function cloneProgram(program) { return normalizeProgram(program); }

export function programBlockCount(program) {
  let count = 0;
  function walk(nodes) {
    for (const node of normalizeProgram(nodes)) {
      count++;
      if (node.type === 'repeat' || node.type === 'forOf') walk(node.body);
      else if (node.type === 'if') { walk(node.then); walk(node.else); }
    }
  }
  walk(program); return count;
}
export function combinedBlockCount(program, functions) {
  let total = programBlockCount(program);
  const safe = normalizeFunctions(functions), used = new Set(), visiting = new Set();
  function scan(nodes) {
    for (const node of normalizeProgram(nodes)) {
      if (node.type === 'call' || node.type === 'on') {
        if (!used.has(node.name) && safe[node.name] && !visiting.has(node.name)) {
          used.add(node.name); visiting.add(node.name);
          const desc = functionDescriptor(safe[node.name]); total += programBlockCount(desc.body); scan(desc.body); visiting.delete(node.name);
        }
      } else if (node.type === 'repeat' || node.type === 'forOf') scan(node.body);
      else if (node.type === 'if') { scan(node.then); scan(node.else); }
    }
  }
  scan(program); return total;
}

export function containsElseBranch(program) {
  let found = false;
  function walk(nodes) { for (const node of normalizeProgram(nodes)) { if (node.type === 'if') { if (node.else.length) { found = true; return; } walk(node.then); walk(node.else); } else if (node.type === 'repeat' || node.type === 'forOf') walk(node.body); if (found) return; } }
  walk(program); return found;
}
export function containsNodeType(program, type) {
  let found = false;
  function walk(nodes) { for (const node of normalizeProgram(nodes)) { if (node.type === type) { found = true; return; } if (node.type === 'repeat' || node.type === 'forOf') walk(node.body); else if (node.type === 'if') { walk(node.then); walk(node.else); } if (found) return; } }
  walk(program); return found;
}
export function containsExpressionType(program, type) {
  let found = false;
  function expr(value) {
    if (!value || typeof value !== 'object' || found) return;
    if (value.type === type) { found = true; return; }
    if (value.type === 'binary') { expr(value.left); expr(value.right); }
    else if (value.type === 'not') expr(value.value);
  }
  function walk(nodes) {
    for (const node of normalizeProgram(nodes)) {
      if (node.type === 'let' || node.type === 'return') expr(node.value);
      else if (node.type === 'target') expr(node.index);
      else if (node.type === 'call') node.args.forEach(expr);
      else if (node.type === 'repeat') { if (typeof node.times !== 'number') expr(node.times); walk(node.body); }
      else if (node.type === 'forOf') walk(node.body);
      else if (node.type === 'if') { if (typeof node.test !== 'string') expr(node.test); walk(node.then); walk(node.else); }
      if (found) return;
    }
  }
  walk(program); return found;
}

const JS_ACTION = Object.freeze({
  move:'hero.move();', turnLeft:'hero.turnLeft();', turnRight:'hero.turnRight();',
  attack:'hero.attack();', heavyAttack:'hero.heavyAttack();', guard:'hero.guard();',
  open:'hero.open();', disarm:'hero.disarm();', usePotion:'hero.usePotion();',
  useAntidote:'hero.useAntidote();', useWard:'hero.useWard();', wait:'hero.wait();',
  targetNearest:'hero.targetNearest();', targetWeakest:'hero.targetWeakest();',
  targetArmored:'hero.targetArmored();', targetElementWeak:'hero.targetElementWeak();',
  cast:'hero.cast();', interact:'hero.interact();', smash:'hero.smash();', push:'hero.push();', take:'hero.take();', throw:'hero.throw();',
  companionFollow:'companion.follow();', companionHold:'companion.hold();', companionGuard:'companion.guard();', companionAssist:'companion.assist();',
  companionMove:'companion.move();', companionTurnLeft:'companion.turnLeft();', companionTurnRight:'companion.turnRight();', companionInteract:'companion.interact();', companionPush:'companion.push();', companionTake:'companion.take();', companionThrow:'companion.throw();'
});
const JS_TEST = Object.freeze({
  enemyAhead:'hero.seesEnemyAhead()', enemyArmoredAhead:'hero.seesArmoredEnemyAhead()',
  enemyWeakAhead:'hero.seesWeakEnemyAhead()', dangerIncoming:'hero.seesIncomingDanger()',
  heroPoisoned:'hero.isPoisoned()', chestAhead:'hero.seesChestAhead()', doorAhead:'hero.seesDoorAhead()',
  trapAhead:'hero.seesTrapAhead()', blockedAhead:'hero.isBlockedAhead()', hasKey:'hero.keys > 0',
  hpLow:'hero.hp <= hero.maxHp / 2', onExit:'hero.isOnExit()',
  multipleEnemies:'hero.seesMultipleEnemies()', targetInRange:'hero.isTargetInRange()',
  targetWeak:'hero.isTargetWeak()', targetArmored:'hero.isTargetArmored()',
  targetElementWeak:'hero.isTargetElementWeak()', leverAhead:'hero.seesLeverAhead()',
  breakableAhead:'hero.seesBreakableAhead()', npcAhead:'hero.seesNpcAhead()', runeGateAhead:'hero.seesRuneGateAhead()',
  pushableAhead:'hero.seesPushableAhead()', cycleTrapAhead:'hero.seesCycleTrapAhead()', cycleTrapActiveAhead:'hero.seesActiveCycleTrapAhead()',
  platformAhead:'hero.seesPlatformAhead()', onPlatform:'hero.isOnPlatform()', questTokenAhead:'hero.seesQuestTokenAhead()', companionNear:'hero.isCompanionNear()',
  carryableAhead:'hero.seesCarryableAhead()', heroCarrying:'hero.isCarrying()', heroOnPlate:'hero.isOnPlate()', companionCarryableAhead:'companion.seesCarryableAhead()', companionCarrying:'companion.isCarrying()', companionOnPlate:'companion.isOnPlate()'
});
const PRECEDENCE = Object.freeze({ '||':1, '&&':2, '===':3, '!==':3, '<':3, '<=':3, '>':3, '>=':3, '+':4, '-':4, '*':5, '/':5 });
function jsString(value) { return JSON.stringify(String(value)); }
function expressionJavaScript(raw, parent = 0) {
  const expr = normalizeExpression(raw);
  if (expr.type === 'literal') return typeof expr.value === 'string' ? jsString(expr.value) : String(expr.value);
  if (expr.type === 'var') return expr.name;
  if (expr.type === 'member') return expr.name + '.' + expr.field;
  if (expr.type === 'property') {
    const indexed = /^enemies\.(\d+)\.(hp|maxHp|armor|distance|element|alive)$/.exec(expr.path);
    return indexed ? `enemies[${indexed[1]}].${indexed[2]}` : expr.path;
  }
  if (expr.type === 'sensor') return JS_TEST[expr.test] || 'false';
  if (expr.type === 'not') return '!' + expressionJavaScript(expr.value, 6);
  if (expr.type === 'binary') {
    const prec = PRECEDENCE[expr.op] || 1;
    const text = expressionJavaScript(expr.left, prec) + ' ' + expr.op + ' ' + expressionJavaScript(expr.right, prec + 1);
    return prec < parent ? '(' + text + ')' : text;
  }
  return '0';
}
function testJavaScript(test) { return typeof test === 'string' ? (JS_TEST[test] || 'false') : expressionJavaScript(test); }
function repeatJavaScript(times) { return typeof times === 'number' ? String(times) : expressionJavaScript(times); }
function linesFor(nodes, depth) {
  const pad = '  '.repeat(depth), out = [];
  for (const node of normalizeProgram(nodes)) {
    if (node.type === 'action') out.push(pad + JS_ACTION[node.op]);
    else if (node.type === 'target') out.push(pad + 'hero.target(' + expressionJavaScript(node.index) + ');');
    else if (node.type === 'let') out.push(pad + 'let ' + node.name + ' = ' + expressionJavaScript(node.value) + ';');
    else if (node.type === 'return') out.push(pad + 'return ' + expressionJavaScript(node.value) + ';');
    else if (node.type === 'call') out.push(pad + (node.assign ? 'let ' + node.assign + ' = ' : '') + node.name + '(' + node.args.map(arg => expressionJavaScript(arg)).join(', ') + ');');
    else if (node.type === 'repeat') { out.push(pad + 'repeat(' + repeatJavaScript(node.times) + ', () => {'); out.push(...linesFor(node.body, depth + 1)); out.push(pad + '});'); }
    else if (node.type === 'forOf') { out.push(pad + 'for (const ' + node.iterator + ' of enemies) {'); out.push(...linesFor(node.body, depth + 1)); out.push(pad + '}'); }
    else if (node.type === 'on') out.push(pad + 'on(' + jsString(node.event) + ', ' + node.name + ');');
    else if (node.type === 'signal') out.push(pad + node.actor + '.signal(' + jsString(node.channel) + ');');
    else if (node.type === 'state') out.push(pad + node.actor + '.state = ' + jsString(node.state) + ';');
    else if (node.type === 'if') { out.push(pad + 'if (' + testJavaScript(node.test) + ') {'); out.push(...linesFor(node.then, depth + 1)); if (node.else.length) { out.push(pad + '} else {'); out.push(...linesFor(node.else, depth + 1)); } out.push(pad + '}'); }
  }
  return out;
}
export function toJavaScript(program, functions = {}) {
  const safeFns = normalizeFunctions(functions), chunks = [];
  for (const [fn, value] of Object.entries(safeFns)) {
    const desc = functionDescriptor(value); if (!desc.body.length) continue;
    chunks.push('function ' + fn + '(' + desc.params.join(', ') + ') {'); chunks.push(...linesFor(desc.body, 1)); chunks.push('}', '');
  }
  chunks.push(...linesFor(program, 0));
  return chunks.join('\n').trim() || '// Build a program · 建立程式';
}

export const AST_LIMITS = Object.freeze({ MAX_NODES, MAX_DEPTH, MAX_REPEAT, MAX_FUNCTIONS, MAX_PARAMS, MAX_ARGS, MAX_VARIABLES, MAX_FOREACH, MAX_HANDLERS, MAX_SIGNALS });
export const COLLECTION_FIELDS = ENEMY_ITEM_FIELDS;
