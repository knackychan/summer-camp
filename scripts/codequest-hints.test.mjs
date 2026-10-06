import assert from 'node:assert/strict';
import { LEVELS } from '../js/games/codequest/levels.js';
import { SKILLS, HINTS, skillsFor, difficultyFor, chipText, hintFor, hasHandHint, peekFor, missingSkills } from '../js/games/codequest/hints.js';

const byId = Object.fromEntries(LEVELS.map(level => [level.id, level]));
const ids = list => list.map(item => item.id);
const filled = pair => Array.isArray(pair) && pair.length === 2 && pair.every(text => typeof text === 'string' && text.trim().length > 0);

// Every requires tag maps to a bilingual skill; no tag is silently dropped.
for (const level of LEVELS) {
  const chips = skillsFor(level);
  for (const chip of chips) { assert.ok(filled(chip.name), level.id + ' chip name'); assert.ok(filled(chip.why), level.id + ' chip why'); assert.ok(chip.icon, level.id + ' chip icon'); }
  if (level.requires.length) assert.ok(chips.length > 0 && chips.every(chip => !chip.teach), level.id + ' requires → chips');
  for (const tag of level.requires) {
    const folded = tag === 'params' || tag === 'arguments' ? 'param' : tag;
    const covered = SKILLS[folded] && (ids(chips).includes(folded) || ((tag === 'expression' || tag === 'member') && level.requires.includes('property')));
    assert.ok(covered, level.id + ' tag ' + tag + ' has a chip');
  }
}
assert.deepEqual(ids(skillsFor(byId.q12)), ['call', 'repeat']);
assert.deepEqual(ids(skillsFor(byId.q01)), ['sequence']);
assert.equal(skillsFor(byId.q01)[0].teach, true);
assert.equal(skillsFor(byId.q26).filter(chip => chip.id === 'param').length, 1);
assert.deepEqual(chipText(skillsFor(byId.q12)), ['🪨 Rune + 🔁 Repeat', '🪨 符文＋🔁 重複']);

// Difficulty is worked out from data.
assert.equal(difficultyFor(byId.q01), 'easy');
assert.equal(difficultyFor(byId.q05), 'medium');
assert.equal(difficultyFor(byId.q12), 'hard');
for (const level of LEVELS) assert.ok(['easy', 'medium', 'hard'].includes(difficultyFor(level)), level.id + ' difficulty');

// Every quest has three bilingual hints (hand-written or the chip fallback).
const handWritten = new Set(['q12']);
for (const level of LEVELS) for (const tier of [0, 1, 2]) {
  assert.ok(filled(hintFor(level, tier)), level.id + ' tier ' + tier);
  if (handWritten.has(level.id)) assert.ok(hasHandHint(level, tier), level.id + ' tier ' + tier + ' hand-written');
}
// Hand-written hints follow D6: short, no hit counts, never "wrong".
const HIT_COUNT_EN = /\d+\s*(hits?|punch(es)?|attacks?|strikes?)\b/i, HIT_COUNT_ZH = /[0-9０-９]+\s*下/;
const SHAME = /wrong|didn'?t work|failed|錯|失敗/i;
for (const [id, entry] of Object.entries(HINTS)) {
  assert.ok(byId[id], id + ' is a real quest');
  for (const tier of ['gentle', 'strong', 'near']) {
    const [en, zh] = entry[tier];
    assert.ok(filled(entry[tier]), id + ' ' + tier);
    assert.ok(en.length <= 110, id + ' ' + tier + ' EN ≤ 110 chars (' + en.length + ')');
    assert.ok(!HIT_COUNT_EN.test(en) && !HIT_COUNT_ZH.test(zh), id + ' ' + tier + ' states no hit count');
    assert.ok(!SHAME.test(en) && !SHAME.test(zh), id + ' ' + tier + ' never says wrong/failed');
    if (tier === 'gentle') assert.ok(!/^good try/i.test(en), id + ' gentle is read before any try');
  }
}

// Peeks come from the real reference and stay short.
for (const level of LEVELS) {
  const peek = peekFor(level);
  if (level.codingView === 'code') { assert.equal(peek.kind, 'code'); assert.ok(peek.lines.length > 0 && peek.lines.length <= 3, level.id + ' code peek'); }
  else { assert.equal(peek.kind, 'cards'); assert.ok(peek.nodes.length > 0 && peek.nodes.length <= 3, level.id + ' card peek'); }
}
const golemPeek = peekFor(byId.q12);
assert.equal(golemPeek.nodes[0].type, 'call');
assert.ok(golemPeek.rune && golemPeek.rune.length > 0, 'q12 peek carries the Rune row');

// missingSkills names everything still missing, nothing once the reference is in.
assert.deepEqual(ids(missingSkills(byId.q12, [], {})), ['call', 'repeat']);
assert.deepEqual(missingSkills(byId.q12, byId.q12.reference.main, byId.q12.reference.functions), []);
for (const level of LEVELS) assert.deepEqual(missingSkills(level, level.reference.main, level.reference.functions), [], level.id + ' reference has every skill');

console.log('codequest-hints: ok');
