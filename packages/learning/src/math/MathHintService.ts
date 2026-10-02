import type { AgentTaskResponse, LessonHintAgentResponse } from "../../../agent/src/types.js";
import type { LearnerProfile, LearningMistakeKind, LearningSessionState, MathHintPresentation, MathHintStrategy, MathQuestion, TutorInterventionKind } from "../types.js";
import { buildMathHintPresentation } from "./MathHintPresentation.js";
import { createLocalMathHint } from "./MathHintFallback.js";
import { buildMathHintRequest } from "./MathHintRequest.js";

export interface LearningAgentClient {
  request(request: ReturnType<typeof buildMathHintRequest>): Promise<AgentTaskResponse>;
}

export interface MathHintResult {
  source: "remote" | "local_fallback";
  hint: LessonHintAgentResponse;
  presentation: MathHintPresentation;
  remoteError?: string;
}

export interface MathHintInput {
  learner: LearnerProfile;
  session: LearningSessionState;
  question: MathQuestion;
  childAnswer: number;
  profileId?: string;
  preferredStrategies?: MathHintStrategy[];
  mistake?: LearningMistakeKind;
  intervention?: TutorInterventionKind;
}

const MATH_STRATEGIES = new Set<MathHintStrategy>(["count_forward", "count_backward", "make_ten", "objects", "number_line", "equal_groups", "array", "skip_count", "compare_quantity", "missing_part", "retry"]);

function isMathStrategy(value: string): value is MathHintStrategy {
  return MATH_STRATEGIES.has(value as MathHintStrategy);
}

export class MathHintService {
  constructor(private readonly client?: LearningAgentClient) {}

  async getHint(input: MathHintInput): Promise<MathHintResult> {
    if (this.client) {
      try {
        const response = await this.client.request(buildMathHintRequest(
          input.learner,
          input.session,
          input.question,
          input.childAnswer,
          input.profileId,
          {
            ...(input.preferredStrategies?.length ? { preferredStrategies: input.preferredStrategies } : {}),
            ...(input.mistake ? { mistake: input.mistake } : {}),
            ...(input.intervention ? { intervention: input.intervention } : {}),
          },
        ));
        if (response.kind !== "lesson_hint") throw new Error("Agent returned the wrong response kind");
        if (!isMathStrategy(response.strategy)) throw new Error("Agent returned a non-math hint strategy");
        if (input.preferredStrategies?.length && !input.preferredStrategies.includes(response.strategy)) {
          throw new Error("Agent ignored the tutor strategy constraint");
        }
        return {
          source: "remote",
          hint: response,
          presentation: buildMathHintPresentation(input.question, response.strategy, input.learner.readingLevel),
        };
      } catch (error) {
        const hint = createLocalMathHint(input.question, input.childAnswer, input.preferredStrategies);
        return {
          source: "local_fallback",
          hint,
          presentation: buildMathHintPresentation(input.question, hint.strategy as MathHintStrategy, input.learner.readingLevel),
          remoteError: error instanceof Error ? error.message.slice(0, 160) : "agent_unavailable",
        };
      }
    }
    const hint = createLocalMathHint(input.question, input.childAnswer, input.preferredStrategies);
    return {
      source: "local_fallback",
      hint,
      presentation: buildMathHintPresentation(input.question, hint.strategy as MathHintStrategy, input.learner.readingLevel),
    };
  }
}
