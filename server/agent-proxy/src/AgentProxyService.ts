import type { ProviderAdapter } from "../../../packages/agent/src/providers/ProviderAdapter.js";
import { validateAgentResponse } from "../../../packages/agent/src/ResponseValidation.js";
import { DEFAULT_MODEL_PROFILE_ID } from "../../../packages/agent/src/routing/ModelCatalog.js";
import { ManualModelRouter } from "../../../packages/agent/src/routing/ManualModelRouter.js";
import { taskForStage } from "../../../packages/agent/src/routing/TaskPolicy.js";
import type { AgentTaskResponse, LlmProviderId, SummerAgentProxyRequest } from "../../../packages/agent/src/types.js";
import { estimateCostUsd } from "./cost.js";
import { canonicalKnowledgeHelpRequest } from "../../../packages/learning/src/knowledge/KnowledgeHelpContract.js";

export interface AgentProxyServiceOptions {
  adapters: ProviderAdapter[];
  defaultProfileId?: string;
  allowedProfileIds?: string[];
  allowDevelopmentProfiles?: boolean;
  allowClientProfileOverride?: boolean;
}

export class AgentProxyService {
  private readonly adapters = new Map<LlmProviderId, ProviderAdapter>();
  private readonly defaultProfileId: string;
  private readonly allowed: Set<string>;
  private readonly router: ManualModelRouter;

  constructor(private readonly options: AgentProxyServiceOptions) {
    this.defaultProfileId = options.defaultProfileId ?? DEFAULT_MODEL_PROFILE_ID;
    this.allowed = new Set(options.allowedProfileIds?.length ? options.allowedProfileIds : [this.defaultProfileId]);
    this.router = new ManualModelRouter(this.defaultProfileId);
    for (const adapter of options.adapters) this.adapters.set(adapter.provider, adapter);
  }

  async handle(raw: SummerAgentProxyRequest): Promise<AgentTaskResponse> {
    if (!raw || raw.version !== 1 || typeof raw.stage !== "string" || !raw.context || typeof raw.context !== "object") throw new Error("Invalid Summer agent request");
    if (raw.task === "knowledge_help" || raw.stage === "learning:knowledge_help") raw = canonicalKnowledgeHelpRequest(raw);
    const requested = this.options.allowClientProfileOverride === true ? raw.routing?.profileId : undefined;
    const profileId = requested && this.allowed.has(requested) ? requested : this.defaultProfileId;
    if (!this.allowed.has(profileId)) throw new Error(`Model profile ${profileId} is not allowed by the server`);
    const task = raw.task ?? taskForStage(raw.stage);
    const decision = this.router.resolve(task, { mode: "manual", profileId, allowDevelopmentProfiles: this.options.allowDevelopmentProfiles === true });
    const adapter = this.adapters.get(decision.profile.provider);
    if (!adapter) throw new Error(`No adapter configured for provider ${decision.profile.provider}`);
    const providerRequest: SummerAgentProxyRequest = raw.task === task ? raw : { ...raw, task };
    const result = await adapter.call(providerRequest, decision.profile);
    const response = validateAgentResponse(task, result.response);
    if (task === "knowledge_help") {
      const cues = providerRequest.context.cues as Array<{ id: string }>;
      if (response.kind !== "knowledge_help" || !cues.some((cue) => cue.id === response.cueId)) throw new Error("Unapproved knowledge help cue");
    }
    response.provider = `remote:${decision.profile.provider}`;
    const tokenCount = (value: unknown): number | undefined => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
    const inputTokens = tokenCount(result.inputTokens), outputTokens = tokenCount(result.outputTokens);
    const estimatedCostUsd = estimateCostUsd(decision.profile, inputTokens, outputTokens);
    response.usage = {
      provider: decision.profile.provider,
      model: decision.profile.model,
      profileId: decision.profile.id,
      ...(inputTokens !== undefined ? { inputTokens } : {}),
      ...(outputTokens !== undefined ? { outputTokens } : {}),
      ...(estimatedCostUsd !== undefined ? { estimatedCostUsd } : {}),
    };
    return response;
  }
}
