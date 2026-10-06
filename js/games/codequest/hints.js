/* Quest clarity (2026-10-06-code-quest-quest-clarity): what each quest needs, how hard it
   is, three hints, and a peek at its solution. Skills come from `level.requires` — the same
   list `model.begin()` enforces — so the chips can't disagree with what Run checks (D4).
   Words are the game's own (D1). Hints never state a number of hits: gear changes damage (D6).
   Pure: no DOM, no game state. */
import { functionDescriptor, toJavaScript } from './ast.js';
import { requirementPresent } from './model.js';

const skill = (id, icon, en, zh, whyEn, whyZh) => Object.freeze({ id, icon, name: Object.freeze([en, zh]), why: Object.freeze([whyEn, whyZh]) });

/** One entry per `requires` tag (params and arguments share `param`). */
export const SKILLS = Object.freeze({
  call: skill('call', '🪨', 'Rune', '符文', 'A Rune is a function: build the steps once, use them again and again.', '符文就是函式：步驟做一次，就能一直重複使用。'),
  repeat: skill('repeat', '🔁', 'Repeat', '重複', 'Repeat does the same card many times, so the program stays short.', '重複可以讓同一張卡做很多次，程式就不會太長。'),
  if: skill('if', '❓', 'If', '如果', 'If lets the hero look first and only act when it is needed.', '如果讓英雄先看一看，需要時才行動。'),
  else: skill('else', '↔', 'Else', '否則', 'Else gives the hero a plan B for when the If check says no.', '否則讓英雄在「如果」不成立時，有另一個計畫。'),
  let: skill('let', '📦', 'Variable', '變數', 'A variable is a labelled box that remembers a value for later.', '變數就像貼了名字的盒子，可以記住一個值。'),
  param: skill('param', '🎛', 'Parameter', '參數', 'A parameter lets one Rune do a different amount each time you use it.', '參數讓同一個符文每次使用時，做不同的量。'),
  return: skill('return', '↩', 'Return', '回傳', 'Return hands an answer back to the code that used the Rune.', '回傳會把答案交回給使用符文的程式。'),
  expression: skill('expression', '➕', 'Expression', '運算式', 'An expression works out a value, like a sum or a compare.', '運算式會算出一個值，例如加法或比較。'),
  property: skill('property', '🔍', 'Property', '屬性', 'Properties let the code read the room: an enemy\'s HP, armor or element.', '屬性讓程式讀取房間：敵人的生命、裝甲或元素。'),
  member: skill('member', '🔍', 'Field', '欄位', 'A dot reads one detail from a thing, like foe.hp.', '用點號可以讀取一個東西的細節，例如 foe.hp。'),
  target: skill('target', '🏹', 'Target', '鎖定目標', 'Targeting picks which enemy your next spell goes to.', '鎖定目標決定下一個法術打向哪個敵人。'),
  forOf: skill('forOf', '🔂', 'for…of', 'for…of 逐一', 'for…of runs the same steps once for each item in a list.', 'for…of 會對清單裡的每一項，各做一次同樣的步驟。'),
  companion: skill('companion', '🐾', 'Companion', '夥伴', 'Your companion runs its own commands, so two characters work at once.', '夥伴有自己的指令，兩個角色可以同時合作。'),
  on: skill('on', '📣', 'Event', '事件', 'An event handler waits, then runs by itself when something happens.', '事件處理器會等待，事情發生時自己執行。'),
  signal: skill('signal', '📡', 'Signal', '訊號', 'A signal is a message one character sends so another can react.', '訊號是一個角色送出的訊息，讓另一個角色做出反應。'),
  state: skill('state', '🚦', 'State', '狀態', 'A state remembers which mode a character is in, like explore or attack.', '狀態記住角色現在的模式，例如探索或攻擊。')
});
const TAG_TO_SKILL = Object.freeze({ params: 'param', arguments: 'param' });

/** Quests with no `requires` still practise something (D4). */
const TEACH_SKILLS = Object.freeze({
  sequence: skill('sequence', '➡', 'Sequence', '順序', 'Cards run one after another, in order.', '卡片會一張接一張，依照順序執行。'),
  direction: skill('direction', '↪', 'Direction', '方向', 'Turning changes which way the next Move goes.', '轉向會改變下一次前進的方向。'),
  action: skill('action', '✋', 'Action', '動作', 'Action cards make the hero do something to what is right in front.', '動作卡讓英雄對正前方的東西做事。'),
  combat: skill('combat', '⚔', 'Combat', '戰鬥', 'Face the enemy first, then attack.', '先面向敵人，再攻擊。')
});
export const TEACH = Object.freeze({ q01: 'sequence', q02: 'direction', q03: 'action', q04: 'combat' });

/** Tags → skill entries: merged, de-duplicated, in order; expression/member fold into property. */
function foldTags(tags) {
  const list = [...(tags || [])];
  const hasProperty = list.includes('property'), seen = new Set(), out = [];
  for (const tag of list) {
    if (hasProperty && (tag === 'expression' || tag === 'member')) continue;
    const id = TAG_TO_SKILL[tag] || tag;
    if (seen.has(id) || !SKILLS[id]) continue;
    seen.add(id); out.push(SKILLS[id]);
  }
  return out;
}

/** The chips a quest shows. Teach-only entries carry `teach: true`. */
export function skillsFor(level) {
  const chips = foldTags(level && level.requires);
  if (chips.length) return chips;
  const teach = level && TEACH[level.id];
  return teach ? [Object.freeze({ ...TEACH_SKILLS[teach], teach: true })] : [];
}

/** 'easy' | 'medium' | 'hard', worked out from data (D5). */
export function difficultyFor(level) {
  const count = skillsFor(level).filter(item => !item.teach).length;
  if (count >= 2 || (Number(level && level.parBlocks) || 0) >= 10) return 'hard';
  return count === 1 ? 'medium' : 'easy';
}

/** "🪨 Rune + 🔁 Repeat" / "🪨 符文＋🔁 重複". */
export function chipText(skills) {
  return [skills.map(item => item.icon + ' ' + item.name[0]).join(' + '), skills.map(item => item.icon + ' ' + item.name[1]).join('＋')];
}

const hint = (gentle, strong, near) => Object.freeze({ gentle: Object.freeze(gentle), strong: Object.freeze(strong), near: Object.freeze(near) });

/** Hand-written hints per quest (D6). Missing quests fall back to `fallbackHint`. */
export const HINTS = Object.freeze({
  q12: hint(
    ['Good try! The golem is tough — one hit won\'t be enough.', '很棒的嘗試！魔像很強壯，打一下不夠。'],
    ['Put Attack with a 🔁 Repeat sticker in the 🪨 Rune row, then put the 🪨 card in the Hero row.', '把貼了 🔁 重複貼紙的攻擊放進 🪨 符文那一排，再把 🪨 卡片放到英雄那一排。'],
    ['Nearly! Your Hero row can start like this:', '快成功了！英雄那一排可以這樣開始：']
  )
});
const TIERS = Object.freeze(['gentle', 'strong', 'near']);

function fallbackHint(level) {
  const skills = skillsFor(level).filter(item => !item.teach);
  if (!skills.length) return ['Look at the goal flag 🏁 and try one card at a time.', '看看目標旗子 🏁，一次試一張卡。'];
  const [en, zh] = chipText(skills);
  return ['Look at the quest card: this quest needs ' + en + '.', '看看任務卡：這一關需要 ' + zh + '。'];
}

/** `[en, zh]` for tier 0 gentle, 1 strong, 2 near. */
export function hintFor(level, tier) {
  const entry = level && HINTS[level.id], key = TIERS[Math.max(0, Math.min(2, Number(tier) || 0))];
  return entry && entry[key] ? entry[key] : fallbackHint(level);
}
export function hasHandHint(level, tier) {
  const entry = level && HINTS[level.id];
  return !!(entry && entry[TIERS[tier]]);
}

/** How the reference solution starts: cards for card rooms, code lines for code rooms. */
export function peekFor(level) {
  const main = (level && level.reference && level.reference.main) || [], fns = (level && level.reference && level.reference.functions) || {};
  if (level && level.codingView === 'code') {
    const lines = toJavaScript(main, fns).split('\n').filter(line => line.trim());
    return { kind: 'code', lines: lines.slice(0, 3), more: lines.length > 3 };
  }
  const nodes = main.slice(0, 3);
  const usesRune = nodes.some(node => node && node.type === 'call' && node.name === 'rune');
  return { kind: 'cards', nodes, more: main.length > 3, rune: usesRune && fns.rune ? functionDescriptor(fns.rune).body : null };
}

/** The skill entries a program still lacks for this quest (same folding as the chips). */
export function missingSkills(level, program, functions) {
  return foldTags(((level && level.requires) || []).filter(tag => !requirementPresent(program || [], functions || {}, tag)));
}
