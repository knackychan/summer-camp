import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { installDom } from './dom-stub.mjs';
import sentence from '../js/brain/scenes/sentence.js';
import soundmatch from '../js/brain/scenes/soundmatch.js';
import generic from '../js/brain/scenes/generic.js';

installDom();
const require = createRequire(import.meta.url);
const data = require('../js/brain-data.js');
const core = require('../js/brain-core.js');
const bopomofo = require('../js/bopomofo.js');

function context(gameId, tier = 'tot') {
  const submitted = [], spoken = [], announced = [];
  return {
    gameId, tier, mount: document.createElement('div'), submitted, spoken, announced,
    submit: value => submitted.push(value), sayPair: pair => spoken.push(pair), announce: pair => announced.push(pair),
    audio: { play() {} }, motion: { emphasize() {}, move() {}, tokens: { move: 0 } },
    scheduler: { after(_ms, done) { done(); return () => {}; } }, random: core.mulberry32(7), reducedMotion: true
  };
}

test('language rounds survive JSON with four unique choices and exact correct/wrong grading', () => {
  for (const script of ['abc', 'bpmf']) {
    data.setInputScript(script);
    for (const id of ['sentence', 'soundmatch']) for (const tier of data.TIERS) {
      for (let seed = 0; seed < 24; seed++) {
        const round = JSON.parse(JSON.stringify(core.buildRound(id, tier, core.mulberry32(seed))));
        assert.equal(round.items.length, tier === 'tot' ? 6 : 8);
        assert.equal(round.clock, tier !== 'tot');
        assert.equal(new Set(round.items.map(item => id === 'sentence' ? item.answer : item.prompt.word[0])).size, round.items.length, 'do not repeat an authored sentence or target word in a round');
        for (const item of round.items) {
          assert.equal(item.choices.length, 4);
          assert.equal(new Set(item.choices).size, 4);
          assert.ok(item.choices.includes(item.answer));
          assert.equal(core.gradeItem(item, item.answer).correct, true);
          assert.equal(core.gradeItem(item, item.choices.find(value => value !== item.answer)).got, 0);
          assert.equal(core.gradeItem(item, '').got, 0);
          assert.ok(item.prompt.en && item.prompt.zh);
          for (const field of ['topic', 'hint', 'explanation']) assert.ok(item.lesson[field].length === 2 && item.lesson[field].every(Boolean), field);
          if (id === 'sentence') {
            assert.deepEqual([...item.prompt.tokens].sort(), item.answer.split(' ').sort());
            assert.notEqual(item.prompt.tokens.join(' '), item.answer, 'train must begin shuffled');
            assert.ok(item.prompt.meaning.every(Boolean));
            assert.equal(item.say, undefined, 'do not speak the answer before building it');
            if (tier === 'tot') assert.equal(item.prompt.tokens.length, 3);
          } else {
            assert.equal(item.prompt.script, script);
            assert.equal(item.prompt.options.length, 4);
            assert.ok(item.prompt.options.every(option => option.picture && option.label.every(Boolean)));
            assert.equal(item.prompt.options.filter(option => option.value === item.answer).length, 1);
            assert.equal(item.prompt.options.filter(option => option.soundKey === item.prompt.matchKey).length, 1, 'exactly one option meets the requested sound rule');
            if (item.prompt.mode === 'word' || item.prompt.mode === 'spelling') assert.equal(item.prompt.clue, item.answer);
            else assert.notEqual(item.prompt.clue, item.answer, 'initial/rhyme visual clue gives the reference word, not the solution');
          }
        }
      }
    }
  }
  data.setInputScript('abc');
});

test('Sentence Train has 18 authored sentences per tier and teaches grammar without revealing the ordered answer', () => {
  const normalize = text => text.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
  const concepts = new Set();
  for (const tier of data.TIERS) {
    const items = [];
    for (let i = 0; i < 18; i++) items.push(data.GAMES.sentence.tiers[tier].gen(() => 0, { i, items }));
    assert.equal(new Set(items.map(item => item.answer)).size, 18);
    assert.equal(new Set(items.map(item => item.prompt.sentenceId)).size, 18);
    for (const item of items) {
      concepts.add(item.prompt.concept);
      const beforeCheck = [item.prompt.meaning[0], item.prompt.en, ...item.lesson.topic, ...item.lesson.hint].join(' ');
      assert.equal(normalize(beforeCheck).includes(normalize(item.answer)), false, item.answer + ' was revealed before Check');
      assert.ok(item.lesson.explanation[0].includes(item.answer));
      assert.ok(item.lesson.explanation[1].includes(item.prompt.meaning[1]));
    }
    if (tier !== 'tot') {
      assert.ok(items.some(item => item.answer.endsWith('?')));
      assert.ok(items.some(item => item.answer.includes(' not ')));
    }
    if (tier === 'hard') {
      assert.ok(items.some(item => item.answer.includes(';')));
      assert.ok(items.some(item => item.answer.split(' ').filter(token => token === 'the').length > 1));
    }
  }
  for (const concept of ['negative', 'question', 'sequence', 'list', 'joining', 'agreement', 'compare']) assert.ok(concepts.has(concept), concept);
});

test('all 36 illustrated words use the established Taiwan Zhuyin spellings and real Chinese speech', () => {
  data.setInputScript('bpmf');
  const items = [];
  for (let i = 0; i < 36; i++) items.push(data.GAMES.soundmatch.tiers.tot.gen(() => 0, { i, items }));
  assert.equal(new Set(items.map(item => item.prompt.word[0])).size, 36);
  for (const item of items) {
    const known = bopomofo.WORDS.find(row => row[2] === item.prompt.word[1]);
    assert.ok(known, item.prompt.word[1]);
    const horizontal = { '鼻子': 'ㄅㄧˊ˙ㄗ', '椅子': 'ㄧˇ˙ㄗ' };
    assert.equal(item.answer, horizontal[known[2]] || known[0]);
    assert.deepEqual(item.prompt.speech, ['', known[2]]);
    assert.ok(item.prompt.picture);
  }
  data.setInputScript('abc');
});

test('a list accepts either valid noun order after serialization and keeps invalid orders incorrect', () => {
  const items = [];
  for (let i = 0; i < 18; i++) items.push(data.GAMES.sentence.tiers.hard.gen(() => 0, { i, items }));
  const item = JSON.parse(JSON.stringify(items.find(row => row.acceptedAnswers)));
  const variant = 'Please bring bananas, apples, and a bottle of water.';
  assert.ok(item.acceptedAnswers.includes(variant));
  assert.deepEqual(variant.split(' ').sort(), item.prompt.tokens.slice().sort());
  assert.equal(core.gradeItem(item, variant).correct, true);
  assert.equal(core.scoreRound({ items: [item], answers: [variant] }).score, 1);
  assert.equal(core.gradeItem(item, 'Please apples, bring bananas, and a bottle of water.').correct, false);
  assert.equal(item.choices.filter(choice => core.gradeItem(item, choice).correct).length, 1);
});

test('tiers use distinct sound tasks with unambiguous options and strategy clues', () => {
  for (const script of ['abc', 'bpmf']) {
    data.setInputScript(script);
    const expected = { tot: ['word'], mid: ['initial', 'word'], hard: [script === 'abc' ? 'rhyme' : 'initial', 'spelling'].sort() };
    for (const tier of data.TIERS) {
      const round = core.buildRound('soundmatch', tier, core.mulberry32(70));
      assert.deepEqual([...new Set(round.items.map(item => item.prompt.mode))].sort(), expected[tier]);
      for (const item of round.items) {
        assert.deepEqual(item.prompt.speech, script === 'bpmf' ? ['', item.prompt.cue[1]] : [item.prompt.cue[0], '']);
        if (script === 'bpmf' && item.prompt.mode === 'initial') {
          const target = bopomofo.WORDS.find(row => row[2] === item.prompt.word[1]);
          const cue = bopomofo.WORDS.find(row => row[2] === item.prompt.cue[1]);
          assert.notEqual(target[0], cue[0]);
          assert.equal(target[0][0], cue[0][0]);
          assert.equal(item.prompt.matchKey, cue[0][0]);
        }
        if (script === 'abc' && item.prompt.mode === 'spelling') {
          assert.equal(item.prompt.options.filter(option => option.value === item.prompt.word[0]).length, 1);
          assert.ok(item.prompt.options.every(option => option.picture === item.prompt.picture));
        }
      }
      assert.ok(data.GAMES.soundmatch.tiers[tier].gen(() => .5).lesson, 'standalone gen without ctx remains valid');
    }
  }
  data.setInputScript('abc');
});

test('Sentence Train handles repeated tokens, removal, clear, keyboard buttons and one submission', async () => {
  const ctx = context('sentence', 'hard'), scene = sentence.create(ctx);
  const item = JSON.parse(JSON.stringify({
    prompt: { type: 'sentence', tokens: ['the', 'dog.', 'the', 'fed', 'We', 'cat', 'and'], picture: '🐱🐶', meaning: ['Feed both animals.', '我們餵了貓和狗。'] },
    answer: 'We fed the cat and the dog.'
  }));
  scene.present(item);
  const words = ctx.mount.querySelectorAll('.brain-sentence__word');
  assert.ok(words.every(button => button.tagName === 'BUTTON' && button.disabled));
  words[0].onclick(); assert.equal(ctx.submitted.length, 0);
  scene.setInputEnabled(true);
  words[0].onclick(); words[0].onclick(); words[2].onclick();
  assert.equal(ctx.mount.querySelectorAll('.brain-sentence__slot').filter(button => button.textContent === 'the').length, 2);
  assert.equal(ctx.mount.querySelector('[data-act="check"]').disabled, true);
  ctx.mount.querySelectorAll('.brain-sentence__slot')[0].onclick();
  assert.equal(words[0].disabled, false); assert.equal(words[2].disabled, true);
  ctx.mount.querySelector('[data-act="clear"]').onclick();
  assert.ok(words.every(button => !button.disabled));
  for (const token of item.answer.split(' ')) words.find(button => button.textContent === token && !button.disabled).onclick();
  assert.deepEqual(ctx.spoken, [], 'the completed target is silent until Check');
  const check = ctx.mount.querySelector('[data-act="check"]');
  assert.equal(check.disabled, false); check.onclick(); check.onclick(); words[0].onclick();
  assert.deepEqual(ctx.submitted, [item.answer]);
  await scene.showFeedback({ correct: true, answer: item.answer });
  assert.deepEqual(ctx.spoken, [[item.answer, item.prompt.meaning[1]]]);
  assert.ok(ctx.mount.querySelector('.brain-sentence__track').classList.contains('is-success'));
  scene.destroy(); words[0].onclick(); assert.equal(ctx.submitted.length, 1);
});

test('Sentence Train wrong order is graded once and reveals the correct sentence', async () => {
  const ctx = context('sentence'), scene = sentence.create(ctx);
  const item = core.buildRound('sentence', 'tot', core.mulberry32(19)).items[0];
  scene.present(item); scene.setInputEnabled(true);
  ctx.mount.querySelectorAll('.brain-sentence__word').forEach(button => button.onclick());
  ctx.mount.querySelector('[data-act="check"]').onclick();
  assert.equal(core.gradeItem(item, ctx.submitted[0]).correct, false);
  await scene.showFeedback({ correct: false, answer: item.answer });
  assert.ok(ctx.mount.querySelector('.brain-corrective').textContent.includes(item.answer));
  assert.ok(ctx.mount.querySelector('.brain-sentence__track').classList.contains('is-hint'));
  scene.destroy();
});

test('Sound Match replay and visual clue work without audio; answer cannot submit twice', async () => {
  for (const script of ['abc', 'bpmf']) {
    data.setInputScript(script);
    const ctx = context('soundmatch'), scene = soundmatch.create(ctx);
    const item = JSON.parse(JSON.stringify(core.buildRound('soundmatch', 'tot', core.mulberry32(12)).items[0]));
    scene.present(item); assert.deepEqual(ctx.spoken, []);
    scene.setInputEnabled(true);
    assert.deepEqual(ctx.spoken[0], script === 'bpmf' ? ['', item.prompt.word[1]] : [item.prompt.word[0], '']);
    ctx.mount.querySelector('.brain-sound__listen').onclick();
    assert.equal(ctx.spoken.length, 2); assert.deepEqual(ctx.submitted, []);
    ctx.sayPair = () => {}; // muted or no offline voice: visual clue still works
    ctx.mount.querySelector('.brain-sound__reveal').onclick();
    const clue = ctx.mount.querySelector('.brain-sound__clue');
    assert.equal(clue.hidden, false); assert.ok(clue.textContent.includes(item.answer));
    assert.equal(ctx.mount.querySelector('.brain-sound__reveal').getAttribute('aria-expanded'), 'true');
    const options = ctx.mount.querySelectorAll('.brain-sound__choice');
    const correct = options.find(button => button.dataset.value === item.answer);
    correct.onclick(); correct.onclick(); options.find(button => button !== correct).onclick();
    assert.deepEqual(ctx.submitted, [item.answer]);
    await scene.showFeedback({ correct: true, answer: item.answer });
    assert.ok(correct.classList.contains('is-answer')); assert.ok(options.every(button => button.disabled));
    scene.destroy(); correct.onclick(); assert.equal(ctx.submitted.length, 1);
  }
  data.setInputScript('abc');
});

test('Sound Match wrong answer highlights one correct picture and shows its word', async () => {
  const ctx = context('soundmatch', 'hard'), scene = soundmatch.create(ctx);
  const item = core.buildRound('soundmatch', 'hard', core.mulberry32(3)).items[0];
  scene.present(item); scene.setInputEnabled(true);
  const options = ctx.mount.querySelectorAll('.brain-sound__choice');
  options.find(button => button.dataset.value !== item.answer).onclick();
  assert.equal(core.gradeItem(item, ctx.submitted[0]).got, 0);
  await scene.showFeedback({ correct: false, answer: item.answer });
  assert.equal(options.filter(button => button.classList.contains('is-answer')).length, 1);
  assert.ok(ctx.mount.querySelector('.brain-corrective').textContent.includes(item.answer));
  scene.destroy();
});

test('language items retain a playable generic choice fallback', () => {
  for (const gameId of ['sentence', 'soundmatch']) {
    const ctx = context(gameId), scene = generic.create(ctx);
    const item = JSON.parse(JSON.stringify(core.buildRound(gameId, 'tot', core.mulberry32(1)).items[0]));
    scene.present(item); scene.setInputEnabled(true);
    const choices = ctx.mount.querySelectorAll('.brain-key');
    assert.equal(choices.length, 4);
    choices.find(button => button.dataset.v === item.answer).onclick();
    assert.deepEqual(ctx.submitted, [item.answer]);
    scene.destroy();
  }
});

test('new sound tasks speak and reveal the cue, then explain the answer and support a fresh retry', async () => {
  for (const script of ['abc', 'bpmf']) {
    data.setInputScript(script);
    const round = core.buildRound('soundmatch', 'hard', core.mulberry32(18));
    for (const item of round.items.slice(0, 2)) {
      const ctx = context('soundmatch', 'hard'), scene = soundmatch.create(ctx);
      scene.present(item); scene.setInputEnabled(true);
      assert.deepEqual(ctx.spoken[0], item.prompt.speech);
      assert.equal(ctx.mount.querySelector('.brain-sound__instruction').textContent, item.prompt.instruction.join(''));
      ctx.mount.querySelector('.brain-sound__reveal').onclick();
      assert.ok(ctx.mount.querySelector('.brain-sound__clue').textContent.includes(item.prompt.clue));
      const wrong = ctx.mount.querySelectorAll('.brain-sound__choice').find(button => button.dataset.value !== item.answer);
      wrong.onclick(); await scene.showFeedback({ correct: false, answer: item.answer });
      assert.ok(ctx.mount.querySelector('.brain-corrective').textContent.includes(item.lesson.explanation[1]));
      scene.present(JSON.parse(JSON.stringify(item))); scene.setInputEnabled(true);
      ctx.mount.querySelectorAll('.brain-sound__choice').find(button => button.dataset.value === item.answer).onclick();
      assert.equal(ctx.submitted.length, 2); assert.equal(ctx.submitted[1], item.answer);
      scene.destroy();
    }
  }
  data.setInputScript('abc');
});

test('saved Sound Match items without lesson or mode still play, reveal and grade', async () => {
  const item = {
    prompt: { type: 'soundmatch', script: 'abc', word: ['cat', '貓'], picture: '🐱', clue: 'cat', pictures: true, spelling: false,
      options: [['cat', '🐱', '貓'], ['dog', '🐶', '狗'], ['bird', '🐦', '鳥'], ['fish', '🐟', '魚']].map(([value, picture, zh]) => ({ value, picture, label: [value, zh] })) },
    answer: 'cat', choices: ['cat', 'dog', 'bird', 'fish']
  };
  const ctx = context('soundmatch'), scene = soundmatch.create(ctx);
  scene.present(JSON.parse(JSON.stringify(item))); scene.setInputEnabled(true);
  assert.deepEqual(ctx.spoken, [['cat', '']]);
  ctx.mount.querySelector('.brain-sound__reveal').onclick();
  assert.equal(ctx.mount.querySelector('.brain-sound__clue').textContent, 'cat · 貓');
  ctx.mount.querySelector('.brain-sound__choice').onclick();
  assert.equal(core.gradeItem(item, ctx.submitted[0]).correct, true);
  await scene.showFeedback({ correct: true, answer: item.answer });
  assert.ok(ctx.mount.querySelector('.brain-corrective').textContent.includes('cat'));
  scene.destroy();
});
