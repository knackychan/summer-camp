/* Per-kid local save. Builds stay on this tablet and never sync (design.md D6;
   amended by the multiplayer plan's D8: a shared world is saved on the host's
   tablet only). Since the multiplayer plan's slice 01 a kid's builds live in
   brick-worlds.js; this file keeps the build shape and the tray prefs. */
export const BUILD_FORMAT = "summer-quest-brick-build";
export const BUILD_VERSION = 1;
const FORMAT = BUILD_FORMAT;
const VERSION = BUILD_VERSION;

function safeParse(raw) {
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

/* A stored build string → the build, or null when it isn't one. */
export function readBuild(raw) {
  const saved = safeParse(raw);
  if (!saved || saved.format !== FORMAT || saved.version !== VERSION || !Array.isArray(saved.pieces)) return null;
  return saved;
}

export function buildPayload(state) {
  return {
    format: FORMAT,
    version: VERSION,
    savedAt: new Date().toISOString(),
    name: state.name || "My Brick World",
    mode: state.mode || "build",
    grid: state.grid || 1,
    pieces: Array.isArray(state.pieces) ? state.pieces : [],
    assemblies: Array.isArray(state.assemblies) ? state.assemblies : [],
  };
}

export class BrickLabStorage {
  constructor(kidId = "local") {
    this.kidId = String(kidId || "local");
    this.key = `sq:brick-lab:v1:${this.kidId}`;
    this.prefsKey = `sq:brick-lab:prefs:v1:${this.kidId}`;
  }

  load() {
    let raw = null;
    try { raw = localStorage.getItem(this.key); } catch { return null; }
    return readBuild(raw);
  }

  save(state) {
    const payload = buildPayload(state);
    try { localStorage.setItem(this.key, JSON.stringify(payload)); } catch { return null; }
    return payload;
  }

  clear() {
    try { localStorage.removeItem(this.key); } catch {}
  }

  /* Tray favourites and recent parts (slice 11): part ids only, per kid,
     beside the build so a cleared build keeps them. */
  loadPrefs() {
    let raw = null;
    try { raw = localStorage.getItem(this.prefsKey); } catch { raw = null; }
    const saved = safeParse(raw) || {};
    const ids = (list) => (Array.isArray(list) ? list.filter((id) => typeof id === "string") : []);
    /* walkView: behind or eyes, the last view this kid walked with (walk plan slice 04). */
    return { favorites: ids(saved.favorites), recents: ids(saved.recents), walkView: saved.walkView === "eyes" ? "eyes" : "behind" };
  }

  savePrefs(prefs) {
    const payload = { favorites: prefs.favorites.slice(), recents: prefs.recents.slice(), walkView: prefs.walkView === "eyes" ? "eyes" : "behind" };
    try { localStorage.setItem(this.prefsKey, JSON.stringify(payload)); } catch { return null; }
    return payload;
  }
}
