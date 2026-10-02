import type { AgentRoutingDecision, AgentTaskKind, ManualRoutingConfig, ModelProfile } from "../types.js";
import { DEFAULT_MODEL_PROFILE_ID, getModelProfile } from "./ModelCatalog.js";

export class ManualModelRouter {
  constructor(private readonly fallbackProfileId = DEFAULT_MODEL_PROFILE_ID) {}

  resolve(task: AgentTaskKind, config?: Partial<ManualRoutingConfig>): AgentRoutingDecision {
    const requestedId = typeof config?.profileId === "string" && config.profileId.trim()
      ? config.profileId.trim()
      : this.fallbackProfileId;
    const requested = getModelProfile(requestedId);
    const fallback = getModelProfile(this.fallbackProfileId);
    const profile = requested ?? fallback;
    if (!profile) throw new Error(`No valid model profile is configured (${requestedId})`);
    if (!profile.productionAllowed && config?.allowDevelopmentProfiles !== true) {
      throw new Error(`Model profile ${profile.id} is development-only`);
    }
    return { profile: cloneProfile(profile), task, reason: "manual_profile" };
  }
}

function cloneProfile(profile: ModelProfile): ModelProfile {
  return {
    ...profile,
    ...(profile.pricing ? { pricing: { ...profile.pricing } } : {}),
  };
}
