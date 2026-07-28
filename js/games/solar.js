/* Solar System 3D game — focus zoom + holo card (slice 32) + quiz (slice 33).
   All text via DOM overlay; all prose in solar-data.js / solar-sim.js / solar-quiz.js.
   Binding specs: tech-spec.md §1–§14, art-direction.md §3–§6. */

import { PLANETS, SOLAR, SCENE, ISS, SATELLITES, PLUTO, MILKYWAY, NEARBY_STARS } from "./solar-data.js";
import { SPEEDS, daysPerSec, advance, orbitCount } from "./solar-sim.js";
import { buildMission, grade } from "./solar-quiz.js";

var R = null;
var STAR_TINTS = ["#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFE9C8", "#FFE9C8", "#C9D6FF"];
var AVAILABLE_PHOTOS = {};
AVAILABLE_PHOTOS[SOLAR.photo] = true;
AVAILABLE_PHOTOS[ISS.photo] = true;
AVAILABLE_PHOTOS[PLUTO.photo] = true;
AVAILABLE_PHOTOS[MILKYWAY.photo] = true;
Object.keys(SATELLITES).forEach(function (planetId) {
  SATELLITES[planetId].forEach(function (sat) { AVAILABLE_PHOTOS[sat.photo] = true; });
});
NEARBY_STARS.forEach(function (ns) { AVAILABLE_PHOTOS[ns.photo] = true; });
PLANETS.forEach(function (p) { AVAILABLE_PHOTOS[p.photo] = true; });

/* ====== Pure helpers (exported for testing) ====== */

export function hitRadius(size) { return Math.max(2.5 * size, 0.9); }
export function angleAt(body, totalDays) { return (totalDays / body.yearDays) * Math.PI * 2; }
export function focusDistance(id, size) { return id === "sun" ? 18 : Math.max(7, Math.min(24, size * 8)); }
export function bodyOpacity(bodyId, focusId) {
  if (!focusId || bodyId === focusId) return 1;
  return focusId === "sun" ? 0.82 : 0.55;
}
export function focusPanLimit(id, size) { return id === "sun" ? 9 : Math.max(2.5, Math.min(8, size * 3)); }
export function photoIsVendored(path) { return !!AVAILABLE_PHOTOS[path]; }
export function bodyNamePair(body) { return [body.name, body.tz]; }
function speedDockLabel(step) {
  var labels = { pause: "Pause", day: "1d", "10day": "10d", month: "1mo", year: "1y" };
  return labels[step.id] || step.en;
}

export function factPool(body, excludeIdx) {
  if (!body || !body.facts || !body.facts.length) return null;
  var n = body.facts.length;
  if (n === 1) return 0;
  var i;
  do { i = Math.floor(Math.random() * n); } while (i === excludeIdx && n > 1);
  return i;
}

export function statCells(body) {
  if (body.id === "sun") {
    return [
      { kEn: "DIAMETER \u00b7 \u76f4\u5f91", v: SOLAR.diameterKm.toLocaleString() + " KM" },
      { kEn: "TYPE \u00b7 \u985e\u578b", v: SOLAR.type.en + " \u6046\u661f" },
      { kEn: "PLANETS \u00b7 \u884c\u661f", v: "8" },
      { kEn: "CENTRE \u00b7 \u4e2d\u5fc3", v: "SOLAR SYSTEM" },
    ];
  }
  if (body.id === "iss") {
    return [
      { kEn: "LENGTH \u00b7 \u9577\u5ea6", v: "109 M" },
      { kEn: "ORBITS \u00b7 \u8ecc\u9053", v: "EARTH \u5730\u7403" },
      { kEn: "ORBIT TIME \u00b7 \u9031\u671f", v: "92 MIN" },
      { kEn: "ALTITUDE \u00b7 \u9ad8\u5ea6", v: ISS.altitudeKm + " KM" },
      { kEn: "CREW \u00b7 \u7d44\u54e1", v: String(ISS.crew) },
      { kEn: "TYPE \u00b7 \u985e\u578b", v: ISS.type.en },
    ];
  }
  if (body.id === "pluto") {
    return [
      { kEn: "DIAMETER \u00b7 \u76f4\u5f91", v: PLUTO.diameterKm.toLocaleString() + " KM" },
      { kEn: "FROM SUN \u00b7 \u8ddd\u65e5", v: PLUTO.au + " AU" },
      { kEn: "1 YEAR \u00b7 \u4e00\u5e74", v: "248 YEARS" },
      { kEn: "MOONS \u00b7 \u885b\u661f", v: "5" },
      { kEn: "TYPE \u00b7 \u985e\u578b", v: PLUTO.type.en },
      { kEn: "REGION \u00b7 \u5340\u57df", v: "KUIPER BELT" },
    ];
  }
  if (body.id === "milkyway") {
    return [
      { kEn: "TYPE \u00b7 \u985e\u578b", v: MILKYWAY.type.en },
      { kEn: "DIAMETER \u00b7 \u76f4\u5f91", v: MILKYWAY.diameterLy.toLocaleString() + " LY" },
      { kEn: "STARS \u00b7 \u6046\u661f", v: MILKYWAY.starCount },
      { kEn: "AGE \u00b7 \u5e74\u9f61", v: MILKYWAY.age },
      { kEn: "HOME TO \u00b7 \u5bb6\u5712", v: "OUR SUN \u592a\u967d" },
      { kEn: "CENTRE \u00b7 \u4e2d\u5fc3", v: "BLACK HOLE \u9ed1\u6d1e" },
    ];
  }
  var nearStar = null;
  NEARBY_STARS.forEach(function (ns) { if (ns.id === body.id) nearStar = ns; });
  if (nearStar) {
    return [
      { kEn: "TYPE \u00b7 \u985e\u578b", v: nearStar.type.en },
      { kEn: "DISTANCE \u00b7 \u8ddd\u96e2", v: nearStar.ly + " LIGHT-YEARS" },
      { kEn: "COLOUR \u00b7 \u984f\u8272", v: nearStar.color === 0xFFF8D6 ? "YELLOW-WHITE" : nearStar.color === 0xE0F0FF ? "BLUE-WHITE" : "RED-ORANGE" },
      { kEn: "VISIBLE \u00b7 \u53ef\u898b", v: nearStar.id === "sirius" ? "BRIGHTEST \u6700\u4eae" : "NAKED EYE" },
      { kEn: "SYSTEM \u00b7 \u7cfb\u7d71", v: nearStar.id === "alphacentauri" ? "TRIPLE \u4e09\u5408\u661f" : nearStar.id === "sirius" ? "BINARY \u96d9\u661f" : "SINGLE \u55ae\u661f" },
      { kEn: "CONSTELLATION", v: nearStar.id === "alphacentauri" ? "CENTAURUS" : nearStar.id === "sirius" ? "CANIS MAJOR" : "OPHIUCHUS" },
    ];
  }
  var satCfg = SCENE.sats && SCENE.sats[body.id];
  if (satCfg) {
    var parentName = "";
    Object.keys(SATELLITES).forEach(function (pid) {
      SATELLITES[pid].forEach(function (s) { if (s.id === body.id) parentName = pid.charAt(0).toUpperCase() + pid.slice(1); });
    });
    return [
      { kEn: "DIAMETER \u00b7 \u76f4\u5f91", v: body.diameterKm.toLocaleString() + " KM" },
      { kEn: "ORBITS \u00b7 \u8ecc\u9053", v: parentName.toUpperCase() },
      { kEn: "ORBIT TIME \u00b7 \u9031\u671f", v: body.orbitDays + " DAYS" },
      { kEn: "TYPE \u00b7 \u985e\u578b", v: body.type.en },
      { kEn: "DISCOVERED \u00b7 \u767c\u73fe", v: body.discovered || "\u2014" },
      { kEn: "MOON OF \u00b7 \u885b\u661f", v: parentName },
    ];
  }
  return [
    { kEn: "DIAMETER \u00b7 \u76f4\u5f91", v: body.diameterKm.toLocaleString() + " KM" },
    { kEn: "FROM SUN \u00b7 \u8ddd\u65e5", v: body.au + " AU" },
    { kEn: "1 YEAR \u00b7 \u4e00\u5e74", v: body.yearDays.toLocaleString() + " DAYS" },
    { kEn: "1 DAY \u00b7 \u4e00\u5929", v: body.dayHours + " HRS" },
    { kEn: "MOONS \u00b7 \u885b\u661f", v: String(body.moons) },
    { kEn: "TYPE \u00b7 \u985e\u578b", v: body.type.en },
  ];
}

export var meta = { icon: "\ud83e\ude90", title: "Solar System", tz: "\u592a\u967d\u7cfb", blurb: "Explore the planets" };

/* ====== Self-referencing settings ====== */

function _settings(bar, ctx) {
  var speedId = (ctx.settings && ctx.settings.speed) || "10day";
  var row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "8px";
  row.style.flexWrap = "wrap";
  row.style.padding = "6px 10px";
  SPEEDS.forEach(function (step) {
    var chip = document.createElement("button");
    chip.className = "chip" + (step.id === speedId ? " on" : "");
    chip.style.fontSize = "13px";
    chip.textContent = step.en + " " + step.tz;
    chip.addEventListener("click", function () {
      ctx.settings.speed = step.id;
      _settings(bar, ctx);
    });
    row.appendChild(chip);
  });
  bar.innerHTML = "";
  bar.appendChild(row);
}

/* ====== CSS ====== */

var SOLAR_CSS = [
  ".solar-ui * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent }",
  ".solar-ui { font-family:'Nunito',system-ui,sans-serif }",
  ".solar-ui .chip { font-family:'Fredoka',system-ui,sans-serif; font-weight:600; font-size:16px; ",
  "  border:2px solid #4A4090; background:rgba(25,19,64,.72); backdrop-filter:blur(6px); color:#A79FD6; ",
  "  border-radius:999px; padding:8px 18px; cursor:pointer; pointer-events:auto }",
  ".solar-ui .chip.on { background:#FFC93C; color:#1C1436; border-color:transparent }",
  ".solar-ui .modebar { position:absolute; top:12px; left:50%; transform:translateX(-50%); display:flex; gap:10px; z-index:2 }",
  ".solar-ui .timeband { position:absolute; left:10px; right:10px; bottom:10px; min-height:44px; ",
  "  background:rgba(51,43,102,.82); backdrop-filter:blur(8px); border:2px solid #4A4090; ",
  "  border-radius:14px; padding:6px 8px; display:flex; align-items:center; gap:8px; ",
  "  pointer-events:auto; box-shadow:0 8px 20px rgba(0,0,0,.18) }",
  ".solar-ui .counter1 { flex:0 0 auto; font-family:'Fredoka',system-ui,sans-serif; font-weight:700; ",
  "  font-size:14px; color:#F3F0FF; padding:6px 9px; border-radius:10px; background:rgba(25,19,64,.48); white-space:nowrap }",
  ".solar-ui .counter1 b,.solar-ui .counter2 b { color:#FFC93C }",
  ".solar-ui .counter2 { flex:1 1 auto; min-width:0; font-weight:800; font-size:11px; color:#A79FD6; ",
  "  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:right; padding-right:4px }",
  ".solar-ui .speeds { flex:0 0 auto; display:flex; gap:5px; justify-content:center; align-items:center; flex-wrap:nowrap }",
  ".solar-ui .speeds .chip { min-width:42px; min-height:32px; font-size:12px; padding:5px 8px; border-radius:11px }",
  /* Info card */
  ".solar-ui .infocard { position:absolute; top:12px; right:12px; bottom:12px; width:min(360px,92vw); overflow-y:auto; ",
  "  background:rgba(25,19,64,.82); backdrop-filter:blur(10px); border:1px solid rgba(78,168,255,.45); border-radius:18px; ",
  "  padding:16px 16px 18px; box-shadow:0 0 32px rgba(78,168,255,.12); pointer-events:auto; z-index:2; ",
  "  animation:solar-card-in .22s ease-out; scrollbar-width:thin }",
  "@keyframes solar-card-in { from{transform:translateX(24px);opacity:0} to{transform:none;opacity:1} }",
  ".solar-ui .infocard::before,.solar-ui .infocard::after { content:''; position:absolute; width:18px; height:18px; pointer-events:none }",
  ".solar-ui .infocard::before { top:6px; left:6px; border-top:2px solid #FFC93C; border-left:2px solid #FFC93C; border-radius:6px 0 0 0 }",
  ".solar-ui .infocard::after { bottom:6px; right:6px; border-bottom:2px solid #FFC93C; border-right:2px solid #FFC93C; border-radius:0 0 6px 0 }",
  ".solar-ui .ic-close { position:absolute; top:10px; right:10px; z-index:2; width:44px; height:44px; border-radius:14px; ",
  "  border:2px solid #4A4090; background:rgba(25,19,64,.6); color:#F3F0FF; font-size:20px; cursor:pointer; display:flex; align-items:center; justify-content:center }",
  ".solar-ui .ic-photo { position:relative; width:100%; aspect-ratio:1; border-radius:14px; overflow:hidden; ",
  "  border:1px solid rgba(78,168,255,.35); box-shadow:0 0 24px rgba(78,168,255,.15); background:#0d0a24 }",
  ".solar-ui .ic-photo img { width:100%; height:100%; object-fit:cover; display:block }",
  ".solar-ui .ic-photo.fallback img { display:none }",
  ".solar-ui .ic-class { margin-top:12px; font-weight:800; font-size:11px; letter-spacing:2px; color:#4EA8FF }",
  ".solar-ui .card-name { font-family:'Fredoka',system-ui,sans-serif; font-weight:700; font-size:28px; margin-top:2px; color:#F3F0FF }",
  ".solar-ui .card-name span { font-weight:600; font-size:23px }",
  ".solar-ui .ic-desc { margin-top:8px; font-weight:700; font-size:15px; line-height:1.45; color:#F3F0FF }",
  ".solar-ui .ic-desc-tz { margin-top:4px; font-weight:700; font-size:14px; line-height:1.45; color:#A79FD6 }",
  ".solar-ui .ic-factbox { margin-top:12px; border:1px dashed rgba(255,201,60,.45); border-radius:12px; padding:10px 12px }",
  ".solar-ui .fb-head { display:flex; align-items:center; gap:8px; font-weight:800; font-size:11px; letter-spacing:2px; color:#FFC93C }",
  ".solar-ui .fb-head button { margin-left:auto; width:34px; height:34px; font-size:15px; border-radius:10px; ",
  "  border:1px solid rgba(255,201,60,.45); background:transparent; color:#FFC93C; cursor:pointer }",
  ".solar-ui .fb-en { margin-top:6px; font-weight:700; font-size:15px; line-height:1.4; color:#F3F0FF }",
  ".solar-ui .fb-tz { margin-top:2px; font-weight:700; font-size:14px; color:#A79FD6 }",
  ".solar-ui .ic-grid { margin-top:12px; display:grid; grid-template-columns:1fr 1fr; gap:8px }",
  ".solar-ui .cell { border:1px solid rgba(78,168,255,.25); border-radius:10px; padding:8px 10px }",
  ".solar-ui .cell .k { font-weight:800; font-size:10px; letter-spacing:1.5px; color:#4EA8FF }",
  ".solar-ui .cell .v { font-family:'Fredoka',system-ui,sans-serif; font-weight:700; font-size:16px; margin-top:1px; color:#F3F0FF }",
  ".solar-ui .ic-voice { margin-top:12px; width:100% !important }",
  ".solar-ui .btn { font-family:'Fredoka',system-ui,sans-serif; font-weight:600; border:none; cursor:pointer; border-radius:14px; ",
  "  padding:12px 22px; font-size:17px; color:#F3F0FF; background:#332B66; box-shadow:0 4px 0 rgba(0,0,0,.25) }",
  ".solar-ui .btn:active { transform:translateY(2px); box-shadow:0 1px 0 rgba(0,0,0,.25) }",
  ".solar-ui .btn.gold { background:#FFC93C; color:#1C1436 }",
  /* Quiz banner */
  ".solar-ui .quizbanner { position:absolute; top:64px; left:50%; transform:translateX(-50%); width:min(92vw,600px); ",
  "  background:#3D3475; border:2px solid #4A4090; border-radius:18px; padding:12px 18px; ",
  "  display:flex; align-items:center; gap:14px; pointer-events:auto; z-index:2; ",
  "  animation:solar-card-in .22s ease-out }",
  ".solar-ui .quizbanner.shake { animation:solar-shake .3s }",
  "@keyframes solar-shake { 0%,60%{transform:translateX(calc(-50% - 6px))} 30%,90%{transform:translateX(calc(-50% + 6px))} 100%{transform:translateX(-50%)} }",
  ".solar-ui .q-round { font-family:'Fredoka',system-ui,sans-serif; font-weight:700; font-size:18px; color:#FFC93C; white-space:nowrap }",
  ".solar-ui .q-mid { flex:1; text-align:center }",
  ".solar-ui .q-en { font-family:'Fredoka',system-ui,sans-serif; font-weight:600; font-size:22px; color:#F3F0FF }",
  ".solar-ui .q-tz { font-weight:800; font-size:17px; color:#A79FD6 }",
  ".solar-ui .q-stars { font-family:'Fredoka',system-ui,sans-serif; font-weight:700; font-size:18px; color:#FFC93C; white-space:nowrap }",
  ".solar-ui .q-try { position:absolute; left:50%; top:calc(100% + 8px); transform:translateX(-50%); ",
  "  font-weight:800; font-size:15px; color:#A79FD6; white-space:nowrap }",
  ".solar-ui .q-voice { width:44px; height:44px; border-radius:14px; border:2px solid #4A4090; background:transparent; ",
  "  color:#F3F0FF; font-size:20px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex:none }",
  /* End card */
  ".solar-ui .endcard { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; ",
  "  background:rgba(20,14,46,.55); z-index:3; pointer-events:auto }",
  ".solar-ui .endcard .card { background:#332B66; border:2px solid #4A4090; border-radius:22px; ",
  "  padding:28px 32px; text-align:center; max-width:min(90vw,420px); animation:solar-card-in .22s ease-out }",
  ".solar-ui .endcard .big { font-family:'Fredoka',system-ui,sans-serif; font-weight:700; font-size:48px; color:#F3F0FF }",
  ".solar-ui .endcard .big b { color:#FFC93C }",
  ".solar-ui .endcard p { margin-top:6px; font-weight:800; font-size:16px; color:#A79FD6 }",
  ".solar-ui .endcard .row { margin-top:18px; display:flex; gap:12px; justify-content:center }",
  /* Burst */
  ".solar-ui .burst { position:absolute; z-index:4; pointer-events:none; font-size:26px; animation:solar-burst .7s ease-out forwards }",
  "@keyframes solar-burst { 0%{transform:translate(-50%,-50%) scale(.6);opacity:1} 100%{transform:translate(-50%,-90%) scale(1.5);opacity:0} }",
  ".solar-ui .hidden { display:none !important }",
  "@media (max-width:720px) { .solar-ui .timeband { left:8px; right:8px; bottom:8px; gap:5px; padding:5px } ",
  "  .solar-ui .counter1 { font-size:12px; padding:5px 7px } ",
  "  .solar-ui .counter2 { display:none } ",
  "  .solar-ui .speeds { flex:1 1 auto } ",
  "  .solar-ui .speeds .chip { flex:1 1 0; min-width:0; padding:5px 2px; font-size:11px } ",
  "  .solar-ui .infocard { top:auto; left:12px; right:12px; bottom:62px; width:auto; max-height:48vh } }"
].join("\n");

/* ====== Helpers ====== */

function disposeScene(scene) {
  if (!scene) return;
  scene.traverse(function (child) {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      var mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(function (m) {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}

/* Procedural ISS model: replaces the old placeholder box with a recognisable
   station — integrated truss, 4 solar-array wings (gold blanket rims around blue
   cell fields), the pressurised module stack, radiators, cupola, a docked crew
   capsule and an antenna dish. Built from primitives so it needs no loader and no
   asset file (offline-first) and matches the flat-colour art direction.
   `s` is SCENE.issSize; the whole model spans ~2.4s x ~1.7s x ~1.1s.
   Returns { model, mats } — mats lists the shared materials so the tick loop can
   fade the whole station for focus-dim. */
function buildIssModel(THREE, s) {
  var mats = [];
  function stationMat(color, emissive) {
    var m = new THREE.MeshLambertMaterial({ color: color, transparent: true, opacity: 1 });
    m.emissive = new THREE.Color(emissive);
    mats.push(m);
    return m;
  }
  var hullMat = stationMat(0xEDEAE2, 0x151515);  /* white modules + radiators */
  var trussMat = stationMat(0xB7B2A5, 0x0f0f0f); /* truss beam + wing masts */
  var goldMat = stationMat(0xE2A93C, 0x201404);  /* solar blanket rims */
  var cellMat = stationMat(0x2B4F80, 0x070c16);  /* solar cells */
  var darkMat = stationMat(0x5E5A52, 0x070707);  /* capsule + antenna */

  var model = new THREE.Group();

  /* Integrated truss — the long backbone beam */
  model.add(new THREE.Mesh(new THREE.BoxGeometry(2.3 * s, 0.10 * s, 0.10 * s), trussMat));

  /* 4 solar-array wings, each a mast plus 2 gold-rimmed blankets fore/aft */
  [-1, 1].forEach(function (side) {
    [0.62, 1.00].forEach(function (wx) {
      var x = side * wx * s;
      var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * s, 0.03 * s, 0.34 * s, 6), trussMat);
      mast.rotation.x = Math.PI / 2;
      mast.position.set(x, 0, 0);
      model.add(mast);
      [-1, 1].forEach(function (zs) {
        var z = zs * 0.46 * s;
        var blanket = new THREE.Mesh(new THREE.BoxGeometry(0.38 * s, 0.016 * s, 0.64 * s), goldMat);
        blanket.position.set(x, 0, z);
        model.add(blanket);
        var cells = new THREE.Mesh(new THREE.BoxGeometry(0.30 * s, 0.032 * s, 0.54 * s), cellMat);
        cells.position.set(x, 0, z);
        model.add(cells);
      });
    });
  });

  /* Pressurised modules, hanging just below the truss centre */
  function tube(r, len, x, y, z, axis, mat) {
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(r * s, r * s, len * s, 12), mat);
    if (axis === "z") mesh.rotation.x = Math.PI / 2;
    if (axis === "x") mesh.rotation.z = Math.PI / 2;
    mesh.position.set(x * s, y * s, z * s);
    model.add(mesh);
    return mesh;
  }
  tube(0.13, 0.50, 0, -0.10, -0.62, "z", hullMat);    /* Zvezda (aft) */
  tube(0.13, 0.42, 0, -0.10, -0.16, "z", hullMat);    /* Zarya */
  tube(0.15, 0.26, 0, -0.10, 0.16, "z", hullMat);     /* Unity node */
  tube(0.14, 0.50, 0, -0.10, 0.52, "z", hullMat);     /* Destiny lab */
  tube(0.10, 0.44, 0.32, -0.10, 0.52, "x", hullMat);  /* Kibo (starboard) */
  tube(0.10, 0.32, -0.26, -0.10, 0.52, "x", hullMat); /* Columbus (port) */

  /* Cupola dome under the node */
  var cupola = new THREE.Mesh(new THREE.SphereGeometry(0.09 * s, 10, 8), hullMat);
  cupola.position.set(0, -0.27 * s, 0.16 * s);
  model.add(cupola);

  /* Docked crew capsule with nose cone, below Destiny */
  tube(0.08, 0.22, -0.12, -0.32, 0.52, "y", darkMat);
  var nose = new THREE.Mesh(new THREE.ConeGeometry(0.08 * s, 0.14 * s, 10), darkMat);
  nose.position.set(-0.12 * s, -0.50 * s, 0.52 * s);
  nose.rotation.x = Math.PI;
  model.add(nose);

  /* 2 radiator panels standing up near the truss centre */
  [-1, 1].forEach(function (side) {
    var rad = new THREE.Mesh(new THREE.BoxGeometry(0.30 * s, 0.50 * s, 0.018 * s), hullMat);
    rad.position.set(side * 0.32 * s, 0.28 * s, 0);
    model.add(rad);
  });

  /* Antenna dish pointing forward off Destiny */
  var dish = new THREE.Mesh(new THREE.ConeGeometry(0.09 * s, 0.10 * s, 10), darkMat);
  dish.position.set(0, -0.10 * s, 0.82 * s);
  dish.rotation.x = Math.PI / 2;
  model.add(dish);

  return { model: model, mats: mats };
}

/* ====== Game module ====== */

export default {
  id: "solar",
  meta: meta,
  keyboard: false,
  bestKey: null,
  settings: _settings,

  init: async function (ctx) {
    var THREE = await import("../vendor/three.module.min.js");
    var OrbitControlsMod = await import("../vendor/OrbitControls.js");
    var OrbitControls = OrbitControlsMod.OrbitControls;

    R = {};
    R.THREE = THREE;
    R.ctx = ctx;
    R.totalDays = 0;
    R.speedId = (ctx.settings && ctx.settings.speed) || "10day";
    R.focus = null;
    R.focusCardId = null;
    R.mode = "explore";
    R.bodies = [];
    R.quiz = null;
    R.quizStars = 0;

    /* Mount canvas */
    var mount = ctx.mount;
    if (!mount.style.position || mount.style.position === "static") {
      mount.style.position = "relative";
    }
    mount.innerHTML = "";

    var canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    mount.appendChild(canvas);

    /* Renderer */
    R.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    R.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    R.renderer.setClearColor(0x191340);
    var initialW = Math.max(mount.clientWidth || 640, 1);
    var initialH = Math.max(mount.clientHeight || 320, 1);
    R.renderer.setSize(initialW, initialH, false);

    /* Camera */
    R.camera = new THREE.PerspectiveCamera(45, initialW / initialH, 0.1, 200);
    R.camera.position.set(0, 16, 30);
    R.camera.lookAt(0, 0, 0);

    /* Controls */
    R.controls = new OrbitControls(R.camera, canvas);
    R.controls.enablePan = false;
    R.controls.enableDamping = true;
    R.controls.dampingFactor = 0.08;
    R.controls.rotateSpeed = 0.6;
    R.controls.zoomSpeed = 0.8;
    R.controls.minDistance = 10;
    R.controls.maxDistance = 55;
    R.controls.minPolarAngle = 0.15;
    R.controls.maxPolarAngle = 1.45;
    R.controls.autoRotate = false;
    R.controls.target.set(0, 0, 0);

    /* Scene */
    R.scene = new THREE.Scene();

    /* Sun */
    var sunGeo = new THREE.SphereGeometry(SCENE.sunRadius, 32, 24);
    var sunMat = new THREE.MeshBasicMaterial({ color: SOLAR.color });
    R.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    R.scene.add(R.sunMesh);

    var glowGeo = new THREE.SphereGeometry(SCENE.sunRadius * 1.35, 32, 24);
    var glowMat = new THREE.MeshBasicMaterial({
      color: 0xFFC93C, transparent: true, opacity: 0.18,
      blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false
    });
    R.scene.add(new THREE.Mesh(glowGeo, glowMat));

    /* Lighting */
    R.scene.add(new THREE.AmbientLight(0xA79FD6, 0.55));
    var pointLight = new THREE.PointLight(0xFFF4D6, 1.1, 0);
    pointLight.position.set(0, 0, 0);
    R.scene.add(pointLight);

    /* Stars */
    var starCount = 950;
    var starGeo = new THREE.BufferGeometry();
    var positions = new Float32Array(starCount * 3);
    var colors = new Float32Array(starCount * 3);
    for (var si = 0; si < starCount; si++) {
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);
      var r = 60 + Math.random() * 30;
      positions[si * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[si * 3 + 1] = r * Math.cos(phi) * 0.6;
      positions[si * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      var tint = STAR_TINTS[si % 10];
      var c = new THREE.Color(tint);
      colors[si * 3] = c.r; colors[si * 3 + 1] = c.g; colors[si * 3 + 2] = c.b;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    R.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      size: 0.75, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false
    }));
    R.scene.add(R.stars);

    /* Milky Way band */
    var bandCount = SCENE.bandCount || 700;
    var bandGeo = new THREE.BufferGeometry();
    var bandPositions = new Float32Array(bandCount * 3);
    var bandColors = new Float32Array(bandCount * 3);
    var bandR = SCENE.bandRadius || 34;
    var bandS = SCENE.bandSpread || 5;
    var bandY = SCENE.bandYSpread || 2.5;
    for (var bi = 0; bi < bandCount; bi++) {
      var ba = Math.random() * Math.PI * 2;
      var br = bandR + (Math.random() - 0.5) * bandS * 2;
      var by = (Math.random() - 0.5) * bandY * 2;
      bandPositions[bi * 3] = Math.cos(ba) * br;
      bandPositions[bi * 3 + 1] = by;
      bandPositions[bi * 3 + 2] = Math.sin(ba) * br;
      var h = 0.08 + Math.random() * 0.1;
      var s = 0.2 + Math.random() * 0.4;
      var l = 0.6 + Math.random() * 0.35;
      var bc = new THREE.Color().setHSL(h, s, l);
      bandColors[bi * 3] = bc.r; bandColors[bi * 3 + 1] = bc.g; bandColors[bi * 3 + 2] = bc.b;
    }
    bandGeo.setAttribute("position", new THREE.BufferAttribute(bandPositions, 3));
    bandGeo.setAttribute("color", new THREE.BufferAttribute(bandColors, 3));
    R.scene.add(new THREE.Points(bandGeo, new THREE.PointsMaterial({
      size: 0.55, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false
    })));

    /* Galactic centre glow */
    var gcAngle = SCENE.galCenterAngle || 2.8;
    var gcDist = (SCENE.bandRadius || 34) + 12;
    var gcGeo = new THREE.SphereGeometry(1.8, 16, 12);
    var gcMat = new THREE.MeshBasicMaterial({
      color: 0xFFCC66, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    var gcMesh = new THREE.Mesh(gcGeo, gcMat);
    gcMesh.position.set(Math.cos(gcAngle) * gcDist, 0, Math.sin(gcAngle) * gcDist);
    R.scene.add(gcMesh);

    /* Nearby stars */
    var nearStarAngles = { alphacentauri: 1.2, sirius: 4.6, barnardstar: 3.1 };
    NEARBY_STARS.forEach(function (ns) {
      var nsDist = SCENE.nearStarRadii[ns.id] || 35;
      var nsAngle = nearStarAngles[ns.id];
      var nsGroup = new THREE.Group();
      nsGroup.position.set(Math.cos(nsAngle) * nsDist, 0, Math.sin(nsAngle) * nsDist);

      var nsGeo = new THREE.SphereGeometry(0.3, 12, 8);
      var nsMat = new THREE.MeshBasicMaterial({ color: ns.color });
      var nsMesh = new THREE.Mesh(nsGeo, nsMat);
      nsGroup.add(nsMesh);

      var nsGlowGeo = new THREE.SphereGeometry(0.7, 12, 8);
      var nsGlowMat = new THREE.MeshBasicMaterial({
        color: ns.color, transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      nsGroup.add(new THREE.Mesh(nsGlowGeo, nsGlowMat));

      var nsHitGeo = new THREE.SphereGeometry(hitRadius(0.3), 8, 6);
      var nsHitMesh = new THREE.Mesh(nsHitGeo, new THREE.MeshBasicMaterial({ visible: false }));
      nsGroup.add(nsHitMesh);

      R.scene.add(nsGroup);

      R.nearStars = R.nearStars || [];
      R.nearStars.push({
        id: ns.id, data: ns, group: nsGroup, mesh: nsMesh, hit: nsHitMesh, size: 0.3
      });
    });

    /* Orbit rings */
    PLANETS.forEach(function (p) {
      var or = SCENE.orbits[p.id];
      var pts = [];
      for (var i = 0; i <= 128; i++) {
        var a = (i / 128) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * or, 0, Math.sin(a) * or));
      }
      R.scene.add(new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x4A4090, transparent: true, opacity: 0.5 })
      ));
    });

    /* Planets */
    var startAngles = [0.2, 3.5, 1.8, 5.2, 4.1, 2.3, 6.0, 0.8];
    PLANETS.forEach(function (p, pi) {
      var group = new THREE.Group();
      var or = SCENE.orbits[p.id];
      var sz = SCENE.sizes[p.id];
      var sa = startAngles[pi] * Math.PI * 2;
      group.position.set(Math.cos(sa) * or, 0, Math.sin(sa) * or);

      var mat = new THREE.MeshLambertMaterial({ color: p.color, transparent: true, opacity: 1 });
      var mesh = new THREE.Mesh(new THREE.SphereGeometry(sz, 24, 18), mat);
      group.add(mesh);

      /* Pixel-art albedo map (art-direction.md §10, tech-spec.md §17): a missing
         or failed load is never an error state, it just keeps the flat colour.
         Self-illuminated (Papa, 2026-07-28): the scene's dim ambient+point light
         was crushing the pixel-art colours (and multiplying them against the
         Lambert material's own tinted colour on top). Swapping to a Basic
         material once the map loads shows the texture at full, constant
         brightness, the same unlit treatment already used for the Sun. */
      new THREE.TextureLoader().load(
        "assets/solar/tex/" + p.id + ".png",
        function (tex) {
          tex.magFilter = THREE.NearestFilter;
          tex.minFilter = THREE.NearestFilter;
          tex.generateMipmaps = false;
          tex.colorSpace = THREE.SRGBColorSpace;
          var litMat = mesh.material;
          mesh.material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 1 });
          litMat.dispose();
        },
        undefined,
        function () {}
      );

      var hitR = hitRadius(sz);
      if (p.id === "earth") hitR = hitR * 0.55;
      var hitMesh = new THREE.Mesh(
        new THREE.SphereGeometry(hitR, 12, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      group.add(hitMesh);

      var ringMesh = null;
      if (p.id === "saturn") {
        ringMesh = new THREE.Mesh(
          new THREE.RingGeometry(sz * 1.35, sz * 2.05, 64),
          new THREE.MeshBasicMaterial({ color: 0xE8D9B0, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
        );
        ringMesh.rotation.x = 0.44;
        group.add(ringMesh);
      }
      if (p.id === "uranus") group.rotation.z = 1.71;

      if (p.id === "earth") {
        var issOrbitPts = [];
        var issOr = SCENE.issOrbit;
        for (var jo = 0; jo <= 64; jo++) {
          var ba = (jo / 64) * Math.PI * 2;
          issOrbitPts.push(new THREE.Vector3(Math.cos(ba) * issOr, -0.01, Math.sin(ba) * issOr));
        }
        group.add(new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(issOrbitPts),
          new THREE.LineBasicMaterial({ color: 0x4EA8FF, transparent: true, opacity: 0.35, depthTest: true })
        ));

        var issGroup = new THREE.Group();
        issGroup.position.set(issOr, 0, 0);
        var issModel = buildIssModel(THREE, SCENE.issSize);
        issGroup.add(issModel.model);

        var issHitGeo = new THREE.SphereGeometry(hitRadius(SCENE.issSize), 8, 6);
        var issHitMesh = new THREE.Mesh(issHitGeo, new THREE.MeshBasicMaterial({ visible: false }));
        issGroup.add(issHitMesh);

        group.add(issGroup);

        R.issBody = {
          id: ISS.id, data: ISS, group: issGroup, mesh: issModel.model, hit: issHitMesh,
          mats: issModel.mats,
          size: SCENE.issSize, orbitRadius: issOr,
          startAngle: Math.random() * Math.PI * 2,
          orbitDays: ISS.orbitDays, prevCount: 0
        };
      }

      var planetSats = SATELLITES[p.id];
      if (planetSats) {
        R.satBodies = R.satBodies || [];
        planetSats.forEach(function (sat) {
          var satCfg = SCENE.sats[sat.id];
          if (!satCfg) return;

          var satOrbitPts = [];
          for (var so = 0; so <= 48; so++) {
            var sba = (so / 48) * Math.PI * 2;
            satOrbitPts.push(new THREE.Vector3(Math.cos(sba) * satCfg.orbit, -0.01, Math.sin(sba) * satCfg.orbit));
          }
          group.add(new THREE.LineLoop(
            new THREE.BufferGeometry().setFromPoints(satOrbitPts),
            new THREE.LineBasicMaterial({ color: 0x6A6090, transparent: true, opacity: 0.28, depthTest: true })
          ));

          var satGroup = new THREE.Group();
          satGroup.position.set(satCfg.orbit, 0, 0);
          var satGeo = new THREE.SphereGeometry(satCfg.size, 16, 12);
          var satMat = new THREE.MeshLambertMaterial({ color: sat.color });
          var satMesh = new THREE.Mesh(satGeo, satMat);
          satGroup.add(satMesh);

          var satHitR = hitRadius(satCfg.size);
          if (sat.id === "moon") satHitR = satHitR * 0.55;
          var satHitGeo = new THREE.SphereGeometry(satHitR, 8, 6);
          var satHitMesh = new THREE.Mesh(satHitGeo, new THREE.MeshBasicMaterial({ visible: false }));
          satGroup.add(satHitMesh);

          group.add(satGroup);

          R.satBodies.push({
            id: sat.id, data: sat, group: satGroup, mesh: satMesh, hit: satHitMesh,
            size: satCfg.size, orbitRadius: satCfg.orbit,
            startAngle: Math.random() * Math.PI * 2,
            orbitDays: sat.orbitDays, prevCount: 0
          });
        });
      }

      R.scene.add(group);
      R.bodies.push({
        id: p.id, data: p, group: group, mesh: mesh, hit: hitMesh, ring: ringMesh,
        startAngle: sa, orbitRadius: or, size: sz, yearDays: p.yearDays,
        dayHours: p.dayHours, prevCount: 0
      });
    });

    /* Raycaster */
    R.raycaster = new THREE.Raycaster();

    /* Pluto (dwarf planet) */
    var plutoOrbit = SCENE.plutoOrbit;
    var plutoSize = SCENE.plutoSize;
    var plutoOrbitPts = [];
    for (var poi = 0; poi <= 64; poi++) {
      var pa = (poi / 64) * Math.PI * 2;
      plutoOrbitPts.push(new THREE.Vector3(Math.cos(pa) * plutoOrbit, 0, Math.sin(pa) * plutoOrbit));
    }
    R.scene.add(new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(plutoOrbitPts),
      new THREE.LineBasicMaterial({ color: 0x4A4090, transparent: true, opacity: 0.5 })
    ));

    var plutoGroup = new THREE.Group();
    var plutoSA = 4.7;
    plutoGroup.position.set(Math.cos(plutoSA) * plutoOrbit, 0, Math.sin(plutoSA) * plutoOrbit);
    var plutoGeo = new THREE.SphereGeometry(plutoSize, 24, 18);
    var plutoMat = new THREE.MeshLambertMaterial({ color: PLUTO.color, transparent: true, opacity: 1 });
    var plutoMesh = new THREE.Mesh(plutoGeo, plutoMat);
    plutoGroup.add(plutoMesh);

    new THREE.TextureLoader().load(
      "assets/solar/tex/pluto.png",
      function (tex) {
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        var litMat = plutoMesh.material;
        plutoMesh.material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 1 });
        litMat.dispose();
      },
      undefined,
      function () {}
    );

    var plutoHitGeo = new THREE.SphereGeometry(hitRadius(plutoSize), 12, 8);
    var plutoHitMesh = new THREE.Mesh(plutoHitGeo, new THREE.MeshBasicMaterial({ visible: false }));
    plutoGroup.add(plutoHitMesh);

    R.scene.add(plutoGroup);

    R.plutoBody = {
      id: PLUTO.id, data: PLUTO, group: plutoGroup, mesh: plutoMesh, hit: plutoHitMesh,
      size: plutoSize, orbitRadius: plutoOrbit, yearDays: PLUTO.yearDays,
      startAngle: plutoSA, prevCount: 0
    };

    /* Asteroid belt */
    var beltCount = 300;
    var beltGeo = new THREE.BufferGeometry();
    var beltPositions = new Float32Array(beltCount * 3);
    for (var bi = 0; bi < beltCount; bi++) {
      var bAngle = Math.random() * Math.PI * 2;
      var bRad = SCENE.beltInner + Math.random() * (SCENE.beltOuter - SCENE.beltInner);
      var bY = (Math.random() - 0.5) * 0.6;
      beltPositions[bi * 3] = Math.cos(bAngle) * bRad;
      beltPositions[bi * 3 + 1] = bY;
      beltPositions[bi * 3 + 2] = Math.sin(bAngle) * bRad;
    }
    beltGeo.setAttribute("position", new THREE.BufferAttribute(beltPositions, 3));
    var beltMat = new THREE.PointsMaterial({
      size: 0.12, sizeAttenuation: true, color: 0x8B7355, transparent: true, opacity: 0.55, depthWrite: false
    });
    R.scene.add(new THREE.Points(beltGeo, beltMat));

    /* Milky Way backdrop sphere (visible only in Galaxy mode) */
    var mwBackdrop = new THREE.Mesh(
      new THREE.SphereGeometry(64, 32, 24),
      new THREE.MeshBasicMaterial({ color: 0x191340, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false })
    );
    mwBackdrop.renderOrder = 1;
    mwBackdrop.visible = true;
    R.mwBackdrop = mwBackdrop;
    R.scene.add(mwBackdrop);

    var mwTexLoader = new THREE.TextureLoader();
    mwTexLoader.load(
      "assets/solar/milkyway-sky.jpg",
      function (tex) {
        tex.colorSpace = THREE.SRGBColorSpace;
        mwBackdrop.material.map = tex;
        mwBackdrop.material.color.set(0xffffff);
        mwBackdrop.material.needsUpdate = true;
      },
      undefined,
      function () {}
    );

    /* ====== DOM UI ====== */
    R.uiRoot = document.createElement("div");
    R.uiRoot.className = "solar-ui";
    R.uiRoot.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:1";
    mount.appendChild(R.uiRoot);

    R.styleNode = document.createElement("style");
    R.styleNode.id = "solar-style";
    R.styleNode.textContent = SOLAR_CSS;
    document.head.appendChild(R.styleNode);

    /* ---- Mode bar ---- */
    var modeBar = document.createElement("div");
    modeBar.className = "modebar";
    modeBar.innerHTML =
      '<button class="chip on" data-mode="explore">Explore \u63a2\u7d22</button>' +
      '<button class="chip" data-mode="quiz">Quiz \u6e2c\u9a57</button>' +
      '<button class="chip" data-mode="galaxy">Galaxy \u9280\u6cb3</button>';
    modeBar.querySelectorAll(".chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        setMode(chip.dataset.mode);
      });
    });
    R.uiRoot.appendChild(modeBar);
    R.modeBar = modeBar;

    /* ---- Info card (hidden initially) ---- */
    var ic = document.createElement("div");
    ic.className = "infocard hidden";
    ic.innerHTML =
      '<button class="ic-close" id="icclose">\u2715</button>' +
      '<div class="ic-photo" id="icphoto"><img id="icimg" alt=""></div>' +
      '<div class="ic-class" id="icclass"></div>' +
      '<h2 class="card-name" id="icname"></h2>' +
      '<p class="ic-desc" id="icdesc"></p>' +
      '<p class="ic-desc-tz" id="icdesctz"></p>' +
      '<div class="ic-factbox">' +
      '<div class="fb-head">\u2726 DID YOU KNOW \u00b7 \u4f60\u77e5\u9053\u55ce <button id="icshuffle">\ud83d\udd00</button></div>' +
      '<div class="fb-en" id="icfact"></div>' +
      '<div class="fb-tz" id="icfacttz"></div></div>' +
      '<div class="ic-grid" id="icgrid"></div>' +
      '<button class="btn ic-voice" id="icvoice">\ud83d\udd0a Listen \u807d\u4e00\u807d</button>';
    R.uiRoot.appendChild(ic);
    R.infocard = ic;

    ic.querySelector("#icclose").addEventListener("click", closeCard);
    ic.querySelector("#icshuffle").addEventListener("click", function (e) { e.stopPropagation(); shuffleFact(); });
    ic.querySelector("#icvoice").addEventListener("click", function () {
      if (R.focusCardId) {
        var bd = findBody(R.focusCardId);
        if (bd) {
          var pair = bodyNamePair(bd.data);
          ctx.sayPair(pair[0], pair[1]);
        }
      }
    });

    /* ---- Time band ---- */
    var band = document.createElement("div");
    band.className = "timeband";
    band.innerHTML =
      '<div class="counter1" id="sol-day">Day <b>0</b> \u00b7 \u7b2c <b>0</b> \u5929</div>' +
      '<div class="speeds" id="sol-speeds"></div>' +
      '<div class="counter2" id="sol-years"></div>';
    R.uiRoot.appendChild(band);
    R.band = band;

    var speedsEl = band.querySelector("#sol-speeds");
    SPEEDS.forEach(function (step) {
      var chip = document.createElement("button");
      chip.className = "chip" + (step.id === R.speedId ? " on" : "");
      chip.textContent = speedDockLabel(step);
      chip.title = step.en + " \u00b7 " + step.tz;
      chip.setAttribute("aria-label", step.en + " " + step.tz);
      chip.addEventListener("click", function () {
        R.speedId = step.id;
        if (R.ctx.settings) R.ctx.settings.speed = step.id;
        speedsEl.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("on"); });
        chip.classList.add("on");
      });
      speedsEl.appendChild(chip);
    });

    /* ---- Quiz banner (hidden initially) ---- */
    var qb = document.createElement("div");
    qb.className = "quizbanner hidden";
    qb.innerHTML =
      '<div class="q-round" id="qround">1 / 8</div>' +
      '<div class="q-mid"><div class="q-en" id="qen"></div><div class="q-tz" id="qtz"></div></div>' +
      '<div class="q-stars" id="qstars">\u2605 0</div>' +
      '<button class="q-voice" id="qvoice">\ud83d\udd0a</button>' +
      '<div class="q-try hidden" id="qtry">Try again! \u518d\u8a66\u4e00\u6b21!</div>';
    R.uiRoot.appendChild(qb);
    R.quizBanner = qb;
    qb.querySelector("#qvoice").addEventListener("click", function () {
      if (R.quiz) ctx.sayPair(R.quiz.promptEn, R.quiz.promptTz);
    });

    /* ---- End card (hidden initially) ---- */
    var ec = document.createElement("div");
    ec.className = "endcard hidden";
    ec.innerHTML =
      '<div class="card">' +
      '<div class="big"><b>\u2605</b> <span id="endstars">0</span> / 8</div>' +
      '<p>Well done, space explorer!<br>\u505a\u5f97\u597d,\u5c0f\u5c0f\u592a\u7a7a\u4eba!</p>' +
      '<div class="row">' +
      '<button class="btn gold" id="ecAgain">Again \u518d\u4e00\u6b21</button>' +
      '<button class="btn" id="ecExplore">Explore \u63a2\u7d22</button></div></div>';
    R.uiRoot.appendChild(ec);
    R.endCard = ec;
    ec.querySelector("#ecAgain").addEventListener("click", startQuiz);
    ec.querySelector("#ecExplore").addEventListener("click", function () { setMode("explore"); });

    /* ====== Mode switching ====== */
    function setMode(mode) {
      if (mode !== "galaxy" && R.isGalaxyView) {
        leaveGalaxyView(0.6);
      }
      R.mode = mode;
      R.modeBar.querySelectorAll(".chip").forEach(function (c) {
        c.classList.toggle("on", c.dataset.mode === mode);
      });
      if (mode === "quiz") {
        closeCard();
        R.endCard.classList.add("hidden");
        startQuiz();
      } else if (mode === "galaxy") {
        R.quizBanner.classList.add("hidden");
        R.endCard.classList.add("hidden");
        R.quiz = null;
        goGalaxyView(1.5);
      } else {
        R.quizBanner.classList.add("hidden");
        R.endCard.classList.add("hidden");
        R.quiz = null;
      }
    }

    function startQuiz() {
      R.quizStars = 0;
      R.quizMission = buildMission(PLANETS, Math.random);
      R.quizIndex = 0;
      R.quizAttempts = 0;
      updateQuizBanner();
      R.endCard.classList.add("hidden");
    }

    function updateQuizBanner() {
      if (!R.quizMission || R.quizIndex >= R.quizMission.length) {
        finishQuiz();
        return;
      }
      R.quiz = R.quizMission[R.quizIndex];
      R.quizAttempts = 0;
      R.quizBanner.classList.remove("hidden", "shake");
      document.getElementById("qround").textContent = (R.quizIndex + 1) + " / 8";
      document.getElementById("qen").textContent = R.quiz.promptEn;
      document.getElementById("qtz").textContent = R.quiz.promptTz;
      document.getElementById("qstars").textContent = "\u2605 " + R.quizStars;
      document.getElementById("qtry").classList.add("hidden");
      ctx.sayPair(R.quiz.promptEn, R.quiz.promptTz);
    }

    function finishQuiz() {
      var stars = R.quizStars;
      R.quiz = null;
      R.quizMission = null;
      document.getElementById("endstars").textContent = stars;
      R.endCard.classList.remove("hidden");
      R.quizBanner.classList.add("hidden");
      ctx.finish({ score: stars, stars: stars });
    }

    function gradeTap(bodyId) {
      if (!R.quiz) return;
      var result = grade(R.quiz, bodyId, R.quizAttempts);
      if (result.correct) {
        if (result.star) R.quizStars++;
        document.getElementById("qstars").textContent = "\u2605 " + R.quizStars;
        ctx.sfx.good();
        burstStar(R.quiz.targetId);
        R.quizIndex++;
        setTimeout(function () { updateQuizBanner(); }, 600);
      } else {
        R.quizAttempts++;
        ctx.sfx.bad();
        R.quizBanner.classList.remove("shake");
        void R.quizBanner.offsetWidth;
        R.quizBanner.classList.add("shake");
        document.getElementById("qtry").classList.remove("hidden");
      }
    }

    function burstStar(targetId) {
      var bd = findBody(targetId);
      if (!bd) return;
      var rect = canvas.getBoundingClientRect();
      var pos = new THREE.Vector3();
      bd.group.getWorldPosition(pos);
      var s = pos.project(R.camera);
      var sx = ((s.x + 1) / 2) * rect.width + rect.left;
      var sy = (-(s.y - 1) / 2) * rect.height + rect.top;
      var el = document.createElement("div");
      el.className = "burst";
      el.textContent = "\u2b50";
      el.style.left = sx + "px";
      el.style.top = sy + "px";
      document.body.appendChild(el);
      setTimeout(function () { el.remove(); }, 700);
    }

    /* ====== Card helpers ====== */
    function findBody(id) {
      if (id === "sun") return { id: "sun", data: SOLAR, group: null, mesh: R.sunMesh, size: SCENE.sunRadius, yearDays: Infinity };
      if (id === "iss" && R.issBody) return R.issBody;
      if (id === "pluto" && R.plutoBody) return R.plutoBody;
      if (id === "milkyway") return { id: MILKYWAY.id, data: MILKYWAY, group: null, mesh: null, size: 1, yearDays: Infinity };
      if (R.satBodies) {
        for (var si = 0; si < R.satBodies.length; si++) {
          if (R.satBodies[si].id === id) return R.satBodies[si];
        }
      }
      if (R.nearStars) {
        for (var ni = 0; ni < R.nearStars.length; ni++) {
          if (R.nearStars[ni].id === id) return R.nearStars[ni];
        }
      }
      for (var i = 0; i < R.bodies.length; i++) {
        if (R.bodies[i].id === id) return R.bodies[i];
      }
      return null;
    }

    function openCard(bodyEntry) {
      var b = bodyEntry.data;
      var bodyId = bodyEntry.id;
      R.focusCardId = bodyId;

      var cEl = R.infocard;
      cEl.classList.remove("hidden");
      cEl.querySelector("#icclass").textContent = b.type.en + " \u00b7 " + b.type.tz;
      cEl.querySelector("#icname").innerHTML = b.name + " <span>" + b.tz + "</span>";
      cEl.querySelector("#icdesc").textContent = b.desc.en;
      cEl.querySelector("#icdesctz").textContent = b.desc.tz;

      var photoEl = cEl.querySelector("#icphoto");
      var imgEl = cEl.querySelector("#icimg");
      photoEl.classList.remove("fallback");
      photoEl.style.background = "#0d0a24";
      imgEl.removeAttribute("src");
      function showFallbackPhoto() {
        imgEl.style.display = "none";
        photoEl.classList.add("fallback");
        var hex = "#" + b.color.toString(16).padStart(6, "0");
        photoEl.style.background = "radial-gradient(circle at 38% 34%, " + shade(hex, 0.35) + ", " + shade(hex, -0.45) + ")";
      }
      imgEl.onerror = showFallbackPhoto;
      if (photoIsVendored(b.photo)) {
        imgEl.style.display = "";
        imgEl.src = b.photo;
      } else {
        showFallbackPhoto();
      }

      var cells = statCells(b);
      var gridHtml = "";
      cells.forEach(function (cell) {
        gridHtml += '<div class="cell"><div class="k">' + cell.kEn + '</div><div class="v">' + cell.v + '</div></div>';
      });
      cEl.querySelector("#icgrid").innerHTML = gridHtml;

      R.factIdx = -1;
      shuffleFact();
      cEl.classList.remove("hidden");
      cEl.scrollTop = 0;
    }

    function shuffleFact() {
      var bd = R.focusCardId ? findBody(R.focusCardId) : null;
      if (!bd) return;
      var idx = factPool(bd.data, R.factIdx);
      if (idx === null) return;
      R.factIdx = idx;
      var fact = bd.data.facts[idx];
      document.getElementById("icfact").textContent = fact.en;
      document.getElementById("icfacttz").textContent = fact.tz;
    }

    function closeCard() {
      if (R.isGalaxyView) {
        leaveGalaxyView(0.6);
        return;
      }
      R.focusCardId = null;
      R.infocard.classList.add("hidden");
      if (R.focus) {
        R.focus = null;
        goHome(0.4);
      }
    }

    /* ====== Focus rig ====== */
    function focusOn(bodyEntry) {
      R.focus = bodyEntry;
      R.controls.minDistance = Math.max(bodyEntry.size * 4, 4);
      R.controls.maxPolarAngle = 1.45;
      R.controls.minPolarAngle = 0.15;
      R.controls.enablePan = true;
      R.focusStart = performance.now();
      R.focusDuration = 1200;
      R.focusPanOffset = new R.THREE.Vector3(0, 0, 0);
      R.lastFocusTarget = null;
      openCard(bodyEntry);
    }

    /* ====== Camera helpers ====== */
    function goGalaxyView(duration) {
      if (!R) return;
      R.focus = null;
      R.focusCardId = null;
      R.infocard.classList.add("hidden");
      R.isGalaxyView = true;

      R.mwBackdrop.material.opacity = 0;
      R.mwBackdrop.visible = true;

      var t0 = performance.now();
      var startTarget = R.controls.target.clone();
      var endTarget = new R.THREE.Vector3(0, 0, 0);
      var startDist = R.camera.position.distanceTo(R.controls.target);
      var endDist = 50;
      var startPolar = R.controls.maxPolarAngle;
      var endPolar = 1.45;
      R.controls.maxDistance = 65;
      R.controls.minDistance = 20;
      R.controls.enablePan = true;

      function anim(now) {
        if (!R || !R.isGalaxyView) return;
        var t = Math.min(1, (now - t0) / (duration * 1000));
        var e = 1 - Math.pow(1 - t, 3);
        R.controls.target.lerpVectors(startTarget, endTarget, e);
        var d = startDist + (endDist - startDist) * e;
        R.camera.position.copy(R.controls.target).add(
          new R.THREE.Vector3(0, 0, 1).applyQuaternion(
            new R.THREE.Quaternion().setFromEuler(new R.THREE.Euler(-0.85, -0.6, 0, "YXZ"))
          ).multiplyScalar(d)
        );
        R.mwBackdrop.material.opacity = Math.min(e * 1.1, 0.75);
        R.controls.maxPolarAngle = startPolar + (endPolar - startPolar) * e;
        if (t < 1) requestAnimationFrame(anim);
        else {
          openCard({ id: "milkyway", data: MILKYWAY, mesh: null, size: 1 });
        }
      }
      requestAnimationFrame(anim);
    }

    function leaveGalaxyView(duration) {
      if (!R) return;
      R.isGalaxyView = false;
      closeCard();

      var t0 = performance.now();
      var startTarget = R.controls.target.clone();
      var endTarget = new R.THREE.Vector3(0, 0, 0);
      var startDist = R.camera.position.distanceTo(R.controls.target);
      var endDist = 36;
      var startOpacity = R.mwBackdrop.material.opacity;

      function anim(now) {
        if (!R || R.isGalaxyView) return;
        var t = Math.min(1, (now - t0) / (duration * 1000));
        var e = 1 - Math.pow(1 - t, 3);
        R.controls.target.lerpVectors(startTarget, endTarget, e);
        var d = startDist + (endDist - startDist) * e;
        R.camera.position.copy(R.controls.target).add(
          new R.THREE.Vector3(0, 0, 1).applyQuaternion(
            new R.THREE.Quaternion().setFromEuler(new R.THREE.Euler(-1.02, -0.85, 0, "YXZ"))
          ).multiplyScalar(d)
        );
        R.mwBackdrop.material.opacity = startOpacity * (1 - e);
        if (t < 1) requestAnimationFrame(anim);
        else {
          R.mwBackdrop.material.opacity = 0;
          R.mwBackdrop.visible = true;
          R.controls.minDistance = 10;
          R.controls.maxDistance = 55;
          R.controls.maxPolarAngle = 1.45;
          R.controls.minPolarAngle = 0.15;
          R.controls.enablePan = false;
        }
      }
      requestAnimationFrame(anim);
    }

    function goHome(duration) {
      if (!R) return;
      var t0 = performance.now();
      var startTarget = R.controls.target.clone();
      var endTarget = new R.THREE.Vector3(0, 0, 0);
      var startDist = R.camera.position.distanceTo(R.controls.target);
      var endDist = 36;

      function anim(now) {
        if (!R || R.focus) return;
        var t = Math.min(1, (now - t0) / (duration * 1000));
        var e = 1 - Math.pow(1 - t, 3);
        R.controls.target.lerpVectors(startTarget, endTarget, e);
        var d = startDist + (endDist - startDist) * e;
        R.camera.position.copy(R.controls.target).add(
          new R.THREE.Vector3(0, 0, 1).applyQuaternion(
            new R.THREE.Quaternion().setFromEuler(new R.THREE.Euler(-1.02, -0.85, 0, "YXZ"))
          ).multiplyScalar(d)
        );
        if (t < 1) requestAnimationFrame(anim);
        else {
          R.controls.minDistance = 10;
          R.controls.maxPolarAngle = 1.45;
          R.controls.minPolarAngle = 0.15;
          R.controls.enablePan = false;
        }
      }
      requestAnimationFrame(anim);
    }

    /* ====== Input ====== */
    var pointerMoved = 0;
    var pointerStartX = 0;
    var pointerStartY = 0;
    var pointerStartTime = 0;

    function onPointerDown(e) {
      if (e.pointerType === "touch" && e.isPrimary === false) return;
      pointerStartX = e.clientX;
      pointerStartY = e.clientY;
      pointerStartTime = performance.now();
      pointerMoved = 0;
    }
    function onPointerMove() { pointerMoved++; }
    function onPointerUp(e) {
      if (e.pointerType === "touch" && e.isPrimary === false) return;
      if (pointerMoved < 10 && performance.now() - pointerStartTime < 350) {
        doTap(e);
      }
    }
    function onDblClick(e) {
      e.preventDefault();
    }

    function doTap(e) {
      if (!R || !R.bodies) return;
      var rect = canvas.getBoundingClientRect();
      var x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      var y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      R.raycaster.setFromCamera(new R.THREE.Vector2(x, y), R.camera);

      /* Check Sun first */
      var sunHit = new THREE.Mesh(new THREE.SphereGeometry(SCENE.sunRadius * 1.5, 12, 8),
        new THREE.MeshBasicMaterial({ visible: false }));
      var isuns = R.raycaster.intersectObject(sunHit, false);
      sunHit.geometry.dispose();
      sunHit.material.dispose();

      if (isuns.length) {
        handleTap("sun");
        return;
      }

      var hitMeshes = R.bodies.map(function (b) { return b.hit; });
      if (R.issBody) hitMeshes.push(R.issBody.hit);
      if (R.plutoBody) hitMeshes.push(R.plutoBody.hit);
      if (R.satBodies) R.satBodies.forEach(function (s) { hitMeshes.push(s.hit); });
      if (R.nearStars) R.nearStars.forEach(function (ns) { hitMeshes.push(ns.hit); });
      var intersections = R.raycaster.intersectObjects(hitMeshes, false);
      if (intersections.length) {
        var obj = intersections[0].object;
        for (var i = 0; i < R.bodies.length; i++) {
          if (R.bodies[i].hit === obj) {
            handleTap(R.bodies[i].id);
            break;
          }
        }
        if (R.issBody && R.issBody.hit === obj) {
          handleTap(R.issBody.id);
        }
        if (R.plutoBody && R.plutoBody.hit === obj) {
          handleTap(R.plutoBody.id);
        }
        if (R.satBodies) {
          for (var sj = 0; sj < R.satBodies.length; sj++) {
            if (R.satBodies[sj].hit === obj) {
              handleTap(R.satBodies[sj].id);
              break;
            }
          }
        }
        if (R.nearStars) {
          for (var nk = 0; nk < R.nearStars.length; nk++) {
            if (R.nearStars[nk].hit === obj) {
              handleTap(R.nearStars[nk].id);
              break;
            }
          }
        }
      }
    }

    function handleTap(bodyId) {
      if (R.mode === "quiz") {
        gradeTap(bodyId);
        return;
      }
      ctx.sfx.pop();
      var bd = findBody(bodyId);
      if (!bd) return;

      if (bodyId === "sun") {
        if (R.focus && R.focus.id === bodyId) {
          return;
        } else {
          var sunPair = bodyNamePair(bd.data);
          ctx.sayPair(sunPair[0], sunPair[1]);
          focusOn(bd);
        }
      } else if (R.focus && R.focus.id === bodyId) {
        return;
      } else if (R.focus) {
        /* Refocus on different body */
        closeCard();
        var refocusPair = bodyNamePair(bd.data);
        ctx.sayPair(refocusPair[0], refocusPair[1]);
        focusOn(bd);
      } else {
        var pair = bodyNamePair(bd.data);
        ctx.sayPair(pair[0], pair[1]);
        focusOn(bd);
      }
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("dblclick", onDblClick);
    R._pointerDown = onPointerDown;
    R._pointerMove = onPointerMove;
    R._pointerUp = onPointerUp;
    R._dblClick = onDblClick;

    /* ====== Resize ====== */
    R.resize = function () {
      var w = Math.max(mount.clientWidth || 640, 1);
      var h = Math.max(mount.clientHeight || 320, 1);
      R.renderer.setSize(w, h, false);
      R.camera.aspect = w / Math.max(h, 1);
      R.camera.updateProjectionMatrix();
    };
    R.ro = new ResizeObserver(function () { R.resize(); });
    R.ro.observe(mount);

    /* ====== Visibility ====== */
    function onVisChange() {
      if (!R) return;
      if (document.hidden) {
        if (R.raf) { cancelAnimationFrame(R.raf); R.raf = null; }
      } else {
        if (R.timer) R.timer.reset();
        R.raf = requestAnimationFrame(tick);
      }
    }
    document.addEventListener("visibilitychange", onVisChange);
    R._visChange = onVisChange;

    /* ====== Counter timer ====== */
    R.counterTimer = setInterval(function () {
      if (!R) return;
      var dayEl = document.getElementById("sol-day");
      var yearsEl = document.getElementById("sol-years");
      if (!dayEl || !yearsEl) return;
      var days = Math.floor(R.totalDays);
      dayEl.innerHTML = "Day <b>" + days.toLocaleString() + "</b>";
      var parts = [];
      R.bodies.forEach(function (b) {
        var oc = orbitCount(R.totalDays, b.yearDays);
        parts.push(b.data.name + " <b>" + oc.count + "</b>y");
        if (oc.count > b.prevCount && b.prevCount >= 0) {
          try { R.ctx.sfx.pop(); } catch (e) {}
        }
        b.prevCount = oc.count;
      });
      if (R.issBody) {
        var issOc = orbitCount(R.totalDays, R.issBody.orbitDays);
        parts.push("ISS <b>" + issOc.count + "</b>o");
      }
      if (R.plutoBody) {
        var plutoOc = orbitCount(R.totalDays, R.plutoBody.yearDays);
        parts.push("Pluto <b>" + plutoOc.count + "</b>y");
      }
      if (R.satBodies) {
        R.satBodies.forEach(function (s) {
          var soc = orbitCount(R.totalDays, s.orbitDays);
          parts.push(s.data.name + " <b>" + soc.count + "</b>o");
        });
      }
      yearsEl.innerHTML = parts.join(" \u00b7 ");
    }, 100);

    /* ====== Main loop ====== */
    R.timer = new THREE.Timer();

    function tick() {
      if (!R) return;
      R.timer.update();
      var dt = Math.min(R.timer.getDelta(), 0.1);

      /* Advance sim */
      var perSec = daysPerSec(R.speedId);
      R.totalDays = advance(R.totalDays, dt * 1000, perSec);

      /* Update planet positions */
      var focusWorldPos = R.focus && R.focus.id === "sun" ? new R.THREE.Vector3(0, 0, 0) : null;
      R.bodies.forEach(function (b) {
        var oc = orbitCount(R.totalDays, b.yearDays);
        var ang = b.startAngle + oc.angle;
        var ox = Math.cos(ang) * b.orbitRadius;
        var oz = Math.sin(ang) * b.orbitRadius;
        b.group.position.set(ox, 0, oz);
        var spinRate = Math.max(0.05, Math.min(0.8, 0.5 * (24 / b.dayHours)));
        b.mesh.rotation.y += spinRate * dt;

        b.mesh.material.opacity = bodyOpacity(b.id, R.focus && R.focus.id);

        if (R.focus && b.id === R.focus.id) {
          focusWorldPos = new R.THREE.Vector3(ox, 0, oz);
        }
      });

      if (R.issBody) {
        var issOc = orbitCount(R.totalDays, R.issBody.orbitDays);
        var issAng = R.issBody.startAngle + issOc.angle;
        R.issBody.group.position.set(
          Math.cos(issAng) * R.issBody.orbitRadius,
          0,
          Math.sin(issAng) * R.issBody.orbitRadius
        );
        R.issBody.mesh.rotation.y += 0.8 * dt;
        var issOpacity = bodyOpacity(R.issBody.id, R.focus && R.focus.id);
        R.issBody.mats.forEach(function (m) { m.opacity = issOpacity; });

        if (R.focus && R.focus.id === "iss") {
          focusWorldPos = new R.THREE.Vector3();
          R.issBody.group.getWorldPosition(focusWorldPos);
        }
      }

      if (R.satBodies) {
        R.satBodies.forEach(function (s) {
          var soc = orbitCount(R.totalDays, s.orbitDays);
          var sang = s.startAngle + soc.angle;
          s.group.position.set(
            Math.cos(sang) * s.orbitRadius,
            0,
            Math.sin(sang) * s.orbitRadius
          );
          s.mesh.rotation.y += 0.15 * dt;
          s.mesh.material.opacity = bodyOpacity(s.id, R.focus && R.focus.id);

          if (R.focus && R.focus.id === s.id) {
            focusWorldPos = new R.THREE.Vector3();
            s.group.getWorldPosition(focusWorldPos);
          }
        });
      }

      if (R.plutoBody) {
        var plutoOc = orbitCount(R.totalDays, R.plutoBody.yearDays);
        var plutoAng = R.plutoBody.startAngle + plutoOc.angle;
        R.plutoBody.group.position.set(
          Math.cos(plutoAng) * R.plutoBody.orbitRadius,
          0,
          Math.sin(plutoAng) * R.plutoBody.orbitRadius
        );
        R.plutoBody.mesh.rotation.y += Math.max(0.05, 0.5 * (24 / 153)) * dt;
        R.plutoBody.mesh.material.opacity = bodyOpacity(R.plutoBody.id, R.focus && R.focus.id);

        if (R.focus && R.focus.id === "pluto") {
          focusWorldPos = new R.THREE.Vector3(R.plutoBody.group.position.x, 0, R.plutoBody.group.position.z);
        }
      }

      R.controls.update();

      /* Focus rig */
      if (R.focus && focusWorldPos) {
        if (R.lastFocusTarget) {
          R.focusPanOffset.add(R.controls.target.clone().sub(R.lastFocusTarget));
          var panLimit = focusPanLimit(R.focus.id, R.focus.size);
          if (R.focusPanOffset.length() > panLimit) R.focusPanOffset.setLength(panLimit);
        }
        var desiredTarget = focusWorldPos.clone().add(R.focusPanOffset);
        var viewDir = R.camera.position.clone().sub(R.controls.target).normalize();
        R.controls.target.lerp(desiredTarget, 0.07);
        var focusDist = focusDistance(R.focus.id, R.focus.size);
        var curDist = R.camera.position.distanceTo(R.controls.target);
        var targetDist = focusDist;
        var t = Math.min(1, (performance.now() - R.focusStart) / R.focusDuration);
        t = 1 - Math.pow(1 - t, 3);
        R.camera.position.copy(R.controls.target).add(viewDir.multiplyScalar(curDist + (targetDist - curDist) * t));
        R.lastFocusTarget = R.controls.target.clone();
      } else if (!R.focus) {
        R.controls.target.lerp(new R.THREE.Vector3(0, 0, 0), 0.08);
        R.focusPanOffset = null;
        R.lastFocusTarget = null;
      }
      R.renderer.render(R.scene, R.camera);
      R.raf = requestAnimationFrame(tick);
    }

    R.raf = requestAnimationFrame(tick);
  },

  stop: function () {
    if (!R) return;
    if (R.raf) { cancelAnimationFrame(R.raf); R.raf = null; }
    if (R.counterTimer) { clearInterval(R.counterTimer); R.counterTimer = null; }
    if (R._pointerDown) R.renderer.domElement.removeEventListener("pointerdown", R._pointerDown);
    if (R._pointerMove) R.renderer.domElement.removeEventListener("pointermove", R._pointerMove);
    if (R._pointerUp) R.renderer.domElement.removeEventListener("pointerup", R._pointerUp);
    if (R._dblClick) R.renderer.domElement.removeEventListener("dblclick", R._dblClick);
    if (R._visChange) document.removeEventListener("visibilitychange", R._visChange);
    if (R.ro) { R.ro.disconnect(); R.ro = null; }
    if (R.issBody) { R.issBody = null; }
    if (R.plutoBody) { R.plutoBody = null; }
    if (R.satBodies) { R.satBodies = null; }
    if (R.nearStars) { R.nearStars = null; }
    if (R.controls) { R.controls.dispose(); R.controls = null; }
    if (R.styleNode && R.styleNode.parentNode) { R.styleNode.parentNode.removeChild(R.styleNode); R.styleNode = null; }
    if (R.scene) { disposeScene(R.scene); R.scene = null; }
    if (R.renderer) {
      R.renderer.dispose();
      var canvas = R.renderer.domElement;
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      try { R.renderer.forceContextLoss(); } catch (e) {}
      R.renderer = null;
    }
    if (R.uiRoot && R.uiRoot.parentNode) { R.uiRoot.parentNode.removeChild(R.uiRoot); R.uiRoot = null; }
    if (R.timer) { R.timer.dispose(); R.timer = null; }
    R.bodies = null; R.camera = null; R.raycaster = null;
    R.focus = null; R.quiz = null; R.quizMission = null;
    R = null;
  }
};

/* Colour helpers (used by photo fallback) */
function hexToRgb(hex) {
  var n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function shade(hex, amt) {
  var c = hexToRgb(hex);
  var t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  var r = Math.round((t - c.r) * p + c.r);
  var g = Math.round((t - c.g) * p + c.g);
  var b = Math.round((t - c.b) * p + c.b);
  return "rgb(" + r + "," + g + "," + b + ")";
}
