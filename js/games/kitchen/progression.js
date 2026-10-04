import { MENU_RECIPES } from './recipes.js';

const LIMIT = 1000000;
const ids = MENU_RECIPES.map(recipe => recipe.id);
const families = ['burger', 'salad', 'lasagna', 'sandwich'];
const count = value => typeof value === 'number' && Number.isFinite(value) ? Math.min(LIMIT, Math.max(0, Math.floor(value))) : 0;
const own = (value, key) => value && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value, key) ? value[key] : undefined;
const known = (value, allowed) => Array.isArray(value) ? [...new Set(value.filter(item => allowed.includes(item)))] : [];

/** Saved data is untrusted; return only bounded, known fields and detached immutable collections. */
export function normalizeProfile(raw, legacyBest = 0) {
    const source = own(raw, 'version') === 1 ? raw : undefined;
    const servings = own(source, 'recipeServes'), shift = own(source, 'shift');
    return Object.freeze({
        version: 1,
        totalServed: source ? count(own(source, 'totalServed')) : count(legacyBest),
        recipeServes: Object.freeze(Object.fromEntries(ids.map(id => [id, count(own(servings, id))]))),
        completedShifts: count(own(source, 'completedShifts')),
        shift: Object.freeze({
            served: count(own(shift, 'served')),
            recipes: Object.freeze(known(own(shift, 'recipes'), ids)),
            families: Object.freeze(known(own(shift, 'families'), families))
        })
    });
}

export function goalsFor(raw) {
    const profile = normalizeProfile(raw), shift = profile.shift, stage = profile.completedShifts % 3;
    const goals = stage === 0 ? [['served', shift.served, 4], ['recipes', shift.recipes.length, 2]] :
        stage === 1 ? [['served', shift.served, 5], ['salad', Number(shift.families.includes('salad')), 1], ['lasagna', Number(shift.families.includes('lasagna')), 1]] :
        [['served', shift.served, 6], ['double-stack-burger', Number(shift.recipes.includes('double-stack-burger')), 1]];
    const targets = goals.map(([id, current, target]) => ({ id, current: Math.min(current, target), target, complete: current >= target }));
    return { shiftNumber: profile.completedShifts + 1, completed: targets.every(goal => goal.complete), targets };
}

/** The model calls this once after accepting a correct serve; mistakes and stale inputs never reach it. */
export function recordServe(raw, order) {
    const before = normalizeProfile(raw);
    const recipe = order && order.recipe && MENU_RECIPES.find(entry => entry.id === order.recipe.id);
    if (!recipe) return { profile: before, completedShift: false, unlocked: [] };
    let profile = normalizeProfile({ ...before,
        totalServed: before.totalServed + 1,
        recipeServes: { ...before.recipeServes, [recipe.id]: before.recipeServes[recipe.id] + 1 },
        shift: { served: before.shift.served + 1, recipes: [...before.shift.recipes, recipe.id], families: [...before.shift.families, recipe.family] }
    });
    const completedShift = goalsFor(profile).completed;
    if (completedShift) profile = normalizeProfile({ ...profile, completedShifts: profile.completedShifts + 1, shift: {} });
    return { profile, completedShift, unlocked: MENU_RECIPES.filter(entry => entry.unlockAt > before.totalServed && entry.unlockAt <= profile.totalServed).map(entry => entry.id) };
}
