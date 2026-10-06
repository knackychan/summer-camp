/* Quest clarity (2026-10-06-code-quest-quest-clarity): what each quest needs, how hard it
   is, three hints, and a peek at its solution. Skills come from `level.requires` — the same
   list `model.begin()` enforces — so the chips can't disagree with what Run checks (D4).
   Words are the game's own (D1). Hints never state a number of hits: gear changes damage (D6).
   Pure: no DOM, no game state. */
import { functionDescriptor, normalizeProgram, toJavaScript } from './ast.js';
import { NEEDS, WIN } from './strings.js';
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
// One short lead-in: the peek under it labels its own rows (Rune, Hero), so it fits on one line.
const NEAR = Object.freeze(['Nearly! You can start like this:', '快成功了！可以這樣開始：']);

/* Card rooms (slice 06). Card and sticker words are the ones on the cards. A fight hint never
   counts hits: "Repeat + if enemy" keeps striking only while the enemy is there, for any blade. */
export const HINTS = Object.freeze({
  q01: hint(
    ['The exit is straight ahead. How many steps away is it?', '出口就在正前方。要走幾步才到？'],
    ['Put one Move card in the Hero row for each step to the glowing exit.', '每走一步，就在英雄那一排放一張前進卡，一直到發光的出口。'],
    NEAR),
  q02: hint(
    ['The hall bends. Walk to the corner first, then look where it goes.', '走廊會轉彎。先走到轉角，再看看路往哪裡走。'],
    ['Move to the corner, Turn Right — the hero\'s own right hand — then Move to the exit.', '前進到轉角，右轉（英雄自己的右手邊），再前進到出口。'],
    NEAR),
  q03: hint(
    ['A chest opens only when the hero stands next to it and faces it.', '英雄要站在寶箱旁邊、面向它，才能打開。'],
    ['Walk until the chest is right below the hero, Turn Right to face it, then Open.', '走到寶箱就在英雄正下方，右轉面向它，再打開。'],
    NEAR),
  q04: hint(
    ['The hero can only hit what is right in front.', '英雄只能打到正前方的東西。'],
    ['Step under the slime, Turn Left to face it, then Attack.', '走到史萊姆下方，左轉面向它，再攻擊。'],
    NEAR),
  q05: hint(
    ['That is a long hall — lots of the same card in a row.', '這條走廊好長，要放好多張一樣的卡。'],
    ['Use one Move card with a 🔁 Repeat sticker instead of many Moves.', '用一張貼了 🔁 重複貼紙的前進卡，代替好多張前進卡。'],
    NEAR),
  q06: hint(
    ['Two long walks: across, then down to the chest.', '要走兩段長路：先往旁邊，再往下走到寶箱。'],
    ['Give each walk a Move with a 🔁 Repeat sticker. Open when the chest is in front.', '每段路用一張貼了 🔁 重複貼紙的前進卡。寶箱在正前方時再打開。'],
    NEAR),
  q07: hint(
    ['Something blocks the hall. The hero could look before stepping.', '有東西擋住走廊。英雄可以先看一看再走。'],
    ['Give Attack an "if enemy" sticker: the hero strikes only when the slime is there.', '在攻擊卡貼上「如果有敵人」貼紙：史萊姆在前面時，英雄才會攻擊。'],
    NEAR),
  q08: hint(
    ['The goblin stands between the hero and the chest.', '哥布林擋在英雄和寶箱中間。'],
    ['Attack with a 🔁 Repeat sticker and an "if enemy" sticker keeps hitting until the goblin is gone.', '攻擊卡貼上 🔁 重複和「如果有敵人」貼紙，會一直打到哥布林不見為止。'],
    NEAR),
  q09: hint(
    ['The hero starts hurt, and the goal wants them healthy at the end.', '英雄一開始就受傷了，目標要他最後保持健康。'],
    ['Give Heal an "if hurt" sticker first. Then face the goblin and Attack.', '先在治療卡貼上「如果受傷」貼紙。再面向哥布林攻擊。'],
    NEAR),
  q10: hint(
    ['Both walks are the same length. Could one card do a whole walk?', '兩段路一樣長。能不能用一張卡走完一整段？'],
    ['Put Move with a Repeat sticker in the 🪨 Rune row. Use the 🪨 card before and after the turn.', '把貼了重複貼紙的前進卡放進 🪨 符文那一排。轉彎前後各用一次 🪨 卡片。'],
    NEAR),
  q11: hint(
    ['Two goblins, one way to beat them. Build that way once.', '兩隻哥布林，打法都一樣。把打法只做一次。'],
    ['In the 🪨 Rune row: Attack with Repeat and "if enemy" stickers. Use the 🪨 card at each goblin.', '🪨 符文那一排放：貼了重複和「如果有敵人」的攻擊卡。每隻哥布林前用一次 🪨 卡片。'],
    NEAR),
  q12: hint(
    ['The golem is tough — one hit won\'t be enough.', '魔像很強壯，打一下不夠。'],
    ['Put Attack with the biggest 🔁 Repeat sticker in the 🪨 Rune row, then the 🪨 card in the Hero row.', '把貼了最大 🔁 重複貼紙的攻擊卡放進 🪨 符文那一排，再把 🪨 卡片放到英雄那一排。'],
    NEAR),
  q13: hint(
    ['The door is locked. Something in the hall can open it.', '門鎖住了。走廊裡有東西可以打開它。'],
    ['Walk over the key to the door, Turn Right, Open, then Move with a 🔁 Repeat sticker.', '走過鑰匙到門前，右轉，打開，再用貼了 🔁 重複貼紙的前進卡。'],
    NEAR),
  q14: hint(
    ['Look at the floor on the way down: one tile is a trap.', '看看往下走的地板：有一格是陷阱。'],
    ['Face the trap and give Disarm an "if trap" sticker, then Move with a 🔁 Repeat sticker.', '面向陷阱，在拆除卡貼上「如果有陷阱」貼紙，再用貼了 🔁 重複貼紙的前進卡。'],
    NEAR),
  q15: hint(
    ['One hall holds everything. Take it one thing at a time, left to right.', '一條走廊什麼都有。從左到右，一次處理一樣。'],
    ['Key, door, goblin, trap, chest: face each one and use its card. Stickers keep it short.', '鑰匙、門、哥布林、陷阱、寶箱：面向每一個，用它的卡片。貼紙讓程式變短。'],
    NEAR),
  q16: hint(
    ['This enemy wears armor. A normal Attack just goes clang.', '這個敵人穿著盔甲。普通攻擊只會「鏘」一聲。'],
    ['Give Heavy an "if armored" sticker and a 🔁 Repeat sticker, then walk to the exit.', '在重擊卡貼上「如果有盔甲」和 🔁 重複貼紙，再走到出口。'],
    NEAR),
  q17: hint(
    ['The hero starts poisoned, and the goal wants no poison at the end.', '英雄一開始就中毒了，目標要他最後沒有中毒。'],
    ['Give Antidote an "if poisoned" sticker. Then face the viper: Attack with Repeat and "if enemy".', '在解毒卡貼上「如果中毒」貼紙。再面向毒蛇：攻擊卡貼上重複和「如果有敵人」。'],
    NEAR),
  q18: hint(
    ['The archer warns before it shoots. One short plan, run again and again, is enough.', '弓手射箭前會先警告。一個短短的計畫，一直重複執行就夠了。'],
    ['Give Guard an "if danger" sticker, add one Move, then press Run again each turn.', '在防禦卡貼上「如果有危險」貼紙，加一張前進卡，每回合再按一次執行。'],
    NEAR),
  q19: hint(
    ['Keep walking, run after run. Be ready for the viper and its poison.', '一回合一回合往前走。準備好對付毒蛇和牠的毒。'],
    ['Three cards: Antidote "if poisoned", Attack "if enemy", then Move. Run it again each turn.', '三張卡：解毒「如果中毒」、攻擊「如果有敵人」，再前進。每回合再執行一次。'],
    NEAR),
  q20: hint(
    ['Armor, arrows and enemies share one path. One plan can check for each.', '盔甲、弓箭和敵人都在同一條路上。一個計畫可以一一檢查。'],
    ['Guard "if danger", Heavy "if armored", Attack "if enemy", then Move. Run it each turn.', '防禦「如果有危險」、重擊「如果有盔甲」、攻擊「如果有敵人」，再前進。每回合執行一次。'],
    NEAR),
  q21: hint(
    ['Same cards as always — tap Code to see them written as JavaScript.', '還是一樣的卡片——點「程式碼」看看它們寫成 JavaScript 的樣子。'],
    ['In the 🪨 Rune row: Attack with Repeat and "if enemy". Use the 🪨 card when the goblin is in front.', '🪨 符文那一排放：貼了重複和「如果有敵人」的攻擊卡。哥布林在前面時用 🪨 卡片。'],
    NEAR),
  q43: hint(
    ['The gate below opens with the lever beside it.', '下面的閘門要用旁邊的拉桿打開。'],
    ['Step once, give Use an "if lever" sticker, then Turn Right and walk through the gate.', '走一步，在互動卡貼上「如果有拉桿」貼紙，再右轉走過閘門。'],
    NEAR),
  q45: hint(
    ['A crate blocks the hall. Some things can be smashed.', '有木箱擋住走廊。有些東西可以打破。'],
    ['Give Smash an "if breakable" sticker, then Move with a 🔁 Repeat sticker to the end.', '在擊破卡貼上「如果可以打破」貼紙，再用貼了 🔁 重複貼紙的前進卡走到底。'],
    NEAR),
  q46: hint(
    ['The guide has something you need for the locked door.', '嚮導有打開鎖門需要的東西。'],
    ['Give Use an "if guide" sticker to talk to the guide, then go to the door, Turn Right and Open.', '在互動卡貼上「如果有嚮導」貼紙和嚮導說話，再走到門前，右轉，打開。'],
    NEAR)
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
  const safe = normalizeProgram(program || []);
  return foldTags(((level && level.requires) || []).filter(tag => !requirementPresent(safe, functions || {}, tag)));
}

/** Refusal words (D3): the whole rule, then what is still missing.
    `runeBuilt`: the Rune row has cards, so a missing 🪨 card only needs placing. */
export function needsAll(level, missing, runeBuilt = false) {
  const all = skillsFor(level).filter(item => !item.teach), lacking = missing || [];
  const [en, zh] = NEEDS.all(chipText(all));
  const more = lacking.length && lacking.length < all.length ? NEEDS.missing(chipText(lacking)) : ['', ''];
  const place = runeBuilt && lacking.some(item => item.id === 'call') ? NEEDS.heroRow : ['', ''];
  return [en + more[0] + place[0], zh + more[1] + place[1]];
}

/** The win card's lines (D8): the skills used (true by construction: the model refuses a
    Run without them), why each matters, and what the next quest brings. */
export function winLines(level, nextLevel) {
  const chips = skillsFor(level), teach = chips.length > 0 && chips[0].teach;
  const used = chips.length ? (teach ? WIN.practised : WIN.used)(chipText(chips)) : null;
  const nextChips = nextLevel ? skillsFor(nextLevel) : [];
  const next = nextLevel ? WIN.next(nextLevel.title, nextChips.length ? chipText(nextChips) : null) : null;
  return { used, why: chips.map(item => item.why), next };
}
