/* Minecraft Evolution Book — 18 topics, 4 bilingual blocks each (one block per magazine mini-page).
   Source: docs/plans/2026-07-28-books/42-minecraft-evolution-book.md
   Layout: magazine mini-pages, 2 per turn, see docs/plans/2026-07-28-books/47-minecraft-two-per-turn-layout.md

   2026-07-29: the original 25 short topics were merged down to 18 longer ones
   (origins+inspirations+Classic became one, survival+creeper one, Indev+Infdev one,
   Alpha+Nether one, Beta+1.0 one, drop-era+2024 one). Each surviving block carries
   the merged text, so no page is a single thin sentence any more.

   Per-topic magazine furniture (all optional, all bilingual):
     era      {en,zh}   small era label printed under the spread number
     image    path      hero image, also used by the thumbnail grid
     images   [path]    one image per mini-page: [hero, page2, page3, page4]
     stat     {value,en,zh}   big-number badge floating on the photo page
     tip      {en,zh}   "PRO TIP" card on text page 2
     fact     {en,zh}   "DID YOU KNOW" card on text page 3
     keys     [{en,zh}] 3-4 feature chips under the pull quote on page 4
     items    [name]    inline SVG pixel-item decorations (see minecraft-magazine.js) */

var MINECRAFT_SPREADS = [
  {
    id: "spread-01",
    titleEN: "Cave Game: How Minecraft Began",
    titleZH: "Cave Game：Minecraft 的起點",
    era: { en: "2009 · The prototype", zh: "2009 · 原型時期" },
    image: "../assets/books/minecraft/minecraft-java-bedrock.jpg",
    images: [
      "../assets/books/minecraft/minecraft-java-bedrock.jpg",
      "../assets/books/minecraft/whats-happening.jpg",
      "../assets/books/minecraft/vanilla-wallpaper.jpg",
      "../assets/books/minecraft/tips-beginners.jpg"
    ],
    items: ["pickaxe", "grass", "torch"],
    stat: { value: "17 MAY", en: "2009 — the first public build goes live", zh: "2009 年，第一個公開版本上線" },
    tip: { en: "Starting a brand-new world? Punch a tree first. Wood becomes planks, planks become sticks and a crafting table, and that little 3×3 grid unlocks almost everything else in the game.", zh: "開始一個全新世界時，先揍一棵樹。木頭變木板，木板變木棒和工作台，而那個小小的 3×3 格線幾乎能解鎖遊戲裡的所有東西。" },
    fact: { en: "The game was only called Cave Game for a few days. By the end of May 2009 it already had the name we use today — and it was free to play in a browser window.", zh: "這款遊戲只叫過幾天 Cave Game。到了 2009 年 5 月底，它已經有了我們今天使用的名字，而且可以在瀏覽器裡免費遊玩。" },
    keys: [
      { en: "Cave Game prototype", zh: "Cave Game 原型" },
      { en: "Break and place", zh: "破壞與放置" },
      { en: "Public development", zh: "公開開發" },
      { en: "Classic in a browser", zh: "瀏覽器裡的 Classic" }
    ],
    blocks: [
      { en: "May 2009. A Swedish programmer named Markus \"Notch\" Persson starts a small side project he calls Cave Game. It has no story, no levels, no boss and no ending — just a grid of cubes and a player who is allowed to dig. The rule underneath everything sounds almost too plain to be exciting: any block you can see, you can remove, carry away, and put back somewhere better. Break, hold, build. Every update for the next seventeen years is bolted onto that one loop.", zh: "2009 年 5 月。瑞典程式設計師 Markus「Notch」Persson 開始一個他稱為 Cave Game 的小副業。它沒有故事、沒有關卡、沒有頭目，也沒有結局，只有一片方塊格線和一個被允許挖掘的玩家。支撐一切的規則簡單到聽起來沒什麼趣味：任何你看得見的方塊，都可以移除、帶走，再放到更好的位置。破壞、持有、建造。之後十七年的每一次更新，都是接在這個循環上。" },
      { en: "Minecraft did not appear out of nowhere. Notch had spent years making prototypes and entering game jams, and three games in particular left fingerprints on it. Infiniminer showed how satisfying it feels to dig and stack blocks in a shared world. Dwarf Fortress showed that deep simulation can produce stories nobody wrote. Dungeon Keeper showed that the space under the ground can be the best part of a game. Minecraft is not a copy of any of them — it is a new mixture of borrowed parts, held together by an unusually clear action loop.", zh: "Minecraft 不是憑空出現的。Notch 花了多年製作原型、參加遊戲創作比賽，而其中三款遊戲特別留下了印記。Infiniminer 展示了在共享世界裡挖掘與堆疊方塊有多過癮。Dwarf Fortress 展示了深層模擬能生出沒人寫過的故事。Dungeon Keeper 展示了地底空間可以是一款遊戲最棒的部分。Minecraft 不是其中任何一款的複製品，而是把借來的零件重新混合，再用異常清楚的操作循環固定起來。" },
      { en: "17 May 2009: the first public build goes online, free, in a browser window. This version, later called Classic, has no crafting, no hunger, no health and almost no danger. The world is flat by modern standards and the whole game is a hand that moves blocks. And yet players who came for five minutes stayed for five hours making castles. Screenshots spread across forums, players invented contests and pixel art and underground cities the game never asked for, and their experiments started steering what got added next. Players here were not customers waiting for a product — they were part of development.", zh: "2009 年 5 月 17 日：第一個公開版本上線，免費，就在瀏覽器視窗裡。這個後來被稱為 Classic 的版本沒有合成、沒有飢餓、沒有生命值，也幾乎沒有危險。以現代標準看，世界很平坦，整個遊戲就是一隻會搬方塊的手。然而本來只想玩五分鐘的玩家，留下來蓋了五小時的城堡。截圖在論壇之間流傳，玩家發明了遊戲從未要求的建造比賽、像素畫和地下城市，而他們的實驗開始引導接下來要加入什麼。這裡的玩家不是等待產品的顧客，而是開發的一部分。" },
      { en: "Minecraft does not begin as a story to finish. It begins as a question: what do you want to make?", zh: "Minecraft 一開始不是一個等你完成的故事，而是一個問題：你想做什麼？" }
    ]
  },
  {
    id: "spread-02",
    titleEN: "Survival Test And The Creeper",
    titleZH: "生存測試與苦力怕",
    era: { en: "Late 2009 · Danger arrives", zh: "2009 年末 · 危險登場" },
    image: "../assets/books/minecraft/2022-wild-update.jpg",
    images: [
      "../assets/books/minecraft/2022-wild-update.jpg",
      "../assets/books/minecraft/2024-garden-awakens.jpg",
      "../assets/books/minecraft/tips-beginners.jpg",
      "../assets/books/minecraft/vanilla-wallpaper.jpg"
    ],
    items: ["heart", "sword", "tnt"],
    stat: { value: "1.5 s", en: "the fuse you get after the hiss", zh: "聽見嘶聲後，你只剩這麼久" },
    tip: { en: "On night one, do not build a mansion. Dig three blocks into a hillside, seal the doorway behind you, and place a single torch. Monsters burn in daylight, so you can be brave again in the morning.", zh: "第一個晚上不要蓋豪宅。往山坡裡挖三格，把入口封起來，放一支火把。怪物在日光下會燃燒，所以早上你就能重新勇敢起來。" },
    fact: { en: "The creeper exists because of a modelling mistake: the pig's height and length were entered the wrong way round. The tall, thin, armless result was too good to delete.", zh: "苦力怕的存在來自一個建模錯誤：豬的高度和長度被輸入反了。那個又高又瘦、沒有手臂的結果，好到捨不得刪掉。" },
    keys: [
      { en: "Health and damage", zh: "生命值與傷害" },
      { en: "Hostile mobs", zh: "敵對生物" },
      { en: "Night and shelter", zh: "夜晚與庇護所" },
      { en: "A famous accident", zh: "一場著名的意外" }
    ],
    blocks: [
      { en: "Late 2009. Survival Test adds the things a building toy never needed: a health bar, monsters that spawn in the dark, and a night that arrives whether you are ready or not. Nothing about the blocks changes, but everything about their meaning does. A wall stops being decoration and becomes shelter. A hole stops being a hole and becomes a hiding place. A torch stops being pretty and becomes the difference between a quiet night and a very loud one.", zh: "2009 年末。生存測試加入建造玩具本來不需要的東西：生命條、在黑暗中生成的怪物，以及不管你準備好沒有都會到來的夜晚。方塊本身沒有任何改變，但它們的意義全變了。牆不再是裝飾，而成為庇護所。洞不再只是洞，而成為藏身處。火把不再只是好看，而成為安靜夜晚與吵鬧夜晚之間的分界。" },
      { en: "Players immediately start swapping survival stories instead of only screenshots of buildings: the night they ran out of torches, the first time they heard a skeleton behind them in a cave, the mine they sealed and never found again. Creative freedom turns out to get stronger, not weaker, when the world is allowed to push back — a house means something only when something outside wants in.", zh: "玩家立刻開始交換生存故事，而不只是建築截圖：火把用完的那個晚上、第一次在洞穴裡聽見身後骷髏的那一刻、封起來就再也找不到的礦坑。事實證明，當世界被允許反抗時，創造的自由會變得更強，而不是更弱。房子之所以有意義，是因為外面有東西想進來。" },
      { en: "And then there is the creeper. A pig model built with its height and length swapped by accident becomes a tall, thin, armless green thing that should have been deleted. Instead it becomes the most recognisable monster in the game. It does not roar or chase you across a field — it walks up quietly behind you while you are busy placing blocks, hisses once, and destroys the thing you spent the afternoon building. It attacks your work, not just your health bar. That single decision turns a bug into a mascot, a plush toy, a Halloween costume, and one of the most recognisable shapes in video game history.", zh: "然後是苦力怕。一個意外把高度和長度輸入反了的豬模型，變成一隻又高又瘦、沒有手臂的綠色東西，本來應該被刪掉。結果它成為遊戲裡最容易辨認的怪物。牠不會咆哮，也不會追著你跑過草原，而是在你忙著放方塊時安靜地走到你背後，嘶一聲，然後摧毀你花了一個下午蓋的東西。牠攻擊的是你的作品，不只是你的生命條。就是這一個決定，把一個錯誤變成吉祥物、絨毛玩偶、萬聖節服裝，以及電子遊戲史上最容易辨認的形狀之一。" },
      { en: "A mistake becomes great design the moment it creates an emotion nobody can forget.", zh: "當錯誤創造出沒有人能忘記的情緒時，它就成為偉大的設計。" }
    ]
  },
  {
    id: "spread-03",
    titleEN: "Indev, Infdev, And The Horizon",
    titleZH: "Indev、Infdev 與地平線",
    era: { en: "Dec 2009 – 2010 · Systems and scale", zh: "2009 年 12 月至 2010 年 · 系統與尺度" },
    image: "../assets/books/minecraft/2021-caves-cliffs-p1.jpg",
    images: [
      "../assets/books/minecraft/2021-caves-cliffs-p1.jpg",
      "../assets/books/minecraft/tips-beginners.jpg",
      "../assets/books/minecraft/2025-chase-skies-b.jpg",
      "../assets/books/minecraft/2024-tricky-trials-c.jpg"
    ],
    items: ["crafting", "compass", "bread"],
    stat: { value: "∞", en: "the world keeps generating as you walk", zh: "只要你走，世界就繼續生成" },
    tip: { en: "Always carry a crafting table and a furnace in your bag, and before you leave home build a tall tower of one bright block next to your base. A landmark you can see from far away beats a map you forgot to make.", zh: "背包裡永遠帶著一個工作台和一個熔爐，而且離家之前，在基地旁邊用顯眼的方塊蓋一座高塔。一個遠遠就看得見的地標，勝過一張你忘了做的地圖。" },
    fact: { en: "Minecraft worlds are generated from a seed number, so two players typing the same seed get exactly the same mountains, caves and villages — and the world you are in right now has almost certainly never been seen by anyone else.", zh: "Minecraft 世界是用一個種子數字生成的，所以兩個玩家輸入同一個種子，會得到一模一樣的山脈、洞穴和村莊；而你現在所在的世界，幾乎可以確定沒有其他人看過。" },
    keys: [
      { en: "Crafting grid", zh: "合成格線" },
      { en: "Smelting and hunger", zh: "熔煉與飢餓" },
      { en: "Infinite terrain", zh: "無限地形" },
      { en: "Home and wilderness", zh: "家與荒野" }
    ],
    blocks: [
      { en: "December 2009 into early 2010. Indev — short for \"in development\" — is where Minecraft stops being a sandbox with monsters and becomes a game with a progression you can feel. Crafting arrives, and with it smelting, tools, food, light sources and a proper day-night rhythm. Suddenly the blocks in your inventory are not just building material: they are ingredients, and the 3×3 grid is the machine that turns one thing into another.", zh: "2009 年 12 月到 2010 年初。Indev（「開發中」的縮寫）是 Minecraft 不再只是有怪物的沙盒、而成為一款能感受到成長曲線的遊戲的時刻。合成登場，隨之而來的還有熔煉、工具、食物、光源，以及真正的日夜節奏。你背包裡的方塊突然不只是建材，而是材料，而 3×3 格線就是把一種東西變成另一種東西的機器。" },
      { en: "Players begin memorising recipes, writing them down and sharing them online. A stone pickaxe is not just an item — it is proof that you understood the chain: wood, planks, sticks, table, pickaxe, stone, better pickaxe, iron. Minecraft's systems interlock, and each link pulls you a little further from the safety of the surface. Wood leads to tools, tools lead to stone, stone leads deeper, and deeper is where the game keeps its best rewards.", zh: "玩家開始背誦配方、把它們寫下來，並在網路上分享。石鎬不只是一個道具，而是你理解了整條鏈的證明：木頭、木板、木棒、工作台、鎬、石頭、更好的鎬、鐵。Minecraft 的系統互相咬合，而每一個環節都把你從地表的安全再往外拉一點。木頭導向工具，工具導向石頭，石頭導向更深處，而更深處正是遊戲藏著最好獎勵的地方。" },
      { en: "Then in 2010 comes Infdev — infinite development — which replaces the small bounded map with terrain that keeps generating in every direction as long as you keep walking. The edge of the world quietly disappears. Caves fork under hills, forests run into lakes, and every ridge you climb shows you another one behind it. A new emotional loop appears, and it is the one players still describe first: you build a home, you leave it, you get lost, you survive on nothing, you find your way back with your bag full — and then you make the home better.", zh: "接著在 2010 年，Infdev（無限開發）登場，用一種只要你繼續走就會朝各方向不斷生成的地形，取代了原本有邊界的小地圖。世界的邊緣就這樣悄悄消失了。洞穴在山丘下分岔，森林延伸到湖邊，你爬上的每一道山脊後面都還有另一道。一種新的情感循環出現了，而這也是玩家至今最先描述的那一種：你蓋一個家，你離開它，你迷路，你身無長物地存活，你帶著滿滿的背包找到回家的路，然後你把家蓋得更好。" },
      { en: "Minecraft discovers the loop it will never give up: home and wilderness, taking turns.", zh: "Minecraft 發現了它永遠不會放棄的循環：家與荒野，輪流登場。" }
    ]
  },
  {
    id: "spread-04",
    titleEN: "Alpha, Mojang, And The Nether",
    titleZH: "Alpha、Mojang 與 Nether",
    era: { en: "2010 · A studio and a second world", zh: "2010 · 一間工作室與第二個世界" },
    image: "../assets/books/minecraft/2020-nether-update.jpg",
    images: [
      "../assets/books/minecraft/2020-nether-update.jpg",
      "../assets/books/minecraft/realms-multiplayer.png",
      "../assets/books/minecraft/2010-nether.jpg",
      "../assets/books/minecraft/mojang-stockholm.jpg"
    ],
    items: ["redstone", "torch", "gold"],
    stat: { value: "1 : 8", en: "one Nether block equals eight Overworld blocks", zh: "Nether 走一格，等於主世界走八格" },
    tip: { en: "Playing with friends? Agree on one rule before you start: whose stuff is shared and whose is not. Every good server has that conversation early, and the ones that skip it end in an argument about a missing diamond pickaxe.", zh: "和朋友一起玩嗎？開始前先講好一條規則：哪些東西是共用的、哪些不是。每個好伺服器都會很早進行這場對話，而跳過它的，最後都會為了一把不見的鑽石鎬吵架。" },
    fact: { en: "Because distance in the Nether counts eight times, players use it as a fast-travel subway: a short tunnel there can cross thousands of blocks back home.", zh: "因為 Nether 的距離要算八倍，玩家把它當成快速通行的地鐵：在那裡的一段短隧道，回到主世界可以跨越好幾千格。" },
    keys: [
      { en: "Survival multiplayer", zh: "生存多人模式" },
      { en: "First redstone", zh: "最早的紅石" },
      { en: "Nether portal", zh: "地獄傳送門" },
      { en: "A second dimension", zh: "第二個維度" }
    ],
    blocks: [
      { en: "2010. Minecraft enters Alpha, becomes a paid game, and Mojang is founded around it. A hobby project now has a payroll — and the people who bought in early paid less precisely because it was unfinished, which is an idea almost nobody in games had tried at that scale before.", zh: "2010 年。Minecraft 進入 Alpha，成為付費遊戲，Mojang 也圍繞著它成立。一個興趣專案現在有了薪水單，而早期購買的人之所以付得比較少，正是因為它還沒完成。在那之前，幾乎沒有遊戲公司在這種規模上嘗試過這個做法。" },
      { en: "Animals, hostile mobs, minecarts, rails, the first redstone circuits and a long list of familiar blocks arrive. Most importantly, survival multiplayer arrives: the same world, at the same time, with other people in it. That changes what a Minecraft world is. It stops being a private notebook and becomes a shared canvas, a shared joke, and occasionally a shared argument about who left the door open at night. A world becomes far more meaningful the moment somebody else can remember it too.", zh: "動物、敵對生物、礦車、鐵軌、最早的紅石電路，以及一長串熟悉的方塊登場。最重要的是生存多人模式登場了：同一個世界、同一個時間，裡面還有其他人。這改變了 Minecraft 世界的本質。它不再是私人筆記本，而成為共享的畫布、共享的玩笑，偶爾也是關於「晚上是誰沒關門」的共享爭吵。當另一個人也能記得同一個世界時，那個世界的意義就會大得多。" },
      { en: "Then, on 31 October 2010, the Halloween Update opens a door in the ground. Build a rectangle of obsidian, strike it with flint and steel, and step into a purple haze that leads somewhere the sun has never reached. On the other side: oceans of lava, twisted terrain, glowing stone, mobs that exist nowhere else, and no way to sleep. Players immediately turn it into infrastructure — portal rooms, marked tunnels, ceiling highways — along with a whole genre of story that starts \"we lost everything on the way back.\"", zh: "接著在 2010 年 10 月 31 日，萬聖節更新在地面上打開一道門。用黑曜石堆一個長方形，用打火石點燃它，然後走進通往陽光從未抵達之處的紫色霧氣。另一邊是：岩漿之海、扭曲地形、發光的石頭、其他地方不存在的生物，還有無法睡覺的規則。玩家立刻把它變成基礎建設：傳送門房、標示過的隧道、天花板高速公路，同時也出現了一整類以「我們在回程時失去了一切」開頭的故事。" },
      { en: "Minecraft proves it can hold worlds inside worlds.", zh: "Minecraft 證明它能在世界裡容納另一個世界。" }
    ]
  },
  {
    id: "spread-05",
    titleEN: "Beta, And Version 1.0",
    titleZH: "Beta 與版本 1.0",
    era: { en: "Dec 2010 – Nov 2011 · Becoming a real game", zh: "2010 年 12 月至 2011 年 11 月 · 成為真正的遊戲" },
    image: "../assets/books/minecraft/vanilla-wallpaper.jpg",
    images: [
      "../assets/books/minecraft/vanilla-wallpaper.jpg",
      "../assets/books/minecraft/2019-village-pillage.jpg",
      "../assets/books/minecraft/2021-caves-cliffs.jpg",
      "../assets/books/minecraft/minecraft-java-bedrock.jpg"
    ],
    items: ["potion", "ender", "diamond"],
    stat: { value: "18 NOV", en: "2011 — 1.0 launches live on stage", zh: "2011 年，1.0 在舞台上現場發行" },
    tip: { en: "Sleeping in a bed does more than skip the night — it also sets your respawn point. Place a bed the moment your base has a roof, and before you enter the End bring a bucket of water and a stack of blocks.", zh: "睡床不只是跳過夜晚，還會設定你的重生點。基地一有屋頂就馬上放一張床；而進入終界之前，帶一桶水和一疊方塊。" },
    fact: { en: "Version 1.0 was launched live on stage in Las Vegas in front of thousands of players, two and a half years after the first browser build.", zh: "1.0 版是在拉斯維加斯的舞台上，當著數千名玩家的面現場發行的，距離第一個瀏覽器版本只過了兩年半。" },
    keys: [
      { en: "Beds and weather", zh: "床與天氣" },
      { en: "Villages and strongholds", zh: "村莊與要塞" },
      { en: "The End and the Ender Dragon", zh: "終界與終界龍" },
      { en: "Potions and enchanting", zh: "藥水與附魔" }
    ],
    blocks: [
      { en: "December 2010 to late 2011. Beta is one enormous public work-in-progress, updated so often that the game a player described on Monday could be out of date by Friday. Beds, weather, wolves, maps, pistons, hunger, villages, ravines, strongholds, Endermen, brewing and enchanting all arrive within a single year. Minecraft gains a vocabulary big enough to describe adventures instead of only buildings.", zh: "2010 年 12 月到 2011 年底。Beta 是一場龐大的公開開發中作品，更新頻繁到玩家週一描述的遊戲，到週五可能就已經過時。床、天氣、狼、地圖、活塞、飢餓、村莊、峽谷、要塞、終界使者、釀造和附魔全都在同一年登場。Minecraft 得到了足以描述冒險、而不只是描述建築的詞彙。" },
      { en: "Around the game, a second industry appears. Wikis document every recipe. Video tutorials are watched millions of times. Servers grow their own laws and economies. Creators become famous for playing a game about cubes, and a generation of players learns the game from other players rather than from anything Mojang wrote. Minecraft gains structure without ever becoming a line you walk down.", zh: "在遊戲周圍，第二個產業出現了。維基記錄每一個配方。影片教學被觀看數百萬次。伺服器長出自己的法律和經濟。創作者因為玩一款方塊遊戲而成名，而整整一個世代的玩家，是從其他玩家、而不是從 Mojang 寫的任何東西學會這款遊戲的。Minecraft 得到了結構，卻從來沒有變成一條只能往前走的直線。" },
      { en: "18 November 2011. Minecraft 1.0 launches officially, on stage, in front of a crowd. The End arrives with it: a floating island at the edge of everything, guarded by the Ender Dragon. Beat it and you get an ending, a scroll of credits and a poem — the first time Minecraft ever tells you that you are done. Enchanting, brewing, breeding and hardcore mode land in the same release. And yet almost nobody stops playing after the credits. The ending is optional, and most players treat it as one more thing to try, not a finish line.", zh: "2011 年 11 月 18 日。Minecraft 1.0 正式發行，在舞台上，在滿場觀眾面前。終界隨之登場：一座位於萬物邊緣的浮空島，由終界龍守護。打敗牠，你會得到一個結局、一段捲動的製作名單，還有一首詩，這是 Minecraft 第一次告訴你「你完成了」。附魔、釀造、繁殖和極限模式在同一個版本登場。然而幾乎沒有人在製作名單之後就停止遊玩。結局是可選的，多數玩家只把它當成又一件可以嘗試的事，而不是終點線。" },
      { en: "The game becomes a rare thing: open-ended, yet still capable of myth.", zh: "這款遊戲成為少見的存在：開放無盡，卻仍然能夠擁有神話。" }
    ]
  },
  {
    id: "spread-06",
    titleEN: "2012 To 2013: The Vocabulary Expands",
    titleZH: "2012 到 2013 年：詞彙擴張",
    era: { en: "2012–2013 · Java 1.1–1.7", zh: "2012–2013 · Java 1.1–1.7" },
    image: "../assets/books/minecraft/2019-village-pillage.jpg",
    images: [
      "../assets/books/minecraft/2019-village-pillage.jpg",
      "../assets/books/minecraft/2017-world-of-color.jpg",
      "../assets/books/minecraft/mc-creator.jpg",
      "../assets/books/minecraft/whats-happening.jpg"
    ],
    items: ["emerald", "redstone", "compass"],
    stat: { value: "7", en: "major Java updates in two years", zh: "兩年內七個主要 Java 版本" },
    tip: { en: "Trade with villagers using a job block. Put a lectern next to an unemployed villager and you can turn them into a librarian who sells you enchanted books — and if you dislike the offer, break the lectern and try again.", zh: "用工作方塊和村民交易。把講台放在沒有職業的村民旁邊，就能讓他變成賣附魔書給你的圖書管理員；如果你不喜歡他開的價，打掉講台再試一次。" },
    fact: { en: "Horses were built by a modder first. Mojang liked the mod so much that they hired its creator and put horses into the real game.", zh: "馬最早是由一位模組作者做出來的。Mojang 太喜歡那個模組，於是聘用了作者，把馬放進正式遊戲裡。" },
    keys: [
      { en: "Villager trading", zh: "村民交易" },
      { en: "Command blocks", zh: "指令方塊" },
      { en: "Horses and jungles", zh: "馬與叢林" },
      { en: "The Wither", zh: "凋零怪" }
    ],
    blocks: [
      { en: "2012 and 2013. Java 1.1 through 1.7 widen the game faster than almost any other stretch in its history, and Jens \"Jeb\" Bergensten takes over as lead developer. Jungles, ocelots, iron golems, emeralds, villager trading, desert temples, the Wither, command blocks, hoppers, comparators, horses, fireworks and dozens of new biomes all arrive. The world gets more crowded, more colourful, and considerably harder to summarise.", zh: "2012 到 2013 年。Java 1.1 到 1.7 以幾乎是史上最快的速度擴大這款遊戲，而 Jens「Jeb」Bergensten 接下首席開發者的位置。叢林、豹貓、鐵魔像、綠寶石、村民交易、沙漠神殿、凋零怪、指令方塊、漏斗、比較器、馬、煙火，以及數十種新生態域全都登場。世界變得更擁擠、更繽紛，也難以一句話講完。" },
      { en: "Every kind of player gets new tools at once. Builders get blocks and colour. Redstone engineers get comparators and hoppers, and start building machines that sort chests and count items. Explorers get biomes and temples worth travelling to. Survival players get the Wither, a boss you have to summon on purpose. And mapmakers get command blocks — which quietly turn Minecraft into a platform for making other games inside it.", zh: "每一種玩家同時得到新工具。建築玩家得到方塊與顏色。紅石工程師得到比較器與漏斗，開始建造會整理箱子、計算物品的機械。探索玩家得到值得長途跋涉的生態域與神殿。生存玩家得到凋零怪，一個必須刻意召喚出來的頭目。而地圖作者得到指令方塊，那悄悄把 Minecraft 變成一個可以在裡面製作其他遊戲的平台。" },
      { en: "This is the period when it stops being possible to describe Minecraft in one sentence. Ask two players what the game is about and you get two different answers: one says building, one says mining; one plays alone in creative mode and one runs a server with a hundred people and a set of written laws. The remarkable part is that the game never splits to accommodate them. It just keeps adding room.", zh: "這是再也無法用一句話描述 Minecraft 的時期。問兩位玩家這款遊戲在講什麼，你會得到兩種答案：一個說建造，一個說挖礦；一個在創造模式裡獨自遊玩，一個經營著上百人、還有成文規則的伺服器。了不起的是，遊戲從未為了容納他們而分裂，它只是不停增加空間。" },
      { en: "Minecraft becomes many different games at once without ever splitting apart.", zh: "Minecraft 同時變成許多種不同的遊戲，卻從未分裂。" }
    ]
  },
  {
    id: "spread-07",
    titleEN: "2014: Microsoft And Bountiful",
    titleZH: "2014 年：Microsoft 與 Bountiful",
    era: { en: "Sept 2014 · The acquisition", zh: "2014 年 9 月 · 收購" },
    image: "../assets/books/minecraft/minecraft-live.jpg",
    images: [
      "../assets/books/minecraft/minecraft-live.jpg",
      "../assets/books/minecraft/mojang-stockholm.jpg",
      "../assets/books/minecraft/microsoft-redmond.jpg",
      "../assets/books/minecraft/2018-aquatic.jpg"
    ],
    items: ["gold", "chest", "book"],
    stat: { value: "$2.5B", en: "the price Microsoft paid for Mojang", zh: "Microsoft 收購 Mojang 的金額" },
    tip: { en: "Ocean monuments look impossible until you drink a potion of water breathing and bring a sponge. Guardians hit hard, but they cannot follow you onto land — and a dry room inside the monument is the safest base you will ever build underwater.", zh: "海底遺跡看起來不可能攻略，直到你喝下水下呼吸藥水並帶上海綿。守衛者攻擊很痛，但牠們無法跟著你上岸；而遺跡裡一間抽乾水的房間，是你在水下能蓋出的最安全基地。" },
    fact: { en: "At the time of the deal, Minecraft had been downloaded over 100 million times on PC alone, and Xbox players had logged more than 2 billion hours.", zh: "交易當時，光是 PC 版 Minecraft 就已經被下載超過一億次，而 Xbox 玩家累積遊玩時數超過二十億小時。" },
    keys: [
      { en: "Mojang joins Microsoft", zh: "Mojang 加入 Microsoft" },
      { en: "Bountiful Update", zh: "Bountiful 更新" },
      { en: "Ocean monuments", zh: "海底遺跡" },
      { en: "Banners and armour stands", zh: "旗幟與盔甲座" }
    ],
    blocks: [
      { en: "September 2014. Microsoft announces a $2.5 billion agreement to acquire Mojang. Notch leaves; the studio in Stockholm stays; the game keeps updating. Players brace for the worst — adverts, subscriptions, a sudden turn towards something safer — and it does not arrive. What arrives instead is more servers, more platforms, more money and a great deal more attention on every decision.", zh: "2014 年 9 月。Microsoft 宣布以 25 億美元收購 Mojang。Notch 離開，斯德哥爾摩的工作室留下，遊戲繼續更新。玩家做好最壞的準備：廣告、訂閱制、突然轉向某種更安全的東西，但那並沒有發生。真正到來的是更多伺服器、更多平台、更多資金，以及對每一個決定多得多的關注。" },
      { en: "The same year, the Bountiful Update lands and turns out to be one of the biggest single content drops the game has ever had. Granite, diorite and andesite give stone three new faces. Slime blocks make redstone machines that move. Banners let players design their own flags, armour stands let them display a set of gear, and a far more powerful command system hands mapmakers tools they will still be using a decade later.", zh: "同一年，Bountiful Update 登場，並成為遊戲史上最大型的單次內容更新之一。花崗岩、閃長岩與安山岩給了石頭三張新面孔。史萊姆方塊讓紅石機械能夠移動。旗幟讓玩家設計自己的旗子，盔甲座讓他們展示整套裝備，而功能強大許多的指令系統，交給地圖作者一套十年後仍在使用的工具。" },
      { en: "It also drops ocean monuments into the sea: huge prismarine temples full of guardians, the first structure that genuinely punishes you for arriving unprepared. Minecraft stops being a runaway indie success and becomes a global franchise with a corporation behind it. From here on, the real challenge is growing without losing the strangeness that made it worth buying in the first place.", zh: "它也把海底遺跡投入海中：巨大的海磷石神殿，滿是守衛者，是第一個真正會懲罰「沒準備就來」的結構。Minecraft 不再只是爆紅的獨立遊戲，而成為背後有企業支撐的全球品牌。從此之後，真正的挑戰是：如何成長，卻不失去當初讓它值得被買下的那份奇特。" },
      { en: "From here on, the challenge is growing without losing the strangeness.", zh: "從此之後，挑戰是：如何成長，卻不失去那份奇特。" }
    ]
  },
  {
    id: "spread-08",
    titleEN: "2016: Combat, Education, Exploration",
    titleZH: "2016 年：戰鬥、教育與探索",
    era: { en: "2016 · Java 1.9–1.11", zh: "2016 · Java 1.9–1.11" },
    image: "../assets/books/minecraft/education-hero.png",
    images: [
      "../assets/books/minecraft/education-hero.png",
      "../assets/books/minecraft/education-planet.png",
      "../assets/books/minecraft/2019-village-pillage.jpg",
      "../assets/books/minecraft/mc-creator.jpg"
    ],
    items: ["sword", "book", "compass"],
    stat: { value: "2016", en: "Education Edition reaches classrooms", zh: "教育版進入教室" },
    tip: { en: "Elytra need momentum, not height. Fire a firework rocket while gliding and you can cross a whole biome without touching the ground — just watch your durability, because landing badly costs a lot more than a rocket.", zh: "鞘翅需要的是動能，不是高度。滑翔時發射煙火火箭，你可以橫越一整個生態域而不落地；只要注意耐久度，因為摔壞的代價比一支火箭高得多。" },
    fact: { en: "The Combat Update added an attack cooldown, which means spam-clicking now does less damage than one well-timed swing. It is still one of the game's most argued-about changes.", zh: "戰鬥更新加入了攻擊冷卻，也就是說瘋狂連點造成的傷害，反而比一次抓好時機的揮擊更低。它至今仍是遊戲中最具爭議的改動之一。" },
    keys: [
      { en: "Attack cooldown", zh: "攻擊冷卻" },
      { en: "Elytra flight", zh: "鞘翅飛行" },
      { en: "Woodland mansions", zh: "林地府邸" },
      { en: "Education Edition", zh: "教育版" }
    ],
    blocks: [
      { en: "2016. Three different ideas of what Minecraft is arrive in a single year: a combat game, a classroom, and a map worth exploring to its far edges. The Combat Update brings cooldowns, shields, dual wielding and elytra. It is the most controversial change Mojang has ever shipped — a whole community of players who had learned to fight by clicking as fast as possible suddenly had to learn timing instead.", zh: "2016 年。關於 Minecraft 是什麼的三種不同想法在同一年抵達：一款戰鬥遊戲、一間教室，以及一張值得探索到最邊緣的地圖。戰鬥更新帶來攻擊冷卻、盾牌、雙手持物和鞘翅。它是 Mojang 推出過最具爭議的改動：一整個學會用最快速度點擊來戰鬥的玩家社群，突然必須改學抓時機。" },
      { en: "The Exploration Update answers a quieter complaint: the world was enormous but there was nothing specific to walk towards. It adds woodland mansions hidden deep in dark forests, explorer maps you buy from cartographers, llamas that carry your things, shulker boxes that survive death, and illagers — villagers who went wrong. Suddenly the map has destinations, and getting to them can mean flying.", zh: "探索更新回應的是一個比較安靜的抱怨：世界很巨大，卻沒有具體值得走過去的東西。它加入藏在黑森林深處的林地府邸、向製圖師購買的探險家地圖、能替你搬東西的駱馬、死了也不會掉落內容物的界伏盒，以及災厄村民——走上歧路的村民。地圖突然有了目的地，而抵達那裡可能得用飛的。" },
      { en: "And Education Edition launches, which changes what the game is allowed to be. Teachers start using Minecraft as a supported platform for coding, chemistry, history and collaborative design, with classroom tools, lesson plans and a way to freeze thirty students in place when the lesson needs their attention. A game about hitting trees becomes a place where lessons happen on purpose.", zh: "而教育版推出，改變了這款遊戲被允許成為什麼。老師開始把 Minecraft 當成受支援的平台，用於程式、化學、歷史和協作設計，並搭配課堂工具、教案，以及在需要學生專心時把三十個人定在原地的功能。一款關於敲樹的遊戲，成為有意識地進行教學的地方。" },
      { en: "Minecraft is no longer only a game you play. It is a place you teach in, argue in, explore, and build systems inside.", zh: "Minecraft 不再只是一款你玩的遊戲。它是你在裡面教學、爭論、探索與建構系統的地方。" }
    ]
  },
  {
    id: "spread-09",
    titleEN: "2017: Color, Bedrock, Cross-Play",
    titleZH: "2017 年：色彩、Bedrock 與跨平台",
    era: { en: "2017 · World of Color & Better Together", zh: "2017 · 色彩世界與 Better Together" },
    image: "../assets/books/minecraft/2017-world-of-color.jpg",
    images: [
      "../assets/books/minecraft/2017-world-of-color.jpg",
      "../assets/books/minecraft/2026-tiny-takeover-c.jpg",
      "../assets/books/minecraft/realms-multiplayer.png",
      "../assets/books/minecraft/minecraft-java-bedrock.jpg"
    ],
    items: ["copper", "emerald", "diamond"],
    stat: { value: "16", en: "dye colours, now on almost every block", zh: "十六種染料顏色，現在幾乎能用在每種方塊上" },
    tip: { en: "Concrete powder only turns into concrete when it touches water. Pour a stack into a pool and mine it straight back out — that is the fastest way to make a lot of it at once.", zh: "混凝土粉末只有碰到水才會變成混凝土。把一整疊倒進水池再立刻挖回來，這是一次做很多的最快方法。" },
    fact: { en: "Two versions of Minecraft now exist side by side: Java, home of mods and PC history, and Bedrock, which lets phones, consoles and Windows share one world.", zh: "現在有兩個版本的 Minecraft 並存：Java 是模組與 PC 歷史的家，而 Bedrock 讓手機、主機和 Windows 共享同一個世界。" },
    keys: [
      { en: "Concrete and terracotta", zh: "混凝土與釉陶" },
      { en: "Bedrock Edition", zh: "Bedrock 版" },
      { en: "Cross-platform play", zh: "跨平台遊玩" },
      { en: "Parrots", zh: "鸚鵡" }
    ],
    blocks: [
      { en: "2017. World of Color repaints the game. Concrete arrives in sixteen flat, brilliant shades. Glazed terracotta adds patterns you can tile into mosaics. Beds, glass and wool are recoloured to match, and parrots turn up to sit on your shoulder. For builders this is not a small update — a palette is a language, and Minecraft had been speaking with about a dozen words.", zh: "2017 年。World of Color 為遊戲重新上色。混凝土帶來十六種平整鮮明的色調。釉陶加入可以拼成馬賽克的圖案。床、玻璃和羊毛重新調色以互相搭配，鸚鵡也出現在你的肩膀上。對建築玩家來說這不是小更新：調色盤就是一種語言，而 Minecraft 之前只用大約十幾個字在說話。" },
      { en: "Almost overnight, pixel art, flags, murals, modern architecture and colour-coded redstone rooms all become practical. Screenshots from 2017 onward look different from everything before them, not because the engine changed but because builders were finally handed a full box of paint.", zh: "幾乎在一夜之間，像素畫、旗幟、壁畫、現代建築，以及用顏色分類的紅石房間都變得可行。2017 年之後的截圖看起來和之前的一切都不一樣，不是因為引擎變了，而是因為建築玩家終於拿到了一整盒顏料。" },
      { en: "In the same period the Better Together direction unifies console, mobile and Windows players under Bedrock Edition. A tablet, an Xbox and a phone can finally stand in the same world at the same time, which for a lot of families is the update that actually mattered. From here Minecraft has two identities: Java for mods and PC heritage, Bedrock for the devices that need to meet in the middle.", zh: "同一時期，Better Together 方向把主機、行動裝置和 Windows 玩家統整到 Bedrock 版之下。平板、Xbox 和手機終於能同時站在同一個世界裡，而對許多家庭來說，這才是真正重要的更新。從此 Minecraft 有兩個身份：Java 承接模組與 PC 傳統，Bedrock 服務那些需要在中間相遇的裝置。" },
      { en: "A palette is a language, and in 2017 Minecraft learned to speak in colour.", zh: "調色盤就是一種語言，而 2017 年，Minecraft 學會了用顏色說話。" }
    ]
  },
  {
    id: "spread-10",
    titleEN: "Oceans, Villages, Bees, Nether",
    titleZH: "海洋、村莊、蜜蜂與 Nether",
    era: { en: "2018–2020 · Rebuilding old places", zh: "2018–2020 · 重建舊地方" },
    image: "../assets/books/minecraft/2018-aquatic.jpg",
    images: [
      "../assets/books/minecraft/2018-aquatic.jpg",
      "../assets/books/minecraft/2019-village-pillage.jpg",
      "../assets/books/minecraft/2019-buzzy-bees.jpg",
      "../assets/books/minecraft/2020-nether-update.jpg"
    ],
    items: ["bucket", "emerald", "torch"],
    stat: { value: "4", en: "familiar places rebuilt in three years", zh: "三年內被重建的四個熟悉地方" },
    tip: { en: "Netherite survives lava, so it is the safest place to keep your best gear. Just remember it still burns you — the armour floats, you do not.", zh: "獄髓不怕岩漿，所以是保存最好裝備的最安全選擇。只是別忘了岩漿還是會燒你：盔甲會浮起來，你不會。" },
    fact: { en: "The Nether Update replaced a dimension that had barely changed in ten years, adding four new biomes, piglins, striders and netherite in one go.", zh: "Nether 更新重做了一個十年來幾乎沒變過的維度，一口氣加入四種新生態域、豬布林、熾足獸和獄髓。" },
    keys: [
      { en: "Update Aquatic", zh: "海洋更新" },
      { en: "Village & Pillage", zh: "村莊與掠奪" },
      { en: "Buzzy Bees", zh: "蜜蜂更新" },
      { en: "Nether Update", zh: "地獄更新" }
    ],
    blocks: [
      { en: "2018 to 2020. Instead of adding new places, Mojang goes back and rebuilds the ones players thought they already knew. It is a quieter kind of ambition, and it changes the game more than most new features do — because it means no part of the world is finished.", zh: "2018 到 2020 年。Mojang 沒有一直加新地方，而是回頭重建那些玩家以為自己早就熟悉的地方。這是一種比較安靜的野心，但它改變遊戲的程度勝過大多數新功能，因為那意味著：世界沒有任何一部分是完成的。" },
      { en: "Update Aquatic fills the empty ocean with coral reefs, kelp forests, shipwrecks, buried treasure, dolphins, turtles and the drowned. Swimming becomes a real mechanic rather than a slow way to die. Village & Pillage then rebuilds villages entirely: villagers get real jobs and workstations, trading becomes a system worth learning, and raids arrive to attack the villages you have just started caring about.", zh: "海洋更新用珊瑚礁、海帶森林、沉船、埋藏寶藏、海豚、海龜和溺屍填滿空蕩的海洋。游泳成為真正的機制，而不只是一種比較慢的死法。接著村莊與掠奪徹底重建村莊：村民有了真正的職業和工作站，交易成為值得鑽研的系統，而掠奪隊也開始攻擊那些你剛開始在乎的村莊。" },
      { en: "Buzzy Bees adds an ecosystem you can farm without breaking, and then the Nether Update rebuilds the oldest dangerous place in the game. Four new biomes, piglins who trade with you if you dress correctly, striders that carry you across lava, and netherite — the first material to beat diamond in nine years. Players who had not visited the Nether since 2010 went back and found somewhere new.", zh: "蜜蜂更新加入一套可以經營而不破壞的生態系；接著 Nether 更新重建了遊戲裡最古老的危險地帶。四種新生態域、只要你穿對衣服就會和你交易的豬布林、載你越過岩漿的熾足獸，以及獄髓——九年來第一種勝過鑽石的材料。那些從 2010 年後就沒去過 Nether 的玩家回去了一趟，發現那裡已經是新的地方。" },
      { en: "Minecraft's world is not fixed. Even the places you are sure you know can wake up again.", zh: "Minecraft 的世界不是固定的。即使是你確信自己熟悉的地方，也可能再次醒來。" }
    ]
  },
  {
    id: "spread-11",
    titleEN: "2021: Caves & Cliffs",
    titleZH: "2021 年：洞穴與山崖",
    era: { en: "2021 · Split into two parts", zh: "2021 · 拆成兩部分" },
    image: "../assets/books/minecraft/2021-caves-cliffs-p1.jpg",
    images: [
      "../assets/books/minecraft/2021-caves-cliffs-p1.jpg",
      "../assets/books/minecraft/2021-caves-cliffs.jpg",
      "../assets/books/minecraft/2025-spring-to-life-b.jpg",
      "../assets/books/minecraft/2025-copper-age-c.jpg"
    ],
    items: ["amethyst", "copper", "pickaxe"],
    stat: { value: "384", en: "blocks of world height after Part II", zh: "第二部分之後的世界高度（格）" },
    tip: { en: "Diamonds sit lowest of all. After Caves & Cliffs the best level to search is around Y −59, and a lush cave in the ceiling usually means water — and a shortcut to the surface — is close by.", zh: "鑽石埋得最深。Caves & Cliffs 之後，最好的搜尋高度大約在 Y −59；而天花板上出現繁茂洞穴，通常代表水和一條通往地表的捷徑就在附近。" },
    fact: { en: "The update was so large it had to ship in two halves: Part I in June 2021 for the mobs and blocks, Part II in November for the terrain itself.", zh: "這次更新大到必須分成兩半推出：2021 年 6 月的第一部分帶來生物與方塊，11 月的第二部分則重做地形本身。" },
    keys: [
      { en: "Copper and amethyst", zh: "銅與紫水晶" },
      { en: "Axolotls and goats", zh: "美西螈與山羊" },
      { en: "Deepslate and dripstone", zh: "深板岩與鐘乳石" },
      { en: "Taller mountains, deeper caves", zh: "更高的山，更深的洞" }
    ],
    blocks: [
      { en: "2021. Caves & Cliffs is so large that Mojang has to cut it in half and ship it twice — the only time in Minecraft's history that has happened. It is also the first update where the team publicly admitted it had promised more than one release could hold, which turned into a lesson that shaped everything that came after it.", zh: "2021 年。Caves & Cliffs 大到 Mojang 必須把它切成兩半、分兩次推出，這是 Minecraft 歷史上唯一一次。它也是開發團隊第一次公開承認「承諾的內容超過一個版本能容納」的更新，而那個教訓形塑了之後的一切。" },
      { en: "Part I brings copper that changes colour as it ages, amethyst geodes that chime when you walk through them, axolotls that help you fight underwater, glow squids, goats that headbutt you off cliffs, candles, moss, dripstone and deepslate. It is a huge amount of new material for builders, and most of it is decorative rather than powerful — a sign of how much of Minecraft's audience now builds for pleasure rather than progress.", zh: "第一部分帶來會隨時間變色的銅、走過會發出清脆聲響的紫水晶洞、會在水下幫你戰鬥的美西螈、發光魷魚、會把你從懸崖上撞下去的山羊、蠟燭、苔蘚、鐘乳石和深板岩。這是給建築玩家的一大批新材料，而且大多是裝飾性而非強力的，這說明現在有多少 Minecraft 玩家是為了樂趣、而不是為了進度而建造。" },
      { en: "Part II is the bigger shock. The world gets taller and deeper at the same time, mountains grow real peaks with snow and goats on them, and caves stop being tunnels and become cathedrals — huge, lush, dripping, frozen rooms you can lose an evening inside. Old worlds meet new terrain at a visible seam, and thousands of players started fresh worlds just to see what generation would give them.", zh: "第二部分帶來更大的衝擊。世界同時變得更高也更深，山脈長出有積雪和山羊的真正峰頂，洞穴不再只是隧道，而成為大教堂：巨大、繁茂、滴水、結冰的空間，可以讓你在裡面耗掉一整個晚上。舊世界與新地形相接處會留下一道看得見的接縫，而成千上萬的玩家開了全新世界，只為了看看生成會給他們什麼。" },
      { en: "Change the terrain and you change the shape of every memory a new world will ever make.", zh: "改變地形，就會改變一個新世界未來所有記憶的形狀。" }
    ]
  },
  {
    id: "spread-12",
    titleEN: "2022: The Wild Update",
    titleZH: "2022 年：荒野更新",
    era: { en: "2022 · Java 1.19", zh: "2022 · Java 1.19" },
    image: "../assets/books/minecraft/2022-wild-update.jpg",
    images: [
      "../assets/books/minecraft/2022-wild-update.jpg",
      "../assets/books/minecraft/2024-garden-awakens.jpg",
      "../assets/books/minecraft/2024-garden-awakens-b.jpg",
      "../assets/books/minecraft/2021-caves-cliffs.jpg"
    ],
    items: ["heart", "torch", "amethyst"],
    stat: { value: "0", en: "eyes on the Warden — it hunts by sound", zh: "伏守者的眼睛數量，牠靠聲音狩獵" },
    tip: { en: "In the deep dark, crouch and stay off the sculk. Throwing a snowball or an egg far away makes a noise somewhere else — and buys you a quiet exit.", zh: "在深暗之域要蹲下，別踩伏聆。往遠處丟雪球或雞蛋會在別的地方製造聲音，替你換來安靜的退路。" },
    fact: { en: "The Warden is blind. It finds you entirely by vibration, which makes it the only mob in Minecraft you can beat by doing absolutely nothing.", zh: "伏守者是瞎的。牠完全靠震動找到你，這讓牠成為 Minecraft 裡唯一一種你什麼都不做就能「戰勝」的生物。" },
    keys: [
      { en: "Mangrove swamps", zh: "紅樹林沼澤" },
      { en: "Allays and frogs", zh: "悅靈與青蛙" },
      { en: "Ancient cities", zh: "遠古城市" },
      { en: "Sculk and the Warden", zh: "伏聆與伏守者" }
    ],
    blocks: [
      { en: "2022. The Wild Update adds the gentlest thing in the game and the most frightening thing in the game, in the same release. On the soft side: mangrove swamps that grow out over the water, mud, frogs, tadpoles, boats you can put a chest in, and the allay — a small floating helper that collects items for you and dances when it hears music.", zh: "2022 年。荒野更新在同一個版本裡，加入了遊戲中最溫柔的東西和最可怕的東西。溫柔的一邊：延伸到水面上的紅樹林沼澤、泥巴、青蛙、蝌蚪、可以放箱子的船，還有悅靈，一個會替你收集物品、聽見音樂就跳舞的小小飛行幫手。" },
      { en: "On the other side: the deep dark, a biome buried far below everything else, filled with sculk that hears every step you take. Walk through it and the blocks around you shriek. Shriek enough times and something arrives.", zh: "另一邊：深暗之域，一個埋在所有東西之下的生態域，滿是會聽見你每一步的伏聆。走過去，你周圍的方塊就會尖叫；尖叫夠多次，某個東西就會到來。" },
      { en: "The Warden is enormous, blind, and impossible to fight fairly — it can kill a player in full netherite armour in two hits. Ancient cities sit in the middle of the deep dark, full of loot nobody can carry out quietly, which turns the whole biome into a puzzle about restraint rather than a fight. Players quickly learn that the smartest move is silence, and that is a remarkable thing for a game to teach.", zh: "伏守者巨大、目盲，而且無法公平地正面對抗，牠能兩下擊殺一個穿滿獄髓盔甲的玩家。遠古城市座落在深暗之域中央，滿是沒有人能安靜搬走的戰利品，這讓整個生態域變成一道關於克制的謎題，而不是一場戰鬥。玩家很快就學到，最聰明的行動是保持安靜，而一款遊戲能教會這件事，非常了不起。" },
      { en: "Minecraft adds real fear without ever turning into a game that is only about fighting.", zh: "Minecraft 加入了真正的恐懼，卻沒有變成一款只講戰鬥的遊戲。" }
    ]
  },
  {
    id: "spread-13",
    titleEN: "2023: Trails & Tales",
    titleZH: "2023 年：足跡與故事",
    era: { en: "2023 · Java 1.20", zh: "2023 · Java 1.20" },
    image: "../assets/books/minecraft/2023-trails-tales.jpg",
    images: [
      "../assets/books/minecraft/2023-trails-tales.jpg",
      "../assets/books/minecraft/2023-trails-tales-b.jpg",
      "../assets/books/minecraft/2023-trails-tales-c.jpg",
      "../assets/books/minecraft/2023-bats-pots.jpg"
    ],
    items: ["book", "bread", "emerald"],
    stat: { value: "10k+", en: "years an ancient seed can wait underground", zh: "遠古種子能在地底等待的年數" },
    tip: { en: "Brush suspicious sand and gravel slowly and never break the block — one careless swing loses the pottery sherd inside it forever, and sherds do not respawn.", zh: "刷可疑的沙子和礫石時要慢，而且千萬別把方塊打掉。一次不小心的揮擊，就會永遠失去裡面的陶片，而陶片不會重新生成。" },
    fact: { en: "The sniffer was chosen by players in a public vote, which makes it the only mob in Minecraft that was elected.", zh: "嗅探獸是玩家公開投票選出來的，這讓牠成為 Minecraft 裡唯一一種「被選舉出來」的生物。" },
    keys: [
      { en: "Archaeology and sherds", zh: "考古與陶片" },
      { en: "Cherry groves", zh: "櫻花樹林" },
      { en: "Armour trims", zh: "盔甲紋飾" },
      { en: "Camels and sniffers", zh: "駱駝與嗅探獸" }
    ],
    blocks: [
      { en: "2023. Trails & Tales is an update about memory. Almost everything in it is a way of leaving a trace, reading a trace somebody else left, or carrying a story forward — which is a strange goal for a game with no story, and exactly why it works.", zh: "2023 年。Trails & Tales 是一次關於記憶的更新。裡面幾乎每一樣東西，都是留下痕跡、讀取別人留下的痕跡，或把故事帶往前方的方式。對一款沒有故事的遊戲來說，這是個奇怪的目標，而這正是它成功的原因。" },
      { en: "Archaeology arrives: brush suspicious sand with a delicate tool, recover pottery sherds one at a time, and assemble decorated pots that say something about where you found them. Armour trims let you mark your gear with patterns and metals so other players can recognise you across a server — the first real customisation the game has offered since capes.", zh: "考古登場：用一件精細工具刷開可疑的沙子，一次找回一片陶片，再拼出能訴說你在哪裡發現它們的裝飾陶罐。盔甲紋飾讓你用圖案和金屬標記自己的裝備，好讓伺服器上的其他玩家能認出你，這是遊戲自披風以來第一次提供真正的個人化。" },
      { en: "Cherry groves paint whole hillsides pink and drop petals as you walk. Camels carry two riders at once and stand tall enough that mobs cannot reach you. Sniffers dig up seeds for plants that had gone extinct thousands of years earlier. And bamboo blocks, rafts and hanging signs hand builders a warmer, softer material set that changed how a lot of bases look.", zh: "櫻花樹林把整片山坡染成粉紅色，你走過時還會飄落花瓣。駱駝一次載兩位騎士，而且站得夠高，讓怪物碰不到你。嗅探獸挖出數千年前就已絕種的植物種子。而竹方塊、竹筏和懸掛告示牌給了建築玩家一組更溫暖柔和的材料，改變了許多基地的樣貌。" },
      { en: "The world becomes a memory field, not only a resource field.", zh: "世界成為記憶的場域，而不只是資源的場域。" }
    ]
  },
  {
    id: "spread-14",
    titleEN: "The Game Drop Era And 2024",
    titleZH: "遊戲掉落時代與 2024 年",
    era: { en: "2023 onward · A new rhythm", zh: "2023 年起 · 新的節奏" },
    image: "../assets/books/minecraft/2024-tricky-trials.jpg",
    images: [
      "../assets/books/minecraft/2024-tricky-trials.jpg",
      "../assets/books/minecraft/2023-bats-pots-b.jpg",
      "../assets/books/minecraft/2024-armored-paws.jpg",
      "../assets/books/minecraft/2024-bundles-bravery.jpg"
    ],
    items: ["sword", "chest", "redstone"],
    stat: { value: "4", en: "drops in 2024: paws, trials, bundles, garden", zh: "2024 年四次掉落：爪、試煉、收納袋、花園" },
    tip: { en: "Trial chambers reward patience. Clear the spawners first, save an ominous bottle for a second run, and open vaults only when your inventory actually has room for what falls out.", zh: "試煉密室獎勵有耐心的人。先清掉生怪磚，把不祥之瓶留到第二輪再用，並且只在背包真的有空位時才開寶庫。" },
    fact: { en: "The Creaking cannot be hurt while its heart is alive somewhere else in the pale garden — you have to find the tree, not fight the monster.", zh: "只要嘎枝怪的心臟還在蒼白花園的某處活著，牠就無法被傷害。你要找的是那棵樹，而不是打倒那隻怪物。" },
    keys: [
      { en: "Smaller, more often", zh: "更小、更頻繁" },
      { en: "Trial chambers", zh: "試煉密室" },
      { en: "The mace and the crafter", zh: "重錘與合成器" },
      { en: "Pale garden and the Creaking", zh: "蒼白花園與嘎枝怪" }
    ],
    blocks: [
      { en: "2023 onward. Mojang changes how Minecraft grows. Instead of one enormous annual update that takes a year to build and a week to explore, the game starts shipping smaller themed drops several times a year. A drop can be about almost anything: bats and pots, wolf armour, bundles, ambient sound, copper, mounts, baby mobs, or a cave full of sulfur. Each one is small enough to explain in a sentence and big enough to change a weekend.", zh: "2023 年起。Mojang 改變了 Minecraft 成長的方式。不再是一年做一次、玩家一週就探索完的巨大年度更新，遊戲開始一年推出好幾次較小的主題掉落。一次掉落可以關於幾乎任何主題：蝙蝠與陶罐、狼盔甲、收納袋、環境音效、銅、坐騎、幼年生物，或一個滿是硫磺的洞穴。每一次都小到能用一句話說明，也大到能改變一個週末。" },
      { en: "The trade-off is real. Drops mean fewer world-shaking moments, and some players miss the long build-up to a single enormous release. But they also mean the game is never quiet for a year, and features can be tested, adjusted or expanded while players are still excited about them rather than twelve months later.", zh: "取捨是真實存在的。掉落意味著撼動世界的時刻變少，有些玩家也懷念那種為單一巨大版本長期醞釀的期待感。但它同時意味著遊戲不會沉寂一整年，而功能可以在玩家還興奮的時候被測試、調整或擴充，而不是等到十二個月後。" },
      { en: "2024 proves the rhythm works: four drops in twelve months. Tricky Trials is the headline — hand-built copper dungeons full of spawners, traps and vaults, guarded by the Breeze, which knocks you off ledges with wind, and the Bogged, which shoots poisoned arrows. Around it, every playstyle gets a gift: wolf armour and armadillos for pet keepers, the mace for fighters, the crafter for redstone engineers, bundles for anyone tired of a full inventory, and the pale garden — grey, silent and stalked by the Creaking — for players who wanted the game to be frightening again.", zh: "2024 年證明了這個節奏行得通：十二個月內四次掉落。Tricky Trials 是頭條：手工設計的銅製地城，滿是生怪磚、陷阱和寶庫，由會用風把你從邊緣打下去的旋風使者，以及射出毒箭的沼骸守衛。在它周圍，每一種玩法都得到禮物：狼盔甲和犰狳給養寵物的人、重錘給戰鬥玩家、合成器給紅石工程師、收納袋給每個受夠背包滿了的人，而灰白、寂靜、被嘎枝怪徘徊其中的蒼白花園，則給那些希望遊戲再次可怕起來的玩家。" },
      { en: "Minecraft starts evolving like a calendar instead of like a yearly festival.", zh: "Minecraft 開始像日曆一樣演化，而不再像一年一度的節慶。" }
    ]
  },
  {
    id: "spread-15",
    titleEN: "2025: Skies And Copper",
    titleZH: "2025 年：天空與銅",
    era: { en: "2025 · Four more drops", zh: "2025 · 又是四次掉落" },
    image: "../assets/books/minecraft/2025-chase-skies.jpg",
    images: [
      "../assets/books/minecraft/2025-chase-skies.jpg",
      "../assets/books/minecraft/2025-copper-age.jpg",
      "../assets/books/minecraft/2025-mounts-mayhem.jpg",
      "../assets/books/minecraft/2025-spring-to-life.jpg"
    ],
    items: ["copper", "compass", "star"],
    stat: { value: "4", en: "riders fit on one happy ghast", zh: "一隻快樂幽魂可以載的騎士人數" },
    tip: { en: "A happy ghast starts as a dried ghast block. Put it in water in the Nether, then hydrate it in the Overworld — patience turns a fossil into a flying bus for your whole group.", zh: "快樂幽魂一開始是乾燥幽魂方塊。先在 Nether 把它放進水裡，再到主世界補水。耐心會把一塊化石變成載著全隊的飛行巴士。" },
    fact: { en: "Vibrant Visuals brings real lighting, shadows and reflections to Bedrock without a single mod — the biggest visual change the game has ever had.", zh: "Vibrant Visuals 為 Bedrock 帶來真正的光照、陰影與反射，而且不需要任何模組，是遊戲史上最大的視覺改變。" },
    keys: [
      { en: "Happy ghasts", zh: "快樂幽魂" },
      { en: "Copper golems and shelves", zh: "銅魔像與架子" },
      { en: "Mounted combat", zh: "騎乘戰鬥" },
      { en: "Vibrant Visuals", zh: "Vibrant Visuals" }
    ],
    blocks: [
      { en: "2025. Spring to Life, Chase the Skies, The Copper Age and Mounts of Mayhem land across the year, and between them they change how the game looks, how it sounds, and how you move through it. Spring to Life goes first and quietly: cold and warm variants of familiar mobs, fireflies, wildflowers, leaf litter and a much richer ambient soundscape.", zh: "2025 年。Spring to Life、Chase the Skies、The Copper Age 和 Mounts of Mayhem 在這一年陸續登場，它們合起來改變了遊戲的外觀、聲音，以及你在其中移動的方式。Spring to Life 最先、也最安靜地登場：熟悉生物的寒冷與溫暖變種、螢火蟲、野花、落葉，以及豐富許多的環境音景。" },
      { en: "Chase the Skies gives players the happy ghast: a giant, gentle, saddled cloud of a mob that carries up to four friends through the air at once. Flying stops being a solo elytra trick and becomes something a group does together — and for the first time since boats, Minecraft has a vehicle built for company rather than speed.", zh: "Chase the Skies 給了玩家快樂幽魂：一隻巨大、溫和、可以裝鞍的雲朵般生物，一次能載四位朋友飛過天空。飛行不再是一個人的鞘翅特技，而成為一群人一起做的事；而這是自船之後，Minecraft 第一次擁有一種為了同伴、而不是為了速度而設計的載具。" },
      { en: "The Copper Age turns a decorative metal into a whole tech tree: copper tools, copper armour, copper golems that sort your chests for you, and shelves that finally let you display what you have collected instead of hiding it in a box. Mounts of Mayhem then adds spears, nautilus mounts and mounted combat, and Vibrant Visuals arrives on Bedrock with real lighting, shadows and reflections.", zh: "The Copper Age 把一種裝飾性金屬變成完整的科技樹：銅工具、銅盔甲、會幫你整理箱子的銅魔像，還有終於能展示收藏品、而不是把它們藏進箱子的架子。接著 Mounts of Mayhem 加入長矛、鸚鵡螺坐騎與騎乘戰鬥，而 Vibrant Visuals 帶著真正的光照、陰影與反射登陸 Bedrock。" },
      { en: "The game keeps finding new ways to move: through air, through water, on horseback, on machines, and alongside friends.", zh: "這款遊戲持續找到新的移動方式：穿過空中、穿過水裡、騎在馬背上、乘著機械，以及和朋友並肩。" }
    ]
  },
  {
    id: "spread-16",
    titleEN: "2026: Tiny Takeover And Chaos Cubed",
    titleZH: "2026 年：Tiny Takeover 與 Chaos Cubed",
    era: { en: "2026 · The newest chapter", zh: "2026 · 最新的一章" },
    image: "../assets/books/minecraft/2026-chaos-cubed.jpg",
    images: [
      "../assets/books/minecraft/2026-chaos-cubed.jpg",
      "../assets/books/minecraft/2026-tiny-takeover.jpg",
      "../assets/books/minecraft/2026-sulfur-caves.jpg",
      "../assets/books/minecraft/2026-sulfur-cubes-variety.jpg"
    ],
    items: ["sulfur", "tnt", "star"],
    stat: { value: "26.2", en: "the Java version players are on right now", zh: "玩家現在使用的 Java 版本" },
    tip: { en: "Feed a sulfur cube a block and it copies that block's behaviour. Give it ice and it slides across the floor; give it TNT and stand a very long way back.", zh: "餵硫磺方塊怪一個方塊，牠就會複製那個方塊的行為。給牠冰，牠會在地上滑行；給牠 TNT，然後站得非常遠。" },
    fact: { en: "Chaos Cubed also added experimental Vulkan rendering to Java Edition — the first time in years the game has changed how it draws the world.", zh: "Chaos Cubed 也為 Java 版加入實驗性的 Vulkan 渲染，這是多年來遊戲第一次改變它繪製世界的方式。" },
    keys: [
      { en: "Sulfur cubes", zh: "硫磺方塊怪" },
      { en: "Sulfur caves and geysers", zh: "硫磺洞穴與間歇泉" },
      { en: "Craftable name tags", zh: "可合成的命名牌" },
      { en: "Friends List", zh: "好友列表" }
    ],
    blocks: [
      { en: "2026. Tiny Takeover arrives in March and Chaos Cubed in June. As of 28 July 2026, Chaos Cubed is the newest official release listed on Minecraft.net — which means this is the last page of the story anyone can write so far.", zh: "2026 年。Tiny Takeover 在 3 月登場，Chaos Cubed 在 6 月登場。截至 2026 年 7 月 28 日，Chaos Cubed 是 Minecraft.net 上列出的最新官方版本，也就是說，這是目前任何人能寫下的故事最後一頁。" },
      { en: "Tiny Takeover is the softer of the two: more baby mobs across the world, craftable name tags so you can finally name anything you love without hunting for a dungeon chest, and golden dandelions scattered through the fields. It is a drop about attachment — about the parts of the game you keep rather than the parts you beat.", zh: "Tiny Takeover 是兩者中比較柔和的那個：世界各處有更多幼年生物、可以合成的命名牌讓你終於不必翻遍地城箱子就能為喜歡的一切命名，還有散落在原野間的金蒲公英。這是一次關於情感連結的掉落，講的是你想留下的那部分遊戲，而不是你想打倒的那部分。" },
      { en: "Chaos Cubed is the loud one. Sulfur cubes are mobs shaped like blocks that absorb whatever they are fed and take on its behaviour — ice makes them slide, honeycomb makes them stick, TNT makes them a problem. Add sulfur caves lit in warm yellow, cinnabar, geysers that erupt in the Overworld, new music, a Friends List and experimental Vulkan rendering in Java 26.2, and one mob becomes a physics toy, a puzzle piece and a ball game all at once.", zh: "Chaos Cubed 是吵鬧的那個。硫磺方塊怪是外型像方塊的生物，會吸收你餵給牠的東西並取得那樣東西的行為：冰讓牠滑行，蜂巢讓牠黏住，TNT 讓牠變成麻煩。再加上暖黃色燈光的硫磺洞穴、硃砂、在主世界噴發的間歇泉、新音樂、好友列表，以及 Java 26.2 的實驗性 Vulkan 渲染，一隻生物同時變成物理玩具、謎題零件和球類運動。" },
      { en: "The newest Minecraft still obeys the oldest rule: one simple system can become a thousand different stories.", zh: "最新的 Minecraft 仍然遵守最古老的規則：一個簡單的系統，可以變成一千個不同的故事。" }
    ]
  },
  {
    id: "spread-17",
    titleEN: "Minecraft Outside The Game",
    titleZH: "遊戲之外的 Minecraft",
    era: { en: "2010s–2020s · The wider world", zh: "2010–2020 年代 · 更大的世界" },
    image: "../assets/books/minecraft/mc-legends.jpg",
    images: [
      "../assets/books/minecraft/mc-legends.jpg",
      "../assets/books/minecraft/mc-dungeons.jpg",
      "../assets/books/minecraft/servers-tile.jpg",
      "../assets/books/minecraft/minecraft-live.jpg"
    ],
    items: ["book", "star", "chest"],
    stat: { value: "350M+", en: "copies sold — the best-selling game ever", zh: "銷售套數，史上最暢銷的遊戲" },
    tip: { en: "Want to build with friends who own different devices? A Realm or a Bedrock world lets a tablet, a console and a PC meet in the same place without anybody setting up a server.", zh: "想和使用不同裝置的朋友一起蓋東西嗎？Realm 或 Bedrock 世界能讓平板、主機和電腦在同一個地方相遇，不需要任何人架伺服器。" },
    fact: { en: "Minecraft passed 300 million copies sold on 15 October 2023 — the first video game ever to do it — and had passed 350 million by 2025.", zh: "Minecraft 在 2023 年 10 月 15 日突破三億套銷量，是史上第一款做到的電子遊戲，並在 2025 年之前突破三億五千萬套。" },
    keys: [
      { en: "Dungeons and Legends", zh: "Dungeons 與 Legends" },
      { en: "Realms and Marketplace", zh: "Realms 與 Marketplace" },
      { en: "Servers, mods and maps", zh: "伺服器、模組與地圖" },
      { en: "A film adaptation", zh: "電影改編" }
    ],
    blocks: [
      { en: "2010s into the 2020s. Minecraft outgrows the program it started as. It becomes a brand, a classroom, a spectator sport, a music genre, a film, and a place where millions of people happen to know each other. Official spin-offs arrive — Dungeons, Legends, Education Edition — alongside Realms, the Marketplace, and live showcases watched by audiences larger than most television broadcasts.", zh: "2010 年代進入 2020 年代。Minecraft 長得比它起初的那個程式還大。它成為品牌、教室、觀賞型運動、一種音樂類型、一部電影，以及數百萬人碰巧彼此認識的地方。官方衍生作品陸續登場：Dungeons、Legends、教育版，還有 Realms、Marketplace，以及觀眾人數超過多數電視節目的線上發表會。" },
      { en: "But the bigger half of Minecraft was never made by Mojang. An enormous ecosystem of servers, mods, texture packs, data packs and custom maps is built entirely by players, much of it free, much of it made by teenagers who learned to program specifically so they could change this game.", zh: "但 Minecraft 較大的那一半，從來不是 Mojang 做的。一個由伺服器、模組、材質包、資料包和自訂地圖構成的龐大生態系，完全由玩家打造，其中很多是免費的，也有很多出自那些為了改造這款遊戲才學會寫程式的青少年之手。" },
      { en: "Creators turn the game into things nobody at Mojang designed: full cities built over years, working computers made of redstone, speedruns measured in seconds, competitive events watched by millions, music videos, history lessons, charity builds, and family worlds that stay alive for a decade. And in 2023, Minecraft became the first video game to pass 300 million copies sold — a number that says less about sales than about how many people have a world of their own somewhere.", zh: "創作者把這款遊戲變成 Mojang 沒有設計過的東西：花了數年打造的完整城市、用紅石做出能運作的電腦、以秒計算的速通、數百萬人觀看的競賽、音樂影片、歷史課程、公益建築，以及活了十年的家庭世界。而在 2023 年，Minecraft 成為第一款突破三億套銷量的電子遊戲，這個數字說的與其說是銷售，不如說是有多少人在某處擁有一個屬於自己的世界。" },
      { en: "Minecraft lasts because its centre is simple and its edges are endless.", zh: "Minecraft 能長久存在，是因為它的中心很簡單，而邊界沒有盡頭。" }
    ]
  },
  {
    id: "spread-18",
    titleEN: "Closing: Seventeen Years Of Blocks",
    titleZH: "結語：十七年的方塊",
    era: { en: "2009 → 2026 · Still going", zh: "2009 → 2026 · 仍在繼續" },
    image: "../assets/books/minecraft/2026-sulfur-caves.jpg",
    images: [
      "../assets/books/minecraft/2026-sulfur-caves.jpg",
      "../assets/books/minecraft/2023-trails-tales.jpg",
      "../assets/books/minecraft/2021-caves-cliffs.jpg",
      "../assets/books/minecraft/minecraft-java-bedrock.jpg"
    ],
    items: ["grass", "heart", "diamond"],
    stat: { value: "17 yrs", en: "of updates, and no ending in sight", zh: "更新的年數，而且看不到結局" },
    tip: { en: "Keep one old world and never delete it. In five years the buildings you think are clumsy today will be the best thing in your archive.", zh: "留一個老世界，永遠別刪掉它。五年後，你今天覺得笨拙的那些建築，會是你收藏裡最棒的東西。" },
    fact: { en: "Every Minecraft world is generated from a number, so the world you are playing in right now has almost certainly never been seen by anyone else.", zh: "每個 Minecraft 世界都是從一個數字生成的，所以你現在正在玩的這個世界，幾乎可以確定從來沒有其他人看過。" },
    keys: [
      { en: "Break, hold, build", zh: "破壞、持有、建造" },
      { en: "Home and wilderness", zh: "家與荒野" },
      { en: "Your world, your rules", zh: "你的世界，你的規則" }
    ],
    blocks: [
      { en: "From 2009 to 2026, Minecraft changes constantly and keeps its first promise anyway: the world is made of blocks, and the blocks are yours. Blocks, mobs, biomes, dimensions, redstone, tools, drops, graphics and platforms keep expanding, and seventeen years in there are still updates that make long-time players say they need to start a fresh world just to see it properly.", zh: "從 2009 到 2026 年，Minecraft 不斷改變，卻始終守住最初的承諾：世界由方塊構成，而方塊屬於你。方塊、生物、生態域、維度、紅石、工具、掉落、畫面和平台持續擴展；十七年過去，仍然有更新會讓老玩家說：我得開一個全新的世界，才能好好看看它。" },
      { en: "What is unusual is how little has been taken away. Almost everything added in 2010 still works in 2026. A player who stopped in Beta and came back today would recognise the crafting grid, the day-night cycle, the sound a pickaxe makes on stone, and the exact panic of hearing a creeper too late.", zh: "不尋常的是，被拿走的東西非常少。2010 年加入的幾乎所有東西，在 2026 年依然有效。一個在 Beta 時期停下、今天才回來的玩家，會認得合成格線、日夜循環、鎬敲在石頭上的聲音，以及太晚聽見苦力怕時那種一模一樣的驚慌。" },
      { en: "And every player quietly keeps a private archive: a first shelter dug into a hill, a first diamond, a first portal, a first base built with a friend, and usually one world that was lost and never quite replaced. None of that is in the patch notes. All of it is what people mean when they say they play Minecraft.", zh: "而每位玩家都靜靜保存著一份私人檔案：挖進山丘的第一個庇護所、第一顆鑽石、第一座傳送門、和朋友一起蓋的第一個基地，以及通常有一個失去之後再也沒能真正取代的世界。這些都不在更新日誌裡，卻正是人們說「我玩 Minecraft」時真正的意思。" },
      { en: "Mojang adds the words. Players write the sentences. That is the evolution of Minecraft.", zh: "Mojang 加入詞彙。玩家寫出句子。這就是 Minecraft 的演化。" }
    ]
  }
];
