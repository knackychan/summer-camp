export const COMMANDS = Object.freeze({
  move: ['Move', '前進'], turnLeft: ['Turn left', '左轉'], turnRight: ['Turn right', '右轉'],
  attack: ['Attack', '攻擊'], heavyAttack: ['Heavy attack', '重擊'], guard: ['Guard', '防禦'],
  open: ['Open / unlock', '打開／解鎖'], disarm: ['Disarm', '解除陷阱'],
  usePotion: ['Healing potion', '治療藥水'], useAntidote: ['Antidote', '解毒藥水'], useWard: ['Ward tonic', '守護藥水'], wait: ['Wait', '等待'],
  targetNearest: ['Target nearest', '鎖定最近敵人'], targetWeakest: ['Target weakest', '鎖定最弱敵人'],
  targetArmored: ['Target armored', '鎖定裝甲敵人'], targetElementWeak: ['Target weakness', '鎖定元素弱點'],
  cast: ['Cast', '施法'], interact: ['Interact', '互動'], smash: ['Smash', '擊破'], push: ['Push', '推動'], take: ['Take rune core', '拿起符文核心'], throw: ['Throw rune core', '投擲符文核心'],
  companionFollow: ['Companion follow', '夥伴跟隨'], companionHold: ['Companion hold', '夥伴待命'], companionGuard: ['Companion guard', '夥伴防禦'], companionAssist: ['Companion assist', '夥伴協助'],
  companionMove: ['Companion move', '夥伴前進'], companionTurnLeft: ['Companion turn left', '夥伴左轉'], companionTurnRight: ['Companion turn right', '夥伴右轉'], companionInteract: ['Companion interact', '夥伴互動'], companionPush: ['Companion push', '夥伴推動'], companionTake: ['Companion take core', '夥伴拿核心'], companionThrow: ['Companion throw core', '夥伴投擲核心']
});

export const CONDITIONS = Object.freeze({
  enemyAhead: ['Enemy ahead', '前方有敵人'], enemyArmoredAhead: ['Armored enemy ahead', '前方敵人有裝甲'],
  enemyWeakAhead: ['Weak enemy ahead', '前方敵人已虛弱'], dangerIncoming: ['Danger incoming', '有攻擊即將到來'],
  heroPoisoned: ['Hero is poisoned', '英雄中毒'], chestAhead: ['Chest ahead', '前方有寶箱'],
  doorAhead: ['Locked door ahead', '前方有鎖門'], trapAhead: ['Trap ahead', '前方有陷阱'],
  blockedAhead: ['Path blocked', '前方被擋住'], hasKey: ['Have a key', '持有鑰匙'],
  hpLow: ['Health is low', '生命值偏低'], onExit: ['On exit', '站在出口'],
  multipleEnemies: ['Multiple enemies', '有多名敵人'], targetInRange: ['Target in range', '目標在射程內'],
  targetWeak: ['Target is weak', '目標已虛弱'], targetArmored: ['Target is armored', '目標有裝甲'],
  targetElementWeak: ['Target is weak to my element', '目標怕我的元素'],
  leverAhead: ['Lever ahead', '前方有拉桿'], breakableAhead: ['Breakable ahead', '前方有可破壞物'],
  npcAhead: ['NPC ahead', '前方有角色'], runeGateAhead: ['Rune gate ahead', '前方有符文閘門'],
  pushableAhead: ['Pushable block ahead', '前方有可推動方塊'], cycleTrapAhead: ['Clock trap ahead', '前方有循環陷阱'], cycleTrapActiveAhead: ['Clock trap is active', '前方循環陷阱正在啟動'],
  platformAhead: ['Moving platform ahead', '前方有移動平台'], onPlatform: ['Standing on platform', '正站在移動平台上'], questTokenAhead: ['Quest token ahead', '前方有任務符記'], companionNear: ['Companion is nearby', '夥伴就在附近'],
  carryableAhead: ['Rune core ahead', '前方有符文核心'], heroCarrying: ['Hero is carrying a core', '英雄正攜帶核心'], heroOnPlate: ['Hero is on a plate', '英雄站在壓力板上'], companionCarryableAhead: ['Core ahead of companion', '夥伴前方有核心'], companionCarrying: ['Companion carries a core', '夥伴正攜帶核心'], companionOnPlate: ['Companion is on a plate', '夥伴站在壓力板上']
});

export const LOGIC = Object.freeze({
  repeat2: ['Repeat ×2', '重複 ×2'], repeat3: ['Repeat ×3', '重複 ×3'], repeat5: ['Repeat ×5', '重複 ×5'],
  ifEnemy: ['IF enemy ahead', '如果前方有敵人'], ifArmored: ['IF enemy is armored', '如果敵人有裝甲'],
  ifWeak: ['IF enemy is weak', '如果敵人已虛弱'], ifDanger: ['IF danger incoming', '如果攻擊即將到來'],
  ifPoisoned: ['IF poisoned', '如果中毒'], ifChest: ['IF chest ahead', '如果前方有寶箱'],
  ifDoor: ['IF door ahead', '如果前方有鎖門'], ifTrap: ['IF trap ahead', '如果前方有陷阱'],
  ifKey: ['IF I have a key', '如果我有鑰匙'], ifHpLow: ['IF health is low', '如果生命值偏低'],
  ifMultiple: ['IF multiple enemies', '如果有多名敵人'], ifTargetRange: ['IF target in range', '如果目標在射程內'],
  ifTargetWeak: ['IF target is weak', '如果目標已虛弱'], ifElementWeak: ['IF elemental weakness', '如果有元素弱點'],
  ifLever: ['IF lever ahead', '如果前方有拉桿'], ifBreakable: ['IF breakable ahead', '如果前方可破壞'],
  ifNpc: ['IF NPC ahead', '如果前方有角色'], ifRuneGate: ['IF rune gate ahead', '如果前方有符文閘門'],
  ifPushable: ['IF pushable ahead', '如果前方可推動'], ifCycleTrap: ['IF clock trap ahead', '如果前方有循環陷阱'], ifCycleTrapActive: ['IF clock trap active', '如果循環陷阱正在啟動'],
  ifPlatform: ['IF platform ahead', '如果前方有移動平台'], ifOnPlatform: ['IF on platform', '如果站在移動平台上'], ifQuestToken: ['IF quest token ahead', '如果前方有任務符記'], ifCompanionNear: ['IF companion nearby', '如果夥伴在附近'],
  ifCarryable: ['IF rune core ahead', '如果前方有符文核心'], ifHeroCarrying: ['IF hero carrying core', '如果英雄攜帶核心'], ifHeroOnPlate: ['IF hero on plate', '如果英雄站在壓力板'], ifCompanionCarryable: ['IF core ahead of companion', '如果夥伴前方有核心'], ifCompanionCarrying: ['IF companion carrying core', '如果夥伴攜帶核心'], ifCompanionOnPlate: ['IF companion on plate', '如果夥伴站在壓力板'],
  callRune: ['Call Rune', '呼叫符文']
});

export const UI = Object.freeze({
  title: ['CODE QUEST', '程式冒險'], subtitle: ['Program the dungeon hero', '編程控制地下城英雄'],
  questMap: ['Quest map', '冒險地圖'], inventory: ['Camp', '營地'], pause: ['Pause', '暫停'],
  program: ['Turn program', '回合程式'], rune: ['Rune function', '符文函式'], code: ['Write code', '編寫程式'],
  picture: ['Picture cards', '圖像卡'], blocksView: ['Blocks', '積木'], hybrid: ['Hybrid', '混合模式'],
  recommended: ['Recommended', '建議模式'], applyCode: ['Apply code', '套用程式碼'], resetCode: ['Reset from blocks', '從積木重設'],
  codeApi: ['Code toolbox', '程式工具箱'], codeMain: ['Executable JavaScript', '可執行 JavaScript'], codeLocked: ['Finish the Signal Bastion to unlock written code.', '完成「訊號堡壘」後即可解鎖文字程式碼。'],
  run: ['Run turn', '執行回合'], step: ['Step', '單步'], undo: ['Undo', '上一步'], clear: ['Clear', '清空'], reset: ['Reset room', '重設房間'],
  moveLeft: ['Move card left', '卡片左移'], moveRight: ['Move card right', '卡片右移'], removeCard: ['Remove card', '移除卡片'],
  wrap: ['Wrap', '包起來'], unwrap: ['Unwrap', '拆開'], repeatCount: ['Change repeat count', '換重複次數'],
  stickersOff: ['Take stickers off', '撕掉貼紙'],
  heroRow: ['Hero', '英雄'], runeRow: ['Rune', '符文'], useInHeroRow: ['Use it in the Hero row', '在英雄那一排使用它'],
  heroRowLabel: ['Hero row: the program the hero runs', '英雄那一排：英雄執行的程式'], runeRowLabel: ['Rune row: runs at every 🪨 card', '符文那一排：每張 🪨 卡片都會執行它'],
  cards: ['Cards', '卡片'],
  zoomIn: ['Zoom in', '放大'], zoomOut: ['Zoom out', '縮小'], zoomHome: ['Whole room', '看整個房間'],
  actions: ['Action cards', '動作卡'], logic: ['Logic cards', '邏輯卡'], selectHint: ['Build a turn routine. Run it again after the dungeon changes.', '建立一套回合程式；地下城狀態改變後可以再次執行。'],
  functionHint: ['Build Rune once, then Call Rune from the main program.', '先建立一次「符文」，再從主程式呼叫它。'],
  blocks: ['blocks', '積木'], par: ['par', '目標'], turn: ['Turn', '回合'], hp: ['HP', '生命'], keys: ['Keys', '鑰匙'],
  defense: ['DEF', '防禦'], status: ['Status', '狀態'], best: ['Best', '最佳'], completed: ['cleared', '已完成'], locked: ['Locked', '尚未解鎖'],
  continue: ['Continue', '繼續'], replay: ['Replay', '再玩一次'], close: ['Back', '返回'],
  pausedTitle: ['Adventure paused', '冒險暫停中'], pausedBody: ['Your program and dungeon room can wait.', '你的程式和地下城房間都會等你。'], resume: ['Keep adventuring', '繼續冒險'],
  campTitle: ['Dungeon Camp', '地下城營地'], bag: ['Ingredient bag', '材料背包'], equipment: ['Loadout', '裝備配置'], potionBench: ['Potion laboratory', '藥水實驗室'],
  cauldron: ['Cauldron', '煉金鍋'], brew: ['Brew', '調製'], clearBench: ['Clear lab', '清空實驗室'], potions: ['Potions', '藥水'], recipes: ['Recipes', '配方'],
  process: ['Process', '製程'], grind: ['Grind', '研磨'], heat: ['Heat', '加熱'], stir: ['Stir', '攪拌'], cool: ['Cool', '冷卻'],
  equip: ['Equip', '裝備'], equipped: ['Equipped', '已裝備'], damage: ['damage', '傷害'], armor: ['armor', '護甲'], slot: ['slot', '欄位'],
  dragHint: ['Choose three ingredients, then perform the recipe process in order.', '選三份材料，再依照配方順序進行製程。'],
  tower: ['Infinite Tower', '無限高塔'], floor: ['Floor', '樓層'], startFloor: ['Enter tower', '進入高塔'],
  explorer: ['Explorer', '探索者'], builder: ['Builder', '建造者'], coder: ['Coder', '程式冒險家'], architect: ['Architect', '程式架構師'],
  spriteNote: ['2.5D pixel dungeon · reactive combat', '2.5D 像素地下城・反應式戰鬥'],
  potionCode: ['Potion Script', '藥水程式'], runPotionCode: ['Run potion code', '執行藥水程式'], loadRecipeCode: ['Code recipe', '載入配方程式']
});

export const ITEM_LABELS = Object.freeze({
  sunHerb: ['Sun Herb', '太陽草'], moonBerry: ['Moon Berry', '月光莓'], waterCrystal: ['Water Crystal', '水晶露'], emberRoot: ['Ember Root', '火根'],
  healing: ['Healing Potion', '治療藥水'], focus: ['Focus Potion', '專注藥水'], antidote: ['Antidote', '解毒藥水'], ward: ['Ward Tonic', '守護藥水'],
  trainingBlade: ['Training Blade', '練習短劍'], bronzeBlade: ['Bronze Blade', '青銅短劍'], clockworkBlade: ['Clockwork Blade', '機關短劍'],
  emberWand: ['Ember Wand', '餘燼魔杖'], frostScepter: ['Frost Scepter', '冰霜權杖'],
  guardCape: ['Guard Cape', '守衛披風'], alchemistApron: ['Alchemist Apron', '鍊金圍裙'], signalCharm: ['Signal Charm', '預警護符'], wardenCrest: ['Warden Crest', '守衛徽記'], seekerLens: ['Seeker Lens', '尋敵透鏡'],
  dungeonKey: ['Dungeon Key', '地下城鑰匙']
});

export const ALCHEMY_LABELS = Object.freeze({
  grind: ['Grind', '研磨'], heat: ['Heat', '加熱'], stir: ['Stir', '攪拌'], cool: ['Cool', '冷卻']
});

export const MESSAGES = Object.freeze({
  intro: ['Build a turn routine, predict the result, then run it.', '建立回合程式、先預測結果，再執行。'],
  empty: ['Add at least one action card first.', '先加入至少一張動作卡。'],
  tooMany: ['That program is a little too big for this quest. Try a loop or function.', '這關的程式有點太長，試試迴圈或函式。'],
  needRepeat: ['This quest asks you to use Repeat.', '這一關要使用「重複」。'], needIf: ['This quest asks you to use IF.', '這一關要使用「如果」。'], needCall: ['This quest needs the 🪨 Rune card in the Hero row.', '這一關要把 🪨 符文卡片放到英雄那一排。'],
  runeReady: ['Your Rune is ready! Put the 🪨 card in the Hero row.', '你的符文準備好了！把 🪨 卡片放到英雄那一排。'],
  missingFunction: ['Your Rune is empty. Put some cards in it first.', '你的符文是空的，先放幾張卡片進去。'], noSelfCall: ["A Rune can't use itself. Use it from Main.", '符文不能呼叫自己，請從主程式使用它。'], recursion: ['Rune tried to call itself forever. Try a smaller reusable routine.', '符文一直呼叫自己了。試著做一個較小的可重複步驟。'],
  blocked: ['Bump! Something blocks the corridor. Inspect the room and adjust the program.', '碰！走廊被擋住了。看看房間，再調整程式。'], noTarget: ['No valid enemy target is selected.', '目前沒有可用的敵人目標。'],
  targeted: ['Target locked. The next ranged action can use it.', '目標已鎖定，下一個遠距動作可以使用它。'],
  outOfRange: ['That target is outside the weapon range.', '那個目標超出武器射程。'],
  noMagic: ['This weapon has no ranged spell. Equip or practice with an elemental weapon.', '這把武器沒有遠距法術。請裝備或練習元素武器。'],
  elementWeak: ['Elemental weakness! Extra damage.', '元素弱點！造成額外傷害。'],
  elementResist: ['The target resists that element.', '目標對這個元素有抗性。'],
  armored: ['Clang! Normal attack cannot pierce that armor. Try Heavy Attack.', '鏘！普通攻擊無法穿透裝甲，試試重擊。'], hit: ['Hit! Keep watching the program.', '擊中了！繼續看程式執行。'], defeated: ['Enemy cleared!', '打敗敵人了！'], guarding: ['Guard ready for the dungeon turn.', '防禦已準備好，等待地下城回合。'],
  opened: ['Chest opened!', '寶箱打開了！'], doorOpened: ['Click! The dungeon door unlocked.', '喀嚓！地下城的門解鎖了。'], lockedDoor: ['The door is locked. Find a key first.', '門鎖住了，先找到鑰匙。'], nothingToOpen: ['There is no chest or locked door directly ahead.', '正前方沒有寶箱或鎖住的門。'], keyCollected: ['Dungeon key collected!', '拿到地下城鑰匙！'],
  trapAhead: ['Trap disarmed. The path is safe now.', '陷阱已解除，現在可以安全通過。'], noTrap: ['There is no active trap directly ahead.', '正前方沒有啟動中的陷阱。'], trapHit: ['Ouch! The hero stepped on a trap.', '哎呀！英雄踩到陷阱了。'],
  leverActivated: ['Lever activated. A rune circuit changed.', '拉桿已啟動，符文迴路發生變化。'], noInteract: ['There is nothing to interact with directly ahead.', '正前方沒有可互動的物件。'],
  npcHelped: ['The dungeon guide shared a useful item.', '地下城角色提供了有用的物品。'], npcDone: ['You already spoke with this character.', '你已經和這個角色互動過了。'],
  crateBroken: ['Crate smashed. The corridor is clear.', '木箱已擊破，走廊打通了。'], noBreakable: ['There is no breakable object directly ahead.', '正前方沒有可破壞物。'],
  plateActivated: ['Pressure plate activated. The rune gate responded.', '壓力板已啟動，符文閘門產生反應。'], gateOpened: ['Rune gate opened!', '符文閘門打開了！'],
  leverDeactivated: ['Lever deactivated. The circuit recalculated.', '拉桿已關閉，符文迴路重新計算。'], gateClosed: ['Rune gate closed because the circuit changed.', '迴路改變，符文閘門關閉了。'],
  pushed: ['Block pushed.', '方塊已推動。'], pushPlate: ['Block landed on a pressure plate!', '方塊壓上了壓力板！'], noPushable: ['There is no pushable block directly ahead.', '正前方沒有可推動的方塊。'], pushBlocked: ['The block cannot move there.', '方塊無法推到那裡。'],
  taken: ['Rune core picked up.', '已拿起符文核心。'], alreadyCarrying: ['That character is already carrying a core.', '這個角色已經攜帶一顆核心。'], noCarryable: ['There is no rune core directly ahead.', '正前方沒有符文核心。'], thrown: ['Rune core thrown.', '符文核心已投擲。'], thrownToPlate: ['Rune core activated a pressure plate!', '符文核心啟動了壓力板！'], notCarrying: ['There is no rune core to throw.', '目前沒有可投擲的符文核心。'], throwBlocked: ['The rune core cannot be thrown there.', '符文核心無法投到那裡。'],
  questStarted: ['Quest started. Find the requested rune token.', '任務開始，去找指定的符文符記。'], questWaiting: ['The guide is still waiting for the quest token.', '嚮導還在等待任務符記。'], questTokenCollected: ['Quest token collected!', '拿到任務符記！'], questCompleted: ['Quest complete. The guide shared a reward.', '任務完成，嚮導給了獎勵。'],
  companionFollow: ['Companion will follow your movement.', '夥伴會跟隨你的移動。'], companionHold: ['Companion will hold this position.', '夥伴會在原地待命。'], companionGuard: ['Companion is guarding the hero.', '夥伴正在守護英雄。'], companionHit: ['Companion assist hit the target.', '夥伴協助攻擊命中目標。'], companionNoTarget: ['No enemy is close enough for the companion.', '附近沒有夥伴能協助攻擊的敵人。'], noCompanion: ['This room has no companion.', '這個房間沒有夥伴。'], companionOutOfRange: ['The companion is too far from the target.', '夥伴離目標太遠。'], companionMoved: ['Companion moved independently.', '夥伴已獨立前進。'], companionBlocked: ['The companion path is blocked.', '夥伴的路被擋住了。'], companionTurned: ['Companion changed direction.', '夥伴已改變方向。'],
  handlerRegistered: ['Event handler armed. It will run when the dungeon emits that event.', '事件處理器已啟用；地下城觸發事件時會執行。'], callbackTriggered: ['Dungeon event triggered your callback.', '地下城事件已觸發你的回呼函式。'],
  healed: ['Healing potion used.', '使用治療藥水。'], noPotion: ['No healing potion is on the belt.', '腰帶上沒有治療藥水。'], fullHealth: ['Health is already full.', '生命值已經滿了。'],
  cured: ['Antidote cleared the poison.', '解毒藥水清除了毒素。'], noAntidote: ['No antidote is available.', '沒有可用的解毒藥水。'], notPoisoned: ['The hero is not poisoned.', '英雄目前沒有中毒。'],
  warded: ['Ward active. Incoming damage will be reduced.', '守護效果啟動，接下來的傷害會降低。'], noWard: ['No ward tonic is available.', '沒有可用的守護藥水。'],
  incoming: ['The archer is signaling a shot. Your next turn can react to it.', '弓手正在預告射擊；下一個回合可以對它做出反應。'], poisoned: ['Poison is active. It will tick after the dungeon turn.', '毒素正在作用，地下城回合結束時會造成傷害。'],
  turnLeftStep: ['Left turn — toward the hero’s left hand.', '左轉——往英雄的左手邊。'], turnRightStep: ['Right turn — toward the hero’s right hand.', '右轉——往英雄的右手邊。'],
  runeRunning: ['Running your Rune…', '正在執行你的符文……'], runeDone: ['Rune finished — back to Main.', '符文跑完了——回到主程式。'],
  worldTurn: ['Now the dungeon takes its turn.', '現在輪到地下城行動。'], resting: ['The hero needs a quick rest. Change the plan and reset the room.', '英雄需要休息一下。調整計畫，再重設房間。'],
  won: ['Quest clear! Your program worked.', '闖關成功！你的程式成功了。'], firstReward: ['New loot added to your camp.', '新戰利品已放進營地。'], improved: ['New smallest program for this quest!', '這一關有新的最短程式紀錄！'],
  selected: ['Selected. Tap a sticker to put it on this card.', '已選取。點一張貼紙，就會貼到這張卡片上。'],
  stickerNeedsCard: ['Put a card first, then its sticker.', '先放一張卡片，再貼貼紙。'], stickerNoBracket: ["This card can't take stickers.", '這張卡片不能貼貼紙。'],
  selectContiguous: ['Select cards next to each other before wrapping them.', '要包起來的卡片必須彼此相鄰。'], wrapEmpty: ['Add an action first, then wrap it.', '先加入動作，再把它包起來。'],
  benchFull: ['The cauldron has three ingredients. Brew or clear it first.', '煉金鍋已有三份材料，先調製或清空。'], noIngredient: ['You do not have that ingredient yet.', '你還沒有這個材料。'], needThree: ['Put exactly three ingredients in the cauldron.', '請在煉金鍋放入三份材料。'],
  unknownRecipe: ['That ingredient combination is not a known recipe. Nothing was lost.', '這個材料組合不是已知配方，材料沒有消失。'], wrongProcess: ['The ingredients are right, but the process order is wrong. Nothing was lost.', '材料正確，但製程順序不對。材料沒有消失。'], missingIngredient: ['The bag changed. Add ingredients again.', '背包內容更新了，請重新加入材料。'], brewed: ['Potion brewed!', '藥水調製完成！'], potionCodeError: ['Potion code needs a small fix.', '藥水程式需要修正一下。'], potionCodeReady: ['Potion recipe loaded as code.', '已把藥水配方載入成程式。'], processAdded: ['Lab step added.', '已加入製程步驟。'],
  // Written-code editor (Architect surface). Referenced by codequest.js since v0.4 but never shipped — opening any code-view quest threw.
  codeError: ['The code needs a fix', '程式碼需要修正'],
  codeChanged: ['Code changed. Tap Apply code before you run it.', '程式碼已修改，執行前請先按「套用程式碼」。'],
  codeApplied: ['Code applied. Your cards now match the code.', '程式碼已套用，程式卡和程式碼一致了。'],
  codeReset: ['Code reset from your blocks.', '已從積木重設程式碼。'],
  equipped: ['Loadout changed.', '裝備配置已更換。'], lockedLevel: ['Clear the previous quest to unlock this one.', '先完成上一關，就能解鎖這一關。'], towerLocked: ['Clear eight quests to unlock the Infinite Tower.', '完成八個關卡，就能解鎖無限高塔。'], paused: ['Paused.', '已暫停。']
});

/* Stickers (simple-cards D1): words on a sticker in the program row, and the picker's longer
   "only if" words. Every if* card in strip-edit.js IF_TESTS has a short line here. */
/* Picker tabs (simple-cards D7): groups follow the card colours (opCategory). */
export const PICKER = Object.freeze({
  walk: ['Walk', '走路'], fight: ['Fight', '戰鬥'], use: ['Use', '使用'], care: ['Care', '照顧'], friend: ['Friend', '夥伴'], stickers: ['Stickers', '貼紙']
});

export const STICKER = Object.freeze({
  times: n => [n + ' times', n + ' 次'],
  onlyIf: test => ['only if: ' + (CONDITIONS[test] || [test])[0], '只有在：' + (CONDITIONS[test] || [test, test])[1]],
  short: Object.freeze({
    enemyAhead: ['if enemy', '如果有敵人'], enemyArmoredAhead: ['if armored', '如果有盔甲'], enemyWeakAhead: ['if weak', '如果敵人虛弱'],
    dangerIncoming: ['if danger', '如果有危險'], heroPoisoned: ['if poisoned', '如果中毒'], chestAhead: ['if chest', '如果有寶箱'],
    doorAhead: ['if door', '如果有門'], trapAhead: ['if trap', '如果有陷阱'], hasKey: ['if key', '如果有鑰匙'], hpLow: ['if hurt', '如果受傷'],
    multipleEnemies: ['if many foes', '如果敵人很多'], targetInRange: ['if in range', '如果打得到'], targetWeak: ['if target weak', '如果目標虛弱'],
    targetElementWeak: ['if weak spot', '如果有弱點'], leverAhead: ['if lever', '如果有拉桿'], breakableAhead: ['if breakable', '如果可以打破'],
    npcAhead: ['if guide', '如果有嚮導'], runeGateAhead: ['if rune gate', '如果有符文閘門'], pushableAhead: ['if block', '如果有方塊'],
    cycleTrapAhead: ['if clock trap', '如果有循環陷阱'], cycleTrapActiveAhead: ['if trap is on', '如果陷阱啟動'], platformAhead: ['if platform', '如果有平台'],
    onPlatform: ['if on platform', '如果在平台上'], questTokenAhead: ['if token', '如果有符記'], companionNear: ['if friend near', '如果夥伴在旁邊'],
    carryableAhead: ['if core', '如果有核心'], heroCarrying: ['if carrying', '如果拿著核心'], heroOnPlate: ['if on plate', '如果在壓力板上'],
    companionCarryableAhead: ['if core by friend', '如果夥伴前有核心'], companionCarrying: ['if friend carries', '如果夥伴拿著核心'],
    companionOnPlate: ['if friend on plate', '如果夥伴在壓力板上']
  })
});

/* Rune coach, shown once per kid (facing-and-rune D10). */
export const COACH = Object.freeze({
  rune1: ['This is your Rune — your own card. The cards inside it run together.', '這是你的符文——你自己的卡片。放在裡面的卡片會一起執行。'],
  rune2: ['Build it once here.', '先在這裡做一次。'],
  rune3: ['Then use it again and again from Main.', '然後在主程式裡一用再用。'],
  runeRow: ['Cards in the Rune row run every time the hero reaches a 🪨 card.', '每次英雄走到 🪨 卡片，符文那一排的卡片就會執行。'],
  next: ['Next ›', '下一步 ›'], done: ['Got it', '知道了'], title: ['Rune tips', '符文小提示']
});

/* Quest card at entry (quest-clarity D2, D5). */
export const BRIEF = Object.freeze({
  toWin: ['To win', '過關條件'], needs: ['This quest needs', '這一關需要'], practise: ["You'll practise", '你會練習'],
  start: ['Start', '開始'], label: ['Quest card', '任務卡'],
  easy: ['Easy', '簡單'], medium: ['Medium', '中等'], hard: ['Hard', '困難']
});

/* A refused Run names the whole rule and what is still missing (quest-clarity D3). */
export const NEEDS = Object.freeze({
  all: chips => ['This quest needs ' + chips[0] + '.', '這一關需要 ' + chips[1] + '。'],
  missing: chips => [' Still missing: ' + chips[0] + '.', '還差：' + chips[1] + '。'],
  heroRow: [' Put the 🪨 card in the Hero row.', '把 🪨 卡片放到英雄那一排。']
});

/* The win card explains the skill (quest-clarity D8). */
export const WIN = Object.freeze({
  used: chips => ['You used ' + chips[0] + '.', '你用了 ' + chips[1] + '。'],
  practised: chips => ['You practised: ' + chips[0] + '.', '你練習了：' + chips[1] + '。'],
  next: (title, chips) => ['Next: ' + title[0] + (chips ? ' — ' + chips[0] : '') + '.', '下一關：' + title[1] + (chips ? '——' + chips[1] : '') + '。']
});

/* Which way the hero faces, in screen words (facing-and-rune D3; screen reader only). */
export const FACING = Object.freeze({
  N: ['Facing up', '面向上方'], S: ['Facing down', '面向下方'], W: ['Facing left', '面向左邊'], E: ['Facing right', '面向右邊']
});

/* Laboratory of Curiosity screen (lab design D1, D8, D12; slice 04). The owl's lines are
   one short sentence each and never call a mix wrong. */
export const LAB = Object.freeze({
  open: ['Lab', '實驗室'], back: ['‹ Dungeon', '‹ 地下城'], title: ['Laboratory of Curiosity', '好奇實驗室'],
  openFromCamp: ['Brew in the Lab →', '到實驗室釀造 →'],
  welcome: ['Welcome to the Lab! Put something in the cauldron and see what happens.', '歡迎來到實驗室！放點東西到鍋子裡，看看會發生什麼事。'],
  picked: ['Now tap the cauldron to drop it in.', '現在點一下鍋子，把它放進去。'],
  dropIn: ['Drop in', '放進去'],
  full: ['The cauldron is full — try Brew!', '鍋子滿了——試試釀造！'],
  empty: ['Put something in the cauldron first!', '先放點東西到鍋子裡！'],
  orderHint: ['So close — the order matters…', '好接近了——順序很重要……'],
  practice: ['Not enough in your bag, so this was a practice brew.', '背包裡的材料不夠，這次是練習釀造。'],
  newPage: ['New page!', '新的一頁！'],
  scriptLocked: ['Clear more quests to unlock the potion scroll.', '再多完成幾關，就能打開藥水卷軸。'],
  cauldron: ['Cauldron', '鍋子'], steps: ['Steps', '步驟'], noSteps: ['Tap a tool to add a step', '點工具就能加入步驟'],
  takeOut: ['Take out', '拿出來'], undoStep: ['Undo step', '撤銷步驟'], clear: ['Clear', '清空'], brew: ['Brew', '釀造'],
  scriptRecipes: ['Load a recipe you know', '載入你知道的配方'],
  // Curiosity Journal sheet (slice 06).
  journal: ['Curiosity Journal', '好奇日誌'], tabReactions: ['Reactions', '反應'], tabPotions: ['Potions', '藥水'], tabIngredients: ['Ingredients', '材料'],
  notFound: ['Not found yet', '還沒發現'], putIn: ['Put in cauldron', '放進鍋子'], ready: ['Ready — tap Brew!', '準備好了——按釀造！'],
  unseen: ['Use it in a reaction to learn its powers.', '用它做一次反應，就能知道它的力量。'], shelf: ['Shelf', '架子'], bag: ['Bag', '背包'],
  // Phase 2 ingredient states (lab-states slice 03).
  freshHint: ['That recipe likes its ingredients fresh!', '這個配方要用新鮮的材料！'],
  pickToChange: ['Tap a tool to change it, or the cauldron to drop it in.', '點工具可以改變它，點鍋子就放進去。']
});
/* Ingredient states (lab-states D2). Names read before the ingredient: "Frozen Moon Berry", 「冰凍的月光莓」. */
export const LAB_STATE_NAMES = Object.freeze({
  crushed: ['Crushed', '碾碎的'], heated: ['Heated', '加熱過的'], frozen: ['Frozen', '冰凍的']
});
/** An ingredient's name in a state, e.g. Frozen Red Mushroom / 冰凍的紅蘑菇 (fresh: just the name). */
export function labFormName(label, state) {
  const name = LAB_STATE_NAMES[state];
  return name ? [`${name[0]} ${label[0]}`, `${name[1]}${label[1]}`] : label;
}
/* Property and reaction-family names for the Journal's icon formulas. */
export const LAB_PROPS = Object.freeze({
  life: ['Life', '生命'], growth: ['Growth', '生長'], fire: ['Fire', '火'], cold: ['Cold', '寒冷'], water: ['Water', '水'],
  echo: ['Echo', '回音'], space: ['Space', '空間'], time: ['Time', '時間'], light: ['Light', '光'], chaos: ['Chaos', '混亂'], calm: ['Calm', '平靜']
});
export const LAB_FAMILIES = Object.freeze({
  reality: ['Reality', '現實'], instability: ['Instability', '不穩定'], time: ['Time', '時間'], space: ['Space', '空間'],
  creature: ['Creature', '生物'], replication: ['Copying', '複製'], biological: ['Plants', '植物'], elemental: ['Elements', '元素'],
  light: ['Light', '光'], fallback: ['Everyday', '日常']
});
/** Owl line after a potion is bottled. */
export function labMadeLine(potionLabel) {
  return [`You made a ${potionLabel[0]}!`, `你做出了${potionLabel[1]}！`];
}
/** Owl line when the Journal book is tapped (the page sheet itself is slice 06). */
export function labPagesLine(found, total) {
  return [`Your Journal has ${found} of ${total} reactions.`, `你的日誌已經有 ${found}／${total} 種反應。`];
}

/* Short one-word card labels for the program strip and command library (redesign D4). */
export const SHORT = Object.freeze({
  move: ['Move', '前進'], turnLeft: ['Left', '左轉'], turnRight: ['Right', '右轉'], attack: ['Attack', '攻擊'], heavyAttack: ['Heavy', '重擊'],
  guard: ['Guard', '防禦'], open: ['Open', '打開'], disarm: ['Disarm', '拆除'], usePotion: ['Heal', '治療'], useAntidote: ['Antidote', '解毒'],
  useWard: ['Ward', '守護'], wait: ['Wait', '等待'], targetNearest: ['Nearest', '最近'], targetWeakest: ['Weakest', '最弱'],
  targetArmored: ['Armored', '裝甲'], targetElementWeak: ['Weakness', '弱點'], cast: ['Cast', '施法'], interact: ['Use', '互動'],
  smash: ['Smash', '擊破'], push: ['Push', '推'], take: ['Take', '拿起'], throw: ['Throw', '投擲'],
  companionFollow: ['Follow', '跟隨'], companionHold: ['Hold', '待命'], companionGuard: ['Guard', '守護'], companionAssist: ['Assist', '協助'],
  companionMove: ['Move', '前進'], companionTurnLeft: ['Left', '左轉'], companionTurnRight: ['Right', '右轉'], companionInteract: ['Use', '互動'],
  companionPush: ['Push', '推'], companionTake: ['Take', '拿起'], companionThrow: ['Throw', '投擲'],
  repeat: ['Repeat', '重複'], if: ['If', '如果'], call: ['Rune', '符文'], else: ['else', '否則']
});

/* One language on screen at a time (redesign D5, Kitchen Quest pattern). Every string
   still ships EN + 中文; the host-bar switch picks which one is shown, saved per kid. */
let LANG = 'en';
export function setLanguage(lang) { LANG = lang === 'zh' ? 'zh' : 'en'; return LANG; }
export function language() { return LANG; }
export function t([en, zh]) { return LANG === 'zh' ? zh : en; }
export function pairHTML([en, zh]) {
  return LANG === 'zh' ? '<span lang="zh-Hant">' + zh + '</span>' : '<span lang="en">' + en + '</span>';
}
