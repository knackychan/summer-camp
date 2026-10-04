/* Curiosity Journal save (Lab design D11): which reaction rules a kid has found and
   which ingredients have been in a reaction. Pure helpers over the Code Quest profile. */
import { LAB_INGREDIENTS, LAB_STATES, applyState } from './ingredients.js';
import { LAB_RULES } from './rules.js';

const MAX = 128;
const RULE_IDS = new Set(LAB_RULES.map(rule => rule.id));
// A form is "<ingredientId>:<state>" for a changed (not fresh) ingredient (lab-states D7).
const isForm = key => {
  const [id, state, extra] = String(key).split(':');
  return extra === undefined && Object.hasOwn(LAB_INGREDIENTS, id) && state !== 'raw' && LAB_STATES.includes(state);
};

function known(list, allowed) {
  return Array.isArray(list) ? [...new Set(list.filter(id => typeof id === 'string' && allowed(id)))].slice(0, MAX) : [];
}

export function normalizeLab(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return Object.freeze({
    found: Object.freeze(known(source.found, id => RULE_IDS.has(id))),
    seen: Object.freeze(known(source.seen, id => Object.hasOwn(LAB_INGREDIENTS, id))),
    states: Object.freeze(known(source.states, isForm))
  });
}

function withLab(profile, found, seen, states = normalizeLab(profile.lab).states) {
  return Object.freeze({ ...profile, lab: normalizeLab({ found, seen, states }) });
}

/** Adds a found rule; returns the same profile when nothing is new, so callers can skip saving. */
export function recordFound(profile, ruleId) {
  const lab = normalizeLab(profile.lab);
  if (!RULE_IDS.has(ruleId) || lab.found.includes(ruleId)) return profile;
  return withLab(profile, [...lab.found, ruleId], lab.seen);
}

/** Records the ingredients of a mix as seen; entries may be ids or `{ id, state }`. */
export function recordSeen(profile, ids) {
  const lab = normalizeLab(profile.lab);
  const list = Array.isArray(ids) ? ids.map(item => (item && typeof item === 'object' ? item.id : item)) : [];
  const fresh = known(list, id => Object.hasOwn(LAB_INGREDIENTS, id)).filter(id => !lab.seen.includes(id));
  if (!fresh.length) return profile;
  return withLab(profile, lab.found, [...lab.seen, ...fresh]);
}

/** Records the changed forms (`{ id, state }`, state not fresh) brewed in a mix; same profile when nothing is new. */
export function recordStates(profile, mix) {
  const lab = normalizeLab(profile.lab);
  const keys = Array.isArray(mix) ? mix.filter(item => item && typeof item === 'object').map(item => item.id + ':' + item.state) : [];
  const fresh = known(keys, isForm).filter(key => !lab.states.includes(key));
  if (!fresh.length) return profile;
  return withLab(profile, lab.found, lab.seen, [...lab.states, ...fresh]);
}

/* ---------- Journal pages (slice 06): pure builders the sheet renders ---------- */

/* What each rule is "made of", for its icon formula: the properties that decide it
   (or, for the one authored special, its three ingredients). Data for the Journal
   only; rules.js stays the single source of the actual tests. */
const FORMULA = Object.freeze({
  pocketUniverse: ['ing:moonflower', 'ing:echoCrystal', 'ing:voidDust'],
  explosion: ['chaos', 'chaos', 'chaos'], temporalRupture: ['time', 'time'], singularity: ['space', 'light'],
  monstrosity: ['echo', 'life', 'growth'], duplication: ['echo', 'life'], overgrowth: ['growth', 'life', 'water'],
  fireball: ['fire', 'fire'], iceBurst: ['cold', 'cold'], glow: ['light', 'light'], steam: ['fire', 'water'],
  bubbles: ['water'], smoke: ['fire'], fizzle: [],
  // Phase 2 state rules (lab-states D4): a "state:" token is a changed ingredient of that kind.
  thermalShock: ['state:frozen', 'state:heated'], snowflakeCopies: ['state:frozen', 'echo'], flamingVines: ['state:heated', 'growth'], glitterStorm: ['state:crushed', 'light']
});

/** Reaction pages: found rules in rule order with label, line and formula; unfound ones carry only their family. */
export function journalReactions(lab) {
  const found = new Set(normalizeLab(lab).found);
  const pages = LAB_RULES.map((rule, index) => found.has(rule.id)
    ? Object.freeze({ index, found: true, id: rule.id, family: rule.family, label: rule.label, line: rule.line, formula: Object.freeze([...FORMULA[rule.id]]) })
    : Object.freeze({ index, found: false, family: rule.family }));
  return Object.freeze({ found: found.size, total: LAB_RULES.length, pages: Object.freeze(pages) });
}

/** Potion pages: discovered recipes show ingredients and ordered steps; the rest only that they exist. */
export function journalPotions(profile, recipes) {
  const known = new Set(profile && Array.isArray(profile.discoveredRecipes) ? profile.discoveredRecipes : []);
  return Object.freeze(recipes.map((recipe, index) => known.has(recipe.id)
    ? Object.freeze({ index, found: true, id: recipe.id, label: recipe.label, ingredients: Object.freeze([...recipe.ingredients]), process: Object.freeze([...recipe.process]) })
    : Object.freeze({ index, found: false })));
}

/** Ingredient pages: all twelve, with their property points revealed once seen in a reaction,
    and each changed form the kid has brewed with (lab-states D7) in state order. */
export function journalIngredients(lab) {
  const book = normalizeLab(lab), seen = new Set(book.seen), forms = new Set(book.states);
  return Object.freeze(Object.values(LAB_INGREDIENTS).map(item => Object.freeze({
    id: item.id, label: item.label, where: item.where, seen: seen.has(item.id),
    props: seen.has(item.id) ? Object.freeze(Object.entries(item.props)) : null,
    forms: Object.freeze(LAB_STATES.filter(state => forms.has(item.id + ':' + state))
      .map(state => Object.freeze({ state, props: Object.freeze(Object.entries(applyState(item.props, state))) })))
  })));
}
