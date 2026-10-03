import type { ProviderAdapter, ProviderCallResult } from "../../../../packages/agent/src/providers/ProviderAdapter.js";
import type { AgentTaskKind, ModelProfile, SummerAgentProxyRequest } from "../../../../packages/agent/src/types.js";
import { buildSummerInput, systemPromptForTask } from "../prompt.js";
import { parseJsonText } from "./json.js";

export interface AnthropicProviderOptions { apiKey: string; fetch?: typeof fetch; endpoint?: string; }

export class AnthropicProvider implements ProviderAdapter {
  readonly provider = "anthropic" as const;
  private readonly fetcher: typeof fetch;
  private readonly endpoint: string;
  constructor(private readonly options: AnthropicProviderOptions) {
    this.fetcher = options.fetch ?? fetch;
    this.endpoint = options.endpoint ?? "https://api.anthropic.com/v1/messages";
  }
  async call(request: SummerAgentProxyRequest, profile: ModelProfile): Promise<ProviderCallResult> {
    const task: AgentTaskKind = request.task ?? "child_phrase";
    const body: Record<string, unknown> = {
      model: profile.model,
      max_tokens: 700,
      system: `${systemPromptForTask(task)}\nReturn one valid JSON object and no markdown.`,
      messages: [{ role: "user", content: buildSummerInput(request.stage, request.context, task) }],
    };
    if (profile.model.includes("sonnet-5")) {
      body.thinking = { type: "adaptive" };
      body.output_config = { effort: profile.reasoning };
    }
    const res = await this.fetcher(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.options.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
    const raw = await res.json() as Record<string, unknown>;
    const content = Array.isArray(raw.content) ? raw.content : [];
    const text = content.map((part) => part && typeof part === "object" ? (part as Record<string, unknown>).text : "").find((value) => typeof value === "string" && value.length) as string | undefined;
    if (!text) throw new Error("Anthropic response has no text");
    const usage = raw.usage && typeof raw.usage === "object" ? raw.usage as Record<string, unknown> : {};
    const inputTokens = numberOrUndefined(usage.input_tokens);
    const outputTokens = numberOrUndefined(usage.output_tokens);
    return {
      response: parseJsonText(text),
      ...(inputTokens !== undefined ? { inputTokens } : {}),
      ...(outputTokens !== undefined ? { outputTokens } : {}),
    };
  }
}
function numberOrUndefined(value: unknown): number | undefined { return Number.isFinite(Number(value)) ? Number(value) : undefined; }
