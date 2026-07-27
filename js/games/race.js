/* Word Racer 🚀 文字競速 — timed typing game migrated from index.html:1378-1425, 2005-2042 (slice 18). */
var S = null, C = null;

function clean(s) { return s.replace(/[^a-zA-Z ]/g, "").replace(/\s+/g, " ").trim().toLowerCase(); }

function makeRacePool() {
  var words = C.shuffle(C.words.hard.slice()).map(function (w) { return [w.toLowerCase(), ""]; });
  var sents = C.shuffle(C.words.sentences.slice()).map(function (s) { return [clean(s), ""]; });
  var out = []; var wi = 0, si = 0;
  while (wi < words.length || si < sents.length) {
    for (var n = 0; n < 3 && wi < words.length; n++) out.push(words[wi++]);
    if (si < sents.length) out.push(sents[si++]);
  }
  return out.concat(C.shuffle(words), C.shuffle(sents));
}

function drawWord() {
  var w = S.word, pos = S.pos;
  var spans = w.split("").map(function (c, idx) {
    var cls = "todo";
    if (idx < pos) cls = "done";
    else if (idx === pos) cls = S.wrong ? "bad cur" : "cur";
    return '<span class="' + cls + '">' + c + '</span>';
  }).join("");
  document.getElementById("stage").innerHTML =
    '<div class="cue">Type it!</div>'
    + '<div class="word">' + spans + '</div>'
    + '<div class="msg" id="msg"></div>';
  C.keys.highlight(w[pos]);
}

function raceHud() {
  var mins = S.started ? Math.max((Date.now() - S.startTs) / 60000, 1 / 60) : 1 / 60;
  var wpm = Math.round(((S.correct || 0) / 5) / mins);
  var total = (S.correct || 0) + (S.errors || 0);
  var acc = total ? Math.round((S.correct / total) * 100) : 100;
  C.hud([
    { k: "Time", v: S.time + "s", c: S.time <= 10 ? 'var(--bad)' : C.kids[C.kid].raw },
    { k: "WPM", v: S.started ? wpm : 0 },
    { k: "Accuracy", v: acc + "%" },
    { k: "Words", v: S.words }
  ]);
}

function nextRace() {
  S.i++;
  if (S.i >= S.pool.length) { S.pool = makeRacePool(); S.i = 0; }
  S.word = S.pool[S.i][0];
  S.pos = 0; S.wrong = false;
  drawWord();
}

function startTimer() {
  S.started = true; S.startTs = Date.now();
  S.timer = setInterval(function () {
    if (!S || !S.running) return;
    S.time--; raceHud();
    if (S.time <= 0) { clearInterval(S.timer); S.timer = null; finishRace(); }
  }, 1000);
}

function finishRace() {
  S.running = false;
  if (S.timer) { clearInterval(S.timer); S.timer = null; }
  var mins = (Date.now() - S.startTs) / 60000;
  var wpm = Math.round(((S.correct || 0) / 5) / Math.max(mins, 1 / 60));
  var total = (S.correct || 0) + (S.errors || 0);
  var acc = total ? Math.round((S.correct / total) * 100) : 100;
  C.finish({ score: wpm });
  C.fx.burst(50);
  var ov = document.createElement("div"); ov.className = "overlay";
  var prevBest = C.bestOriginal || 0;
  var isBest = wpm > prevBest;
  ov.innerHTML =
    '<div class="card">'
    + '<h3 style="color:' + C.kids[C.kid].color + '">' + (isBest ? '\ud83c\udfc6 New best!' : '\u23f1\ufe0f Time!') + '</h3>'
    + '<div class="big" style="color:' + C.kids[C.kid].color + '">' + wpm + '</div>'
    + '<p>words per minute \u00b7 ' + acc + '% accuracy \u00b7 ' + S.words + ' words' + (isBest ? '' : ' \u00b7 best ' + prevBest) + '</p>'
    + '<button class="btn" id="raceAgain" style="background:' + C.kids[C.kid].raw + ';color:#1c1436">Play again \ud83d\udd01</button>'
    + '<button class="btn small" id="raceHome" style="margin-left:8px">Heroes</button>'
    + '</div>';
  document.body.appendChild(ov);
  var storedC = C;
  ov.querySelector("#raceAgain").onclick = function () { ov.remove(); init(storedC); C = storedC; };
  ov.querySelector("#raceHome").onclick = function () {
    ov.remove();
    var backBtn = document.getElementById("back");
    if (backBtn) backBtn.click();
  };
}

function init(ctx) {
  C = ctx;
  C.bestOriginal = C.best || 0;
  S = {
    pool: makeRacePool(), i: 0, pos: 0, correct: 0, errors: 0,
    words: 0, time: 60, started: false, running: true, timer: null,
    word: "", wrong: false, wordTimeout: null
  };
  drawWord(); raceHud();
  C.fx.hint("Start typing to begin the 60-second race!");
}

function key(ch) {
  if (!S) return;
  if (!S.started) startTimer();
  var expect = S.word[S.pos];
  if (ch === expect.toLowerCase() || (expect === " " && ch === " ")) {
    S.pos++; S.wrong = false; S.correct = (S.correct || 0) + 1;
    C.sfx.good();
    drawWord();
    if (S.pos >= S.word.length) {
      S.words++; C.fx.burst(10); C.sfx.win();
      if (S.wordTimeout) clearTimeout(S.wordTimeout);
      S.wordTimeout = setTimeout(function () { if (S && S.running) nextRace(); }, 120);
    }
    raceHud();
  } else {
    S.errors = (S.errors || 0) + 1; S.wrong = true; C.sfx.bad(); C.fx.flash("bad");
    drawWord();
    C.fx.hint("Try again!");
    raceHud();
  }
}

function stop() {
  if (!S) return;
  S.running = false;
  if (S.timer) { clearInterval(S.timer); S.timer = null; }
  if (S.wordTimeout) { clearTimeout(S.wordTimeout); S.wordTimeout = null; }
  S = null;
}

export default {
  id: "race",
  meta: { icon: "\ud83d\ude80", title: "Word Racer", tz: "\u6587\u5b57\u7af6\u901f", blurb: "Type fast for a score" },
  keyboard: true,
  bestKey: "race",
  init: init,
  key: key,
  stop: stop,
  forceFinishForTest: finishRace,
  debugState: function () { return S; }
};
