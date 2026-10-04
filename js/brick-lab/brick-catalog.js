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

/* size is the short tray caption shown to pre-readers ("" = icon only). */
export const PARTS = Object.freeze([
  rect("brick_1x1", ["Brick 1×1", "積木 1×1"], "1×1", 1, 1),
  rect("brick_1x2", ["Brick 1×2", "積木 1×2"], "1×2", 1, 2),
  rect("brick_1x4", ["Brick 1×4", "積木 1×4"], "1×4", 1, 4),
  rect("brick_2x2", ["Brick 2×2", "積木 2×2"], "2×2", 2, 2),
  rect("brick_2x3", ["Brick 2×3", "積木 2×3"], "2×3", 2, 3),
  rect("brick_2x4", ["Brick 2×4", "積木 2×4"], "2×4", 2, 4),
  rect("brick_2x6", ["Brick 2×6", "積木 2×6"], "2×6", 2, 6),
  rect("plate_1x2", ["Plate 1×2", "薄板 1×2"], "1×2", 1, 2, PLATE_HEIGHT, "plates"),
  rect("plate_2x2", ["Plate 2×2", "薄板 2×2"], "2×2", 2, 2, PLATE_HEIGHT, "plates"),
  rect("plate_2x4", ["Plate 2×4", "薄板 2×4"], "2×4", 2, 4, PLATE_HEIGHT, "plates"),
  { id: "slope_2x2", label: ["Slope 2×2", "斜坡 2×2"], size: "", category: "slopes", shape: "slope", width: 2, depth: 2, height: BRICK_HEIGHT, studs: true },
  { id: "wheel_small", label: ["Wheel", "輪子"], size: "", category: "wheels", shape: "wheel", width: 1, depth: 1, height: 0.68, studs: false },
  { id: "rail_straight", label: ["Straight Rail", "直軌道"], size: "", category: "rails", shape: "rail", width: 2, depth: 6, height: 0.18, studs: false },
  { id: "tree_small", label: ["Small Tree", "小樹"], size: "", category: "nature", shape: "tree", width: 2, depth: 2, height: 4, studs: false },
  { id: "flower", label: ["Flower", "花"], size: "", category: "nature", shape: "flower", width: 1, depth: 1, height: 0.9, studs: false },
]);

export const CATEGORIES = Object.freeze([
  { id: "bricks", label: ["Bricks", "積木"], icon: "🧱" },
  { id: "plates", label: ["Plates", "薄板"], icon: "▤" },
  { id: "slopes", label: ["Slopes", "斜坡"], icon: "◩" },
  { id: "wheels", label: ["Wheels", "輪子"], icon: "🛞" },
  { id: "rails", label: ["Rails", "軌道"], icon: "🛤️" },
  { id: "nature", label: ["Nature", "自然"], icon: "🌳" },
]);

export function getPart(partId) {
  return PARTS.find((part) => part.id === partId) || PARTS[0];
}

export function getColorHex(colorId) {
  return colorId in COLORS ? COLORS[colorId] : COLORS.red;
}
