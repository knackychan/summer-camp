/* Assemblies: a wall, a floor, a tower or a bridge of one part, placed in one
   go (docs/plans/2026-10-06-brick-lab-assemblies/ design.md A3, A6; slice 02).
   Pure: no DOM, no Three.

   Sizes count blocks of the armed part, never studs (A3): `along` is the
   part's long side, `across` its short side, `up` the layers. At rotation 0
   (and 180) `along` runs along x; at 90 (and 270) along z. Every block of an
   assembly has the same rotation, so its long side follows `along`.

   A block is { dx, dz, layer }: whole blocks from the anchor corner, the
   assembly's smallest x and z. Studs edges sit on whole units (D11), so the
   anchor corner is a whole number and every block lands on the stud grid. */

export const ASSEMBLY_MAX = 64;
export const ASSEMBLY_PATTERNS = Object.freeze(["wall", "floor", "tower", "bridge"]);
export const ASSEMBLY_DEFAULTS = Object.freeze({
  wall: Object.freeze({ along: 8, across: 1, up: 3 }),
  floor: Object.freeze({ along: 4, across: 4, up: 1 }),
  tower: Object.freeze({ along: 2, across: 2, up: 8 }),
  bridge: Object.freeze({ along: 6, across: 1, up: 3 }),
});
/* The steppers each pattern shows: a wall is one block thick, a floor one layer. */
export const ASSEMBLY_KEYS = Object.freeze({
  wall: Object.freeze(["along", "up"]),
  floor: Object.freeze(["along", "across"]),
  tower: Object.freeze(["along", "across", "up"]),
  bridge: Object.freeze(["along", "across", "up"]),
});
const ISLAND_HALF = 32;
const TILING = new Set(["bricks", "plates", "tiles"]);

const whole = (value) => Math.max(1, Math.floor(Number(value) || 1));
const turn = (rotation) => ((Math.round((Number(rotation) || 0) / 90) * 90) % 360 + 360) % 360;

/* True when a part may be tiled: a plain box of Bricks, Plates or Tiles. */
export function assemblyParts(part) {
  return !!part && TILING.has(part.category) && part.shape === "rect";
}

/* The rotation every block takes so its long side runs along the assembly. */
export function blockRotation(part, rotation = 0) {
  const base = part.width >= part.depth ? 0 : 90;
  return (base + turn(rotation)) % 360;
}

/* One block's footprint in world studs: { w (x), d (z) }. */
function blockSize(part, rotation) {
  const long = Math.max(part.width, part.depth);
  const short = Math.min(part.width, part.depth);
  return turn(rotation) % 180 ? { w: short, d: long } : { w: long, d: short };
}

/* Fixed sizes per pattern: a wall's across and a floor's up are always 1. */
function shape(pattern, along, across, up) {
  if (pattern === "wall") return { along, across: 1, up };
  if (pattern === "floor") return { along, across, up: 1 };
  return { along, across, up };
}

export function assemblyCount(pattern, along, across, up) {
  const s = shape(pattern, along, across, up);
  if (pattern !== "bridge") return s.along * s.across * s.up;
  const pillars = s.along > 1 ? 2 : 1;
  return s.along * s.across + pillars * s.across * (s.up - 1);
}

/* Too wide for the island along x or z? */
function tooWide(s, part, rotation, half) {
  const size = blockSize(part, rotation);
  const along = turn(rotation) % 180 ? size.d : size.w;
  const across = turn(rotation) % 180 ? size.w : size.d;
  return s.along * along > half * 2 || s.across * across > half * 2;
}

/* The blocks of an assembly. Sizes clamp to ≥ 1, the island and ASSEMBLY_MAX;
   `clamped` says whether anything was cut. */
export function buildAssembly({ pattern = "wall", part, along, across, up, rotation = 0, half = ISLAND_HALF }) {
  const kind = ASSEMBLY_PATTERNS.includes(pattern) ? pattern : "wall";
  const asked = shape(kind, whole(along), whole(across), whole(up));
  const s = { ...asked };
  const size = blockSize(part, rotation);
  const alongStep = turn(rotation) % 180 ? size.d : size.w;
  const acrossStep = turn(rotation) % 180 ? size.w : size.d;
  s.along = Math.min(s.along, Math.max(1, Math.floor(half * 2 / alongStep)));
  s.across = Math.min(s.across, Math.max(1, Math.floor(half * 2 / acrossStep)));
  /* Over the cap: the biggest size gives a block back first (ties: up, across, along). */
  while (assemblyCount(kind, s.along, s.across, s.up) > ASSEMBLY_MAX) {
    const key = ["up", "across", "along"].reduce((best, k) => (s[k] > s[best] ? k : best), "up");
    s[key] -= 1;
  }
  const blocks = [];
  const put = (a, c, layer) => {
    const [dx, dz] = turn(rotation) % 180 ? [c, a] : [a, c];
    blocks.push({ dx, dz, layer });
  };
  for (let layer = 0; layer < s.up; layer += 1) {
    for (let a = 0; a < s.along; a += 1) {
      /* A bridge: a deck on the top layer over a pillar at each end. */
      if (kind === "bridge" && layer < s.up - 1 && a !== 0 && a !== s.along - 1) continue;
      for (let c = 0; c < s.across; c += 1) put(a, c, layer);
    }
  }
  const studsAlong = s.along * alongStep;
  const studsAcross = s.across * acrossStep;
  return {
    blocks,
    count: blocks.length,
    along: s.along,
    across: s.across,
    up: s.up,
    studs: turn(rotation) % 180 ? { w: studsAcross, d: studsAlong } : { w: studsAlong, d: studsAcross },
    layers: s.up,
    clamped: s.along !== asked.along || s.across !== asked.across || s.up !== asked.up,
  };
}

/* The stepper rule: the new settings, or the same object when the change
   would leave 1…cap, the island, or isn't a size this pattern has. */
export function stepSize(settings, key, delta, part, half = ISLAND_HALF) {
  const keys = ASSEMBLY_KEYS[settings.pattern] || [];
  if (!keys.includes(key)) return settings;
  const next = { ...settings, [key]: whole(settings[key]) + delta };
  if (next[key] < 1) return settings;
  const s = shape(next.pattern, whole(next.along), whole(next.across), whole(next.up));
  if (assemblyCount(next.pattern, s.along, s.across, s.up) > ASSEMBLY_MAX) return settings;
  if (tooWide(s, part, next.rotation || 0, half)) return settings;
  return next;
}

/* One `add` op per block. `anchor` = { x, z } the anchor corner and y the
   centre height of a bottom-layer block (the caller's landing()). */
export function placeAssembly(blocks, anchor, part, rotation, colorId, idFor) {
  const { w, d } = blockSize(part, rotation);
  const pieceRotation = blockRotation(part, rotation);
  const round = (value) => Math.round(value * 1000) / 1000;
  return blocks.map((block, index) => ({
    type: "add",
    piece: {
      id: idFor(index),
      partId: part.id,
      colorId,
      x: round(anchor.x + block.dx * w + w / 2),
      y: round(anchor.y + block.layer * part.height),
      z: round(anchor.z + block.dz * d + d / 2),
      rotation: pieceRotation,
    },
  }));
}

/* The kid's last settings per pattern (A4), from saved prefs: unknown keys
   dropped, sizes whole numbers 1…ASSEMBLY_MAX, defaults for the rest. */
export function cleanAssemblyPrefs(raw) {
  const saved = raw && typeof raw === "object" ? raw : {};
  const size = (value, fallback) => (Number.isInteger(value) && value >= 1 && value <= ASSEMBLY_MAX ? value : fallback);
  const out = {
    pattern: ASSEMBLY_PATTERNS.includes(saved.pattern) ? saved.pattern : "wall",
    rotation: [0, 90, 180, 270].includes(saved.rotation) ? saved.rotation : 0,
  };
  ASSEMBLY_PATTERNS.forEach((pattern) => {
    const given = saved[pattern] && typeof saved[pattern] === "object" ? saved[pattern] : {};
    const fallback = ASSEMBLY_DEFAULTS[pattern];
    out[pattern] = { along: size(given.along, fallback.along), across: size(given.across, fallback.across), up: size(given.up, fallback.up) };
  });
  return out;
}
