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
const NEAR_CODE = Object.freeze(['Nearly! Your code can start like this:', '快成功了！程式可以這樣開始：']);

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
    NEAR),

  /* Code rooms (slices 07, 08). API names stay in English in both languages; the sentence
     around them is translated. No < > & (hints are inserted as HTML). */
  q22: hint(
    ['One rule, run every turn: what should the hero do when something is in the way, and when not?', '一條規則，每回合都執行：前面有東西時要做什麼？沒有時又要做什麼？'],
    ['Use if … else: attack when hero.seesEnemyAhead(), otherwise move. Run it each turn.', '用 if … else：hero.seesEnemyAhead() 時攻擊，不然就前進。每回合執行一次。'],
    NEAR_CODE),
  q23: hint(
    ['Two jobs in this room: opening the door and fighting. Each can be its own function.', '這個房間有兩件事：開門和戰鬥。每件事都可以做成自己的函式。'],
    ['Define function unlock() to open the door and function strike() to fight, then call each where needed.', '定義 function unlock() 開門、function strike() 戰鬥，再在需要的地方呼叫它們。'],
    NEAR_CODE),
  q24: hint(
    ['Things block the path at different moments. Check before every step.', '路上不同時候會有東西擋住。每走一步前先檢查。'],
    ['Make advance(): wait if hero.isBlockedAhead(), else move. Use if … else for the armor and the trap too.', '做一個 advance()：hero.isBlockedAhead() 時等待，不然就前進。盔甲和陷阱也用 if … else。'],
    NEAR_CODE),
  q25: hint(
    ['Both corridors are the same length. Write that length down once.', '兩條走廊一樣長。把這個長度只寫一次。'],
    ['Store it with let steps = …; then use repeat(steps, …) for both walks.', '用 let steps = …; 記下來，兩段路都用 repeat(steps, …)。'],
    NEAR_CODE),
  q26: hint(
    ['The two walks have different lengths. One walk function can take the length as a number.', '兩段路長度不同。一個走路函式可以把長度當成數字收進來。'],
    ['Write function walk(steps) that repeats hero.move() and ends with return steps. Call it for each corridor.', '寫 function walk(steps)，重複 hero.move()，最後 return steps。每條走廊各呼叫一次。'],
    NEAR_CODE),
  q27: hint(
    ['The chest opens only if the walk was long enough. walk() can tell you how far it went.', '走得夠遠，寶箱才會打開。walk() 會告訴你走了多遠。'],
    ['Keep the answers with let moved = walk(…); add them up, and open only if the total is big enough.', '用 let moved = walk(…); 記下答案，加起來，總數夠大時才打開。'],
    NEAR_CODE),
  q28: hint(
    ['How many attacks does the goblin need? The game can tell you — no guessing.', '哥布林要打幾下？遊戲可以告訴你，不用猜。'],
    ['let hits = enemy.hp / hero.weapon.damage; then repeat(hits, …) with hero.attack().', 'let hits = enemy.hp / hero.weapon.damage; 再用 repeat(hits, …) 執行 hero.attack()。'],
    NEAR_CODE),
  q29: hint(
    ['Healing only helps when you are hurt and still have a potion.', '只有受傷而且還有藥水時，治療才有用。'],
    ['One if with two checks that must both be true: hero.hp is low and hero.inventory.healing is above 0.', '一個 if 裡有兩個都要成立的檢查：hero.hp 偏低，而且 hero.inventory.healing 大於 0。'],
    NEAR_CODE),
  q30: hint(
    ['The Warden has armor, warns before it shoots, and its HP changes. Read enemy instead of guessing.', '守衛有盔甲、射擊前會警告，生命值也會變。讀取 enemy，不要用猜的。'],
    ['Write strike(times): heavyAttack if enemy.armor is above 0, else attack. Guard if enemy.incoming.', '寫 strike(times)：enemy.armor 大於 0 就 heavyAttack，不然就 attack。enemy.incoming 時防禦。'],
    NEAR_CODE),
  q31: hint(
    ['Two guardians wait in the hall. enemies.length can count them for you.', '走廊裡有兩個守衛。enemies.length 可以幫你數。'],
    ['let foes = enemies.length; then repeat(foes, …) with move, attack, move inside.', 'let foes = enemies.length; 再用 repeat(foes, …)，裡面放前進、攻擊、前進。'],
    NEAR_CODE),
  q32: hint(
    ['The goblin is out of sword reach, but not out of spell reach. Pick it from the enemies list.', '哥布林在劍打不到的地方，但法術打得到。從 enemies 清單裡選它。'],
    ['Read enemies[0].hp into a variable, hero.target(0), then repeat hero.cast() that many times.', '把 enemies[0].hp 存進變數，hero.target(0)，再重複 hero.cast() 那麼多次。'],
    NEAR_CODE),
  q33: hint(
    ['With the Ember Wand, fire hits the frost creature hard. The ember one resists it.', '用餘燼魔杖時，火對冰霜生物特別有效。餘燼生物會抵抗它。'],
    ['hero.targetElementWeak() and cast first; then hero.targetNearest() and cast as often as enemies[0].hp.', '先 hero.targetElementWeak() 再施法；然後 hero.targetNearest()，施法次數照 enemies[0].hp。'],
    NEAR_CODE),
  q34: hint(
    ['Frost can freeze the guardian so it skips its next turn.', '冰霜可以把守衛凍住，讓它跳過下一回合。'],
    ['hero.targetNearest(), hero.cast() to freeze it, then hero.move() while it is frozen.', 'hero.targetNearest()，hero.cast() 把它凍住，趁它被凍住時 hero.move()。'],
    NEAR_CODE),
  q35: hint(
    ['Take out the armored enemy first; the weaker ones are easier after.', '先打倒有盔甲的敵人，之後弱的就簡單了。'],
    ['hero.targetArmored() and cast, then repeat(enemies.length - 1, …) with targetWeakest and cast.', 'hero.targetArmored() 再施法，然後 repeat(enemies.length - 1, …)，裡面 targetWeakest 再施法。'],
    NEAR_CODE),
  q36: hint(
    ['Three foes, different elements. One function can pick the best target each time.', '三個敵人，元素都不同。一個函式可以每次挑最好的目標。'],
    ['In clear(count): targetElementWeak; cast if isTargetElementWeak(), else targetWeakest and cast.', '在 clear(count) 裡：targetElementWeak；isTargetElementWeak() 時施法，不然 targetWeakest 再施法。'],
    NEAR_CODE),
  q37: hint(
    ['The gate checks your relic. Read hero.weapon to see what you carry.', '閘門會檢查你的遺物。讀取 hero.weapon 看看你帶了什麼。'],
    ['let rank = hero.weapon.rarityRank; walk through only if rank is 1 or more.', 'let rank = hero.weapon.rarityRank; 只有 rank 至少是 1 時才走過去。'],
    NEAR_CODE),
  q38: hint(
    ['Three slimes in a row. Let a loop visit each one for you.', '一排三隻史萊姆。讓迴圈幫你一隻一隻處理。'],
    ['for (const foe of enemies) { hero.target(foe); hero.cast(); } then walk to the exit.', 'for (const foe of enemies) { hero.target(foe); hero.cast(); } 然後走到出口。'],
    NEAR_CODE),
  q39: hint(
    ['Not every foe is weak to your element. Check each one inside the loop.', '不是每個敵人都怕你的元素。在迴圈裡逐一檢查。'],
    ['In for…of: one cast if foe.weakTo === hero.weapon.element, else cast more than once.', '在 for…of 裡：foe.weakTo === hero.weapon.element 時施法一次，不然多施法幾次。'],
    NEAR_CODE),
  q40: hint(
    ['Your weapon\'s rarity and affixes are numbers the code can read.', '武器的稀有度和詞綴，都是程式讀得到的數字。'],
    ['Read hero.weapon.affixCount and rarityRank; walk affixes + 3 steps, then turn right.', '讀取 hero.weapon.affixCount 和 rarityRank；走 affixes + 3 步，再右轉。'],
    NEAR_CODE),
  q41: hint(
    ['Same job for every foe. Put it in a function that takes the foe.', '每個敵人都做同一件事。把它放進一個收下 foe 的函式。'],
    ['function strike(foe) { hero.target(foe); hero.cast(); } then call strike(foe) inside for…of.', 'function strike(foe) { hero.target(foe); hero.cast(); } 再在 for…of 裡呼叫 strike(foe)。'],
    NEAR_CODE),
  q42: hint(
    ['Some escorts are tougher than others. foe.maxHp tells you which.', '有些護衛比較強。foe.maxHp 會告訴你是哪些。'],
    ['In for…of, target each foe; cast more at a foe with a big maxHp, once at the small ones.', '在 for…of 裡鎖定每個敵人；maxHp 大的多施法幾次，小的施法一次。'],
    NEAR_CODE),
  q44: hint(
    ['The gate opens when the plate is pressed. The world can tell you if it worked.', '踩下壓力板，閘門就會打開。世界會告訴你有沒有成功。'],
    ['Walk onto the plate, read hero.world.switchesActive, and go through only if it is at least 1.', '走上壓力板，讀取 hero.world.switchesActive，至少是 1 才走過去。'],
    NEAR_CODE),
  q47: hint(
    ['A lever and a crate block the way. One routine can handle whatever is in front.', '拉桿和木箱擋住了路。一個函式可以處理前面的任何東西。'],
    ['In clear(): interact if hero.seesLeverAhead(), smash if hero.seesBreakableAhead(). Call it after each step.', 'function clear()：hero.seesLeverAhead() 就互動，hero.seesBreakableAhead() 就擊破。每走一步呼叫一次。'],
    NEAR_CODE),
  q48: hint(
    ['Both mechanisms must be on before the Guardian can be hurt.', '兩個機關都啟動後，才能打傷守衛。'],
    ['Pull the lever, step on the plate, then compare switchesActive with switchesRequired before fighting.', '拉下拉桿、踩上壓力板，戰鬥前先比較 switchesActive 和 switchesRequired。'],
    NEAR_CODE),
  q49: hint(
    ['Exactly two levers — not one, not three.', '剛好兩個拉桿——不是一個，也不是三個。'],
    ['Interact with two levers, then check hero.world.switchesActive === 2 before crossing.', '和兩個拉桿互動，通過前檢查 hero.world.switchesActive === 2。'],
    NEAR_CODE),
  q50: hint(
    ['The clock trap turns on and off. Waiting can be the right move.', '循環陷阱會開開關關。有時候等待才是對的。'],
    ['If a clock trap is ahead: wait while it is active, else move. No trap: move. Run it each turn.', '前面有循環陷阱時：啟動中就等待，不然前進。沒有陷阱就前進。每回合執行一次。'],
    NEAR_CODE),
  q51: hint(
    ['The plate needs something heavy on it. The stone block can be pushed.', '壓力板上要放重的東西。石塊可以推。'],
    ['Walk next to the block, face it and hero.push() it onto the plate, then go around to the stairs.', '走到石塊旁邊，面向它，用 hero.push() 推上壓力板，再繞到樓梯。'],
    NEAR_CODE),
  q52: hint(
    ['The bridge moves. Wait for it, step on, and ride it across.', '橋會移動。等它來，踩上去，坐它過去。'],
    ['If hero.seesPlatformAhead(), move; else wait when blocked, otherwise move. Run it each turn.', 'hero.seesPlatformAhead() 時前進；不然被擋住就等待，沒擋住就前進。每回合執行一次。'],
    NEAR_CODE),
  q53: hint(
    ['The guide gives you a quest: start it, fetch the token, and come back.', '嚮導給你一個任務：開始任務、拿到符記，再回來。'],
    ['Talk to the guide, check hero.world.questsStarted, fetch the token, come back, and talk again.', '和嚮導說話，檢查 hero.world.questsStarted，拿到符記，回來再說一次話。'],
    NEAR_CODE),
  q54: hint(
    ['Your companion can follow you and help in a fight. Tell it what to do.', '夥伴可以跟著你，也能幫忙戰鬥。告訴它要做什麼。'],
    ['Start with companion.follow(); when hero.seesEnemyAhead(), companion.assist() then hero.attack().', '先 companion.follow()；hero.seesEnemyAhead() 時，companion.assist() 再 hero.attack()。'],
    NEAR_CODE),
  q55: hint(
    ['Two plates must be pressed at the same time — one for each of you.', '兩塊壓力板要同時踩下——你們各踩一塊。'],
    ['companion.hold() first, then walk the hero onto one plate and the companion onto the other.', '先 companion.hold()，再讓英雄走上一塊壓力板，夥伴走上另一塊。'],
    NEAR_CODE),
  q56: hint(
    ['The lever is in the companion\'s lane, not the hero\'s.', '拉桿在夥伴的路上，不在英雄的路上。'],
    ['Write function scout(): companion.hold(), move it down its lane, companion.interact(). Then walk the hero.', '寫 function scout()：companion.hold()，讓它走自己的路，companion.interact()。再讓英雄走。'],
    NEAR_CODE),
  q57: hint(
    ['The plate wants the rune core on it. Pick it up and throw it there.', '壓力板上要放符文核心。拿起來，丟過去。'],
    ['If hero.seesCarryableAhead(), take; move; if hero.isCarrying(), throw. Check orbsOnPlates, then go.', 'hero.seesCarryableAhead() 就拿起；前進；hero.isCarrying() 就投擲。檢查 orbsOnPlates 再走。'],
    NEAR_CODE),
  q58: hint(
    ['Hand the core to your companion — the plate is on its side.', '把核心交給夥伴——壓力板在它那一邊。'],
    ['hero.take() and hero.throw() to the companion; then companion.take(), turn, move and companion.throw().', 'hero.take() 再 hero.throw() 給夥伴；然後 companion.take()、轉向、前進、companion.throw()。'],
    NEAR_CODE),
  q59: hint(
    ['You don\'t have to guard by hand. Tell the game what to do when danger comes.', '不用自己防禦。告訴遊戲危險來時要做什麼。'],
    ['Write function brace() with companion.guard(), register on("danger", brace) once, then move.', '寫 function brace()，裡面 companion.guard()，註冊一次 on("danger", brace)，再前進。'],
    NEAR_CODE),
  q60: hint(
    ['Two plates, one core and the companion. Power the circuit before you fight.', '兩塊壓力板、一顆核心和夥伴。戰鬥前先讓迴路通電。'],
    ['Write power() to put the core and the companion on the plates; check circuitSatisfied, then fight.', '寫 power() 把核心和夥伴放上壓力板；檢查 circuitSatisfied，再戰鬥。'],
    NEAR_CODE),
  q61: hint(
    ['The relay gate listens for a message.', '中繼閘門在等一個訊息。'],
    ['Send it with hero.signal("ready"), then walk through the gate.', '用 hero.signal("ready") 送出訊息，再走過閘門。'],
    NEAR_CODE),
  q62: hint(
    ['Your companion can answer a message by itself.', '夥伴可以自己回應訊息。'],
    ['Write answer() with companion.move(); register on("signal", answer); then hero.signal("help").', '寫 answer()，裡面 companion.move()；註冊 on("signal", answer)；再 hero.signal("help")。'],
    NEAR_CODE),
  q63: hint(
    ['Two things to watch: messages and arrows. Each needs its own handler.', '要注意兩件事：訊息和弓箭。每件事都要有自己的處理器。'],
    ['Register on("signal", advance) and on("danger", brace), send hero.signal("ready"), then move.', '註冊 on("signal", advance) 和 on("danger", brace)，送出 hero.signal("ready")，再前進。'],
    NEAR_CODE),
  q64: hint(
    ['This time the companion sends the message.', '這次由夥伴送出訊息。'],
    ['companion.signal("switch") opens the relay; then walk the hero through.', 'companion.signal("switch") 會打開中繼閘門；再讓英雄走過去。'],
    NEAR_CODE),
  q65: hint(
    ['The handler can read which message came last, and choose.', '處理器可以讀取最後收到的是哪個訊息，再做選擇。'],
    ['In route(): if hero.signal.last === "help", companion.move(); else companion.hold(). Then send help.', '在 route() 裡：hero.signal.last === "help" 時 companion.move()；不然 companion.hold()。再送出 help。'],
    NEAR_CODE),
  q66: hint(
    ['Give each job its own function: send, follow, guard.', '每件事都做成自己的函式：送訊息、跟隨、防禦。'],
    ['boot() sends ready, sync() moves the companion, brace() guards. Register sync and brace, then boot().', 'boot() 送出 ready，sync() 讓夥伴移動，brace() 防禦。註冊 sync 和 brace，再 boot()。'],
    NEAR_CODE),
  q67: hint(
    ['The hero remembers a mode. Explore first, then switch to attack.', '英雄會記住一個模式。先探索，再切換成攻擊。'],
    ['If hero.state === "explore": move and set hero.state = "attack"; else attack. Run it each turn.', 'hero.state === "explore" 時：前進並設定 hero.state = "attack"；不然就攻擊。每回合執行一次。'],
    NEAR_CODE),
  q68: hint(
    ['The companion has its own mode, separate from the hero\'s.', '夥伴有自己的模式，和英雄分開。'],
    ['If companion.state === "wait": set it to "regroup" and move; else move. Run it each turn.', 'companion.state === "wait" 時：設成 "regroup" 並前進；不然就前進。每回合執行一次。'],
    NEAR_CODE),
  q69: hint(
    ['Messages wait in line and arrive in the order you send them.', '訊息會排隊，照你送出的順序抵達。'],
    ['Register on("signal", receive) with companion.move() inside, then send "ready" before "switch".', '註冊 on("signal", receive)，裡面 companion.move()，再先送 "ready"，後送 "switch"。'],
    NEAR_CODE),
  q70: hint(
    ['Two corridors: the companion takes the lower one. Both signals open the way.', '兩條走廊：夥伴走下面那條。兩個訊號一起才會開路。'],
    ['Set companion.state, move it down its corridor, companion.signal("switch"), then hero.signal("ready").', '設定 companion.state，讓它走自己的走廊，companion.signal("switch")，再 hero.signal("ready")。'],
    NEAR_CODE),
  q71: hint(
    ['The lever is in another room. Your companion can pull it when you call.', '拉桿在另一個房間。你一呼叫，夥伴就能拉它。'],
    ['remote() does companion.interact(); register on("signal", remote), send "switch", then walk.', 'remote() 執行 companion.interact()；註冊 on("signal", remote)，送出 "switch"，再前進。'],
    NEAR_CODE),
  q72: hint(
    ['Everything at once: states, two signals, the companion and the golem. Plan it step by step.', '全部一起來：狀態、兩個訊號、夥伴和魔像。一步一步計畫。'],
    ['plan(): while exploring, send ready and switch, then go to attack; else target and cast in range.', 'plan()：探索時送出 ready 和 switch，再切換成攻擊；不然鎖定目標，在射程內施法。'],
    NEAR_CODE)
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
