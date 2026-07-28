/* City Drive 🏙️ 城市開車 — free-roam knowledge missions migrated from index.html:1758-2072 (slice 17). */
var S = null, C = null;

var CT = 48, CITY_W = 26, CITY_H = 20;
var CITY_MAP = [
  "GGGRGGGGGGGGGRGGGGGGGGRGGG",
  "GGGRGGGGGGGGGRGGGGGGGGRGGG",
  "GGGRGGGGGGGGGRGGGGGGGGRGGG",
  "RRRRRRRRRRRRRRRRRRRRRRRRRR",
  "GGGRGGGGGGGGGRGGGGGGGGRGGG",
  "GGGRGGGGGGGGGRGGGGGGGGRGGG",
  "GGGRGGGGGGGGGRGGGGGGGGRGGG",
  "GGGRGGGGGGGGGRGGGGGGGGRGGG",
  "GGGRGGGGGGGGGRGGGGGGGGRGGG",
  "GGGRGGGGGGGGGRGGGGGGGGRGGG",
  "RRRRRRRRRRRRRRRRRRRRRRRRRR",
  "GGGRGGGGGGGGGRGGGGGGGGRGGG",
  "GGGRGGWWWGGGGRGGGGGGGGRGGG",
  "GGGRGGWWWGGGGRGGGGGGGGRGGG",
  "GGGRGGGGGGGGGRGGGGGGGGRGGG",
  "GGGRGGGGGGGGGRGGGGGGGGRGGG",
  "RRRRRRRRRRRRRRRRRRRRRRRRRR",
  "GGGRGGGGGGGGGRGGGGGGGGRGGG",
  "GGGRGGGGGGGGGRGGGGGGGGRGGG",
  "GGGRGGGGGGGGGRGGGGGGGGRGGG"
];
var CITY_TREES = [[8, 0], [20, 6], [24, 7], [1, 9], [17, 11], [4, 18], [11, 19]];
var CITY_B = [
  { id: "school", em: "\ud83c\udfeb", x: 5, y: 1, door: [5, 3] },
  { id: "zoo", em: "\ud83e\udd81", x: 15, y: 1, door: [15, 3] },
  { id: "market", em: "\ud83d\uded2", x: 23, y: 1, door: [23, 3] },
  { id: "hospital", em: "\ud83c\udfe5", x: 5, y: 4, door: [5, 3] },
  { id: "farm", em: "\ud83d\ude9c", x: 1, y: 4, door: [3, 4] },
  { id: "park", em: "\ud83c\udf33", x: 11, y: 5, door: [13, 5] },
  { id: "castle", em: "\ud83c\udff0", x: 15, y: 8, door: [15, 10] },
  { id: "church", em: "\u26ea", x: 9, y: 11, door: [9, 10] },
  { id: "hotel", em: "\ud83c\udfe8", x: 19, y: 11, door: [19, 10] },
  { id: "museum", em: "\ud83d\uddbc\ufe0f", x: 5, y: 14, door: [5, 16] },
  { id: "police", em: "\ud83d\udc6e", x: 23, y: 13, door: [22, 13] },
  { id: "h1", em: "\ud83c\udfe0", x: 9, y: 17, door: [9, 16], house: true },
  { id: "h2", em: "\ud83c\udfe0", x: 15, y: 17, door: [15, 16], house: true },
  { id: "h3", em: "\ud83c\udfe0", x: 19, y: 17, door: [19, 16], house: true }
];
var CITY_PLOT = ["#e8b04b", "#d96f6f", "#7fb0e0", "#b48ede", "#8fcf7a", "#e0995f", "#c9c9d9"];

function cityWord(id) {
  var all = C.words.all;
  if (!all) return [id, "\u2753", "", ""];
  for (var i = 0; i < all.length; i++) {
    if (all[i][0] === id) return all[i];
  }
  return [id, "\u2753", "", ""];
}

function cityTile(px, py) {
  var x = Math.floor(px / CT), y = Math.floor(py / CT);
  if (x < 0 || y < 0 || x >= CITY_W || y >= CITY_H) return "X";
  for (var i = 0; i < CITY_B.length; i++) {
    var b = CITY_B[i];
    if (x >= b.x && x < b.x + 2 && y >= b.y && y < b.y + 2) return "B";
  }
  return CITY_MAP[y].charAt(x);
}

function doorXY(b) { return { x: b.door[0] * CT + CT / 2, y: b.door[1] * CT + CT / 2 }; }

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function cityDraw() {
  var ctx2 = S.canvasCtx, vw = S.vw, vh = S.vh, car = S.car;
  var camX = Math.max(0, Math.min(car.x - vw / 2, CITY_W * CT - vw));
  var camY = Math.max(0, Math.min(car.y - vh / 2, CITY_H * CT - vh));
  ctx2.save(); ctx2.clearRect(0, 0, vw, vh); ctx2.translate(-camX, -camY);
  var x0 = Math.floor(camX / CT), x1 = Math.min(CITY_W - 1, Math.ceil((camX + vw) / CT));
  var y0 = Math.floor(camY / CT), y1 = Math.min(CITY_H - 1, Math.ceil((camY + vh) / CT));
  for (var y = y0; y <= y1; y++) {
    for (var x = x0; x <= x1; x++) {
      var c = CITY_MAP[y].charAt(x);
      ctx2.fillStyle = c === "R" ? "#4c4c58" : c === "W" ? "#4EA8FF" : ((x + y) % 2 ? "#57a05a" : "#5daa60");
      ctx2.fillRect(x * CT, y * CT, CT, CT);
      if (c === "R") {
        ctx2.fillStyle = "rgba(255,255,255,.55)";
        if (x > 0 && x < CITY_W - 1 && CITY_MAP[y].charAt(x - 1) === "R" && CITY_MAP[y].charAt(x + 1) === "R")
          ctx2.fillRect(x * CT + 8, y * CT + CT / 2 - 1, CT - 16, 2);
        if (y > 0 && y < CITY_H - 1 && CITY_MAP[y - 1].charAt(x) === "R" && CITY_MAP[y + 1].charAt(x) === "R")
          ctx2.fillRect(x * CT + CT / 2 - 1, y * CT + 8, 2, CT - 16);
      }
    }
  }
  ctx2.font = "28px serif"; ctx2.textAlign = "center"; ctx2.textBaseline = "middle";
  CITY_TREES.forEach(function (t) { ctx2.fillText("\ud83c\udf33", t[0] * CT + CT / 2, t[1] * CT + CT / 2); });
  CITY_B.forEach(function (b, i) {
    ctx2.fillStyle = CITY_PLOT[i % CITY_PLOT.length];
    rr(ctx2, b.x * CT + 3, b.y * CT + 3, CT * 2 - 6, CT * 2 - 6, 10); ctx2.fill();
    ctx2.font = "40px serif"; ctx2.fillText(b.em, b.x * CT + CT, b.y * CT + CT);
    if (S.signs && S.signs[b.id] != null) {
      ctx2.fillStyle = "#fff"; rr(ctx2, b.x * CT + CT - 22, b.y * CT - 14, 44, 24, 6); ctx2.fill();
      ctx2.fillStyle = "#1c1436"; ctx2.font = "700 15px Fredoka,sans-serif";
      ctx2.fillText(String(S.signs[b.id]), b.x * CT + CT, b.y * CT - 2);
    }
  });
  var m = S.m;
  if (m && !m.done) {
    var goal = (m.kind === "taxi" && !m.picked) ? m.pickup : m.target;
    if (goal) {
      var d = doorXY(goal), pulse = 6 + 4 * Math.sin(performance.now() / 220);
      ctx2.strokeStyle = "#FFC93C"; ctx2.lineWidth = 3;
      ctx2.beginPath(); ctx2.arc(d.x, d.y, 20 + pulse, 0, Math.PI * 2); ctx2.stroke();
      ctx2.font = "26px serif"; ctx2.fillText("\ud83d\udccd", d.x, d.y - 34 - pulse);
    }
    if (m.kind === "taxi" && !m.picked) {
      var pd = doorXY(m.pickup);
      ctx2.font = "26px serif"; ctx2.fillText("\ud83d\ude4b", pd.x + 18, pd.y - 14);
    }
    if (m.kind === "letters") {
      m.spots.forEach(function (s, i) {
        if (i < m.i) return;
        ctx2.globalAlpha = i === m.i ? 1 : 0.35;
        ctx2.fillStyle = "#fff"; ctx2.beginPath(); ctx2.arc(s.x, s.y, 16, 0, Math.PI * 2); ctx2.fill();
        ctx2.fillStyle = "#1c1436"; ctx2.font = "700 18px Fredoka,sans-serif"; ctx2.fillText(s.ch, s.x, s.y + 1);
        ctx2.globalAlpha = 1;
      });
    }
  }
  ctx2.save(); ctx2.translate(car.x, car.y); ctx2.rotate(car.h);
  ctx2.fillStyle = C.kids[C.kid].raw; rr(ctx2, -17, -10, 34, 20, 6); ctx2.fill();
  ctx2.fillStyle = "rgba(255,255,255,.75)"; rr(ctx2, -4, -7, 12, 14, 3); ctx2.fill();
  ctx2.fillStyle = "#222"; ctx2.fillRect(-14, -13, 10, 4); ctx2.fillRect(4, -13, 10, 4);
  ctx2.fillRect(-14, 9, 10, 4); ctx2.fillRect(4, 9, 10, 4);
  ctx2.restore(); ctx2.restore();
}

function cityHud() {
  var items = [];
  if (S.time >= 0) items.push({ k: "Time", v: S.time + "s", c: S.time <= 10 ? "var(--bad)" : C.kids[C.kid].raw });
  items.push({ k: "Missions", v: S.score, c: C.kids[C.kid].raw });
  items.push({ k: "Best", v: C.best });
  C.hud(items);
}

function cityPrompt(html) {
  var el = document.getElementById("cdPrompt");
  if (el) el.innerHTML = html;
}

function cityMathQ(age) {
  var a, b, op;
  if (age <= 8) {
    if (Math.random() < 0.6) { op = "+"; a = 1 + rint(10); b = 1 + rint(10); }
    else { op = "\u2212"; a = 5 + rint(15); b = 1 + rint(Math.min(a - 1, 9)); }
  } else {
    var r2 = Math.random();
    if (r2 < 0.4) { op = "\u00d7"; a = 2 + rint(8); b = 2 + rint(8); }
    else if (r2 < 0.7) { op = "+"; a = 10 + rint(60); b = 1 + rint(30); }
    else { op = "\u2212"; a = 20 + rint(79); b = 1 + rint(19); }
  }
  var val = op === "+" ? a + b : op === "\u2212" ? a - b : a * b;
  return { text: a + " " + op + " " + b, val: val };
}

function rint(n) { return Math.floor(Math.random() * n); }

function cityLetterSpots(word) {
  var roads = [];
  for (var y = 0; y < CITY_H; y++)
    for (var x = 0; x < CITY_W; x++)
      if (CITY_MAP[y].charAt(x) === "R") roads.push([x, y]);
  var cx = Math.floor(S.car.x / CT), cy = Math.floor(S.car.y / CT);
  var far = function (a, bx, by) { return Math.abs(a[0] - bx) + Math.abs(a[1] - by) >= 4; };
  var pool = C.shuffle(roads), spots = [];
  for (var i = 0; i < pool.length && spots.length < word.length; i++) {
    var c = pool[i]; var ok = far(c, cx, cy);
    for (var j = 0; j < spots.length; j++) if (!far(c, spots[j][0], spots[j][1])) ok = false;
    if (ok) spots.push(c);
  }
  return spots.map(function (c, i) { return { x: c[0] * CT + CT / 2, y: c[1] * CT + CT / 2, ch: word.charAt(i) }; });
}

function cityMission() {
  var age = C.kids[C.kid].age;
  var kinds = age <= 5 ? ["place", "letters"] : age <= 8 ? ["place", "deliver"] : ["deliver", "taxi", "place"];
  var kind = kinds[S.mn % kinds.length]; S.mn++;
  S.m = { kind: kind, done: false }; S.signs = null;
  if (kind === "place") {
    var pool = CITY_B.filter(function (b) { return !b.house && (age > 5 || ["school", "zoo", "park", "farm"].indexOf(b.id) >= 0); });
    var b = C.rand(pool), w = cityWord(b.id);
    S.m.target = b;
    cityPrompt(b.em + ' Drive to the <b>' + w[0] + '</b>! \u958b\u5230' + w[3] + '!');
    C.sayPair(w[0], w[2]);
  } else if (kind === "deliver") {
    var q = cityMathQ(age);
    var houses = C.shuffle(CITY_B.filter(function (b) { return b.house; }));
    S.m.target = houses[0];
    var vals = [q.val];
    while (vals.length < 3) {
      var d = q.val + (1 + rint(4)) * (Math.random() < 0.5 ? -1 : 1);
      if (d > 0 && vals.indexOf(d) < 0) vals.push(d);
    }
    S.signs = {};
    houses.forEach(function (h, i) { S.signs[h.id] = vals[i]; });
    cityPrompt('\ud83c\udf4e Deliver to house <b>' + q.text + '</b>! \u9001\u5230 <b>' + q.text + '</b> \u7684\u623f\u5b50!');
  } else if (kind === "taxi") {
    var stops = C.shuffle(CITY_B.filter(function (b) { return !b.house; }));
    S.m.pickup = stops[0]; S.m.target = stops[1]; S.m.picked = false;
    var pw = cityWord(stops[0].id);
    cityPrompt('\ud83d\ude4b Pick up your passenger at the <b>' + pw[0] + '</b>! \u53bb' + pw[3] + '\u63a5\u4e58\u5ba2!');
    C.say("passenger at the " + pw[0]);
  } else {
    var pool2 = C.words.easy.filter(function (x) { return x[0].length === 3; });
    if (!pool2.length) pool2 = [["cat", "\ud83d\udc31"]];
    var w2 = C.rand(pool2);
    S.m.word = w2[0].toUpperCase(); S.m.i = 0; S.m.em = w2[1]; S.m.say = w2[0];
    S.m.spots = cityLetterSpots(S.m.word);
    cityPrompt('\ud83d\udd24 Collect <b>' + S.m.word + '</b>! \u6536\u96c6\u5b57\u6bcd ' + S.m.word + '! ' + w2[1]);
    C.say(w2[0]);
  }
  cityHud();
}

function cityArrive() {
  var m = S.m, car = S.car;
  if (!m || m.done) return;
  var now = performance.now();
  if (m.kind === "letters") {
    var s = m.spots[m.i];
    if (s && Math.hypot(car.x - s.x, car.y - s.y) < 26) {
      m.i++; C.sfx.good(); C.fx.burst(6); C.say(s.ch);
      if (m.i >= m.spots.length) { C.say(m.say); cityComplete(); }
    }
    return;
  }
  var goal = (m.kind === "taxi" && !m.picked) ? m.pickup : m.target;
  var parked = function (b) {
    var d = doorXY(b);
    return Math.abs(car.v) < 45 && Math.hypot(car.x - d.x, car.y - d.y) < 44;
  };
  if (m.kind === "deliver") {
    var others = CITY_B.filter(function (b) { return b.house && b.id !== m.target.id; });
    for (var i = 0; i < others.length; i++) {
      if (parked(others[i]) && (!S.hintAt || now - S.hintAt > 2500)) {
        S.hintAt = now; C.sfx.bad();
        C.fx.hint('That house is ' + S.signs[others[i].id] + ' \u2014 try another! \u90a3\u9593\u662f ' + S.signs[others[i].id] + '\uff0c\u518d\u8a66\u4e00\u9593!');
      }
    }
  }
  if (!parked(goal)) return;
  if (m.kind === "taxi" && !m.picked) {
    m.picked = true; C.sfx.good(); C.fx.burst(8);
    var w = cityWord(m.target.id);
    cityPrompt('\ud83d\udcac "Take me to the <b>' + w[0] + '</b>, please!" \u300c\u8acb\u5e36\u6211\u53bb' + w[3] + '!\u300d');
    C.sayPair("take me to the " + w[0], w[2]);
    return;
  }
  var w2 = cityWord(m.target.id);
  if (m.kind === "place" || m.kind === "taxi") C.sayPair(w2[0], w2[2]);
  cityComplete();
}

function cityComplete() {
  S.m.done = true; S.score++; C.sfx.win(); C.fx.burst(16); C.fx.flash("ok");
  C.fx.hint("Great driving! \u958b\u5f97\u771f\u597d!");
  if (S.score > C.best) { C.best = S.score; }
  C.finish({ score: S.score });
  cityHud();
  var run = S;
  if (S.missionTimeout) clearTimeout(S.missionTimeout);
  S.missionTimeout = setTimeout(function () { if (S === run && S.running) cityMission(); }, 1400);
}

function finishCity() {
  S.running = false;
  if (S.raf) { cancelAnimationFrame(S.raf); S.raf = null; }
  if (S.timer) { clearInterval(S.timer); S.timer = null; }
  if (S.missionTimeout) { clearTimeout(S.missionTimeout); S.missionTimeout = null; }
  var prevBest = C.bestOriginal || 0;
  var isBest = S.score >= prevBest && S.score > 0;
  C.finish({ score: S.score });
  C.fx.burst(40);
  var ov = document.createElement("div"); ov.className = "overlay";
  ov.innerHTML =
    '<div class="card">'
    + '<h3 style="color:' + C.kids[C.kid].color + '">' + (isBest ? '\ud83c\udfc6 New best! \u65b0\u7d00\u9304!' : '\ud83c\udfc1 Day over! \u6536\u5de5\u4e86!') + '</h3>'
    + '<div class="big" style="color:' + C.kids[C.kid].color + '">' + S.score + '</div>'
    + '<p>missions done \u5b8c\u6210\u7684\u4efb\u52d9' + (isBest ? '' : ' \u00b7 best \u6700\u4f73 ' + prevBest) + '</p>'
    + '<button class="btn" id="cityAgain" style="background:' + C.kids[C.kid].raw + ';color:#1c1436">Drive again \u518d\u958b\u4e00\u6b21 \ud83d\ude97</button>'
    + '<button class="btn small" id="cityHome" style="margin-left:8px">Heroes</button>'
    + '</div>';
  document.body.appendChild(ov);
  var storedC = C;
  ov.querySelector("#cityAgain").onclick = function () {
    ov.remove();
    init(storedC);
    C = storedC;
  };
  ov.querySelector("#cityHome").onclick = function () {
    ov.remove();
    var backBtn = document.getElementById("back");
    if (backBtn) backBtn.click();
  };
}

function cityLoop(now) {
  if (!S || !S.running) return;
  var dt = Math.min((now - S.last) / 1000, 0.05); S.last = now;
  var car = S.car, k = S.keys;
  var onGrass = cityTile(car.x, car.y) === "G";
  var cap = onGrass ? S.vmax * 0.45 : S.vmax;
  if (k.g) car.v = Math.min(car.v + 300 * dt, cap);
  else car.v *= Math.pow(0.15, dt);
  if (car.v > cap) car.v = cap;
  if (Math.abs(car.v) > 5) {
    var dir = (k.l ? -1 : 0) + (k.r ? 1 : 0);
    car.h += dir * 2.6 * dt * (0.45 + 0.55 * Math.min(Math.abs(car.v) / S.vmax, 1));
  }
  var nx = car.x + Math.cos(car.h) * car.v * dt, ny = car.y + Math.sin(car.h) * car.v * dt;
  var reach = car.v < 0 ? -14 : 14;
  var ahead = cityTile(nx + Math.cos(car.h) * reach, ny + Math.sin(car.h) * reach);
  if (ahead === "B" || ahead === "W" || ahead === "X") {
    car.v = (car.v < 0 ? 1 : -1) * Math.max(Math.abs(car.v) * 0.3, 40);
  } else { car.x = nx; car.y = ny; }
  cityArrive();
  cityDraw();
  S.raf = requestAnimationFrame(cityLoop);
}

function cityTick() {
  if (!S || !S.running) return;
  S.time--; cityHud();
  if (S.time <= 0) finishCity();
}

function init(ctx) {
  C = ctx;
  C.bestOriginal = C.best || 0;
  C.best = C.bestOriginal;

  var age = C.kids[C.kid].age;
  S = {
    score: 0, mn: 0, m: null, signs: null, running: true,
    raf: null, timer: null, missionTimeout: null,
    keys: { l: false, r: false, g: false },
    car: { x: 13 * CT + CT / 2, y: 10 * CT + CT / 2, h: 0, v: 0 }
  };

  var stage = C.stage;
  stage.innerHTML =
    '<div class="game-scene game-scene--city">'
    + '<div class="cd-wrap" id="cdWrap">'
    + '<canvas id="cityCv"></canvas>'
    + '<div class="cd-prompt" id="cdPrompt"></div>'
    + '<div class="cd-btn cd-l" id="cdL">\u25c0</div>'
    + '<div class="cd-btn cd-r" id="cdR">\u25b6</div>'
    + '<div class="cd-btn cd-gas" id="cdGas">\u26a1</div>'
    + '</div>'
    + '</div>'
    + '<div class="msg" id="msg"></div>';

  var wrap = document.getElementById("cdWrap"), cv = document.getElementById("cityCv");
  var dpr = window.devicePixelRatio || 1;
  S.vw = wrap.clientWidth; S.vh = wrap.clientHeight;
  S._dpr = dpr;
  S._cv = cv;
  cv.width = S.vw * dpr; cv.height = S.vh * dpr;
  S.canvasCtx = cv.getContext("2d"); S.canvasCtx.scale(dpr, dpr);

  S._resizeObserver = new ResizeObserver(function () {
    if (!S || !S.running) return;
    var w = wrap.clientWidth, h = wrap.clientHeight;
    if (w === 0 || h === 0) return;
    S.vw = w; S.vh = h;
    cv.width = w * dpr; cv.height = h * dpr;
    S.canvasCtx.scale(dpr, dpr);
    cityDraw();
  });
  S._resizeObserver.observe(wrap);

  var hold = function (elId, key) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.onpointerdown = function (e) { e.preventDefault(); S.keys[key] = true; };
    el.onpointerup = el.onpointercancel = el.onpointerout = function () { S.keys[key] = false; };
  };
  hold("cdL", "l"); hold("cdR", "r"); hold("cdGas", "g");

  S.keydown = function (e) {
    if (e.key === "ArrowLeft") { e.preventDefault(); S.keys.l = true; }
    if (e.key === "ArrowRight") { e.preventDefault(); S.keys.r = true; }
    if (e.key === "ArrowUp") { e.preventDefault(); S.keys.g = true; }
  };
  S.keyup = function (e) {
    if (e.key === "ArrowLeft") S.keys.l = false;
    if (e.key === "ArrowRight") S.keys.r = false;
    if (e.key === "ArrowUp") S.keys.g = false;
  };
  addEventListener("keydown", S.keydown);
  addEventListener("keyup", S.keyup);

  S.vmax = age <= 5 ? 120 : age <= 8 ? 190 : 220;
  S.time = age <= 5 ? -1 : 180;
  cityMission();
  cityHud();
  if (S.time >= 0) S.timer = setInterval(cityTick, 1000);
  S.last = performance.now();
  S.raf = requestAnimationFrame(cityLoop);
  cityDraw();
}

function stop() {
  if (!S) return;
  S.running = false;
  if (S.keydown) { removeEventListener("keydown", S.keydown); S.keydown = null; }
  if (S.keyup) { removeEventListener("keyup", S.keyup); S.keyup = null; }
  if (S.raf) { cancelAnimationFrame(S.raf); S.raf = null; }
  if (S.timer) { clearInterval(S.timer); S.timer = null; }
  if (S.missionTimeout) { clearTimeout(S.missionTimeout); S.missionTimeout = null; }
  if (S._resizeObserver) { S._resizeObserver.disconnect(); S._resizeObserver = null; }
  S = null;
}

export default {
  id: "city",
  meta: { icon: "\ud83c\udfd9\ufe0f", title: "City Drive", tz: "\u57ce\u5e02\u958b\u8eca", blurb: "Drive & deliver" },
  keyboard: false,
  bestKey: "city",
  init: init,
  stop: stop,
  forceFinishForTest: finishCity,
  debugState: function () { return S; }
};
