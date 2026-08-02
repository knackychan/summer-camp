/* Paint & Colour 🎨 畫畫著色 — tap-to-fill colouring sheets plus free drawing.
   Two layers over one another: an SVG sheet (each region is a tap target) and a
   canvas for the brush. The mode switch just flips pointer-events between them,
   so there is no flood-fill algorithm anywhere. */
import { SHEETS } from "./paint-sheets.js";

var CW = 800, CH = 600;                       /* canvas backing store; CSS scales it */
var SIZES = [8, 20, 40];
var COLORS = ["#e6194b", "#f58231", "#ffe119", "#3cb44b", "#2ec4b6", "#42d4f4",
              "#4363d8", "#911eb4", "#f032e6", "#ffb3c6", "#9a6324", "#20143a",
              "#8a8f98", "#ffffff"];

var S = null, C = null;

function css() {
  return '<style>'
    + '.pa{display:flex;flex-direction:column;gap:6px;height:100%;font-family:Fredoka,system-ui,sans-serif}'
    + '.pa__bar{display:flex;flex-wrap:wrap;gap:5px;align-items:center;justify-content:center;padding:2px}'
    + '.pa__sw{width:34px;height:34px;border-radius:50%;border:3px solid #6b5a99;padding:0;flex:0 0 auto}'
    + '.pa__sw.on{border-color:#fff;box-shadow:0 0 0 3px #000}'
    + '.pa__btn{min-height:40px;padding:0 10px;border-radius:12px;border:2px solid #6b5a99;'
    + 'background:#241a44;color:#fff;font-family:inherit;font-weight:700;font-size:14px;flex:0 0 auto}'
    + '.pa__btn.on{background:#ffe119;color:#1c1436;border-color:#fff}'
    /* container units fit the 4:3 sheet inside whatever the host gives us — the
       arena stage is short and wide, portrait is tall and narrow, and plain
       aspect-ratio + max-width leaves a letterboxed slab in the tall case */
    + '.pa__wrap{flex:1;min-height:0;display:flex;justify-content:center;align-items:center;'
    + 'container-type:size}'
    + '.pa__paper{position:relative;width:min(100cqw,133.33cqh);height:min(100cqh,75cqw);'
    + 'background:#fff;border-radius:14px;overflow:hidden;touch-action:none}'
    + '.pa__paper>svg,.pa__paper>canvas{position:absolute;left:0;top:0;width:100%;height:100%}'
    + '.pa__pick{position:absolute;left:0;top:0;right:0;bottom:0;background:#241a44;overflow:auto;'
    + 'display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;padding:10px}'
    + '.pa__card{border-radius:12px;border:2px solid #6b5a99;background:#1c1436;color:#fff;'
    + 'font-family:inherit;font-weight:700;font-size:13px;padding:8px 4px;line-height:1.25}'
    + '.pa__card i{display:block;font-style:normal;font-size:28px}'
    + '.pa__card small{display:block;opacity:.75;font-weight:400}'
    + '</style>';
}

function sheetSvg(sheet) {
  return '<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet">'
    + '<g stroke="#20143a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="#fff">'
    + sheet.svg + '</g></svg>';
}

/* ---- undo: one stack, three kinds of entry ---- */
function push(entry) {
  S.undo.push(entry);
  if (S.undo.length > 60) S.undo.shift();
}

function undo() {
  var e = S.undo.pop();
  if (!e) return;
  if (e.t === "stroke") { S.strokes.pop(); redraw(); }
  else if (e.t === "fill") { e.el.setAttribute("fill", e.prev); }
  else if (e.t === "clear") {
    S.strokes = e.strokes;
    e.fills.forEach(function (f) { f[0].setAttribute("fill", f[1]); });
    redraw();
  }
}

function clearAll() {
  var fills = regions().map(function (el) { return [el, el.getAttribute("fill")]; });
  push({ t: "clear", strokes: S.strokes, fills: fills });
  S.strokes = [];
  fills.forEach(function (f) { f[0].setAttribute("fill", "#fff"); });
  redraw();
}

function regions() {
  return Array.prototype.slice.call(S.paper.querySelectorAll("svg .z"));
}

/* ---- canvas ---- */
function styleStroke(s) {
  var g = S.g;
  g.globalCompositeOperation = s.c ? "source-over" : "destination-out";
  g.strokeStyle = s.c || "#000";
  g.fillStyle = s.c || "#000";
  g.lineWidth = s.w;
}

function redraw() {
  var g = S.g;
  g.clearRect(0, 0, CW, CH);
  g.lineCap = "round";
  g.lineJoin = "round";
  S.strokes.forEach(function (s) {
    styleStroke(s);
    if (s.p.length < 2) {
      g.beginPath();
      g.arc(s.p[0].x, s.p[0].y, s.w / 2, 0, Math.PI * 2);
      g.fill();
      return;
    }
    g.beginPath();
    g.moveTo(s.p[0].x, s.p[0].y);
    for (var i = 1; i < s.p.length; i++) g.lineTo(s.p[i].x, s.p[i].y);
    g.stroke();
  });
  g.globalCompositeOperation = "source-over";
}

function at(e) {
  var r = S.cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * CW / r.width, y: (e.clientY - r.top) * CH / r.height };
}

function onDown(e) {
  var s = { c: S.mode === "erase" ? null : S.color, w: SIZES[S.size], p: [at(e)] };
  S.strokes.push(s);
  S.live = s;
  push({ t: "stroke" });
  S.cv.setPointerCapture(e.pointerId);
  styleStroke(s);
  S.g.beginPath();
  S.g.arc(s.p[0].x, s.p[0].y, s.w / 2, 0, Math.PI * 2);
  S.g.fill();
  S.g.globalCompositeOperation = "source-over";
  e.preventDefault();
}

function onMove(e) {
  if (!S.live) return;
  var p = at(e), q = S.live.p[S.live.p.length - 1];
  S.live.p.push(p);
  styleStroke(S.live);
  S.g.lineCap = "round";
  S.g.lineJoin = "round";
  S.g.beginPath();
  S.g.moveTo(q.x, q.y);
  S.g.lineTo(p.x, p.y);
  S.g.stroke();
  S.g.globalCompositeOperation = "source-over";
  e.preventDefault();
}

function onUp() {
  if (!S.live) return;
  S.live = null;
  C.sfx.pop();
}

/* ---- ui ---- */
function setMode(m) {
  S.mode = m;
  /* the whole mode switch: in fill mode taps fall through to the SVG regions */
  S.cv.style.pointerEvents = m === "fill" ? "none" : "auto";
  syncBar();
}

function syncBar() {
  S.bar.querySelectorAll("[data-mode]").forEach(function (b) {
    b.classList.toggle("on", b.dataset.mode === S.mode);
  });
  S.bar.querySelectorAll("[data-size]").forEach(function (b) {
    b.classList.toggle("on", +b.dataset.size === S.size);
  });
  S.bar.querySelectorAll("[data-col]").forEach(function (b) {
    b.classList.toggle("on", b.dataset.col === S.color);
  });
}

function loadSheet(id) {
  var sheet = SHEETS.filter(function (s) { return s.id === id; })[0] || SHEETS[0];
  S.sheet = sheet;
  S.strokes = [];
  S.undo = [];
  S.paper.querySelector("svg").outerHTML = sheetSvg(sheet);
  redraw();
  regions().forEach(function (el) {
    el.style.cursor = "pointer";
    el.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
      push({ t: "fill", el: el, prev: el.getAttribute("fill") || "#fff" });
      el.setAttribute("fill", S.color);
      C.sfx.good();
    });
  });
  C.hud([{ k: "Sheet 圖", v: sheet.icon + " " + sheet.name[0], c: C.kids[C.kid].raw },
         { k: "Stars", v: C.stars }]);
  C.sayPair("Tap a part to fill it with colour!", "點一個地方就會上色！");
}

function showPicker(on) {
  var old = S.paper.querySelector(".pa__pick");
  if (old) old.remove();
  if (!on) return;
  var d = document.createElement("div");
  d.className = "pa__pick";
  d.innerHTML = SHEETS.map(function (s) {
    return '<button class="pa__card" data-sheet="' + s.id + '"><i>' + s.icon + '</i>'
      + s.name[0] + '<small>' + s.name[1] + '</small></button>';
  }).join("");
  d.querySelectorAll("[data-sheet]").forEach(function (b) {
    b.onpointerdown = function () { loadSheet(b.dataset.sheet); showPicker(false); };
  });
  S.paper.appendChild(d);
}

function init(ctx) {
  C = ctx;
  var wrap = document.createElement("div");
  wrap.className = "pa";
  wrap.innerHTML = css()
    + '<div class="pa__bar">'
    +   COLORS.map(function (c) {
          return '<button class="pa__sw" data-col="' + c + '" style="background:' + c + '"'
            + ' aria-label="colour ' + c + '"></button>';
        }).join("")
    + '</div>'
    + '<div class="pa__bar">'
    +   '<button class="pa__btn" data-mode="fill">🎨 Fill 填色</button>'
    +   '<button class="pa__btn" data-mode="draw">✏️ Draw 畫</button>'
    +   '<button class="pa__btn" data-mode="erase">🧽 Rub out 擦掉</button>'
    +   SIZES.map(function (w, i) {
          return '<button class="pa__btn" data-size="' + i + '">'
            + ["·", "•", "⬤"][i] + '</button>';
        }).join("")
    +   '<button class="pa__btn" data-act="undo">↩️ Undo 復原</button>'
    +   '<button class="pa__btn" data-act="clear">🗑️ Clear 全清</button>'
    +   '<button class="pa__btn" data-act="pick">📄 New sheet 換圖</button>'
    + '</div>'
    + '<div class="pa__wrap"><div class="pa__paper"><svg></svg>'
    +   '<canvas width="' + CW + '" height="' + CH + '"></canvas></div></div>';

  ctx.mount.innerHTML = "";
  ctx.mount.appendChild(wrap);

  S = { mode: "fill", color: COLORS[0], size: 1, strokes: [], undo: [], live: null,
        paper: wrap.querySelector(".pa__paper"), cv: wrap.querySelector("canvas"),
        bar: wrap, sheet: null };
  S.g = S.cv.getContext("2d");

  wrap.querySelectorAll("[data-col]").forEach(function (b) {
    b.onpointerdown = function () { S.color = b.dataset.col; syncBar(); };
  });
  wrap.querySelectorAll("[data-mode]").forEach(function (b) {
    b.onpointerdown = function () { setMode(b.dataset.mode); };
  });
  wrap.querySelectorAll("[data-size]").forEach(function (b) {
    b.onpointerdown = function () { S.size = +b.dataset.size; syncBar(); };
  });
  wrap.querySelector('[data-act="undo"]').onpointerdown = undo;
  wrap.querySelector('[data-act="clear"]').onpointerdown = clearAll;
  wrap.querySelector('[data-act="pick"]').onpointerdown = function () { showPicker(true); };

  S.cv.addEventListener("pointerdown", onDown);
  S.cv.addEventListener("pointermove", onMove);
  S.cv.addEventListener("pointerup", onUp);
  S.cv.addEventListener("pointercancel", onUp);

  loadSheet("house");
  setMode("fill");
}

function stop() {
  /* every listener lives on nodes inside ctx.mount, which the host clears */
  S = null;
  C = null;
}

export default {
  id: "paint",
  meta: { icon: "🎨", title: "Paint & Colour", tz: "畫畫著色", blurb: "Colour the sheets" },
  keyboard: false,
  bestKey: null,
  init: init,
  stop: stop
};
