/* Brick Lab runtime (docs/plans/2026-10-03-brick-lab/). Adapted from the
   v0.1.0 integration kit: Three arrives through three-runtime.js (WebGL1 gets
   the r162 fallback), the host owns Back, every kid-facing string is EN + 中文.
   Slice 05: tools sit on the piece, selection never touches layout, bricks
   have real proportions and studs on a studded baseplate. */
import { loadThree, createRenderer, releaseContext, firstFrame, observeResize } from "../games/three-runtime.js";
import {
  BRICK_HEIGHT, CATEGORIES, COLORS, COLOR_FINISH, COLOR_NAMES, FINISHES, PARTS, PLATE_HEIGHT, getColorHex, getPart, isFixedColor, partDims,
} from "./brick-catalog.js";
import { extendSpots, isRail, railClash, railLinks, snapRail, traceCircuits, worldConnectors } from "./brick-rails.js";
import { createKidCamera } from "./brick-camera.js";
import { BrickLabStorage } from "./brick-storage.js";
import { createThumbs } from "./brick-thumbs.js";
import { BrickWorlds } from "./brick-worlds.js";
import { createSequencer } from "./brick-share.js";
import { JOINT_LABELS, cleanPose, isSitting, jointAngles, posesFor, poseShape, samePose, sitOffset, sitShift, stopsOf } from "./brick-pose.js";
import { createLanSession } from "../game-services/lan-session.js";
import { BrickTogether } from "./brick-together.js";

let THREE = null;

/* "EN · 中文" for sentences, "EN 中文" for short labels. */
const say = (pair) => `${pair[0]} · ${pair[1]}`;
const label = (pair) => `${pair[0]} ${pair[1]}`;

const HINTS = {
  choose: ["Choose a piece on the left, or tap a piece to edit it.", "從左邊選一塊積木，或點一塊來修改。"],
  place: ["Tap the baseplate to put the piece down.", "點底板，把積木放上去。"],
  dragDrop: ["Let go where the piece should go.", "拖到想放的地方再放手。"],
  focus: ["Tap an arm, a leg or the head.", "點一下手、腳或頭。"],
  joint: (name) => [`${name[0]}: turn it with ↺ ↻.`, `${name[1]}：用 ↺ ↻ 轉動。`],
  placed: ["Placed! Pick another piece, or edit this one.", "放好了！再選一塊，或修改這一塊。"],
  selected: ["Tap it again to turn it, or drag it to move it.", "再點一下可以旋轉，拖著它可以移動。"],
  moveTo: ["Tap the new spot for this piece.", "點一個新位置放這塊積木。"],
  moved: ["Moved! Tap a piece or pick another.", "移好了！點一塊或再選一塊。"],
  removed: ["Piece removed.", "積木拿掉了。"],
  undone: ["Undone.", "復原了。"],
  explore: ["Slide to look around. Tap something to edit it.", "滑動來看看四周。點任何東西就能修改。"],
  backInBuild: ["Back in Build — edit the piece you tapped.", "回到建造——修改你點的積木。"],
  saved: ["Saved on this tablet", "已儲存在這台平板"],
  railSelected: ["Glowing dots are rail ends — turn or drag to join them.", "發光的點是軌道接頭，轉一轉或拖過去接起來。"],
  railBusy: ["Rails can't overlap — try a free spot.", "軌道不能疊在一起，換個空位試試。"],
  railJoined: ["Rails connected!", "軌道接上了！"],
  circuit: ["Circuit complete!", "軌道接成一圈了！"],
  changed: ["Someone changed that", "有人改過了"],
  placedBy: (name) => [`${name} put this one here.`, `這塊是 ${name} 放的。`],
};

/* Parts tray and info card (slice 11). */
const TRAY = {
  parts: (n) => [`${n} ${n === 1 ? "part" : "parts"}`, `${n} 種`],
  search: ["Find a part", "找積木"],
  results: ["Search", "搜尋"],
  pieces: ["Pieces", "積木"],
  back: ["Back to all pieces", "回到全部積木"],
  allSizes: ["All sizes", "全部尺寸"],
  favorites: ["Favourites", "最愛"],
  recents: ["Recent", "最近用過"],
  favorite: ["Favourite", "最愛"],
  none: ["No parts match.", "沒有符合的積木。"],
  close: ["Close", "關閉"],
  size: ["Size", "尺寸"],
  studs: ["studs", "顆凸點"],
  colours: (n) => [`${n} colours`, `${n} 種顏色`],
  ownColours: ["Comes in its own colours", "有自己固定的顏色"],
  railEnds: (n) => [`${n} rail ends`, `${n} 個軌道接頭`],
  flat: ["Lies flat on the baseplate", "平放在底板上"],
};

/* World menu (multiplayer plan D3, slice 01). */
const MENU = {
  worlds: ["My worlds", "我的世界"],
  join: ["Join a world", "加入世界"],
  joinSoon: ["Coming soon: build together on the home wifi", "即將推出：在家裡的 Wi-Fi 一起蓋"],
  needsApp: ["Building together needs the Summer Quest app", "一起蓋需要 Summer Quest 應用程式"],
  noneNearby: ["No worlds open nearby", "附近沒有開著的世界"],
  joining: ["Joining…", "加入中…"],
  cantJoin: ["Couldn't reach that world. Try again.", "連不上那個世界，再試一次。"],
  joined: (name) => [`${name} joined!`, `${name} 加入了！`],
  left: (name) => [`${name} left`, `${name} 離開了`],
  closed: (name) => [`${name}'s world closed`, `${name} 的世界關閉了`],
  looking: (name) => [`Looking for ${name}'s world…`, `正在找 ${name} 的世界…`],
  update: ["Update the app on both tablets", "兩台平板都要更新"],
  newWorld: ["New world", "新世界"],
  open: ["Open", "打開"],
  more: ["More", "更多"],
  rename: ["Rename", "改名"],
  remove: ["Delete", "刪除"],
  close: ["Close", "關閉"],
  save: ["Done", "好了"],
  cancel: ["Cancel", "取消"],
  keep: ["Keep it", "保留"],
  sure: ["Delete this world?", "要刪除這個世界嗎？"],
  name: ["World name", "世界名稱"],
  bricks: (n) => [`${n} ${n === 1 ? "brick" : "bricks"}`, `${n} 塊積木`],
  removed: ["World deleted.", "世界刪除了。"],
};

/* Turn and zoom buttons over the view (kid-camera plan K3). */
const CAM_ARC = "M7 13a9 9 0 1 0 3-6.7";
const CAMERA_BUTTONS = [
  { id: "left", icon: `<path d="${CAM_ARC}"/><path d="M10 2v5H5"/>`, label: ["Turn left", "向左轉"] },
  { id: "right", icon: `<g transform="matrix(-1 0 0 1 32 0)"><path d="${CAM_ARC}"/><path d="M10 2v5H5"/></g>`, label: ["Turn right", "向右轉"] },
  { id: "out", icon: '<path d="M7 16h18"/>', label: ["Zoom out", "縮小"] },
  { id: "in", icon: '<path d="M7 16h18M16 7v18"/>', label: ["Zoom in", "放大"] },
];

const SNAP_GUIDES = {
  studs: ["Snaps onto the studs. Stack it on other bricks.", "會卡在凸點上，可以疊在別的積木上。"],
  rail: ["Snaps to a nearby rail end. Turn it until the ends face each other.", "靠近軌道接頭就會自動接上。轉一轉，讓接頭對好。"],
  wheel: ["Put it next to an axle or a brick.", "放在車軸或積木旁邊。"],
  plant: ["Plants straight into the baseplate.", "直接種在底板上。"],
  head: ["Put it on a minifigure's head.", "放在小人偶的頭上。"],
  seat: ["Put a minifigure on it to sit or ride.", "把小人偶放上去，就能坐或騎。"],
};

const RECENT_MAX = 5;

const TAU = Math.PI * 2;
/* Rail end dots float just above the track; at most this many show. */
const MARKER_Y = 0.62;
const MARKER_MAX = 240;
const DEFAULT_COLOR = "red";
const SELECTION_BLUE = 0x3c8df6;
const BASEPLATE_GREEN = 0x4b9f4a;

/* Real brick proportions on a 1-unit pitch (D10): stud Ø0.6 × 0.2, a small
   seam between neighbours so stacked bricks show the groove. */
const STUD_R = 0.3;
const STUD_H = 0.2;
const SEAM = 0.02;
/* Diorama scale (slice 06): a 32×32 baseplate seen from further away, so
   bricks read as minifig-scale bricks, not chunky blocks. */
const BASE_HALF = 32;
/* Render on demand (slice 13): keep drawing this long after the last input. */
const RENDER_HOLD = 500;
/* Step-down (slice 14): average frame time that counts as "can't keep up". */
const SLOW_FRAME_MS = 28;
const INPUT_EVENTS = ["pointerdown", "pointermove", "pointerup", "pointercancel", "wheel", "keydown", "input", "change", "click"];
const SEA_BLUE = 0x2b5d93;
/* Home (kid-camera plan K4): the whole island from the front right, ~47° down. */
const HOME_VIEW = Object.freeze({ x: 6, z: 9, yaw: 38 * Math.PI / 180, distance: 100 });
const BUILD_MAX_DISTANCE = 128;
/* The view's centre stays this close to the plate (slice 07, D13). */
const VIEW_REACH = 36;
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

/* "1 brick tall", "2 plates tall"… for the info card. */
function heightText(part) {
  if (isRail(part)) return TRAY.flat;
  if (Math.abs(part.height - BRICK_HEIGHT) < 0.01) return ["1 brick tall", "1 塊積木高"];
  /* Tall parts count bricks (a minifigure is "about 3 bricks tall"). */
  if (part.height > BRICK_HEIGHT) {
    const bricks = Math.max(1, Math.round(part.height / BRICK_HEIGHT));
    const exact = Math.abs(bricks * BRICK_HEIGHT - part.height) < 0.05;
    return [`${exact ? "" : "about "}${bricks} bricks tall`, `${exact ? "" : "大約 "}${bricks} 塊積木高`];
  }
  const plates = Math.max(1, Math.round(part.height / PLATE_HEIGHT));
  return [`${plates} ${plates === 1 ? "plate" : "plates"} tall`, `${plates} 片薄板高`];
}

function snapGuide(part) {
  if (isRail(part)) return SNAP_GUIDES.rail;
  if (part.shape === "wheel") return SNAP_GUIDES.wheel;
  if (part.ground) return SNAP_GUIDES.plant;
  if (part.sink) return SNAP_GUIDES.head;
  if (part.top != null) return SNAP_GUIDES.seat;
  return SNAP_GUIDES.studs;
}

/* Search folds case and lets "2x4" find "2×4"; labels match in EN and 中文. */
function searchText(value) {
  return String(value || "").toLowerCase().replace(/[x*]/g, "×").replace(/\s+/g, " ").trim();
}

function partMatches(part, query) {
  if (!query) return true;
  const category = CATEGORIES.find((c) => c.id === part.category);
  const haystack = searchText([part.label[0], part.label[1], partDims(part), part.size, category ? category.label.join(" ") : ""].join(" "));
  return query.split(" ").every((word) => haystack.includes(word));
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

/* Reduced-quality devices (slice 13) light everything with Lambert: same
   diffuse, no roughness or metalness, far cheaper per pixel than PBR. */
function litMaterial(cheap, params) {
  if (!cheap) return new THREE.MeshStandardMaterial(params);
  const { roughness, metalness, ...lambert } = params;
  return new THREE.MeshLambertMaterial(lambert);
}

/* Palette hex → its finish (catalog C3): gold and silver shine, trans
   colours are see-through. Looked up by hex so recolouring keeps working
   through kit.mat(hex). */
const PALETTE_FINISH = new Map(Object.keys(COLOR_FINISH).map((id) => [COLORS[id], COLOR_FINISH[id]]));

function finishMaterial(cheap, hex, finish = {}) {
  const params = { color: hex, roughness: finish.roughness == null ? 0.42 : finish.roughness, metalness: finish.metalness || 0 };
  if (finish.emissive) Object.assign(params, { emissive: finish.emissive, emissiveIntensity: 0.9 });
  if (finish.opacity) Object.assign(params, { transparent: true, opacity: finish.opacity, depthWrite: false });
  return litMaterial(cheap, params);
}

function makeKit(cheap) {
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
    cheap,
    mat: (hex, roughness, metalness = 0) => (roughness == null && PALETTE_FINISH.has(hex)
      ? keep(mats, `${hex}:finish`, () => finishMaterial(cheap, hex, PALETTE_FINISH.get(hex)))
      : keep(mats, `${hex}:${roughness == null ? 0.45 : roughness}:${metalness}`,
        () => litMaterial(cheap, { color: hex, roughness: roughness == null ? 0.45 : roughness, metalness }))),
    /* A model part's fixed slot (catalog C2): its own key, so a palette
       recolour never swaps it. */
    finish: (name) => keep(mats, `finish:${name}`, () => finishMaterial(cheap, (FINISHES[name] || FINISHES.grey).hex, FINISHES[name] || FINISHES.grey)),
    /* Any other shared material (rail glow, connector dots), freed with the lab. */
    custom: (key, make) => keep(mats, key, make),
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
   down to a small front lip. A studless slope (the 1×1 "cheese") slants all
   the way to its back edge. */
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
    if (part.studs) {
      shape.lineTo(part.depth / 2 - 1, hh);
      shape.lineTo(hd, hh);
    } else {
      shape.lineTo(hd, hh);
    }
    shape.lineTo(hd, -hh);
    const length = part.width - SEAM * 2 - bevel * 2;
    const body = new THREE.ExtrudeGeometry(shape, {
      depth: length, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2,
    });
    body.translate(0, 0, -length / 2);
    body.rotateY(Math.PI / 2);
    const list = [body];
    if (part.studs) addStuds(list, studRow(part.width), [-part.depth / 2 + 0.5], part.height / 2);
    return mergeGeometries(list);
  });
  const group = new THREE.Group();
  group.add(mesh(geometry, kit.mat(colorHex)));
  return group;
}

/* A profile drawn in (−z, y) and extruded across the part's width, the way the
   slope is built: rotateY(π/2) turns shape x into world −z, so the back (studs)
   is at +shape x. */
function extrudeProfile(width, shape, bevel = 0.03) {
  const length = width - SEAM * 2 - bevel * 2;
  const body = new THREE.ExtrudeGeometry(shape, {
    depth: length, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2,
  });
  body.translate(0, 0, -length / 2);
  body.rotateY(Math.PI / 2);
  return body;
}

/* A flat-shaded solid from convex faces, each listed with the way it faces:
   a fan is flipped where needed so every face points outwards. */
function facetGeometry(faces) {
  const out = [];
  const n = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  faces.forEach(({ points, facing }) => {
    for (let i = 1; i < points.length - 1; i += 1) {
      const a = points[0];
      let b = points[i];
      let c = points[i + 1];
      e1.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      e2.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
      n.crossVectors(e1, e2);
      if (n.x * facing[0] + n.y * facing[1] + n.z * facing[2] < 0) [b, c] = [c, b];
      out.push(...a, ...b, ...c);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  g.computeVertexNormals();
  return g;
}

/* A box of the given size centred at (x, y, z). */
function boxAt(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

function paintedGroup(geometry, colorHex, kit) {
  const group = new THREE.Group();
  group.add(mesh(geometry, kit.mat(colorHex)));
  return group;
}

/* Outside-corner roof slope 2×2 (more-parts slice 02): one stud on the back
   corner cell; two slanted faces fall from it to the front and the side and
   meet on a hip line along the diagonal. */
function makeSlopeCornerPiece(part, colorHex, kit) {
  return paintedGroup(kit.geo(part.id, () => {
    const a = part.width / 2 - SEAM;
    const y0 = -part.height / 2;
    const yt = part.height / 2;
    const yl = y0 + 0.16;
    const body = facetGeometry([
      { facing: [0, -1, 0], points: [[-a, y0, -a], [a, y0, -a], [a, y0, a], [-a, y0, a]] },
      { facing: [0, 0, -1], points: [[-a, y0, -a], [a, y0, -a], [a, yl, -a], [0, yt, -a], [-a, yt, -a]] },
      { facing: [-1, 0, 0], points: [[-a, y0, -a], [-a, y0, a], [-a, yl, a], [-a, yt, 0], [-a, yt, -a]] },
      { facing: [0, 0, 1], points: [[-a, y0, a], [a, y0, a], [a, yl, a], [-a, yl, a]] },
      { facing: [1, 0, 0], points: [[a, y0, -a], [a, y0, a], [a, yl, a], [a, yl, -a]] },
      { facing: [0, 1, 0], points: [[-a, yt, -a], [0, yt, -a], [0, yt, 0], [-a, yt, 0]] },
      { facing: [1, 1, 0], points: [[0, yt, -a], [a, yl, -a], [a, yl, a], [0, yt, 0]] },
      { facing: [0, 1, 1], points: [[-a, yt, 0], [0, yt, 0], [a, yl, a], [-a, yl, a]] },
    ]);
    const list = [body];
    addStuds(list, [-part.width / 2 + 0.5], [-part.depth / 2 + 0.5], yt);
    return mergeGeometries(list);
  }), colorHex, kit);
}

/* Inverted slope, the eave (more-parts slice 02): a studded flat top that
   slants in underneath to a one-stud foot at the back, so it overhangs a wall. */
function makeSlopeInvPiece(part, colorHex, kit) {
  return paintedGroup(kit.geo(part.id, () => {
    const bevel = 0.03;
    const hd = part.depth / 2 - SEAM - bevel;
    const hh = part.height / 2 - bevel;
    const shape = new THREE.Shape();
    shape.moveTo(hd, -hh);
    shape.lineTo(hd, hh);
    shape.lineTo(-hd, hh);
    shape.lineTo(-hd, hh - 0.16);
    shape.lineTo(part.depth / 2 - 1, -hh);
    shape.lineTo(hd, -hh);
    const list = [extrudeProfile(part.width, shape, bevel)];
    addStuds(list, studRow(part.width), studRow(part.depth), part.height / 2);
    return mergeGeometries(list);
  }), colorHex, kit);
}

/* Lattice frame (more-parts slice 02): corner posts, bottom rails, crossed
   struts on both long sides (along z) and a studded top. */
function makeFramePiece(part, colorHex, kit) {
  return paintedGroup(kit.geo(part.id, () => {
    const hw = part.width / 2 - SEAM;
    const hd = part.depth / 2 - SEAM;
    const hh = part.height / 2;
    const bar = 0.2;
    const top = 0.24;
    const list = [boxAt(hw * 2, top, hd * 2, 0, hh - top / 2, 0)];
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => {
      list.push(boxAt(bar, part.height - top, bar, sx * (hw - bar / 2), -top / 2, sz * (hd - bar / 2)));
    }));
    [-1, 1].forEach((sx) => list.push(boxAt(bar, bar, hd * 2, sx * (hw - bar / 2), -hh + bar / 2, 0)));
    [-1, 1].forEach((sz) => list.push(boxAt(hw * 2, bar, bar, 0, -hh + bar / 2, sz * (hd - bar / 2))));
    const span = hd * 2 - bar * 2;
    const rise = part.height - top - bar;
    const tilt = Math.atan2(rise, span);
    [-1, 1].forEach((sx) => [-1, 1].forEach((dir) => {
      const g = new THREE.BoxGeometry(bar * 0.7, bar * 0.7, Math.hypot(span, rise));
      g.rotateX(dir * tilt);
      g.translate(sx * (hw - bar / 2), -hh + bar + rise / 2, 0);
      list.push(g);
    }));
    addStuds(list, studRow(part.width), studRow(part.depth), hh);
    return mergeGeometries(list);
  }), colorHex, kit);
}

/* Support bracket (more-parts slice 02): a studded shelf on an upright back
   plate, with a triangular web under the shelf from its front edge down to
   the foot of the back plate. */
function makeBracePiece(part, colorHex, kit) {
  return paintedGroup(kit.geo(part.id, () => {
    const hw = part.width / 2 - SEAM;
    const hd = part.depth / 2 - SEAM;
    const hh = part.height / 2;
    const shelf = 0.3;
    const back = 0.26;
    const list = [
      boxAt(hw * 2, shelf, hd * 2, 0, hh - shelf / 2, 0),
      boxAt(hw * 2, part.height - shelf, back, 0, -shelf / 2, -hd + back / 2),
    ];
    /* Shape x is world −z (extrudeProfile), so the back plate is at +x. */
    const web = new THREE.Shape();
    web.moveTo(hd - back, hh - shelf);
    web.lineTo(-hd + 0.1, hh - shelf);
    web.lineTo(hd - back, -hh + 0.1);
    web.lineTo(hd - back, hh - shelf);
    list.push(extrudeProfile(0.4, web, 0.02));
    addStuds(list, studRow(part.width), studRow(part.depth), hh);
    return mergeGeometries(list);
  }), colorHex, kit);
}

/* Window (more-parts slice 02): a frame in the picked colour (sill, studded
   head, two jambs, running along z) round one see-through pane in a fixed
   light blue that recolouring never touches (D4). */
const WINDOW_SILL = 0.22;
const WINDOW_HEAD = 0.3;
const WINDOW_JAMB = 0.2;
const WINDOW_GLASS = 0x9fd3ee;

function makeWindowPiece(part, colorHex, kit) {
  const hw = part.width / 2 - SEAM;
  const hd = part.depth / 2 - SEAM;
  const hh = part.height / 2;
  const frame = kit.geo(part.id, () => {
    const list = [
      boxAt(hw * 2, WINDOW_SILL, hd * 2, 0, -hh + WINDOW_SILL / 2, 0),
      boxAt(hw * 2, WINDOW_HEAD, hd * 2, 0, hh - WINDOW_HEAD / 2, 0),
    ];
    [-1, 1].forEach((sz) => list.push(boxAt(hw * 1.4, part.height - WINDOW_SILL - WINDOW_HEAD, WINDOW_JAMB,
      0, (WINDOW_SILL - WINDOW_HEAD) / 2, sz * (hd - WINDOW_JAMB / 2))));
    addStuds(list, studRow(part.width), studRow(part.depth), hh);
    return mergeGeometries(list);
  });
  const pane = kit.geo(`${part.id}:pane`, () => boxAt(0.06, part.height - WINDOW_SILL - WINDOW_HEAD + 0.04,
    hd * 2 - WINDOW_JAMB * 2 + 0.04, 0, (WINDOW_SILL - WINDOW_HEAD) / 2, 0));
  const glass = kit.custom("window:pane", () => litMaterial(kit.cheap, {
    color: WINDOW_GLASS, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.45, depthWrite: false,
  }));
  const group = new THREE.Group();
  group.add(mesh(frame, kit.mat(colorHex)));
  group.add(mesh(pane, glass, false));
  return group;
}

/* A small seeded random (mulberry32): the same numbers on every tablet. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Fits a geometry's bounding box to a w × h × d box centred on the origin. */
function fitBox(g, w, h, d) {
  g.computeBoundingBox();
  const b = g.boundingBox;
  g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2);
  g.scale(w / (b.max.x - b.min.x), h / (b.max.y - b.min.y), d / (b.max.z - b.min.z));
  return g;
}

/* Rock (more-parts slice 03): a low-poly boulder, the same on every tablet —
   an icosahedron with every corner pushed by a fixed-seed random, a flat
   bottom, fixed grey (D4, D7). */
function makeRockPiece(part, kit) {
  const geometry = kit.geo(part.id, () => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const random = seeded(20261005);
    const position = g.attributes.position;
    const moved = new Map();
    for (let i = 0; i < position.count; i += 1) {
      /* Corners are repeated per face: move each shared corner once. */
      const key = [position.getX(i), position.getY(i), position.getZ(i)].map((v) => v.toFixed(4)).join(",");
      if (!moved.has(key)) moved.set(key, 0.82 + random() * 0.3);
      const k = moved.get(key);
      position.setXYZ(i, position.getX(i) * k, Math.max(position.getY(i) * k, -0.45), position.getZ(i) * k);
    }
    g.computeVertexNormals();
    return fitBox(g, part.width - SEAM * 2 - 0.1, part.height, part.depth - SEAM * 2 - 0.1);
  });
  const group = new THREE.Group();
  group.add(mesh(geometry, kit.mat(0x8f9294, 0.82)));
  return group;
}

/* Mushroom (more-parts slice 03): a cream stem under a red dome cap with
   white dots; all three colours fixed (D4). */
function makeMushroomPiece(part, kit) {
  const hh = part.height / 2;
  const capBase = -hh + 0.62;
  const capR = 0.46;
  const capH = hh - capBase;
  const stem = kit.geo("mushroom:stem", () => {
    const g = new THREE.CylinderGeometry(0.17, 0.22, 0.66, 14);
    g.translate(0, -hh + 0.33, 0);
    return g;
  });
  const cap = kit.geo("mushroom:cap", () => {
    const dome = new THREE.SphereGeometry(capR, 18, 8, 0, TAU, 0, Math.PI / 2);
    dome.scale(1, capH / capR, 1);
    const under = new THREE.CircleGeometry(capR, 18);
    under.rotateX(Math.PI / 2);
    const g = mergeGeometries([dome, under]);
    g.translate(0, capBase, 0);
    return g;
  });
  const dots = kit.geo("mushroom:dots", () => mergeGeometries([[0, 0.05], [0.9, 0.55], [2.3, 0.6], [3.7, 0.5], [5.1, 0.62]].map(([turn, tilt]) => {
    const g = new THREE.SphereGeometry(0.075, 8, 5);
    /* Flattened along z, then turned so z follows the dome's normal. */
    g.scale(1, 1, 0.45);
    /* A point on the dome at angle `turn` round and `tilt` down from the top. */
    const a = tilt * Math.PI / 2;
    const x = Math.sin(a) * Math.cos(turn) * capR;
    const z = Math.sin(a) * Math.sin(turn) * capR;
    const y = Math.cos(a) * capH;
    g.lookAt(new THREE.Vector3(x / capR, y / capH, z / capR));
    g.translate(x, capBase + y, z);
    return g;
  })));
  const group = new THREE.Group();
  group.add(mesh(stem, kit.mat(0xefe2c4, 0.6)));
  group.add(mesh(cap, kit.mat(0xd0281c, 0.5)));
  group.add(mesh(dots, kit.mat(0xfbfbf6, 0.5), false));
  return group;
}

/* Log (more-parts slice 03): a 12-sided trunk lying along the 4-stud axis (z),
   brown bark with tan end faces and a darker ring; fixed colours (D4). */
function makeLogPiece(part, kit) {
  const r = part.height / 2;
  const length = part.depth - SEAM * 2;
  const bark = kit.geo(`${part.id}:bark`, () => {
    const g = new THREE.CylinderGeometry(r, r, length, 12, 1, true);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const ends = kit.geo(`${part.id}:ends`, () => mergeGeometries([-1, 1].map((side) => {
    const g = new THREE.CircleGeometry(r * 0.8, 12);
    if (side < 0) g.rotateY(Math.PI);
    g.translate(0, 0, side * length / 2);
    return g;
  })));
  const rings = kit.geo(`${part.id}:rings`, () => mergeGeometries([-1, 1].map((side) => {
    const g = new THREE.RingGeometry(r * 0.8, r, 12);
    if (side < 0) g.rotateY(Math.PI);
    g.translate(0, 0, side * length / 2);
    return g;
  })));
  const group = new THREE.Group();
  group.add(mesh(bark, kit.mat(0x6b3a1c, 0.85)));
  group.add(mesh(ends, kit.mat(0xd9b27c, 0.7)));
  group.add(mesh(rings, kit.mat(0x9a6233, 0.7)));
  return group;
}

/* Crate 2×2 (more-parts slice 03): a box of raised planks with corner battens
   and a planked lid, in the picked colour. */
function makeCratePiece(part, colorHex, kit) {
  return paintedGroup(kit.geo(part.id, () => {
    const hw = part.width / 2 - SEAM;
    const hd = part.depth / 2 - SEAM;
    const hh = part.height / 2;
    const inset = 0.05;
    const batten = 0.16;
    const list = [boxAt((hw - inset) * 2, part.height - 0.02, (hd - inset) * 2, 0, -0.01, 0)];
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => list.push(boxAt(batten, part.height, batten, sx * (hw - batten / 2), 0, sz * (hd - batten / 2)))));
    const planks = 3;
    const gap = 0.05;
    const plank = (part.height - gap * (planks + 1)) / planks;
    for (let i = 0; i < planks; i += 1) {
      const y = -hh + gap + plank / 2 + i * (plank + gap);
      [-1, 1].forEach((s) => {
        list.push(boxAt((hw - batten) * 2, plank, inset, 0, y, s * (hd - inset / 2)));
        list.push(boxAt(inset, plank, (hd - batten) * 2, s * (hw - inset / 2), y, 0));
      });
    }
    const lid = 4;
    const board = ((hd - batten) * 2 - gap * (lid - 1)) / lid;
    for (let i = 0; i < lid; i += 1) {
      list.push(boxAt((hw - batten) * 2, 0.04, board, 0, hh - 0.02, -hd + batten + board / 2 + i * (board + gap)));
    }
    return mergeGeometries(list);
  }), colorHex, kit);
}

/* Barrel (more-parts slice 03): a bulging lathe with a flat lid in the picked
   colour, and two dark iron hoops. */
function makeBarrelPiece(part, colorHex, kit) {
  const hh = part.height / 2;
  const body = kit.geo(part.id, () => new THREE.LatheGeometry([
    [0, -hh], [0.36, -hh], [0.43, -hh * 0.5], [0.46, 0], [0.43, hh * 0.5], [0.36, hh], [0, hh],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 20));
  const hoops = kit.geo(`${part.id}:hoops`, () => mergeGeometries([-1, 1].map((side) => {
    const g = new THREE.TorusGeometry(0.445, 0.028, 6, 24);
    g.rotateX(Math.PI / 2);
    g.translate(0, side * hh * 0.5, 0);
    return g;
  })));
  const group = new THREE.Group();
  group.add(mesh(body, kit.mat(colorHex)));
  group.add(mesh(hoops, kit.mat(0x3d4246, 0.4, 0.3)));
  return group;
}

/* Fence post (more-parts slice 03): a square post four bricks tall on a 1×1
   footing, with a cap and one stud on top. */
function makeFencePostPiece(part, colorHex, kit) {
  return paintedGroup(kit.geo(part.id, () => {
    const hh = part.height / 2;
    const foot = 0.24;
    const cap = 0.2;
    const list = [
      boxAt(1 - SEAM * 2, foot, 1 - SEAM * 2, 0, -hh + foot / 2, 0),
      boxAt(0.56, part.height - foot - cap, 0.56, 0, (foot - cap) / 2, 0),
      boxAt(0.78, cap, 0.78, 0, hh - cap / 2, 0),
    ];
    addStuds(list, [0], [0], hh);
    return mergeGeometries(list);
  }), colorHex, kit);
}

/* Railing 1×2 (more-parts slice 03): two posts, a lower rail and a studded
   top rail, open between. The rails run along z. */
function makeRailingPiece(part, colorHex, kit) {
  return paintedGroup(kit.geo(part.id, () => {
    const hw = part.width / 2 - SEAM;
    const hd = part.depth / 2 - SEAM;
    const hh = part.height / 2;
    const top = 0.24;
    const post = 0.22;
    const list = [boxAt(hw * 2, top, hd * 2, 0, hh - top / 2, 0)];
    [-1, 1].forEach((sz) => list.push(boxAt(post, part.height - top, post, 0, -top / 2, sz * (hd - post / 2 - 0.06))));
    list.push(boxAt(0.14, 0.14, hd * 2 - 0.2, 0, -hh + 0.4, 0));
    addStuds(list, studRow(part.width), studRow(part.depth), hh);
    return mergeGeometries(list);
  }), colorHex, kit);
}

/* A plate-thick slab from a footprint outline (world x, z points or a ready
   THREE.Shape whose y is world −z), bevelled like bevelBox. */
function footprintSlab(outline, height, bevel = 0.025) {
  let shape = outline;
  if (Array.isArray(outline)) {
    shape = new THREE.Shape();
    outline.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
    shape.lineTo(outline[0][0], -outline[0][1]);
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: height - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 12,
  });
  g.translate(0, 0, -(height - bevel * 2) / 2);
  g.rotateX(-Math.PI / 2);
  return g;
}

/* Rounded plate 1×2 (parts-survey slice 02): both short ends fully round. */
function makeRoundedPlatePiece(part, colorHex, kit) {
  return paintedGroup(kit.geo(part.id, () => {
    const r = part.width / 2 - SEAM - 0.025;
    const half = part.depth / 2 - part.width / 2;
    const shape = new THREE.Shape();
    shape.moveTo(r, -half);
    shape.lineTo(r, half);
    shape.absarc(0, half, r, 0, Math.PI, false);
    shape.lineTo(-r, -half);
    shape.absarc(0, -half, r, Math.PI, TAU, false);
    const list = [footprintSlab(shape, part.height)];
    addStuds(list, studRow(part.width), studRow(part.depth), part.height / 2);
    return mergeGeometries(list);
  }), colorHex, kit);
}

/* Corner plate 2×2 (parts-survey slice 02): an L of three cells; the front
   right cell is empty but still counts as taken (D5). */
function makeCornerPlatePiece(part, colorHex, kit) {
  return paintedGroup(kit.geo(part.id, () => {
    const a = part.width / 2 - SEAM - 0.025;
    const g = SEAM + 0.025;
    const list = [footprintSlab([[-a, -a], [a, -a], [a, -g], [-g, -g], [-g, a], [-a, a]], part.height)];
    [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5]].forEach(([x, z]) => addStuds(list, [x], [z], part.height / 2));
    return mergeGeometries(list);
  }), colorHex, kit);
}

/* Cut-corner plate 2×2 (parts-survey slice 02): the front right corner cut
   off at 45°, three studs. */
function makeWedgePlatePiece(part, colorHex, kit) {
  return paintedGroup(kit.geo(part.id, () => {
    const a = part.width / 2 - SEAM - 0.025;
    const list = [footprintSlab([[-a, -a], [a, -a], [a, 0], [0, a], [-a, a]], part.height)];
    [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5]].forEach(([x, z]) => addStuds(list, [x], [z], part.height / 2));
    return mergeGeometries(list);
  }), colorHex, kit);
}

/* Cone 1×1 (parts-survey slice 03): a round base tapering to a small flat
   top with one stud. */
function makeConePiece(part, colorHex, kit) {
  return paintedGroup(kit.geo(part.id, () => {
    const hh = part.height / 2;
    const r = part.width / 2 - SEAM;
    const top = STUD_R + 0.03;
    const body = new THREE.LatheGeometry([
      [0, -hh], [r, -hh], [r, -hh + 0.14], [top, hh], [0, hh],
    ].map(([x, y]) => new THREE.Vector2(x, y)), 24);
    const list = [body];
    addStuds(list, [0], [0], hh);
    return mergeGeometries(list);
  }), colorHex, kit);
}

/* Curved slope (parts-survey slice 03): a short flat strip at the back, then
   a curve bowing up and over down to a thin front lip; no studs. */
function makeSlopeCurvedPiece(part, colorHex, kit) {
  return paintedGroup(kit.geo(part.id, () => {
    const bevel = 0.03;
    const hd = part.depth / 2 - SEAM - bevel;
    const hh = part.height / 2 - bevel;
    const back = hd - part.depth * 0.2;
    const shape = new THREE.Shape();
    shape.moveTo(hd, -hh);
    shape.lineTo(hd, hh);
    shape.lineTo(back, hh);
    shape.quadraticCurveTo(-hd, hh, -hd, -hh + 0.1);
    shape.lineTo(-hd, -hh);
    shape.lineTo(hd, -hh);
    return mergeGeometries([extrudeProfile(part.width, shape, bevel)]);
  }), colorHex, kit);
}

/* Arch 1×4 (parts-survey slice 04): a brick with a half-round opening cut
   from underneath between its end cells, four studs on top. The opening
   still counts as taken (D5). */
function makeArchPiece(part, colorHex, kit) {
  return paintedGroup(kit.geo(part.id, () => {
    const bevel = 0.03;
    const hd = part.depth / 2 - SEAM - bevel;
    const hh = part.height / 2 - bevel;
    const span = part.depth / 2 - 1;
    const shape = new THREE.Shape();
    shape.moveTo(hd, -hh);
    shape.lineTo(hd, hh);
    shape.lineTo(-hd, hh);
    shape.lineTo(-hd, -hh);
    shape.lineTo(-span, -hh);
    shape.absellipse(0, -hh, span, part.height * 0.68, Math.PI, 0, true);
    shape.lineTo(hd, -hh);
    const list = [extrudeProfile(part.width, shape, bevel)];
    addStuds(list, studRow(part.width), studRow(part.depth), part.height / 2);
    return mergeGeometries(list);
  }), colorHex, kit);
}

/* Door (parts-survey slice 04): a frame — two jambs and a studded head, no
   sill — round a closed door with raised panels, all in the picked colour,
   and a small dark knob on each face that recolouring leaves alone (D7). The
   frame runs along z; the door doesn't open (D6). */
function makeDoorPiece(part, colorHex, kit) {
  const hw = part.width / 2 - SEAM;
  const hd = part.depth / 2 - SEAM;
  const hh = part.height / 2;
  const jamb = 0.3;
  const head = 0.4;
  const frame = kit.geo(part.id, () => {
    const list = [boxAt(hw * 2, head, hd * 2, 0, hh - head / 2, 0)];
    [-1, 1].forEach((sz) => list.push(boxAt(hw * 2, part.height - head, jamb, 0, -head / 2, sz * (hd - jamb / 2))));
    const door = part.height - head;
    const width = hd * 2 - jamb * 2;
    list.push(boxAt(0.16, door, width, 0, -head / 2, 0));
    /* Two raised panels on each face. */
    [-1, 1].forEach((sx) => [0.28, 0.72].forEach((at) => {
      list.push(boxAt(0.04, door * 0.36, width * 0.7, sx * 0.1, -hh + door * at, 0));
    }));
    addStuds(list, studRow(part.width), studRow(part.depth), hh);
    return mergeGeometries(list);
  });
  const knobs = kit.geo(`${part.id}:knob`, () => mergeGeometries([-1, 1].map((sx) => {
    const g = new THREE.SphereGeometry(0.07, 10, 8);
    g.translate(sx * 0.13, -hh + (part.height - head) * 0.48, hd - jamb - 0.22);
    return g;
  })));
  const group = new THREE.Group();
  group.add(mesh(frame, kit.mat(colorHex)));
  group.add(mesh(knobs, kit.mat(0x3d4246, 0.4, 0.3), false));
  return group;
}

/* Leaves (parts-survey slice 04): a small round plate with three flattened
   leaves fanned out and up from it; fixed green. */
function makeLeavesPiece(part, kit) {
  const hh = part.height / 2;
  const base = kit.geo("leaves:base", () => {
    const g = new THREE.CylinderGeometry(0.3, 0.32, 0.2, 14);
    g.translate(0, -hh + 0.1, 0);
    return g;
  });
  const leaves = kit.geo("leaves:leaves", () => mergeGeometries([0, 1, 2].map((i) => {
    const g = new THREE.SphereGeometry(0.5, 12, 6);
    g.scale(0.36, 0.08, 1);
    g.translate(0, 0, 0.42);
    g.rotateX(-0.5);
    g.rotateY(i * TAU / 3 + 0.4);
    g.translate(0, -hh + 0.24, 0);
    return g;
  })));
  const group = new THREE.Group();
  group.add(mesh(base, kit.mat(0x2f7d32, 0.6)));
  group.add(mesh(leaves, kit.mat(0x43a047, 0.55)));
  return group;
}

/* Grille tile 1×2 (parts-survey slice 01): a thin base with five bars along
   its length on top, so four shallow grooves run lengthwise; no studs. */
function makeGrillePiece(part, colorHex, kit) {
  return paintedGroup(kit.geo(part.id, () => {
    const hw = part.width / 2 - SEAM;
    const hd = part.depth / 2 - SEAM;
    const hh = part.height / 2;
    const base = 0.24;
    const bars = 5;
    const gap = 0.06;
    const bar = (hw * 2 - gap * (bars - 1)) / bars;
    const list = [boxAt(hw * 2, base, hd * 2, 0, -hh + base / 2, 0)];
    for (let i = 0; i < bars; i += 1) {
      list.push(boxAt(bar, part.height - base, hd * 2, -hw + bar / 2 + i * (bar + gap), hh - (part.height - base) / 2, 0));
    }
    return mergeGeometries(list);
  }), colorHex, kit);
}

/* Quarter tile 1×1 (parts-survey slice 01): a quarter disc of radius one
   stud, its square corner on the footprint's back-left corner. */
function makeQuarterTilePiece(part, colorHex, kit) {
  return paintedGroup(kit.geo(part.id, () => {
    const bevel = 0.02;
    const c = part.width / 2 - SEAM - bevel;
    const r = c * 2;
    /* Shape y becomes world −z after rotateX(−π/2) below. */
    const shape = new THREE.Shape();
    shape.moveTo(-c, c);
    shape.lineTo(-c + r, c);
    shape.absarc(-c, c, r, 0, -Math.PI / 2, true);
    shape.lineTo(-c, c);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: part.height - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 16,
    });
    g.translate(0, 0, -(part.height - bevel * 2) / 2);
    g.rotateX(-Math.PI / 2);
    return mergeGeometries([g]);
  }), colorHex, kit);
}

/* Round plate 2×2 (more-parts slice 01): a disc with chamfered rims and a
   2×2 grid of studs. */
function makeRoundPlatePiece(part, colorHex, kit) {
  const geometry = kit.geo(part.id, () => {
    const r = Math.min(part.width, part.depth) / 2 - SEAM;
    const hh = part.height / 2;
    const c = 0.025;
    /* Lathe profiles run bottom → top so the faces point outwards. */
    const disc = new THREE.LatheGeometry([
      [0, -hh], [r - c, -hh], [r, -hh + c], [r, hh - c], [r - c, hh], [0, hh],
    ].map(([x, y]) => new THREE.Vector2(x, y)), 32);
    const list = [disc];
    if (part.studs) addStuds(list, studRow(part.width), studRow(part.depth), hh);
    return mergeGeometries(list);
  });
  const group = new THREE.Group();
  group.add(mesh(geometry, kit.mat(colorHex)));
  return group;
}

function makeWheelPiece(part, colorHex, kit) {
  const scale = part.wheelScale || 1;
  const tire = kit.geo(`wheel:tire:${scale}`, () => {
    const g = new THREE.LatheGeometry([
      [0.25, -0.21], [0.4, -0.22], [0.46, -0.15], [0.46, 0.15], [0.4, 0.22], [0.25, 0.21],
    ].map(([r, y]) => new THREE.Vector2(r, y)), 28);
    g.rotateZ(Math.PI / 2);
    g.scale(scale, scale, scale);
    return g;
  });
  const hub = kit.geo(`wheel:hub:${scale}`, () => {
    const g = mergeGeometries([
      new THREE.CylinderGeometry(0.27, 0.27, 0.4, 20),
      new THREE.CylinderGeometry(0.1, 0.1, 0.46, 10),
    ]);
    g.rotateZ(Math.PI / 2);
    g.scale(scale, scale, scale);
    return g;
  });
  const group = new THREE.Group();
  group.add(mesh(tire, kit.mat(0x1f2328, 0.62)));
  group.add(mesh(hub, kit.mat(colorHex)));
  return group;
}

/* Track gauge and sleepers (slice 09, D17): every rail is built from the
   catalog's centre-line segments, so straight, curve, T and cross share one
   look and join seamlessly. */
const RAIL_OFFSET = 0.62;
const SLEEPER_STEP = 0.68;
const SLEEPER_END = 0.35;
const RAIL_STEEL = 0x8a9097;

function railBar(length, x, z, angle) {
  const g = new THREE.BoxGeometry(0.12, 0.12, length);
  g.rotateY(angle);
  g.translate(x, 0.03, z);
  return g;
}

function sleeper(x, z, angle) {
  const g = new THREE.BoxGeometry(1.72, 0.1, 0.18);
  g.rotateY(angle);
  g.translate(x, -0.04, z);
  return g;
}

/* Positions along a run of `length`, one sleeper every SLEEPER_STEP. */
function sleeperStops(length) {
  const out = [];
  for (let t = SLEEPER_END; t <= length - SLEEPER_END + 1e-6; t += SLEEPER_STEP) out.push(t);
  return out;
}

function trackGeometries(part) {
  const rails = [];
  const sleepers = [];
  part.track.forEach((segment) => {
    if (segment.type === "pad") {
      const g = new THREE.BoxGeometry(part.width - 0.14, 0.1, part.depth - 0.14);
      g.translate(0, -0.04, 0);
      sleepers.push(g);
    } else if (segment.type === "line") {
      const [ax, az] = segment.from;
      const [bx, bz] = segment.to;
      const length = Math.hypot(bx - ax, bz - az);
      const ux = (bx - ax) / length;
      const uz = (bz - az) / length;
      /* A box's length runs along +z; rotateY(angle) turns +z to (ux, uz). */
      const angle = Math.atan2(ux, uz);
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      [-RAIL_OFFSET, RAIL_OFFSET].forEach((side) => rails.push(railBar(length * 0.98, mx + uz * side, mz - ux * side, angle)));
      if (segment.sleepers !== false) {
        sleeperStops(length).forEach((t) => sleepers.push(sleeper(ax + ux * t, az + uz * t, angle)));
      }
    } else if (segment.type === "arc") {
      const [cx, cz] = segment.centre;
      const from = segment.from * Math.PI / 180;
      const to = segment.to * Math.PI / 180;
      /* Points on the arc are centre + r·(sin a, cos a): angles count from
         +z towards +x, like a connector's direction. */
      [segment.radius - RAIL_OFFSET, segment.radius + RAIL_OFFSET].forEach((r) => {
        const steps = 12;
        for (let i = 0; i < steps; i += 1) {
          const a0 = from + (to - from) * i / steps;
          const a1 = from + (to - from) * (i + 1) / steps;
          const mid = (a0 + a1) / 2;
          const chord = 2 * r * Math.sin(Math.abs(a1 - a0) / 2);
          rails.push(railBar(chord * 1.04, cx + r * Math.sin(mid), cz + r * Math.cos(mid), mid + Math.PI / 2));
        }
      });
      const length = segment.radius * Math.abs(to - from);
      sleeperStops(length).forEach((t) => {
        const a = from + (to - from) * t / length;
        sleepers.push(sleeper(cx + segment.radius * Math.sin(a), cz + segment.radius * Math.cos(a), a + Math.PI / 2));
      });
    }
  });
  return { rails: mergeGeometries(rails), sleepers: mergeGeometries(sleepers) };
}

function makeRailPiece(part, kit) {
  let built = null;
  const build = () => { if (!built) built = trackGeometries(part); return built; };
  const rails = kit.geo(`${part.id}:rails`, () => build().rails);
  const sleepers = kit.geo(`${part.id}:sleepers`, () => build().sleepers);
  const group = new THREE.Group();
  const steel = mesh(rails, kit.mat(RAIL_STEEL, 0.32, 0.45));
  /* The steel glows gold when the rail is on a closed circuit (slice 10). */
  steel.userData.sqblSteel = true;
  group.add(steel);
  group.add(mesh(sleepers, kit.mat(0x6c6e68, 0.4)));
  return group;
}

/* Roof peak 2×2 (slice 09): two 45°-ish faces meeting at a ridge along x,
   with a short upright lip on both sides like the real ridge brick. */
function makePeakPiece(part, colorHex, kit) {
  const geometry = kit.geo(part.id, () => {
    const bevel = 0.03;
    const hd = part.depth / 2 - SEAM - bevel;
    const hh = part.height / 2 - bevel;
    const lip = 0.16;
    const ridge = 0.12;
    const shape = new THREE.Shape();
    shape.moveTo(hd, -hh);
    shape.lineTo(-hd, -hh);
    shape.lineTo(-hd, -hh + lip);
    shape.lineTo(-ridge, hh);
    shape.lineTo(ridge, hh);
    shape.lineTo(hd, -hh + lip);
    shape.lineTo(hd, -hh);
    const length = part.width - SEAM * 2 - bevel * 2;
    const body = new THREE.ExtrudeGeometry(shape, {
      depth: length, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2,
    });
    body.translate(0, 0, -length / 2);
    body.rotateY(Math.PI / 2);
    return mergeGeometries([body]);
  });
  const group = new THREE.Group();
  group.add(mesh(geometry, kit.mat(colorHex)));
  return group;
}

/* Axle 1×2 (slice 09): a studded plate with a grey axle across it, poking
   out both sides where wheels go. */
function makeAxlePiece(part, colorHex, kit) {
  const plate = kit.geo(part.id, () => {
    const list = [bevelBox(part.width - SEAM * 2, part.height, part.depth - SEAM * 2, 0.025)];
    addStuds(list, studRow(part.width), studRow(part.depth), part.height / 2);
    return mergeGeometries(list);
  });
  const rod = kit.geo(`${part.id}:rod`, () => {
    const g = new THREE.CylinderGeometry(0.1, 0.1, part.width + 1.4, 12);
    g.rotateZ(Math.PI / 2);
    g.translate(0, -part.height / 2 + 0.06, 0);
    return g;
  });
  const group = new THREE.Group();
  group.add(mesh(plate, kit.mat(colorHex)));
  group.add(mesh(rod, kit.mat(0x6c6e68, 0.38, 0.3)));
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

/* Model parts (catalog C1): a part is a list of primitives, each in part
   space (x across, y up from the part's floor, z towards its front) with a
   colour slot. Every slot becomes one merged geometry, cached per part, so a
   piece is one draw call per colour. */
const DEG = Math.PI / 180;
const segs = (n, kit) => (kit.cheap ? Math.max(6, Math.round(n * 0.6)) : n);

function prismShape(points, flip = 1) {
  const shape = new THREE.Shape();
  points.forEach(([u, v], i) => (i ? shape.lineTo(u, v * flip) : shape.moveTo(u, v * flip)));
  return shape;
}

/* One primitive → geometry in part space (the floor at y = 0). */
function primitiveGeometry(p, kit) {
  let g;
  let y = 0;
  if (p.box) {
    const [w, h, d] = p.box;
    const bevel = p.bevel == null ? (Math.min(w, h, d) >= 0.3 ? 0.03 : 0) : p.bevel;
    g = bevel ? bevelBox(w, h, d, bevel) : new THREE.BoxGeometry(w, h, d);
    y = h / 2;
  } else if (p.cyl) {
    /* [r, h], or [top r, bottom r, h] for a taper. */
    const [top, b, c] = p.cyl;
    const bottom = c == null ? top : b;
    const h = c == null ? b : c;
    g = new THREE.CylinderGeometry(top, bottom, h, segs(p.seg || 18, kit), 1, !!p.open);
    if (p.axis === "x") { g.rotateZ(Math.PI / 2); y = Math.max(top, bottom); }
    else if (p.axis === "z") { g.rotateX(Math.PI / 2); y = Math.max(top, bottom); }
    else y = h / 2;
  } else if (p.cone) {
    const [r, h] = p.cone;
    g = new THREE.ConeGeometry(r, h, segs(p.seg || 18, kit));
    y = h / 2;
  } else if (p.ball != null) {
    g = new THREE.SphereGeometry(p.ball, segs(p.seg || 14, kit), segs(p.segH || 10, kit));
    y = p.ball * (p.s ? p.s[1] : 1);
  } else if (p.dome != null) {
    g = new THREE.SphereGeometry(p.dome, segs(p.seg || 18, kit), segs(p.segH || 8, kit), 0, TAU, 0, Math.PI / 2);
  } else if (p.torus) {
    const [radius, tube] = p.torus;
    g = new THREE.TorusGeometry(radius, tube, segs(p.segT || 8, kit), segs(p.seg || 20, kit), (p.arc || 360) * DEG);
    if (p.axis === "y") { g.rotateX(Math.PI / 2); y = tube; }
    else if (p.axis === "x") { g.rotateY(Math.PI / 2); y = radius + tube; }
    else y = radius + tube;
  } else if (p.lathe) {
    g = new THREE.LatheGeometry(p.lathe.map(([r, h]) => new THREE.Vector2(r, h)), segs(p.seg || 18, kit));
  } else if (p.prism) {
    const len = p.len || 1;
    const axis = p.axis || "z";
    const bevel = p.bevel || 0;
    const flip = axis === "y" ? -1 : 1;
    const shape = prismShape(p.prism, flip);
    (p.holes || []).forEach((hole) => shape.holes.push(new THREE.Path(hole.map(([u, v]) => new THREE.Vector2(u, v * flip)))));
    g = new THREE.ExtrudeGeometry(shape, {
      depth: len - bevel * 2, bevelEnabled: !!bevel, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 8,
    });
    g.translate(0, 0, -(len - bevel * 2) / 2);
    /* Outline (u, v): z → u across and pushed along x; y → (x, z) plan pushed up. */
    if (axis === "x") g.rotateY(-Math.PI / 2);
    /* A plan pushed up: `at` y is its floor. */
    else if (axis === "y") { g.rotateX(-Math.PI / 2); g.translate(0, len / 2, 0); }
  } else if (p.studs) {
    const list = [];
    const points = Array.isArray(p.studs[0]) ? p.studs : [].concat(...studRow(p.studs[0]).map((x) => studRow(p.studs[1]).map((z) => [x, z])));
    points.forEach(([x, z]) => {
      const stud = studGeometry(segs(12, kit));
      stud.translate(x, 0, z);
      list.push(stud);
    });
    g = mergeGeometries(list);
  } else {
    throw new Error(`unknown primitive in ${JSON.stringify(p)}`);
  }
  if (p.s) g.scale(p.s[0], p.s[1], p.s[2]);
  if (p.rot) {
    if (p.rot[0]) g.rotateX(p.rot[0] * DEG);
    if (p.rot[1]) g.rotateY(p.rot[1] * DEG);
    if (p.rot[2]) g.rotateZ(p.rot[2] * DEG);
  }
  const at = p.at || [0, null, 0];
  /* `at` is the primitive's centre; a missing y sits it on the floor. */
  g.translate(at[0] || 0, at[1] == null ? y : at[1], at[2] || 0);
  return g;
}

/* The colour slots a model uses, `main` (the palette) first. */
function modelSlots(part) {
  const slots = Array.from(new Set(part.model.map((p) => p.c || "main")));
  return slots.sort((a, b) => (a === "main" ? -1 : b === "main" ? 1 : 0));
}

function makeModelPiece(part, colorHex, kit) {
  const group = new THREE.Group();
  modelSlots(part).forEach((slot) => {
    const geometry = kit.geo(`${part.id}:${slot}`, () => {
      const merged = mergeGeometries(part.model.filter((p) => (p.c || "main") === slot).map((p) => primitiveGeometry(p, kit)));
      merged.translate(0, -part.height / 2, 0);
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      return merged;
    });
    const finish = slot === "main" ? null : FINISHES[slot];
    const see = finish && (finish.opacity || finish.emissive);
    group.add(mesh(geometry, slot === "main" ? kit.mat(colorHex) : kit.finish(slot), !see));
  });
  return group;
}

/* A posed model part (moving-parts M1, M2): the body plus one pivot group per
   joint, each holding its own merged geometry per colour slot, cached per
   (part, joint, slot). Joint geometry is built around its pivot so the group
   turns it in place. A sitting figure sits lower and back in its box (M12). */
function makeJointedPiece(part, colorHex, kit, pose) {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  if (isSitting(part, pose)) {
    const off = sitOffset();
    inner.position.set(0, off.y, off.z);
  }
  const angles = jointAngles(part, pose);
  const half = part.height / 2;
  ["", ...Object.keys(part.joints)].forEach((joint) => {
    let holder = inner;
    let pivot = [0, half, 0];
    if (joint) {
      const def = part.joints[joint];
      pivot = def.at;
      holder = new THREE.Group();
      holder.position.set(def.at[0], def.at[1] - half, def.at[2]);
      holder.rotation[def.axis] = angles[joint] * DEG;
      holder.userData.sqblJoint = joint;
      inner.add(holder);
    }
    modelSlots(part).forEach((slot) => {
      const prims = part.model.filter((p) => (p.c || "main") === slot && (p.j || "") === joint);
      if (!prims.length) return;
      const geometry = kit.geo(`${part.id}:${joint || "body"}:${slot}`, () => {
        const merged = mergeGeometries(prims.map((p) => primitiveGeometry(p, kit)));
        merged.translate(-pivot[0], -pivot[1], -pivot[2]);
        merged.computeBoundingBox();
        merged.computeBoundingSphere();
        return merged;
      });
      const finish = slot === "main" ? null : FINISHES[slot];
      const see = finish && (finish.opacity || finish.emissive);
      holder.add(mesh(geometry, slot === "main" ? kit.mat(colorHex) : kit.finish(slot), !see));
    });
  });
  return root;
}

function makePieceMesh(part, colorHex, kit) {
  if (part.model) return makeModelPiece(part, colorHex, kit);
  if (part.shape === "wheel") return makeWheelPiece(part, colorHex, kit);
  if (part.shape === "rail") return makeRailPiece(part, kit);
  if (part.shape === "tree") return makeTreePiece(part, kit);
  if (part.shape === "flower") return makeFlowerPiece(part, colorHex, kit);
  if (part.shape === "slope") return makeSlopePiece(part, colorHex, kit);
  if (part.shape === "peak") return makePeakPiece(part, colorHex, kit);
  if (part.shape === "axle") return makeAxlePiece(part, colorHex, kit);
  if (part.shape === "roundPlate") return makeRoundPlatePiece(part, colorHex, kit);
  if (part.shape === "grille") return makeGrillePiece(part, colorHex, kit);
  if (part.shape === "arch") return makeArchPiece(part, colorHex, kit);
  if (part.shape === "door") return makeDoorPiece(part, colorHex, kit);
  if (part.shape === "leaves") return makeLeavesPiece(part, kit);
  if (part.shape === "cone") return makeConePiece(part, colorHex, kit);
  if (part.shape === "slopeCurved") return makeSlopeCurvedPiece(part, colorHex, kit);
  if (part.shape === "roundedPlate") return makeRoundedPlatePiece(part, colorHex, kit);
  if (part.shape === "cornerPlate") return makeCornerPlatePiece(part, colorHex, kit);
  if (part.shape === "wedgePlate") return makeWedgePlatePiece(part, colorHex, kit);
  if (part.shape === "quarterTile") return makeQuarterTilePiece(part, colorHex, kit);
  if (part.shape === "slopeCorner") return makeSlopeCornerPiece(part, colorHex, kit);
  if (part.shape === "slopeInv") return makeSlopeInvPiece(part, colorHex, kit);
  if (part.shape === "frame") return makeFramePiece(part, colorHex, kit);
  if (part.shape === "brace") return makeBracePiece(part, colorHex, kit);
  if (part.shape === "window") return makeWindowPiece(part, colorHex, kit);
  if (part.shape === "rock") return makeRockPiece(part, kit);
  if (part.shape === "mushroom") return makeMushroomPiece(part, kit);
  if (part.shape === "log") return makeLogPiece(part, kit);
  if (part.shape === "crate") return makeCratePiece(part, colorHex, kit);
  if (part.shape === "barrel") return makeBarrelPiece(part, colorHex, kit);
  if (part.shape === "fencePost") return makeFencePostPiece(part, colorHex, kit);
  if (part.shape === "railing") return makeRailingPiece(part, colorHex, kit);
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

/* The box an existing piece fills: its part, or a sitting minifigure's lower 2x2 (moving-parts M12). */
function shapeOf(piece) {
  return poseShape(getPart(piece.partId), piece.pose);
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
    this.worlds = new BrickWorlds(this.kidId);
    /* Home-wifi session (multiplayer plan D2): unavailable outside the app. */
    this.lan = createLanSession(options.lanTransport);
    this.kids = options.kids || {};
    this.together = new BrickTogether(this, this.lan, this.kidId, options.lanRetryMs ? { retryMs: options.lanRetryMs } : {});
    this.worldId = null; /* the world being built; null while the menu shows */
    this.menuEdit = null; /* { id, step: "actions" | "rename" | "delete" } */
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
    this.baseplateStuds = 0;
    this.bubble = { shown: false, x: NaN, y: NaN, width: 0, height: 0 };
    /* Slice 11: tray search, size filter, favourites, recents, info card. */
    this.query = "";
    this.sizeFilter = "";
    this.prefs = this.cleanPrefs(this.storage.loadPrefs());
    this.infoPartId = null;
    this.railView = "categories"; /* slice 12: "categories" | "parts" */
    this.studsPainted = false; /* slice 13/14: baseplate studs as a texture */
    this.perf = { level: 0, sum: 0, count: 0, last: 0 }; /* slice 14 step-down */
    this.finding = false; /* slice 12: search + size shown under the rail head */
    /* Slice 10: rail joins. `rails` is the last trace; `snap` the join the
       ghost or a dragged rail would make right now. */
    this.rails = { edges: [], linked: new Map(), free: [], circuit: new Set() };
    this.freeEndsCache = null;
    this.snap = null;
  }

  cleanPrefs(prefs) {
    const known = (list, max) => Array.from(new Set(list)).filter((id) => PARTS.some((part) => part.id === id)).slice(0, max);
    return { favorites: known(prefs.favorites, PARTS.length), recents: known(prefs.recents, RECENT_MAX) };
  }

  async mount() {
    /* No OrbitControls: brick-camera.js drives the view (kid-camera plan K7). */
    const runtime = await loadThree(document.createElement("canvas"), false);
    if (this.destroyed) { releaseContext(runtime); return this; }
    this.runtime = runtime;
    THREE = runtime.THREE;
    this.kit = makeKit(this.runtime.reduced);
    this.reducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    this.renderShell();
    await this.cssReady;
    if (this.destroyed) return this;
    this.setupScene();
    this.setupThumbs();
    this.bindUI();
    this.worlds.ensure(() => (this.options.seedDemo === false ? [] : this.settle(createStarterPieces())));
    this.homeView(false);
    this.renderPartTray();
    this.renderColorTray();
    this.updateModeUI();
    this.updateSelectionUI();
    this.showMenu();
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
          <aside class="sqbl-left-rail" data-view="categories" aria-label="Pieces 積木種類">
            <div class="sqbl-rail-head">
              <button type="button" class="sqbl-rail-collapse" data-action="toggle-left" aria-label="Fold 收起">‹</button>
              <button type="button" class="sqbl-rail-back" data-action="parts-back" aria-label="${escapeHtml(label(TRAY.back))}">←</button>
              <div class="sqbl-tray-title" data-tray-title aria-live="polite"></div>
              ${pre ? "" : `<button type="button" class="sqbl-rail-find" data-action="toggle-find" aria-expanded="false" aria-label="${escapeHtml(label(TRAY.search))}">🔍</button>`}
            </div>
            ${pre ? "" : `<label class="sqbl-search"><span aria-hidden="true">🔍</span><input type="search" data-search enterkeyhint="search" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(label(TRAY.search))}" aria-label="${escapeHtml(label(TRAY.search))}"></label>
            <select class="sqbl-size" data-size aria-label="${escapeHtml(label(TRAY.size))}">
              <option value="">${escapeHtml(label(TRAY.allSizes))}</option>
              ${Array.from(new Set(PARTS.map(partDims))).sort((a, b) => a.localeCompare(b, "en", { numeric: true })).map((dims) => `<option value="${dims}">${dims}</option>`).join("")}
            </select>`}
            <div class="sqbl-category-list">${categoryButtons}</div>
            <div class="sqbl-parts" data-parts></div>
            <div class="sqbl-colors" data-colors></div>
          </aside>

          <div class="sqbl-stage-wrap">
            <div class="sqbl-stage" data-stage></div>
            <div class="sqbl-lens" aria-hidden="true"><i class="sqbl-lens-top"></i><i class="sqbl-lens-bottom"></i></div>
            <div class="sqbl-bubble" data-bubble role="toolbar" aria-label="Tools 工具">
              <div class="sqbl-bubble-card">
                ${tool("move", "✥", ["Move", "移動"])}
                ${tool("rotate", "↻", ["Turn", "旋轉"])}
                ${tool("duplicate", "⧉", ["Copy", "複製"])}
                ${tool("pose", "🤸", ["Pose", "姿勢"], " hidden")}
                ${tool("delete", "🗑", ["Remove", "拿掉"], ' class="is-danger"')}
              </div>
            </div>
            <div class="sqbl-stage-hint" data-stage-hint aria-live="polite"></div>
            <div class="sqbl-focus" data-focus hidden>
              <div class="sqbl-focus-vignette" aria-hidden="true"></div>
              <button type="button" class="sqbl-focus-done" data-focus-act="done" aria-label="Done 完成">✓ <span>Done 完成</span></button>
              <div class="sqbl-focus-turn" role="group" aria-label="Turn 轉動">
                <button type="button" data-focus-act="ccw" aria-label="Turn back 往回轉">↺</button>
                <button type="button" data-focus-act="cw" aria-label="Turn 轉動">↻</button>
              </div>
              <div class="sqbl-focus-dock">
                <div class="sqbl-focus-joints" data-focus-joints role="group" aria-label="Parts 部位"></div>
                <div class="sqbl-focus-poses" data-focus-poses role="group" aria-label="Poses 姿勢"></div>
              </div>
            </div>
            <div class="sqbl-cam" role="toolbar" aria-label="Camera 鏡頭">${CAMERA_BUTTONS.map((b) => `
              <button type="button" class="sqbl-cam-btn" data-cam="${b.id}" aria-label="${escapeHtml(label(b.label))}"><svg viewBox="0 0 32 32" aria-hidden="true">${b.icon}</svg></button>`).join("")}
            </div>
            <div class="sqbl-info" data-info role="dialog" aria-modal="false" hidden></div>
            <div class="sqbl-explore-badge">🌍 ${pre ? "" : "Explore 探索"}</div>
            <div class="sqbl-crew" data-crew aria-live="polite" hidden></div>
            <div class="sqbl-lost" data-lost role="status" hidden></div>
          </div>

          <div class="sqbl-menu" data-menu hidden>
            <div class="sqbl-menu-panel">
              <h2 class="sqbl-menu-title"><span aria-hidden="true">🗺️</span> ${escapeHtml(MENU.worlds[0])} <span lang="zh-TW">${escapeHtml(MENU.worlds[1])}</span></h2>
              <div class="sqbl-worlds" data-worlds></div>
              <h2 class="sqbl-menu-title"><span aria-hidden="true">👋</span> ${escapeHtml(MENU.join[0])} <span lang="zh-TW">${escapeHtml(MENU.join[1])}</span></h2>
              <div class="sqbl-join" data-join></div>
            </div>
          </div>
        </div>

        <div class="sqbl-toast" data-toast role="status" aria-live="polite"></div>
      </section>`;

    /* The scene is sized from the styled stage: until the stylesheet is in,
       the stage is the whole mount and the first frames would be stretched. */
    const link = this.root.querySelector("link[rel=stylesheet]");
    this.cssReady = link.sheet ? Promise.resolve() : new Promise((done) => {
      link.addEventListener("load", done, { once: true });
      link.addEventListener("error", done, { once: true });
      setTimeout(done, 3000);
    });

    this.app = this.root.querySelector(".sqbl-app");
    this.stage = this.root.querySelector("[data-stage]");
    this.partsEl = this.root.querySelector("[data-parts]");
    this.colorsEl = this.root.querySelector("[data-colors]");
    this.hintEl = this.root.querySelector("[data-stage-hint]");
    this.toastEl = this.root.querySelector("[data-toast]");
    this.bubbleEl = this.root.querySelector("[data-bubble]");
    this.poseToolEl = this.root.querySelector("[data-action=pose]");
    this.focusEl = this.root.querySelector("[data-focus]");
    this.focusJointsEl = this.root.querySelector("[data-focus-joints]");
    this.focusPosesEl = this.root.querySelector("[data-focus-poses]");
    this.focus = null;
    this.focusHidden = new Set();
    this.leftRail = this.root.querySelector(".sqbl-left-rail");
    this.infoEl = this.root.querySelector("[data-info]");
    this.searchEl = this.root.querySelector("[data-search]");
    this.sizeEl = this.root.querySelector("[data-size]");
    this.menuEl = this.root.querySelector("[data-menu]");
    this.worldsEl = this.root.querySelector("[data-worlds]");
    this.joinEl = this.root.querySelector("[data-join]");
    this.crewEl = this.root.querySelector("[data-crew]");
    this.lostEl = this.root.querySelector("[data-lost]");
  }

  setupScene() {
    this.scene = new THREE.Scene();
    /* The island floats in a sea that fades into the background (slice 06). */
    this.scene.background = new THREE.Color(SEA_BLUE);
    this.scene.fog = new THREE.Fog(SEA_BLUE, 180, 440);
    /* A narrower lens flattens perspective: reads as a tabletop diorama. */
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 640);

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

    /* Kid camera (docs/plans/2026-10-05-brick-lab-kid-camera/): one finger
       slides the island like a map, two fingers pinch / twist, the tilt
       follows the zoom; the view's centre stays over the island (D13). */
    this.cam = createKidCamera({
      camera: this.camera, element: this.renderer.domElement, view: HOME_VIEW, reducedMotion: this.reducedMotion,
      limits: { reach: VIEW_REACH, minDistance: 4, maxDistance: BUILD_MAX_DISTANCE },
    });

    /* Lo-fi lighting (slice 08): cool sky, warm bounce from the ground, a low
       warm late-afternoon sun with long soft shadows, a faint cool rim. */
    const cheap = this.kit.cheap;
    /* Reduced quality (slice 13): no fill light; the sky light lifts a
       little to make up for it. */
    const ambient = new THREE.HemisphereLight(0xc6d8ff, 0xa88a6a, cheap ? 1.4 : 1.2);
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
    this.sun = sun;
    if (!cheap) {
      const fill = new THREE.DirectionalLight(0x9fb6ff, 0.65);
      fill.position.set(-10, 7, -8);
      this.scene.add(fill);
    }

    this.addIsland();

    /* Matter than the bricks: a big glossy plate turns into one white glare. */
    const plastic = this.kit.mat(BASEPLATE_GREEN, 0.55);
    const base = mesh(bevelBox(BASE_HALF * 2, 0.42, BASE_HALF * 2, 0.06), plastic, false);
    base.position.y = -0.21;
    base.userData.sqblGround = true;
    this.scene.add(base);
    this.ground = base;
    if (cheap) {
      this.baseplateStuds = BASE_HALF * 2 * BASE_HALF * 2;
      this.paintStuds();
    } else this.addBaseplateStuds(plastic);

    this.selectionBox = new THREE.Box3();
    this.selectionHelper = new THREE.Box3Helper(this.selectionBox, SELECTION_BLUE);
    this.selectionHelper.visible = false;
    this.selectionHelper.raycast = () => {};
    this.scene.add(this.selectionHelper);
    /* Focus mode (moving-parts F4): the picked joint, outlined in gold. */
    this.jointBox = new THREE.Box3();
    this.jointHelper = new THREE.Box3Helper(this.jointBox, 0xf5b301);
    this.jointHelper.visible = false;
    this.jointHelper.raycast = () => {};
    this.scene.add(this.jointHelper);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.dragPoint = new THREE.Vector3();
    this.bubblePoint = new THREE.Vector3();

    this.ghost = new THREE.Group();
    this.ghost.visible = false;
    this.ghost.raycast = () => {};
    this.scene.add(this.ghost);

    /* Rail end dots and the dashed join guide (slice 10); shared geometry
       and materials come from the kit, so destroy() frees them. */
    this.markers = new THREE.Group();
    this.markers.raycast = () => {};
    this.scene.add(this.markers);
    const guideGeometry = new THREE.BufferGeometry();
    guideGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    this.guideLine = new THREE.Line(guideGeometry, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.35, gapSize: 0.22, transparent: true, opacity: 0.9 }));
    this.guideLine.visible = false;
    this.guideLine.raycast = () => {};
    this.guideLine.renderOrder = 2;
    this.scene.add(this.guideLine);

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
      const rocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), litMaterial(this.kit.cheap, { roughness: 0.92 }), cells.length * 2);
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
      const plane = new THREE.Mesh(geometry, litMaterial(this.kit.cheap, { color, roughness: 0.85 }));
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = y;
      plane.receiveShadow = true;
      this.scene.add(plane);
    };
    water(new THREE.ShapeGeometry(shallowShape, 8), 0x62a6d6, sea + 0.05);
    water(new THREE.CircleGeometry(520, 48), SEA_BLUE, sea);
  }

  /* Reduced quality (slice 13), or a step-down (slice 14): the 64×64 studs as a repeating texture, not
     ~147k triangles of geometry. The extrusion's lid UVs are world units, so
     one tile is one stud, centred on the half-units like the real ones. Seen
     from the home view (+x/+z, also where the sun is) a stud shows its sunlit
     wall below and right of its top: canvas bottom-right once it is flipped
     onto the plate. Values sit under white so the wall can rise above the
     plate; the colour is lifted to match. */
  paintedStuds() {
    return this.kit.custom("plate:painted", () => {
      const size = 64;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const g = canvas.getContext("2d");
      const c = size / 2;
      const r = STUD_R * size;
      const disc = (x, y, radius, fill) => { g.fillStyle = fill; g.beginPath(); g.arc(x, y, radius, 0, TAU); g.fill(); };
      g.fillStyle = "#e2e2e2";
      g.fillRect(0, 0, size, size);
      disc(c + 2, c + 3, r + 1.6, "rgba(0,0,0,.38)");
      disc(c + 2, c + 3, r, "#ffffff");
      const top = g.createLinearGradient(c - r, c - r, c + r, c + r);
      top.addColorStop(0, "#d2d2d2");
      top.addColorStop(1, "#ebebeb");
      disc(c, c, r, top);
      const map = this.kit.custom("plate:studs", () => new THREE.CanvasTexture(canvas));
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.colorSpace = THREE.SRGBColorSpace;
      const material = litMaterial(this.kit.cheap, { color: BASEPLATE_GREEN, roughness: 0.55, map });
      material.color.multiplyScalar(1.31); /* #e2 in sRGB is 0.76 linear */
      return material;
    });
  }

  /* The plate's top face (group 0 of the extrusion) takes the painted studs;
     the sides stay plain plastic. */
  paintStuds() {
    if (this.studsPainted) return false;
    this.ground.material = [this.paintedStuds(), this.ground.material];
    if (this.baseStudMesh) this.baseStudMesh.visible = false;
    this.studsPainted = true;
    return true;
  }

  /* Step-down (slice 14): a standard-tier tablet that can't keep up while the
     view moves quietly loses detail, one step per slow 2 s of drawing: pixel
     ratio 1, then painted studs, then no shadows. Only frames drawn back to
     back count; a pause (idle, a shader compile) starts the count over. It
     never steps back up during a visit. */
  measureFrame(time) {
    const perf = this.perf;
    const gap = time - perf.last;
    perf.last = time;
    if (this.kit.cheap || perf.level >= 3 || gap > 250) {
      perf.sum = 0;
      perf.count = 0;
      return;
    }
    perf.sum += gap;
    perf.count += 1;
    if (perf.sum < 2000) return;
    const slow = perf.sum / perf.count > SLOW_FRAME_MS;
    perf.sum = 0;
    perf.count = 0;
    if (slow) this.stepDown();
  }

  stepDown() {
    const steps = [
      () => {
        if (this.renderer.getPixelRatio() <= 1) return false;
        this.renderer.setPixelRatio(1);
        this.resize();
        return true;
      },
      () => this.paintStuds(),
      () => {
        if (!this.sun.castShadow) return false;
        this.sun.castShadow = false; /* the lights change, so materials rebuild without shadows */
        return true;
      },
    ];
    while (this.perf.level < steps.length) {
      if (steps[this.perf.level++]()) break;
    }
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
    this.baseStudMesh = studs;
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
    this.invalidate();
    if (this.categoryListEl) [this.categoryListEl, this.partsEl].forEach((list) => this.markScrollable(list));
    if (this.markColorsScrollable) this.markColorsScrollable();
  }

  bindUI() {
    this.root.querySelectorAll("[data-mode-button]").forEach((button) => {
      button.addEventListener("pointerdown", () => this.setMode(button.dataset.modeButton));
    });

    /* click, not pointerdown: the list scrolls on a short tablet, and a
       finger that scrolls it must not pick the category it started on. */
    this.root.querySelectorAll("[data-category]").forEach((button) => {
      button.addEventListener("click", () => {
        this.activeCategory = button.dataset.category;
        this.activePartId = (PARTS.find((part) => part.category === this.activeCategory) || PARTS[0]).id;
        /* Picking a category leaves a search: the tray shows that category again. */
        this.setFilters("", "", false);
        this.setFinding(false);
        this.hideInfo();
        this.renderPartTray();
        this.partsEl.scrollTop = 0;
        this.setRailView("parts");
        this.placementArmed = false;
        this.ghost.visible = false;
        this.snap = null;
        this.updateRailMarks();
        this.setHint("🧱", HINTS.choose);
      });
    });

    this.root.querySelector("[data-action=save]").addEventListener("pointerdown", () => this.saveNow(true));
    this.root.querySelector("[data-action=undo]").addEventListener("pointerdown", () => this.undo());
    this.root.querySelector("[data-action=home-view]").addEventListener("pointerdown", () => this.homeView());
    /* K3: ↺ turns the island anticlockwise on screen, ↻ clockwise; one zoom step each. */
    const camActions = { left: () => this.cam.turn(-45), right: () => this.cam.turn(45), in: () => this.cam.zoom(0.7), out: () => this.cam.zoom(1 / 0.7) };
    this.root.querySelectorAll("[data-cam]").forEach((button) => button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      camActions[button.dataset.cam]();
      this.haptic("tap");
    }));
    this.root.querySelector("[data-action=rotate]").addEventListener("pointerdown", () => this.rotateSelected());
    this.root.querySelector("[data-action=duplicate]").addEventListener("pointerdown", () => this.duplicateSelected());
    this.root.querySelector("[data-action=delete]").addEventListener("pointerdown", () => this.deleteSelected());
    this.root.querySelector("[data-action=move]").addEventListener("pointerdown", () => this.beginMoveSelected());
    this.poseToolEl.addEventListener("pointerdown", () => this.enterFocus(this.selectedId));
    this.focusEl.addEventListener("click", (event) => {
      const button = event.target.closest("[data-focus-act],[data-focus-pose],[data-focus-joint]");
      if (!button || !this.focus) return;
      if (button.dataset.focusPose) this.setPose(this.focus.id, { p: button.dataset.focusPose });
      else if (button.dataset.focusJoint) this.pickJoint(button.dataset.focusJoint);
      else if (button.dataset.focusAct === "done") this.leaveFocus();
      else if (button.dataset.focusAct === "cw") this.turnJoint(1);
      else if (button.dataset.focusAct === "ccw") this.turnJoint(-1);
      this.haptic("tap");
    });
    this.root.querySelector("[data-action=toggle-left]").addEventListener("pointerdown", () => this.leftRail.classList.toggle("is-collapsed"));
    this.root.querySelector("[data-action=parts-back]").addEventListener("pointerdown", () => {
      this.setFilters("", "");
      this.setFinding(false);
      this.setRailView("categories");
    });
    /* 🔍 opens search + size and focuses the box; tapping it again clears
       any filter and closes them. preventDefault keeps the focus in the box. */
    const find = this.root.querySelector("[data-action=toggle-find]");
    if (find) find.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (this.finding) {
        if (this.query || this.sizeFilter) this.setFilters("", "");
        this.setFinding(false);
      } else {
        this.setFinding(true);
        this.searchEl.focus();
      }
    });

    /* Tray (slice 11): one delegated listener survives every re-render. The
       star toggles a favourite; the rest of a tile arms the part and opens its
       info card. click, not pointerdown: a swipe that scrolls the tray must
       not pick a part. */
    this.partsEl.addEventListener("click", (event) => {
      /* The click that ends a drag out of the tray is not a tap (slice 15). */
      if (this.trayDragEnded) { this.trayDragEnded = false; return; }
      const star = event.target.closest("[data-fav]");
      if (star) { this.toggleFavorite(star.dataset.fav); return; }
      const tile = event.target.closest("[data-part]");
      if (!tile) return;
      this.activePartId = tile.dataset.part;
      this.markActivePart();
      this.armPlacement(this.activePartId);
      this.showInfo(this.activePartId);
    });
    this.bindTrayDrag();
    /* A list with more below fades out at its foot, so a kid knows to scroll. */
    this.categoryListEl = this.root.querySelector(".sqbl-category-list");
    [this.categoryListEl, this.partsEl].forEach((list) => list.addEventListener("scroll", () => this.markScrollable(list), { passive: true }));
    if (this.searchEl) {
      this.searchEl.addEventListener("input", () => this.setFilters(this.searchEl.value, this.sizeFilter));
      this.searchEl.addEventListener("keydown", (event) => { if (event.key === "Enter") this.searchEl.blur(); });
    }
    if (this.sizeEl) this.sizeEl.addEventListener("change", () => this.setFilters(this.query, this.sizeEl.value));
    this.infoEl.addEventListener("click", (event) => {
      const action = event.target.closest("[data-info-action]");
      if (!action) return;
      if (action.dataset.infoAction === "close") this.hideInfo();
      else this.toggleFavorite(this.infoPartId);
    });
    /* Tap anywhere else closes the card (the tray tap that opens it comes after). */
    this.onOutsidePress = (event) => {
      if (this.infoPartId && !this.infoEl.contains(event.target)) this.hideInfo();
    };
    this.root.addEventListener("pointerdown", this.onOutsidePress, true);
    this.onPause = () => this.onAppPause();
    this.onResume = () => this.onAppResume();
    window.addEventListener("summerquest:native-pause", this.onPause);
    window.addEventListener("summerquest:native-resume", this.onResume);
    this.menuEl.addEventListener("click", (event) => this.onMenuClick(event));
    this.menuEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || !event.target.matches("[data-world-name]")) return;
      event.preventDefault();
      event.target.closest("[data-world]").querySelector('[data-world-act="rename-save"]').click();
    });
    /* Every scene change starts from input; any input keeps frames coming
       for a moment (slice 13). A restored GL context needs a fresh frame. */
    this.onInput = () => this.invalidate();
    INPUT_EVENTS.forEach((type) => this.root.addEventListener(type, this.onInput, { capture: true, passive: true }));
    this.renderer.domElement.addEventListener("webglcontextrestored", this.onInput);

    /* Capture phase on the stage runs before the camera's own listener on
       the canvas, so a press on the selected piece can suspend the camera. */
    this.stage.addEventListener("pointerdown", (event) => this.onDragStart(event), true);

    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", (event) => {
      this.pointerDown = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    });
    canvas.addEventListener("pointermove", (event) => this.onPointerMove(event));
    canvas.addEventListener("pointerup", (event) => {
      if (this.onDragEnd(event, false)) { this.pointerDown = null; return; }
      if (this.drag) return; /* a second finger during a drag is not a tap */
      if (this.cam.moved()) { this.pointerDown = null; return; } /* a slide or a pinch is not a tap */
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

  /* Part icons are the real part in the picked colour (multiplayer plan
     D12, slice 08). Only icons on screen are drawn; until one is ready the
     CSS drawing stands in. */
  setupThumbs() {
    this.thumbs = createThumbs({ THREE, renderer: this.renderer, cheap: this.kit.cheap, perFrame: this.kit.cheap ? 1 : 3 });
    this.thumbs.onReady((key, url) => {
      this.root.querySelectorAll(".sqbl-part-preview[data-thumb-want], .sqbl-pose-pic[data-thumb-want]").forEach((el) => {
        if (el.dataset.thumbWant === key) this.setThumb(el, key, url);
      });
    });
    this.shownPreviews = new Set();
    this.previewWatch = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.shownPreviews.add(entry.target);
          this.paintPreview(entry.target);
        } else this.shownPreviews.delete(entry.target);
      });
    });
  }

  thumbKey(part) {
    return isFixedColor(part) ? part.id : `${part.id}:${this.activeColorId}`;
  }

  setThumb(el, key, url) {
    let img = el.firstElementChild;
    if (!img) {
      img = document.createElement("img");
      img.alt = "";
      img.draggable = false;
      el.appendChild(img);
    }
    img.src = url;
    el.dataset.thumb = key;
    delete el.dataset.thumbWant;
    el.classList.add("has-pic");
  }

  paintPreview(el) {
    if (!this.thumbs || !el.isConnected) return;
    const part = getPart(el.dataset.preview);
    const key = this.thumbKey(part);
    if (el.dataset.thumb === key) return;
    const url = this.thumbs.get(key);
    if (url) { this.setThumb(el, key, url); return; }
    /* Keep the old picture (other colour) until the new one is ready. */
    el.dataset.thumbWant = key;
    const colorHex = getColorHex(this.activeColorId);
    this.thumbs.want(key, () => makePieceMesh(part, colorHex, this.kit), (object) => disposeTree(object));
  }

  watchPreviews(container, fresh) {
    if (!this.previewWatch) return;
    if (fresh) {
      this.previewWatch.disconnect();
      this.shownPreviews.clear();
      this.thumbs.cancel();
    }
    container.querySelectorAll(".sqbl-part-preview").forEach((el) => this.previewWatch.observe(el));
  }

  /* Slice 12 (D23): the rail shows the categories, or one category's parts
     (or search results). Its width never changes between the two, so the 3D
     view never resizes (D14); opening a category unfolds a folded rail. */
  setRailView(view) {
    this.railView = view;
    this.leftRail.dataset.view = view;
    if (view === "parts") this.leftRail.classList.remove("is-collapsed");
    this.updateCategoryUI();
    this.markScrollable(view === "parts" ? this.partsEl : this.categoryListEl);
  }

  /* Search and size stay folded under 🔍 so a short tablet shows more parts
     (slice 12). Height inside the rail only: the canvas never resizes. */
  setFinding(on) {
    this.finding = !!on;
    this.leftRail.classList.toggle("is-finding", this.finding);
    const find = this.root.querySelector("[data-action=toggle-find]");
    if (find) {
      find.classList.toggle("is-on", this.finding);
      find.setAttribute("aria-expanded", String(this.finding));
    }
    if (!this.finding && this.searchEl) this.searchEl.blur();
  }

  /* Slice 15: press a part and slide it sideways out of the rail; the ghost
     follows the finger over the plate and letting go places it, exactly as a
     tap there would. A mostly vertical slide still scrolls the rail (the tiles
     are touch-action: pan-y). Let go over the rail and the part just stays
     armed, as after a tap. */
  bindTrayDrag() {
    const canvas = this.renderer.domElement;
    const overCanvas = (event) => {
      const r = canvas.getBoundingClientRect();
      return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
    };
    this.partsEl.addEventListener("pointerdown", (event) => {
      this.trayDragEnded = false;
      const tile = event.target.closest("[data-part]");
      if (!tile || this.mode !== "build" || event.button > 0) return;
      this.trayDrag = { tile, partId: tile.dataset.part, x: event.clientX, y: event.clientY, id: event.pointerId, active: false };
    });
    this.partsEl.addEventListener("pointermove", (event) => {
      const drag = this.trayDrag;
      if (!drag || drag.id !== event.pointerId) return;
      if (!drag.active) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (Math.abs(dx) < DRAG_START || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        drag.active = true;
        try { drag.tile.setPointerCapture(event.pointerId); } catch (error) { /* already released */ }
        this.hideInfo();
        this.activePartId = drag.partId;
        this.markActivePart();
        this.armPlacement(drag.partId);
        this.setHint("☝️", HINTS.dragDrop);
      }
      if (overCanvas(event)) this.ghostAt(event);
      else this.ghost.visible = false;
    });
    const end = (event, cancelled) => {
      const drag = this.trayDrag;
      if (!drag || drag.id !== event.pointerId) return;
      this.trayDrag = null;
      if (!drag.active) return;
      this.trayDragEnded = true;
      if (!cancelled && overCanvas(event) && this.placementArmed) this.onTap(event);
      else {
        this.ghost.visible = false;
        this.setHint("☝️", HINTS.place);
      }
    };
    this.partsEl.addEventListener("pointerup", (event) => end(event, false));
    this.partsEl.addEventListener("pointercancel", (event) => end(event, true));
  }

  markScrollable(list) {
    list.classList.toggle("has-more", list.scrollTop + list.clientHeight < list.scrollHeight - 2);
  }

  updateCategoryUI() {
    this.root.querySelectorAll("[data-category]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.category === this.activeCategory);
    });
    const category = CATEGORIES.find((item) => item.id === this.activeCategory);
    const title = this.root.querySelector("[data-tray-title]");
    if (!title) return;
    const searching = !!(this.query || this.sizeFilter);
    const count = this.trayCount || 0;
    const name = this.railView !== "parts" ? TRAY.pieces : searching ? TRAY.results : (category && category.label) || TRAY.pieces;
    if (this.preReader) {
      title.textContent = this.railView !== "parts" ? "🧱" : `${searching ? "🔍" : (category && category.icon) || "🧱"} ${count}`;
      return;
    }
    /* Two lines, "Bricks" / "積木 · 9", so the title fits between the head
       buttons (slice 12); the full sentence is the accessible name. */
    const tail = this.railView === "parts" ? ` · ${count}` : "";
    title.innerHTML = `<span>${escapeHtml(name[0])}</span><span lang="zh-TW">${escapeHtml(name[1] + tail)}</span>`;
    title.setAttribute("aria-label", this.railView === "parts" ? `${label(name)}: ${label(TRAY.parts(count))}` : label(name));
  }

  /* Slice 11: favourites and recents pinned at the front of the tray, then
     the category; a search or size filter shows matches from every category
     instead. The rail keeps its fixed width (D14, D23), the grid only scrolls. */
  renderPartTray() {
    const filtering = !!(this.query || this.sizeFilter);
    const sections = [];
    let count = 0;
    if (filtering) {
      const found = PARTS.filter((part) => partMatches(part, this.query) && (!this.sizeFilter || partDims(part) === this.sizeFilter));
      count = found.length;
      sections.push({ id: "results", parts: found });
    } else {
      const byId = (ids) => ids.map((id) => getPart(id));
      if (this.prefs.favorites.length) sections.push({ id: "favorites", icon: "★", title: TRAY.favorites, parts: byId(this.prefs.favorites) });
      if (this.prefs.recents.length) sections.push({ id: "recents", icon: "🕘", title: TRAY.recents, parts: byId(this.prefs.recents) });
      const parts = PARTS.filter((part) => part.category === this.activeCategory);
      count = parts.length;
      sections.push({ id: "category", parts });
    }
    const tile = (part) => {
      const fav = this.prefs.favorites.includes(part.id);
      return `
      <div class="sqbl-part-slot">
        <button type="button" class="sqbl-part${part.id === this.activePartId ? " is-active" : ""}" data-part="${part.id}" aria-label="${escapeHtml(label(part.label))}">
          <span class="sqbl-part-preview" data-shape="${part.shape}" data-preview="${part.id}" aria-hidden="true"></span>
          <b>${escapeHtml(partLabel(part, this.preReader))}</b>
        </button>
        <button type="button" class="sqbl-fav${fav ? " is-on" : ""}" data-fav="${part.id}" aria-pressed="${fav}" aria-label="${escapeHtml(label(TRAY.favorite))} · ${escapeHtml(label(part.label))}">${fav ? "★" : "☆"}</button>
      </div>`;
    };
    this.partsEl.innerHTML = sections.map((section) => {
      const head = section.title
        ? `<span class="sqbl-tray-sep" data-section="${section.id}" title="${escapeHtml(label(section.title))}"><span aria-hidden="true">${section.icon}</span><small>${this.preReader ? "" : escapeHtml(label(section.title))}</small>${this.preReader ? `<span class="sqbl-sr">${escapeHtml(label(section.title))}</span>` : ""}</span>`
        : "";
      const body = section.parts.length ? section.parts.map(tile).join("")
        : `<p class="sqbl-tray-empty">${this.preReader ? "🔍 ∅" : escapeHtml(say(TRAY.none))}</p>`;
      return head + body;
    }).join("");
    this.trayCount = count;
    this.watchPreviews(this.partsEl, true);
    if (this.infoPartId) this.watchPreviews(this.infoEl, false);
    this.markScrollable(this.partsEl);
    this.updateCategoryUI();
  }

  markActivePart() {
    this.partsEl.querySelectorAll("[data-part]").forEach((item) => item.classList.toggle("is-active", item.dataset.part === this.activePartId));
  }

  setFilters(query, size, render = true) {
    this.query = searchText(query);
    this.sizeFilter = size || "";
    if (this.searchEl && searchText(this.searchEl.value) !== this.query) this.searchEl.value = query || "";
    if (this.sizeEl && this.sizeEl.value !== this.sizeFilter) this.sizeEl.value = this.sizeFilter;
    if (this.query || this.sizeFilter) this.setRailView("parts");
    if (render) this.renderPartTray();
  }

  toggleFavorite(partId) {
    if (!partId) return;
    const list = this.prefs.favorites;
    const at = list.indexOf(partId);
    if (at >= 0) list.splice(at, 1);
    else list.push(partId);
    this.storage.savePrefs(this.prefs);
    const scroll = this.partsEl.scrollTop;
    this.renderPartTray();
    this.partsEl.scrollTop = scroll;
    if (this.infoPartId === partId) this.showInfo(partId);
    this.haptic("tap");
  }

  rememberRecent(partId) {
    const list = [partId].concat(this.prefs.recents.filter((id) => id !== partId)).slice(0, RECENT_MAX);
    if (list.join() === this.prefs.recents.join()) return;
    this.prefs.recents = list;
    this.storage.savePrefs(this.prefs);
    /* Re-render only outside a search: the recents row is not shown then. */
    if (!this.query && !this.sizeFilter) {
      const scroll = this.partsEl.scrollTop;
      this.renderPartTray();
      this.partsEl.scrollTop = scroll;
    }
  }

  /* Small card over the bottom-left of the view: an overlay, so it never
     resizes the 3D canvas (D9). */
  showInfo(partId) {
    const part = getPart(partId);
    const pre = this.preReader;
    const fav = this.prefs.favorites.includes(part.id);
    const fixed = isFixedColor(part);
    const line = (pair) => (pre ? "" : `<p>${escapeHtml(say(pair))}</p>`);
    const swatches = fixed ? "" : `<div class="sqbl-info-swatches" aria-hidden="true">${Object.keys(COLORS).map((id) => `<i style="background:${cssHex(getColorHex(id))}"></i>`).join("")}</div>`;
    this.infoEl.innerHTML = `
      <div class="sqbl-info-head">
        <span class="sqbl-part-preview" data-shape="${part.shape}" data-preview="${part.id}" aria-hidden="true"></span>
        <div><strong>${escapeHtml(part.label[0])}</strong><strong lang="zh-TW">${escapeHtml(part.label[1])}</strong></div>
        <button type="button" class="sqbl-info-fav${fav ? " is-on" : ""}" data-info-action="favorite" aria-pressed="${fav}" aria-label="${escapeHtml(label(TRAY.favorite))}">${fav ? "★" : "☆"}</button>
        <button type="button" class="sqbl-info-close" data-info-action="close" aria-label="${escapeHtml(label(TRAY.close))}">✕</button>
      </div>
      <p class="sqbl-info-dims"><b>${escapeHtml(partDims(part))}</b>${pre ? "" : ` ${escapeHtml(label(TRAY.studs))} · ${escapeHtml(label(heightText(part)))}`}</p>
      ${line(fixed ? TRAY.ownColours : TRAY.colours(Object.keys(COLORS).length))}
      ${swatches}
      ${isRail(part) ? line(TRAY.railEnds(part.connectors.length)) : ""}
      ${line(snapGuide(part))}`;
    this.infoEl.hidden = false;
    this.infoPartId = part.id;
    this.watchPreviews(this.infoEl, false);
  }

  hideInfo() {
    if (!this.infoPartId) return;
    this.infoEl.hidden = true;
    this.infoPartId = null;
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
    /* 21 colours slide sideways in three rows (catalog C3); a fade at the
       right edge says there are more. */
    const sideways = () => this.colorsEl.classList.toggle("has-more-x",
      this.colorsEl.scrollLeft + this.colorsEl.clientWidth < this.colorsEl.scrollWidth - 2);
    if (!this.markColorsScrollable) this.colorsEl.addEventListener("scroll", () => this.markColorsScrollable(), { passive: true });
    this.markColorsScrollable = sideways;
    sideways();
    this.setActiveColor(this.activeColorId, true);
  }

  setActiveColor(colorId, force = false) {
    if (colorId === this.activeColorId && !force) return;
    this.activeColorId = colorId;
    this.colorsEl.querySelectorAll("[data-color]").forEach((item) => item.classList.toggle("is-active", item.dataset.color === colorId));
    /* A selected gold piece shows its swatch even when it sits past the edge. */
    const swatch = this.colorsEl.querySelector(`[data-color="${colorId}"]`);
    if (swatch) {
      const left = swatch.offsetLeft - this.colorsEl.offsetLeft;
      const view = this.colorsEl;
      if (left < view.scrollLeft) view.scrollLeft = left;
      else if (left + swatch.offsetWidth > view.scrollLeft + view.clientWidth) view.scrollLeft = left + swatch.offsetWidth - view.clientWidth;
    }
    this.app.style.setProperty("--sqbl-piece", cssHex(getColorHex(colorId)));
    if (this.shownPreviews) this.shownPreviews.forEach((el) => this.paintPreview(el));
  }

  /* Multiplayer plan slice 01 (D3): the lab opens on the kid's worlds.
     Opening one loads it onto the plate; Back saves it, keeps a small
     picture for its card and comes back here. */
  showMenu() {
    this.menuEdit = null;
    this.renderMenu();
    this.together.startLooking();
    this.renderJoin();
    this.renderCrew();
    this.menuEl.hidden = false;
    this.app.classList.add("is-menu");
    this.hideInfo();
    this.invalidate();
  }

  hideMenu() {
    this.together.stopLooking();
    this.menuEl.hidden = true;
    this.app.classList.remove("is-menu");
    this.menuEdit = null;
  }

  renderMenu() {
    const pre = this.preReader;
    const button = (attrs, icon, pair, cls = "") => `<button type="button" class="sqbl-menu-btn${cls}" ${attrs} aria-label="${escapeHtml(label(pair))}"><span aria-hidden="true">${icon}</span>${pre ? "" : ` ${escapeHtml(label(pair))}`}</button>`;
    const card = (world) => {
      const edit = this.menuEdit && this.menuEdit.id === world.id ? this.menuEdit.step : "";
      const pic = world.thumb ? `<img src="${escapeHtml(world.thumb)}" alt="" draggable="false">` : `<span aria-hidden="true">🧱</span>`;
      const name = escapeHtml(world.name);
      let foot = "";
      if (edit === "rename") {
        foot = `<input type="text" class="sqbl-world-name-input" data-world-name maxlength="40" value="${name}" aria-label="${escapeHtml(label(MENU.name))}" enterkeyhint="done" autocomplete="off" spellcheck="false">
          <div class="sqbl-world-actions">${button('data-world-act="rename-save"', "✓", MENU.save, " is-primary")}${button('data-world-act="cancel"', "✕", MENU.cancel)}</div>`;
      } else if (edit === "delete") {
        foot = `<p class="sqbl-world-ask">${pre ? "🗑 ?" : escapeHtml(say(MENU.sure))}</p>
          <div class="sqbl-world-actions">${button('data-world-act="delete-yes"', "🗑", MENU.remove)}${button('data-world-act="cancel"', "↩", MENU.keep, " is-primary")}</div>`;
      } else if (edit === "actions") {
        foot = `<div class="sqbl-world-actions">${pre ? "" : button('data-world-act="rename"', "✏️", MENU.rename)}${button('data-world-act="delete"', "🗑", MENU.remove)}${button('data-world-act="cancel"', "✕", MENU.close)}</div>`;
      }
      return `
      <div class="sqbl-world${edit ? " is-editing" : ""}" data-world="${escapeHtml(world.id)}">
        <button type="button" class="sqbl-world-open" data-world-open="${escapeHtml(world.id)}" aria-label="${escapeHtml(label(MENU.open))} · ${name}"${edit ? " disabled" : ""}>
          <span class="sqbl-world-pic">${pic}</span>
          ${pre ? "" : `<b class="sqbl-world-name">${name}</b>`}
          <small class="sqbl-world-count">🧱 ${pre ? world.count : escapeHtml(say(MENU.bricks(world.count)))}</small>
        </button>
        ${edit ? "" : `<button type="button" class="sqbl-world-more" data-world-act="more" aria-label="${escapeHtml(label(MENU.more))} · ${name}">⋯</button>`}
        ${foot}
      </div>`;
    };
    this.worldsEl.innerHTML = `
      <button type="button" class="sqbl-world-new" data-world-new aria-label="${escapeHtml(label(MENU.newWorld))}">
        <span class="sqbl-world-pic" aria-hidden="true">＋</span>${pre ? "" : `<b>${escapeHtml(label(MENU.newWorld))}</b>`}
      </button>
      ${this.worlds.list().map(card).join("")}`;
    const input = this.worldsEl.querySelector("[data-world-name]");
    if (input) {
      input.focus();
      input.select();
    }
  }

  onMenuClick(event) {
    const target = event.target.closest("button");
    if (!target || !this.menuEl.contains(target)) return;
    if (target.hasAttribute("data-world-new")) {
      const world = this.worlds.create(this.worlds.nextName());
      if (world) this.openWorld(world.id);
      return;
    }
    if (target.dataset.worldOpen) {
      this.openWorld(target.dataset.worldOpen);
      return;
    }
    if (target.dataset.joinWorld) {
      this.joinWorld(target.dataset.joinWorld);
      return;
    }
    const act = target.dataset.worldAct;
    const card = target.closest("[data-world]");
    if (!act || !card) return;
    const id = card.dataset.world;
    if (act === "more") this.menuEdit = { id, step: "actions" };
    else if (act === "rename") this.menuEdit = { id, step: "rename" };
    else if (act === "delete") this.menuEdit = { id, step: "delete" };
    else if (act === "rename-save") {
      const input = card.querySelector("[data-world-name]");
      if (input) this.worlds.rename(id, input.value);
      this.menuEdit = null;
    } else if (act === "delete-yes") {
      this.worlds.remove(id);
      this.menuEdit = null;
      this.toast(this.preReader ? "🗑" : say(MENU.removed));
    } else this.menuEdit = null;
    this.renderMenu();
  }

  /* Back: close an open card action first, then leave the world for the menu;
     on the menu itself Back belongs to the host. */
  back() {
    if (this.destroyed || !this.menuEl) return false;
    if (this.focus) return this.leaveFocus();
    if (!this.menuEl.hidden) {
      if (!this.menuEdit) return false;
      this.menuEdit = null;
      this.renderMenu();
      return true;
    }
    return this.leaveWorld();
  }

  clearPlate() {
    this.selectPiece(null);
    this.moveId = null;
    this.snap = null;
    this.placementArmed = false;
    this.ghost.visible = false;
    for (const id of Array.from(this.pieces.keys())) this.removePiece(id, false);
    this.history = [];
    this.updateUndoUI();
    this.syncRails();
  }

  openWorld(id) {
    const saved = this.worlds.load(id);
    if (!saved) { this.renderMenu(); return false; }
    this.clearPlate();
    this.worldId = id;
    const stale = saved.grid !== GRID_VERSION;
    const pieces = stale ? this.settle(saved.pieces) : saved.pieces;
    pieces.forEach((instance) => this.addPiece(instance, false));
    this.sequencer = createSequencer({ world: this.pieces, rules: this.shareRules() });
    this.syncRails();
    if (stale && pieces.length) this.scheduleSave();
    this.setMode("build", { quiet: true });
    this.homeView(false);
    this.setHint("🧱", HINTS.choose);
    this.hideMenu();
    this.invalidate(1000);
    /* Opening a world puts it on the home wifi (D4). */
    this.together.host(this.currentWorldName());
    this.updateUndoUI();
    return true;
  }

  leaveWorld() {
    this.leaveFocus();
    if (this.together.role === "guest") {
      this.together.leave();
      this.endShared();
      return true;
    }
    if (!this.worldId) return false;
    clearTimeout(this.saveTimer);
    this.together.stopHosting();
    this.sharedChanged();
    this.saveNow(false, this.captureThumb());
    this.worldId = null;
    this.sequencer = null;
    this.clearPlate();
    this.showMenu();
    return true;
  }

  /* ---------- building together (multiplayer plan slices 05-06) ---------- */

  kidName(kid) {
    return (this.kids[kid] && this.kids[kid].name) || kid;
  }

  kidLook(kid) {
    const info = this.kids[kid] || {};
    return { name: info.name || kid, av: info.av || "🧱", color: /^#[0-9a-f]{6}$/i.test(info.raw || "") ? info.raw : "#7a8ca0" };
  }

  currentWorldName() {
    const meta = this.worldId && this.worlds.meta(this.worldId);
    return meta ? meta.name : "";
  }

  /* The Join area of the menu: worlds open on the home wifi. */
  renderJoin() {
    if (!this.joinEl) return;
    const pre = this.preReader;
    if (!this.lan.available) {
      this.joinEl.innerHTML = `<p class="sqbl-join-note">${pre ? "📱" : escapeHtml(say(MENU.needsApp))}</p>`;
      return;
    }
    const worlds = this.together.joinable();
    if (!worlds.length) {
      this.joinEl.innerHTML = `<p class="sqbl-join-note">${pre ? "🛜 …" : escapeHtml(say(MENU.noneNearby))}</p>`;
      return;
    }
    this.joinEl.innerHTML = `<div class="sqbl-join-list">${worlds.map((world) => {
      const look = this.kidLook(world.kid);
      return `<button type="button" class="sqbl-join-card" data-join-world="${escapeHtml(world.id)}" style="--sqbl-kid:${look.color}" aria-label="${escapeHtml(label(MENU.join))} · ${escapeHtml(look.name)} · ${escapeHtml(world.world)}">
        <span class="sqbl-join-av" aria-hidden="true">${look.av}</span>
        ${pre ? "" : `<b>${escapeHtml(look.name)}</b><small>🧱 ${escapeHtml(world.world)}</small>`}
      </button>`;
    }).join("")}</div>`;
  }

  async joinWorld(serviceId) {
    const service = this.together.found.get(serviceId);
    if (!service || this.together.role) return;
    this.toast(this.preReader ? "🛜 …" : say(MENU.joining));
    const ok = await this.together.join(service);
    if (!ok) {
      this.toast(this.preReader ? "🛜 ✕" : say(MENU.cantJoin));
      this.together.startLooking();
    }
  }

  /* Guest: the host's world arrives (welcome); nothing of it is saved here (D7). */
  loadShared(world) {
    this.showLost(null);
    this.clearPlate();
    world.forEach((piece) => { if (piece && typeof piece.id === "string") this.addPiece(piece, false); });
    this.syncRails();
    this.setMode("build", { quiet: true });
    if (!this.menuEl.hidden) {
      this.homeView(false);
      this.hideMenu();
    }
    this.setHint("🧱", HINTS.choose);
    this.invalidate(1000);
  }

  /* Guest back on its own menu: the host left, the link dropped, or Back. */
  endShared() {
    this.showLost(null);
    this.clearPlate();
    this.sharedChanged();
    this.showMenu();
  }

  sessionEnded(reason, hostKid) {
    this.endShared();
    if (reason === "proto") this.toast(this.preReader ? "📱 ⟳" : say(MENU.update));
    else this.toast(this.preReader ? "👋" : say(MENU.closed(this.kidName(hostKid || ""))));
  }

  /* Guest: the link to the host dropped; the plate stays while we look (D9). */
  connectionLost(hostKid) {
    this.selectPiece(null);
    this.moveId = null;
    this.placementArmed = false;
    this.ghost.visible = false;
    if (this.drag) { this.drag = null; this.cam.enabled = true; }
    this.showLost(hostKid);
  }

  showLost(hostKid) {
    if (!this.lostEl) return;
    this.lostEl.hidden = hostKid == null;
    if (hostKid == null) return;
    const look = this.kidLook(hostKid);
    this.lostEl.innerHTML = `<span class="sqbl-lost-av" aria-hidden="true">${look.av}</span><b>${this.preReader ? "🛜 …" : escapeHtml(say(MENU.looking(look.name)))}</b>`;
  }

  versionRefused() {
    this.toast(this.preReader ? "📱 ⟳" : say(MENU.update));
  }

  /* The app went to the background (home button, screen off): a hosted world
     leaves the wifi until the app is back; a guest goes home (D9). */
  onAppPause() {
    if (this.together.role === "host") {
      this.together.stopHosting();
      this.hostPaused = true;
      this.sharedChanged();
    } else if (this.together.role === "guest") {
      this.together.leave();
      this.endShared();
    }
  }

  onAppResume() {
    if (!this.hostPaused) return;
    this.hostPaused = false;
    if (this.worldId) this.together.host(this.currentWorldName()).then(() => this.updateUndoUI());
  }

  crewToast(kid, joined) {
    if (kid === this.kidId) return;
    const look = this.kidLook(kid);
    this.toast(this.preReader ? `${look.av} ${joined ? "👋" : "🚪"}` : say(joined ? MENU.joined(look.name) : MENU.left(look.name)));
  }

  /* Who is building in this world, each in their own colour. */
  renderCrew() {
    if (!this.crewEl) return;
    const kids = this.together.shared ? this.together.roster : [];
    this.crewEl.hidden = kids.length < 2;
    this.crewEl.innerHTML = kids.map((kid) => {
      const look = this.kidLook(kid);
      return `<span class="sqbl-crew-chip${kid === this.kidId ? " is-me" : ""}" style="--sqbl-kid:${look.color}" title="${escapeHtml(look.name)}"><span aria-hidden="true">${look.av}</span>${this.preReader ? "" : `<b>${escapeHtml(look.name)}</b>`}</span>`;
    }).join("");
  }

  /* A guest arrived or left, or a session began or ended: the crew chips,
     the selection colour and the undo button follow. */
  sharedChanged() {
    this.app.classList.toggle("is-guest", this.together.role === "guest");
    this.renderCrew();
    if (this.selectedId) this.selectPiece(this.selectedId);
    this.updateUndoUI();
  }

  /* Recolour the colour parts of a piece only. */
  paintObject(object, piece) {
    if (!object) return;
    const material = this.kit.mat(getColorHex(piece.colorId));
    object.traverse((node) => { if (node.userData.sqblPaint) node.material = material; });
  }

  /* Who placed a piece, while building together (D6): the selection outline
     takes their colour and the hint names them. Bricks keep their own colour. */
  placer(id) {
    const piece = this.together.shared && this.pieces.get(id);
    return piece && piece.by && this.kids[piece.by] ? this.kidLook(piece.by) : null;
  }

  /* After a change that came from (or went through) the host. */
  afterRemoteOp() {
    if (this.focus && !this.pieces.has(this.focus.id)) this.leaveFocus();
    this.syncRails();
    if (this.selectedId && !this.pieces.has(this.selectedId)) this.selectPiece(null);
    else if (this.selectedId) {
      this.selectionBox.setFromObject(this.sceneObjects.get(this.selectedId));
      this.updateSelectionUI();
    }
    this.invalidate();
  }

  /* Guest: the host applied this tablet's own change. */
  ownChangeApplied(op, sent) {
    if (op.type === "add" && !(sent.meta && sent.meta.undo)) this.selectPiece(op.piece.id);
    if (sent.meta && sent.meta.undo) this.setHint("↶", HINTS.undone);
  }

  ownChangeRefused(op, why) {
    if (op.type === "move" && this.pieces.has(op.id)) {
      const piece = this.pieces.get(op.id);
      const object = this.sceneObjects.get(op.id);
      object.position.set(piece.x, piece.y, piece.z);
      object.rotation.y = piece.rotation * Math.PI / 180;
    }
    if (why === "changed") this.setHint("🤝", HINTS.changed);
    else this.setHint("🛤️", HINTS.railBusy);
    this.updateUndoUI();
    this.invalidate();
  }

  /* The world's card picture: one fresh frame of the current view, scaled down. */
  captureThumb() {
    try {
      this.selectPiece(null);
      this.ghost.visible = false;
      this.renderer.render(this.scene, this.camera);
      const src = this.renderer.domElement;
      if (!src.width || !src.height) return "";
      const canvas = document.createElement("canvas");
      canvas.width = 200;
      canvas.height = Math.max(1, Math.round(200 * src.height / src.width));
      canvas.getContext("2d").drawImage(src, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.72);
    } catch {
      return "";
    }
  }

  /* Snap x/z to the stud grid and stack bottom-up with today's heights (D11):
     a build saved before slice 05 keeps its shape instead of floating. */
  settle(list) {
    const settled = new Map();
    return list.slice().sort((a, b) => (Number(a.y) || 0) - (Number(b.y) || 0)).map((raw) => {
      const part = getPart(raw.partId);
      const rotation = normalRotation(raw.rotation);
      const piece = { ...raw, id: String(raw.id || uid()), partId: part.id, rotation };
      const shape = poseShape(part, cleanPose(part, raw.pose));
      Object.assign(piece, this.placementFor({ x: Number(raw.x) || 0, z: Number(raw.z) || 0 }, shape, rotation, null, settled));
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
    if (typeof instance.by === "string") clean.by = instance.by;
    const pose = cleanPose(getPart(clean.partId), instance.pose);
    if (pose) clean.pose = pose;
    this.pieces.set(clean.id, clean);
    this.addObject(clean);
    if (persist) this.scheduleSave();
    return clean.id;
  }

  /* The 3D object for a piece already in `pieces`. */
  addObject(piece) {
    const part = getPart(piece.partId);
    const jointed = part.joints && (piece.pose || (this.focus && this.focus.id === piece.id));
    const object = jointed ? makeJointedPiece(part, getColorHex(piece.colorId), this.kit, piece.pose)
      : makePieceMesh(part, getColorHex(piece.colorId), this.kit);
    const paint = this.kit.mat(getColorHex(piece.colorId));
    object.traverse((node) => { if (node.material === paint) node.userData.sqblPaint = true; });
    object.position.set(piece.x, piece.y, piece.z);
    object.rotation.y = piece.rotation * Math.PI / 180;
    object.userData.sqblPieceId = piece.id;
    object.userData.sqblPieceRoot = true;
    object.traverse((child) => {
      if (child.isMesh) child.userData.sqblPieceId = piece.id;
    });
    this.scene.add(object);
    this.sceneObjects.set(piece.id, object);
    this.freeEndsCache = null;
  }

  /* Multiplayer plan slice 02 (D5): every change is an op through the
     sequencer — in-process when building alone, the host tablet's when
     building together. The host's checks are the catalog, the plate and
     the rail rules (D10). */
  shareRules() {
    return {
      part: (id) => PARTS.find((part) => part.id === id) || null,
      color: (id) => Object.prototype.hasOwnProperty.call(COLORS, id),
      half: BASE_HALF,
      blocked: (piece, ignoreId) => {
        const part = getPart(piece.partId);
        return isRail(part) && railClash(part, piece.x, piece.z, piece.rotation, this.railList(this.pieces, ignoreId), ignoreId);
      },
      pose: (partId, pose) => pose === null || samePose(cleanPose(getPart(partId), pose), pose),
    };
  }

  /* Submit an op; on success the scene follows. Returns the applied change or null. */
  commit(op) {
    if (this.together.role === "guest") return this.together.request(op);
    if (!this.sequencer) return null;
    const result = this.sequencer.submit(this.kidId, { id: uid("req"), op });
    if (result.t !== "apply") return null;
    this.showOp(result.op);
    this.together.applied(result);
    return result;
  }

  /* commit() with a solo undo snapshot, dropped again when the op is refused. */
  change(op) {
    /* Building in a hosted or joined world: undo is per kid, by inverse ops (D6). */
    if (this.together.role) {
      const done = this.commit(op);
      this.updateUndoUI();
      return done;
    }
    this.recordHistory();
    const done = this.commit(op);
    if (!done) {
      this.history.pop();
      this.updateUndoUI();
    }
    return done;
  }

  /* Bring the 3D scene in line with an op already applied to `pieces`. */
  showOp(op) {
    this.freeEndsCache = null;
    if (op.type === "add") this.addObject(this.pieces.get(op.piece.id));
    else if (op.type === "remove") {
      const object = this.sceneObjects.get(op.id);
      if (object) {
        this.scene.remove(object);
        disposeTree(object);
      }
      this.sceneObjects.delete(op.id);
      if (this.selectedId === op.id) this.selectPiece(null);
      if (this.moveId === op.id) { this.moveId = null; this.ghost.visible = false; }
    } else if (op.type === "move") {
      const piece = this.pieces.get(op.id);
      const object = this.sceneObjects.get(op.id);
      object.position.set(piece.x, piece.y, piece.z);
      object.rotation.y = piece.rotation * Math.PI / 180;
    } else if (op.type === "recolor") {
      /* Swap the cached material on the colour parts only: no rebuild, no
         DOM. The wheel's tyre and the flower's centre keep their own colours. */
      this.paintObject(this.sceneObjects.get(op.id), this.pieces.get(op.id));
    } else if (op.type === "pose") {
      const old = this.sceneObjects.get(op.id);
      if (old) {
        this.scene.remove(old);
        disposeTree(old);
        this.sceneObjects.delete(op.id);
      }
      this.addObject(this.pieces.get(op.id));
      if (this.selectedId === op.id) this.selectPiece(op.id);
      if (this.focus && this.focus.id === op.id) this.renderFocus();
    }
    this.scheduleSave();
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
    this.freeEndsCache = null;
    if (this.selectedId === id) this.selectPiece(null);
    if (persist) this.scheduleSave();
  }

  armPlacement(partId) {
    if (this.mode !== "build") return;
    this.activePartId = getPart(partId).id;
    this.moveId = null;
    this.placementArmed = true;
    this.snap = null;
    this.refreshGhost();
    /* A new part is placed unturned (the ghost may still carry a moved piece's turn). */
    this.ghost.rotation.y = 0;
    this.setHint("☝️", HINTS.place);
    this.updateRailMarks();
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
    this.ghostBlocked = false;
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
    return this.landing(point, part, rotation, ignoreId, pool).pos;
  }

  /* placementFor plus, for rails (slice 10), the join it snapped onto and
     whether it would clip another rail — then it cannot go there. */
  landing(point, part, rotation = 0, ignoreId = null, pool = this.pieces) {
    const { w, d } = footprint(part, rotation);
    let x = snapAxis(point.x, w);
    let z = snapAxis(point.z, d);
    if (isRail(part)) {
      const { rails, free } = pool === this.pieces ? this.freeEnds(ignoreId) : this.endsOf(this.railList(pool, ignoreId));
      const join = snapRail(part, x, z, rotation, free, ignoreId);
      const onPlate = join && Math.abs(join.x) + w / 2 <= BASE_HALF && Math.abs(join.z) + d / 2 <= BASE_HALF;
      if (onPlate) { x = join.x; z = join.z; }
      /* Rails sit on the baseplate studs. */
      return { pos: { x, y: STUD_H + part.height / 2, z }, join: onPlate ? join : null, blocked: railClash(part, x, z, rotation, rails, ignoreId) };
    }
    /* The old tree and flower plug in at ground level (catalog C5). */
    if (part.ground) return { pos: { x, y: part.height / 2, z }, join: null, blocked: false };
    const probe = pieceBounds({ x, y: 0, z, rotation }, part);
    /* Anything stacks on anything, wheels, trees and flowers included
       (more-parts D3, amended 2026-10-05). A seat or a saddle is lower than
       the part: what lands there rests at its `top` (catalog C5). */
    let top = 0;
    let under = null;
    for (const [id, instance] of pool) {
      if (id === ignoreId) continue;
      const otherPart = shapeOf(instance);
      const other = pieceBounds(instance, otherPart);
      const rest = otherPart.top == null ? other.maxY : other.minY + otherPart.top;
      if (overlap2D(probe, other) && rest > top) { top = rest; under = otherPart; }
    }
    /* A hat drops over the head it lands on. */
    if (part.sink && under && under.head) top -= part.sink;
    return { pos: { x, y: Math.round((top + part.height / 2) * 1000) / 1000, z }, join: null, blocked: false };
  }

  /* The rails of a pool in the shape brick-rails.js reads. */
  railList(pool = this.pieces, ignoreId = null) {
    const out = [];
    for (const [id, instance] of pool) {
      if (id === ignoreId) continue;
      const part = getPart(instance.partId);
      if (isRail(part)) out.push({ id, part, x: instance.x, z: instance.z, rotation: instance.rotation });
    }
    return out;
  }

  endsOf(rails) {
    return { rails, free: railLinks(rails).free };
  }

  /* Free rail ends with one rail lifted out (the one being moved), cached
     until the build changes: a drag at 60 fps only scans the ends. */
  freeEnds(ignoreId = null) {
    const cache = this.freeEndsCache;
    if (cache && cache.ignoreId === ignoreId) return cache;
    this.freeEndsCache = { ignoreId, ...this.endsOf(this.railList(this.pieces, ignoreId)) };
    return this.freeEndsCache;
  }

  /* Re-trace joins and circuits after a change (slice 10): circuit rails
     glow gold; the piece just placed, moved or turned gets a toast when it
     joined a rail or closed a loop. */
  syncRails(focusId = null, announce = false) {
    this.freeEndsCache = null;
    const before = this.rails;
    const list = this.railList();
    const traced = traceCircuits(list);
    this.rails = traced;
    const steel = this.kit.mat(RAIL_STEEL, 0.32, 0.45);
    const glow = this.glowMaterial();
    list.forEach((rail) => {
      const object = this.sceneObjects.get(rail.id);
      if (!object) return;
      const lit = traced.circuit.has(rail.id);
      object.traverse((node) => { if (node.userData.sqblSteel) node.material = lit ? glow : steel; });
    });
    if (announce && focusId && traced.linked.has(focusId)) {
      const closed = traced.circuit.has(focusId) && !before.circuit.has(focusId);
      const wasLinked = before.linked.get(focusId);
      const joined = traced.linked.get(focusId).size > (wasLinked ? wasLinked.size : 0);
      if (closed) {
        this.toast(this.preReader ? "🔁 ✨" : say(HINTS.circuit));
        this.setHint("✨", HINTS.circuit);
      } else if (joined) {
        this.toast(this.preReader ? "🛤️ ✓" : say(HINTS.railJoined));
      }
    }
    this.updateRailMarks();
  }

  glowMaterial() {
    return this.kit.custom("rail:glow", () => litMaterial(this.kit.cheap, {
      color: 0xf6c945, roughness: 0.3, metalness: 0.45, emissive: 0xffa000, emissiveIntensity: 0.45,
    }));
  }

  /* Glowing dots on rail ends (slice 10): a selected rail shows its own ends
     (green = joined); while a rail is being placed, moved or dragged every
     free end shows, the one it will join is big and white, and a dashed
     guide runs through the joint along the track. */
  updateRailMarks() {
    if (!this.markers) return;
    const dots = [];
    let guide = null;
    const movingId = this.drag && this.drag.active ? this.drag.id : this.moveId;
    const moving = movingId && this.pieces.get(movingId);
    const carrying = this.mode === "build" && (moving ? isRail(getPart(moving.partId)) : this.placementArmed && isRail(getPart(this.activePartId)));
    if (carrying) {
      this.freeEnds(movingId || null).free.forEach((end) => dots.push({ x: end.x, z: end.z, kind: "free" }));
      if (this.snap) {
        dots.push({ x: this.snap.end.x, z: this.snap.end.z, kind: "target" });
        guide = this.snap.end;
      }
    } else if (this.selectedId && this.mode === "build") {
      const instance = this.pieces.get(this.selectedId);
      const part = instance && getPart(instance.partId);
      if (part && isRail(part)) {
        const linked = this.rails.linked.get(this.selectedId) || new Set();
        worldConnectors(part, instance.x, instance.z, instance.rotation)
          .forEach((c) => dots.push({ x: c.x, z: c.z, kind: linked.has(c.index) ? "linked" : "free" }));
      }
    }
    const shown = dots.slice(0, MARKER_MAX);
    const pool = this.markers.children;
    while (pool.length < shown.length) {
      const dot = new THREE.Mesh(this.kit.geo("marker", () => new THREE.SphereGeometry(0.22, 14, 10)), this.markerMaterial("free"));
      dot.raycast = () => {};
      dot.renderOrder = 2;
      this.markers.add(dot);
    }
    pool.forEach((dot, i) => {
      const spec = shown[i];
      dot.visible = !!spec;
      if (!spec) return;
      dot.position.set(spec.x, MARKER_Y, spec.z);
      dot.scale.setScalar(spec.kind === "target" ? 1.7 : 1);
      dot.material = this.markerMaterial(spec.kind);
    });
    this.markerCount = shown.length;
    this.guideLine.visible = !!guide;
    if (guide) {
      const dx = Math.sin(guide.dir * Math.PI / 180) * 3.5;
      const dz = Math.cos(guide.dir * Math.PI / 180) * 3.5;
      const position = this.guideLine.geometry.attributes.position;
      position.setXYZ(0, guide.x - dx, MARKER_Y, guide.z - dz);
      position.setXYZ(1, guide.x + dx, MARKER_Y, guide.z + dz);
      position.needsUpdate = true;
      this.guideLine.geometry.computeBoundingSphere();
      this.guideLine.computeLineDistances();
    }
  }

  markerMaterial(kind) {
    const color = { free: 0xffe066, linked: 0x6ee7a0, target: 0xffffff }[kind];
    return this.kit.custom(`marker:${kind}`, () => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 }));
  }

  /* A ghost that would clip a rail turns faint — never red (coach, not cop). */
  setGhostBlocked(blocked) {
    if (blocked === this.ghostBlocked) return;
    this.ghostBlocked = blocked;
    this.ghost.traverse((node) => { if (node.material) node.material.opacity = blocked ? 0.18 : 0.48; });
  }

  onPointerMove(event) {
    if (this.drag) { this.onDragMove(event); return; }
    if (this.mode !== "build" || !this.ghost || (!this.placementArmed && !this.moveId)) return;
    if (event.buttons) return;
    this.ghostAt(event);
  }

  /* The ghost under a pointer: hover, or a part dragged out of the tray. */
  ghostAt(event) {
    const hits = this.pointFromEvent(event);
    const groundHit = hits.find((hit) => isGround(hit)) || hits.find((hit) => this.getPieceIdFromIntersection(hit));
    if (!groundHit) {
      this.ghost.visible = false;
      return;
    }
    const instance = this.moveId && this.pieces.get(this.moveId);
    const part = instance ? shapeOf(instance) : getPart(this.activePartId);
    const land = this.landing(groundHit.point, part, instance ? instance.rotation : 0, this.moveId);
    this.ghost.position.set(land.pos.x, land.pos.y, land.pos.z);
    this.ghost.visible = true;
    this.setGhostBlocked(land.blocked);
    if (land.join !== this.snap) {
      this.snap = land.join;
      this.updateRailMarks();
    }
  }

  /* Press on the selected piece: the camera is suspended until the finger lifts.
     Lifting without travel is a tap (turn); travelling drags the piece (D8). */
  onDragStart(event) {
    if (this.mode !== "build" || !this.selectedId || this.moveId || this.placementArmed || this.drag || this.focus) return;
    if (event.isPrimary === false || event.button > 0) return;
    const pieceHit = this.pointFromEvent(event).find((hit) => this.getPieceIdFromIntersection(hit));
    if (!pieceHit || this.getPieceIdFromIntersection(pieceHit) !== this.selectedId) return;
    const instance = this.pieces.get(this.selectedId);
    const part = shapeOf(instance);
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
    this.cam.enabled = false;
    /* Capture so the lift is seen even off the canvas: the camera must come back. */
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
    if (!instance) { this.drag = null; this.cam.enabled = true; return; }
    const land = this.landing({ x: point.x - drag.offsetX, z: point.z - drag.offsetZ },
      shapeOf(instance), instance.rotation, drag.id);
    const pos = land.pos;
    this.sceneObjects.get(drag.id).position.set(pos.x, pos.y, pos.z);
    drag.pos = pos;
    drag.blocked = land.blocked;
    if (land.join !== this.snap) {
      this.snap = land.join;
      this.updateRailMarks();
    }
  }

  /* Returns true when this pointer finished a real drag (so it is not a tap). */
  onDragEnd(event, cancelled) {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return false;
    this.drag = null;
    this.cam.enabled = true;
    if (!drag.active) return false;
    const instance = this.pieces.get(drag.id);
    const object = this.sceneObjects.get(drag.id);
    if (!instance || !object) return true;
    const pos = drag.pos;
    this.snap = null;
    const still = cancelled || !pos || drag.blocked || (pos.x === instance.x && pos.y === instance.y && pos.z === instance.z);
    if (still || !this.change({ type: "move", id: drag.id, x: pos.x, y: pos.y, z: pos.z, rotation: instance.rotation })) {
      object.position.set(instance.x, instance.y, instance.z);
      if ((drag.blocked || !still) && !cancelled) this.setHint("🛤️", HINTS.railBusy);
    } else {
      this.setHint("✓", HINTS.moved);
      this.haptic("tap");
      this.syncRails(drag.id, true);
    }
    this.selectPiece(drag.id);
    return true;
  }

  onTap(event) {
    const hits = this.pointFromEvent(event);
    const pieceHit = hits.find((hit) => this.getPieceIdFromIntersection(hit));
    const pieceId = pieceHit ? this.getPieceIdFromIntersection(pieceHit) : null;

    /* Focus mode (F4): a tap on the model picks the limb under the finger. */
    if (this.focus) {
      const hit = hits.find((h) => this.getPieceIdFromIntersection(h) === this.focus.id);
      let node = hit ? hit.object : null;
      while (node && !node.userData.sqblJoint && !node.userData.sqblPieceRoot) node = node.parent;
      if (node && node.userData.sqblJoint) this.pickJoint(node.userData.sqblJoint);
      return;
    }

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
      const land = this.landing(targetHit.point, shapeOf(instance), instance.rotation, this.moveId);
      const pos = land.pos;
      if (land.blocked || !this.change({ type: "move", id: this.moveId, x: pos.x, y: pos.y, z: pos.z, rotation: instance.rotation })) {
        this.setHint("🛤️", HINTS.railBusy);
        return;
      }
      const moved = this.moveId;
      this.moveId = null;
      this.snap = null;
      this.ghost.visible = false;
      this.selectPiece(moved);
      this.setHint("✓", HINTS.moved);
      this.syncRails(moved, true);
      return;
    }

    if (this.placementArmed) {
      const targetHit = hits.find((hit) => isGround(hit) || this.getPieceIdFromIntersection(hit));
      if (!targetHit) return;
      const part = getPart(this.activePartId);
      const land = this.landing(targetHit.point, part);
      const id = uid();
      if (land.blocked || !this.change({ type: "add", piece: { id, partId: part.id, colorId: this.activeColorId, ...land.pos, rotation: 0 } })) {
        this.setHint("🛤️", HINTS.railBusy);
        return;
      }
      this.placementArmed = false;
      this.snap = null;
      this.selectPiece(id);
      this.ghost.visible = false;
      this.setHint("✓", HINTS.placed);
      this.haptic("tap");
      this.rememberRecent(part.id);
      this.syncRails(id, true);
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
    this.selectionHelper.visible = !!id && !this.focus;
    if (id) {
      this.selectionBox.setFromObject(this.sceneObjects.get(id));
      this.setActiveColor(this.pieces.get(id).colorId);
      const by = this.placer(id);
      this.selectionHelper.material.color.set(by ? by.color : SELECTION_BLUE);
      if (changed && by && this.pieces.get(id).by !== this.kidId) this.setHint(by.av, HINTS.placedBy(by.name));
      else if (changed) this.setHint("✨", isRail(getPart(this.pieces.get(id).partId)) ? HINTS.railSelected : HINTS.selected);
    }
    this.updateSelectionUI();
  }

  updateSelectionUI() {
    const shown = !!this.selectedId && !this.moveId && !(this.drag && this.drag.active) && this.mode === "build" && !this.focus;
    const posable = !!(this.selectedId && getPart(this.pieces.get(this.selectedId).partId).joints);
    if (this.poseToolEl.hidden === posable) {
      this.poseToolEl.hidden = !posable;
      this.bubble.width = 0; /* one more or one fewer tool: measure again */
    }
    if (shown !== this.bubble.shown) {
      this.bubble.shown = shown;
      this.bubbleEl.classList.toggle("is-visible", shown);
    }
    if (shown) this.placeBubble();
    this.updateRailMarks();
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
    const id = this.selectedId;
    const instance = this.pieces.get(id);
    const rotation = (instance.rotation + 90) % 360;
    const land = this.landing(instance, shapeOf(instance), rotation, id);
    /* A rail that would clip its neighbour once turned stays as it is. */
    if (land.blocked || !this.change({ type: "move", id, ...land.pos, rotation })) {
      this.setHint("🛤️", HINTS.railBusy);
      return;
    }
    this.selectPiece(id);
    this.haptic("tap");
    this.syncRails(id, true);
  }

  duplicateSelected() {
    if (!this.selectedId) return;
    const original = this.pieces.get(this.selectedId);
    const part = shapeOf(original);
    let spot = { x: original.x + 2, z: original.z + 2, rotation: original.rotation };
    if (isRail(part)) {
      /* A copied rail continues the track from a free end (turned if it must:
         three copies of a curve close a ring), else the first free spot. */
      const { w, d } = footprint(part, 0);
      const fits = (s) => Math.abs(s.x) + Math.max(w, d) / 2 <= BASE_HALF && Math.abs(s.z) + Math.max(w, d) / 2 <= BASE_HALF
        && !this.landing(s, part, s.rotation).blocked;
      const ahead = extendSpots(part, { id: original.id, rotation: original.rotation }, this.freeEnds().free)
        .map((s) => ({ ...s, ...this.placementFor(s, part, s.rotation) }));
      const aside = [2, 4, 6, 8, 10].map((step) => ({ x: original.x + step, z: original.z + step, rotation: original.rotation }));
      spot = ahead.concat(aside).find(fits);
      if (!spot) { this.setHint("🛤️", HINTS.railBusy); return; }
    }
    const pos = this.placementFor(spot, part, spot.rotation);
    const id = uid();
    const done = this.change({ type: "add", piece: { id, partId: original.partId, colorId: original.colorId, ...pos, rotation: spot.rotation, ...(original.pose ? { pose: original.pose } : {}) } });
    if (!done) {
      this.setHint("🛤️", HINTS.railBusy);
      return;
    }
    if (done.pending) return;
    this.selectPiece(id);
    this.focusPiece(id, 14);
    this.syncRails(id, true);
  }

  deleteSelected() {
    if (!this.selectedId) return;
    if (!this.change({ type: "remove", id: this.selectedId })) return;
    this.syncRails();
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

  recolorSelected(colorId) {
    if (!this.selectedId) return;
    if (this.pieces.get(this.selectedId).colorId === colorId) return;
    this.change({ type: "recolor", id: this.selectedId, colorId });
  }

  /* Pose a piece (moving-parts M6, M9, M12). Sitting down or standing up moves
     its centre half a stud and lands it again by the usual rules. Returns
     whether the world now holds that pose. */
  setPose(id, raw) {
    const piece = this.pieces.get(id);
    if (!piece) return false;
    const part = getPart(piece.partId);
    const pose = cleanPose(part, raw);
    if (samePose(pose, piece.pose)) return true;
    const was = isSitting(part, piece.pose);
    const now = isSitting(part, pose);
    let point = { x: piece.x, z: piece.z };
    if (was !== now) {
      const shift = sitShift(piece.rotation, now ? 1 : -1);
      point = { x: piece.x + shift.dx, z: piece.z + shift.dz };
    }
    const pos = this.landing(point, poseShape(part, pose), piece.rotation, id).pos;
    const done = this.change({ type: "pose", id, pose, x: pos.x, y: pos.y, z: pos.z });
    this.invalidate();
    return !!done;
  }

  /* Rebuild a piece's 3D object in place (jointed in focus mode, M2). */
  refreshObject(id) {
    const old = this.sceneObjects.get(id);
    if (!old || !this.pieces.has(id)) return;
    this.scene.remove(old);
    disposeTree(old);
    this.sceneObjects.delete(id);
    this.addObject(this.pieces.get(id));
    if (this.selectedId === id) this.selectPiece(id);
    this.invalidate();
  }

  /* Focus mode, the character editor (moving-parts slice 02, M5): the camera
     glides in on the piece, the rail folds away, and its limbs can be picked
     and turned. */
  enterFocus(id) {
    const piece = id && this.pieces.get(id);
    if (!piece || this.focus || this.mode !== "build" || !getPart(piece.partId).joints) return;
    this.hideInfo();
    this.placementArmed = false;
    this.moveId = null;
    this.ghost.visible = false;
    this.focus = { id, joint: null };
    this.app.classList.add("is-focus");
    this.focusEl.hidden = false;
    this.refreshObject(id);
    this.selectionHelper.visible = false;
    this.renderFocus();
    const shape = shapeOf(piece);
    const size = Math.max(shape.height, shape.width, shape.depth);
    /* About half the stage high, looking a little below its middle so the
       piece sits above the pose dock at the foot of the stage. */
    const fit = size / (0.5 * 2 * Math.tan(this.camera.fov * Math.PI / 360));
    this.cam.focusOn({ x: piece.x, y: piece.y - shape.height * 0.35, z: piece.z, distance: fit, minDistance: Math.max(2.5, fit * 0.45), maxDistance: fit * 1.5 }, 400);
    this.updateSelectionUI();
    this.setHint("👆", HINTS.focus);
    return true;
  }

  leaveFocus() {
    if (!this.focus) return false;
    const id = this.focus.id;
    this.focus = null;
    this.app.classList.remove("is-focus");
    this.focusEl.hidden = true;
    this.jointHelper.visible = false;
    this.showOccluders();
    this.refreshObject(id);
    this.cam.unfocus(400);
    if (this.selectedId) this.selectPiece(this.selectedId);
    this.updateSelectionUI();
    this.invalidate();
    return true;
  }

  pickJoint(joint) {
    if (!this.focus) return;
    const part = getPart(this.pieces.get(this.focus.id).partId);
    if (!part.joints[joint]) return;
    this.focus.joint = joint;
    this.renderFocus();
    this.setHint("↻", HINTS.joint(JOINT_LABELS[joint] || [joint, joint]));
    this.invalidate();
  }

  /* ↺ / ↻: one step of the picked joint, wrapped within its stops (F5). */
  turnJoint(dir) {
    const focus = this.focus;
    if (!focus || !focus.joint) return;
    const piece = this.pieces.get(focus.id);
    const part = getPart(piece.partId);
    const pose = { p: piece.pose ? piece.pose.p : posesFor(part)[0].id, t: { ...((piece.pose && piece.pose.t) || {}) } };
    const count = stopsOf(part.joints[focus.joint]).length;
    const steps = ((((pose.t[focus.joint] || 0) + dir) % count) + count) % count;
    if (steps) pose.t[focus.joint] = steps;
    else delete pose.t[focus.joint];
    this.setPose(focus.id, pose);
  }

  /* Focus mode: pieces between the lens and the focused piece hide while the
     camera turns around it, so nothing blocks the model (slice 02, As built). */
  hideOccluders() {
    const target = this.sceneObjects.get(this.focus.id);
    if (!target) return;
    const eye = this.camera.position;
    const far = eye.distanceTo(target.position);
    this.sceneObjects.forEach((object, id) => {
      const near = id !== this.focus.id && object.position.distanceTo(eye) < far * 0.75;
      object.visible = !near;
      if (near) this.focusHidden.add(id);
      else this.focusHidden.delete(id);
    });
  }

  showOccluders() {
    this.focusHidden.forEach((id) => {
      const object = this.sceneObjects.get(id);
      if (object) object.visible = true;
    });
    this.focusHidden.clear();
  }

  /* The joint group of the focused piece, for the gold outline and the harness. */
  focusHolder(joint) {
    const object = this.focus && this.sceneObjects.get(this.focus.id);
    let found = null;
    if (object) object.traverse((node) => { if (node.userData.sqblJoint === joint) found = node; });
    return found;
  }

  renderFocus() {
    const focus = this.focus;
    if (!focus) return;
    const piece = this.pieces.get(focus.id);
    const part = getPart(piece.partId);
    const presets = posesFor(part);
    const current = piece.pose ? piece.pose.p : presets[0].id;
    this.focusPosesEl.innerHTML = presets.map((p) => `
      <button type="button" class="sqbl-pose-card${p.id === current ? " is-active" : ""}" data-focus-pose="${p.id}" aria-label="${escapeHtml(label(p.label))}" aria-pressed="${p.id === current}">
        <span class="sqbl-pose-pic" data-pose-pic="${p.id}" aria-hidden="true">${p.icon}</span>
        <span class="sqbl-pose-name">${escapeHtml(p.label[0])}<br><span lang="zh-TW">${escapeHtml(p.label[1])}</span></span>
      </button>`).join("");
    this.focusJointsEl.innerHTML = Object.keys(part.joints).map((j) => {
      const name = JOINT_LABELS[j] || [j, j];
      return `<button type="button" class="sqbl-joint-chip${j === focus.joint ? " is-active" : ""}" data-focus-joint="${j}" aria-pressed="${j === focus.joint}">${escapeHtml(name[0])} <span lang="zh-TW">${escapeHtml(name[1])}</span></button>`;
    }).join("");
    this.focusEl.querySelectorAll("[data-focus-act=cw],[data-focus-act=ccw]").forEach((b) => { b.disabled = !focus.joint; });
    this.hideOccluders(); /* a rebuilt scene (Undo) starts with everything shown */
    /* Pose cards show the piece itself in each pose (F3), drawn like the rail icons. */
    if (this.thumbs) {
      const colorHex = getColorHex(piece.colorId);
      this.focusPosesEl.querySelectorAll("[data-pose-pic]").forEach((el) => {
        const pose = cleanPose(part, { p: el.dataset.posePic });
        const key = `${part.id}:${piece.colorId}:pose:${el.dataset.posePic}`;
        const url = this.thumbs.get(key);
        if (url) { this.setThumb(el, key, url); return; }
        el.dataset.thumbWant = key;
        this.thumbs.want(key, () => (pose ? makeJointedPiece(part, colorHex, this.kit, pose) : makePieceMesh(part, colorHex, this.kit)), (object) => disposeTree(object));
      });
    }
  }

  setMode(mode, options = {}) {
    mode = mode === "explore" ? "explore" : "build";
    if (this.mode === mode) return;
    this.leaveFocus();
    this.mode = mode;
    this.moveId = null;
    this.snap = null;
    this.ghost.visible = false;
    if (mode === "explore") {
      this.selectPiece(null);
      this.cam.setLimits({ maxDistance: BUILD_MAX_DISTANCE + 32 });
      this.setHint("🌍", HINTS.explore);
    } else {
      this.cam.setLimits({ maxDistance: BUILD_MAX_DISTANCE });
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

  /* Glide to a piece, keeping the turn; close enough to see its sides (K4). */
  focusPiece(id, distance = 16) {
    const piece = this.pieces.get(id);
    if (!piece) return;
    this.cam.animateTo({ x: piece.x, z: piece.z, distance }, 520);
  }

  homeView(animated = true) {
    if (animated) this.cam.animateTo(HOME_VIEW, 520);
    else this.cam.jumpTo(HOME_VIEW);
  }

  recordHistory() {
    const snapshot = Array.from(this.pieces.values()).map((piece) => ({ ...piece }));
    this.history.push(snapshot);
    if (this.history.length > 40) this.history.shift();
    this.updateUndoUI();
  }

  updateUndoUI() {
    const button = this.root.querySelector("[data-action=undo]");
    if (button) button.disabled = this.together.role ? this.together.undo.size === 0 : this.history.length === 0;
  }

  undo() {
    if (this.together.role) {
      if (this.together.undoLast()) this.haptic("tap");
      this.updateUndoUI();
      return;
    }
    const snapshot = this.history.pop();
    if (!snapshot) return;
    this.selectPiece(null);
    this.moveId = null;
    this.placementArmed = false;
    for (const id of Array.from(this.pieces.keys())) this.removePiece(id, false);
    snapshot.forEach((piece) => this.addPiece(piece, false));
    if (this.focus) {
      if (this.pieces.has(this.focus.id)) { this.selectPiece(this.focus.id); this.renderFocus(); } else this.leaveFocus();
    }
    this.syncRails();
    this.updateUndoUI();
    this.scheduleSave();
    this.setHint("↶", HINTS.undone);
    this.haptic("tap");
  }

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(false), 180);
  }

  saveNow(notify = false, thumb) {
    if (!this.worldId) return;
    const pieces = Array.from(this.pieces.values()).map((piece) => ({ ...piece }));
    this.worlds.save(this.worldId, { mode: this.mode, grid: GRID_VERSION, pieces, assemblies: [] }, thumb);
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

  invalidate(ms = RENDER_HOLD) {
    this.renderUntil = Math.max(this.renderUntil || 0, performance.now() + ms);
  }

  /* Position and orientation since the last drawn frame (damping and
     tweens move the camera with no input). */
  cameraMoved() {
    const p = this.camera.position;
    const q = this.camera.quaternion;
    const now = [p.x, p.y, p.z, q.x, q.y, q.z, q.w];
    const last = this.lastCamera;
    this.lastCamera = now;
    return !last || now.some((value, i) => Math.abs(value - last[i]) > 1e-6);
  }

  /* Render on demand (slice 13): a frame is drawn only while something can
     change — the camera moves, the circuit glow breathes, or there was input
     in the last half second. An idle lab draws nothing, so a weak tablet stays
     cool and has its whole budget when the kid touches it. */
  startLoop() {
    this.invalidate(1000);
    const loop = (time) => {
      if (this.destroyed) return;
      this.raf = requestAnimationFrame(loop);
      /* Slides, glides and button turns move the camera here (K1–K5). */
      this.cam.update(time);
      /* Circuit rails breathe softly (still with reduced motion). */
      const glowing = this.rails.circuit.size && !this.reducedMotion;
      if (glowing) {
        this.glowMaterial().emissiveIntensity = 0.35 + 0.2 * (1 + Math.sin(time / 420));
      }
      const moved = this.cameraMoved();
      if (this.focus && moved) this.hideOccluders();
      /* Part icons draw into the canvas corner; the scene then covers it. */
      const icons = this.thumbs ? this.thumbs.pump() : 0;
      if (!icons && !moved && !glowing && performance.now() > this.renderUntil) return;
      if (this.selectedId && this.selectionHelper.visible) {
        const object = this.sceneObjects.get(this.selectedId);
        if (object) this.selectionBox.setFromObject(object);
        this.placeBubble();
      }
      const holder = this.focus && this.focus.joint ? this.focusHolder(this.focus.joint) : null;
      this.jointHelper.visible = !!holder;
      if (holder) this.jointBox.setFromObject(holder);
      this.renderer.render(this.scene, this.camera);
      this.frames = (this.frames || 0) + 1;
      this.measureFrame(time);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /* Read-only state for browser harnesses; screen points are CSS pixels. */
  snapshot() {
    const rect = this.renderer ? this.renderer.domElement.getBoundingClientRect() : null;
    const toScreen = (x, y, z) => {
      if (!rect || !THREE) return null;
      const p = new THREE.Vector3(x, y, z).project(this.camera);
      return { x: rect.left + (p.x + 1) / 2 * rect.width, y: rect.top + (1 - p.y) / 2 * rect.height };
    };
    const pieces = Array.from(this.pieces.values()).map((piece) => {
      const out = Object.assign({}, piece);
      const screen = toScreen(piece.x, piece.y, piece.z);
      if (screen) out.screen = screen;
      return out;
    });
    return {
      menu: !!(this.menuEl && !this.menuEl.hidden),
      lan: this.lan.available,
      together: this.together.snapshot(),
      selectionColor: this.selectionHelper ? `#${this.selectionHelper.material.color.getHexString()}` : null,
      world: this.worldId,
      worlds: this.worlds.list().map((w) => ({ id: w.id, name: w.name, count: w.count, thumb: !!w.thumb })),
      mode: this.mode,
      preReader: this.preReader,
      selectedId: this.selectedId,
      /* The selected piece's material colours: a recolour must leave fixed parts (a window pane) alone. */
      /* Focus mode (slice 02): the piece, the picked joint and where each joint is on screen. */
      focus: this.focus ? (() => {
        const joints = {};
        const object = this.sceneObjects.get(this.focus.id);
        const at = new THREE.Vector3();
        if (object) object.traverse((node) => {
          if (!node.userData.sqblJoint) return;
          /* Aim at the limb's middle, not its pin: the pin sits on the body's edge. */
          new THREE.Box3().setFromObject(node).getCenter(at);
          joints[node.userData.sqblJoint] = { screen: toScreen(at.x, at.y, at.z) };
        });
        /* The piece's on-screen box: is it framed big, and above the dock? */
        const box = object ? new THREE.Box3().setFromObject(object) : null;
        let rect = null;
        if (box) {
          rect = { top: Infinity, bottom: -Infinity, left: Infinity, right: -Infinity };
          for (let i = 0; i < 8; i += 1) {
            const p = toScreen(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
            if (!p) continue;
            rect.top = Math.min(rect.top, p.y); rect.bottom = Math.max(rect.bottom, p.y);
            rect.left = Math.min(rect.left, p.x); rect.right = Math.max(rect.right, p.x);
          }
        }
        return { id: this.focus.id, joint: this.focus.joint, joints, rect, hidden: this.focusHidden.size };
      })() : null,
      /* The selected piece's drawn joint angles in degrees (moving-parts checks). */
      poseAngles: this.selectedId && this.sceneObjects.get(this.selectedId) ? (() => {
        const out = {};
        const joints = getPart(this.pieces.get(this.selectedId).partId).joints || {};
        this.sceneObjects.get(this.selectedId).traverse((node) => {
          const joint = node.userData.sqblJoint;
          if (joint && joints[joint]) out[joint] = Math.round(node.rotation[joints[joint].axis] / DEG * 10) / 10;
        });
        return out;
      })() : {},
      selectedColors: this.selectedId && this.sceneObjects.get(this.selectedId) ? (() => {
        const out = [];
        this.sceneObjects.get(this.selectedId).traverse((node) => {
          if (node.isMesh && node.material && node.material.color) out.push(`#${node.material.color.getHexString()}`);
        });
        return out;
      })() : [],
      placementArmed: this.placementArmed,
      moving: !!this.moveId,
      dragging: !!(this.drag && this.drag.active),
      toolsShown: this.bubble.shown,
      baseplateStuds: this.baseplateStuds,
      undo: this.history.length,
      graphics: this.renderer ? this.renderer.domElement.dataset.sqGraphics : null,
      /* Last frame's cost, for the low-end check (slice 13). */
      render: this.renderer ? { quality: this.renderer.domElement.dataset.sqGraphicsQuality, calls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles, trayDrag: !!(this.trayDrag && this.trayDrag.active), studs: this.studsPainted ? "painted" : "mesh", frames: this.frames || 0,
        level: this.perf.level, pixelRatio: this.renderer.getPixelRatio(), shadows: !!(this.renderer.shadowMap.enabled && this.sun.castShadow) } : null,
      canvas: rect ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height } : null,
      camera: this.camera ? { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z, aspect: this.camera.aspect } : null,
      /* The ground point the view looks at, and the kid camera's view (K7). */
      target: this.cam ? { x: this.cam.view().x, y: 0, z: this.cam.view().z } : null,
      view: this.cam ? this.cam.view() : null,
      rails: {
        links: this.rails.edges.length, circuit: Array.from(this.rails.circuit),
        markers: this.markerCount || 0, guide: !!(this.guideLine && this.guideLine.visible),
        free: this.rails.free.map((end) => ({ id: end.id, x: end.x, z: end.z, dir: end.dir, screen: toScreen(end.x, STUD_H, end.z) })),
      },
      tray: {
        view: this.railView, finding: this.finding, category: this.activeCategory, query: this.query, size: this.sizeFilter, count: this.trayCount || 0,
        parts: this.partsEl ? Array.from(this.partsEl.querySelectorAll("[data-part]"), (el) => el.dataset.part) : [],
        favorites: this.prefs.favorites.slice(), recents: this.prefs.recents.slice(), info: this.infoPartId,
        icons: this.partsEl ? Array.from(this.partsEl.querySelectorAll(".sqbl-part-preview.has-pic"), (el) => el.dataset.thumb) : [],
        iconsCached: this.thumbs ? this.thumbs.cached() : 0, iconsPending: this.thumbs ? this.thumbs.pending() : 0,
      },
      pieces,
    };
  }

  /* Save, then release everything this runtime allocated: loop, timers,
     observer, camera input, every geometry/material (cached ones too), and the
     GL context. */
  destroy() {
    if (this.destroyed) return;
    if (this.scene && this.worldId) this.saveNow(false, this.captureThumb());
    this.destroyed = true;
    clearTimeout(this.saveTimer);
    clearTimeout(this.toastTimer);
    cancelAnimationFrame(this.raf);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.previewWatch) this.previewWatch.disconnect();
    if (this.thumbs) this.thumbs.dispose();
    if (this.together) this.together.dispose();
    if (this.lan) this.lan.dispose();
    if (this.onOutsidePress) this.root.removeEventListener("pointerdown", this.onOutsidePress, true);
    if (this.onPause) window.removeEventListener("summerquest:native-pause", this.onPause);
    if (this.onResume) window.removeEventListener("summerquest:native-resume", this.onResume);
    if (this.onInput) INPUT_EVENTS.forEach((type) => this.root.removeEventListener(type, this.onInput, { capture: true }));
    if (this.cam) this.cam.dispose();
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
