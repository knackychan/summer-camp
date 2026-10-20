/* Painted ground (docs/plans/2026-10-20-terrain-painter/ slice 01, D9).
   The plate is a GRID x GRID string, one letter per stud cell, '.' = plain.
   Index i = iz * GRID + ix, with ix = floor(x + GRID/2) and iz = floor(z + GRID/2)
   (x/z in world studs, the plate centred on 0). Slice 02 maps this onto a
   DataTexture row order; nothing here knows about Three or the DOM. */
export const GRID = 64; // BASE_HALF * 2 in brick-lab.js
export const CELLS = GRID * GRID;
export const PLAIN_LETTER = ".";
/* Must equal BASEPLATE_GREEN in brick-lab.js (slice 02 asserts it). */
export const PLAIN_COLOR = 0x4b9f4a;

export const TERRAINS = [
  { id: "plain", letter: ".", color: PLAIN_COLOR, en: "Eraser", zh: "橡皮擦" },
  { id: "grass", letter: "g", color: 0x7cc24a, en: "Grass", zh: "草地" },
  { id: "dirt", letter: "d", color: 0x8a5a33, en: "Dirt", zh: "泥土" },
  { id: "sand", letter: "s", color: 0xe8d28c, en: "Sand", zh: "沙子" },
  { id: "water", letter: "w", color: 0x3d8fd6, en: "Water", zh: "水" },
  { id: "snow", letter: "n", color: 0xf4f7fb, en: "Snow", zh: "雪" },
  { id: "stone", letter: "p", color: 0x9aa0a6, en: "Stone path", zh: "石板路" },
  { id: "lava", letter: "l", color: 0xe0531f, en: "Lava", zh: "岩漿" },
  { id: "flowers", letter: "f", color: 0x6cc36a, en: "Flowers", zh: "花地", dots: [0xf06292, 0xffd54f, 0xffffff] },
];

/* Brush radius in cells for the three size buttons. */
export const BRUSH = { S: 0, M: 2, L: 5 };
export const PLAIN = PLAIN_LETTER.repeat(CELLS);

const BY_LETTER = new Map(TERRAINS.map((t) => [t.letter, t]));
export const terrainOf = (letter) => BY_LETTER.get(letter) || BY_LETTER.get(PLAIN_LETTER);

/* World x/z (studs) to cell index, or -1 off the plate. */
export function cellAt(x, z) {
  const ix = Math.floor(x + GRID / 2);
  const iz = Math.floor(z + GRID / 2);
  return ix < 0 || iz < 0 || ix >= GRID || iz >= GRID ? -1 : iz * GRID + ix;
}

/* Anything stored becomes a valid 4096-letter string. Unknown letters turn
   plain; a missing, non-string or wrong-length value is a plain plate. */
export function cleanGround(raw) {
  if (typeof raw !== "string" || raw.length !== CELLS) return PLAIN;
  let out = "";
  for (let i = 0; i < CELLS; i++) out += BY_LETTER.has(raw[i]) ? raw[i] : PLAIN_LETTER;
  return out;
}

/* Cells of the brush centred on cell (ix, iz): a disc of radius r (centres
   with dx² + dz² <= r², so M = 13 cells, L = 81), clipped to the plate,
   sorted, no duplicates. */
export function brushCells(ix, iz, size) {
  const r = BRUSH[size] || 0;
  const out = [];
  if (!Number.isInteger(ix) || !Number.isInteger(iz)) return out;
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dz * dz > r * r) continue;
      const x = ix + dx;
      const z = iz + dz;
      if (x < 0 || z < 0 || x >= GRID || z >= GRID) continue;
      out.push(z * GRID + x);
    }
  }
  return out;
}

/* Paint `letter` on the cells `idx`. Returns the new string and an undo
   record holding only the cells that really changed. */
export function applyCells(ground, idx, letter) {
  const arr = cleanGround(ground).split("");
  const to = BY_LETTER.has(letter) ? letter : PLAIN_LETTER;
  const done = [];
  const was = [];
  for (const i of idx) {
    if (!Number.isInteger(i) || i < 0 || i >= CELLS || arr[i] === to) continue;
    done.push(i);
    was.push(arr[i]);
    arr[i] = to;
  }
  return { ground: arr.join(""), undo: { idx: done, was } };
}

/* Put an undo record back (its `was` letters) and return the string. */
export function applyUndo(ground, undo) {
  const arr = cleanGround(ground).split("");
  undo.idx.forEach((i, k) => { arr[i] = undo.was[k]; });
  return arr.join("");
}

/* Merge undo records a then b of one stroke: the first `was` of each cell wins,
   so the whole stroke undoes to the state before it began. */
export function strokeMerge(a, b) {
  const seen = new Map();
  for (const rec of [a, b]) rec.idx.forEach((i, k) => { if (!seen.has(i)) seen.set(i, rec.was[k]); });
  const idx = [...seen.keys()].sort((x, y) => x - y);
  return { idx, was: idx.map((i) => seen.get(i)) };
}
