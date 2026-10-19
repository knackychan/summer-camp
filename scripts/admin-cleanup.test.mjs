// Pure helpers of Admin → Settings → Clean up (docs/plans/2026-10-09-admin-cleanup/ D5, D6).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('../js/admin-cleanup.js');

const asks = [
  { id: 'a1', kid_id: 'luis', kind: 'question', body: 'Can I go out?\nplease', answer: 'Yes\nafter lunch', created_at: '2026-10-09T02:00:00Z' },
  { id: 'a2', kid_id: 'lili', kind: 'question', body: null, audio_path: 'voices/x.webm', created_at: '2026-10-09T03:00:00Z' },
  { id: 'a3', kid_id: 'luis', kind: 'reward:movie_pick:20', body: 'Movie', created_at: '2026-10-08T03:00:00Z' },
  { id: 'a4', kid_id: 'luis', kind: 'question', body: 'old', answer_audio_path: 'voices/r.webm', created_at: '2026-10-07T03:00:00Z' }
];
const data = { asks, archivedIds: new Set(['a1', 'a4']), rewardIds: ['a3'] };

// Messages: newest first, kid text + Papa's reply, Archived and Reward tags.
let rows = C.buildRows('asks', data, { kid: 'all' });
assert.deepEqual(rows.map(r => r.id), ['a2', 'a1', 'a3', 'a4']);
assert.equal(rows[1].text, 'Can I go out?');
assert.deepEqual(rows[1].lines, ['Papa: Yes']);
assert.deepEqual(rows[1].tags, ['Archived']);
assert.equal(rows[0].text, 'Voice memo');
assert.deepEqual(rows[2].tags, ['Reward']);
assert.deepEqual(rows[3].lines, ['Papa: voice reply']);
rows = C.buildRows('asks', data, { kid: 'luis' });
assert.deepEqual(rows.map(r => r.id), ['a1', 'a3', 'a4'], 'kid filter');

// Summer chats: one row per exchange, first line of the reply, grouped by session.
const kidChats = [
  { id: 3, kid_id: 'lili', session_id: 's2', kid_text: 'why?', reply_en: 'Because.\nMore', created_at: '2026-10-09T05:00:00Z' },
  { id: 2, kid_id: 'lili', session_id: 's1', kid_text: 'hi', reply_en: 'Hello!', flagged: true, created_at: '2026-10-09T04:01:00Z' },
  { id: 1, kid_id: 'lili', session_id: 's1', kid_text: 'hey', reply_en: 'Hi', created_at: '2026-10-09T04:00:00Z' }
];
rows = C.buildRows('kid_chats', { kidChats }, {});
assert.deepEqual(rows.map(r => r.id), ['3', '2', '1'], 'bigint ids become text');
assert.deepEqual(rows[0].lines, ['Summer: Because.']);
assert.deepEqual(rows.map(r => r.groupStart), [true, true, false]);
assert.deepEqual(rows[1].tags, ['Flagged']);
assert.deepEqual(C.buildRows('kid_chats', { kidChats }, { kid: 'luis' }), []);

// Photos and passes.
rows = C.buildRows('photos', { photos: [{ id: 'p1', kid_id: 'luis', day: '2026-10-09', block_idx: 2, path: 'proofs/a.jpg', created_at: '2026-10-09T01:00:00Z' }, { id: 'p2', kid_id: 'lili', day: '2026-10-08', block_idx: null, path: 'proofs/b.jpg' }], blockTitle: i => ['Wake', 'Breakfast', 'Reading'][i] }, {});
assert.equal(rows[0].text, '2026-10-09 · Reading');
assert.equal(rows[1].text, '2026-10-08 · Dinner gallery');
rows = C.buildRows('passes', { passes: [{ id: 'g1', kid_id: 'luis', kind: 'golden', status: 'spent', reason: 'Great week', created_at: '2026-10-09T01:00:00Z' }, { id: 'e1', kid_id: 'luis', kind: 'excused', status: 'granted' }] }, {});
assert.equal(rows[0].text, 'Golden pass · spent');
assert.deepEqual(rows[0].lines, ['Great week']);
assert.deepEqual(rows[0].tags, ['Spent']);
assert.equal(rows[1].text, 'Excused pass · granted');

// Selection helpers never mutate.
const shown = C.buildRows('asks', data, {});
let sel = new Set();
sel = C.toggle(sel, 'a1'); assert.deepEqual([...sel], ['a1']);
const before = sel;
sel = C.toggle(sel, 'a1'); assert.equal(sel.size, 0); assert.equal(before.size, 1);
assert.equal(C.allSelected(shown, sel), false);
sel = C.toggleAll(shown, sel); assert.equal(sel.size, 4); assert.equal(C.allSelected(shown, sel), true);
sel = C.toggleAll(shown, sel); assert.equal(sel.size, 0);
assert.equal(C.allSelected([], new Set()), false, 'nothing shown is never "all selected"');
assert.deepEqual([...C.prune(C.buildRows('asks', data, { kid: 'lili' }), new Set(['a1', 'a2']))], ['a2']);

// Confirm and result wording.
let t = C.confirmText({ action: 'selected', category: 'asks', count: 2, rewardCount: 1 });
assert.equal(t.head, 'Delete 2 messages.');
assert.match(t.notes.join(' '), /1 reward request will be kept — reset points first to remove it\./);
assert.match(t.notes.join(' '), /Storage/);
assert.equal(t.notes.at(-1), 'This cannot be undone.');
t = C.confirmText({ action: 'archived', category: 'asks', kid: 'luis' });
assert.match(t.head, /every archived message for Luis/);
assert.match(t.notes[0], /Reward requests are kept/);
t = C.confirmText({ action: 'clear', category: 'passes', kid: 'all' });
assert.match(t.head, /every pass for every kid/);
assert.match(t.notes.join(' '), /not recomputed/);
assert.doesNotMatch(t.notes.join(' '), /Storage/);
assert.equal(C.confirmText({ action: 'selected', category: 'kid_chats', count: 1 }).head, 'Delete 1 chat message.');
assert.equal(C.resultText('asks', { deleted: 3, skipped: 2 }), '3 messages deleted, 2 reward requests kept — reset points first to remove them');
assert.equal(C.resultText('photos', { deleted: 1, skipped: 0 }), '1 photo deleted');

// Points reset card.
const totals = [{ kid_id: 'luis', available: 600, pending: 20, total_earned: 800 }, { kid_id: 'lili', available: 0, pending: 0, total_earned: 0 }];
assert.equal(C.balanceText(totals, 'luis'), '600 points available · 20 pending · 800 earned');
assert.match(C.balanceText(totals, 'all'), /^Luis: 600 points available.*Lili: 0 points available/);
assert.equal(C.balanceText([], 'luis'), 'No points recorded');
assert.equal(C.resetText({ kids: 1 }), 'Points reset to 0 for 1 kid');
assert.equal(C.resetText({ kids: 3 }), 'Points reset to 0 for 3 kids');
assert.equal(C.resetText({ kids: 1, progress: true }), 'Points and progress reset for 1 kid');
assert.match(C.resetScopeText(true), /Brain Gym, word mastery/);
assert.match(C.resetScopeText(false), /Brain Gym and learning stay/);
console.log('admin-cleanup: rows, filters, selection, confirm and result wording OK');
