/* Assemblies plan slice 02 (docs/plans/2026-10-06-brick-lab-assemblies/ A3): the
   wall / floor / tower / bridge generator is pure maths. */
import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES, getPart, PARTS } from "../js/brick-lab/brick-catalog.js";
import {
  ASSEMBLY_DEFAULTS, ASSEMBLY_KEYS, ASSEMBLY_MAX, ASSEMBLY_PATTERNS,
  assemblyCount, assemblyParts, blockRotation, buildAssembly, cleanAssemblyPrefs, placeAssembly, stepSize,
} from "../js/brick-lab/brick-assembly.js";

const brick = getPart("brick_2x4");
const plate = getPart("plate_2x2");
const tile = PARTS.find((p) => p.category === "tiles" && p.shape === "rect");
const key = (b) => `${b.dx},${b.dz},${b.layer}`;

test("only plain boxes of Bricks, Plates and Tiles tile", () => {
  assert.ok(assemblyParts(brick) && assemblyParts(plate) && assemblyParts(tile));
  assert.ok(!assemblyParts(getPart("fig_boy")));
  assert.ok(!assemblyParts(PARTS.find((p) => p.category === "plates" && p.shape !== "rect")));
  assert.ok(!assemblyParts(PARTS.find((p) => p.category === "doors")));
  assert.ok(!assemblyParts(null));
  CATEGORIES.filter((c) => ["bricks", "plates", "tiles"].includes(c.id)).forEach((c) => {
    assert.ok(PARTS.some((p) => p.category === c.id && assemblyParts(p)), `${c.id} has a part to tile`);
  });
});

test("every pattern's default fits under the cap", () => {
  assert.deepEqual(ASSEMBLY_PATTERNS, ["wall", "floor", "tower", "bridge"]);
  for (const pattern of ASSEMBLY_PATTERNS) {
    const d = ASSEMBLY_DEFAULTS[pattern];
    const built = buildAssembly({ pattern, part: brick, ...d });
    assert.ok(built.count <= ASSEMBLY_MAX && !built.clamped, pattern);
    assert.equal(built.count, assemblyCount(pattern, d.along, d.across, d.up));
    assert.equal(new Set(built.blocks.map(key)).size, built.count, `${pattern}: no block twice`);
  }
});

test("wall: along × 1 × up, the brick's long side along x", () => {
  const built = buildAssembly({ pattern: "wall", part: brick, along: 8, across: 5, up: 3 });
  assert.equal(built.count, 24, "a wall is one block thick whatever across says");
  assert.deepEqual(built.studs, { w: 32, d: 2 });
  assert.equal(built.layers, 3);
  assert.ok(built.blocks.every((b) => b.dz === 0 && b.dx < 8 && b.layer < 3));
  assert.equal(blockRotation(brick, 0), 90, "a 2×4 lies long along x");
  assert.equal(blockRotation(getPart("brick_1x2"), 90), 180, "turned: long along z");
});

test("floor: along × across, one layer; a 2×2 plate floor of 4×4 is 8×8 studs", () => {
  const built = buildAssembly({ pattern: "floor", part: plate, along: 4, across: 4, up: 9 });
  assert.equal(built.count, 16);
  assert.deepEqual(built.studs, { w: 8, d: 8 });
  assert.ok(built.blocks.every((b) => b.layer === 0));
});

test("tower: solid along × across × up", () => {
  const built = buildAssembly({ pattern: "tower", part: tile, along: 2, across: 2, up: 8 });
  assert.equal(built.count, 32);
  assert.equal(built.layers, 8);
  for (let layer = 0; layer < 8; layer++) assert.equal(built.blocks.filter((b) => b.layer === layer).length, 4);
});

test("bridge: a deck on top, resting on end pillars of up − 1 layers", () => {
  const built = buildAssembly({ pattern: "bridge", part: brick, along: 6, across: 2, up: 3 });
  const deck = built.blocks.filter((b) => b.layer === 2);
  const pillars = built.blocks.filter((b) => b.layer < 2);
  assert.equal(deck.length, 12);
  assert.equal(pillars.length, 2 * 2 * 2);
  assert.ok(pillars.every((b) => b.dx === 0 || b.dx === 5));
  assert.equal(built.count, 20);
  assert.equal(buildAssembly({ pattern: "bridge", part: brick, along: 1, across: 1, up: 3 }).count, 3, "a one-block bridge is one pillar");
  assert.equal(buildAssembly({ pattern: "bridge", part: brick, along: 6, across: 1, up: 1 }).count, 6, "no pillars: just the deck");
});

test("past the cap or the island: clamped, and it says so", () => {
  const big = buildAssembly({ pattern: "tower", part: brick, along: 10, across: 10, up: 10 });
  assert.ok(big.count <= ASSEMBLY_MAX && big.clamped);
  const wide = buildAssembly({ pattern: "wall", part: getPart("brick_1x1"), along: 70, up: 1 });
  assert.ok(wide.clamped && wide.studs.w <= 64 && wide.count <= ASSEMBLY_MAX);
  const long = buildAssembly({ pattern: "wall", part: brick, along: 20, up: 1 });
  assert.ok(long.clamped && long.studs.w <= 64, "20 bricks of 4 studs would be 80 studs");
  const odd = buildAssembly({ pattern: "floor", part: plate, along: 0, across: -3, up: "x" });
  assert.equal(odd.count, 1, "sizes are at least 1");
});

test("the stepper refuses past the cap, the island, 1, or a size the pattern lacks", () => {
  const wall = { pattern: "wall", ...ASSEMBLY_DEFAULTS.wall, rotation: 0 };
  const taller = stepSize(wall, "up", 1, brick);
  assert.equal(taller.up, 4);
  assert.notEqual(taller, wall);
  assert.equal(stepSize(wall, "across", 1, brick), wall, "a wall has no across");
  assert.deepEqual(ASSEMBLY_KEYS.wall, ["along", "up"]);
  const one = { pattern: "floor", along: 1, across: 1, up: 1, rotation: 0 };
  assert.equal(stepSize(one, "along", -1, plate), one);
  const full = { pattern: "tower", along: 4, across: 4, up: 4, rotation: 0 };
  assert.equal(stepSize(full, "up", 1, plate), full, "65 blocks: refused");
  assert.equal(stepSize(full, "up", -1, plate).up, 3);
  const edge = { pattern: "wall", along: 16, across: 1, up: 1, rotation: 0 };
  assert.equal(stepSize(edge, "along", 1, brick), edge, "17 bricks leave the island");
  assert.equal(stepSize({ ...edge, along: 15 }, "along", 1, brick).along, 16);
});

test("rotation turns the shape: along runs along z at 90", () => {
  const flat = buildAssembly({ pattern: "wall", part: brick, along: 4, up: 1, rotation: 0 });
  const turned = buildAssembly({ pattern: "wall", part: brick, along: 4, up: 1, rotation: 90 });
  assert.deepEqual(turned.studs, { w: 2, d: 16 });
  assert.deepEqual(turned.blocks.map((b) => [b.dz, b.dx]), flat.blocks.map((b) => [b.dx, b.dz]));
  assert.equal(blockRotation(brick, 90), 180);
  assert.deepEqual(buildAssembly({ pattern: "wall", part: brick, along: 4, up: 1, rotation: 180 }).blocks, flat.blocks);
});

test("placeAssembly: one add per block on the stud grid, layers a part high", () => {
  const built = buildAssembly({ pattern: "wall", part: brick, along: 3, up: 2 });
  const ops = placeAssembly(built.blocks, { x: -4, y: 0.6, z: 6 }, brick, 0, "red", (i) => `a${i}`);
  assert.equal(ops.length, 6);
  assert.ok(ops.every((op) => op.type === "add" && op.piece.partId === "brick_2x4" && op.piece.colorId === "red" && op.piece.rotation === 90));
  assert.deepEqual(ops.filter((op) => op.piece.y === 0.6).map((op) => [op.piece.x, op.piece.z]), [[-2, 7], [2, 7], [6, 7]]);
  assert.deepEqual(Array.from(new Set(ops.map((op) => op.piece.y))), [0.6, 1.8]);
  assert.deepEqual(ops.map((op) => op.piece.id), ["a0", "a1", "a2", "a3", "a4", "a5"]);

  const plates = placeAssembly(buildAssembly({ pattern: "tower", part: plate, along: 1, across: 1, up: 3 }).blocks, { x: 0, y: 0.2, z: 0 }, plate, 0, "blue", (i) => `p${i}`);
  assert.deepEqual(plates.map((op) => op.piece.y), [0.2, 0.6, 1]);
  const odd = placeAssembly([{ dx: 1, dz: 0, layer: 0 }], { x: 0, y: 0.6, z: 0 }, getPart("brick_1x3"), 90, "red", () => "o");
  assert.deepEqual([odd[0].piece.x, odd[0].piece.z], [1.5, 1.5], "an odd footprint centres on a half stud");
});

test("bridge pillars stand under the deck ends", () => {
  const built = buildAssembly({ pattern: "bridge", part: brick, along: 4, across: 1, up: 3 });
  const ops = placeAssembly(built.blocks, { x: 0, y: 0.6, z: 0 }, brick, 0, "red", (i) => `b${i}`);
  const deckY = Math.max(...ops.map((op) => op.piece.y));
  assert.equal(deckY, 3);
  const under = ops.filter((op) => op.piece.y < deckY).map((op) => op.piece.x);
  assert.deepEqual(Array.from(new Set(under)).sort((a, b) => a - b), [2, 14]);
});

test("saved settings come back clean: per pattern, defaults for anything odd", () => {
  const fresh = cleanAssemblyPrefs(undefined);
  assert.equal(fresh.pattern, "wall");
  assert.deepEqual(fresh.wall, { along: 8, across: 1, up: 3 });
  const kept = cleanAssemblyPrefs({ pattern: "tower", rotation: 90, tower: { along: 3, across: 2, up: 5 }, floor: { along: 99, across: "x" }, junk: 1 });
  assert.deepEqual([kept.pattern, kept.rotation, kept.tower], ["tower", 90, { along: 3, across: 2, up: 5 }]);
  assert.deepEqual(kept.floor, { along: 4, across: 4, up: 1 });
  assert.ok(!("junk" in kept));
  assert.equal(cleanAssemblyPrefs({ pattern: "castle", rotation: 45 }).pattern, "wall");
});
