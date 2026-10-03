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
      pieces: Array.isArray(state.pieces) ? state.pieces : [],
      assemblies: Array.isArray(state.assemblies) ? state.assemblies : [],
    };
    try { localStorage.setItem(this.key, JSON.stringify(payload)); } catch { return null; }
    return payload;
  }

  clear() {
    try { localStorage.removeItem(this.key); } catch {}
  }
}
