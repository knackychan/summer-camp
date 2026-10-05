/* Brick Lab parts, categories and colours (docs/plans/2026-10-03-brick-lab/).
   Every kid-facing label is an [en, zh] pair. */
/* Real proportions on a 1-unit stud pitch: a brick is 9.6 mm tall on an 8 mm
   pitch (1.2), a plate a third of that (0.4) — slice 05, D10. */
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
  rect("plate_1x1", ["Plate 1×1", "薄板 1×1"], "1×1", 1, 1, PLATE_HEIGHT, "plates"),
  rect("plate_1x2", ["Plate 1×2", "薄板 1×2"], "1×2", 1, 2, PLATE_HEIGHT, "plates"),
  rect("plate_1x3", ["Plate 1×3", "薄板 1×3"], "1×3", 1, 3, PLATE_HEIGHT, "plates"),
  rect("plate_1x4", ["Plate 1×4", "薄板 1×4"], "1×4", 1, 4, PLATE_HEIGHT, "plates"),
  rect("plate_2x2", ["Plate 2×2", "薄板 2×2"], "2×2", 2, 2, PLATE_HEIGHT, "plates"),
  rect("plate_2x4", ["Plate 2×4", "薄板 2×4"], "2×4", 2, 4, PLATE_HEIGHT, "plates"),
  rect("plate_2x6", ["Plate 2×6", "薄板 2×6"], "2×6", 2, 6, PLATE_HEIGHT, "plates"),
  rect("plate_4x4", ["Plate 4×4", "薄板 4×4"], "4×4", 4, 4, PLATE_HEIGHT, "plates"),
  { id: "plate_round_2x2", label: ["Round Plate 2×2", "圓薄板 2×2"], size: "", category: "plates", shape: "roundPlate", width: 2, depth: 2, height: PLATE_HEIGHT, studs: true },
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
  { id: "window_1x2", label: ["Window", "窗戶"], size: "", category: "structure", shape: "window", width: 1, depth: 2, height: BRICK_HEIGHT * 2, studs: true },
  { id: "tree_small", label: ["Small Tree", "小樹"], size: "", category: "nature", shape: "tree", width: 2, depth: 2, height: 4, studs: false },
  { id: "flower", label: ["Flower", "花"], size: "", category: "nature", shape: "flower", width: 1, depth: 1, height: 0.9, studs: false },
  /* More-parts slice 03: rock, mushroom and log keep their own colours. */
  { id: "rock", label: ["Rock", "石頭"], size: "", category: "nature", shape: "rock", width: 2, depth: 2, height: 1, studs: false },
  { id: "mushroom", label: ["Mushroom", "蘑菇"], size: "", category: "nature", shape: "mushroom", width: 1, depth: 1, height: BRICK_HEIGHT, studs: false },
  { id: "log_2x4", label: ["Log", "木頭"], size: "", category: "scenery", shape: "log", width: 2, depth: 4, height: BRICK_HEIGHT, studs: false },
  { id: "crate_2x2", label: ["Crate", "木箱"], size: "", category: "scenery", shape: "crate", width: 2, depth: 2, height: BRICK_HEIGHT, studs: false },
  { id: "barrel", label: ["Barrel", "木桶"], size: "", category: "scenery", shape: "barrel", width: 1, depth: 1, height: BRICK_HEIGHT, studs: false },
  { id: "fence_post", label: ["Fence Post", "柵欄柱"], size: "", category: "scenery", shape: "fencePost", width: 1, depth: 1, height: BRICK_HEIGHT * 4, studs: true },
  { id: "railing_1x2", label: ["Railing", "欄杆"], size: "", category: "scenery", shape: "railing", width: 1, depth: 2, height: BRICK_HEIGHT, studs: true },
]);

/* Parts drawn in their own fixed colours: the palette does not recolour them. */
export const FIXED_COLOR_SHAPES = Object.freeze(["rail", "tree", "rock", "mushroom", "log"]);

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
]);

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
