import { validateAgentResponse } from "../ResponseValidation.js";
import { taskForStage } from "../routing/TaskPolicy.js";
import type { AgentTaskResponse, SummerAgentProxyRequest } from "../types.js";

export interface AgentHttpClientOptions {
  endpoint: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class AgentHttpClient {
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: AgentHttpClientOptions) {
    if (!options.endpoint.trim()) throw new Error("Agent endpoint is required");
    this.fetcher = options.fetch ?? fetch;
    this.timeoutMs = Math.max(1_000, Math.min(30_000, Math.round(options.timeoutMs ?? 7_000)));
  }

  async request(request: SummerAgentProxyRequest, options?: { signal?: AbortSignal }): Promise<AgentTaskResponse> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    options?.signal?.addEventListener("abort", abort, { once: true });
    if (options?.signal?.aborted) abort();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(this.options.endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Summer agent HTTP ${response.status}`);
      const raw: unknown = await response.json();
      try { return validateAgentResponse(request.task ?? taskForStage(request.stage), raw); }
      catch { const error = new Error("Invalid agent response"); error.name = "AgentResponseValidationError"; throw error; }
    } finally {
      clearTimeout(timer);
      options?.signal?.removeEventListener("abort", abort);
    }
  }
}
