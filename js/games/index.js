/* Static manifest — the one place that knows every game exists (design.md §2).
   Data only: no init, no stop, no DOM. Imported eagerly so the games grid can
   render all tiles without downloading nine game modules. Order is the grid
   order, matching the old Object.keys(LEVELS) order at index.html:2927.
   Practice tab = brain: true plus practice: true (typing and word drills); those
   keep the game-switcher rail. Everything else is a Game and opens full screen
   (docs/plans/2026-10-03-games-practice-split/design.md). Dig Site and Change
   Maker were retired by Papa the same day. */

export var MANIFEST = [
  { id: "machines", brain: false, keyboard: true,  bestKey: null,      legacy: false,
    meta: { icon: "\ud83d\ude9c", title: "Big Machines",  tz: "\u5927\u6a5f\u5668",   blurb: "Race, dig & fly" } },
  { id: "monster-truck", brain: false, keyboard: false, bestKey: "monster_truck", legacy: false,
    meta: { icon: "\ud83d\udede\ufe0f", title: "Monster Truck", tz: "\u602a\u7378\u5361\u8eca", blurb: "Crush cars in 3D \u00b7 3D\u58d3\u8eca" } },
  { id: "kitchen",  brain: false, keyboard: false, bestKey: "kitchen", legacy: false,
    meta: { icon: "🍳", title: "Kitchen Quest", tz: "廚房冒險", blurb: "Cook & serve · 料理上菜" } },
  { id: "codequest", brain: false, keyboard: false, bestKey: "codequest", legacy: false,
    meta: { icon: "🏰", title: "Code Quest", tz: "程式冒險", blurb: "Program the hero · 編程闖關" } },
  { id: "balloon",  brain: false, keyboard: true,  bestKey: "balloon", legacy: false,
    meta: { icon: "\ud83c\udf88", title: "Balloon Pop",   tz: "\u6233\u6c23\u7403",   blurb: "Pop balloons with keys" } },
  { id: "hunt",     brain: false, keyboard: true,  bestKey: null,      legacy: false, practice: true,
    meta: { icon: "\ud83d\udd0e", title: "Key Hunt",      tz: "\u627e\u6309\u9375",   blurb: "Find the glowing key" } },
  { id: "home",     brain: false, keyboard: true,  bestKey: null,      legacy: false, practice: true,
    meta: { icon: "\ud83c\udfaf", title: "Home Row",      tz: "\u57fa\u6e96\u9375",   blurb: "Learn your fingers" } },
  { id: "race",     brain: false, keyboard: true,  bestKey: "race",    legacy: false,
    meta: { icon: "\ud83d\ude80", title: "Word Racer",    tz: "\u6587\u5b57\u7af6\u901f", blurb: "Type fast for a score" } },
  { id: "orc",      brain: false, keyboard: true,  bestKey: "orc",     legacy: false,
    meta: { icon: "\u2694\ufe0f", title: "Orc Attack",    tz: "\u534a\u7378\u4eba\u4f86\u8972", blurb: "Type to defend the hero" } },
  { id: "vocab",    brain: false, keyboard: true,  bestKey: "shop",    legacy: false, practice: true,
    meta: { icon: "\ud83e\uddd9", title: "Word Wizard",   tz: "\u6587\u5b57\u5deb\u5e2b", blurb: "Learn English words" } },

  { id: "solar",    brain: false, keyboard: false, bestKey: null,      legacy: false,
    meta: { icon: "\ud83e\ude90", title: "Solar System", tz: "\u592a\u967d\u7cfb", blurb: "Explore the planets" } },

  /* Creative tool, not screen-time reward \u2014 startGame() lets it through the block
     lock the same way Brain Gym goes through. */
  { id: "paint",    brain: false, keyboard: false, bestKey: null,      legacy: false,
    meta: { icon: "\ud83c\udfa8", title: "Paint & Colour", tz: "\u756b\u756b\u8457\u8272", blurb: "Colour the sheets" } },
  /* Creative builder, same open door as Paint (docs/plans/2026-10-03-brick-lab/ D4). */
  { id: "bricklab", brain: false, keyboard: false, bestKey: null,      legacy: false,
    meta: { icon: "🧱", title: "Brick Lab", tz: "積木實驗室", blurb: "Build with bricks · 積木建造" } },

  /* music: true keeps these out of the Games grid \u2014 they live in the Music Room
     tab, which hosts them full-screen (design.md D15 supersedes D1). They stay in
     this manifest because SQLoadGame, the sw.js precache guard and the ctx
     contract all key off it. */
  { id: "pads",   brain: false, keyboard: false, bestKey: "pads", legacy: false, music: true,
    meta: { icon: "\ud83e\udd41", title: "Drum Pads",  tz: "\u6253\u64ca\u588a",   blurb: "Finger drumming" } },
  { id: "piano",  brain: false, keyboard: false, bestKey: null,   legacy: false, music: true,
    meta: { icon: "\ud83c\udfb9", title: "Piano",      tz: "\u92fc\u7434",     blurb: "Play and practise" } },
  { id: "moog",   brain: false, keyboard: false, bestKey: null,   legacy: false, music: true,
    meta: { icon: "\ud83c\udf9b\ufe0f", title: "Synth",      tz: "\u5408\u6210\u5668",   blurb: "Twist the knobs" } },

  { id: "calc",     brain: true,  keyboard: false, bestKey: null, meta: { icon: "\u2795", title: "Calculations",    tz: "\u8a08\u7b97",     blurb: "Quick sums" } },
  { id: "signs",    brain: true,  keyboard: false, bestKey: null, meta: { icon: "\u2753", title: "Sign Finder",     tz: "\u627e\u7b26\u865f",   blurb: "Find the missing sign" } },
  { id: "lowhigh",  brain: true,  keyboard: false, bestKey: null, meta: { icon: "\ud83d\udd22", title: "Low to High",     tz: "\u7531\u5c0f\u5230\u5927", blurb: "Remember and order" } },
  { id: "stroop",   brain: true,  keyboard: false, bestKey: null, meta: { icon: "\ud83c\udfa8", title: "Color Words",     tz: "\u984f\u8272\u5b57",   blurb: "Say the ink, not the word" } },
  { id: "crunch",   brain: true,  keyboard: false, bestKey: null, meta: { icon: "🧩", title: "Number Bonds", tz: "數字好朋友", blurb: "Find a pair to make the target" } },
  { id: "clock",    brain: true,  keyboard: false, bestKey: null, meta: { icon: "\ud83d\udd50", title: "Time Lapse",      tz: "\u6642\u9418",     blurb: "Read the clock" } },
  { id: "wordmem",  brain: true,  keyboard: false, bestKey: null, meta: { icon: "\ud83e\udde0", title: "Word Memory",     tz: "\u8a18\u55ae\u5b57",   blurb: "Remember the words" } },
  { id: "recall",   brain: true,  keyboard: false, bestKey: null, meta: { icon: "\ud83d\udd01", title: "Math Recall",     tz: "\u8a18\u61b6\u8a08\u7b97", blurb: "Answer the one before" } },
  { id: "fractions", brain: true, keyboard: false, bestKey: null, meta: { icon: "🥪", title: "Fraction Picnic", tz: "分數野餐", blurb: "Share equal pieces · 平分每一份" } },
  { id: "balance", brain: true, keyboard: false, bestKey: null, meta: { icon: "⚖️", title: "Balance Lab", tz: "天平實驗室", blurb: "Balance the numbers · 讓數字平衡" } },
  { id: "circuit", brain: true, keyboard: false, bestKey: null, meta: { icon: "💡", title: "Circuit Builder", tz: "電路小工匠", blurb: "Build a working circuit · 動手接電路" } },
  { id: "sorter", brain: true, keyboard: false, bestKey: null, meta: { icon: "🔬", title: "Science Sorter", tz: "科學分類站", blurb: "Sort and discover why · 分類找原因" } },
  { id: "sentence", brain: true, keyboard: false, bestKey: null, meta: { icon: "🚂", title: "Sentence Train", tz: "句子小火車", blurb: "Put words in order · 排出完整句子" } },
  { id: "soundmatch", brain: true, keyboard: false, bestKey: null, meta: { icon: "🔊", title: "Sound Match", tz: "聽音找單字", blurb: "Listen and find a match · 聽一聽，找一找" } },
  { id: "memorymatch", brain: true, keyboard: false, bestKey: null, meta: { icon: "🃏", title: "Memory Match", tz: "記憶配對", blurb: "Remember the pictures · 記住圖片的位置" } },
  { id: "patternecho", brain: true, keyboard: false, bestKey: null, meta: { icon: "🎵", title: "Pattern Echo", tz: "節奏記憶", blurb: "Watch, remember, repeat · 看一看，記住，再點一次" } },
];

export function findEntry(id) {
  for (var i = 0; i < MANIFEST.length; i++) {
    if (MANIFEST[i].id === id) return MANIFEST[i];
  }
  return null;
}

export default MANIFEST;
