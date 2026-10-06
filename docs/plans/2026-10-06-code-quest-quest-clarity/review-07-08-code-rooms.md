# Slices 07–08 review: code-room hints (approved by Papa 2026-10-06)

Same rules as the card rooms: gentle on the quest card, strong after the first stuck moment, near leads into a peek at the first 3 lines of the real solution. API names stay in English in both languages. No hit counts: where the room is about counting (q28, q32, q33) the hint points at the property that gives the number.

## q22 IF / ELSE Gate / 如果／否則之門 — If + Else · hard

| | EN | 中文 |
|---|---|---|
| gentle | One rule, run every turn: what should the hero do when something is in the way, and when not? | 一條規則，每回合都執行：前面有東西時要做什麼？沒有時又要做什麼？ |
| strong | Use if … else: attack when hero.seesEnemyAhead(), otherwise move. Run it each turn. | 用 if … else：hero.seesEnemyAhead() 時攻擊，不然就前進。每回合執行一次。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q23 Two Runes / 兩個自訂函式 — Rune · hard

| | EN | 中文 |
|---|---|---|
| gentle | Two jobs in this room: opening the door and fighting. Each can be its own function. | 這個房間有兩件事：開門和戰鬥。每件事都可以做成自己的函式。 |
| strong | Define function unlock() to open the door and function strike() to fight, then call each where needed. | 定義 function unlock() 開門、function strike() 戰鬥，再在需要的地方呼叫它們。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q24 Dungeon Script / 地下城腳本 — If + Else + Rune · hard

| | EN | 中文 |
|---|---|---|
| gentle | Things block the path at different moments. Check before every step. | 路上不同時候會有東西擋住。每走一步前先檢查。 |
| strong | Make advance(): wait if hero.isBlockedAhead(), else move. Use if … else for the armor and the trap too. | 做一個 advance()：hero.isBlockedAhead() 時等待，不然就前進。盔甲和陷阱也用 if … else。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q25 Variable Steps / 變數步伐 — Variable · medium

| | EN | 中文 |
|---|---|---|
| gentle | Both corridors are the same length. Write that length down once. | 兩條走廊一樣長。把這個長度只寫一次。 |
| strong | Store it with let steps = …; then use repeat(steps, …) for both walks. | 用 let steps = …; 記下來，兩段路都用 repeat(steps, …)。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q26 Parameter Passage / 參數通道 — Parameter + Return · hard

| | EN | 中文 |
|---|---|---|
| gentle | The two walks have different lengths. One walk function can take the length as a number. | 兩段路長度不同。一個走路函式可以把長度當成數字收進來。 |
| strong | Write function walk(steps) that repeats hero.move() and ends with return steps. Call it for each corridor. | 寫 function walk(steps)，重複 hero.move()，最後 return steps。每條走廊各呼叫一次。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q27 Return Gate / 回傳之門 — Return + Expression + If · hard

| | EN | 中文 |
|---|---|---|
| gentle | The chest opens only if the walk was long enough. walk() can tell you how far it went. | 走得夠遠，寶箱才會打開。walk() 會告訴你走了多遠。 |
| strong | Keep the answers with let moved = walk(…); add them up, and open only if the total is big enough. | 用 let moved = walk(…); 記下答案，加起來，總數夠大時才打開。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q28 Inspect the Enemy / 讀取敵人狀態 — Variable + Property · hard

| | EN | 中文 |
|---|---|---|
| gentle | How many attacks does the goblin need? The game can tell you — no guessing. | 哥布林要打幾下？遊戲可以告訴你，不用猜。 |
| strong | let hits = enemy.hp / hero.weapon.damage; then repeat(hits, …) with hero.attack(). | let hits = enemy.hp / hero.weapon.damage; 再用 repeat(hits, …) 執行 hero.attack()。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q29 Inventory Logic / 背包邏輯 — Property + If · hard

| | EN | 中文 |
|---|---|---|
| gentle | Healing only helps when you are hurt and still have a potion. | 只有受傷而且還有藥水時，治療才有用。 |
| strong | One if with two checks that must both be true: hero.hp is low and hero.inventory.healing is above 0. | 一個 if 裡有兩個都要成立的檢查：hero.hp 偏低，而且 hero.inventory.healing 大於 0。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q30 Rune Warden / 符文守衛 — Parameter + Return + Variable + Property + If · hard

| | EN | 中文 |
|---|---|---|
| gentle | The Warden has armor, warns before it shoots, and its HP changes. Read enemy instead of guessing. | 守衛有盔甲、射擊前會警告，生命值也會變。讀取 enemy，不要用猜的。 |
| strong | Write strike(times): heavyAttack if enemy.armor is above 0, else attack. Guard if enemy.incoming. | 寫 strike(times)：enemy.armor 大於 0 就 heavyAttack，不然就 attack。enemy.incoming 時防禦。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q31 Enemy Collection / 敵人集合 — Variable + Property + Repeat · hard

| | EN | 中文 |
|---|---|---|
| gentle | Two guardians wait in the hall. enemies.length can count them for you. | 走廊裡有兩個守衛。enemies.length 可以幫你數。 |
| strong | let foes = enemies.length; then repeat(foes, …) with move, attack, move inside. | let foes = enemies.length; 再用 repeat(foes, …)，裡面放前進、攻擊、前進。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q32 Indexed Target / 索引目標 — Variable + Property + Target · hard

| | EN | 中文 |
|---|---|---|
| gentle | The goblin is out of sword reach, but not out of spell reach. Pick it from the enemies list. | 哥布林在劍打不到的地方，但法術打得到。從 enemies 清單裡選它。 |
| strong | Read enemies[0].hp into a variable, hero.target(0), then repeat hero.cast() that many times. | 把 enemies[0].hp 存進變數，hero.target(0)，再重複 hero.cast() 那麼多次。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q33 Element Match / 元素配對 — Property · hard

| | EN | 中文 |
|---|---|---|
| gentle | With the Ember Wand, fire hits the frost creature hard. The ember one resists it. | 用餘燼魔杖時，火對冰霜生物特別有效。餘燼生物會抵抗它。 |
| strong | hero.targetElementWeak() and cast first; then hero.targetNearest() and cast as often as enemies[0].hp. | 先 hero.targetElementWeak() 再施法；然後 hero.targetNearest()，施法次數照 enemies[0].hp。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q34 Freeze the Turn / 凍結回合 — Property · medium

| | EN | 中文 |
|---|---|---|
| gentle | Frost can freeze the guardian so it skips its next turn. | 冰霜可以把守衛凍住，讓它跳過下一回合。 |
| strong | hero.targetNearest(), hero.cast() to freeze it, then hero.move() while it is frozen. | hero.targetNearest()，hero.cast() 把它凍住，趁它被凍住時 hero.move()。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q35 Target Algorithm / 目標演算法 — Variable + Property + Repeat · hard

| | EN | 中文 |
|---|---|---|
| gentle | Take out the armored enemy first; the weaker ones are easier after. | 先打倒有盔甲的敵人，之後弱的就簡單了。 |
| strong | hero.targetArmored() and cast, then repeat(enemies.length - 1, …) with targetWeakest and cast. | hero.targetArmored() 再施法，然後 repeat(enemies.length - 1, …)，裡面 targetWeakest 再施法。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q36 Nexus Array / 樞紐陣列 — Parameter + Return + Variable + Property + If · hard

| | EN | 中文 |
|---|---|---|
| gentle | Three foes, different elements. One function can pick the best target each time. | 三個敵人，元素都不同。一個函式可以每次挑最好的目標。 |
| strong | In clear(count): targetElementWeak; cast if isTargetElementWeak(), else targetWeakest and cast. | 在 clear(count) 裡：targetElementWeak；isTargetElementWeak() 時施法，不然 targetWeakest 再施法。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q37 Relic Readout / 遺物讀值 — Variable + Property · hard

| | EN | 中文 |
|---|---|---|
| gentle | The gate checks your relic. Read hero.weapon to see what you carry. | 閘門會檢查你的遺物。讀取 hero.weapon 看看你帶了什麼。 |
| strong | let rank = hero.weapon.rarityRank; walk through only if rank is 1 or more. | let rank = hero.weapon.rarityRank; 只有 rank 至少是 1 時才走過去。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q38 For Each Foe / 逐一敵人 — for…of · medium

| | EN | 中文 |
|---|---|---|
| gentle | Three slimes in a row. Let a loop visit each one for you. | 一排三隻史萊姆。讓迴圈幫你一隻一隻處理。 |
| strong | for (const foe of enemies) { hero.target(foe); hero.cast(); } then walk to the exit. | for (const foe of enemies) { hero.target(foe); hero.cast(); } 然後走到出口。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q39 Inspect Each / 逐一檢查 — for…of + Field + If + Expression · hard

| | EN | 中文 |
|---|---|---|
| gentle | Not every foe is weak to your element. Check each one inside the loop. | 不是每個敵人都怕你的元素。在迴圈裡逐一檢查。 |
| strong | In for…of: one cast if foe.weakTo === hero.weapon.element, else cast more than once. | 在 for…of 裡：foe.weakTo === hero.weapon.element 時施法一次，不然多施法幾次。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q40 Affix Logic / 詞綴邏輯 — Property + If · hard

| | EN | 中文 |
|---|---|---|
| gentle | Your weapon's rarity and affixes are numbers the code can read. | 武器的稀有度和詞綴，都是程式讀得到的數字。 |
| strong | Read hero.weapon.affixCount and rarityRank; walk affixes + 3 steps, then turn right. | 讀取 hero.weapon.affixCount 和 rarityRank；走 affixes + 3 步，再右轉。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q41 Party Function / 隊伍函式 — for…of + Parameter · hard

| | EN | 中文 |
|---|---|---|
| gentle | Same job for every foe. Put it in a function that takes the foe. | 每個敵人都做同一件事。把它放進一個收下 foe 的函式。 |
| strong | function strike(foe) { hero.target(foe); hero.cast(); } then call strike(foe) inside for…of. | function strike(foe) { hero.target(foe); hero.cast(); } 再在 for…of 裡呼叫 strike(foe)。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q42 Relic Hydra / 遺物多頭獸 — for…of + Field + If + Expression · hard

| | EN | 中文 |
|---|---|---|
| gentle | Some escorts are tougher than others. foe.maxHp tells you which. | 有些護衛比較強。foe.maxHp 會告訴你是哪些。 |
| strong | In for…of, target each foe; cast more at a foe with a big maxHp, once at the small ones. | 在 for…of 裡鎖定每個敵人；maxHp 大的多施法幾次，小的施法一次。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q44 Pressure State / 壓力狀態 — Property + If · hard

| | EN | 中文 |
|---|---|---|
| gentle | The gate opens when the plate is pressed. The world can tell you if it worked. | 踩下壓力板，閘門就會打開。世界會告訴你有沒有成功。 |
| strong | Walk onto the plate, read hero.world.switchesActive, and go through only if it is at least 1. | 走上壓力板，讀取 hero.world.switchesActive，至少是 1 才走過去。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q47 Mechanism Function / 機關函式 — Rune + If · hard

| | EN | 中文 |
|---|---|---|
| gentle | A lever and a crate block the way. One routine can handle whatever is in front. | 拉桿和木箱擋住了路。一個函式可以處理前面的任何東西。 |
| strong | In clear(): interact if hero.seesLeverAhead(), smash if hero.seesBreakableAhead(). Call it after each step. | function clear()：hero.seesLeverAhead() 就互動，hero.seesBreakableAhead() 就擊破。每走一步呼叫一次。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q48 Circuit Guardian / 迴路守衛 — Property + If + Repeat · hard

| | EN | 中文 |
|---|---|---|
| gentle | Both mechanisms must be on before the Guardian can be hurt. | 兩個機關都啟動後，才能打傷守衛。 |
| strong | Pull the lever, step on the plate, then compare switchesActive with switchesRequired before fighting. | 拉下拉桿、踩上壓力板，戰鬥前先比較 switchesActive 和 switchesRequired。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q49 Boolean Gate / 布林閘門 — Property + If · hard

| | EN | 中文 |
|---|---|---|
| gentle | Exactly two levers — not one, not three. | 剛好兩個拉桿——不是一個，也不是三個。 |
| strong | Interact with two levers, then check hero.world.switchesActive === 2 before crossing. | 和兩個拉桿互動，通過前檢查 hero.world.switchesActive === 2。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q50 Clock Trap / 時鐘陷阱 — If + Else · hard

| | EN | 中文 |
|---|---|---|
| gentle | The clock trap turns on and off. Waiting can be the right move. | 循環陷阱會開開關關。有時候等待才是對的。 |
| strong | If a clock trap is ahead: wait while it is active, else move. No trap: move. Run it each turn. | 前面有循環陷阱時：啟動中就等待，不然前進。沒有陷阱就前進。每回合執行一次。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q51 Push Compiler / 推箱編譯器 — Repeat · hard

| | EN | 中文 |
|---|---|---|
| gentle | The plate needs something heavy on it. The stone block can be pushed. | 壓力板上要放重的東西。石塊可以推。 |
| strong | Walk next to the block, face it and hero.push() it onto the plate, then go around to the stairs. | 走到石塊旁邊，面向它，用 hero.push() 推上壓力板，再繞到樓梯。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q52 Moving Bridge / 移動橋 — If + Else · hard

| | EN | 中文 |
|---|---|---|
| gentle | The bridge moves. Wait for it, step on, and ride it across. | 橋會移動。等它來，踩上去，坐它過去。 |
| strong | If hero.seesPlatformAhead(), move; else wait when blocked, otherwise move. Run it each turn. | hero.seesPlatformAhead() 時前進；不然被擋住就等待，沒擋住就前進。每回合執行一次。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q53 Quest State / 任務狀態 — Property + Rune · hard

| | EN | 中文 |
|---|---|---|
| gentle | The guide gives you a quest: start it, fetch the token, and come back. | 嚮導給你一個任務：開始任務、拿到符記，再回來。 |
| strong | Talk to the guide, check hero.world.questsStarted, fetch the token, come back, and talk again. | 和嚮導說話，檢查 hero.world.questsStarted，拿到符記，回來再說一次話。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q54 Companion Protocol / 夥伴協定 — If + Companion · hard

| | EN | 中文 |
|---|---|---|
| gentle | Your companion can follow you and help in a fight. Tell it what to do. | 夥伴可以跟著你，也能幫忙戰鬥。告訴它要做什麼。 |
| strong | Start with companion.follow(); when hero.seesEnemyAhead(), companion.assist() then hero.attack(). | 先 companion.follow()；hero.seesEnemyAhead() 時，companion.assist() 再 hero.attack()。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q55 Twin Plates / 雙人壓板 — Repeat + Companion · hard

| | EN | 中文 |
|---|---|---|
| gentle | Two plates must be pressed at the same time — one for each of you. | 兩塊壓力板要同時踩下——你們各踩一塊。 |
| strong | companion.hold() first, then walk the hero onto one plate and the companion onto the other. | 先 companion.hold()，再讓英雄走上一塊壓力板，夥伴走上另一塊。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q56 Scout Circuit / 偵察迴路 — Rune + Companion · hard

| | EN | 中文 |
|---|---|---|
| gentle | The lever is in the companion's lane, not the hero's. | 拉桿在夥伴的路上，不在英雄的路上。 |
| strong | Write function scout(): companion.hold(), move it down its lane, companion.interact(). Then walk the hero. | 寫 function scout()：companion.hold()，讓它走自己的路，companion.interact()。再讓英雄走。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q57 Rune Core Carry / 符文核心搬運 — If + Property · hard

| | EN | 中文 |
|---|---|---|
| gentle | The plate wants the rune core on it. Pick it up and throw it there. | 壓力板上要放符文核心。拿起來，丟過去。 |
| strong | If hero.seesCarryableAhead(), take; move; if hero.isCarrying(), throw. Check orbsOnPlates, then go. | hero.seesCarryableAhead() 就拿起；前進；hero.isCarrying() 就投擲。檢查 orbsOnPlates 再走。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q58 Core Relay / 核心接力 — Companion + If · hard

| | EN | 中文 |
|---|---|---|
| gentle | Hand the core to your companion — the plate is on its side. | 把核心交給夥伴——壓力板在它那一邊。 |
| strong | hero.take() and hero.throw() to the companion; then companion.take(), turn, move and companion.throw(). | hero.take() 再 hero.throw() 給夥伴；然後 companion.take()、轉向、前進、companion.throw()。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q59 Danger Callback / 危險回呼 — Event + Companion · hard

| | EN | 中文 |
|---|---|---|
| gentle | You don't have to guard by hand. Tell the game what to do when danger comes. | 不用自己防禦。告訴遊戲危險來時要做什麼。 |
| strong | Write function brace() with companion.guard(), register on("danger", brace) once, then move. | 寫 function brace()，裡面 companion.guard()，註冊一次 on("danger", brace)，再前進。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q60 Twin Core Compiler / 雙核心編譯器 — Property + Rune + Companion · hard

| | EN | 中文 |
|---|---|---|
| gentle | Two plates, one core and the companion. Power the circuit before you fight. | 兩塊壓力板、一顆核心和夥伴。戰鬥前先讓迴路通電。 |
| strong | Write power() to put the core and the companion on the plates; check circuitSatisfied, then fight. | 寫 power() 把核心和夥伴放上壓力板；檢查 circuitSatisfied，再戰鬥。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q61 Ping Gate / 訊號閘門 — Signal · medium

| | EN | 中文 |
|---|---|---|
| gentle | The relay gate listens for a message. | 中繼閘門在等一個訊息。 |
| strong | Send it with hero.signal("ready"), then walk through the gate. | 用 hero.signal("ready") 送出訊息，再走過閘門。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q62 Answer Back / 回覆訊號 — Signal + Event + Companion · hard

| | EN | 中文 |
|---|---|---|
| gentle | Your companion can answer a message by itself. | 夥伴可以自己回應訊息。 |
| strong | Write answer() with companion.move(); register on("signal", answer); then hero.signal("help"). | 寫 answer()，裡面 companion.move()；註冊 on("signal", answer)；再 hero.signal("help")。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q63 Two Watchers / 雙重監看 — Signal + Event + Companion · hard

| | EN | 中文 |
|---|---|---|
| gentle | Two things to watch: messages and arrows. Each needs its own handler. | 要注意兩件事：訊息和弓箭。每件事都要有自己的處理器。 |
| strong | Register on("signal", advance) and on("danger", brace), send hero.signal("ready"), then move. | 註冊 on("signal", advance) 和 on("danger", brace)，送出 hero.signal("ready")，再前進。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q64 Companion Relay / 夥伴中繼 — Signal + Companion · hard

| | EN | 中文 |
|---|---|---|
| gentle | This time the companion sends the message. | 這次由夥伴送出訊息。 |
| strong | companion.signal("switch") opens the relay; then walk the hero through. | companion.signal("switch") 會打開中繼閘門；再讓英雄走過去。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q65 Message Router / 訊息路由器 — Signal + Event + Property · hard

| | EN | 中文 |
|---|---|---|
| gentle | The handler can read which message came last, and choose. | 處理器可以讀取最後收到的是哪個訊息，再做選擇。 |
| strong | In route(): if hero.signal.last === "help", companion.move(); else companion.hold(). Then send help. | 在 route() 裡：hero.signal.last === "help" 時 companion.move()；不然 companion.hold()。再送出 help。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q66 Automation Core / 自動化核心 — Signal + Event + Rune + Companion · hard

| | EN | 中文 |
|---|---|---|
| gentle | Give each job its own function: send, follow, guard. | 每件事都做成自己的函式：送訊息、跟隨、防禦。 |
| strong | boot() sends ready, sync() moves the companion, brace() guards. Register sync and brace, then boot(). | boot() 送出 ready，sync() 讓夥伴移動，brace() 防禦。註冊 sync 和 brace，再 boot()。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q67 Hero State / 英雄狀態 — State + Property · hard

| | EN | 中文 |
|---|---|---|
| gentle | The hero remembers a mode. Explore first, then switch to attack. | 英雄會記住一個模式。先探索，再切換成攻擊。 |
| strong | If hero.state === "explore": move and set hero.state = "attack"; else attack. Run it each turn. | hero.state === "explore" 時：前進並設定 hero.state = "attack"；不然就攻擊。每回合執行一次。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q68 Companion State / 夥伴狀態 — State + Property + Companion · hard

| | EN | 中文 |
|---|---|---|
| gentle | The companion has its own mode, separate from the hero's. | 夥伴有自己的模式，和英雄分開。 |
| strong | If companion.state === "wait": set it to "regroup" and move; else move. Run it each turn. | companion.state === "wait" 時：設成 "regroup" 並前進；不然就前進。每回合執行一次。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q69 Message Queue / 訊息佇列 — Signal + Event + Companion · hard

| | EN | 中文 |
|---|---|---|
| gentle | Messages wait in line and arrive in the order you send them. | 訊息會排隊，照你送出的順序抵達。 |
| strong | Register on("signal", receive) with companion.move() inside, then send "ready" before "switch". | 註冊 on("signal", receive)，裡面 companion.move()，再先送 "ready"，後送 "switch"。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q70 Split Corridors / 分岔走廊 — Signal + State + Companion · hard

| | EN | 中文 |
|---|---|---|
| gentle | Two corridors: the companion takes the lower one. Both signals open the way. | 兩條走廊：夥伴走下面那條。兩個訊號一起才會開路。 |
| strong | Set companion.state, move it down its corridor, companion.signal("switch"), then hero.signal("ready"). | 設定 companion.state，讓它走自己的走廊，companion.signal("switch")，再 hero.signal("ready")。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q71 Remote Switch / 遠端開關 — Signal + Event + Companion · hard

| | EN | 中文 |
|---|---|---|
| gentle | The lever is in another room. Your companion can pull it when you call. | 拉桿在另一個房間。你一呼叫，夥伴就能拉它。 |
| strong | remote() does companion.interact(); register on("signal", remote), send "switch", then walk. | remote() 執行 companion.interact()；註冊 on("signal", remote)，送出 "switch"，再前進。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

## q72 Dual Processor / 雙處理器 — State + Signal + Event + Rune + Companion + Property · hard

| | EN | 中文 |
|---|---|---|
| gentle | Everything at once: states, two signals, the companion and the golem. Plan it step by step. | 全部一起來：狀態、兩個訊號、夥伴和魔像。一步一步計畫。 |
| strong | plan(): while exploring, send ready and switch, then go to attack; else target and cast in range. | plan()：探索時送出 ready 和 switch，再切換成攻擊；不然鎖定目標，在射程內施法。 |
| near | Nearly! Your code can start like this: | 快成功了！程式可以這樣開始： |

