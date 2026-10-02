import type { ActivityAdapter } from "../ActivityAdapter.js";

export interface LegacyBrainGymAdapterOptions {
  launchUrl?: string;
}

export function createLegacyBrainGymAdapter(options: LegacyBrainGymAdapterOptions = {}): ActivityAdapter {
  const launchUrl = options.launchUrl || "../../index.html#games";
  return {
    id: "brain-gym",
    title: ["Brain Gym", "頭腦體操"],
    icon: "🧠",
    ageBands: ["early_reader", "reader"],
    capabilities: ["learning", "brain", "tutor_context", "legacy_embed"],
    async launch() {
      return { ok: true, target: { kind: "embedded", url: launchUrl } };
    },
  };
}
