/* Brick Lab rail joins and circuits (docs/plans/2026-10-03-brick-lab/,
   slice 10). Pure data, no Three: connectors in world space, the snap that
   pulls a rail onto a nearby free end, the overlap test that keeps rails from
   clipping, and the trace that finds closed loops. A rail instance is
   { id, part, x, z, rotation } with `part` from the catalog. */

/* A rail lands this close (studs) to a matching free end and snaps onto it. */
export const SNAP_RADIUS = 1.5;

const sinDeg = (deg) => [0, 1, 0, -1][((deg / 90) % 4 + 4) % 4];
const cosDeg = (deg) => sinDeg(deg + 90);

/* Turn a local (x, z) by a quarter-turn rotation the way Three turns a piece
   about +y: x' = x·cos + z·sin, z' = −x·sin + z·cos. */
export function rotateXZ(x, z, rotation) {
  const s = sinDeg(rotation);
  const c = cosDeg(rotation);
  return { x: x * c + z * s, z: -x * s + z * c };
}

const norm = (deg) => ((deg % 360) + 360) % 360;
const opposite = (a, b) => norm(a - b) === 180;
/* Connectors sit on whole units; rounding absorbs float noise from saves. */
const keyOf = (x, z) => `${Math.round(x * 100)},${Math.round(z * 100)}`;

export function isRail(part) {
  return !!(part && part.shape === "rail" && Array.isArray(part.connectors));
}

export function worldConnectors(part, x, z, rotation) {
  if (!isRail(part)) return [];
  return part.connectors.map((c, index) => {
    const p = rotateXZ(c.x, c.z, rotation);
    return { x: x + p.x, z: z + p.z, dir: norm(c.dir + rotation), index };
  });
}

function bounds(part, x, z, rotation) {
  const quarter = (norm(rotation) / 90) % 2;
  const w = quarter ? part.depth : part.width;
  const d = quarter ? part.width : part.depth;
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
}

/* Two rails clip when their footprints overlap; sharing an edge (a join) is fine. */
export function railClash(part, x, z, rotation, rails, ignoreId = null, pad = 0.04) {
  const a = bounds(part, x, z, rotation);
  return rails.some((rail) => {
    if (rail.id === ignoreId) return false;
    const b = bounds(rail.part, rail.x, rail.z, rail.rotation);
    return a.minX < b.maxX - pad && a.maxX > b.minX + pad && a.minZ < b.maxZ - pad && a.maxZ > b.minZ + pad;
  });
}

/* Every link between rails and every connector left free. O(n): connectors
   are bucketed by position, so each end only meets the ends at its own spot. */
export function railLinks(rails) {
  const buckets = new Map();
  rails.forEach((rail) => {
    worldConnectors(rail.part, rail.x, rail.z, rail.rotation).forEach((c) => {
      const key = keyOf(c.x, c.z);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push({ id: rail.id, ...c });
    });
  });
  const edges = [];
  const linked = new Map(rails.map((rail) => [rail.id, new Set()]));
  const free = [];
  buckets.forEach((ends) => {
    const used = new Set();
    for (let i = 0; i < ends.length; i += 1) {
      if (used.has(i)) continue;
      const j = ends.findIndex((other, k) => k > i && !used.has(k) && other.id !== ends[i].id && opposite(other.dir, ends[i].dir));
      if (j < 0) continue;
      used.add(i);
      used.add(j);
      edges.push([ends[i].id, ends[j].id]);
      linked.get(ends[i].id).add(ends[i].index);
      linked.get(ends[j].id).add(ends[j].index);
    }
    ends.forEach((end, i) => { if (!used.has(i)) free.push(end); });
  });
  return { edges, linked, free };
}

/* Rails on a closed loop: the graph's 2-core. Peel away every rail with one
   link or none until nothing changes; what is left lies on a loop (or between
   two loops). O(rails + links). */
export function traceCircuits(rails) {
  const { edges, linked, free } = railLinks(rails);
  const adjacent = new Map(rails.map((rail) => [rail.id, []]));
  edges.forEach(([a, b]) => { adjacent.get(a).push(b); adjacent.get(b).push(a); });
  const degree = new Map(rails.map((rail) => [rail.id, adjacent.get(rail.id).length]));
  const gone = new Set();
  const queue = rails.filter((rail) => degree.get(rail.id) < 2).map((rail) => rail.id);
  while (queue.length) {
    const id = queue.pop();
    if (gone.has(id)) continue;
    gone.add(id);
    adjacent.get(id).forEach((next) => {
      if (gone.has(next)) return;
      degree.set(next, degree.get(next) - 1);
      if (degree.get(next) < 2) queue.push(next);
    });
  }
  const circuit = new Set(rails.map((rail) => rail.id).filter((id) => !gone.has(id)));
  return { edges, linked, free, circuit };
}

/* Where a rail dropped at grid point (x, z) should go: onto the nearest free
   end that faces one of its own ends, within SNAP_RADIUS. Orientation must
   already match (turn the rail to make a join); null when nothing is near. */
export function snapRail(part, x, z, rotation, freeEnds, ignoreId = null, radius = SNAP_RADIUS) {
  let best = null;
  worldConnectors(part, 0, 0, rotation).forEach((own) => {
    freeEnds.forEach((end) => {
      if (end.id === ignoreId || !opposite(end.dir, own.dir)) return;
      const cx = end.x - own.x;
      const cz = end.z - own.z;
      const distance = Math.hypot(cx - x, cz - z);
      if (distance <= radius && (!best || distance < best.distance)) {
        best = { x: cx, z: cz, distance, end, own };
      }
    });
  });
  return best;
}

/* Spots that continue a rail from its free ends with a copy of `part`,
   trying the copy's own turn first, then the other three. */
export function extendSpots(part, original, freeEnds) {
  const out = [];
  [0, 90, 180, 270].map((turn) => norm(original.rotation + turn)).forEach((rotation) => {
    freeEnds.filter((end) => end.id === original.id).forEach((end) => {
      worldConnectors(part, 0, 0, rotation).forEach((own) => {
        if (opposite(end.dir, own.dir)) out.push({ x: end.x - own.x, z: end.z - own.z, rotation });
      });
    });
  });
  return out;
}
