/* Laboratory of Curiosity resolver (design.md D4, D7, D8). Pure and deterministic:
   an experiment is 1–4 ingredients in drop order plus up to 5 process steps in order.
   An exact recipe with its exact steps makes a potion; anything else walks LAB_RULES
   and always lands on a reaction. A recipe mix in the wrong order gets hint 'order'.
   Phase 2 (lab-states D3, D5, D6): an ingredient is an id (fresh) or `{ id, state }`; its
   state changes its own points before summing, and potions need fresh ingredients —
   a recipe's ingredients with one changed get hint 'fresh'. */
import { LAB_PROPERTIES, LAB_INGREDIENTS, LAB_STATES, applyState } from './ingredients.js';
import { LAB_RULES } from './rules.js';
import { ALCHEMY_STEPS } from '../progression.js';

export const LAB_MAX_INGREDIENTS = 4;
export const LAB_MAX_STEPS = 5;
// The live tint shows what the mix is made of; chaos and calm show as shaking instead.
const TINTS = LAB_PROPERTIES.filter(prop => prop !== 'chaos' && prop !== 'calm');

/** Experiment entries as `{ id, state }`. An item is `{ id, state }`, a bare id (fresh) or the
    screen's key `"id:state"`; an unknown state is fresh. */
export function labEntries(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const [keyId, keyState] = typeof item === 'string' ? item.split(':') : [];
    const id = typeof item === 'string' ? keyId : item && typeof item === 'object' ? item.id : null;
    if (typeof id !== 'string' || !Object.hasOwn(LAB_INGREDIENTS, id)) continue;
    const raw = typeof item === 'string' ? keyState : item.state;
    const state = LAB_STATES.includes(raw) ? raw : 'raw';
    out.push(Object.freeze({ id, state }));
    if (out.length >= LAB_MAX_INGREDIENTS) break;
  }
  return out;
}
function stateCounts(entries) {
  const out = { crushed: 0, heated: 0, frozen: 0 };
  for (const entry of entries) if (entry.state !== 'raw') out[entry.state] += 1;
  return out;
}
function cleanSteps(list) {
  return Array.isArray(list) ? list.filter(step => ALCHEMY_STEPS.includes(step)).slice(0, LAB_MAX_STEPS) : [];
}
function counts(ids) {
  const out = {};
  for (const id of ids) out[id] = (out[id] || 0) + 1;
  return out;
}
function sameCounts(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every(key => (a[key] || 0) === (b[key] || 0));
}

/** Summed properties after process steps; instability = chaos − calm. */
export function sumExperiment(ingredients, steps) {
  const entries = labEntries(ingredients), process = cleanSteps(steps);
  const sums = Object.fromEntries(LAB_PROPERTIES.map(prop => [prop, 0]));
  for (const { id, state } of entries) for (const [prop, n] of Object.entries(applyState(LAB_INGREDIENTS[id].props, state))) sums[prop] += n;
  let stirs = 0;
  for (const step of process) {
    if (step === 'heat') { sums.fire += 1; sums.chaos += 1; }
    else if (step === 'cool') { sums.cold += 1; sums.calm += 1; }
    else if (step === 'grind') sums.chaos += 1;
    else if (step === 'stir') stirs += 1;
  }
  if (stirs >= 2) sums.calm += 1;
  sums.instability = sums.chaos - sums.calm;
  return sums;
}

export function resolveExperiment({ ingredients, steps, recipes = [] } = {}) {
  const entries = labEntries(ingredients), process = cleanSteps(steps), mix = counts(entries.map(entry => entry.id));
  const states = stateCounts(entries), fresh = states.crushed + states.heated + states.frozen === 0;
  const recipe = entries.length ? recipes.find(entry => sameCounts(mix, counts(entry.ingredients))) : null;
  const inOrder = !!recipe && recipe.process.length === process.length && recipe.process.every((step, i) => step === process[i]);
  if (recipe && inOrder && fresh) return Object.freeze({ kind: 'potion', potionId: recipe.id, recipeId: recipe.id });
  const sums = sumExperiment(entries, process);
  const hit = LAB_RULES.find(entry => entry.test(sums, mix, states));
  const intensity = Math.min(3, Math.max(1, 1 + Math.floor(hit.over(sums) / 2)));
  const result = { kind: 'reaction', ruleId: hit.id, family: hit.family, intensity };
  // A changed ingredient is the first thing to fix, so 'fresh' wins over 'order'.
  if (recipe) result.hint = fresh ? 'order' : 'fresh';
  return Object.freeze(result);
}

/** Live cauldron hint while adding: tint toward the strongest property, shake when unstable. */
export function mixHint(ingredients, steps) {
  const sums = sumExperiment(ingredients, steps);
  let tint = null;
  for (const prop of TINTS) if (sums[prop] > 0 && (tint === null || sums[prop] > sums[tint])) tint = prop;
  return Object.freeze({ tint, shaky: sums.instability >= 3 });
}

/** The screen's compact key for an entry: the bare id when fresh, else "id:state". */
export function labKey(id, state = 'raw') {
  return state && state !== 'raw' ? id + ':' + state : id;
}
