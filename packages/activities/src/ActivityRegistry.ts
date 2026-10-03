import type { ActivityAdapter, ActivityLaunchResult } from "./ActivityAdapter.js";

export class ActivityRegistry {
  private readonly adapters = new Map<string, ActivityAdapter>();

  register(adapter: ActivityAdapter): void {
    if (!adapter.id.trim()) throw new Error("Activity adapter id is required");
    if (this.adapters.has(adapter.id)) throw new Error(`Activity already registered: ${adapter.id}`);
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): ActivityAdapter | null {
    return this.adapters.get(id) || null;
  }

  list(): ActivityAdapter[] {
    return Array.from(this.adapters.values());
  }

  listForAgeBand(ageBand: string): ActivityAdapter[] {
    return this.list().filter((adapter) => adapter.ageBands.includes("all") || adapter.ageBands.includes(ageBand));
  }

  async launch(id: string, kidId: string): Promise<ActivityLaunchResult> {
    const adapter = this.get(id);
    if (!adapter) return { ok: false, reason: "activity_not_found" };
    return adapter.launch({ kidId });
  }
}
