/* Laboratory of Curiosity resolver (design.md D4, D7, D8). Pure and deterministic:
   an experiment is 1–4 ingredients in drop order plus up to 5 process steps in order.
   An exact recipe with its exact steps makes a potion; anything else walks LAB_RULES
   and always lands on a reaction. A recipe mix in the wrong order gets hint 'order'. */
import { LAB_PROPERTIES, LAB_INGREDIENTS } from './ingredients.js';
import { LAB_RULES } from './rules.js';
import { ALCHEMY_STEPS } from '../progression.js';

export const LAB_MAX_INGREDIENTS = 4;
export const LAB_MAX_STEPS = 5;
// The live tint shows what the mix is made of; chaos and calm show as shaking instead.
const TINTS = LAB_PROPERTIES.filter(prop => prop !== 'chaos' && prop !== 'calm');

function cleanIngredients(list) {
  return Array.isArray(list) ? list.filter(id => typeof id === 'string' && Object.hasOwn(LAB_INGREDIENTS, id)).slice(0, LAB_MAX_INGREDIENTS) : [];
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
  const ids = cleanIngredients(ingredients), process = cleanSteps(steps);
  const sums = Object.fromEntries(LAB_PROPERTIES.map(prop => [prop, 0]));
  for (const id of ids) for (const [prop, n] of Object.entries(LAB_INGREDIENTS[id].props)) sums[prop] += n;
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
  const ids = cleanIngredients(ingredients), process = cleanSteps(steps), mix = counts(ids);
  const recipe = ids.length ? recipes.find(entry => sameCounts(mix, counts(entry.ingredients))) : null;
  if (recipe && recipe.process.length === process.length && recipe.process.every((step, i) => step === process[i])) {
    return Object.freeze({ kind: 'potion', potionId: recipe.id, recipeId: recipe.id });
  }
  const sums = sumExperiment(ids, process);
  const hit = LAB_RULES.find(entry => entry.test(sums, mix));
  const intensity = Math.min(3, Math.max(1, 1 + Math.floor(hit.over(sums) / 2)));
  const result = { kind: 'reaction', ruleId: hit.id, family: hit.family, intensity };
  if (recipe) result.hint = 'order';
  return Object.freeze(result);
}

/** Live cauldron hint while adding: tint toward the strongest property, shake when unstable. */
export function mixHint(ingredients, steps) {
  const sums = sumExperiment(ingredients, steps);
  let tint = null;
  for (const prop of TINTS) if (sums[prop] > 0 && (tint === null || sums[prop] > sums[tint])) tint = prop;
  return Object.freeze({ tint, shaky: sums.instability >= 3 });
}
