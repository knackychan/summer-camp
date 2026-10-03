import { taipeiClock } from "../../../core/src/time.js";
import type { StorageDriver } from "../../../storage/src/StorageDriver.js";
import { serialStorageTask } from "../../../storage/src/SerialStorageTasks.js";
import { LearnerProfileStore } from "../LearnerProfileStore.js";
import { curriculumVocabularySkill } from "../curriculum/SkillCatalog.js";
import { LearningSessionEngine } from "../LearningSessionEngine.js";
import { VocabularyHintService, type VocabularyHintResult, type VocabularyLearningAgentClient } from "../language/VocabularyHintService.js";
import { chooseVocabularyTutorIntervention } from "../tutor/AdaptiveVocabularyTutorPolicy.js";
import { LearningSessionStore } from "../storage/LearningSessionStore.js";
import { createTelemetryId, type LearningTelemetryRecorder } from "../telemetry/LearningTelemetry.js";
import type {
  LearnerProfile,
  LearningSessionState,
  VocabularyExercise,
  VocabularyMistakeKind,
  VocabularyMode,
  VocabularyTutorIntervention,
} from "../types.js";

export interface VocabularyBaseInput {
  directorRunId?: string;
  attemptId?: string;
  kidId: string;
  age: number;
  language?: string;
  gameId: string;
  mode: VocabularyMode;
  target: string;
  emoji?: string;
  sourceFrench?: string;
  sourceChinese?: string;
  promptMode?: string;
  position?: number;
  revealed?: number;
  skill?: string;
}

export interface VocabularyAttemptInput extends VocabularyBaseInput {
  correct: boolean;
  responseMs: number;
  hintsUsed?: number;
  mistake?: VocabularyMistakeKind;
}

export interface VocabularyHintInput extends VocabularyBaseInput {
  profileId?: string;
  intervention?: VocabularyTutorIntervention;
}

export interface VocabularyInterventionInput extends VocabularyBaseInput {
  typedCharacter?: string;
  expectedCharacter?: string;
  wrongCountAtPosition?: number;
  totalWrongCount?: number;
}

interface SessionRuntime { id: string; engine: LearningSessionEngine; }

function difficultyForMode(mode: VocabularyMode): number {
  if (mode === "sentences") return 5;
  if (mode === "translate") return 3;
  if (mode === "recall" || mode === "bopomofo") return 2;
  return 1;
}

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function exerciseFromInput(input: VocabularyBaseInput): VocabularyExercise | null {
  if (input.gameId !== "vocab") return null;
  const target = clean(input.target, 96);
  if (!target) return null;
  return {
    id: `vocab:${input.mode}:${target.toLocaleLowerCase()}`,
    mode: input.mode,
    target,
    difficulty: difficultyForMode(input.mode),
    position: Math.max(0, Math.min(target.length, Math.round(Number(input.position) || 0))),
    revealed: Math.max(0, Math.min(target.length, Math.round(Number(input.revealed) || 0))),
    ...(clean(input.emoji, 8) ? { emoji: clean(input.emoji, 8) } : {}),
    ...(clean(input.sourceFrench, 100) ? { sourceFrench: clean(input.sourceFrench, 100) } : {}),
    ...(clean(input.sourceChinese, 100) ? { sourceChinese: clean(input.sourceChinese, 100) } : {}),
    ...(clean(input.promptMode, 16) ? { promptMode: clean(input.promptMode, 16) } : {}),
  };
}

export class VocabularyLearningBridge {
  private readonly profiles: LearnerProfileStore;
  private readonly sessions: LearningSessionStore;
  private readonly hints: VocabularyHintService;
  private readonly runtime = new Map<string, SessionRuntime>();
  private readonly lastIntervention = new Map<string, VocabularyTutorIntervention["kind"]>();

  constructor(
    private readonly storage: StorageDriver,
    client?: VocabularyLearningAgentClient,
    private readonly telemetry?: LearningTelemetryRecorder,
  ) {
    this.profiles = new LearnerProfileStore(storage);
    this.sessions = new LearningSessionStore(storage);
    this.hints = new VocabularyHintService(client);
  }

  canSupport(input: VocabularyBaseInput): boolean { return input.mode !== "copy" && exerciseFromInput(input) !== null; }

  recordAttempt(input: VocabularyAttemptInput): Promise<{ learner: LearnerProfile; session: LearningSessionState; exercise: VocabularyExercise } | null> {
    return serialStorageTask(this.storage, `learning-attempt:language:${input.kidId}`, () => this.recordAttemptUnlocked(input));
  }

  private async recordAttemptUnlocked(input: VocabularyAttemptInput): Promise<{ learner: LearnerProfile; session: LearningSessionState; exercise: VocabularyExercise } | null> {
    const exercise = exerciseFromInput(input);
    if (!exercise) return null;
    const { learner, runtime } = await this.context(input, exercise);
    const before = runtime.engine.snapshot();
    const duplicate = Boolean(input.attemptId && before.attempts.some((attempt) => attempt.attemptId === input.attemptId));
    const session = runtime.engine.recordAttempt({
      ...(input.attemptId ? { attemptId: input.attemptId } : {}),
      questionId: exercise.id,
      correct: input.correct === true,
      responseMs: input.responseMs,
      hintsUsed: input.hintsUsed ?? 0,
      difficulty: exercise.difficulty,
      ...(input.mistake ? { mistake: input.mistake } : {}),
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
        domain: "language",
        skill: session.skill,
        sessionId: input.directorRunId || runtime.id,
        questionId: exercise.id,
        correct: attempt.correct,
        responseMs: attempt.responseMs,
        hintsUsed: attempt.hintsUsed,
        difficulty: attempt.difficulty,
        ...(attempt.mistake ? { mistake: attempt.mistake } : {}),
      });
      if (!duplicate && attempt.hintsUsed > 0) {
        const intervention = this.lastIntervention.get(`${runtime.id}:${exercise.id}`);
        await this.telemetry.record({
          version: 1,
          id: createTelemetryId(attempt.answeredAt + 1),
          type: "support_outcome",
          at: attempt.answeredAt + 1,
          learnerId: input.kidId,
          domain: "language",
          skill: session.skill,
          sessionId: runtime.id,
          questionId: exercise.id,
          outcome: "assisted_completion",
          ...(intervention ? { intervention } : {}),
        });
      }
      if (!duplicate && exercise.mode !== "copy" && session.lastAdaptedAttemptCount !== before.lastAdaptedAttemptCount && session.lastAdaptation) {
        await this.telemetry.record({
          version: 1,
          id: createTelemetryId(attempt.answeredAt + 2),
          type: "adaptation",
          at: attempt.answeredAt + 2,
          learnerId: input.kidId,
          domain: "language",
          skill: session.skill,
          sessionId: runtime.id,
          questionId: exercise.id,
          signal: session.lastAdaptation,
          level: session.level,
          attemptCount: session.attempts.length,
        });
      }
    }

    this.lastIntervention.delete(`${runtime.id}:${exercise.id}`);

    // Copy practice is deliberately AI-free and non-adaptive: keep the attempt
    // for session history, but do not let opening the easiest mode reset or
    // rewrite the learner's language level.
    if (exercise.mode === "copy") return { learner, session, exercise };

    const updatedLearner: LearnerProfile = { ...learner, levels: { ...learner.levels, language: session.level } };
    await this.profiles.save(updatedLearner);
    return { learner: updatedLearner, session, exercise };
  }

  async getHint(input: VocabularyHintInput): Promise<VocabularyHintResult | null> {
    if (input.mode === "copy") return null;
    const exercise = exerciseFromInput(input);
    if (!exercise) return null;
    const { learner, runtime } = await this.context(input, exercise);
    const result = await this.hints.getHint({
      learner,
      session: runtime.engine.snapshot(),
      exercise,
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
        domain: "language",
        skill: runtime.engine.snapshot().skill,
        sessionId: runtime.id,
        questionId: exercise.id,
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

  async getIntervention(input: VocabularyInterventionInput): Promise<VocabularyTutorIntervention | null> {
    if (input.mode === "copy") return null;
    const exercise = exerciseFromInput(input);
    if (!exercise) return null;
    const { learner, runtime } = await this.context(input, exercise);
    const intervention = chooseVocabularyTutorIntervention({
      session: runtime.engine.snapshot(),
      exercise,
      readingLevel: learner.readingLevel,
      ...(clean(input.typedCharacter, 8) ? { typedCharacter: clean(input.typedCharacter, 8) } : {}),
      ...(clean(input.expectedCharacter, 8) ? { expectedCharacter: clean(input.expectedCharacter, 8) } : {}),
      wrongCountAtPosition: Math.max(0, Math.round(Number(input.wrongCountAtPosition) || 0)),
      totalWrongCount: Math.max(0, Math.round(Number(input.totalWrongCount) || 0)),
    });
    this.lastIntervention.set(`${runtime.id}:${exercise.id}`, intervention.kind);
    if (this.telemetry) {
      await this.telemetry.record({
        version: 1,
        id: createTelemetryId(),
        type: "intervention",
        at: Date.now(),
        learnerId: input.kidId,
        domain: "language",
        skill: runtime.engine.snapshot().skill,
        sessionId: runtime.id,
        questionId: exercise.id,
        intervention: intervention.kind,
        reason: intervention.reason,
        mistake: intervention.mistake,
      });
    }
    return intervention;
  }

  async snapshot(input: VocabularyBaseInput): Promise<LearningSessionState | null> {
    const exercise = exerciseFromInput(input);
    if (!exercise) return null;
    const { runtime } = await this.context(input, exercise);
    return runtime.engine.snapshot();
  }

  private async context(input: VocabularyBaseInput, exercise: VocabularyExercise): Promise<{ learner: LearnerProfile; runtime: SessionRuntime }> {
    const skill = curriculumVocabularySkill(exercise, input.skill);
    const learner = await this.profiles.load(input.kidId, {
      age: input.age,
      language: clean(input.language, 12) || "en-zh-TW",
      levels: { math: 1, language: exercise.difficulty, logic: 1, science: 1, geography: 1, history: 1 },
    });
    const day = taipeiClock().day;
    const id = `vocab:${input.kidId}:${skill}:${day}`;
    let runtime = this.runtime.get(id);
    if (!runtime) {
      const existing = await this.sessions.load(id);
      runtime = {
        id,
        engine: new LearningSessionEngine({
          learnerId: input.kidId,
          domain: "language",
          skill,
          level: learner.levels.language,
          idFactory: () => id,
        }, existing || undefined),
      };
      this.runtime.set(id, runtime);
    }
    return { learner, runtime };
  }
}
