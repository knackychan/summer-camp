// Kitchen Quest v0.7: independent dishes, shared kitchen, and persistent cooking progress.
import { ALL_INGREDIENTS } from './ingredients.js';
import { RecipeDeck, RECIPES, MENU_RECIPES, GUIDED_SERVES, evaluateRecipe, customizeRecipe } from './recipes.js';
import { seeded, hashSeed } from './motion.js';
import { KitchenSimulation } from './kitchen.js';
import { normalizeProfile, goalsFor, recordServe } from './progression.js';
export { INGREDIENTS, ALL_INGREDIENTS, MATERIALS } from './ingredients.js';
export const SERVICE_SECONDS = .82;
/** A shift is dealt from one text key; the same key always reproduces the same orders and the same customers. */
export function seedsFromKey(key) {
    return { key, orders: hashSeed(key + ':orders'), cast: hashSeed(key + ':cast') };
}
/** One deal per cook per day per amount of progress, and per visit: a new day, a dish served since the last visit,
 *  or another visit the same day (`run` counts the earlier ones) deals a different shift. The first visit keeps the plain key. */
export function shiftSeeds(kid, day, totalServed, run = 0) {
    return seedsFromKey([kid, day, totalServed].join(':') + (run > 0 ? ':r' + run : ''));
}
const emptyDish = (order) => ({ food: [], order, phase: 'editing', feedbackVisible: false, elapsed: 0, waitRemaining: 0, arrivalAge: 0 });
const copyOrder = (order) => order ? { ...order, recipe: { ...order.recipe,
        required: { ...order.recipe.required }, sequence: [...order.recipe.sequence] } } : undefined;
/** Two independent dishes, one active input destination. Cosmetic events never decide correctness. */
export class KitchenModel {
    constructor(seed = 29813, cookingEnabled = false, directCooking = false, profile) {
        this.seed = seed;
        this.cookingEnabled = cookingEnabled;
        this.directCooking = directCooking;
        this.maxLayers = 12;
        this.dishes = [emptyDish()];
        this.selected = 0;
        this.nextOrder = 1;
        this.nextLayer = 1;
        this.recent = new Set();
        this.recentQueue = [];
        this.mode = 'free';
        this.difficulty = 'standard';
        /** Input epoch, not dish identity: selecting away AND back still invalidates an old release. */
        this.session = 1;
        this.served = 0;
        this.ordersServed = 0;
        this._profile = normalizeProfile(profile);
        this.orderCount = 0;
        // Customer requests rotate extra-tomato / extra-pickles / no-cheese; the seed picks where the rotation starts.
        this.requestOffset = Math.floor(seeded(seed ^ 0x5bd1e995)() * 3);
        this.deck = this.newDeck();
    }
    /** A cook who has served the whole starting menu is past the guided tour, so the deal is shuffled from the first order. */
    newDeck() { return new RecipeDeck(this.seed, this.menu, { guided: this._profile.totalServed < GUIDED_SERVES }); }
    get profile() { return normalizeProfile(this._profile); }
    get goals() { return goalsFor(this._profile); }
    get menu() { return this.cookingEnabled ? MENU_RECIPES.filter(recipe => recipe.unlockAt <= this._profile.totalServed) : RECIPES; }
    get active() { return this.dishes[this.selected]; }
    get activeSlot() { return this.selected; }
    get phase() { return this.active.phase; }
    get feedbackVisible() { return this.active.feedbackVisible; }
    get waiting() { return this.active.phase === 'waiting'; }
    get serviceElapsed() { return this.active.elapsed; }
    get anyServing() { return this.dishes.some(d => d.phase === 'serving'); }
    get hasFood() { var _a; return this.dishes.some(d => d.food.length > 0) || !!((_a = this.kitchen) === null || _a === void 0 ? void 0 : _a.hasWork); }
    get layers() { return this.active.food.map(l => ({ ...l })); }
    get order() { return copyOrder(this.active.order); }
    get stations() {
        return this.dishes.map((d, slot) => ({ slot, order: copyOrder(d.order), layers: d.food.map(l => ({ ...l })),
            phase: d.phase, feedbackVisible: d.feedbackVisible, serviceElapsed: d.elapsed, waitRemaining: d.waitRemaining, arrivalAge: d.arrivalAge,
            evaluation: this.evaluateDish(d) }));
    }
    evaluation() {
        const d = this.active;
        return this.evaluateDish(d);
    }
    evaluateDish(d) {
        if (!d.order)
            return undefined;
        const report = evaluateRecipe(d.order.recipe.sequence, d.food.map(l => l.ingredient));
        const pending = d.food.findIndex(l => l.pending);
        if (pending >= 0) {
            report.correct = false;
            report.matchedPrefix = Math.min(report.matchedPrefix, pending);
            if (report.firstMismatch === null || pending < report.firstMismatch)
                report.firstMismatch = pending;
        }
        return report;
    }
    /** Both public modes have customers. Legacy free assembly is retained only for the isolated lab/tests. */
    requestDifficulty(difficulty) {
        if (this.anyServing)
            return 'busy';
        if (this.mode === 'orders' && this.difficulty === difficulty)
            return 'unchanged';
        if (this.hasFood) {
            this.pendingDifficulty = difficulty;
            this.pendingMode = 'orders';
            return 'confirm';
        }
        this.difficulty = difficulty;
        this.changeMode('orders');
        return 'changed';
    }
    /** A serving plate may be left or revisited; a mode-confirmation may not be bypassed. */
    selectOrder(slot, expectedOrderId) {
        var _a;
        if (this.pendingMode)
            return 'busy';
        if (this.mode !== 'orders' || !Number.isInteger(slot) || !this.dishes[slot])
            return 'stale';
        if (expectedOrderId !== undefined && ((_a = this.dishes[slot].order) === null || _a === void 0 ? void 0 : _a.id) !== expectedOrderId)
            return 'stale';
        if (slot === this.selected)
            return 'unchanged';
        this.selected = slot;
        this.session++;
        return 'changed';
    }
    requestMode(mode) {
        if (this.anyServing)
            return 'busy';
        if (mode === this.mode) {
            this.pendingMode = undefined;
            return 'unchanged';
        }
        // Include the parked burger: an empty active bun is not permission to discard the other dish.
        if (this.hasFood) {
            this.pendingMode = mode;
            return 'confirm';
        }
        this.changeMode(mode);
        return 'changed';
    }
    confirmMode(accept) {
        const mode = this.pendingMode, difficulty = this.pendingDifficulty;
        this.pendingMode = undefined;
        this.pendingDifficulty = undefined;
        if (!accept || !mode)
            return 'unchanged';
        if (this.anyServing)
            return 'busy';
        if (difficulty)
            this.difficulty = difficulty;
        this.changeMode(mode);
        return 'changed';
    }
    changeMode(mode) {
        this.mode = mode;
        this.selected = 0;
        this.session++;
        this.pendingMode = undefined;
        this.pendingDifficulty = undefined;
        this.ordersServed = 0;
        this.orderCount = 0;
        this.deck = this.newDeck();
        this.kitchen = mode === 'orders' && this.cookingEnabled ? new KitchenSimulation({ rawPatties: this.directCooking, difficulty: this.difficulty }) : undefined;
        this.dishes = mode === 'orders' ? [emptyDish(this.newOrder()), emptyDish(this.newOrder())] : [emptyDish()];
    }
    newOrder(excluded = []) {
        // Never immediately repeat this plate or give both visible customers the same starter.
        // At most two exclusions; two bounded bags always contain a choice.
        let recipe = this.deck.next();
        for (let i = 1; excluded.includes(recipe.id) && i < MENU_RECIPES.length * 2; i++)
            recipe = this.deck.next();
        const order = { id: this.nextOrder++, recipe, closed: false };
        this.orderCount++;
        if (this.difficulty === 'standard' && this.orderCount > 5 && (this.orderCount - 5) % 3 === 0) {
            const requests = ['no-cheese', 'extra-tomato', 'extra-pickles'];
            const start = ((this.orderCount - 5) / 3 - 1 + this.requestOffset) % requests.length;
            for (let i = 0; i < requests.length; i++) {
                const request = requests[(start + i) % requests.length], customized = customizeRecipe(recipe, request);
                if (customized !== recipe) { order.recipe = customized; order.request = request; break; }
            }
        }
        return order;
    }
    apply(command) {
        var _a, _b, _c, _d, _e, _f;
        const d = this.active;
        if (command.session !== this.session || (d.order && command.orderId !== d.order.id))
            return { type: 'reject', reason: 'stale' };
        if (this.recent.has(command.id))
            return { type: 'reject', reason: 'duplicate' };
        this.recent.add(command.id);
        this.recentQueue.push(command.id);
        if (this.recentQueue.length > 1024)
            this.recent.delete(this.recentQueue.shift());
        if (d.phase !== 'editing' || this.pendingMode)
            return { type: 'reject', reason: 'busy' };
        switch (command.type) {
            case 'cookPatty': {
                if (!this.kitchen || !d.order)
                    return { type: 'reject', reason: 'busy' };
                if (d.food.length >= this.maxLayers)
                    return { type: 'reject', reason: 'full' };
                const slot = this.kitchen.startPatty(d.order.id, this.nextLayer);
                if (slot < 0)
                    return { type: 'reject', reason: 'grill-full' };
                const layer = { id: this.nextLayer++, ingredient: 'patty', pending: true };
                d.food.push(layer);
                return { type: 'cook', layer: { ...layer }, slot };
            }
            case 'remove': {
                const index = d.food.findIndex(l => l.id === command.layerId);
                if (index < 0)
                    return { type: 'reject', reason: 'stale' };
                const [layer] = d.food.splice(index, 1);
                if (layer.pending)
                    (_a = this.kitchen) === null || _a === void 0 ? void 0 : _a.detachPatty(layer.id);
                else
                    (_b = this.kitchen) === null || _b === void 0 ? void 0 : _b.refund(layer.ingredient);
                return { type: 'undo', layer: { ...layer } };
            }
            case 'add': {
                if (d.food.length >= this.maxLayers)
                    return { type: 'reject', reason: 'full' };
                if (this.kitchen && !this.kitchen.take(command.ingredient))
                    return { type: 'reject', reason: 'stock' };
                const layer = { id: this.nextLayer++, ingredient: command.ingredient };
                d.food.push(layer);
                return { type: 'add', layer: { ...layer } };
            }
            case 'undo': {
                const layer = d.food.pop();
                if (layer) {
                    if (layer.pending)
                        (_c = this.kitchen) === null || _c === void 0 ? void 0 : _c.detachPatty(layer.id);
                    else
                        (_d = this.kitchen) === null || _d === void 0 ? void 0 : _d.refund(layer.ingredient);
                }
                return layer ? { type: 'undo', layer: { ...layer } } : { type: 'reject', reason: 'empty' };
            }
            case 'clear': {
                if (!d.food.length)
                    return { type: 'reject', reason: 'empty' };
                const removed = this.layers;
                removed.forEach(l => { var _a, _b; if (l.pending)
                    (_a = this.kitchen) === null || _a === void 0 ? void 0 : _a.detachPatty(l.id);
                else
                    (_b = this.kitchen) === null || _b === void 0 ? void 0 : _b.refund(l.ingredient); });
                d.food = [];
                this.session++;
                return { type: 'clear', removed };
            }
            case 'serve': {
                if (d.food.some(l => l.pending))
                    return { type: 'reject', reason: 'cooking' };
                const evaluation = this.evaluation();
                if (evaluation && !evaluation.correct) {
                    d.feedbackVisible = true;
                    return { type: 'mismatch', evaluation };
                }
                if (!d.food.length)
                    return { type: 'reject', reason: 'empty' };
                (_e = this.kitchen) === null || _e === void 0 ? void 0 : _e.commit(d.food.map(l => l.ingredient));
                let progress;
                if (d.order) {
                    const result = recordServe(this._profile, d.order);
                    this._profile = result.profile;
                    this.deck.unlock(this.menu);
                    progress = { completedShift: result.completedShift, unlocked: result.unlocked };
                    d.order.closed = true;
                    this.ordersServed++;
                }
                d.phase = 'serving';
                d.elapsed = 0;
                this.served++;
                return { type: 'serve', layers: this.layers, orderId: (_f = d.order) === null || _f === void 0 ? void 0 : _f.id, progress };
            }
        }
    }
    /** Explicit identity makes repeated or stale completions safe, including an inactive plate. */
    finishService(slot = this.selected, expectedOrderId) {
        var _a;
        const dish = this.dishes[slot];
        if (!dish || dish.phase !== 'serving' || (expectedOrderId !== undefined && ((_a = dish.order) === null || _a === void 0 ? void 0 : _a.id) !== expectedOrderId))
            return false;
        const excluded = this.dishes.map(d => { var _a; return (_a = d.order) === null || _a === void 0 ? void 0 : _a.recipe.id; }).filter((id) => id !== undefined);
        if (this.kitchen) {
            this.dishes[slot] = { ...emptyDish(dish.order), phase: 'waiting', waitRemaining: this.difficulty === 'easy' ? 4 + slot : this.kitchen.pace === 'rush' ? 1.5 : 12 + slot * 2 };
        }
        else
            this.dishes[slot] = emptyDish(this.mode === 'orders' ? this.newOrder(excluded) : undefined);
        // A background replacement must NOT invalidate a gesture on the other customer's plate.
        if (slot === this.selected)
            this.session++;
        return true;
    }
    /** Caller supplies active, unpaused time. No hidden-tab or long-frame catch-up. */
    advanceServices(dt) {
        var _a;
        if (!Number.isFinite(dt) || dt <= 0 || this.pendingMode)
            return [];
        dt = Math.min(dt, .05);
        const completed = [];
        for (let slot = 0; slot < this.dishes.length; slot++) {
            const d = this.dishes[slot];
            if (d.phase === 'waiting') {
                d.waitRemaining = Math.max(0, d.waitRemaining - dt);
                if (d.waitRemaining < 1e-8) {
                    const excluded = this.dishes.map(dish => { var _a; return (_a = dish.order) === null || _a === void 0 ? void 0 : _a.recipe.id; }).filter((id) => id !== undefined);
                    this.dishes[slot] = emptyDish(this.newOrder(excluded));
                    if (slot === this.selected)
                        this.session++;
                    completed.push(slot);
                }
                continue;
            }
            if (this.kitchen)
                d.arrivalAge = Math.min(6, d.arrivalAge + dt);
            if (d.phase !== 'serving')
                continue;
            d.elapsed += dt;
            if (d.elapsed + 1e-9 >= SERVICE_SECONDS && this.finishService(slot, (_a = d.order) === null || _a === void 0 ? void 0 : _a.id))
                completed.push(slot);
        }
        return completed;
    }
    counts() {
        const counts = Object.fromEntries(ALL_INGREDIENTS.map(id => [id, 0]));
        this.active.food.forEach(layer => counts[layer.ingredient]++);
        return counts;
    }
    kitchenAction(action, id, session, expectedJobId, expectedTrayRevision) {
        if (!this.kitchen || this.pendingMode || session !== this.session || this.recent.has(id))
            return { ok: false, message: 'That action is no longer active.' };
        this.recent.add(id);
        this.recentQueue.push(id);
        if (this.recentQueue.length > 1024)
            this.recent.delete(this.recentQueue.shift());
        const result = this.kitchen.act(action, expectedJobId, expectedTrayRevision);
        if (result.plated) {
            const dish = this.dishes.find(d => { var _a; return ((_a = d.order) === null || _a === void 0 ? void 0 : _a.id) === result.plated.orderId && d.phase === 'editing'; });
            const layer = dish === null || dish === void 0 ? void 0 : dish.food.find(l => l.id === result.plated.layerId && l.pending);
            if (layer)
                delete layer.pending;
            else
                this.kitchen.refund('patty'); // Defensive fallback: never deliver to a replacement customer.
        }
        return result;
    }
    snapshot() {
        var _a;
        return { session: this.session, phase: this.phase, mode: this.mode, pendingMode: this.pendingMode,
            difficulty: this.difficulty, pendingDifficulty: this.pendingDifficulty, activeSlot: this.activeSlot, stations: this.stations, layers: this.layers, served: this.served,
            ordersServed: this.ordersServed, order: this.order, feedbackVisible: this.feedbackVisible, profile: this.profile, goals: this.goals,
            kitchen: (_a = this.kitchen) === null || _a === void 0 ? void 0 : _a.snapshot(), evaluation: this.evaluation(), counts: this.counts() };
    }
}
