import { taipeiClock } from "../../../core/src/time.js";
import type { StorageDriver } from "../../../storage/src/StorageDriver.js";
import { serialStorageTask } from "../../../storage/src/SerialStorageTasks.js";
import { LearnerProfileStore } from "../LearnerProfileStore.js";
import { curriculumMathSkill, isCurriculumSkillId } from "../curriculum/SkillCatalog.js";
import { LearningSessionEngine } from "../LearningSessionEngine.js";
import { MathHintService, type LearningAgentClient, type MathHintResult } from "../math/MathHintService.js";
import { classifyMathMistake } from "../math/MathMistakeClassifier.js";
import { chooseMathTutorIntervention } from "../tutor/AdaptiveMathTutorPolicy.js";
import type { TutorExperimentHarness } from "../experiments/TutorExperimentHarness.js";
import {
  brainMathQuestionFromItem,
  canUseBrainMathHint,
  type BrainMathItemLike,
} from "../math/BrainMathQuestionAdapter.js";
import { LearningSessionStore } from "../storage/LearningSessionStore.js";
import { createTelemetryId, type LearningSupportOutcome, type LearningTelemetryRecorder } from "../telemetry/LearningTelemetry.js";
import type { LearnerProfile, LearningSessionState, MathQuestion, MathTutorIntervention } from "../types.js";

export interface BrainMathBaseInput {
  directorRunId?: string;
  attemptId?: string;
  kidId: string;
  age: number;
  language?: string;
  gameId: string;
  tier: string;
  index: number;
  item: BrainMathItemLike;
  skill?: string;
}

export interface BrainMathAttemptInput extends BrainMathBaseInput {
  childAnswer: number | string;
  responseMs: number;
  hintsUsed?: number;
}

export interface BrainMathHintInput extends BrainMathBaseInput {
  childAnswer: number | string;
  profileId?: string;
  intervention?: MathTutorIntervention;
}

export interface BrainMathInterventionInput extends BrainMathBaseInput {
  childAnswer: number | string;
}

export interface BrainMathSupportOutcomeInput extends BrainMathBaseInput {
  outcome: LearningSupportOutcome;
  intervention?: MathTutorIntervention["kind"];
}

export interface BrainMathAttemptResult {
  learner: LearnerProfile;
  session: LearningSessionState;
  question: MathQuestion;
}

interface SessionRuntime {
  id: string;
  engine: LearningSessionEngine;
}

export class BrainMathLearningBridge {
  private readonly profiles: LearnerProfileStore;
  private readonly sessions: LearningSessionStore;
  private readonly hints: MathHintService;
  private readonly runtime = new Map<string, SessionRuntime>();

  constructor(
    private readonly storage: StorageDriver,
    client?: LearningAgentClient,
    private readonly telemetry?: LearningTelemetryRecorder,
    private readonly experiments?: TutorExperimentHarness,
  ) {
    this.profiles = new LearnerProfileStore(storage);
    this.sessions = new LearningSessionStore(storage);
    this.hints = new MathHintService(client);
  }

  canSupport(input: BrainMathBaseInput): boolean {
    return canUseBrainMathHint(input);
  }

  recordAttempt(input: BrainMathAttemptInput): Promise<BrainMathAttemptResult | null> {
    return serialStorageTask(this.storage, `learning-attempt:math:${input.kidId}`, () => this.recordAttemptUnlocked(input));
  }

  private async recordAttemptUnlocked(input: BrainMathAttemptInput): Promise<BrainMathAttemptResult | null> {
    const question = brainMathQuestionFromItem(input);
    if (!question) return null;
    const childAnswer = Number(input.childAnswer);
    if (!Number.isFinite(childAnswer)) return null;

    const { learner, runtime } = await this.context(input, question);
    const before = runtime.engine.snapshot();
    const correct = childAnswer === question.answer;
    const mistake = !correct ? classifyMathMistake(question, childAnswer) : undefined;
    const duplicate = Boolean(input.attemptId && before.attempts.some((attempt) => attempt.attemptId === input.attemptId));
    const session = runtime.engine.recordAttempt({
      ...(input.attemptId ? { attemptId: input.attemptId } : {}),
      questionId: question.id,
      correct,
      responseMs: input.responseMs,
      hintsUsed: input.hintsUsed ?? 0,
      difficulty: question.difficulty,
      ...(mistake ? { mistake } : {}),
    });
    await this.sessions.save(session);

    const attempt = input.attemptId ? session.attempts.find((item) => item.attemptId === input.attemptId) : session.attempts[session.attempts.length - 1];
    if (attempt && this.telemetry) {
      await this.telemetry.record({
        version: 1,
        id: input.attemptId || createTelemetryId(attempt.answeredAt),
        type: "attempt",
        at: attempt.answeredAt,
        learnerId: input.kidId,
        domain: "math",
        skill: session.skill,
        sessionId: input.directorRunId || runtime.id,
        questionId: question.id,
        correct: attempt.correct,
        responseMs: attempt.responseMs,
        hintsUsed: attempt.hintsUsed,
        difficulty: attempt.difficulty,
        ...(attempt.mistake ? { mistake: attempt.mistake } : {}),
      });
      if (!duplicate && session.lastAdaptedAttemptCount !== before.lastAdaptedAttemptCount && session.lastAdaptation) {
        await this.telemetry.record({
          version: 1,
          id: createTelemetryId(attempt.answeredAt + 1),
          type: "adaptation",
          at: attempt.answeredAt + 1,
          learnerId: input.kidId,
          domain: "math",
          skill: session.skill,
          sessionId: runtime.id,
          questionId: question.id,
          signal: session.lastAdaptation,
          level: session.level,
          attemptCount: session.attempts.length,
        });
      }
    }

    const updatedLearner: LearnerProfile = {
      ...learner,
      levels: { ...learner.levels, math: session.level },
    };
    await this.profiles.save(updatedLearner);
    return { learner: updatedLearner, session, question };
  }

  async getHint(input: BrainMathHintInput): Promise<MathHintResult | null> {
    const question = brainMathQuestionFromItem(input);
    if (!question) return null;
    const childAnswer = Number(input.childAnswer);
    if (!Number.isFinite(childAnswer)) return null;

    const { learner, runtime } = await this.context(input, question);
    const result = await this.hints.getHint({
      learner,
      session: runtime.engine.snapshot(),
      question,
      childAnswer,
      ...(input.profileId ? { profileId: input.profileId } : {}),
      ...(input.intervention?.preferredStrategies?.length ? { preferredStrategies: input.intervention.preferredStrategies } : {}),
      ...(input.intervention ? { mistake: input.intervention.mistake, intervention: input.intervention.kind } : {}),
    });
    if (this.telemetry) {
      const usage = result.hint.usage;
      await this.telemetry.record({
        version: 1,
        id: createTelemetryId(),
        type: "hint",
        at: Date.now(),
        learnerId: input.kidId,
        domain: "math",
        skill: runtime.engine.snapshot().skill,
        sessionId: runtime.id,
        questionId: question.id,
        source: result.source,
        strategy: result.hint.strategy,
        remoteFallback: result.source === "local_fallback" && Boolean(result.remoteError),
        ...(usage?.provider ? { provider: usage.provider } : {}),
        ...(usage?.model ? { model: usage.model } : {}),
        ...(usage?.profileId ? { profileId: usage.profileId } : {}),
        ...(usage?.inputTokens != null ? { inputTokens: usage.inputTokens } : {}),
        ...(usage?.outputTokens != null ? { outputTokens: usage.outputTokens } : {}),
        ...(usage?.estimatedCostUsd != null ? { estimatedCostUsd: usage.estimatedCostUsd } : {}),
      });
    }
    return result;
  }

  async getIntervention(input: BrainMathInterventionInput): Promise<MathTutorIntervention | null> {
    const question = brainMathQuestionFromItem(input);
    if (!question) return null;
    const childAnswer = Number(input.childAnswer);
    if (!Number.isFinite(childAnswer) || childAnswer === question.answer) return null;
    const { runtime } = await this.context(input, question);
    const baseline = chooseMathTutorIntervention({
      session: runtime.engine.snapshot(),
      question,
      childAnswer,
    });
    const experimentResult = this.experiments?.applyMath({
      learnerId: input.kidId,
      question,
      baseline,
    });
    const intervention = experimentResult?.intervention ?? baseline;
    if (this.telemetry) {
      await this.telemetry.record({
        version: 1,
        id: createTelemetryId(),
        type: "intervention",
        at: Date.now(),
        learnerId: input.kidId,
        domain: "math",
        skill: runtime.engine.snapshot().skill,
        sessionId: runtime.id,
        questionId: question.id,
        intervention: intervention.kind,
        reason: intervention.reason,
        mistake: intervention.mistake,
        ...(experimentResult?.assignment ? {
          experimentId: experimentResult.assignment.experimentId,
          experimentVariant: experimentResult.assignment.variantId,
        } : {}),
      });
    }
    return intervention;
  }

  async recordSupportOutcome(input: BrainMathSupportOutcomeInput): Promise<void> {
    if (!this.telemetry) return;
    const question = brainMathQuestionFromItem(input);
    if (!question) return;
    const { runtime } = await this.context(input, question);
    await this.telemetry.record({
      version: 1,
      id: createTelemetryId(),
      type: "support_outcome",
      at: Date.now(),
      learnerId: input.kidId,
      domain: "math",
      skill: runtime.engine.snapshot().skill,
      sessionId: runtime.id,
      questionId: question.id,
      outcome: input.outcome,
      ...(input.intervention ? { intervention: input.intervention } : {}),
    });
  }

  async snapshot(input: BrainMathBaseInput): Promise<LearningSessionState | null> {
    const question = brainMathQuestionFromItem(input);
    if (!question) return null;
    const { runtime } = await this.context(input, question);
    return runtime.engine.snapshot();
  }

  private async context(input: BrainMathBaseInput, question: MathQuestion): Promise<{ learner: LearnerProfile; runtime: SessionRuntime }> {
    const skill = input.skill && isCurriculumSkillId(input.skill) ? input.skill : curriculumMathSkill(question);
    const learner = await this.profiles.load(input.kidId, {
      age: input.age,
      language: input.language?.trim() || "en-zh-TW",
      levels: { math: question.difficulty, language: 1, logic: 1, science: 1, geography: 1, history: 1 },
    });
    const day = taipeiClock().day;
    const id = `brain-math:${input.kidId}:${skill}:${day}`;
    let runtime = this.runtime.get(id);
    if (!runtime) {
      const existing = await this.sessions.load(id);
      runtime = {
        id,
        engine: new LearningSessionEngine({
          learnerId: input.kidId,
          domain: "math",
          skill,
          level: learner.levels.math,
          idFactory: () => id,
        }, existing || undefined),
      };
      this.runtime.set(id, runtime);
    }
    return { learner, runtime };
  }
}
