/* Key Hunt 🔎 找按鍵 — simple letter-hunt game migrated from index.html:1366-1381 (slice 18). */
var S = null, C = null;

function isBopomofo() { return !!(C && C.inputScript === "bpmf" && C.bopomofo); }

/* Zhuyin hunt targets borrow their picture word from the shared pack: a word that
   starts with the symbol, else one that merely contains it. No second table to
   keep in sync with bopomofo.js; symbols no word uses just sit out. */
export function bopomofoTargets(rows, pool) {
  var out = {};
  rows.forEach(function (row) {
    row.forEach(function (sym) {
      var hit = pool.filter(function (w) { return w[0].indexOf(sym) === 0; })[0]
        || pool.filter(function (w) { return w[0].indexOf(sym) >= 0; })[0];
      if (hit) out[sym] = hit[1] + " " + hit[2];
    });
  });
  return out;
}

function nextHunt() {
  var L = S.bpmf || C.words.letters;
  var keys = Object.keys(L);
  var letter = C.rand(keys);
  S.letter = letter;
  var parts = L[letter].split(" ");
  var em = parts[0];
  var rest = parts.slice(1).join(" ");
  C.stage.innerHTML =
    '<div class="game-scene game-scene--hunt">'
    + '<div class="game-scene__center">'
    + '<div class="cue">Press this key ' + (S.bpmf ? "\u6309\u9019\u500b\u9375 " : "") + '\ud83d\udc47</div>'
    + '<div class="bigletter" style="color:' + C.kids[C.kid].color + '">' + letter + '</div>'
    + '<div class="picword"><span class="em">' + em + '</span>' + rest + '</div>'
    + '<div class="msg" id="msg">Find the glowing key!</div>'
    + '</div>'
    + '</div>';
  C.keys.highlight(letter);
  C.hud([{ k: "Found", v: S.found, c: C.kids[C.kid].raw }, { k: "Stars", v: C.stars }]);
}

function init(ctx) {
  C = ctx;
  S = { score: 0, found: 0, letter: null, running: true, bpmf: null };
  if (isBopomofo()) {
    var t = bopomofoTargets(C.bopomofo.ROWS, C.words.bopomofo || []);
    if (Object.keys(t).length) S.bpmf = t;
  }
  nextHunt();
}

function key(ch) {
  if (!S) return;
  if (ch.toUpperCase() === S.letter) {
    S.found++; C.sfx.good(); C.fx.flash("ok"); C.fx.burst(6);
    S.huntTimeout = setTimeout(nextHunt, 220);
  } else {
    C.sfx.bad(); C.fx.flash("bad");
    C.fx.wobbleMsg("Oops! Press the glowing key \ud83d\udc46");
  }
}

function stop() {
  if (!S) return;
  S.running = false;
  if (S.huntTimeout) { clearTimeout(S.huntTimeout); S.huntTimeout = null; }
  S = null;
}

export default {
  id: "hunt",
  meta: { icon: "\ud83d\udd0e", title: "Key Hunt", tz: "\u627e\u6309\u9375", blurb: "Find the glowing key" },
  keyboard: true,
  bestKey: null,
  init: init,
  key: key,
  stop: stop,
  debugState: function () { return S; }
};
