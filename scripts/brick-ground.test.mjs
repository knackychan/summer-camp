import test from "node:test";
import assert from "node:assert/strict";
import {
  CELLS, GRID, PLAIN, PLAIN_COLOR, TERRAINS, applyCells, applyUndo, brushCells, cellAt, cleanGround, strokeMerge, terrainOf,
} from "../js/brick-lab/brick-ground.js";
import { BrickWorlds } from "../js/brick-lab/brick-worlds.js";
import { buildPayload } from "../js/brick-lab/brick-storage.js";

const HAN = /[㐀-鿿]/;
const cell = (ix, iz) => iz * GRID + ix;

test("terrains: 9 entries, unique single letters, '.' is plain, bilingual", () => {
  assert.equal(TERRAINS.length, 9);
  assert.equal(new Set(TERRAINS.map((t) => t.letter)).size, 9);
  TERRAINS.forEach((t) => {
    assert.match(t.letter, /^[\x21-\x7e]$/);
    assert.ok(t.en && HAN.test(t.zh), t.id + " needs en + 中文");
    assert.ok(Number.isInteger(t.color));
  });
  assert.equal(TERRAINS.find((t) => t.letter === ".").id, "plain");
  assert.equal(terrainOf("?").id, "plain");
  assert.notEqual(terrainOf("g").color, PLAIN_COLOR);
});

test("PLAIN and cleanGround", () => {
  assert.equal(PLAIN.length, CELLS);
  assert.equal(PLAIN, ".".repeat(4096));
  for (const bad of [undefined, null, 42, "x", "a".repeat(4095), {}]) assert.equal(cleanGround(bad), PLAIN);
  assert.equal(cleanGround("a".repeat(4096)), PLAIN);
  assert.equal(cleanGround("gZ" + "w".repeat(4094)), "g." + "w".repeat(4094));
});

test("cellAt maps world studs to an index", () => {
  assert.equal(cellAt(-32, -32), 0);
  assert.equal(cellAt(31.9, 31.9), CELLS - 1);
  assert.equal(cellAt(-0.5, 0.5), cell(31, 32));
  assert.equal(cellAt(32, 0), -1);
  assert.equal(cellAt(0, -32.1), -1);
});

test("brushCells: S, M, L shapes and counts", () => {
  assert.deepEqual(brushCells(10, 20, "S"), [cell(10, 20)]);
  const m = brushCells(32, 32, "M");
  assert.equal(m.length, 13);
  assert.ok(m.includes(cell(32, 30)) && m.includes(cell(34, 32)) && !m.includes(cell(34, 34)) && !m.includes(cell(34, 33)));
  const l = brushCells(32, 32, "L");
  assert.equal(l.length, 81);
  assert.ok(l.includes(cell(32, 27)) && l.includes(cell(37, 32)) && !l.includes(cell(36, 36)));
});

test("brushCells: clipped at corners and edges, sorted, unique", () => {
  const spots = [[0, 0], [63, 0], [0, 63], [63, 63], [0, 32], [63, 32], [32, 0], [32, 63]];
  for (const [x, z] of spots) {
    for (const size of ["S", "M", "L"]) {
      const out = brushCells(x, z, size);
      assert.ok(out.length > 0 && out.every((i) => i >= 0 && i < CELLS));
      assert.deepEqual(out, [...new Set(out)].sort((a, b) => a - b));
    }
  }
  assert.equal(brushCells(0, 0, "S").length, 1);
  assert.equal(brushCells(0, 0, "M").length, 6);
  assert.equal(brushCells(0, 0, "L").length, 26);
  assert.deepEqual(brushCells(-1, 3, "S"), []);
});

test("applyCells + undo round-trip; only changed cells recorded", () => {
  const idx = brushCells(10, 10, "M");
  const a = applyCells(PLAIN, idx, "w");
  assert.equal(a.undo.idx.length, 13);
  assert.equal(a.ground.split("w").length - 1, 13);
  assert.deepEqual(a.undo.was, Array(13).fill("."));
  assert.equal(applyUndo(a.ground, a.undo), PLAIN);
  const again = applyCells(a.ground, idx, "w");
  assert.equal(again.undo.idx.length, 0);
  assert.equal(again.ground, a.ground);
  const over = applyCells(a.ground, brushCells(10, 10, "S"), "d");
  assert.deepEqual(over.undo, { idx: [cell(10, 10)], was: ["w"] });
  assert.equal(applyUndo(over.ground, over.undo), a.ground);
});

test("strokeMerge keeps the first was of each cell", () => {
  const a = applyCells(PLAIN, [5, 6], "g");
  const b = applyCells(a.ground, [6, 7], "w");
  const merged = strokeMerge(a.undo, b.undo);
  assert.deepEqual(merged, { idx: [5, 6, 7], was: [".", ".", "."] });
  assert.equal(applyUndo(b.ground, merged), PLAIN);
});

test("storage: plain saves no field, painted ground round-trips, legacy loads plain", () => {
  assert.equal(buildPayload({ ground: PLAIN }).ground, undefined);
  assert.equal(buildPayload({}).ground, undefined);
  const painted = applyCells(PLAIN, [0, 1, 4095], "l").ground;
  assert.equal(buildPayload({ ground: painted }).ground, painted);
  const data = new Map();
  const store = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) };
  const worlds = new BrickWorlds("kid", store);
  const world = worlds.create("W", { pieces: [], ground: painted });
  assert.equal(cleanGround(worlds.load(world.id).ground), painted);
  worlds.save(world.id, { pieces: [], ground: PLAIN });
  assert.equal(cleanGround(worlds.load(world.id).ground), PLAIN);
  const old = worlds.create("Old", { pieces: [] });
  assert.equal(worlds.load(old.id).ground, undefined);
  assert.equal(cleanGround(worlds.load(old.id).ground), PLAIN);
});
