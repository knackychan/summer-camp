/* Per-kid local save. Builds stay on this tablet and never sync (design.md D6). */
const FORMAT = "summer-quest-brick-build";
const VERSION = 1;

function safeParse(raw) {
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
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
    const saved = safeParse(raw);
    if (!saved || saved.format !== FORMAT || saved.version !== VERSION || !Array.isArray(saved.pieces)) return null;
    return saved;
  }

  save(state) {
    const payload = {
      format: FORMAT,
      version: VERSION,
      savedAt: new Date().toISOString(),
      name: state.name || "My Brick World",
      mode: state.mode || "build",
      grid: state.grid || 1,
      pieces: Array.isArray(state.pieces) ? state.pieces : [],
      assemblies: Array.isArray(state.assemblies) ? state.assemblies : [],
    };
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
    return { favorites: ids(saved.favorites), recents: ids(saved.recents) };
  }

  savePrefs(prefs) {
    const payload = { favorites: prefs.favorites.slice(), recents: prefs.recents.slice() };
    try { localStorage.setItem(this.prefsKey, JSON.stringify(payload)); } catch { return null; }
    return payload;
  }
}
