import test from "node:test";
import assert from "node:assert/strict";
import { BrickWorlds, FIRST_WORLD_NAME, worldName } from "../js/brick-lab/brick-worlds.js";

/* localStorage stand-in. */
function memory(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
  };
}

const piece = (id) => ({ id, partId: "brick_2x4", colorId: "red", x: 0.5, y: 0.6, z: 0, rotation: 0 });
const legacyBuild = (pieces, grid = 2) => JSON.stringify({
  format: "summer-quest-brick-build", version: 1, savedAt: "2026-10-01T00:00:00.000Z",
  name: "My Brick World", mode: "build", grid, pieces, assemblies: [],
});

test("first visit: the old single build becomes world 1, the old key is kept", () => {
  const old = legacyBuild([piece("a"), piece("b")], 1);
  const store = memory({ "sq:brick-lab:v1:maya": old });
  const worlds = new BrickWorlds("maya", store);
  const list = worlds.ensure(() => [piece("starter")]);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, FIRST_WORLD_NAME);
  assert.equal(list[0].count, 2);
  const build = worlds.load(list[0].id);
  assert.deepEqual(build.pieces.map((p) => p.id), ["a", "b"]);
  assert.equal(build.grid, 1, "the old grid travels with it, so the lab re-settles it");
  assert.equal(store.getItem("sq:brick-lab:v1:maya"), old);
  assert.equal(worlds.ensure().length, 1, "ensure runs the migration once");
});

test("first visit with no old build: the starter fills world 1", () => {
  const worlds = new BrickWorlds("leo", memory());
  const list = worlds.ensure(() => [piece("s1"), piece("s2"), piece("s3")]);
  assert.equal(list.length, 1);
  assert.equal(worlds.load(list[0].id).pieces.length, 3);
});

test("an empty old build gets the starter, like a fresh save did", () => {
  const worlds = new BrickWorlds("leo", memory({ "sq:brick-lab:v1:leo": legacyBuild([]) }));
  assert.equal(worlds.load(worlds.ensure(() => [piece("s")])[0].id).pieces.length, 1);
});

test("create, save, rename, remove", () => {
  const store = memory();
  const worlds = new BrickWorlds("maya", store);
  worlds.ensure(() => []);
  assert.equal(worlds.nextName(), worldName(2));
  const castle = worlds.create(worlds.nextName());
  assert.equal(castle.name, "World 2 · 世界 2");
  assert.equal(worlds.load(castle.id).pieces.length, 0, "a new world is empty");
  worlds.save(castle.id, { pieces: [piece("x")], grid: 2 }, "data:image/jpeg;base64,AAAA");
  const saved = worlds.meta(castle.id);
  assert.equal(saved.count, 1);
  assert.equal(saved.thumb, "data:image/jpeg;base64,AAAA");
  assert.equal(worlds.list()[0].id, castle.id, "most recently played first");
  assert.equal(worlds.rename(castle.id, "  Castle   城堡 ").name, "Castle 城堡");
  assert.equal(worlds.rename(castle.id, "   ").name, "Castle 城堡", "a blank name keeps the old one");
  assert.ok(worlds.remove(castle.id));
  assert.equal(worlds.list().length, 1);
  assert.equal(store.getItem(worlds.worldKey(castle.id)), null);
  assert.equal(worlds.load(castle.id), null);
  assert.equal(worlds.remove("nope"), false);
});

test("a thumb that isn't an image is ignored", () => {
  const worlds = new BrickWorlds("maya", memory());
  const [w] = worlds.ensure(() => []);
  worlds.save(w.id, { pieces: [] }, "javascript:alert(1)");
  assert.equal(worlds.meta(w.id).thumb, "");
});

test("a broken index entry or a broken world doesn't break the list", () => {
  const store = memory();
  const worlds = new BrickWorlds("maya", store);
  const [w] = worlds.ensure(() => [piece("a")]);
  const index = JSON.parse(store.getItem(worlds.indexKey));
  index.push(null, { name: "no id" }, 42);
  store.setItem(worlds.indexKey, JSON.stringify(index));
  assert.equal(worlds.list().length, 1);
  store.setItem(worlds.worldKey(w.id), "{not json");
  assert.deepEqual(worlds.load(w.id).pieces, [], "a world that can't be read opens empty");
  store.setItem(worlds.indexKey, "{not json");
  assert.equal(worlds.ensure(() => []).length, 1, "an unreadable index starts again");
});

test("each kid has their own worlds", () => {
  const store = memory();
  const maya = new BrickWorlds("maya", store);
  const leo = new BrickWorlds("leo", store);
  maya.ensure(() => []);
  maya.create("Castle");
  leo.ensure(() => []);
  assert.equal(maya.list().length, 2);
  assert.equal(leo.list().length, 1);
});

test("storage that throws (private mode) doesn't throw", () => {
  const broken = { getItem() { throw new Error("no"); }, setItem() { throw new Error("no"); }, removeItem() { throw new Error("no"); } };
  const worlds = new BrickWorlds("maya", broken);
  assert.deepEqual(worlds.ensure(() => []), []);
  assert.equal(worlds.create("x"), null);
});
