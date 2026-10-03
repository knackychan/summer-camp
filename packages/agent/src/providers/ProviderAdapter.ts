import type { ModelProfile, SummerAgentProxyRequest } from "../types.js";

export interface ProviderCallResult {
  response: unknown;
  inputTokens?: number;
  outputTokens?: number;
}

export interface ProviderAdapter {
  readonly provider: ModelProfile["provider"];
  call(request: SummerAgentProxyRequest, profile: ModelProfile): Promise<ProviderCallResult>;
}
