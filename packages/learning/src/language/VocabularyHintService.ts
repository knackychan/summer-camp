import type { AgentTaskResponse, LessonHintAgentResponse } from "../../../agent/src/types.js";
import type {
  LearnerProfile,
  LearningSessionState,
  VocabularyExercise,
  VocabularyHintPresentation,
  VocabularyHintStrategy,
  VocabularyMistakeKind,
  VocabularyTutorInterventionKind,
} from "../types.js";
import { createLocalVocabularyHint } from "./VocabularyHintFallback.js";
import { buildVocabularyHintPresentation } from "./VocabularyHintPresentation.js";
import { buildVocabularyHintRequest } from "./VocabularyHintRequest.js";

export interface VocabularyLearningAgentClient {
  request(request: ReturnType<typeof buildVocabularyHintRequest>): Promise<AgentTaskResponse>;
}

export interface VocabularyHintResult {
  source: "remote" | "local_fallback";
  hint: LessonHintAgentResponse;
  presentation: VocabularyHintPresentation;
  remoteError?: string;
}

export interface VocabularyHintInput {
  learner: LearnerProfile;
  session: LearningSessionState;
  exercise: VocabularyExercise;
  profileId?: string;
  preferredStrategies?: VocabularyHintStrategy[];
  mistake?: VocabularyMistakeKind;
  intervention?: VocabularyTutorInterventionKind;
}

const LANGUAGE_STRATEGIES = new Set<VocabularyHintStrategy>([
  "first_letter",
  "next_letter",
  "word_shape",
  "picture_clue",
  "repeat_prompt",
  "sound_it_out",
  "retry",
]);

function isLanguageStrategy(value: string): value is VocabularyHintStrategy {
  return LANGUAGE_STRATEGIES.has(value as VocabularyHintStrategy);
}

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function leaksTarget(response: LessonHintAgentResponse, target: string): boolean {
  const cleanTarget = normalize(target);
  if (cleanTarget.length < 2) return false;
  const combined = normalize(`${response.message} ${response.messageZh}`);
  return combined.includes(cleanTarget);
}

export class VocabularyHintService {
  constructor(private readonly client?: VocabularyLearningAgentClient) {}

  async getHint(input: VocabularyHintInput): Promise<VocabularyHintResult> {
    if (this.client) {
      try {
        const response = await this.client.request(buildVocabularyHintRequest(
          input.learner,
          input.session,
          input.exercise,
          input.profileId,
          {
            ...(input.preferredStrategies?.length ? { preferredStrategies: input.preferredStrategies } : {}),
            ...(input.mistake ? { mistake: input.mistake } : {}),
            ...(input.intervention ? { intervention: input.intervention } : {}),
          },
        ));
        if (response.kind !== "lesson_hint") throw new Error("Agent returned the wrong response kind");
        if (!isLanguageStrategy(response.strategy)) throw new Error("Agent returned a non-language hint strategy");
        if (input.preferredStrategies?.length && !input.preferredStrategies.includes(response.strategy)) {
          throw new Error("Agent ignored the tutor strategy constraint");
        }
        if (leaksTarget(response, input.exercise.target)) throw new Error("Agent hint revealed the target answer");
        return {
          source: "remote",
          hint: response,
          presentation: buildVocabularyHintPresentation(input.exercise, response.strategy, input.learner.readingLevel),
        };
      } catch (error) {
        const hint = createLocalVocabularyHint(input.exercise, input.learner.readingLevel, input.preferredStrategies);
        return {
          source: "local_fallback",
          hint,
          presentation: buildVocabularyHintPresentation(input.exercise, hint.strategy as VocabularyHintStrategy, input.learner.readingLevel),
          remoteError: error instanceof Error ? error.message.slice(0, 160) : "agent_unavailable",
        };
      }
    }
    const hint = createLocalVocabularyHint(input.exercise, input.learner.readingLevel, input.preferredStrategies);
    return {
      source: "local_fallback",
      hint,
      presentation: buildVocabularyHintPresentation(input.exercise, hint.strategy as VocabularyHintStrategy, input.learner.readingLevel),
    };
  }
}
