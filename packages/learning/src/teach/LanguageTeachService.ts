import type { AgentTaskResponse, LessonExplanationAgentResponse } from "../../../agent/src/types.js";
import type { CurriculumSkillId } from "../curriculum/SkillCatalog.js";
import type { LearnerProfile } from "../types.js";
import { buildLanguageTeachRequest } from "./LanguageTeachRequest.js";
import { createLocalLanguageTeachScene, type LanguageTeachScene } from "./LanguageTeachScene.js";

export interface LanguageTeachAgentClient {
  request(request: ReturnType<typeof buildLanguageTeachRequest>): Promise<AgentTaskResponse>;
}

export interface LanguageTeachResult {
  source: "remote" | "local_fallback";
  scene: LanguageTeachScene;
  explanation: LessonExplanationAgentResponse;
  remoteError?: string;
}

function localExplanation(scene: LanguageTeachScene): LessonExplanationAgentResponse {
  return {
    kind: "lesson_explanation",
    message: scene.message,
    messageZh: scene.messageZh,
    strategy: scene.strategy,
    emotion: "encouraging",
  };
}

export class LanguageTeachService {
  constructor(private readonly client?: LanguageTeachAgentClient) {}

  async getScene(input: { learner: LearnerProfile; skill: CurriculumSkillId; profileId?: string }): Promise<LanguageTeachResult | null> {
    const scene = createLocalLanguageTeachScene(input.skill, input.learner.readingLevel);
    if (!scene) return null;
    if (!this.client) return { source: "local_fallback", scene, explanation: localExplanation(scene) };
    try {
      const response = await this.client.request(buildLanguageTeachRequest(input.learner, scene, input.profileId));
      if (response.kind !== "lesson_explanation") throw new Error("Agent returned the wrong explanation kind");
      if (response.strategy !== scene.strategy) throw new Error("Agent changed the deterministic teaching strategy");
      return { source: "remote", scene, explanation: response };
    } catch (error) {
      return {
        source: "local_fallback",
        scene,
        explanation: localExplanation(scene),
        remoteError: error instanceof Error ? error.message.slice(0, 160) : "agent_unavailable",
      };
    }
  }
}
