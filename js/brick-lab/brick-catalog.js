/* Brick Lab parts, categories and colours (docs/plans/2026-10-03-brick-lab/).
   Every kid-facing label is an [en, zh] pair. */
/* Real proportions on a 1-unit stud pitch: a brick is 9.6 mm tall on an 8 mm
   pitch (1.2), a plate a third of that (0.4) — slice 05, D10. */
import { CATEGORY_ORDER, MORE_CATEGORIES, MORE_PARTS } from "./brick-parts.js";

export const BRICK_UNIT = 1;
export const BRICK_HEIGHT = 1.2;
export const PLATE_HEIGHT = 0.4;

/* Lego-like plastic colours; ids are stable (saved builds use them). */
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

const rect = (id, label, size, w, d, h = BRICK_HEIGHT, category = "bricks") => ({
  id,
  label,
  size,
  category,
  shape: "rect",
  width: w,
  depth: d,
  height: h,
  studs: true,
});

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
  rect("plate_1x2", ["Plate 1×2", "薄板 1×2"], "1×2", 1, 2, PLATE_HEIGHT, "plates"),
  rect("plate_1x4", ["Plate 1×4", "薄板 1×4"], "1×4", 1, 4, PLATE_HEIGHT, "plates"),
  rect("plate_2x2", ["Plate 2×2", "薄板 2×2"], "2×2", 2, 2, PLATE_HEIGHT, "plates"),
  rect("plate_2x4", ["Plate 2×4", "薄板 2×4"], "2×4", 2, 4, PLATE_HEIGHT, "plates"),
  rect("plate_2x6", ["Plate 2×6", "薄板 2×6"], "2×6", 2, 6, PLATE_HEIGHT, "plates"),
  { id: "slope_2x2", label: ["Slope 2×2", "斜坡 2×2"], size: "", category: "slopes", shape: "slope", width: 2, depth: 2, height: BRICK_HEIGHT, studs: true },
  /* Two 45° faces meeting at a ridge: the top of a roof (slice 09). */
  { id: "slope_45", label: ["Roof Peak 45°", "屋脊 45°"], size: "", category: "slopes", shape: "peak", width: 2, depth: 2, height: BRICK_HEIGHT, studs: false },
  { id: "wheel_small", label: ["Wheel", "輪子"], size: "", category: "wheels", shape: "wheel", width: 1, depth: 1, height: 0.68, studs: false, support: false },
  { id: "wheel_med", label: ["Medium Wheel", "中輪子"], size: "", category: "wheels", shape: "wheel", width: 1, depth: 1, height: 1.2, studs: false, wheelScale: 1.35, support: false },
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
  { id: "tree_small", label: ["Small Tree", "小樹"], size: "", category: "nature", shape: "tree", width: 2, depth: 2, height: 4, studs: false, support: false, ground: true },
  { id: "flower", label: ["Flower", "花"], size: "", category: "nature", shape: "flower", width: 1, depth: 1, height: 0.9, studs: false, support: false, ground: true },
  /* The catalog plan (docs/plans/2026-10-05-brick-catalog/): ~170 parts drawn from data. */
  ...MORE_PARTS,
]);

/* Parts drawn in their own fixed colours: the palette does not recolour them. */
export const FIXED_COLOR_SHAPES = Object.freeze(["rail", "tree"]);

/* True when the palette does not recolour the part (rails, the tree, and
   model parts with no `main` slot — C2). */
export function isFixedColor(part) {
  return !!part.fixed || FIXED_COLOR_SHAPES.includes(part.shape);
}

export const CATEGORIES = Object.freeze([
  { id: "bricks", label: ["Bricks", "積木"], icon: "🧱" },
  { id: "plates", label: ["Plates", "薄板"], icon: "▤" },
  { id: "slopes", label: ["Slopes", "斜坡"], icon: "◩" },
  { id: "wheels", label: ["Wheels", "輪子"], icon: "🛞" },
  { id: "connectors", label: ["Connectors", "連接件"], icon: "🔩" },
  { id: "rails", label: ["Rails", "軌道"], icon: "🛤️" },
  { id: "structure", label: ["Structure", "結構"], icon: "🏗️" },
  { id: "nature", label: ["Nature", "自然"], icon: "🌳" },
  ...MORE_CATEGORIES,
  /* Shape categories first, then the world (catalog C4). */
].sort((a, b) => CATEGORY_ORDER.indexOf(a.id) - CATEGORY_ORDER.indexOf(b.id)));

/* Footprint in studs, "width×depth": the tray's size filter and the info card. */
export function partDims(part) {
  return `${part.width}×${part.depth}`;
}

export function getPart(partId) {
  return PARTS.find((part) => part.id === partId) || PARTS[0];
}

export function getColorHex(colorId) {
  return colorId in COLORS ? COLORS[colorId] : COLORS.red;
}
