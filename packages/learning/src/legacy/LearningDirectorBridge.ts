import { taipeiClock } from "../../../core/src/time.js";
import type { StorageDriver } from "../../../storage/src/StorageDriver.js";
import { serialStorageTask } from "../../../storage/src/SerialStorageTasks.js";
import { LearnerProfileStore } from "../LearnerProfileStore.js";
import {
  buildLearningDirectorPlan,
  completeLearningDirectorStep,
  currentLearningDirectorStep,
  recommendLearningDirectorStep,
  refreshLearningDirectorPlan,
  startLearningDirectorStep,
  type LearningDirectorLaunch,
  type LearningDirectorPlan,
  type LearningDirectorStep,
} from "../director/LearningDirector.js";
import { LearningDirectorStore } from "../director/LearningDirectorStore.js";
import { PlacementCalibrationStore } from "../placement/PlacementCalibrationStore.js";
import { refreshPlacementCalibration, type PlacementCalibrationState } from "../placement/PlacementCalibration.js";
import { LearningTelemetryStore, summarizeLearningTelemetry } from "../telemetry/LearningTelemetry.js";
import type { VocabularyMode } from "../types.js";

export interface LearningDirectorInput {
  kidId: string;
  age: number;
  language?: string;
  preferredVocabularyMode?: VocabularyMode;
  /** The shipped UI opts into run-bound sessions; legacy clients remain supported. */
  guided?: boolean;
  availableGameIds?: LearningDirectorLaunch["gameId"][];
  expectedPlanId?: string;
  expectedStepId?: string;
  expectedRevision?: number;
}

export interface LearningDirectorSnapshot {
  plan: LearningDirectorPlan;
  currentStep: LearningDirectorStep | null;
  actionApplied?: boolean;
}

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function placementChanged(plan: LearningDirectorPlan, placement: PlacementCalibrationState | null): boolean {
  const complete = placement?.status === "complete" ? placement : null;
  if (!complete) return plan.placementId != null;
  return plan.placementId !== complete.id || plan.placementUpdatedAt !== complete.updatedAt;
}
function planHasStarted(plan: LearningDirectorPlan): boolean {
  return plan.activeStepIndex > 0 || plan.steps.some((step) => step.startedAt != null) || plan.completedAt != null;
}
function matches(input: LearningDirectorInput, plan: LearningDirectorPlan): boolean {
  return (input.expectedPlanId == null || input.expectedPlanId === plan.id)
    && (input.expectedStepId == null || input.expectedStepId === currentLearningDirectorStep(plan)?.id)
    && (input.expectedRevision == null || input.expectedRevision === plan.coordination?.revision);
}

export class LearningDirectorBridge {
  private readonly profiles: LearnerProfileStore;
  private readonly telemetry: LearningTelemetryStore;
  private readonly plans: LearningDirectorStore;
  private readonly placements: PlacementCalibrationStore;

  constructor(private readonly storage: StorageDriver) {
    this.profiles = new LearnerProfileStore(storage);
    this.telemetry = new LearningTelemetryStore(storage);
    this.plans = new LearningDirectorStore(storage);
    this.placements = new PlacementCalibrationStore(storage);
  }
  private serial<T>(input: LearningDirectorInput, task: () => Promise<T>): Promise<T> {
    return serialStorageTask(this.storage, `director:${input.kidId}`, task);
  }
  private result(plan: LearningDirectorPlan, actionApplied?: boolean): LearningDirectorSnapshot {
    return { plan, currentStep: currentLearningDirectorStep(plan), ...(actionApplied == null ? {} : { actionApplied }) };
  }
  private async currentPlacement(kidId: string, events: Awaited<ReturnType<LearningTelemetryStore["list"]>>): Promise<PlacementCalibrationState | null> {
    let placement = await this.placements.load(kidId);
    if (placement?.status === "in_progress") {
      placement = refreshPlacementCalibration(placement, events);
      await this.placements.save(placement);
    }
    return placement?.status === "complete" ? placement : null;
  }
  private async fresh(input: LearningDirectorInput, now?: number) {
    const day = taipeiClock().day;
    const learner = await this.profiles.load(input.kidId, {
      age: input.age, language: clean(input.language, 12) || "en-zh-TW",
      levels: { math: 1, language: 1, logic: 1, science: 1, geography: 1, history: 1 },
    });
    const events = await this.telemetry.list();
    const placement = await this.currentPlacement(input.kidId, events);
    const plan = buildLearningDirectorPlan({
      learner, summaries: summarizeLearningTelemetry(events), day, placement,
      ...(now == null ? {} : { now }),
      ...(input.preferredVocabularyMode ? { preferredVocabularyMode: input.preferredVocabularyMode } : {}),
    });
    return { plan, events, placement };
  }
  private enableGuided(plan: LearningDirectorPlan): LearningDirectorPlan {
    if (plan.coordination) return plan;
    // Preserve completed steps and committed partial counts, but never claim an
    // old unbound event belongs to a new activity run after upgrading.
    return {
      ...plan,
      coordination: { version: 1, status: "ready", revision: 0, declinedSkills: [] },
      steps: plan.steps.map((step) => {
        if (step.completedAt) return step;
        const next = { ...step, acceptedAttemptIds: Array.from({ length: step.progressAttempts }, (_, i) => `legacy-committed:${step.id}:${i}`) };
        delete next.startedAt;
        delete next.runId;
        return next;
      }),
    };
  }
  private recommend(plan: LearningDirectorPlan, fresh: LearningDirectorPlan, input: LearningDirectorInput): void {
    if (!plan.coordination || plan.completedAt || plan.coordination.status === "finished") return;
    const step = currentLearningDirectorStep(plan);
    if (!step || step.startedAt || step.progressAttempts) return;
    const next = recommendLearningDirectorStep(plan, fresh, {
      ...(input.availableGameIds ? { availableGameIds: input.availableGameIds } : {}),
    });
    if (next) plan.steps[plan.activeStepIndex] = next;
    else plan.coordination = { ...plan.coordination, status: "finished", finishReason: "no_candidates", finishedAt: Date.now(), revision: plan.coordination.revision + 1 };
  }
  private async snapshotUnlocked(input: LearningDirectorInput): Promise<LearningDirectorSnapshot> {
    const fresh = await this.fresh(input);
    let plan = await this.plans.load(input.kidId, fresh.plan.day);
    if (!plan || plan.version !== 11 || plan.learnerId !== input.kidId || plan.day !== fresh.plan.day || (placementChanged(plan, fresh.placement) && !planHasStarted(plan))) plan = fresh.plan;
    const justEnabled = Boolean(input.guided && !plan.coordination);
    if (input.guided) plan = this.enableGuided(plan);
    const oldIndex = plan.activeStepIndex;
    plan = refreshLearningDirectorPlan(plan, fresh.events);
    if (plan.coordination) {
      plan.skills = fresh.plan.skills;
      plan.reviewDueCount = fresh.plan.reviewDueCount;
      if (oldIndex !== plan.activeStepIndex || justEnabled) this.recommend(plan, fresh.plan, input);
    }
    await this.plans.save(plan);
    return this.result(plan);
  }
  snapshot(input: LearningDirectorInput): Promise<LearningDirectorSnapshot> {
    return this.serial(input, () => this.snapshotUnlocked(input));
  }
  start(input: LearningDirectorInput): Promise<LearningDirectorSnapshot> {
    return this.serial(input, async () => {
      const state = await this.snapshotUnlocked(input);
      let plan = state.plan;
      if (!matches(input, plan) || !state.currentStep) return this.result(plan, false);
      const launch = state.currentStep.launch;
      if (input.availableGameIds && launch && !input.availableGameIds.includes(launch.gameId)) {
        // Availability can change after a saved recommendation was rendered.
        // Offer a valid replacement, but never auto-start it or credit a skip.
        if (plan.coordination) {
          const revision = plan.coordination.revision + 1;
          const next = recommendLearningDirectorStep(plan, (await this.fresh(input)).plan, {
            availableGameIds: input.availableGameIds, excludeSkills: [state.currentStep.skill], alternative: true,
          });
          if (next) {
            next.id = `${plan.id}:step-${plan.activeStepIndex + 1}:available-${revision}`;
            plan.steps[plan.activeStepIndex] = next;
            plan.coordination = { ...plan.coordination, status: "ready", revision, declinedSkills: [] };
          } else {
            delete state.currentStep.runId;
            plan.coordination = { ...plan.coordination, status: "finished", finishReason: "no_candidates", finishedAt: Date.now(), revision };
          }
          await this.plans.save(plan);
        }
        return this.result(plan, false);
      }
      plan = startLearningDirectorStep(plan);
      if (plan.coordination) {
        const revision = plan.coordination.revision + 1;
        plan.coordination = { ...plan.coordination, status: "running", revision };
        const step = currentLearningDirectorStep(plan)!;
        // A new mount gets a new identity. Partial committed progress survives.
        step.runId = `guided-${Date.now().toString(36)}-${revision}-${Math.random().toString(36).slice(2, 10)}`;
      }
      await this.plans.save(plan);
      return this.result(plan, true);
    });
  }
  completeCurrent(input: LearningDirectorInput): Promise<LearningDirectorSnapshot> {
    return this.serial(input, async () => {
      const state = await this.snapshotUnlocked(input);
      if (!matches(input, state.plan) || (state.plan.coordination && state.plan.coordination.status !== "running")) return this.result(state.plan, false);
      const plan = completeLearningDirectorStep(state.plan);
      if (plan.activeStepIndex !== state.plan.activeStepIndex && plan.coordination) {
        plan.coordination = { ...plan.coordination, status: "ready", revision: plan.coordination.revision + 1, declinedSkills: [] };
        this.recommend(plan, (await this.fresh(input)).plan, input);
      }
      await this.plans.save(plan);
      return this.result(plan, plan.activeStepIndex !== state.plan.activeStepIndex);
    });
  }
  pause(input: LearningDirectorInput): Promise<LearningDirectorSnapshot> {
    return this.serial(input, async () => {
      const state = await this.snapshotUnlocked(input), plan = state.plan;
      if (!matches(input, plan) || !plan.coordination || plan.completedAt || plan.coordination.status === "finished") return this.result(plan, false);
      const step = currentLearningDirectorStep(plan);
      if (step) delete step.runId; // subsequent stale callbacks cannot complete this step
      plan.coordination = { ...plan.coordination, status: "paused", revision: plan.coordination.revision + 1 };
      await this.plans.save(plan);
      return this.result(plan, true);
    });
  }
  finish(input: LearningDirectorInput): Promise<LearningDirectorSnapshot> {
    return this.serial(input, async () => {
      const state = await this.snapshotUnlocked(input), plan = state.plan;
      if (!matches(input, plan) || !plan.coordination || plan.completedAt || plan.coordination.status === "finished") return this.result(plan, false);
      const step = currentLearningDirectorStep(plan);
      if (step) delete step.runId;
      plan.coordination = { ...plan.coordination, status: "finished", finishReason: "child_choice", finishedAt: Date.now(), revision: plan.coordination.revision + 1 };
      await this.plans.save(plan);
      return this.result(plan, true);
    });
  }
  alternative(input: LearningDirectorInput): Promise<LearningDirectorSnapshot> {
    return this.serial(input, async () => {
      const state = await this.snapshotUnlocked(input), plan = state.plan;
      if (!matches(input, plan) || !plan.coordination || !state.currentStep) return this.result(plan, false);
      const declined = [...new Set([...plan.coordination.declinedSkills, state.currentStep.skill])];
      const fresh = (await this.fresh(input)).plan;
      const next = recommendLearningDirectorStep(plan, fresh, {
        alternative: true, excludeSkills: declined,
        ...(input.availableGameIds ? { availableGameIds: input.availableGameIds } : {}),
      });
      if (!next) return this.result(plan, false);
      const revision = plan.coordination.revision + 1;
      next.id = `${plan.id}:step-${plan.activeStepIndex + 1}:choice-${revision}`;
      plan.steps[plan.activeStepIndex] = next;
      plan.coordination = { ...plan.coordination, status: "ready", revision, declinedSkills: declined };
      await this.plans.save(plan);
      return this.result(plan, true);
    });
  }
  reset(input: LearningDirectorInput): Promise<LearningDirectorSnapshot> {
    return this.serial(input, async () => {
      const previous = await this.plans.load(input.kidId, taipeiClock().day);
      if (previous && !matches(input, previous)) return this.result(previous, false);
      const now = Math.max(Date.now(), (previous?.createdAt ?? 0) + 1);
      const fresh = await this.fresh(input, now);
      const plan = input.guided || previous?.coordination ? this.enableGuided(fresh.plan) : fresh.plan;
      this.recommend(plan, fresh.plan, input);
      await this.plans.save(plan);
      return this.result(plan, true);
    });
  }
}
