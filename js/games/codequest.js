import { createScheduler } from '../game-services/scheduler.js';
import { CodeQuestModel } from './codequest/model.js';
import { LEVELS, generateEndless } from './codequest/levels.js';
import { action, repeat, ifNode, call, combinedBlockCount, toJavaScript } from './codequest/ast.js';
import { parseJavaScript, CODE_API } from './codequest/parser.js';
import { normalizeProfile, recordLevelComplete, recordEndlessClear, modeFor, equipmentDescriptor, equipmentFor, weaponFor, combatStatsFor, equip, claimLoot, consumePotion, scoreForProfile, setActiveDungeonRun, finishDungeonRun, abandonDungeonRun, saveRuneLibrary, loadRuneLibrary, saveBehaviorSource, setBehaviorEnabled, behaviorFor, CODEQUEST_EQUIPMENT } from './codequest/progression.js';
import { createDungeonRun, normalizeDungeonRun, roomMeta, roomGraph, nextRooms, enterDungeonRoom, resolveRunChoice, completeCombatRoom, failDungeonRun, expeditionLevel, dungeonRunSummary, hazardInfo, sigilsRequired, saveRunLoadout, activateRunLoadout } from './codequest/run.js';
import { spriteURL } from './codequest/pixel-art.js';
import { previewPath } from './codequest/preview.js';
import { drawRoom, MAX_ZOOM, ROOM_VIEW } from './codequest/room-view.js';
import { placeBubbleRect } from './codequest/bubble.js';
import { IF_TESTS, repeatCounts, ifTests, insertAfter, canUnwrap, unwrap, setRepeatCount, nextRepeatCount, setCondition, extendSelection } from './codequest/strip-edit.js';
import { COMMANDS, CONDITIONS, LOGIC, UI, ITEM_LABELS, MESSAGES, SHORT, LAB, pairHTML, setLanguage, language, t } from './codequest/strings.js';
import { mountLab } from './codequest/lab/lab-screen.js';

let S = null;
// Host settings bar (game-fs top row, beside Back). Kept across stop(): the host renders the bar before init().
let BAR = null;
const pair = (en, zh) => pairHTML([en, zh]);
const label = value => pairHTML(value);
const button = (actionId, content, attrs = '') => '<button type="button" data-action="' + actionId + '" ' + attrs + '>' + content + '</button>';
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

function settingsRoot(ctx) {
  const settings = ctx.settings;
  if (!settings.codequest || typeof settings.codequest !== 'object' || Array.isArray(settings.codequest)) settings.codequest = {};
  if (!settings.codequest.profiles || typeof settings.codequest.profiles !== 'object' || Array.isArray(settings.codequest.profiles)) settings.codequest.profiles = {};
  return settings.codequest.profiles;
}

function saveProfile() {
  if (!S) return;
  settingsRoot(S.ctx)[S.ctx.kid] = S.profile;
  S.ctx.saveSettings();
}
function saveRun(run, captureCode = false) {
  if (!S) return null;
  const next = normalizeDungeonRun(captureCode && run ? { ...run, code:sourceFromAst() } : run);
  S.run = next; S.profile = setActiveDungeonRun(S.profile, next); saveProfile(); return next;
}
function restoreRunCode(run) {
  if (!run || !run.code) return false;
  const parsed = parseJavaScript(run.code); if (!parsed.ok) return false;
  S.program = parsed.program; const parsedFns = { ...parsed.functions };
  if (Array.isArray(parsedFns.rune)) { S.runeProgram = parsedFns.rune.slice(); delete parsedFns.rune; } else S.runeProgram = [];
  S.extraFunctions = parsedFns; S.selectedMain.clear(); S.selectedRune.clear(); syncCodeFromAst(); return true;
}

function currentProgram() { return S.editor === 'rune' ? S.runeProgram : S.program; }
function currentSelection() { return S.editor === 'rune' ? S.selectedRune : S.selectedMain; }
function functions() {
  return { ...S.extraFunctions, ...(S.runeProgram.length ? { rune: S.runeProgram } : {}) };
}
function behaviorAllowedForLevel(level = S && S.level) {
  if (!level) return false;
  const match = /^q(\d+)$/.exec(level.id || '');
  return Boolean(level.expedition || level.endless || (match && Number(match[1]) >= 59));
}
function eachBehaviorNode(value, visit, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) { for (const item of value) eachBehaviorNode(item, visit, seen); return; }
  if (typeof value.type === 'string') visit(value);
  for (const child of Object.values(value)) eachBehaviorNode(child, visit, seen);
}
function behaviorOwnershipOK(parsed, owner) {
  let ok = true;
  eachBehaviorNode([parsed.program, ...Object.values(parsed.functions || {})], node => {
    if (!ok) return;
    if (node.type === 'action') {
      const actor = String(node.op || '').startsWith('companion') ? 'companion' : 'hero';
      if (actor !== owner) ok = false;
    } else if ((node.type === 'state' || node.type === 'signal') && node.actor !== owner) ok = false;
    else if ((node.type === 'target' || node.type === 'target-ref') && owner !== 'hero') ok = false;
  });
  return ok;
}
function persistentBehaviors() {
  if (!behaviorAllowedForLevel()) return [];
  const bundles = [];
  for (const owner of ['hero','companion']) {
    const saved = behaviorFor(S.profile, owner);
    if (!saved.enabled || !saved.source.trim()) continue;
    const parsed = parseJavaScript(saved.source);
    if (!parsed.ok || !parsed.program.length || parsed.program.some(node => node.type !== 'on')) continue;
    bundles.push({ owner, program: parsed.program, functions: parsed.functions, source:'persistent' });
  }
  return bundles;
}
function sourceFromAst() { return toJavaScript(S.program, functions()); }
function syncCodeFromAst() {
  if (!S) return;
  S.codeDraft = sourceFromAst(); S.codeDirty = false; S.codeError = null;
}
function setCurrentProgram(next) {
  if (S.editor === 'rune') S.runeProgram = next; else S.program = next;
  currentSelection().clear();
  syncCodeFromAst();
}
function uid(prefix) { S.serial++; return prefix + '-' + S.serial; }

function pushUndo() {
  S.undo.push({ program: S.program.slice(), runeProgram: S.runeProgram.slice(), extraFunctions: { ...S.extraFunctions } });
  if (S.undo.length > 40) S.undo.shift();
}
function restoreUndo() {
  const previous = S.undo.pop();
  if (!previous) return false;
  S.program = previous.program; S.runeProgram = previous.runeProgram; S.extraFunctions = { ...(previous.extraFunctions || {}) };
  S.selectedMain.clear(); S.selectedRune.clear(); syncCodeFromAst();
  return true;
}

function notify(message, zh) {
  if (!S) return;
  const text = Array.isArray(message) ? message : [message, zh || message];
  S.notice = text; S.noticeAt = performance.now();
  const node = S.root.querySelector('.cq-notice');
  if (node) node.innerHTML = label(text);
  if (S.bubble) { S.bubble.innerHTML = label(text); S.bubble.hidden = !!(S.dialog || S.paused); }
}
/** Screen-reader only: routine edits should not pop a bubble over the hero. */
function announce(text) {
  const node = S && S.root.querySelector('.cq-notice');
  if (node) node.innerHTML = label(text);
}

function modeLabel() { return UI[modeFor(S.profile)] || UI.explorer; }
function kidColor() { return S.ctx.kids && S.ctx.kids[S.ctx.kid] && S.ctx.kids[S.ctx.kid].color || '#39d0c8'; }

/* ---------- card art: pixel sprites for things, small vector glyphs for motion and logic ---------- */
const GLYPHS = {
  move: '<path d="M12 2 L21 12 H15.5 V22 H8.5 V12 H3 Z"/>',
  turnLeft: '<path d="M9 3 L2 9.5 L9 16 V12 H14 Q17 12 17 15 V22 H21.5 V14.5 Q21.5 7.5 14 7.5 H9 Z"/>',
  turnRight: '<path d="M15 3 L22 9.5 L15 16 V12 H10 Q7 12 7 15 V22 H2.5 V14.5 Q2.5 7.5 10 7.5 H15 Z"/>',
  wait: '<path d="M5 2 H19 V7 L14 12 L19 17 V22 H5 V17 L10 12 L5 7 Z M8 4.5 V6 L12 10 L16 6 V4.5 Z"/>',
  repeat: '<path d="M3 11 Q3 5 10 5 H15 V1.5 L21 7 L15 12.5 V9 H10 Q7 9 7 12 Z M21 13 Q21 19 14 19 H9 V22.5 L3 17 L9 11.5 V15 H14 Q17 15 17 12 Z"/>',
  if: '<path d="M7 8 Q7 2.5 12 2.5 Q17 2.5 17 7.5 Q17 11 13.5 12.5 V15 H10.5 V10.5 Q14 9.5 14 7.5 Q14 5.5 12 5.5 Q10 5.5 10 8 Z M10.5 17.5 H13.5 V21 H10.5 Z"/>',
  call: '<path d="M15.5 2.5 Q11 2.5 10.5 7 L10.2 9 H7 V12 H9.8 L8.6 19 Q8.3 21 6.5 21 H5 V23.5 H7 Q11 23.5 11.6 19 L12.8 12 H16 V9 H13.2 L13.5 7.2 Q13.8 5.3 15.5 5.3 H18 V2.5 Z"/>',
  target: '<path d="M11 1 H13 V7 H11 Z M11 17 H13 V23 H11 Z M1 11 H7 V13 H1 Z M17 11 H23 V13 H17 Z M12 8 A4 4 0 1 1 11.99 8 Z M12 10.5 A1.5 1.5 0 1 0 12.01 10.5 Z"/>',
  data: '<path d="M4 4 H10 V7 H7 V17 H10 V20 H4 Z M14 4 H20 V20 H14 V17 H17 V7 H14 Z"/>',
  play: '<path d="M6 3 L21 12 L6 21 Z"/>',
  step: '<path d="M3 4 L13 12 L3 20 Z M15 4 H20 V20 H15 Z"/>',
  reset: '<path d="M12 3 Q20.5 3 20.5 12 Q20.5 21 12 21 Q5.5 21 3.8 15 H7.2 Q8.6 17.8 12 17.8 Q17.3 17.8 17.3 12 Q17.3 6.2 12 6.2 Q9.3 6.2 7.9 8.2 L11 11 H2.5 V2.5 L5.6 5.6 Q8 3 12 3 Z"/>',
  undo: '<path d="M9 3 L2 9.5 L9 16 V12 H14 Q17.5 12 17.5 15.5 Q17.5 19 14 19 H11 V22.5 H14 Q21.5 22.5 21.5 15.5 Q21.5 8 14 8 H9 Z"/>',
  left: '<path d="M15 3 L6 12 L15 21 Z"/>', right: '<path d="M9 3 L18 12 L9 21 Z"/>',
  remove: '<path d="M5 3 L12 10 L19 3 L21 5 L14 12 L21 19 L19 21 L12 14 L5 21 L3 19 L10 12 L3 5 Z"/>',
  trash: '<path d="M8 2 H16 V4 H21 V7 H3 V4 H8 Z M5 8 H19 L18 22 H6 Z M9 10 V20 H11 V10 Z M13 10 V20 H15 V10 Z"/>',
  flag: '<path d="M4 2 H7 V23 H4 Z M8 3 H20 L17 8 L20 13 H8 Z"/>',
  bug: '<path d="M9 3 H15 V6 H9 Z M6 7 H18 V18 Q18 22 12 22 Q6 22 6 18 Z M2 9 H5 V11 H2 Z M19 9 H22 V11 H19 Z M2 15 H5 V17 H2 Z M19 15 H22 V17 H19 Z M11 9 V20 H13 V9 Z"/>'
};
const glyph = name => '<svg class="cq-ico" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">' + (GLYPHS[name] || GLYPHS.data) + '</svg>';
const sprite = id => '<img class="cq-spr" src="' + spriteURL(id, kidColor()) + '" alt="">';

function actionIcon(op) {
  if (op === 'move' || op === 'companionMove') return glyph('move');
  if (op === 'turnLeft' || op === 'companionTurnLeft') return glyph('turnLeft');
  if (op === 'turnRight' || op === 'companionTurnRight') return glyph('turnRight');
  if (op === 'wait') return glyph('wait');
  if (op.startsWith('target')) return glyph('target');
  if (op === 'attack' || op === 'heavyAttack' || op === 'cast') { const gear = weaponFor(S.profile); return sprite(gear.spriteId || gear.id); }
  if (op === 'guard') return sprite('guardCape');
  if (op === 'open') return sprite('chest-closed');
  if (op === 'usePotion') return sprite('potion');
  if (op === 'useAntidote') return sprite('antidote');
  if (op === 'useWard') return sprite('ward');
  if (op === 'disarm') return sprite('trap-active');
  if (op === 'interact' || op === 'companionInteract') return sprite('lever-off');
  if (op === 'smash') return sprite('crate');
  if (op === 'push' || op === 'companionPush') return sprite('push-block');
  if (op === 'take' || op === 'throw' || op === 'companionTake' || op === 'companionThrow') return sprite('rune-core');
  if (op.startsWith('companion')) return sprite('companion');
  return glyph('data');
}
function logicIcon(id) { return glyph(id.startsWith('repeat') ? 'repeat' : id.startsWith('if') ? 'if' : 'call'); }

/** Colour family of a card (redesign design.md, Screen): move blue, turn purple, attack red,
    interact gold, care green, companion teal, loops/logic violet, functions magenta. */
function opCategory(op) {
  if (op === 'move') return 'move';
  if (op === 'turnLeft' || op === 'turnRight') return 'turn';
  if (op.startsWith('companion')) return 'ally';
  if (['attack', 'heavyAttack', 'cast', 'smash'].includes(op) || op.startsWith('target')) return 'attack';
  if (['open', 'interact', 'disarm', 'take', 'throw', 'push'].includes(op)) return 'use';
  return 'care';
}
function nodeCategory(node) {
  if (node.type === 'action') return opCategory(node.op);
  if (node.type === 'target') return 'attack';
  if (node.type === 'repeat' || node.type === 'forOf') return 'loop';
  if (node.type === 'if') return 'logic';
  if (node.type === 'call' || node.type === 'on') return 'func';
  return 'data';
}
function logicCategory(id) { return id.startsWith('repeat') ? 'loop' : id.startsWith('if') ? 'logic' : 'func'; }

function nodeTitle(node) {
  if (node.type === 'action') return COMMANDS[node.op] || [node.op, node.op];
  if (node.type === 'target') { const line = toJavaScript([node], {}).split('\n')[0]; return [line, line]; }
  if (node.type === 'repeat') { const count = typeof node.times === 'number' ? node.times : toJavaScript([node], {}).split('\n')[0].replace(/^repeat\(|,.*$/g, ''); return ['Repeat ×' + count, '重複 ×' + count]; }
  if (node.type === 'if') { const test = typeof node.test === 'string' && CONDITIONS[node.test] ? CONDITIONS[node.test] : ['expression', '運算式']; return ['IF ' + test[0], '如果' + test[1]]; }
  if (node.type === 'call') return ['Call ' + node.name + '(' + ((node.args && node.args.length) ? '…' : '') + ')', '呼叫 ' + node.name + '(' + ((node.args && node.args.length) ? '…' : '') + ')'];
  if (node.type === 'let' || node.type === 'return') { const line = toJavaScript([node], {}).split('\n')[0]; return [line, line]; }
  if (node.type === 'forOf') return ['For each enemy', '逐一敵人'];
  if (node.type === 'on') return ['On ' + node.event + ' → ' + node.name, '當 ' + node.event + ' → ' + node.name];
  return ['Program block', '程式積木'];
}
/** The one or two words printed on a card. */
function nodeShort(node) {
  if (node.type === 'action') return SHORT[node.op] || COMMANDS[node.op] || [node.op, node.op];
  if (node.type === 'repeat') { const n = typeof node.times === 'number' ? node.times : '?'; return ['×' + n, '×' + n]; }
  if (node.type === 'forOf') return ['each', '每個'];
  if (node.type === 'if') return typeof node.test === 'string' && CONDITIONS[node.test] ? CONDITIONS[node.test] : ['test', '條件'];
  if (node.type === 'call') return node.name === 'rune' ? SHORT.call : [node.name, node.name];
  return nodeTitle(node);
}
function nodeIcon(node) {
  if (node.type === 'action') return actionIcon(node.op);
  if (node.type === 'target') return glyph('target');
  if (node.type === 'repeat' || node.type === 'forOf') return glyph('repeat');
  if (node.type === 'if') return glyph('if');
  if (node.type === 'call' || node.type === 'on') return glyph('call');
  return glyph('data');
}
const running = node => !!(node.uid && node.uid === S.activeUid);

function codeUnlocked() { return modeFor(S.profile) === 'architect'; }
function allowedRepresentations() {
  const mode = modeFor(S.profile);
  if (mode === 'explorer') return ['picture'];
  if (mode === 'builder') return ['picture', 'blocks'];
  return ['picture', 'blocks', 'hybrid'];
}
function defaultRepresentation() {
  const mode = modeFor(S.profile);
  if (mode === 'explorer') return 'picture';
  if (mode === 'builder') return 'blocks';
  return 'hybrid';
}

/* ---------- program strip (redesign slice 04) ---------- */
function miniCards(nodes) {
  if (!nodes.length) return '<span class="cq-mini empty">' + glyph('data') + '</span>';
  return nodes.map(node => {
    const cls = 'cat-' + nodeCategory(node) + (running(node) ? ' executing' : '');
    if (node.type === 'repeat' || node.type === 'forOf') return '<span class="cq-mini-bracket ' + cls + '"><i>' + label(nodeShort(node)) + '</i>' + miniCards(node.body) + '</span>';
    if (node.type === 'if') return '<span class="cq-mini-bracket ' + cls + '"><i>?</i>' + miniCards(node.then) + (node.else.length ? '<em>' + label(SHORT.else) + '</em>' + miniCards(node.else) : '') + '</span>';
    return '<span class="cq-mini ' + cls + '" title="' + esc(t(nodeTitle(node))) + '">' + nodeIcon(node) + '</span>';
  }).join('');
}
function stripCard(node, index, selected) {
  const cls = 'cat-' + nodeCategory(node) + (selected ? ' selected' : '') + (running(node) ? ' executing' : '') + (node.uid && node.uid === S.justAdded ? ' just-added' : '');
  const head = '<i class="cq-num">' + (index + 1) + '</i>' + nodeIcon(node) + '<b>' + label(nodeShort(node)) + '</b>';
  const attrs = 'aria-pressed="' + selected + '" aria-label="' + esc((index + 1) + '. ' + t(nodeTitle(node))) + '"';
  if (node.type === 'repeat' || node.type === 'forOf' || node.type === 'if') {
    const body = node.type === 'if' ? miniCards(node.then) + (node.else.length ? '<em>' + label(SHORT.else) + '</em>' + miniCards(node.else) : '') : miniCards(node.body);
    return '<div class="cq-bracket ' + cls + '">' + button('select:' + index, head, 'class="cq-bracket-head" ' + attrs) + '<div class="cq-bracket-body">' + body + '</div></div>';
  }
  return button('select:' + index, head, 'class="cq-card ' + cls + '" ' + attrs);
}
function stripHTML() {
  const nodes = currentProgram(), selected = currentSelection();
  const free = Math.max(0, S.level.maxBlocks - combinedBlockCount(S.program, functions()));
  const shown = Math.min(free, 6);
  const slots = Array.from({ length: shown }, (_, i) => '<span class="cq-slot" aria-hidden="true">' + (i === 0 ? '+' : '') + '</span>').join('') + (free > shown ? '<span class="cq-slot more" aria-hidden="true">+' + (free - shown) + '</span>' : '');
  return nodes.map((node, i) => stripCard(node, i, selected.has(i))).join('') + slots;
}
function stripTabsHTML() {
  if (!S.level.available.logic.includes('callRune')) return '';
  // One 48 px toggle: it names the strip being edited; tapping it switches Main ⇄ Rune.
  const rune = S.editor === 'rune';
  return button(rune ? 'strip:main' : 'strip:rune', glyph(rune ? 'call' : 'play') + '<b>' + label(rune ? SHORT.call : ['Main', '主程式']) + '</b>',
    'class="cq-strip-toggle' + (rune ? ' rune' : '') + '" aria-pressed="' + rune + '" aria-label="' + esc(t(rune ? ['Editing Rune. Tap for Main.', '正在編輯符文，點一下回主程式。'] : ['Editing Main. Tap for Rune.', '正在編輯主程式，點一下編輯符文。'])) + '"');
}
/* Card tools live on the card menu (UX polish U3); the strip end keeps only program-level tools. */
function toolsHTML() {
  return button('undo', glyph('undo'), 'class="cq-tool" aria-label="' + esc(t(UI.undo)) + '" ' + (S.undo.length ? '' : 'disabled')) +
    button('clear', glyph('trash'), 'class="cq-tool" aria-label="' + esc(t(UI.clear)) + '" ' + (currentProgram().length ? '' : 'disabled'));
}
/* Floating card menu (UX polish slice 08): opens over the tapped card(s). One card:
   move, remove, and Wrap (action cards) or count / test / Unwrap (brackets). A run of
   cards: Wrap and remove. Wrap choices are only the room's own logic cards. */
function menuVisible() {
  return !!(S.menuOpen && currentSelection().size && !S.dialog && !S.paused && !S.autoRun && S.model.phase === 'programming');
}
function menuButton(actionId, inner, aria, extra = '') {
  return button(actionId, inner, 'class="cq-menu-btn' + (extra ? ' ' + extra : '') + '" aria-label="' + esc(t(aria)) + '"' + (/\boff\b/.test(extra) ? ' disabled' : ''));
}
function wrapWords(id) {
  const n = Number(id.replace('repeat', '')) || 2;
  return id.startsWith('repeat') ? ['×' + n, '×' + n] : IF_TESTS[id] && CONDITIONS[IF_TESTS[id]] ? CONDITIONS[IF_TESTS[id]] : LOGIC[id];
}
function cardMenuHTML() {
  const list = currentProgram(), picked = [...currentSelection()].sort((a, b) => a - b);
  const one = picked.length === 1 ? picked[0] : -1, node = one >= 0 ? list[one] : null;
  const logicIds = S.level.available.logic, counts = repeatCounts(logicIds), tests = ifTests(logicIds);
  const wrapIds = logicIds.filter(id => id !== 'callRune');
  const bracket = node && (node.type === 'repeat' || node.type === 'if' || node.type === 'forOf');
  const row = [];
  if (node) row.push(menuButton('nudge:-1', glyph('left'), UI.moveLeft, one === 0 ? 'off' : ''));
  if (node && node.type === 'repeat' && typeof node.times === 'number' && counts.length > 1) row.push(menuButton('menu:count', glyph('repeat') + '<b>×' + node.times + '</b>', UI.repeatCount, 'wide'));
  if (node && canUnwrap(node)) row.push(menuButton('menu:unwrap', glyph('data') + '<b>' + label(UI.unwrap) + '</b>', UI.unwrap, 'wide'));
  if (!bracket && wrapIds.length) row.push(menuButton('menu:wrap', glyph('repeat') + '<b>' + label(UI.wrap) + '</b>', UI.wrap, 'wide' + (S.menuWrap ? ' on' : '')));
  row.push(menuButton('delete', glyph('remove'), UI.removeCard));
  if (node) row.push(menuButton('nudge:1', glyph('right'), UI.moveRight, one === list.length - 1 ? 'off' : ''));
  let second = '';
  if (node && node.type === 'if' && tests.length > 1) {
    second = tests.map(([id, test]) => button('menu:test:' + id, glyph('if') + '<b>' + label(CONDITIONS[test] || LOGIC[id]) + '</b>',
      'class="cq-menu-btn wide cat-logic' + (node.test === test ? ' on' : '') + '" aria-pressed="' + (node.test === test) + '" aria-label="' + esc(t(LOGIC[id] || CONDITIONS[test])) + '"')).join('');
  } else if (!bracket && S.menuWrap && wrapIds.length) {
    second = wrapIds.map(id => button('logic:' + id, logicIcon(id) + '<b>' + label(wrapWords(id)) + '</b>',
      'class="cq-menu-btn wide cat-' + logicCategory(id) + '" aria-label="' + esc(t(LOGIC[id])) + '"')).join('');
  }
  return '<div class="cq-menu-row">' + row.join('') + '</div>' + (second ? '<div class="cq-menu-row cq-menu-choices">' + second + '</div>' : '');
}
function cardElement(index) {
  const head = S.root.querySelector('.cq-strip [data-action="select:' + index + '"]');
  return head && head.classList.contains('cq-bracket-head') ? head.parentElement : head;
}
function renderMenu() {
  const menu = S.root.querySelector('.cq-card-menu');
  if (!menu) return;
  const show = menuVisible();
  menu.hidden = !show;
  if (!show) return;
  menu.innerHTML = cardMenuHTML();
  placeMenu();
}
/** Sit the menu above the selected cards, clamped to the play area; it follows the strip's scroll. */
function placeMenu() {
  const menu = S.root.querySelector('.cq-card-menu'), play = S.root.querySelector('.cq-play');
  if (!menu || menu.hidden || !play) return;
  const rects = [...currentSelection()].map(cardElement).filter(Boolean).map(el => el.getBoundingClientRect());
  if (!rects.length) { menu.hidden = true; return; }
  const box = play.getBoundingClientRect();
  const left = Math.min(...rects.map(r => r.left)), right = Math.max(...rects.map(r => r.right)), top = Math.min(...rects.map(r => r.top));
  const w = menu.offsetWidth, h = menu.offsetHeight, cx = (left + right) / 2 - box.left;
  const x = Math.max(4, Math.min(box.width - w - 4, cx - w / 2)), y = Math.max(4, top - box.top - h - 12);
  menu.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  menu.style.setProperty('--tail', Math.round(Math.max(18, Math.min(w - 18, cx - x))) + 'px');
}
function closeMenu() {
  if (!S || !S.menuOpen) return;
  S.menuOpen = false; S.menuWrap = false;
  const menu = S.root.querySelector('.cq-card-menu'); if (menu) menu.hidden = true;
}
function menuAction(actionId) {
  const list = currentProgram(), picked = [...currentSelection()], index = picked.length === 1 ? picked[0] : -1;
  const logicIds = S.level.available.logic, counts = repeatCounts(logicIds);
  if (actionId === 'menu:wrap') { S.menuWrap = !S.menuWrap; renderMenu(); return; }
  let next = null;
  if (actionId === 'menu:unwrap') next = unwrap(list, index);
  else if (actionId === 'menu:count' && list[index]) next = setRepeatCount(list, index, nextRepeatCount(list[index].times, counts), counts);
  else if (actionId.startsWith('menu:test:')) next = setCondition(list, index, IF_TESTS[actionId.slice(10)], ifTests(logicIds).map(pair => pair[1]));
  if (!next) return;
  pushUndo(); setCurrentProgram(next);
  // Count / test edits keep the bracket selected so the kid can keep tapping; Unwrap closes the menu.
  if (actionId === 'menu:unwrap') { closeMenu(); announce(['Cards unwrapped.', '卡片已拆開。']); }
  else { currentSelection().add(index); announce(['Card changed.', '卡片已更改。']); }
  render();
}
function libraryHTML() {
  const level = S.level;
  const actions = level.available.actions.map(op => button('add:' + op, actionIcon(op) + '<b>' + label(SHORT[op] || COMMANDS[op]) + '</b>', 'class="cq-cmd cat-' + opCategory(op) + '" aria-label="' + esc(t(COMMANDS[op])) + '"')).join('');
  const logic = level.available.logic.map(id => {
    const n = Number(id.replace('repeat', '')) || 2;
    const words = id.startsWith('repeat') ? ['×' + n, '×' + n] : id === 'callRune' ? SHORT.call : LOGIC[id];
    return button('logic:' + id, logicIcon(id) + '<b>' + label(words) + '</b>', 'class="cq-cmd cat-' + logicCategory(id) + '" aria-label="' + esc(t(LOGIC[id])) + '"');
  }).join('');
  return actions + logic;
}

function runeLibraryHTML() {
  const slots=(S.profile.runeLibrary||[]).map((source,index)=>'<div class="cq-library-slot"><b>LIB '+(index+1)+'</b>'+button('library:save:'+index,pair('Save','儲存'))+button('library:load:'+index,pair('Load','載入'),source&&source.trim()?'':'disabled')+'</div>').join('');
  const behaviorRow = owner => {
    const saved = behaviorFor(S.profile, owner), hero = owner === 'hero';
    return '<div class="cq-behavior-row"><b>'+pair(hero?'HERO BEHAVIOR':'COMPANION BEHAVIOR',hero?'英雄行為':'夥伴行為')+'</b>'+button('behavior:save:'+owner,pair('Save current handlers','儲存目前處理器'))+button('behavior:toggle:'+owner,saved.enabled?pair('ON','開啟'):pair('OFF','關閉'),saved.source.trim()?'':'disabled')+'</div>';
  };
  return '<section class="cq-rune-library"><h4>'+pair('Rune Library','符文函式庫')+'</h4><p>'+pair('Save four programs plus independent Hero and Companion event behaviors. Persistent behaviors auto-load only in advanced rooms.','保存四組程式，以及英雄與夥伴各自獨立的事件行為。持續行為只會在進階房間自動載入。')+'</p><div>'+slots+'</div>'+behaviorRow('hero')+behaviorRow('companion')+'</section>';
}
function codeToolboxHTML() {
  const actions = availableCodeApiActions();
  const actionButtons = actions.map((line, i) => button('snippet:api:' + i, '<code>' + esc(line) + '</code>', 'class="cq-code-chip" data-code-line="' + esc(line) + '"')).join('');
  return '<aside class="cq-code-toolbox"><h3>' + label(UI.codeApi) + '</h3><div class="cq-code-chips">' + actionButtons + '</div><div class="cq-code-templates">' +
    button('snippet:if', '<code>if (...) { }</code>', 'class="cq-code-chip"') +
    button('snippet:else', '<code>if (...) { } else { }</code>', 'class="cq-code-chip"') +
    button('snippet:repeat', '<code>repeat(3, ...)</code>', 'class="cq-code-chip"') +
    button('snippet:variable', '<code>let steps = 3;</code>', 'class="cq-code-chip"') +
    button('snippet:function', '<code>function walk(steps) { }</code>', 'class="cq-code-chip"') +
    button('snippet:return', '<code>return steps;</code>', 'class="cq-code-chip"') +
    (S.profile.completed.includes('q37') ? button('snippet:foreach', '<code>for (const foe of enemies) { }</code>', 'class="cq-code-chip"') : '') +
    (S.profile.completed.includes('q58') ? button('snippet:event', '<code>on("danger", react);</code>', 'class="cq-code-chip"') : '') +
    (S.profile.completed.includes('q60') ? button('snippet:signal', '<code>hero.signal("ready");</code>', 'class="cq-code-chip"') : '') +
    (S.profile.completed.includes('q66') ? button('snippet:state', '<code>hero.state = "attack";</code>', 'class="cq-code-chip"') : '') +
    (S.profile.completed.includes('q68') ? button('snippet:mailbox', '<code>hero.signal.pending</code>', 'class="cq-code-chip"') : '') + '</div>' +
    (S.profile.completed.includes('q60') ? runeLibraryHTML() : '') + '<details><summary>' + pair('Sensors', '感測條件') + '</summary><pre><code>' + esc(CODE_API.conditions.join('\n')) + '</code></pre></details><details><summary>' + pair('RPG properties', 'RPG 物件屬性') + '</summary><pre><code>' + esc(CODE_API.properties.join('\n')) + '</code></pre></details></aside>';
}
function codeEditorHTML() {
  if (!codeUnlocked()) return '<section class="cq-code-locked"><b>🔒 ' + label(UI.code) + '</b><p>' + label(UI.codeLocked) + '</p><pre><code>' + esc(sourceFromAst()) + '</code></pre></section>';
  const error = S.codeError ? '<div class="cq-code-error" role="alert"><b>' + label(MESSAGES.codeError) + '</b><span>' + esc(S.codeError.message) + '</span><small>Ln ' + S.codeError.line + ' · Col ' + S.codeError.column + '</small></div>' : '';
  return '<section class="cq-code-editor"><div class="cq-code-editor-head"><div><b>' + label(UI.codeMain) + '</b><span>' + pair('Type the same dungeon logic as a safe JavaScript subset.', '用安全的 JavaScript 子集輸入同一套地下城邏輯。') + '</span></div><div class="cq-code-actions">' + button('code:reset', label(UI.resetCode)) + button('code:apply', label(UI.applyCode), 'class="cq-primary"') + '</div></div><div class="cq-code-layout"><div class="cq-code-paper"><textarea class="cq-code-input" aria-label="Code Quest JavaScript editor" spellcheck="false" autocomplete="off" autocapitalize="off">' + esc(S.codeDraft) + '</textarea>' + error + '<p class="cq-code-status">' + (S.codeDirty ? label(MESSAGES.codeChanged) : label(MESSAGES.codeApplied)) + '</p></div>' + codeToolboxHTML() + '</div></section>';
}
function debuggerHTML() {
  if (!behaviorAllowedForLevel()) return '';
  const snap=S.model.snapshot(), trace=(snap.trace||[]).slice(-8).reverse();
  const queue=(snap.messageQueue||[]).map(item=>'<span>#'+item.id+' '+esc(String(item.from).toUpperCase())+'→'+esc(String(item.to).toUpperCase())+' · '+esc(String(item.channel).toUpperCase())+'</span>').join('');
  const callbacks=(snap.callbackQueue||[]).map(item=>'<span>'+esc(String(item.owner||'main').toUpperCase())+' · '+esc(item.name||item.event)+'</span>').join('');
  const traceRows=trace.map(item=>{
    const bits=[item.actor&&String(item.actor).toUpperCase(),item.channel&&String(item.channel).toUpperCase(),item.name,item.op,item.to,item.from&&('FROM '+item.from)].filter(Boolean).map(esc).join(' · ');
    return '<li><b>'+item.n+'</b><code>'+esc(String(item.kind||'event').toUpperCase())+'</code><span>'+bits+'</span></li>';
  }).join('');
  return '<section class="cq-event-debugger"><div class="cq-debug-head"><b>'+pair('Event Debugger','事件除錯器')+'</b><span>'+pair('Current actor: '+String(snap.callbackOwner||'main').toUpperCase(),'目前角色：'+(snap.callbackOwner==='companion'?'夥伴':snap.callbackOwner==='hero'?'英雄':'主程式'))+'</span></div><div class="cq-debug-queues"><div><b>'+pair('MESSAGE QUEUE','訊息佇列')+' · '+(snap.messageQueue||[]).length+'</b>'+(queue||'<em>'+pair('empty','空')+'</em>')+'</div><div><b>'+pair('CALLBACK QUEUE','回呼佇列')+' · '+(snap.callbackQueue||[]).length+'</b>'+(callbacks||'<em>'+pair('empty','空')+'</em>')+'</div></div><ol>'+ (traceRows || '<li><span>'+pair('Run or Step to build a trace.','執行或單步以建立追蹤。')+'</span></li>') +'</ol></section>';
}
/* The </> Code sheet: written JavaScript, the hybrid mirror and the event debugger live
   here instead of on the main screen (redesign D4). */
function codeSheetHTML() {
  const head = '<div class="cq-dialog-head"><h2>' + label(['Code', '程式碼']) + '</h2>' + button('dialog:close', label(UI.close)) + '</div>';
  const body = codeUnlocked() ? codeEditorHTML() : '<section class="cq-code-view"><p class="cq-code-note">' + pair('Your cards, written as real JavaScript.', '你的卡片，寫成真正的 JavaScript。') + '</p><pre><code>' + esc(sourceFromAst()) + '</code></pre></section>';
  return head + '<div class="cq-sheet-body">' + body + debuggerHTML() + '</div>';
}

function objectives() {
  const snap = S.model.snapshot(), o = S.level.objective || {}, checks = [];
  if (o.reachExit) checks.push([snap.exit && snap.hero.x === snap.exit.x && snap.hero.y === snap.exit.y, 'Reach exit', '走到出口']);
  if (o.defeatAll) checks.push([!snap.enemies.some(e => e.hp > 0), 'Defeat enemies', '打敗敵人']);
  if (o.openAllChests) checks.push([!snap.chests.some(c => !c.open), 'Open chests', '打開寶箱']);
  if (o.collectAllKeys) checks.push([!snap.keys.some(k => !k.collected), 'Collect keys', '拿到鑰匙']);
  if (o.unlockAllDoors) checks.push([!snap.doors.some(d => !d.open), 'Unlock doors', '解鎖門']);
  if (o.disarmAllTraps) checks.push([!snap.traps.some(t => !t.disarmed), 'Disarm traps', '解除陷阱']);
  if (o.activateAllLevers) checks.push([!snap.levers.some(item => !item.active), 'Activate levers', '啟動拉桿']);
  if (o.activateAllPlates) checks.push([!snap.plates.some(item => !item.active), 'Activate plates', '啟動壓力板']);
  if (o.openAllRuneGates) checks.push([!snap.runeGates.some(item => !item.open), 'Open rune gates', '打開符文閘門']);
  if (o.breakAllCrates) checks.push([!snap.crates.some(item => !item.broken), 'Break obstacles', '擊破障礙物']);
  if (o.helpAllNpcs) checks.push([!snap.npcs.some(item => !item.helped), 'Interact with guide', '和嚮導互動']);
  if (o.satisfyCircuit) checks.push([S.model._mechanismsReady(), 'Satisfy circuit rule', '滿足迴路條件']);
  if (o.pushAllOntoPlates) checks.push([snap.pushBlocks.length > 0 && snap.pushBlocks.every(block => snap.plates.some(plate => plate.active && plate.x === block.x && plate.y === block.y)), 'Push blocks onto plates', '把方塊推上壓力板']);
  if (o.collectAllQuestTokens) checks.push([!snap.questTokens.some(item => !item.collected), 'Collect quest tokens', '收集任務符記']);
  if (o.completeNpcQuests) checks.push([!snap.npcs.some(item => item.questState !== 'complete'), 'Complete guide quest', '完成嚮導任務']);
  if (o.companionAssists) checks.push([(snap.companion && snap.companion.assists || 0) >= o.companionAssists, 'Companion assists ×' + o.companionAssists, '夥伴協助 ×' + o.companionAssists]);
  if (o.companionMoves) checks.push([(snap.stats && snap.stats.companionMoves || 0) >= o.companionMoves, 'Companion moves ×' + o.companionMoves, '夥伴移動 ×' + o.companionMoves]);
  if (o.placeAllOrbsOnPlates) checks.push([(snap.orbs || []).length > 0 && (snap.orbs || []).every(orb => !orb.heldBy && snap.plates.some(plate => plate.x === orb.x && plate.y === orb.y)), 'Place rune cores on plates', '把符文核心放到壓力板']);
  if (o.callbacksTriggered) checks.push([(snap.stats && snap.stats.callbacksTriggered || 0) >= o.callbacksTriggered, 'Event callbacks ×' + o.callbacksTriggered, '事件回呼 ×' + o.callbacksTriggered]);
  if (o.signalsSent) checks.push([(snap.stats && snap.stats.signalsSent || 0) >= o.signalsSent, 'Signals ×' + o.signalsSent, '訊號 ×' + o.signalsSent]);
  if (o.stateChanges) checks.push([(snap.stats && snap.stats.stateChanges || 0) >= o.stateChanges, 'State changes ×' + o.stateChanges, '狀態切換 ×' + o.stateChanges]);
  if (o.heroState) checks.push([snap.hero.state === o.heroState, 'Hero state · ' + String(o.heroState).toUpperCase(), '英雄狀態・' + String(o.heroState).toUpperCase()]);
  if (o.companionState) checks.push([snap.companion && snap.companion.state === o.companionState, 'Companion state · ' + String(o.companionState).toUpperCase(), '夥伴狀態・' + String(o.companionState).toUpperCase()]);
  if (o.companionInteractions) checks.push([(snap.stats && snap.stats.companionInteractions || 0) >= o.companionInteractions, 'Companion interactions ×' + o.companionInteractions, '夥伴互動 ×' + o.companionInteractions]);
  if (o.messageSequence) checks.push([(snap.deliveredSignals||[]).slice(0,o.messageSequence.length).every((value,index)=>value===o.messageSequence[index]), 'Messages · ' + o.messageSequence.join(' → ').toUpperCase(), '訊息・' + o.messageSequence.join(' → ').toUpperCase()]);
  if (o.minHp) checks.push([snap.hero.hp >= o.minHp, 'Finish with HP ' + o.minHp + '+', '完成時生命值至少 ' + o.minHp]);
  if (o.finishUnpoisoned) checks.push([!(snap.hero.statuses && snap.hero.statuses.poison > 0), 'Finish without poison', '完成時沒有中毒']);
  return checks;
}
function goalHTML() {
  const checks = objectives(), done = checks.filter(check => check[0]).length;
  return glyph('flag') + '<span class="cq-goal-text">' + label(S.level.objectiveText) + '</span>' + (checks.length > 1 ? '<i>' + done + '/' + checks.length + '</i>' : '');
}
function goalPopHTML() {
  const l = S.level, best = S.profile.bestBlocks[l.id] || 0;
  return '<b>' + label(l.title) + '</b><small>' + label(l.region.label) + ' · ' + label(l.concept) + '</small><p>' + label(l.objectiveText) + '</p>' +
    '<ul class="cq-checks">' + objectives().map(([done, en, zh]) => '<li class="' + (done ? 'done' : '') + '"><b>' + (done ? '◆' : '◇') + '</b>' + pair(en, zh) + '</li>').join('') + '</ul>' +
    '<small>' + pair('Par ' + l.parBlocks + ' blocks' + (best ? ' · your best ' + best : ''), '目標 ' + l.parBlocks + ' 個積木' + (best ? '・你的最佳 ' + best : '')) + '</small>';
}

const HEART = '<svg viewBox="0 0 7 6" aria-hidden="true"><path d="M1 0H3V1H4V0H6V1H7V3H6V4H5V5H4V6H3V5H2V4H1V3H0V1H1Z"/></svg>';
function chip(content, cls = '') { return '<span class="cq-chip' + (cls ? ' ' + cls : '') + '">' + content + '</span>'; }
/** Hearts always; keys, potions, coins and status only when this room uses them. */
function vitalsHTML() {
  const snap = S.model.snapshot(), hero = snap.hero, out = [], bag = hero.consumables || {};
  const hearts = Array.from({ length: Math.min(12, hero.maxHp) }, (_, i) => '<span class="cq-heart' + (i < hero.hp ? '' : ' empty') + '">' + HEART + '</span>').join('');
  out.push('<span class="cq-hearts" role="img" aria-label="' + esc(t(['Health ' + hero.hp + ' of ' + hero.maxHp, '生命 ' + hero.hp + '/' + hero.maxHp])) + '">' + hearts + '</span>');
  if ((snap.keys || []).length || (snap.doors || []).length || hero.keys) out.push(chip(sprite('key') + '<b>' + (hero.keys || 0) + '</b>'));
  if (bag.healing) out.push(chip(sprite('potion') + '<b>' + bag.healing + '</b>'));
  if (bag.antidote) out.push(chip(sprite('antidote') + '<b>' + bag.antidote + '</b>'));
  if (bag.ward) out.push(chip(sprite('ward') + '<b>' + bag.ward + '</b>'));
  if (S.run && S.level.expedition) out.push(chip('<b>◆ ' + S.run.coins + '</b>'));
  if (hero.statuses && hero.statuses.poison > 0) out.push(chip(label(['Poisoned', '中毒']), 'status'));
  if (hero.statuses && hero.statuses.ward > 0) out.push(chip(label(['Warded', '守護中']), 'status'));
  if (hero.guarding) out.push(chip(label(['Guarding', '防禦中']), 'status'));
  if (snap.enemies.some(enemy => enemy.hp > 0 && enemy.intent === 'shot')) out.push(chip(label(['Watch out!', '小心！']), 'status'));
  return out.join('');
}

function html(selector, value) {
  const el = S.root.querySelector(selector);
  if (el && el.dataset.cqHtml !== String(value.length) + ':' + hashText(value)) { el.innerHTML = value; el.dataset.cqHtml = String(value.length) + ':' + hashText(value); }
}
function hashText(text) { let h = 0; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0; return h; }

function setbarHTML() {
  const codeHint = !!(S && S.level && (S.level.codingView === 'hybrid' || S.level.codingView === 'code'));
  const zh = language() === 'zh';
  // The switch is written in the language it switches to, so a child who reads only that one can find it.
  const lang = button('lang', zh ? '<span lang="en">English</span>' : '<span lang="zh-Hant">中文</span>', 'class="cq-lang" aria-label="' + (zh ? 'Switch to English' : '切換成中文') + '"');
  // In the Lab the bar is just the way back and the language switch (lab design D1).
  if (S && S.lab) return '<div class="cq-setbar" role="group" aria-label="' + esc(t(LAB.title)) + '">' + button('lab:exit', label(LAB.back), 'class="cq-lab-exit"') + lang + '</div>';
  return '<div class="cq-setbar" role="group" aria-label="' + esc(t(['Code Quest controls', '程式冒險控制'])) + '">' +
    button('map', glyph('flag') + label(UI.questMap)) + button('lab', label(LAB.open), 'class="cq-lab-open"') + button('camp', label(UI.inventory)) +
    button('code', glyph('data') + label(['Code', '程式碼']), codeHint ? 'class="cq-attn"' : '') +
    lang + button('pause', label(UI.pause)) + '</div>';
}
function renderBar() {
  if (barReady()) BAR.innerHTML = setbarHTML();
  else if (S && S.root.querySelector('.cq-top')) S.root.querySelector('.cq-top').innerHTML = setbarHTML();
}
function savedLang(ctx) {
  const langs = ctx.settings.codequest && ctx.settings.codequest.lang;
  return langs && typeof langs === 'object' && langs[ctx.kid] === 'zh' ? 'zh' : 'en';
}
function setLang(next) {
  setLanguage(next);
  settingsRoot(S.ctx);
  const cq = S.ctx.settings.codequest;
  if (!cq.lang || typeof cq.lang !== 'object' || Array.isArray(cq.lang)) cq.lang = {};
  cq.lang[S.ctx.kid] = language(); S.ctx.saveSettings();
  renderBar(); notify(S.notice || MESSAGES.intro);
  render();
  if (S.lab) S.lab.render();
}

function render() {
  if (!S) return;
  const root = S.root;
  root.dataset.lang = language(); root.dataset.editor = S.editor;
  html('.cq-goal', goalHTML());
  root.querySelector('.cq-goal').setAttribute('aria-expanded', String(!!S.goalOpen));
  const pop = root.querySelector('.cq-goal-pop'); pop.hidden = !S.goalOpen; if (S.goalOpen) html('.cq-goal-pop', goalPopHTML());
  html('.cq-vitals', vitalsHTML());
  const debugAllowed = behaviorAllowedForLevel();
  root.querySelector('[data-action="debug"]').hidden = !debugAllowed;
  const panel = root.querySelector('.cq-debug'); panel.hidden = !(debugAllowed && S.debugOpen); if (!panel.hidden) panel.innerHTML = debuggerHTML();
  html('.cq-strip-tabs-slot', stripTabsHTML());
  html('.cq-strip', stripHTML());
  html('.cq-tools', toolsHTML());
  renderMenu();
  renderZoom();
  html('.cq-library', libraryHTML());
  root.querySelector('.cq-strip').setAttribute('aria-label', t(S.editor === 'rune' ? UI.rune : UI.program));
  html('.cq-runbox', button('run', glyph('play') + '<b>' + label(['Run', '執行']) + '</b>', 'class="cq-run"') +
    '<div>' + button('step', glyph('step') + '<b>' + label(UI.step) + '</b>', 'class="cq-small"') + button('reset', glyph('reset') + '<b>' + label(['Reset', '重設']) + '</b>', 'class="cq-small"') + '</div>');
  root.querySelector('.cq-debug-toggle').setAttribute('aria-label', t(['Event debugger', '事件除錯器']));
  const blocked = S.paused || !!S.dialog || S.codeDirty || S.model.phase === 'won' || S.model.phase === 'resting';
  const run = root.querySelector('[data-action="run"]');
  run.disabled = blocked; root.querySelector('[data-action="step"]').disabled = blocked;
  run.classList.toggle('running', S.model.phase === 'executing' && S.autoRun);
  root.querySelector('.cq-notice').innerHTML = label(S.notice || MESSAGES.intro);
  if (S.bubble) { S.bubble.innerHTML = label(S.notice || MESSAGES.intro); if (S.dialog || S.paused) S.bubble.hidden = true; }
  if (S.dialog === 'code') root.querySelector('.cq-dialog').innerHTML = codeSheetHTML();
  const executing = root.querySelector('.cq-strip .executing');
  if (executing && executing.scrollIntoView) executing.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  S.preview = previewFor();
  draw();
}
/* Path preview (redesign D7): Explorer stage only, on a fresh room, while building. It runs
   the program on a throw-away model, so it always shows exactly what Run will do. */
function previewFor() {
  if (modeFor(S.profile) !== 'explorer' || S.model.phase !== 'programming' || S.model.turn !== 1 || !S.program.length) return null;
  const path = previewPath(createModel(S.level), S.program, functions());
  return path.length > 1 ? path : null;
}

function draw(time = performance.now()) {
  if (!S || S.lab) return;
  if (S.heroStateUntil && time > S.heroStateUntil) S.heroState = 'idle';
  const box = S.canvas.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const snapshot = S.model.snapshot();
  followHero(snapshot);
  const view = drawRoom(S.canvas, snapshot, { time: time / 1000, now: time, cssWidth: box.width, cssHeight: box.height, dpr: window.devicePixelRatio || 1, reducedMotion: S.reducedMotion, kidColor: kidColor(), heroState: S.heroState, heroMotion: S.heroMotion, enemyMotions: S.enemyMotions, fx: S.fx, paused: S.paused, dim: !!S.dialog && !S.paused, preview: S.preview, camera: S.camera });
  if (view) {
    S.view = view;
    // Keep the clamped centre, so a pan past the edge doesn't build up off-screen.
    if (S.camera.zoom) { S.camera.cx = view.camera.cx; S.camera.cy = view.camera.cy; }
  }
  placeBubble(time, box);
}
/* Zoom + pan (UX polish slice 09, U6): the whole-room fit is Home; ＋ adds whole device
   pixels (up to +2), a one-finger drag pans while zoomed, and a run follows the hero.
   The camera never rotates. */
const HOME = () => ({ zoom: 0, cx: NaN, cy: NaN });
function setZoom(zoom) {
  const next = Math.max(0, Math.min(MAX_ZOOM, zoom));
  if (next === S.camera.zoom) return;
  S.camera = next ? { ...S.camera, zoom: next } : HOME();
  renderZoom(); draw();
}
function followHero(snapshot) {
  if (!S.camera.zoom || S.model.phase !== 'executing' || !snapshot.hero) return;
  const { TILE, MARGIN, TOP } = ROOM_VIEW;
  const tx = MARGIN + snapshot.hero.x * TILE + TILE / 2, ty = MARGIN + TOP + snapshot.hero.y * TILE + TILE / 2;
  const k = S.reducedMotion || !Number.isFinite(S.camera.cx) ? 1 : .25;
  S.camera.cx = Number.isFinite(S.camera.cx) ? S.camera.cx + (tx - S.camera.cx) * k : tx;
  S.camera.cy = Number.isFinite(S.camera.cy) ? S.camera.cy + (ty - S.camera.cy) * k : ty;
}
/* ＋ stays first so it never moves; − and ⌂ appear to its right only while zoomed, so the
   button under a finger never changes into a different one. */
function zoomHTML() {
  const z = S.camera.zoom;
  return button('zoom:in', '<b>＋</b>', 'class="cq-zoom-btn" aria-label="' + esc(t(UI.zoomIn)) + '" ' + (z >= MAX_ZOOM ? 'disabled' : '')) +
    (z ? button('zoom:out', '<b>−</b>', 'class="cq-zoom-btn" aria-label="' + esc(t(UI.zoomOut)) + '"') + button('zoom:home', '<b>⌂</b>', 'class="cq-zoom-btn" aria-label="' + esc(t(UI.zoomHome)) + '"') : '');
}
function renderZoom() {
  const node = S.root.querySelector('.cq-zoom');
  if (node) node.innerHTML = zoomHTML();
  S.canvas.classList.toggle('zoomed', !!S.camera.zoom);
}
/* Scene gestures: pinch steps the zoom, the wheel steps it, a one-finger drag pans while zoomed. */
function sceneGestures(canvas) {
  const points = new Map();
  let pinch = null, lastWheel = 0;
  const spread = () => { const [a, b] = [...points.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  canvas.addEventListener('wheel', e => {
    if (!S) return;
    e.preventDefault();
    if (e.timeStamp - lastWheel < 220 || !e.deltaY) return;
    lastWheel = e.timeStamp; setZoom(S.camera.zoom + (e.deltaY < 0 ? 1 : -1));
  }, { passive: false });
  canvas.addEventListener('pointerdown', e => {
    if (!S) return;
    points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    pinch = points.size === 2 ? { d: spread() } : null;
  });
  canvas.addEventListener('pointermove', e => {
    if (!S || !points.has(e.pointerId)) return;
    const prev = points.get(e.pointerId);
    points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && points.size === 2) {
      const r = spread() / pinch.d;
      if (r > 1.4 || r < 1 / 1.4) { setZoom(S.camera.zoom + (r > 1 ? 1 : -1)); pinch.d = spread(); }
    } else if (points.size === 1 && S.camera.zoom && S.view) {
      const k = (window.devicePixelRatio || 1) / S.view.device;
      S.camera.cx -= (e.clientX - prev.x) * k; S.camera.cy -= (e.clientY - prev.y) * k;
      draw();
    }
  });
  const end = e => { points.delete(e.pointerId); if (points.size < 2) pinch = null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
}

/* The speech bubble replaces the old notice bar: it pops over the hero for a few
   seconds when something happens, then steps aside (coach, not cop). bubble.js picks
   the side that keeps clear of the HUD and the hero and covers the least of the puzzle. */
const BUBBLE_MS = 3200;
const BUBBLE_SIDE_CLASSES = ['below', 'side-left', 'side-right', 'caption'];
function sceneRect(el, box) {
  if (!el || el.hidden) return null;
  const r = el.getBoundingClientRect();
  return r.width && r.height ? { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height } : null;
}
function placeBubble(time, box) {
  const bubble = S.bubble;
  if (!bubble) return;
  const visible = !!S.noticeAt && time - S.noticeAt < BUBBLE_MS && !S.dialog && !S.paused;
  if (bubble.hidden === visible) bubble.hidden = !visible;
  if (!visible || !S.view) return;
  const root = S.root;
  const hard = ['.cq-goal', '.cq-vitals', '.cq-goal-pop', '.cq-debug-toggle', '.cq-debug', '.cq-zoom'].map(sel => sceneRect(root.querySelector(sel), box)).filter(Boolean);
  const spot = placeBubbleRect({
    box: { w: box.width, h: box.height }, size: { w: bubble.offsetWidth, h: bubble.offsetHeight },
    hero: S.view.heroBox ? { box: S.view.heroBox } : null, hard, soft: S.view.focus || [], previous: S.bubbleSide
  });
  S.bubbleSide = spot.side;
  for (const cls of BUBBLE_SIDE_CLASSES) bubble.classList.toggle(cls, spot.side === cls.replace('side-', ''));
  bubble.dataset.side = spot.side;
  bubble.style.transform = 'translate(' + spot.x + 'px,' + spot.y + 'px)';
  bubble.style.setProperty('--tail', spot.tail + 'px');
}

function addAction(op) {
  if (!S.level.available.actions.includes(op)) return;
  const picked = [...currentSelection()], node = action(op, uid('a'));
  pushUndo(); setCurrentProgram(insertAfter(currentProgram(), picked.length === 1 ? picked[0] : -1, node));
  // The pulse plays once: the next render no longer marks the card.
  closeMenu(); S.justAdded = node.uid; announce(['Card added.', '已加入卡片。']); render(); S.justAdded = null;
  const added = S.root.querySelector('.cq-strip .just-added');
  if (added && added.scrollIntoView) added.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function selectedRange() {
  const selected = [...currentSelection()].sort((a, b) => a - b), nodes = currentProgram();
  if (!nodes.length) return null;
  if (!selected.length) return [nodes.length - 1, nodes.length - 1];
  for (let i = 1; i < selected.length; i++) if (selected[i] !== selected[i - 1] + 1) return false;
  return [selected[0], selected[selected.length - 1]];
}

function wrap(kind, value) {
  const range = selectedRange();
  if (range === null) { notify(MESSAGES.wrapEmpty); return; }
  if (range === false) { notify(MESSAGES.selectContiguous); return; }
  const nodes = currentProgram(), body = nodes.slice(range[0], range[1] + 1);
  let wrapper;
  if (kind === 'repeat') wrapper = repeat(value, body, uid('r'));
  else wrapper = ifNode(value, body, [], uid('i'));
  pushUndo();
  setCurrentProgram(nodes.slice(0, range[0]).concat(wrapper, nodes.slice(range[1] + 1)));
  notify(['Cards wrapped into one logic block.', '卡片已包成一個邏輯積木。']); render();
}

function logic(id) {
  if (!S.level.available.logic.includes(id)) return;
  if (id === 'callRune') {
    if (!S.runeProgram.length) { S.editor = 'rune'; notify(MESSAGES.missingFunction); render(); return; }
    pushUndo(); setCurrentProgram(currentProgram().concat(call('rune', uid('c')))); notify(['Rune call added.', '已加入符文呼叫。']); render(); return;
  }
  if (id.startsWith('repeat')) wrap('repeat', Number(id.replace('repeat', '')) || 2);
  else if (IF_TESTS[id]) wrap('if', IF_TESTS[id]);
}

function selectIndex(index) {
  const list = currentProgram(), selection = currentSelection();
  if (index < 0 || index >= list.length) return;
  const next = extendSelection(selection, index);
  selection.clear(); for (const i of next) selection.add(i);
  S.menuOpen = selection.size > 0; S.menuWrap = false;
  announce(MESSAGES.selected); render();
}
function removeIndex(index) {
  const list = currentProgram(); if (index < 0 || index >= list.length) return;
  pushUndo(); setCurrentProgram(list.slice(0, index).concat(list.slice(index + 1))); currentSelection().clear(); render();
}
function moveIndex(index, delta) {
  const list = currentProgram().slice(), target = index + delta;
  if (index < 0 || target < 0 || index >= list.length || target >= list.length) return;
  pushUndo(); [list[index], list[target]] = [list[target], list[index]]; setCurrentProgram(list);
  const selection = currentSelection(); if (selection.has(index)) { selection.clear(); selection.add(target); }
  render();
}

function applyCodeDraft() {
  const textarea = S.root.querySelector('.cq-code-input');
  if (textarea) S.codeDraft = textarea.value;
  const parsed = parseJavaScript(S.codeDraft);
  if (!parsed.ok) {
    S.codeError = parsed.error; S.codeDirty = true;
    notify([parsed.error.message + ' (line ' + parsed.error.line + ', column ' + parsed.error.column + ')', '程式碼錯誤：第 ' + parsed.error.line + ' 行，第 ' + parsed.error.column + ' 欄。']);
    render();
    const next = S.root.querySelector('.cq-code-input');
    if (next) { next.focus(); next.setSelectionRange(parsed.error.offset, parsed.error.offset + parsed.error.length); }
    return false;
  }
  pushUndo();
  S.program = parsed.program;
  const parsedFns = { ...parsed.functions };
  if (Array.isArray(parsedFns.rune)) { S.runeProgram = parsedFns.rune.slice(); delete parsedFns.rune; }
  else S.runeProgram = [];
  S.extraFunctions = parsedFns;
  S.selectedMain.clear(); S.selectedRune.clear();
  S.codeError = null; S.codeDirty = false;
  notify(MESSAGES.codeApplied); render();
  return true;
}
function resetCodeDraft() {
  syncCodeFromAst(); notify(MESSAGES.codeReset); render();
}
function availableCodeApiActions() {
  const heroOpFor = { move:'move', turnLeft:'turnLeft', turnRight:'turnRight', attack:'attack', heavyAttack:'heavyAttack', guard:'guard', open:'open', disarm:'disarm', interact:'interact', smash:'smash', push:'push', take:'take', throw:'throw', usePotion:'usePotion', useAntidote:'useAntidote', useWard:'useWard', wait:'wait', cast:'cast', targetNearest:'targetNearest', targetWeakest:'targetWeakest', targetArmored:'targetArmored', targetElementWeak:'targetElementWeak' };
  const companionOpFor = { follow:'companionFollow', hold:'companionHold', guard:'companionGuard', assist:'companionAssist', move:'companionMove', turnLeft:'companionTurnLeft', turnRight:'companionTurnRight', interact:'companionInteract', push:'companionPush', take:'companionTake', throw:'companionThrow' };
  return CODE_API.actions.filter(line => {
    let match = /^hero\.([A-Za-z0-9_]+)\(\);$/.exec(line);
    if (match) return S.level.available.actions.includes(heroOpFor[match[1]]);
    match = /^companion\.([A-Za-z0-9_]+)\(\);$/.exec(line);
    return !!(match && S.level.available.actions.includes(companionOpFor[match[1]]));
  }).slice(0, 14);
}
function insertCodeSnippet(kind) {
  const textarea = S.root.querySelector('.cq-code-input');
  if (textarea) S.codeDraft = textarea.value;
  let snippet = '';
  if (kind.startsWith('api:')) snippet = availableCodeApiActions()[Number(kind.slice(4))] || '';
  else if (kind === 'if') snippet = 'if (hero.seesEnemyAhead()) {\n  hero.attack();\n}';
  else if (kind === 'else') snippet = 'if (hero.seesEnemyAhead()) {\n  hero.attack();\n} else {\n  hero.move();\n}';
  else if (kind === 'repeat') snippet = 'repeat(3, () => {\n  hero.move();\n});';
  else if (kind === 'variable') snippet = 'let steps = 3;';
  else if (kind === 'function') snippet = 'function walk(steps) {\n  repeat(steps, () => {\n    hero.move();\n  });\n  return steps;\n}';
  else if (kind === 'return') snippet = 'return steps;';
  else if (kind === 'foreach') snippet = 'for (const foe of enemies) {\n  hero.target(foe);\n  hero.cast();\n}';
  else if (kind === 'event') snippet = 'function react() {\n  companion.guard();\n}\n\non("danger", react);';
  else if (kind === 'signal') snippet = 'function relay() {\n  companion.move();\n}\n\non("signal", relay);\nhero.signal("ready");';
  else if (kind === 'state') snippet = 'if (hero.state === "explore") {\n  hero.state = "attack";\n}';
  else if (kind === 'mailbox') snippet = 'if (hero.signal.pending > 0) {\n  hero.guard();\n}';
  if (!snippet) return;
  const prefix = S.codeDraft.trim() ? '\n\n' : '';
  S.codeDraft += prefix + snippet; S.codeDirty = true; S.codeError = null;
  render();
  const next = S.root.querySelector('.cq-code-input'); if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
}

function beginIfNeeded() {
  if (S.codeDirty) { notify(MESSAGES.codeChanged); return false; }
  if (S.model.phase === 'executing') return true;
  if (S.model.phase !== 'programming') return false;
  const result = S.model.begin(S.program, functions(), persistentBehaviors());
  if (result.ok) return true;
  if (result.reason === 'empty-program') notify(MESSAGES.empty);
  else if (result.reason === 'too-many-blocks') notify(MESSAGES.tooMany);
  else if (result.reason === 'missing-concept') notify(result.concept === 'repeat' ? MESSAGES.needRepeat : result.concept === 'if' ? MESSAGES.needIf : MESSAGES.needCall);
  else if (result.reason === 'missing-function') notify(MESSAGES.missingFunction);
  else notify(['Try adjusting the program.', '試著調整程式。']);
  render(); return false;
}

function eventNotice(event) {
  if (!event) return;
  if (event.type === 'target' || event.type === 'target-ref') {
    notify(event.result === 'targeted' ? MESSAGES.targeted : MESSAGES.noTarget);
  } else if (event.type === 'action') {
    if (event.result === 'blocked') notify(MESSAGES.blocked);
    else if (event.result === 'no-target') notify(MESSAGES.noTarget);
    else if (event.result === 'targeted') notify(MESSAGES.targeted);
    else if (event.result === 'out-of-range') notify(MESSAGES.outOfRange);
    else if (event.result === 'no-magic') notify(MESSAGES.noMagic);
    else if (event.result === 'element-weak') notify(MESSAGES.elementWeak);
    else if (event.result === 'element-resist' || event.result === 'resisted') notify(MESSAGES.elementResist);
    else if (event.result === 'armored') notify(MESSAGES.armored);
    else if (event.result === 'hit') notify(MESSAGES.hit);
    else if (event.result === 'defeated') notify(MESSAGES.defeated);
    else if (event.result === 'opened') notify(MESSAGES.opened);
    else if (event.result === 'door-opened') notify(MESSAGES.doorOpened);
    else if (event.result === 'locked-door') notify(MESSAGES.lockedDoor);
    else if (event.result === 'nothing-to-open' || event.result === 'already-open') notify(MESSAGES.nothingToOpen);
    else if (event.result === 'key-collected') notify(MESSAGES.keyCollected);
    else if (event.result === 'disarmed') notify(MESSAGES.trapAhead);
    else if (event.result === 'no-trap' || event.result === 'already-disarmed') notify(MESSAGES.noTrap);
    else if (event.result === 'trap-hit') notify(MESSAGES.trapHit);
    else if (event.result === 'healed') notify(MESSAGES.healed);
    else if (event.result === 'no-potion') notify(MESSAGES.noPotion);
    else if (event.result === 'full-health') notify(MESSAGES.fullHealth);
    else if (event.result === 'guarding') notify(MESSAGES.guarding);
    else if (event.result === 'cured') notify(MESSAGES.cured);
    else if (event.result === 'no-antidote') notify(MESSAGES.noAntidote);
    else if (event.result === 'not-poisoned') notify(MESSAGES.notPoisoned);
    else if (event.result === 'warded') notify(MESSAGES.warded);
    else if (event.result === 'no-ward') notify(MESSAGES.noWard);
    else if (event.result === 'lever-activated') notify(MESSAGES.leverActivated);
    else if (event.result === 'lever-deactivated') notify(MESSAGES.leverDeactivated);
    else if (event.result === 'plate-activated') notify(MESSAGES.plateActivated);
    else if (event.result === 'npc-helped') notify(MESSAGES.npcHelped);
    else if (event.result === 'npc-already-helped') notify(MESSAGES.npcDone);
    else if (event.result === 'nothing-to-interact' || event.result === 'already-active') notify(MESSAGES.noInteract);
    else if (event.result === 'crate-broken') notify(MESSAGES.crateBroken);
    else if (event.result === 'pushed') notify(MESSAGES.pushed);
    else if (event.result === 'push-plate') notify(MESSAGES.pushPlate);
    else if (event.result === 'no-pushable') notify(MESSAGES.noPushable);
    else if (event.result === 'push-blocked') notify(MESSAGES.pushBlocked);
    else if (event.result === 'taken') notify(MESSAGES.taken);
    else if (event.result === 'already-carrying') notify(MESSAGES.alreadyCarrying);
    else if (event.result === 'no-carryable') notify(MESSAGES.noCarryable);
    else if (event.result === 'thrown') notify(MESSAGES.thrown);
    else if (event.result === 'thrown-to-plate') notify(MESSAGES.thrownToPlate);
    else if (event.result === 'not-carrying') notify(MESSAGES.notCarrying);
    else if (event.result === 'throw-blocked') notify(MESSAGES.throwBlocked);
    else if (event.result === 'quest-started') notify(MESSAGES.questStarted);
    else if (event.result === 'quest-waiting') notify(MESSAGES.questWaiting);
    else if (event.result === 'quest-token-collected') notify(MESSAGES.questTokenCollected);
    else if (event.result === 'quest-completed') notify(MESSAGES.questCompleted);
    else if (event.result === 'companion-follow') notify(MESSAGES.companionFollow);
    else if (event.result === 'companion-hold') notify(MESSAGES.companionHold);
    else if (event.result === 'companion-guard') notify(MESSAGES.companionGuard);
    else if (event.result === 'companion-hit') notify(MESSAGES.companionHit);
    else if (event.result === 'no-companion') notify(MESSAGES.noCompanion);
    else if (event.result === 'companion-out-of-range') notify(MESSAGES.companionOutOfRange);
    else if (event.result === 'companion-moved') notify(MESSAGES.companionMoved);
    else if (event.result === 'companion-blocked') notify(MESSAGES.companionBlocked);
    else if (event.result === 'companion-turned') notify(MESSAGES.companionTurned);
    else if (event.result === 'no-breakable' || event.result === 'already-broken') notify(MESSAGES.noBreakable);
  } else if (event.type === 'state') {
    notify([String(event.actor).toUpperCase()+' state → '+String(event.state).toUpperCase()+'.',(event.actor==='companion'?'夥伴':'英雄')+'狀態 → '+String(event.state).toUpperCase()+'。']);
  } else if (event.type === 'signal') {
    notify(['Signal '+String(event.channel).toUpperCase()+' sent by '+event.actor+' · '+event.pending+' pending.','已由'+(event.actor==='companion'?'夥伴':'英雄')+'傳送訊號 '+String(event.channel).toUpperCase()+'・待處理 '+event.pending+'。']);
  } else if (event.type === 'handler') {
    notify(MESSAGES.handlerRegistered);
  } else if (event.type === 'callback-start' || event.type === 'callback-next') {
    notify([String(event.owner||'main').toUpperCase()+' handler '+String(event.name||'')+' is running.','正在執行 '+(event.owner==='companion'?'夥伴':event.owner==='hero'?'英雄':'主程式')+'處理器 '+String(event.name||'')+'。']);
  } else if (event.type === 'callback-done') {
    notify([String(event.owner||'main').toUpperCase()+' handler complete.','處理器執行完成。']);
  } else if (event.type === 'world-turn') {
    if ((event.callbacks || []).length) notify(MESSAGES.callbackTriggered);
    else if (event.phase === 'resting') notify(MESSAGES.resting);
    else if ((event.events || []).some(item => item.type === 'enemy-intent')) notify(MESSAGES.incoming);
    else if ((event.events || []).some(item => item.type === 'status-applied' || item.type === 'status-tick')) notify(MESSAGES.poisoned);
    else notify(MESSAGES.worldTurn);
  } else if (event.type === 'program-error') {
    notify(event.reason === 'recursive-call' ? MESSAGES.recursion : event.reason === 'missing-function' ? MESSAGES.missingFunction : ['The program stopped safely. Try a smaller plan.', '程式安全停止了，試試較小的計畫。']);
  }
}

function executeOne(auto) {
  if (!S || S.paused || S.dialog || !beginIfNeeded()) return;
  S.autoRun = !!auto;
  const event = S.model.step();
  const now = performance.now();
  S.activeUid = event.uid || null;
  if (event.type === 'action') {
    if (event.detail && event.detail.source === 'inventory' && event.detail.item) {
      S.profile = consumePotion(S.profile, event.detail.item, 1); saveProfile();
    }
    S.heroState = (event.op === 'attack' || event.op === 'heavyAttack' || event.op === 'cast' || event.op === 'smash' || event.op === 'companionAssist') ? 'attack' : (event.op === 'move' || event.op === 'push' || event.op === 'take' || event.op === 'throw') ? 'walk' : event.result === 'trap-hit' ? 'hurt' : 'idle';
    S.heroStateUntil = now + ((event.op === 'move' || event.op === 'push' || event.op === 'take' || event.op === 'throw') ? 320 : 280);
    if ((event.op === 'move' || event.op === 'push') && event.before && event.after && (event.before.x !== event.after.x || event.before.y !== event.after.y)) {
      S.heroMotion = { from: event.before, to: event.after, start: now, duration: 300 };
    } else S.heroMotion = null;
    if (event.op === 'attack' || event.op === 'heavyAttack') S.fx = { kind: 'attack', target: event.target || 'hero', start: now, duration: event.op === 'heavyAttack' ? 420 : 300 };
    else if (event.op === 'cast') S.fx = { kind: event.detail && event.detail.element === 'frost' ? 'frost' : 'fire', target: event.target || 'hero', start: now, duration: 420 };
    else if (event.op === 'guard') S.fx = { kind: 'guard', target: 'hero', start: now, duration: 340 };
    else if (event.result === 'cured') S.fx = { kind: 'poison', target: 'hero', start: now, duration: 280 };
    else if (event.result === 'opened' || event.result === 'door-opened' || event.result === 'key-collected' || event.result === 'taken' || event.result === 'thrown' || event.result === 'thrown-to-plate' || event.result === 'lever-activated' || event.result === 'lever-deactivated' || event.result === 'plate-activated' || event.result === 'npc-helped' || event.result === 'quest-started' || event.result === 'quest-completed' || event.result === 'quest-token-collected' || event.result === 'push-plate') S.fx = { kind: 'open', target: event.target || 'hero', start: now, duration: 320 };
    else if (event.result === 'crate-broken' || event.result === 'pushed' || event.result === 'companion-hit') S.fx = { kind: 'attack', target: event.target || 'hero', start: now, duration: 300 };
    else if (event.result === 'trap-hit') S.fx = { kind: 'trap', target: event.target || 'hero', start: now, duration: 340 };
    else S.fx = null;
    if (event.result === 'opened' || event.result === 'door-opened' || event.result === 'key-collected' || event.result === 'taken' || event.result === 'thrown-to-plate' || event.result === 'quest-token-collected' || event.result === 'disarmed' || event.result === 'lever-activated' || event.result === 'lever-deactivated' || event.result === 'plate-activated' || event.result === 'push-plate' || event.result === 'npc-helped' || event.result === 'quest-completed' || event.result === 'crate-broken') S.ctx.sfx && S.ctx.sfx.good && S.ctx.sfx.good();
    else if (event.op === 'attack' || event.op === 'heavyAttack' || event.op === 'cast' || event.op === 'smash' || event.op === 'push' || event.op === 'throw' || event.op === 'companionAssist' || event.op === 'companionPush' || event.op === 'companionThrow') S.ctx.sfx && S.ctx.sfx.pop && S.ctx.sfx.pop();
  } else if (event.type === 'state') {
    S.fx = { kind:'state', target:event.actor==='companion'?'companion':'hero', start:now, duration:360 };
  } else if (event.type === 'signal') {
    S.fx = { kind:'signal', actor:event.actor, to:event.to, target:(event.opened&&event.opened[0])||event.to, channel:event.channel, start:now, duration:460 };
  } else if (event.type === 'handler') {
    notify(MESSAGES.handlerRegistered);
  } else if (event.type === 'callback-start') {
    notify(MESSAGES.callbackTriggered);
  } else if (event.type === 'world-turn') {
    S.enemyMotions = {};
    for (const item of event.events || []) if (item.type === 'enemy-move') S.enemyMotions[item.enemy] = { from: item.from, to: item.to, start: now, duration: 320 };
    if (event.events && event.events.some(item => item.type === 'enemy-shot')) S.fx = { kind: 'shot', target: 'hero', start: now, duration: 340 };
    else if (event.events && event.events.some(item => item.type === 'enemy-status-tick')) {
      const item = event.events.find(entry => entry.type === 'enemy-status-tick'); S.fx = { kind: 'fire', target: item.enemy, start: now, duration: 360 };
    }
    else if (event.events && event.events.some(item => item.type === 'enemy-status-skip')) {
      const item = event.events.find(entry => entry.type === 'enemy-status-skip'); S.fx = { kind: 'frost', target: item.enemy, start: now, duration: 360 };
    }
    else if (event.events && event.events.some(item => item.type === 'status-applied' || item.type === 'status-tick')) S.fx = { kind: 'poison', target: 'hero', start: now, duration: 360 };
    if (event.events && event.events.some(item => item.type === 'enemy-attack' || item.type === 'enemy-shot')) {
      S.heroState = 'hurt'; S.heroStateUntil = now + 320; S.fx = { kind: 'trap', target: 'hero', start: now, duration: 280 };
    }
  }
  eventNotice(event); render();
  if (S.model.phase === 'won') { completeQuest(); return; }
  if (S.model.phase === 'resting' || S.model.phase === 'programming') {
    S.autoRun = false; render();
    if (S.model.phase === 'resting' && S.run && S.level && S.level.expedition) failExpedition();
    return;
  }
  if (auto && S.model.phase === 'executing') S.scheduler.after(360, () => executeOne(true));
}

function rewardHTML(reward) {
  const rows = [];
  for (const [id, n] of Object.entries((reward && reward.ingredients) || {})) if (n) rows.push('<li><img src="' + spriteURL(id, kidColor()) + '" alt="">' + label(ITEM_LABELS[id]) + ' ×' + n + '</li>');
  for (const [id, n] of Object.entries((reward && reward.potions) || {})) if (n) rows.push('<li><img src="' + spriteURL(id, kidColor()) + '" alt="">' + label(ITEM_LABELS[id]) + ' ×' + n + '</li>');
  if (reward && reward.equipment) rows.push('<li><img src="' + spriteURL(reward.equipment, kidColor()) + '" alt="">' + label(ITEM_LABELS[reward.equipment]) + '</li>');
  if (reward && reward.lootChoiceSeed) rows.push('<li><b class="cq-glyph">◆</b>' + pair('Relic chest unlocked · choose one at Camp', '已解鎖遺物寶箱・到營地選一件') + '</li>');
  return rows.length ? '<ul class="cq-rewards">' + rows.join('') + '</ul>' : '';
}

function completeQuest() {
  if (!S || S.completing) return;
  S.completing = true; S.autoRun = false;
  if (S.run && S.level && S.level.expedition) { completeExpeditionEncounter(); return; }
  const blocks = combinedBlockCount(S.program, functions());
  let firstClear = false, improved = false, reward = S.level.reward || {};
  if (S.level.endless) {
    const result = recordEndlessClear(S.profile, S.level.floor, reward); S.profile = result.profile; improved = result.improved;
  } else {
    const result = recordLevelComplete(S.profile, S.level, blocks); S.profile = result.profile; firstClear = result.firstClear; improved = result.improved; reward = result.reward;
  }
  saveProfile();
  const score = scoreForProfile(S.profile); S.ctx.finish({ score }); S.best = Math.max(S.best, score);
  S.ctx.sfx && S.ctx.sfx.good && S.ctx.sfx.good();
  const extra = firstClear ? '<p>' + label(MESSAGES.firstReward) + '</p>' + rewardHTML(reward) : improved ? '<p>' + label(MESSAGES.improved) + '</p>' : '';
  openDialog('win', '<h2>' + label(MESSAGES.won) + '</h2><p>' + pair('Program size: ' + blocks + ' · par ' + S.level.parBlocks, '程式大小：' + blocks + '・目標 ' + S.level.parBlocks) + '</p>' + extra + '<div class="cq-dialog-actions">' + button('win:replay', label(UI.replay)) + button('win:continue', label(UI.continue), 'class="cq-primary" autofocus') + '</div>');
  render();
}

function createModel(level) {
  const base = combatStatsFor(S.profile);
  if (S.run && level && level.expedition) {
    const boons = S.run.boons || {};
    return new CodeQuestModel(level, {
      ...base,
      weaponDamage:Math.max(1, Math.min(9, base.weaponDamage + (boons.attack || 0) - ((S.run.hazard && !S.run.hazard.cleared && S.run.hazard.id === 'rust') ? 1 : 0))),
      spellDamage:Math.max(0, Math.min(9, Math.max(base.spellDamage + (boons.spell || 0) - ((S.run.hazard && !S.run.hazard.cleared && S.run.hazard.id === 'static') ? 1 : 0), Number(level.practiceSpellDamage) || 0))),
      weaponRange:Math.min(6, Math.max(base.weaponRange, Number(level.practiceRange) || 1)),
      weaponElement:base.weaponElement !== 'neutral' ? base.weaponElement : (['fire','frost'].includes(level.practiceElement) ? level.practiceElement : 'neutral'),
      defense:Math.min(4, base.defense + (boons.defense || 0)),
      maxHp:S.run.maxHp,
      consumables:{ healing:0, antidote:0, ward:0, focus:0 }
    });
  }
  return new CodeQuestModel(level, base);
}

function syncCombatStats() {
  const stats = combatStatsFor(S.profile), inRun = !!(S.run && S.level && S.level.expedition), boons = inRun ? S.run.boons : {};
  const hazardActive = inRun && S.run.hazard && !S.run.hazard.cleared;
  S.model.weaponDamage = Math.max(1, Math.min(9, stats.weaponDamage + (boons.attack || 0) - (hazardActive && S.run.hazard.id === 'rust' ? 1 : 0)));
  S.model.spellDamage = Math.max(0, Math.min(9, Math.max(stats.spellDamage + (boons.spell || 0) - (hazardActive && S.run.hazard.id === 'static' ? 1 : 0), inRun ? Number(S.level.practiceSpellDamage) || 0 : 0))); 
  S.model.weaponRange = Math.min(6, Math.max(stats.weaponRange, inRun ? Number(S.level.practiceRange) || 1 : 1));
  S.model.weaponElement = stats.weaponElement !== 'neutral' ? stats.weaponElement : (inRun && ['fire','frost'].includes(S.level.practiceElement) ? S.level.practiceElement : 'neutral');
  S.model.defense = Math.min(4, stats.defense + (boons.defense || 0)); S.model.wardBonus = stats.wardBonus;
  S.model.weaponRarityRank = stats.weaponRarityRank; S.model.weaponAffixCount = stats.weaponAffixCount; S.model.armorRarityRank = stats.armorRarityRank; S.model.charmRarityRank = stats.charmRarityRank; S.model.setBonusCount = stats.setBonusCount || 0;
  const maxHp = inRun ? S.run.maxHp : stats.maxHp; S.model.maxHp = maxHp; S.model.hero.maxHp = maxHp; S.model.hero.hp = Math.min(S.model.hero.hp, maxHp);
}

function startLevel(level, options = {}) {
  const preserveProgram = !!options.preserveProgram;
  S.level = level; S.model = createModel(level);
  if (!preserveProgram) { S.program = []; S.runeProgram = []; S.extraFunctions = {}; S.selectedMain.clear(); S.selectedRune.clear(); S.undo = []; }
  else { S.selectedMain.clear(); S.selectedRune.clear(); S.undo = []; }
  S.editor = 'main'; S.goalOpen = false; S.debugOpen = false; S.menuOpen = false; S.menuWrap = false; S.camera = HOME();
  S.representation = level.codingView === 'hybrid' && allowedRepresentations().includes('hybrid') ? 'hybrid' : defaultRepresentation();
  S.autoRun = false; S.heroState = 'idle'; S.heroMotion = null; S.enemyMotions = {}; S.fx = null; S.activeUid = null; S.completing = false;
  const activeBehaviors=behaviorAllowedForLevel(level)&&['hero','companion'].some(owner=>{const saved=behaviorFor(S.profile,owner);return saved.enabled&&saved.source.trim();});
  S.notice = activeBehaviors ? ['Hero/Companion persistent behaviors are armed for this advanced room.', '此進階房間已載入英雄／夥伴持續行為。'] : level.expedition ? ['Your Rune library travels with this expedition.', '你的符文函式會跟著這趟遠征。'] : MESSAGES.intro;
  syncCodeFromAst();
  if (S.dialog) closeDialog(false);
  // The Map / win dialog paused the scheduler; a fresh room must run (Run's auto-steps and the draw loop live there).
  if (!S.paused) S.scheduler.resume();
  if (level.codingView === 'code' && codeUnlocked() && !level.expedition) S.notice = CODE_ROOM;
  renderBar(); render(); notify(S.notice);
}
const CODE_ROOM = ['This room is solved in code. Tap Code to write it.', '這個房間要用程式碼解決。點「程式碼」來寫。'];

function startAuthored(index) {
  if (index < 0 || index >= LEVELS.length) return;
  S.run = null;
  if (index > 0 && !S.profile.completed.includes(LEVELS[index - 1].id)) { notify(MESSAGES.lockedLevel); return; }
  startLevel(LEVELS[index]);
}
function startEndless(floor) {
  S.run = null;
  if (S.profile.completed.length < 8) { notify(MESSAGES.towerLocked); return; }
  startLevel(generateEndless(floor));
}

function runSeed() { return 'kid-' + String(S.ctx.kid || 'hero').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,24) + '-expedition-' + (S.profile.expeditionsCleared + 1); }
function runRoomClass(id, run) {
  const classes = ['cq-run-node'];
  if (id === run.current) classes.push('current');
  if (run.cleared.includes(id)) classes.push('cleared');
  if (run.route.includes(id)) classes.push('route');
  if (nextRooms(run).includes(id)) classes.push('frontier');
  if (id === 'r5' && run.sigils < sigilsRequired()) classes.push('locked');
  return classes.join(' ');
}
function runLoadoutHTML(run) {
  const slots = run.runeLoadouts.map((source, index) => {
    const letter = String.fromCharCode(65 + index), saved = !!(source && source.trim()), active = run.activeLoadout === index;
    return '<div class="cq-run-loadout ' + (active ? 'active' : '') + '"><b>RUNE ' + letter + '</b><small>' + pair(saved ? 'Saved program' : 'Empty slot', saved ? '已儲存程式' : '空白欄位') + '</small>' +
      button('run:loadout:save:' + index, pair('Save current','儲存目前程式')) +
      button('run:loadout:load:' + index, pair('Load','載入'), saved ? '' : 'disabled') + '</div>';
  }).join('');
  return '<section class="cq-run-loadouts"><h4>' + pair('Rune loadouts','符文配置') + '</h4><p>' + pair('Save up to three reusable programs and swap them between rooms.', '最多儲存三組可重複使用的程式，並可在房間之間切換。') + '</p><div>' + slots + '</div></section>';
}
function runRoomActions(run) {
  const meta = roomMeta(run.current); if (!meta) return '';
  if (run.failed) return '<div class="cq-run-actions">' + button('run:new', pair('Retry expedition','重新遠征'), 'class="cq-primary"') + button('run:abandon', pair('Leave dungeon','離開地下城')) + '</div>';
  if (run.finished) return '';
  if (run.cleared.includes(run.current)) {
    const next = nextRooms(run);
    const bossHint = run.sigils < sigilsRequired() ? '<small>' + pair('Root Compiler sealed · collect ' + (sigilsRequired() - run.sigils) + ' more compiler sigil(s).', '根編譯器仍封印・還需 ' + (sigilsRequired() - run.sigils) + ' 枚編譯符印。') + '</small>' : '';
    return '<div class="cq-run-actions"><p>' + pair('Choose any reachable unexplored chamber.', '選擇任何目前可到達且尚未探索的房間。') + '</p>' + next.map(id => button('run:next:' + id, label(roomMeta(id).label), 'class="cq-primary"')).join('') + bossHint + '</div>';
  }
  if (['combat','elite','boss'].includes(meta.type)) return '<div class="cq-run-actions">' + button('run:enter', pair(meta.type === 'boss' ? 'Enter sealed boss chamber' : 'Enter chamber', meta.type === 'boss' ? '進入封印首領房' : '進入房間'), 'class="cq-primary" ' + (meta.type === 'boss' && run.sigils < sigilsRequired() ? 'disabled' : '')) + '</div>';
  if (meta.type === 'event' && run.current === 'r1a') return '<div class="cq-run-actions"><p>' + pair('The Rune Fountain offers recovery or power.', '符文泉提供恢復或力量。') + '</p>' + button('run:choice:fountain:heal', pair('Restore 3 HP','恢復 3 HP'), 'class="cq-primary"') + button('run:choice:fountain:power', pair('Trade 1 HP → +1 spell','消耗 1 HP → 法術 +1')) + '</div>';
  if (meta.type === 'event' && run.current === 'r2c') return '<div class="cq-run-actions"><p>' + pair('Search the observatory for route resources.', '搜尋觀測站取得路線資源。') + '</p>' + button('run:choice:observatory:coins', pair('Recover 5 coins','取得 5 金幣'), 'class="cq-primary"') + button('run:choice:observatory:supply', pair('Recover +1 healing','取得 +1 治療')) + '</div>';
  if (meta.type === 'hazard') {
    const hazard = hazardInfo(run), canStabilize = run.coins >= 4 || run.provisions.ward > 0;
    return '<div class="cq-run-actions"><p>' + label(hazard.label) + '</p>' + button('run:choice:hazard:stabilize', pair('Stabilize · 4 coins or 1 Ward · gain sigil','穩定・4 金幣或 1 守護・獲得符印'), 'class="cq-primary" ' + (!canStabilize ? 'disabled' : '')) + button('run:choice:hazard:ignore', pair('Leave hazard active','保留危害')) + '</div>';
  }
  if (meta.type === 'rest') return '<div class="cq-run-actions"><p>' + pair('Rest or prepare one extra healing potion.', '休息，或準備一瓶額外治療藥水。') + '</p>' + button('run:choice:rest:heal', pair('Full rest','完全休息'), 'class="cq-primary"') + button('run:choice:rest:brew', pair('Brew +1 healing','調製 +1 治療')) + '</div>';
  if (meta.type === 'treasure') return '<div class="cq-run-actions"><p>' + pair('Choose one temporary expedition upgrade.', '選擇一個本次遠征的暫時升級。') + '</p>' + button('run:choice:treasure:blade', pair('+1 melee attack','近戰攻擊 +1'), 'class="cq-primary"') + button('run:choice:treasure:focus', pair('+1 spell power','法術威力 +1')) + button('run:choice:treasure:guard', pair('+1 defense','防禦 +1')) + '</div>';
  if (meta.type === 'sigil') return '<div class="cq-run-actions"><p>' + pair('Compile a route sigil and choose its side effect.', '編譯一枚路線符印並選擇附加效果。') + '</p>' + button('run:choice:sigil:attack', pair('Compile sigil +1 ATK','編譯符印 +1 攻擊'), 'class="cq-primary"') + button('run:choice:sigil:spell', pair('Compile sigil +1 SPELL','編譯符印 +1 法術')) + '</div>';
  if (meta.type === 'shop') {
    const shop = run.shop;
    return '<div class="cq-run-actions cq-run-shop"><p>' + pair('Spend expedition coins on resources, permanent-for-run upgrades, or a costly route sigil.', '使用遠征金幣購買資源、整趟有效的升級，或昂貴的路線符印。') + '</p>' +
      button('run:choice:shop:healing', pair('Healing potion · 6','治療藥水・6'), (shop.healBought || run.coins < 6) ? 'disabled' : '') +
      button('run:choice:shop:ward', pair('Ward tonic · 7','守護藥水・7'), (shop.wardBought || run.coins < 7) ? 'disabled' : '') +
      button('run:choice:shop:patch', pair('Runtime patch +1 Max HP · 8','執行期補丁 +1 最大生命・8'), (shop.patchBought || run.coins < 8) ? 'disabled' : '') +
      button('run:choice:shop:forge', pair('Forge edge +1 ATK · 10','鍛造刀鋒 +1 攻擊・10'), (shop.forgeBought || run.coins < 10) ? 'disabled' : '') +
      button('run:choice:shop:sigil', pair('Compiler sigil · 12','編譯符印・12'), (shop.sigilBought || run.coins < 12) ? 'disabled' : '') +
      button('run:choice:shop:leave', pair('Leave market','離開市集'), 'class="cq-primary"') + '</div>';
  }
  return '';
}
function expeditionHTML() {
  const run = S.run || S.profile.activeRun; if (!run) return '';
  const graph = roomGraph(run), summary = dungeonRunSummary(run), hazard = hazardInfo(run);
  const nodes = Object.keys(graph).map(id => { const meta=roomMeta(id), modifier = meta.type === 'elite' ? run.eliteModifiers[id] : ''; return '<article class="' + runRoomClass(id,run) + ' type-' + meta.type + '" style="grid-column:' + (meta.x + 1) + ';grid-row:' + (meta.y + 1) + '"><b>' + label(meta.label) + '</b><small>' + esc(meta.type.toUpperCase() + (modifier ? ' · ' + modifier : '')) + '</small>' + (id === 'r5' && run.sigils < sigilsRequired() ? '<em>🔒 ' + run.sigils + '/' + sigilsRequired() + '</em>' : '') + '</article>'; }).join('');
  const meta = roomMeta(run.current);
  return '<div class="cq-dialog-head"><h2>' + pair('Compiler Catacombs · Algorithmic Expedition','編譯者地下城・演算法遠征') + '</h2>' + button('dialog:close', label(UI.close)) + '</div>' +
    '<section class="cq-run-hud"><b>♥ ' + run.hp + '/' + run.maxHp + '</b><b>◆ ' + run.coins + '</b><b>⌘ ' + run.sigils + '/' + sigilsRequired() + '</b><span>🧪 ' + run.provisions.healing + '</span><span>☄ ' + run.provisions.ward + '</span><span>⚔ +' + run.boons.attack + '</span><span>✦ +' + run.boons.spell + '</span><span>🛡 +' + run.boons.defense + '</span></section>' +
    '<div class="cq-run-hazard ' + (hazard.cleared ? 'cleared' : 'active') + '"><b>' + pair('RUN HAZARD','遠征危害') + '</b><span>' + label(hazard.label) + '</span><small>' + pair('Layout seed: ' + run.layoutId.toUpperCase(), '路線種子：' + run.layoutId.toUpperCase()) + '</small></div>' +
    '<div class="cq-run-map cq-run-map-v09" aria-label="Algorithmic connected dungeon map 演算法相連地下城地圖">' + nodes + '</div>' +
    '<section class="cq-run-current"><h3>' + label(meta.label) + '</h3><p>' + pair('Rooms searched: ' + summary.roomsCleared + '/13 · reachable frontier: ' + summary.frontier.length + ' · collect ' + sigilsRequired() + ' compiler sigils to unlock the Root Compiler.', '已搜尋房間：' + summary.roomsCleared + '/13・可到達前線：' + summary.frontier.length + '・收集 ' + sigilsRequired() + ' 枚編譯符印以解鎖根編譯器。') + '</p>' + runRoomActions(run) + '</section>' +
    runLoadoutHTML(run) + '<div class="cq-dialog-actions">' + button('run:abandon', pair('Abandon expedition','放棄遠征')) + '</div>';
}
function startNewExpedition() {
  const stats = combatStatsFor(S.profile);
  S.run = createDungeonRun(runSeed(), stats.maxHp); S.profile = setActiveDungeonRun(S.profile, S.run); saveProfile();
  S.program = []; S.runeProgram = []; S.extraFunctions = {}; S.selectedMain.clear(); S.selectedRune.clear(); syncCodeFromAst();
  const level = expeditionLevel(S.run); if (level) startLevel(level, { preserveProgram:true }); else openDialog('expedition', expeditionHTML());
}
function resumeExpedition() {
  S.run = normalizeDungeonRun(S.profile.activeRun); if (!S.run) { startNewExpedition(); return; }
  restoreRunCode(S.run);
  if (S.run.failed) { openDialog('expedition', expeditionHTML()); return; }
  const level = expeditionLevel(S.run); if (level && !S.run.cleared.includes(S.run.current)) startLevel(level, { preserveProgram:true }); else openDialog('expedition', expeditionHTML());
}
function enterCurrentRunRoom() {
  if (!S.run) return;
  if (S.run.code) restoreRunCode(S.run);
  const level = expeditionLevel(S.run); if (level) startLevel(level, { preserveProgram:true }); else openDialog('expedition', expeditionHTML());
}
function completeExpeditionEncounter() {
  const result = completeCombatRoom(S.run, S.model.snapshot()); if (!result.ok) return false;
  S.run = result.run; saveRun(S.run, true);
  if (result.finished) {
    const finished = finishDungeonRun(S.profile, S.run); S.profile = finished.profile; S.run = null; saveProfile();
    const score = scoreForProfile(S.profile); S.ctx.finish({ score }); S.best = Math.max(S.best, score); S.ctx.sfx && S.ctx.sfx.good && S.ctx.sfx.good();
    openDialog('win', '<h2>' + pair('Expedition Complete!','遠征完成！') + '</h2><p>' + pair('The Compiler Catacombs are clear. Your final program survived the whole connected run.', '編譯者地下城已清除，你的最終程式成功走完整場相連遠征。') + '</p><p>' + pair('A deterministic relic chest is waiting at Camp.', '營地已有一個確定性遺物寶箱等著你。') + '</p><div class="cq-dialog-actions">' + button('camp', label(UI.inventory), 'class="cq-primary"') + button('map', label(UI.questMap)) + '</div>');
  } else openDialog('expedition', expeditionHTML());
  render(); return true;
}
function failExpedition() {
  if (!S.run) return;
  S.run = failDungeonRun({ ...S.run, code:sourceFromAst() }); S.profile = setActiveDungeonRun(S.profile, S.run); saveProfile(); S.autoRun = false;
  openDialog('expedition', expeditionHTML());
}

function mapHTML() {
  const groups = new Map();
  LEVELS.forEach((level, index) => {
    if (!groups.has(level.region.id)) groups.set(level.region.id, { region: level.region, levels: [] });
    groups.get(level.region.id).levels.push({ level, index });
  });
  const sections = [...groups.values()].map(group => '<section class="cq-map-region"><h3>' + label(group.region.label) + '</h3><div class="cq-map-grid">' + group.levels.map(({ level, index }) => {
    const unlocked = index === 0 || S.profile.completed.includes(LEVELS[index - 1].id), done = S.profile.completed.includes(level.id), best = S.profile.bestBlocks[level.id] || 0;
    return button('level:' + index, '<b>' + (index + 1) + '</b><span>' + label(level.title) + '</span><small>' + label(level.concept) + '</small><em>' + (done ? pair('Cleared' + (best ? ' · ' + best + ' blocks' : ''), '已完成' + (best ? '・' + best + ' 積木' : '')) : unlocked ? pair('Ready', '可以挑戰') : label(UI.locked)) + '</em>', 'class="cq-level ' + (done ? 'done' : '') + '" ' + (!unlocked ? 'disabled' : ''));
  }).join('') + '</div></section>').join('');
  const towerUnlocked = S.profile.completed.length >= 8, runUnlocked = S.profile.completed.length >= 30;
  const runButton = S.profile.activeRun ? button('run:resume', pair('Resume connected expedition','繼續相連遠征'), 'class="cq-primary"') : button('run:new', pair(runUnlocked ? 'Begin connected expedition' : 'Locked · clear Algorithm Vault', runUnlocked ? '開始相連遠征' : '尚未解鎖・先完成演算法寶庫'), 'class="cq-primary" ' + (!runUnlocked ? 'disabled' : ''));
  return '<div class="cq-dialog-head"><h2>' + label(UI.questMap) + '</h2>' + button('dialog:close', label(UI.close)) + '</div><div class="cq-map-scroll">' + sections + '<section class="cq-map-region cq-expedition"><h3>' + pair('Compiler Catacombs','編譯者地下城') + '</h3><p>' + pair('A procedural connected expedition: search branches, stabilize a run hazard, collect compiler sigils, and carry three Rune loadouts between rooms.', '程序化相連遠征：搜尋分支、穩定遠征危害、收集編譯符印，並在房間間攜帶三組符文配置。') + runButton + '<small>' + pair('Cleared expeditions: ' + S.profile.expeditionsCleared + ' · best rooms ' + S.profile.bestExpeditionRooms + '/13', '完成遠征：' + S.profile.expeditionsCleared + '・最佳房間 ' + S.profile.bestExpeditionRooms + '/13') + '</small></section><section class="cq-map-region cq-tower"><h3>' + label(UI.tower) + '</h3><p>' + pair('Endless deterministic rooms combine everything you have learned.', '無限的確定性房間，會混合你已學會的程式概念。') + '</p>' + button('endless:' + Math.max(1, S.profile.endlessBest + 1), pair((towerUnlocked ? 'Enter floor ' : 'Locked · floor ') + Math.max(1, S.profile.endlessBest + 1), (towerUnlocked ? '進入第 ' : '尚未解鎖・第 ') + Math.max(1, S.profile.endlessBest + 1) + ' 層'), 'class="cq-primary" ' + (!towerUnlocked ? 'disabled' : '')) + '</section></div>';
}

function ingredientChip(id) {
  const count = S.profile.ingredients[id] || 0;
  return '<span class="cq-ingredient ' + (!count ? 'empty' : '') + '"><img src="' + spriteURL(id, kidColor()) + '" alt=""><b>' + label(ITEM_LABELS[id]) + '</b><span>×' + count + '</span></span>';
}

function potionSprite(id) { return id === 'healing' ? 'potion' : id === 'focus' ? 'moonBerry' : id; }

function campHTML() {
  const build = combatStatsFor(S.profile);
  const setNames = { ember:['Ember Circuit','餘燼迴路'], frost:['Frost Circuit','冰霜迴路'], aegis:['Aegis Circuit','守護迴路'] };
  const setSummary = build.activeSets && build.activeSets.length ? '<div class="cq-set-bonuses"><b>' + pair('Active set effects','已啟用套裝效果') + '</b>' + build.activeSets.map(set => '<span>' + label(setNames[set.id] || [set.id,set.id]) + ' ×' + set.pieces + '</span>').join('') + '</div>' : '';
  const equipmentIds = [...S.profile.equipment, ...S.profile.lootGear.map(item => item.id)];
  const equipment = equipmentIds.map(id => {
    const item = equipmentDescriptor(S.profile, id) || CODEQUEST_EQUIPMENT[id];
    if (!item) return '';
    const active = S.profile.loadout && S.profile.loadout[item.slot] === id;
    const stats = [item.rarity ? item.rarity.toUpperCase() : '', item.damage ? item.damage + ' ' + UI.damage[0] : '', item.spellDamage ? item.spellDamage + ' SPELL' : '', item.range && item.range > 1 ? 'RANGE ' + item.range : '', item.element && item.element !== 'neutral' ? item.element.toUpperCase() : '', item.defense ? '+' + item.defense + ' DEF' : '', item.maxHp ? '+' + item.maxHp + ' HP' : '', item.wardBonus ? '+' + item.wardBonus + ' WARD' : '', item.rangeBonus ? '+' + item.rangeBonus + ' RANGE' : '', item.setId ? 'SET ' + item.setId.toUpperCase() : '', item.affixLabels ? item.affixLabels.map(entry=>entry[0]).join(' + ') : ''].filter(Boolean).join(' · ');
    return '<article class="cq-equip-card ' + (active ? 'active' : '') + ' ' + (item.rarity ? 'rarity-' + item.rarity : '') + '"><img src="' + spriteURL(item.spriteId || item.id, kidColor()) + '" alt=""><div><b>' + label(item.label) + '</b><span>' + pair(item.slot.toUpperCase(), item.slot === 'weapon' ? '武器' : item.slot === 'armor' ? '防具' : '護符') + (stats ? ' · ' + esc(stats) : '') + '</span></div>' + button('equip:' + id, active ? label(UI.equipped) : label(UI.equip), active ? 'disabled' : '') + '</article>';
  }).join('');
  const relicChoices = S.profile.pendingLoot.length ? '<section class="cq-relic-choice"><h3>' + pair('Relic Chest · choose one', '遺物寶箱・選一件') + '</h3><p>' + pair('The other two dissolve when you claim a relic. Compare its slot, rarity and affixes first.', '領取一件後另外兩件會消失，先比較欄位、稀有度與詞綴。') + '</p><div class="cq-equipment">' + S.profile.pendingLoot.map(item => { const stats=[item.rarity.toUpperCase(), item.damage?item.damage+' '+UI.damage[0]:'', item.spellDamage?item.spellDamage+' SPELL':'', item.defense?'+'+item.defense+' DEF':'', item.maxHp?'+'+item.maxHp+' HP':'', item.element!=='neutral'?item.element.toUpperCase():'', item.setId?'SET '+item.setId.toUpperCase():'', item.affixLabels.map(entry=>entry[0]).join(' + ')].filter(Boolean).join(' · '); return '<article class="cq-equip-card rarity-' + item.rarity + '"><img src="' + spriteURL(item.spriteId, kidColor()) + '" alt=""><div><b>' + label(item.label) + '</b><span>' + esc(stats) + '</span></div>' + button('loot:claim:' + item.id, pair('Claim', '領取'), 'class="cq-primary"') + '</article>'; }).join('') + '</div></section>' : '';
  const stock = ['healing','focus','antidote','ward'].map(id => '<span><img src="' + spriteURL(potionSprite(id), kidColor()) + '" alt="">' + label(ITEM_LABELS[id]) + ' ×' + S.profile.potions[id] + '</span>').join('');
  return '<div class="cq-dialog-head"><h2>' + label(UI.campTitle) + '</h2>' + button('dialog:close', label(UI.close)) + '</div>' + (S.campNotice ? '<p class="cq-camp-notice">' + label(S.campNotice) + '</p>' : '') + '<div class="cq-camp-scroll">' + relicChoices + '<section><h3>' + label(UI.bag) + '</h3><div class="cq-ingredients">' + ['sunHerb','moonBerry','waterCrystal','emberRoot'].map(ingredientChip).join('') + '</div></section>' +
    // The potion bench, process, recipes and potion script moved into the Lab (lab design D2).
    '<section class="cq-camp-potions"><h3>' + label(UI.potions) + '</h3><div class="cq-potion-stock">' + stock + '</div>' + button('lab', label(LAB.openFromCamp), 'class="cq-primary cq-camp-lab"') + '</section>' +
    '<section><h3>' + label(UI.equipment) + '</h3>' + setSummary + '<div class="cq-equipment">' + equipment + '</div></section></div>';
}
function openDialog(kind, html) {
  if (!S) return;
  S.dialog = kind; S.scheduler.pause();
  const dialog = S.root.querySelector('.cq-dialog');
  dialog.innerHTML = html || (kind === 'map' ? mapHTML() : kind === 'camp' ? campHTML() : '<h2>' + label(UI.pausedTitle) + '</h2><p>' + label(UI.pausedBody) + '</p><div class="cq-dialog-actions">' + button('pause', label(UI.resume), 'class="cq-primary" autofocus') + '</div>');
  dialog.setAttribute('aria-label', kind === 'map' ? 'Quest map 冒險地圖' : kind === 'camp' ? 'Pixel camp 像素營地' : kind === 'expedition' ? 'Connected dungeon expedition 相連地下城遠征' : kind === 'code' ? 'Code 程式碼' : 'Code Quest paused 程式冒險暫停');
  dialog.classList.toggle('cq-sheet', kind === 'code');
  if (S.bubble) S.bubble.hidden = true;
  if (!dialog.open) dialog.showModal();
}
function closeDialog(resume = true) {
  if (!S || !S.dialog) return;
  const dialog = S.root.querySelector('.cq-dialog');
  try { dialog.close(); } catch (e) {}
  S.dialog = null;
  if (resume && !S.paused) S.scheduler.resume();
  render();
}
function pause() {
  // The Lab has no clock to stop; the dungeon behind it is already paused.
  if (!S || S.paused || S.dialog === 'win' || S.lab) return;
  S.paused = true; S.autoRun = false;
  openDialog('pause'); render();
}
function resume() {
  if (!S) return;
  S.paused = false; closeDialog(false); S.scheduler.resume(); render();
}

/* Lab (lab design D1): the dungeon waits, paused, while the Lab is open. */
function bumpConsumable(id) {
  // A potion brewed mid-room also lands on the hero's belt, as the Camp bench always did.
  if (S.model && S.model.hero && S.model.hero.consumables && Object.hasOwn(S.model.hero.consumables, id)) S.model.hero.consumables[id] = Math.min(9, S.model.hero.consumables[id] + 1);
}
function openLab() {
  if (!S || S.lab) return;
  if (S.dialog) closeDialog(false);
  // The scheduler freezes a running turn mid-step; it carries on when the kid comes back.
  closeMenu(); S.scheduler.pause();
  S.root.querySelector('.cq-play').hidden = true;
  S.lab = mountLab(S.root, {
    profile: () => S.profile,
    save: profile => { S.profile = profile; saveProfile(); },
    onPotion: bumpConsumable,
    sfx: S.ctx.sfx, kidColor, reduced: S.reducedMotion,
    canScript: () => S.profile.completed.includes('q26')
  });
  renderBar();
}
function closeLab() {
  if (!S || !S.lab) return false;
  S.lab.destroy(); S.lab = null;
  S.root.querySelector('.cq-play').hidden = false;
  if (!S.paused && !S.dialog) S.scheduler.resume();
  renderBar(); render();
  return true;
}

function perform(actionId) {
  if (!S || !actionId) return;
  if (actionId === 'strip:main' || actionId === 'strip:rune') { S.editor = actionId === 'strip:rune' ? 'rune' : 'main'; currentSelection().clear(); if (S.editor === 'rune' && !S.runeProgram.length) notify(UI.functionHint); render(); return; }
  if (actionId.startsWith('nudge:')) { const selected = [...currentSelection()]; if (selected.length === 1) moveIndex(selected[0], Number(actionId.slice(6))); return; }
  if (actionId === 'delete') { const selected = [...currentSelection()].sort((a, b) => b - a); if (!selected.length) return; pushUndo(); let list = currentProgram().slice(); for (const i of selected) list.splice(i, 1); setCurrentProgram(list); currentSelection().clear(); render(); return; }
  if (actionId === 'goal') { S.goalOpen = !S.goalOpen; render(); return; }
  if (actionId === 'debug') { S.debugOpen = !S.debugOpen; render(); return; }
  if (actionId === 'code') { if (!S.codeDraft) syncCodeFromAst(); openDialog('code', codeSheetHTML()); return; }
  if (actionId === 'lang') { setLang(language() === 'zh' ? 'en' : 'zh'); return; }
  if (actionId === 'code:apply') { applyCodeDraft(); return; }
  if (actionId === 'code:reset') { resetCodeDraft(); return; }
  if (actionId.startsWith('snippet:')) { insertCodeSnippet(actionId.slice(8)); return; }
  if (actionId.startsWith('library:save:')) { const i=Number(actionId.slice(13)); const result=saveRuneLibrary(S.profile,i,sourceFromAst()); if(result.ok){S.profile=result.profile;saveProfile();notify(['Rune Library slot saved.','符文函式庫欄位已儲存。']);render();} return; }
  if (actionId.startsWith('library:load:')) { const i=Number(actionId.slice(13)); const result=loadRuneLibrary(S.profile,i); if(result.ok){const parsed=parseJavaScript(result.code);if(parsed.ok){S.program=parsed.program;S.runeProgram=[];S.extraFunctions={...parsed.functions};syncCodeFromAst();notify(['Rune Library program loaded.','已載入符文函式庫程式。']);render();}} return; }
  if (actionId.startsWith('behavior:save:')) {
    const owner=actionId.slice('behavior:save:'.length), code=sourceFromAst(), parsed=parseJavaScript(code);
    if(!['hero','companion'].includes(owner)||!parsed.ok||!parsed.program.length||parsed.program.some(node=>node.type!=='on')){notify(['Behavior source may contain only top-level on(...) registrations plus functions.','行為來源只能包含頂層 on(...) 註冊與函式。']);return;}
    if(!behaviorOwnershipOK(parsed,owner)){notify([owner.toUpperCase()+' behavior may command only '+owner+' actions/state/signals.','此行為只能控制'+(owner==='hero'?'英雄':'夥伴')+'自己的動作／狀態／訊號。']);return;}
    const result=saveBehaviorSource(S.profile,owner,code,true);S.profile=result.profile;saveProfile();notify([owner.toUpperCase()+' persistent behavior saved and enabled.','已儲存並開啟'+(owner==='hero'?'英雄':'夥伴')+'持續行為。']);render();return;
  }
  if (actionId.startsWith('behavior:toggle:')) {
    const owner=actionId.slice('behavior:toggle:'.length), saved=behaviorFor(S.profile,owner); if(!['hero','companion'].includes(owner)) return;
    S.profile=setBehaviorEnabled(S.profile,owner,!saved.enabled);saveProfile();notify(!saved.enabled?[owner.toUpperCase()+' persistent behavior enabled.','已開啟'+(owner==='hero'?'英雄':'夥伴')+'持續行為。']:[owner.toUpperCase()+' persistent behavior disabled.','已關閉'+(owner==='hero'?'英雄':'夥伴')+'持續行為。']);render();return;
  }
  if (actionId.startsWith('add:')) { addAction(actionId.slice(4)); return; }
  if (actionId.startsWith('logic:')) { logic(actionId.slice(6)); return; }
  if (actionId.startsWith('menu:')) { menuAction(actionId); return; }
  if (actionId === 'zoom:in') { setZoom(S.camera.zoom + 1); return; }
  if (actionId === 'zoom:out') { setZoom(S.camera.zoom - 1); return; }
  if (actionId === 'zoom:home') { setZoom(0); return; }
  if (actionId.startsWith('select:')) { selectIndex(Number(actionId.slice(7))); return; }
  if (actionId.startsWith('remove:')) { removeIndex(Number(actionId.slice(7))); return; }
  if (actionId.startsWith('up:')) { moveIndex(Number(actionId.slice(3)), -1); return; }
  if (actionId.startsWith('down:')) { moveIndex(Number(actionId.slice(5)), 1); return; }
  if (actionId === 'undo') { if (restoreUndo()) render(); return; }
  if (actionId === 'clear') { if (currentProgram().length) { pushUndo(); setCurrentProgram([]); currentSelection().clear(); render(); } return; }
  if (actionId === 'run') { closeMenu(); executeOne(true); return; }
  if (actionId === 'step') { closeMenu(); executeOne(false); return; }
  if (actionId === 'reset') { closeMenu(); S.camera = HOME(); S.model = createModel(S.level); S.autoRun = false; S.heroState = 'idle'; S.heroMotion = null; S.enemyMotions = {}; S.fx = null; S.activeUid = null; S.completing = false; notify(['Room reset. Your program stayed on the table.', '房間已重設，程式仍保留在桌上。']); render(); return; }
  if (actionId === 'map') { openDialog('map'); return; }
  if (actionId === 'camp') { openDialog('camp'); return; }
  if (actionId === 'lab') { openLab(); return; }
  if (actionId === 'lab:exit') { closeLab(); return; }
  if (actionId === 'pause') { if (S.paused) resume(); else pause(); return; }
  if (actionId === 'dialog:close') { closeDialog(); return; }
  if (actionId.startsWith('run:loadout:save:')) { const index = Number(actionId.slice(17)); const result = saveRunLoadout(S.run,index,sourceFromAst()); if (result.ok) { S.run=result.run; saveRun(S.run,false); notify(['Rune loadout saved.','符文配置已儲存。']); } openDialog('expedition', expeditionHTML()); return; }
  if (actionId.startsWith('run:loadout:load:')) { const index = Number(actionId.slice(17)); const result = activateRunLoadout(S.run,index); if (result.ok) { S.run=result.run; saveRun(S.run,false); restoreRunCode(S.run); notify(['Rune loadout loaded.','符文配置已載入。']); } openDialog('expedition', expeditionHTML()); return; }
  if (actionId === 'run:new') { if (S.profile.activeRun) { S.profile = abandonDungeonRun(S.profile); saveProfile(); } startNewExpedition(); return; }
  if (actionId === 'run:resume') { resumeExpedition(); return; }
  if (actionId === 'run:enter') { enterCurrentRunRoom(); return; }
  if (actionId.startsWith('run:next:')) { const result = enterDungeonRoom(S.run, actionId.slice(9)); if (result.ok) { S.run=result.run; saveRun(S.run,true); const meta=roomMeta(S.run.current); if (meta && ['combat','elite','boss'].includes(meta.type)) enterCurrentRunRoom(); else openDialog('expedition', expeditionHTML()); } return; }
  if (actionId.startsWith('run:choice:')) { const result = resolveRunChoice(S.run, actionId.slice(11)); if (result.ok) { S.run=result.run; saveRun(S.run,true); } openDialog('expedition', expeditionHTML()); return; }
  if (actionId === 'run:abandon') { S.profile = abandonDungeonRun(S.profile); S.run=null; saveProfile(); if (S.level && S.level.expedition) { const next = LEVELS.findIndex(level => !S.profile.completed.includes(level.id)); startLevel(LEVELS[next < 0 ? LEVELS.length - 1 : next]); } openDialog('map', mapHTML()); return; }
  if (actionId.startsWith('level:')) { startAuthored(Number(actionId.slice(6))); return; }
  if (actionId.startsWith('endless:')) { startEndless(Number(actionId.slice(8))); return; }
  if (actionId.startsWith('loot:claim:')) { const result = claimLoot(S.profile, actionId.slice(11)); if (result.ok) { S.profile = result.profile; saveProfile(); syncCombatStats(); S.campNotice = ['Relic claimed.', '已領取遺物。']; notify(S.campNotice); } openDialog('camp', campHTML()); return; }
  if (actionId.startsWith('equip:')) { S.profile = equip(S.profile, actionId.slice(6)); saveProfile(); syncCombatStats(); notify(MESSAGES.equipped); openDialog('camp', campHTML()); return; }
  if (actionId === 'win:replay') { const level = S.level; closeDialog(false); startLevel(level); return; }
  if (actionId === 'win:continue') {
    const current = S.level;
    closeDialog(false);
    if (current.endless) startEndless(current.floor + 1);
    else {
      const index = LEVELS.findIndex(level => level.id === current.id);
      if (index >= 0 && index < LEVELS.length - 1) startAuthored(index + 1); else openDialog('map');
    }
  }
}

function keydown(e) {
  if (!S) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    if (S.dialog === 'win') return;
    if (S.dialog) { if (S.paused) resume(); else closeDialog(); }
    else if (S.lab) { if (!S.lab.closeSheet()) closeLab(); }
    else pause();
  }
}
function visibility() { if (document.hidden) pause(); }

function barReady() { return !!(BAR && BAR.isConnected); }
/* Map / Camp / Code / language / Pause live in the host bar next to Back, like Kitchen
   Quest, so the stage keeps its full height on short landscape tablets. */
function settings(bar) {
  BAR = bar;
  bar.innerHTML = setbarHTML();
  bar.addEventListener('pointerdown', e => {
    const target = e.target.closest('button[data-action]');
    if (!S || !target || target.disabled || e.button !== 0) return;
    e.preventDefault(); perform(target.dataset.action);
  });
  bar.addEventListener('click', e => {
    const target = e.target.closest('button[data-action]');
    // Keyboard activation only: a pointer's click was already handled on pointerdown (a toggle like 中文 would flip back).
    if (S && e.detail === 0 && !e.pointerType && target && !target.disabled) perform(target.dataset.action);
  });
}

function init(ctx) {
  stop();
  const root = document.createElement('div'); root.className = 'cq';
  setLanguage(savedLang(ctx));
  root.innerHTML = '<link rel="stylesheet" href="' + new URL('../../css/codequest.css', import.meta.url).href + '">' +
    (barReady() ? '' : '<header class="cq-top"></header>') +
    '<main class="cq-play"><section class="cq-scene"><canvas width="480" height="270" role="img" aria-label="Pixel dungeon room 像素地下城房間"></canvas>' +
    '<div class="cq-hud"><div class="cq-hud-left"><button type="button" class="cq-goal" data-action="goal" aria-expanded="false"></button><div class="cq-goal-pop" hidden></div></div><div class="cq-vitals"></div></div>' +
    '<button type="button" class="cq-debug-toggle" data-action="debug" aria-label="Event debugger 事件除錯器" hidden>' + glyph('bug') + '</button><aside class="cq-debug" hidden></aside>' +
    '<div class="cq-zoom" role="group"></div><div class="cq-bubble" hidden></div></section>' +
    '<section class="cq-dock"><div class="cq-program"><div class="cq-strip-tabs-slot"></div><div class="cq-strip cq-scroll" role="group"></div><div class="cq-tools"></div></div>' +
    '<div class="cq-library cq-scroll" role="group" aria-label="Command cards 指令卡"></div>' +
    '<div class="cq-runbox"></div></section><div class="cq-card-menu" role="toolbar" hidden></div></main>' +
    '<p class="cq-notice cq-sr" role="status" aria-live="polite"></p><dialog class="cq-dialog"></dialog>';

  const saved = ctx.settings.codequest && ctx.settings.codequest.profiles && ctx.settings.codequest.profiles[ctx.kid];
  const profile = normalizeProfile(saved, ctx.best);
  const firstUncleared = LEVELS.findIndex(level => !profile.completed.includes(level.id));
  const initial = firstUncleared < 0 ? LEVELS[LEVELS.length - 1] : LEVELS[firstUncleared];
  const initialMode = modeFor(profile);
  const initialRepresentation = initial.codingView === 'hybrid' && (initialMode === 'coder' || initialMode === 'architect') ? 'hybrid' : initialMode === 'explorer' ? 'picture' : initialMode === 'builder' ? 'blocks' : 'hybrid';
  S = {
    root, ctx, profile, level: initial, model: null, program: [], runeProgram: [], extraFunctions: {}, selectedMain: new Set(), selectedRune: new Set(),
    editor: 'main', representation: initialRepresentation, goalOpen: false, debugOpen: false, noticeAt: 0, preview: null, view: null, bubbleSide: null, menuOpen: false, menuWrap: false, justAdded: null, camera: HOME(),
    codeDraft: '', codeDirty: false, codeError: null,
    undo: [], serial: 0, scheduler: createScheduler(), paused: false, dialog: null, autoRun: false,
    canvas: root.querySelector('canvas'), bubble: root.querySelector('.cq-bubble'), best: Number(ctx.best) || 0, notice: MESSAGES.intro, heroState: 'idle', heroStateUntil: 0, heroMotion: null, enemyMotions: {}, fx: null, activeUid: null,
    lab: null, campNotice: null, completing: false, lastDraw: 0, run: normalizeDungeonRun(profile.activeRun)
  };
  S.model = createModel(initial); syncCodeFromAst();
  settingsRoot(ctx)[ctx.kid] = profile; ctx.saveSettings();
  ctx.mount.classList.add('cq-stage'); ctx.mount.appendChild(root); ctx.hud([]);

  root.addEventListener('input', e => {
    if (!S || !e.target.classList) return;
    if (!e.target.classList.contains('cq-code-input')) return;
    S.codeDraft = e.target.value; S.codeDirty = true; S.codeError = null;
    const status = root.querySelector('.cq-code-status'); if (status) status.innerHTML = label(MESSAGES.codeChanged);
    const run = root.querySelector('[data-action="run"]'), step = root.querySelector('[data-action="step"]'); if (run) run.disabled = true; if (step) step.disabled = true;
  });

  root.addEventListener('pointerdown', e => {
    if (S && S.menuOpen && !e.target.closest('.cq-card-menu, .cq-strip')) closeMenu();
    const target = e.target.closest('button[data-action]');
    if (!target || target.disabled || e.button !== 0) return;
    if (target.closest('.cq-scroll')) return;
    e.preventDefault(); target.focus({ preventScroll: true }); perform(target.dataset.action);
  });
  root.addEventListener('click', e => {
    const target = e.target.closest('button[data-action]');
    if (target && !target.disabled && (e.detail === 0 || target.closest('.cq-scroll'))) perform(target.dataset.action);
  });
  sceneGestures(S.canvas);
  root.querySelector('.cq-zoom').setAttribute('aria-label', 'Zoom 縮放');
  root.querySelector('.cq-strip').addEventListener('scroll', () => { if (S) placeMenu(); }, { passive: true });
  root.querySelector('.cq-dialog').addEventListener('cancel', e => { e.preventDefault(); if (S.dialog === 'win') return; if (S.paused) resume(); else closeDialog(); });
  document.addEventListener('keydown', keydown, true); document.addEventListener('visibilitychange', visibility);
  window.addEventListener('blur', pause); window.addEventListener('summerquest:native-pause', pause);
  S.reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // The canvas backing store follows its box in device pixels (room-view fits the room at a whole-number scale).
  if (typeof ResizeObserver === 'function') { S.resize = new ResizeObserver(() => { if (S) draw(); }); S.resize.observe(root.querySelector('.cq-scene')); }
  S.scheduler.frame(time => { if (!S || S.paused || S.dialog) return; if (time - S.lastDraw > 48) { S.lastDraw = time; draw(time); } });
  renderBar(); render(); notify(initial.codingView === 'code' && initialMode === 'architect' ? CODE_ROOM : MESSAGES.intro);
  if (S.run) openDialog('expedition', expeditionHTML());
}

function stop() {
  if (!S) return;
  S.scheduler.cancelAll();
  if (S.resize) S.resize.disconnect();
  document.removeEventListener('keydown', keydown, true); document.removeEventListener('visibilitychange', visibility);
  window.removeEventListener('blur', pause); window.removeEventListener('summerquest:native-pause', pause);
  if (S.lab) { S.lab.destroy(); S.lab = null; }
  const dialog = S.root.querySelector('.cq-dialog'); try { if (dialog.open) dialog.close(); } catch (e) {}
  S.root.remove(); S.ctx.mount.classList.remove('cq-stage'); S = null;
}

export default {
  id: 'codequest', version: '0.14.0', keyboard: false, bestKey: 'codequest',
  meta: { icon: '🏰', title: 'Code Quest', tz: '程式冒險', blurb: 'Program the hero · 編程闖關' },
  settings, init, stop,
  /** Host Back: inside the Lab it closes the script sheet, then returns to the dungeon — one press never leaves Code Quest from the Lab. */
  back() { if (!S || !S.lab) return false; if (!S.lab.closeSheet()) closeLab(); return true; },
  snapshot() { return S ? { level: S.level.id, lab: S.lab ? S.lab.snapshot() : { open: false }, model: S.model.snapshot(), profile: S.profile, run:S.run, program: S.program, runeProgram: S.runeProgram, editor: S.editor, representation: S.representation, codeDirty: S.codeDirty, paused: S.paused, dialog: S.dialog, lang: language(), goalOpen: !!S.goalOpen, preview: S.preview, notice: S.notice, bubbleSide: S.bubbleSide, heroBox: S.view ? S.view.heroBox : null, menuOpen: menuVisible(), selection: [...currentSelection()].sort((a, b) => a - b), camera: { zoom: S.camera.zoom, cx: S.camera.cx, cy: S.camera.cy } } : null; }
};
