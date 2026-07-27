/* Balloon Pop 🎈 戳氣球 — letter-popping game migrated from index.html:1366-1446 (slice 18). */
var S = null, C = null;

var BALLOON_COLORS = ["#FF6FB5", "#4EA8FF", "#FFC93C", "#4ADE80", "#FF8A5C", "#C084FC", "#FB923C", "#A78BFA"];

function balloonHud() {
  C.hud([
    { k: "Popped", v: S.popped, c: C.kids[C.kid].raw },
    { k: "Streak", v: S.streak },
    { k: "Stars", v: C.stars }
  ]);
}

function usedLetters() { return new Set(S.balloons.map(function (b) { return b.letter; })); }

function spawnBalloon() {
  var st = document.getElementById("stage");
  var W = st.clientWidth, used = usedLetters();
  var pool = "abcdefghijklmnopqrstuvwxyz".split("").filter(function (c) { return !used.has(c); });
  if (!pool.length) return;
  var letter = C.rand(pool);
  var el = document.createElement("div"); el.className = "balloon";
  var col = C.rand(BALLOON_COLORS);
  el.innerHTML = '<div class="bl" style="background:' + col + '">' + letter.toUpperCase() + '</div>'
    + '<div class="knot" style="background:' + col + '"></div><div class="str"></div>';
  var bw = 70;
  var x = 20 + Math.random() * (Math.max(W - bw - 40, 10));
  el.style.left = x + "px"; el.style.top = "0px";
  el.style.transform = 'translate(0px, ' + (st.clientHeight + 30) + 'px)';
  st.appendChild(el);
  var wob = Math.random() * Math.PI * 2;
  S.balloons.push({ el: el, letter: letter, y: st.clientHeight + 30, x: x, wob: wob, dead: false });
}

function balloonLoop(now) {
  if (!S.running) return;
  var st = document.getElementById("stage");
  var dt = Math.min((now - S.last) / 1000, 0.05); S.last = now;
  var speed = (C.settings.balloon && C.settings.balloon.speed) || 2;
  var count = (C.settings.balloon && C.settings.balloon.count) || 3;
  var spd = 28 + (speed - 1) * 20.5;
  if (now > S.spawnAt && S.balloons.filter(function (b) { return !b.dead; }).length < count) {
    spawnBalloon();
    S.spawnAt = now + (700 - speed * 80) + Math.random() * 500;
  }
  S.balloons.forEach(function (b) {
    if (b.dead) return;
    b.y -= spd * dt; b.wob += dt * 2.2;
    var wx = Math.sin(b.wob) * 10;
    b.el.style.transform = 'translate(' + wx + 'px, ' + b.y + 'px)';
    b.el.style.top = "0px";
    if (b.y < -110) {
      b.dead = true; S.escaped++; S.streak = 0;
      b.el.classList.add("byefx");
      setTimeout(function () { b.el.remove(); }, 500);
      balloonHud();
    }
  });
  S.balloons = S.balloons.filter(function (b) { return !b.dead || b.el.isConnected; });
  C.keys.highlightSet(S.balloons.filter(function (b) { return !b.dead; }).map(function (b) { return b.letter; }));
  S.raf = requestAnimationFrame(balloonLoop);
}

function key(ch) {
  if (!S) return;
  var cand = S.balloons.filter(function (b) { return !b.dead && b.letter === ch; })
    .sort(function (a, b) { return b.y - a.y; })[0];
  if (cand) {
    cand.dead = true; S.popped++; S.streak++;
    C.sfx.pop(); C.fx.burstAt(cand.el);
    cand.el.classList.add("popfx");
    setTimeout(function () { cand.el.remove(); }, 300);
    C.finish({ score: S.popped });
    balloonHud();
  } else {
    C.sfx.bad(); S.streak = 0; balloonHud();
    var m = document.getElementById("amsg");
    if (m) {
      m.textContent = "Look at the letters on the balloons! \ud83c\udf88";
      setTimeout(function () { if (m.isConnected) m.textContent = "Pop the balloons \u2014 press the letter on each one! \ud83c\udf88"; }, 1500);
    }
  }
}

function settings(bar, ctx) {
  var spd = (ctx.settings.balloon && ctx.settings.balloon.speed) || 2;
  var cnt = (ctx.settings.balloon && ctx.settings.balloon.count) || 3;
  bar.innerHTML = '';
  bar.appendChild(createSlider("Speed " + spd, 1, 5, spd, function (v) {
    ctx.settings.balloon = ctx.settings.balloon || {};
    ctx.settings.balloon.speed = v;
    settings(bar, ctx);
  }));
  bar.appendChild(createSlider("Balloons " + cnt, 1, 6, cnt, function (v) {
    ctx.settings.balloon = ctx.settings.balloon || {};
    ctx.settings.balloon.count = v;
    settings(bar, ctx);
  }));
}

function createSlider(label, min, max, val, onChange) {
  var grp = document.createElement("span");
  grp.className = "grp";
  grp.innerHTML = label;
  var input = document.createElement("input");
  input.type = "range"; input.min = min; input.max = max; input.value = val;
  input.addEventListener("input", function () { onChange(Number(input.value)); });
  grp.appendChild(input);
  var valEl = document.createElement("span");
  valEl.className = "val"; valEl.textContent = val;
  grp.appendChild(valEl);
  return grp;
}

function init(ctx) {
  C = ctx;
  var st = document.getElementById("stage");
  st.classList.add("arena");
  st.innerHTML = '<div class="arena-msg" id="amsg">Pop the balloons \u2014 press the letter on each one! \ud83c\udf88</div>';
  S = {
    balloons: [], popped: 0, escaped: 0, streak: 0,
    running: true, last: performance.now(), spawnAt: 0, raf: null
  };
  balloonHud();
  S.raf = requestAnimationFrame(balloonLoop);
}

function stop() {
  if (!S) return;
  S.running = false;
  if (S.raf) { cancelAnimationFrame(S.raf); S.raf = null; }
  S = null;
}

export default {
  id: "balloon",
  meta: { icon: "\ud83c\udf88", title: "Balloon Pop", tz: "\u6233\u6c23\u7403", blurb: "Pop balloons with keys" },
  keyboard: true,
  bestKey: "balloon",
  init: init,
  key: key,
  settings: settings,
  stop: stop,
  debugState: function () { return S; }
};
