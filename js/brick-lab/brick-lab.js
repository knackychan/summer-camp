/* Brick Lab runtime (docs/plans/2026-10-03-brick-lab/). Adapted from the
   v0.1.0 integration kit: Three arrives through three-runtime.js (WebGL1 gets
   the r162 fallback), the host owns Back, every kid-facing string is EN + 中文. */
import { loadThree, createRenderer, releaseContext, firstFrame, observeResize } from "../games/three-runtime.js";
import { BRICK_HEIGHT, CATEGORIES, COLORS, COLOR_NAMES, PARTS, getColorHex, getPart } from "./brick-catalog.js";
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
  selected: ["Selected. Use the tools on the right, or tap another piece.", "選好了。用右邊的工具，或點另一塊。"],
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

function isGround(hit) {
  return !!(hit.object && hit.object.userData && hit.object.userData.sqblGround);
}

function disposeTree(root) {
  root.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material.dispose();
    }
  });
}

function makeRectPiece(part, colorHex) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3, metalness: 0.02 });
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(part.width * 0.96, part.height, part.depth * 0.96),
    bodyMaterial,
  );
  body.position.y = 0;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  if (part.studs) {
    const studGeo = new THREE.CylinderGeometry(0.215, 0.215, 0.12, 18);
    for (let x = 0; x < part.width; x += 1) {
      for (let z = 0; z < part.depth; z += 1) {
        const stud = new THREE.Mesh(studGeo, bodyMaterial);
        stud.position.set(
          x - (part.width - 1) / 2,
          part.height / 2 + 0.06,
          z - (part.depth - 1) / 2,
        );
        stud.castShadow = true;
        group.add(stud);
      }
    }
  }
  return group;
}

function makeSlopePiece(part, colorHex) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.32 });
  const shape = new THREE.Shape();
  shape.moveTo(-part.depth * 0.48, -part.height / 2);
  shape.lineTo(part.depth * 0.48, -part.height / 2);
  shape.lineTo(part.depth * 0.48, part.height / 2);
  shape.lineTo(-part.depth * 0.48, -part.height / 2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: part.width * 0.96, bevelEnabled: false });
  geo.translate(-part.width * 0.48, 0, 0);
  geo.rotateY(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

function makeWheelPiece(part, colorHex) {
  const group = new THREE.Group();
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.46, 0.44, 24),
    new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.62 }),
  );
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  group.add(tire);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.23, 0.47, 20),
    new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3 }),
  );
  hub.rotation.z = Math.PI / 2;
  group.add(hub);
  return group;
}

function makeRailPiece(part) {
  const group = new THREE.Group();
  const railMat = new THREE.MeshStandardMaterial({ color: 0x4f5660, roughness: 0.48, metalness: 0.18 });
  const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x8b5a38, roughness: 0.66 });
  for (const x of [-0.62, 0.62]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, part.depth * 0.96), railMat);
    rail.position.set(x, 0.12, 0);
    rail.castShadow = true;
    group.add(rail);
  }
  for (let z = -part.depth / 2 + 0.35; z <= part.depth / 2 - 0.35; z += 0.68) {
    const sleeper = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.10, 0.18), sleeperMat);
    sleeper.position.set(0, 0.02, z);
    group.add(sleeper);
  }
  return group;
}

function makeTreePiece() {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.34, 1.7, 10),
    new THREE.MeshStandardMaterial({ color: 0x815038, roughness: 0.7 }),
  );
  trunk.position.y = -0.85;
  trunk.castShadow = true;
  group.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f9d50, roughness: 0.48 });
  [0, 0.7, 1.3].forEach((y, i) => {
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.0 - i * 0.13, 1.8, 10), leafMat);
    crown.position.y = y + 0.15;
    crown.castShadow = true;
    group.add(crown);
  });
  return group;
}

function makeFlowerPiece(colorHex) {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.06, 0.62, 8),
    new THREE.MeshStandardMaterial({ color: 0x2f8e4a, roughness: 0.6 }),
  );
  stem.position.y = -0.14;
  group.add(stem);
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 10, 8),
    new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4 }),
  );
  center.position.y = 0.26;
  group.add(center);
  for (let i = 0; i < 6; i += 1) {
    const petal = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.45 }),
    );
    petal.scale.set(1.4, 0.55, 0.8);
    petal.position.set(Math.cos(i * TAU / 6) * 0.24, 0.26, Math.sin(i * TAU / 6) * 0.24);
    group.add(petal);
  }
  return group;
}

function makePieceMesh(part, colorHex) {
  if (part.shape === "wheel") return makeWheelPiece(part, colorHex);
  if (part.shape === "rail") return makeRailPiece(part);
  if (part.shape === "tree") return makeTreePiece();
  if (part.shape === "flower") return makeFlowerPiece(colorHex);
  if (part.shape === "slope") return makeSlopePiece(part, colorHex);
  return makeRectPiece(part, colorHex);
}

function pieceBounds(instance, part) {
  const quarterTurns = ((instance.rotation || 0) / 90) % 2;
  const w = quarterTurns ? part.depth : part.width;
  const d = quarterTurns ? part.width : part.depth;
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

function createStarterPieces() {
  return [
    { id: uid(), partId: "brick_2x4", colorId: "red", x: -3, y: BRICK_HEIGHT / 2, z: -1, rotation: 0 },
    { id: uid(), partId: "brick_2x4", colorId: "yellow", x: -3, y: BRICK_HEIGHT * 1.5, z: -1, rotation: 90 },
    { id: uid(), partId: "brick_2x2", colorId: "blue", x: 1, y: BRICK_HEIGHT / 2, z: 1, rotation: 0 },
    { id: uid(), partId: "brick_2x2", colorId: "green", x: 1, y: BRICK_HEIGHT * 1.5, z: 1, rotation: 0 },
    { id: uid(), partId: "rail_straight", colorId: "darkGray", x: 4, y: 0.09, z: -2, rotation: 0 },
    { id: uid(), partId: "tree_small", colorId: "green", x: 4, y: 2, z: 4, rotation: 0 },
    { id: uid(), partId: "flower", colorId: "pink", x: -5, y: 0.45, z: 3, rotation: 0 },
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
    this.placementArmed = false;
    this.history = [];
    this.pieces = new Map();
    this.sceneObjects = new Map();
    this.pointerDown = null;
    this.saveTimer = null;
    this.destroyed = false;
    this.cameraTween = null;
  }

  async mount() {
    const runtime = await loadThree(document.createElement("canvas"), true);
    if (this.destroyed) { releaseContext(runtime); return this; }
    this.runtime = runtime;
    THREE = runtime.THREE;
    OrbitControls = runtime.OrbitControls;
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
            <div class="sqbl-stage-hint" data-stage-hint aria-live="polite"></div>
            <div class="sqbl-explore-badge">🌍 ${pre ? "" : "Explore 探索"}</div>
          </div>

          <aside class="sqbl-right-rail is-empty" aria-label="Tools 工具">
            <button type="button" class="sqbl-rail-collapse" data-action="toggle-right" aria-label="Fold 收起">›</button>
            <div class="sqbl-selection-name" data-selection-name></div>
            <div class="sqbl-context-actions">
              <button type="button" data-action="move" aria-label="Move 移動">✥ <span>${pre ? "" : "Move<br>移動"}</span></button>
              <button type="button" data-action="rotate" aria-label="Turn 旋轉">↻ <span>${pre ? "" : "Turn<br>旋轉"}</span></button>
              <button type="button" data-action="duplicate" aria-label="Copy 複製">⧉ <span>${pre ? "" : "Copy<br>複製"}</span></button>
              <button type="button" data-action="delete" class="is-danger" aria-label="Remove 拿掉">🗑 <span>${pre ? "" : "Remove<br>拿掉"}</span></button>
            </div>
          </aside>
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
    this.selectionNameEl = this.root.querySelector("[data-selection-name]");
    this.rightRail = this.root.querySelector(".sqbl-right-rail");
    this.leftRail = this.root.querySelector(".sqbl-left-rail");
    this.bottomTray = this.root.querySelector(".sqbl-bottom-tray");
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdfeff6);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
    this.camera.position.set(12, 12, 15);

    this.renderer = createRenderer(this.runtime, 2);
    this.renderer.shadowMap.enabled = !this.renderer.sqReducedQuality;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = "sqbl-canvas";
    this.renderer.domElement.setAttribute("aria-label", "Brick Lab 3D builder 積木實驗室 3D 建造");
    this.stage.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 32;
    this.controls.minPolarAngle = 0.32;
    this.controls.maxPolarAngle = Math.PI / 2.08;
    this.controls.target.set(0, 0.7, 0);
    this.controls.enablePan = false;

    const ambient = new THREE.HemisphereLight(0xffffff, 0x60705d, 1.9);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff5d9, 2.5);
    sun.position.set(8, 16, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    this.scene.add(sun);

    const table = new THREE.Mesh(
      new THREE.CylinderGeometry(17.5, 17.5, 0.8, 48),
      new THREE.MeshStandardMaterial({ color: 0xb98455, roughness: 0.78 }),
    );
    table.position.y = -0.75;
    table.receiveShadow = true;
    this.scene.add(table);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(18, 0.42, 18),
      new THREE.MeshStandardMaterial({ color: 0x75b657, roughness: 0.48 }),
    );
    base.position.y = -0.21;
    base.receiveShadow = true;
    base.userData.sqblGround = true;
    this.scene.add(base);
    this.ground = base;

    const grid = new THREE.GridHelper(18, 18, 0x4e873d, 0x639e4d);
    grid.position.y = 0.008;
    grid.material.opacity = 0.28;
    grid.material.transparent = true;
    this.scene.add(grid);

    this.selectionBox = new THREE.Box3();
    this.selectionHelper = new THREE.Box3Helper(this.selectionBox, 0x3c8df6);
    this.selectionHelper.visible = false;
    this.scene.add(this.selectionHelper);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.ghost = new THREE.Group();
    this.ghost.visible = false;
    this.scene.add(this.ghost);

    this.resizeObserver = observeResize(this.stage, () => this.resize());
    this.resize();
  }

  resize() {
    if (this.destroyed || !this.stage || !this.renderer) return;
    const width = Math.max(1, this.stage.clientWidth);
    const height = Math.max(1, this.stage.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
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
    this.root.querySelector("[data-action=toggle-right]").addEventListener("pointerdown", () => this.rightRail.classList.toggle("is-collapsed"));
    this.root.querySelector("[data-action=toggle-chrome]").addEventListener("pointerdown", () => this.app.classList.toggle("is-build-focus"));

    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", (event) => {
      this.pointerDown = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    });
    canvas.addEventListener("pointermove", (event) => this.onPointerMove(event));
    canvas.addEventListener("pointerup", (event) => {
      if (!this.pointerDown) return;
      const dx = event.clientX - this.pointerDown.x;
      const dy = event.clientY - this.pointerDown.y;
      const travel = Math.hypot(dx, dy);
      const duration = event.timeStamp - this.pointerDown.time;
      this.pointerDown = null;
      if (travel < 10 && duration < 550) this.onTap(event);
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

  renderColorTray() {
    this.colorsEl.innerHTML = Object.keys(COLORS).map((colorId) => `
      <button type="button" class="sqbl-color${colorId === this.activeColorId ? " is-active" : ""}" data-color="${colorId}" aria-label="${escapeHtml(label(COLOR_NAMES[colorId]))}" style="--sqbl-swatch:#${getColorHex(colorId).toString(16).padStart(6, "0")}"></button>`).join("");
    this.colorsEl.querySelectorAll("[data-color]").forEach((button) => {
      button.addEventListener("click", () => {
        this.activeColorId = button.dataset.color;
        this.colorsEl.querySelectorAll("[data-color]").forEach((item) => item.classList.toggle("is-active", item === button));
        if (this.selectedId) this.recolorSelected(this.activeColorId);
        else this.refreshGhost();
      });
    });
  }

  loadInitialState() {
    const saved = this.storage.load();
    const source = saved && saved.pieces.length ? saved.pieces : (this.options.seedDemo === false ? [] : createStarterPieces());
    source.forEach((instance) => this.addPiece(instance, false));
    if (!saved && source.length) this.scheduleSave();
    this.homeView(false);
    this.placementArmed = false;
    this.setHint("🧱", HINTS.choose);
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
      rotation: ((Number(instance.rotation) || 0) % 360 + 360) % 360,
    };
    const part = getPart(clean.partId);
    const object = makePieceMesh(part, getColorHex(clean.colorId));
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

  rebuildPiece(id) {
    const instance = this.pieces.get(id);
    if (!instance) return;
    const selected = this.selectedId === id;
    const object = this.sceneObjects.get(id);
    if (object) {
      this.scene.remove(object);
      disposeTree(object);
    }
    this.sceneObjects.delete(id);
    this.pieces.delete(id);
    this.addPiece(instance, false);
    if (selected) this.selectPiece(id);
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
    const mesh = makePieceMesh(part, getColorHex(this.activeColorId));
    mesh.traverse((node) => {
      if (!node.material) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => {
        material.transparent = true;
        material.opacity = 0.48;
        material.depthWrite = false;
      });
    });
    this.ghost.add(mesh);
    this.ghost.visible = false;
  }

  pointFromEvent(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
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

  placementForPoint(point, part, ignoreId = null) {
    let x = clamp(Math.round(point.x), -8, 8);
    let z = clamp(Math.round(point.z), -8, 8);
    const probe = { id: "probe", x, y: part.height / 2, z, rotation: 0 };
    const probeBounds = pieceBounds(probe, part);
    let top = 0;
    for (const [id, instance] of this.pieces) {
      if (id === ignoreId) continue;
      const otherPart = getPart(instance.partId);
      if (otherPart.shape === "wheel" || otherPart.shape === "tree" || otherPart.shape === "flower") continue;
      const other = pieceBounds(instance, otherPart);
      if (overlap2D(probeBounds, other)) top = Math.max(top, other.maxY);
    }
    let y = top + part.height / 2;
    if (part.shape === "tree") y = part.height / 2;
    if (part.shape === "flower") y = part.height / 2;
    if (part.shape === "rail") y = part.height / 2;
    return { x, y, z };
  }

  onPointerMove(event) {
    if (this.mode !== "build" || !this.ghost || (!this.placementArmed && !this.moveId)) return;
    if (event.buttons) return;
    const hits = this.pointFromEvent(event);
    const groundHit = hits.find((hit) => isGround(hit)) || hits.find((hit) => this.getPieceIdFromIntersection(hit));
    if (!groundHit) {
      this.ghost.visible = false;
      return;
    }
    const part = this.moveId ? getPart(this.pieces.get(this.moveId).partId) : getPart(this.activePartId);
    const pos = this.placementForPoint(groundHit.point, part, this.moveId);
    this.ghost.position.set(pos.x, pos.y, pos.z);
    this.ghost.visible = true;
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
      const part = getPart(instance.partId);
      const pos = this.placementForPoint(targetHit.point, part, this.moveId);
      instance.x = pos.x; instance.y = pos.y; instance.z = pos.z;
      const object = this.sceneObjects.get(this.moveId);
      object.position.set(pos.x, pos.y, pos.z);
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
      const pos = this.placementForPoint(targetHit.point, part);
      const id = this.addPiece({ id: uid(), partId: part.id, colorId: this.activeColorId, ...pos, rotation: 0 }, true);
      this.placementArmed = false;
      this.selectPiece(id);
      this.ghost.visible = false;
      this.setHint("✓", HINTS.placed);
      this.haptic("tap");
      return;
    }

    if (pieceId) {
      this.selectPiece(pieceId);
      return;
    }

    this.selectPiece(null);
  }

  selectPiece(id) {
    if (id && !this.pieces.has(id)) id = null;
    this.selectedId = id;
    this.selectionHelper.visible = !!id;
    if (id) {
      const object = this.sceneObjects.get(id);
      this.selectionBox.setFromObject(object);
      this.selectionHelper.box.copy(this.selectionBox);
      this.activeColorId = this.pieces.get(id).colorId;
      this.renderColorTray();
      this.setHint("✨", HINTS.selected);
    }
    this.updateSelectionUI();
  }

  updateSelectionUI() {
    const hasSelection = !!this.selectedId;
    this.rightRail.classList.toggle("is-empty", !hasSelection);
    if (!hasSelection) {
      this.selectionNameEl.textContent = "";
      return;
    }
    const instance = this.pieces.get(this.selectedId);
    const part = getPart(instance.partId);
    this.selectionNameEl.textContent = this.preReader ? "🧱" : label(part.label);
  }

  rotateSelected() {
    if (!this.selectedId) return;
    this.recordHistory();
    const instance = this.pieces.get(this.selectedId);
    instance.rotation = (instance.rotation + 90) % 360;
    this.sceneObjects.get(this.selectedId).rotation.y = instance.rotation * Math.PI / 180;
    this.selectPiece(this.selectedId);
    this.scheduleSave();
    this.haptic("tap");
  }

  duplicateSelected() {
    if (!this.selectedId) return;
    const original = this.pieces.get(this.selectedId);
    const copy = { ...original, id: uid(), x: clamp(original.x + 2, -8, 8), z: clamp(original.z + 2, -8, 8) };
    const id = this.addPiece(copy, true);
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
    this.activeColorId = instance.colorId;
    this.refreshGhost();
    this.ghost.position.copy(this.sceneObjects.get(this.selectedId).position);
    this.ghost.visible = true;
    this.setHint("☝️", HINTS.moveTo);
  }

  recolorSelected(colorId) {
    if (!this.selectedId) return;
    this.recordHistory();
    const instance = this.pieces.get(this.selectedId);
    instance.colorId = colorId;
    this.rebuildPiece(this.selectedId);
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
      this.controls.enablePan = true;
      this.controls.maxDistance = 38;
      this.setHint("🌍", HINTS.explore);
    } else {
      this.controls.enablePan = false;
      this.controls.maxDistance = 32;
      this.placementArmed = false;
      this.ghost.visible = false;
      this.setHint("🧱", HINTS.choose);
    }
    this.updateModeUI();
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
    const target = new THREE.Vector3(0, 0.7, 0);
    const camera = new THREE.Vector3(12, 12, 15);
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
    this.storage.save({ name: "My Brick World", mode: this.mode, pieces, assemblies: [] });
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
      if (this.selectedId && this.selectionHelper.visible) {
        const object = this.sceneObjects.get(this.selectedId);
        if (object) {
          this.selectionBox.setFromObject(object);
          this.selectionHelper.box.copy(this.selectionBox);
        }
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
      undo: this.history.length,
      graphics: this.renderer ? this.renderer.domElement.dataset.sqGraphics : null,
      canvas: rect ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height } : null,
      camera: this.camera ? { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z, aspect: this.camera.aspect } : null,
      pieces,
    };
  }

  /* Save, then release everything this runtime allocated: loop, timers,
     observer, controls, every geometry/material, and the GL context. */
  destroy() {
    if (this.destroyed) return;
    if (this.scene) this.saveNow(false);
    this.destroyed = true;
    clearTimeout(this.saveTimer);
    clearTimeout(this.toastTimer);
    cancelAnimationFrame(this.raf);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.controls) this.controls.dispose();
    if (this.scene) disposeTree(this.scene);
    if (this.renderer) this.renderer.dispose();
    if (this.runtime) releaseContext(this.runtime);
    this.root.innerHTML = "";
  }
}

export function createBrickLab(root, options = {}) {
  return new BrickLabRuntime(root, options);
}
