/* Science Book data — card deck for the book reader.
   Each card = { id, emoji, nameEN, nameZH, photo, typeEN, typeZH, group, facts[{en,tz}] }
   PHOTO PLACEHOLDERS: all images need to be scraped from Wikimedia Commons / public domain sources.
   See assets/books/science/README.md for the scrape list. */

var SCIENCE_CARDS = [
  /* ── MATTER ── */
  {
    id: "solid", emoji: "🪨", nameEN: "Solid", nameZH: "固體", photo: "../assets/books/science/solid.jpg",
    typeEN: "STATES OF MATTER", typeZH: "物質狀態", group: "matter",
    facts: [
      { en: "Solids have a fixed shape — they don't flow like liquids.", tz: "固體有固定的形狀——它們不像液體那樣流動。" },
      { en: "Atoms in a solid are packed tightly together.", tz: "固體中的原子緊密地排列在一起。" },
      { en: "Ice is the solid form of water.", tz: "冰是水的固體形態。" },
    ]
  },
  {
    id: "liquid", emoji: "💧", nameEN: "Liquid", nameZH: "液體", photo: "../assets/books/science/liquid.jpg",
    typeEN: "STATES OF MATTER", typeZH: "物質狀態", group: "matter",
    facts: [
      { en: "Liquids take the shape of their container.", tz: "液體會變成容器的形狀。" },
      { en: "Liquids flow because their atoms can slide past each other.", tz: "液體流動是因為原子可以互相滑過。" },
      { en: "Water is the most common liquid on Earth.", tz: "水是地球上最常見的液體。" },
    ]
  },
  {
    id: "gas", emoji: "💨", nameEN: "Gas", nameZH: "氣體", photo: "../assets/books/science/gas.jpg",
    typeEN: "STATES OF MATTER", typeZH: "物質狀態", group: "matter",
    facts: [
      { en: "Gases spread out to fill any space.", tz: "氣體會擴散填滿任何空間。" },
      { en: "The air we breathe is a mix of gases — mostly nitrogen and oxygen.", tz: "我們呼吸的空氣是氣體的混合物——主要是氮和氧。" },
      { en: "Steam rising from boiling water is water in gas form.", tz: "沸水冒出的蒸汽是氣態的水。" },
    ]
  },
  /* ── FORCES ── */
  {
    id: "gravity", emoji: "🌍", nameEN: "Gravity", nameZH: "重力", photo: "../assets/books/science/gravity.jpg",
    typeEN: "PHYSICS", typeZH: "物理", group: "forces",
    facts: [
      { en: "Gravity is the force that pulls everything toward each other.", tz: "重力是將所有物體互相拉近的力量。" },
      { en: "The Moon's gravity causes tides in Earth's oceans.", tz: "月球的重力引起了地球海洋的潮汐。" },
      { en: "If you jump on the Moon, you go 6 times higher than on Earth.", tz: "如果你在月球上跳，你會跳得比在地球上高6倍。" },
    ]
  },
  {
    id: "magnets", emoji: "🧲", nameEN: "Magnets", nameZH: "磁鐵", photo: "../assets/books/science/magnets.jpg",
    typeEN: "PHYSICS", typeZH: "物理", group: "forces",
    facts: [
      { en: "Every magnet has two poles — a north pole and a south pole.", tz: "每個磁鐵有兩個磁極——北極和南極。" },
      { en: "Earth itself is a giant magnet with a magnetic field.", tz: "地球本身就是一個有磁場的巨大磁鐵。" },
      { en: "Magnets can attract some metals but not others — like iron, not aluminium.", tz: "磁鐵可以吸引某些金屬但不是全部——比如鐵，但不會吸引鋁。" },
    ]
  },
  {
    id: "friction", emoji: "🛞", nameEN: "Friction", nameZH: "摩擦力", photo: "../assets/books/science/friction.jpg",
    typeEN: "PHYSICS", typeZH: "物理", group: "forces",
    facts: [
      { en: "Friction is the force that slows things down when they rub together.", tz: "摩擦力是物體摩擦時減慢速度的力量。" },
      { en: "Without friction, you couldn't walk — your feet would just slip.", tz: "沒有摩擦力，你就走不了路——你的腳會一直滑。" },
      { en: "Ice has very little friction, which is why it's so slippery.", tz: "冰的摩擦力很小，這就是為什麼它那麼滑。" },
    ]
  },
  /* ── ENERGY ── */
  {
    id: "light", emoji: "💡", nameEN: "Light", nameZH: "光", photo: "../assets/books/science/light.jpg",
    typeEN: "PHYSICS", typeZH: "物理", group: "energy",
    facts: [
      { en: "Light travels at about 300,000 km per second — the fastest thing in the universe.", tz: "光以每秒約30萬公里的速度傳播——是宇宙中最快的東西。" },
      { en: "White light is actually made of all the colours of the rainbow.", tz: "白光實際上是由彩虹的所有顏色組成的。" },
      { en: "Light from the Sun takes about 8 minutes to reach Earth.", tz: "太陽的光需要大約8分鐘才能到達地球。" },
    ]
  },
  {
    id: "sound", emoji: "🔊", nameEN: "Sound", nameZH: "聲音", photo: "../assets/books/science/sound.jpg",
    typeEN: "PHYSICS", typeZH: "物理", group: "energy",
    facts: [
      { en: "Sound travels as invisible waves through air, water, and solids.", tz: "聲音以無形波的形式通過空氣、水和固體傳播。" },
      { en: "Sound travels faster through water than through air.", tz: "聲音在水中傳播的速度比在空氣中快。" },
      { en: "In space, nobody can hear you — because there is no air for sound to travel through.", tz: "在太空中，沒有人能聽到你——因為沒有空氣讓聲音傳播。" },
    ]
  },
  {
    id: "electricity", emoji: "⚡", nameEN: "Electricity", nameZH: "電", photo: "../assets/books/science/electricity.jpg",
    typeEN: "PHYSICS", typeZH: "物理", group: "energy",
    facts: [
      { en: "Electricity is the flow of tiny particles called electrons.", tz: "電是叫做電子的微小粒子的流動。" },
      { en: "Lightning is a giant spark of static electricity in the sky.", tz: "閃電是天空中一個巨大的靜電火花。" },
      { en: "A single lightning bolt carries enough energy to power a house for a month.", tz: "一道閃電攜帶的能量足以供一棟房子使用一個月。" },
    ]
  },
  /* ── EARTH ── */
  {
    id: "volcano", emoji: "🌋", nameEN: "Volcano", nameZH: "火山", photo: "../assets/books/science/volcano.jpg",
    typeEN: "EARTH SCIENCE", typeZH: "地球科學", group: "earth",
    facts: [
      { en: "Volcanoes form when hot melted rock from inside Earth erupts.", tz: "火山是地球內部熱熔岩石噴發時形成的。" },
      { en: "The biggest volcano in our solar system is on Mars — Olympus Mons.", tz: "太陽系中最大的火山在火星上——奧林帕斯山。" },
      { en: "There are about 1,350 active volcanoes on Earth right now.", tz: "目前地球上大約有1350座活火山。" },
    ]
  },
  {
    id: "cloud", emoji: "☁️", nameEN: "Cloud", nameZH: "雲", photo: "../assets/books/science/cloud.jpg",
    typeEN: "EARTH SCIENCE", typeZH: "地球科學", group: "earth",
    facts: [
      { en: "Clouds are made of millions of tiny water droplets or ice crystals.", tz: "雲是由數百萬個微小的水滴或冰晶組成的。" },
      { en: "A typical cloud weighs about 500,000 kilograms.", tz: "一朵典型的雲重達約50萬公斤。" },
      { en: "There are 10 main types of clouds — from fluffy cumulus to wispy cirrus.", tz: "雲有10種主要類型——從蓬鬆的積雲到纖細的卷雲。" },
    ]
  },
  {
    id: "rainbow", emoji: "🌈", nameEN: "Rainbow", nameZH: "彩虹", photo: "../assets/books/science/rainbow.jpg",
    typeEN: "EARTH SCIENCE", typeZH: "地球科學", group: "earth",
    facts: [
      { en: "Rainbows form when sunlight shines through raindrops.", tz: "彩虹是太陽光穿過雨滴時形成的。" },
      { en: "A rainbow is actually a full circle — we usually only see half from the ground.", tz: "彩虹其實是一個完整的圓圈——從地面我們通常只看到一半。" },
      { en: "No two people see exactly the same rainbow.", tz: "沒有兩個人能看到完全一樣的彩虹。" },
    ]
  },
  /* ── BODY ── */
  {
    id: "heart", emoji: "❤️", nameEN: "Heart", nameZH: "心臟", photo: "../assets/books/science/heart.jpg",
    typeEN: "HUMAN BODY", typeZH: "人體", group: "body",
    facts: [
      { en: "Your heart beats about 100,000 times every day.", tz: "你的心臟每天跳動約10萬次。" },
      { en: "The heart pumps blood to every part of your body through 96,000 km of blood vessels.", tz: "心臟通過96,000公里的血管將血液輸送到身體的每個部位。" },
      { en: "A child's heart is about the size of their fist.", tz: "小孩的心臟大約和拳頭一樣大。" },
    ]
  },
  {
    id: "lungs", emoji: "🫁", nameEN: "Lungs", nameZH: "肺", photo: "../assets/books/science/lungs.jpg",
    typeEN: "HUMAN BODY", typeZH: "人體", group: "body",
    facts: [
      { en: "Your lungs take in oxygen and breathe out carbon dioxide.", tz: "你的肺吸入氧氣並呼出二氧化碳。" },
      { en: "The surface area of your lungs is about the size of a tennis court.", tz: "你肺部的表面積大約有一個網球場那麼大。" },
      { en: "We breathe about 20,000 times every day.", tz: "我們每天大約呼吸2萬次。" },
    ]
  },
  {
    id: "brain", emoji: "🧠", nameEN: "Brain", nameZH: "大腦", photo: "../assets/books/science/brain.jpg",
    typeEN: "HUMAN BODY", typeZH: "人體", group: "body",
    facts: [
      { en: "The brain uses about 20% of all the energy in your body.", tz: "大腦消耗了你身體大約 20% 的能量。" },
      { en: "Your brain keeps working even when you sleep.", tz: "即使在你睡覺的時候，你的大腦也在工作。" },
      { en: "The human brain has about 86 billion tiny cells called neurons.", tz: "人類的大腦有大約860億個叫做神經元的微小細胞。" },
    ]
  },
  {
    id: "skeleton", emoji: "🦴", nameEN: "Skeleton", nameZH: "骨骼", photo: "../assets/books/science/skeleton.jpg",
    typeEN: "HUMAN BODY", typeZH: "人體", group: "body",
    facts: [
      { en: "An adult human has 206 bones — babies start with about 300.", tz: "成年人有206塊骨頭——嬰兒出生時大約有300塊。" },
      { en: "Bones are stronger than steel, weight for weight.", tz: "以重量比來說，骨頭比鋼還堅固。" },
      { en: "More than half of your bones are in your hands and feet.", tz: "你一半以上的骨頭都在手和腳裡。" },
    ]
  },
  /* ── MORE ── */
  {
    id: "photosynthesis", emoji: "🌿", nameEN: "Photosynthesis", nameZH: "光合作用", photo: "../assets/books/science/photosynthesis.jpg",
    typeEN: "LIFE SCIENCE", typeZH: "生命科學", group: "earth",
    facts: [
      { en: "Plants make their own food using sunlight, water, and carbon dioxide.", tz: "植物利用陽光、水和二氧化碳來製作自己的食物。" },
      { en: "This process gives out oxygen — the air we need to breathe.", tz: "這個過程會釋放氧氣——我們呼吸所需的空氣。" },
      { en: "Without photosynthesis, there would be no food for animals or humans.", tz: "沒有光合作用，就沒有給動物或人類的食物。" },
    ]
  },
  {
    id: "watercycle", emoji: "🔄", nameEN: "Water Cycle", nameZH: "水循環", photo: "../assets/books/science/watercycle.jpg",
    typeEN: "EARTH SCIENCE", typeZH: "地球科學", group: "earth",
    facts: [
      { en: "Water on Earth never runs out — it keeps moving in a big circle.", tz: "地球上的水永遠不會用完——它在一個大循環中不斷流動。" },
      { en: "The same water dinosaurs drank could be in your glass today.", tz: "恐龍喝過的水可能今天就在你的杯子裡。" },
      { en: "The water cycle has 4 steps: evaporation, condensation, precipitation, and collection.", tz: "水循環有4個步驟：蒸發、凝結、降水和收集。" },
    ]
  },
];
