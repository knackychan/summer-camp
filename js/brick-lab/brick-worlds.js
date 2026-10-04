/* Several Brick Lab worlds per kid, saved on this tablet
   (docs/plans/2026-10-04-brick-lab-multiplayer/ D3, slice 01).

   An index of small cards — `sq:brick-lab:worlds:v1:<kid>` — and one build
   per world — `sq:brick-lab:world:v1:<kid>:<id>`, in the same
   `summer-quest-brick-build` v1 shape as the single save before it. The old
   single save (`sq:brick-lab:v1:<kid>`) becomes world 1 the first time and is
   left in place, untouched. Storage is injected so Node tests can use a Map. */
import { BUILD_FORMAT, BUILD_VERSION, buildPayload, readBuild } from "./brick-storage.js";

export const FIRST_WORLD_NAME = "My Brick World · 我的積木世界";
export const worldName = (n) => `World ${n} · 世界 ${n}`;
const NAME_MAX = 40;

function browserStore() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

function cleanName(name, fallback) {
  const text = String(name == null ? "" : name).replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
  return text || fallback;
}

function newId() {
  return `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export class BrickWorlds {
  constructor(kidId = "local", store = browserStore()) {
    this.kidId = String(kidId || "local");
    this.store = store;
    this.indexKey = `sq:brick-lab:worlds:v1:${this.kidId}`;
    this.legacyKey = `sq:brick-lab:v1:${this.kidId}`;
  }

  worldKey(id) {
    return `sq:brick-lab:world:v1:${this.kidId}:${id}`;
  }

  get(key) {
    try { return this.store ? this.store.getItem(key) : null; } catch { return null; }
  }

  set(key, value) {
    try { if (this.store) this.store.setItem(key, value); return true; } catch { return false; }
  }

  drop(key) {
    try { if (this.store) this.store.removeItem(key); } catch {}
  }

  readIndex() {
    let list = null;
    try { list = JSON.parse(this.get(this.indexKey)); } catch { list = null; }
    if (!Array.isArray(list)) return null;
    return list.filter((w) => w && typeof w.id === "string").map((w) => ({
      id: w.id,
      name: cleanName(w.name, FIRST_WORLD_NAME),
      createdAt: String(w.createdAt || ""),
      updatedAt: String(w.updatedAt || ""),
      played: Math.max(0, Number(w.played) || 0),
      count: Math.max(0, Number(w.count) || 0),
      thumb: typeof w.thumb === "string" && w.thumb.startsWith("data:image/") ? w.thumb : "",
    }));
  }

  writeIndex(list) {
    return this.set(this.indexKey, JSON.stringify(list));
  }

  /* Most recently played first (`played` counts up on every save: two
     saves in the same millisecond still keep their order). */
  list() {
    const list = this.readIndex() || [];
    return list.slice().sort((a, b) => b.played - a.played);
  }

  /* First visit on this tablet: the old single build becomes world 1, or
     `starter()` (the starter village) fills a fresh one. Returns the list. */
  ensure(starter = () => []) {
    if (this.readIndex()) return this.list();
    const legacy = readBuild(this.get(this.legacyKey));
    const pieces = legacy && legacy.pieces.length ? legacy.pieces : starter();
    const world = this.create(FIRST_WORLD_NAME, legacy && legacy.pieces.length
      ? { pieces, grid: legacy.grid, mode: legacy.mode, assemblies: legacy.assemblies }
      : { pieces });
    if (!world) this.writeIndex([]);
    return this.list();
  }

  create(name, state = {}) {
    const list = this.readIndex() || [];
    const now = new Date().toISOString();
    const world = {
      id: newId(),
      name: cleanName(name, worldName(list.length + 1)),
      createdAt: now,
      updatedAt: now,
      played: list.reduce((max, w) => Math.max(max, w.played), 0) + 1,
      count: Array.isArray(state.pieces) ? state.pieces.length : 0,
      thumb: "",
    };
    const payload = buildPayload({ ...state, name: world.name });
    if (!this.set(this.worldKey(world.id), JSON.stringify(payload))) return null;
    list.push(world);
    this.writeIndex(list);
    return world;
  }

  /* The default name for the next new world. */
  nextName() {
    return worldName((this.readIndex() || []).length + 1);
  }

  meta(id) {
    return (this.readIndex() || []).find((w) => w.id === id) || null;
  }

  load(id) {
    if (!this.meta(id)) return null;
    return readBuild(this.get(this.worldKey(id))) || { format: BUILD_FORMAT, version: BUILD_VERSION, pieces: [], assemblies: [], grid: undefined };
  }

  save(id, state, thumb) {
    const list = this.readIndex() || [];
    const world = list.find((w) => w.id === id);
    if (!world) return null;
    const payload = buildPayload({ ...state, name: world.name });
    if (!this.set(this.worldKey(id), JSON.stringify(payload))) return null;
    world.updatedAt = new Date().toISOString();
    world.played = list.reduce((max, w) => Math.max(max, w.played), 0) + 1;
    world.count = payload.pieces.length;
    if (typeof thumb === "string" && thumb.startsWith("data:image/")) world.thumb = thumb;
    this.writeIndex(list);
    return payload;
  }

  rename(id, name) {
    const list = this.readIndex() || [];
    const world = list.find((w) => w.id === id);
    if (!world) return null;
    world.name = cleanName(name, world.name);
    this.writeIndex(list);
    return world;
  }

  remove(id) {
    const list = this.readIndex() || [];
    const next = list.filter((w) => w.id !== id);
    if (next.length === list.length) return false;
    this.writeIndex(next);
    this.drop(this.worldKey(id));
    return true;
  }
}
