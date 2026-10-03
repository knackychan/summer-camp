import type { AgentTaskResponse, KnowledgeLessonAgentResponse } from "../../../agent/src/types.js";
import type { LearnerProfile } from "../types.js";
import { getKnowledgeLesson } from "./KnowledgeLessonCatalog.js";
import { buildKnowledgeLessonRequest } from "./KnowledgeLessonRequest.js";
import { createLocalKnowledgeLessonPlan, type KnowledgeLessonPlan } from "./KnowledgeLessonRuntime.js";

export interface KnowledgeLessonAgentClient {
  request(request: ReturnType<typeof buildKnowledgeLessonRequest>): Promise<AgentTaskResponse>;
}

function remotePlan(response: KnowledgeLessonAgentResponse): KnowledgeLessonPlan {
  return {
    source: "remote",
    factIds: [...response.factIds],
    questionIds: [...response.questionIds],
    presentation: response.presentation,
    encouragement: response.encouragement,
    ...(response.provider ? { provider: response.provider } : {}),
    ...(response.usage?.model ? { model: response.usage.model } : {}),
    ...(response.usage?.profileId ? { profileId: response.usage.profileId } : {}),
    ...(response.usage?.inputTokens != null ? { inputTokens: response.usage.inputTokens } : {}),
    ...(response.usage?.outputTokens != null ? { outputTokens: response.usage.outputTokens } : {}),
    ...(response.usage?.estimatedCostUsd != null ? { estimatedCostUsd: response.usage.estimatedCostUsd } : {}),
  };
}

function validateIds(ids: string[], allowed: string[], min: number): boolean {
  if (ids.length < min || ids.length > 3 || new Set(ids).size !== ids.length) return false;
  const allowedSet = new Set(allowed);
  return ids.every((id) => allowedSet.has(id));
}

export class KnowledgeLessonService {
  constructor(private readonly client?: KnowledgeLessonAgentClient) {}

  async plan(input: { learner: LearnerProfile; lessonId: string; profileId?: string }): Promise<KnowledgeLessonPlan | null> {
    const lesson = getKnowledgeLesson(input.lessonId);
    if (!lesson) return null;
    const local = createLocalKnowledgeLessonPlan(lesson);
    if (!this.client) return local;
    try {
      const response = await this.client.request(buildKnowledgeLessonRequest(input.learner, lesson, input.profileId));
      if (response.kind !== "knowledge_lesson_plan") throw new Error("Agent returned the wrong knowledge lesson kind");
      if (!validateIds(response.factIds, lesson.facts.map((fact) => fact.id), 2)) throw new Error(`Agent returned unsupported ${lesson.domain} fact IDs`);
      if (!validateIds(response.questionIds, lesson.questions.map((question) => question.id), 2)) throw new Error(`Agent returned unsupported ${lesson.domain} question IDs`);
      return remotePlan(response);
    } catch (error) {
      return {
        ...local,
        remoteError: error instanceof Error ? error.message.slice(0, 160) : "agent_unavailable",
      };
    }
  }
}
