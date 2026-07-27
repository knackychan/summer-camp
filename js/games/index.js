/* Static manifest — the one place that knows every game exists (design.md §2).
   Data only: no init, no stop, no DOM. Imported eagerly so the games grid can
   render all tiles without downloading nine game modules. Order is the grid
   order, matching the old Object.keys(LEVELS) order at index.html:2927. */

export var MANIFEST = [
  { id: "machines", brain: false, keyboard: true,  bestKey: null,      meta: { icon: "\ud83d\ude9c", title: "Big Machines",  tz: "\u5927\u6a5f\u5668",   blurb: "Race, dig & fly" } },
  { id: "city",     brain: false, keyboard: false, bestKey: "city",    meta: { icon: "\ud83c\udfd9\ufe0f", title: "City Drive",    tz: "\u57ce\u5e02\u958b\u8eca", blurb: "Drive & deliver" } },
  { id: "dig",      brain: false, keyboard: false, bestKey: "dig",     meta: { icon: "\u26cf\ufe0f", title: "Dig Site",      tz: "\u6316\u571f\u5de5\u5730", blurb: "Dig the right rocks" } },
  { id: "balloon",  brain: false, keyboard: true,  bestKey: "balloon", meta: { icon: "\ud83c\udf88", title: "Balloon Pop",   tz: "\u6233\u6c23\u7403",   blurb: "Pop balloons with keys" } },
  { id: "hunt",     brain: false, keyboard: true,  bestKey: null,      meta: { icon: "\ud83d\udd0e", title: "Key Hunt",      tz: "\u627e\u6309\u9375",   blurb: "Find the glowing key" } },
  { id: "home",     brain: false, keyboard: true,  bestKey: null,      meta: { icon: "\ud83c\udfaf", title: "Home Row",      tz: "\u57fa\u6e96\u9375",   blurb: "Learn your fingers" } },
  { id: "race",     brain: false, keyboard: true,  bestKey: "race",    meta: { icon: "\ud83d\ude80", title: "Word Racer",    tz: "\u6587\u5b57\u7af6\u901f", blurb: "Type fast for a score" } },
  { id: "orc",      brain: false, keyboard: true,  bestKey: "orc",     meta: { icon: "\u2694\ufe0f", title: "Orc Attack",    tz: "\u534a\u7378\u4eba\u4f86\u8972", blurb: "Type to defend the hero" } },
  { id: "vocab",    brain: false, keyboard: true,  bestKey: "shop",    meta: { icon: "\ud83e\uddd9", title: "Word Wizard",   tz: "\u6587\u5b57\u5deb\u5e2b", blurb: "Learn English words" } },

  { id: "solar",    brain: false, keyboard: false, bestKey: null,      legacy: false,
    meta: { icon: "\ud83e\ude90", title: "Solar System", tz: "\u592a\u967d\u7cfb", blurb: "Explore the planets" } },

  { id: "calc",     brain: true,  keyboard: false, bestKey: null, meta: { icon: "\u2795", title: "Calculations",    tz: "\u8a08\u7b97",     blurb: "Quick sums" } },
  { id: "signs",    brain: true,  keyboard: false, bestKey: null, meta: { icon: "\u2753", title: "Sign Finder",     tz: "\u627e\u7b26\u865f",   blurb: "Find the missing sign" } },
  { id: "lowhigh",  brain: true,  keyboard: false, bestKey: null, meta: { icon: "\ud83d\udd22", title: "Low to High",     tz: "\u7531\u5c0f\u5230\u5927", blurb: "Remember and order" } },
  { id: "stroop",   brain: true,  keyboard: false, bestKey: null, meta: { icon: "\ud83c\udfa8", title: "Color Words",     tz: "\u984f\u8272\u5b57",   blurb: "Say the ink, not the word" } },
  { id: "crunch",   brain: true,  keyboard: false, bestKey: null, meta: { icon: "\ud83d\udd0d", title: "Number Cruncher", tz: "\u6578\u4e00\u6578",   blurb: "Count them fast" } },
  { id: "clock",    brain: true,  keyboard: false, bestKey: null, meta: { icon: "\ud83d\udd50", title: "Time Lapse",      tz: "\u6642\u9418",     blurb: "Read the clock" } },
  { id: "change",   brain: true,  keyboard: false, bestKey: null, meta: { icon: "\ud83d\udcb1", title: "Change Maker",    tz: "\u627e\u96f6\u9322",   blurb: "Count the change" } },
  { id: "wordmem",  brain: true,  keyboard: false, bestKey: null, meta: { icon: "\ud83e\udde0", title: "Word Memory",     tz: "\u8a18\u55ae\u5b57",   blurb: "Remember the words" } },
  { id: "recall",   brain: true,  keyboard: false, bestKey: null, meta: { icon: "\ud83d\udd01", title: "Math Recall",     tz: "\u8a18\u61b6\u8a08\u7b97", blurb: "Answer the one before" } },
];

export function findEntry(id) {
  for (var i = 0; i < MANIFEST.length; i++) {
    if (MANIFEST[i].id === id) return MANIFEST[i];
  }
  return null;
}

export default MANIFEST;
