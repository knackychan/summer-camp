import type { SummerAgentProxyRequest } from "../../../packages/agent/src/types.js";
import type { AgentProxyService } from "./AgentProxyService.js";

export interface AgentProxyFetchHandlerOptions {
  maxBodyBytes?: number;
}

export function createAgentProxyFetchHandler(service: AgentProxyService, options: AgentProxyFetchHandlerOptions = {}) {
  const maxBodyBytes = Math.max(4_096, Math.min(256_000, options.maxBodyBytes ?? 64_000));
  return async function handle(request: Request): Promise<Response> {
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { Allow: "POST" });
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) return json({ error: "payload_too_large" }, 413);
    let body: SummerAgentProxyRequest;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > maxBodyBytes) return json({ error: "payload_too_large" }, 413);
      body = JSON.parse(raw) as SummerAgentProxyRequest;
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    try {
      const result = await service.handle(body);
      return json(result, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "agent_error";
      return json({ error: "agent_error", message: message.slice(0, 160) }, 502);
    }
  };
}

function json(value: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}
