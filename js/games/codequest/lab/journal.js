/* Curiosity Journal save (Lab design D11): which reaction rules a kid has found and
   which ingredients have been in a reaction. Pure helpers over the Code Quest profile. */
import { LAB_INGREDIENTS } from './ingredients.js';
import { LAB_RULES } from './rules.js';

const MAX = 128;
const RULE_IDS = new Set(LAB_RULES.map(rule => rule.id));

function known(list, allowed) {
  return Array.isArray(list) ? [...new Set(list.filter(id => typeof id === 'string' && allowed(id)))].slice(0, MAX) : [];
}

export function normalizeLab(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return Object.freeze({
    found: Object.freeze(known(source.found, id => RULE_IDS.has(id))),
    seen: Object.freeze(known(source.seen, id => Object.hasOwn(LAB_INGREDIENTS, id)))
  });
}

function withLab(profile, found, seen) {
  return Object.freeze({ ...profile, lab: normalizeLab({ found, seen }) });
}

/** Adds a found rule; returns the same profile when nothing is new, so callers can skip saving. */
export function recordFound(profile, ruleId) {
  const lab = normalizeLab(profile.lab);
  if (!RULE_IDS.has(ruleId) || lab.found.includes(ruleId)) return profile;
  return withLab(profile, [...lab.found, ruleId], lab.seen);
}

export function recordSeen(profile, ids) {
  const lab = normalizeLab(profile.lab);
  const fresh = known(ids, id => Object.hasOwn(LAB_INGREDIENTS, id)).filter(id => !lab.seen.includes(id));
  if (!fresh.length) return profile;
  return withLab(profile, lab.found, [...lab.seen, ...fresh]);
}
