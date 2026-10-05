/* Brick Lab catalog extension (docs/plans/2026-10-05-brick-catalog/).
   Model parts are data (C1): a list of primitives in part space — x across,
   y up from the part's floor, z towards its front — each in a colour slot:
   `main` takes the palette colour, any other slot names a fixed finish from
   FINISHES in brick-catalog.js (C2). Primitive kinds:
     box [w, h, d]            cyl [r, h] or [top r, bottom r, h] (axis "x"/"z")
     cone [r, h]              ball r (s: [sx, sy, sz] stretches it)
     dome r (half ball)       torus [radius, tube] (axis "y" lies flat, arc°)
     lathe [[r, y], …]        prism [[u, v], …] pushed `len` along axis x / y / z
     studs [[x, z], …] or [cols, rows], tops at `at` y
   `at` is the centre (a missing y sits the primitive on the floor), `rot` is
   degrees about x, y, z. Ids are stable: saved builds use them.
   A part the catalog already has (the 81 of brick-catalog.js) is not
   repeated here (design.md A1).
   This file must not import brick-catalog.js (it is imported by it). */

const B = 1.2; /* a brick */
const P = 0.4; /* a plate */
const SEAM = 0.02;

const studRow = (n) => Array.from({ length: n }, (_, i) => i - (n - 1) / 2);
const grid = (w, d) => [].concat(...studRow(w).map((x) => studRow(d).map((z) => [x, z])));
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
/* Nested lists of primitives → one flat list, without the ES2019 array
   flatteners (the Android 8 syntax gate in check.mjs). */
const flatten = (list) => list.reduce((out, item) => out.concat(Array.isArray(item) ? flatten(item) : [item]), []);

/* The same primitive on both sides of x = 0. */
function mirror(p) {
  const other = { ...p, at: [-p.at[0], p.at[1], p.at[2]] };
  if (p.rot) other.rot = [p.rot[0], -p.rot[1], -p.rot[2]];
  return [p, other];
}

/* A brick body w × d with its floor at y0 and studs on top. */
function body(w, h, d, { y0 = 0, studs = true, c } = {}) {
  const out = [{ box: [w - SEAM * 2, h, d - SEAM * 2], at: [0, y0 + h / 2, 0], c }];
  if (studs) out.push({ studs: grid(w, d), at: [0, y0 + h, 0], c });
  return out;
}

function clean(p) {
  const out = {};
  Object.keys(p).forEach((key) => { if (p[key] !== undefined) out[key] = p[key]; });
  return Object.freeze(out);
}

/* A model part. `fixed` is worked out: no `main` slot → its own colours. */
function model(id, label, category, width, depth, height, prims, extra = {}) {
  const list = Object.freeze(flatten(prims).filter(Boolean).map(clean));
  const fixed = !list.some((p) => (p.c || "main") === "main");
  return Object.freeze({
    id, label, size: "", category, shape: "model", width, depth, height, studs: false,
    model: list, ...(fixed ? { fixed: true } : {}), ...extra,
  });
}

/* Plain bricks, plates and tiles reuse the hand-written box builder. */
const rect = (id, label, size, width, depth, height, category, studs = true) => Object.freeze({
  id, label, size, category, shape: "rect", width, depth, height, studs,
});
const legacy = (id, label, category, shape, width, depth, height, extra = {}) => Object.freeze({
  id, label, size: "", category, shape, width, depth, height, studs: shape !== "peak", ...extra,
});

/* ── Minifigures (C6): 2 studs wide, 1 deep, the head stud at y = 4. ── */
const HEAD = 2.98;
const FIG_TOP = 4.0;
const face = (y = HEAD, z = 0) => [
  mirror({ ball: 0.07, at: [0.18, y + 0.52, z + 0.47], c: "black", seg: 8, segH: 6 }),
  { torus: [0.17, 0.035], arc: 180, rot: [0, 0, 180], at: [0, y + 0.32, z + 0.49], c: "black", seg: 10, segT: 5 },
];

function minifig({ legs = "main", torso = "main", arms, hands = "skin", skin = "skin", lower = "legs", sit = false, eyes = true, head = true } = {}) {
  const dy = sit ? -1.25 : 0;
  const dz = sit ? -0.5 : 0;
  const up = (p) => ({ ...p, at: [p.at[0], p.at[1] + dy, p.at[2] + dz] });
  const out = [];
  if (sit) {
    out.push({ box: [1.9, 0.32, 0.8], at: [0, 0.16, -0.5], c: legs });
    out.push(mirror({ box: [0.92, 0.42, 1.25], at: [0.47, 0.21, 0.4], c: legs }));
    out.push(mirror({ box: [0.92, 0.3, 0.2], at: [0.47, 0.42, 0.93], c: legs }));
  } else if (lower === "legs") {
    out.push(mirror({ box: [0.92, 1.25, 0.8], at: [0.47, 0.625, 0], c: legs }));
    out.push({ box: [1.9, 0.32, 0.8], at: [0, 1.41, 0], c: legs });
  } else if (lower === "skirt") {
    out.push({ lathe: [[0.01, 0], [0.98, 0], [0.98, 0.08], [0.68, 1.57], [0.01, 1.57]], at: [0, 0, 0], c: legs });
  } else if (lower === "peg") {
    out.push({ box: [0.92, 1.25, 0.8], at: [0.47, 0.625, 0], c: legs });
    out.push({ cyl: [0.16, 0.12, 1.25], at: [-0.47, 0.625, 0], c: "wood" });
    out.push({ box: [1.9, 0.32, 0.8], at: [0, 1.41, 0], c: legs });
  }
  const top = [
    { prism: [[-0.97, 1.57], [0.97, 1.57], [0.74, 2.88], [-0.74, 2.88]], len: 0.78, at: [0, 0, 0], c: torso },
    mirror({ cyl: [0.2, 0.24, 1.05], at: [0.93, 2.3, 0.02], rot: [0, 0, 12], c: arms || torso }),
    mirror({ ball: 0.17, at: [1.06, 1.72, 0.14], c: hands, seg: 10, segH: 8 }),
    { cyl: [0.3, 0.12], at: [0, 2.94, 0], c: skin },
  ];
  if (head) {
    top.push({ lathe: [[0.01, 0], [0.44, 0], [0.52, 0.08], [0.52, 0.78], [0.44, 0.86], [0.01, 0.86]], at: [0, HEAD, 0], c: skin });
    top.push({ cyl: [0.3, 0.17], at: [0, HEAD + 0.94, 0], c: skin });
    if (eyes) top.push(face());
  }
  out.push(flatten(top).map(up));
  return out;
}

/* Things that sit on a head, moved like the body they belong to. */
const onHead = (prims, sit = false) => flatten(prims).map((p) => ({ ...p, at: [p.at[0], p.at[1] + (sit ? -1.25 : 0), p.at[2] + (sit ? -0.5 : 0)] }));
const hairCap = (c = "brown", y = HEAD + 0.5) => [
  { dome: 0.57, s: [1, 1.05, 1], at: [0, y, -0.02], c },
  { box: [1.08, 0.7, 0.34], at: [0, y - 0.2, -0.36], c },
];

function figure(id, label, opts, extras = [], extra = {}) {
  const sit = !!opts.sit;
  const height = (extra.height || (sit ? FIG_TOP - 1.25 : FIG_TOP) + 0.05);
  return model(id, label, "figures", 2, sit ? 2 : 1, height, [minifig(opts), onHead(extras, sit)],
    { head: true, top: sit ? FIG_TOP - 1.25 : FIG_TOP, ...extra, height });
}

/* ── Hats (C5): floor at the brim; `sink` drops them over a head. ── */
const hat = (id, label, sink, height, prims) => model(id, label, "accessories", 2, 1, height, prims, { sink });

/* ── Shared shapes ── */
const archOutline = (half, legTop, radius, height, steps = 10) => [
  [-half, 0], [-radius, 0], [-radius, legTop],
  ...range(steps - 1, (i) => {
    const a = Math.PI - (i + 1) * Math.PI / steps;
    return [Math.cos(a) * radius, legTop + Math.sin(a) * radius];
  }),
  [radius, legTop], [radius, 0], [half, 0], [half, height], [-half, height],
];
const curveTop = (from, to, steps = 8) => range(steps + 1, (i) => {
  const t = i / steps;
  return [-1 + 2 * t, from + (to - from) * (1 - Math.cos(t * Math.PI / 2))];
});
const gearOutline = (teeth, outer, inner) => range(teeth * 4, (i) => {
  const a = (i / (teeth * 4)) * Math.PI * 2;
  const r = i % 4 === 1 || i % 4 === 2 ? outer : inner;
  return [Math.sin(a) * r, Math.cos(a) * r];
});
const circle = (r, n = 12, cx = 0, cy = 0) => range(n, (i) => [cx + Math.sin(-i / n * Math.PI * 2) * r, cy + Math.cos(-i / n * Math.PI * 2) * r]);
const ring = (r, n, f) => range(n, (i) => f(Math.sin(i / n * Math.PI * 2) * r, Math.cos(i / n * Math.PI * 2) * r, i / n * 360));
const legs4 = (x, z, h, r = 0.1, c = "main", y0 = 0) => [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => ({ cyl: [r, h], at: [sx * x, y0 + h / 2, sz * z], c }));
const eyes = (x, y, z, r = 0.07) => mirror({ ball: r, at: [x, y, z], c: "black", seg: 8, segH: 6 });

/* A horse a minifig can ride: its saddle is `top` (C5). */
const horse = (id, label, coat, mane, hoof, extras) => model(id, label, "animals", 2, 4, 4.0, [
  { ball: 0.8, s: [0.9, 0.9, 2.0], at: [0, 1.95, -0.2], c: coat },
  legs4(0.38, 1.1, 1.35, 0.17, coat), legs4(0.38, 1.1, 0.14, 0.19, hoof),
  { cyl: [0.34, 0.42, 1.3], rot: [35, 0, 0], at: [0, 2.8, 1.3], c: coat },
  { ball: 0.4, s: [0.9, 0.95, 1.6], rot: [25, 0, 0], at: [0, 3.3, 1.85], c: coat },
  eyes(0.28, 3.5, 1.85, 0.06),
  mirror({ cone: [0.09, 0.28], at: [0.17, 3.75, 1.62], c: coat, seg: 5 }),
  { box: [0.14, 1.2, 0.5], rot: [35, 0, 0], at: [0, 3.05, 1.1], c: mane, bevel: 0 },
  { cyl: [0.2, 0.06, 1.3], rot: [25, 0, 0], at: [0, 1.8, -2.0], c: mane },
  extras,
], { top: 2.65 });

export const MORE_CATEGORIES = Object.freeze([
  { id: "round", label: ["Round & Cones", "圓形 · 圓錐"], icon: "🔴" },
  { id: "doors", label: ["Doors & Windows", "門窗"], icon: "🚪" },
  { id: "vehicles", label: ["Vehicle Parts", "車輛零件"], icon: "🚗" },
  { id: "figures", label: ["Minifigures", "小人偶"], icon: "👷" },
  { id: "animals", label: ["Animals", "動物"], icon: "🐴" },
  { id: "accessories", label: ["Hats & Hair", "帽子 · 頭髮"], icon: "👑" },
  { id: "home", label: ["Home & Town", "居家 · 城鎮"], icon: "🏠" },
  { id: "castle", label: ["Castle", "城堡"], icon: "🏰" },
  { id: "pirates", label: ["Pirates", "海盜"], icon: "⚓" },
  { id: "space", label: ["Space", "太空"], icon: "🚀" },
].map(Object.freeze));

/* Where each category sits in the rail (C4, A4): shape categories first,
   then the world. brick-catalog.js orders CATEGORIES by this. */
export const CATEGORY_ORDER = Object.freeze(["bricks", "plates", "tiles", "slopes", "round", "structure", "doors", "wheels", "vehicles",
  "connectors", "rails", "nature", "scenery", "figures", "animals", "accessories", "home", "castle", "pirates", "space"]);

export const MORE_PARTS = Object.freeze([
  /* ── Bricks ── */
  rect("brick_1x8", ["Brick 1×8", "積木 1×8"], "1×8", 1, 8, B, "bricks"),
  rect("brick_2x8", ["Brick 2×8", "積木 2×8"], "2×8", 2, 8, B, "bricks"),
  model("brick_corner", ["Corner Brick", "轉角積木"], "bricks", 2, 2, B, [
    { box: [1.96, B, 0.96], at: [0, B / 2, -0.5] },
    { box: [0.96, B, 0.98], at: [-0.5, B / 2, 0.49] },
    { studs: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5]], at: [0, B, 0] },
  ], { size: "2×2" }),
  model("brick_log", ["Log Brick 1×4", "圓木積木 1×4"], "bricks", 1, 4, B, [
    { box: [0.7, B, 3.96], at: [0, B / 2, 0], bevel: 0 },
    mirror({ cyl: [0.16, 3.96], axis: "z", at: [0.33, 0.3, 0] }),
    mirror({ cyl: [0.16, 3.96], axis: "z", at: [0.33, 0.9, 0] }),
    { studs: grid(1, 4), at: [0, B, 0] },
  ], { size: "1×4" }),
  model("brick_masonry", ["Stone Wall Brick 1×4", "石牆積木 1×4"], "bricks", 1, 4, B, [
    { box: [0.86, B, 3.96], at: [0, B / 2, 0], bevel: 0 },
    [-1.5, -0.5, 0.5, 1.5].map((z) => mirror({ box: [0.08, 0.5, 0.9], at: [0.45, 0.3, z] })),
    [-1, 0, 1].map((z) => mirror({ box: [0.08, 0.5, 0.9], at: [0.45, 0.88, z] })),
    { studs: grid(1, 4), at: [0, B, 0] },
  ], { size: "1×4" }),

  /* ── Plates and tiles ── */
  rect("plate_6x6", ["Plate 6×6", "薄板 6×6"], "6×6", 6, 6, P, "plates"),
  rect("plate_8x8", ["Plate 8×8", "薄板 8×8"], "8×8", 8, 8, P, "plates"),
  model("plate_road", ["Road Plate 8×8", "馬路板 8×8"], "plates", 8, 8, P, [
    { box: [7.96, P, 7.96], at: [0, P / 2, 0], c: "dark" },
    range(4, (i) => ({ box: [0.22, 0.03, 1.1], at: [0, P + 0.01, -3 + i * 2], c: "white", bevel: 0 })),
    mirror({ box: [0.16, 0.03, 7.6], at: [3.55, P + 0.01, 0], c: "white", bevel: 0 }),
  ], { size: "8×8" }),

  /* ── Slopes ── */
  legacy("slope_2x4", ["Wide Slope 4×2", "寬斜坡 4×2"], "slopes", "slope", 4, 2, B),
  legacy("peak_2x4", ["Roof Peak 4×2", "屋脊 4×2"], "slopes", "peak", 4, 2, B),
  model("slope_steep", ["Steep Slope 1×2×3", "陡斜坡 1×2×3"], "slopes", 1, 2, B * 3, [
    { prism: [[-0.98, 0], [0.98, 0], [0.98, 0.2], [0, B * 3], [-0.98, B * 3]], len: 0.96, axis: "x" },
    { studs: [[0, -0.5]], at: [0, B * 3, 0] },
  ]),
  model("wedge_4x4", ["Triangle Plate 4×4", "三角薄板 4×4"], "slopes", 4, 4, P, [
    { prism: [[-1.98, -1.98], [1.98, -1.98], [-1.98, 1.98]], len: P, axis: "y", at: [0, 0, 0] },
    { studs: grid(4, 4).filter(([x, z]) => x + z <= -0.9), at: [0, P, 0] },
  ]),

  /* ── Round bricks, cones and domes ── */
  model("round_brick_4x4", ["Round Brick 4×4", "圓積木 4×4"], "round", 4, 4, B, [
    { cyl: [1.97, B], seg: 32 }, { studs: grid(4, 4).filter(([x, z]) => Math.hypot(x, z) < 1.8), at: [0, B, 0] },
  ]),
  model("tower_2x2", ["Round Tower 2×2×3", "圓塔 2×2×3"], "round", 2, 2, B * 3, [
    { cyl: [0.97, B * 3], seg: 24 },
    [1, 2].map((i) => ({ torus: [0.97, 0.03], axis: "y", at: [0, i * B, 0], seg: 24, segT: 4 })),
    { studs: grid(2, 2), at: [0, B * 3, 0] },
  ]),
  model("round_plate_4x4", ["Round Plate 4×4", "圓薄板 4×4"], "round", 4, 4, P, [
    { cyl: [1.97, P], seg: 32 }, { studs: grid(4, 4).filter(([x, z]) => Math.hypot(x, z) < 1.8), at: [0, P, 0] },
  ]),
  model("cone_2x2", ["Cone 2×2", "圓錐 2×2"], "round", 2, 2, B * 2, [
    { lathe: [[0.01, 0], [0.97, 0], [0.97, 0.16], [0.32, B * 2], [0.01, B * 2]], at: [0, 0, 0], seg: 24 },
    { studs: [[0, 0]], at: [0, B * 2, 0] },
  ]),
  model("cone_4x4", ["Tower Roof 4×4", "塔頂 4×4"], "round", 4, 4, B * 3, [
    { lathe: [[0.01, 0], [2.08, 0], [2.08, 0.18], [1.7, 0.4], [0.06, B * 3], [0.01, B * 3]], at: [0, 0, 0], seg: 28 },
  ]),
  model("dome_2x2", ["Dome 2×2", "圓頂 2×2"], "round", 2, 2, 1.1, [
    { cyl: [0.97, 0.14], seg: 24 }, { dome: 0.95, s: [1, 1, 1], at: [0, 0.12, 0], seg: 24 },
  ]),
  model("dome_4x4", ["Big Dome 4×4", "大圓頂 4×4"], "round", 4, 4, 2.1, [
    { cyl: [1.97, 0.16], seg: 32 }, { dome: 1.94, at: [0, 0.14, 0], seg: 28, segH: 10 },
  ]),

  /* ── Structure ── */
  model("column", ["Column 2×2×6", "圓柱 2×2×6"], "structure", 2, 2, B * 6, [
    { box: [1.96, 0.5, 1.96], at: [0, 0.25, 0] },
    { cyl: [0.62, 0.7, B * 6 - 1.0], at: [0, B * 3, 0], seg: 20 },
    { box: [1.96, 0.5, 1.96], at: [0, B * 6 - 0.25, 0] },
    { studs: grid(2, 2), at: [0, B * 6, 0] },
  ]),
  model("arch_1x6", ["Big Arch 1×6×3", "大拱門 1×6×3"], "structure", 1, 6, B * 3, [
    { prism: archOutline(2.98, 1.2, 2, B * 3), len: 0.96, axis: "x" },
    { studs: grid(1, 6), at: [0, B * 3, 0] },
  ]),
  model("bridge", ["Bridge 2×8", "拱橋 2×8"], "structure", 2, 8, 1.6, [
    { prism: [...range(9, (i) => { const u = -3.98 + i * 7.96 / 8; return [u, 1.6 - 0.9 * (u / 3.98) ** 2]; }),
      ...range(9, (i) => { const u = 3.98 - i * 7.96 / 8; return [u, 1.25 - 1.25 * (u / 3.98) ** 2]; })], len: 1.96, axis: "x" },
  ]),
  model("stairs", ["Stairs 2×4", "樓梯 2×4"], "structure", 2, 4, B * 4, [
    range(4, (i) => ({ box: [1.96, B * (i + 1), 0.98], at: [0, B * (i + 1) / 2, 1.5 - i] })),
  ]),
  model("ladder", ["Ladder", "梯子"], "structure", 2, 1, B * 5, [
    mirror({ box: [0.16, B * 5, 0.2], at: [0.82, B * 2.5, 0], bevel: 0 }),
    range(9, (i) => ({ cyl: [0.06, 1.6], axis: "x", at: [0, 0.4 + i * 0.65, 0] })),
  ]),
  model("panel_1x2", ["Wall Panel 1×2×2", "牆板 1×2×2"], "structure", 1, 2, B * 2, [
    { box: [0.98, P, 1.96], at: [0, P / 2, 0] },
    { box: [0.24, B * 2 - P, 1.96], at: [-0.37, P + (B * 2 - P) / 2, 0] },
    { studs: [[-0.37, -0.5], [-0.37, 0.5]], at: [0, B * 2, 0] },
  ]),
  model("panel_1x4", ["Wall Panel 1×4×3", "牆板 1×4×3"], "structure", 1, 4, B * 3, [
    { box: [0.98, P, 3.96], at: [0, P / 2, 0] },
    { box: [0.24, B * 3 - P, 3.96], at: [-0.37, P + (B * 3 - P) / 2, 0] },
  ]),

  /* ── Doors and windows (a minifig fits a 1×4×6 door) ── */
  model("door_round", ["Castle Door 1×4×6", "城堡門 1×4×6"], "doors", 1, 4, B * 6, [
    { prism: archOutline(1.98, 5.0, 1.5, B * 6, 12), len: 0.96, axis: "x" },
    { prism: [...archOutline(1.5, 5.0, 1.5, 6.5, 12).slice(2, 15), [1.5, 0], [-1.5, 0]], len: 0.16, axis: "x", at: [0.08, 0, 0], c: "wood" },
    [1.4, 4.2].map((y) => ({ box: [0.06, 0.16, 2.9], at: [0.18, y, 0], c: "black", bevel: 0 })),
    { torus: [0.16, 0.035], at: [0.2, 3.0, 1.0], rot: [0, 90, 0], c: "black", seg: 10, segT: 4 },
    { studs: grid(1, 4), at: [0, B * 6, 0] },
  ]),
  model("window_shutters", ["Window with Shutters", "百葉窗"], "doors", 1, 4, B * 2, [
    { box: [0.98, 0.24, 1.96], at: [0, 0.12, 0], c: "white" }, { box: [0.98, 0.24, 1.96], at: [0, B * 2 - 0.12, 0], c: "white" },
    [-0.89, 0.89].map((z) => ({ box: [0.98, B * 2, 0.2], at: [0, B, z], c: "white" })),
    { box: [0.06, 1.95, 1.58], at: [0, B, 0], c: "glass", bevel: 0 },
    [-1.48, 1.48].map((z) => ({ box: [0.12, 2.2, 0.92], at: [0.2, B, z] })),
    [-1.48, 1.48].map((z) => range(5, (i) => ({ box: [0.03, 0.06, 0.8], at: [0.27, 0.4 + i * 0.4, z], c: "black", bevel: 0 }))),
    { studs: grid(1, 2), at: [0, B * 2, 0], c: "white" },
  ]),
  model("garage_door", ["Garage Door 1×4×4", "車庫門 1×4×4"], "doors", 1, 4, B * 4, [
    [-1.8, 1.8].map((z) => ({ box: [0.98, B * 4, 0.36], at: [0, B * 2, z] })),
    { box: [0.98, 0.4, 3.96], at: [0, B * 4 - 0.2, 0] },
    { box: [0.12, B * 4 - 0.4, 3.24], at: [0, (B * 4 - 0.4) / 2, 0], c: "white" },
    range(7, (i) => ({ box: [0.2, 0.06, 3.2], at: [0.04, 0.3 + i * 0.62, 0], c: "grey", bevel: 0 })),
    { studs: grid(1, 4), at: [0, B * 4, 0] },
  ]),

  /* ── Wheels ── */
  model("wheel_wagon", ["Wagon Wheel", "馬車輪"], "wheels", 1, 2, 1.8, [
    { torus: [0.8, 0.1], axis: "x", at: [0, 0.9, 0], c: "wood", seg: 24, segT: 6 },
    range(6, (i) => ({ box: [0.08, 1.6, 0.1], rot: [i * 30, 0, 0], at: [0, 0.9, 0], c: "wood", bevel: 0 })),
    { cyl: [0.2, 0.3], axis: "x", at: [0, 0.9, 0], c: "dark" },
  ]),

  /* ── Vehicle parts ── */
  model("steering_wheel", ["Steering Wheel", "方向盤"], "vehicles", 2, 1, 1.5, [
    { box: [1.96, P, 0.96], at: [0, P / 2, 0] },
    { cyl: [0.08, 0.8], rot: [-30, 0, 0], at: [0, 0.75, 0.1], c: "dark" },
    { torus: [0.4, 0.06], rot: [-30, 0, 0], at: [0, 1.08, -0.08], c: "black", seg: 20, segT: 6 },
    { box: [0.72, 0.06, 0.06], rot: [-30, 0, 0], at: [0, 1.08, -0.08], c: "black", bevel: 0 },
  ]),
  model("car_seat", ["Seat 2×2", "座椅 2×2"], "vehicles", 2, 2, 1.7, [
    { box: [1.96, 0.4, 1.96], at: [0, 0.2, 0] },
    { box: [1.8, 0.3, 1.5], at: [0, 0.55, 0.2] },
    { box: [1.8, 1.3, 0.3], at: [0, 1.05, -0.8], rot: [-8, 0, 0] },
  ], { top: 0.7 }),
  model("windscreen", ["Windscreen 4×2", "擋風玻璃 4×2"], "vehicles", 4, 2, B * 2, [
    { box: [3.96, P, 1.96], at: [0, P / 2, 0] },
    { box: [3.6, 2.0, 0.08], rot: [-35, 0, 0], at: [0, 1.35, -0.1], c: "glass", bevel: 0 },
    mirror({ box: [0.18, 2.1, 0.16], rot: [-35, 0, 0], at: [1.85, 1.35, -0.1] }),
    { box: [3.88, 0.18, 0.2], at: [0, 2.2, -0.68], rot: [-35, 0, 0] },
  ]),
  model("mudguard", ["Wheel Arch 2×4", "擋泥板 2×4"], "vehicles", 2, 4, B, [
    { prism: archOutline(1.98, 0.05, 0.95, B, 10), len: 1.96, axis: "x" },
    { studs: [[-0.5, -1.5], [0.5, -1.5], [-0.5, 1.5], [0.5, 1.5]], at: [0, B, 0] },
  ]),
  /* 4×8, inside the 8-stud cap (parts-survey D4; A3): two side by side make a bigger ship. */
  model("boat_hull", ["Boat Hull 4×8", "船身 4×8"], "vehicles", 4, 8, 1.9, [
    { prism: [[-1.4, -3.7], [1.4, -3.7], [1.4, 1.7], [0, 3.45], [-1.4, 1.7]], len: 0.8, axis: "y", at: [0, 0, 0] },
    { prism: [[-1.98, -3.98], [1.98, -3.98], [1.98, 1.85], [1.1, 3.25], [0, 3.98], [-1.1, 3.25], [-1.98, 1.85]], len: 1.0, axis: "y", at: [0, 0.8, 0] },
    { prism: [[-1.7, -3.8], [1.7, -3.8], [1.7, 1.8], [0.9, 3.05], [0, 3.65], [-0.9, 3.05], [-1.7, 1.8]], len: 0.06, axis: "y", at: [0, 1.8, 0], c: "wood" },
    { box: [3.4, 0.06, 0.08], at: [0, 1.4, 3.3], c: "white", bevel: 0 },
  ], { top: 1.86 }),
  model("rowboat", ["Rowboat 2×6", "小划艇 2×6"], "vehicles", 2, 6, 1.2, [
    { prism: [[-0.7, -2.6], [0.7, -2.6], [0.7, 1.6], [0, 2.7], [-0.7, 1.6]], len: 0.5, axis: "y", at: [0, 0, 0] },
    { prism: [[-0.98, -2.98], [0.98, -2.98], [0.98, 1.7], [0, 2.98], [-0.98, 1.7]], len: 0.7, axis: "y", at: [0, 0.45, 0] },
    { prism: [[-0.8, -2.8], [0.8, -2.8], [0.8, 1.6], [0, 2.7], [-0.8, 1.6]], len: 0.05, axis: "y", at: [0, 0.6, 0], c: "wood" },
    [-1.2, 0.8].map((z) => ({ box: [1.7, 0.1, 0.5], at: [0, 0.75, z], c: "wood", bevel: 0 })),
    mirror({ cyl: [0.05, 2.6], rot: [0, 0, 70], at: [1.0, 1.0, 0], c: "wood" }),
  ], { top: 0.8 }),
  model("wing", ["Wing 8×4", "機翼 8×4"], "vehicles", 8, 4, P, [
    { prism: [[-3.98, -1.98], [-3.98, 1.98], [3.98, 0.5], [3.98, -0.5]], len: P, axis: "y", at: [0, 0, 0] },
    { studs: [[-3.5, -1.5], [-3.5, -0.5], [-3.5, 0.5], [-3.5, 1.5], [-2.5, -0.5], [-2.5, 0.5]], at: [0, P, 0] },
  ]),
  model("tail_fin", ["Tail Fin", "尾翼"], "vehicles", 1, 4, 3, [
    { box: [0.96, P, 3.96], at: [0, P / 2, 0] },
    { prism: [[1.9, P], [1.4, P + 0.3], [-1.2, 3], [-1.9, 3], [-1.9, P]], len: 0.24, axis: "x" },
  ]),
  model("propeller", ["Propeller", "螺旋槳"], "vehicles", 3, 1, 3, [
    { box: [0.96, P, 0.96], at: [0, P / 2, 0] },
    { box: [0.5, 1.2, 0.5], at: [0, 1.0, -0.1] },
    { cone: [0.3, 0.5], rot: [90, 0, 0], at: [0, 1.6, 0.45] },
    [90, 210, 330].map((a) => ({ box: [0.32, 1.3, 0.06], rot: [0, 0, a + 90], at: [Math.cos(a * Math.PI / 180) * 0.68, 1.6 + Math.sin(a * Math.PI / 180) * 0.68, 0.22], c: "dark", bevel: 0 })),
  ]),
  model("rotor", ["Helicopter Rotor", "直升機旋翼"], "vehicles", 1, 1, 1.2, [
    { box: [0.96, P, 0.96], at: [0, P / 2, 0] },
    { cyl: [0.12, 0.6], at: [0, 0.7, 0], c: "dark" },
    { cyl: [0.25, 0.18], at: [0, 1.05, 0] },
    { box: [8, 0.05, 0.4], at: [0, 1.1, 0], c: "dark", bevel: 0 },
    { box: [0.4, 0.05, 8], at: [0, 1.12, 0], c: "dark", bevel: 0 },
  ]),
  model("jet_engine", ["Jet Engine", "噴射引擎"], "vehicles", 2, 4, 1.9, [
    { cyl: [0.86, 0.72, 3.4], axis: "z", at: [0, 0.95, -0.1], seg: 20 },
    { torus: [0.8, 0.1], at: [0, 0.95, 1.65], c: "silver", seg: 20, segT: 6 },
    { cyl: [0.72, 0.05], axis: "z", at: [0, 0.95, 1.6], c: "dark" },
    { cyl: [0.5, 0.4], axis: "z", at: [0, 0.95, -1.9], c: "dark" },
    { cone: [0.42, 0.7], rot: [-90, 0, 0], at: [0, 0.95, -2.35], c: "fire" },
  ]),
  model("headlight", ["Headlight Brick", "車燈積木"], "vehicles", 1, 1, B, [
    ...body(1, B, 1),
    { cyl: [0.32, 0.08], axis: "z", at: [0, 0.6, 0.5], c: "glow" },
  ]),
  model("cockpit", ["Cockpit Canopy 2×4", "駕駛艙罩 2×4"], "vehicles", 2, 4, 1.4, [
    { box: [1.96, 0.24, 3.96], at: [0, 0.12, 0] },
    { dome: 0.92, s: [1, 1.25, 2.0], at: [0, 0.2, 0], c: "glass", seg: 20 },
  ]),
  model("exhaust", ["Exhaust Pipes", "排氣管"], "vehicles", 2, 1, 1.0, [
    { box: [1.96, P, 0.96], at: [0, P / 2, 0] },
    mirror({ cyl: [0.18, 1.0], axis: "z", at: [0.5, 0.6, 0.1], c: "silver" }),
    mirror({ cyl: [0.12, 0.05], axis: "z", at: [0.5, 0.6, 0.62], c: "black" }),
  ]),

  /* ── Connectors (shapes only: nothing moves yet, C8) ── */
  model("hinge", ["Hinge 2×2", "鉸鏈 2×2"], "connectors", 2, 2, P, [
    mirror({ box: [0.9, P, 1.96], at: [0.53, P / 2, 0] }),
    { cyl: [0.18, 1.96], axis: "z", at: [0, 0.2, 0], c: "dark" },
    { studs: grid(2, 2).map(([x, z]) => [x * 1.06, z]), at: [0, P, 0] },
  ]),
  model("lever", ["Lever", "控制桿"], "connectors", 1, 1, 1.7, [
    { box: [0.96, P, 0.96], at: [0, P / 2, 0] },
    { dome: 0.3, at: [0, P, 0], c: "dark" },
    { cyl: [0.06, 1.0], rot: [0, 0, -25], at: [0.21, 1.0, 0], c: "dark" },
    { ball: 0.2, at: [0.42, 1.45, 0], c: "red" },
  ]),
  model("turntable", ["Turntable 2×2", "轉盤 2×2"], "connectors", 2, 2, P * 2, [
    { box: [1.96, P, 1.96], at: [0, P / 2, 0], c: "dark" },
    { cyl: [0.94, P], at: [0, P * 1.5, 0], seg: 24 },
    { studs: grid(2, 2), at: [0, P * 2, 0] },
  ]),
  model("beam_1x6", ["Beam 1×6", "樑 1×6"], "connectors", 1, 6, 0.8, [
    { box: [0.76, 0.76, 5.2], at: [0, 0.4, 0], bevel: 0.02 },
    [-2.6, 2.6].map((z) => ({ cyl: [0.38, 0.76], axis: "x", at: [0, 0.4, z] })),
    studRow(6).map((z) => ({ cyl: [0.25, 0.8], axis: "x", at: [0, 0.4, z], c: "black", seg: 10 })),
  ]),
  model("bar_4", ["Bar 4", "細桿 4"], "connectors", 1, 4, 0.5, [
    { cyl: [0.16, 3.9], axis: "z", at: [0, 0.25, 0], c: "main" },
    [-1.5, 1.5].map((z) => ({ box: [0.6, 0.2, 0.4], at: [0, 0.1, z] })),
  ]),
  model("gear", ["Gear", "齒輪"], "connectors", 3, 1, 3, [
    { prism: gearOutline(12, 1.48, 1.22).map(([u, v]) => [u, v + 1.5]), holes: [circle(0.22, 10, 0, 1.5)], len: 0.35, at: [0, 0, 0] },
    { cyl: [0.16, 0.8], axis: "z", at: [0, 1.5, 0], c: "dark" },
  ]),
  model("gear_small", ["Small Gear", "小齒輪"], "connectors", 1, 1, 1.6, [
    { prism: gearOutline(8, 0.78, 0.6).map(([u, v]) => [u, v + 0.8]), holes: [circle(0.16, 8, 0, 0.8)], len: 0.3, at: [0, 0, 0] },
  ]),

  /* ── Nature (plants stack on plates; C5) ── */
  model("tree_round", ["Round Tree", "圓樹"], "nature", 2, 2, 4.8, [
    { cyl: [0.26, 0.32, 2.2], c: "wood" },
    { ball: 1.3, at: [0, 3.4, 0], c: "leaf", seg: 16 },
    { ball: 0.8, at: [0.7, 2.9, 0.5], c: "leaf" }, { ball: 0.75, at: [-0.7, 3.0, -0.4], c: "leaf" },
  ]),
  model("pine_tall", ["Tall Pine", "高松樹"], "nature", 2, 2, 6.4, [
    { cyl: [0.26, 1.4], c: "brown" },
    [[1.3, 1.7, 1.0], [1.1, 1.6, 2.2], [0.88, 1.5, 3.3], [0.62, 1.5, 4.3], [0.36, 1.3, 5.3]].map(([r, h, y]) => ({ cone: [r, h], at: [0, y + h / 2 - 0.4, 0], c: "green", seg: 14 })),
  ]),
  model("palm_tree", ["Palm Tree", "椰子樹"], "nature", 2, 2, 5.4, [
    range(6, (i) => ({ cyl: [0.22, 0.27, 0.8], at: [i * 0.07, 0.4 + i * 0.78, 0], rot: [0, 0, -3], c: "sand" })),
    range(7, (i) => ({ box: [0.4, 0.06, 2.0], rot: [24, i * 360 / 7, 0], at: [0.42 + Math.sin(i * Math.PI * 2 / 7) * 0.8, 4.75, Math.cos(i * Math.PI * 2 / 7) * 0.8], c: "leaf", bevel: 0 })),
    [[0.2, 0.15], [-0.2, 0.15], [0, -0.22]].map(([x, z]) => ({ ball: 0.18, at: [0.42 + x, 4.55, z], c: "brown", seg: 8, segH: 6 })),
  ]),
  model("fruit_tree", ["Apple Tree", "蘋果樹"], "nature", 2, 2, 4.4, [
    { cyl: [0.24, 0.32, 1.9], c: "wood" },
    { ball: 1.2, s: [1, 0.85, 1], at: [0, 3.1, 0], c: "leaf", seg: 16 },
    [[0.7, 2.8, 0.85], [-0.8, 3.1, 0.6], [0.2, 3.6, 0.95], [-0.4, 2.6, 0.9], [0.95, 3.3, -0.3], [-0.9, 2.9, -0.6]].map((at) => ({ ball: 0.14, at, c: "red", seg: 8, segH: 6 })),
  ]),
  model("bush", ["Bush", "灌木"], "nature", 2, 2, 1.3, [
    { ball: 0.7, at: [0, 0.6, 0], c: "leaf" }, { ball: 0.5, at: [0.55, 0.45, 0.3], c: "green" }, { ball: 0.5, at: [-0.5, 0.45, -0.25], c: "green" },
  ]),
  model("cactus", ["Cactus", "仙人掌"], "nature", 1, 1, 2.4, [
    { cyl: [0.26, 2.0], c: "green" }, { ball: 0.26, at: [0, 2.0, 0], c: "green" },
    { cyl: [0.14, 0.5], at: [0.38, 1.0, 0], rot: [0, 0, 90], c: "green" }, { cyl: [0.14, 0.6], at: [0.6, 1.3, 0], c: "green" },
    { cyl: [0.14, 0.4], at: [-0.36, 1.3, 0], rot: [0, 0, 90], c: "green" }, { cyl: [0.14, 0.5], at: [-0.55, 1.55, 0], c: "green" },
    { ball: 0.12, at: [0, 2.3, 0], c: "pink" },
  ]),
  model("grass", ["Grass", "草叢"], "nature", 1, 1, 0.8, [
    [[0, 0, 0.8], [0.25, 0.15, 0.6], [-0.22, 0.1, 0.65], [0.1, -0.25, 0.55], [-0.15, -0.2, 0.7]].map(([x, z, h]) => ({ cone: [0.1, h], at: [x, h / 2, z], c: "lime", seg: 5 })),
  ]),
  model("sunflower", ["Sunflower", "向日葵"], "nature", 1, 1, 2.8, [
    { cyl: [0.06, 2.2], c: "green" },
    mirror({ ball: 0.22, s: [1.6, 0.3, 0.8], at: [0.25, 1.0, 0], c: "leaf", seg: 8, segH: 4 }),
    ring(0.32, 12, (x, y) => ({ ball: 0.13, s: [1, 1, 0.4], at: [x, 2.35 + y, 0.06], c: "yellow", seg: 8, segH: 5 })),
    { cyl: [0.24, 0.12], axis: "z", at: [0, 2.35, 0.1], c: "brown" },
  ]),
  model("pumpkin", ["Pumpkin", "南瓜"], "nature", 1, 1, 0.9, [
    ring(0.18, 6, (x, z) => ({ ball: 0.3, s: [1, 0.8, 1], at: [x, 0.36, z], c: "orange", seg: 10, segH: 8 })),
    { cyl: [0.05, 0.2], at: [0, 0.75, 0], c: "green" },
  ]),
  model("pond", ["Pond 4×4", "池塘 4×4"], "nature", 4, 4, 0.5, [
    { cyl: [1.7, 0.14], seg: 24, c: "water" },
    ring(1.75, 10, (x, z) => ({ ball: 0.3, s: [1, 0.6, 1], at: [x, 0.15, z], c: "grey", seg: 6, segH: 4 })),
  ]),
  model("campfire", ["Campfire", "營火"], "nature", 2, 2, 1.2, [
    ring(0.6, 7, (x, z) => ({ ball: 0.22, s: [1, 0.7, 1], at: [x, 0.12, z], c: "grey", seg: 6, segH: 4 })),
    [0, 60, 120].map((a) => ({ cyl: [0.08, 1.1], axis: "z", rot: [0, a, 0], at: [0, 0.16, 0], c: "wood" })),
    { cone: [0.32, 0.8], at: [0, 0.6, 0], c: "fire", seg: 8 }, { cone: [0.18, 0.5], at: [0.12, 0.45, 0.1], c: "glow", seg: 6 },
  ]),
  model("tent", ["Tent 4×4", "帳篷 4×4"], "nature", 4, 4, 2.6, [
    { prism: [[-1.95, 0], [1.95, 0], [0, 2.4]], len: 3.9, axis: "z" },
    { prism: [[-0.6, 0], [0.6, 0], [0, 1.4]], len: 0.05, axis: "z", at: [0, 0, 1.96], c: "black" },
    { cyl: [0.05, 2.6], at: [0, 1.3, 2.0], c: "wood" },
  ]),

  /* ── Minifigures ── */
  figure("fig_boy", ["Minifigure", "小人偶"], { legs: "blue" }, [hairCap("brown")]),
  figure("fig_girl", ["Minifigure with Ponytail", "綁馬尾的小人偶"], { legs: "navy" }, [
    hairCap("orange"), { ball: 0.24, s: [0.9, 1.3, 0.9], at: [0, HEAD + 0.5, -0.62], c: "orange" },
  ]),
  figure("fig_sitting", ["Sitting Minifigure", "坐著的小人偶"], { legs: "blue", sit: true }, [hairCap("black")]),
  figure("fig_knight", ["Knight", "騎士"], { legs: "dark", arms: "silver" }, [
    { lathe: [[0.58, -0.08], [0.6, 0.0], [0.6, 0.4], [0.56, 0.8], [0.36, 0.98], [0.01, 1.0]], at: [0, HEAD + 0.02, 0], c: "silver", seg: 16 },
    { box: [0.6, 0.08, 0.2], at: [0, HEAD + 0.52, 0.55], c: "black", bevel: 0 },
    { cone: [0.14, 0.6], at: [0, HEAD + 1.25, -0.1], c: "red", seg: 8 },
    { box: [0.5, 0.6, 0.06], at: [0, 2.2, 0.41], c: "gold", bevel: 0 },
  ], { height: 4.3 }),
  figure("fig_king", ["King", "國王"], { legs: "main" }, [
    { lathe: [[0.5, 0], [0.58, 0], [0.58, 0.32], [0.5, 0.32], [0.5, 0]], at: [0, HEAD + 0.74, 0], c: "gold", seg: 16 },
    ring(0.5, 5, (x, z) => ({ cone: [0.1, 0.3], at: [x, HEAD + 1.2, z], c: "gold", seg: 6 })),
    { prism: [[-0.4, 0], [0.4, 0], [0, -0.5]], len: 0.12, at: [0, HEAD + 0.25, 0.48], c: "white" },
    { box: [1.8, 2.6, 0.08], at: [0, 1.6, -0.46], c: "red", bevel: 0 },
    { box: [1.9, 0.2, 0.86], at: [0, 2.82, 0], c: "white" },
  ], { height: 4.25 }),
  figure("fig_princess", ["Princess", "公主"], { legs: "main", lower: "skirt" }, [
    hairCap("yellow"), { box: [1.0, 1.0, 0.25], at: [0, HEAD + 0.1, -0.4], c: "yellow" },
    { torus: [0.36, 0.04], axis: "y", at: [0, HEAD + 0.98, 0], c: "gold", seg: 14, segT: 4 },
    { ball: 0.07, at: [0, HEAD + 1.0, 0.36], c: "pink", seg: 6, segH: 4 },
  ]),
  figure("fig_wizard", ["Wizard", "巫師"], { legs: "main", lower: "skirt" }, [
    { cyl: [0.95, 0.06], at: [0, HEAD + 0.88, 0], c: "purple", seg: 18 },
    { cone: [0.52, 1.5], at: [0, HEAD + 1.66, 0], c: "purple", seg: 14 },
    { ball: 0.1, at: [0.2, HEAD + 1.5, 0.35], c: "gold", seg: 6, segH: 4 },
    { prism: [[-0.38, 0], [0.38, 0], [0, -0.95]], len: 0.16, at: [0, HEAD + 0.25, 0.5], c: "white" },
  ], { height: 5.4 }),
  figure("fig_pirate_captain", ["Pirate Captain", "海盜船長"], { legs: "dark", lower: "peg" }, [
    { dome: 0.56, s: [1, 0.7, 1], at: [0, HEAD + 0.72, 0], c: "black" },
    { prism: [[0, 1.0], [0.95, -0.55], [-0.95, -0.55]], len: 0.08, axis: "y", at: [0, HEAD + 0.72, 0], c: "black" },
    { ball: 0.08, at: [0, HEAD + 1.0, 0.45], c: "white", seg: 6, segH: 4 },
    { box: [0.22, 0.18, 0.06], at: [0.18, HEAD + 0.52, 0.5], c: "black", bevel: 0 },
    { prism: [[-0.42, 0], [0.42, 0], [0.2, -0.45], [-0.2, -0.45]], len: 0.12, at: [0, HEAD + 0.22, 0.47], c: "black" },
    { box: [0.3, 0.2, 0.06], at: [0, 1.7, 0.41], c: "gold", bevel: 0 },
  ], { height: 4.25 }),
  figure("fig_pirate", ["Pirate", "海盜"], { legs: "navy", torso: "white", arms: "main" }, [
    { dome: 0.55, s: [1, 0.7, 1], at: [0, HEAD + 0.62, 0], c: "red" },
    { ball: 0.14, at: [-0.2, HEAD + 0.6, -0.56], c: "red", seg: 6, segH: 4 },
    [1.85, 2.25, 2.62].map((y) => ({ box: [1.82 - (y - 1.57) * 0.35, 0.16, 0.8], at: [0, y, 0], c: "main", bevel: 0 })),
  ]),
  figure("fig_astronaut", ["Astronaut", "太空人"], { legs: "main" }, [
    { ball: 0.74, at: [0, HEAD + 0.45, 0], c: "glass", seg: 18, segH: 12 },
    { torus: [0.62, 0.08], axis: "y", at: [0, HEAD - 0.02, 0], c: "white", seg: 18, segT: 5 },
    mirror({ cyl: [0.22, 1.0], at: [0.32, 2.3, -0.62], c: "grey" }),
    { box: [0.6, 0.4, 0.06], at: [0, 2.3, 0.41], c: "screen", bevel: 0 },
  ], { height: 4.25 }),
  figure("fig_robot", ["Robot", "機器人"], { legs: "dark", arms: "grey", hands: "dark", head: false }, [
    { box: [0.96, 0.86, 0.86], at: [0, HEAD + 0.45, 0], c: "grey" },
    eyes(0.2, HEAD + 0.5, 0.42, 0.1).map((p) => ({ ...p, c: "neon" })),
    { box: [0.5, 0.08, 0.04], at: [0, HEAD + 0.22, 0.44], c: "black", bevel: 0 },
    { cyl: [0.04, 0.5], at: [0, HEAD + 1.12, 0], c: "dark" }, { ball: 0.1, at: [0, HEAD + 1.4, 0], c: "fire", seg: 6, segH: 4 },
    { box: [0.7, 0.5, 0.06], at: [0, 2.3, 0.41], c: "screen", bevel: 0 },
  ], { height: 4.45 }),
  figure("fig_alien", ["Alien", "外星人"], { legs: "main", skin: "lime", hands: "lime", eyes: false }, [
    { ball: 0.6, s: [1, 0.9, 0.95], at: [0, HEAD + 0.55, 0], c: "lime", seg: 16 },
    mirror({ ball: 0.17, s: [1, 1.4, 0.6], at: [0.22, HEAD + 0.58, 0.48], c: "black", seg: 10, segH: 8 }),
    mirror({ cyl: [0.03, 0.5], rot: [0, 0, 20], at: [0.25, HEAD + 1.25, 0], c: "lime" }),
    mirror({ ball: 0.09, at: [0.34, HEAD + 1.5, 0], c: "neon", seg: 6, segH: 4 }),
  ], { height: 4.6 }),
  figure("fig_firefighter", ["Firefighter", "消防員"], { legs: "main" }, [
    { dome: 0.6, s: [1, 0.85, 1.05], at: [0, HEAD + 0.6, 0], c: "red" },
    { cyl: [0.72, 0.04], at: [0, HEAD + 0.6, -0.1], c: "red", seg: 18 },
    { box: [0.2, 0.22, 0.06], at: [0, HEAD + 0.85, 0.6], c: "gold", bevel: 0 },
    [1.85, 2.5].map((y) => ({ box: [1.86 - (y - 1.57) * 0.35, 0.1, 0.82], at: [0, y, 0], c: "yellow", bevel: 0 })),
  ], { height: 4.2 }),
  figure("fig_police", ["Police Officer", "警察"], { legs: "navy" }, [
    { cyl: [0.56, 0.62, 0.42], at: [0, HEAD + 0.9, 0], c: "navy" },
    { prism: [[-0.45, 0], [0.45, 0], [0.3, 0.38], [-0.3, 0.38]], len: 0.05, axis: "y", at: [0, HEAD + 0.7, 0.52], c: "black" },
    { ball: 0.07, at: [0, HEAD + 0.95, 0.6], c: "gold", seg: 6, segH: 4 },
    { box: [0.18, 0.22, 0.06], at: [0.38, 2.5, 0.4], c: "gold", bevel: 0 },
  ], { height: 4.2 }),
  figure("fig_chef", ["Chef", "廚師"], { legs: "dark" }, [
    { cyl: [0.5, 0.56], at: [0, HEAD + 1.12, 0], c: "white" },
    { ball: 0.62, s: [1, 0.6, 1], at: [0, HEAD + 1.5, 0], c: "white" },
    { prism: [[-0.75, 1.6], [0.75, 1.6], [0.55, 2.4], [-0.55, 2.4]], len: 0.06, at: [0, 0, 0.41], c: "white" },
  ], { height: 4.9 }),
  figure("fig_farmer", ["Farmer", "農夫"], { legs: "blue" }, [
    { cyl: [1.0, 0.05], at: [0, HEAD + 0.72, 0], c: "sand", seg: 18 },
    { cyl: [0.5, 0.56, 0.45], at: [0, HEAD + 0.95, 0], c: "sand" },
    { box: [1.0, 0.1, 1.1], at: [0, HEAD + 0.8, 0], c: "red", bevel: 0 },
    mirror({ box: [0.16, 1.3, 0.04], at: [0.42, 2.2, 0.41], c: "blue", bevel: 0 }),
  ], { height: 4.2 }),

  /* ── Animals (their own colours, C2) ── */
  model("dog", ["Dog", "小狗"], "animals", 1, 2, 1.3, [
    { ball: 0.4, s: [0.9, 0.85, 1.5], at: [0, 0.68, -0.1], c: "tan" },
    { ball: 0.32, at: [0, 1.0, 0.55], c: "tan" }, { ball: 0.15, s: [1, 0.8, 1.3], at: [0, 0.92, 0.85], c: "tan" },
    { ball: 0.07, at: [0, 0.97, 1.03], c: "black", seg: 6, segH: 4 }, eyes(0.12, 1.1, 0.83, 0.05),
    mirror({ ball: 0.12, s: [0.6, 1.4, 0.8], at: [0.28, 1.08, 0.48], c: "brown" }),
    legs4(0.2, 0.42, 0.42, 0.09, "tan"),
    { cyl: [0.05, 0.4], rot: [-40, 0, 0], at: [0, 0.95, -0.72], c: "tan" },
  ]),
  model("cat", ["Cat", "小貓"], "animals", 1, 2, 1.2, [
    { ball: 0.36, s: [0.85, 0.85, 1.45], at: [0, 0.62, -0.1], c: "orange" },
    { ball: 0.3, at: [0, 0.95, 0.5], c: "orange" },
    mirror({ cone: [0.1, 0.22], at: [0.17, 1.27, 0.48], c: "orange", seg: 4 }),
    eyes(0.11, 1.0, 0.77, 0.05), { ball: 0.04, at: [0, 0.9, 0.8], c: "pink", seg: 6, segH: 4 },
    legs4(0.18, 0.4, 0.4, 0.08, "orange"),
    { torus: [0.32, 0.05], arc: 150, rot: [0, 90, 0], at: [0, 0.95, -0.6], c: "orange", seg: 10, segT: 5 },
  ]),
  horse("horse", ["Horse", "馬"], "wood", "black", "black", [{ box: [1.1, 0.12, 1.1], at: [0, 2.62, -0.2], c: "red" }]),
  horse("unicorn", ["Unicorn", "獨角獸"], "white", "pink", "gold", [{ cone: [0.08, 0.7], rot: [35, 0, 0], at: [0, 3.95, 2.2], c: "gold", seg: 6 }]),
  model("cow", ["Cow", "乳牛"], "animals", 2, 4, 2.6, [
    { box: [1.4, 1.1, 2.6], at: [0, 1.55, -0.2], c: "white", bevel: 0.15 },
    [[0.71, 1.6, 0.4], [-0.71, 1.4, -0.6], [0.4, 2.1, -0.9]].map(([x, y, z]) => ({ ball: 0.32, s: [0.25, 0.8, 1], at: [x, y, z], c: "black", seg: 8, segH: 6 })),
    legs4(0.45, 0.9, 1.0, 0.16, "white"),
    { box: [0.9, 0.85, 0.9], at: [0, 2.0, 1.4], c: "white", bevel: 0.12 },
    { box: [0.85, 0.42, 0.25], at: [0, 1.75, 1.88], c: "pink", bevel: 0.08 },
    eyes(0.25, 2.2, 1.86, 0.06),
    mirror({ cone: [0.07, 0.3], rot: [0, 0, -60], at: [0.55, 2.45, 1.3], c: "cream", seg: 6 }),
    { ball: 0.22, at: [0, 0.95, -0.3], c: "pink", seg: 8, segH: 6 },
    { cyl: [0.04, 0.8], at: [0, 1.6, -1.55], c: "black" },
  ], { top: 2.1 }),
  model("pig", ["Pig", "小豬"], "animals", 2, 2, 1.2, [
    { ball: 0.5, s: [1, 0.9, 1.35], at: [0, 0.65, -0.05], c: "pink" },
    { cyl: [0.18, 0.15], axis: "z", at: [0, 0.68, 0.72], c: "pink" },
    mirror({ ball: 0.035, at: [0.07, 0.7, 0.8], c: "black", seg: 5, segH: 4 }), eyes(0.2, 0.88, 0.58, 0.05),
    mirror({ cone: [0.12, 0.2], rot: [20, 0, 0], at: [0.24, 1.12, 0.35], c: "pink", seg: 4 }),
    legs4(0.26, 0.38, 0.32, 0.1, "pink"),
    { torus: [0.08, 0.025], at: [0, 0.75, -0.72], rot: [0, 90, 0], c: "pink", seg: 8, segT: 4 },
  ]),
  model("sheep", ["Sheep", "綿羊"], "animals", 2, 2, 1.6, [
    [[0, 0.9, 0, 0.5], [0.3, 1.0, 0.35, 0.36], [-0.3, 1.0, 0.3, 0.36], [0.3, 1.0, -0.35, 0.36], [-0.3, 1.05, -0.3, 0.36], [0, 1.2, 0, 0.36]].map(([x, y, z, r]) => ({ ball: r, at: [x, y, z], c: "white", seg: 10, segH: 7 })),
    { ball: 0.26, s: [0.85, 1, 1.15], at: [0, 1.15, 0.72], c: "black" },
    eyes(0.11, 1.2, 0.97, 0.05).map((p) => ({ ...p, c: "white" })),
    legs4(0.28, 0.32, 0.6, 0.08, "black"),
  ]),
  model("chicken", ["Chicken", "雞"], "animals", 1, 1, 1.1, [
    { ball: 0.3, s: [0.85, 0.9, 1.1], at: [0, 0.5, -0.05], c: "white" },
    { ball: 0.18, at: [0, 0.82, 0.22], c: "white" },
    { box: [0.06, 0.16, 0.2], at: [0, 1.02, 0.2], c: "red", bevel: 0 },
    { cone: [0.06, 0.16], rot: [90, 0, 0], at: [0, 0.8, 0.44], c: "orange", seg: 5 },
    eyes(0.1, 0.86, 0.33, 0.035),
    mirror({ cyl: [0.03, 0.25], at: [0.1, 0.12, 0], c: "orange" }),
  ]),
  model("duck", ["Duck", "鴨子"], "animals", 1, 2, 1.0, [
    { ball: 0.34, s: [0.9, 0.8, 1.4], at: [0, 0.32, -0.1], c: "yellow" },
    { ball: 0.22, at: [0, 0.75, 0.3], c: "yellow" },
    { ball: 0.12, s: [1, 0.4, 1.4], at: [0, 0.7, 0.55], c: "orange", seg: 8, segH: 6 },
    eyes(0.11, 0.82, 0.45, 0.04),
    { cone: [0.12, 0.25], rot: [-110, 0, 0], at: [0, 0.5, -0.55], c: "yellow", seg: 6 },
  ]),
  model("rabbit", ["Rabbit", "兔子"], "animals", 1, 1, 1.4, [
    { ball: 0.3, s: [0.9, 1, 1.1], at: [0, 0.4, -0.05], c: "white" },
    { ball: 0.22, at: [0, 0.8, 0.12], c: "white" },
    mirror({ ball: 0.09, s: [0.8, 3, 0.5], at: [0.09, 1.2, 0.05], rot: [0, 0, -8], c: "white", seg: 8, segH: 6 }),
    eyes(0.1, 0.85, 0.3, 0.04), { ball: 0.035, at: [0, 0.78, 0.34], c: "pink", seg: 5, segH: 4 },
    { ball: 0.1, at: [0, 0.3, -0.4], c: "white", seg: 6, segH: 4 },
  ]),
  model("frog", ["Frog", "青蛙"], "animals", 1, 1, 0.7, [
    { ball: 0.36, s: [1, 0.6, 1.1], at: [0, 0.25, 0], c: "green" },
    mirror({ ball: 0.13, at: [0.17, 0.5, 0.22], c: "white", seg: 8, segH: 6 }),
    eyes(0.19, 0.53, 0.33, 0.05),
    mirror({ ball: 0.12, s: [1.2, 0.5, 1.8], at: [0.33, 0.08, -0.15], c: "green", seg: 8, segH: 4 }),
  ]),
  model("fish", ["Fish", "魚"], "animals", 1, 2, 1.0, [
    { ball: 0.3, s: [0.6, 1.1, 1.5], at: [0, 0.5, 0.15], c: "orange" },
    { prism: [[-0.45, 0.15], [-0.45, 0.85], [-0.1, 0.5]].map(([u, v]) => [u - 0.15, v]), len: 0.06, axis: "x", c: "orange" },
    eyes(0.12, 0.6, 0.5, 0.05),
  ]),
  model("shark", ["Shark", "鯊魚"], "animals", 2, 4, 1.7, [
    { ball: 0.55, s: [0.8, 0.8, 3.0], at: [0, 0.6, 0.1], c: "grey", seg: 16 },
    { ball: 0.48, s: [0.75, 0.5, 2.8], at: [0, 0.42, 0.15], c: "white", seg: 16 },
    { prism: [[-0.3, 1.0], [0.4, 1.0], [-0.3, 1.7]], len: 0.08, axis: "x", c: "grey" },
    { prism: [[-1.5, 0.6], [-1.98, 1.4], [-1.8, 0.6], [-1.98, 0.1]], len: 0.08, axis: "x", c: "grey" },
    mirror({ prism: [[0, 0], [0.8, -0.3], [0.8, 0.1]], len: 0.06, axis: "z", at: [0.35, 0.4, 0.6], c: "grey" }),
    eyes(0.3, 0.75, 1.3, 0.05),
    { box: [0.4, 0.04, 0.06], at: [0, 0.48, 1.62], c: "black", bevel: 0 },
  ]),
  model("parrot", ["Parrot", "鸚鵡"], "animals", 1, 1, 1.4, [
    { ball: 0.26, s: [0.9, 1.4, 0.9], at: [0, 0.6, 0], c: "red" },
    { ball: 0.2, at: [0, 1.08, 0.08], c: "red" },
    { cone: [0.08, 0.18], rot: [120, 0, 0], at: [0, 1.0, 0.3], c: "yellow", seg: 5 },
    eyes(0.1, 1.12, 0.22, 0.035),
    mirror({ ball: 0.14, s: [0.4, 1.4, 0.9], at: [0.22, 0.65, -0.05], c: "blue", seg: 8, segH: 6 }),
    { box: [0.18, 0.5, 0.06], rot: [20, 0, 0], at: [0, 0.2, -0.25], c: "blue", bevel: 0 },
    { box: [0.5, 0.06, 0.12], at: [0, 0.03, 0.05], c: "wood", bevel: 0 },
  ]),
  model("crocodile", ["Crocodile", "鱷魚"], "animals", 2, 6, 0.9, [
    { ball: 0.5, s: [1.3, 0.75, 2.6], at: [0, 0.38, -0.3], c: "green" },
    { box: [0.7, 0.32, 1.6], at: [0, 0.32, 2.0], c: "green", bevel: 0.08 },
    { box: [0.66, 0.08, 1.5], at: [0, 0.32, 2.05], c: "white", bevel: 0 },
    mirror({ ball: 0.12, at: [0.25, 0.58, 1.3], c: "green", seg: 8, segH: 6 }), eyes(0.27, 0.66, 1.38, 0.04),
    { cone: [0.4, 2.2], rot: [-90, 0, 0], at: [0, 0.3, -2.6], s: [1.2, 1, 0.5], c: "green", seg: 8 },
    range(5, (i) => ({ cone: [0.08, 0.16], at: [0, 0.78, 0.6 - i * 0.45], c: "green", seg: 4 })),
    legs4(0.6, 0.8, 0.3, 0.11, "green"),
  ]),
  model("dragon", ["Dragon", "龍"], "animals", 4, 6, 4.2, [
    { ball: 0.85, s: [0.95, 0.9, 1.8], at: [0, 1.6, -0.3] },
    { ball: 0.6, s: [0.9, 0.6, 1.6], at: [0, 1.25, -0.25], c: "yellow" },
    legs4(0.55, 0.9, 1.0, 0.2, "main"),
    { cyl: [0.32, 0.42, 1.4], rot: [40, 0, 0], at: [0, 2.6, 1.15] },
    { box: [0.8, 0.6, 1.1], at: [0, 3.25, 1.75], bevel: 0.12 },
    eyes(0.38, 3.45, 1.75, 0.08).map((p) => ({ ...p, c: "yellow" })),
    mirror({ cone: [0.08, 0.5], rot: [-30, 0, -15], at: [0.25, 3.75, 1.45], c: "cream", seg: 6 }),
    mirror({ prism: [[0.4, 0], [2.0, 1.3], [1.9, 0.2], [1.2, -0.3]], len: 0.06, axis: "z", at: [0.2, 2.2, -0.2], c: "darkRed" }),
    { cone: [0.4, 2.4], rot: [-100, 0, 0], at: [0, 1.4, -2.4], c: "main", seg: 10 },
    range(4, (i) => ({ cone: [0.1, 0.3], at: [0, 2.35 - i * 0.05, 0.5 - i * 0.55], c: "yellow", seg: 4 })),
  ], { top: 2.4 }),
  model("turtle", ["Turtle", "烏龜"], "animals", 2, 2, 0.9, [
    { dome: 0.75, s: [1, 0.85, 1.1], at: [0, 0.1, 0], c: "green", seg: 12, segH: 5 },
    { cyl: [0.78, 0.1], at: [0, 0.12, 0], c: "lime" },
    { ball: 0.22, at: [0, 0.3, 0.9], c: "lime" }, eyes(0.1, 0.38, 1.06, 0.04),
    legs4(0.5, 0.45, 0.2, 0.12, "lime"),
  ]),
  model("owl", ["Owl", "貓頭鷹"], "animals", 1, 1, 1.4, [
    { ball: 0.36, s: [1, 1.3, 0.9], at: [0, 0.6, 0], c: "brown" },
    { ball: 0.24, s: [1, 1.2, 0.5], at: [0, 0.5, 0.15], c: "tan" },
    mirror({ ball: 0.13, at: [0.14, 0.95, 0.24], c: "yellow", seg: 10, segH: 8 }), eyes(0.14, 0.95, 0.36, 0.06),
    { cone: [0.05, 0.12], rot: [180, 0, 0], at: [0, 0.82, 0.32], c: "orange", seg: 4 },
    mirror({ cone: [0.08, 0.2], rot: [0, 0, -20], at: [0.22, 1.08, 0], c: "brown", seg: 4 }),
  ]),
  model("monkey", ["Monkey", "猴子"], "animals", 1, 1, 1.5, [
    { ball: 0.3, s: [0.9, 1.2, 0.85], at: [0, 0.55, 0], c: "brown" },
    { ball: 0.27, at: [0, 1.1, 0.05], c: "brown" },
    { ball: 0.18, s: [1.1, 0.9, 0.6], at: [0, 1.06, 0.22], c: "tan" }, eyes(0.08, 1.15, 0.3, 0.04),
    mirror({ ball: 0.1, s: [0.5, 1, 1], at: [0.28, 1.12, 0], c: "tan", seg: 8, segH: 6 }),
    mirror({ cyl: [0.06, 0.6], rot: [0, 0, 20], at: [0.3, 0.55, 0.05], c: "brown" }),
    { torus: [0.3, 0.05], arc: 200, rot: [0, 90, 0], at: [0, 0.45, -0.4], c: "brown", seg: 12, segT: 5 },
  ]),
  model("penguin", ["Penguin", "企鵝"], "animals", 1, 1, 1.3, [
    { ball: 0.34, s: [0.95, 1.5, 0.9], at: [0, 0.55, 0], c: "black" },
    { ball: 0.26, s: [0.9, 1.4, 0.5], at: [0, 0.5, 0.22], c: "white" },
    eyes(0.1, 0.95, 0.27, 0.04).map((p) => ({ ...p, c: "white" })),
    { cone: [0.06, 0.16], rot: [90, 0, 0], at: [0, 0.88, 0.36], c: "orange", seg: 5 },
    mirror({ ball: 0.1, s: [1, 0.3, 1.4], at: [0.12, 0.03, 0.15], c: "orange", seg: 6, segH: 4 }),
    mirror({ ball: 0.12, s: [0.3, 1.4, 0.7], rot: [0, 0, 15], at: [0.34, 0.6, 0], c: "black", seg: 6, segH: 6 }),
  ]),

  /* ── Hats and hair: 2×1 like a minifig, they sink over its head (C5) ── */
  hat("hat_crown", ["Crown", "王冠"], 0.45, 0.75, [
    { lathe: [[0.5, 0], [0.58, 0], [0.58, 0.32], [0.5, 0.32], [0.5, 0]], at: [0, 0, 0], c: "gold", seg: 16 },
    ring(0.52, 5, (x, z) => ({ cone: [0.1, 0.32], at: [x, 0.48, z], c: "gold", seg: 6 })),
    ring(0.6, 4, (x, z) => ({ ball: 0.07, at: [x, 0.16, z], c: "red", seg: 6, segH: 4 })),
  ]),
  hat("hat_knight", ["Knight Helmet", "騎士頭盔"], 0.95, 1.6, [
    { lathe: [[0.6, 0], [0.6, 0.55], [0.56, 0.9], [0.36, 1.1], [0.01, 1.14]], at: [0, 0, 0], c: "silver", seg: 16 },
    { box: [0.6, 0.08, 0.1], at: [0, 0.5, 0.56], c: "black", bevel: 0 },
    { cone: [0.13, 0.55], at: [0, 1.38, -0.1], seg: 8 },
  ]),
  hat("hat_viking", ["Viking Helmet", "維京頭盔"], 0.55, 1.1, [
    { dome: 0.6, s: [1, 0.9, 1], c: "silver", seg: 16 },
    { torus: [0.6, 0.05], axis: "y", at: [0, 0.03, 0], c: "brown", seg: 16, segT: 4 },
    mirror({ cone: [0.12, 0.6], rot: [0, 0, -50], at: [0.75, 0.55, 0], c: "cream", seg: 8 }),
  ]),
  hat("hat_pirate", ["Pirate Hat", "海盜帽"], 0.5, 0.75, [
    { dome: 0.56, s: [1, 0.85, 1] },
    { prism: [[0, 1.0], [0.95, -0.55], [-0.95, -0.55]], len: 0.08, axis: "y", at: [0, 0.02, 0] },
    { ball: 0.09, at: [0, 0.28, 0.5], c: "white", seg: 6, segH: 4 },
  ]),
  hat("hat_wizard", ["Wizard Hat", "巫師帽"], 0.45, 1.75, [
    { cyl: [0.95, 0.06], seg: 18 }, { cone: [0.52, 1.6], at: [0, 0.84, 0], seg: 14 },
    { ball: 0.1, at: [0.18, 0.6, 0.38], c: "gold", seg: 6, segH: 4 },
  ]),
  hat("hat_cap", ["Cap", "棒球帽"], 0.45, 0.5, [
    { dome: 0.57, s: [1, 0.75, 1] },
    { prism: circle(0.5, 12).filter(([, v]) => v >= -0.01).map(([u, v]) => [u, v]), len: 0.05, axis: "y", at: [0, 0.03, 0.42] },
  ]),
  hat("hat_cowboy", ["Cowboy Hat", "牛仔帽"], 0.45, 0.6, [
    { cyl: [1.0, 0.06], seg: 18 }, { cyl: [0.5, 0.56, 0.5], at: [0, 0.3, 0], seg: 14 },
    { cyl: [0.57, 0.1], at: [0, 0.12, 0], c: "dark", seg: 14 },
  ]),
  hat("hat_hard", ["Hard Hat", "安全帽"], 0.45, 0.6, [
    { dome: 0.6, s: [1, 0.85, 1.05] }, { torus: [0.62, 0.06], axis: "y", at: [0, 0.03, 0], seg: 16, segT: 4 },
    { box: [0.1, 0.45, 1.1], at: [0, 0.32, 0], bevel: 0 },
  ]),
  hat("hat_space", ["Space Helmet", "太空頭盔"], 1.05, 1.5, [
    { ball: 0.74, at: [0, 0.55, 0], c: "glass", seg: 18, segH: 12 },
    { torus: [0.62, 0.08], axis: "y", at: [0, 0, 0], seg: 18, segT: 5 },
  ]),
  hat("hair_ponytail", ["Ponytail Hair", "馬尾頭髮"], 0.45, 0.6, [
    { dome: 0.57, s: [1, 0.85, 1] }, { box: [1.08, 0.65, 0.3], at: [0, -0.1, -0.38] },
    { ball: 0.25, s: [0.9, 1.3, 0.9], at: [0, -0.1, -0.65] },
  ]),
  hat("hair_long", ["Long Hair", "長髮"], 0.45, 0.6, [
    { dome: 0.57, s: [1, 0.85, 1] }, { box: [1.12, 1.25, 0.34], at: [0, -0.35, -0.36] },
    mirror({ box: [0.2, 0.9, 0.5], at: [0.5, -0.25, -0.05] }),
  ]),

  /* ── Home & town ── */
  model("table", ["Table 2×4", "桌子 2×4"], "home", 2, 4, 1.45, [
    { box: [1.96, 0.25, 3.96], at: [0, 1.32, 0] }, legs4(0.75, 1.75, 1.2, 0.1, "main"),
  ]),
  model("chair", ["Chair", "椅子"], "home", 2, 2, 2.2, [
    { box: [1.7, 0.22, 1.7], at: [0, 0.89, 0.1] }, legs4(0.7, 0.7, 0.8, 0.08, "main"),
    { box: [1.7, 1.25, 0.16], at: [0, 1.62, -0.74] },
  ], { top: 1.0 }),
  model("bed", ["Bed 2×6", "床 2×6"], "home", 2, 6, 1.9, [
    { box: [1.96, 0.5, 5.6], at: [0, 0.35, 0.18], c: "wood" },
    { box: [1.96, 1.9, 0.3], at: [0, 0.95, -2.83], c: "wood" },
    { box: [1.8, 0.3, 5.3], at: [0, 0.75, 0.25], c: "white" },
    { box: [1.84, 0.12, 3.6], at: [0, 0.92, 1.0] },
    { box: [1.3, 0.25, 0.8], at: [0, 1.0, -2.2], c: "white" },
  ], { top: 1.0 }),
  model("sofa", ["Sofa 4×2", "沙發 4×2"], "home", 4, 2, 1.8, [
    { box: [3.96, 0.7, 1.96], at: [0, 0.35, 0] },
    { box: [3.96, 1.1, 0.5], at: [0, 1.25, -0.73] },
    mirror({ box: [0.4, 0.55, 1.96], at: [1.78, 0.98, 0] }),
    [-0.8, 0.8].map((x) => ({ box: [1.5, 0.22, 1.4], at: [x, 0.8, 0.2], c: "cream" })),
  ], { top: 0.9 }),
  model("floor_lamp", ["Floor Lamp", "立燈"], "home", 1, 1, 3.3, [
    { cyl: [0.4, 0.12], c: "dark" }, { cyl: [0.05, 2.6], at: [0, 1.4, 0], c: "dark" },
    { ball: 0.18, at: [0, 2.7, 0], c: "glow", seg: 8, segH: 6 },
    { lathe: [[0.48, 0], [0.26, 0.6]], at: [0, 2.6, 0], seg: 14 },
  ]),
  model("bookshelf", ["Bookshelf", "書架"], "home", 3, 1, B * 3, [
    { box: [2.96, B * 3, 0.1], at: [0, B * 1.5, -0.43] },
    mirror({ box: [0.12, B * 3, 0.96], at: [1.42, B * 1.5, 0] }),
    [0, 1.2, 2.4, 3.48].map((y) => ({ box: [2.96, 0.12, 0.96], at: [0, y + 0.06, 0] })),
    [0.12, 1.32, 2.52].map((y, row) => range(7, (i) => ({ box: [0.26, 0.75 + ((i + row) % 3) * 0.1, 0.7], at: [-1.05 + i * 0.35, y + 0.42 + ((i + row) % 3) * 0.05, 0.05],
      c: ["red", "blue", "yellow", "green", "purple", "orange", "azure"][(i + row * 2) % 7], bevel: 0 }))),
  ]),
  model("tv", ["TV", "電視"], "home", 3, 1, 2.3, [
    { box: [1.4, 0.12, 0.7], at: [0, 0.06, 0], c: "dark" }, { box: [0.2, 0.5, 0.15], at: [0, 0.35, -0.1], c: "dark" },
    { box: [2.9, 1.7, 0.18], at: [0, 1.45, 0], c: "black" },
    { box: [2.65, 1.48, 0.02], at: [0, 1.45, 0.1], c: "screen", bevel: 0 },
  ]),
  model("stove", ["Kitchen Stove", "爐子"], "home", 2, 2, 1.9, [
    { box: [1.96, 1.8, 1.96], at: [0, 0.9, 0] },
    { box: [1.9, 0.06, 1.9], at: [0, 1.83, 0], c: "black", bevel: 0 },
    grid(2, 2).map(([x, z]) => ({ torus: [0.24, 0.04], axis: "y", at: [x * 0.95, 1.88, z * 0.95], c: "dark", seg: 12, segT: 4 })),
    { box: [1.3, 0.75, 0.04], at: [0, 0.65, 0.98], c: "glass", bevel: 0 },
    range(4, (i) => ({ cyl: [0.07, 0.08], axis: "z", at: [-0.6 + i * 0.4, 1.4, 1.0], c: "black" })),
  ]),
  model("fridge", ["Fridge", "冰箱"], "home", 2, 2, B * 4, [
    { box: [1.96, B * 4, 1.96], at: [0, B * 2, 0] },
    { box: [1.9, 0.04, 0.04], at: [0, 3.1, 1.0], c: "dark", bevel: 0 },
    [3.6, 2.2].map((y) => ({ box: [0.08, 0.7, 0.08], at: [0.75, y, 1.02], c: "silver", bevel: 0 })),
  ]),
  model("toilet", ["Toilet", "馬桶"], "home", 2, 2, 1.8, [
    { lathe: [[0.01, 0], [0.32, 0], [0.42, 0.45], [0.55, 0.85], [0.01, 0.85]], at: [0, 0, 0.2], c: "white", seg: 16 },
    { torus: [0.45, 0.07], axis: "y", s: [1, 1, 1.15], at: [0, 0.88, 0.2], c: "white", seg: 16, segT: 5 },
    { box: [1.2, 0.9, 0.45], at: [0, 1.25, -0.72], c: "white" },
    { box: [0.2, 0.06, 0.1], at: [0.35, 1.55, -0.48], c: "silver", bevel: 0 },
  ], { top: 0.92 }),
  model("bathtub", ["Bathtub 2×4", "浴缸 2×4"], "home", 2, 4, 1.2, [
    { box: [1.96, 1.1, 3.96], at: [0, 0.55, 0], c: "white", bevel: 0.15 },
    { box: [1.6, 0.04, 3.6], at: [0, 0.95, 0], c: "water", bevel: 0 },
    { cyl: [0.06, 0.6], rot: [60, 0, 0], at: [0, 1.25, -1.75], c: "silver" },
  ]),
  model("plant_pot", ["Potted Plant", "盆栽"], "home", 1, 1, 1.6, [
    { lathe: [[0.01, 0], [0.3, 0], [0.42, 0.55], [0.01, 0.55]], at: [0, 0, 0] },
    { cyl: [0.38, 0.04], at: [0, 0.5, 0], c: "brown" },
    [[0, 1.05, 0, 0.35], [0.2, 0.85, 0.15, 0.25], [-0.2, 0.9, -0.1, 0.25], [0.05, 1.32, 0.05, 0.22]].map(([x, y, z, r]) => ({ ball: r, at: [x, y, z], c: "leaf", seg: 10, segH: 7 })),
  ]),
  model("mailbox", ["Mailbox", "郵筒"], "home", 1, 1, 2.6, [
    { cyl: [0.4, 0.06], c: "dark" },
    { box: [0.85, 1.7, 0.85], at: [0, 1.2, 0] }, { dome: 0.43, s: [1, 0.6, 1], at: [0, 2.05, 0] },
    { box: [0.5, 0.06, 0.04], at: [0, 1.75, 0.44], c: "black", bevel: 0 },
  ]),
  model("bench", ["Park Bench", "公園長椅"], "home", 4, 2, 1.7, [
    [-0.4, 0, 0.4].map((z) => ({ box: [3.9, 0.1, 0.3], at: [0, 0.82, z], c: "wood", bevel: 0 })),
    [1.15, 1.5].map((y) => ({ box: [3.9, 0.22, 0.1], at: [0, y, -0.7], c: "wood", bevel: 0 })),
    mirror({ box: [0.12, 0.8, 1.2], at: [1.6, 0.4, 0], c: "black", bevel: 0 }),
    mirror({ box: [0.12, 1.0, 0.1], at: [1.6, 1.2, -0.65], c: "black", bevel: 0 }),
  ], { top: 0.87 }),
  model("street_lamp", ["Street Lamp", "路燈"], "home", 1, 1, 6, [
    { cyl: [0.38, 0.2], c: "dark" }, { cyl: [0.1, 5.4], at: [0, 2.9, 0], c: "dark" },
    { cyl: [0.06, 1.0], axis: "x", at: [0.45, 5.55, 0], c: "dark" },
    { lathe: [[0.4, 0], [0.3, 0.35], [0.01, 0.4]], at: [0.9, 5.15, 0], c: "dark", seg: 12 },
    { ball: 0.22, at: [0.9, 5.2, 0], c: "glow", seg: 8, segH: 6 },
  ]),
  model("traffic_light", ["Traffic Light", "紅綠燈"], "home", 1, 1, 5.2, [
    { cyl: [0.38, 0.2], c: "dark" }, { cyl: [0.1, 3.4], at: [0, 1.9, 0], c: "dark" },
    { box: [0.7, 1.7, 0.6], at: [0, 4.3, 0], c: "black" },
    [["redLight", 4.85], ["amberLight", 4.3], ["greenLight", 3.75]].map(([c, y]) => ({ cyl: [0.2, 0.06], axis: "z", at: [0, y, 0.31], c })),
  ]),

  /* ── Castle ── */
  model("battlement", ["Battlement 1×4", "城垛 1×4"], "castle", 1, 4, B * 2, [
    { box: [0.98, B, 3.96], at: [0, B / 2, 0] },
    [-1.5, 0.5].map((z) => ({ box: [0.98, B, 0.96], at: [0, B * 1.5, z] })),
    { studs: [[0, -1.5], [0, 0.5]], at: [0, B * 2, 0] },
  ]),
  model("portcullis", ["Portcullis", "城門柵欄"], "castle", 1, 4, B * 4, [
    range(5, (i) => ({ cyl: [0.07, B * 4 - 0.3], at: [0, (B * 4 - 0.3) / 2 + 0.3, -1.6 + i * 0.8], c: "dark" })),
    range(5, (i) => ({ cone: [0.1, 0.3], rot: [180, 0, 0], at: [0, 0.15, -1.6 + i * 0.8], c: "dark", seg: 6 })),
    [1.4, 2.8, 4.3].map((y) => ({ box: [0.16, 0.14, 3.9], at: [0, y, 0], c: "dark", bevel: 0 })),
  ]),
  model("banner", ["Castle Banner", "城堡旗幟"], "castle", 1, 1, 5.6, [
    { cyl: [0.3, 0.2], c: "dark" }, { cyl: [0.07, 5.2], at: [0, 2.8, 0], c: "steel" },
    { ball: 0.14, at: [0, 5.45, 0], c: "gold", seg: 8, segH: 6 },
    { prism: [[0, 0], [1.8, 0], [1.8, -1.6], [0.9, -1.2], [0, -1.6]].map(([u, v]) => [u, v + 5.2]), len: 0.04, axis: "z", at: [0.07, 0, 0] },
  ]),
  model("torch", ["Torch", "火把"], "castle", 1, 1, 1.8, [
    { box: [0.5, 0.3, 0.5], at: [0, 0.15, 0], c: "dark" },
    { cyl: [0.07, 0.05, 1.1], at: [0, 0.85, 0], c: "wood" },
    { cyl: [0.13, 0.15], at: [0, 1.4, 0], c: "dark" },
    { cone: [0.15, 0.4], at: [0, 1.65, 0], c: "fire", seg: 8 }, { ball: 0.11, at: [0, 1.52, 0], c: "glow", seg: 8, segH: 6 },
  ]),
  model("weapon_rack", ["Weapon Rack", "武器架"], "castle", 2, 1, 2.8, [
    { box: [1.96, 0.2, 0.9], at: [0, 0.1, 0], c: "wood" },
    mirror({ box: [0.14, 2.2, 0.14], at: [0.9, 1.1, -0.3], c: "wood", bevel: 0 }), { box: [1.96, 0.14, 0.14], at: [0, 2.0, -0.3], c: "wood", bevel: 0 },
    { box: [0.12, 1.6, 0.04], at: [-0.45, 1.2, 0], c: "silver", bevel: 0 }, { box: [0.45, 0.08, 0.1], at: [-0.45, 2.0, 0], c: "gold", bevel: 0 },
    { cyl: [0.05, 0.35], at: [-0.45, 2.2, 0], c: "brown" },
    { cyl: [0.04, 2.4], at: [0.4, 1.3, 0], c: "wood" }, { cone: [0.09, 0.3], at: [0.4, 2.65, 0], c: "steel", seg: 6 },
  ]),
  model("shield", ["Shield", "盾牌"], "castle", 2, 1, 2.0, [
    { box: [1.0, 0.16, 0.6], at: [0, 0.08, -0.1], c: "wood" },
    { prism: [[-0.8, 1.95], [0.8, 1.95], [0.8, 1.1], [0.4, 0.5], [0, 0.25], [-0.4, 0.5], [-0.8, 1.1]], len: 0.1, at: [0, 0, 0.05] },
    { box: [0.12, 1.4, 0.04], at: [0, 1.15, 0.12], c: "gold", bevel: 0 }, { box: [1.3, 0.12, 0.04], at: [0, 1.4, 0.12], c: "gold", bevel: 0 },
  ]),
  model("throne", ["Throne", "王座"], "castle", 2, 2, 3.6, [
    { box: [1.96, 0.3, 1.96], at: [0, 0.15, 0], c: "gold" },
    { box: [1.6, 0.7, 1.5], at: [0, 0.65, 0.1] },
    { box: [1.6, 2.6, 0.3], at: [0, 2.0, -0.75] },
    mirror({ box: [0.25, 0.5, 1.5], at: [0.88, 1.15, 0.1], c: "gold" }),
    mirror({ cone: [0.12, 0.35], at: [0.7, 3.45, -0.75], c: "gold", seg: 6 }), { ball: 0.2, at: [0, 3.4, -0.75], c: "gold", seg: 8, segH: 6 },
  ], { top: 1.0 }),
  model("sword_stone", ["Sword in the Stone", "石中劍"], "castle", 2, 2, 2.8, [
    { ball: 0.85, s: [1.15, 0.65, 1], at: [0, 0.45, 0], c: "grey", seg: 8, segH: 5 },
    { box: [0.14, 1.4, 0.05], at: [0, 1.4, 0], c: "silver", bevel: 0 },
    { box: [0.6, 0.1, 0.12], at: [0, 2.1, 0], c: "gold", bevel: 0 },
    { cyl: [0.06, 0.4], at: [0, 2.35, 0], c: "brown" }, { ball: 0.1, at: [0, 2.6, 0], c: "gold", seg: 8, segH: 6 },
  ]),
  model("catapult", ["Catapult", "投石機"], "castle", 2, 4, 2.6, [
    mirror({ box: [0.2, 0.3, 3.8], at: [0.8, 0.55, 0], c: "wood", bevel: 0 }),
    [-1.4, 1.4].map((z) => ({ box: [1.8, 0.2, 0.2], at: [0, 0.55, z], c: "wood", bevel: 0 })),
    [-1.3, 1.3].map((z) => mirror({ torus: [0.35, 0.08], axis: "x", at: [0.95, 0.43, z], c: "wood", seg: 12, segT: 4 })),
    mirror({ box: [0.16, 1.2, 0.2], at: [0.6, 1.2, 0.3], c: "wood", bevel: 0 }),
    { box: [0.18, 0.14, 3.0], rot: [30, 0, 0], at: [0, 1.5, -0.1], c: "wood", bevel: 0 },
    { dome: 0.3, rot: [150, 0, 0], at: [0, 2.25, -1.4], c: "wood", seg: 10, segH: 5 },
    { ball: 0.24, at: [0, 2.25, -1.4], c: "grey", seg: 8, segH: 6 },
  ]),
  model("well", ["Well", "水井"], "castle", 2, 2, 3.4, [
    { lathe: [[0.75, 0], [0.97, 0], [0.97, 0.9], [0.75, 0.9], [0.75, 0.05]], at: [0, 0, 0], c: "grey", seg: 16 },
    { cyl: [0.76, 0.04], at: [0, 0.6, 0], c: "water" },
    mirror({ box: [0.12, 2.6, 0.12], at: [0.85, 1.6, 0], c: "wood", bevel: 0 }),
    { cyl: [0.06, 1.8], axis: "x", at: [0, 2.3, 0], c: "wood" },
    { prism: [[-1.1, 2.6], [1.1, 2.6], [0, 3.4]], len: 1.96, axis: "z" },
    { cyl: [0.18, 0.14, 0.3], at: [0, 1.4, 0], c: "wood" },
  ]),

  /* ── Pirates ── */
  model("treasure_chest", ["Treasure Chest", "寶箱"], "pirates", 2, 1, 1.5, [
    { box: [1.6, 0.7, 0.9], at: [0, 0.35, 0], c: "wood" },
    [-0.5, 0.5].map((x) => ({ box: [0.12, 0.72, 0.92], at: [x, 0.36, 0], c: "gold", bevel: 0 })),
    [[-0.35, 0.75, 0], [0.3, 0.78, 0.1], [0, 0.82, -0.1], [0.45, 0.72, -0.15], [-0.1, 0.74, 0.2]].map((at) => ({ ball: 0.16, s: [1, 0.5, 1], at, c: "gold", seg: 8, segH: 5 })),
    { ball: 0.1, at: [0.15, 0.85, 0.2], c: "red", seg: 6, segH: 4 },
    { cyl: [0.45, 1.6], axis: "x", s: [1, 1, 0.5], rot: [-70, 0, 0], at: [0, 1.0, -0.6], c: "wood" },
  ]),
  model("cannon", ["Cannon", "大砲"], "pirates", 2, 4, 1.8, [
    { box: [1.2, 0.5, 2.6], at: [0, 0.55, -0.3], c: "wood" },
    [-1.0, 0.6].map((z) => mirror({ cyl: [0.4, 0.14], axis: "x", at: [0.7, 0.4, z], c: "wood" })),
    { cyl: [0.32, 0.42, 3.0], rot: [80, 0, 0], at: [0, 1.15, 0.3], c: "black" },
    { torus: [0.33, 0.07], at: [0, 1.4, 1.75], rot: [-10, 0, 0], c: "black", seg: 14, segT: 4 },
    { ball: 0.25, at: [0, 1.0, -1.6], c: "black", seg: 8, segH: 6 },
  ]),
  model("anchor", ["Anchor", "船錨"], "pirates", 2, 1, 2.8, [
    { box: [0.16, 2.2, 0.16], at: [0, 1.35, 0], c: "dark", bevel: 0 },
    { torus: [0.2, 0.05], at: [0, 2.6, 0], c: "dark", seg: 10, segT: 4 },
    { cyl: [0.07, 1.1], axis: "x", at: [0, 2.15, 0], c: "dark" },
    { torus: [0.7, 0.08], arc: 180, rot: [0, 0, 180], at: [0, 0.95, 0], c: "dark", seg: 14, segT: 5 },
    mirror({ cone: [0.14, 0.35], rot: [0, 0, -30], at: [0.75, 0.95, 0], c: "dark", seg: 4 }),
  ]),
  model("ship_wheel", ["Ship's Wheel", "船舵"], "pirates", 2, 1, 2.8, [
    { box: [0.5, 1.4, 0.5], at: [0, 0.7, -0.15], c: "wood" },
    { torus: [0.7, 0.07], at: [0, 1.95, 0.2], c: "wood", seg: 20, segT: 5 },
    range(4, (i) => ({ box: [0.07, 2.0, 0.07], rot: [0, 0, i * 45], at: [0, 1.95, 0.2], c: "wood", bevel: 0 })),
    { cyl: [0.14, 0.2], axis: "z", at: [0, 1.95, 0.2], c: "gold" },
  ]),
  /* 8 tall, the height cap (A3). */
  model("mast", ["Mast & Sail", "桅杆與帆"], "pirates", 2, 1, 8, [
    { cyl: [0.22, 0.26, 8], c: "wood" },
    [6.9, 3.5].map((y) => ({ cyl: [0.1, 5.2], axis: "x", at: [0, y, 0.1], c: "wood" })),
    { box: [4.8, 3.2, 0.06], at: [0, 5.2, 0.25], bevel: 0 },
    { lathe: [[0.45, 0], [0.55, 0], [0.55, 0.5], [0.45, 0.5], [0.45, 0]], at: [0, 7.0, 0], c: "wood", seg: 12 },
    { prism: [[0, 0], [0.9, -0.25], [0, -0.5]].map(([u, v]) => [u, v + 7.95]), len: 0.04, at: [0.24, 0, 0], c: "black" },
  ]),
  model("pirate_flag", ["Pirate Flag", "海盜旗"], "pirates", 1, 1, 5.2, [
    { cyl: [0.3, 0.2], c: "dark" }, { cyl: [0.07, 5.0], at: [0, 2.7, 0], c: "wood" },
    { box: [1.8, 1.2, 0.04], at: [0.95, 4.5, 0], c: "black", bevel: 0 },
    { ball: 0.22, s: [1, 1, 0.3], at: [0.95, 4.62, 0.03], c: "white", seg: 10, segH: 8 },
    [45, -45].map((a) => ({ box: [0.7, 0.07, 0.03], rot: [0, 0, a], at: [0.95, 4.3, 0.03], c: "white", bevel: 0 })),
  ]),
  model("gold_pile", ["Gold Coins", "金幣堆"], "pirates", 2, 2, 0.8, [
    { dome: 0.85, s: [1, 0.55, 1], c: "gold", seg: 14, segH: 6 },
    [[0.7, 0.05, 0.4], [-0.6, 0.05, 0.6], [0.2, 0.05, -0.8], [0.8, 0.05, -0.4]].map((at) => ({ cyl: [0.16, 0.05], at, c: "gold" })),
    [[0.2, 0.42, 0.3, "red"], [-0.3, 0.38, -0.2, "azure"], [0.1, 0.46, -0.3, "lime"]].map(([x, y, z, c]) => ({ ball: 0.1, at: [x, y, z], c, seg: 6, segH: 4 })),
  ]),
  model("lifebuoy", ["Life Ring", "救生圈"], "pirates", 2, 2, 0.4, [
    { torus: [0.62, 0.2], axis: "y", at: [0, 0.2, 0], c: "white", seg: 20, segT: 8 },
    [0, 90, 180, 270].map((a) => ({ torus: [0.62, 0.21], arc: 30, axis: "y", rot: [0, a, 0], at: [0, 0.2, 0], c: "red", seg: 4, segT: 8 })),
  ]),
  model("treasure_map", ["Treasure Map", "藏寶圖"], "pirates", 2, 2, 0.15, [
    { box: [1.9, 0.08, 1.7], at: [0, 0.04, 0], c: "tan", bevel: 0 },
    [45, -45].map((a) => ({ box: [0.45, 0.02, 0.08], rot: [0, a, 0], at: [0.45, 0.09, -0.35], c: "red", bevel: 0 })),
    range(5, (i) => ({ box: [0.18, 0.02, 0.06], rot: [0, -30, 0], at: [-0.6 + i * 0.22, 0.09, 0.45 - i * 0.16], c: "red", bevel: 0 })),
    { ball: 0.12, s: [1, 0.3, 1], at: [-0.6, 0.08, -0.5], c: "leaf", seg: 8, segH: 4 },
  ]),

  /* ── Space ── */
  model("radar_dish", ["Radar Dish", "雷達天線"], "space", 2, 2, 2.6, [
    { box: [1.96, P, 1.96], at: [0, P / 2, 0] },
    { cyl: [0.12, 1.1], at: [0, 0.95, 0], c: "steel" },
    { lathe: [[0.01, 0], [0.5, 0.06], [0.85, 0.3], [0.95, 0.42]], rot: [-40, 0, 0], at: [0, 1.5, 0.1], c: "silver", seg: 18 },
    { cyl: [0.03, 0.6], rot: [-40, 0, 0], at: [0, 1.75, 0.3], c: "dark" },
    { ball: 0.08, at: [0, 2.0, 0.5], c: "fire", seg: 6, segH: 4 },
  ]),
  model("antenna", ["Antenna", "天線"], "space", 1, 1, 3.2, [
    { cyl: [0.45, P], seg: 16 },
    { cyl: [0.04, 2.6], at: [0, 1.7, 0], c: "steel" },
    [1.6, 2.2].map((y) => ({ box: [0.6, 0.04, 0.04], at: [0, y, 0], c: "steel", bevel: 0 })),
    { ball: 0.1, at: [0, 3.05, 0], c: "fire", seg: 8, segH: 6 },
  ]),
  model("console", ["Control Console", "控制台"], "space", 2, 2, 1.8, [
    { prism: [[-0.98, 0], [0.98, 0], [0.98, 0.9], [-0.3, 1.6], [-0.98, 1.6]], len: 1.96, axis: "x" },
    { box: [1.6, 0.04, 0.9], rot: [29, 0, 0], at: [0, 1.27, 0.36], c: "screen", bevel: 0 },
    [["redLight", -0.5], ["greenLight", 0], ["amberLight", 0.5]].map(([c, x]) => ({ ball: 0.07, at: [x, 0.95, 0.99], c, seg: 6, segH: 4 })),
  ]),
  model("crystal", ["Energy Crystal", "能量水晶"], "space", 1, 1, 1.7, [
    { cone: [0.25, 1.2], at: [0, 0.6, 0], c: "neon", seg: 6 },
    { cone: [0.16, 0.8], rot: [0, 0, 25], at: [0.22, 0.4, 0.1], c: "neon", seg: 6 },
    { cone: [0.14, 0.7], rot: [20, 0, -20], at: [-0.2, 0.33, -0.05], c: "neon", seg: 6 },
    { ball: 0.3, s: [1.2, 0.4, 1.2], at: [0, 0.05, 0], c: "grey", seg: 7, segH: 4 },
  ]),
  model("solar_panel", ["Solar Panel", "太陽能板"], "space", 2, 4, 1.8, [
    { box: [0.96, P, 0.96], at: [0, P / 2, 0] },
    { cyl: [0.08, 0.9], at: [0, 0.85, 0], c: "steel" },
    { box: [1.9, 0.06, 3.8], rot: [25, 0, 0], at: [0, 1.4, 0], c: "navy", bevel: 0 },
    range(3, (i) => ({ box: [0.03, 0.08, 3.8], rot: [25, 0, 0], at: [-0.48 + i * 0.48, 1.41, 0], c: "silver", bevel: 0 })),
  ]),
  model("teleporter", ["Teleporter Pad", "傳送台"], "space", 4, 4, 3.2, [
    { cyl: [1.95, P], seg: 28 },
    { torus: [1.6, 0.08], axis: "y", at: [0, P, 0], c: "neon", seg: 28, segT: 5 },
    { cyl: [1.2, 0.05], at: [0, P + 0.02, 0], c: "neon", seg: 24 },
    { cyl: [1.5, 2.6], at: [0, P + 1.3, 0], c: "beam", open: true, seg: 24 },
  ]),
  model("base_dome", ["Moon Base Dome 6×6", "月球基地圓頂 6×6"], "space", 6, 6, 3.4, [
    { cyl: [2.96, 0.5], seg: 32 },
    { dome: 2.8, at: [0, 0.48, 0], c: "glass", seg: 28, segH: 10 },
    { box: [1.4, 1.8, 0.8], at: [0, 1.35, 2.5] },
    { box: [1.0, 1.4, 0.04], at: [0, 1.2, 2.92], c: "glass", bevel: 0 },
  ]),
  model("rocket", ["Rocket", "火箭"], "space", 2, 2, 7, [
    { cyl: [0.32, 0.5, 0.5], at: [0, 0.25, 0], c: "dark" },
    { cyl: [0.75, 4.4], at: [0, 2.7, 0], seg: 20 },
    { cone: [0.75, 1.6], at: [0, 5.7, 0], c: "white", seg: 20 },
    { torus: [0.75, 0.06], axis: "y", at: [0, 4.9, 0], c: "white", seg: 20, segT: 4 },
    { cyl: [0.26, 0.06], axis: "z", at: [0, 3.9, 0.74], c: "glass" }, { torus: [0.27, 0.05], at: [0, 3.9, 0.76], c: "silver", seg: 14, segT: 4 },
    ring(0.75, 3, (x, z, a) => ({ prism: [[0, 0.5], [0.6, 0.3], [0.6, 0.9], [0, 2.0]], len: 0.08, axis: "z", rot: [0, a - 90, 0], at: [x, 0, z] })),
    { cone: [0.3, 0.6], rot: [180, 0, 0], at: [0, -0.05, 0], c: "fire", seg: 8 },
  ]),
  model("ufo", ["Flying Saucer", "飛碟"], "space", 4, 4, 2.0, [
    ring(1.1, 3, (x, z) => ({ cyl: [0.05, 0.6], at: [x, 0.3, z], c: "steel" })),
    { lathe: [[0.01, 0.55], [1.2, 0.6], [1.95, 0.9], [1.2, 1.15], [0.01, 1.2]], at: [0, 0, 0], c: "silver", seg: 28 },
    { torus: [1.95, 0.08], axis: "y", at: [0, 0.9, 0], seg: 28, segT: 5 },
    { dome: 0.85, at: [0, 1.12, 0], c: "glass", seg: 20 },
    ring(1.5, 8, (x, z) => ({ ball: 0.1, at: [x, 0.82, z], c: "neon", seg: 6, segH: 4 })),
  ]),
  model("alien_plant", ["Alien Plant", "外星植物"], "space", 1, 1, 2.2, [
    [[0, 0, 1.6], [0.3, -0.15, 1.1], [-0.28, -0.1, 0.85]].map(([x, z, h]) => [
      { cyl: [0.05, 0.08, h], at: [x, h / 2, z], c: "purple" },
      { ball: 0.18, at: [x, h + 0.12, z], c: "neon", seg: 8, segH: 6 },
    ]),
    { ball: 0.35, s: [1, 0.4, 1], at: [0, 0.1, 0], c: "purple", seg: 8, segH: 4 },
  ]),
  model("fuel_tank", ["Fuel Tank", "燃料槽"], "space", 2, 2, 2.6, [
    { cyl: [0.9, 2.0], at: [0, 1.15, 0], seg: 20 },
    [0.2, 2.1].map((y) => ({ dome: 0.9, s: [1, 0.3, 1], at: [0, y, 0], rot: y < 1 ? [180, 0, 0] : [0, 0, 0], seg: 20, segH: 4 })),
    [0.6, 1.7].map((y) => ({ torus: [0.92, 0.05], axis: "y", at: [0, y, 0], c: "steel", seg: 20, segT: 4 })),
    { cyl: [0.08, 0.5], at: [0, 2.5, 0], c: "steel" },
  ]),
  model("satellite", ["Satellite", "衛星"], "space", 2, 2, 2.0, [
    { box: [0.9, 1.0, 0.9], at: [0, 0.9, 0], c: "gold" },
    mirror({ box: [1.6, 0.04, 0.8], at: [1.3, 0.9, 0], c: "navy", bevel: 0 }),
    mirror({ cyl: [0.03, 0.4], axis: "x", at: [0.6, 0.9, 0], c: "steel" }),
    { lathe: [[0.01, 0], [0.3, 0.05], [0.42, 0.2]], at: [0, 1.4, 0], c: "silver", seg: 14 },
    { cyl: [0.06, 0.4], at: [0, 0.2, 0], c: "steel" },
  ]),
]);
