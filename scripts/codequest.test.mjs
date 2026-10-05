import assert from 'node:assert/strict';
import { action as A, targetNode as T, repeat as R, ifNode as IF, call as CALL, letNode as LET, returnNode as RET, signalNode as SIG, stateNode as STATE, literal as L, propertyRef as P, variableRef as V, binary as B, normalizeProgram, programBlockCount, combinedBlockCount, toJavaScript } from '../js/games/codequest/ast.js';
import { ProgramRunner, runToActions } from '../js/games/codequest/interpreter.js';
import { CodeQuestModel, solveLevel } from '../js/games/codequest/model.js';
import { LEVELS, generateEndless } from '../js/games/codequest/levels.js';
import { normalizeProfile, recordLevelComplete, recordEndlessClear, brew, brewLab, equip, claimLoot, equipmentFor, weaponFor, combatStatsFor, consumePotion, scoreForProfile, modeFor, setActiveDungeonRun, finishDungeonRun, abandonDungeonRun, saveRuneLibrary, loadRuneLibrary, saveBehaviorSource, setBehaviorEnabled, behaviorFor } from '../js/games/codequest/progression.js';
import { createDungeonRun, normalizeDungeonRun, roomMeta, roomGraph, nextRooms, enterDungeonRoom, resolveRunChoice, completeCombatRoom, failDungeonRun, expeditionLevel, dungeonRunSummary, hazardInfo, sigilsRequired, saveRunLoadout, activateRunLoadout } from '../js/games/codequest/run.js';
import { parseJavaScript } from '../js/games/codequest/parser.js';
import { previewPath } from '../js/games/codequest/preview.js';
import { legacyLevel } from './fixtures/codequest-legacy-rooms.mjs';
import { parseAlchemyCode, runAlchemyCode, recipeToAlchemyCode, recipeById } from '../js/games/codequest/alchemy-code.js';

// AST sanitation is bounded, immutable and preserves real structure.
const program = normalizeProgram([A('move'), R(3, [A('attack')]), IF('hpLow', [A('usePotion')]), CALL('rune')]);
assert.equal(programBlockCount(program), 6);
assert.throws(() => program.push(A('move')), TypeError);
assert.equal(combinedBlockCount(program, { rune: [R(2, [A('move')])] }), 8);
assert.match(toJavaScript(program, { rune: [A('move')] }), /function rune\(\)/);
assert.match(toJavaScript(program, { rune: [A('move')] }), /repeat\(3/);
assert.equal(normalizeProgram([{ type: 'action', op: 'network' }, { type: 'repeat', times: 999, body: [A('move')] }])[0].times, 12);

// Interpreter resolves loops, live conditions and function calls without eval.
assert.deepEqual(runToActions([R(3, [A('move')])], {}, { test: () => false }).actions, ['move', 'move', 'move']);
let low = true;
const conditional = new ProgramRunner([IF('hpLow', [A('usePotion')], [A('attack')]), IF('hpLow', [A('wait')], [A('attack')])]);
let event = conditional.step({ test: name => name === 'hpLow' && low });
assert.equal(event.op, 'usePotion'); low = false;
event = conditional.step({ test: name => name === 'hpLow' && low });
assert.equal(event.op, 'attack');
assert.equal(conditional.step({ test: () => false }).type, 'done');
assert.deepEqual(runToActions([CALL('rune'), CALL('rune')], { rune: [A('move'), A('attack')] }, { test: () => false }).actions, ['move', 'attack', 'move', 'attack']);
assert.equal(runToActions([CALL('rune')], { rune: [CALL('rune')] }, { test: () => false }).error, 'recursive-call');

// Basic room semantics: movement, turning, blocking, combat and chest opening.
const q03 = legacyLevel('q03');
const room = new CodeQuestModel(q03, { weaponDamage: 1 });
assert.equal(room.begin([A('move'), A('move'), A('open')]).ok, true);
assert.equal(room.step().result, 'ok');
assert.equal(room.step().result, 'ok');
assert.equal(room.step().result, 'opened');
assert.equal(room.phase, 'won');
assert.equal(room.snapshot().chests[0].open, true);

const wallRoom = new CodeQuestModel(legacyLevel('q02'));
assert.equal(wallRoom.begin([A('move'), A('move'), A('move')]).ok, true);
assert.equal(wallRoom.step().result, 'ok');
assert.equal(wallRoom.step().result, 'ok');
assert.equal(wallRoom.step().result, 'blocked');
assert.equal(wallRoom.snapshot().stats.blocked, 1);

const combat = new CodeQuestModel(legacyLevel('q08'), { weaponDamage: 1 });
assert.equal(combat.begin([R(2, [A('attack')]), A('move'), A('open')]).ok, true);
while (combat.phase === 'executing') combat.step();
assert.equal(combat.phase, 'won');
assert.equal(combat.snapshot().enemies[0].hp, 0);
assert.equal(combat.snapshot().chests[0].open, true);


// Dungeon-crawler semantics: keys, locked doors and traps are deterministic model state.
const keyCrypt = new CodeQuestModel(legacyLevel('q13'));
assert.equal(keyCrypt.snapshot().hero.keys, 0);
assert.equal(keyCrypt.begin([A('move'), A('open'), A('move'), R(4, [A('move')])]).ok, true);
let keyEvent = keyCrypt.step();
assert.equal(keyEvent.result, 'key-collected');
assert.equal(keyCrypt.snapshot().hero.keys, 1);
let doorEvent = keyCrypt.step();
assert.equal(doorEvent.result, 'door-opened');
assert.equal(keyCrypt.snapshot().hero.keys, 0);
while (keyCrypt.phase === 'executing') keyCrypt.step();
assert.equal(keyCrypt.phase, 'won');
assert.equal(keyCrypt.snapshot().doors[0].open, true);

const trapRoom = new CodeQuestModel(legacyLevel('q14'));
assert.equal(trapRoom.test('trapAhead'), false);
assert.equal(trapRoom.begin([A('move'), IF('trapAhead', [A('disarm')]), R(5, [A('move')])]).ok, true);
assert.equal(trapRoom.step().result, 'ok');
assert.equal(trapRoom.test('trapAhead'), true);
assert.equal(trapRoom.step().result, 'disarmed');
while (trapRoom.phase === 'executing') trapRoom.step();
assert.equal(trapRoom.phase, 'won');
assert.equal(trapRoom.snapshot().traps[0].disarmed, true);
assert.equal(trapRoom.snapshot().hero.hp, 5);

const trapHit = new CodeQuestModel(legacyLevel('q14'));
assert.equal(trapHit.begin([A('move'), A('move')]).reason, 'missing-concept');


// v0.10 physical dungeon systems are model state, not renderer decoration.
const leverLevel = legacyLevel('q43');
const leverRoom = new CodeQuestModel(leverLevel);
assert.equal(leverRoom.snapshot().runeGates[0].open, false);
assert.equal(leverRoom.begin(leverLevel.reference.main, leverLevel.reference.functions).ok, true);
assert.equal(leverRoom.step().result, 'ok');
assert.equal(leverRoom.test('leverAhead'), true);
const leverEvent = leverRoom.step();
assert.equal(leverEvent.result, 'lever-activated');
assert.equal(leverRoom.snapshot().levers[0].active, true);
assert.equal(leverRoom.snapshot().runeGates[0].open, true);
while (leverRoom.phase === 'executing') leverRoom.step();
assert.equal(leverRoom.phase, 'won');
assert.equal(leverRoom.snapshot().exit.kind, 'stairs');

const plateLevel = legacyLevel('q44');
const plateRoom = new CodeQuestModel(plateLevel);
assert.equal(plateRoom.begin(plateLevel.reference.main, plateLevel.reference.functions).ok, true);
assert.equal(plateRoom.step().result, 'ok');
assert.equal(plateRoom.step().result, 'plate-activated');
assert.equal(plateRoom.read('hero.world.switchesActive'), 1);
assert.equal(plateRoom.read('hero.world.gatesOpen'), 1);

const crateLevel = legacyLevel('q45');
const crateRoom = new CodeQuestModel(crateLevel);
assert.equal(crateRoom.begin(crateLevel.reference.main, crateLevel.reference.functions).ok, true);
assert.equal(crateRoom.step().result, 'ok');
assert.equal(crateRoom.test('breakableAhead'), true);
assert.equal(crateRoom.step().result, 'crate-broken');
assert.equal(crateRoom.read('hero.world.cratesRemaining'), 0);

const npcLevel = legacyLevel('q46');
const npcRoom = new CodeQuestModel(npcLevel);
assert.equal(npcRoom.begin(npcLevel.reference.main, npcLevel.reference.functions).ok, true);
assert.equal(npcRoom.step().result, 'ok');
assert.equal(npcRoom.step().result, 'npc-helped');
assert.equal(npcRoom.snapshot().hero.keys, 1);
assert.equal(npcRoom.read('hero.world.npcsHelped'), 1);

const guardianLevel = legacyLevel('q48');
const guardianRoom = new CodeQuestModel(guardianLevel);
assert.equal(guardianRoom.snapshot().enemies.find(e => e.type === 'circuitGuardian').armor, 2);
assert.equal(guardianRoom.begin(guardianLevel.reference.main, guardianLevel.reference.functions).ok, true);
for (let i = 0; i < 5; i++) guardianRoom.step(); // move, interact, then 3 repeated moves onto the plate
assert.equal(guardianRoom.read('hero.world.switchesActive'), 2);
assert.equal(guardianRoom.snapshot().runeGates[0].open, true);
assert.equal(guardianRoom.snapshot().enemies.find(e => e.type === 'circuitGuardian').armor, 0);

// v0.11 environmental logic: circuits can close again, mechanisms advance with turns, and companion state is programmable.
const booleanLevel = legacyLevel('q49');
const booleanRoom = new CodeQuestModel({ ...booleanLevel, requires:[], maxBlocks:96 });
assert.equal(booleanRoom.begin([A('move'),A('interact'),A('move'),A('interact')]).ok, true);
while (booleanRoom.phase === 'executing') booleanRoom.step();
assert.equal(booleanRoom.read('hero.world.switchesActive'), 2);
assert.equal(booleanRoom.snapshot().runeGates[0].open, true);
assert.equal(booleanRoom.begin([A('move'),A('move'),A('interact')]).ok, true);
while (booleanRoom.phase === 'executing') booleanRoom.step();
assert.equal(booleanRoom.read('hero.world.switchesActive'), 3);
assert.equal(booleanRoom.snapshot().runeGates[0].open, false);
assert.equal(booleanRoom.begin([A('interact')]).ok, true);
while (booleanRoom.phase === 'executing') booleanRoom.step();
assert.equal(booleanRoom.read('hero.world.switchesActive'), 2);
assert.equal(booleanRoom.snapshot().runeGates[0].open, true);

const clockSolved = solveLevel(legacyLevel('q50'));
assert.equal(clockSolved.solved, true);
assert.equal(clockSolved.model.snapshot().hero.hp, 5);
assert.equal(clockSolved.model.snapshot().stats.cycleTrapHits, 0);

const pushSolved = solveLevel(legacyLevel('q51'));
assert.equal(pushSolved.solved, true);
assert.equal(pushSolved.model.snapshot().stats.pushes, 1);
assert.equal(pushSolved.model.snapshot().pushBlocks.every(block => pushSolved.model.snapshot().plates.some(plate => plate.x === block.x && plate.y === block.y)), true);

const platformSolved = solveLevel(legacyLevel('q52'));
assert.equal(platformSolved.solved, true);
assert.ok(platformSolved.model.snapshot().stats.platformMoves > 0);

const questSolved = solveLevel(legacyLevel('q53'));
assert.equal(questSolved.solved, true);
assert.equal(questSolved.model.snapshot().stats.questsStarted, 1);
assert.equal(questSolved.model.snapshot().stats.questsCompleted, 1);
assert.equal(questSolved.model.snapshot().questTokens.every(token => token.collected), true);

const companionSolved = solveLevel(legacyLevel('q54'));
assert.equal(companionSolved.solved, true);
assert.equal(companionSolved.model.snapshot().stats.companionAssists, 1);
assert.ok(companionSolved.model.snapshot().companion);

// World turn is deterministic and only occurs after the child's whole program.
// (The pure model accepts any known AST action; the level UI decides which cards are offered.)
const world = new CodeQuestModel(legacyLevel('q04'));
const hp = world.snapshot().hero.hp;
assert.equal(world.begin([A('wait')]).ok, true);
assert.equal(world.step().type, 'action');
const turn = world.step();
assert.equal(turn.type, 'world-turn');
assert.equal(world.snapshot().hero.hp, hp);
assert.equal(world.snapshot().enemies[0].x, 2); // slime moved one tile toward the hero.

// Pedagogical requirements reject bypass programs but accept the intended concept.
const loopLevel = legacyLevel('q05');
assert.equal(new CodeQuestModel(loopLevel).begin([A('move')]).reason, 'missing-concept');
assert.equal(new CodeQuestModel(loopLevel).begin([R(5, [A('move')])]).ok, true);
const ifLevel = legacyLevel('q07');
assert.equal(new CodeQuestModel(ifLevel).begin([A('attack'), R(3, [A('move')])]).reason, 'missing-concept');
assert.equal(new CodeQuestModel(ifLevel).begin(ifLevel.reference.main).ok, true);
const fnLevel = legacyLevel('q10');
assert.equal(new CodeQuestModel(fnLevel).begin([R(2, [A('move')]), A('turnRight'), R(2, [A('move')])]).reason, 'missing-concept');
assert.equal(new CodeQuestModel(fnLevel).begin([A('move'), A('move'), A('move'), A('move'), A('move'), A('move'), A('move')]).reason, 'too-many-blocks');
assert.equal(new CodeQuestModel(fnLevel).begin(fnLevel.reference.main, fnLevel.reference.functions).ok, true);

// Every authored quest has a verified reference solution and exact par block count.
for (const level of LEVELS) {
  assert.equal(combinedBlockCount(level.reference.main, level.reference.functions), level.parBlocks, level.id + ' par mismatch');
  const solved = solveLevel(level, { weaponDamage: 1 });
  assert.equal(solved.solved, true, level.id + ' reference failed: ' + solved.reason);
  assert.equal(solved.model.snapshot().objectiveComplete, true, level.id + ' objective not complete');
}

// Endless floors are deterministic, bounded and solver-verified across a broad sample.
for (let floor = 1; floor <= 1536; floor++) {
  const a = generateEndless(floor), b = generateEndless(floor);
  assert.deepEqual(a.map, b.map);
  assert.equal(a.id, b.id);
  assert.equal(combinedBlockCount(a.reference.main, a.reference.functions), a.parBlocks, a.id + ' par mismatch');
  const solved = solveLevel(a, { weaponDamage: 1 });
  assert.equal(solved.solved, true, a.id + ' unsolved');
}

// v0.4 written-code bridge: generated code round-trips back to the same executable AST.
for (const level of LEVELS) {
  const source = toJavaScript(level.reference.main, level.reference.functions);
  const parsed = parseJavaScript(source);
  assert.equal(parsed.ok, true, level.id + ' generated JavaScript did not parse: ' + (parsed.error && parsed.error.message));
  assert.equal(toJavaScript(parsed.program, parsed.functions), source, level.id + ' code round-trip changed semantics');
  const fromCode = { ...level, reference: { main: parsed.program, functions: parsed.functions } };
  assert.equal(solveLevel(fromCode, { weaponDamage: 1 }).solved, true, level.id + ' parsed code did not solve');
}
for (let floor = 1; floor <= 1536; floor++) {
  const level = generateEndless(floor), source = toJavaScript(level.reference.main, level.reference.functions), parsed = parseJavaScript(source);
  assert.equal(parsed.ok, true, level.id + ' code parse failed');
  const fromCode = { ...level, reference: { main: parsed.program, functions: parsed.functions } };
  assert.equal(solveLevel(fromCode, { weaponDamage: 1 }).solved, true, level.id + ' parsed tower code did not solve');
}

// The parser accepts the teaching subset and rejects capabilities outside it with bounded source locations.
const written = parseJavaScript(`
function strike() {
  repeat(2, () => {
    hero.attack();
  });
}

if (hero.seesEnemyAhead()) {
  strike();
} else {
  hero.move();
}
`);
assert.equal(written.ok, true);
assert.equal(written.functions.strike.length, 1);
assert.equal(written.program[0].type, 'if');
assert.equal(written.program[0].else.length, 1);
for (const unsafe of [
  'while (true) { hero.move(); }',
  'hero.attack(enemy);',
  'fetch();',
  'hero.hp = 99;',
  'function x(a,b,c,d) { hero.move(); }',
  'if (Math.random()) { hero.move(); }',
  'hero["move"]();'
]) {
  const parsed = parseJavaScript(unsafe);
  assert.equal(parsed.ok, false, 'unsafe source unexpectedly parsed: ' + unsafe);
  assert.equal(Number.isInteger(parsed.error.line), true);
  assert.equal(Number.isInteger(parsed.error.column), true);
}
assert.equal(parseJavaScript('function strike() { hero.attack(); }\nstrike();').ok, true);
assert.equal(parseJavaScript('function walk(steps) { repeat(steps, () => { hero.move(); }); return steps; }\nlet moved = walk(3);\nif (moved >= 3) { hero.open(); }').ok, true);
assert.equal(parseJavaScript('missing();').ok, false);
assert.equal(parseJavaScript('repeat(13, () => { hero.move(); });').ok, false);

const elseLevel = legacyLevel('q22');
assert.equal(new CodeQuestModel(elseLevel).begin([IF('enemyAhead', [A('attack')])]).reason, 'missing-concept');
assert.equal(new CodeQuestModel(elseLevel).begin(elseLevel.reference.main).ok, true);

// Saved progression sanitizes unknown fields and grants first-clear loot once.
const dirty = JSON.parse('{"version":1,"completed":["q01","q01","hack"],"ingredients":{"sunHerb":3.8,"__proto__":99},"potions":{"healing":2},"equipment":["trainingBlade","nope"],"equipped":"nope","endlessBest":-2,"lootFound":9999999999}');
const clean = normalizeProfile(dirty);
assert.deepEqual(clean.completed, ['q01']);
assert.equal(clean.ingredients.sunHerb, 3);
assert.equal(Object.hasOwn(clean.ingredients, '__proto__'), false);
assert.deepEqual(clean.equipment, ['trainingBlade']);
assert.equal(clean.equipped, 'trainingBlade');
assert.equal(clean.endlessBest, 0);
assert.equal(clean.lootFound, 1000000);
assert.throws(() => clean.completed.push('q02'), TypeError);

let profile = normalizeProfile();
const first = recordLevelComplete(profile, LEVELS[0], 3); profile = first.profile;
assert.equal(first.firstClear, true);
assert.equal(profile.completed.includes('q01'), true);
assert.equal(profile.ingredients.sunHerb, 1);
const replay = recordLevelComplete(profile, LEVELS[0], 2);
assert.equal(replay.firstClear, false);
assert.equal(replay.profile.ingredients.sunHerb, 1);
assert.equal(replay.improved, true);
assert.equal(replay.profile.bestBlocks.q01, 2);

// Equipment and potion bench are persistent RPG systems, with no ingredient loss on bad recipes.
profile = recordLevelComplete(profile, LEVELS[1], 5).profile;
profile = recordLevelComplete(profile, LEVELS[2], 3).profile; // healing recipe becomes discoverable; enough sun herb + water.
assert.equal(profile.discoveredRecipes.includes('healing'), true);
const beforeBad = profile;
const bad = brew(profile, ['sunHerb', 'waterCrystal', 'waterCrystal']);
assert.equal(bad.ok, false);
assert.deepEqual(bad.profile, beforeBad);
const brewed = brew(profile, ['sunHerb', 'sunHerb', 'waterCrystal']);
assert.equal(brewed.ok, true);
assert.equal(brewed.profile.potions.healing, 1);
assert.equal(brewed.profile.ingredients.sunHerb, profile.ingredients.sunHerb - 2);
profile = recordLevelComplete(brewed.profile, LEVELS[3], 2).profile;
profile = recordLevelComplete(profile, LEVELS[4], 2).profile;
profile = recordLevelComplete(profile, LEVELS[5], 3).profile;
profile = recordLevelComplete(profile, LEVELS[6], 4).profile;
profile = recordLevelComplete(profile, LEVELS[7], 4).profile;
assert.equal(profile.equipment.includes('bronzeBlade'), true);
profile = equip(profile, 'bronzeBlade');
assert.equal(weaponFor(profile).damage, 2);
assert.equal(equip(profile, 'not-real').equipped, 'bronzeBlade');

const endless = recordEndlessClear(profile, 7, generateEndless(7).reward);
assert.equal(endless.profile.endlessBest, 7);
assert.ok(scoreForProfile(endless.profile) > scoreForProfile(normalizeProfile()));


// v0.3 combat state: armor requires the right action rather than more HP.
const armorLevel = { ...legacyLevel('q16'), requires: [], maxBlocks: 96 };
const armorNormal = new CodeQuestModel(armorLevel, { weaponDamage: 1 });
assert.equal(armorNormal.begin([A('attack')]).ok, true);
assert.equal(armorNormal.step().result, 'armored');
assert.equal(armorNormal.snapshot().enemies[0].hp, 3);
const armorHeavy = new CodeQuestModel(armorLevel, { weaponDamage: 1 });
assert.equal(armorHeavy.begin([A('heavyAttack')]).ok, true);
const heavy = armorHeavy.step();
assert.equal(heavy.result, 'hit');
assert.equal(heavy.detail.damage, 2);
assert.equal(armorHeavy.snapshot().enemies[0].hp, 1);
assert.equal(armorHeavy.test('enemyArmoredAhead'), true);
assert.equal(armorHeavy.test('enemyWeakAhead'), true);
assert.match(toJavaScript([IF('enemyArmoredAhead', [A('heavyAttack')])]), /seesArmoredEnemyAhead/);

// Archer intent is telegraphed on one dungeon turn and reactable on the next.
const signal = new CodeQuestModel(legacyLevel('q18'), { weaponDamage: 1 });
assert.equal(signal.begin(signal.level.reference.main).ok, true);
assert.equal(signal.step().op, 'move');
let signalWorld = signal.step();
assert.equal(signalWorld.type, 'world-turn');
assert.equal(signalWorld.events.some(item => item.type === 'enemy-intent' && item.intent === 'shot'), true);
assert.equal(signal.test('dangerIncoming'), true);
assert.equal(signal.begin(signal.level.reference.main).ok, true);
assert.equal(signal.step().op, 'guard');
assert.equal(signal.step().op, 'move');
signalWorld = signal.step();
assert.equal(signalWorld.events.some(item => item.type === 'enemy-shot'), true);
assert.equal(signalWorld.events.find(item => item.type === 'enemy-shot').damage, 0);
assert.equal(signal.snapshot().hero.hp, 5);
assert.equal(signal.snapshot().stats.damageBlocked > 0, true);

// Venom creates status state after the dungeon turn; antidote clears it deterministically.
const patrolLevel = { ...legacyLevel('q19'), requires: [], maxBlocks: 96 };
const venom = new CodeQuestModel(patrolLevel, { weaponDamage: 1, consumables: { antidote: 1 } });
assert.equal(venom.begin([A('move')]).ok, true);
venom.step(); venom.step(); // viper moves adjacent.
assert.equal(venom.begin([A('wait')]).ok, true);
venom.step(); const venomWorld = venom.step();
assert.equal(venomWorld.events.some(item => item.type === 'status-applied' && item.status === 'poison'), true);
assert.equal(venom.test('heroPoisoned'), true);
assert.equal(venom.begin([A('useAntidote')]).ok, true);
assert.equal(venom.step().result, 'cured');
assert.equal(venom.test('heroPoisoned'), false);

// v1 saves migrate to v2 loadout without losing the old equipped weapon.
const oldSave = normalizeProfile({ version: 1, equipment: ['trainingBlade','bronzeBlade'], equipped: 'bronzeBlade', potions: { healing: 2 }, ingredients: {} });
assert.equal(oldSave.version, 12);
assert.equal(oldSave.loadout.weapon, 'bronzeBlade');
assert.equal(oldSave.equipped, 'bronzeBlade');
assert.equal(oldSave.potions.antidote, 0);

// Equipment is slot-based, and combat stats aggregate weapon/armor/charm effects.
let geared = normalizeProfile({ version: 2, equipment: ['trainingBlade','bronzeBlade','guardCape','signalCharm'], loadout: { weapon: 'trainingBlade' } });
geared = equip(geared, 'bronzeBlade'); geared = equip(geared, 'guardCape'); geared = equip(geared, 'signalCharm');
assert.deepEqual(geared.loadout, { weapon: 'bronzeBlade', armor: 'guardCape', charm: 'signalCharm' });
assert.equal(combatStatsFor(geared).weaponDamage, 2);
assert.equal(combatStatsFor(geared).defense, 2); // Guard Cape + Signal Charm activate the Aegis two-piece circuit.
assert.equal(combatStatsFor(geared).wardBonus, 1);

// The v0.3 alchemy lab validates both ingredients and ordered process without consuming failed attempts.
const labProfile = normalizeProfile({ version: 2, ingredients: { sunHerb: 4, waterCrystal: 3, moonBerry: 3, emberRoot: 3 }, potions: {} });
const wrongProcess = brewLab(labProfile, ['sunHerb','sunHerb','waterCrystal'], ['stir','grind']);
assert.equal(wrongProcess.ok, false);
assert.equal(wrongProcess.reason, 'wrong-process');
assert.deepEqual(wrongProcess.profile.ingredients, labProfile.ingredients);
const labHealing = brewLab(labProfile, ['sunHerb','sunHerb','waterCrystal'], ['grind','stir']);
assert.equal(labHealing.ok, true);
assert.equal(labHealing.profile.potions.healing, 1);
const labAntidote = brewLab(labHealing.profile, ['moonBerry','moonBerry','emberRoot'], ['grind','heat','stir']);
assert.equal(labAntidote.ok, true);
assert.equal(labAntidote.profile.potions.antidote, 1);
const spentAntidote = consumePotion(labAntidote.profile, 'antidote');
assert.equal(spentAntidote.potions.antidote, 0);

// Practice consumables are consumed before persistent inventory consumables.
const practiceCure = new CodeQuestModel(legacyLevel('q17'), { weaponDamage: 1, consumables: { antidote: 1 } });
assert.equal(practiceCure.begin([IF('heroPoisoned', [A('useAntidote')]), R(2, [A('attack')])]).ok, true);
const cureEvent = practiceCure.step();
assert.equal(cureEvent.result, 'cured');
assert.equal(cureEvent.detail.source, 'practice');
assert.equal(practiceCure.snapshot().hero.consumables.antidote, 1);

// New authored strategy quests deliberately depend on changing state across turns.
for (const id of ['q16','q17','q18','q19','q20']) {
  const level = LEVELS.find(item => item.id === id);
  const result = solveLevel(level, { weaponDamage: 1 });
  assert.equal(result.solved, true, id + ' multi-turn strategy failed');
}

// v0.10 written code can inspect and operate physical dungeon mechanisms through the same safe AST.
const physicalCode = parseJavaScript(`
if (hero.seesLeverAhead()) { hero.interact(); }
if (hero.seesBreakableAhead()) { hero.smash(); }
let switches = hero.world.switchesActive;
if (switches >= hero.world.switchesRequired) { hero.move(); }
`);
assert.equal(physicalCode.ok, true);
assert.deepEqual(runToActions(physicalCode.program, physicalCode.functions, {
  test: name => name === 'leverAhead' || name === 'breakableAhead',
  read: path => ({ 'hero.world.switchesActive':2, 'hero.world.switchesRequired':2 }[path] || 0)
}).actions, ['interact','smash','move']);
assert.equal(parseJavaScript('hero.world.switchesActive = 99;').ok, false);

const companionCode = parseJavaScript(`
companion.follow();
if (hero.isCompanionNear()) { companion.guard(); }
companion.assist();
let distance = companion.distance;
`);
assert.equal(companionCode.ok, true);
assert.deepEqual(runToActions(companionCode.program, companionCode.functions, {
  test:name => name === 'companionNear', read:path => path === 'companion.distance' ? 1 : 0
}).actions, ['companionFollow','companionGuard','companionAssist']);
assert.equal(parseJavaScript('companion.distance = 0;').ok, false);

// v0.5 advanced interpreter: parameters, returned values, expression-driven repeat and safe RPG properties.
const advancedParsed = parseJavaScript(`
function strike(times) {
  repeat(times, () => {
    if (enemy.armor > 0) {
      hero.heavyAttack();
    } else {
      hero.attack();
    }
  });
  return times;
}
let attacks = 2;
let used = strike(attacks);
if (used === 2 && hero.weapon.damage >= 1) {
  hero.move();
}
`);
assert.equal(advancedParsed.ok, true);
const advancedRun = runToActions(advancedParsed.program, advancedParsed.functions, {
  test: () => false,
  read: path => ({ 'enemy.armor': 1, 'hero.weapon.damage': 1 }[path] || 0)
});
assert.deepEqual(advancedRun.actions, ['heavyAttack','heavyAttack','move']);
assert.equal(advancedRun.snapshot.variables.attacks, 2);
assert.equal(advancedRun.snapshot.variables.used, 2);
assert.equal(parseJavaScript('let x = window.location;').ok, false);
assert.equal(parseJavaScript('let x = enemy["hp"];').ok, false);
assert.equal(parseJavaScript('let x = 1; x = 2;').ok, false);
assert.equal(parseJavaScript('function f(a) { return a; }\nlet x = f();').ok, false);
assert.equal(parseJavaScript('return 3;').ok, false);

// The advanced authored region is solver-verified and requires the intended concepts.
for (const id of ['q25','q26','q27','q28','q29','q30']) {
  const level = LEVELS.find(item => item.id === id);
  assert.equal(solveLevel(level, { weaponDamage: 1 }).solved, true, id + ' advanced-code quest failed');
}
const q26 = LEVELS.find(item => item.id === 'q26');
assert.equal(new CodeQuestModel(q26).begin([R(3,[A('move')]),A('open')]).reason, 'missing-concept');
const q28 = LEVELS.find(item => item.id === 'q28');
assert.equal(new CodeQuestModel(q28).begin([A('move'),R(2,[A('attack')]),R(5,[A('move')])]).reason, 'missing-concept');

// The potion bench has a second, code-driven surface over the same pure recipe model.
const healingRecipe = recipeById('healing');
const healingSource = recipeToAlchemyCode(healingRecipe);
assert.match(healingSource, /bench\.add\("sunHerb"\)/);
assert.match(healingSource, /bench\.bottle\(\)/);
assert.equal(parseAlchemyCode(healingSource).ok, true);
const codeLabProfile = normalizeProfile({ version: 3, ingredients: { sunHerb: 3, waterCrystal: 2 }, potions: {} });
const codeBrew = runAlchemyCode(codeLabProfile, healingSource);
assert.equal(codeBrew.ok, true);
assert.equal(codeBrew.profile.potions.healing, 1);
assert.equal(runAlchemyCode(codeLabProfile, 'bench.add("sunHerb");\nfetch();\nbench.bottle();').ok, false);
assert.equal(runAlchemyCode(codeLabProfile, 'bench.add("sunHerb");\nbench.add("sunHerb");\nbench.add("waterCrystal");\nbench.stir();\nbench.grind();\nbench.bottle();').reason, 'wrong-process');

// Profile v10 migrates prior saves while preserving inherited rewards and loadout.
const migratedV2 = normalizeProfile({ version: 2, completed: ['q01'], equipment: ['trainingBlade','signalCharm'], loadout: { weapon: 'trainingBlade', charm: 'signalCharm' } });
assert.equal(migratedV2.version, 12);
assert.equal(migratedV2.loadout.charm, 'signalCharm');
let bossProfile = normalizeProfile({ version: 3, completed: LEVELS.slice(0,29).map(level => level.id), equipment: ['trainingBlade'] });
bossProfile = recordLevelComplete(bossProfile, legacyLevel('q30'), 12).profile;
assert.equal(bossProfile.equipment.includes('wardenCrest'), true);
assert.equal(equip(bossProfile, 'wardenCrest').loadout.charm, 'wardenCrest');

// v0.6 party collections: fixed indexes, target selection and elemental casting stay bounded and deterministic.
const partyParsed = parseJavaScript(`
let foes = enemies.length;
let firstHp = enemies[0].hp;
hero.target(0);
if (hero.isTargetInRange() && firstHp > 0) {
  hero.cast();
}
`);
assert.equal(partyParsed.ok, true);
assert.equal(partyParsed.program.some(node => node.type === 'target'), true);
assert.match(toJavaScript(partyParsed.program, partyParsed.functions), /enemies\[0\]\.hp/);
assert.equal(parseJavaScript('let hp = enemies[i].hp;').ok, false);
assert.equal(parseJavaScript('let hp = enemies[4].hp;').ok, false);
assert.equal(parseJavaScript('hero.target(9);').ok, true); // parser accepts expression; interpreter enforces bounded target index.
const invalidTargetRunner = new ProgramRunner([T(L(9))]);
assert.equal(invalidTargetRunner.step({ test:()=>false, read:()=>0 }).reason, 'target-index');
assert.equal(runToActions([T(L(2)), A('cast')], {}, { test:()=>false, read:()=>0 }).actions[0], 'target:2');

const partyLevel = { ...legacyLevel('q33'), requires: [], maxBlocks: 96 };
const partyModel = new CodeQuestModel(partyLevel);
assert.equal(partyModel.read('enemies.length'), 2);
assert.equal(partyModel.begin([A('targetElementWeak'), A('cast')]).ok, true);
const selected = partyModel.step();
assert.equal(selected.result, 'targeted');
assert.equal(partyModel.test('targetElementWeak'), true);
const elemental = partyModel.step();
assert.equal(elemental.result, 'defeated');
assert.equal(elemental.detail.elemental, 'weak');
assert.equal(partyModel.read('enemies.length'), 1);

const freezeLevel = legacyLevel('q34');
const frost = new CodeQuestModel(freezeLevel);
assert.equal(frost.begin(freezeLevel.reference.main, freezeLevel.reference.functions).ok, true);
while (frost.phase === 'executing') frost.step();
assert.equal(frost.snapshot().stats.frozenTurns > 0, true);

// Magic equipment contributes spell metadata without changing melee weapon semantics.
let mage = normalizeProfile({ version: 4, equipment: ['trainingBlade','emberWand','seekerLens'], loadout: { weapon: 'trainingBlade' } });
mage = equip(mage, 'emberWand'); mage = equip(mage, 'seekerLens');
const mageStats = combatStatsFor(mage);
assert.equal(mageStats.weaponDamage, 1);
assert.equal(mageStats.spellDamage, 2);
assert.equal(mageStats.weaponRange, 5);
assert.equal(mageStats.weaponElement, 'fire');

// The new Element Nexus region is solver-verified.
for (const id of ['q31','q32','q33','q34','q35','q36']) {
  const level = LEVELS.find(item => item.id === id);
  assert.equal(solveLevel(level, { weaponDamage: 1 }).solved, true, id + ' party/collection quest failed');
}


// v0.7 bounded collection iteration: real for...of syntax maps to a safe AST and read-only enemy records.
const foreachParsed = parseJavaScript(`
for (const foe of enemies) {
  hero.target(foe);
  if (foe.hp > 0 && foe.alive) {
    hero.cast();
  }
}
`);
assert.equal(foreachParsed.ok, true);
assert.equal(foreachParsed.program[0].type, 'forOf');
assert.match(toJavaScript(foreachParsed.program, foreachParsed.functions), /for \(const foe of enemies\)/);
assert.match(toJavaScript(foreachParsed.program, foreachParsed.functions), /foe\.hp/);
const foreachRun = runToActions(foreachParsed.program, {}, {
  test:()=>false, read:()=>0,
  collection:()=>[{ id:'enemy-1', hp:1, maxHp:1, armor:0, distance:2, element:'neutral', alive:true, weakTo:'none' }]
});
assert.deepEqual(foreachRun.actions, ['target-ref:enemy-1','cast']);
for (const unsafe of [
  'for (let foe of enemies) { hero.target(foe); }',
  'for (const foe of inventory) { hero.target(foe); }',
  'for (const foe of enemies) { foe.hp = 0; }',
  'for (const foe of enemies) { let x = foe.secret; }'
]) assert.equal(parseJavaScript(unsafe).ok, false, 'unsafe for...of unexpectedly parsed: ' + unsafe);

// Deterministic relic choices are regenerated from seed+tier, can be claimed once, and affect the normal slot loadout.
let relicProfile = normalizeProfile({ version:4, completed: LEVELS.slice(0,36).map(level=>level.id), equipment:['trainingBlade'] });
const relicRewardA = recordLevelComplete(relicProfile, LEVELS.find(level=>level.id==='q37'), 4);
const relicRewardB = recordLevelComplete(relicProfile, LEVELS.find(level=>level.id==='q37'), 4);
assert.equal(relicRewardA.profile.version, 12);
assert.equal(relicRewardA.profile.pendingLoot.length, 3);
assert.deepEqual(relicRewardA.profile.pendingLoot, relicRewardB.profile.pendingLoot);
const chosenRelic = relicRewardA.profile.pendingLoot[0];
const claimed = claimLoot(relicRewardA.profile, chosenRelic.id);
assert.equal(claimed.ok, true);
assert.equal(claimed.profile.pendingLoot.length, 0);
assert.equal(claimed.profile.lootGear.length, 1);
const equippedRelicProfile = equip(claimed.profile, chosenRelic.id);
assert.equal(equippedRelicProfile.loadout[chosenRelic.slot], chosenRelic.id);
const equippedRelic = equipmentFor(equippedRelicProfile, chosenRelic.slot);
assert.equal(equippedRelic.id, chosenRelic.id);
assert.equal(combatStatsFor(equippedRelicProfile).weaponRarityRank >= 1, true);
const tampered = normalizeProfile({ version:5, equipment:['trainingBlade'], lootGear:[{ ...chosenRelic, damage:99, seed:chosenRelic.seed, tier:chosenRelic.tier }], loadout:{ weapon:'trainingBlade' } });
assert.notEqual(tampered.lootGear[0].damage, 99);

// Every fifth endless clear can open a deterministic three-choice relic chest.
const towerLoot = recordEndlessClear(normalizeProfile({ version:5 }), 5, generateEndless(5).reward).profile;
assert.equal(towerLoot.pendingLoot.length, 3);

// The Relic Foundry uses iteration, member reads, object arguments and a multi-enemy boss.
for (const id of ['q37','q38','q39','q40','q41','q42']) {
  const level = LEVELS.find(item => item.id === id);
  assert.equal(solveLevel(level, { weaponDamage:1 }).solved, true, id + ' relic/iteration quest failed');
}
const hydra = solveLevel(LEVELS.find(level=>level.id==='q42'), { weaponDamage:1 });
assert.equal(hydra.solved, true);
assert.equal(hydra.model.snapshot().enemies.find(enemy=>enemy.type==='relicHydra').hp, 0);

// v0.10 inherits the v0.9 algorithmic expedition and adds physical mechanisms to combat rooms.
let expedition = createDungeonRun('test-expedition', 6);
assert.equal(expedition.version, 2);
assert.equal(expedition.current, 'r0');
assert.equal(['alpha','beta','gamma'].includes(expedition.layoutId), true);
assert.equal(['miasma','static','rust'].includes(expedition.hazard.id), true);
assert.equal(Object.keys(roomGraph(expedition)).length, 13);
assert.equal(parseJavaScript('let sigils = hero.run.sigils; let searched = hero.run.roomsCleared; if (hero.run.hazardActive) { hero.guard(); }').ok, true);
const expeditionStateModel = new CodeQuestModel(expeditionLevel(expedition), { weaponDamage:2 });
assert.equal(expeditionStateModel.read('hero.run.sigils'), 0);
assert.equal(expeditionStateModel.read('hero.run.roomsCleared'), 0);
assert.equal(expeditionStateModel.read('hero.run.hazardActive'), true);
assert.deepEqual(nextRooms(expedition), []); // entry combat must be cleared before search frontier opens.
let expeditionProfile = setActiveDungeonRun(normalizeProfile({ version:6 }), expedition);
assert.equal(expeditionProfile.version, 12);
assert.equal(expeditionProfile.activeRun.seed, 'test-expedition');
const r0level = expeditionLevel(expedition), r0solve = solveLevel(r0level, { weaponDamage:2, spellDamage:4, weaponRange:6, weaponElement:'frost', maxHp:6 });
assert.equal(r0solve.solved, true);
expedition = completeCombatRoom(expedition, r0solve.model.snapshot()).run;
assert.deepEqual(nextRooms(expedition), ['r1a','r1b']);
assert.equal(expedition.coins, 6);
if (expedition.hazard.id === 'miasma') assert.equal(expedition.hp, 5);

// Search a combat branch, then an elite sigil room. Frontier preserves unexplored branches.
expedition = enterDungeonRoom(expedition, 'r1b').run;
let roomSolve = solveLevel(expeditionLevel(expedition), { weaponDamage:2, spellDamage:4, weaponRange:6, weaponElement:'frost', maxHp:6 });
assert.equal(roomSolve.solved, true);
expedition = completeCombatRoom(expedition, roomSolve.model.snapshot()).run;
assert.equal(nextRooms(expedition).includes('r1a'), true);
assert.equal(nextRooms(expedition).includes('r2'), true);
expedition = enterDungeonRoom(expedition, 'r2').run;
roomSolve = solveLevel(expeditionLevel(expedition), { weaponDamage:2, spellDamage:4, weaponRange:6, weaponElement:'frost', maxHp:6 });
assert.equal(roomSolve.solved, true);
expedition = completeCombatRoom(expedition, roomSolve.model.snapshot()).run;
assert.equal(expedition.sigils, 1);
assert.equal(expedition.coins >= 24, true);

// Stabilizer can consume coins or Ward, clears the run-wide hazard and awards a compiler sigil.
assert.equal(nextRooms(expedition).includes('r2b'), true);
expedition = enterDungeonRoom(expedition, 'r2b').run;
const beforeStabilizeCoins = expedition.coins;
expedition = resolveRunChoice(expedition, 'hazard:stabilize').run;
assert.equal(expedition.hazard.cleared, true);
assert.equal(expedition.sigils, 2);
assert.equal(expedition.coins, beforeStabilizeCoins - 4);

// Compiler Archive supplies the third sigil. The boss is still unreachable until a tier-4 room is searched.
assert.equal(nextRooms(expedition).includes('r3c'), true);
expedition = enterDungeonRoom(expedition, 'r3c').run;
expedition = resolveRunChoice(expedition, 'sigil:spell').run;
assert.equal(expedition.sigils, sigilsRequired());
assert.equal(nextRooms(expedition).includes('r5'), false);

// A treasure branch opens the final frontier; route search is not a single linear next-room chain.
expedition = enterDungeonRoom(expedition, 'r4').run;
expedition = resolveRunChoice(expedition, 'treasure:guard').run;
assert.equal(expedition.boons.defense, 1);
assert.equal(nextRooms(expedition).includes('r5'), true);

// Three bounded Rune loadouts persist safe source and can be activated between rooms.
const loadoutSource = 'function rune() { hero.guard(); }\nrune();';
let loadoutResult = saveRunLoadout(expedition, 1, loadoutSource);
assert.equal(loadoutResult.ok, true); expedition = loadoutResult.run;
assert.equal(expedition.runeLoadouts[1], loadoutSource);
loadoutResult = activateRunLoadout(expedition, 1);
assert.equal(loadoutResult.ok, true); expedition = loadoutResult.run;
assert.equal(expedition.activeLoadout, 1);
assert.equal(expedition.code, loadoutSource);
assert.equal(saveRunLoadout(expedition, 9, loadoutSource).ok, false); // out-of-range slots are rejected.

expedition = enterDungeonRoom(expedition, 'r5').run;
const boss = solveLevel(expeditionLevel(expedition), { weaponDamage:2, spellDamage:4, weaponRange:6, weaponElement:'frost', maxHp:6 });
assert.equal(boss.solved, true);
expedition = completeCombatRoom(expedition, boss.model.snapshot()).run;
assert.equal(expedition.finished, true);
assert.equal(dungeonRunSummary(expedition).roomsCleared >= 7, true);
assert.equal(dungeonRunSummary(expedition).sigils >= sigilsRequired(), true);
assert.equal(hazardInfo(expedition).cleared, true);
expeditionProfile = setActiveDungeonRun(expeditionProfile, expedition);
const expeditionFinish = finishDungeonRun(expeditionProfile, expedition);
assert.equal(expeditionFinish.ok, true);
assert.equal(expeditionFinish.profile.activeRun, null);
assert.equal(expeditionFinish.profile.expeditionsCleared, 1);
assert.equal(expeditionFinish.profile.pendingLoot.length, 3);
assert.equal(abandonDungeonRun(setActiveDungeonRun(expeditionFinish.profile, createDungeonRun('again',5))).activeRun, null);
assert.equal(failDungeonRun(createDungeonRun('failed',5)).failed, true);

// Seed-derived topology/hazard/elite generation covers every bounded variant and is stable per seed.
const layoutsSeen = new Set(), hazardsSeen = new Set(), eliteModsSeen = new Set();
for (let i=0;i<96;i++) {
  const a=createDungeonRun('variant-'+i,5), b=createDungeonRun('variant-'+i,5);
  assert.equal(a.layoutId,b.layoutId); assert.equal(a.hazard.id,b.hazard.id);
  assert.deepEqual(a.eliteModifiers,b.eliteModifiers);
  layoutsSeen.add(a.layoutId); hazardsSeen.add(a.hazard.id); eliteModsSeen.add(a.eliteModifiers.r2); eliteModsSeen.add(a.eliteModifiers.r4a);
}
assert.deepEqual([...layoutsSeen].sort(), ['alpha','beta','gamma']);
assert.deepEqual([...hazardsSeen].sort(), ['miasma','rust','static']);
assert.deepEqual([...eliteModsSeen].sort(), ['armored','elemental','ranged','venom']);

// Legacy v0.8 run v1 remains resumable and is migrated into the v2 expedition contract.
const legacyRun = normalizeDungeonRun({ version:1, seed:'legacy', current:'r4', cleared:['r0','r1a','r2','r3a'], route:['r0','r1a','r2','r3a','r4'], hp:4, maxHp:5, coins:12, provisions:{ healing:2 }, boons:{}, shop:{}, flags:{} });
assert.equal(legacyRun.version, 2);
assert.equal(legacyRun.cleared.includes('r2'), true);
assert.equal(legacyRun.sigils >= 2, true);

// Equipment circuits create deterministic two-piece build synergies and are readable by code.
let emberSet = normalizeProfile({ version:6, equipment:['trainingBlade','emberWand','alchemistApron'], loadout:{ weapon:'trainingBlade' } });
emberSet = equip(emberSet,'emberWand'); emberSet = equip(emberSet,'alchemistApron');
const emberStats = combatStatsFor(emberSet);
assert.equal(emberStats.activeSets.some(set=>set.id==='ember' && set.pieces>=2), true);
assert.equal(emberStats.spellDamage, 3);
let aegisSet = normalizeProfile({ version:6, equipment:['trainingBlade','guardCape','signalCharm'], loadout:{ weapon:'trainingBlade' } });
aegisSet = equip(aegisSet,'guardCape'); aegisSet = equip(aegisSet,'signalCharm');
assert.equal(combatStatsFor(aegisSet).defense, 2);
assert.equal(parseJavaScript('let n = hero.build.synergyCount;').ok, true);
const synergyModel = new CodeQuestModel(LEVELS[0], { setBonusCount:2 });
assert.equal(synergyModel.read('hero.build.synergyCount'), 2);

assert.equal(modeFor({ version: 3, completed: [] }), 'explorer');
assert.equal(modeFor({ version: 3, completed: LEVELS.slice(0, 4).map(level => level.id) }), 'builder');
assert.equal(modeFor({ version: 3, completed: LEVELS.slice(0, 12).map(level => level.id) }), 'coder');
assert.equal(modeFor({ version: 3, completed: LEVELS.slice(0, 20).map(level => level.id) }), 'architect');


// v0.12 cooperative algorithms: live plates, independent companion movement,
// Rune Core carry/throw handoff, and bounded event callbacks all stay deterministic.
for (const id of ['q55','q56','q57','q58','q59','q60']) {
  const level = LEVELS.find(item => item.id === id);
  assert.equal(solveLevel(level, { weaponDamage:1 }).solved, true, id + ' cooperative quest failed');
}
const twin = new CodeQuestModel(LEVELS.find(level=>level.id==='q55'));
assert.equal(twin.begin(LEVELS.find(level=>level.id==='q55').reference.main, LEVELS.find(level=>level.id==='q55').reference.functions || {}).ok, true);
while (twin.phase === 'executing') twin.step();
assert.equal(twin.snapshot().stats.companionMoves >= 2, true);
assert.equal(twin.snapshot().plates.every(plate=>plate.active), true);

const carry = solveLevel(LEVELS.find(level=>level.id==='q57'), { weaponDamage:1 }).model.snapshot();
assert.equal(carry.orbs.length, 1);
assert.equal(carry.orbs[0].heldBy, null);
assert.equal(carry.plates.some(plate=>plate.x===carry.orbs[0].x && plate.y===carry.orbs[0].y), true);

const relay = solveLevel(LEVELS.find(level=>level.id==='q58'), { weaponDamage:1 }).model.snapshot();
assert.equal(relay.stats.carries >= 2, true);
assert.equal(relay.stats.throws >= 2, true);
assert.equal(relay.stats.companionMoves >= 2, true);

const callbackSource = 'function react() { companion.guard(); }\non("danger", react);\nhero.move();';
const callbackParsed = parseJavaScript(callbackSource);
assert.equal(callbackParsed.ok, true);
const callbackModel = new CodeQuestModel({ ...LEVELS.find(level=>level.id==='q59'), requires:[], maxBlocks:96 });
assert.equal(callbackModel.begin(callbackParsed.program, callbackParsed.functions).ok, true);
let callbackGuardSeen = false, callbackRegistered = false;
for (let i=0;i<64 && callbackModel.phase==='executing';i++) {
  const event = callbackModel.step();
  if (event.type === 'handler') callbackRegistered = true;
  if (event.type === 'action' && event.op === 'companionGuard') callbackGuardSeen = true;
}
assert.equal(callbackRegistered, true);
assert.equal(callbackGuardSeen, true);
assert.equal(callbackModel.snapshot().stats.callbacksTriggered >= 1, true);
assert.equal(callbackModel.snapshot().hero.hp >= 5, true);

for (const unsafe of [
  'on("unknown", react); function react() { hero.guard(); }',
  'function react(x) { hero.guard(); } on("danger", react);',
  'function react() { hero.guard(); } function nest() { on("danger", react); } nest();',
  'companion["move"]();'
]) assert.equal(parseJavaScript(unsafe).ok, false, 'unsafe callback/co-op code unexpectedly parsed: ' + unsafe);

// v0.13 automation + message passing: bounded actor signals round-trip through source,
// trigger callbacks, expose read-only message state, and can drive a relay gate.
for (const id of ['q61','q62','q63','q64','q65','q66']) {
  const level=LEVELS.find(item=>item.id===id);
  assert.equal(solveLevel(level,{weaponDamage:1}).solved,true,id+' signal quest failed');
}
const signalSource='function relay() { companion.move(); }\non("signal", relay);\nhero.signal("help");';
const signalParsed=parseJavaScript(signalSource);
assert.equal(signalParsed.ok,true);
assert.match(toJavaScript(signalParsed.program,signalParsed.functions),/hero\.signal\("help"\)/);
const signalRoundTrip=parseJavaScript(toJavaScript(signalParsed.program,signalParsed.functions));
assert.equal(signalRoundTrip.ok,true);
const ping=new CodeQuestModel(LEVELS.find(level=>level.id==='q61'));
assert.equal(ping.begin([SIG('hero','ready'),R(L(8),[A('move')])],{}).ok,true);
while(ping.phase==='executing') ping.step();
assert.equal(ping.snapshot().lastSignal.channel,'ready');
assert.equal(ping.snapshot().lastSignal.from,'hero');
assert.equal(ping.snapshot().stats.signalsSent,1);
assert.equal(ping.snapshot().runeGates.every(gate=>gate.open),true);
assert.equal(ping.read('hero.signal.last'),'ready');
assert.equal(ping.read('hero.signal.from'),'hero');
assert.equal(ping.read('hero.signal.count'),1);
for (const unsafe of [
  'hero.signal("unknown");',
  'companion.signal("launch");',
  'on("message", react); function react() { hero.wait(); }',
  'hero.signal(window.location);'
]) assert.equal(parseJavaScript(unsafe).ok,false,'unsafe signal source unexpectedly parsed: '+unsafe);

// Persistent Rune Library/profile behavior storage is bounded and migrates old profiles.
let libraryProfile=normalizeProfile({version:10,completed:[]});
assert.equal(libraryProfile.version,12);
assert.equal(libraryProfile.runeLibrary.length,4);
let lib=saveRuneLibrary(libraryProfile,0,'hero.move();');
assert.equal(lib.ok,true); libraryProfile=lib.profile;
assert.equal(loadRuneLibrary(libraryProfile,0).code,'hero.move();');
assert.equal(saveRuneLibrary(libraryProfile,9,'hero.move();').ok,false);
const behaviorCode='function react() { companion.guard(); }\non("danger", react);';
const behavior=saveBehaviorSource(libraryProfile,behaviorCode,true);
assert.equal(behavior.ok,true); libraryProfile=behavior.profile;
assert.equal(libraryProfile.behaviorEnabled,true);
libraryProfile=setBehaviorEnabled(libraryProfile,false);
assert.equal(libraryProfile.behaviorEnabled,false);
assert.equal(libraryProfile.behaviorSource,behaviorCode);


// v0.14 state machines + independent persistent behaviors + FIFO message protocols.
for (const id of ['q67','q68','q69','q70','q71','q72']) {
  const level=LEVELS.find(item=>item.id===id);
  assert.equal(solveLevel(level,{weaponDamage:1}).solved,true,id+' protocol quest failed');
}
assert.equal(LEVELS.length,72);

// Actor-state mutation is deliberately narrow: only the two allowlisted state properties can be assigned.
const stateSource='hero.state = "attack";\ncompanion.state = "regroup";';
const stateParsed=parseJavaScript(stateSource);
assert.equal(stateParsed.ok,true);
assert.equal(toJavaScript(stateParsed.program,stateParsed.functions),stateSource);
assert.deepEqual(runToActions(stateParsed.program,{}, { test:()=>false }).actions,['hero.state:attack','companion.state:regroup']);
for (const unsafe of [
  'hero.hp = 99;',
  'hero.state = "godmode";',
  'companion.mode = "follow";',
  'let state = "explore"; state = "attack";'
]) assert.equal(parseJavaScript(unsafe).ok,false,'unsafe assignment unexpectedly parsed: '+unsafe);

// State survives the Program -> World -> Program boundary and drives the next turn.
const q67=LEVELS.find(level=>level.id==='q67'), stateRoom=new CodeQuestModel(q67,{weaponDamage:1});
assert.equal(stateRoom.begin(q67.reference.main,q67.reference.functions).ok,true);
while(stateRoom.phase==='executing') stateRoom.step();
assert.equal(stateRoom.snapshot().hero.state,'attack');
assert.equal(stateRoom.snapshot().stats.stateChanges,1);
if(stateRoom.phase==='programming'){
  assert.equal(stateRoom.begin(q67.reference.main,q67.reference.functions).ok,true);
  while(stateRoom.phase==='executing') stateRoom.step();
}
assert.equal(stateRoom.snapshot().hero.state,'attack');

// FIFO mailbox delivery is stable and debugger trace records callback order.
const q69=LEVELS.find(level=>level.id==='q69'), fifo=new CodeQuestModel(q69);
assert.equal(fifo.begin(q69.reference.main,q69.reference.functions).ok,true);
while(fifo.phase==='executing') fifo.step();
const fifoSnap=fifo.snapshot();
assert.deepEqual(fifoSnap.deliveredSignals.slice(0,2),['ready','switch']);
assert.deepEqual(fifoSnap.trace.filter(item=>item.kind==='callback-start').map(item=>item.channel).slice(0,2),['ready','switch']);
assert.equal(fifoSnap.messageQueue.length,0);
assert.equal(fifoSnap.stats.callbacksTriggered,2);

// Mailboxes are bounded to eight pending messages; overflow is deterministic and counted.
const mailboxLevel={...q69, requires:[], maxBlocks:96, objective:{surviveTurns:99}};
const mailbox=new CodeQuestModel(mailboxLevel);
const tenSignals=Array.from({length:10},(_,i)=>SIG('hero',i%2?'switch':'ready'));
assert.equal(mailbox.begin(tenSignals,{}).ok,true);
for(let i=0;i<8;i++) mailbox.step();
assert.equal(mailbox.read('hero.signal.pending'),0);
assert.equal(mailbox.read('companion.signal.pending'),8);
mailbox.step(); mailbox.step();
assert.equal(mailbox.snapshot().stats.messagesDropped,2);
while(mailbox.phase==='executing') mailbox.step();
assert.equal(mailbox.snapshot().deliveredSignals.length,8);

// Hero and Companion persistent behavior programs are independent but execute through one model/runner.
// Actor-owned signal handlers consume only messages addressed to that actor; main-program signal
// handlers preserve v0.13's global event semantics.
const heroBehavior=parseJavaScript('function protect() { hero.state = "defend"; }\non("signal", protect);');
const companionBehavior=parseJavaScript('function regroup() { companion.state = "regroup"; }\non("signal", regroup);');
assert.equal(heroBehavior.ok,true); assert.equal(companionBehavior.ok,true);
const behaviorLevel={...q69, requires:[], maxBlocks:96, objective:{surviveTurns:99}};
const dualBehavior=new CodeQuestModel(behaviorLevel);
assert.equal(dualBehavior.begin([SIG('hero','help')],{},[
  {owner:'hero',program:heroBehavior.program,functions:heroBehavior.functions},
  {owner:'companion',program:companionBehavior.program,functions:companionBehavior.functions}
]).ok,true);
while(dualBehavior.phase==='executing') dualBehavior.step();
let dualSnap=dualBehavior.snapshot();
assert.equal(dualSnap.hero.state,'explore');
assert.equal(dualSnap.companion.state,'regroup');
assert.deepEqual(dualSnap.eventHandlers.signal.map(item=>item.owner),['hero','companion']);
assert.equal(dualSnap.stats.callbacksTriggered,1);
assert.equal(dualBehavior.read('companion.signal.pending'),0);

// Reverse direction: a Companion signal addresses Hero, so only Hero persistent behavior runs.
assert.equal(dualBehavior.begin([SIG('companion','ready')],{},[
  {owner:'hero',program:heroBehavior.program,functions:heroBehavior.functions},
  {owner:'companion',program:companionBehavior.program,functions:companionBehavior.functions}
]).ok,true);
assert.equal(dualBehavior.step().type,'signal');
assert.equal(dualBehavior.read('hero.signal.pending'),1);
assert.equal(dualBehavior.read('companion.signal.pending'),0);
while(dualBehavior.phase==='executing') dualBehavior.step();
dualSnap=dualBehavior.snapshot();
assert.equal(dualSnap.hero.state,'defend');
assert.equal(dualSnap.companion.state,'regroup');
assert.equal(dualSnap.stats.callbacksTriggered,2);

// v11 profiles migrate the former shared behavior into Companion behavior without losing source or enablement.
const legacyBehavior='function react() { companion.guard(); }\non("danger", react);';
const migratedV11=normalizeProfile({version:11,behaviorSource:legacyBehavior,behaviorEnabled:true,runeLibrary:['hero.move();','','','']});
assert.equal(migratedV11.version,12);
assert.equal(migratedV11.heroBehaviorSource,'');
assert.equal(migratedV11.heroBehaviorEnabled,false);
assert.equal(migratedV11.companionBehaviorSource,legacyBehavior);
assert.equal(migratedV11.companionBehaviorEnabled,true);
assert.equal(migratedV11.runeLibrary[0],'hero.move();');

let splitBehavior=normalizeProfile({version:11});
let savedHero=saveBehaviorSource(splitBehavior,'hero','function h() { hero.guard(); }\non("danger", h);',true);
assert.equal(savedHero.ok,true); splitBehavior=savedHero.profile;
let savedCompanion=saveBehaviorSource(splitBehavior,'companion','function c() { companion.guard(); }\non("danger", c);',false);
assert.equal(savedCompanion.ok,true); splitBehavior=savedCompanion.profile;
assert.equal(behaviorFor(splitBehavior,'hero').enabled,true);
assert.equal(behaviorFor(splitBehavior,'companion').enabled,false);
splitBehavior=setBehaviorEnabled(splitBehavior,'companion',true);
assert.equal(behaviorFor(splitBehavior,'hero').enabled,true);
assert.equal(behaviorFor(splitBehavior,'companion').enabled,true);

// The new Infinite Tower families are present in every 32-floor cycle.
for (const floor of [29,30,31,32,61,62,63,64]) {
  const level=generateEndless(floor);
  assert.equal(solveLevel(level,{weaponDamage:1}).solved,true,level.id+' v0.14 endless family failed');
}

console.log('Code Quest v0.14: 72 authored quests, bounded actor state/FIFO protocols, split persistent behaviors and 1536 endless floors verified.');


// ---- Redesign slice 04: Explorer path preview ----
{
  const level = LEVELS.find(entry => entry.id === 'q01');
  const live = new CodeQuestModel(level);
  const before = JSON.stringify(live.snapshot());
  const path = previewPath(new CodeQuestModel(level), level.reference.main, level.reference.functions || {});
  // The preview visits exactly the tiles a real run visits.
  const real = new CodeQuestModel(level), visited = [{ x: real.hero.x, y: real.hero.y }];
  assert.equal(real.begin(level.reference.main, level.reference.functions || {}).ok, true);
  for (let i = 0; i < 256 && real.phase === 'executing'; i++) {
    const event = real.step();
    if (event.type === 'world-turn') break;
    const last = visited[visited.length - 1];
    if (real.hero.x !== last.x || real.hero.y !== last.y) visited.push({ x: real.hero.x, y: real.hero.y });
  }
  assert.deepEqual(path.map(p => ({ x: p.x, y: p.y })), visited, 'preview must match the real run');
  assert.ok(path.length > 1);
  assert.equal(JSON.stringify(live.snapshot()), before, 'preview never touches the live model');
  // A wall bump stops the path where the hero stops.
  const bump = previewPath(new CodeQuestModel(LEVELS.find(entry => entry.id === 'q02')), [A('move'), A('move'), A('move'), A('move'), A('move'), A('move')]);
  const q02 = new CodeQuestModel(LEVELS.find(entry => entry.id === 'q02'));
  assert.ok(bump.length >= 1 && bump.every(p => !q02._wall(p.x, p.y)), 'preview never walks into a wall');
  assert.deepEqual(previewPath(new CodeQuestModel(level), []), [{ x: live.hero.x, y: live.hero.y, dir: live.hero.dir }]);
  console.log('Code Quest redesign: Explorer path preview verified.');
}

// ---- Redesign slice 05: every authored quest is a real room ----
for (const level of LEVELS) {
  const w = level.map[0].length, h = level.map.length;
  assert.ok(w <= 9 && h <= 7, level.id + ' room must fit 9×7 (is ' + w + '×' + h + ')');
  const walkableRows = level.map.slice(1, -1).filter(row => /[^#]/.test(row.slice(1, -1))).length;
  assert.ok(walkableRows >= 3, level.id + ' room needs depth: ≥ 3 walkable rows');
}
console.log('Code Quest redesign: 72 authored rooms fit 9×7 with depth.');

// ---- UX polish slice 08: card-menu strip edits ----
import { IF_TESTS, repeatCounts, ifTests, insertAfter, canUnwrap, unwrap, setRepeatCount, nextRepeatCount, setCondition, extendSelection } from '../js/games/codequest/strip-edit.js';
{
  const a = A('move', 'a-1'), b = A('turnLeft', 'a-2'), c = A('attack', 'a-3');
  const loop = R(3, [a, b], 'r-1'), test = IF('enemyAhead', [c], [], 'i-1'), both = IF('enemyAhead', [a], [b], 'i-2');
  const list = Object.freeze([loop, test, A('move', 'a-4')]);
  // Insert after the selected card, else append.
  assert.deepEqual(insertAfter(list, 0, c).map(n => n.uid), ['r-1', 'a-3', 'i-1', 'a-4']);
  assert.deepEqual(insertAfter(list, -1, c).map(n => n.uid), ['r-1', 'i-1', 'a-4', 'a-3']);
  // Unwrap keeps the body cards and their UIDs; an IF with an else branch refuses.
  assert.deepEqual(unwrap(list, 0).map(n => n.uid), ['a-1', 'a-2', 'i-1', 'a-4']);
  assert.deepEqual(unwrap(list, 1).map(n => n.uid), ['r-1', 'a-3', 'a-4']);
  assert.equal(canUnwrap(both), false); assert.equal(unwrap([both], 0), null);
  assert.equal(unwrap(list, 2), null, 'an action card has nothing to unwrap');
  // Repeat counts come from the room's cards only.
  const counts = repeatCounts(['repeat2', 'ifEnemy', 'repeat5', 'repeat3', 'callRune']);
  assert.deepEqual(counts, [2, 3, 5]);
  assert.deepEqual([nextRepeatCount(3, counts), nextRepeatCount(5, counts), nextRepeatCount(4, counts)], [5, 2, 2]);
  const five = setRepeatCount(list, 0, 5, counts);
  assert.equal(five[0].times, 5); assert.equal(five[0].uid, 'r-1'); assert.deepEqual(five[0].body.map(n => n.uid), ['a-1', 'a-2']);
  assert.equal(setRepeatCount(list, 0, 4, counts), null, 'a count the room does not offer is refused');
  assert.equal(setRepeatCount(list, 1, 2, counts), null, 'only Repeat brackets have a count');
  // IF tests swap among the room's tests, keeping both branches.
  const tests = ifTests(['repeat2', 'ifEnemy', 'ifChest', 'ifNope']);
  assert.deepEqual(tests, [['ifEnemy', 'enemyAhead'], ['ifChest', 'chestAhead']]);
  const chest = setCondition(list, 1, 'chestAhead', tests.map(p => p[1]));
  assert.equal(chest[1].test, 'chestAhead'); assert.equal(chest[1].uid, 'i-1'); assert.deepEqual(chest[1].then.map(n => n.uid), ['a-3']);
  assert.equal(setCondition(list, 1, 'hasKey', tests.map(p => p[1])), null);
  // Inputs are never mutated.
  assert.deepEqual(list.map(n => n.uid), ['r-1', 'i-1', 'a-4']); assert.equal(list[0].times, 3); assert.equal(list[1].test, 'enemyAhead');
  // Every library IF card maps to a condition the parser knows.
  for (const [id, cond] of Object.entries(IF_TESTS)) assert.equal(IF(cond, [], []).test, cond, id);
  // Selection: neighbours extend, ends shrink, elsewhere restarts.
  const sel = (set, i) => [...extendSelection(new Set(set), i)].sort((x, y) => x - y);
  assert.deepEqual(sel([], 2), [2]); assert.deepEqual(sel([2], 3), [2, 3]); assert.deepEqual(sel([2, 3], 1), [1, 2, 3]);
  assert.deepEqual(sel([1, 2, 3], 3), [1, 2]); assert.deepEqual(sel([1, 2, 3], 2), [2]); assert.deepEqual(sel([2], 2), []);
  assert.deepEqual(sel([2, 3], 6), [6]);
}
console.log('Code Quest UX polish: card-menu strip edits verified.');

// Facing + Rune plan slice 03: the runner names the open calls so the strip can light the running call card.
{
  const runner = new ProgramRunner([A('move', 'a-top'), CALL('rune', 'c-1'), A('turnRight', 'a-r'), CALL('outer', 'c-2')],
    { rune: [A('move', 'a-in1'), A('move', 'a-in2')], outer: [CALL('rune', 'c-3')] });
  const env = { test: () => false };
  const seen = [];
  for (let i = 0; i < 8; i++) {
    const event = runner.step(env);
    if (event.type !== 'action') break;
    seen.push([event.uid, runner.activeCalls().map(call => call.uid + ':' + call.name).join('>')]);
  }
  assert.deepEqual(seen, [
    ['a-top', ''], ['a-in1', 'c-1:rune'], ['a-in2', 'c-1:rune'], ['a-r', ''],
    ['a-in1', 'c-2:outer>c-3:rune'], ['a-in2', 'c-2:outer>c-3:rune']
  ]);
  assert.equal(runner.step(env).type, 'done');
  assert.deepEqual(runner.activeCalls(), []);
}

// Facing + Rune plan slice 05: the coach list is additive in v12, bounded and idempotent.
{
  const { markCoachSeen } = await import('../js/games/codequest/progression.js');
  assert.deepEqual(normalizeProfile({ version: 12, completed: [] }).coach, []);
  assert.deepEqual(normalizeProfile({ version: 11 }).coach, []);
  assert.deepEqual(normalizeProfile({ version: 12, coach: ['rune', 'rune', 'nope', 7, null] }).coach, ['rune']);
  const seen = markCoachSeen(normalizeProfile({ version: 12, completed: ['q01'] }), 'rune');
  assert.deepEqual(seen.coach, ['rune']);
  assert.deepEqual(seen.completed, ['q01']);
  assert.deepEqual(markCoachSeen(seen, 'rune').coach, ['rune']);
  assert.deepEqual(normalizeProfile(JSON.parse(JSON.stringify(seen))).coach, ['rune']);
}
