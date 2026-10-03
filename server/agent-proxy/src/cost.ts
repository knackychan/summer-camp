import type { ModelProfile } from "../../../packages/agent/src/types.js";

export function estimateCostUsd(profile: ModelProfile, inputTokens?: number, outputTokens?: number): number | undefined {
  if (!profile.pricing || !Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) return undefined;
  const input = Number(inputTokens) / 1_000_000 * profile.pricing.inputPerMillion;
  const output = Number(outputTokens) / 1_000_000 * profile.pricing.outputPerMillion;
  return Math.round((input + output) * 100_000_000) / 100_000_000;
}
