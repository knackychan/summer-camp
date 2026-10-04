import test from 'node:test';
import assert from 'node:assert/strict';
import { LAB_PROPERTIES, LAB_INGREDIENTS, SHELF_IDS, BAG_IDS, LAB_FREE_INGREDIENTS } from '../js/games/codequest/lab/ingredients.js';
import { LAB_RULES } from '../js/games/codequest/lab/rules.js';
import { sumExperiment, resolveExperiment, mixHint } from '../js/games/codequest/lab/resolve.js';
import { RECIPES, CODEQUEST_INGREDIENTS, normalizeProfile, brewLab } from '../js/games/codequest/progression.js';
import { normalizeLab, recordFound, recordSeen } from '../js/games/codequest/lab/journal.js';
import { runAlchemyCode, recipeToAlchemyCode, recipeById } from '../js/games/codequest/alchemy-code.js';

const resolve = (ingredients, steps = []) => resolveExperiment({ ingredients, steps, recipes: RECIPES });

test('ingredient data: 8 shelf + 4 bag, bag in progression order', () => {
  assert.equal(SHELF_IDS.length, 8);
  assert.deepEqual([...BAG_IDS], [...CODEQUEST_INGREDIENTS]);
  assert.equal(Object.keys(LAB_INGREDIENTS).length, 12);
  for (const id of SHELF_IDS) assert.equal(LAB_INGREDIENTS[id].where, 'shelf');
  for (const id of BAG_IDS) assert.equal(LAB_INGREDIENTS[id].where, 'bag');
  for (const item of Object.values(LAB_INGREDIENTS)) {
    for (const [prop, n] of Object.entries(item.props)) {
      assert.ok(LAB_PROPERTIES.includes(prop), item.id + ' has unknown property ' + prop);
      assert.ok(Number.isInteger(n) && n >= 0 && n <= 3, item.id + '.' + prop + ' out of 0..3');
    }
  }
  assert.equal(LAB_FREE_INGREDIENTS, true);
});

test('every ingredient, rule label and rule line ships EN + 中文', () => {
  const pairs = [
    ...Object.values(LAB_INGREDIENTS).map(item => [item.id, item.label]),
    ...LAB_RULES.flatMap(rule => [[rule.id + '.label', rule.label], [rule.id + '.line', rule.line]])
  ];
  for (const [where, pair] of pairs) {
    assert.ok(Array.isArray(pair) && pair.length === 2, where);
    assert.ok(pair[0].trim() && pair[1].trim(), where + ' missing a language');
    assert.match(pair[1], /[一-鿿]/, where + ' has no 中文');
  }
});

test('process steps modify the summed mix', () => {
  const base = sumExperiment(['emberSeed'], []);
  assert.equal(base.fire, 3);
  assert.equal(base.instability, 1);
  const heated = sumExperiment(['emberSeed'], ['heat']);
  assert.equal(heated.fire, 4);
  assert.equal(heated.chaos, 2);
  const cooled = sumExperiment(['frostDew'], ['cool']);
  assert.equal(cooled.cold, 3);
  assert.equal(cooled.calm, 2);
  assert.equal(sumExperiment(['voidDust'], ['grind']).chaos, 3);
  assert.equal(sumExperiment(['voidDust'], ['stir']).calm, 0);
  assert.equal(sumExperiment(['voidDust'], ['stir', 'stir']).calm, 1);
});

test('the 4 recipes with their exact steps make potions', () => {
  for (const recipe of RECIPES) {
    const result = resolve([...recipe.ingredients].reverse(), recipe.process);
    assert.equal(result.kind, 'potion', recipe.id);
    assert.equal(result.potionId, recipe.id);
    assert.equal(result.recipeId, recipe.id);
  }
});

test('a recipe mix in the wrong order is a reaction with an order hint', () => {
  for (const recipe of RECIPES) {
    const result = resolve(recipe.ingredients, [...recipe.process].reverse());
    assert.equal(result.kind, 'reaction', recipe.id);
    assert.equal(result.hint, 'order', recipe.id);
  }
  assert.equal(resolve(['sunHerb', 'sunHerb', 'waterCrystal'], []).hint, 'order');
  assert.equal(resolve(['sunHerb', 'waterCrystal'], ['grind', 'stir']).hint, undefined);
});

const FIXTURES = [
  ['pocketUniverse', ['moonflower', 'echoCrystal', 'voidDust']],
  ['explosion', ['voidDust', 'redMushroom', 'emberSeed', 'starDust']],
  ['temporalRupture', ['voidDust', 'starDust']],
  ['singularity', ['voidDust', 'emberSeed']],
  ['monstrosity', ['echoCrystal', 'lifeSap', 'redMushroom']],
  ['duplication', ['echoCrystal', 'redMushroom']],
  ['overgrowth', ['lifeSap', 'redMushroom', 'frostDew']],
  ['fireball', ['emberSeed'], ['heat']],
  ['iceBurst', ['frostDew'], ['cool']],
  ['glow', ['moonflower', 'starDust']],
  ['steam', ['emberSeed', 'frostDew']],
  ['bubbles', ['frostDew']],
  ['smoke', ['emberRoot']],
  ['fizzle', ['lifeSap']]
];

test('every rule is reached by a fixture, in table order', () => {
  assert.deepEqual(LAB_RULES.map(rule => rule.id), FIXTURES.map(([id]) => id));
  for (const [id, mix, steps] of FIXTURES) {
    const result = resolve(mix, steps);
    assert.equal(result.kind, 'reaction', id);
    assert.equal(result.ruleId, id, mix.join('+') + ' should be ' + id + ', got ' + result.ruleId);
    assert.equal(result.family, LAB_RULES.find(rule => rule.id === id).family);
    assert.ok([1, 2, 3].includes(result.intensity), id + ' intensity');
  }
});

test('more of the deciding property means more intensity', () => {
  const small = resolve(['echoCrystal', 'redMushroom']);
  const big = resolve(['echoCrystal', 'echoCrystal', 'redMushroom']);
  assert.equal(big.ruleId, 'duplication');
  assert.ok(big.intensity > small.intensity);
});

test('every single ingredient resolves to something', () => {
  for (const id of Object.keys(LAB_INGREDIENTS)) {
    const result = resolve([id]);
    assert.ok(result.kind === 'reaction' && result.ruleId, id);
  }
});

test('bad input never throws and is capped', () => {
  for (const input of [[], null, undefined, 'echoCrystal', [42, null, 'nope', {}], Array(9).fill('frostDew')]) {
    const result = resolveExperiment({ ingredients: input, steps: ['heat', 'bogus', 7], recipes: RECIPES });
    assert.ok(result && result.kind, String(input));
  }
  assert.equal(resolveExperiment({}).ruleId, 'fizzle');
  // 9 Frost Dews count as 4; 7 cools count as 5.
  assert.equal(sumExperiment(Array(9).fill('frostDew'), Array(7).fill('cool')).cold, 4 * 2 + 5);
});

test('same input twice gives the same result', () => {
  for (const [, mix, steps] of FIXTURES) assert.deepEqual(resolve(mix, steps), resolve(mix, steps));
});

test('mixHint tints toward the strongest property and shakes when unstable', () => {
  assert.equal(mixHint([], []).tint, null);
  assert.equal(mixHint(['emberSeed'], []).tint, 'fire');
  assert.equal(mixHint(['echoCrystal', 'redMushroom'], []).tint, 'echo');
  assert.equal(mixHint(['frostDew'], []).shaky, false);
  assert.equal(mixHint(['voidDust', 'emberSeed'], []).shaky, true);
});

// Slice 02 — free brewing + Journal save.
const healing = RECIPES.find(recipe => recipe.id === 'healing');

test('brewLab free:true brews with zero stock and leaves counts unchanged', () => {
  const empty = normalizeProfile({ version: 12 });
  const result = brewLab(empty, healing.ingredients, healing.process, { free: true });
  assert.equal(result.ok, true);
  assert.equal(result.profile.potions.healing, 1);
  assert.deepEqual(result.profile.ingredients, empty.ingredients);
  assert.ok(result.profile.discoveredRecipes.includes('healing'));
});

test('brewLab without free still needs stock and still consumes it', () => {
  const empty = normalizeProfile({ version: 12 });
  assert.equal(brewLab(empty, healing.ingredients, healing.process).reason, 'missing-ingredient');
  const stocked = normalizeProfile({ version: 12, ingredients: { sunHerb: 2, waterCrystal: 1 } });
  const result = brewLab(stocked, healing.ingredients, healing.process);
  assert.equal(result.ok, true);
  assert.equal(result.profile.ingredients.sunHerb, 0);
  assert.equal(result.profile.ingredients.waterCrystal, 0);
});

test('runAlchemyCode passes free through', () => {
  const empty = normalizeProfile({ version: 12 });
  const result = runAlchemyCode(empty, recipeToAlchemyCode(recipeById('healing')), { free: true });
  assert.equal(result.ok, true);
  assert.equal(result.profile.potions.healing, 1);
  assert.equal(runAlchemyCode(empty, recipeToAlchemyCode(recipeById('healing'))).reason, 'missing-ingredient');
});

test('profiles carry a lab journal; old saves get an empty one', () => {
  const old = normalizeProfile({ version: 11, completed: ['q01'], ingredients: { sunHerb: 3 } });
  assert.deepEqual(old.lab, { found: [], seen: [] });
  assert.deepEqual(old.completed, ['q01']);
  assert.equal(old.ingredients.sunHerb, 3);
  const saved = normalizeProfile({ version: 12, lab: { found: ['glow', 'fizzle'], seen: ['moonflower'] } });
  assert.deepEqual(normalizeProfile(JSON.parse(JSON.stringify(saved))).lab, { found: ['glow', 'fizzle'], seen: ['moonflower'] });
});

test('normalizeLab drops unknown ids and duplicates and caps the lists', () => {
  assert.deepEqual(normalizeLab(null), { found: [], seen: [] });
  assert.deepEqual(normalizeLab({ found: ['glow', 'glow', 'nope', 7, '__proto__'], seen: ['frostDew', 'dragon', 'frostDew'] }), { found: ['glow'], seen: ['frostDew'] });
  assert.deepEqual(normalizeLab({ found: 'glow', seen: {} }), { found: [], seen: [] });
  assert.ok(Object.isFrozen(normalizeLab({ found: ['glow'] })));
  const many = normalizeLab({ found: Array(500).fill(0).map((_, i) => LAB_RULES[i % LAB_RULES.length].id) });
  assert.equal(many.found.length, LAB_RULES.length);
});

test('recordFound / recordSeen add once and return the same profile when nothing is new', () => {
  const base = normalizeProfile({ version: 12 });
  const one = recordFound(base, 'duplication');
  assert.deepEqual(one.lab.found, ['duplication']);
  assert.equal(recordFound(one, 'duplication'), one);
  assert.equal(recordFound(one, 'notARule'), one);
  const seen = recordSeen(one, ['echoCrystal', 'redMushroom', 'echoCrystal', 'bogus']);
  assert.deepEqual(seen.lab.seen, ['echoCrystal', 'redMushroom']);
  assert.deepEqual(seen.lab.found, ['duplication']);
  assert.equal(recordSeen(seen, ['redMushroom']), seen);
  assert.equal(seen.version, base.version);
});

/* ---------- slice 04: lab-screen state helpers (no DOM) ---------- */
import { createLabState, labAdd, labRemove, labStep, labUndo, labClear, labSelect, labBrew } from '../js/games/codequest/lab/lab-screen.js';
import { LAB, labMadeLine, labPagesLine } from '../js/games/codequest/strings.js';

const fill = (ids, steps = []) => steps.reduce(labStep, ids.reduce(labAdd, createLabState()));
const emptyProfile = () => normalizeProfile({ version: 12 });

test('lab screen: add / remove / caps, and the owl says the cauldron is full', () => {
  let s = fill(['echoCrystal', 'redMushroom', 'sunHerb', 'sunHerb']);
  assert.deepEqual([...s.mix], ['echoCrystal', 'redMushroom', 'sunHerb', 'sunHerb']);
  s = labAdd(s, 'moonflower');
  assert.equal(s.mix.length, 4);
  assert.equal(s.line, LAB.full);
  assert.deepEqual([...labRemove(s, 1).mix], ['echoCrystal', 'sunHerb', 'sunHerb']);
  assert.equal(labRemove(s, 9), s);
  assert.equal(labAdd(createLabState(), 'notAThing').mix.length, 0);
  let steps = ['grind', 'heat', 'stir', 'cool', 'stir'].reduce(labStep, createLabState());
  assert.equal(steps.steps.length, 5);
  steps = labStep(steps, 'heat');
  assert.equal(steps.steps.length, 5);
  assert.equal(steps.line, LAB.full);
  assert.equal(labStep(createLabState(), 'bottle').steps.length, 0);
  assert.deepEqual([...labUndo(steps).steps], ['grind', 'heat', 'stir', 'cool']);
  const cleared = labClear(fill(['sunHerb'], ['grind']));
  assert.equal(cleared.mix.length + cleared.steps.length, 0);
  assert.equal(cleared.effect, null);
});

test('lab screen: selecting lifts an item and adding puts it down', () => {
  let s = labSelect(createLabState(), 'jar:echoCrystal');
  assert.equal(s.selection, 'jar:echoCrystal');
  assert.equal(s.line, LAB.picked);
  s = labAdd(s, 'echoCrystal');
  assert.equal(s.selection, null);
  const withOne = labAdd(createLabState(), 'echoCrystal');
  assert.equal(labSelect(withOne, 'jar:redMushroom').line, LAB.welcome, 'the hint only shows before the first ingredient');
  assert.equal(labSelect(withOne, null).selection, null);
});

test('lab screen brew: empty cauldron asks for an ingredient and changes nothing', () => {
  const profile = emptyProfile();
  const out = labBrew(createLabState(), profile);
  assert.equal(out.changed, false);
  assert.equal(out.profile, profile);
  assert.equal(out.state.line, LAB.empty);
});

test('lab screen brew: Echo Crystal + Red Mushroom is duplication, a new Journal page, saved once', () => {
  const profile = emptyProfile();
  const out = labBrew(fill(['echoCrystal', 'redMushroom']), profile, { now: 5 });
  assert.equal(out.state.lastResult.ruleId, 'duplication');
  assert.equal(out.state.newPage, true);
  assert.equal(out.newRule, true);
  assert.equal(out.changed, true);
  assert.deepEqual([...out.profile.lab.found], ['duplication']);
  assert.deepEqual([...out.profile.lab.seen], ['echoCrystal', 'redMushroom']);
  assert.equal(out.state.effect.ruleId, 'duplication');
  assert.equal(out.state.effect.lastIngredient, 'redMushroom');
  assert.equal(out.state.line, LAB_RULES.find(rule => rule.id === 'duplication').line);
  assert.deepEqual([...out.state.mix], ['echoCrystal', 'redMushroom'], 'mix stays after Brew');
  const again = labBrew(labClear(out.state), out.profile);
  assert.equal(again.changed, false, 'nothing to save the second time');
  const repeat = labBrew(fill(['echoCrystal', 'redMushroom']), out.profile);
  assert.equal(repeat.changed, false);
  assert.equal(repeat.profile, out.profile);
  assert.equal(repeat.state.newPage, false);
  assert.equal(repeat.newRule, false);
});

test('lab screen brew: Healing recipe in order bottles a potion without using the bag (D5)', () => {
  const profile = emptyProfile();
  assert.equal(profile.ingredients.sunHerb, 0);
  const before = profile.potions.healing;
  const out = labBrew(fill(['sunHerb', 'sunHerb', 'waterCrystal'], ['grind', 'stir']), profile, { free: true });
  assert.equal(out.potionId, 'healing');
  assert.equal(out.changed, true);
  assert.equal(out.profile.potions.healing, before + 1);
  assert.deepEqual(out.profile.ingredients, profile.ingredients);
  assert.ok(out.profile.discoveredRecipes.includes('healing'));
  assert.equal(out.state.effect.ruleId, 'potion');
  assert.deepEqual(out.state.line, labMadeLine(RECIPES.find(recipe => recipe.id === 'healing').label));
});

test('lab screen brew: Healing mix in the wrong order is a reaction plus the order hint, no potion', () => {
  const profile = emptyProfile();
  const out = labBrew(fill(['sunHerb', 'sunHerb', 'waterCrystal'], ['stir', 'grind']), profile, { free: true });
  assert.equal(out.potionId, null);
  assert.equal(out.state.lastResult.kind, 'reaction');
  assert.equal(out.state.lastResult.hint, 'order');
  assert.equal(out.state.line, LAB.orderHint);
  assert.equal(out.profile.potions.healing, profile.potions.healing);
});

test('lab screen brew: with free off and an empty bag the recipe plays as a practice brew', () => {
  const profile = emptyProfile();
  const out = labBrew(fill(['sunHerb', 'sunHerb', 'waterCrystal'], ['grind', 'stir']), profile, { free: false });
  assert.equal(out.potionId, null);
  assert.equal(out.state.lastResult.kind, 'reaction');
  assert.equal(out.state.lastResult.practice, true);
  assert.equal(out.state.line, LAB.practice);
  assert.equal(out.profile.potions.healing, 0);
  // With stock it bottles and spends the bag, exactly as the Camp bench did.
  const stocked = normalizeProfile({ ...profile, ingredients: { sunHerb: 2, moonBerry: 0, waterCrystal: 1, emberRoot: 0 } });
  const paid = labBrew(fill(['sunHerb', 'sunHerb', 'waterCrystal'], ['grind', 'stir']), stocked, { free: false });
  assert.equal(paid.potionId, 'healing');
  assert.equal(paid.profile.ingredients.sunHerb, 0);
});

test('lab screen strings ship EN + 中文', () => {
  const pairs = [...Object.entries(LAB), ['made', labMadeLine(['Healing Potion', '治療藥水'])], ['pages', labPagesLine(1, 14)]];
  for (const [where, pair] of pairs) {
    assert.ok(Array.isArray(pair) && pair.length === 2, where);
    assert.ok(pair[0].trim() && pair[1].trim(), where + ' missing a language');
    assert.match(pair[1], /[一-鿿]/, where + ' has no 中文');
  }
});
