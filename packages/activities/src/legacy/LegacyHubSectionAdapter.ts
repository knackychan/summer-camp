import type { LocalizedText } from "../../../core/src/localization.js";
import type { ActivityAdapter } from "../ActivityAdapter.js";

export interface LegacyHubSectionOptions {
  id: string;
  title: LocalizedText;
  icon: string;
  hash: string;
  ageBands?: string[];
  capabilities?: string[];
  launchUrlPrefix?: string;
}

export function createLegacyHubSectionAdapter(options: LegacyHubSectionOptions): ActivityAdapter {
  return {
    id: options.id,
    title: options.title,
    icon: options.icon,
    ageBands: options.ageBands || ["all"],
    capabilities: ["legacy_embed", ...(options.capabilities || [])],
    async launch() {
      const prefix = options.launchUrlPrefix || "../../index.html";
      return { ok: true, target: { kind: "embedded", url: `${prefix}#${options.hash}` } };
    },
  };
}
