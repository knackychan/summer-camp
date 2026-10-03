import { createScheduler } from '../game-services/scheduler.js';
import { CodeQuestModel } from './codequest/model.js';
import { LEVELS, generateEndless } from './codequest/levels.js';
import { action, repeat, ifNode, call, combinedBlockCount, toJavaScript } from './codequest/ast.js';
import { parseJavaScript, CODE_API } from './codequest/parser.js';
import { runAlchemyCode, recipeToAlchemyCode, recipeById } from './codequest/alchemy-code.js';
import { normalizeProfile, recordLevelComplete, recordEndlessClear, modeFor, equipmentDescriptor, equipmentFor, weaponFor, combatStatsFor, brewLab, equip, claimLoot, consumePotion, scoreForProfile, setActiveDungeonRun, finishDungeonRun, abandonDungeonRun, saveRuneLibrary, loadRuneLibrary, saveBehaviorSource, setBehaviorEnabled, behaviorFor, CODEQUEST_EQUIPMENT, RECIPES, ALCHEMY_STEPS } from './codequest/progression.js';
import { createDungeonRun, normalizeDungeonRun, roomMeta, roomGraph, nextRooms, enterDungeonRoom, resolveRunChoice, completeCombatRoom, failDungeonRun, expeditionLevel, dungeonRunSummary, hazardInfo, sigilsRequired, saveRunLoadout, activateRunLoadout } from './codequest/run.js';
import { spriteURL } from './codequest/pixel-art.js';
import { drawDungeonWorld, WIDTH, HEIGHT } from './codequest/dungeon-view.js';
import { COMMANDS, CONDITIONS, LOGIC, UI, ITEM_LABELS, ALCHEMY_LABELS, MESSAGES, pairHTML } from './codequest/strings.js';

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
  S.notice = text;
  const node = S.root.querySelector('.cq-notice');
  if (node) node.innerHTML = label(text);
}

function modeLabel() { return UI[modeFor(S.profile)] || UI.explorer; }
function kidColor() { return S.ctx.kids && S.ctx.kids[S.ctx.kid] && S.ctx.kids[S.ctx.kid].color || '#39d0c8'; }

function actionIcon(op) {
  if (op === 'attack' || op === 'heavyAttack') { const gear = weaponFor(S.profile); return '<img src="' + spriteURL(gear.spriteId || gear.id, kidColor()) + '" alt="">'; }
  if (op === 'guard') return '<img src="' + spriteURL('guardCape', kidColor()) + '" alt="">';
  if (op === 'open') return '<img src="' + spriteURL('chest-closed', kidColor()) + '" alt="">';
  if (op === 'usePotion') return '<img src="' + spriteURL('potion', kidColor()) + '" alt="">';
  if (op === 'useAntidote') return '<img src="' + spriteURL('antidote', kidColor()) + '" alt="">';
  if (op === 'useWard') return '<img src="' + spriteURL('ward', kidColor()) + '" alt="">';
  if (op === 'disarm') return '<img src="' + spriteURL('trap-active', kidColor()) + '" alt="">';
  if (op === 'interact') return '<img src="' + spriteURL('lever-off', kidColor()) + '" alt="">';
  if (op === 'smash') return '<img src="' + spriteURL('crate', kidColor()) + '" alt="">';
  if (op === 'push') return '<img src="' + spriteURL('push-block', kidColor()) + '" alt="">';
  if (op === 'take' || op === 'throw') return '<img src="' + spriteURL('rune-core', kidColor()) + '" alt="">';
  if (op.startsWith('companion')) return '<img src="' + spriteURL('companion', kidColor()) + '" alt="">';
  if (op === 'cast') { const gear = weaponFor(S.profile); return '<img src="' + spriteURL(gear.spriteId || gear.id, kidColor()) + '" alt="">'; }
  if (op.startsWith('target')) return '<b class="cq-glyph" aria-hidden="true">◎</b>';
  const glyph = { move:'→', turnLeft:'↶', turnRight:'↷', wait:'…' }[op] || '◆';
  return '<b class="cq-glyph" aria-hidden="true">' + glyph + '</b>';
}

function logicIcon(id) {
  if (id.startsWith('repeat')) return '<b class="cq-glyph">↻</b>';
  if (id.startsWith('if')) return '<b class="cq-glyph">?</b>';
  return '<b class="cq-glyph">ƒ</b>';
}

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

function renderNested(nodes, depth = 0) {
  if (!nodes.length) return '<span class="cq-empty-nest">' + pair('empty', '空的') + '</span>';
  return '<div class="cq-nested" style="--depth:' + depth + '">' + nodes.map(node => {
    const cls = 'cq-mini cq-mini-' + node.type + (node.uid && node.uid === S.activeUid ? ' executing' : '');
    let body = '<span>' + label(nodeTitle(node)) + '</span>';
    if (node.type === 'repeat' || node.type === 'forOf') body += renderNested(node.body, depth + 1);
    else if (node.type === 'if') {
      body += '<div class="cq-branch"><em>' + label(['THEN', '就做']) + '</em>' + renderNested(node.then, depth + 1) + '</div>';
      if (node.else.length) body += '<div class="cq-branch"><em>' + label(['ELSE', '否則']) + '</em>' + renderNested(node.else, depth + 1) + '</div>';
    }
    return '<div class="' + cls + '">' + body + '</div>';
  }).join('') + '</div>';
}

function renderProgramCards() {
  const nodes = currentProgram(), selected = currentSelection();
  if (!nodes.length) return '<div class="cq-empty-program">' + pair('Your program is empty. Add an action card below.', '主程式還是空的，從下面加入一張動作卡。') + '</div>';
  return '<div class="cq-program-list">' + nodes.map((node, index) => {
    const isSelected = selected.has(index), title = nodeTitle(node);
    let interior = node.type === 'action' ? actionIcon(node.op) + label(title) : node.type === 'call' ? logicIcon('callRune') + label(title) : logicIcon(node.type) + label(title);
    if (node.type === 'repeat' || node.type === 'forOf') interior += renderNested(node.body, 1);
    if (node.type === 'if') interior += '<div class="cq-branch"><em>' + label(['THEN', '就做']) + '</em>' + renderNested(node.then, 1) + '</div>' + (node.else.length ? '<div class="cq-branch"><em>' + label(['ELSE', '否則']) + '</em>' + renderNested(node.else, 1) + '</div>' : '');
    const running = node.uid && node.uid === S.activeUid;
    return '<article class="cq-program-card ' + (isSelected ? 'selected ' : '') + (running ? 'executing' : '') + '" data-index="' + index + '">' +
      button('select:' + index, '<span class="cq-card-index">' + (index + 1) + '</span><span class="cq-card-main">' + interior + '</span>', 'class="cq-card-select" aria-pressed="' + isSelected + '"') +
      '<div class="cq-card-tools">' + button('up:' + index, '↑', 'aria-label="Move up 上移" ' + (index === 0 ? 'disabled' : '')) + button('down:' + index, '↓', 'aria-label="Move down 下移" ' + (index === nodes.length - 1 ? 'disabled' : '')) + button('remove:' + index, '×', 'aria-label="Remove 移除"') + '</div></article>';
  }).join('') + '</div>';
}

function codeUnlocked() { return modeFor(S.profile) === 'architect'; }
function allowedRepresentations() {
  const mode = modeFor(S.profile);
  if (mode === 'explorer') return ['picture'];
  if (mode === 'builder') return ['picture', 'blocks'];
  if (mode === 'coder') return ['picture', 'blocks', 'hybrid'];
  return ['picture', 'blocks', 'hybrid'];
}
function defaultRepresentation() {
  const mode = modeFor(S.profile);
  if (mode === 'explorer') return 'picture';
  if (mode === 'builder') return 'blocks';
  return 'hybrid';
}
function representationSwitcher() {
  const names = { picture: UI.picture, blocks: UI.blocksView, hybrid: UI.hybrid };
  return '<div class="cq-representation" role="group" aria-label="Coding abstraction level 程式抽象層級">' + allowedRepresentations().map(id => button('view:' + id, label(names[id]), 'aria-pressed="' + (S.representation === id) + '"')).join('') + '</div>';
}
function visualBuilderHTML() {
  const level = S.level, current = currentProgram();
  const picture = S.representation === 'picture';
  const actions = level.available.actions.map(op => button('add:' + op, actionIcon(op) + (picture ? '<span class="cq-picture-label">' + label(COMMANDS[op]) + '</span>' : label(COMMANDS[op])), 'class="cq-palette-card"')).join('');
  const logic = level.available.logic.map(id => button('logic:' + id, logicIcon(id) + label(LOGIC[id]), 'class="cq-palette-card cq-logic-card"')).join('');
  const hint = S.editor === 'rune' ? UI.functionHint : UI.selectHint;
  const mirror = S.representation === 'hybrid' ? '<aside class="cq-hybrid-code"><div class="cq-code-note">' + pair('Same program · real JavaScript form', '同一個程式・JavaScript 形式') + '</div><pre><code>' + esc(sourceFromAst()) + '</code></pre></aside>' : '';
  return '<section class="cq-builder cq-mode-' + S.representation + '">' + representationSwitcher() + '<div class="cq-builder-grid"><div class="cq-builder-main"><div class="cq-builder-head"><div><b>' + (S.editor === 'rune' ? label(UI.rune) : label(UI.program)) + '</b><span>' + label(hint) + '</span></div><span class="cq-count">' + combinedBlockCount(S.program, functions()) + ' / ' + S.level.maxBlocks + ' ' + label(UI.blocks) + '</span></div>' +
    '<div class="cq-program-tray">' + renderProgramCards() + '</div>' +
    '<div class="cq-palette"><h3>' + label(UI.actions) + '</h3><div class="cq-palette-grid">' + actions + '</div>' + (logic && !picture ? '<h3>' + label(UI.logic) + '</h3><div class="cq-palette-grid">' + logic + '</div>' : '') + '</div>' +
    (S.editor === 'rune' && !current.length ? '<p class="cq-rune-tip">' + pair('Build one reusable routine here, then call it from the turn program.', '在這裡建立一個可重複使用的函式，再從回合程式呼叫它。') + '</p>' : '') + '</div>' + mirror + '</div></section>';
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
function editorHTML() {
  const editor = S.editor === 'code' ? codeEditorHTML() : visualBuilderHTML();
  return editor + debuggerHTML();
}

function objectiveChecks() {
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
  return '<ul class="cq-checks">' + checks.map(([done, en, zh]) => '<li class="' + (done ? 'done' : '') + '"><b>' + (done ? '◆' : '◇') + '</b>' + pair(en, zh) + '</li>').join('') + '</ul>';
}

function questHTML() {
  const l = S.level, snap = S.model.snapshot(), best = S.profile.bestBlocks[l.id] || 0;
  return '<div class="cq-quest-heading"><span>' + label(l.region.label) + '</span><b>' + label(l.concept) + '</b></div><h2>' + label(l.title) + '</h2><p>' + label(l.objectiveText) + '</p>' + objectiveChecks() +
    '<div class="cq-quest-metrics"><span>' + pair('Turn ' + snap.turn, '第 ' + snap.turn + ' 回合') + '</span><span>' + pair('Par ' + l.parBlocks, '目標 ' + l.parBlocks) + '</span><span>' + (best ? pair('Best ' + best, '最佳 ' + best) : pair('Not cleared yet', '尚未完成')) + '</span></div>';
}

function statsHTML() {
  const snap = S.model.snapshot(), weapon = weaponFor(S.profile), stats = S.level && S.level.expedition ? snap.combat : combatStatsFor(S.profile), status = [];
  if (snap.hero.guarding) status.push(pair('GUARD', '防禦'));
  if (snap.hero.statuses && snap.hero.statuses.poison > 0) status.push(pair('POISON ' + snap.hero.statuses.poison, '中毒 ' + snap.hero.statuses.poison));
  if (snap.hero.statuses && snap.hero.statuses.ward > 0) status.push(pair('WARD ' + snap.hero.statuses.ward, '守護 ' + snap.hero.statuses.ward));
  if (snap.enemies.some(enemy => enemy.intent === 'shot')) status.push(pair('SHOT!', '射擊預告！'));
  if (stats.setBonusCount > 0) status.push(pair('CIRCUIT ×' + stats.setBonusCount, '套裝 ×' + stats.setBonusCount));
  if (S.run && S.level && S.level.expedition) status.push(pair('COINS ' + S.run.coins, '金幣 ' + S.run.coins));
  if ((snap.levers && snap.levers.length) || (snap.plates && snap.plates.length)) status.push(pair('CIRCUIT ' + (snap.levers.filter(x=>x.active).length + snap.plates.filter(x=>x.active).length) + '/' + S.model.switchesRequired, '迴路 ' + (snap.levers.filter(x=>x.active).length + snap.plates.filter(x=>x.active).length) + '/' + S.model.switchesRequired));
  if (snap.cycleTraps && snap.cycleTraps.length) status.push(pair('CLOCK ' + snap.clockPhase, '時鐘 ' + snap.clockPhase));
  if (snap.hero.carrying) status.push(pair('CORE CARRIED', '攜帶核心'));
  if (snap.lastSignal && snap.lastSignal.channel !== 'none') status.push(pair('SIGNAL '+snap.lastSignal.channel.toUpperCase()+' · '+snap.lastSignal.from.toUpperCase()+'→'+String(snap.lastSignal.to||'dungeon').toUpperCase(), '訊號 '+snap.lastSignal.channel.toUpperCase()+'・'+(snap.lastSignal.from==='companion'?'夥伴':'英雄')+'→'+(snap.lastSignal.to==='companion'?'夥伴':snap.lastSignal.to==='hero'?'英雄':'地下城')));
  status.push(pair('HERO STATE '+String(snap.hero.state||'explore').toUpperCase(), '英雄狀態 '+String(snap.hero.state||'explore').toUpperCase()));
  if ((snap.messageQueue||[]).length) status.push(pair('MAIL '+snap.messageQueue.length, '訊息 '+snap.messageQueue.length));
  if (snap.companion) status.push(pair('ALLY ' + String(snap.companion.mode).toUpperCase() + ' · STATE ' + String(snap.companion.state||'wait').toUpperCase() + (snap.companion.carrying ? ' · CORE' : ''), '夥伴 ' + (snap.companion.mode === 'follow' ? '跟隨' : '待命') + '・狀態 ' + String(snap.companion.state||'wait').toUpperCase() + (snap.companion.carrying ? '・核心' : '')));
  if (snap.questTokens && snap.questTokens.length) status.push(pair('RUNES ' + snap.questTokens.filter(x=>x.collected).length + '/' + snap.questTokens.length, '符記 ' + snap.questTokens.filter(x=>x.collected).length + '/' + snap.questTokens.length));
  const living = snap.enemies.filter(enemy => enemy.hp > 0), selected = snap.hero.targetId && living.find(enemy => enemy.id === snap.hero.targetId);
  const weaponMeta = [weapon.rarity ? weapon.rarity.toUpperCase() : '', stats.weaponDamage + ' ' + UI.damage[0], stats.spellDamage ? stats.spellDamage + ' SPELL' : '', stats.weaponRange > 1 ? 'R' + stats.weaponRange : '', stats.weaponElement !== 'neutral' ? stats.weaponElement.toUpperCase() : '', weapon.affixLabels ? weapon.affixLabels.map(entry=>entry[0]).join('+') : ''].filter(Boolean).join(' · ');
  return '<span>' + pair('HP ' + snap.hero.hp + '/' + snap.hero.maxHp, '生命 ' + snap.hero.hp + '/' + snap.hero.maxHp) + '</span><span>' + pair('DEF ' + stats.defense, '防禦 ' + stats.defense) + '</span><span>' + pair('Enemies ' + living.length, '敵人 ' + living.length) + '</span><span>' + pair('Keys ' + (snap.hero.keys || 0), '鑰匙 ' + (snap.hero.keys || 0)) + '</span><span>' + label(weapon.label) + ' · ' + esc(weaponMeta) + '</span>' + (selected ? '<span class="cq-status-chip">' + pair('TARGET ' + selected.id.replace('enemy-',''), '目標 ' + selected.id.replace('enemy-','')) + '</span>' : '') + (status.length ? '<span class="cq-status-chip">' + status.join(' · ') + '</span>' : '');
}

function render() {
  if (!S) return;
  S.root.dataset.editor = S.editor; S.root.dataset.representation = S.representation;
  const profileEl = (barReady() ? BAR : S.root).querySelector('.cq-profile');
  if (profileEl) profileEl.innerHTML = '<b>' + label(modeLabel()) + '</b><span>' + pair(S.profile.completed.length + ' quests cleared', '已完成 ' + S.profile.completed.length + ' 關') + '</span>';
  S.root.querySelector('.cq-quest').innerHTML = questHTML();
  S.root.querySelector('.cq-stats').innerHTML = statsHTML();
  S.root.querySelector('.cq-editor-body').innerHTML = editorHTML();
  S.root.querySelectorAll('.cq-tabs button').forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.dataset.action === 'tab:' + S.editor));
    if (btn.dataset.action === 'tab:code') btn.disabled = !codeUnlocked();
  });
  const executing = S.model.phase === 'executing', codePending = S.editor === 'code' && S.codeDirty;
  S.root.querySelector('[data-action="run"]').disabled = S.paused || S.dialog || codePending || S.model.phase === 'won' || S.model.phase === 'resting';
  S.root.querySelector('[data-action="step"]').disabled = S.paused || S.dialog || codePending || S.model.phase === 'won' || S.model.phase === 'resting';
  S.root.querySelector('[data-action="run"]').classList.toggle('running', executing && S.autoRun);
  S.root.querySelector('.cq-notice').innerHTML = label(S.notice || MESSAGES.intro);
  draw();
}

function draw(time = performance.now()) {
  if (!S) return;
  if (S.heroStateUntil && time > S.heroStateUntil) S.heroState = 'idle';
  drawDungeonWorld(S.canvas, S.model.snapshot(), { time: time / 1000, now: time, kidColor: kidColor(), heroState: S.heroState, heroMotion: S.heroMotion, enemyMotions: S.enemyMotions, fx: S.fx, paused: S.paused || !!S.dialog });
}

function addAction(op) {
  if (!S.level.available.actions.includes(op)) return;
  pushUndo(); setCurrentProgram(currentProgram().concat(action(op, uid('a'))));
  notify(['Card added.', '已加入卡片。']); render();
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
    if (!S.runeProgram.length) { notify(MESSAGES.missingFunction); S.editor = 'rune'; render(); return; }
    pushUndo(); setCurrentProgram(currentProgram().concat(call('rune', uid('c')))); notify(['Rune call added.', '已加入符文呼叫。']); render(); return;
  }
  if (id.startsWith('repeat')) wrap('repeat', Number(id.replace('repeat', '')) || 2);
  else if (id === 'ifEnemy') wrap('if', 'enemyAhead');
  else if (id === 'ifArmored') wrap('if', 'enemyArmoredAhead');
  else if (id === 'ifWeak') wrap('if', 'enemyWeakAhead');
  else if (id === 'ifDanger') wrap('if', 'dangerIncoming');
  else if (id === 'ifPoisoned') wrap('if', 'heroPoisoned');
  else if (id === 'ifChest') wrap('if', 'chestAhead');
  else if (id === 'ifDoor') wrap('if', 'doorAhead');
  else if (id === 'ifTrap') wrap('if', 'trapAhead');
  else if (id === 'ifKey') wrap('if', 'hasKey');
  else if (id === 'ifHpLow') wrap('if', 'hpLow');
  else if (id === 'ifMultiple') wrap('if', 'multipleEnemies');
  else if (id === 'ifTargetRange') wrap('if', 'targetInRange');
  else if (id === 'ifTargetWeak') wrap('if', 'targetWeak');
  else if (id === 'ifElementWeak') wrap('if', 'targetElementWeak');
  else if (id === 'ifLever') wrap('if', 'leverAhead');
  else if (id === 'ifBreakable') wrap('if', 'breakableAhead');
  else if (id === 'ifNpc') wrap('if', 'npcAhead');
  else if (id === 'ifRuneGate') wrap('if', 'runeGateAhead');
  else if (id === 'ifPushable') wrap('if', 'pushableAhead');
  else if (id === 'ifCycleTrap') wrap('if', 'cycleTrapAhead');
  else if (id === 'ifCycleTrapActive') wrap('if', 'cycleTrapActiveAhead');
  else if (id === 'ifPlatform') wrap('if', 'platformAhead');
  else if (id === 'ifOnPlatform') wrap('if', 'onPlatform');
  else if (id === 'ifQuestToken') wrap('if', 'questTokenAhead');
  else if (id === 'ifCompanionNear') wrap('if', 'companionNear');
  else if (id === 'ifCarryable') wrap('if', 'carryableAhead');
  else if (id === 'ifHeroCarrying') wrap('if', 'heroCarrying');
  else if (id === 'ifHeroOnPlate') wrap('if', 'heroOnPlate');
  else if (id === 'ifCompanionCarryable') wrap('if', 'companionCarryableAhead');
  else if (id === 'ifCompanionCarrying') wrap('if', 'companionCarrying');
  else if (id === 'ifCompanionOnPlate') wrap('if', 'companionOnPlate');
}

function selectIndex(index) {
  const list = currentProgram(), selection = currentSelection();
  if (index < 0 || index >= list.length) return;
  if (selection.has(index)) selection.delete(index); else selection.add(index);
  notify(MESSAGES.selected); render();
}
function removeIndex(index) {
  const list = currentProgram(); if (index < 0 || index >= list.length) return;
  pushUndo(); setCurrentProgram(list.slice(0, index).concat(list.slice(index + 1))); render();
}
function moveIndex(index, delta) {
  const list = currentProgram().slice(), target = index + delta;
  if (index < 0 || target < 0 || index >= list.length || target >= list.length) return;
  pushUndo(); [list[index], list[target]] = [list[target], list[index]]; setCurrentProgram(list); render();
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
  if (S.editor === 'code' && S.codeDirty) { notify(MESSAGES.codeChanged); return false; }
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
  S.editor = level.codingView === 'code' && codeUnlocked() ? 'code' : 'main';
  S.representation = level.codingView === 'hybrid' && allowedRepresentations().includes('hybrid') ? 'hybrid' : defaultRepresentation();
  S.autoRun = false; S.heroState = 'idle'; S.heroMotion = null; S.enemyMotions = {}; S.fx = null; S.activeUid = null; S.completing = false;
  const activeBehaviors=behaviorAllowedForLevel(level)&&['hero','companion'].some(owner=>{const saved=behaviorFor(S.profile,owner);return saved.enabled&&saved.source.trim();});
  S.notice = activeBehaviors ? ['Hero/Companion persistent behaviors are armed for this advanced room.', '此進階房間已載入英雄／夥伴持續行為。'] : level.expedition ? ['Your Rune library travels with this expedition.', '你的符文函式會跟著這趟遠征。'] : MESSAGES.intro;
  syncCodeFromAst();
  if (S.dialog) closeDialog(false);
  render();
}

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

function ingredientButton(id) {
  const count = S.profile.ingredients[id] || 0;
  return '<button type="button" class="cq-ingredient ' + (!count ? 'empty' : '') + '" data-drag-ingredient="' + id + '" ' + (!count ? 'disabled' : '') + '><img src="' + spriteURL(id, kidColor()) + '" alt=""><b>' + label(ITEM_LABELS[id]) + '</b><span>×' + count + '</span></button>';
}

function potionSprite(id) { return id === 'healing' ? 'potion' : id === 'focus' ? 'moonBerry' : id; }

function campHTML() {
  const tray = S.bench, process = S.benchProcess || [], build = combatStatsFor(S.profile);
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
  const knownRecipes = RECIPES.filter(recipe => S.profile.discoveredRecipes.includes(recipe.id)).map(recipe => '<li><img src="' + spriteURL(potionSprite(recipe.id), kidColor()) + '" alt=""><b>' + label(recipe.label) + '</b><span>' + recipe.ingredients.map(id => label(ITEM_LABELS[id])).join('<b class="cq-recipe-plus"> + </b>') + '</span><em>' + recipe.process.map(step => label(ALCHEMY_LABELS[step])).join(' → ') + '</em>' + (S.profile.completed.includes('q26') ? button('labcode:template:' + recipe.id, label(UI.loadRecipeCode), 'class="cq-code-chip"') : '') + '</li>').join('') || '<li>' + pair('Keep questing to discover recipes.', '繼續闖關就能發現配方。') + '</li>';
  const potionCode = S.profile.completed.includes('q26') ? '<section class="cq-potion-code"><h3>' + label(UI.potionCode) + '</h3><p>' + pair('The same physical recipe can now be expressed as safe bench methods.', '同一個實體配方現在也可以用安全的 bench 方法表示。') + '</p><textarea class="cq-lab-code-input" spellcheck="false" autocomplete="off">' + esc(S.labCode || '') + '</textarea>' + (S.labCodeError ? '<div class="cq-code-error"><b>' + label(MESSAGES.potionCodeError) + '</b><span>' + esc(S.labCodeError.message) + '</span><small>Ln ' + S.labCodeError.line + '</small></div>' : '') + '<div class="cq-dialog-actions">' + button('labcode:brew', label(UI.runPotionCode), 'class="cq-primary"') + '</div></section>' : '';
  const processButtons = ALCHEMY_STEPS.map(step => button('lab:' + step, label(ALCHEMY_LABELS[step]), 'class="cq-lab-step"')).join('');
  const processTrail = process.length ? process.map((step, i) => '<span><b>' + (i + 1) + '</b>' + label(ALCHEMY_LABELS[step]) + '</span>').join('') : '<i>' + pair('No process steps yet', '尚未加入製程步驟') + '</i>';
  const stock = ['healing','focus','antidote','ward'].map(id => '<span><img src="' + spriteURL(potionSprite(id), kidColor()) + '" alt="">' + label(ITEM_LABELS[id]) + ' ×' + S.profile.potions[id] + '</span>').join('');
  return '<div class="cq-dialog-head"><h2>' + label(UI.campTitle) + '</h2>' + button('dialog:close', label(UI.close)) + '</div>' + (S.campNotice ? '<p class="cq-camp-notice">' + label(S.campNotice) + '</p>' : '') + '<div class="cq-camp-scroll">' + relicChoices + '<section><h3>' + label(UI.bag) + '</h3><p>' + label(UI.dragHint) + '</p><div class="cq-ingredients">' + ['sunHerb','moonBerry','waterCrystal','emberRoot'].map(ingredientButton).join('') + '</div></section>' +
    '<section class="cq-bench"><h3>' + label(UI.potionBench) + '</h3><div class="cq-cauldron" data-cauldron="true"><b>' + label(UI.cauldron) + '</b><div>' + (tray.length ? tray.map((id, index) => button('bench:remove:' + index, '<img src="' + spriteURL(id, kidColor()) + '" alt=""><span>' + label(ITEM_LABELS[id]) + '</span>', 'class="cq-bench-slot"')).join('') : '<span class="cq-bench-empty">' + pair('Drop ingredients here', '把材料放到這裡') + '</span>') + '</div></div>' +
    '<div class="cq-lab-process"><b>' + label(UI.process) + '</b><div class="cq-process-trail">' + processTrail + '</div><div class="cq-lab-controls">' + processButtons + button('lab:undo', pair('↶ Undo step', '撤銷步驟'), process.length ? '' : 'disabled') + '</div></div>' +
    '<div class="cq-dialog-actions">' + button('bench:clear', label(UI.clearBench)) + button('bench:brew', label(UI.brew), 'class="cq-primary"') + '</div><div class="cq-potion-stock"><b>' + label(UI.potions) + '</b>' + stock + '</div></section>' +
    '<section><h3>' + label(UI.equipment) + '</h3>' + setSummary + '<div class="cq-equipment">' + equipment + '</div></section><section><h3>' + label(UI.recipes) + '</h3><ul class="cq-recipes">' + knownRecipes + '</ul></section>' + potionCode + '</div>';
}
function openDialog(kind, html) {
  if (!S) return;
  S.dialog = kind; S.scheduler.pause();
  const dialog = S.root.querySelector('.cq-dialog');
  dialog.innerHTML = html || (kind === 'map' ? mapHTML() : kind === 'camp' ? campHTML() : '<h2>' + label(UI.pausedTitle) + '</h2><p>' + label(UI.pausedBody) + '</p><div class="cq-dialog-actions">' + button('pause', label(UI.resume), 'class="cq-primary" autofocus') + '</div>');
  dialog.setAttribute('aria-label', kind === 'map' ? 'Quest map 冒險地圖' : kind === 'camp' ? 'Pixel camp 像素營地' : kind === 'expedition' ? 'Connected dungeon expedition 相連地下城遠征' : 'Code Quest paused 程式冒險暫停');
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
  if (!S || S.paused || S.dialog === 'win') return;
  S.paused = true; S.autoRun = false;
  openDialog('pause'); render();
}
function resume() {
  if (!S) return;
  S.paused = false; closeDialog(false); S.scheduler.resume(); render();
}

function addBenchIngredient(id) {
  if (!S.profile.ingredients[id]) { S.campNotice = MESSAGES.noIngredient; notify(MESSAGES.noIngredient); openDialog('camp', campHTML()); return; }
  const inTray = S.bench.filter(item => item === id).length;
  if (inTray >= S.profile.ingredients[id]) { S.campNotice = MESSAGES.noIngredient; notify(MESSAGES.noIngredient); openDialog('camp', campHTML()); return; }
  if (S.bench.length >= 3) { S.campNotice = MESSAGES.benchFull; notify(MESSAGES.benchFull); openDialog('camp', campHTML()); return; }
  S.campNotice = null; S.bench.push(id); openDialog('camp', campHTML());
}
function addLabStep(step) {
  if (!ALCHEMY_STEPS.includes(step)) return;
  if (S.benchProcess.length >= 5) S.benchProcess.shift();
  S.benchProcess.push(step); S.campNotice = MESSAGES.processAdded; openDialog('camp', campHTML());
}
function brewBench() {
  const result = brewLab(S.profile, S.bench, S.benchProcess);
  if (!result.ok) {
    S.campNotice = result.reason === 'need-three' ? MESSAGES.needThree : result.reason === 'unknown-recipe' ? MESSAGES.unknownRecipe : result.reason === 'wrong-process' ? MESSAGES.wrongProcess : MESSAGES.missingIngredient;
    notify(S.campNotice); openDialog('camp', campHTML()); return;
  }
  S.profile = result.profile; if (S.model && S.model.hero && S.model.hero.consumables && Object.hasOwn(S.model.hero.consumables, result.recipe.id)) S.model.hero.consumables[result.recipe.id] = Math.min(9, S.model.hero.consumables[result.recipe.id] + 1); S.bench = []; S.benchProcess = []; S.campNotice = MESSAGES.brewed; saveProfile(); S.ctx.sfx && S.ctx.sfx.good && S.ctx.sfx.good(); notify(MESSAGES.brewed); openDialog('camp', campHTML());
}
function brewPotionCode() {
  const textarea = S.root.querySelector('.cq-lab-code-input'); if (textarea) S.labCode = textarea.value;
  const result = runAlchemyCode(S.profile, S.labCode);
  if (!result.ok) {
    S.labCodeError = result.error || { message: result.reason === 'need-three' ? 'Add exactly three ingredients in code.' : result.reason === 'wrong-process' ? 'The bench process order does not match a recipe.' : 'The potion script did not produce a known recipe.', line: 1 };
    S.campNotice = MESSAGES.potionCodeError; notify(S.campNotice); openDialog('camp', campHTML()); return;
  }
  S.profile = result.profile; S.labCodeError = null;
  if (S.model && S.model.hero && S.model.hero.consumables && Object.hasOwn(S.model.hero.consumables, result.recipe.id)) S.model.hero.consumables[result.recipe.id] = Math.min(9, S.model.hero.consumables[result.recipe.id] + 1);
  saveProfile(); S.ctx.sfx && S.ctx.sfx.good && S.ctx.sfx.good(); S.campNotice = MESSAGES.brewed; notify(MESSAGES.brewed); openDialog('camp', campHTML());
}

function perform(actionId) {
  if (!S || !actionId) return;
  if (actionId.startsWith('tab:')) { const target = actionId.slice(4); if (target === 'code' && !codeUnlocked()) { notify(UI.codeLocked); return; } S.editor = target; currentSelection().clear(); if (target === 'code' && !S.codeDraft) syncCodeFromAst(); render(); return; }
  if (actionId.startsWith('view:')) { const view = actionId.slice(5); if (allowedRepresentations().includes(view)) { S.representation = view; render(); } return; }
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
  if (actionId.startsWith('select:')) { selectIndex(Number(actionId.slice(7))); return; }
  if (actionId.startsWith('remove:')) { removeIndex(Number(actionId.slice(7))); return; }
  if (actionId.startsWith('up:')) { moveIndex(Number(actionId.slice(3)), -1); return; }
  if (actionId.startsWith('down:')) { moveIndex(Number(actionId.slice(5)), 1); return; }
  if (actionId === 'undo') { if (restoreUndo()) render(); return; }
  if (actionId === 'clear') { if (currentProgram().length) { pushUndo(); setCurrentProgram([]); render(); } return; }
  if (actionId === 'run') { executeOne(true); return; }
  if (actionId === 'step') { executeOne(false); return; }
  if (actionId === 'reset') { S.model = createModel(S.level); S.autoRun = false; S.heroState = 'idle'; S.heroMotion = null; S.enemyMotions = {}; S.fx = null; S.activeUid = null; S.completing = false; notify(['Room reset. Your program stayed on the table.', '房間已重設，程式仍保留在桌上。']); render(); return; }
  if (actionId === 'map') { openDialog('map'); return; }
  if (actionId === 'camp') { openDialog('camp'); return; }
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
  if (actionId.startsWith('bench:remove:')) { const i = Number(actionId.slice(13)); if (i >= 0 && i < S.bench.length) S.bench.splice(i, 1); openDialog('camp', campHTML()); return; }
  if (actionId === 'bench:clear') { S.bench = []; S.benchProcess = []; openDialog('camp', campHTML()); return; }
  if (actionId.startsWith('lab:') && actionId !== 'lab:undo') { addLabStep(actionId.slice(4)); return; }
  if (actionId === 'lab:undo') { if (S.benchProcess.length) S.benchProcess.pop(); openDialog('camp', campHTML()); return; }
  if (actionId === 'bench:brew') { brewBench(); return; }
  if (actionId.startsWith('labcode:template:')) { const recipe = recipeById(actionId.slice(17)); if (recipe && S.profile.discoveredRecipes.includes(recipe.id)) { S.labCode = recipeToAlchemyCode(recipe); S.labCodeError = null; S.campNotice = MESSAGES.potionCodeReady; openDialog('camp', campHTML()); } return; }
  if (actionId === 'labcode:brew') { brewPotionCode(); return; }
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

function startIngredientDrag(e, target) {
  if (!S || target.disabled || S.dialog !== 'camp') return;
  e.preventDefault();
  const id = target.dataset.dragIngredient;
  const ghost = document.createElement('div'); ghost.className = 'cq-drag-ghost'; ghost.innerHTML = '<img src="' + spriteURL(id, kidColor()) + '" alt="">'; S.root.querySelector('.cq-dialog').appendChild(ghost);
  S.drag = { id, ghost, startX: e.clientX, startY: e.clientY, moved: false, pointerId: e.pointerId };
  ghost.style.transform = 'translate(' + (e.clientX - 24) + 'px,' + (e.clientY - 24) + 'px)';
}
function dragMove(e) {
  if (!S || !S.drag || e.pointerId !== S.drag.pointerId) return;
  if (Math.abs(e.clientX - S.drag.startX) + Math.abs(e.clientY - S.drag.startY) > 8) S.drag.moved = true;
  S.drag.ghost.style.transform = 'translate(' + (e.clientX - 24) + 'px,' + (e.clientY - 24) + 'px)';
}
function dragEnd(e) {
  if (!S || !S.drag || e.pointerId !== S.drag.pointerId) return;
  const drag = S.drag; S.drag = null;
  const hit = document.elementFromPoint(e.clientX, e.clientY), over = hit && hit.closest && hit.closest('[data-cauldron]');
  drag.ghost.remove();
  if (!drag.moved || over) addBenchIngredient(drag.id);
}

function keydown(e) {
  if (!S) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    if (S.dialog === 'win') return;
    if (S.dialog) { if (S.paused) resume(); else closeDialog(); }
    else pause();
  }
}
function visibility() { if (document.hidden) pause(); }

function barReady() { return !!(BAR && BAR.isConnected); }
function topActionsHTML() { return '<div class="cq-top-actions">' + button('map', label(UI.questMap)) + button('camp', label(UI.inventory)) + button('pause', label(UI.pause)) + '</div>'; }

/* Quest map / Camp / Pause and the rank badge live in the host bar next to Back,
   like Kitchen Quest, so the stage keeps its full height on short landscape tablets. */
function settings(bar) {
  BAR = bar;
  bar.innerHTML = '<div class="cq-setbar" role="group" aria-label="Code Quest controls 程式冒險控制"><div class="cq-profile"></div>' + topActionsHTML() + '</div>';
  bar.addEventListener('pointerdown', e => {
    const target = e.target.closest('button[data-action]');
    if (!S || !target || target.disabled || e.button !== 0) return;
    e.preventDefault(); perform(target.dataset.action);
  });
  bar.addEventListener('click', e => {
    const target = e.target.closest('button[data-action]');
    if (S && e.detail === 0 && target && !target.disabled) perform(target.dataset.action);
  });
}

function init(ctx) {
  stop();
  const root = document.createElement('div'); root.className = 'cq';
  root.innerHTML = '<link rel="stylesheet" href="' + new URL('../../css/codequest.css', import.meta.url).href + '">' +
    (barReady() ? '' : '<header class="cq-top"><div class="cq-brand"><h2>' + label(UI.title) + '</h2><span>' + label(UI.subtitle) + '</span></div><div class="cq-profile"></div>' + topActionsHTML() + '</header>') +
    '<main class="cq-main"><section class="cq-world"><div class="cq-scene"><canvas width="' + WIDTH + '" height="' + HEIGHT + '" role="img" aria-label="2.5D pixel dungeon RPG room 2.5D 像素地下城房間"></canvas><div class="cq-stats"></div></div><aside class="cq-quest"></aside></section><section class="cq-editor"><nav class="cq-tabs" aria-label="Programming views 程式編輯模式">' + button('tab:main', label(UI.program)) + button('tab:rune', label(UI.rune)) + button('tab:code', label(UI.code)) + '</nav><div class="cq-editor-body"></div></section></main>' +
    '<footer class="cq-bottom"><div class="cq-edit-actions">' + button('undo', label(UI.undo)) + button('clear', label(UI.clear)) + button('reset', label(UI.reset)) + '</div><div class="cq-run-actions">' + button('step', label(UI.step)) + button('run', label(UI.run), 'class="cq-primary"') + '</div></footer><p class="cq-notice" role="status" aria-live="polite"></p><dialog class="cq-dialog"></dialog>';

  const saved = ctx.settings.codequest && ctx.settings.codequest.profiles && ctx.settings.codequest.profiles[ctx.kid];
  const profile = normalizeProfile(saved, ctx.best);
  const firstUncleared = LEVELS.findIndex(level => !profile.completed.includes(level.id));
  const initial = firstUncleared < 0 ? LEVELS[LEVELS.length - 1] : LEVELS[firstUncleared];
  const initialMode = modeFor(profile);
  const initialRepresentation = initial.codingView === 'hybrid' && (initialMode === 'coder' || initialMode === 'architect') ? 'hybrid' : initialMode === 'explorer' ? 'picture' : initialMode === 'builder' ? 'blocks' : 'hybrid';
  S = {
    root, ctx, profile, level: initial, model: null, program: [], runeProgram: [], extraFunctions: {}, selectedMain: new Set(), selectedRune: new Set(),
    editor: initial.codingView === 'code' && initialMode === 'architect' ? 'code' : 'main', representation: initialRepresentation,
    codeDraft: '', codeDirty: false, codeError: null,
    undo: [], serial: 0, scheduler: createScheduler(), paused: false, dialog: null, autoRun: false,
    canvas: root.querySelector('canvas'), best: Number(ctx.best) || 0, notice: MESSAGES.intro, heroState: 'idle', heroStateUntil: 0, heroMotion: null, enemyMotions: {}, fx: null, activeUid: null,
    bench: [], benchProcess: [], labCode: '', labCodeError: null, campNotice: null, drag: null, completing: false, lastDraw: 0, run: normalizeDungeonRun(profile.activeRun)
  };
  S.model = createModel(initial); syncCodeFromAst();
  settingsRoot(ctx)[ctx.kid] = profile; ctx.saveSettings();
  ctx.mount.classList.add('cq-stage'); ctx.mount.appendChild(root); ctx.hud([]);

  root.addEventListener('input', e => {
    if (!S || !e.target.classList) return;
    if (e.target.classList.contains('cq-lab-code-input')) { S.labCode = e.target.value; S.labCodeError = null; return; }
    if (!e.target.classList.contains('cq-code-input')) return;
    S.codeDraft = e.target.value; S.codeDirty = true; S.codeError = null;
    const status = root.querySelector('.cq-code-status'); if (status) status.innerHTML = label(MESSAGES.codeChanged);
    const run = root.querySelector('[data-action="run"]'), step = root.querySelector('[data-action="step"]'); if (run) run.disabled = true; if (step) step.disabled = true;
  });

  root.addEventListener('pointerdown', e => {
    const ingredient = e.target.closest('[data-drag-ingredient]');
    if (ingredient) { startIngredientDrag(e, ingredient); return; }
    const target = e.target.closest('button[data-action]');
    if (!target || target.disabled || e.button !== 0) return;
    e.preventDefault(); target.focus({ preventScroll: true }); perform(target.dataset.action);
  });
  root.addEventListener('click', e => {
    const target = e.target.closest('button[data-action]');
    if (e.detail === 0 && target && !target.disabled) perform(target.dataset.action);
  });
  root.querySelector('.cq-dialog').addEventListener('cancel', e => { e.preventDefault(); if (S.dialog === 'win') return; if (S.paused) resume(); else closeDialog(); });
  window.addEventListener('pointermove', dragMove, true); window.addEventListener('pointerup', dragEnd, true); window.addEventListener('pointercancel', dragEnd, true);
  document.addEventListener('keydown', keydown, true); document.addEventListener('visibilitychange', visibility);
  window.addEventListener('blur', pause); window.addEventListener('summerquest:native-pause', pause);
  S.scheduler.frame(time => { if (!S || S.paused || S.dialog) return; if (time - S.lastDraw > 48) { S.lastDraw = time; draw(time); } });
  render(); notify(MESSAGES.intro);
  if (S.run) openDialog('expedition', expeditionHTML());
}

function stop() {
  if (!S) return;
  S.scheduler.cancelAll();
  window.removeEventListener('pointermove', dragMove, true); window.removeEventListener('pointerup', dragEnd, true); window.removeEventListener('pointercancel', dragEnd, true);
  document.removeEventListener('keydown', keydown, true); document.removeEventListener('visibilitychange', visibility);
  window.removeEventListener('blur', pause); window.removeEventListener('summerquest:native-pause', pause);
  if (S.drag && S.drag.ghost) S.drag.ghost.remove();
  const dialog = S.root.querySelector('.cq-dialog'); try { if (dialog.open) dialog.close(); } catch (e) {}
  S.root.remove(); S.ctx.mount.classList.remove('cq-stage'); S = null;
}

export default {
  id: 'codequest', version: '0.14.0', keyboard: false, bestKey: 'codequest',
  meta: { icon: '🏰', title: 'Code Quest', tz: '程式冒險', blurb: 'Program the hero · 編程闖關' },
  settings, init, stop,
  snapshot() { return S ? { level: S.level.id, model: S.model.snapshot(), profile: S.profile, run:S.run, program: S.program, runeProgram: S.runeProgram, editor: S.editor, representation: S.representation, codeDirty: S.codeDirty, paused: S.paused, dialog: S.dialog } : null; }
};
