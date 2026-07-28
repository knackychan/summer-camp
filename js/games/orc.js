/* Orc Attack ⚔️ 半獸人來襲 — migrated from index.html:1362-1500 (slice 18). */
var S = null, C = null;

var ORC_FIGS = ["👹","👺","🧌","👾","🐗","🦖"];

var HARD_WORDS = ["because","animal","yellow","planet","dragon","castle","rocket","jungle","guitar",
"thunder","rainbow","picture","morning","treasure","adventure","elephant","computer","birthday",
"mountain","dinosaur","butterfly","chocolate","wonderful","keyboard","practice"];

function poolFor(diff) {
  if (diff === "easy") return "abcdefghijklmnopqrstuvwxyz".split("");
  if (diff === "medium") return C.words.easy.map(function (w) { return w[0]; });
  return HARD_WORDS.slice();
}

function orcHud() {
  var hp = Math.max(S.hp, 0);
  C.hud([
    { k: "Lives", v: hp > 0 ? "❤️".repeat(hp) : "💀", c: S.hp <= 1 ? "var(--bad)" : C.kids[C.kid].raw },
    { k: "Score", v: S.score },
    { k: "Kills", v: S.kills },
    { k: "Best", v: C.best }
  ]);
}

function spawnOrc() {
  var st = document.getElementById("stage");
  var used = new Set(S.orcs.filter(function (o) { return !o.dead; }).map(function (o) { return o.word[0]; }));
  var pool = poolFor(C.settings.orc.diff).filter(function (w) { return !used.has(w[0]); });
  if (!pool.length) pool = poolFor(C.settings.orc.diff);
  var word = C.rand(pool);
  var el = document.createElement("div"); el.className = "orc";
  el.innerHTML = '<div class="tag"></div><div class="fig">' + C.rand(ORC_FIGS) + '</div>';
  var H = st.clientHeight;
  var y = Math.max(50, 40 + Math.random() * (H - 140));
  el.style.top = y + "px";
  st.appendChild(el);
  var o = {
    el: el, word: word, pos: 0, x: st.clientWidth + 20, y: y, dead: false,
    fig: el.querySelector(".fig"), tag: el.querySelector(".tag")
  };
  drawOrcTag(o);
  el.style.transform = "translateX(" + o.x + "px)";
  S.orcs.push(o);
}

function drawOrcTag(o) {
  o.tag.innerHTML = o.word.split("").map(function (c, i) {
    return '<span class="' + (i < o.pos ? "done" : "todo") + '">' + c.toUpperCase() + '</span>';
  }).join("");
}

function orcLoop(now) {
  if (!S.running) return;
  var st = document.getElementById("stage");
  var dt = Math.min((now - S.last) / 1000, 0.05); S.last = now;
  var s = C.settings.orc;
  var diffMul = s.diff === "easy" ? 1 : s.diff === "medium" ? 1.12 : 1.25;
  var spd = (26 + (s.speed - 1) * 17.5) * diffMul * (1 + Math.min(S.kills * 0.008, 0.5));
  if (now > S.spawnAt && S.orcs.filter(function (o) { return !o.dead; }).length < s.count) {
    spawnOrc();
    S.spawnAt = now + (1600 - s.speed * 180) + Math.random() * 800;
  }
  var heroX = 64;
  S.orcs.forEach(function (o) {
    if (o.dead) return;
    o.x -= spd * dt;
    o.el.style.transform = "translateX(" + o.x + "px)";
    if (o.x <= heroX) {
      o.dead = true; o.el.remove();
      if (S.lock === o) S.lock = null;
      S.hp--; C.sfx.hit(); C.fx.flash("bad");
      var hf = document.getElementById("heroFig");
      if (hf) { hf.classList.add("hit"); setTimeout(function () { hf.classList.remove("hit"); }, 400); }
      orcHud();
      if (S.hp <= 0) finishOrc();
    }
  });
  S.orcs = S.orcs.filter(function (o) { return !o.dead; });
  if (S.lock) C.keys.highlight(S.lock.word[S.lock.pos]);
  else C.keys.highlightSet(S.orcs.map(function (o) { return o.word[0]; }));
  S.raf = requestAnimationFrame(orcLoop);
}

function key(ch) {
  if (!S || !S.running) return;
  if (S.lock) {
    var o = S.lock;
    if (ch === o.word[o.pos]) {
      o.pos++; C.sfx.good(); drawOrcTag(o);
      if (o.pos >= o.word.length) killOrc(o);
    } else { C.sfx.bad(); C.fx.flash("bad"); }
    return;
  }
  var cand = S.orcs.filter(function (o) { return !o.dead && o.word[0] === ch; })
    .sort(function (a, b) { return a.x - b.x; })[0];
  if (cand) {
    cand.pos = 1; C.sfx.good(); drawOrcTag(cand);
    if (cand.pos >= cand.word.length) { killOrc(cand); }
    else { S.lock = cand; cand.el.classList.add("locked"); }
  } else { C.sfx.bad(); C.fx.flash("bad"); }
}

function killOrc(o) {
  o.dead = true;
  if (S.lock === o) S.lock = null;
  zapTo(o);
  C.sfx.zap(); C.fx.burstAt(o.el);
  o.el.classList.add("diefx");
  setTimeout(function () { o.el.remove(); }, 300);
  S.kills++;
  S.score += o.word.length * 10;
  C.finish({ score: S.score });
  orcHud();
}

function zapTo(o) {
  var st = document.getElementById("stage");
  var z = document.createElement("div"); z.className = "zap";
  var x1 = 70, y1 = st.clientHeight / 2, x2 = o.x + 20, y2 = o.y + 40;
  var len = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1);
  z.style.cssText += ";left:" + x1 + "px;top:" + y1 + "px;width:" + len + "px;transform:rotate(" + ang + "rad)";
  st.appendChild(z);
  setTimeout(function () { z.remove(); }, 200);
}

function finishOrc() {
  if (!S || !S.running) return;
  S.running = false;
  if (S.raf) { cancelAnimationFrame(S.raf); S.raf = null; }
  var prevBest = C.best || 0;
  var isBest = S.score >= prevBest && S.score > 0;
  C.finish({ score: S.score });
  C.fx.burst(40);
  var ov = document.createElement("div"); ov.className = "overlay";
  ov.innerHTML = '<div class="card">'
    + '<h3 style="color:' + C.kids[C.kid].color + '">' + (isBest ? "\ud83c\udfc6 New best!" : "\u2694\ufe0f Battle over!") + '</h3>'
    + '<div class="big" style="color:' + C.kids[C.kid].color + '">' + S.score + '</div>'
    + '<p>points \u00b7 ' + S.kills + ' orcs defeated' + (isBest ? '' : ' \u00b7 best ' + prevBest) + '</p>'
    + '<button class="btn" id="orcAgain" style="background:' + C.kids[C.kid].raw + ';color:#1c1436">Fight again \u2694\ufe0f</button>'
    + '<button class="btn small" id="orcHome" style="margin-left:8px">Heroes</button>'
    + '</div>';
  document.body.appendChild(ov);
  var storedC = C;
  ov.querySelector("#orcAgain").onclick = function () { ov.remove(); init(storedC); C = storedC; };
  ov.querySelector("#orcHome").onclick = function () {
    ov.remove();
    var backBtn = document.getElementById("back");
    if (backBtn) backBtn.click();
  };
}

function settings(bar, ctx) {
  var s = ctx.settings.orc;
  var D = [["easy", "\ud83d\ude42 Letters"], ["medium", "\ud83d\ude00 Words"], ["hard", "\ud83d\ude08 Big words"]];
  bar.innerHTML = '';
  var dchips = document.createElement("div"); dchips.className = "grp dchips";
  D.forEach(function (d) {
    var btn = document.createElement("button");
    btn.className = "chip" + (s.diff === d[0] ? " on" : "");
    btn.setAttribute("data-d", d[0]);
    if (s.diff === d[0]) btn.style.background = ctx.kids[ctx.kid].raw;
    btn.textContent = d[1];
    btn.onclick = function () {
      s.diff = d[0]; ctx.saveSettings(); ctx.restart();
    };
    dchips.appendChild(btn);
  });
  bar.appendChild(dchips);

  var spdGrp = document.createElement("span"); spdGrp.className = "grp";
  spdGrp.innerHTML = "\ud83d\udc22 Speed ";
  var spdInput = document.createElement("input");
  spdInput.type = "range"; spdInput.id = "setSpeed"; spdInput.min = "1"; spdInput.max = "5"; spdInput.value = s.speed;
  spdGrp.appendChild(spdInput);
  var spdVal = document.createElement("span"); spdVal.className = "val"; spdVal.id = "vSpeed"; spdVal.textContent = s.speed;
  spdGrp.appendChild(spdVal);
  spdGrp.appendChild(document.createTextNode(" \ud83d\udc07"));
  spdInput.oninput = function () {
    s.speed = +spdInput.value; spdVal.textContent = spdInput.value; ctx.saveSettings();
  };
  bar.appendChild(spdGrp);

  var cntGrp = document.createElement("span"); cntGrp.className = "grp";
  cntGrp.innerHTML = "\ud83d\udc79 Orcs ";
  var cntInput = document.createElement("input");
  cntInput.type = "range"; cntInput.id = "setCount"; cntInput.min = "1"; cntInput.max = "5"; cntInput.value = s.count;
  cntGrp.appendChild(cntInput);
  var cntVal = document.createElement("span"); cntVal.className = "val"; cntVal.id = "vCount"; cntVal.textContent = s.count;
  cntGrp.appendChild(cntVal);
  cntInput.oninput = function () {
    s.count = +cntInput.value; cntVal.textContent = cntInput.value; ctx.saveSettings();
  };
  bar.appendChild(cntGrp);
}

function init(ctx) {
  C = ctx;
  var st = document.getElementById("stage");
  st.classList.add("arena");
  st.innerHTML = '<div class="arena-msg" id="amsg">Type the word above each orc to zap it! \u26a1</div>'
    + '<div class="hero-fig" id="heroFig"><div class="fig">\ud83e\uddb8</div></div>';
  S = {
    orcs: [], hp: 3, score: 0, kills: 0, lock: null, running: true,
    last: performance.now(), spawnAt: performance.now() + 600, raf: null, wave: 1
  };
  orcHud();
  S.raf = requestAnimationFrame(orcLoop);
}

function stop() {
  if (!S) return;
  S.running = false;
  if (S.raf) { cancelAnimationFrame(S.raf); S.raf = null; }
  S = null;
}

export default {
  id: "orc",
  meta: { icon: "\u2694\ufe0f", title: "Orc Attack", tz: "\u534a\u7378\u4eba\u4f86\u8972", blurb: "Type to defend the hero" },
  keyboard: true,
  bestKey: "orc",
  init: init,
  key: key,
  settings: settings,
  stop: stop,
  poolFor: poolFor,
  forceFinishForTest: finishOrc,
  debugState: function () { return S; }
};
