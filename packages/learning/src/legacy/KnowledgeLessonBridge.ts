import type { StorageDriver } from "../../../storage/src/StorageDriver.js";
import { serialStorageTask } from "../../../storage/src/SerialStorageTasks.js";
import { LearnerProfileStore } from "../LearnerProfileStore.js";
import type { LearningTelemetryRecorder } from "../telemetry/LearningTelemetry.js";
import { getKnowledgeLesson, listKnowledgeLessons, type KnowledgeLessonDomain } from "../knowledge/KnowledgeLessonCatalog.js";
import {
  advanceKnowledgeLesson, answerKnowledgeQuestion, applyKnowledgeLessonPlan,
  createKnowledgeLessonSession, knowledgeLessonSnapshot, markKnowledgeAdaptationAttempted,
  type KnowledgeLessonMode, type KnowledgeLessonSession, type KnowledgeLessonSnapshot,
} from "../knowledge/KnowledgeLessonRuntime.js";
import { KnowledgeLessonStore } from "../knowledge/KnowledgeLessonStore.js";
import { KnowledgeLessonService, type KnowledgeLessonAgentClient } from "../knowledge/KnowledgeLessonService.js";

import { KnowledgeHelpBridge } from "./KnowledgeHelpBridge.js";

export interface KnowledgeLessonBridgeInput {
  kidId: string;
  age: number;
  language?: string;
  domain?: KnowledgeLessonDomain;
  lessonId?: string;
  profileId?: string;
  mode?: KnowledgeLessonMode;
  /** Backward-compatible v0.4.9 alias. */
  scienceMode?: KnowledgeLessonMode;
  flow?: "free" | "director";
  directorSessionId?: string;
  directorStepId?: string;
  directorRunId?: string;
  resume?: boolean;
  expectedSessionId?: string;
  expectedPhase?: "intro" | "question" | "complete";
  expectedQuestionId?: string;
  expectedUpdatedAt?: number;
}

export class KnowledgeLessonBridge {
  private readonly profiles: LearnerProfileStore;
  private readonly store: KnowledgeLessonStore;
  private readonly service: KnowledgeLessonService;
  private readonly help: KnowledgeHelpBridge;
  constructor(
    private readonly storage: StorageDriver,
    client?: KnowledgeLessonAgentClient,
    private readonly telemetry?: LearningTelemetryRecorder,
  ) {
    this.profiles = new LearnerProfileStore(storage);
    this.store = new KnowledgeLessonStore(storage);
    this.service = new KnowledgeLessonService(client);
    this.help = new KnowledgeHelpBridge(storage, client, telemetry);
  }
  private serial<T>(input: KnowledgeLessonBridgeInput, task: () => Promise<T>): Promise<T> {
    return serialStorageTask(this.storage, `knowledge:${input.kidId}`, task);
  }
  private domain(input: KnowledgeLessonBridgeInput): KnowledgeLessonDomain {
    return input.domain === "geography" || input.domain === "history" ? input.domain : "science";
  }
  private learner(input: KnowledgeLessonBridgeInput) {
    return this.profiles.load(input.kidId, {
      age: input.age, language: input.language?.trim() || "en-zh-TW",
      levels: { math: 1, language: 1, logic: 1, science: 1, geography: 1, history: 1 },
    });
  }
  private snapshotForDomain(session: KnowledgeLessonSession | null, domain: KnowledgeLessonDomain): KnowledgeLessonSnapshot | null {
    if (!session || session.version !== 1) return null;
    const snapshot = knowledgeLessonSnapshot(session);
    return snapshot?.lesson.domain === domain ? snapshot : null;
  }
  private matches(input: KnowledgeLessonBridgeInput, snapshot: KnowledgeLessonSnapshot): boolean {
    return (input.expectedSessionId == null || snapshot.session.id === input.expectedSessionId)
      && (input.expectedPhase == null || snapshot.session.phase === input.expectedPhase)
      && (input.expectedQuestionId == null || snapshot.currentQuestion?.id === input.expectedQuestionId)
      && (input.expectedUpdatedAt == null || snapshot.session.updatedAt === input.expectedUpdatedAt);
  }
  private async recordAnswer(snapshot: KnowledgeLessonSnapshot): Promise<void> {
    const answer = snapshot.currentAnswer;
    if (!answer || !this.telemetry) return;
    // A durable answer has a durable event identity; retrying its callback can
    // repair a failed telemetry write without counting the answer twice.
    await this.telemetry.record({
      version: 1, id: `${snapshot.session.id}:q${snapshot.session.questionIndex}`, type: "attempt",
      at: answer.answeredAt, learnerId: snapshot.session.learnerId,
      domain: snapshot.lesson.domain, skill: snapshot.lesson.skill,
      sessionId: snapshot.session.directorRunId || snapshot.session.id,
      questionId: answer.questionId, correct: answer.correct,
      responseMs: answer.responseMs, hintsUsed: 0, difficulty: snapshot.lesson.difficulty,
    });
  }
  async catalog(input: KnowledgeLessonBridgeInput) {
    return listKnowledgeLessons(this.domain(input), input.age).map((lesson) => ({
      id: lesson.id, domain: lesson.domain, topic: lesson.topic, skill: lesson.skill,
      icon: lesson.icon, title: lesson.title, titleZh: lesson.titleZh,
      subtitle: lesson.subtitle, subtitleZh: lesson.subtitleZh, minAge: lesson.minAge,
    }));
  }
  snapshot(input: KnowledgeLessonBridgeInput): Promise<KnowledgeLessonSnapshot | null> {
    return this.help.read(input);
  }
  openHelp(input: KnowledgeLessonBridgeInput & { focusId?: string }) { return this.help.open(input); }
  adaptHelp(input: KnowledgeLessonBridgeInput) { return this.help.adapt(input); }
  nextHelp(input: KnowledgeLessonBridgeInput) { return this.help.next(input); }
  cancelHelp(input: KnowledgeLessonBridgeInput) { return this.help.cancel(input); }
  start(input: KnowledgeLessonBridgeInput): Promise<KnowledgeLessonSnapshot | null> {
    return this.serial(input, async () => {
      if (!input.lessonId) return null;
      const lesson = getKnowledgeLesson(input.lessonId), domain = this.domain(input);
      if (!lesson || lesson.domain !== domain || input.age < lesson.minAge) return null;
      this.help.abortForLearner(input.kidId);
      const learner = await this.learner(input);
      const previous = await this.store.load(input.kidId);
      const mode = input.mode ?? input.scienceMode ?? "explore";
      if (input.resume && input.flow === "director" && input.directorSessionId && input.directorStepId
        && previous?.flow === "director" && previous.lessonId === lesson.id && previous.mode === mode
        && previous.directorSessionId === input.directorSessionId && previous.directorStepId === input.directorStepId) {
        const resumed = { ...previous, ...(input.directorRunId ? { directorRunId: input.directorRunId } : {}), updatedAt: Math.max(Date.now(), previous.updatedAt + 1) };
        await this.store.save(resumed);
        return knowledgeLessonSnapshot(resumed);
      }
      const session = createKnowledgeLessonSession({
        learnerId: input.kidId, lessonId: input.lessonId, readingLevel: learner.readingLevel, mode,
        now: Math.max(Date.now(), (previous?.startedAt ?? 0) + 1),
        ...(input.flow ? { flow: input.flow } : {}),
        ...(input.directorSessionId ? { directorSessionId: input.directorSessionId } : {}),
        ...(input.directorStepId ? { directorStepId: input.directorStepId } : {}),
        ...(input.directorRunId ? { directorRunId: input.directorRunId } : {}),
      });
      if (!session) return null;
      await this.store.save(session);
      return knowledgeLessonSnapshot(session);
    });
  }
  async adapt(input: KnowledgeLessonBridgeInput): Promise<KnowledgeLessonSnapshot | null> {
    // Claim once under the lock, release while the network is in flight.
    const claimed = await this.serial(input, async () => {
      const session = await this.store.load(input.kidId);
      const existing = this.snapshotForDomain(session, this.domain(input));
      if (!session || !existing || !this.matches(input, existing) || session.mode === "check"
        || session.adaptationAttempted || session.phase !== "intro" || session.answers.length) return null;
      const next = markKnowledgeAdaptationAttempted(session, Math.max(Date.now(), session.updatedAt + 1));
      await this.store.save(next);
      return next;
    });
    if (!claimed) return this.snapshot(input);
    const learner = await this.learner(input);
    const plan = await this.service.plan({ learner, lessonId: claimed.lessonId, ...(input.profileId ? { profileId: input.profileId } : {}) });
    return this.serial(input, async () => {
      const current = await this.store.load(input.kidId);
      const currentSnapshot = this.snapshotForDomain(current, this.domain(input));
      // Never restore an old session, reverse navigation, or erase an answer.
      if (!current || current.id !== claimed.id || current.updatedAt !== claimed.updatedAt
        || current.phase !== "intro" || current.mode === "check" || current.answers.length) return currentSnapshot;
      const next = plan ? applyKnowledgeLessonPlan(current, plan, Math.max(Date.now(), current.updatedAt + 1)) : current;
      await this.store.save(next);
      return this.snapshotForDomain(next, this.domain(input));
    });
  }
  answer(input: KnowledgeLessonBridgeInput & { selectedOptionId: string; responseMs?: number }): Promise<KnowledgeLessonSnapshot | null> {
    return this.serial(input, async () => {
      const session = await this.store.load(input.kidId), domain = this.domain(input);
      const before = this.snapshotForDomain(session, domain);
      if (!session || !before?.currentQuestion || !this.matches(input, before)) return before;
      if (before.currentAnswer) { await this.recordAnswer(before); return before; }
      this.help.abortForLearner(input.kidId);
      const now = Math.max(Date.now(), session.updatedAt + 1);
      const next = answerKnowledgeQuestion(session, input.selectedOptionId, input.responseMs ?? 0, now);
      const after = this.snapshotForDomain(next, domain);
      if (!after) return null;
      await this.store.save(next);
      await this.recordAnswer(after);
      return after;
    });
  }
  advance(input: KnowledgeLessonBridgeInput): Promise<KnowledgeLessonSnapshot | null> {
    return this.serial(input, async () => {
      const session = await this.store.load(input.kidId), domain = this.domain(input);
      const before = this.snapshotForDomain(session, domain);
      if (!session || !before || !this.matches(input, before)) return before;
      this.help.abortForLearner(input.kidId);
      const next = advanceKnowledgeLesson(session, Math.max(Date.now(), session.updatedAt + 1));
      await this.store.save(next);
      return this.snapshotForDomain(next, domain);
    });
  }
  reset(input: KnowledgeLessonBridgeInput): Promise<void> {
    return this.serial(input, async () => {
      const session = await this.store.load(input.kidId);
      const snapshot = this.snapshotForDomain(session, this.domain(input));
      if (snapshot && this.matches(input, snapshot)) { this.help.abortForLearner(input.kidId); await this.store.remove(input.kidId); }
    });
  }
}
