import type { LearningTelemetryEvent, LearningTelemetryMirror } from "./LearningTelemetry.js";

export interface LearningTelemetryHttpClientOptions {
  endpoint: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class LearningTelemetryHttpClient implements LearningTelemetryMirror {
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: LearningTelemetryHttpClientOptions) {
    if (!options.endpoint.trim()) throw new Error("Learning telemetry endpoint is required");
    this.fetcher = options.fetch ?? fetch;
    this.timeoutMs = Math.max(500, Math.min(10_000, Math.round(options.timeoutMs ?? 2_000)));
  }

  async post(event: LearningTelemetryEvent): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(this.options.endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(event),
        signal: controller.signal,
        keepalive: true,
      });
      if (!response.ok) throw new Error(`Learning telemetry HTTP ${response.status}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
