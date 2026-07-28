/* Dig Site ⛏️ 挖土工地 — excavator puzzle game migrated from index.html:2073-2227 (slice 17). */
var S = null, C = null, DG_COLS = 5, DG_ROWS = 4;

function digHud() {
  C.hud([
    { k: "Time", v: S.time + "s", c: S.time <= 10 ? "var(--bad)" : C.kids[C.kid].raw },
    { k: "Tasks", v: S.tasks, c: C.kids[C.kid].raw },
    { k: "Best", v: C.best }
  ]);
}

function digPlace(items) {
  var cells = [];
  for (var r = 0; r < DG_ROWS; r++)
    for (var c = 0; c < DG_COLS; c++)
      if (!(r === S.er && c === S.ec)) cells.push([r, c]);
  var spots = C.shuffle(cells).slice(0, items.length);
  return items.map(function (it, i) {
    var spot = spots[i];
    return Object.assign({ r: spot[0], c: spot[1], dug: false }, it);
  });
}

function rockAt(r, c) {
  for (var i = 0; i < S.rocks.length; i++) {
    var k = S.rocks[i];
    if (!k.dug && k.r === r && k.c === c) return k;
  }
  return null;
}

function drawDig() {
  var g = document.getElementById("dgGrid");
  if (!g) return;
  var html = "";
  for (var r = 0; r < DG_ROWS; r++) {
    for (var c = 0; c < DG_COLS; c++) {
      var k = rockAt(r, c), ex = (r === S.er && c === S.ec);
      html += '<div class="dg-cell' + (ex ? ' ex' : '') + '">'
        + (ex ? '<span class="dg-exv">🚜</span>' : '')
        + (k ? '<span class="dg-rock" data-rc="' + r + '-' + c + '">🪨<i>' + k.label + '</i></span>' : '')
        + '</div>';
    }
  }
  g.innerHTML = html;
}

function nextDigTask() {
  var age = C.kids[C.kid].age;
  var vocab = C._vocab;
  var easyWords = vocab && vocab.easy;
  S.sum = 0; S.need = 0;
  if (age <= 5) {
    var L = C.words.letters;
    var keys = Object.keys(L);
    var letter = C.rand(keys);
    var decoys = C.shuffle(keys.filter(function (l) { return l !== letter; })).slice(0, 5);
    S.task = { kind: "letter", target: letter, left: 3 };
    S.rocks = digPlace([letter, letter, letter].concat(decoys).map(function (l) {
      return { label: l, good: l === letter };
    }));
    var em = L[letter].split(" ")[0];
    document.getElementById("dgCue").innerHTML =
      '⛏️ Dig all the <b>' + letter + '</b> rocks! 挖出所有 <b>' + letter + '</b>! ' + em;
    C.say(letter);
  } else if (age <= 8) {
    var pool = C.words.easy.filter(function (x) { return x[0].length <= 4; });
    if (!pool.length) pool = [["cat","🐱"]];
    var rands = [];
    for (var ri = 0; ri < pool.length; ri++) rands.push([Math.random(), pool[ri]]);
    rands.sort(function (a, b) { return a[0] - b[0]; });
    var w = rands[0][1];
    var letters = w[0].toUpperCase().split("");
    var decoyPool = "BDFGKMPRSTW".split("").filter(function (l) { return letters.indexOf(l) < 0; });
    var shuffled = C.shuffle(decoyPool);
    var decoys = shuffled.slice(0, Math.min(4, shuffled.length));
    S.task = { kind: "spell", word: w[0], letters: letters };
    S.rocks = digPlace(letters.map(function (l, i) { return { label: l, ord: i }; })
      .concat(decoys.map(function (l) { return { label: l }; })));
    document.getElementById("dgCue").innerHTML =
      '⛏️ Dig <b>' + letters.join("-") + '</b> in order! 照順序挖出 <b>' + w[0].toUpperCase() + '</b>! ' + (w[1] || '');
    C.say(w[0]);
  } else {
    var rint = function (n) { return 1 + Math.floor(Math.random() * n); };
    var parts = [2 + rint(6), 2 + rint(6), 2 + rint(6)];
    var target = parts[0] + parts[1] + parts[2];
    var decoys = [1 + rint(9), 1 + rint(9), 1 + rint(9)];
    S.task = { kind: "sum", target: target };
    S.rocks = digPlace(parts.concat(decoys).map(function (n) { return { label: String(n), val: n }; }));
    digSumCue();
  }
  drawDig();
}

function digSumCue() {
  document.getElementById("dgCue").innerHTML =
    '⛏️ Dig rocks that add up to <b>' + S.task.target + '</b>! 挖出加起來等於 <b>' + S.task.target + '</b> 的石頭! (' + S.sum + ' so far 目前 ' + S.sum + ')';
}

function digMove(dr, dc) {
  if (!S.running) return;
  var r = S.er + dr, c = S.ec + dc;
  if (r < 0 || c < 0 || r >= DG_ROWS || c >= DG_COLS) { C.sfx.bad(); return; }
  S.er = r; S.ec = c; C.sfx.good(); drawDig();
}

function digClunk() {
  C.sfx.bad(); C.fx.flash("bad");
  var el = document.querySelector('[data-rc="' + S.er + '-' + S.ec + '"]');
  if (el) { el.classList.add("clunk"); setTimeout(drawDig, 360); }
  C.fx.hint("Clunk! Not that rock! 鏘! 不是這顆!");
}

function digGood() { C.sfx.good(); C.fx.flash("ok"); C.fx.burst(6); }

function digTaskDone() {
  S.tasks++; C.sfx.win(); C.fx.burst(16);
  if (S.task.kind === "spell") C.say(S.task.word);
  if (S.tasks > C.best) { C.best = S.tasks; }
  C.finish({ score: S.tasks });
  digHud();
  C.fx.hint("Task done! 完成任務!");
  var run = S;
  if (S.taskTimeout) clearTimeout(S.taskTimeout);
  S.taskTimeout = setTimeout(function () { if (S === run && S.running) nextDigTask(); }, 1000);
}

function digAct() {
  if (!S.running) return;
  var k = rockAt(S.er, S.ec);
  if (!k) { C.sfx.bad(); C.fx.hint("No rock here! 這裡沒有石頭!"); return; }
  var t = S.task;
  if (t.kind === "letter") {
    if (k.good) {
      k.dug = true; t.left--;
      digGood(); C.say(k.label);
      if (t.left <= 0) { drawDig(); digTaskDone(); return; }
    } else digClunk();
  } else if (t.kind === "spell") {
    if (k.ord === S.need) {
      k.dug = true; S.need++; digGood(); C.say(k.label);
      if (S.need >= t.letters.length) { drawDig(); digTaskDone(); return; }
    } else digClunk();
  } else {
    var next = S.sum + k.val;
    if (next === t.target) {
      k.dug = true; drawDig(); digGood(); digTaskDone(); return;
    } else if (next < t.target) {
      k.dug = true; S.sum = next; digGood(); digSumCue();
    } else {
      S.sum = 0; S.rocks.forEach(function (x) { x.dug = false; });
      digClunk(); digSumCue();
      C.fx.hint("Too much — rocks are back, start again! 太多了，石頭回來了，重新算!");
    }
  }
  drawDig();
}

function digTick() {
  if (!S.running) return;
  S.time--; digHud();
  if (S.time <= 0) finishDig();
}

function finishDig() {
  S.running = false;
  if (S.timer) { clearInterval(S.timer); S.timer = null; }
  if (S.taskTimeout) { clearTimeout(S.taskTimeout); S.taskTimeout = null; }
  var prevBest = C.bestOriginal || 0;
  var isBest = S.tasks >= prevBest && S.tasks > 0;
  C.finish({ score: S.tasks });
  C.fx.burst(40);
  var ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML =
    '<div class="card">'
    + '<h3 style="color:' + C.kids[C.kid].color + '">' + (isBest ? '🏆 New best! 新紀錄!' : '⛏️ Site closed! 收工了!') + '</h3>'
    + '<div class="big" style="color:' + C.kids[C.kid].color + '">' + S.tasks + '</div>'
    + '<p>tasks done 完成的任務' + (isBest ? '' : ' · best 最佳 ' + prevBest) + '</p>'
    + '<button class="btn" id="digAgain" style="background:' + C.kids[C.kid].raw + ';color:#1c1436">Dig again 再挖一次 ⛏️</button>'
    + '<button class="btn small" id="digHome" style="margin-left:8px">Heroes</button>'
    + '</div>';
  document.body.appendChild(ov);
  var storedC = C;
  ov.querySelector("#digAgain").onclick = function () {
    ov.remove();
    init(storedC);
    C = storedC;
  };
  ov.querySelector("#digHome").onclick = function () {
    ov.remove();
    var backBtn = document.getElementById("back");
    if (backBtn) backBtn.click();
  };
}

function init(ctx) {
  C = ctx;
  C.bestOriginal = C.best || 0;
  C.best = C.bestOriginal;

  S = {
    tasks: 0, time: 90, er: DG_ROWS - 1, ec: 0, rocks: [], task: null,
    need: 0, sum: 0, running: true, timer: null, taskTimeout: null
  };

  C.stage.innerHTML =
    '<div class="game-scene game-scene--dig">'
    + '<div class="dig-layout">'
    + '<div class="cue" id="dgCue"></div>'
    + '<div class="dg-grid" id="dgGrid"></div>'
    + '<div class="dg-ctl">'
    + '<div class="dg-pad">'
    + '<button class="dbtn" data-d="0,-1">◀</button>'
    + '<div class="dg-ud"><button class="dbtn" data-d="-1,0">▲</button><button class="dbtn" data-d="1,0">▼</button></div>'
    + '<button class="dbtn" data-d="0,1">▶</button>'
    + '</div>'
    + '<button class="dg-dig" id="dgDig">⛏️ DIG 挖!</button>'
    + '</div>'
    + '<div class="msg" id="msg">Drive to a rock, then DIG! 開到石頭旁邊，然後挖!</div>'
    + '</div>'
    + '</div>';

  document.querySelectorAll(".dbtn").forEach(function (b) {
    b.onpointerdown = function (e) {
      e.preventDefault();
      var d = b.dataset.d.split(",");
      digMove(+d[0], +d[1]);
    };
  });
  document.getElementById("dgDig").onpointerdown = function (e) { e.preventDefault(); digAct(); };

  nextDigTask();
  digHud();
  S.timer = setInterval(digTick, 1000);
}

function stop() {
  if (!S) return;
  S.running = false;
  if (S.timer) { clearInterval(S.timer); S.timer = null; }
  if (S.taskTimeout) { clearTimeout(S.taskTimeout); S.taskTimeout = null; }
  S = null;
}

export default {
  id: "dig",
  meta: { icon: "\u26cf\ufe0f", title: "Dig Site", tz: "\u6316\u571f\u5de5\u5730", blurb: "Dig the right rocks" },
  keyboard: false,
  bestKey: "dig",
  init: init,
  stop: stop,
  forceFinishForTest: finishDig,
  debugState: function () { return S; }
};
