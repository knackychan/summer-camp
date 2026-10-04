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
  ['thermalShock', [{ id: 'frostDew', state: 'frozen' }, { id: 'emberSeed', state: 'heated' }]],
  ['temporalRupture', ['voidDust', 'starDust']],
  ['singularity', ['voidDust', 'emberSeed']],
  ['snowflakeCopies', [{ id: 'redMushroom', state: 'frozen' }, 'echoCrystal']],
  ['monstrosity', ['echoCrystal', 'lifeSap', 'redMushroom']],
  ['duplication', ['echoCrystal', 'redMushroom']],
  ['overgrowth', ['lifeSap', 'redMushroom', 'frostDew']],
  ['flamingVines', [{ id: 'redMushroom', state: 'heated' }]],
  ['fireball', ['emberSeed'], ['heat']],
  ['iceBurst', ['frostDew'], ['cool']],
  ['glitterStorm', [{ id: 'moonflower', state: 'crushed' }]],
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
    assert.equal(result.ruleId, id, JSON.stringify(mix) + ' should be ' + id + ', got ' + result.ruleId);
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
  assert.deepEqual(old.lab, { found: [], seen: [], states: [] });
  assert.deepEqual(old.completed, ['q01']);
  assert.equal(old.ingredients.sunHerb, 3);
  const saved = normalizeProfile({ version: 12, lab: { found: ['glow', 'fizzle'], seen: ['moonflower'] } });
  assert.deepEqual(normalizeProfile(JSON.parse(JSON.stringify(saved))).lab, { found: ['glow', 'fizzle'], seen: ['moonflower'], states: [] });
});

test('normalizeLab drops unknown ids and duplicates and caps the lists', () => {
  assert.deepEqual(normalizeLab(null), { found: [], seen: [], states: [] });
  assert.deepEqual(normalizeLab({ found: ['glow', 'glow', 'nope', 7, '__proto__'], seen: ['frostDew', 'dragon', 'frostDew'] }), { found: ['glow'], seen: ['frostDew'], states: [] });
  assert.deepEqual(normalizeLab({ found: 'glow', seen: {} }), { found: [], seen: [], states: [] });
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
import { LAB, LAB_STATE_NAMES, labFormName, labMadeLine, labPagesLine } from '../js/games/codequest/strings.js';

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
  assert.equal(s.line, LAB.pickToChange, 'the first lift says what the hand can do now');
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

/* ---------- slice 06: Journal page builders ---------- */
import { journalReactions, journalPotions, journalIngredients } from '../js/games/codequest/lab/journal.js';
import { labLoad } from '../js/games/codequest/lab/lab-screen.js';
import { LAB_PROPS, LAB_FAMILIES } from '../js/games/codequest/strings.js';

test('Journal reactions: counts match lab.found, unfound pages never leak label or line', () => {
  const book = journalReactions({ found: ['glow', 'duplication', 'fizzle'], seen: [] });
  assert.equal(book.found, 3);
  assert.equal(book.total, LAB_RULES.length);
  assert.equal(book.pages.length, LAB_RULES.length);
  assert.deepEqual(book.pages.filter(page => page.found).map(page => page.id), ['duplication', 'glow', 'fizzle']);
  const secrets = LAB_RULES.flatMap(rule => [rule.id, ...rule.label, ...rule.line]);
  for (const page of book.pages.filter(p => !p.found)) {
    assert.deepEqual(Object.keys(page).sort(), ['family', 'found', 'index']);
    const text = JSON.stringify(page);
    for (const secret of secrets) assert.ok(!text.includes(secret) || secret === page.family, 'unfound page leaks ' + secret);
    assert.ok(LAB_FAMILIES[page.family], page.family + ' has a family name');
  }
  const glow = book.pages.find(page => page.id === 'glow');
  assert.deepEqual(glow.label, LAB_RULES.find(rule => rule.id === 'glow').label);
  assert.deepEqual([...glow.formula], ['light', 'light']);
  for (const rule of LAB_RULES) {
    const page = journalReactions({ found: [rule.id] }).pages.find(p => p.found);
    for (const token of page.formula) {
      const ok = token.startsWith('ing:') ? LAB_INGREDIENTS[token.slice(4)] : token.startsWith('state:') ? ['crushed', 'heated', 'frozen'].includes(token.slice(6)) : LAB_PROPS[token];
      assert.ok(ok, rule.id + ' formula token ' + token);
    }
  }
  assert.equal(journalReactions(undefined).found, 0);
});

test('Journal potions: discovered recipes show ingredients and steps, the rest show nothing', () => {
  const pages = journalPotions({ discoveredRecipes: ['ward'] }, RECIPES);
  assert.equal(pages.length, 4);
  const ward = pages.find(page => page.found);
  assert.equal(ward.id, 'ward');
  assert.deepEqual([...ward.process], ['heat', 'stir', 'cool']);
  for (const page of pages.filter(p => !p.found)) assert.deepEqual(Object.keys(page).sort(), ['found', 'index']);
});

test('Journal ingredients: all twelve, property points hidden until seen', () => {
  const pages = journalIngredients({ seen: ['frostDew'] });
  assert.equal(pages.length, 12);
  for (const page of pages) {
    if (page.id === 'frostDew') assert.deepEqual(Object.fromEntries(page.props), { cold: 2, water: 2, calm: 1 });
    else { assert.equal(page.seen, false); assert.equal(page.props, null); }
  }
});

test('Journal "Put in cauldron" loads a recipe; Brew then makes that potion', () => {
  const ward = RECIPES.find(recipe => recipe.id === 'ward');
  const loaded = labLoad(fill(['voidDust'], ['grind']), ward.ingredients, ward.process);
  assert.deepEqual([...loaded.mix], [...ward.ingredients]);
  assert.deepEqual([...loaded.steps], [...ward.process]);
  assert.equal(loaded.line, LAB.ready);
  const out = labBrew(loaded, emptyProfile(), { free: true });
  assert.equal(out.potionId, 'ward');
});

test('Journal strings ship EN + 中文', () => {
  for (const [where, pair] of [...Object.entries(LAB_PROPS), ...Object.entries(LAB_FAMILIES)]) {
    assert.ok(pair[0].trim() && /[一-鿿]/.test(pair[1]), where);
  }
});

/* ---------- Phase 2 slice 01: ingredient states (docs/plans/2026-10-04-lab-states) ---------- */
import { LAB_STATES, STATE_TOOL, applyState } from '../js/games/codequest/lab/ingredients.js';
import { labEntries } from '../js/games/codequest/lab/resolve.js';

const st = (id, state) => ({ id, state });

test('states: the three tools map to crushed / heated / frozen and change points per design D3', () => {
  assert.deepEqual([...LAB_STATES], ['raw', 'crushed', 'heated', 'frozen']);
  assert.deepEqual({ ...STATE_TOOL }, { grind: 'crushed', heat: 'heated', cool: 'frozen' });
  const mushroom = LAB_INGREDIENTS.redMushroom.props; // life 1, growth 2, chaos 1
  assert.deepEqual({ ...applyState(mushroom, 'raw') }, { ...mushroom });
  assert.deepEqual({ ...applyState(mushroom, 'crushed') }, { life: 1, growth: 3, chaos: 2 });
  assert.deepEqual({ ...applyState(mushroom, 'heated') }, { life: 1, growth: 2, fire: 2, chaos: 2 });
  assert.deepEqual({ ...applyState(mushroom, 'frozen') }, { cold: 2, calm: 1, chaos: 1 });
  assert.deepEqual({ ...applyState(LAB_INGREDIENTS.frostDew.props, 'heated') }, { fire: 2, water: 1, calm: 1, chaos: 1 });
  for (const item of Object.values(LAB_INGREDIENTS)) for (const state of LAB_STATES) {
    for (const [prop, n] of Object.entries(applyState(item.props, state))) {
      assert.ok(LAB_PROPERTIES.includes(prop) && Number.isInteger(n) && n > 0, `${item.id} ${state} ${prop}=${n}`);
    }
  }
});

test('entries: bare ids are fresh, unknown states become fresh, junk is dropped, cap 4', () => {
  assert.deepEqual(labEntries(['sunHerb', st('voidDust', 'frozen'), st('lifeSap', 'melted'), st('nope', 'heated'), 7, null]),
    [st('sunHerb', 'raw'), st('voidDust', 'frozen'), st('lifeSap', 'raw')]);
  assert.equal(labEntries(Array(9).fill(st('moonflower', 'crushed'))).length, 4);
  assert.deepEqual(labEntries('sunHerb'), []);
});

test('the vision test: Frozen Mushroom + Echo Crystal is not Mushroom + Echo Crystal', () => {
  assert.equal(resolve(['redMushroom', 'echoCrystal']).ruleId, 'duplication');
  assert.equal(resolve([st('redMushroom', 'frozen'), 'echoCrystal']).ruleId, 'snowflakeCopies');
});

test('every state-only rule is reachable, and none fires without a changed ingredient', () => {
  const fixtures = {
    thermalShock: [st('frostDew', 'frozen'), st('emberSeed', 'heated')],
    snowflakeCopies: [st('redMushroom', 'frozen'), 'echoCrystal'],
    flamingVines: [st('redMushroom', 'heated')],
    glitterStorm: [st('moonflower', 'crushed')]
  };
  for (const [ruleId, mix] of Object.entries(fixtures)) assert.equal(resolve(mix).ruleId, ruleId, ruleId);
  assert.equal(resolve([st('starDust', 'crushed')]).ruleId, 'glitterStorm');
  // The same ingredients fresh land elsewhere.
  assert.notEqual(resolve(['frostDew', 'emberSeed']).ruleId, 'thermalShock');
  assert.notEqual(resolve(['redMushroom']).ruleId, 'flamingVines');
  assert.notEqual(resolve(['moonflower']).ruleId, 'glitterStorm');
  // Every one of the 18 rules still has a fixture that reaches it.
  const reached = new Set();
  const ids = Object.keys(LAB_INGREDIENTS);
  const forms = ids.flatMap(id => LAB_STATES.map(state => st(id, state)));
  for (const a of forms) {
    reached.add(resolve([a]).ruleId);
    for (const b of forms) reached.add(resolve([a, b]).ruleId);
  }
  // Phase 1's three- and four-ingredient and step fixtures, unchanged.
  for (const [, mix, steps] of FIXTURES) reached.add(resolve(mix, steps).ruleId);
  assert.equal(LAB_RULES.length, 18);
  assert.deepEqual(LAB_RULES.map(rule => rule.id).filter(id => !reached.has(id)), []);
});

test('potions need fresh ingredients: a changed one gives a reaction and the fresh hint', () => {
  const healing = RECIPES.find(recipe => recipe.id === 'healing');
  assert.equal(resolve(healing.ingredients, healing.process).kind, 'potion');
  const crushed = resolve([st('sunHerb', 'crushed'), 'sunHerb', 'waterCrystal'], healing.process);
  assert.equal(crushed.kind, 'reaction');
  assert.equal(crushed.hint, 'fresh');
  assert.equal(resolve([st('sunHerb', 'frozen'), 'sunHerb', 'waterCrystal'], ['stir', 'grind']).hint, 'fresh', 'fresh wins over order');
  assert.equal(resolve(['sunHerb', 'sunHerb', 'waterCrystal'], ['stir', 'grind']).hint, 'order');
  assert.equal(resolve([st('sunHerb', 'raw'), 'sunHerb', 'waterCrystal'], healing.process).kind, 'potion', 'an explicit raw state is fresh');
});

test('states: deterministic, and mixHint follows them', () => {
  const mix = [st('voidDust', 'heated'), st('starDust', 'crushed')];
  assert.deepEqual(resolve(mix, ['stir']), resolve(mix, ['stir']));
  assert.equal(mixHint([st('frostDew', 'frozen')], []).tint, 'cold');
  assert.equal(mixHint([st('frostDew', 'heated')], []).tint, 'fire');
});

/* ---------- Phase 2 slice 02: the Journal remembers forms ---------- */
import { recordStates } from '../js/games/codequest/lab/journal.js';

test('lab.states: known changed forms only, deduped, capped; Phase 1 saves get none', () => {
  assert.deepEqual([...normalizeLab({ states: ['redMushroom:frozen', 'redMushroom:frozen', 'redMushroom:raw', 'dragon:frozen', 'sunHerb:melted', 'sunHerb:heated:x', 7, 'lifeSap:crushed'] }).states],
    ['redMushroom:frozen', 'lifeSap:crushed']);
  const many = Object.keys(LAB_INGREDIENTS).flatMap(id => ['crushed', 'heated', 'frozen'].map(state => id + ':' + state));
  assert.equal(normalizeLab({ states: [...many, ...many, ...many, ...many] }).states.length, Math.min(128, many.length));
  // A Phase 1 save: everything else unchanged, states empty.
  const phase1 = normalizeProfile({ version: 12, completed: ['q01'], lab: { found: ['glow'], seen: ['moonflower'] } });
  assert.deepEqual(phase1.lab, { found: ['glow'], seen: ['moonflower'], states: [] });
  assert.deepEqual(phase1.completed, ['q01']);
  assert.equal(phase1.version, 12);
});

test('recordStates adds changed forms once; fresh entries and bare ids add nothing', () => {
  const base = emptyProfile();
  assert.equal(recordStates(base, ['redMushroom', { id: 'sunHerb', state: 'raw' }]), base);
  const one = recordStates(base, [{ id: 'redMushroom', state: 'frozen' }, 'echoCrystal', { id: 'moonflower', state: 'crushed' }]);
  assert.deepEqual([...one.lab.states], ['redMushroom:frozen', 'moonflower:crushed']);
  assert.equal(recordStates(one, [{ id: 'redMushroom', state: 'frozen' }]), one);
  // Other Journal lists survive.
  const full = recordStates(recordFound(recordSeen(base, [{ id: 'lifeSap', state: 'heated' }]), 'glow'), [{ id: 'lifeSap', state: 'heated' }]);
  assert.deepEqual(full.lab, { found: ['glow'], seen: ['lifeSap'], states: ['lifeSap:heated'] });
  assert.deepEqual(recordFound(full, 'smoke').lab.states, ['lifeSap:heated'], 'recordFound keeps forms');
});

test('Journal ingredient pages list discovered forms with their points', () => {
  const pages = journalIngredients({ seen: ['redMushroom'], states: ['redMushroom:frozen', 'redMushroom:crushed'] });
  const mushroom = pages.find(page => page.id === 'redMushroom');
  assert.deepEqual(mushroom.forms.map(form => form.state), ['crushed', 'frozen'], 'state order, not discovery order');
  assert.deepEqual(Object.fromEntries(mushroom.forms[1].props), { cold: 2, calm: 1, chaos: 1 });
  for (const page of pages.filter(p => p.id !== 'redMushroom')) assert.deepEqual([...page.forms], []);
  assert.equal(journalReactions({}).total, 18);
});

/* ---------- Phase 2 slice 03: pick it up, tap a tool ---------- */
import { labProcess } from '../js/games/codequest/lab/lab-screen.js';

const lift = (hitId, s = createLabState()) => labSelect(s, hitId);

test('lift + tool changes the lifted ingredient, which stays in hand; a new tool replaces the state', () => {
  let s = lift('jar:redMushroom');
  assert.equal(s.held, 'redMushroom');
  s = labProcess(s, 'cool');
  assert.equal(s.held, 'redMushroom:frozen');
  assert.equal(s.selection, 'jar:redMushroom', 'still lifted');
  assert.deepEqual(s.line, ['Frozen Red Mushroom!', '冰凍的紅蘑菇！']);
  assert.equal(s.steps.length, 0, 'not a cauldron step');
  s = labProcess(s, 'heat');
  assert.equal(s.held, 'redMushroom:heated');
  assert.equal(labProcess(lift('bag:sunHerb'), 'grind').held, 'sunHerb:crushed');
  // Pressing the lifted item again keeps its form in hand.
  assert.equal(labSelect(s, 'jar:redMushroom'), s);
  assert.equal(labSelect(s, 'jar:echoCrystal').held, 'echoCrystal', 'a different jar is fresh');
  assert.equal(labSelect(s, null).held, null);
});

test('the spoon with something lifted stirs the cauldron and keeps the lift; empty hands are Phase 1 steps', () => {
  const lifted = labProcess(lift('jar:moonflower'), 'grind');
  const stirred = labProcess(lifted, 'stir');
  assert.deepEqual([...stirred.steps], ['stir']);
  assert.equal(stirred.held, 'moonflower:crushed');
  const empty = labProcess(createLabState(), 'cool');
  assert.deepEqual([...empty.steps], ['cool']);
  assert.equal(empty.held, null);
});

test('dropping the held form into the cauldron keeps its state; brewing records it', () => {
  let s = labAdd(labProcess(lift('jar:redMushroom'), 'cool'), 'redMushroom:frozen');
  assert.deepEqual([...s.mix], ['redMushroom:frozen']);
  assert.equal(s.held, null);
  assert.equal(s.selection, null);
  s = labAdd(s, 'echoCrystal');
  const out = labBrew(s, emptyProfile());
  assert.equal(out.state.lastResult.ruleId, 'snowflakeCopies', 'the vision test, through the screen');
  assert.deepEqual([...out.profile.lab.states], ['redMushroom:frozen']);
  assert.deepEqual([...out.profile.lab.seen], ['redMushroom', 'echoCrystal']);
  assert.equal(out.state.effect.lastIngredient, 'echoCrystal');
  assert.equal(labBrew(labAdd(createLabState(), 'redMushroom:melted'), emptyProfile()).state.lastResult.ruleId,
    labBrew(labAdd(createLabState(), 'redMushroom'), emptyProfile()).state.lastResult.ruleId, 'unknown state = fresh');
});

test('a recipe with a changed ingredient: reaction, the fresh hint, and no potion', () => {
  const healing = RECIPES.find(recipe => recipe.id === 'healing');
  const s = ['grind', 'stir'].reduce(labStep, ['sunHerb:crushed', 'sunHerb', 'waterCrystal'].reduce(labAdd, createLabState()));
  const out = labBrew(s, emptyProfile(), { free: true });
  assert.equal(out.potionId, null);
  assert.equal(out.state.lastResult.hint, 'fresh');
  assert.equal(out.state.line, LAB.freshHint);
  assert.equal(out.profile.potions.healing, 0);
  assert.equal(labBrew(['grind', 'stir'].reduce(labStep, healing.ingredients.reduce(labAdd, createLabState())), emptyProfile(), { free: true }).potionId, 'healing');
});

test('state names ship EN + 中文', () => {
  for (const [state, pair] of Object.entries(LAB_STATE_NAMES)) assert.ok(pair[0] && /[一-鿿]/.test(pair[1]), state);
  for (const key of ['freshHint', 'pickToChange']) assert.ok(LAB[key][0] && /[一-鿿]/.test(LAB[key][1]), key);
  assert.deepEqual(labFormName(['Moon Berry', '月光莓'], 'heated'), ['Heated Moon Berry', '加熱過的月光莓']);
  assert.deepEqual(labFormName(['Moon Berry', '月光莓'], 'raw'), ['Moon Berry', '月光莓']);
});

/* ---------- Phase 2 slice 05: Journal forms ---------- */
test('the four state rules show their changed ingredient in the formula', () => {
  const book = journalReactions({ found: ['thermalShock', 'snowflakeCopies', 'flamingVines', 'glitterStorm'] });
  const formula = id => [...book.pages.find(page => page.id === id).formula];
  assert.deepEqual(formula('thermalShock'), ['state:frozen', 'state:heated']);
  assert.deepEqual(formula('snowflakeCopies'), ['state:frozen', 'echo']);
  assert.ok(formula('flamingVines').includes('state:heated') && formula('glitterStorm').includes('state:crushed'));
  assert.equal(book.found, 4);
  assert.equal(book.total, 18);
});
