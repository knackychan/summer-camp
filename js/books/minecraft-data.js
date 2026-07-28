/* Minecraft Evolution Book — 25 spreads, 4 blocks each, bilingual EN + 繁體中文.
   Source: docs/plans/2026-07-28-books/43-minecraft-four-block-layout.md */

var MINECRAFT_SPREADS = [
  {
    id: "spread-01",
    titleEN: "A Game That Starts With A Question",
    titleZH: "一個從問題開始的遊戲",
    image: "../assets/books/minecraft/minecraft-java-bedrock.jpg",
    blocks: [
      { en: "2009. Markus \"Notch\" Persson begins a small prototype first known as Cave Game.", zh: "2009 年。Markus「Notch」Persson 開始製作一個小原型，最早叫做 Cave Game。" },
      { en: "The early idea is simple: a first-person world made of blocks that can be removed and placed again.", zh: "最早的想法很簡單：一個第一人稱方塊世界，方塊可以被移除，也可以再次放置。" },
      { en: "The game grows in public. Players see rough versions, give feedback, and become part of development.", zh: "遊戲在公開環境中成長。玩家看見粗糙版本、提供回饋，並成為開發的一部分。" },
      { en: "Minecraft begins not as a fixed story, but as a question: what do you want to make?", zh: "Minecraft 一開始不是固定故事，而是一個問題：你想做什麼？" }
    ]
  },
  {
    id: "spread-02",
    titleEN: "Inspirations Before Minecraft",
    titleZH: "Minecraft 之前的靈感",
    image: "../assets/books/minecraft/minecraft-java-bedrock.jpg",
    blocks: [
      { en: "Before May 2009, Notch experiments with systems, prototypes, and ideas from other games.", zh: "2009 年 5 月之前，Notch 已經在嘗試系統、原型，以及其他遊戲帶來的靈感。" },
      { en: "Infiniminer shows the thrill of digging and building in a block world. Dwarf Fortress suggests deep simulation. Dungeon Keeper suggests underground play.", zh: "Infiniminer 展示方塊世界挖掘與建造的魅力。Dwarf Fortress 暗示深層模擬。Dungeon Keeper 暗示地下空間玩法。" },
      { en: "Minecraft is not a copy of one game. It is a new mixture of known ideas with a very clear action loop.", zh: "Minecraft 不是單一遊戲的複製品。它把已知想法重新混合，並形成非常清楚的操作循環。" },
      { en: "The magic is not only \"blocks.\" It is ownership: break material, carry it, and reshape the world.", zh: "魔力不只是「方塊」，而是擁有感：打下材料、帶走材料，再重塑世界。" }
    ]
  },
  {
    id: "spread-03",
    titleEN: "Classic And The First Public Build",
    titleZH: "Classic 與第一個公開版本",
    blocks: [
      { en: "May 17, 2009. The first public Minecraft build appears.", zh: "2009 年 5 月 17 日。第一個公開 Minecraft 版本出現。" },
      { en: "Classic is mostly a building toy. The world is simple, flat by modern standards, and limited, but the core interaction works.", zh: "Classic 主要像建造玩具。以今日標準看，世界簡單、平坦且有限，但核心互動已經成立。" },
      { en: "Forums, screenshots, and player experiments start shaping the game's direction.", zh: "論壇、截圖和玩家實驗開始影響遊戲方向。" },
      { en: "A rough prototype can be powerful when the central verb is strong. Minecraft's verb is \"change.\"", zh: "當核心動詞夠強時，粗糙原型也能很有力量。Minecraft 的動詞是「改變」。" }
    ]
  },
  {
    id: "spread-04",
    titleEN: "Survival Test",
    titleZH: "生存測試",
    blocks: [
      { en: "Late 2009. Survival ideas begin turning the sandbox into a challenge.", zh: "2009 年後期。生存想法開始把沙盒變成挑戰。" },
      { en: "Health, danger, mobs, and damage make the same blocks feel different. A wall becomes shelter. A hole becomes a hiding place.", zh: "生命值、危險、怪物和傷害讓同樣的方塊有不同意義。牆成為庇護所。洞成為躲藏處。" },
      { en: "Players now share survival stories, not only buildings.", zh: "玩家開始分享生存故事，而不只是建築作品。" },
      { en: "Creative freedom becomes stronger when the world can push back.", zh: "當世界會反抗時，創造自由會變得更有張力。" }
    ]
  },
  {
    id: "spread-05",
    titleEN: "The Creeper Lesson",
    titleZH: "苦力怕的一課",
    image: "../assets/books/minecraft/2022-wild-update.jpg",
    blocks: [
      { en: "Early development. A mistaken pig model helps create the creeper.", zh: "早期開發。一個錯誤的豬模型促成苦力怕。" },
      { en: "The creeper is quiet, approaches without arms, hisses, then explodes. It destroys space, not only health.", zh: "苦力怕很安靜，沒有手臂地靠近，發出嘶聲，然後爆炸。它破壞空間，而不只是傷害生命值。" },
      { en: "The creeper becomes Minecraft's most famous monster and one of gaming's most recognizable icons.", zh: "苦力怕成為 Minecraft 最有名的怪物，也成為遊戲史上最容易辨認的圖像之一。" },
      { en: "A mistake can become great design when it creates a memorable emotion.", zh: "當錯誤能製造難忘情緒時，它就可能變成偉大設計。" }
    ]
  },
  {
    id: "spread-06",
    titleEN: "Indev And Crafting",
    titleZH: "Indev 與合成系統",
    blocks: [
      { en: "December 2009 into early 2010. Indev means \"in development.\"", zh: "2009 年 12 月到 2010 年初。Indev 代表「in development」。" },
      { en: "Crafting, smelting, tools, food, light, and a stronger day-night rhythm make survival more structured.", zh: "合成、熔煉、工具、食物、光源，以及更明確的日夜節奏，讓生存更有結構。" },
      { en: "Players begin learning recipes, sharing discoveries, and building routine survival knowledge.", zh: "玩家開始學習配方、分享發現，並建立日常生存知識。" },
      { en: "Minecraft's systems interlock: wood leads to tools, tools lead to stone, stone leads deeper.", zh: "Minecraft 的系統互相咬合：木頭導向工具，工具導向石頭，石頭導向更深處。" }
    ]
  },
  {
    id: "spread-07",
    titleEN: "Infdev And The Horizon",
    titleZH: "Infdev 與地平線",
    image: "../assets/books/minecraft/2021-caves-cliffs-p1.jpg",
    blocks: [
      { en: "2010. Infdev promises worlds that keep generating as players travel.", zh: "2010 年。Infdev 承諾世界會隨玩家旅行持續生成。" },
      { en: "The map becomes enormous in practice. Caves, hills, forests, lakes, and terrain make exploration feel open-ended.", zh: "地圖在實際感受上變得巨大。洞穴、山丘、森林、湖泊和地形讓探索感覺沒有盡頭。" },
      { en: "Players now create homes, leave them, get lost, return with resources, and improve them.", zh: "玩家開始建家、離家、迷路、帶著資源回來，再改善基地。" },
      { en: "Minecraft discovers the emotional loop of home and wilderness.", zh: "Minecraft 發現了「家」與「荒野」之間的情感循環。" }
    ]
  },
  {
    id: "spread-08",
    titleEN: "Alpha, Mojang, And Multiplayer",
    titleZH: "Alpha、Mojang 與多人模式",
    blocks: [
      { en: "2010. Minecraft enters Alpha, becomes paid, and Mojang forms around the game's growth.", zh: "2010 年。Minecraft 進入 Alpha，成為付費遊戲，Mojang 也隨著遊戲成長而成立。" },
      { en: "Animals, hostile mobs, multiplayer survival, minecarts, redstone basics, and more familiar blocks arrive.", zh: "動物、敵對怪物、生存多人模式、礦車、紅石基礎，以及更多熟悉方塊登場。" },
      { en: "Multiplayer changes Minecraft from a private world into a shared canvas, shared joke, and shared responsibility.", zh: "多人模式讓 Minecraft 從私人世界變成共同畫布、共同玩笑和共同責任。" },
      { en: "A Minecraft world becomes more meaningful when other people can remember it too.", zh: "當其他人也能記住同一個世界時，Minecraft 世界會更有意義。" }
    ]
  },
  {
    id: "spread-09",
    titleEN: "The Nether Opens",
    titleZH: "Nether 開啟",
    image: "../assets/books/minecraft/2020-nether-update.jpg",
    blocks: [
      { en: "October 2010. The Halloween Update introduces the Nether.", zh: "2010 年 10 月。萬聖節更新加入 Nether。" },
      { en: "A portal leads to lava, strange terrain, new materials, and a hostile dimension.", zh: "傳送門通往岩漿、奇異地形、新材料和敵意維度。" },
      { en: "Players now build portal rooms, travel networks, and stories about dangerous expeditions.", zh: "玩家開始建造傳送門房、旅行網路，以及危險遠征的故事。" },
      { en: "Minecraft proves it can contain worlds inside worlds.", zh: "Minecraft 證明它能在世界裡容納另一個世界。" }
    ]
  },
  {
    id: "spread-10",
    titleEN: "Beta And The Adventure Shape",
    titleZH: "Beta 與冒險形狀",
    blocks: [
      { en: "December 2010 to 2011. Beta becomes a huge public work-in-progress.", zh: "2010 年 12 月到 2011 年。Beta 成為龐大的公開開發中作品。" },
      { en: "Beds, weather, wolves, maps, pistons, hunger, villages, ravines, strongholds, Endermen, potions, and enchantments arrive.", zh: "床、天氣、狼、地圖、活塞、飢餓、村莊、峽谷、要塞、終界使者、藥水和附魔登場。" },
      { en: "The community documents recipes, makes tutorials, builds servers, and spreads the game through video.", zh: "社群記錄配方、製作教學、建立伺服器，並透過影片傳播遊戲。" },
      { en: "Minecraft gains structure without becoming linear.", zh: "Minecraft 得到結構，卻沒有變成線性遊戲。" }
    ]
  },
  {
    id: "spread-11",
    titleEN: "Version 1.0",
    titleZH: "版本 1.0",
    image: "../assets/books/minecraft/2021-caves-cliffs.jpg",
    blocks: [
      { en: "November 18, 2011. Minecraft 1.0 officially launches.", zh: "2011 年 11 月 18 日。Minecraft 1.0 正式推出。" },
      { en: "The End, the Ender Dragon, enchanting, brewing, breeding, hardcore mode, and credits give the sandbox an optional ending.", zh: "終界、終界龍、附魔、釀造、繁殖、極限模式和片尾名單，給沙盒一個可選擇的結局。" },
      { en: "Minecraft is now an official release, but players can still ignore the ending and make their own goals.", zh: "Minecraft 現在是正式版本，但玩家仍可無視結局，自己設定目標。" },
      { en: "The game becomes a rare thing: open-ended, but still capable of myth.", zh: "遊戲成為少見的存在：開放無盡，卻仍能擁有神話。" }
    ]
  },
  {
    id: "spread-12",
    titleEN: "2012 To 2013, The Vocabulary Expands",
    titleZH: "2012 到 2013 年，詞彙擴張",
    blocks: [
      { en: "2012 and 2013. Java 1.1 through 1.7 widen the game quickly.", zh: "2012 到 2013 年。Java 1.1 到 1.7 快速擴大遊戲。" },
      { en: "Jungles, ocelots, iron golems, trading, emeralds, temples, the Wither, command blocks, hoppers, comparators, horses, and new biomes arrive.", zh: "叢林、豹貓、鐵魔像、交易、綠寶石、神殿、凋零怪、指令方塊、漏斗、比較器、馬和新生態域登場。" },
      { en: "Builders, redstone engineers, survival players, explorers, and mapmakers all gain new tools.", zh: "建築玩家、紅石工程師、生存玩家、探索玩家和地圖作者都得到新工具。" },
      { en: "Minecraft becomes many games without splitting apart.", zh: "Minecraft 變成許多種遊戲，卻沒有分裂。" }
    ]
  },
  {
    id: "spread-13",
    titleEN: "2014 And Microsoft",
    titleZH: "2014 年與 Microsoft",
    blocks: [
      { en: "September 2014. Microsoft announces a $2.5 billion agreement to acquire Mojang.", zh: "2014 年 9 月。Microsoft 宣布以 25 億美元收購 Mojang。" },
      { en: "The Bountiful Update adds granite, diorite, andesite, slime blocks, banners, armor stands, ocean monuments, guardians, and stronger commands.", zh: "Bountiful Update 加入花崗岩、閃長岩、安山岩、史萊姆方塊、旗幟、盔甲座、海底遺跡、守衛者和更強指令。" },
      { en: "Minecraft changes from runaway indie success into a major global franchise with corporate support.", zh: "Minecraft 從爆紅獨立遊戲變成有企業支援的全球大型品牌。" },
      { en: "The challenge becomes growth without losing strangeness.", zh: "挑戰變成：如何成長，卻不失去奇特個性。" }
    ]
  },
  {
    id: "spread-14",
    titleEN: "Combat, Education, And Exploration",
    titleZH: "戰鬥、教育與探索",
    blocks: [
      { en: "2016. Combat changes, Education Edition launches, and exploration features expand.", zh: "2016 年。戰鬥改版、教育版推出，探索功能擴大。" },
      { en: "Cooldowns, shields, elytra, polar bears, husks, strays, woodland mansions, explorer maps, shulker boxes, llamas, and illagers appear.", zh: "攻擊冷卻、盾牌、鞘翅、北極熊、屍殼、流髑、林地府邸、探險家地圖、界伏盒、駱馬和災厄村民出現。" },
      { en: "Teachers begin using Minecraft as a supported learning platform for collaboration, coding, history, and design.", zh: "老師開始把 Minecraft 當成受支援的學習平台，用於合作、程式、歷史和設計。" },
      { en: "Minecraft becomes not only a game to play, but a place to teach, argue, explore, and create systems.", zh: "Minecraft 不只是一款可玩的遊戲，也成為教學、討論、探索和創造系統的地方。" }
    ]
  },
  {
    id: "spread-15",
    titleEN: "Color, Bedrock, And Cross-Play",
    titleZH: "色彩、Bedrock 與跨平台遊玩",
    image: "../assets/books/minecraft/2017-world-of-color.jpg",
    blocks: [
      { en: "2017. World of Color and the Better Together direction reshape expression and access.", zh: "2017 年。World of Color 和 Better Together 方向重塑表達與可及性。" },
      { en: "Concrete, glazed terracotta, colored beds, parrots, and refreshed colors give builders a brighter palette.", zh: "混凝土、釉陶、彩色床、鸚鵡和更新後的顏色，給建築玩家更明亮的調色盤。" },
      { en: "Bedrock helps many consoles, mobile devices, and Windows players share worlds more easily.", zh: "Bedrock 讓許多主機、行動裝置和 Windows 玩家更容易共享世界。" },
      { en: "Minecraft now has two main identities: Java for PC heritage and mods, Bedrock for cross-platform families and devices.", zh: "Minecraft 現在有兩個主要身份：Java 承接 PC 歷史和模組，Bedrock 支援跨平台家庭與裝置。" }
    ]
  },
  {
    id: "spread-16",
    titleEN: "Oceans, Villages, Bees, Nether",
    titleZH: "海洋、村莊、蜜蜂與 Nether",
    image: "../assets/books/minecraft/2018-aquatic.jpg",
    blocks: [
      { en: "2018 to 2020. Familiar spaces receive major redesigns.", zh: "2018 到 2020 年。熟悉空間迎來大型重設。" },
      { en: "Update Aquatic fills oceans. Village & Pillage rebuilds villages. Buzzy Bees adds ecology. Nether Update rebuilds the Nether with new biomes, mobs, and Netherite.", zh: "Update Aquatic 填滿海洋。Village & Pillage 重建村莊。Buzzy Bees 加入生態。Nether Update 用新生態域、生物和獄髓重建 Nether。" },
      { en: "Players return to old spaces and discover that they now have new stories.", zh: "玩家回到舊空間，發現那裡已經有新故事。" },
      { en: "Minecraft's world is not fixed. Even the places players think they know can wake up again.", zh: "Minecraft 世界不是固定的。即使玩家以為熟悉的地方，也能再次醒來。" }
    ]
  },
  {
    id: "spread-17",
    titleEN: "Caves & Cliffs",
    titleZH: "洞穴與山崖",
    image: "../assets/books/minecraft/2021-caves-cliffs-p1.jpg",
    blocks: [
      { en: "2021. Caves & Cliffs is split into two parts because it is so large.", zh: "2021 年。Caves & Cliffs 因為太大，被拆成兩部分。" },
      { en: "Part I adds copper, amethyst, axolotls, glow squids, goats, candles, moss, dripstone, and deepslate. Part II expands world height and transforms terrain.", zh: "第一部分加入銅、紫水晶、美西螈、發光魷魚、山羊、蠟燭、苔蘚、滴水石和深板岩。第二部分擴大世界高度並改造地形。" },
      { en: "Builders gain mountains. Miners gain vast caves. Explorers gain a new sense of scale.", zh: "建築玩家得到高山。礦工得到巨大洞穴。探索玩家得到新的尺度感。" },
      { en: "Changing terrain changes the memory shape of every new world.", zh: "改變地形，就會改變每個新世界的記憶形狀。" }
    ]
  },
  {
    id: "spread-18",
    titleEN: "The Wild Update",
    titleZH: "荒野更新",
    image: "../assets/books/minecraft/2022-wild-update.jpg",
    blocks: [
      { en: "2022. The Wild Update adds both softness and fear.", zh: "2022 年。The Wild Update 同時加入柔和與恐懼。" },
      { en: "Mangrove swamps, mud, frogs, tadpoles, allays, chests in boats, the deep dark, ancient cities, sculk, and the Warden arrive.", zh: "紅樹林沼澤、泥巴、青蛙、蝌蚪、悅靈、箱船、深淵、遠古城市、伏聆和伏守者登場。" },
      { en: "Players learn that the Warden is not a normal enemy. Sometimes the smartest move is silence.", zh: "玩家學到伏守者不是普通敵人。有時最聰明的行動是保持安靜。" },
      { en: "Minecraft adds danger without turning into a combat-only game.", zh: "Minecraft 加入危險，卻沒有變成只有戰鬥的遊戲。" }
    ]
  },
  {
    id: "spread-19",
    titleEN: "Trails & Tales",
    titleZH: "足跡與故事",
    image: "../assets/books/minecraft/2023-trails-tales.jpg",
    blocks: [
      { en: "2023. Trails & Tales focuses on memory, identity, and discovery.", zh: "2023 年。Trails & Tales 聚焦於記憶、身份和發現。" },
      { en: "Archaeology, pottery sherds, decorated pots, cherry groves, camels, sniffers, armor trims, bamboo blocks, rafts, and hanging signs arrive.", zh: "考古、陶器碎片、裝飾陶罐、櫻花樹林、駱駝、嗅探獸、盔甲紋飾、竹方塊、竹筏和懸掛告示牌登場。" },
      { en: "Players can now show identity through armor, build with new soft colors, and tell older-looking stories.", zh: "玩家現在能透過盔甲展現身份，用新的柔和色彩建造，也能講出更像古老過去的故事。" },
      { en: "The world becomes a memory field, not only a resource field.", zh: "世界變成記憶場，而不只是資源場。" }
    ]
  },
  {
    id: "spread-20",
    titleEN: "The Game Drop Era",
    titleZH: "遊戲掉落時代",
    blocks: [
      { en: "2023 onward. Mojang moves toward smaller, more frequent themed game drops.", zh: "2023 年起。Mojang 轉向更小、更頻繁且主題明確的遊戲掉落。" },
      { en: "Instead of one huge annual update, drops can focus on bats, pots, wolf armor, bundles, ambience, copper, mounts, baby mobs, or sulfur caves.", zh: "不再只有一年一個巨大更新，掉落可以專注在蝙蝠、陶罐、狼盔甲、收納袋、氛圍、銅、坐騎、幼年怪物或硫磺洞穴。" },
      { en: "Players receive new reasons to return throughout the year.", zh: "玩家一整年都會得到回來遊玩的新理由。" },
      { en: "Minecraft begins evolving like a calendar, not only like a yearly festival.", zh: "Minecraft 開始像日曆一樣演化，而不只是年度節慶。" }
    ]
  },
  {
    id: "spread-21",
    titleEN: "Tricky Trials And The 2024 Drops",
    titleZH: "Tricky Trials 與 2024 年掉落",
    image: "../assets/books/minecraft/2024-tricky-trials.jpg",
    blocks: [
      { en: "2024. Armored Paws, Tricky Trials, Bundles of Bravery, and The Garden Awakens build the new rhythm.", zh: "2024 年。Armored Paws、Tricky Trials、Bundles of Bravery 和 The Garden Awakens 建立新節奏。" },
      { en: "Wolf armor, armadillos, trial chambers, the Breeze, the Bogged, vaults, the mace, the crafter, bundles, pale gardens, resin, eyeblossoms, and the Creaking arrive.", zh: "狼盔甲、犰狳、試煉密室、旋風使者、沼骸、寶庫、重錘、合成器、收納袋、蒼白花園、樹脂、眼花和嘎枝怪登場。" },
      { en: "Different playstyles receive different gifts: pet care, combat challenge, inventory help, atmosphere, and technical automation.", zh: "不同玩法得到不同禮物：寵物照顧、戰鬥挑戰、背包改善、氣氛和技術自動化。" },
      { en: "Tricky Trials is not the end of Minecraft's evolution. It is one stop in the drop era.", zh: "Tricky Trials 不是 Minecraft 演化的終點，而是掉落時代中的一站。" }
    ]
  },
  {
    id: "spread-22",
    titleEN: "2025, Skies And Copper",
    titleZH: "2025 年，天空與銅",
    image: "../assets/books/minecraft/2025-chase-skies.jpg",
    blocks: [
      { en: "2025. Spring to Life, Chase the Skies, The Copper Age, and Mounts of Mayhem arrive.", zh: "2025 年。Spring to Life、Chase the Skies、The Copper Age 和 Mounts of Mayhem 登場。" },
      { en: "Ambient variants, happy ghasts, flying mounts, player locator tools, Vibrant Visuals on Bedrock, copper golems, copper equipment, shelves, spears, nautilus mounts, and mounted combat expand play.", zh: "環境變種、快樂幽魂、飛行坐騎、玩家定位工具、Bedrock 的 Vibrant Visuals、銅魔像、銅裝備、架子、長矛、鸚鵡螺坐騎與騎乘戰鬥擴展玩法。" },
      { en: "Minecraft now serves cozy players, explorers, technical builders, visual players, and combat players in separate but connected releases.", zh: "Minecraft 現在透過分開但相連的版本，服務溫馨玩家、探索玩家、技術建築玩家、視覺玩家與戰鬥玩家。" },
      { en: "The game keeps finding new movement: through air, water, horseback, machines, and friendship.", zh: "遊戲持續找到新的移動方式：天空、水下、馬背、機械和友情。" }
    ]
  },
  {
    id: "spread-23",
    titleEN: "2026, Tiny Takeover And Chaos Cubed",
    titleZH: "2026 年，Tiny Takeover 與 Chaos Cubed",
    image: "../assets/books/minecraft/2026-chaos-cubed.jpg",
    blocks: [
      { en: "2026. Tiny Takeover launches in March. Chaos Cubed launches in June and is the latest official release shown on Minecraft.net as of 2026-07-28.", zh: "2026 年。Tiny Takeover 於 3 月推出。Chaos Cubed 於 6 月推出，且截至 2026-07-28 是 Minecraft.net 顯示的最新官方版本。" },
      { en: "Tiny Takeover expands baby mobs, craftable name tags, and golden dandelions. Chaos Cubed adds sulfur cubes, sulfur caves, cinnabar and sulfur blocks, geysers, new music, Friends List, and experimental Vulkan rendering in Java 26.2.", zh: "Tiny Takeover 擴展幼年怪物、可合成命名牌和金蒲公英。Chaos Cubed 在 Java 26.2 加入硫磺方塊怪、硫磺洞穴、硃砂與硫磺方塊、間歇泉、新音樂、好友列表和實驗性 Vulkan 渲染。" },
      { en: "The sulfur cube turns a mob into a physics toy, a puzzle object, and a player-made game tool.", zh: "硫磺方塊怪把生物變成物理玩具、謎題物件和玩家自製遊戲工具。" },
      { en: "The latest Minecraft still follows the oldest rule: one simple system can become many stories.", zh: "最新 Minecraft 仍遵守最古老的規則：一個簡單系統可以變成許多故事。" }
    ]
  },
  {
    id: "spread-24",
    titleEN: "Minecraft Outside The Game",
    titleZH: "遊戲之外的 Minecraft",
    image: "../assets/books/minecraft/minecraft-java-bedrock.jpg",
    blocks: [
      { en: "2010s to 2020s. Minecraft becomes bigger than one game client.", zh: "2010 年代到 2020 年代。Minecraft 變得比單一遊戲程式更大。" },
      { en: "Dungeons, Legends, Education, Realms, Marketplace, servers, mods, maps, livestreams, speedruns, and film adaptations expand the block world.", zh: "Dungeons、Legends、Education、Realms、Marketplace、伺服器、模組、地圖、直播、速通和電影改編擴大方塊世界。" },
      { en: "Creators turn Minecraft into tutorials, cities, stories, competitions, classrooms, music videos, and shared family worlds.", zh: "創作者把 Minecraft 變成教學、城市、故事、競賽、教室、音樂影片和家庭共享世界。" },
      { en: "Minecraft survives because its center is simple and its edges are endless.", zh: "Minecraft 能長久存在，是因為中心很簡單，邊界卻沒有盡頭。" }
    ]
  },
  {
    id: "spread-25",
    titleEN: "Closing Spread",
    titleZH: "結尾跨頁",
    image: "../assets/books/minecraft/2026-sulfur-caves.jpg",
    blocks: [
      { en: "From 2009 to 2026, Minecraft changes constantly but keeps its first promise.", zh: "從 2009 到 2026，Minecraft 不斷改變，卻保留最初承諾。" },
      { en: "Blocks, mobs, biomes, dimensions, redstone, tools, drops, graphics, and platforms keep expanding.", zh: "方塊、生物、生態域、維度、紅石、工具、掉落、畫面和平台持續擴展。" },
      { en: "Every player adds a private archive: a first shelter, first diamond, first portal, first shared base, or first lost world.", zh: "每位玩家都加入私人檔案：第一個庇護所、第一顆鑽石、第一座傳送門、第一個共同基地，或第一個失去的世界。" },
      { en: "Mojang adds words. Players write sentences. That is the evolution of Minecraft.", zh: "Mojang 加入詞彙。玩家寫出句子。這就是 Minecraft 的演化。" }
    ]
  }
];
