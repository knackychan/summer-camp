import type { StorageDriver } from "../../../storage/src/StorageDriver.js";
import { serialStorageTask } from "../../../storage/src/SerialStorageTasks.js";
import type { LearningTelemetryRecorder } from "../telemetry/LearningTelemetry.js";
import { getKnowledgeLesson } from "../knowledge/KnowledgeLessonCatalog.js";
import { knowledgeCheckHelpCues, knowledgeHelpCues, localKnowledgeCheckHelp, localKnowledgeHelp, type KnowledgeHelpResult, type KnowledgeHelpState } from "../knowledge/KnowledgeHelpContract.js";
import { KnowledgeHelpService, type KnowledgeHelpAgentClient } from "../knowledge/KnowledgeHelpService.js";
import { knowledgeLessonSnapshot, type KnowledgeLessonSession, type KnowledgeLessonSnapshot } from "../knowledge/KnowledgeLessonRuntime.js";
import { KnowledgeLessonStore } from "../knowledge/KnowledgeLessonStore.js";
import type { KnowledgeLessonBridgeInput } from "./KnowledgeLessonBridge.js";

type Input = KnowledgeLessonBridgeInput & { focusId?: string };
/** Same store and serial key as lesson mutations. No scheduler, grading, mastery or reward writes. */
export class KnowledgeHelpBridge {
  private readonly store: KnowledgeLessonStore;
  private readonly service: KnowledgeHelpService;
  private readonly pending = new Map<string, { learnerId: string; controller: AbortController }>();
  constructor(private readonly storage: StorageDriver, client?: KnowledgeHelpAgentClient,
    private readonly telemetry?: LearningTelemetryRecorder, timeoutMs?: number) {
    this.store = new KnowledgeLessonStore(storage);
    this.service = new KnowledgeHelpService(client, timeoutMs);
  }
  private serial<T>(input: Input, task: () => Promise<T>): Promise<T> {
    return serialStorageTask(this.storage, `knowledge:${input.kidId}`, task);
  }
  private view(input: Input, session: KnowledgeLessonSession | null): KnowledgeLessonSnapshot | null {
    if (!session || session.version !== 1) return null;
    const domain = input.domain === "history" || input.domain === "geography" ? input.domain : "science";
    const view = knowledgeLessonSnapshot(session);
    return view?.lesson.domain === domain && view.session.learnerId === input.kidId ? view : null;
  }
  private eligible(input: Input, session: KnowledgeLessonSession | null): session is KnowledgeLessonSession {
    const view = this.view(input, session);
    if (!session || !view || input.expectedSessionId !== session.id || input.age < view.lesson.minAge) return false;
    if (session.mode === "explore") return input.expectedPhase === "intro" && session.phase === "intro" && session.answers.length === 0;
    return input.expectedPhase === "question" && session.phase === "question" && !!view.currentQuestion
      && input.expectedQuestionId === view.currentQuestion.id && !view.currentAnswer;
  }
  private currentRequestId(session: KnowledgeLessonSession): string | null {
    if (session.mode === "explore" && session.phase === "intro") return `${session.id}:explore-help`;
    const view = knowledgeLessonSnapshot(session);
    return session.mode === "check" && session.phase === "question" && view?.currentQuestion ? `${session.id}:check-help:${view.currentQuestion.id}` : null;
  }
  private local(session: KnowledgeLessonSession, focusId?: string | null): KnowledgeHelpResult | null {
    const lesson = getKnowledgeLesson(session.lessonId), view = knowledgeLessonSnapshot(session);
    if (!lesson || !view) return null;
    return session.mode === "check" && view.currentQuestion
      ? localKnowledgeCheckHelp(view.currentQuestion, focusId)
      : localKnowledgeHelp(lesson, session.readingLevel, focusId);
  }
  private cues(session: KnowledgeLessonSession) {
    const lesson = getKnowledgeLesson(session.lessonId), view = knowledgeLessonSnapshot(session);
    if (!lesson || !view) return [];
    return session.mode === "check" && view.currentQuestion ? knowledgeCheckHelpCues(view.currentQuestion) : knowledgeHelpCues(lesson);
  }
  private async record(session: KnowledgeLessonSession, result: KnowledgeHelpResult, outcome: "applied" | "discarded"): Promise<void> {
    const lesson = getKnowledgeLesson(session.lessonId);
    if (!session.help || !lesson || !this.telemetry) return;
    await this.telemetry.record({ version: 1, id: session.help.requestId, type: "tutor_help", at: Date.now(),
      learnerId: session.learnerId, domain: lesson.domain, skill: lesson.skill, sessionId: session.id,
      task: "knowledge_help", lessonId: session.lessonId, outcome,
      ...result, fallbackReason: outcome === "discarded" ? "stale_context" : result.fallbackReason });
  }
  abortForLearner(learnerId: string): void {
    for (const pending of this.pending.values()) if (pending.learnerId === learnerId) pending.controller.abort();
  }
  read(input: Input): Promise<KnowledgeLessonSnapshot | null> {
    return this.serial(input, async () => {
      let session = await this.store.load(input.kidId);
      if (!this.view(input, session)) return null;
      const help = session?.help, expectedRequestId = session ? this.currentRequestId(session) : null;
      if (session && help && help.requestId !== expectedRequestId) {
        const { help: _help, ...withoutHelp } = session;
        session = withoutHelp;
        await this.store.save(session);
        return this.view(input, session);
      }
      // Reload does not silently replay an interrupted paid attempt.
      if (session && help?.status === "pending" && !this.pending.has(help.requestId)) {
        const result: KnowledgeHelpResult = { ...help.result, source: "local", fallbackReason: "interrupted" };
        session = { ...session, help: { ...help, status: "ready", result } };
        await this.store.save(session);
        await this.record(session, result, "applied");
      }
      return this.view(input, session);
    });
  }
  open(input: Input): Promise<KnowledgeLessonSnapshot | null> {
    return this.serial(input, async () => {
      const session = await this.store.load(input.kidId);
      if (!this.eligible(input, session)) return null;
      const requestId = this.currentRequestId(session);
      if (!requestId) return null;
      if (session.help?.requestId === requestId) return this.view(input, session);
      const result = this.local(session, input.focusId);
      if (!result) return null;
      const help: KnowledgeHelpState = { version: 1, requestId, revision: 0,
        status: "ready", remoteAttempted: false, initialFocusId: input.focusId ?? null, result };
      // Help is presentation-only: do not change questionIndex, answers, grading, mastery, rewards or updatedAt.
      const next = { ...session, help };
      await this.store.save(next);
      return this.view(input, next);
    });
  }
  async adapt(input: Input): Promise<KnowledgeLessonSnapshot | null> {
    const claimed = await this.serial(input, async () => {
      const session = await this.store.load(input.kidId);
      if (!this.eligible(input, session) || !session.help || session.help.remoteAttempted || session.help.requestId !== this.currentRequestId(session)) return null;
      const controller = new AbortController();
      const help: KnowledgeHelpState = { ...session.help, remoteAttempted: true, status: "pending" };
      const next = { ...session, help };
      await this.store.save(next);
      this.pending.set(help.requestId, { learnerId: session.learnerId, controller });
      const view = knowledgeLessonSnapshot(next);
      return { session: next, help, controller, questionId: view?.currentQuestion?.id ?? null };
    });
    if (!claimed) return null;
    const { session, help, controller, questionId } = claimed;
    const result = await this.service.select({ lessonId: session.lessonId, readingLevel: session.readingLevel,
      age: input.age, focusId: help.initialFocusId, local: help.result, signal: controller.signal,
      mode: session.mode, phase: session.mode === "check" ? "question" : "intro", questionId,
      ...(input.profileId ? { profileId: input.profileId } : {}) });
    return this.serial(input, async () => {
      this.pending.delete(help.requestId);
      const current = await this.store.load(input.kidId);
      if (!this.eligible(input, current) || current.help?.requestId !== help.requestId
        || current.help.status !== "pending" || current.help.revision !== help.revision
        || current.directorRunId !== session.directorRunId) {
        await this.record(session, result, "discarded");
        return null;
      }
      const next = { ...current, help: { ...current.help, status: "ready" as const, result } };
      await this.store.save(next);
      await this.record(next, result, "applied");
      return this.view(input, next);
    });
  }
  next(input: Input): Promise<KnowledgeLessonSnapshot | null> {
    return this.serial(input, async () => {
      const session = await this.store.load(input.kidId);
      if (!this.eligible(input, session) || !session.help || session.help.requestId !== this.currentRequestId(session)) return null;
      const cues = this.cues(session);
      const index = cues.findIndex((cue) => cue.id === session.help!.result.cueId);
      const cue = cues[(index + 1) % cues.length];
      if (!cue) return null;
      const base = this.local(session, cue.id);
      if (!base) return null;
      const result: KnowledgeHelpResult = { ...base, fallbackReason: "local_choice" };
      const help: KnowledgeHelpState = { ...session.help, revision: session.help.revision + 1, remoteAttempted: true, status: "ready", result };
      const next = { ...session, help };
      await this.store.save(next);
      this.abortForLearner(input.kidId);
      return this.view(input, next);
    });
  }
  cancel(input: Input): Promise<void> {
    return this.serial(input, async () => {
      const session = await this.store.load(input.kidId);
      if (!session || session.id !== input.expectedSessionId || !session.help) return;
      if (session.help.status === "pending" || !session.help.remoteAttempted) {
        await this.store.save({ ...session, help: { ...session.help, remoteAttempted: true, status: "ready",
          result: { ...session.help.result, fallbackReason: "cancelled" } } });
      }
      this.abortForLearner(input.kidId);
    });
  }
}
