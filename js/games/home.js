/* Home Row 🎯 基準鍵 — typing practice game migrated from index.html:1367-1376 + 1408-1421 (slice 18). */
var S = null, C = null;

function drawWord() {
  var w = S.word, pos = S.pos;
  var wordEl = S._wordEl;
  if (!wordEl) return;
  wordEl.innerHTML = w.split("").map(function (c, idx) {
    var cls = "todo";
    if (idx < pos) cls = "done";
    else if (idx === pos) cls = S.wrong ? "bad cur" : "cur";
    return '<span class="' + cls + '">' + c + '</span>';
  }).join("");
  C.keys.highlight(w[pos]);
}

function homeHud() {
  var total = (S.correct || 0) + (S.errors || 0);
  var acc = total ? Math.round((S.correct / total) * 100) : 100;
  C.hud([
    { k: "Words", v: S.words, c: C.kids[C.kid].raw },
    { k: "Accuracy", v: acc + "%" },
    { k: "Stars", v: C.stars }
  ]);
}

function nextHome() {
  S.i++;
  if (S.i >= S.queue.length) { S.queue = C.shuffle(C.words.easy.slice()); S.i = 0; }
  S.word = S.queue[S.i][0]; S.em = S.queue[S.i][1];
  S.pos = 0; S.wrong = false;
  if (S._emEl) S._emEl.textContent = S.em || "";
  drawWord(); homeHud();
}

function init(ctx) {
  C = ctx;
  S = {
    queue: C.shuffle(C.words.easy.slice()), i: 0, pos: 0,
    correct: 0, errors: 0, words: 0, em: "", word: "", wrong: false,
    running: true, wordTimeout: null
  };

  C.stage.innerHTML =
    '<div class="game-scene game-scene--home">'
    + '<div class="game-scene__center">'
    + '<div class="cue">Type the word</div>'
    + '<div class="word-em" id="homeEm"></div>'
    + '<div class="word" id="homeWord"></div>'
    + '<div class="msg" id="msg"></div>'
    + '</div>'
    + '</div>';

  S._wordEl = document.getElementById("homeWord");
  S._emEl = document.getElementById("homeEm");
  nextHome();
}

function key(ch) {
  if (!S) return;
  var expect = S.word[S.pos];
  if (ch === expect.toLowerCase() || (expect === " " && ch === " ")) {
    S.pos++; S.wrong = false; S.correct = (S.correct || 0) + 1;
    C.sfx.good();
    drawWord();
    if (S.pos >= S.word.length) {
      S.words++; C.fx.burst(10); C.sfx.win();
      if (S.wordTimeout) clearTimeout(S.wordTimeout);
      S.wordTimeout = setTimeout(function () { if (S && S.running) nextHome(); }, 300);
    }
    homeHud();
  } else {
    S.errors = (S.errors || 0) + 1; S.wrong = true; C.sfx.bad(); C.fx.flash("bad");
    drawWord();
    var f = FINGER_MAP[(ch || "").toLowerCase()] || [""];
    var hint = f[1] ? 'Use your ' + f[1] + ' for "' + ch.toUpperCase() + '"' : "Try again!";
    C.fx.hint(hint);
    homeHud();
  }
}

function stop() {
  if (!S) return;
  S.running = false;
  if (S.wordTimeout) { clearTimeout(S.wordTimeout); S.wordTimeout = null; }
  S = null;
}

var FINGER_MAP = null;
function initFingerMap() {
  if (FINGER_MAP) return;
  FINGER_MAP = {};
  var map = [
    [["1","2","q","a","z"], "left-pinky"], [["3","w","s","x"], "left-ring"],
    [["4","e","d","c"], "left-middle"], [["5","6","r","f","v","t","g","b"], "left-index"],
    [["7","y","h","n","u","j","m"], "right-index"], [["8","i","k",","], "right-middle"],
    [["9","o","l","."], "right-ring"], [["0","p",";","/","'"], "right-pinky"]
  ];
  for (var i = 0; i < map.length; i++) {
    var keys = map[i][0], name = map[i][1];
    for (var j = 0; j < keys.length; j++) FINGER_MAP[keys[j].toLowerCase()] = [name, name];
  }
}

initFingerMap();

export default {
  id: "home",
  meta: { icon: "\ud83c\udfaf", title: "Home Row", tz: "\u57fa\u6e96\u9375", blurb: "Learn your fingers" },
  keyboard: true,
  bestKey: null,
  init: init,
  key: key,
  stop: stop,
  debugState: function () { return S; }
};
