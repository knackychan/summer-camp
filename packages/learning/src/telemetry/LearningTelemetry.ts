import type { StorageDriver } from "../../../storage/src/StorageDriver.js";
import { serialStorageTask } from "../../../storage/src/SerialStorageTasks.js";
import type {
  LearningAdaptationSignal,
  LearningAttemptMistake,
  LearningDomain,
  TutorInterventionKind,
  VocabularyTutorInterventionKind,
} from "../types.js";

import type { KnowledgeHelpResult } from "../knowledge/KnowledgeHelpContract.js";

export type LearningTelemetryEventType = "tutor_help" | "attempt" | "intervention" | "hint" | "adaptation" | "support_outcome";
export type LearningTelemetryHintSource = "remote" | "local_fallback";
export type LearningSupportOutcome =
  | "retry_recovered"
  | "retry_failed"
  | "scaffold_success"
  | "assisted_completion"
  | "support_skipped";

export type LearningInterventionKind = TutorInterventionKind | VocabularyTutorInterventionKind;

export interface LearningTelemetryBaseEvent {
  version: 1;
  id: string;
  type: LearningTelemetryEventType;
  at: number;
  learnerId: string;
  domain: LearningDomain;
  skill: string;
  sessionId: string;
  questionId?: string;
}

export interface LearningAttemptTelemetryEvent extends LearningTelemetryBaseEvent {
  type: "attempt";
  correct: boolean;
  responseMs: number;
  hintsUsed: number;
  difficulty: number;
  mistake?: LearningAttemptMistake;
}

export interface LearningInterventionTelemetryEvent extends LearningTelemetryBaseEvent {
  type: "intervention";
  intervention: LearningInterventionKind;
  reason: string;
  mistake?: LearningAttemptMistake;
  experimentId?: string;
  experimentVariant?: string;
}

export interface LearningHintTelemetryEvent extends LearningTelemetryBaseEvent {
  type: "hint";
  source: LearningTelemetryHintSource;
  strategy: string;
  remoteFallback: boolean;
  provider?: string;
  model?: string;
  profileId?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
}

export interface LearningAdaptationTelemetryEvent extends LearningTelemetryBaseEvent {
  type: "adaptation";
  signal: LearningAdaptationSignal;
  level: number;
  attemptCount: number;
}

export interface LearningSupportOutcomeTelemetryEvent extends LearningTelemetryBaseEvent {
  type: "support_outcome";
  outcome: LearningSupportOutcome;
  intervention?: LearningInterventionKind;
}

export interface LearningTutorHelpTelemetryEvent extends LearningTelemetryBaseEvent, KnowledgeHelpResult {
  type: "tutor_help";
  task: "knowledge_help";
  lessonId: string;
  outcome: "applied" | "discarded";
}

export type LearningTelemetryEvent =
  | LearningTutorHelpTelemetryEvent
  | LearningAttemptTelemetryEvent
  | LearningInterventionTelemetryEvent
  | LearningHintTelemetryEvent
  | LearningAdaptationTelemetryEvent
  | LearningSupportOutcomeTelemetryEvent;

export interface LearningTelemetryMirror {
  post(event: LearningTelemetryEvent): Promise<void>;
}

export interface LearningTelemetrySummary {
  learnerId: string;
  domain: LearningDomain;
  skill: string;
  attempts: number;
  correctAttempts: number;
  independentAttempts: number;
  independentCorrectAttempts: number;
  independentCorrectRate: number | null;
  firstAttemptAt: number | null;
  lastAttemptAt: number | null;
  lastIndependentAttemptAt: number | null;
  consecutiveIndependentCorrect: number;
  recentIndependentCorrectRate: number | null;
  previousIndependentCorrectRate: number | null;
  independenceTrend: "improving" | "stable" | "declining" | "insufficient";
  averageResponseMs: number | null;
  interventionCount: number;
  remoteHintCount: number;
  localHintCount: number;
  aiHintRate: number | null;
  remoteFallbackCount: number;
  retryRecoveries: number;
  retryAttempts: number;
  retryRecoveryRate: number | null;
  assistedCompletions: number;
  topMistake: LearningAttemptMistake | null;
  latestAdaptation: LearningAdaptationSignal | null;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export const LEARNING_TELEMETRY_STORAGE_KEY = "sq:learning:telemetry:v1";
export const DEFAULT_LOCAL_TELEMETRY_LIMIT = 1_200;

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function finiteInt(value: unknown, fallback = 0, min = 0, max = 1_000_000): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function finiteNumber(value: unknown, fallback = 0, min = 0, max = 1_000_000): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function domainOf(value: unknown): LearningDomain | null {
  return value === "math" || value === "language" || value === "logic" || value === "science" || value === "geography" || value === "history" ? value : null;
}

function typeOf(value: unknown): LearningTelemetryEventType | null {
  return value === "tutor_help" || value === "attempt" || value === "intervention" || value === "hint" || value === "adaptation" || value === "support_outcome" ? value : null;
}

function mistakeOf(value: unknown): LearningAttemptMistake | undefined {
  if (
    value === "near_miss" ||
    value === "counting_slip" ||
    value === "operation_confusion" ||
    value === "single_letter_slip" ||
    value === "repeated_letter_confusion" ||
    value === "recall_stall" ||
    value === "unknown"
  ) return value;
  return undefined;
}

function interventionOf(value: unknown): LearningInterventionKind | undefined {
  if (
    value === "continue" ||
    value === "tiny_hint" ||
    value === "visual_explanation" ||
    value === "easier_follow_up" ||
    value === "tiny_clue" ||
    value === "picture_audio" ||
    value === "reveal_letter" ||
    value === "easier_recall"
  ) return value;
  return undefined;
}

function adaptationOf(value: unknown): LearningAdaptationSignal | null {
  return value === "level_up" || value === "maintain" || value === "support" || value === "level_down" ? value : null;
}

function outcomeOf(value: unknown): LearningSupportOutcome | null {
  return value === "retry_recovered" || value === "retry_failed" || value === "scaffold_success" || value === "assisted_completion" || value === "support_skipped" ? value : null;
}

export function createTelemetryId(now = Date.now()): string {
  const random = Math.random().toString(36).slice(2, 9);
  return `lt-${now.toString(36)}-${random}`;
}

/**
 * Field-by-field normalizer used both by the browser and the family-PC LAN
 * collector. Unknown fields are intentionally discarded.
 */
export function normalizeLearningTelemetryEvent(value: unknown): LearningTelemetryEvent | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const type = typeOf(raw.type);
  const domain = domainOf(raw.domain);
  const learnerId = clean(raw.learnerId, 80);
  const skill = clean(raw.skill, 80);
  const sessionId = clean(raw.sessionId, 140);
  const id = clean(raw.id, 140);
  const at = finiteInt(raw.at, 0, 1, Number.MAX_SAFE_INTEGER);
  if (!type || !domain || !learnerId || !skill || !sessionId || !id || !at) return null;
  const questionId = clean(raw.questionId, 180);
  const base: LearningTelemetryBaseEvent = {
    version: 1,
    id,
    type,
    at,
    learnerId,
    domain,
    skill,
    sessionId,
    ...(questionId ? { questionId } : {}),
  };

  if (type === "tutor_help") {
    if (raw.task !== "knowledge_help" || (raw.outcome !== "applied" && raw.outcome !== "discarded")
      || (raw.source !== "local" && raw.source !== "remote")) return null;
    const lessonId = clean(raw.lessonId, 120), cueId = clean(raw.cueId, 110);
    if (!lessonId || !cueId) return null;
    const reasons = ["not_requested", "disabled", "timeout", "provider_error", "invalid_response", "cancelled", "interrupted", "stale_context", "local_choice"];
    if (raw.fallbackReason !== null && !reasons.includes(String(raw.fallbackReason))) return null;
    const metric = (key: string, max: number): number | null => typeof raw[key] === "number" && Number.isFinite(raw[key]) && raw[key] >= 0
      ? Math.min(raw[key], max) : null;
    return { ...base, type, task: "knowledge_help", lessonId, cueId, outcome: raw.outcome, source: raw.source,
      fallbackReason: raw.fallbackReason as KnowledgeHelpResult["fallbackReason"],
      latencyMs: metric("latencyMs", 3_600_000), provider: clean(raw.provider, 80) || null,
      model: clean(raw.model, 120) || null, profileId: clean(raw.profileId, 120) || null,
      inputTokens: metric("inputTokens", 10_000_000), outputTokens: metric("outputTokens", 10_000_000), estimatedCostUsd: metric("estimatedCostUsd", 100_000) };
  }
  if (type === "attempt") {
    const mistake = mistakeOf(raw.mistake);
    return {
      ...base,
      type,
      correct: raw.correct === true,
      responseMs: finiteInt(raw.responseMs, 0, 0, 3_600_000),
      hintsUsed: finiteInt(raw.hintsUsed, 0, 0, 50),
      difficulty: finiteInt(raw.difficulty, 1, 1, 10),
      ...(mistake ? { mistake } : {}),
    };
  }
  if (type === "intervention") {
    const intervention = interventionOf(raw.intervention);
    if (!intervention) return null;
    const reason = clean(raw.reason, 80) || "unspecified";
    const mistake = mistakeOf(raw.mistake);
    const experimentId = clean(raw.experimentId, 120);
    const experimentVariant = clean(raw.experimentVariant, 80);
    return {
      ...base,
      type,
      intervention,
      reason,
      ...(mistake ? { mistake } : {}),
      ...(experimentId ? { experimentId } : {}),
      ...(experimentVariant ? { experimentVariant } : {}),
    };
  }
  if (type === "hint") {
    const source: LearningTelemetryHintSource = raw.source === "remote" ? "remote" : raw.source === "local_fallback" ? "local_fallback" : "local_fallback";
    const strategy = clean(raw.strategy, 80) || "unknown";
    const provider = clean(raw.provider, 80);
    const model = clean(raw.model, 120);
    const profileId = clean(raw.profileId, 120);
    return {
      ...base,
      type,
      source,
      strategy,
      remoteFallback: raw.remoteFallback === true,
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
      ...(profileId ? { profileId } : {}),
      ...(raw.inputTokens != null ? { inputTokens: finiteInt(raw.inputTokens, 0, 0, 10_000_000) } : {}),
      ...(raw.outputTokens != null ? { outputTokens: finiteInt(raw.outputTokens, 0, 0, 10_000_000) } : {}),
      ...(raw.estimatedCostUsd != null ? { estimatedCostUsd: finiteNumber(raw.estimatedCostUsd, 0, 0, 100_000) } : {}),
    };
  }
  if (type === "adaptation") {
    const signal = adaptationOf(raw.signal);
    if (!signal) return null;
    return {
      ...base,
      type,
      signal,
      level: finiteInt(raw.level, 1, 1, 10),
      attemptCount: finiteInt(raw.attemptCount, 0, 0, 100_000),
    };
  }
  const outcome = outcomeOf(raw.outcome);
  if (!outcome) return null;
  const intervention = interventionOf(raw.intervention);
  return {
    ...base,
    type: "support_outcome",
    outcome,
    ...(intervention ? { intervention } : {}),
  };
}

/** Operational Explore diagnostics have a separate bounded allowance. They must
 * not push locally graded attempts out of the existing learning evidence window. */
export function retainLearningTelemetryEvents(events: LearningTelemetryEvent[], learningLimit: number, helpLimit = 100): LearningTelemetryEvent[] {
  const out: LearningTelemetryEvent[] = [];
  let learningCount = 0, helpCount = 0;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]!;
    if (event.type === "tutor_help") {
      if (helpCount >= Math.max(1, helpLimit)) continue;
      helpCount += 1;
    } else {
      if (learningCount >= Math.max(1, learningLimit)) continue;
      learningCount += 1;
    }
    out.push(event);
  }
  return out.reverse();
}

export class LearningTelemetryStore {
  constructor(
    private readonly storage: StorageDriver,
    private readonly limit = DEFAULT_LOCAL_TELEMETRY_LIMIT,
    private readonly key = LEARNING_TELEMETRY_STORAGE_KEY,
  ) {}

  async list(): Promise<LearningTelemetryEvent[]> {
    const value = await this.storage.get<unknown[]>(this.key);
    if (!Array.isArray(value)) return [];
    const out: LearningTelemetryEvent[] = [];
    const seen = new Set<string>();
    for (const item of value) {
      const normalized = normalizeLearningTelemetryEvent(item);
      if (normalized && !seen.has(normalized.id)) { seen.add(normalized.id); out.push(normalized); }
    }
    return retainLearningTelemetryEvents(out, this.limit);
  }

  async append(event: LearningTelemetryEvent): Promise<void> {
    const normalized = normalizeLearningTelemetryEvent(event);
    if (!normalized) return;
    await serialStorageTask(this.storage, this.key, async () => {
      const events = await this.list();
      if (events.some((item) => item.id === normalized.id)) return;
      events.push(normalized);
      await this.storage.set(this.key, retainLearningTelemetryEvents(events, this.limit));
    });
  }

  async clear(): Promise<void> {
    await this.storage.remove(this.key);
  }
}

export class LearningTelemetryRecorder {
  constructor(
    private readonly store: LearningTelemetryStore,
    private readonly mirror?: LearningTelemetryMirror,
  ) {}

  async record(event: LearningTelemetryEvent): Promise<void> {
    try { await this.store.append(event); } catch { /* telemetry never blocks learning */ }
    if (this.mirror) void this.mirror.post(event).catch(() => { /* best effort LAN mirror */ });
  }

  list(): Promise<LearningTelemetryEvent[]> { return this.store.list(); }
  clear(): Promise<void> { return this.store.clear(); }
}

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function trendFor(attempts: LearningAttemptTelemetryEvent[]): Pick<LearningTelemetrySummary, "recentIndependentCorrectRate" | "previousIndependentCorrectRate" | "independenceTrend"> {
  const independent = attempts.filter((event) => event.hintsUsed === 0);
  if (independent.length < 4) return { recentIndependentCorrectRate: null, previousIndependentCorrectRate: null, independenceTrend: "insufficient" };
  const split = Math.max(2, Math.floor(independent.length / 2));
  const previous = independent.slice(Math.max(0, independent.length - split * 2), independent.length - split);
  const recent = independent.slice(-split);
  const previousRate = rate(previous.filter((event) => event.correct).length, previous.length);
  const recentRate = rate(recent.filter((event) => event.correct).length, recent.length);
  if (previousRate == null || recentRate == null) return { recentIndependentCorrectRate: recentRate, previousIndependentCorrectRate: previousRate, independenceTrend: "insufficient" };
  const delta = recentRate - previousRate;
  return {
    recentIndependentCorrectRate: recentRate,
    previousIndependentCorrectRate: previousRate,
    independenceTrend: delta >= 0.12 ? "improving" : delta <= -0.12 ? "declining" : "stable",
  };
}

export function summarizeLearningTelemetry(events: LearningTelemetryEvent[]): LearningTelemetrySummary[] {
  const groups = new Map<string, LearningTelemetryEvent[]>();
  for (const event of events) {
    if (event.type === "tutor_help") continue; // operational selection, not learning evidence
    const key = `${event.learnerId}\u0000${event.domain}\u0000${event.skill}`;
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }
  const summaries: LearningTelemetrySummary[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    const first = list[0];
    if (!first) continue;
    const attempts = list.filter((event): event is LearningAttemptTelemetryEvent => event.type === "attempt");
    const hints = list.filter((event): event is LearningHintTelemetryEvent => event.type === "hint");
    const interventions = list.filter((event): event is LearningInterventionTelemetryEvent => event.type === "intervention");
    const adaptations = list.filter((event): event is LearningAdaptationTelemetryEvent => event.type === "adaptation");
    const outcomes = list.filter((event): event is LearningSupportOutcomeTelemetryEvent => event.type === "support_outcome");
    const independent = attempts.filter((event) => event.hintsUsed === 0);
    const remoteHints = hints.filter((event) => event.source === "remote");
    const localHints = hints.filter((event) => event.source === "local_fallback");
    const retryRecoveries = outcomes.filter((event) => event.outcome === "retry_recovered").length;
    const retryFailures = outcomes.filter((event) => event.outcome === "retry_failed").length;
    const mistakeCounts = new Map<LearningAttemptMistake, number>();
    for (const attempt of attempts) if (attempt.mistake && attempt.mistake !== "unknown") mistakeCounts.set(attempt.mistake, (mistakeCounts.get(attempt.mistake) ?? 0) + 1);
    let topMistake: LearningAttemptMistake | null = null;
    let topMistakeCount = 0;
    for (const [mistake, count] of mistakeCounts) if (count > topMistakeCount) { topMistake = mistake; topMistakeCount = count; }
    const trend = trendFor(attempts);
    const latestAdaptation = adaptations.length ? adaptations[adaptations.length - 1]?.signal ?? null : null;
    let consecutiveIndependentCorrect = 0;
    for (let index = independent.length - 1; index >= 0; index -= 1) {
      if (!independent[index]?.correct) break;
      consecutiveIndependentCorrect += 1;
    }
    summaries.push({
      learnerId: first.learnerId,
      domain: first.domain,
      skill: first.skill,
      attempts: attempts.length,
      correctAttempts: attempts.filter((event) => event.correct).length,
      independentAttempts: independent.length,
      independentCorrectAttempts: independent.filter((event) => event.correct).length,
      independentCorrectRate: rate(independent.filter((event) => event.correct).length, independent.length),
      firstAttemptAt: attempts[0]?.at ?? null,
      lastAttemptAt: attempts[attempts.length - 1]?.at ?? null,
      lastIndependentAttemptAt: independent[independent.length - 1]?.at ?? null,
      consecutiveIndependentCorrect,
      ...trend,
      averageResponseMs: average(attempts.map((event) => event.responseMs)),
      interventionCount: interventions.length,
      remoteHintCount: remoteHints.length,
      localHintCount: localHints.length,
      aiHintRate: rate(remoteHints.length, hints.length),
      remoteFallbackCount: localHints.filter((event) => event.remoteFallback).length,
      retryRecoveries,
      retryAttempts: retryRecoveries + retryFailures,
      retryRecoveryRate: rate(retryRecoveries, retryRecoveries + retryFailures),
      assistedCompletions: outcomes.filter((event) => event.outcome === "assisted_completion").length,
      topMistake,
      latestAdaptation,
      inputTokens: hints.reduce((sum, event) => sum + (event.inputTokens ?? 0), 0),
      outputTokens: hints.reduce((sum, event) => sum + (event.outputTokens ?? 0), 0),
      estimatedCostUsd: hints.reduce((sum, event) => sum + (event.estimatedCostUsd ?? 0), 0),
    });
  }
  return summaries.sort((a, b) => a.learnerId.localeCompare(b.learnerId) || a.domain.localeCompare(b.domain) || a.skill.localeCompare(b.skill));
}
