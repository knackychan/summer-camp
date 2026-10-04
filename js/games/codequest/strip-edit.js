/* Program-strip edits for the floating card menu (redesign UX polish slice 08, U3–U5).
   Pure list operations over existing AST nodes: inputs are never mutated, nodes are
   rebuilt only with ast.js constructors, so the AST shape and the game rules stay as
   they are (design D8). A refused edit returns null. */
import { repeat, ifNode } from './ast.js';

/** Library IF card id → the condition it tests. */
export const IF_TESTS = Object.freeze({
  ifEnemy: 'enemyAhead', ifArmored: 'enemyArmoredAhead', ifWeak: 'enemyWeakAhead', ifDanger: 'dangerIncoming',
  ifPoisoned: 'heroPoisoned', ifChest: 'chestAhead', ifDoor: 'doorAhead', ifTrap: 'trapAhead', ifKey: 'hasKey',
  ifHpLow: 'hpLow', ifMultiple: 'multipleEnemies', ifTargetRange: 'targetInRange', ifTargetWeak: 'targetWeak',
  ifElementWeak: 'targetElementWeak', ifLever: 'leverAhead', ifBreakable: 'breakableAhead', ifNpc: 'npcAhead',
  ifRuneGate: 'runeGateAhead', ifPushable: 'pushableAhead', ifCycleTrap: 'cycleTrapAhead',
  ifCycleTrapActive: 'cycleTrapActiveAhead', ifPlatform: 'platformAhead', ifOnPlatform: 'onPlatform',
  ifQuestToken: 'questTokenAhead', ifCompanionNear: 'companionNear', ifCarryable: 'carryableAhead',
  ifHeroCarrying: 'heroCarrying', ifHeroOnPlate: 'heroOnPlate', ifCompanionCarryable: 'companionCarryableAhead',
  ifCompanionCarrying: 'companionCarrying', ifCompanionOnPlate: 'companionOnPlate'
});

/** Repeat counts a room offers, from its library logic ids (repeat2 → 2). */
export function repeatCounts(logicIds) {
  return (logicIds || []).filter(id => /^repeat\d+$/.test(id)).map(id => Number(id.slice(6))).sort((a, b) => a - b);
}
/** IF tests a room offers, as [logicId, test] pairs in library order. */
export function ifTests(logicIds) {
  return (logicIds || []).filter(id => IF_TESTS[id]).map(id => [id, IF_TESTS[id]]);
}

const valid = (list, index) => Number.isInteger(index) && index >= 0 && index < list.length;

/** Insert after `index`; out of range (or -1) appends. */
export function insertAfter(list, index, node) {
  const at = valid(list, index) ? index + 1 : list.length;
  return list.slice(0, at).concat(node, list.slice(at));
}

export function canUnwrap(node) {
  return !!node && (node.type === 'repeat' || (node.type === 'if' && !(node.else && node.else.length)));
}
/** The bracket's cards take its place. An IF with an else branch can't unwrap (its cards would merge). */
export function unwrap(list, index) {
  if (!valid(list, index) || !canUnwrap(list[index])) return null;
  const node = list[index], body = node.type === 'repeat' ? node.body : node.then;
  return list.slice(0, index).concat(body, list.slice(index + 1));
}

export function setRepeatCount(list, index, times, allowed) {
  const node = valid(list, index) ? list[index] : null;
  if (!node || node.type !== 'repeat' || !allowed.includes(times)) return null;
  return list.slice(0, index).concat(repeat(times, node.body, node.uid), list.slice(index + 1));
}
/** The next count in the room's cycle (2 → 3 → 5 → 2). */
export function nextRepeatCount(times, allowed) {
  if (!allowed.length) return null;
  const i = allowed.indexOf(times);
  return allowed[(i + 1) % allowed.length];
}

export function setCondition(list, index, test, allowed) {
  const node = valid(list, index) ? list[index] : null;
  if (!node || node.type !== 'if' || !allowed.includes(test)) return null;
  return list.slice(0, index).concat(ifNode(test, node.then, node.else, node.uid), list.slice(index + 1));
}

/** Tapping a card: next to the selection extends it, an end card shrinks it, anything else starts over. */
export function extendSelection(selection, index) {
  const picked = [...selection].sort((a, b) => a - b);
  if (!picked.length) return new Set([index]);
  const lo = picked[0], hi = picked[picked.length - 1];
  if (selection.has(index)) {
    if (picked.length === 1) return new Set();
    if (index === lo || index === hi) return new Set(picked.filter(i => i !== index));
    return new Set([index]);
  }
  if (index === lo - 1 || index === hi + 1) return new Set(picked.concat(index));
  return new Set([index]);
}
