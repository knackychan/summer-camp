import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES, PARTS, getPart, partDims } from "../js/brick-lab/brick-catalog.js";
import {
  extendSpots, railClash, railLinks, rotateXZ, snapRail, traceCircuits, worldConnectors,
} from "../js/brick-lab/brick-rails.js";

const rail = (id, partId, x, z, rotation = 0) => ({ id, part: getPart(partId), x, z, rotation });
const HAN = /[㐀-鿿]/;

test("catalog: unique ids, bilingual labels, every part in a real category", () => {
  const ids = new Set();
  PARTS.forEach((part) => {
    assert.ok(!ids.has(part.id), "duplicate part " + part.id);
    ids.add(part.id);
    assert.ok(part.label[0] && HAN.test(part.label[1]), part.id + " needs [en, 中文]");
    assert.ok(CATEGORIES.some((c) => c.id === part.category), part.id + " has unknown category " + part.category);
    assert.ok(Number.isInteger(part.width) && Number.isInteger(part.depth), part.id + " footprint must be whole studs");
  });
  CATEGORIES.forEach((c) => {
    assert.ok(c.label[0] && HAN.test(c.label[1]), c.id + " needs [en, 中文]");
    assert.ok(PARTS.some((p) => p.category === c.id), c.id + " is empty");
  });
  assert.ok(PARTS.length >= 23, "slice 09 adds 8–12 parts to the 15");
  assert.equal(partDims(getPart("brick_2x5")), "2×5");
});

test("catalog: every rail end sits on its footprint edge, facing out, on whole units", () => {
  PARTS.filter((p) => p.shape === "rail").forEach((part) => {
    assert.ok(part.width % 2 === 0 && part.depth % 2 === 0, part.id + " needs an even footprint");
    assert.ok(part.connectors.length >= 2, part.id);
    part.connectors.forEach((c) => {
      assert.ok([0, 90, 180, 270].includes(c.dir), part.id + " dir");
      assert.ok(Number.isInteger(c.x) && Number.isInteger(c.z), part.id + " end off the grid");
      const out = { 0: [0, 1], 90: [1, 0], 180: [0, -1], 270: [-1, 0] }[c.dir];
      const edge = out[0] ? c.x * out[0] === part.width / 2 : c.z * out[1] === part.depth / 2;
      assert.ok(edge, `${part.id} end (${c.x},${c.z}) faces ${c.dir} but is not on that edge`);
    });
  });
});

test("rotation turns ends the way Three turns the piece", () => {
  assert.deepEqual(rotateXZ(0, 1, 90), { x: 1, z: 0 });
  const ends = worldConnectors(getPart("rail_straight"), 10, 4, 90);
  assert.deepEqual(ends.map((e) => [e.x, e.z, e.dir]), [[13, 4, 90], [7, 4, 270]]);
});

test("a rail dropped near a free end snaps onto it, only when the ends face each other", () => {
  const rails = [rail("a", "rail_straight", 0, 0)];
  const { free } = railLinks(rails);
  const snap = snapRail(getPart("rail_straight"), 1, 6, 0, free);
  assert.deepEqual([snap.x, snap.z], [0, 6]);
  assert.equal(snapRail(getPart("rail_straight"), 0, 12, 0, free), null, "too far");
  assert.equal(snapRail(getPart("rail_straight"), 6, 0, 90, free), null, "turned the wrong way");
  const curve = snapRail(getPart("rail_curve_90"), 0, 5, 0, free);
  assert.deepEqual([curve.x, curve.z], [0, 5]);
});

test("rails can join but never overlap", () => {
  const rails = [rail("a", "rail_straight", 0, 0)];
  assert.equal(railClash(getPart("rail_straight"), 0, 6, 0, rails), false, "end to end is a join");
  assert.equal(railClash(getPart("rail_straight"), 0, 4, 0, rails), true);
  assert.equal(railClash(getPart("rail_cross"), 1, 0, 0, rails), true);
  assert.equal(railClash(getPart("rail_straight"), 0, 4, 0, rails, "a"), false, "a moving rail ignores itself");
});

test("four curves make a ring: a circuit; a straight line does not", () => {
  const line = [rail("a", "rail_straight", 0, 0), rail("b", "rail_straight", 0, 6), rail("c", "rail_straight", 0, 12)];
  const open = traceCircuits(line);
  assert.equal(open.edges.length, 2);
  assert.equal(open.circuit.size, 0);
  assert.equal(open.free.length, 2);

  /* Grow the ring the way Copy does: from each new piece's free end. */
  const ring = [rail("c0", "rail_curve_90", 0, 0)];
  for (let i = 1; i < 4; i += 1) {
    const last = ring[ring.length - 1];
    const { free } = railLinks(ring);
    const spot = extendSpots(last.part, last, free).find((s) => !railClash(last.part, s.x, s.z, s.rotation, ring));
    assert.ok(spot, "copy " + i + " finds a free end");
    ring.push(rail("c" + i, "rail_curve_90", spot.x, spot.z, spot.rotation));
  }
  const closed = traceCircuits(ring);
  assert.equal(closed.edges.length, 4);
  assert.equal(closed.circuit.size, 4);
  assert.equal(closed.free.length, 0);
});

test("an oval of two T-rails and four curves: the loop glows, a spur off it does not", () => {
  const oval = [
    rail("west", "rail_junction_t", -2, 0, 180), rail("east", "rail_junction_t", 2, 0, 0),
    rail("nw", "rail_curve_90", -2, 4, 270), rail("ne", "rail_curve_90", 2, 4, 0),
    rail("sw", "rail_curve_90", -2, -4, 180), rail("se", "rail_curve_90", 2, -4, 90),
  ];
  oval.forEach((r) => assert.equal(railClash(r.part, r.x, r.z, r.rotation, oval, r.id), false, r.id + " clips"));
  const traced = traceCircuits(oval);
  assert.equal(traced.free.length, 2, "only the two T branches are free");
  assert.equal(traced.circuit.size, 6);
  const withSpur = oval.concat(rail("spur", "rail_straight", 7, 0, 90));
  const spurred = traceCircuits(withSpur);
  assert.equal(spurred.edges.length, 7);
  assert.equal(spurred.circuit.size, 6);
  assert.ok(!spurred.circuit.has("spur"));
});

test("tracing stays linear: 2000 rails in well under a frame budget", () => {
  const many = Array.from({ length: 2000 }, (_, i) => rail("r" + i, "rail_straight", 0, i * 6));
  const start = performance.now();
  const { edges } = traceCircuits(many);
  assert.equal(edges.length, 1999);
  assert.ok(performance.now() - start < 200);
});
