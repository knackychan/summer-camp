import type {
  LearningAdaptationSignal,
  LearningDomain,
  LearningSessionState,
  RecordAttemptInput,
} from "./types.js";

export interface LearningSessionOptions {
  learnerId: string;
  domain: LearningDomain;
  skill: string;
  level: number;
  now?: () => number;
  idFactory?: () => string;
}

const WINDOW = 5;

function clampLevel(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

export function adaptationForWindow(correctCount: number): LearningAdaptationSignal {
  if (correctCount >= 5) return "level_up";
  if (correctCount === 4) return "maintain";
  if (correctCount >= 2) return "support";
  return "level_down";
}

export class LearningSessionEngine {
  private state: LearningSessionState;
  private readonly now: () => number;

  constructor(options: LearningSessionOptions, existing?: LearningSessionState) {
    this.now = options.now ?? (() => Date.now());
    const now = this.now();
    this.state = existing ? cloneState(existing) : {
      id: options.idFactory?.() ?? `session-${now}`,
      learnerId: options.learnerId,
      domain: options.domain,
      skill: options.skill,
      level: clampLevel(options.level),
      attempts: [],
      startedAt: now,
      updatedAt: now,
      lastAdaptedAttemptCount: 0,
    };
  }

  snapshot(): LearningSessionState {
    return cloneState(this.state);
  }

  recordAttempt(input: RecordAttemptInput): LearningSessionState {
    if (input.attemptId && this.state.attempts.some((attempt) => attempt.attemptId === input.attemptId)) return this.snapshot();
    const answeredAt = input.answeredAt ?? this.now();
    this.state.attempts.push({
      ...(input.attemptId ? { attemptId: input.attemptId } : {}),
      questionId: input.questionId,
      correct: input.correct === true,
      responseMs: Math.max(0, Math.round(Number(input.responseMs) || 0)),
      hintsUsed: Math.max(0, Math.round(Number(input.hintsUsed) || 0)),
      difficulty: clampLevel(input.difficulty ?? this.state.level),
      answeredAt,
      ...(input.mistake ? { mistake: input.mistake } : {}),
    });
    this.state.updatedAt = answeredAt;

    const sinceAdaptation = this.state.attempts.length - this.state.lastAdaptedAttemptCount;
    if (sinceAdaptation >= WINDOW) this.applyAdaptationWindow();
    return this.snapshot();
  }

  private applyAdaptationWindow(): void {
    const window = this.state.attempts.slice(-WINDOW);
    const correctCount = window.filter((attempt) => attempt.correct).length;
    const signal = adaptationForWindow(correctCount);
    if (signal === "level_up") this.state.level = clampLevel(this.state.level + 1);
    if (signal === "level_down") this.state.level = clampLevel(this.state.level - 1);
    this.state.lastAdaptation = signal;
    this.state.lastAdaptedAttemptCount = this.state.attempts.length;
  }
}

function cloneState(state: LearningSessionState): LearningSessionState {
  return {
    ...state,
    attempts: state.attempts.map((attempt) => ({ ...attempt })),
  };
}
