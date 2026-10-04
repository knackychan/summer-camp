// Kitchen Quest v0.7 menu and exact recipe grading.
import { ALL_INGREDIENTS } from './ingredients.js';
import { seeded } from './motion.js';
function counts(sequence) {
    const result = Object.fromEntries(ALL_INGREDIENTS.map(id => [id, 0]));
    for (const id of sequence)
        result[id]++;
    return result;
}
function recipe(id, sequence, family = 'burger', unlockAt = 0) {
    return Object.freeze({ id, family, unlockAt, sequence: Object.freeze([...sequence]), required: Object.freeze(counts(sequence)) });
}
export const RECIPES = Object.freeze([
    recipe('cheese-burger', ['patty', 'cheese']),
    recipe('garden-burger', ['patty', 'tomato', 'lettuce']),
    recipe('double-tomato-burger', ['patty', 'cheese', 'tomato', 'tomato'])
]);
export const MENU_RECIPES = Object.freeze([
    ...RECIPES, recipe('garden-salad', ['lettuce', 'tomato', 'cheese', 'sauce'], 'salad'),
    recipe('baked-lasagna', ['lasagna'], 'lasagna'),
    recipe('pickle-crunch-burger', ['patty', 'pickles', 'cheese', 'sauce'], 'burger', 4),
    recipe('double-stack-burger', ['patty', 'cheese', 'patty', 'cheese', 'pickles'], 'burger', 8),
    recipe('chef-salad', ['lettuce', 'tomato', 'pickles', 'cheese', 'tomato', 'sauce'], 'salad', 12),
    recipe('lasagna-feast', ['lasagna', 'lettuce', 'tomato', 'cheese'], 'lasagna', 16),
    // Unlocks continue every four dishes. Only foods the kitchen already has, so no new tray,
    // stock or sprite: each is a new order of the same pieces, from 2 to 7 steps.
    recipe('veggie-melt', ['cheese', 'tomato', 'lettuce'], 'burger', 20),
    recipe('saucy-burger', ['patty', 'sauce', 'lettuce', 'tomato'], 'burger', 24),
    recipe('cheese-lover-burger', ['patty', 'cheese', 'cheese', 'cheese'], 'burger', 28),
    recipe('crunchy-pickle-salad', ['lettuce', 'pickles', 'cheese', 'pickles', 'sauce'], 'salad', 32),
    recipe('cheesy-lasagna', ['lasagna', 'cheese', 'sauce'], 'lasagna', 36),
    recipe('everything-burger', ['patty', 'cheese', 'tomato', 'lettuce', 'pickles', 'sauce'], 'burger', 40),
    recipe('lasagna-duo', ['lasagna', 'lasagna', 'cheese'], 'lasagna', 44),
    recipe('triple-decker-burger', ['patty', 'cheese', 'patty', 'tomato', 'patty', 'cheese', 'sauce'], 'burger', 48)
]);
/** The starting menu is the guided tour: it is dealt in authored order until a cook has served that many dishes. */
export const GUIDED_SERVES = MENU_RECIPES.filter(entry => entry.unlockAt === 0).length;
/** Dishes named for an ingredient never ask to drop it ("no cheese" on a Cheese lover burger). */
const NO_REQUESTS = new Set(['cheese-lover-burger', 'cheesy-lasagna']);
/** Requests change the ticket and its ingredient counts together, leaving the menu untouched. */
export function customizeRecipe(base, request) {
    if (NO_REQUESTS.has(base.id)) return base;
    let sequence;
    if (request === 'no-cheese' && base.sequence.includes('cheese')) {
        sequence = base.sequence.filter(id => id !== 'cheese');
        if (!sequence.length) return base;
    } else if (request === 'extra-tomato' || request === 'extra-pickles') {
        sequence = [...base.sequence, request === 'extra-tomato' ? 'tomato' : 'pickles'];
    } else return base;
    return recipe(base.id, sequence, base.family, base.unlockAt);
}
/** Exact length AND exact addition order. Pure, detached results; no UI wording or animation state. */
export function evaluateRecipe(required, actual) {
    const wanted = counts(required), added = counts(actual);
    const ingredients = ALL_INGREDIENTS.map(ingredient => ({ ingredient, required: wanted[ingredient], actual: added[ingredient],
        missing: Math.max(wanted[ingredient] - added[ingredient], 0), extra: Math.max(added[ingredient] - wanted[ingredient], 0) }));
    const mismatches = ingredients.filter(d => d.missing > 0 || d.extra > 0).map(d => ({ ...d }));
    const steps = Array.from({ length: Math.max(required.length, actual.length) }, (_, index) => {
        var _a, _b;
        const expected = (_a = required[index]) !== null && _a !== void 0 ? _a : null, placed = (_b = actual[index]) !== null && _b !== void 0 ? _b : null;
        const status = expected === null ? 'extra' : placed === null ? 'missing' : expected === placed ? 'matched' : 'wrong';
        return { index, required: expected, actual: placed, status };
    });
    const first = steps.findIndex(step => step.status !== 'matched');
    return { correct: first === -1, ingredients, mismatches, steps,
        firstMismatch: first < 0 ? null : first, matchedPrefix: first < 0 ? required.length : first };
}
/** Intro in authored order, then deterministic shuffled bags without boundary repeats.
 *  `guided: false` skips the authored intro (a cook who has done the tour): the first bag is shuffled too,
 *  while a dish unlocked later is still dealt next, before the bags resume. */
export class RecipeDeck {
    constructor(seed = 29813, recipes = RECIPES, { guided = true } = {}) {
        this.recipes = [...recipes];
        this.intro = guided ? 0 : this.recipes.length;
        this.bag = [];
        this.random = seeded(seed);
    }
    unlock(recipes) {
        for (const entry of recipes)
            if (!this.recipes.some(existing => existing.id === entry.id)) this.recipes.push(entry);
        // Appending extends the authored intro, so each new dish appears before the next shuffled bag.
    }
    next() {
        let next;
        if (this.intro < this.recipes.length)
            next = this.recipes[this.intro++];
        else {
            if (!this.bag.length) {
                this.bag = [...this.recipes];
                for (let i = this.bag.length - 1; i > 0; i--) {
                    const j = Math.floor(this.random() * (i + 1));
                    [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
                }
                if (this.bag.length > 1 && this.bag[0].id === this.previous)
                    [this.bag[0], this.bag[1]] = [this.bag[1], this.bag[0]];
            }
            next = this.bag.shift();
        }
        this.previous = next.id;
        return next;
    }
}
