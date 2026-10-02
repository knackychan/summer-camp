import type { AgentTaskResponse, LessonExplanationAgentResponse } from "../../../agent/src/types.js";
import type { CurriculumSkillId } from "../curriculum/SkillCatalog.js";
import type { LearnerProfile } from "../types.js";
import { createLocalMathTeachScene, type MathTeachScene } from "./MathTeachScene.js";
import { buildMathTeachRequest } from "./MathTeachRequest.js";

export interface MathTeachAgentClient {
  request(request: ReturnType<typeof buildMathTeachRequest>): Promise<AgentTaskResponse>;
}

export interface MathTeachResult {
  source: "remote" | "local_fallback";
  scene: MathTeachScene;
  explanation: LessonExplanationAgentResponse;
  remoteError?: string;
}

function localExplanation(scene: MathTeachScene): LessonExplanationAgentResponse {
  return {
    kind: "lesson_explanation",
    message: scene.message,
    messageZh: scene.messageZh,
    strategy: scene.strategy,
    emotion: "encouraging",
  };
}

export class MathTeachService {
  constructor(private readonly client?: MathTeachAgentClient) {}

  async getScene(input: { learner: LearnerProfile; skill: CurriculumSkillId; profileId?: string }): Promise<MathTeachResult | null> {
    const scene = createLocalMathTeachScene(input.skill, input.learner.readingLevel);
    if (!scene) return null;
    if (!this.client) return { source: "local_fallback", scene, explanation: localExplanation(scene) };
    try {
      const response = await this.client.request(buildMathTeachRequest(input.learner, scene, input.profileId));
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
