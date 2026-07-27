/* Solar System 3D game — living scene with time-warp (slice 31).
   All text via DOM overlay; all prose in solar-data.js / solar-sim.js.
   Binding specs: tech-spec.md §1–§14, art-direction.md §3–§6. */

import { PLANETS, SOLAR, SCENE } from "./solar-data.js";
import { SPEEDS, daysPerSec, advance, orbitCount } from "./solar-sim.js";

var R = null;
var STAR_TINTS = ["#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFE9C8", "#FFE9C8", "#C9D6FF"];

/* ====== Helpers ====== */

function disposeScene(scene) {
  if (!scene) return;
  scene.traverse(function (child) {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(function (m) { m.dispose(); });
      } else {
        child.material.dispose();
      }
    }
  });
}

export function hitRadius(size) {
  return Math.max(2.5 * size, 0.9);
}

export function angleAt(body, totalDays) {
  return (totalDays / body.yearDays) * Math.PI * 2;
}

export var meta = { icon: "\ud83e\ude90", title: "Solar System", tz: "\u592a\u967d\u7cfb", blurb: "Explore the planets" };

/* ====== Game module ====== */

/* Module-scoped reference for self-referencing settings */
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
    R.bodies = [];

    /* Mount canvas */
    var mount = ctx.mount;
    if (!mount.style.position || mount.style.position === "static") {
      mount.style.position = "relative";
    }

    var canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    mount.appendChild(canvas);

    /* Renderer */
    R.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    R.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    R.renderer.setClearColor(0x191340);
    canvas.width = mount.clientWidth;
    canvas.height = mount.clientHeight;

    /* Camera */
    R.camera = new THREE.PerspectiveCamera(45, canvas.width / Math.max(canvas.height, 1), 0.1, 200);
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
    var sunMesh = new THREE.Mesh(sunGeo, sunMat);
    R.scene.add(sunMesh);

    var glowGeo = new THREE.SphereGeometry(SCENE.sunRadius * 1.35, 32, 24);
    var glowMat = new THREE.MeshBasicMaterial({
      color: 0xFFC93C,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false
    });
    var glowMesh = new THREE.Mesh(glowGeo, glowMat);
    R.scene.add(glowMesh);

    /* Lighting */
    R.scene.add(new THREE.AmbientLight(0xA79FD6, 0.55));
    var pointLight = new THREE.PointLight(0xFFF4D6, 1.1, 0);
    pointLight.position.set(0, 0, 0);
    R.scene.add(pointLight);

    /* Stars */
    var starCount = 1500;
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
      colors[si * 3] = c.r;
      colors[si * 3 + 1] = c.g;
      colors[si * 3 + 2] = c.b;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    var starMat = new THREE.PointsMaterial({
      size: 1.6,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });
    R.stars = new THREE.Points(starGeo, starMat);
    R.scene.add(R.stars);

    /* Orbit rings */
    PLANETS.forEach(function (p) {
      var orbitRadius = SCENE.orbits[p.id];
      var ringPoints = [];
      for (var i = 0; i <= 128; i++) {
        var a = (i / 128) * Math.PI * 2;
        ringPoints.push(new THREE.Vector3(Math.cos(a) * orbitRadius, 0, Math.sin(a) * orbitRadius));
      }
      var ringGeo = new THREE.BufferGeometry().setFromPoints(ringPoints);
      var ringLine = new THREE.LineLoop(
        ringGeo,
        new THREE.LineBasicMaterial({ color: 0x4A4090, transparent: true, opacity: 0.5 })
      );
      R.scene.add(ringLine);
    });

    /* Planets */
    var startAngles = [0.2, 3.5, 1.8, 5.2, 4.1, 2.3, 6.0, 0.8]; // staggered starts
    R.bodies = [];
    PLANETS.forEach(function (p, pi) {
      var group = new THREE.Group();
      var orbitRadius = SCENE.orbits[p.id];
      var size = SCENE.sizes[p.id];
      var startAngle = startAngles[pi] * Math.PI * 2;

      group.position.set(Math.cos(startAngle) * orbitRadius, 0, Math.sin(startAngle) * orbitRadius);

      var mat = new THREE.MeshLambertMaterial({ color: p.color, transparent: true, opacity: 1 });
      var geo = new THREE.SphereGeometry(size, 24, 18);
      var mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);

      /* Hit sphere (inflated, invisible) */
      var hitGeo = new THREE.SphereGeometry(hitRadius(size), 12, 8);
      var hitMat = new THREE.MeshBasicMaterial({ visible: false });
      var hitMesh = new THREE.Mesh(hitGeo, hitMat);
      group.add(hitMesh);

      /* Saturn ring */
      var ringMesh = null;
      if (p.id === "saturn") {
        var ringGeo = new THREE.RingGeometry(size * 1.35, size * 2.05, 64);
        var ringMat = new THREE.MeshBasicMaterial({
          color: 0xE8D9B0,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide
        });
        ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = 0.44;
        group.add(ringMesh);
      }

      /* Uranus axial tilt */
      if (p.id === "uranus") {
        group.rotation.z = 1.71;
      }

      R.scene.add(group);

      var bodyEntry = {
        id: p.id,
        data: p,
        group: group,
        mesh: mesh,
        hit: hitMesh,
        ring: ringMesh,
        startAngle: startAngle,
        orbitRadius: orbitRadius,
        size: size,
        yearDays: p.yearDays,
        dayHours: p.dayHours,
        prevCount: 0
      };
      R.bodies.push(bodyEntry);
    });

    /* Raycaster */
    R.raycaster = new THREE.Raycaster();
    R.tapStartX = 0;
    R.tapStartY = 0;
    R.tapStartTime = 0;
    R.pulseTarget = null;
    R.pulseTime = 0;
    R.pulseBaseScale = 1;

    /* ====== DOM UI ====== */

    R.uiRoot = document.createElement("div");
    R.uiRoot.className = "solar-ui";
    R.uiRoot.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:1";
    mount.appendChild(R.uiRoot);

    /* Style node */
    R.styleNode = document.createElement("style");
    R.styleNode.id = "solar-style";
    R.styleNode.textContent = [
      ".solar-ui * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent }",
      ".solar-ui .chip { font-family:'Fredoka',system-ui,sans-serif; font-weight:600; font-size:16px; ",
      "  border:2px solid #4A4090; background:rgba(25,19,64,.72); backdrop-filter:blur(6px); color:#A79FD6; ",
      "  border-radius:999px; padding:8px 18px; cursor:pointer; pointer-events:auto }",
      ".solar-ui .chip.on { background:#FFC93C; color:#1C1436; border-color:transparent }",
      ".solar-ui .timeband { position:absolute; left:12px; bottom:12px; max-width:min(92vw,600px); ",
      "  background:rgba(51,43,102,.82); backdrop-filter:blur(8px); border:2px solid #4A4090; ",
      "  border-radius:18px; padding:10px 16px; text-align:center; pointer-events:auto }",
      ".solar-ui .counter1 { font-family:'Fredoka',system-ui,sans-serif; font-weight:700; font-size:19px; color:#F3F0FF }",
      ".solar-ui .counter1 b { color:#FFC93C }",
      ".solar-ui .counter2 { margin-top:1px; font-weight:800; font-size:12px; color:#A79FD6 }",
      ".solar-ui .counter2 b { color:#FFC93C }",
      ".solar-ui .speeds { margin-top:8px; display:flex; gap:7px; justify-content:center; flex-wrap:wrap }",
      ".solar-ui .speeds .chip { font-size:13px; padding:5px 12px }"
    ].join("\n");
    document.head.appendChild(R.styleNode);

    /* Time band */
    R.band = document.createElement("div");
    R.band.className = "timeband";
    R.band.innerHTML =
      '<div class="counter1" id="sol-day">Day <b>0</b> \u00b7 \u7b2c <b>0</b> \u5929</div>' +
      '<div class="counter2" id="sol-years"></div>' +
      '<div class="speeds" id="sol-speeds"></div>';
    R.uiRoot.appendChild(R.band);

    var speedsEl = R.band.querySelector("#sol-speeds");
    SPEEDS.forEach(function (step) {
      var chip = document.createElement("button");
      chip.className = "chip" + (step.id === R.speedId ? " on" : "");
      chip.innerHTML = step.en + "<br>" + step.tz;
      chip.addEventListener("click", function () {
        R.speedId = step.id;
        if (R.ctx.settings) R.ctx.settings.speed = step.id;
        speedsEl.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("on"); });
        chip.classList.add("on");
      });
      speedsEl.appendChild(chip);
    });

    /* Counter timer */
    R.counterTimer = setInterval(function () {
      if (!R) return;
      var dayEl = document.getElementById("sol-day");
      var yearsEl = document.getElementById("sol-years");
      if (!dayEl || !yearsEl) return;
      var days = Math.floor(R.totalDays);
      dayEl.innerHTML = "Day <b>" + days.toLocaleString() + "</b> \u00b7 \u7b2c <b>" + days.toLocaleString() + "</b> \u5929";
      var parts = [];
      R.bodies.forEach(function (b) {
        var oc = orbitCount(R.totalDays, b.yearDays);
        parts.push(b.data.name + " <b>" + oc.count + "</b>");
        if (oc.count > b.prevCount && b.prevCount >= 0) {
          try { R.ctx.sfx.pop(); } catch (e) {}
        }
        b.prevCount = oc.count;
      });
      yearsEl.innerHTML = parts.join(" \u00b7 ");
    }, 100);

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

    function onPointerMove(e) {
      if (e.pointerType === "touch" && e.isPrimary === false) return;
      pointerMoved += Math.abs(e.clientX - pointerStartX) + Math.abs(e.clientY - pointerStartY);
    }

    function onPointerUp(e) {
      if (e.pointerType === "touch" && e.isPrimary === false) return;
      var dt = performance.now() - pointerStartTime;
      if (pointerMoved < 10 && dt < 350) {
        doTap(e);
      }
    }

    function onDblClick(e) {
      goHome(0.4);
    }

    function onWheel(e) {
      // OrbitControls handles zoom via wheel; nothing extra needed
    }

    function doTap(e) {
      if (!R || !R.bodies) return;
      var rect = canvas.getBoundingClientRect();
      var x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      var y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      R.raycaster.setFromCamera(new R.THREE.Vector2(x, y), R.camera);
      var hitMeshes = R.bodies.map(function (b) { return b.hit; });
      var intersections = R.raycaster.intersectObjects(hitMeshes, false);
      if (intersections.length) {
        var obj = intersections[0].object;
        for (var i = 0; i < R.bodies.length; i++) {
          if (R.bodies[i].hit === obj) {
            pulsePlanet(R.bodies[i]);
            break;
          }
        }
      }
    }

    function pulsePlanet(body) {
      R.ctx.sfx.pop();
      R.pulseTarget = body;
      R.pulseTime = performance.now();
      R.pulseBaseScale = body.mesh.scale.x;
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("dblclick", onDblClick);
    canvas.addEventListener("wheel", onWheel, { passive: true });

    R._pointerDown = onPointerDown;
    R._pointerMove = onPointerMove;
    R._pointerUp = onPointerUp;
    R._dblClick = onDblClick;
    R._wheel = onWheel;

    /* ====== Resize ====== */
    R.resize = function () {
      var w = mount.clientWidth;
      var h = mount.clientHeight;
      canvas.width = w;
      canvas.height = h;
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
        if (R.clock) R.clock.start();
        R.raf = requestAnimationFrame(tick);
      }
    }
    document.addEventListener("visibilitychange", onVisChange);
    R._visChange = onVisChange;

    /* ====== Home ====== */
    function goHome(duration) {
      if (!R) return;
      var t0 = performance.now();
      var startTarget = R.controls.target.clone();
      var startAz, startPol;
      {
        var p = R.camera.position;
        var r = Math.sqrt(p.x * p.x + p.z * p.z);
        startAz = Math.atan2(p.x, p.z);
        startPol = Math.acos(p.y / p.distanceTo(R.controls.target));
      }
      var startDist = R.camera.position.distanceTo(R.controls.target);
      var endTarget = new R.THREE.Vector3(0, 0, 0);
      var endDist = 36;
      var endAz = 0.85;
      var endPol = 1.02;

      function animHome(now) {
        if (!R) return;
        var t = Math.min(1, (now - t0) / (duration * 1000));
        var e = 1 - Math.pow(1 - t, 3); // ease-out cubic
        R.controls.target.lerpVectors(startTarget, endTarget, e);
        var dist = startDist + (endDist - startDist) * e;
        var az = startAz + (endAz - startAz) * e;
        var pol = startPol + (endPol - startPol) * e;
        var cx = dist * Math.sin(pol) * Math.sin(az);
        var cy = dist * Math.cos(pol);
        var cz = dist * Math.sin(pol) * Math.cos(az);
        R.camera.position.set(cx, cy, cz).add(R.controls.target);
        R.camera.lookAt(R.controls.target);
        if (t < 1) {
          requestAnimationFrame(animHome);
        }
      }
      requestAnimationFrame(animHome);
    }

    /* ====== Main loop ====== */
    R.clock = new THREE.Clock();

    function tick() {
      if (!R) return;
      var dt = Math.min(R.clock.getDelta(), 0.1);

      /* Advance sim */
      var perSec = daysPerSec(R.speedId);
      R.totalDays = advance(R.totalDays, dt * 1000, perSec);

      /* Update planet positions */
      R.bodies.forEach(function (b) {
        var oc = orbitCount(R.totalDays, b.yearDays);
        var ang = b.startAngle + oc.angle;
        var ox = Math.cos(ang) * b.orbitRadius;
        var oz = Math.sin(ang) * b.orbitRadius;
        b.group.position.set(ox, 0, oz);

        /* Axial spin: 0.5 × (24 / dayHours), clamped [0.05, 0.8] */
        var spinRate = Math.max(0.05, Math.min(0.8, 0.5 * (24 / b.dayHours)));
        b.mesh.rotation.y += spinRate * dt;
      });

      /* Pulse animation */
      if (R.pulseTarget) {
        var elapsed = (performance.now() - R.pulseTime) / 1000;
        if (elapsed < 0.25) {
          var s = 1 + 0.15 * Math.sin((elapsed / 0.25) * Math.PI);
          R.pulseTarget.mesh.scale.setScalar(s);
        } else {
          R.pulseTarget.mesh.scale.setScalar(R.pulseBaseScale);
          R.pulseTarget = null;
          R.pulseTime = 0;
        }
      }

      R.controls.update();
      R.renderer.render(R.scene, R.camera);
      R.raf = requestAnimationFrame(tick);
    }

    R.raf = requestAnimationFrame(tick);
  },

  stop: function () {
    if (!R) return;
    if (R.raf) { cancelAnimationFrame(R.raf); R.raf = null; }
    if (R.counterTimer) { clearInterval(R.counterTimer); R.counterTimer = null; }

    if (R._pointerDown) { R.renderer.domElement.removeEventListener("pointerdown", R._pointerDown); }
    if (R._pointerMove) { R.renderer.domElement.removeEventListener("pointermove", R._pointerMove); }
    if (R._pointerUp) { R.renderer.domElement.removeEventListener("pointerup", R._pointerUp); }
    if (R._dblClick) { R.renderer.domElement.removeEventListener("dblclick", R._dblClick); }
    if (R._wheel) { R.renderer.domElement.removeEventListener("wheel", R._wheel); }
    if (R._visChange) { document.removeEventListener("visibilitychange", R._visChange); }

    if (R.ro) { R.ro.disconnect(); R.ro = null; }
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

    R.bodies = null;
    R.camera = null;
    R.clock = null;
    R.raycaster = null;
    R.pulseTarget = null;
    R = null;
  }
};
