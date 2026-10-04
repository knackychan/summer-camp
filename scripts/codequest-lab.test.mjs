import test from 'node:test';
import assert from 'node:assert/strict';
import { LAB_PROPERTIES, LAB_INGREDIENTS, SHELF_IDS, BAG_IDS, LAB_FREE_INGREDIENTS } from '../js/games/codequest/lab/ingredients.js';
import { LAB_RULES } from '../js/games/codequest/lab/rules.js';
import { sumExperiment, resolveExperiment, mixHint } from '../js/games/codequest/lab/resolve.js';
import { RECIPES, CODEQUEST_INGREDIENTS } from '../js/games/codequest/progression.js';

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
