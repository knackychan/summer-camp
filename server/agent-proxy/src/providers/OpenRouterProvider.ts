import type { ProviderAdapter, ProviderCallResult } from "../../../../packages/agent/src/providers/ProviderAdapter.js";
import { responseJsonSchemaForTask } from "../../../../packages/agent/src/ResponseValidation.js";
import type { AgentTaskKind, ModelProfile, SummerAgentProxyRequest } from "../../../../packages/agent/src/types.js";
import { buildSummerInput, responseSchemaNameForTask, systemPromptForTask } from "../prompt.js";
import { parseJsonText } from "./json.js";

export interface OpenRouterProviderOptions { apiKey: string; fetch?: typeof fetch; endpoint?: string; appName?: string; siteUrl?: string; }

export class OpenRouterProvider implements ProviderAdapter {
  readonly provider = "openrouter" as const;
  private readonly fetcher: typeof fetch;
  private readonly endpoint: string;
  constructor(private readonly options: OpenRouterProviderOptions) {
    this.fetcher = options.fetch ?? fetch;
    this.endpoint = options.endpoint ?? "https://openrouter.ai/api/v1/chat/completions";
  }
  async call(request: SummerAgentProxyRequest, profile: ModelProfile): Promise<ProviderCallResult> {
    const task: AgentTaskKind = request.task ?? "child_phrase";
    const headers: Record<string, string> = { "content-type": "application/json", authorization: `Bearer ${this.options.apiKey}` };
    if (this.options.appName) headers["X-Title"] = this.options.appName;
    if (this.options.siteUrl) headers["HTTP-Referer"] = this.options.siteUrl;
    const res = await this.fetcher(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: profile.model,
        reasoning: { effort: profile.reasoning },
        messages: [
          { role: "system", content: systemPromptForTask(task) },
          { role: "user", content: buildSummerInput(request.stage, request.context, task) },
        ],
        max_tokens: 700,
        response_format: { type: "json_schema", json_schema: { name: responseSchemaNameForTask(task), strict: true, schema: responseJsonSchemaForTask(task) } },
        usage: { include: true },
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
    const raw = await res.json() as Record<string, unknown>;
    const choices = Array.isArray(raw.choices) ? raw.choices : [];
    const first = choices[0] && typeof choices[0] === "object" ? choices[0] as Record<string, unknown> : {};
    const message = first.message && typeof first.message === "object" ? first.message as Record<string, unknown> : {};
    if (typeof message.content !== "string") throw new Error("OpenRouter response has no text");
    const usage = raw.usage && typeof raw.usage === "object" ? raw.usage as Record<string, unknown> : {};
    const inputTokens = numberOrUndefined(usage.prompt_tokens ?? usage.input_tokens);
    const outputTokens = numberOrUndefined(usage.completion_tokens ?? usage.output_tokens);
    return {
      response: parseJsonText(message.content),
      ...(inputTokens !== undefined ? { inputTokens } : {}),
      ...(outputTokens !== undefined ? { outputTokens } : {}),
    };
  }
}
function numberOrUndefined(value: unknown): number | undefined { return Number.isFinite(Number(value)) ? Number(value) : undefined; }
