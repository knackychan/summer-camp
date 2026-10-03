import { action as A, targetNode as T, repeat as R, ifNode as IF, call as CALL, letNode as LET, returnNode as RET, forOfNode as FOR, onNode as ON, signalNode as SIG, stateNode as STATE, literal as L, propertyRef as P, variableRef as V, memberRef as M, binary as B } from './ast.js';

const region = (id, en, zh) => Object.freeze({ id, label: Object.freeze([en, zh]) });
export const REGIONS = Object.freeze({
  trail: region('trail', 'Trail of Steps', '步驟小徑'),
  echo: region('echo', 'Echo Caves', '回音洞窟'),
  gate: region('gate', 'Gatewood', '判斷森林'),
  forge: region('forge', 'Function Forge', '函式鍛造坊'),
  crypt: region('crypt', 'Clockwork Crypt', '機關地窖'),
  bastion: region('bastion', 'Signal Bastion', '訊號堡壘'),
  scriptorium: region('scriptorium', 'Rune Scriptorium', '符文書庫'),
  vault: region('vault', 'Algorithm Vault', '演算法寶庫'),
  nexus: region('nexus', 'Element Nexus', '元素樞紐'),
  relic: region('relic', 'Relic Foundry', '遺物鑄造所'),
  mechanism: region('mechanism', 'Mechanism Depths', '機關深層'),
  logicworks: region('logicworks', 'Logic Labyrinth', '邏輯迷宮'),
  coop: region('coop', 'Twin Core Citadel', '雙核心城塞'),
  signalworks: region('signalworks', 'Signal Foundry', '訊號鑄造所'),
  protocol: region('protocol', 'Protocol Citadel', '協定城塞'),
  tower: region('tower', 'Infinite Tower', '無限高塔')
});

function freezeLevel(level) {
  return Object.freeze({
    ...level,
    title: Object.freeze(level.title),
    objectiveText: Object.freeze(level.objectiveText),
    map: Object.freeze([...level.map]),
    ...(Array.isArray(level.movingPlatforms) ? { movingPlatforms:Object.freeze(level.movingPlatforms.map(item=>Object.freeze({ ...item, path:Object.freeze((item.path||[]).map(point=>Object.freeze({ ...point }))) }))) } : {}),
    available: Object.freeze({
      actions: Object.freeze([...(level.available.actions || [])]),
      logic: Object.freeze([...(level.available.logic || [])])
    }),
    requires: Object.freeze([...(level.requires || [])]),
    objective: Object.freeze({ ...(level.objective || {}) }),
    reward: Object.freeze({ ...(level.reward || {}), ingredients: Object.freeze({ ...((level.reward && level.reward.ingredients) || {}) }), potions: Object.freeze({ ...((level.reward && level.reward.potions) || {}) }) }),
    reference: Object.freeze({ main: level.reference.main, functions: Object.freeze({ ...(level.reference.functions || {}) }) })
  });
}

const BASIC = ['move', 'turnLeft', 'turnRight'];
const RPG = ['attack', 'heavyAttack', 'guard', 'open', 'disarm', 'usePotion', 'useAntidote', 'useWard', 'wait'];
const PARTY = ['targetNearest', 'targetWeakest', 'targetArmored', 'targetElementWeak', 'cast'];
const WORLD = ['interact', 'smash', 'push', 'take', 'throw'];
const COMPANION = ['companionFollow','companionHold','companionGuard','companionAssist','companionMove','companionTurnLeft','companionTurnRight','companionInteract','companionPush','companionTake','companionThrow'];
const LOGIC_CORE = ['repeat2', 'repeat3', 'repeat5', 'ifEnemy', 'ifArmored', 'ifWeak', 'ifDanger', 'ifPoisoned', 'ifChest', 'ifDoor', 'ifTrap', 'ifKey', 'ifHpLow', 'callRune'];
const LOGIC_WORLD = ['ifLever', 'ifBreakable', 'ifNpc', 'ifRuneGate', 'ifPushable', 'ifCycleTrap', 'ifCycleTrapActive', 'ifPlatform', 'ifOnPlatform', 'ifQuestToken', 'ifCompanionNear', 'ifCarryable', 'ifHeroCarrying', 'ifHeroOnPlate', 'ifCompanionCarryable', 'ifCompanionCarrying', 'ifCompanionOnPlate'];

export const LEVELS = Object.freeze([
  freezeLevel({
    id: 'q01', region: REGIONS.trail, title: ['First Rune', '第一個符文'], concept: ['Sequence', '順序'],
    objectiveText: ['Reach the glowing exit.', '走到發光出口。'],
    map: ['########', '#H..E..#', '#......#', '########'], heroDir: 'E',
    objective: { reachExit: true }, available: { actions: BASIC, logic: [] }, requires: [], maxBlocks: 5, parBlocks: 3,
    reward: { ingredients: { sunHerb: 1 }, lootFound: 1 },
    reference: { main: [A('move'), A('move'), A('move')], functions: {} }
  }),
  freezeLevel({
    id: 'q02', region: REGIONS.trail, title: ['Turn the Corner', '轉過彎道'], concept: ['Direction', '方向'],
    objectiveText: ['Follow the corridor to the exit.', '沿著走廊走到出口。'],
    map: ['#######', '#H..###', '###.###', '###E###', '#######'], heroDir: 'E',
    objective: { reachExit: true }, available: { actions: BASIC, logic: [] }, requires: [], maxBlocks: 7, parBlocks: 5,
    reward: { ingredients: { waterCrystal: 1 }, lootFound: 1 },
    reference: { main: [A('move'), A('move'), A('turnRight'), A('move'), A('move')], functions: {} }
  }),
  freezeLevel({
    id: 'q03', region: REGIONS.trail, title: ['Treasure Tap', '寶箱指令'], concept: ['Action', '動作'],
    objectiveText: ['Stand beside the chest and open it.', '站到寶箱旁邊並打開它。'],
    map: ['########', '#H..C..#', '#......#', '########'], heroDir: 'E',
    objective: { openAllChests: true }, available: { actions: BASIC.concat(['open']), logic: [] }, requires: [], maxBlocks: 5, parBlocks: 3,
    reward: { ingredients: { sunHerb: 2 }, lootFound: 2 },
    reference: { main: [A('move'), A('move'), A('open')], functions: {} }
  }),
  freezeLevel({
    id: 'q04', region: REGIONS.trail, title: ['Slime Scout', '史萊姆偵察'], concept: ['Combat', '戰鬥'],
    objectiveText: ['Move close and defeat the slime.', '靠近並打敗史萊姆。'],
    map: ['#######', '#H.S..#', '#.....#', '#######'], heroDir: 'E',
    objective: { defeatAll: true }, available: { actions: BASIC.concat(['attack']), logic: [] }, requires: [], maxBlocks: 4, parBlocks: 2,
    reward: { ingredients: { moonBerry: 1 }, lootFound: 1 },
    reference: { main: [A('move'), A('attack')], functions: {} }
  }),
  freezeLevel({
    id: 'q05', region: REGIONS.echo, title: ['Echo Hall', '回音長廊'], concept: ['Repeat', '重複'],
    objectiveText: ['Use Repeat to cross the long hall.', '用「重複」穿過長廊。'],
    map: ['#########', '#H....E.#', '#.......#', '#########'], heroDir: 'E',
    objective: { reachExit: true }, available: { actions: BASIC, logic: ['repeat2', 'repeat3', 'repeat5'] }, requires: ['repeat'], maxBlocks: 3, parBlocks: 2,
    reward: { ingredients: { sunHerb: 1, waterCrystal: 1 }, lootFound: 2 },
    reference: { main: [R(5, [A('move')])], functions: {} }
  }),
  freezeLevel({
    id: 'q06', region: REGIONS.echo, title: ['Treasure Rhythm', '寶箱節奏'], concept: ['Loop + action', '迴圈＋動作'],
    objectiveText: ['Repeat the walk, then open the chest.', '重複走路，再打開寶箱。'],
    map: ['#########', '#H...C..#', '#.......#', '#########'], heroDir: 'E',
    objective: { openAllChests: true }, available: { actions: BASIC.concat(['open']), logic: ['repeat2', 'repeat3', 'repeat5'] }, requires: ['repeat'], maxBlocks: 4, parBlocks: 3,
    reward: { ingredients: { moonBerry: 1, waterCrystal: 1 }, lootFound: 2 },
    reference: { main: [R(3, [A('move')]), A('open')], functions: {} }
  }),
  freezeLevel({
    id: 'q07', region: REGIONS.gate, title: ['Look Before You Strike', '先看再出招'], concept: ['If', '如果'],
    objectiveText: ['Use IF to check the path, defeat the slime, then reach the exit.', '用「如果」檢查前方，打敗史萊姆後走到出口。'],
    map: ['#######', '#HS.E.#', '#.....#', '#######'], heroDir: 'E',
    objective: { defeatAll: true, reachExit: true }, available: { actions: BASIC.concat(['attack']), logic: ['repeat2', 'repeat3', 'ifEnemy'] }, requires: ['if'], maxBlocks: 5, parBlocks: 4,
    reward: { ingredients: { sunHerb: 1, moonBerry: 1 }, lootFound: 2 },
    reference: { main: [IF('enemyAhead', [A('attack')]), R(3, [A('move')])], functions: {} }
  }),
  freezeLevel({
    id: 'q08', region: REGIONS.gate, title: ['Goblin Chest', '哥布林寶箱'], concept: ['Combat loop', '戰鬥迴圈'],
    objectiveText: ['Defeat the goblin and open the chest.', '打敗哥布林並打開寶箱。'],
    map: ['#######', '#HGC..#', '#.....#', '#######'], heroDir: 'E',
    objective: { defeatAll: true, openAllChests: true }, available: { actions: BASIC.concat(RPG), logic: ['repeat2', 'repeat3', 'ifEnemy', 'ifChest'] }, requires: ['repeat'], maxBlocks: 6, parBlocks: 4,
    reward: { equipment: 'bronzeBlade', ingredients: { waterCrystal: 1 }, lootFound: 3 },
    reference: { main: [R(2, [A('attack')]), A('move'), A('open')], functions: {} }
  }),
  freezeLevel({
    id: 'q09', region: REGIONS.gate, title: ['Potion Logic', '藥水邏輯'], concept: ['Condition + state', '條件＋狀態'],
    objectiveText: ['Check your health, heal, and defeat the goblin.', '檢查生命值，治療後打敗哥布林。'],
    map: ['#######', '#HG...#', '#.....#', '#######'], heroDir: 'E', heroHp: 2, practicePotions: 1,
    objective: { defeatAll: true, minHp: 4 }, available: { actions: BASIC.concat(RPG), logic: ['repeat2', 'repeat3', 'ifEnemy', 'ifHpLow'] }, requires: ['if'], maxBlocks: 5, parBlocks: 4,
    reward: { ingredients: { sunHerb: 2, waterCrystal: 1 }, lootFound: 3 },
    reference: { main: [IF('hpLow', [A('usePotion')]), R(2, [A('attack')])], functions: {} }
  }),
  freezeLevel({
    id: 'q10', region: REGIONS.forge, title: ['Function Forge', '函式鍛造坊'], concept: ['Function', '函式'],
    objectiveText: ['Build Rune as a reusable dash and call it twice.', '把「符文」做成可重複使用的衝刺函式，呼叫兩次。'],
    map: ['#######', '#H..###', '###.###', '###E###', '#######'], heroDir: 'E',
    objective: { reachExit: true }, available: { actions: BASIC, logic: ['repeat2', 'repeat3', 'callRune'] }, requires: ['call'], maxBlocks: 6, parBlocks: 5,
    reward: { ingredients: { moonBerry: 2, waterCrystal: 1 }, lootFound: 3 },
    reference: { main: [CALL('rune'), A('turnRight'), CALL('rune')], functions: { rune: [R(2, [A('move')])] } }
  }),
  freezeLevel({
    id: 'q11', region: REGIONS.forge, title: ['Reusable Strike', '重複使用攻擊'], concept: ['Reuse', '重複使用'],
    objectiveText: ['Create one strike routine and use it on both goblins.', '做一個攻擊函式，對兩隻哥布林重複使用。'],
    map: ['#######', '#HGG..#', '#.....#', '#######'], heroDir: 'E',
    objective: { defeatAll: true }, available: { actions: BASIC.concat(['attack']), logic: ['repeat2', 'repeat3', 'ifEnemy', 'callRune'] }, requires: ['call'], maxBlocks: 7, parBlocks: 5,
    reward: { ingredients: { sunHerb: 1, emberRoot: 1 }, lootFound: 3 },
    reference: { main: [CALL('rune'), A('move'), CALL('rune')], functions: { rune: [R(2, [A('attack')])] } }
  }),
  freezeLevel({
    id: 'q12', region: REGIONS.forge, title: ['Loop Golem', '迴圈魔像'], concept: ['Compose', '組合程式'],
    objectiveText: ['Defeat the golem, open its chest, and escape.', '打敗魔像、打開寶箱並走到出口。'],
    map: ['########', '#HOCE..#', '#......#', '########'], heroDir: 'E',
    objective: { defeatAll: true, openAllChests: true, reachExit: true }, available: { actions: BASIC.concat(RPG, PARTY), logic: LOGIC_CORE }, requires: ['call', 'repeat'], maxBlocks: 9, parBlocks: 7,
    reward: { equipment: 'clockworkBlade', ingredients: { emberRoot: 2, moonBerry: 1 }, lootFound: 5 },
    reference: { main: [CALL('rune'), A('move'), A('open'), R(2, [A('move')])], functions: { rune: [R(4, [A('attack')])] } }
  }),
  freezeLevel({
    id: 'q13', region: REGIONS.crypt, title: ['Key Crypt', '鑰匙地窖'], concept: ['State + lock', '狀態＋鎖'],
    objectiveText: ['Pick up the key, unlock the door, and reach the exit.', '拿到鑰匙、解鎖門，再走到出口。'],
    map: ['##########', '#HKD...E.#', '#........#', '##########'], heroDir: 'E',
    objective: { collectAllKeys: true, unlockAllDoors: true, reachExit: true },
    available: { actions: BASIC.concat(['open']), logic: ['repeat2', 'repeat3', 'repeat5', 'ifDoor', 'ifKey'] }, requires: ['repeat'], maxBlocks: 7, parBlocks: 5,
    reward: { ingredients: { waterCrystal: 1, emberRoot: 1 }, lootFound: 4 },
    reference: { main: [A('move'), A('open'), A('move'), R(4, [A('move')])], functions: {} }
  }),
  freezeLevel({
    id: 'q14', region: REGIONS.crypt, title: ['Spike Logic', '尖刺邏輯'], concept: ['Hazard condition', '危險條件'],
    objectiveText: ['Check for the floor trap, disarm it, and cross safely.', '檢查地板陷阱、解除它，再安全通過。'],
    map: ['##########', '#H.^...E.#', '#........#', '##########'], heroDir: 'E',
    objective: { disarmAllTraps: true, reachExit: true, minHp: 5 },
    available: { actions: BASIC.concat(['disarm']), logic: ['repeat2', 'repeat3', 'repeat5', 'ifTrap'] }, requires: ['if'], maxBlocks: 7, parBlocks: 5,
    reward: { ingredients: { sunHerb: 1, emberRoot: 2 }, lootFound: 4 },
    reference: { main: [A('move'), IF('trapAhead', [A('disarm')]), R(5, [A('move')])], functions: {} }
  }),
  freezeLevel({
    id: 'q15', region: REGIONS.crypt, title: ['Dungeon Algorithm', '地下城演算法'], concept: ['Compose dungeon logic', '組合地下城邏輯'],
    objectiveText: ['Use everything: key, lock, combat, trap, treasure, and exit.', '結合鑰匙、門鎖、戰鬥、陷阱、寶箱與出口。'],
    map: ['############', '#HKD.G^C.E.#', '#..........#', '############'], heroDir: 'E',
    objective: { collectAllKeys: true, unlockAllDoors: true, defeatAll: true, disarmAllTraps: true, openAllChests: true, reachExit: true },
    available: { actions: BASIC.concat(RPG, PARTY, WORLD, COMPANION), logic: LOGIC_CORE.concat(LOGIC_WORLD) }, requires: ['repeat', 'if'], maxBlocks: 17, parBlocks: 14,
    reward: { ingredients: { sunHerb: 1, moonBerry: 1, waterCrystal: 1, emberRoot: 1 }, lootFound: 7 },
    reference: {
      main: [A('move'), A('open'), R(2, [A('move')]), R(2, [A('attack')]), A('move'), IF('trapAhead', [A('disarm')]), A('move'), A('open'), A('move'), R(2, [A('move')])],
      functions: {}
    }
  }),
  freezeLevel({
    id: 'q16', region: REGIONS.bastion, title: ['Armor Protocol', '裝甲協定'], concept: ['Read enemy state', '讀取敵人狀態'],
    objectiveText: ['Detect armor, use Heavy Attack, then cross the room.', '偵測裝甲、使用重擊，再穿過房間。'],
    map: ['########', '#HB.E..#', '#......#', '########'], heroDir: 'E',
    objective: { defeatAll: true, reachExit: true },
    available: { actions: BASIC.concat(['attack', 'heavyAttack']), logic: ['repeat2', 'repeat3', 'ifEnemy', 'ifArmored'] }, requires: ['if', 'repeat'], maxBlocks: 7, parBlocks: 5,
    reward: { equipment: 'guardCape', ingredients: { emberRoot: 1, waterCrystal: 1 }, lootFound: 5 },
    reference: { main: [R(2, [IF('enemyArmoredAhead', [A('heavyAttack')])]), R(3, [A('move')])], functions: {} }
  }),
  freezeLevel({
    id: 'q17', region: REGIONS.bastion, title: ['Venom Check', '毒素檢查'], concept: ['Status condition', '狀態條件'],
    objectiveText: ['If poisoned, use the antidote. Then defeat the viper.', '如果中毒就使用解毒藥水，再打敗毒蛇。'],
    map: ['#######', '#HV...#', '#.....#', '#######'], heroDir: 'E', heroPoison: 2, practiceAntidotes: 1,
    objective: { defeatAll: true, finishUnpoisoned: true },
    available: { actions: BASIC.concat(['attack', 'useAntidote']), logic: ['repeat2', 'ifEnemy', 'ifPoisoned'] }, requires: ['if'], maxBlocks: 6, parBlocks: 4,
    reward: { potions: { antidote: 1 }, ingredients: { moonBerry: 2, emberRoot: 1 }, lootFound: 5 },
    reference: { main: [IF('heroPoisoned', [A('useAntidote')]), R(2, [A('attack')])], functions: {} }
  }),
  freezeLevel({
    id: 'q18', region: REGIONS.bastion, title: ['Read the Signal', '讀取攻擊訊號'], concept: ['Intent + reusable turn program', '意圖＋重複回合程式'],
    objectiveText: ['Run the same turn program again. Guard whenever the archer signals a shot.', '重複執行同一個回合程式；弓手預告射擊時就防禦。'],
    map: ['#########', '#H....E.#', '#..A....#', '#########'], heroDir: 'E',
    objective: { reachExit: true, minHp: 5 },
    available: { actions: BASIC.concat(['guard']), logic: ['ifDanger'] }, requires: ['if'], maxBlocks: 4, parBlocks: 3,
    reward: { equipment: 'signalCharm', potions: { ward: 1 }, ingredients: { waterCrystal: 2 }, lootFound: 6 },
    reference: { main: [IF('dangerIncoming', [A('guard')]), A('move')], functions: {} }
  }),
  freezeLevel({
    id: 'q19', region: REGIONS.bastion, title: ['Venom Patrol', '毒蛇巡邏'], concept: ['Reactive routine', '反應式程式'],
    objectiveText: ['Keep moving. Attack when blocked by the viper and cure poison when it appears.', '持續前進；毒蛇擋路就攻擊，中毒就解毒。'],
    map: ['#########', '#H..V.E.#', '#.......#', '#########'], heroDir: 'E', practiceAntidotes: 2,
    objective: { defeatAll: true, reachExit: true, finishUnpoisoned: true },
    available: { actions: BASIC.concat(['attack', 'useAntidote']), logic: ['ifEnemy', 'ifPoisoned'] }, requires: ['if'], maxBlocks: 7, parBlocks: 5,
    reward: { equipment: 'alchemistApron', ingredients: { moonBerry: 2, emberRoot: 2 }, lootFound: 6 },
    reference: { main: [IF('heroPoisoned', [A('useAntidote')]), IF('enemyAhead', [A('attack')]), A('move')], functions: {} }
  }),
  freezeLevel({
    id: 'q20', region: REGIONS.bastion, title: ['Sentinel Engine', '哨兵引擎'], concept: ['Combat strategy', '戰鬥策略'],
    objectiveText: ['Use one reusable strategy for armor, enemy contact, incoming shots, and movement.', '用同一套策略處理裝甲、近身敵人、射擊預告與移動。'],
    map: ['##########', '#H.B.A.E.#', '#........#', '##########'], heroDir: 'E',
    objective: { defeatAll: true, reachExit: true, minHp: 2 },
    available: { actions: BASIC.concat(['attack', 'heavyAttack', 'guard']), logic: ['ifEnemy', 'ifArmored', 'ifDanger'] }, requires: ['if'], maxBlocks: 9, parBlocks: 7,
    reward: { potions: { ward: 1, antidote: 1 }, ingredients: { sunHerb: 1, moonBerry: 1, waterCrystal: 2, emberRoot: 2 }, lootFound: 8 },
    reference: { main: [IF('dangerIncoming', [A('guard')]), IF('enemyArmoredAhead', [A('heavyAttack')]), IF('enemyAhead', [A('attack')]), A('move')], functions: {} }
  }),
  freezeLevel({
    id: 'q21', region: REGIONS.scriptorium, title: ['Read the Spell', '讀懂程式咒文'], concept: ['Code bridge', '積木到程式碼'],
    objectiveText: ['Use the code view to read the same movement and combat plan as JavaScript.', '用程式碼畫面閱讀同一套移動與戰鬥計畫。'],
    map: ['##########', '#H..G..E.#', '#........#', '##########'], heroDir: 'E', codingView: 'hybrid',
    objective: { defeatAll: true, reachExit: true },
    available: { actions: BASIC.concat(['attack']), logic: ['repeat2', 'repeat3', 'ifEnemy', 'callRune'] }, requires: ['call'], maxBlocks: 9, parBlocks: 7,
    reward: { ingredients: { sunHerb: 1, moonBerry: 1, waterCrystal: 1 }, lootFound: 7 },
    reference: { main: [R(2, [A('move')]), CALL('strike'), R(4, [A('move')])], functions: { strike: [R(2, [A('attack')])] } }
  }),
  freezeLevel({
    id: 'q22', region: REGIONS.scriptorium, title: ['IF / ELSE Gate', '如果／否則之門'], concept: ['Else branch', '否則分支'],
    objectiveText: ['Write one rule: attack IF an enemy is ahead, ELSE move. Run the same code across turns.', '寫一條規則：前方有敵人就攻擊，否則前進；跨回合重複執行同一段程式。'],
    map: ['##########', '#H..G..E.#', '#........#', '##########'], heroDir: 'E', codingView: 'code',
    objective: { defeatAll: true, reachExit: true, minHp: 1 },
    available: { actions: BASIC.concat(['attack']), logic: ['ifEnemy'] }, requires: ['if', 'else'], maxBlocks: 5, parBlocks: 3,
    reward: { potions: { healing: 1 }, ingredients: { moonBerry: 2 }, lootFound: 7 },
    reference: { main: [IF('enemyAhead', [A('attack')], [A('move')])], functions: {} }
  }),
  freezeLevel({
    id: 'q23', region: REGIONS.scriptorium, title: ['Two Runes', '兩個自訂函式'], concept: ['Named functions', '自訂函式'],
    objectiveText: ['Define two small functions, then compose them to unlock, fight, and escape.', '定義兩個小函式，再組合它們完成解鎖、戰鬥與逃脫。'],
    map: ['############', '#HKD.G...E.#', '#..........#', '############'], heroDir: 'E', codingView: 'code',
    objective: { collectAllKeys: true, unlockAllDoors: true, defeatAll: true, reachExit: true },
    available: { actions: BASIC.concat(['open', 'attack']), logic: ['repeat2', 'repeat3', 'ifEnemy', 'ifDoor', 'callRune'] }, requires: ['call'], maxBlocks: 15, parBlocks: 10,
    reward: { ingredients: { emberRoot: 2, waterCrystal: 2 }, potions: { focus: 1 }, lootFound: 8 },
    reference: {
      main: [A('move'), CALL('unlock'), R(2, [A('move')]), CALL('strike'), R(4, [A('move')])],
      functions: { unlock: [A('open')], strike: [R(2, [A('attack')])] }
    }
  }),
  freezeLevel({
    id: 'q24', region: REGIONS.scriptorium, title: ['Dungeon Script', '地下城腳本'], concept: ['Written strategy', '文字程式策略'],
    objectiveText: ['Combine functions, IF/ELSE and repeat into one safe dungeon script.', '把函式、如果／否則與重複組成一個安全的地下城腳本。'],
    map: ['############', '#H.B.^C...E#', '#..........#', '############'], heroDir: 'E', codingView: 'code', practiceWards: 1,
    objective: { defeatAll: true, disarmAllTraps: true, openAllChests: true, reachExit: true, minHp: 1 },
    available: { actions: BASIC.concat(RPG, PARTY, WORLD, COMPANION), logic: LOGIC_CORE.concat(LOGIC_WORLD) }, requires: ['if', 'else', 'call'], maxBlocks: 18, parBlocks: 16,
    reward: { potions: { ward: 1, antidote: 1 }, ingredients: { sunHerb: 2, moonBerry: 2, waterCrystal: 2, emberRoot: 2 }, lootFound: 10 },
    reference: {
      main: [CALL('advance'), IF('enemyArmoredAhead', [A('heavyAttack')], [A('attack')]), CALL('advance'), CALL('advance'), IF('trapAhead', [A('disarm')], [A('wait')]), CALL('advance'), A('open'), R(5, [A('move')])],
      functions: { advance: [IF('blockedAhead', [A('wait')], [A('move')])] }
    }
  }),
  freezeLevel({
    id: 'q25', region: REGIONS.vault, title: ['Variable Steps', '變數步伐'], concept: ['Variables', '變數'],
    objectiveText: ['Store the corridor length in a variable, then use it to control Repeat.', '把走廊長度存進變數，再用變數控制重複次數。'],
    map: ['#########', '#H....E.#', '#.......#', '#########'], heroDir: 'E', codingView: 'code',
    objective: { reachExit: true }, available: { actions: BASIC, logic: ['repeat5'] }, requires: ['let'], maxBlocks: 7, parBlocks: 3,
    reward: { ingredients: { waterCrystal: 2, moonBerry: 1 }, lootFound: 7 },
    reference: { main: [LET('steps', L(5)), R(V('steps'), [A('move')])], functions: {} }
  }),
  freezeLevel({
    id: 'q26', region: REGIONS.vault, title: ['Parameter Passage', '參數通道'], concept: ['Parameters', '參數'],
    objectiveText: ['Pass a number into a reusable walk function and return how far it walked.', '把數字傳入可重複使用的走路函式，並回傳走了多遠。'],
    map: ['#########', '#H...C..#', '#.......#', '#########'], heroDir: 'E', codingView: 'code',
    objective: { openAllChests: true }, available: { actions: BASIC.concat(['open']), logic: ['repeat3', 'callRune'] }, requires: ['params', 'arguments', 'return'], maxBlocks: 10, parBlocks: 5,
    reward: { ingredients: { sunHerb: 2, waterCrystal: 1 }, potions: { focus: 1 }, lootFound: 8 },
    reference: {
      main: [CALL('walk', undefined, [L(3)], 'moved'), A('open')],
      functions: { walk: { params: ['steps'], body: [R(V('steps'), [A('move')]), RET(V('steps'))] } }
    }
  }),
  freezeLevel({
    id: 'q27', region: REGIONS.vault, title: ['Return Gate', '回傳之門'], concept: ['Return values', '回傳值'],
    objectiveText: ['Use a returned value in a comparison before opening the treasure.', '把函式回傳值拿來比較，再決定是否打開寶箱。'],
    map: ['#########', '#H...C..#', '#.......#', '#########'], heroDir: 'E', codingView: 'code',
    objective: { openAllChests: true }, available: { actions: BASIC.concat(['open']), logic: ['repeat3', 'callRune'] }, requires: ['return', 'expression', 'if'], maxBlocks: 12, parBlocks: 6,
    reward: { ingredients: { moonBerry: 2, emberRoot: 1 }, lootFound: 8 },
    reference: {
      main: [CALL('walk', undefined, [L(3)], 'moved'), IF(B('>=', V('moved'), L(3)), [A('open')])],
      functions: { walk: { params: ['steps'], body: [R(V('steps'), [A('move')]), RET(V('steps'))] } }
    }
  }),
  freezeLevel({
    id: 'q28', region: REGIONS.vault, title: ['Inspect the Enemy', '讀取敵人狀態'], concept: ['Object properties', '物件屬性'],
    objectiveText: ['Read enemy.hp and hero.weapon.damage to calculate how many attacks are needed.', '讀取 enemy.hp 與 hero.weapon.damage，算出需要攻擊幾次。'],
    map: ['##########', '#H.G...E.#', '#........#', '##########'], heroDir: 'E', codingView: 'code',
    objective: { defeatAll: true, reachExit: true }, available: { actions: BASIC.concat(['attack']), logic: ['repeat5'] }, requires: ['let', 'property'], maxBlocks: 10, parBlocks: 6,
    reward: { ingredients: { emberRoot: 2, waterCrystal: 2 }, lootFound: 9 },
    reference: { main: [A('move'), LET('hits', B('/', P('enemy.hp'), P('hero.weapon.damage'))), R(V('hits'), [A('attack')]), R(L(5), [A('move')])], functions: {} }
  }),
  freezeLevel({
    id: 'q29', region: REGIONS.vault, title: ['Inventory Logic', '背包邏輯'], concept: ['State + boolean logic', '狀態＋布林邏輯'],
    objectiveText: ['Read HP and potion inventory, heal only when both conditions say it is useful, then escape.', '讀取生命與藥水數量，只有兩個條件都成立時才治療，再離開房間。'],
    map: ['########', '#H...E.#', '#......#', '########'], heroDir: 'E', heroHp: 2, practicePotions: 1, codingView: 'code',
    objective: { reachExit: true, minHp: 3 }, available: { actions: BASIC.concat(['usePotion']), logic: ['repeat3'] }, requires: ['property', 'expression', 'if'], maxBlocks: 9, parBlocks: 4,
    reward: { potions: { healing: 1, ward: 1 }, ingredients: { sunHerb: 2, waterCrystal: 2 }, lootFound: 9 },
    reference: { main: [IF(B('&&', B('<=', P('hero.hp'), L(2)), B('>', P('hero.inventory.healing'), L(0))), [A('usePotion')]), R(L(4), [A('move')])], functions: {} }
  }),
  freezeLevel({
    id: 'q30', region: REGIONS.vault, title: ['Rune Warden', '符文守衛'], concept: ['Boss algorithm', '頭目演算法'],
    objectiveText: ["Write one reusable algorithm for the Warden's armor, telegraphed shot, changing HP, and final escape.", '寫一套可重複使用的演算法，處理守衛的裝甲、射擊預告、生命變化與最後逃脫。'],
    map: ['########', '#HW...E#', '#......#', '########'], heroDir: 'E', practicePotions: 1, codingView: 'code',
    objective: { defeatAll: true, reachExit: true, minHp: 1 }, available: { actions: BASIC.concat(['attack','heavyAttack','guard','usePotion']), logic: LOGIC_CORE }, requires: ['params','arguments','return','let','property','expression','if'], maxBlocks: 22, parBlocks: 12,
    reward: { equipment: 'wardenCrest', potions: { focus: 1, ward: 1 }, ingredients: { sunHerb: 2, moonBerry: 2, waterCrystal: 2, emberRoot: 2 }, lootFound: 15 },
    reference: {
      main: [LET('attacks', L(2)), IF(P('enemy.incoming'), [A('guard')]), CALL('strike', undefined, [V('attacks')], 'used'), IF(B('===', P('enemy.hp'), L(0)), [R(L(5), [A('move')])])],
      functions: { strike: { params: ['times'], body: [R(V('times'), [IF(B('>', P('enemy.armor'), L(0)), [A('heavyAttack')], [A('attack')])]), RET(V('times'))] } }
    }
  }),
  freezeLevel({
    id: 'q31', region: REGIONS.nexus, title: ['Enemy Collection', '敵人集合'], concept: ['Collection length', '集合長度'],
    objectiveText: ['Read enemies.length once, then use the value to clear two guardians and reach the exit.', '先讀取 enemies.length，再用這個值清除兩名守衛並走到出口。'],
    map: ['############', '#H.S.G..E..#', '#..........#', '############'], heroDir: 'E', codingView: 'code',
    objective: { defeatAll: true, reachExit: true }, available: { actions: BASIC.concat(['attack']), logic: ['repeat2','repeat3','repeat5'] },
    requires: ['let','property','repeat'], maxBlocks: 12, parBlocks: 7,
    reward: { ingredients: { emberRoot: 2, waterCrystal: 1 }, lootFound: 10 },
    reference: { main: [LET('foes', P('enemies.length')), R(V('foes'), [A('move'), A('attack'), A('move')]), R(L(3), [A('move')])], functions: {} }
  }),
  freezeLevel({
    id: 'q32', region: REGIONS.nexus, title: ['Indexed Target', '索引目標'], concept: ['Array index + target', '陣列索引＋目標'],
    objectiveText: ['Inspect enemies[0].hp, select that collection item with hero.target(0), and cast from range.', '讀取 enemies[0].hp，用 hero.target(0) 選取集合項目，再從遠處施法。'],
    map: ['###########', '#H......E.#', '#..G......#', '#.........#', '###########'], heroDir: 'E', codingView: 'code',
    practiceSpellDamage: 2, practiceRange: 5, practiceElement: 'neutral',
    objective: { defeatAll: true, reachExit: true }, available: { actions: BASIC.concat(PARTY), logic: ['repeat5'] },
    requires: ['let','property','target'], maxBlocks: 10, parBlocks: 6,
    reward: { equipment: 'emberWand', ingredients: { emberRoot: 2, moonBerry: 1 }, lootFound: 11 },
    reference: { main: [LET('hp', P('enemies.0.hp')), T(L(0)), R(V('hp'), [A('cast')]), R(L(7), [A('move')])], functions: {} }
  }),
  freezeLevel({
    id: 'q33', region: REGIONS.nexus, title: ['Element Match', '元素配對'], concept: ['Weakness + selection', '弱點＋選擇'],
    objectiveText: ['Use an Ember Wand strategy: target the frost creature weak to fire first, then clear the resistant ember creature.', '使用餘燼魔杖策略：先鎖定怕火的冰霜生物，再處理抗火的餘燼生物。'],
    map: ['###########', '#H......E.#', '#..F..I...#', '#.........#', '###########'], heroDir: 'E', codingView: 'code',
    practiceSpellDamage: 2, practiceRange: 6, practiceElement: 'fire',
    objective: { defeatAll: true, reachExit: true }, available: { actions: BASIC.concat(PARTY), logic: ['repeat2','repeat5'] },
    requires: ['property'], maxBlocks: 12, parBlocks: 8,
    reward: { ingredients: { emberRoot: 2, waterCrystal: 2 }, lootFound: 12 },
    reference: { main: [LET('resistHits', P('enemies.0.hp')), A('targetElementWeak'), A('cast'), A('targetNearest'), R(V('resistHits'), [A('cast')]), R(L(7), [A('move')])], functions: {} }
  }),
  freezeLevel({
    id: 'q34', region: REGIONS.nexus, title: ['Freeze the Turn', '凍結回合'], concept: ['Status + changing state', '狀態＋動態變化'],
    objectiveText: ['Frost does more than damage: freeze the approaching guardian so its next world turn is skipped.', '冰霜不只造成傷害：凍住接近中的守衛，讓它跳過下一個世界回合。'],
    map: ['##########', '#H.....E.#', '#....O...#', '#........#', '##########'], heroDir: 'E', codingView: 'code',
    practiceSpellDamage: 1, practiceRange: 5, practiceElement: 'frost',
    objective: { defeatAll: true, reachExit: true, minHp: 3 }, available: { actions: BASIC.concat(PARTY), logic: ['repeat5','ifDanger'] },
    requires: ['property'], maxBlocks: 9, parBlocks: 4,
    reward: { equipment: 'frostScepter', potions: { ward: 1 }, lootFound: 12 },
    reference: { main: [LET('frozen', P('enemies.frozenCount')), A('targetNearest'), A('cast'), A('move')], functions: {} }
  }),
  freezeLevel({
    id: 'q35', region: REGIONS.nexus, title: ['Target Algorithm', '目標演算法'], concept: ['Selection strategy', '選擇策略'],
    objectiveText: ['Use collection counts and target selectors to remove the armored threat before the weaker enemies.', '用集合數量與目標選擇器，先移除有裝甲的威脅，再處理較弱敵人。'],
    map: ['############', '#H.......E.#', '#..B.S.G...#', '#..........#', '############'], heroDir: 'E', codingView: 'code',
    practiceSpellDamage: 3, practiceRange: 6, practiceElement: 'neutral',
    objective: { defeatAll: true, reachExit: true }, available: { actions: BASIC.concat(PARTY), logic: ['repeat2','repeat3','repeat5'] },
    requires: ['let','property','repeat'], maxBlocks: 14, parBlocks: 8,
    reward: { equipment: 'seekerLens', ingredients: { moonBerry: 2, waterCrystal: 2 }, lootFound: 13 },
    reference: { main: [LET('foes', P('enemies.length')), A('targetArmored'), A('cast'), R(B('-', V('foes'), L(1)), [A('targetWeakest'), A('cast')]), R(L(8), [A('move')])], functions: {} }
  }),
  freezeLevel({
    id: 'q36', region: REGIONS.nexus, title: ['Nexus Array', '樞紐陣列'], concept: ['Party algorithm', '隊伍演算法'],
    objectiveText: ['Write one party algorithm that reads the enemy collection, exploits elemental weakness, and retargets until the chamber is clear.', '寫一套隊伍演算法：讀取敵人集合、利用元素弱點，並持續重新鎖定直到房間清空。'],
    map: ['############', '#H.......E.#', '#..I.F.B...#', '#..........#', '############'], heroDir: 'E', codingView: 'code',
    practiceSpellDamage: 3, practiceRange: 6, practiceElement: 'fire',
    objective: { defeatAll: true, reachExit: true }, available: { actions: BASIC.concat(PARTY), logic: LOGIC_CORE },
    requires: ['params','arguments','return','let','property','expression','if'], maxBlocks: 22, parBlocks: 13,
    reward: { potions: { focus: 1, ward: 1 }, ingredients: { sunHerb: 2, moonBerry: 2, waterCrystal: 2, emberRoot: 2 }, lootFound: 18 },
    reference: {
      main: [LET('foes', P('enemies.length')), CALL('clear', undefined, [V('foes')], 'cleared'), IF(B('===', V('cleared'), L(3)), [R(L(8), [A('move')])])],
      functions: { clear: { params: ['count'], body: [R(V('count'), [IF(B('>', P('enemies.length'), L(0)), [A('targetElementWeak'), IF('targetElementWeak', [A('cast')], [A('targetWeakest'), A('cast')])])]), RET(V('count'))] } }
    }
  }),
  freezeLevel({
    id: 'q37', region: REGIONS.relic, title: ['Relic Readout', '遺物讀值'], concept: ['Build properties', '裝備屬性'],
    objectiveText: ['Read your equipped relic metadata, then cross the foundry gate.', '讀取目前裝備的遺物資料，再穿過鑄造所大門。'],
    map: ['#########', '#H....E.#', '#.......#', '#########'], heroDir: 'E', codingView: 'code',
    objective: { reachExit: true }, available: { actions: BASIC, logic: ['repeat5'] },
    requires: ['let','property','expression'], maxBlocks: 8, parBlocks: 4,
    reward: { lootChoiceSeed: 'q37-relic-readout', lootTier: 2, ingredients: { emberRoot: 1 }, lootFound: 5 },
    reference: { main: [LET('rank', P('hero.weapon.rarityRank')), IF(B('>=', V('rank'), L(1)), [R(L(5), [A('move')])])], functions: {} }
  }),
  freezeLevel({
    id: 'q38', region: REGIONS.relic, title: ['For Each Foe', '逐一敵人'], concept: ['for...of iteration', 'for...of 迭代'],
    objectiveText: ['Iterate the active enemies collection, target each foe record, and clear the room.', '逐一走訪目前敵人集合、鎖定每個 foe，再清空房間。'],
    map: ['###########', '#H......E.#', '#..S.S.S..#', '#.........#', '###########'], heroDir: 'E', codingView: 'code',
    practiceSpellDamage: 2, practiceRange: 6, practiceElement: 'neutral',
    objective: { defeatAll: true, reachExit: true }, available: { actions: BASIC.concat(PARTY), logic: ['repeat5'] },
    requires: ['forOf'], maxBlocks: 10, parBlocks: 5,
    reward: { ingredients: { moonBerry: 2, waterCrystal: 1 }, lootFound: 7 },
    reference: { main: [FOR('foe', [T(V('foe')), A('cast')]), R(L(7), [A('move')])], functions: {} }
  }),
  freezeLevel({
    id: 'q39', region: REGIONS.relic, title: ['Inspect Each', '逐一檢查'], concept: ['Item properties', '集合項目屬性'],
    objectiveText: ['Read foe.weakTo inside the loop and adapt the number of casts.', '在迴圈裡讀取 foe.weakTo，依弱點調整施法次數。'],
    map: ['###########', '#H......E.#', '#..F..I...#', '#.........#', '###########'], heroDir: 'E', codingView: 'code',
    practiceSpellDamage: 2, practiceRange: 6, practiceElement: 'fire',
    objective: { defeatAll: true, reachExit: true }, available: { actions: BASIC.concat(PARTY), logic: ['repeat5'] },
    requires: ['forOf','member','if','expression'], maxBlocks: 15, parBlocks: 8,
    reward: { lootChoiceSeed: 'q39-inspect-each', lootTier: 3, ingredients: { waterCrystal: 2 }, lootFound: 8 },
    reference: { main: [FOR('foe', [T(V('foe')), IF(B('===', M('foe','weakTo'), P('hero.weapon.element')), [A('cast')], [A('cast'), A('cast')])]), R(L(7), [A('move')])], functions: {} }
  }),
  freezeLevel({
    id: 'q40', region: REGIONS.relic, title: ['Affix Logic', '詞綴邏輯'], concept: ['Build-aware condition', '依裝備判斷'],
    objectiveText: ['Use rarity and affix count as program state instead of hidden loot math.', '把稀有度與詞綴數量當成可讀取的程式狀態，而不是隱藏數值。'],
    map: ['##########', '#H.....E.#', '#........#', '##########'], heroDir: 'E', codingView: 'code',
    objective: { reachExit: true }, available: { actions: BASIC, logic: ['repeat5'] },
    requires: ['property','expression','if'], maxBlocks: 10, parBlocks: 4,
    reward: { lootChoiceSeed: 'q40-affix-logic', lootTier: 4, potions: { focus: 1 }, lootFound: 9 },
    reference: { main: [LET('affixes', P('hero.weapon.affixCount')), IF(B('>=', P('hero.weapon.rarityRank'), L(1)), [R(B('+', V('affixes'), L(6)), [A('move')])])], functions: {} }
  }),
  freezeLevel({
    id: 'q41', region: REGIONS.relic, title: ['Party Function', '隊伍函式'], concept: ['Object arguments', '物件參數'],
    objectiveText: ['Pass each read-only foe record into one reusable function.', '把每個唯讀 foe 紀錄傳進同一個可重複使用函式。'],
    map: ['###########', '#H......E.#', '#..S.S.S..#', '#.........#', '###########'], heroDir: 'E', codingView: 'code',
    practiceSpellDamage: 2, practiceRange: 6, practiceElement: 'neutral',
    objective: { defeatAll: true, reachExit: true }, available: { actions: BASIC.concat(PARTY), logic: LOGIC_CORE },
    requires: ['forOf','params','arguments'], maxBlocks: 14, parBlocks: 6,
    reward: { ingredients: { sunHerb: 2, emberRoot: 2 }, lootFound: 10 },
    reference: { main: [FOR('foe', [CALL('strike', undefined, [V('foe')])]), R(L(7), [A('move')])], functions: { strike: { params: ['foe'], body: [T(V('foe')), A('cast')] } } }
  }),
  freezeLevel({
    id: 'q42', region: REGIONS.relic, title: ['Relic Hydra', '遺物多頭獸'], concept: ['Collection boss algorithm', '集合首領演算法'],
    objectiveText: ['Clear the Hydra escorts with one collection loop, break its shield, then escape.', '用一個集合迴圈清除多頭獸護衛、打破護盾，再逃出房間。'],
    map: ['############', '#H.......E.#', '#..F.I.X...#', '#..........#', '############'], heroDir: 'E', codingView: 'code',
    practiceSpellDamage: 3, practiceRange: 6, practiceElement: 'frost',
    objective: { defeatAll: true, reachExit: true, minHp: 3 }, available: { actions: BASIC.concat(PARTY, ['guard']), logic: LOGIC_CORE },
    requires: ['forOf','member','if','expression'], maxBlocks: 18, parBlocks: 8,
    reward: { lootChoiceSeed: 'q42-relic-hydra', lootTier: 6, potions: { ward: 1 }, ingredients: { sunHerb: 2, moonBerry: 2, waterCrystal: 2, emberRoot: 2 }, lootFound: 20 },
    reference: { main: [FOR('foe', [T(V('foe')), IF(B('>', M('foe','maxHp'), L(4)), [A('cast'), A('cast')], [A('cast')])]), R(L(8), [A('move')])], functions: {} }
  }),
  freezeLevel({
    id:'q43', region:REGIONS.mechanism, title:['Lever Circuit','拉桿迴路'], concept:['World interaction','世界互動'],
    objectiveText:['Detect the lever, activate it, open the rune gate, and take the stairs.','偵測拉桿、啟動迴路、打開符文閘門並走上樓梯。'],
    map:['###########','#H.LZ...>.#','#.........#','###########'], heroDir:'E', switchesRequired:1,
    objective:{ activateAllLevers:true, openAllRuneGates:true, reachExit:true }, available:{ actions:BASIC.concat(WORLD), logic:['repeat5','ifLever'] },
    requires:['if'], maxBlocks:8, parBlocks:5,
    reward:{ ingredients:{ emberRoot:1, waterCrystal:1 }, lootFound:8 },
    reference:{ main:[A('move'),IF('leverAhead',[A('interact')]),R(L(6),[A('move')])], functions:{} }
  }),
  freezeLevel({
    id:'q44', region:REGIONS.mechanism, title:['Pressure State','壓力狀態'], concept:['World properties','世界屬性'],
    objectiveText:['Step on the plate, read the circuit state, and cross the opened gate.','踩上壓力板、讀取迴路狀態，再穿過已打開的閘門。'],
    map:['###########','#H.PZ...>.#','#.........#','###########'], heroDir:'E', codingView:'code', switchesRequired:1,
    objective:{ activateAllPlates:true, openAllRuneGates:true, reachExit:true }, available:{ actions:BASIC.concat(WORLD), logic:['repeat2','repeat5'] },
    requires:['property','expression','if'], maxBlocks:10, parBlocks:6,
    reward:{ ingredients:{ moonBerry:1, waterCrystal:2 }, lootFound:8 },
    reference:{ main:[R(L(2),[A('move')]),LET('active',P('hero.world.switchesActive')),IF(B('>=',V('active'),L(1)),[R(L(5),[A('move')])])], functions:{} }
  }),
  freezeLevel({
    id:'q45', region:REGIONS.mechanism, title:['Break the Path','擊破道路'], concept:['Sensor + action','感測＋動作'],
    objectiveText:['Detect a breakable crate, smash it, and keep moving without exposing the hidden grid.','偵測可破壞木箱、擊破它，再繼續前進。'],
    map:['###########','#H.Q....>.#','#.........#','###########'], heroDir:'E',
    objective:{ breakAllCrates:true, reachExit:true }, available:{ actions:BASIC.concat(WORLD), logic:['repeat5','ifBreakable'] },
    requires:['if'], maxBlocks:8, parBlocks:5,
    reward:{ ingredients:{ sunHerb:2 }, lootFound:8 },
    reference:{ main:[A('move'),IF('breakableAhead',[A('smash')]),R(L(6),[A('move')])], functions:{} }
  }),
  freezeLevel({
    id:'q46', region:REGIONS.mechanism, title:['Guide Protocol','嚮導協定'], concept:['NPC interaction','角色互動'],
    objectiveText:['Talk to the dungeon guide, receive a key, unlock the door, and take the stairs.','和地下城嚮導互動、取得鑰匙、解鎖門並走上樓梯。'],
    map:['###########','#H.ND...>.#','#.........#','###########'], heroDir:'E', npcReward:'key',
    objective:{ helpAllNpcs:true, unlockAllDoors:true, reachExit:true }, available:{ actions:BASIC.concat(['open'],WORLD), logic:['repeat5','ifNpc'] },
    requires:['if'], maxBlocks:10, parBlocks:7,
    reward:{ potions:{ ward:1 }, lootFound:9 },
    reference:{ main:[A('move'),IF('npcAhead',[A('interact')]),A('move'),A('open'),R(L(5),[A('move')])], functions:{} }
  }),
  freezeLevel({
    id:'q47', region:REGIONS.mechanism, title:['Mechanism Function','機關函式'], concept:['Reusable world routine','可重用世界函式'],
    objectiveText:['Write one reusable clearFront routine for levers and crates, then pass the rune gate.','寫一個可重複使用的 clearFront 函式來處理拉桿與木箱，再穿過符文閘門。'],
    map:['###########','#H.LQZ..>.#','#.........#','###########'], heroDir:'E', codingView:'code', switchesRequired:1,
    objective:{ activateAllLevers:true, breakAllCrates:true, openAllRuneGates:true, reachExit:true }, available:{ actions:BASIC.concat(WORLD), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['call','if'], maxBlocks:14, parBlocks:10,
    reward:{ lootChoiceSeed:'q47-mechanism-function', lootTier:5, lootFound:10 },
    reference:{ main:[A('move'),CALL('clear'),A('move'),CALL('clear'),R(L(5),[A('move')])], functions:{ clear:[IF('leverAhead',[A('interact')]),IF('breakableAhead',[A('smash')])] } }
  }),
  freezeLevel({
    id:'q48', region:REGIONS.mechanism, title:['Circuit Guardian','迴路守衛'], concept:['Mechanism boss algorithm','機關首領演算法'],
    objectiveText:['Power both mechanisms, verify the circuit state, break the Guardian shield, and escape by stairs.','啟動兩個機關、確認迴路狀態、打破守衛護盾並從樓梯逃離。'],
    map:['##############','#H.L.PZ.Y..>.#','#............#','##############'], heroDir:'E', codingView:'code', switchesRequired:2,
    objective:{ activateAllLevers:true, activateAllPlates:true, openAllRuneGates:true, defeatAll:true, reachExit:true }, available:{ actions:BASIC.concat(RPG,PARTY,WORLD), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['property','expression','if','repeat'], maxBlocks:20, parBlocks:13,
    reward:{ lootChoiceSeed:'q48-circuit-guardian', lootTier:7, potions:{ healing:1, ward:1 }, ingredients:{ emberRoot:2, waterCrystal:2 }, lootFound:24 },
    reference:{ main:[A('move'),IF('leverAhead',[A('interact')]),R(L(3),[A('move')]),LET('ready',P('hero.world.switchesActive')),IF(B('>=',V('ready'),P('hero.world.switchesRequired')),[R(L(2),[A('move')]),R(L(4),[A('heavyAttack')]),R(L(4),[A('move')])])], functions:{} }
  }),
  freezeLevel({
    id:'q49', region:REGIONS.logicworks, title:['Boolean Gate','布林閘門'], concept:['Exact circuit state','精確迴路狀態'],
    objectiveText:['Activate exactly two of three toggle levers, verify the boolean circuit, then cross the gate.','在三個可切換拉桿中啟動剛好兩個、確認布林迴路，再穿過閘門。'],
    map:['##############','#H.LL.LZ...>.#','#............#','##############'], heroDir:'E', codingView:'code', switchesRequired:2, circuitMode:'exact', toggleLevers:true, dynamicCircuit:true,
    objective:{ satisfyCircuit:true, openAllRuneGates:true, reachExit:true }, available:{ actions:BASIC.concat(WORLD), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['property','expression','if'], maxBlocks:14, parBlocks:8,
    reward:{ ingredients:{ moonBerry:2, waterCrystal:1 }, lootFound:10 },
    reference:{ main:[A('move'),A('interact'),A('move'),A('interact'),LET('active',P('hero.world.switchesActive')),IF(B('===',V('active'),L(2)),[R(L(8),[A('move')])])], functions:{} }
  }),
  freezeLevel({
    id:'q50', region:REGIONS.logicworks, title:['Clock Trap','時鐘陷阱'], concept:['Time-dependent state','依時間變化的狀態'],
    objectiveText:['Run the same decision routine across turns: wait while the clock trap is active and cross when it is safe.','跨回合重複執行同一套判斷：陷阱啟動時等待，安全時再通過。'],
    map:['###########','#H.T....>.#','#.........#','###########'], heroDir:'E', codingView:'code', clockStart:0,
    objective:{ reachExit:true, minHp:5 }, available:{ actions:BASIC.concat(['wait'],WORLD), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['if','else'], maxBlocks:10, parBlocks:5,
    reward:{ potions:{ ward:1 }, lootFound:10 },
    reference:{ main:[IF('cycleTrapAhead',[IF('cycleTrapActiveAhead',[A('wait')],[A('move')])],[A('move')])], functions:{} }
  }),
  freezeLevel({
    id:'q51', region:REGIONS.logicworks, title:['Push Compiler','推箱編譯器'], concept:['Stateful world action','有狀態的世界動作'],
    objectiveText:['Push the stone block onto the pressure plate, open the gate, then route back to the stairs.','把石塊推上壓力板、打開閘門，再繞回樓梯。'],
    map:['############','#H..Z....>.#','#..U.......#','#..P.......#','############'], heroDir:'E', codingView:'code', switchesRequired:1,
    objective:{ pushAllOntoPlates:true, activateAllPlates:true, openAllRuneGates:true, reachExit:true }, available:{ actions:BASIC.concat(WORLD), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['repeat'], maxBlocks:16, parBlocks:10,
    reward:{ lootChoiceSeed:'q51-push-compiler', lootTier:6, lootFound:12 },
    reference:{ main:[R(L(2),[A('move')]),A('turnRight'),A('push'),A('turnLeft'),A('turnLeft'),A('move'),A('turnRight'),R(L(6),[A('move')])], functions:{} }
  }),
  freezeLevel({
    id:'q52', region:REGIONS.logicworks, title:['Moving Bridge','移動橋'], concept:['Reactive platform timing','反應式平台時機'],
    objectiveText:['Use the same IF routine every turn: wait for the platform, board it, ride across the pit, and continue.','每回合使用同一個 IF 程式：等待平台、登上平台、越過深坑，再繼續前進。'],
    map:['###########','#.H~~...>.#','#.........#','###########'], heroDir:'E', codingView:'code', movingPlatforms:[{ path:[{x:3,y:1},{x:4,y:1}], startIndex:1 }],
    objective:{ reachExit:true, minHp:5 }, available:{ actions:BASIC.concat(['wait'],WORLD), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['if','else'], maxBlocks:10, parBlocks:5,
    reward:{ ingredients:{ sunHerb:2, emberRoot:1 }, lootFound:12 },
    reference:{ main:[IF('platformAhead',[A('move')],[IF('blockedAhead',[A('wait')],[A('move')])])], functions:{} }
  }),
  freezeLevel({
    id:'q53', region:REGIONS.logicworks, title:['Quest State','任務狀態'], concept:['State machine + reusable route','狀態機＋可重用路線'],
    objectiveText:['Start the guide quest, collect its rune token, return to complete the quest, then leave by the stairs.','啟動嚮導任務、取得符文信物、返回完成任務，再從樓梯離開。'],
    map:['#############','#..N........#','#H....*...>.#','#...........#','#############'], heroDir:'E', codingView:'code', npcQuest:true, npcReward:'ward',
    objective:{ collectAllQuestTokens:true, completeNpcQuests:true, reachExit:true }, available:{ actions:BASIC.concat(WORLD), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['property','expression','call'], maxBlocks:28, parBlocks:19,
    reward:{ potions:{ healing:1 }, lootFound:14 },
    reference:{ main:[R(L(2),[A('move')]),A('turnLeft'),A('interact'),A('turnRight'),LET('started',P('hero.world.questsStarted')),IF(B('===',V('started'),L(1)),[R(L(3),[A('move')]),CALL('around'),R(L(3),[A('move')]),A('turnRight'),A('interact'),A('turnRight'),R(L(7),[A('move')])])], functions:{ around:[A('turnLeft'),A('turnLeft')] } }
  }),
  freezeLevel({
    id:'q54', region:REGIONS.logicworks, title:['Companion Protocol','夥伴協定'], concept:['Programmable companion','可編程夥伴'],
    objectiveText:['Keep the companion following, use one assist command in combat, then clear the corridor together.','讓夥伴保持跟隨，在戰鬥中使用一次協助指令，再一起清除走廊。'],
    map:['############','#cH..G...>.#','#..........#','############'], heroDir:'E', codingView:'code',
    objective:{ defeatAll:true, companionAssists:1, reachExit:true }, available:{ actions:BASIC.concat(RPG,WORLD,COMPANION), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['if','companion'], maxBlocks:14, parBlocks:8,
    reward:{ lootChoiceSeed:'q54-companion-protocol', lootTier:8, potions:{ ward:1 }, lootFound:20 },
    reference:{ main:[A('companionFollow'),R(L(2),[A('move')]),IF('enemyAhead',[A('companionAssist'),A('attack')]),R(L(5),[A('move')])], functions:{} }
  }),
  freezeLevel({
    id:'q55', region:REGIONS.coop, title:['Twin Plates','雙人壓板'], concept:['Two-character coordination','雙角色協作'],
    objectiveText:['Hold the companion, move both characters onto separate live plates at the same time, and open the rune gate.','讓夥伴待命，讓兩個角色同時站上不同的即時壓力板，打開符文閘門。'],
    map:['##############','#H.P...Z.....#','#c.P.........#','##############'], heroDir:'E', companionDir:'E', codingView:'code', switchesRequired:2, livePlates:true, dynamicCircuit:true,
    objective:{ satisfyCircuit:true, activateAllPlates:true, openAllRuneGates:true, companionMoves:2 }, available:{ actions:BASIC.concat(WORLD,COMPANION), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['repeat','companion'], maxBlocks:12, parBlocks:5,
    reward:{ ingredients:{ waterCrystal:2, moonBerry:1 }, lootFound:12 },
    reference:{ main:[A('companionHold'),R(L(2),[A('move')]),R(L(2),[A('companionMove')])], functions:{} }
  }),
  freezeLevel({
    id:'q56', region:REGIONS.coop, title:['Scout Circuit','偵察迴路'], concept:['Companion-specific function','夥伴專用函式'],
    objectiveText:['Send the companion down its own lane to power the lever, then let the hero cross the newly opened route.','讓夥伴沿自己的通道前進啟動拉桿，再讓英雄穿過新開啟的路線。'],
    map:['##############','#H...Z.....>.#','#c..L........#','##############'], heroDir:'E', companionDir:'E', codingView:'code', switchesRequired:1,
    objective:{ activateAllLevers:true, openAllRuneGates:true, reachExit:true, companionMoves:2 }, available:{ actions:BASIC.concat(WORLD,COMPANION), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['call','companion'], maxBlocks:14, parBlocks:7,
    reward:{ lootChoiceSeed:'q56-scout-circuit', lootTier:8, lootFound:14 },
    reference:{ main:[CALL('scout'),R(L(10),[A('move')])], functions:{ scout:[A('companionHold'),R(L(2),[A('companionMove')]),A('companionInteract')] } }
  }),
  freezeLevel({
    id:'q57', region:REGIONS.coop, title:['Rune Core Carry','符文核心搬運'], concept:['Carryable state','可搬運狀態'],
    objectiveText:['Pick up the rune core, place it on the live plate, keep the circuit powered, and cross the gate.','拿起符文核心，把它放到即時壓力板上維持供能，再穿過閘門。'],
    map:['#############','#HoPZ.....>.#','#...........#','#############'], heroDir:'E', codingView:'code', switchesRequired:1, livePlates:true, dynamicCircuit:true,
    objective:{ placeAllOrbsOnPlates:true, openAllRuneGates:true, reachExit:true }, available:{ actions:BASIC.concat(WORLD), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['if','property'], maxBlocks:14, parBlocks:9,
    reward:{ ingredients:{ emberRoot:2, waterCrystal:2 }, lootFound:14 },
    reference:{ main:[IF('carryableAhead',[A('take')]),A('move'),IF('heroCarrying',[A('throw')]),LET('cores',P('hero.world.orbsOnPlates')),IF(B('===',V('cores'),L(1)),[R(L(8),[A('move')])])], functions:{} }
  }),
  freezeLevel({
    id:'q58', region:REGIONS.coop, title:['Core Relay','核心接力'], concept:['Object handoff','物件接力'],
    objectiveText:['Hand the rune core to the companion, let the companion place it on the plate, then clear the lane and escape.','把符文核心交給夥伴，讓夥伴把核心放上壓力板，再清出通道逃離。'],
    map:['#############','#Hoc.PZ...>.#','#...........#','#############'], heroDir:'E', companionDir:'W', codingView:'code', switchesRequired:1, livePlates:true, dynamicCircuit:true,
    objective:{ placeAllOrbsOnPlates:true, openAllRuneGates:true, reachExit:true, companionMoves:2 }, available:{ actions:BASIC.concat(WORLD,COMPANION), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['companion','if'], maxBlocks:22, parBlocks:13,
    reward:{ potions:{ ward:1 }, lootFound:16 },
    reference:{ main:[A('take'),A('throw'),IF('companionCarryableAhead',[A('companionTake')]),A('companionTurnRight'),A('companionTurnRight'),A('companionMove'),IF('companionCarrying',[A('companionThrow')]),A('companionTurnRight'),A('companionMove'),R(L(9),[A('move')])], functions:{} }
  }),
  freezeLevel({
    id:'q59', region:REGIONS.coop, title:['Danger Callback','危險回呼'], concept:['Event callback','事件回呼'],
    objectiveText:['Register a danger handler once. When the archer signals a shot, the callback should make the companion guard automatically.','只註冊一次危險處理函式；弓手預告射擊時，回呼要自動讓夥伴防禦。'],
    map:['############','#cH......>.#','#..........#','#....A.....#','############'], heroDir:'E', companionDir:'E', codingView:'code',
    objective:{ reachExit:true, minHp:5, callbacksTriggered:1 }, available:{ actions:BASIC.concat(RPG,COMPANION), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['on','companion'], maxBlocks:10, parBlocks:3,
    reward:{ lootChoiceSeed:'q59-danger-callback', lootTier:9, lootFound:18 },
    reference:{ main:[ON('danger','brace'),A('move')], functions:{ brace:[A('companionGuard')] } }
  }),
  freezeLevel({
    id:'q60', region:REGIONS.coop, title:['Twin Core Compiler','雙核心編譯器'], concept:['Cooperative algorithm','協作演算法'],
    objectiveText:['Keep a rune core and the companion on two live plates, verify the circuit, defeat the Circuit Guardian, and escape together.','讓符文核心與夥伴同時維持兩個即時壓力板、確認迴路、打敗迴路守衛，再一起逃離。'],
    map:['################','#HoPZ..Y.....>.#','#c.P...........#','################'], heroDir:'E', companionDir:'E', codingView:'code', switchesRequired:2, livePlates:true, dynamicCircuit:true,
    objective:{ placeAllOrbsOnPlates:true, satisfyCircuit:true, defeatAll:true, reachExit:true, companionMoves:2 }, available:{ actions:BASIC.concat(RPG,WORLD,COMPANION), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['property','expression','call','companion'], maxBlocks:28, parBlocks:16,
    reward:{ lootChoiceSeed:'q60-twin-core', lootTier:9, potions:{ healing:1, ward:1 }, ingredients:{ emberRoot:2, moonBerry:2 }, lootFound:30 },
    reference:{ main:[CALL('power'),LET('ready',P('hero.world.circuitSatisfied')),IF(B('===',V('ready'),L(true)),[CALL('finish')])], functions:{ power:[A('companionHold'),A('take'),A('move'),A('throw'),R(L(2),[A('companionMove')])], finish:[R(L(4),[A('move')]),R(L(8),[A('attack')]),R(L(6),[A('move')])] } }
  }),
  freezeLevel({
    id:'q61', region:REGIONS.signalworks, title:['Ping Gate','訊號閘門'], concept:['Message passing','訊息傳遞'],
    objectiveText:['Send a READY signal to the dungeon relay, open the rune gate, and cross.','傳送 READY 訊號給地下城中繼器，打開符文閘門並通過。'],
    map:['############','#H.Z.....>.#','#..........#','############'], heroDir:'E', codingView:'code', signalGateChannel:'ready',
    objective:{ signalsSent:1, signalChannel:'ready', openAllRuneGates:true, reachExit:true }, available:{ actions:BASIC.concat(WORLD), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['signal'], maxBlocks:8, parBlocks:3,
    reward:{ ingredients:{ waterCrystal:2, emberRoot:1 }, lootFound:18 },
    reference:{ main:[SIG('hero','ready'),R(L(8),[A('move')])], functions:{} }
  }),
  freezeLevel({
    id:'q62', region:REGIONS.signalworks, title:['Answer Back','回覆訊號'], concept:['Signal callback','訊號回呼'],
    objectiveText:['Register SIGNAL once, send HELP, and let the callback move the companion automatically.','註冊 SIGNAL、傳送 HELP，讓回呼自動移動夥伴。'],
    map:['############','#H.......>.#','#c.........#','############'], heroDir:'E', companionDir:'E', codingView:'code',
    objective:{ signalsSent:1, callbacksTriggered:1, companionMoves:1, reachExit:true }, available:{ actions:BASIC.concat(COMPANION), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['signal','on','companion'], maxBlocks:12, parBlocks:5,
    reward:{ lootChoiceSeed:'q62-answer-back', lootTier:9, lootFound:20 },
    reference:{ main:[A('companionHold'),ON('signal','answer'),SIG('hero','help'),A('move')], functions:{ answer:[A('companionMove')] } }
  }),
  freezeLevel({
    id:'q63', region:REGIONS.signalworks, title:['Two Watchers','雙重監看'], concept:['Multiple event handlers','多事件處理'],
    objectiveText:['Keep SIGNAL and DANGER handlers active while crossing the archer relay lane.','穿越弓手中繼通道時，同時維持 SIGNAL 與 DANGER 處理函式。'],
    map:['############','#H.......>.#','#c.........#','#....A.....#','############'], heroDir:'E', companionDir:'E', codingView:'code',
    objective:{ signalsSent:1, callbacksTriggered:2, reachExit:true, minHp:4 }, available:{ actions:BASIC.concat(RPG,COMPANION), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['signal','on','companion'], maxBlocks:16, parBlocks:7,
    reward:{ potions:{ ward:1 }, lootFound:22 },
    reference:{ main:[A('companionHold'),ON('signal','advance'),ON('danger','brace'),SIG('hero','ready'),A('move')], functions:{ advance:[A('companionMove')], brace:[A('companionGuard')] } }
  }),
  freezeLevel({
    id:'q64', region:REGIONS.signalworks, title:['Companion Relay','夥伴中繼'], concept:['Actor-to-world signal','角色到世界訊號'],
    objectiveText:['Have the companion transmit SWITCH to the relay gate while the hero advances.','讓夥伴傳送 SWITCH 到中繼閘門，英雄穿過開啟的通道。'],
    map:['#############','#H..Z.....>.#','#c..........#','#############'], heroDir:'E', companionDir:'E', codingView:'code', signalGateChannel:'switch',
    objective:{ signalsSent:1, signalChannel:'switch', openAllRuneGates:true, reachExit:true }, available:{ actions:BASIC.concat(COMPANION), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['signal','companion'], maxBlocks:10, parBlocks:3,
    reward:{ lootChoiceSeed:'q64-companion-relay', lootTier:9, lootFound:22 },
    reference:{ main:[SIG('companion','switch'),R(L(9),[A('move')])], functions:{} }
  }),
  freezeLevel({
    id:'q65', region:REGIONS.signalworks, title:['Message Router','訊息路由器'], concept:['Read message state','讀取訊息狀態'],
    objectiveText:['Route behavior from the last signal: HELP moves the companion, otherwise it holds.','依最後訊號路由行為：HELP 讓夥伴移動，否則待命。'],
    map:['############','#H.......>.#','#c.........#','############'], heroDir:'E', companionDir:'E', codingView:'code',
    objective:{ signalsSent:1, callbacksTriggered:1, companionMoves:1, reachExit:true }, available:{ actions:BASIC.concat(COMPANION), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['signal','on','property','expression'], maxBlocks:18, parBlocks:7,
    reward:{ ingredients:{ moonBerry:2, emberRoot:2 }, lootFound:24 },
    reference:{ main:[A('companionHold'),ON('signal','route'),SIG('hero','help'),A('move')], functions:{ route:[IF(B('===',P('hero.signal.last'),L('help')),[A('companionMove')],[A('companionHold')])] } }
  }),
  freezeLevel({
    id:'q66', region:REGIONS.signalworks, title:['Automation Core','自動化核心'], concept:['Reusable event architecture','可重用事件架構'],
    objectiveText:['Use a signal relay plus danger handling to open the gate, coordinate the companion, and escape.','用訊號中繼與危險處理器打開閘門、協調夥伴並逃離。'],
    map:['##############','#H..Z.....>.##','#c...........#','#.....A......#','##############'], heroDir:'E', companionDir:'E', codingView:'code', signalGateChannel:'ready',
    objective:{ signalsSent:1, callbacksTriggered:2, companionMoves:1, openAllRuneGates:true, reachExit:true, minHp:4 }, available:{ actions:BASIC.concat(RPG,COMPANION), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['signal','on','call','companion'], maxBlocks:20, parBlocks:8,
    reward:{ lootChoiceSeed:'q66-automation-core', lootTier:9, potions:{ healing:1, ward:1 }, lootFound:36 },
    reference:{ main:[A('companionHold'),ON('signal','sync'),ON('danger','brace'),CALL('boot'),A('move')], functions:{ boot:[SIG('hero','ready')], sync:[A('companionMove')], brace:[A('companionGuard')] } }
  }),
  freezeLevel({
    id:'q67', region:REGIONS.protocol, title:['Hero State','英雄狀態'], concept:['Persistent finite state','持續有限狀態'],
    objectiveText:['Explore once, switch into ATTACK state, then keep the same state across turns to defeat the goblin.','先探索一次，切換成 ATTACK 狀態，並讓狀態跨回合保留來擊敗哥布林。'],
    map:['##########','#H.G.....#','##########'], heroDir:'E', heroState:'explore', codingView:'code',
    objective:{ defeatAll:true, stateChanges:1, heroState:'attack' }, available:{ actions:BASIC.concat(RPG), logic:LOGIC_CORE },
    requires:['state','property','expression'], maxBlocks:12, parBlocks:4,
    reward:{ ingredients:{ emberRoot:2, sunHerb:1 }, lootFound:26 },
    reference:{ main:[IF(B('===',P('hero.state'),L('explore')),[A('move'),STATE('hero','attack')],[A('attack')])], functions:{} }
  }),
  freezeLevel({
    id:'q68', region:REGIONS.protocol, title:['Companion State','夥伴狀態'], concept:['Independent actor state','獨立角色狀態'],
    objectiveText:['Give the companion its own WAIT → REGROUP state transition and let that state control later turns.','讓夥伴擁有自己的 WAIT → REGROUP 狀態轉換，並由該狀態控制後續回合。'],
    map:['##########','#H.......#','#c.......#','##########'], heroDir:'E', companionDir:'E', companionState:'wait', codingView:'code',
    objective:{ companionMoves:2, stateChanges:1, companionState:'regroup' }, available:{ actions:BASIC.concat(COMPANION), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['state','property','expression','companion'], maxBlocks:12, parBlocks:4,
    reward:{ lootChoiceSeed:'q68-companion-state', lootTier:9, lootFound:28 },
    reference:{ main:[IF(B('===',P('companion.state'),L('wait')),[STATE('companion','regroup'),A('companionMove')],[A('companionMove')])], functions:{} }
  }),
  freezeLevel({
    id:'q69', region:REGIONS.protocol, title:['Message Queue','訊息佇列'], concept:['FIFO message delivery','先進先出訊息'],
    objectiveText:['Send READY then SWITCH. The SIGNAL handler must process both messages in exactly that order.','依序傳送 READY、SWITCH；SIGNAL 處理器必須按照相同順序處理兩則訊息。'],
    map:['##########','#H.......#','#c.......#','##########'], heroDir:'E', companionDir:'E', codingView:'code',
    objective:{ signalsSent:2, callbacksTriggered:2, companionMoves:2, messageSequence:['ready','switch'] }, available:{ actions:BASIC.concat(RPG,COMPANION), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['signal','on','companion'], maxBlocks:14, parBlocks:5,
    reward:{ ingredients:{ moonBerry:2, waterCrystal:2 }, lootFound:30 },
    reference:{ main:[A('companionHold'),ON('signal','receive'),SIG('hero','ready'),SIG('hero','switch')], functions:{ receive:[A('companionMove')] } }
  }),
  freezeLevel({
    id:'q70', region:REGIONS.protocol, title:['Split Corridors','分岔走廊'], concept:['Separated actor protocol','分離角色協定'],
    objectiveText:['Move the companion down the lower corridor, then pair SWITCH + READY to unlock the hero corridor.','讓夥伴沿下方走廊前進，再配對 SWITCH + READY 解鎖英雄通道。'],
    map:['###############','#H..Z......E..#','#####.#########','#c............#','###############'], heroDir:'E', companionDir:'E', codingView:'code', signalGateChannels:['switch','ready'],
    objective:{ signalsSent:2, openAllRuneGates:true, reachExit:true, companionMoves:3, companionState:'regroup' }, available:{ actions:BASIC.concat(COMPANION), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['signal','state','companion'], maxBlocks:14, parBlocks:8,
    reward:{ lootChoiceSeed:'q70-split-corridors', lootTier:9, lootFound:32 },
    reference:{ main:[A('companionHold'),STATE('companion','regroup'),R(L(3),[A('companionMove')]),SIG('companion','switch'),SIG('hero','ready'),R(L(10),[A('move')])], functions:{} }
  }),
  freezeLevel({
    id:'q71', region:REGIONS.protocol, title:['Remote Switch','遠端開關'], concept:['Cross-room callback','跨房回呼'],
    objectiveText:['The hero cannot cross the gate directly. Signal SWITCH so the companion operates the isolated lever from the lower chamber.','英雄無法直接穿過閘門；傳送 SWITCH，讓下方隔離房間中的夥伴操作拉桿。'],
    map:['###############','#H..Z......E..#','###############','#cL...........#','###############'], heroDir:'E', companionDir:'E', codingView:'code', switchesRequired:1,
    objective:{ callbacksTriggered:1, companionInteractions:1, openAllRuneGates:true, reachExit:true, signalsSent:1 }, available:{ actions:BASIC.concat(COMPANION), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['signal','on','companion'], maxBlocks:14, parBlocks:6,
    reward:{ potions:{ ward:1, healing:1 }, lootFound:34 },
    reference:{ main:[A('companionHold'),ON('signal','remote'),SIG('hero','switch'),R(L(10),[A('move')])], functions:{ remote:[A('companionInteract')] } }
  }),
  freezeLevel({
    id:'q72', region:REGIONS.protocol, title:['Dual Processor','雙處理器'], concept:['State-machine protocol boss','狀態機協定首領'],
    objectiveText:['Boot two actor states, deliver READY then SWITCH, open the paired rune gate, coordinate the companion callbacks, defeat the Protocol Golem, and escape.','啟動兩個角色狀態、依序傳送 READY 與 SWITCH、打開雙訊號符文閘門、協調夥伴回呼，擊敗協定魔像後逃離。'],
    map:['###############','#H..Z..O..E...#','#c............#','###############'], heroDir:'E', companionDir:'E', heroState:'explore', companionState:'wait', codingView:'code', signalGateChannels:['ready','switch'], practiceSpellDamage:2, practiceRange:4, practiceElement:'frost',
    objective:{ signalsSent:2, callbacksTriggered:2, openAllRuneGates:true, companionMoves:1, stateChanges:3, heroState:'attack', companionState:'defend', defeatAll:true, reachExit:true, messageSequence:['ready','switch'] }, available:{ actions:BASIC.concat(RPG,PARTY,COMPANION), logic:LOGIC_CORE.concat(LOGIC_WORLD) },
    requires:['state','signal','on','call','companion','property','expression'], maxBlocks:28, parBlocks:16,
    reward:{ lootChoiceSeed:'q72-dual-processor', lootTier:9, potions:{ healing:1, ward:1 }, ingredients:{ emberRoot:2, moonBerry:2 }, lootFound:42 },
    reference:{
      main:[ON('signal','sync'),CALL('plan')],
      functions:{
        sync:[IF(B('===',P('hero.signal.last'),L('ready')),[STATE('companion','regroup'),A('companionMove')]),IF(B('===',P('hero.signal.last'),L('switch')),[STATE('companion','defend'),A('companionGuard')])],
        plan:[IF(B('===',P('hero.state'),L('explore')),[SIG('hero','ready'),SIG('companion','switch'),STATE('hero','attack')],[A('targetNearest'),IF('targetInRange',[A('cast')],[A('move')])])]
      }
    }
  })
]);

export function levelById(id) {
  return LEVELS.find(level => level.id === id) || null;
}

function endlessReward(floor) {
  const id = floor % 4 === 0 ? 'emberRoot' : floor % 3 === 0 ? 'moonBerry' : floor % 2 === 0 ? 'waterCrystal' : 'sunHerb';
  return Object.freeze({ ingredients: Object.freeze({ [id]: 1 }), lootFound: 1, ...(floor % 5 === 0 ? { lootChoiceSeed: 'tower-' + floor, lootTier: Math.max(1, Math.min(9, Math.ceil(floor / 24))) } : {}) });
}

export function generateEndless(floor = 1) {
  const f = Math.max(1, Math.min(9999, Math.floor(Number(floor) || 1)));
  const variant = (f - 1) % 32;
  const enemy = f >= 12 ? 'O' : f >= 4 ? 'G' : 'S';
  const hp = enemy === 'O' ? 4 : enemy === 'G' ? 2 : 1;
  let map, objective, reference, objectiveText, extras = {}, blocks;
  if (variant === 0) {
    map = ['##########', '#H......E#', '#........#', '##########'];
    objective = { reachExit: true }; reference = { main: [R(7, [A('move')])], functions: {} }; blocks = 2;
    objectiveText = ['Climb by reaching the exit.', '走到出口，繼續向上爬。'];
  } else if (variant === 1) {
    map = ['##########', ('#H..' + enemy + '...E#'), '#........#', '##########'];
    objective = { defeatAll: true, reachExit: true }; reference = { main: [R(2, [A('move')]), R(hp, [A('attack')]), R(5, [A('move')])], functions: {} }; blocks = 6;
    objectiveText = ['Clear the guardian and reach the exit.', '打敗守衛並走到出口。'];
  } else if (variant === 2) {
    map = ['##########', '#H...C..E#', '#........#', '##########'];
    objective = { openAllChests: true, reachExit: true }; reference = { main: [R(3, [A('move')]), A('open'), R(4, [A('move')])], functions: {} }; blocks = 5;
    objectiveText = ['Open the tower chest, then reach the exit.', '打開高塔寶箱，再走到出口。'];
  } else if (variant === 3) {
    map = ['##########', '#H..^...E#', '#........#', '##########'];
    objective = { disarmAllTraps: true, reachExit: true }; reference = { main: [R(2, [A('move')]), A('disarm'), R(5, [A('move')])], functions: {} }; blocks = 5;
    objectiveText = ['Disarm the tower trap and keep climbing.', '解除高塔陷阱，再繼續向上。'];
  } else if (variant === 4) {
    map = ['##########', '#HK.D...E#', '#........#', '##########'];
    objective = { collectAllKeys: true, unlockAllDoors: true, reachExit: true }; reference = { main: [R(2, [A('move')]), A('open'), R(5, [A('move')])], functions: {} }; blocks = 5;
    objectiveText = ['Find the key, unlock the door, and escape.', '找到鑰匙、解鎖門，再逃出去。'];
  } else if (variant === 5) {
    map = ['##########', '#HB....E.#', '#........#', '##########'];
    objective = { defeatAll: true, reachExit: true }; reference = { main: [IF('enemyArmoredAhead', [A('heavyAttack')]), IF('enemyAhead', [A('attack')]), A('move')], functions: {} }; blocks = 5;
    objectiveText = ['Read the armored sentinel and keep advancing.', '判斷裝甲哨兵並持續前進。'];
  } else if (variant === 6) {
    map = ['##########', '#H..V..E.#', '#........#', '##########'];
    objective = { defeatAll: true, reachExit: true, finishUnpoisoned: true }; extras = { practiceAntidotes: 4 };
    reference = { main: [IF('heroPoisoned', [A('useAntidote')]), IF('enemyAhead', [A('attack')]), A('move')], functions: {} }; blocks = 5;
    objectiveText = ['React to venom while you climb.', '一邊攀登，一邊處理毒素。'];
  } else if (variant === 7) {
    map = ['##########', '#H.....E.#', '#..A.....#', '##########'];
    objective = { reachExit: true, minHp: 4 }; reference = { main: [IF('dangerIncoming', [A('guard')]), A('move')], functions: {} }; blocks = 3;
    objectiveText = ['Read the archer signal and cross safely.', '讀取弓手訊號並安全通過。'];
  } else if (variant === 8) {
    map = ['##########', '#H.S.S..E#', '#........#', '##########'];
    objective = { defeatAll: true, reachExit: true };
    reference = { main: [LET('foes', P('enemies.length')), R(V('foes'), [A('move'), A('attack'), A('move')]), R(L(3), [A('move')])], functions: {} }; blocks = 7;
    objectiveText = ['Use the enemy collection to clear a two-guardian floor.', '利用敵人集合清除雙守衛樓層。'];
  } else if (variant === 9) {
    map = ['##########', '#H.....E.#', '#...I....#', '##########'];
    objective = { defeatAll: true, reachExit: true }; extras = { practiceSpellDamage: 3, practiceRange: 6, practiceElement: 'fire' };
    reference = { main: [A('targetElementWeak'), A('cast'), R(L(6), [A('move')])], functions: {} }; blocks = 4;
    objectiveText = ['Find the elemental weakness, cast from range, and climb.', '找出元素弱點，從遠處施法並繼續攀登。'];
  } else if (variant === 10) {
    map = ['##########', '#H.....E.#', '#..S.S.S.#', '##########'];
    objective = { defeatAll: true, reachExit: true }; extras = { practiceSpellDamage: 2, practiceRange: 6, practiceElement: 'neutral' };
    reference = { main: [FOR('foe', [T(V('foe')), A('cast')]), R(L(6), [A('move')])], functions: {} }; blocks = 5;
    objectiveText = ['Iterate a tower enemy party and target each record.', '逐一走訪高塔敵人隊伍並鎖定每個紀錄。'];
  } else if (variant === 11) {
    map = ['##########', '#H.....E.#', '#....X...#', '##########'];
    objective = { defeatAll: true, reachExit: true }; extras = { practiceSpellDamage: 4, practiceRange: 6, practiceElement: 'frost' };
    reference = { main: [A('targetNearest'), R(L(2), [A('cast')]), R(L(6), [A('move')])], functions: {} }; blocks = 5;
    objectiveText = ['Break a lone Relic Hydra and keep climbing.', '擊破單獨的遺物多頭獸並繼續向上。'];
  } else if (variant === 12) {
    map = ['###########','#H.LZ...>.#','#.........#','###########'];
    objective = { activateAllLevers:true, openAllRuneGates:true, reachExit:true }; extras = { switchesRequired:1 };
    reference = { main:[A('move'),IF('leverAhead',[A('interact')]),R(L(6),[A('move')])], functions:{} }; blocks = 5;
    objectiveText = ['Activate a tower lever circuit and pass the rune gate.', '啟動高塔拉桿迴路並穿過符文閘門。'];
  } else if (variant === 13) {
    map = ['###########','#H.Q....>.#','#.........#','###########'];
    objective = { breakAllCrates:true, reachExit:true };
    reference = { main:[A('move'),IF('breakableAhead',[A('smash')]),R(L(6),[A('move')])], functions:{} }; blocks = 5;
    objectiveText = ['Detect and clear a destructible obstruction.', '偵測並清除可破壞障礙物。'];
  } else if (variant === 14) {
    map = ['###########','#H.ND...>.#','#.........#','###########'];
    objective = { helpAllNpcs:true, unlockAllDoors:true, reachExit:true }; extras = { npcReward:'key' };
    reference = { main:[A('move'),IF('npcAhead',[A('interact')]),A('move'),A('open'),R(L(5),[A('move')])], functions:{} }; blocks = 7;
    objectiveText = ['Ask the dungeon guide for the key and unlock the route.', '向地下城嚮導取得鑰匙並解鎖路線。'];
  } else if (variant === 15) {
    map = ['##############','#H.L.PZ.Y..>.#','#............#','##############'];
    objective = { activateAllLevers:true, activateAllPlates:true, openAllRuneGates:true, defeatAll:true, reachExit:true }; extras = { switchesRequired:2 };
    reference = { main:[A('move'),IF('leverAhead',[A('interact')]),R(L(3),[A('move')]),LET('ready',P('hero.world.switchesActive')),IF(B('>=',V('ready'),P('hero.world.switchesRequired')),[R(L(2),[A('move')]),R(L(4),[A('heavyAttack')]),R(L(4),[A('move')])])], functions:{} }; blocks = 13;
    objectiveText = ['Power a mechanism circuit, drop the Guardian shield, and climb.', '啟動機關迴路、解除守衛護盾並繼續攀登。'];
  } else if (variant === 16) {
    map = ['##############','#H.LL.LZ...>.#','#............#','##############'];
    objective = { satisfyCircuit:true, openAllRuneGates:true, reachExit:true }; extras = { switchesRequired:2, circuitMode:'exact', toggleLevers:true, dynamicCircuit:true };
    reference = { main:[A('move'),A('interact'),A('move'),A('interact'),LET('active',P('hero.world.switchesActive')),IF(B('===',V('active'),L(2)),[R(L(8),[A('move')])])], functions:{} }; blocks = 8;
    objectiveText = ['Set an exact two-switch boolean circuit and cross the gate.', '設定剛好兩個開關的布林迴路並穿過閘門。'];
  } else if (variant === 17) {
    map = ['###########','#H.T....>.#','#.........#','###########'];
    objective = { reachExit:true, minHp:5 }; extras = { clockStart:0 };
    reference = { main:[IF('cycleTrapAhead',[IF('cycleTrapActiveAhead',[A('wait')],[A('move')])],[A('move')])], functions:{} }; blocks = 5;
    objectiveText = ['Reuse a timing decision to cross the clock trap safely.', '重複使用時機判斷，安全通過時鐘陷阱。'];
  } else if (variant === 18) {
    map = ['############','#H..Z....>.#','#..U.......#','#..P.......#','############'];
    objective = { pushAllOntoPlates:true, activateAllPlates:true, openAllRuneGates:true, reachExit:true }; extras = { switchesRequired:1 };
    reference = { main:[R(L(2),[A('move')]),A('turnRight'),A('push'),A('turnLeft'),A('turnLeft'),A('move'),A('turnRight'),R(L(6),[A('move')])], functions:{} }; blocks = 10;
    objectiveText = ['Push a tower block onto its pressure plate and reroute through the gate.', '把高塔石塊推上壓力板，再改道穿過閘門。'];
  } else if (variant === 19) {
    map = ['###########','#.H~~...>.#','#.........#','###########'];
    objective = { reachExit:true, minHp:5 }; extras = { movingPlatforms:[{ path:[{x:3,y:1},{x:4,y:1}], startIndex:1 }] };
    reference = { main:[IF('platformAhead',[A('move')],[IF('blockedAhead',[A('wait')],[A('move')])])], functions:{} }; blocks = 5;
    objectiveText = ['Wait for a moving bridge, ride it over the pit, and keep climbing.', '等待移動橋、越過深坑，再繼續攀登。'];
  } else if (variant === 20) {
    map = ['##############','#H.P...Z.....#','#c.P.........#','##############'];
    objective = { satisfyCircuit:true, activateAllPlates:true, openAllRuneGates:true, companionMoves:2 }; extras = { switchesRequired:2, livePlates:true, dynamicCircuit:true, companionDir:'E' };
    reference = { main:[A('companionHold'),R(L(2),[A('move')]),R(L(2),[A('companionMove')])], functions:{} }; blocks = 5;
    objectiveText = ['Coordinate hero and companion on two live plates.', '協調英雄與夥伴同時站上兩個即時壓力板。'];
  } else if (variant === 21) {
    map = ['#############','#HoPZ.....>.#','#...........#','#############'];
    objective = { placeAllOrbsOnPlates:true, openAllRuneGates:true, reachExit:true }; extras = { switchesRequired:1, livePlates:true, dynamicCircuit:true };
    reference = { main:[A('take'),A('move'),A('throw'),R(L(8),[A('move')])], functions:{} }; blocks = 5;
    objectiveText = ['Carry a rune core onto a live plate and keep climbing.', '把符文核心搬上即時壓力板並繼續攀登。'];
  } else if (variant === 22) {
    map = ['############','#cH......>.#','#..........#','#....A.....#','############'];
    objective = { reachExit:true, minHp:5, callbacksTriggered:1 }; extras = { companionDir:'E' };
    reference = { main:[ON('danger','brace'),A('move')], functions:{ brace:[A('companionGuard')] } }; blocks = 3;
    objectiveText = ['Register a danger callback and cross the archer lane safely.', '註冊危險回呼並安全穿過弓手通道。'];
  } else if (variant === 23) {
    map = ['##############','#H...Z.....>.#','#c..L........#','##############'];
    objective = { activateAllLevers:true, openAllRuneGates:true, reachExit:true, companionMoves:2 }; extras = { switchesRequired:1, companionDir:'E' };
    reference = { main:[A('companionHold'),R(L(2),[A('companionMove')]),A('companionInteract'),R(L(10),[A('move')])], functions:{} }; blocks = 6;
    objectiveText = ['Send the companion to power a separate tower circuit.', '派夥伴去啟動獨立的高塔迴路。'];
  } else if (variant === 24) {
    map=['############','#H.Z.....>.#','#..........#','############']; objective={signalsSent:1,openAllRuneGates:true,reachExit:true}; extras={signalGateChannel:'ready'};
    reference={main:[SIG('hero','ready'),R(L(8),[A('move')])],functions:{}}; blocks=3; objectiveText=['Send READY to open the relay gate.','傳送 READY 打開中繼閘門。'];
  } else if (variant === 25) {
    map=['############','#H.......>.#','#c.........#','############']; objective={signalsSent:1,callbacksTriggered:1,companionMoves:1,reachExit:true}; extras={companionDir:'E'};
    reference={main:[A('companionHold'),ON('signal','go'),SIG('hero','help'),A('move')],functions:{go:[A('companionMove')]}}; blocks=5; objectiveText=['Use a signal callback to move the companion.','使用訊號回呼移動夥伴。'];
  } else if (variant === 26) {
    map=['#############','#H..Z.....>.#','#c..........#','#############']; objective={signalsSent:1,openAllRuneGates:true,reachExit:true}; extras={companionDir:'E',signalGateChannel:'switch'};
    reference={main:[SIG('companion','switch'),R(L(9),[A('move')])],functions:{}}; blocks=3; objectiveText=['Let the companion signal the relay gate.','讓夥伴向中繼閘門傳送訊號。'];
  } else if (variant === 27) {
    map=['############','#H.......>.#','#c.........#','#....A.....#','############']; objective={signalsSent:1,callbacksTriggered:2,reachExit:true,minHp:4}; extras={companionDir:'E'};
    reference={main:[A('companionHold'),ON('signal','go'),ON('danger','brace'),SIG('hero','ready'),A('move')],functions:{go:[A('companionMove')],brace:[A('companionGuard')]}}; blocks=7; objectiveText=['Keep two handlers active while crossing the relay lane.','穿越中繼通道時同時維持兩個處理函式。'];
  } else if (variant === 28) {
    map=['##########','#H.G.....#','##########']; objective={defeatAll:true,stateChanges:1,heroState:'attack'}; extras={heroState:'explore'};
    reference={main:[IF(B('===',P('hero.state'),L('explore')),[A('move'),STATE('hero','attack')],[A('attack')])],functions:{}}; blocks=4; objectiveText=['Keep a hero combat state across tower turns.','讓英雄戰鬥狀態跨高塔回合保留。'];
  } else if (variant === 29) {
    map=['##########','#H.......#','#c.......#','##########']; objective={signalsSent:2,callbacksTriggered:2,companionMoves:2,messageSequence:['ready','switch']}; extras={companionDir:'E'};
    reference={main:[A('companionHold'),ON('signal','receive'),SIG('hero','ready'),SIG('hero','switch')],functions:{receive:[A('companionMove')]}}; blocks=5; objectiveText=['Queue READY then SWITCH and process both in FIFO order.','依先進先出順序處理 READY 與 SWITCH。'];
  } else if (variant === 30) {
    map=['###############','#H..Z......E..#','#####.#########','#c............#','###############']; objective={signalsSent:2,openAllRuneGates:true,reachExit:true,companionMoves:3,companionState:'regroup'}; extras={companionDir:'E',signalGateChannels:['switch','ready']};
    reference={main:[A('companionHold'),STATE('companion','regroup'),R(L(3),[A('companionMove')]),SIG('companion','switch'),SIG('hero','ready'),R(L(10),[A('move')])],functions:{}}; blocks=8; objectiveText=['Split the actors and pair two protocol signals to unlock the route.','分開兩個角色並配對兩個協定訊號解鎖路線。'];
  } else {
    map=['###############','#H..Z......E..#','###############','#cL...........#','###############']; objective={callbacksTriggered:1,companionInteractions:1,openAllRuneGates:true,reachExit:true,signalsSent:1}; extras={companionDir:'E',switchesRequired:1};
    reference={main:[A('companionHold'),ON('signal','remote'),SIG('hero','switch'),R(L(10),[A('move')])],functions:{remote:[A('companionInteract')]}}; blocks=6; objectiveText=['Trigger an isolated companion switch through a cross-room callback.','用跨房回呼觸發隔離房間中的夥伴開關。'];
  }
  return freezeLevel({
    id: 'endless-' + String(f).padStart(4, '0'), endless: true, floor: f, region: REGIONS.tower,
    title: ['Infinite Tower · Floor ' + f, '無限高塔・第 ' + f + ' 層'], concept: ['Mixed practice', '綜合練習'],
    objectiveText, map, heroDir: 'E', objective, ...extras,
    available: { actions: BASIC.concat(RPG, PARTY, WORLD, COMPANION), logic: LOGIC_CORE.concat(LOGIC_WORLD) },
    requires: f > 3 ? ['repeat'].filter(() => variant < 5) : [], maxBlocks: Math.max(8, blocks + 4), parBlocks: blocks,
    reward: endlessReward(f), reference
  });
}
