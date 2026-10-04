import assert from 'node:assert/strict';
import { KitchenModel, ALL_INGREDIENTS, shiftSeeds } from '../js/games/kitchen/model.js';
import { LASAGNA_STEPS, CAPACITY } from '../js/games/kitchen/kitchen.js';
import { FOOD, RECIPES, REQUESTS, PATTY, PATTY_HINT } from '../js/games/kitchen/strings.js';
import { SPRITE_IDS, ICON_IDS } from '../js/games/kitchen/sprites.js';
import { CAST, Cast, speech } from '../js/games/kitchen/customers.js';
import { PENDING_THICK, layerThickness } from '../js/games/kitchen/scene.js';
import { MENU_RECIPES, GUIDED_SERVES, RecipeDeck, customizeRecipe, evaluateRecipe } from '../js/games/kitchen/recipes.js';
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

// Every dish and generated request can be prepared through the real stations and served.
const everyDish = Math.max(...MENU_RECIPES.map(recipe => recipe.unlockAt));
const fullMenu = create('standard', normalizeProfile(undefined, everyDish));
const cookedRecipes = new Set(), cookedRequests = new Set();
let servedFull = 0;
for (; servedFull < 80 && (cookedRecipes.size < MENU_RECIPES.length || cookedRequests.size < 3); servedFull++) {
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
assert.ok(servedFull < 60, 'a shuffled deal reaches every dish in a reasonable number of orders: ' + servedFull);
assert.deepEqual([...cookedRequests].sort(), ['extra-pickles', 'extra-tomato', 'no-cheese']);
assert.equal(fullMenu.profile.totalServed, everyDish + servedFull);
assert.equal(Object.values(state(fullMenu).held).reduce((sum, amount) => sum + amount, 0), 0);

// Recipe audit: every dish is well formed, preparable, drawable, bilingual and unlocked in order.
const hasChinese = text => /[\u4e00-\u9fff]/.test(text);
const stationFor = id => id === 'patty' ? 'grill' : id === 'lasagna' ? 'oven' : id === 'tomato' || id === 'lettuce' ? 'board' : 'pantry';
assert.equal(new Set(MENU_RECIPES.map(recipe => recipe.id)).size, MENU_RECIPES.length, 'duplicate recipe id');
assert.equal(new Set(MENU_RECIPES.map(recipe => recipe.sequence.join('|'))).size, MENU_RECIPES.length, 'two recipes share one sequence');
assert.deepEqual(Object.keys(RECIPES).sort(), MENU_RECIPES.map(recipe => recipe.id).sort(), 'every recipe has a name and every name a recipe');
for (const recipe of MENU_RECIPES) {
  const where = recipe.id;
  assert.ok(['burger', 'salad', 'lasagna'].includes(recipe.family), where + ' family');
  assert.ok(recipe.sequence.length >= 1 && recipe.sequence.length <= 8, where + ' has 1 to 8 steps');
  assert.ok(recipe.sequence.length + 2 <= fullMenu.maxLayers, where + ' leaves room on the plate for a request and a slip');
  for (const ingredient of recipe.sequence) {
    assert.ok(ALL_INGREDIENTS.includes(ingredient), where + ' uses unknown ' + ingredient);
    assert.ok(FOOD[ingredient] && FOOD[ingredient].length === 2 && FOOD[ingredient].every(Boolean) && hasChinese(FOOD[ingredient][1]), ingredient + ' is bilingual');
    assert.ok(SPRITE_IDS.includes(ingredient), where + ': no plate sprite for ' + ingredient);
    assert.ok(ICON_IDS.includes(ingredient), where + ': no tray icon for ' + ingredient);
    assert.ok(['grill', 'oven', 'board', 'pantry'].includes(stationFor(ingredient)));
  }
  assert.ok(RECIPES[recipe.id].length === 2 && RECIPES[recipe.id].every(Boolean) && hasChinese(RECIPES[recipe.id][1]), where + ' name is bilingual');
  assert.ok(recipe.required.lasagna <= 4, where + ': one bake makes four portions');
  assert.ok(recipe.required.lasagna <= CAPACITY.lasagna && recipe.required.patty <= CAPACITY.patty, where + ' fits the shelf');
  assert.equal(evaluateRecipe(recipe.sequence, recipe.sequence).correct, true);
  // Whatever customers ask for, the changed ticket is still a valid, serveable dish.
  for (const request of Object.keys(REQUESTS)) {
    const changed = customizeRecipe(recipe, request);
    assert.equal(evaluateRecipe(changed.sequence, changed.sequence).correct, true);
    assert.ok(changed.sequence.length >= 1 && changed.sequence.length + 2 <= fullMenu.maxLayers, where + ' + ' + request);
  }
}
for (const request of Object.keys(REQUESTS)) assert.ok(REQUESTS[request].every(Boolean) && hasChinese(REQUESTS[request][1]), request);
// Unlocks never go backwards, never leave a hole wider than four dishes, and start with the tour.
const unlocks = MENU_RECIPES.map(recipe => recipe.unlockAt);
assert.deepEqual(unlocks, [...unlocks].sort((a, b) => a - b));
const steps = [...new Set(unlocks)];
steps.slice(1).forEach((step, index) => assert.ok(step - steps[index] <= 4, 'gap before ' + step));
assert.equal(unlocks.filter(unlockAt => unlockAt === 0).length, GUIDED_SERVES);
assert.ok(MENU_RECIPES.length >= 14);
// The lasagna tray holds exactly six layers: a seventh is refused with the full-tray message.
assert.equal(LASAGNA_STEPS.length, 6);
const tray = create();
for (let layer = 0; layer < 7; layer++) kitchen(tray, 'lasagna:add:' + LASAGNA_STEPS[layer % 6]);
assert.equal(state(tray).lasagnaLayers.length, 6);
assert.equal(kitchen(tray, 'lasagna:add:pasta').ok, false);
// Every regular can ask for every dish in both languages.
for (const who of CAST) for (const recipe of MENU_RECIPES) {
  const english = speech(who, { recipe }, 'en'), chinese = speech(who, { recipe }, 'zh');
  assert.ok(english.includes(RECIPES[recipe.id][0].toLowerCase()) || english.includes(RECIPES[recipe.id][0].toUpperCase()), who.id + ' / ' + recipe.id);
  assert.ok(chinese.includes(RECIPES[recipe.id][1]), who.id + ' / ' + recipe.id);
}

// A shift is dealt from kid + day + progress: reproducible from its key, different when any part changes.
const deal = (seed, served, count = 12) => {
  const dealer = new KitchenModel(seed, true, true, normalizeProfile(undefined, served)); dealer.requestDifficulty('easy');
  // Two customers are seated at once, so the first two dishes are already on their tickets.
  return [...dealer.stations.map(station => station.order.recipe.id), ...Array.from({ length: count - 2 }, () => dealer.deck.next().id)];
};
const seedFor = (kid, day, served) => shiftSeeds(kid, day, served);
assert.deepEqual(seedFor('luis', '2026-10-04', 9), seedFor('luis', '2026-10-04', 9));
assert.equal(seedFor('luis', '2026-10-04', 9).key, 'luis:2026-10-04:9');
// Another visit the same day is another shift, still reproducible from its key; the first visit keeps the plain key.
assert.equal(shiftSeeds('luis', '2026-10-04', 9, 0).key, 'luis:2026-10-04:9');
assert.equal(shiftSeeds('luis', '2026-10-04', 9, 2).key, 'luis:2026-10-04:9:r2');
assert.deepEqual(shiftSeeds('luis', '2026-10-04', 9, 2), shiftSeeds('luis', '2026-10-04', 9, 2));
assert.equal(new Set([0, 1, 2, 3, 4, 5].map(run => shiftSeeds('luis', '2026-10-04', 9, run).orders)).size, 6);
assert.ok(Number.isInteger(seedFor('luis', '2026-10-04', 9).orders) && seedFor('luis', '2026-10-04', 9).orders >= 0);
assert.notEqual(seedFor('luis', '2026-10-04', 9).orders, seedFor('luis', '2026-10-04', 9).cast);
const base = seedFor('luis', '2026-10-04', 9).orders;
for (const other of [seedFor('ana', '2026-10-04', 9), seedFor('luis', '2026-10-05', 9), seedFor('luis', '2026-10-04', 10)]) assert.notEqual(other.orders, base);
const days = Array.from({ length: 14 }, (_, day) => '2026-10-' + String(day + 1).padStart(2, '0'));
const shifts = days.map(day => deal(seedFor('luis', day, 20).orders, 20));
assert.deepEqual(shifts[0], deal(seedFor('luis', days[0], 20).orders, 20), 'same key, same shift');
assert.ok(new Set(shifts.map(dealt => dealt.join())).size >= 12, 'nearly every day is a different shift');
assert.ok(new Set(shifts.map(dealt => dealt[0])).size >= 4, 'the first dish varies from day to day');
assert.ok(shifts.every(dealt => dealt.length === 12 && dealt.every(id => MENU_RECIPES.some(recipe => recipe.id === id))));
// A cook who has not done the starting tour still gets it in authored order, whatever the day.
const tour = MENU_RECIPES.filter(recipe => recipe.unlockAt < GUIDED_SERVES).map(recipe => recipe.id);
for (const day of days) assert.deepEqual(deal(seedFor('luis', day, GUIDED_SERVES - 1).orders, GUIDED_SERVES - 1, tour.length), tour);
// A cook past the tour is shuffled, and a dish unlocked mid-shift still arrives next.
const veteran = new KitchenModel(seedFor('luis', days[3], 30).orders, true, true, normalizeProfile(undefined, 30)); veteran.requestDifficulty('easy');
assert.equal(veteran.deck.recipes.length, MENU_RECIPES.filter(recipe => recipe.unlockAt <= 30).length);
veteran.deck.next();
veteran.deck.unlock([MENU_RECIPES[MENU_RECIPES.length - 1]]);
assert.equal(veteran.deck.next().id, MENU_RECIPES[MENU_RECIPES.length - 1].id);
assert.equal(veteran.snapshot().session > 0, true);
// Customers walk in different orders on different days, and the same order on the same day.
const firstFaces = days.map(day => { const cast = new Cast(seedFor('luis', day, 20).cast); const out = []; for (let i = 0; i < 4; i++) out.push(cast.draw(cast.visible()).id); return out.join(); });
assert.ok(new Set(firstFaces).size >= 12);
const castA = new Cast(seedFor('luis', days[0], 20).cast), castB = new Cast(seedFor('luis', days[0], 20).cast);
assert.deepEqual([castA.draw(new Set()).id, castA.draw(new Set()).id], [castB.draw(new Set()).id, castB.draw(new Set()).id]);
// The request rotation starts in a different place for different seeds but always visits all three requests.
const offsets = new Set(days.map(day => new KitchenModel(seedFor('luis', day, 20).orders, true, true).requestOffset));
assert.ok(offsets.size > 1 && [...offsets].every(offset => [0, 1, 2].includes(offset)));

// A patty reserved on the plate is described by what its pan is doing, in both languages.
for (const phase of ['side-one', 'side-two', 'flip', 'ready', 'burnt']) {
  assert.ok(PATTY[phase].length === 2 && PATTY[phase].every(Boolean) && hasChinese(PATTY[phase][1]), 'status ' + phase);
  assert.ok(PATTY_HINT[phase].length === 2 && PATTY_HINT[phase].every(Boolean) && hasChinese(PATTY_HINT[phase][1]), 'hint ' + phase);
}
assert.notDeepEqual(PATTY.flip, PATTY.ready);
assert.notDeepEqual(PATTY['side-one'], PATTY.ready);
// ...and it keeps the room it will fill: the dashed tray is taller than a cooked patty, and the extra melts away on landing.
assert.ok(PENDING_THICK > 7);
assert.equal(layerThickness(7, true, undefined), PENDING_THICK);
assert.equal(layerThickness(3, false, undefined), 3, 'a cheese slice is never padded');
assert.equal(layerThickness(7, false, 0), PENDING_THICK);
assert.ok(layerThickness(7, false, .1) < PENDING_THICK && layerThickness(7, false, .1) > 7);
assert.equal(layerThickness(7, false, .25), 7);
const heights = [0, .05, .1, .15, .2].map(age => layerThickness(7, false, age));
assert.deepEqual(heights, [...heights].sort((a, b) => b - a), 'the stack settles smoothly, never bounces');

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

console.log('Kitchen Quest checks passed: recipes, recipe audit, daily deals, orders, cooking, patty status, stock, prep, difficulty, stale input, saved shifts, unlocks, requests and pixel rendering.');
