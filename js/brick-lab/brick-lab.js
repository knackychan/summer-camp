/* Brick Lab runtime (docs/plans/2026-10-03-brick-lab/). Adapted from the
   v0.1.0 integration kit: Three arrives through three-runtime.js (WebGL1 gets
   the r162 fallback), the host owns Back, every kid-facing string is EN + 中文.
   Slice 05: tools sit on the piece, selection never touches layout, bricks
   have real proportions and studs on a studded baseplate. */
import { loadThree, createRenderer, releaseContext, firstFrame, observeResize } from "../games/three-runtime.js";
import { CATEGORIES, COLORS, COLOR_NAMES, PARTS, getColorHex, getPart } from "./brick-catalog.js";
import { BrickLabStorage } from "./brick-storage.js";

let THREE = null;
let OrbitControls = null;

/* "EN · 中文" for sentences, "EN 中文" for short labels. */
const say = (pair) => `${pair[0]} · ${pair[1]}`;
const label = (pair) => `${pair[0]} ${pair[1]}`;

const HINTS = {
  choose: ["Choose a piece from the tray, or tap a piece to edit it.", "從下面選一塊積木，或點一塊來修改。"],
  place: ["Tap the baseplate to put the piece down.", "點底板，把積木放上去。"],
  placed: ["Placed! Pick another piece, or edit this one.", "放好了！再選一塊，或修改這一塊。"],
  selected: ["Tap it again to turn it, or drag it to move it.", "再點一下可以旋轉，拖著它可以移動。"],
  moveTo: ["Tap the new spot for this piece.", "點一個新位置放這塊積木。"],
  moved: ["Moved! Tap a piece or pick another.", "移好了！點一塊或再選一塊。"],
  removed: ["Piece removed.", "積木拿掉了。"],
  undone: ["Undone.", "復原了。"],
  explore: ["Explore freely. Tap something to edit it.", "自由探索。點任何東西就能修改。"],
  backInBuild: ["Back in Build — edit the piece you tapped.", "回到建造——修改你點的積木。"],
  saved: ["Saved on this tablet", "已儲存在這台平板"],
};

const TAU = Math.PI * 2;
const DEFAULT_COLOR = "red";
const BASEPLATE_GREEN = 0x4b9f4a;

/* Real brick proportions on a 1-unit pitch (D10): stud Ø0.6 × 0.2, a small
   seam between neighbours so stacked bricks show the groove. */
const STUD_R = 0.3;
const STUD_H = 0.2;
const SEAM = 0.02;
/* Diorama scale (slice 06): a 32×32 baseplate seen from further away, so
   bricks read as minifig-scale bricks, not chunky blocks. */
const BASE_HALF = 32;
const SEA_BLUE = 0x2b5d93;
const HOME_TARGET = [5, -8, 7];
const HOME_CAMERA = [54, 62, 70];
const BUILD_MAX_DISTANCE = 128;
/* Saves without this grid version predate D10/D11 and are re-settled on load. */
const GRID_VERSION = 2;
/* Pointer travel (CSS px) that turns a press into a drag. */
const DRAG_START = 10;

function uid(prefix = "piece") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function partLabel(part, preReader) {
  /* Sized parts show "2×4" (the rail already names the category); others their name. */
  return part.size || (preReader ? "" : label(part.label));
}

function cssHex(hex) {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

function isGround(hit) {
  return !!(hit.object && hit.object.userData && hit.object.userData.sqblGround);
}

/* Geometries and materials shared through the runtime's cache (one per part,
   one per colour) are only freed when the whole lab is destroyed. */
const SHARED = new WeakSet();

function disposeTree(root, all = false) {
  root.traverse((child) => {
    if (child.geometry && (all || !SHARED.has(child.geometry))) child.geometry.dispose();
    if (child.material) {
      (Array.isArray(child.material) ? child.material : [child.material]).forEach((m) => {
        if (all || !SHARED.has(m)) m.dispose();
      });
    }
  });
}

function makeKit() {
  const geos = new Map();
  const mats = new Map();
  const keep = (map, key, make) => {
    if (!map.has(key)) {
      const value = make();
      SHARED.add(value);
      map.set(key, value);
    }
    return map.get(key);
  };
  return {
    geo: (key, make) => keep(geos, key, make),
    /* Satin plastic by default: soft lo-fi highlights, not mirror gloss (slice 08). */
    mat: (hex, roughness = 0.45, metalness = 0) => keep(mats, `${hex}:${roughness}:${metalness}`,
      () => new THREE.MeshStandardMaterial({ color: hex, roughness, metalness })),
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      geos.clear();
      mats.clear();
    },
  };
}

/* One geometry from many, so a piece is one draw call (no addons needed). */
function mergeGeometries(list) {
  const flat = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let count = 0;
  flat.forEach((g) => { count += g.attributes.position.count; });
  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  let offset = 0;
  flat.forEach((g) => {
    position.set(g.attributes.position.array, offset);
    normal.set(g.attributes.normal.array, offset);
    offset += g.attributes.position.count * 3;
  });
  new Set(list.concat(flat)).forEach((g) => g.dispose());
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(position, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

function studGeometry(segments = 16) {
  const chamfer = 0.035;
  /* Lathe profiles run bottom → top so the faces point outwards. */
  return new THREE.LatheGeometry([
    new THREE.Vector2(STUD_R, -0.02),
    new THREE.Vector2(STUD_R, STUD_H - chamfer),
    new THREE.Vector2(STUD_R - chamfer, STUD_H),
    new THREE.Vector2(0, STUD_H),
  ], segments);
}

function roundedRectShape(halfW, halfD, radius) {
  const s = new THREE.Shape();
  s.moveTo(-halfW + radius, -halfD);
  s.lineTo(halfW - radius, -halfD);
  s.quadraticCurveTo(halfW, -halfD, halfW, -halfD + radius);
  s.lineTo(halfW, halfD - radius);
  s.quadraticCurveTo(halfW, halfD, halfW - radius, halfD);
  s.lineTo(-halfW + radius, halfD);
  s.quadraticCurveTo(-halfW, halfD, -halfW, halfD - radius);
  s.lineTo(-halfW, -halfD + radius);
  s.quadraticCurveTo(-halfW, -halfD, -halfW + radius, -halfD);
  return s;
}

/* Box centred on the origin with bevelled top and bottom edges. */
function bevelBox(width, height, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(roundedRectShape(width / 2 - bevel, depth / 2 - bevel, 0.03), {
    depth: height - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 2,
  });
  g.translate(0, 0, -(height - bevel * 2) / 2);
  g.rotateX(-Math.PI / 2);
  return g;
}

/* Stud centres along one side: 2 wide → [-0.5, 0.5]. */
const studRow = (count) => Array.from({ length: count }, (_, i) => i - (count - 1) / 2);

function addStuds(list, xs, zs, top) {
  xs.forEach((x) => zs.forEach((z) => {
    const stud = studGeometry();
    stud.translate(x, top, z);
    list.push(stud);
  }));
}

function mesh(geometry, material, shadow = true) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

function makeRectPiece(part, colorHex, kit) {
  const geometry = kit.geo(part.id, () => {
    const list = [bevelBox(part.width - SEAM * 2, part.height, part.depth - SEAM * 2, part.height < 0.5 ? 0.025 : 0.035)];
    if (part.studs) addStuds(list, studRow(part.width), studRow(part.depth), part.height / 2);
    return mergeGeometries(list);
  });
  const group = new THREE.Group();
  group.add(mesh(geometry, kit.mat(colorHex)));
  return group;
}

/* Like the classic 2×2 45° slope: a flat back row with studs, a slanted face
   down to a small front lip. */
function makeSlopePiece(part, colorHex, kit) {
  const geometry = kit.geo(part.id, () => {
    const bevel = 0.03;
    const hd = part.depth / 2 - SEAM - bevel;
    const hh = part.height / 2 - bevel;
    const lip = 0.16;
    /* Outline in (−z, y): rotateY(π/2) below turns shape x into world −z. */
    const shape = new THREE.Shape();
    shape.moveTo(hd, -hh);
    shape.lineTo(-hd, -hh);
    shape.lineTo(-hd, -hh + lip);
    shape.lineTo(0, hh);
    shape.lineTo(hd, hh);
    shape.lineTo(hd, -hh);
    const length = part.width - SEAM * 2 - bevel * 2;
    const body = new THREE.ExtrudeGeometry(shape, {
      depth: length, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2,
    });
    body.translate(0, 0, -length / 2);
    body.rotateY(Math.PI / 2);
    const list = [body];
    addStuds(list, studRow(part.width), [-part.depth / 2 + 0.5], part.height / 2);
    return mergeGeometries(list);
  });
  const group = new THREE.Group();
  group.add(mesh(geometry, kit.mat(colorHex)));
  return group;
}

function makeWheelPiece(part, colorHex, kit) {
  const tire = kit.geo("wheel:tire", () => {
    const g = new THREE.LatheGeometry([
      [0.25, -0.21], [0.4, -0.22], [0.46, -0.15], [0.46, 0.15], [0.4, 0.22], [0.25, 0.21],
    ].map(([r, y]) => new THREE.Vector2(r, y)), 28);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const hub = kit.geo("wheel:hub", () => {
    const g = mergeGeometries([
      new THREE.CylinderGeometry(0.27, 0.27, 0.4, 20),
      new THREE.CylinderGeometry(0.1, 0.1, 0.46, 10),
    ]);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const group = new THREE.Group();
  group.add(mesh(tire, kit.mat(0x1f2328, 0.62)));
  group.add(mesh(hub, kit.mat(colorHex)));
  return group;
}

function makeRailPiece(part, kit) {
  const rails = kit.geo("rail:rails", () => mergeGeometries([-0.62, 0.62].map((x) => {
    const g = new THREE.BoxGeometry(0.12, 0.12, part.depth * 0.96);
    g.translate(x, 0.03, 0);
    return g;
  })));
  const sleepers = kit.geo("rail:sleepers", () => {
    const list = [];
    for (let z = -part.depth / 2 + 0.35; z <= part.depth / 2 - 0.35; z += 0.68) {
      const g = new THREE.BoxGeometry(1.72, 0.1, 0.18);
      g.translate(0, -0.04, z);
      list.push(g);
    }
    return mergeGeometries(list);
  });
  const group = new THREE.Group();
  group.add(mesh(rails, kit.mat(0x8a9097, 0.32, 0.45)));
  group.add(mesh(sleepers, kit.mat(0x6c6e68, 0.4)));
  return group;
}

/* A round brick for a trunk and three stacked cones, like the classic pine. */
function makeTreePiece(part, kit) {
  const trunk = kit.geo("tree:trunk", () => {
    const g = new THREE.CylinderGeometry(0.3, 0.3, 1.2, 16);
    g.translate(0, -part.height / 2 + 0.6, 0);
    return g;
  });
  const crown = kit.geo("tree:crown", () => mergeGeometries([[-0.4, 1.6, 1.0], [0.3, 1.4, 0.82], [1.0, 1.2, 0.6]].map(([y, h, r]) => {
    const g = new THREE.ConeGeometry(r, h, 12);
    g.translate(0, y, 0);
    return g;
  })));
  const group = new THREE.Group();
  group.add(mesh(trunk, kit.mat(0x582a12, 0.32)));
  /* Fixed colours use their own roughness so they never share a palette
     material that recolouring swaps. */
  group.add(mesh(crown, kit.mat(0x237841, 0.3)));
  return group;
}

function makeFlowerPiece(part, colorHex, kit) {
  const stem = kit.geo("flower:stem", () => {
    const g = new THREE.CylinderGeometry(0.05, 0.06, 0.62, 8);
    g.translate(0, -0.14, 0);
    return g;
  });
  const center = kit.geo("flower:center", () => {
    const g = new THREE.SphereGeometry(0.15, 12, 8);
    g.translate(0, 0.27, 0);
    return g;
  });
  const petals = kit.geo("flower:petals", () => mergeGeometries(Array.from({ length: 6 }, (_, i) => {
    const g = new THREE.SphereGeometry(0.12, 10, 6);
    g.scale(1.4, 0.55, 0.8);
    g.rotateY(-i * TAU / 6);
    g.translate(Math.cos(i * TAU / 6) * 0.24, 0.26, Math.sin(i * TAU / 6) * 0.24);
    return g;
  })));
  const group = new THREE.Group();
  group.add(mesh(stem, kit.mat(BASEPLATE_GREEN, 0.4), false));
  group.add(mesh(center, kit.mat(0xf2cd37, 0.3)));
  group.add(mesh(petals, kit.mat(colorHex)));
  return group;
}

function makePieceMesh(part, colorHex, kit) {
  if (part.shape === "wheel") return makeWheelPiece(part, colorHex, kit);
  if (part.shape === "rail") return makeRailPiece(part, kit);
  if (part.shape === "tree") return makeTreePiece(part, kit);
  if (part.shape === "flower") return makeFlowerPiece(part, colorHex, kit);
  if (part.shape === "slope") return makeSlopePiece(part, colorHex, kit);
  return makeRectPiece(part, colorHex, kit);
}

function normalRotation(rotation) {
  return ((Math.round((Number(rotation) || 0) / 90) * 90) % 360 + 360) % 360;
}

function footprint(part, rotation) {
  const quarter = (normalRotation(rotation) / 90) % 2;
  return { w: quarter ? part.depth : part.width, d: quarter ? part.width : part.depth };
}

/* Studs sit on half units, so an odd footprint centres on a half unit and an
   even one on a whole unit (D11); the piece stays on the baseplate. */
function snapAxis(value, size) {
  const centre = size % 2 ? Math.floor(value) + 0.5 : Math.round(value);
  return clamp(centre, -BASE_HALF + size / 2, BASE_HALF - size / 2);
}

function pieceBounds(instance, part) {
  const { w, d } = footprint(part, instance.rotation);
  return {
    minX: instance.x - w / 2,
    maxX: instance.x + w / 2,
    minZ: instance.z - d / 2,
    maxZ: instance.z + d / 2,
    minY: instance.y - part.height / 2,
    maxY: instance.y + part.height / 2,
  };
}

function overlap2D(a, b, pad = 0.04) {
  return a.minX < b.maxX - pad && a.maxX > b.minX + pad && a.minZ < b.maxZ - pad && a.maxZ > b.minZ + pad;
}

/* A small village to start from (slice 06). x/z only; y is just the stacking
   order, settled on load. */
function createStarterPieces() {
  const p = (partId, colorId, x, z, y = 0, rotation = 0) => ({ id: uid(), partId, colorId, x, y, z, rotation });
  /* A 4×4 house at an integer centre: two rings of walls, a door, a gable roof. */
  const house = (cx, cz, wall, roof) => {
    const out = [];
    [0, 1].forEach((y) => {
      out.push(p("brick_1x4", wall, cx - 1.5, cz, y), p("brick_1x4", wall, cx + 1.5, cz, y),
        p("brick_1x2", wall, cx, cz - 1.5, y, 90), p("brick_1x2", y ? "white" : "brown", cx, cz + 1.5, y, 90));
    });
    out.push(p("slope_2x2", roof, cx - 1, cz + 1, 2), p("slope_2x2", roof, cx + 1, cz + 1, 2),
      p("slope_2x2", roof, cx - 1, cz - 1, 2, 180), p("slope_2x2", roof, cx + 1, cz - 1, 2, 180));
    return out;
  };
  return [
    ...house(0, 0, "yellow", "red"), ...house(-9, -6, "white", "blue"), ...house(9, 6, "red", "blue"),
    p("brick_2x2", "blue", 8, -6, 0), p("brick_2x2", "blue", 8, -6, 1), p("brick_2x2", "white", 8, -6, 2),
    p("slope_2x2", "red", 8, -6, 3),
    p("plate_2x4", "tan", 0, 4, 0), p("plate_2x4", "tan", 0, 8, 0), p("plate_2x4", "tan", 0, 12, 0),
    p("tree_small", "green", -6, 4), p("tree_small", "green", -14, 2), p("tree_small", "green", 4, -10),
    p("tree_small", "green", 14, -2), p("tree_small", "green", -4, -14), p("tree_small", "green", 6, 14),
    p("tree_small", "green", -12, 12),
    p("flower", "pink", -3.5, 3.5), p("flower", "yellow", 3.5, 3.5), p("flower", "red", -4.5, -2.5),
    p("flower", "white", 5.5, 9.5), p("flower", "pink", -8.5, -1.5), p("flower", "yellow", 2.5, 12.5),
    p("rail_straight", "darkGray", 18, -6), p("rail_straight", "darkGray", 18, 0), p("rail_straight", "darkGray", 18, 6),
  ];
}

export class BrickLabRuntime {
  constructor(root, options = {}) {
    if (!(root instanceof HTMLElement)) throw new Error("BrickLabRuntime requires a root HTMLElement");
    this.root = root;
    this.options = options;
    this.kidId = String(options.kidId || "local");
    this.preReader = !!options.preReader;
    this.storage = new BrickLabStorage(this.kidId);
    this.mode = "build";
    this.activeCategory = "bricks";
    this.activePartId = "brick_2x4";
    this.activeColorId = DEFAULT_COLOR;
    this.selectedId = null;
    this.moveId = null;
    this.drag = null;
    this.placementArmed = false;
    this.history = [];
    this.pieces = new Map();
    this.sceneObjects = new Map();
    this.pointerDown = null;
    this.saveTimer = null;
    this.destroyed = false;
    this.cameraTween = null;
    this.baseplateStuds = 0;
    this.bubble = { shown: false, x: NaN, y: NaN, width: 0, height: 0 };
  }

  async mount() {
    const runtime = await loadThree(document.createElement("canvas"), true);
    if (this.destroyed) { releaseContext(runtime); return this; }
    this.runtime = runtime;
    THREE = runtime.THREE;
    OrbitControls = runtime.OrbitControls;
    this.kit = makeKit();
    this.renderShell();
    this.setupScene();
    this.bindUI();
    this.loadInitialState();
    this.renderPartTray();
    this.renderColorTray();
    this.updateModeUI();
    this.updateSelectionUI();
    firstFrame(this.renderer, this.scene, this.camera);
    this.startLoop();
    return this;
  }

  renderShell() {
    const pre = this.preReader;
    const categoryButtons = CATEGORIES.map((category) => `
      <button type="button" class="sqbl-category" data-category="${category.id}" aria-label="${escapeHtml(label(category.label))}">
        <span aria-hidden="true">${category.icon}</span><b>${pre ? "" : `${escapeHtml(category.label[0])}<small>${escapeHtml(category.label[1])}</small>`}</b>
      </button>`).join("");
    const tool = (action, icon, pair, extra = "") => `
      <button type="button" data-action="${action}"${extra} aria-label="${escapeHtml(label(pair))}">
        <span class="sqbl-tool-icon" aria-hidden="true">${icon}</span>${pre ? "" : `<span class="sqbl-tool-label">${escapeHtml(pair[0])}<br>${escapeHtml(pair[1])}</span>`}
      </button>`;
    const css = new URL("../../css/brick-lab.css", import.meta.url).href;

    this.root.innerHTML = `
      <link rel="stylesheet" href="${css}">
      <section class="sqbl-app${pre ? " is-pre-reader" : ""}" data-mode="build" aria-label="Brick Lab 積木實驗室">
        <header class="sqbl-topbar">
          <div class="sqbl-brand"><span aria-hidden="true">🧱</span><div><strong>Brick Lab <span lang="zh-TW">積木實驗室</span></strong>${pre ? "" : "<small>Build · Imagine · Explore — 建造 · 想像 · 探索</small>"}</div></div>
          <div class="sqbl-mode-toggle" role="group" aria-label="Mode 模式">
            <button type="button" data-mode-button="build" class="is-active" aria-label="Build 建造">🧱 <span>Build 建造</span></button>
            <button type="button" data-mode-button="explore" aria-label="Explore 探索">🌍 <span>Explore 探索</span></button>
          </div>
          <div class="sqbl-global-actions">
            <button type="button" class="sqbl-icon-btn" data-action="home-view" aria-label="Reset camera 重設視角">⌂</button>
            <button type="button" class="sqbl-icon-btn" data-action="undo" aria-label="Undo 復原" disabled>↶</button>
            <button type="button" class="sqbl-save-btn" data-action="save" aria-label="Save 儲存">💾 <span>Save 儲存</span></button>
          </div>
        </header>

        <div class="sqbl-main">
          <aside class="sqbl-left-rail" aria-label="Pieces 積木種類">
            <button type="button" class="sqbl-rail-collapse" data-action="toggle-left" aria-label="Fold 收起">‹</button>
            <div class="sqbl-category-list">${categoryButtons}</div>
          </aside>

          <div class="sqbl-stage-wrap">
            <div class="sqbl-stage" data-stage></div>
            <div class="sqbl-lens" aria-hidden="true"><i class="sqbl-lens-top"></i><i class="sqbl-lens-bottom"></i></div>
            <div class="sqbl-bubble" data-bubble role="toolbar" aria-label="Tools 工具">
              <div class="sqbl-bubble-card">
                ${tool("move", "✥", ["Move", "移動"])}
                ${tool("rotate", "↻", ["Turn", "旋轉"])}
                ${tool("duplicate", "⧉", ["Copy", "複製"])}
                ${tool("delete", "🗑", ["Remove", "拿掉"], ' class="is-danger"')}
              </div>
            </div>
            <div class="sqbl-stage-hint" data-stage-hint aria-live="polite"></div>
            <div class="sqbl-explore-badge">🌍 ${pre ? "" : "Explore 探索"}</div>
          </div>
        </div>

        <footer class="sqbl-bottom-tray">
          <div class="sqbl-tray-top">
            <div class="sqbl-tray-title" data-tray-title></div>
            <button type="button" class="sqbl-focus-build" data-action="toggle-chrome" aria-label="Bigger build area 放大建造區">↕</button>
          </div>
          <div class="sqbl-parts" data-parts></div>
          <div class="sqbl-colors" data-colors></div>
        </footer>
        <div class="sqbl-toast" data-toast role="status" aria-live="polite"></div>
      </section>`;

    this.app = this.root.querySelector(".sqbl-app");
    this.stage = this.root.querySelector("[data-stage]");
    this.partsEl = this.root.querySelector("[data-parts]");
    this.colorsEl = this.root.querySelector("[data-colors]");
    this.hintEl = this.root.querySelector("[data-stage-hint]");
    this.toastEl = this.root.querySelector("[data-toast]");
    this.bubbleEl = this.root.querySelector("[data-bubble]");
    this.leftRail = this.root.querySelector(".sqbl-left-rail");
    this.bottomTray = this.root.querySelector(".sqbl-bottom-tray");
  }

  setupScene() {
    this.scene = new THREE.Scene();
    /* The island floats in a sea that fades into the background (slice 06). */
    this.scene.background = new THREE.Color(SEA_BLUE);
    this.scene.fog = new THREE.Fog(SEA_BLUE, 180, 440);
    /* A narrower lens flattens perspective: reads as a tabletop diorama. */
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 640);
    this.camera.position.set(...HOME_CAMERA);

    this.renderer = createRenderer(this.runtime, 2);
    this.renderer.shadowMap.enabled = !this.renderer.sqReducedQuality;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    /* Lo-fi miniature look (slice 08): filmic tone curve rolls off the
       highlights and calms the saturated plastic colours. */
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.className = "sqbl-canvas";
    /* Tilt-shift blur is a CSS backdrop filter: only where the GPU has room. */
    this.app.classList.toggle("is-hq", !this.renderer.sqReducedQuality);
    this.renderer.domElement.setAttribute("aria-label", "Brick Lab 3D builder 積木實驗室 3D 建造");
    this.stage.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 4;
    this.controls.maxDistance = BUILD_MAX_DISTANCE;
    this.controls.minPolarAngle = 0.32;
    this.controls.maxPolarAngle = Math.PI / 2.08;
    this.controls.target.set(...HOME_TARGET);
    /* Pan in both modes (slice 07): two fingers on a tablet (they also pinch
       to zoom), right button on a mouse. It slides along the ground, not the
       screen, and the loop keeps the view's centre over the island. */
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = false;
    this.controls.panSpeed = 1.2;

    /* Lo-fi lighting (slice 08): cool sky, warm bounce from the ground, a low
       warm late-afternoon sun with long soft shadows, a faint cool rim. */
    const ambient = new THREE.HemisphereLight(0xc6d8ff, 0xa88a6a, 1.2);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffcf94, 3.3);
    sun.position.set(40, 34, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -BASE_HALF - 4;
    sun.shadow.camera.right = BASE_HALF + 4;
    sun.shadow.camera.top = BASE_HALF + 4;
    sun.shadow.camera.bottom = -BASE_HALF - 4;
    sun.shadow.camera.far = 200;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9fb6ff, 0.65);
    fill.position.set(-10, 7, -8);
    this.scene.add(fill);

    this.addIsland();

    /* Matter than the bricks: a big glossy plate turns into one white glare. */
    const plastic = this.kit.mat(BASEPLATE_GREEN, 0.55);
    const base = mesh(bevelBox(BASE_HALF * 2, 0.42, BASE_HALF * 2, 0.06), plastic, false);
    base.position.y = -0.21;
    base.userData.sqblGround = true;
    this.scene.add(base);
    this.ground = base;
    this.addBaseplateStuds(plastic);

    this.selectionBox = new THREE.Box3();
    this.selectionHelper = new THREE.Box3Helper(this.selectionBox, 0x3c8df6);
    this.selectionHelper.visible = false;
    this.selectionHelper.raycast = () => {};
    this.scene.add(this.selectionHelper);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.dragPoint = new THREE.Vector3();
    this.bubblePoint = new THREE.Vector3();

    this.ghost = new THREE.Group();
    this.ghost.visible = false;
    this.ghost.raycast = () => {};
    this.scene.add(this.ghost);

    this.resizeObserver = observeResize(this.stage, () => this.resize());
    this.resize();
  }

  /* Diorama setting (slice 06): the plate sits on a stepped cliff of grey
     blocks, in a shallow-water halo, in a sea dotted with little waves.
     Instanced, seeded (same island every time), never raycast. */
  addIsland() {
    let seed = 7;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const surface = -0.42;
    const sea = -1.6;
    const core = mesh(bevelBox(BASE_HALF * 2, 1.4, BASE_HALF * 2, 0.1), this.kit.mat(0x8c9096, 0.9), false);
    core.position.y = surface - 0.7;
    this.scene.add(core);

    const cells = [];
    for (let i = 0; i < BASE_HALF * 2; i += 1) {
      const t = -BASE_HALF + 0.5 + i;
      cells.push([t, -BASE_HALF], [t, BASE_HALF], [-BASE_HALF, t], [BASE_HALF, t]);
    }
    const instanced = this.renderer.extensions.has("ANGLE_instanced_arrays") || !this.runtime.legacy;
    if (instanced) {
      const rocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.92 }), cells.length * 2);
      const matrix = new THREE.Matrix4();
      const color = new THREE.Color();
      let n = 0;
      cells.forEach(([x, z]) => {
        /* Two steps of blocks: one hugging the plate, one lower and further out. */
        [[0.25, 0.1], [0.95, -0.55]].forEach(([out, drop]) => {
          const ox = Math.abs(x) === BASE_HALF ? Math.sign(x) * out : 0;
          const oz = Math.abs(z) === BASE_HALF ? Math.sign(z) * out : 0;
          const top = surface + drop - random() * 0.35;
          const height = top - sea + 0.2;
          const w = 0.8 + random() * 0.5;
          matrix.makeScale(w, height, 0.8 + random() * 0.5).setPosition(x + ox, top - height / 2, z + oz);
          rocks.setMatrixAt(n, matrix);
          rocks.setColorAt(n, color.setHex([0x9aa0a6, 0x80868d, 0xb4b8bd, 0x6c7178][Math.floor(random() * 4)]));
          n += 1;
        });
      });
      rocks.instanceMatrix.needsUpdate = true;
      rocks.instanceColor.needsUpdate = true;
      rocks.castShadow = !this.renderer.sqReducedQuality;
      rocks.receiveShadow = true;
      rocks.frustumCulled = false;
      rocks.raycast = () => {};
      this.scene.add(rocks);

      const waves = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 0.06, 0.3), new THREE.MeshBasicMaterial({ color: 0xe8f4ff }), 90);
      for (let i = 0; i < 90; i += 1) {
        const angle = random() * TAU;
        const radius = BASE_HALF * 1.6 + random() * 52;
        matrix.makeRotationY(random() * 0.6 - 0.3).setPosition(Math.cos(angle) * radius, sea + 0.08, Math.sin(angle) * radius);
        waves.setMatrixAt(i, matrix);
      }
      waves.instanceMatrix.needsUpdate = true;
      waves.frustumCulled = false;
      waves.raycast = () => {};
      this.scene.add(waves);
    }

    const shallowShape = roundedRectShape(BASE_HALF + 9, BASE_HALF + 9, 13);
    const water = (geometry, color, y) => {
      const plane = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = y;
      plane.receiveShadow = true;
      this.scene.add(plane);
    };
    water(new THREE.ShapeGeometry(shallowShape, 8), 0x62a6d6, sea + 0.05);
    water(new THREE.CircleGeometry(520, 48), SEA_BLUE, sea);
  }

  /* One instanced mesh for the 32×32 studs: a single draw call. WebGL1 needs
     ANGLE_instanced_arrays (near universal); without it the plate stays smooth. */
  addBaseplateStuds(material) {
    if (this.runtime.legacy && !this.renderer.extensions.has("ANGLE_instanced_arrays")) return;
    const count = BASE_HALF * 2 * BASE_HALF * 2;
    /* 4096 studs: fewer sides on reduced-quality devices, where they are tiny anyway. */
    const studs = new THREE.InstancedMesh(studGeometry(this.renderer.sqReducedQuality ? 6 : 10), material, count);
    const matrix = new THREE.Matrix4();
    let i = 0;
    for (let x = -BASE_HALF + 0.5; x < BASE_HALF; x += 1) {
      for (let z = -BASE_HALF + 0.5; z < BASE_HALF; z += 1) {
        studs.setMatrixAt(i, matrix.makeTranslation(x, 0, z));
        i += 1;
      }
    }
    studs.instanceMatrix.needsUpdate = true;
    studs.receiveShadow = true;
    studs.frustumCulled = false;
    studs.raycast = () => {};
    this.scene.add(studs);
    this.baseplateStuds = count;
  }

  resize() {
    if (this.destroyed || !this.stage || !this.renderer) return;
    const width = Math.max(1, this.stage.clientWidth);
    const height = Math.max(1, this.stage.clientHeight);
    this.stageSize = { width, height };
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.bubble.width = 0;
    /* Resizing clears the drawing buffer; draw now, before the browser
       paints, so a resize never shows a blank frame. */
    if (this.scene) this.renderer.render(this.scene, this.camera);
  }

  bindUI() {
    this.root.querySelectorAll("[data-mode-button]").forEach((button) => {
      button.addEventListener("pointerdown", () => this.setMode(button.dataset.modeButton));
    });

    this.root.querySelectorAll("[data-category]").forEach((button) => {
      button.addEventListener("pointerdown", () => {
        this.activeCategory = button.dataset.category;
        this.activePartId = (PARTS.find((part) => part.category === this.activeCategory) || PARTS[0]).id;
        this.renderPartTray();
        this.updateCategoryUI();
        this.placementArmed = false;
        this.ghost.visible = false;
        this.setHint("🧱", HINTS.choose);
      });
    });

    this.root.querySelector("[data-action=save]").addEventListener("pointerdown", () => this.saveNow(true));
    this.root.querySelector("[data-action=undo]").addEventListener("pointerdown", () => this.undo());
    this.root.querySelector("[data-action=home-view]").addEventListener("pointerdown", () => this.homeView());
    this.root.querySelector("[data-action=rotate]").addEventListener("pointerdown", () => this.rotateSelected());
    this.root.querySelector("[data-action=duplicate]").addEventListener("pointerdown", () => this.duplicateSelected());
    this.root.querySelector("[data-action=delete]").addEventListener("pointerdown", () => this.deleteSelected());
    this.root.querySelector("[data-action=move]").addEventListener("pointerdown", () => this.beginMoveSelected());
    this.root.querySelector("[data-action=toggle-left]").addEventListener("pointerdown", () => this.leftRail.classList.toggle("is-collapsed"));
    this.root.querySelector("[data-action=toggle-chrome]").addEventListener("pointerdown", () => this.app.classList.toggle("is-build-focus"));

    /* Capture phase on the stage runs before OrbitControls' own listener on
       the canvas, so a press on the selected piece can suspend orbiting. */
    this.stage.addEventListener("pointerdown", (event) => this.onDragStart(event), true);

    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", (event) => {
      this.pointerDown = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    });
    canvas.addEventListener("pointermove", (event) => this.onPointerMove(event));
    canvas.addEventListener("pointerup", (event) => {
      if (this.onDragEnd(event, false)) { this.pointerDown = null; return; }
      if (this.drag) return; /* a second finger during a drag is not a tap */
      if (!this.pointerDown) return;
      const dx = event.clientX - this.pointerDown.x;
      const dy = event.clientY - this.pointerDown.y;
      const travel = Math.hypot(dx, dy);
      const duration = event.timeStamp - this.pointerDown.time;
      this.pointerDown = null;
      if (travel < DRAG_START && duration < 550) this.onTap(event);
    });
    canvas.addEventListener("pointercancel", (event) => {
      this.onDragEnd(event, true);
      this.pointerDown = null;
    });
  }

  updateCategoryUI() {
    this.root.querySelectorAll("[data-category]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.category === this.activeCategory);
    });
    const category = CATEGORIES.find((item) => item.id === this.activeCategory);
    const title = this.root.querySelector("[data-tray-title]");
    if (title) title.textContent = this.preReader ? (category && category.icon) || "🧱" : label((category && category.label) || ["Pieces", "積木"]);
  }

  renderPartTray() {
    const parts = PARTS.filter((part) => part.category === this.activeCategory);
    this.partsEl.innerHTML = parts.map((part) => `
      <button type="button" class="sqbl-part${part.id === this.activePartId ? " is-active" : ""}" data-part="${part.id}" aria-label="${escapeHtml(label(part.label))}">
        <span class="sqbl-part-preview" data-shape="${part.shape}" aria-hidden="true"></span>
        <b>${escapeHtml(partLabel(part, this.preReader))}</b>
      </button>`).join("");
    this.partsEl.querySelectorAll("[data-part]").forEach((button) => {
      button.addEventListener("click", () => {
        this.activePartId = button.dataset.part;
        this.partsEl.querySelectorAll("[data-part]").forEach((item) => item.classList.toggle("is-active", item === button));
        this.armPlacement(this.activePartId);
      });
    });
    this.updateCategoryUI();
  }

  /* Built once; selection only moves the is-active class (D9). */
  renderColorTray() {
    this.colorsEl.innerHTML = Object.keys(COLORS).map((colorId) => `
      <button type="button" class="sqbl-color" data-color="${colorId}" aria-label="${escapeHtml(label(COLOR_NAMES[colorId]))}" style="--sqbl-swatch:${cssHex(getColorHex(colorId))}"></button>`).join("");
    this.colorsEl.querySelectorAll("[data-color]").forEach((button) => {
      button.addEventListener("click", () => {
        this.setActiveColor(button.dataset.color);
        if (this.selectedId) this.recolorSelected(this.activeColorId);
        else this.refreshGhost();
      });
    });
    this.setActiveColor(this.activeColorId, true);
  }

  setActiveColor(colorId, force = false) {
    if (colorId === this.activeColorId && !force) return;
    this.activeColorId = colorId;
    this.colorsEl.querySelectorAll("[data-color]").forEach((item) => item.classList.toggle("is-active", item.dataset.color === colorId));
    this.app.style.setProperty("--sqbl-piece", cssHex(getColorHex(colorId)));
  }

  loadInitialState() {
    const saved = this.storage.load();
    const fresh = !(saved && saved.pieces.length);
    const source = fresh ? (this.options.seedDemo === false ? [] : createStarterPieces()) : saved.pieces;
    const pieces = fresh || saved.grid !== GRID_VERSION ? this.settle(source) : source;
    pieces.forEach((instance) => this.addPiece(instance, false));
    if (pieces.length && (fresh || saved.grid !== GRID_VERSION)) this.scheduleSave();
    this.homeView(false);
    this.placementArmed = false;
    this.setHint("🧱", HINTS.choose);
  }

  /* Snap x/z to the stud grid and stack bottom-up with today's heights (D11):
     a build saved before slice 05 keeps its shape instead of floating. */
  settle(list) {
    const settled = new Map();
    return list.slice().sort((a, b) => (Number(a.y) || 0) - (Number(b.y) || 0)).map((raw) => {
      const part = getPart(raw.partId);
      const rotation = normalRotation(raw.rotation);
      const piece = { ...raw, id: String(raw.id || uid()), partId: part.id, rotation };
      Object.assign(piece, this.placementFor({ x: Number(raw.x) || 0, z: Number(raw.z) || 0 }, part, rotation, null, settled));
      settled.set(piece.id, piece);
      return piece;
    });
  }

  addPiece(instance, persist = true) {
    if (persist) this.recordHistory();
    const clean = {
      id: String(instance.id || uid()),
      partId: getPart(instance.partId).id,
      colorId: COLORS[instance.colorId] !== undefined ? instance.colorId : DEFAULT_COLOR,
      x: Number(instance.x) || 0,
      y: Number(instance.y) || getPart(instance.partId).height / 2,
      z: Number(instance.z) || 0,
      rotation: normalRotation(instance.rotation),
    };
    const part = getPart(clean.partId);
    const object = makePieceMesh(part, getColorHex(clean.colorId), this.kit);
    object.position.set(clean.x, clean.y, clean.z);
    object.rotation.y = clean.rotation * Math.PI / 180;
    object.userData.sqblPieceId = clean.id;
    object.userData.sqblPieceRoot = true;
    object.traverse((child) => {
      if (child.isMesh) child.userData.sqblPieceId = clean.id;
    });
    this.scene.add(object);
    this.pieces.set(clean.id, clean);
    this.sceneObjects.set(clean.id, object);
    if (persist) this.scheduleSave();
    return clean.id;
  }

  removePiece(id, persist = true) {
    if (persist) this.recordHistory();
    const object = this.sceneObjects.get(id);
    if (object) {
      this.scene.remove(object);
      disposeTree(object);
    }
    this.sceneObjects.delete(id);
    this.pieces.delete(id);
    if (this.selectedId === id) this.selectPiece(null);
    if (persist) this.scheduleSave();
  }

  armPlacement(partId) {
    if (this.mode !== "build") return;
    this.activePartId = getPart(partId).id;
    this.moveId = null;
    this.placementArmed = true;
    this.refreshGhost();
    this.setHint("☝️", HINTS.place);
  }

  refreshGhost() {
    while (this.ghost.children.length) {
      const child = this.ghost.children.pop();
      disposeTree(child);
    }
    const part = getPart(this.activePartId);
    const preview = makePieceMesh(part, getColorHex(this.activeColorId), this.kit);
    preview.traverse((node) => {
      if (!node.material) return;
      /* The cached material is shared by real pieces: the ghost gets its own. */
      node.material = node.material.clone();
      node.material.transparent = true;
      node.material.opacity = 0.48;
      node.material.depthWrite = false;
    });
    this.ghost.add(preview);
    this.ghost.visible = false;
  }

  setRay(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  pointFromEvent(event) {
    this.setRay(event);
    /* Pieces added or moved since the last frame (Undo, a drop) must be hit
       where they are now, not where the last render left their matrices. */
    this.scene.updateMatrixWorld();
    return this.raycaster.intersectObjects(this.scene.children, true);
  }

  getPieceIdFromIntersection(hit) {
    let object = hit && hit.object;
    while (object) {
      if (object.userData && object.userData.sqblPieceId) return object.userData.sqblPieceId;
      object = object.parent;
    }
    return null;
  }

  /* Where a piece lands when dropped at a point: snapped to the stud grid,
     resting on whatever it overlaps in `pool`. */
  placementFor(point, part, rotation = 0, ignoreId = null, pool = this.pieces) {
    const { w, d } = footprint(part, rotation);
    const x = snapAxis(point.x, w);
    const z = snapAxis(point.z, d);
    /* Rails sit on the baseplate studs; trees and flowers plug in at ground level. */
    if (part.shape === "rail") return { x, y: STUD_H + part.height / 2, z };
    if (part.shape === "tree" || part.shape === "flower") return { x, y: part.height / 2, z };
    const probe = pieceBounds({ x, y: 0, z, rotation }, part);
    let top = 0;
    for (const [id, instance] of pool) {
      if (id === ignoreId) continue;
      const otherPart = getPart(instance.partId);
      if (otherPart.shape === "wheel" || otherPart.shape === "tree" || otherPart.shape === "flower") continue;
      const other = pieceBounds(instance, otherPart);
      if (overlap2D(probe, other)) top = Math.max(top, other.maxY);
    }
    return { x, y: Math.round((top + part.height / 2) * 1000) / 1000, z };
  }

  onPointerMove(event) {
    if (this.drag) { this.onDragMove(event); return; }
    if (this.mode !== "build" || !this.ghost || (!this.placementArmed && !this.moveId)) return;
    if (event.buttons) return;
    const hits = this.pointFromEvent(event);
    const groundHit = hits.find((hit) => isGround(hit)) || hits.find((hit) => this.getPieceIdFromIntersection(hit));
    if (!groundHit) {
      this.ghost.visible = false;
      return;
    }
    const instance = this.moveId && this.pieces.get(this.moveId);
    const part = getPart(instance ? instance.partId : this.activePartId);
    const pos = this.placementFor(groundHit.point, part, instance ? instance.rotation : 0, this.moveId);
    this.ghost.position.set(pos.x, pos.y, pos.z);
    this.ghost.visible = true;
  }

  /* Press on the selected piece: orbit is suspended until the finger lifts.
     Lifting without travel is a tap (turn); travelling drags the piece (D8). */
  onDragStart(event) {
    if (this.mode !== "build" || !this.selectedId || this.moveId || this.placementArmed || this.drag) return;
    if (event.isPrimary === false || event.button > 0) return;
    const pieceHit = this.pointFromEvent(event).find((hit) => this.getPieceIdFromIntersection(hit));
    if (!pieceHit || this.getPieceIdFromIntersection(pieceHit) !== this.selectedId) return;
    const instance = this.pieces.get(this.selectedId);
    const part = getPart(instance.partId);
    /* Drag on the plane of the piece's base, keeping where the finger grabbed it. */
    this.dragPlane.constant = -(instance.y - part.height / 2);
    const grab = this.raycaster.ray.intersectPlane(this.dragPlane, this.dragPoint);
    this.drag = {
      id: this.selectedId,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      active: false,
      offsetX: grab ? grab.x - instance.x : 0,
      offsetZ: grab ? grab.z - instance.z : 0,
      pos: null,
    };
    this.controls.enabled = false;
    /* Capture so the lift is seen even off the canvas: orbit must come back. */
    try { this.renderer.domElement.setPointerCapture(event.pointerId); } catch {}
  }

  onDragMove(event) {
    const drag = this.drag;
    if (event.pointerId !== drag.pointerId) return;
    if (!drag.active) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < DRAG_START) return;
      drag.active = true;
      this.updateSelectionUI();
    }
    this.setRay(event);
    const point = this.raycaster.ray.intersectPlane(this.dragPlane, this.dragPoint);
    if (!point) return;
    const instance = this.pieces.get(drag.id);
    const pos = this.placementFor({ x: point.x - drag.offsetX, z: point.z - drag.offsetZ },
      getPart(instance.partId), instance.rotation, drag.id);
    this.sceneObjects.get(drag.id).position.set(pos.x, pos.y, pos.z);
    drag.pos = pos;
  }

  /* Returns true when this pointer finished a real drag (so it is not a tap). */
  onDragEnd(event, cancelled) {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return false;
    this.drag = null;
    this.controls.enabled = true;
    if (!drag.active) return false;
    const instance = this.pieces.get(drag.id);
    const object = this.sceneObjects.get(drag.id);
    if (!instance || !object) return true;
    const pos = drag.pos;
    if (cancelled || !pos || (pos.x === instance.x && pos.y === instance.y && pos.z === instance.z)) {
      object.position.set(instance.x, instance.y, instance.z);
    } else {
      this.recordHistory();
      Object.assign(instance, pos);
      this.scheduleSave();
      this.setHint("✓", HINTS.moved);
      this.haptic("tap");
    }
    this.selectPiece(drag.id);
    return true;
  }

  onTap(event) {
    const hits = this.pointFromEvent(event);
    const pieceHit = hits.find((hit) => this.getPieceIdFromIntersection(hit));
    const pieceId = pieceHit ? this.getPieceIdFromIntersection(pieceHit) : null;

    if (this.mode === "explore") {
      if (pieceId) {
        this.setMode("build", { quiet: true });
        this.selectPiece(pieceId);
        this.focusPiece(pieceId);
        this.setHint("✏️", HINTS.backInBuild);
      }
      return;
    }

    if (this.moveId) {
      const targetHit = hits.find((hit) => isGround(hit) || this.getPieceIdFromIntersection(hit));
      if (!targetHit) return;
      const instance = this.pieces.get(this.moveId);
      this.recordHistory();
      const pos = this.placementFor(targetHit.point, getPart(instance.partId), instance.rotation, this.moveId);
      Object.assign(instance, pos);
      this.sceneObjects.get(this.moveId).position.set(pos.x, pos.y, pos.z);
      const moved = this.moveId;
      this.moveId = null;
      this.ghost.visible = false;
      this.selectPiece(moved);
      this.scheduleSave();
      this.setHint("✓", HINTS.moved);
      return;
    }

    if (this.placementArmed) {
      const targetHit = hits.find((hit) => isGround(hit) || this.getPieceIdFromIntersection(hit));
      if (!targetHit) return;
      const part = getPart(this.activePartId);
      const pos = this.placementFor(targetHit.point, part);
      const id = this.addPiece({ id: uid(), partId: part.id, colorId: this.activeColorId, ...pos, rotation: 0 }, true);
      this.placementArmed = false;
      this.selectPiece(id);
      this.ghost.visible = false;
      this.setHint("✓", HINTS.placed);
      this.haptic("tap");
      return;
    }

    if (pieceId) {
      /* Tapping the selected piece again turns it — the tool is the piece (D8). */
      if (pieceId === this.selectedId) this.rotateSelected();
      else this.selectPiece(pieceId);
      return;
    }

    this.selectPiece(null);
  }

  /* One pass, no layout: class toggles and a material swap only (D9). */
  selectPiece(id) {
    if (id && !this.pieces.has(id)) id = null;
    const changed = id !== this.selectedId;
    this.selectedId = id;
    this.selectionHelper.visible = !!id;
    if (id) {
      this.selectionBox.setFromObject(this.sceneObjects.get(id));
      this.setActiveColor(this.pieces.get(id).colorId);
      if (changed) this.setHint("✨", HINTS.selected);
    }
    this.updateSelectionUI();
  }

  updateSelectionUI() {
    const shown = !!this.selectedId && !this.moveId && !(this.drag && this.drag.active) && this.mode === "build";
    if (shown !== this.bubble.shown) {
      this.bubble.shown = shown;
      this.bubbleEl.classList.toggle("is-visible", shown);
    }
    if (shown) this.placeBubble();
  }

  /* Keep the tool bubble above the selected piece (below it near the top
     edge), inside the stage. transform only: never a reflow. */
  placeBubble() {
    if (!this.bubble.shown || !this.stageSize) return;
    if (!this.bubble.width) {
      this.bubble.width = this.bubbleEl.offsetWidth;
      this.bubble.height = this.bubbleEl.offsetHeight;
    }
    /* Screen rectangle of the selection box's 8 corners: the bubble clears
       the whole piece at any zoom, not just its top centre. */
    const box = this.selectionBox;
    const { width, height } = this.stageSize;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < 8; i += 1) {
      const p = this.bubblePoint.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(this.camera);
      const x = (p.x + 1) / 2 * width;
      const y = (1 - p.y) / 2 * height;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const gap = 12;
    let top = minY - this.bubble.height - gap;
    if (top < 8) top = maxY + gap;
    const left = clamp((minX + maxX) / 2 - this.bubble.width / 2, 8, Math.max(8, width - this.bubble.width - 8));
    top = clamp(top, 8, Math.max(8, height - this.bubble.height - 8));
    if (Math.abs(left - this.bubble.x) < 0.5 && Math.abs(top - this.bubble.y) < 0.5) return;
    this.bubble.x = left;
    this.bubble.y = top;
    this.bubbleEl.style.transform = `translate3d(${left.toFixed(1)}px,${top.toFixed(1)}px,0)`;
  }

  /* Turning a piece whose sides differ in parity re-centres it on the studs. */
  rotateSelected() {
    if (!this.selectedId) return;
    this.recordHistory();
    const id = this.selectedId;
    const instance = this.pieces.get(id);
    instance.rotation = (instance.rotation + 90) % 360;
    Object.assign(instance, this.placementFor(instance, getPart(instance.partId), instance.rotation, id));
    const object = this.sceneObjects.get(id);
    object.rotation.y = instance.rotation * Math.PI / 180;
    object.position.set(instance.x, instance.y, instance.z);
    this.selectPiece(id);
    this.scheduleSave();
    this.haptic("tap");
  }

  duplicateSelected() {
    if (!this.selectedId) return;
    const original = this.pieces.get(this.selectedId);
    const part = getPart(original.partId);
    const pos = this.placementFor({ x: original.x + 2, z: original.z + 2 }, part, original.rotation);
    const id = this.addPiece({ ...original, id: uid(), ...pos }, true);
    this.selectPiece(id);
    this.focusPiece(id, 5.5);
  }

  deleteSelected() {
    if (!this.selectedId) return;
    const id = this.selectedId;
    this.removePiece(id, true);
    this.setHint("🗑️", HINTS.removed);
    this.haptic("tap");
  }

  beginMoveSelected() {
    if (!this.selectedId) return;
    this.moveId = this.selectedId;
    const instance = this.pieces.get(this.selectedId);
    this.activePartId = instance.partId;
    this.setActiveColor(instance.colorId);
    this.refreshGhost();
    this.ghost.rotation.y = instance.rotation * Math.PI / 180;
    this.ghost.position.copy(this.sceneObjects.get(this.selectedId).position);
    this.ghost.visible = true;
    this.updateSelectionUI();
    this.setHint("☝️", HINTS.moveTo);
  }

  /* Swap the cached material in place: no rebuild, no DOM. The wheel's tyre
     and the flower's centre keep their own colours. */
  recolorSelected(colorId) {
    if (!this.selectedId) return;
    const instance = this.pieces.get(this.selectedId);
    if (instance.colorId === colorId) return;
    this.recordHistory();
    const from = this.kit.mat(getColorHex(instance.colorId));
    const to = this.kit.mat(getColorHex(colorId));
    instance.colorId = colorId;
    this.sceneObjects.get(this.selectedId).traverse((node) => {
      if (node.material === from) node.material = to;
    });
    this.scheduleSave();
  }

  setMode(mode, options = {}) {
    mode = mode === "explore" ? "explore" : "build";
    if (this.mode === mode) return;
    this.mode = mode;
    this.moveId = null;
    this.ghost.visible = false;
    if (mode === "explore") {
      this.selectPiece(null);
      this.controls.maxDistance = BUILD_MAX_DISTANCE + 32;
      this.setHint("🌍", HINTS.explore);
    } else {
      this.controls.maxDistance = BUILD_MAX_DISTANCE;
      this.placementArmed = false;
      this.ghost.visible = false;
      this.setHint("🧱", HINTS.choose);
    }
    this.updateModeUI();
    this.updateSelectionUI();
    if (!options.quiet) this.haptic("tap");
  }

  updateModeUI() {
    this.app.dataset.mode = this.mode;
    this.app.classList.toggle("is-explore", this.mode === "explore");
    this.root.querySelectorAll("[data-mode-button]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.modeButton === this.mode);
    });
  }

  focusPiece(id, distance = 6.5) {
    const object = this.sceneObjects.get(id);
    if (!object) return;
    const target = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
    const currentDirection = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
    const endCamera = target.clone().add(currentDirection.multiplyScalar(distance));
    this.animateCamera(target, endCamera, 520);
  }

  homeView(animated = true) {
    const target = new THREE.Vector3(...HOME_TARGET);
    const camera = new THREE.Vector3(...HOME_CAMERA);
    if (animated) this.animateCamera(target, camera, 520);
    else {
      this.controls.target.copy(target);
      this.camera.position.copy(camera);
      this.controls.update();
    }
  }

  animateCamera(target, position, duration = 450) {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.controls.target.copy(target);
      this.camera.position.copy(position);
      this.controls.update();
      return;
    }
    this.cameraTween = {
      start: performance.now(), duration,
      fromTarget: this.controls.target.clone(), toTarget: target.clone(),
      fromCamera: this.camera.position.clone(), toCamera: position.clone(),
    };
  }

  recordHistory() {
    const snapshot = Array.from(this.pieces.values()).map((piece) => ({ ...piece }));
    this.history.push(snapshot);
    if (this.history.length > 40) this.history.shift();
    this.updateUndoUI();
  }

  updateUndoUI() {
    const button = this.root.querySelector("[data-action=undo]");
    if (button) button.disabled = this.history.length === 0;
  }

  undo() {
    const snapshot = this.history.pop();
    if (!snapshot) return;
    this.selectPiece(null);
    this.moveId = null;
    this.placementArmed = false;
    for (const id of Array.from(this.pieces.keys())) this.removePiece(id, false);
    snapshot.forEach((piece) => this.addPiece(piece, false));
    this.updateUndoUI();
    this.scheduleSave();
    this.setHint("↶", HINTS.undone);
    this.haptic("tap");
  }

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(false), 180);
  }

  saveNow(notify = false) {
    const pieces = Array.from(this.pieces.values()).map((piece) => ({ ...piece }));
    this.storage.save({ name: "My Brick World", mode: this.mode, grid: GRID_VERSION, pieces, assemblies: [] });
    if (notify) this.toast(this.preReader ? "✓ 💾" : say(HINTS.saved));
  }

  toast(message) {
    this.toastEl.textContent = message;
    this.toastEl.classList.add("is-visible");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove("is-visible"), 1500);
  }

  /* Pre-readers see the icon; everyone else the EN · 中文 sentence. */
  setHint(icon, pair) {
    if (!this.hintEl) return;
    this.hintEl.textContent = this.preReader ? icon : say(pair);
  }

  haptic() {
    try { if (this.options.onTap) this.options.onTap(); } catch {}
  }

  /* Panning may wander, but never so far that the island leaves the view:
     the centre stays above the plate (plus a little sea), camera and all. */
  keepViewOnIsland() {
    const target = this.controls.target;
    const limit = BASE_HALF + 4;
    const dx = clamp(target.x, -limit, limit) - target.x;
    const dz = clamp(target.z, -limit, limit) - target.z;
    if (!dx && !dz) return;
    target.x += dx; target.z += dz;
    this.camera.position.x += dx; this.camera.position.z += dz;
  }

  startLoop() {
    const loop = (time) => {
      if (this.destroyed) return;
      this.raf = requestAnimationFrame(loop);
      if (this.cameraTween) {
        const t = clamp((time - this.cameraTween.start) / this.cameraTween.duration, 0, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        this.controls.target.lerpVectors(this.cameraTween.fromTarget, this.cameraTween.toTarget, eased);
        this.camera.position.lerpVectors(this.cameraTween.fromCamera, this.cameraTween.toCamera, eased);
        if (t >= 1) this.cameraTween = null;
      }
      this.controls.update();
      this.keepViewOnIsland();
      if (this.selectedId && this.selectionHelper.visible) {
        const object = this.sceneObjects.get(this.selectedId);
        if (object) this.selectionBox.setFromObject(object);
        this.placeBubble();
      }
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /* Read-only state for browser harnesses; screen points are CSS pixels. */
  snapshot() {
    const rect = this.renderer ? this.renderer.domElement.getBoundingClientRect() : null;
    const pieces = Array.from(this.pieces.values()).map((piece) => {
      const out = Object.assign({}, piece);
      if (rect && THREE) {
        const p = new THREE.Vector3(piece.x, piece.y, piece.z).project(this.camera);
        out.screen = { x: rect.left + (p.x + 1) / 2 * rect.width, y: rect.top + (1 - p.y) / 2 * rect.height };
      }
      return out;
    });
    return {
      mode: this.mode,
      preReader: this.preReader,
      selectedId: this.selectedId,
      placementArmed: this.placementArmed,
      moving: !!this.moveId,
      dragging: !!(this.drag && this.drag.active),
      toolsShown: this.bubble.shown,
      baseplateStuds: this.baseplateStuds,
      undo: this.history.length,
      graphics: this.renderer ? this.renderer.domElement.dataset.sqGraphics : null,
      canvas: rect ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height } : null,
      camera: this.camera ? { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z, aspect: this.camera.aspect } : null,
      target: this.controls ? { x: this.controls.target.x, y: this.controls.target.y, z: this.controls.target.z } : null,
      pieces,
    };
  }

  /* Save, then release everything this runtime allocated: loop, timers,
     observer, controls, every geometry/material (cached ones too), and the
     GL context. */
  destroy() {
    if (this.destroyed) return;
    if (this.scene) this.saveNow(false);
    this.destroyed = true;
    clearTimeout(this.saveTimer);
    clearTimeout(this.toastTimer);
    cancelAnimationFrame(this.raf);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.controls) this.controls.dispose();
    if (this.scene) disposeTree(this.scene, true);
    if (this.kit) this.kit.dispose();
    if (this.renderer) this.renderer.dispose();
    if (this.runtime) releaseContext(this.runtime);
    this.root.innerHTML = "";
  }
}

export function createBrickLab(root, options = {}) {
  return new BrickLabRuntime(root, options);
}
