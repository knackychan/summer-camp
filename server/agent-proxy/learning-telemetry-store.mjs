import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { normalizeLearningTelemetryEvent, retainLearningTelemetryEvents } from "../../dist/mobile/packages/learning/src/telemetry/LearningTelemetry.js";

export class LearningTelemetryFileStore {
  constructor(options = {}) {
    this.path = resolve(options.path || "server/agent-proxy/data/learning-telemetry.json");
    this.limit = Math.max(100, Math.min(50_000, Number(options.limit) || 5_000));
  }

  list() {
    if (!existsSync(this.path)) return [];
    try {
      const parsed = JSON.parse(readFileSync(this.path, "utf8"));
      if (!Array.isArray(parsed)) return [];
      const out = [];
      for (const item of parsed) {
        const normalized = normalizeLearningTelemetryEvent(item);
        if (normalized) out.push(normalized);
      }
      return retainLearningTelemetryEvents(out, this.limit);
    } catch {
      return [];
    }
  }

  append(value) {
    const normalized = normalizeLearningTelemetryEvent(value);
    if (!normalized) return null;
    const events = this.list();
    events.push(normalized);
    this.write(retainLearningTelemetryEvents(events, this.limit));
    return normalized;
  }

  clear() {
    this.write([]);
  }

  write(events) {
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(events, null, 2) + "\n", "utf8");
    renameSync(tmp, this.path);
  }
}
