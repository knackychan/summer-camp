import type { ProviderAdapter, ProviderCallResult } from "../../../../packages/agent/src/providers/ProviderAdapter.js";
import { responseJsonSchemaForTask } from "../../../../packages/agent/src/ResponseValidation.js";
import type { AgentTaskKind, ModelProfile, SummerAgentProxyRequest } from "../../../../packages/agent/src/types.js";
import { buildSummerInput, responseSchemaNameForTask, systemPromptForTask } from "../prompt.js";
import { parseJsonText } from "./json.js";

export interface OpenAIProviderOptions { apiKey: string; fetch?: typeof fetch; endpoint?: string; }

export class OpenAIProvider implements ProviderAdapter {
  readonly provider = "openai" as const;
  private readonly fetcher: typeof fetch;
  private readonly endpoint: string;
  constructor(private readonly options: OpenAIProviderOptions) {
    this.fetcher = options.fetch ?? fetch;
    this.endpoint = options.endpoint ?? "https://api.openai.com/v1/responses";
  }
  async call(request: SummerAgentProxyRequest, profile: ModelProfile): Promise<ProviderCallResult> {
    const task: AgentTaskKind = request.task ?? "child_phrase";
    const res = await this.fetcher(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.options.apiKey}` },
      body: JSON.stringify({
        model: profile.model,
        reasoning: { effort: profile.reasoning },
        instructions: systemPromptForTask(task),
        input: buildSummerInput(request.stage, request.context, task),
        max_output_tokens: 700,
        text: { format: { type: "json_schema", name: responseSchemaNameForTask(task), strict: true, schema: responseJsonSchemaForTask(task) } },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
    const raw = await res.json() as Record<string, unknown>;
    const outputText = extractOpenAIText(raw);
    const usage = raw.usage && typeof raw.usage === "object" ? raw.usage as Record<string, unknown> : {};
    const inputTokens = numberOrUndefined(usage.input_tokens);
    const outputTokens = numberOrUndefined(usage.output_tokens);
    return {
      response: parseJsonText(outputText),
      ...(inputTokens !== undefined ? { inputTokens } : {}),
      ...(outputTokens !== undefined ? { outputTokens } : {}),
    };
  }
}

function extractOpenAIText(raw: Record<string, unknown>): string {
  if (typeof raw.output_text === "string") return raw.output_text;
  if (!Array.isArray(raw.output)) throw new Error("OpenAI response has no output text");
  for (const item of raw.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (typeof p.text === "string") return p.text;
    }
  }
  throw new Error("OpenAI response has no output text");
}
function numberOrUndefined(value: unknown): number | undefined { return Number.isFinite(Number(value)) ? Number(value) : undefined; }
