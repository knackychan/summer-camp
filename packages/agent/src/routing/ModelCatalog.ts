import type { ModelProfile } from "../types.js";

/**
 * Manually curated provider/model profiles.
 * Prices are planning hints only and must never be used for billing.
 * Re-check provider pricing before changing production defaults.
 */
export const MODEL_PROFILES: readonly ModelProfile[] = [
  {
    id: "openai-luna-cheap",
    provider: "openai",
    model: "gpt-6-luna",
    reasoning: "low",
    costClass: "ultra_low",
    productionAllowed: true,
    label: "OpenAI Luna · Low",
    notes: "Default cheap profile for short child-facing interactions and simple structured decisions.",
    pricing: { currency: "USD", inputPerMillion: 0.10, outputPerMillion: 0.50, reviewedOn: "2026-09-23" },
  },
  {
    id: "anthropic-haiku-cheap",
    provider: "anthropic",
    model: "claude-haiku-4-5",
    reasoning: "low",
    costClass: "low",
    productionAllowed: true,
    label: "Claude Haiku 4.5 · Low",
    notes: "Low-cost Anthropic comparison profile; manual selection only in v0.2.7.",
    pricing: { currency: "USD", inputPerMillion: 1.00, outputPerMillion: 5.00, reviewedOn: "2026-09-23" },
  },
  {
    id: "anthropic-sonnet-standard",
    provider: "anthropic",
    model: "claude-sonnet-5",
    reasoning: "medium",
    costClass: "standard",
    productionAllowed: true,
    label: "Claude Sonnet 5 · Medium",
    notes: "Reserved for manual quality comparisons and harder tutor/planning work.",
    pricing: { currency: "USD", inputPerMillion: 2.00, outputPerMillion: 10.00, reviewedOn: "2026-09-23" },
  },
  {
    id: "openai-sol-standard",
    provider: "openai",
    model: "gpt-6-sol",
    reasoning: "medium",
    costClass: "standard",
    productionAllowed: true,
    label: "OpenAI Sol · Medium",
    notes: "Manual higher-power profile for complex lesson planning/evaluation.",
    pricing: { currency: "USD", inputPerMillion: 2.00, outputPerMillion: 10.00, reviewedOn: "2026-09-23" },
  },
  {
    id: "openrouter-free-dev",
    provider: "openrouter",
    model: "openrouter/free",
    reasoning: "low",
    costClass: "free",
    productionAllowed: false,
    label: "OpenRouter Free · Development",
    notes: "Development/prototyping only. The actual routed model can vary, so it is not the default child-production profile.",
    pricing: { currency: "USD", inputPerMillion: 0, outputPerMillion: 0, reviewedOn: "2026-09-23" },
  },
] as const;

export const DEFAULT_MODEL_PROFILE_ID = "openai-luna-cheap";

export function getModelProfile(id: string): ModelProfile | null {
  return MODEL_PROFILES.find((profile) => profile.id === id) ?? null;
}

export function listModelProfiles(options: { includeDevelopment?: boolean } = {}): ModelProfile[] {
  return MODEL_PROFILES.filter((profile) => profile.productionAllowed || options.includeDevelopment === true).map((profile) => ({ ...profile }));
}
