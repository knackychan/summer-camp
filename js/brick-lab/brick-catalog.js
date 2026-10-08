/* Brick Lab parts, categories and colours (docs/plans/2026-10-03-brick-lab/).
   Every kid-facing label is an [en, zh] pair. */
/* Real proportions on a 1-unit stud pitch: a brick is 9.6 mm tall on an 8 mm
   pitch (1.2), a plate a third of that (0.4) — slice 05, D10. */
import { CATEGORY_ORDER, MORE_CATEGORIES, MORE_PARTS } from "./brick-parts.js";

export const BRICK_UNIT = 1;
export const BRICK_HEIGHT = 1.2;
export const PLATE_HEIGHT = 0.4;

/* Lego-like plastic colours; ids are stable (saved builds use them). */
/* A hand-built door or window that swings open on its edge at z (moving-parts
   M8): its builder in brick-lab.js hangs the leaf or pane on this joint. */
const swingOn = (z, height) => ({ body: "machine", joints: Object.freeze({
  swing: Object.freeze({ at: Object.freeze([0, height / 2, z]), axis: "y", step: 22.5, min: 0, max: 90, open: 90 }) }) });

export const COLORS = Object.freeze({
  red: 0xc91a09,
  orange: 0xfe8a18,
  yellow: 0xf2cd37,
  green: 0x237841,
  blue: 0x0055bf,
  purple: 0x6846a5,
  pink: 0xc870a0,
  white: 0xf4f4f4,
  lightGray: 0xa0a5a9,
  darkGray: 0x6c6e68,
  black: 0x1b2a34,
  tan: 0xe4cd9e,
  brown: 0x582a12,
  /* Catalog plan (docs/plans/2026-10-05-brick-catalog/ C3). */
  lime: 0xbbe90b,
  darkBlue: 0x0a3463,
  azure: 0x36aebf,
  darkRed: 0x720e0f,
  gold: 0xd9a933,
  silver: 0xb4b9bf,
  transClear: 0xe6f4fb,
  transBlue: 0x58a6e4,
});

/* Palette colours that are not plain satin plastic (C3): metallic or see-through. */
export const COLOR_FINISH = Object.freeze({
  gold: Object.freeze({ metalness: 0.3, roughness: 0.3 }),
  silver: Object.freeze({ metalness: 0.3, roughness: 0.28 }),
  transClear: Object.freeze({ opacity: 0.38, roughness: 0.15 }),
  transBlue: Object.freeze({ opacity: 0.55, roughness: 0.15 }),
});

export const COLOR_NAMES = Object.freeze({
  red: ["Red", "紅色"],
  orange: ["Orange", "橘色"],
  yellow: ["Yellow", "黃色"],
  green: ["Green", "綠色"],
  blue: ["Blue", "藍色"],
  purple: ["Purple", "紫色"],
  pink: ["Pink", "粉紅色"],
  white: ["White", "白色"],
  lightGray: ["Light grey", "淺灰色"],
  darkGray: ["Dark grey", "深灰色"],
  black: ["Black", "黑色"],
  tan: ["Tan", "米色"],
  brown: ["Brown", "咖啡色"],
  lime: ["Lime", "萊姆綠"],
  darkBlue: ["Dark blue", "深藍色"],
  azure: ["Azure", "天藍色"],
  darkRed: ["Dark red", "深紅色"],
  gold: ["Gold", "金色"],
  silver: ["Silver", "銀色"],
  transClear: ["See-through", "透明"],
  transBlue: ["See-through blue", "透明藍"],
});

/* Fixed finishes a model part's non-palette slots use (C2): a minifig's
   face, wood, glass, a torch flame. Never recoloured. */
export const FINISHES = Object.freeze({
  skin: { hex: 0xf2cd37 },
  black: { hex: 0x1b2a34 },
  white: { hex: 0xf4f4f4 },
  grey: { hex: 0xa0a5a9 },
  dark: { hex: 0x6c6e68 },
  red: { hex: 0xc91a09 },
  blue: { hex: 0x0055bf },
  navy: { hex: 0x0a3463 },
  green: { hex: 0x237841 },
  leaf: { hex: 0x4b9f4a },
  lime: { hex: 0xa5ca18 },
  yellow: { hex: 0xf5c518 },
  orange: { hex: 0xfe8a18 },
  pink: { hex: 0xf4a6c4 },
  purple: { hex: 0x6846a5 },
  brown: { hex: 0x582a12 },
  wood: { hex: 0x8b5a2b },
  tan: { hex: 0xe4cd9e },
  sand: { hex: 0xc7a96b },
  darkRed: { hex: 0x720e0f },
  azure: { hex: 0x36aebf },
  cream: { hex: 0xfff3d6 },
  gold: { hex: 0xe0b23a, metalness: 0.3, roughness: 0.3 },
  silver: { hex: 0xc8cdd4, metalness: 0.3, roughness: 0.28 },
  steel: { hex: 0x8a9097, metalness: 0.3, roughness: 0.32 },
  glass: { hex: 0xd8eef8, opacity: 0.4, roughness: 0.12 },
  water: { hex: 0x3f9be0, opacity: 0.62, roughness: 0.15 },
  glow: { hex: 0xfff2b0, emissive: 0xffd25a },
  fire: { hex: 0xff8a1f, emissive: 0xff5a00 },
  screen: { hex: 0x1c3f66, emissive: 0x2c7fd0 },
  neon: { hex: 0x9ff5ff, emissive: 0x3fd8ff },
  beam: { hex: 0xa8f0ff, emissive: 0x3fd8ff, opacity: 0.22 },
  redLight: { hex: 0xff4a3a, emissive: 0xd01800 },
  amberLight: { hex: 0xffb020, emissive: 0xc07000 },
  greenLight: { hex: 0x4fe07a, emissive: 0x10a040 },
});

const rect = (id, label, size, w, d, h = BRICK_HEIGHT, category = "bricks", studs = true) => ({
  id,
  label,
  size,
  category,
  shape: "rect",
  width: w,
  depth: d,
  height: h,
  studs,
});

/* A tile: a plate with a smooth top (parts-survey slice 01). Bricks still
   stack on it (anything stacks on anything, more-parts D3 amended). */
const tile = (id, label, size, w, d) => rect(id, label, size, w, d, PLATE_HEIGHT, "tiles", false);

/* Rail track layout (slice 09, D17): centre-line segments the geometry is
   built from, and the connectors other rails snap to. A connector is a point
   on the footprint edge plus the direction it faces, in degrees from +z
   towards +x (0 = +z, 90 = +x), the same sense as a piece's rotation. Every
   rail is 2 studs wide on an even footprint, so its centre and every
   connector sit on whole units and joined rails line up on the stud grid. */
const RAIL_HEIGHT = 0.18;
const rail = (id, label, width, depth, track, connectors) => ({
  id, label, size: "", category: "rails", shape: "rail", width, depth, height: RAIL_HEIGHT, studs: false,
  track: Object.freeze(track.map((segment) => Object.freeze(segment))),
  connectors: Object.freeze(connectors.map(([x, z, dir]) => Object.freeze({ x, z, dir }))),
});

/* size is the short tray caption shown to pre-readers ("" = icon only).
   Every id is stable: saved builds use them. */
export const PARTS = Object.freeze([
  rect("brick_1x1", ["Brick 1×1", "積木 1×1"], "1×1", 1, 1),
  rect("brick_1x2", ["Brick 1×2", "積木 1×2"], "1×2", 1, 2),
  rect("brick_1x3", ["Brick 1×3", "積木 1×3"], "1×3", 1, 3),
  rect("brick_1x4", ["Brick 1×4", "積木 1×4"], "1×4", 1, 4),
  rect("brick_2x2", ["Brick 2×2", "積木 2×2"], "2×2", 2, 2),
  rect("brick_2x3", ["Brick 2×3", "積木 2×3"], "2×3", 2, 3),
  rect("brick_2x4", ["Brick 2×4", "積木 2×4"], "2×4", 2, 4),
  rect("brick_2x5", ["Brick 2×5", "積木 2×5"], "2×5", 2, 5),
  rect("brick_2x6", ["Brick 2×6", "積木 2×6"], "2×6", 2, 6),
  /* Parts-survey slice 03: a longer brick, a pillar, round bricks and a cone. */
  rect("brick_1x6", ["Brick 1×6", "積木 1×6"], "1×6", 1, 6),
  { id: "pillar_1x1x3", label: ["Pillar", "柱子"], size: "1×1", category: "bricks", shape: "rect", width: 1, depth: 1, height: BRICK_HEIGHT * 3, studs: true },
  { id: "brick_round_1x1", label: ["Round Brick 1×1", "圓積木 1×1"], size: "", category: "round", shape: "roundPlate", width: 1, depth: 1, height: BRICK_HEIGHT, studs: true },
  { id: "brick_round_2x2", label: ["Round Brick 2×2", "圓積木 2×2"], size: "", category: "round", shape: "roundPlate", width: 2, depth: 2, height: BRICK_HEIGHT, studs: true },
  { id: "cone_1x1", label: ["Cone", "圓錐"], size: "", category: "round", shape: "cone", width: 1, depth: 1, height: BRICK_HEIGHT, studs: true },
  rect("plate_1x1", ["Plate 1×1", "薄板 1×1"], "1×1", 1, 1, PLATE_HEIGHT, "plates"),
  rect("plate_1x2", ["Plate 1×2", "薄板 1×2"], "1×2", 1, 2, PLATE_HEIGHT, "plates"),
  rect("plate_1x3", ["Plate 1×3", "薄板 1×3"], "1×3", 1, 3, PLATE_HEIGHT, "plates"),
  rect("plate_1x4", ["Plate 1×4", "薄板 1×4"], "1×4", 1, 4, PLATE_HEIGHT, "plates"),
  rect("plate_2x2", ["Plate 2×2", "薄板 2×2"], "2×2", 2, 2, PLATE_HEIGHT, "plates"),
  rect("plate_2x4", ["Plate 2×4", "薄板 2×4"], "2×4", 2, 4, PLATE_HEIGHT, "plates"),
  rect("plate_2x6", ["Plate 2×6", "薄板 2×6"], "2×6", 2, 6, PLATE_HEIGHT, "plates"),
  rect("plate_4x4", ["Plate 4×4", "薄板 4×4"], "4×4", 4, 4, PLATE_HEIGHT, "plates"),
  { id: "plate_round_2x2", label: ["Round Plate 2×2", "圓薄板 2×2"], size: "", category: "round", shape: "roundPlate", width: 2, depth: 2, height: PLATE_HEIGHT, studs: true },
  /* Plates (docs/plans/2026-10-05-brick-lab-parts-survey/ slice 02). The corner
     plate's empty cell still counts as taken (parts-survey D5). */
  rect("plate_1x6", ["Plate 1×6", "薄板 1×6"], "1×6", 1, 6, PLATE_HEIGHT, "plates"),
  rect("plate_1x8", ["Plate 1×8", "薄板 1×8"], "1×8", 1, 8, PLATE_HEIGHT, "plates"),
  rect("plate_2x3", ["Plate 2×3", "薄板 2×3"], "2×3", 2, 3, PLATE_HEIGHT, "plates"),
  rect("plate_2x8", ["Plate 2×8", "薄板 2×8"], "2×8", 2, 8, PLATE_HEIGHT, "plates"),
  rect("plate_4x6", ["Plate 4×6", "薄板 4×6"], "4×6", 4, 6, PLATE_HEIGHT, "plates"),
  { id: "plate_round_1x1", label: ["Round Plate 1×1", "圓薄板 1×1"], size: "", category: "round", shape: "roundPlate", width: 1, depth: 1, height: PLATE_HEIGHT, studs: true },
  { id: "plate_rounded_1x2", label: ["Rounded Plate 1×2", "圓角薄板 1×2"], size: "", category: "plates", shape: "roundedPlate", width: 1, depth: 2, height: PLATE_HEIGHT, studs: true },
  { id: "plate_corner_2x2", label: ["Corner Plate", "轉角薄板"], size: "", category: "plates", shape: "cornerPlate", width: 2, depth: 2, height: PLATE_HEIGHT, studs: true },
  { id: "plate_wedge_2x2", label: ["Cut-Corner Plate", "斜角薄板"], size: "", category: "plates", shape: "wedgePlate", width: 2, depth: 2, height: PLATE_HEIGHT, studs: true },
  /* Tiles (docs/plans/2026-10-05-brick-lab-parts-survey/ slice 01). */
  tile("tile_1x1", ["Tile 1×1", "光面板 1×1"], "1×1", 1, 1),
  tile("tile_1x2", ["Tile 1×2", "光面板 1×2"], "1×2", 1, 2),
  tile("tile_1x3", ["Tile 1×3", "光面板 1×3"], "1×3", 1, 3),
  tile("tile_1x4", ["Tile 1×4", "光面板 1×4"], "1×4", 1, 4),
  tile("tile_1x6", ["Tile 1×6", "光面板 1×6"], "1×6", 1, 6),
  tile("tile_1x8", ["Tile 1×8", "光面板 1×8"], "1×8", 1, 8),
  tile("tile_2x2", ["Tile 2×2", "光面板 2×2"], "2×2", 2, 2),
  tile("tile_2x3", ["Tile 2×3", "光面板 2×3"], "2×3", 2, 3),
  tile("tile_2x4", ["Tile 2×4", "光面板 2×4"], "2×4", 2, 4),
  { id: "tile_grille_1x2", label: ["Grille", "格柵板"], size: "", category: "tiles", shape: "grille", width: 1, depth: 2, height: PLATE_HEIGHT, studs: false },
  { id: "tile_round_1x1", label: ["Round Tile 1×1", "圓光面板 1×1"], size: "", category: "tiles", shape: "roundPlate", width: 1, depth: 1, height: PLATE_HEIGHT, studs: false },
  { id: "tile_round_2x2", label: ["Round Tile 2×2", "圓光面板 2×2"], size: "", category: "tiles", shape: "roundPlate", width: 2, depth: 2, height: PLATE_HEIGHT, studs: false },
  { id: "tile_quarter_1x1", label: ["Quarter Tile", "扇形光面板"], size: "", category: "tiles", shape: "quarterTile", width: 1, depth: 1, height: PLATE_HEIGHT, studs: false },
  { id: "slope_2x2", label: ["Slope 2×2", "斜坡 2×2"], size: "", category: "slopes", shape: "slope", width: 2, depth: 2, height: BRICK_HEIGHT, studs: true },
  /* Two 45° faces meeting at a ridge: the top of a roof (slice 09). */
  /* Small slopes (more-parts slice 01): the 1×1 "cheese" slope is studless. */
  { id: "slope_1x1", label: ["Slope 1×1", "斜坡 1×1"], size: "", category: "slopes", shape: "slope", width: 1, depth: 1, height: 0.8, studs: false },
  { id: "slope_1x2", label: ["Slope 1×2", "斜坡 1×2"], size: "", category: "slopes", shape: "slope", width: 1, depth: 2, height: BRICK_HEIGHT, studs: true },
  /* Parts-survey slice 03: a low slope, a small eave and two curved slopes. */
  { id: "slope_30_1x2", label: ["Low Slope 1×2", "矮斜坡 1×2"], size: "", category: "slopes", shape: "slope", width: 1, depth: 2, height: 0.8, studs: true },
  { id: "slope_inv_1x2", label: ["Small Eave", "小屋簷"], size: "", category: "slopes", shape: "slopeInv", width: 1, depth: 2, height: BRICK_HEIGHT, studs: true },
  { id: "slope_curved_2x2", label: ["Curved Slope 2×2", "弧形斜坡 2×2"], size: "", category: "slopes", shape: "slopeCurved", width: 2, depth: 2, height: 0.8, studs: false },
  { id: "slope_curved_1x2", label: ["Curved Slope 1×2", "弧形斜坡 1×2"], size: "", category: "slopes", shape: "slopeCurved", width: 1, depth: 2, height: 0.8, studs: false },
  { id: "slope_45", label: ["Roof Peak 45°", "屋脊 45°"], size: "", category: "slopes", shape: "peak", width: 2, depth: 2, height: BRICK_HEIGHT, studs: false },
  { id: "peak_1x2", label: ["Ridge Cap", "小屋脊"], size: "", category: "slopes", shape: "peak", width: 1, depth: 2, height: BRICK_HEIGHT, studs: false },
  { id: "slope_corner_2x2", label: ["Corner Slope", "轉角斜坡"], size: "", category: "slopes", shape: "slopeCorner", width: 2, depth: 2, height: BRICK_HEIGHT, studs: true },
  { id: "slope_inv_2x2", label: ["Eave", "屋簷"], size: "", category: "slopes", shape: "slopeInv", width: 2, depth: 2, height: BRICK_HEIGHT, studs: true },
  { id: "wheel_small", label: ["Wheel", "輪子"], size: "", category: "wheels", shape: "wheel", width: 1, depth: 1, height: 0.68, studs: false },
  { id: "wheel_med", label: ["Medium Wheel", "中輪子"], size: "", category: "wheels", shape: "wheel", width: 1, depth: 1, height: 1.2, studs: false, wheelScale: 1.35 },
  { id: "wheel_large", label: ["Large Wheel", "大輪子"], size: "", category: "wheels", shape: "wheel", width: 1, depth: 2, height: 1.6, studs: false, wheelScale: 1.7 },
  rail("rail_straight", ["Straight Rail", "直軌道"], 2, 6,
    [{ type: "line", from: [0, -3], to: [0, 3] }],
    [[0, 3, 0], [0, -3, 180]]),
  /* A quarter circle of radius 2 around the footprint's corner: four make a ring. */
  rail("rail_curve_90", ["Curved Rail", "彎軌道"], 4, 4,
    [{ type: "arc", centre: [-2, -2], radius: 2, from: 0, to: 90 }],
    [[0, -2, 180], [-2, 0, 270]]),
  rail("rail_junction_t", ["T-Rail", "T型軌道"], 4, 4,
    [{ type: "line", from: [0, -2], to: [0, 2] }, { type: "line", from: [0.62, 0], to: [2, 0] }],
    [[0, -2, 180], [0, 2, 0], [2, 0, 90]]),
  /* Two short tracks crossing on one square pad (no sleepers to overlap). */
  rail("rail_cross", ["Cross Rail", "十字軌道"], 2, 2,
    [{ type: "line", from: [0, -1], to: [0, 1], sleepers: false }, { type: "line", from: [-1, 0], to: [1, 0], sleepers: false }, { type: "pad" }],
    [[0, 1, 0], [0, -1, 180], [1, 0, 90], [-1, 0, 270]]),
  { id: "axle", label: ["Axle", "車軸"], size: "", category: "connectors", shape: "axle", width: 1, depth: 2, height: PLATE_HEIGHT, studs: true },
  rect("platform_4x4", ["Platform 4×4", "平台 4×4"], "4×4", 4, 4, PLATE_HEIGHT * 2, "structure"),
  /* More-parts slice 02. The window's pane keeps its own see-through colour. */
  { id: "frame_2x4", label: ["Lattice Frame", "格子框架"], size: "", category: "structure", shape: "frame", width: 2, depth: 4, height: BRICK_HEIGHT, studs: true },
  { id: "brace_1x2", label: ["Support Bracket", "支架"], size: "", category: "structure", shape: "brace", width: 1, depth: 2, height: BRICK_HEIGHT, studs: true },
  { id: "window_1x2", label: ["Window", "窗戶"], size: "", category: "doors", shape: "window", width: 1, depth: 2, height: BRICK_HEIGHT * 2, studs: true, ...swingOn(-0.78, BRICK_HEIGHT * 2) },
  /* Parts-survey slice 04. The space under the arch and the doorway count as
     taken (parts-survey D5). D6 ("the door doesn't open") is reversed
     (2026-10-08): the door and the windows swing open on a tap (moving-parts
     M8); the opening still counts as taken, open or shut. */
  { id: "arch_1x4", label: ["Arch 1×4", "拱形積木 1×4"], size: "", category: "structure", shape: "arch", width: 1, depth: 4, height: BRICK_HEIGHT, studs: true },
  { id: "door_1x4x6", label: ["Door", "門"], size: "", category: "doors", shape: "door", width: 1, depth: 4, height: BRICK_HEIGHT * 6, studs: true, ...swingOn(-1.68, BRICK_HEIGHT * 6) },
  { id: "window_1x4x3", label: ["Big Window", "大窗戶"], size: "", category: "doors", shape: "window", width: 1, depth: 4, height: BRICK_HEIGHT * 3, studs: true, ...swingOn(-1.78, BRICK_HEIGHT * 3) },
  /* The two that plant straight into the baseplate (catalog C5: `ground`). */
  { id: "tree_small", label: ["Small Tree", "小樹"], size: "", category: "nature", shape: "tree", width: 2, depth: 2, height: 4, studs: false, ground: true },
  { id: "flower", label: ["Flower", "花"], size: "", category: "nature", shape: "flower", width: 1, depth: 1, height: 0.9, studs: false, ground: true },
  /* More-parts slice 03: rock, mushroom and log keep their own colours. */
  { id: "rock", label: ["Rock", "石頭"], size: "", category: "nature", shape: "rock", width: 2, depth: 2, height: 1, studs: false },
  { id: "mushroom", label: ["Mushroom", "蘑菇"], size: "", category: "nature", shape: "mushroom", width: 1, depth: 1, height: BRICK_HEIGHT, studs: false },
  { id: "leaves", label: ["Leaves", "葉子"], size: "", category: "nature", shape: "leaves", width: 1, depth: 1, height: 0.8, studs: false },
  { id: "log_2x4", label: ["Log", "木頭"], size: "", category: "scenery", shape: "log", width: 2, depth: 4, height: BRICK_HEIGHT, studs: false },
  { id: "crate_2x2", label: ["Crate", "木箱"], size: "", category: "scenery", shape: "crate", width: 2, depth: 2, height: BRICK_HEIGHT, studs: false },
  { id: "barrel", label: ["Barrel", "木桶"], size: "", category: "scenery", shape: "barrel", width: 1, depth: 1, height: BRICK_HEIGHT, studs: false },
  { id: "fence_post", label: ["Fence Post", "柵欄柱"], size: "", category: "scenery", shape: "fencePost", width: 1, depth: 1, height: BRICK_HEIGHT * 4, studs: true },
  { id: "railing_1x2", label: ["Railing", "欄杆"], size: "", category: "scenery", shape: "railing", width: 1, depth: 2, height: BRICK_HEIGHT, studs: true },
  /* The catalog plan (docs/plans/2026-10-05-brick-catalog/): parts drawn from data. */
  ...MORE_PARTS,
]);

/* Parts drawn in their own fixed colours: the palette does not recolour them. */
export const FIXED_COLOR_SHAPES = Object.freeze(["rail", "tree", "rock", "mushroom", "log", "leaves"]);

/* True when the palette does not recolour the part: the shapes above, and
   model parts with no `main` slot (catalog C2). */
export function isFixedColor(part) {
  return !!part.fixed || FIXED_COLOR_SHAPES.includes(part.shape);
}

export const CATEGORIES = Object.freeze([
  { id: "bricks", label: ["Bricks", "積木"], icon: "🧱" },
  { id: "plates", label: ["Plates", "薄板"], icon: "▤" },
  { id: "tiles", label: ["Tiles", "光面板"], icon: "▭" },
  { id: "slopes", label: ["Slopes", "斜坡"], icon: "◩" },
  { id: "wheels", label: ["Wheels", "輪子"], icon: "🛞" },
  { id: "connectors", label: ["Connectors", "連接件"], icon: "🔩" },
  { id: "rails", label: ["Rails", "軌道"], icon: "🛤️" },
  { id: "structure", label: ["Structure", "結構"], icon: "🏗️" },
  { id: "nature", label: ["Nature", "自然"], icon: "🌳" },
  { id: "scenery", label: ["Scenery", "景物"], icon: "🪵" },
  ...MORE_CATEGORIES,
  /* Shape categories first, then the world (catalog C4). */
].sort((a, b) => CATEGORY_ORDER.indexOf(a.id) - CATEGORY_ORDER.indexOf(b.id)));

/* Footprint in studs, "width×depth": the tray's size filter and the info card. */
export function partDims(part) {
  return `${part.width}×${part.depth}`;
}

/* A short fingerprint of the catalog (more-parts D6): every part id, then
   every colour id, in order, FNV-1a hashed. Two tablets share a world only
   when theirs match, so a new part never reaches an app that can't draw it. */
export const CATALOG_ID = (() => {
  let h = 0x811c9dc5;
  const text = PARTS.map((part) => part.id).concat(Object.keys(COLORS)).join(",");
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
})();

export function getPart(partId) {
  return PARTS.find((part) => part.id === partId) || PARTS[0];
}

export function getColorHex(colorId) {
  return colorId in COLORS ? COLORS[colorId] : COLORS.red;
}
