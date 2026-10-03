// Kitchen Quest v0.6.0 core, imported from the user-supplied source.
// TypeScript transpiled to ES2019 modules; gameplay rules preserved.
/** A finite, shared pantry. Held ingredients reserve shelf space so Undo never loses food. */
export const STOCK_ITEMS = ['patty', 'tomato', 'lettuce', 'lasagna'];
export const CAPACITY = { patty: 12, tomato: 18, lettuce: 18, lasagna: 8 };
export const LASAGNA_STEPS = ['pasta', 'sauce', 'cheese', 'pasta', 'sauce', 'cheese'];
const zero = () => ({ patty: 0, tomato: 0, lettuce: 0, lasagna: 0 });
const empty = (id = 0) => ({ id, phase: 'empty', remaining: 0, duration: 0 });
const isStock = (id) => STOCK_ITEMS.includes(id);
const result = (ok, message, sound) => ({ ok, message, sound });
export class KitchenSimulation {
    constructor(options = {}) {
        this.options = options;
        this.ready = { patty: 2, tomato: 4, lettuce: 3, lasagna: 0 };
        this.held = zero();
        this.grill = [empty(), empty()];
        this.oven = empty();
        this.board = 'tomato';
        this.cuts = 0;
        this.lasagna = [];
        this.nextJob = 1;
        this.trayRevision = 0;
        this.time = 0;
        if (options.rawPatties)
            this.ready.patty = 0;
    }
    get difficulty() { return this.options.difficulty || 'standard'; }
    get clock() { return this.time; }
    get pace() { return this.difficulty === 'easy' || this.time % 80 < 45 ? 'calm' : 'rush'; }
    get phaseRemaining() { return this.time % 80 < 45 ? 45 - this.time % 80 : 80 - this.time % 80; }
    get hasWork() { return this.ready.patty !== (this.options.rawPatties ? 0 : 2) || this.ready.tomato !== 4 || this.ready.lettuce !== 3 || this.ready.lasagna !== 0 || this.cuts > 0 || this.lasagna.length > 0 || this.grill.some(j => j.phase !== 'empty') || this.oven.phase !== 'empty'; }
    available(id) { return isStock(id) ? this.ready[id] : Infinity; }
    take(id) {
        if (!isStock(id))
            return true;
        if (this.ready[id] < 1)
            return false;
        this.ready[id]--;
        this.held[id]++;
        return true;
    }
    refund(id) { if (isStock(id) && this.held[id] > 0) {
        this.held[id]--;
        this.ready[id]++;
    } }
    commit(ids) { for (const id of ids)
        if (isStock(id) && this.held[id] > 0)
            this.held[id]--; }
    promised(id) {
        if (id === 'patty')
            return this.grill.filter(j => j.phase !== 'empty' && j.phase !== 'burnt').reduce((n, j) => { var _a; return n + ((_a = j.quantity) !== null && _a !== void 0 ? _a : 2); }, 0);
        if (id === 'lasagna')
            return this.oven.phase !== 'empty' && this.oven.phase !== 'burnt' ? 4 : 0;
        return this.board === id && this.cuts > 0 ? 6 : 0;
    }
    room(id, count) { return this.ready[id] + this.held[id] + this.promised(id) + count <= CAPACITY[id]; }
    /** A tray tap reserves one pan and one order position; raw meat never enters ready stock. */
    startPatty(orderId, layerId) {
        const slot = this.grill.findIndex(j => j.phase === 'empty');
        if (slot < 0 || !this.room('patty', 1))
            return -1;
        this.grill[slot] = { id: this.nextJob++, phase: 'side-one', remaining: 5, duration: 5, quantity: 1, targetOrderId: orderId, targetLayerId: layerId };
        return slot;
    }
    detachPatty(layerId) {
        for (const job of this.grill)
            if (job.targetLayerId === layerId) {
                delete job.targetLayerId;
                delete job.targetOrderId;
            }
    }
    act(action, expectedJobId, expectedTrayRevision) {
        var _a;
        if (action.startsWith('lasagna:') && expectedTrayRevision !== undefined && expectedTrayRevision !== this.trayRevision)
            return result(false, 'That layer has already changed.');
        if (action === 'board:tomato' || action === 'board:lettuce') {
            if (this.cuts)
                return result(false, 'Finish this batch, or reset the board first.');
            this.board = action === 'board:tomato' ? 'tomato' : 'lettuce';
            return result(true, this.board === 'tomato' ? 'Four cuts make six tomato slices.' : 'Three cuts make six lettuce portions.');
        }
        if (action === 'board:reset') {
            this.cuts = 0;
            return result(true, 'Fresh chopping board.');
        }
        if (action === 'board:cut') {
            if (this.cuts === 0 && !this.room(this.board, 6))
                return result(false, 'Shelf full. Use some prepared stock first.', 'error');
            this.cuts++;
            const needed = this.board === 'tomato' ? 4 : 3;
            if (this.cuts === needed) {
                this.ready[this.board] += 6;
                this.cuts = 0;
                return result(true, `+6 ${this.board === 'tomato' ? 'tomato slices' : 'lettuce portions'} in stock!`, 'collect');
            }
            return result(true, `${this.cuts} / ${needed} cuts`, 'chop');
        }
        if (action.startsWith('grill:')) {
            const slot = Number(action.slice(6));
            if (!Number.isInteger(slot) || !this.grill[slot])
                return result(false, 'Unknown grill.');
            const job = this.grill[slot];
            if (expectedJobId !== undefined && expectedJobId !== job.id)
                return result(false, 'That grill action has already finished.');
            if (job.phase === 'empty') {
                if (!this.room('patty', 2))
                    return result(false, 'Patty shelf full. Serve or use some stock first.', 'error');
                this.grill[slot] = { id: this.nextJob++, phase: 'side-one', remaining: 5, duration: 5 };
                return result(true, 'Two patties sizzling. Flip when the timer rings.', 'start');
            }
            if (job.phase === 'flip') {
                this.grill[slot] = { ...job, id: this.nextJob++, phase: 'side-two', remaining: 4, duration: 4 };
                return result(true, 'Flipped! Finish the second side.', 'flip');
            }
            if (job.phase === 'ready') {
                const quantity = (_a = job.quantity) !== null && _a !== void 0 ? _a : 2;
                this.grill[slot] = empty(this.nextJob++);
                if (job.targetLayerId !== undefined && job.targetOrderId !== undefined) {
                    this.held.patty++;
                    return { ...result(true, 'Cooked patty returned to its customer’s dish!', 'collect'), plated: { layerId: job.targetLayerId, orderId: job.targetOrderId } };
                }
                this.ready.patty += quantity;
                return result(true, `+${quantity} grilled ${quantity === 1 ? 'patty' : 'patties'} in stock!`, 'collect');
            }
            if (job.phase === 'burnt') {
                if (job.targetLayerId !== undefined) {
                    if (!this.room('patty', 1))
                        return result(false, 'Use some cooked stock before trying again.', 'error');
                    this.grill[slot] = { ...job, id: this.nextJob++, phase: 'side-one', remaining: 5, duration: 5 };
                    return result(true, 'Fresh raw patty. Same customer, same place. Try again!', 'start');
                }
                this.grill[slot] = empty(this.nextJob++);
                return result(true, 'Pan cleared. Try another batch.');
            }
            return result(false, 'Still cooking. Prep something else while you wait.');
        }
        if (action.startsWith('lasagna:add:')) {
            const layer = action.slice(12);
            if (!['pasta', 'sauce', 'cheese'].includes(layer))
                return result(false, 'Unknown layer.');
            if (this.lasagna.length >= 6)
                return result(false, 'The tray is full. Tap a layer to remove it, or put it in the oven.');
            this.lasagna.push(layer);
            this.trayRevision++;
            return result(true, 'Layer added.', layer === 'pasta' ? 'chop' : 'flip');
        }
        if (action.startsWith('lasagna:remove:')) {
            const index = Number(action.slice(15));
            if (!Number.isInteger(index) || index < 0 || index >= this.lasagna.length)
                return result(false, 'That layer is no longer on the tray.');
            this.lasagna.splice(index, 1);
            this.trayRevision++;
            return result(true, 'Layer removed. The other layers stay in place.');
        }
        if (action === 'lasagna:undo') {
            this.lasagna.pop();
            this.trayRevision++;
            return result(true, 'Last layer removed.');
        }
        if (action === 'lasagna:clear') {
            this.lasagna = [];
            this.trayRevision++;
            return result(true, 'Empty baking tray.');
        }
        if (action === 'oven') {
            if (expectedJobId !== undefined && expectedJobId !== this.oven.id)
                return result(false, 'That oven action has already finished.');
            if (this.oven.phase === 'empty') {
                if (this.lasagna.length !== LASAGNA_STEPS.length || this.lasagna.some((id, index) => id !== LASAGNA_STEPS[index]))
                    return result(false, 'Follow the six lasagna layers. Tap any wrong layers to remove them before baking.', 'error');
                if (!this.room('lasagna', 4))
                    return result(false, 'Lasagna shelf full. Serve some portions first.', 'error');
                this.oven = { id: this.nextJob++, phase: 'baking', remaining: 14, duration: 14 };
                this.lasagna = [];
                this.trayRevision++;
                return result(true, 'Lasagna baking. You can prepare the next tray meanwhile.', 'start');
            }
            if (this.oven.phase === 'ready') {
                this.ready.lasagna += 4;
                this.oven = empty(this.nextJob++);
                return result(true, '+4 baked lasagna portions in stock!', 'collect');
            }
            if (this.oven.phase === 'burnt') {
                this.oven = empty(this.nextJob++);
                return result(true, 'Oven cleared. No other stock was lost.');
            }
            return result(false, 'The lasagna is still baking.');
        }
        return result(false, 'Unknown kitchen action.');
    }
    advance(dt) {
        if (!Number.isFinite(dt) || dt <= 0)
            return [];
        dt = Math.min(.05, dt);
        this.time += dt;
        const events = [];
        const heat = (job, appliance, slot) => {
            if (job.phase === 'empty' || job.phase === 'burnt')
                return;
            job.remaining = Math.max(0, job.remaining - dt);
            if (job.remaining > 1e-8)
                return;
            if (job.phase === 'side-one') {
                job.phase = 'flip';
                job.remaining = this.difficulty === 'easy' ? 30 : 10;
                job.duration = job.remaining;
                events.push({ type: 'flip', appliance, slot });
            }
            else if (job.phase === 'side-two' || job.phase === 'baking') {
                job.phase = 'ready';
                job.remaining = this.difficulty === 'easy' ? 45 : 18;
                job.duration = job.remaining;
                events.push({ type: 'ready', appliance, slot });
            }
            else {
                job.phase = 'burnt';
                job.remaining = 0;
                events.push({ type: 'burnt', appliance, slot });
            }
            // Invalidate a press captured during the previous heat stage, even without switching views.
            job.id = this.nextJob++;
        };
        this.grill.forEach((job, i) => heat(job, 'grill', i));
        heat(this.oven, 'oven', 0);
        return events;
    }
    snapshot() {
        return { stock: { ...this.ready }, held: { ...this.held }, capacity: { ...CAPACITY }, grill: this.grill.map(j => ({ ...j })), oven: { ...this.oven },
            board: { ingredient: this.board, cuts: this.cuts, required: this.board === 'tomato' ? 4 : 3, batch: 6 },
            lasagnaLayers: [...this.lasagna], trayRevision: this.trayRevision, difficulty: this.difficulty, clock: this.time, pace: this.pace, phaseRemaining: this.phaseRemaining, cycle: Math.floor(this.time / 80) + 1 };
    }
}
