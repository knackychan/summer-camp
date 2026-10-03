import assert from 'node:assert/strict';
import { KitchenModel } from '../js/games/kitchen/model.js';
import { LASAGNA_STEPS } from '../js/games/kitchen/kitchen.js';
import { MENU_RECIPES, RecipeDeck, customizeRecipe, evaluateRecipe } from '../js/games/kitchen/recipes.js';
import { normalizeProfile, goalsFor, recordServe } from '../js/games/kitchen/progression.js';
import { drawIngredient, drawKitchen, WIDTH, HEIGHT } from '../js/games/kitchen/pixel-art.js';
import { HEX } from '../js/world/planet-palette.js';

let serial = 0;
const create = (difficulty = 'easy', profile) => {
  const model = new KitchenModel(29813, true, true, profile);
  assert.equal(model.requestDifficulty(difficulty), 'changed');
  return model;
};
const command = (model, type, extra = {}) => model.apply({
  id: `dish-${++serial}`, session: model.session, orderId: model.order.id, type, ...extra,
});
const kitchen = (model, action, jobId, revision) =>
  model.kitchenAction(action, `prep-${++serial}`, model.session, jobId, revision);
const state = model => model.kitchen.snapshot();
const tick = (model, seconds) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) {
    model.kitchen.advance(1 / 60);
    model.advanceServices(1 / 60);
  }
};

// Grading preserves sequence, repeated slices, missing steps and extra ingredients.
for (const recipe of MENU_RECIPES) {
  assert.equal(evaluateRecipe(recipe.sequence, recipe.sequence).correct, true);
  assert.equal(evaluateRecipe(recipe.sequence, recipe.sequence.slice(1)).correct, false);
  assert.equal(evaluateRecipe(recipe.sequence, [...recipe.sequence, 'pickles']).correct, false);
}
assert.equal(evaluateRecipe(['patty', 'cheese'], ['cheese', 'patty']).correct, false);
assert.equal(evaluateRecipe(['tomato', 'tomato'], ['tomato']).correct, false);

// Two orders reserve independent raw patties; stale and duplicate gestures are atomic.
const model = create();
assert.equal(model.stations.length, 2);
assert.equal(state(model).stock.patty, 0);
assert.equal(command(model, 'add', { ingredient: 'patty' }).reason, 'stock');
const firstOrder = model.order.id;
const raw = { id: 'one-raw-tap', session: model.session, orderId: firstOrder, type: 'cookPatty' };
const first = model.apply(raw);
assert.equal(first.type, 'cook');
assert.equal(model.apply(raw).reason, 'duplicate');
command(model, 'add', { ingredient: 'cheese' });
assert.equal(command(model, 'serve').reason, 'cooking');
model.selectOrder(1);
assert.equal(model.apply({ ...raw, id: 'stale-raw-tap' }).reason, 'stale');
const second = command(model, 'cookPatty');
command(model, 'add', { ingredient: 'tomato' });
command(model, 'add', { ingredient: 'lettuce' });
assert.equal(command(model, 'cookPatty').reason, 'grill-full');
assert.equal(model.layers.length, 3);
const oldJob = state(model).grill[0].id;
tick(model, 5.05);
assert.equal(kitchen(model, 'grill:0', oldJob).ok, false);
assert.equal(kitchen(model, 'grill:0', state(model).grill[0].id).ok, true);
assert.equal(kitchen(model, 'grill:1', state(model).grill[1].id).ok, true);
tick(model, 4.05);
const collectId = state(model).grill[0].id;
assert.deepEqual(kitchen(model, 'grill:0', collectId).plated, { orderId: firstOrder, layerId: first.layer.id });
assert.equal(kitchen(model, 'grill:0', collectId).ok, false);
assert.equal(model.activeSlot, 1);
assert.equal(model.stations[0].layers[0].pending, undefined);
assert.equal(model.layers[0].id, second.layer.id);
assert.equal(model.layers[0].pending, true);
assert.equal(kitchen(model, 'grill:1', state(model).grill[1].id).ok, true);
assert.equal(model.evaluation().correct, true);
assert.equal(command(model, 'serve').type, 'serve');
assert.equal(command(model, 'serve').reason, 'busy');
assert.equal(model.requestDifficulty('standard'), 'busy');
assert.equal(model.ordersServed, 1);
model.selectOrder(0);
assert.equal(model.evaluation().correct, true);
assert.equal(command(model, 'serve').type, 'serve');
assert.equal(state(model).held.patty, 0);
tick(model, 6);
assert.equal(model.ordersServed, 2);
assert.ok(model.stations.every(station => station.phase === 'editing'));

// Removing a specific slice refunds once; a canceled raw layer becomes ready stock.
const correction = create();
const tomato = command(correction, 'add', { ingredient: 'tomato' }).layer;
const other = command(correction, 'add', { ingredient: 'tomato' }).layer;
assert.equal(command(correction, 'serve').type, 'mismatch');
assert.equal(correction.layers.length, 2);
assert.equal(command(correction, 'remove', { layerId: tomato.id }).type, 'undo');
assert.equal(command(correction, 'remove', { layerId: tomato.id }).reason, 'stale');
assert.deepEqual(correction.layers.map(layer => layer.id), [other.id]);
assert.equal(state(correction).stock.tomato, 3);
const pending = command(correction, 'cookPatty').layer;
command(correction, 'remove', { layerId: pending.id });
assert.equal(state(correction).stock.patty, 0);
assert.equal(state(correction).grill[0].targetOrderId, undefined);
tick(correction, 5.05);
kitchen(correction, 'grill:0');
tick(correction, 4.05);
kitchen(correction, 'grill:0');
assert.equal(state(correction).stock.patty, 1);
command(correction, 'clear');
assert.equal(state(correction).stock.tomato, 4);

// Progressive preparation credits only a completed batch; exact lasagna must bake.
const prep = create();
for (let i = 0; i < 3; i++) assert.equal(kitchen(prep, 'board:cut').ok, true);
assert.equal(state(prep).board.cuts, 3);
assert.equal(state(prep).stock.tomato, 4);
assert.equal(kitchen(prep, 'board:lettuce').ok, false);
kitchen(prep, 'board:cut');
assert.equal(state(prep).stock.tomato, 10);
kitchen(prep, 'board:lettuce');
for (let i = 0; i < 3; i++) kitchen(prep, 'board:cut');
assert.equal(state(prep).stock.lettuce, 9);
kitchen(prep, 'lasagna:add:cheese');
assert.equal(kitchen(prep, 'oven').ok, false);
const revision = state(prep).trayRevision;
assert.equal(kitchen(prep, 'lasagna:remove:0', undefined, revision).ok, true);
assert.equal(kitchen(prep, 'lasagna:remove:0', undefined, revision).ok, false);
for (const layer of LASAGNA_STEPS) kitchen(prep, `lasagna:add:${layer}`);
assert.equal(kitchen(prep, 'oven').ok, true);
assert.equal(state(prep).stock.lasagna, 0);
assert.deepEqual(state(prep).lasagnaLayers, []);
kitchen(prep, 'lasagna:add:pasta');
tick(prep, 14.05);
const ovenId = state(prep).oven.id;
assert.equal(kitchen(prep, 'oven', ovenId).ok, true);
assert.equal(kitchen(prep, 'oven', ovenId).ok, false);
assert.equal(state(prep).stock.lasagna, 4);
assert.deepEqual(state(prep).lasagnaLayers, ['pasta']);

// Difficulty confirmation covers kitchen work, and easy still has a burn deadline.
const before = state(prep);
assert.equal(prep.requestDifficulty('standard'), 'confirm');
assert.equal(prep.confirmMode(false), 'unchanged');
assert.deepEqual(state(prep), before);
const oldSession = prep.session;
assert.equal(prep.requestDifficulty('standard'), 'confirm');
assert.equal(prep.confirmMode(true), 'changed');
assert.ok(prep.session > oldSession);
assert.equal(prep.difficulty, 'standard');
assert.equal(state(prep).stock.lasagna, 0);
command(prep, 'cookPatty');
tick(prep, 15.1);
assert.equal(state(prep).grill[0].phase, 'burnt');
assert.equal(kitchen(prep, 'grill:0').ok, true);
assert.equal(state(prep).grill[0].targetLayerId, prep.layers[0].id);
const easy = create();
command(easy, 'cookPatty');
tick(easy, 15.1);
assert.equal(state(easy).grill[0].phase, 'flip');
tick(easy, 20);
assert.equal(state(easy).grill[0].phase, 'burnt');
tick(easy, 60);
assert.equal(state(easy).pace, 'calm');
assert.equal(easy.stations.length, 2);

// Saved progress accepts only known, bounded own fields and never shares mutable data.
const fresh = normalizeProfile(undefined, 7);
assert.equal(fresh.totalServed, 7);
assert.equal(goalsFor(fresh).shiftNumber, 1);
assert.equal(goalsFor(fresh).targets[0].current, 0);
const dirty = JSON.parse('{"version":1,"totalServed":999999999,"recipeServes":{"cheese-burger":2.9,"__proto__":{"polluted":true},"unknown":50},"completedShifts":-2,"shift":{"served":3.8,"recipes":["cheese-burger","cheese-burger","unknown"],"families":["burger","toString","burger"]}}');
const clean = normalizeProfile(dirty);
assert.equal(clean.totalServed, 1000000);
assert.equal(clean.recipeServes['cheese-burger'], 2);
assert.equal(clean.completedShifts, 0);
assert.deepEqual(clean.shift, { served: 3, recipes: ['cheese-burger'], families: ['burger'] });
assert.equal(Object.hasOwn(clean.recipeServes, '__proto__'), false);
assert.equal(Object.hasOwn(clean.recipeServes, 'unknown'), false);
dirty.shift.recipes.push('garden-salad');
assert.deepEqual(clean.shift.recipes, ['cheese-burger']);
assert.throws(() => clean.shift.recipes.push('garden-salad'), TypeError);
assert.deepEqual(normalizeProfile(JSON.parse(JSON.stringify(clean))), clean);
assert.equal(normalizeProfile(Object.create({ version: 1, totalServed: 88 }), 2).totalServed, 2);
assert.equal(normalizeProfile({ version: 1, recipeServes: Object.create({ 'cheese-burger': 99 }), totalServed: Infinity }).recipeServes['cheese-burger'], 0);
assert.equal(normalizeProfile({ version: 1, totalServed: NaN }).totalServed, 0);
assert.deepEqual(recordServe(fresh, { recipe: { id: '__proto__' } }).profile, fresh);

// Goals repeat in three authored shifts; each unlock is credited once at its threshold.
const recipeById = id => MENU_RECIPES.find(recipe => recipe.id === id);
let profile = normalizeProfile(), credited = [], completed = [];
const course = ['cheese-burger', 'cheese-burger', 'cheese-burger', 'garden-burger',
  'cheese-burger', 'garden-salad', 'baked-lasagna', 'garden-burger', 'cheese-burger',
  'double-stack-burger', 'garden-burger', 'cheese-burger', 'garden-burger', 'cheese-burger', 'garden-burger',
  'chef-salad'];
course.forEach((id, index) => {
  const previous = profile;
  const result = recordServe(profile, { recipe: recipeById(id) });
  profile = result.profile;
  assert.equal(previous.totalServed, index);
  assert.equal(profile.totalServed, index + 1);
  if (result.completedShift) completed.push(index + 1);
  credited.push(...result.unlocked);
  if ([4, 8, 12, 16].includes(index + 1)) assert.equal(result.unlocked.length, 1);
  else assert.equal(result.unlocked.length, 0);
});
assert.deepEqual(completed, [4, 9, 15]);
assert.deepEqual(credited, ['pickle-crunch-burger', 'double-stack-burger', 'chef-salad', 'lasagna-feast']);
assert.equal(profile.completedShifts, 3);
assert.deepEqual(profile.shift, { served: 1, recipes: ['chef-salad'], families: ['salad'] });
assert.equal(goalsFor(profile).shiftNumber, 4);
assert.equal(goalsFor(profile).targets[0].target, 4);
assert.equal(profile.recipeServes['cheese-burger'], 7);
assert.equal(recordServe(profile, { recipe: recipeById('cheese-burger') }).unlocked.length, 0);

// Unlocking extends the live menu without resetting its intro or mutating another deck.
const starters = MENU_RECIPES.filter(recipe => recipe.unlockAt === 0);
const deck = new RecipeDeck(29813, starters);
assert.equal(deck.next().id, 'cheese-burger');
assert.equal(deck.next().id, 'garden-burger');
deck.unlock([recipeById('pickle-crunch-burger')]);
assert.deepEqual(Array.from({ length: 4 }, () => deck.next().id), ['double-tomato-burger', 'garden-salad', 'baked-lasagna', 'pickle-crunch-burger']);
deck.next();
deck.unlock([recipeById('double-stack-burger'), recipeById('double-stack-burger')]);
assert.equal(deck.next().id, 'double-stack-burger');
assert.equal(deck.recipes.length, 7);
assert.equal(starters.length, 5);
const singleton = new RecipeDeck(2, [recipeById('cheese-burger')]);
assert.equal(singleton.next().id, singleton.next().id);

// Custom requests update both sequence and counts, never the shared menu or another ticket.
const cheeseburger = recipeById('cheese-burger');
const noCheese = customizeRecipe(cheeseburger, 'no-cheese');
assert.deepEqual(noCheese.sequence, ['patty']);
assert.equal(noCheese.required.cheese, 0);
assert.equal(evaluateRecipe(noCheese.sequence, ['patty']).correct, true);
assert.equal(evaluateRecipe(noCheese.sequence, cheeseburger.sequence).correct, false);
assert.deepEqual(cheeseburger.sequence, ['patty', 'cheese']);
const extraTomato = customizeRecipe(recipeById('double-tomato-burger'), 'extra-tomato');
assert.equal(extraTomato.required.tomato, 3);
assert.equal(extraTomato.sequence[extraTomato.sequence.length - 1], 'tomato');
assert.equal(customizeRecipe(recipeById('baked-lasagna'), 'no-cheese'), recipeById('baked-lasagna'));
assert.equal(customizeRecipe(cheeseburger, 'unknown'), cheeseburger);
assert.equal(customizeRecipe(cheeseburger, 'extra-pickles').required.pickles, 1);
const requested = create('standard');
const easyRequests = create();
const untouched = requested.order;
for (let number = 3; number <= 14; number++) {
  const order = requested.newOrder(), easyOrder = easyRequests.newOrder();
  assert.equal(Boolean(order.request), number > 5 && (number - 5) % 3 === 0);
  assert.equal(easyOrder.request, undefined);
  assert.equal(evaluateRecipe(order.recipe.sequence, order.recipe.sequence).correct, true);
  for (const ingredient of Object.keys(order.recipe.required))
    assert.equal(order.recipe.required[ingredient], order.recipe.sequence.filter(id => id === ingredient).length);
}
assert.deepEqual(requested.order, untouched);

// Accepted serving advances persistent progress once; stale/mistaken inputs and difficulty resets do not.
const progressModel = create('easy', normalizeProfile(undefined, 3));
const parkedOrder = progressModel.stations[1].order;
assert.equal(progressModel.menu.length, 5);
command(progressModel, 'add', { ingredient: 'cheese' });
assert.equal(command(progressModel, 'serve').type, 'mismatch');
assert.equal(progressModel.profile.totalServed, 3);
command(progressModel, 'clear');
command(progressModel, 'cookPatty');
command(progressModel, 'add', { ingredient: 'cheese' });
tick(progressModel, 5.05);
kitchen(progressModel, 'grill:0');
tick(progressModel, 4.05);
kitchen(progressModel, 'grill:0');
const serveCommand = { id: 'profile-serve-once', session: progressModel.session, orderId: progressModel.order.id, type: 'serve' };
const accepted = progressModel.apply(serveCommand);
assert.equal(accepted.type, 'serve');
assert.deepEqual(accepted.progress, { completedShift: false, unlocked: ['pickle-crunch-burger'] });
assert.equal(progressModel.profile.totalServed, 4);
assert.equal(progressModel.ordersServed, 1);
assert.equal(progressModel.menu.length, 6);
assert.deepEqual(progressModel.stations[1].order, parkedOrder);
assert.equal(progressModel.apply(serveCommand).reason, 'duplicate');
assert.equal(command(progressModel, 'serve').reason, 'busy');
assert.equal(progressModel.profile.totalServed, 4);
const earned = progressModel.profile;
tick(progressModel, 6);
assert.equal(progressModel.order.recipe.id, 'double-tomato-burger');
assert.equal(progressModel.apply({ ...serveCommand, id: 'old-ticket-serve' }).reason, 'stale');
assert.deepEqual(progressModel.profile, earned);
assert.equal(progressModel.requestDifficulty('standard'), 'changed');
assert.equal(progressModel.ordersServed, 0);
assert.deepEqual(progressModel.profile, earned);
assert.deepEqual(progressModel.goals, goalsFor(earned));
const reloaded = create('easy', JSON.parse(JSON.stringify(earned)));
assert.deepEqual(reloaded.profile, earned);
assert.equal(reloaded.menu.length, 6);
assert.equal(reloaded.order.recipe.id, 'cheese-burger');
assert.deepEqual(reloaded.snapshot().profile, earned);
assert.notEqual(reloaded.profile, reloaded.profile);

// Every expanded dish and generated request can be prepared through the real stations and served.
const fullMenu = create('standard', normalizeProfile(undefined, 16));
const cookedRecipes = new Set(), cookedRequests = new Set();
for (let served = 0; served < 16; served++) {
  const order = fullMenu.order;
  for (const ingredient of order.recipe.sequence) {
    if (ingredient === 'patty' && fullMenu.kitchen.available(ingredient) === 0) {
      const job = command(fullMenu, 'cookPatty');
      assert.equal(job.type, 'cook');
      tick(fullMenu, 5.05);
      assert.equal(kitchen(fullMenu, 'grill:' + job.slot).ok, true);
      tick(fullMenu, 4.05);
      assert.equal(kitchen(fullMenu, 'grill:' + job.slot).ok, true);
      continue;
    }
    if (fullMenu.kitchen.available(ingredient) === 0) {
      if (ingredient === 'lasagna') {
        for (const layer of LASAGNA_STEPS) kitchen(fullMenu, 'lasagna:add:' + layer);
        assert.equal(kitchen(fullMenu, 'oven').ok, true);
        tick(fullMenu, 14.05);
        assert.equal(kitchen(fullMenu, 'oven').ok, true);
      } else {
        assert.equal(kitchen(fullMenu, 'board:' + ingredient).ok, true);
        const cuts = state(fullMenu).board.required;
        for (let cut = 0; cut < cuts; cut++) assert.equal(kitchen(fullMenu, 'board:cut').ok, true);
      }
    }
    assert.equal(command(fullMenu, 'add', { ingredient }).type, 'add');
  }
  assert.equal(command(fullMenu, 'serve').type, 'serve', order.recipe.id);
  cookedRecipes.add(order.recipe.id);
  if (order.request) cookedRequests.add(order.request);
  tick(fullMenu, 18);
  fullMenu.selectOrder(1 - fullMenu.activeSlot);
}
assert.equal(cookedRecipes.size, MENU_RECIPES.length);
assert.deepEqual([...cookedRequests].sort(), ['extra-pickles', 'extra-tomato', 'no-cheese']);
assert.equal(fullMenu.profile.totalServed, 32);
assert.equal(Object.values(state(fullMenu).held).reduce((sum, amount) => sum + amount, 0), 0);

// Rendering stays on the shared palette and an integer pixel grid for every food.
let rectangles = 0;
const context = {
  fillStyle: '', imageSmoothingEnabled: true,
  fillRect(...bounds) {
    assert.ok(HEX.includes(this.fillStyle), this.fillStyle);
    assert.ok(bounds.every(Number.isInteger), bounds);
    assert.ok(bounds[2] >= 0 && bounds[3] >= 0, bounds);
    rectangles++;
  },
};
for (const id of ['patty', 'patty-raw', 'cheese', 'tomato', 'whole-tomato', 'lettuce', 'pickles', 'sauce', 'lasagna', 'pasta', 'bun-base', 'bun-top']) {
  const previous = rectangles;
  drawIngredient(context, id, 0, 0, 1.5);
  assert.ok(rectangles > previous, id);
}
const canvas = { width: 0, height: 0, getContext: () => context };
for (const recipe of MENU_RECIPES) {
  const layers = recipe.sequence.map(ingredient => ({ ingredient }));
  for (const phase of ['side-one', 'flip', 'side-two', 'ready', 'burnt']) {
    drawKitchen(canvas, { layers, stations: [{ phase: 'editing', order: { recipe } }], time: 1.4,
      kitchen: { ...before, grill: [{ phase, remaining: 2, duration: 5 }, { phase: 'empty' }], oven: { phase: phase === 'side-one' ? 'baking' : phase, remaining: 2, duration: 14 } },
      paused: phase === 'burnt' });
  }
}
assert.equal(canvas.width, WIDTH);
assert.equal(canvas.height, HEIGHT);
assert.equal(context.imageSmoothingEnabled, false);
assert.ok(rectangles > 1000);

console.log('Kitchen Quest checks passed: recipes, orders, cooking, stock, prep, difficulty, stale input, saved shifts, unlocks, requests and pixel rendering.');
