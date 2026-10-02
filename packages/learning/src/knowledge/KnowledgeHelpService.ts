import { validateKnowledgeHelpResponse } from "../../../agent/src/ResponseValidation.js";
import type { AgentTaskResponse, SummerAgentProxyRequest } from "../../../agent/src/types.js";
import type { ReadingLevel } from "../../../core/src/interaction-profile.js";
import { getKnowledgeLesson } from "./KnowledgeLessonCatalog.js";
import { canonicalKnowledgeHelpRequest, knowledgeCheckHelpCues, knowledgeHelpAgeBand, knowledgeHelpCues, type KnowledgeHelpResult } from "./KnowledgeHelpContract.js";

export interface KnowledgeHelpAgentClient {
  request(request: SummerAgentProxyRequest, options?: { signal?: AbortSignal }): Promise<AgentTaskResponse>;
}
export class KnowledgeHelpService {
  constructor(private readonly client?: KnowledgeHelpAgentClient, private readonly timeoutMs = 6_000) {}
  async select(input: { lessonId: string; age: number; readingLevel: ReadingLevel; focusId: string | null;
    mode: "explore" | "check"; phase: "intro" | "question"; questionId?: string | null;
    local: KnowledgeHelpResult; profileId?: string; signal?: AbortSignal }): Promise<KnowledgeHelpResult> {
    if (!this.client) return { ...input.local, fallbackReason: "disabled", latencyMs: 0 };
    const lesson = getKnowledgeLesson(input.lessonId);
    if (!lesson) return { ...input.local, fallbackReason: "invalid_response", latencyMs: 0 };
    const question = input.mode === "check" ? lesson.questions.find((item) => item.id === input.questionId) : null;
    if (input.mode === "check" && !question) return { ...input.local, fallbackReason: "invalid_response", latencyMs: 0 };
    const started = Date.now(), controller = new AbortController();
    let timedOut = false, timer: ReturnType<typeof setTimeout> | undefined;
    const abort = () => controller.abort();
    input.signal?.addEventListener("abort", abort, { once: true });
    if (input.signal?.aborted) abort();
    try {
      if (controller.signal.aborted) throw new Error("cancelled");
      const request = canonicalKnowledgeHelpRequest({ version: 1, task: "knowledge_help", stage: "learning:knowledge_help",
        context: { lessonId: lesson.id, domain: lesson.domain, mode: input.mode, phase: input.phase,
          ...(question ? { questionId: question.id } : {}), readingLevel: input.readingLevel,
          ageBand: knowledgeHelpAgeBand(input.age), focusId: input.focusId },
        ...(input.profileId ? { routing: { mode: "manual", profileId: input.profileId } } : {}) });
      const cancelled = new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
        timer = setTimeout(() => { timedOut = true; controller.abort(); }, Math.max(1, this.timeoutMs));
      });
      const raw = await Promise.race([this.client.request(request, { signal: controller.signal }), cancelled]);
      let response: ReturnType<typeof validateKnowledgeHelpResponse>;
      try {
        response = validateKnowledgeHelpResponse(raw);
        const allowed = question ? knowledgeCheckHelpCues(question) : knowledgeHelpCues(lesson);
        if (!allowed.some((cue) => cue.id === response.cueId)) throw new Error("Unknown cue");
      } catch { return { ...input.local, fallbackReason: "invalid_response", latencyMs: Math.max(0, Date.now() - started) }; }
      const usage = response.usage;
      return { cueId: response.cueId, source: "remote", fallbackReason: null, latencyMs: Math.max(0, Date.now() - started),
        provider: response.provider ?? null, model: usage?.model ?? null, profileId: usage?.profileId ?? null,
        inputTokens: usage?.inputTokens ?? null, outputTokens: usage?.outputTokens ?? null, estimatedCostUsd: usage?.estimatedCostUsd ?? null };
    } catch (error) {
      return { ...input.local, fallbackReason: timedOut ? "timeout" : controller.signal.aborted ? "cancelled" : error instanceof Error && error.name === "AgentResponseValidationError" ? "invalid_response" : "provider_error",
        latencyMs: Math.max(0, Date.now() - started) };
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      input.signal?.removeEventListener("abort", abort);
    }
  }
}
