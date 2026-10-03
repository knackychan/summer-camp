import assert from 'node:assert/strict';
import { prepPlan } from '../js/games/kitchen/prep-plan.js';
import { KitchenModel } from '../js/games/kitchen/model.js';
import { KitchenSimulation, LASAGNA_STEPS } from '../js/games/kitchen/kitchen.js';

let serial = 0;
const command = (model, type, extra = {}) => model.apply({
    id: `prep-check-${++serial}`, session: model.session, orderId: model.order.id, type, ...extra,
});
const plan = model => prepPlan(model.stations, model.kitchen.snapshot());
const row = (rows, ingredient) => rows.find(item => item.ingredient === ingredient);
const dish = (id, required, layers = [], phase = 'editing') => ({
    order: { id, recipe: { required }, closed: false }, layers, phase,
});

// Both customers reserve their own patty, including the inactive customer's plate.
const model = new KitchenModel(29813, true, true);
assert.equal(model.requestDifficulty('standard'), 'changed');
assert.deepEqual(row(plan(model), 'patty'), {
    ingredient: 'patty', needed: 2, ready: 0, cooking: 0, missing: 2, reserved: 0, retry: 0,
});
assert.equal(command(model, 'cookPatty').type, 'cook');
model.selectOrder(1);
assert.equal(command(model, 'cookPatty').type, 'cook');
assert.deepEqual(row(plan(model), 'patty'), {
    ingredient: 'patty', needed: 0, ready: 0, cooking: 0, missing: 0, reserved: 2, retry: 0,
});

// A detached patty will enter pantry stock; targeted patties never count twice.
assert.equal(command(model, 'undo').type, 'undo');
assert.deepEqual(row(plan(model), 'patty'), {
    ingredient: 'patty', needed: 1, ready: 0, cooking: 1, missing: 0, reserved: 1, retry: 0,
});
assert.equal(command(model, 'add', { ingredient: 'tomato' }).type, 'add');
assert.equal(row(plan(model), 'tomato'), undefined);
assert.equal(command(model, 'clear').type, 'clear');
assert.deepEqual(row(plan(model), 'tomato'), {
    ingredient: 'tomato', needed: 1, ready: 4, cooking: 0, missing: 0, reserved: 0, retry: 0,
});

// Burnt food is no longer promised stock; a targeted burnt pan needs a retry.
for (let frame = 0; frame < 910; frame++) model.kitchen.advance(1 / 60);
assert.deepEqual(row(plan(model), 'patty'), {
    ingredient: 'patty', needed: 2, ready: 0, cooking: 0, missing: 2, reserved: 0, retry: 1,
});
assert.equal(model.kitchen.act('grill:0').ok, true);
assert.equal(row(plan(model), 'patty').reserved, 1);
assert.equal(row(plan(model), 'patty').retry, 0);

// Waiting, serving, absent and closed orders never create preparation demand.
const stock = new KitchenSimulation();
assert.deepEqual(prepPlan([
    dish(1, { tomato: 12 }, [], 'waiting'), dish(2, { patty: 12 }, [], 'serving'),
    { phase: 'editing', layers: [] }, { ...dish(4, { lettuce: 12 }), order: { closed: true } },
], stock.snapshot()), []);
assert.deepEqual(prepPlan([], undefined), []);

// Wrong ingredient order and surplus layers do not hide another dish's deficit.
const wrong = [
    dish(1, { tomato: 1, lettuce: 1 }, [{ ingredient: 'tomato' }, { ingredient: 'tomato' }, { ingredient: 'lettuce' }]),
    dish(2, { tomato: 7, lettuce: 1 }, [{ ingredient: 'lettuce' }]),
];
assert.deepEqual(prepPlan(wrong, stock.snapshot()), [
    { ingredient: 'tomato', needed: 7, ready: 4, cooking: 0, missing: 3, reserved: 0, retry: 0 },
]);

// Chopping counts only once started and becomes available only after the final cut.
assert.equal(stock.act('board:cut').ok, true);
assert.deepEqual(row(prepPlan(wrong, stock.snapshot()), 'tomato'), {
    ingredient: 'tomato', needed: 7, ready: 4, cooking: 6, missing: 0, reserved: 0, retry: 0,
});
for (let cut = 0; cut < 3; cut++) stock.act('board:cut');
assert.equal(row(prepPlan(wrong, stock.snapshot()), 'tomato').ready, 10);
assert.equal(row(prepPlan(wrong, stock.snapshot()), 'tomato').cooking, 0);
stock.act('board:lettuce');
stock.act('board:cut');
assert.equal(row(prepPlan([], stock.snapshot()), 'lettuce').cooking, 6);
stock.act('board:reset');
assert.deepEqual(prepPlan([], stock.snapshot()), []);

// Uncollected food stays separate from ready stock, including full oven batches.
for (const layer of LASAGNA_STEPS) stock.act(`lasagna:add:${layer}`);
assert.deepEqual(prepPlan([], stock.snapshot()), []);
assert.equal(stock.act('oven').ok, true);
assert.equal(stock.act('grill:0').ok, true);
assert.deepEqual(prepPlan([], stock.snapshot()).map(item => [item.ingredient, item.cooking]), [['patty', 2], ['lasagna', 4]]);
for (let frame = 0; frame < 310; frame++) stock.advance(1 / 60);
stock.act('grill:0');
for (let frame = 0; frame < 540; frame++) stock.advance(1 / 60);
assert.equal(stock.snapshot().grill[0].phase, 'ready');
assert.equal(stock.snapshot().oven.phase, 'ready');
const pending = prepPlan([dish(9, { patty: 5, lasagna: 6 })], stock.snapshot());
assert.deepEqual(row(pending, 'patty'), { ingredient: 'patty', needed: 5, ready: 2, cooking: 2, missing: 1, reserved: 0, retry: 0 });
assert.deepEqual(row(pending, 'lasagna'), { ingredient: 'lasagna', needed: 6, ready: 0, cooking: 4, missing: 2, reserved: 0, retry: 0 });
for (let frame = 0; frame < 1090; frame++) stock.advance(1 / 60);
assert.equal(row(prepPlan([dish(9, { lasagna: 6 })], stock.snapshot()), 'lasagna').cooking, 0);

// The helper returns repeatable values without mutating either input snapshot.
const stations = model.stations, snapshot = model.kitchen.snapshot();
const before = JSON.stringify([stations, snapshot]);
assert.deepEqual(prepPlan(stations, snapshot), prepPlan(stations, snapshot));
assert.equal(JSON.stringify([stations, snapshot]), before);
console.log('Kitchen prep checks passed: shared demand, reservations, refunds, batches, burns and read-only snapshots.');
