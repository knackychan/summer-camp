import type { StorageDriver } from "../../../storage/src/StorageDriver.js";
import { LearnerProfileStore } from "../LearnerProfileStore.js";
import {
  buildPlacementCalibration,
  currentPlacementCalibrationStep,
  placementEvidenceSnapshot,
  refreshPlacementCalibration,
  shouldRecommendPlacement,
  skipPlacementCalibration,
  startPlacementCalibrationStep,
  type PlacementCalibrationState,
  type PlacementCalibrationStep,
} from "../placement/PlacementCalibration.js";
import { PlacementCalibrationStore } from "../placement/PlacementCalibrationStore.js";
import { LearningTelemetryStore } from "../telemetry/LearningTelemetry.js";
import type { VocabularyMode } from "../types.js";

export interface PlacementCalibrationInput {
  kidId: string;
  age: number;
  language?: string;
  preferredVocabularyMode?: VocabularyMode;
}

export interface PlacementCalibrationSnapshot {
  recommended: boolean;
  evidence: ReturnType<typeof placementEvidenceSnapshot>;
  state: PlacementCalibrationState | null;
  currentStep: PlacementCalibrationStep | null;
}

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export class PlacementCalibrationBridge {
  private readonly profiles: LearnerProfileStore;
  private readonly telemetry: LearningTelemetryStore;
  private readonly placements: PlacementCalibrationStore;

  constructor(storage: StorageDriver) {
    this.profiles = new LearnerProfileStore(storage);
    this.telemetry = new LearningTelemetryStore(storage);
    this.placements = new PlacementCalibrationStore(storage);
  }

  private async learner(input: PlacementCalibrationInput) {
    return this.profiles.load(input.kidId, {
      age: input.age,
      language: clean(input.language, 12) || "en-zh-TW",
      levels: { math: 1, language: 1, logic: 1, science: 1, geography: 1, history: 1 },
    });
  }

  async snapshot(input: PlacementCalibrationInput): Promise<PlacementCalibrationSnapshot> {
    const learner = await this.learner(input);
    const events = await this.telemetry.list();
    let state = await this.placements.load(input.kidId);
    if (state?.status === "in_progress") {
      state = refreshPlacementCalibration(state, events);
      await this.placements.save(state);
    }
    const evidence = placementEvidenceSnapshot(learner, events, input.preferredVocabularyMode);
    const recommended = state?.status === "complete" || state?.status === "skipped"
      ? false
      : shouldRecommendPlacement(learner, events, input.preferredVocabularyMode);
    return { recommended, evidence, state, currentStep: state ? currentPlacementCalibrationStep(state) : null };
  }

  async start(input: PlacementCalibrationInput): Promise<PlacementCalibrationSnapshot> {
    const learner = await this.learner(input);
    const events = await this.telemetry.list();
    let state = await this.placements.load(input.kidId);
    if (!state || state.status === "complete" || state.status === "skipped") {
      state = buildPlacementCalibration(learner, input.preferredVocabularyMode, Date.now(), events);
    } else {
      state = refreshPlacementCalibration(state, events);
    }
    state = startPlacementCalibrationStep(state);
    await this.placements.save(state);
    const evidence = placementEvidenceSnapshot(learner, events, input.preferredVocabularyMode);
    return { recommended: false, evidence, state, currentStep: currentPlacementCalibrationStep(state) };
  }

  async reset(input: PlacementCalibrationInput): Promise<PlacementCalibrationSnapshot> {
    const learner = await this.learner(input);
    const events = await this.telemetry.list();
    const previous = await this.placements.load(input.kidId);
    const now = Math.max(Date.now(), (previous?.createdAt ?? 0) + 1);
    const state = buildPlacementCalibration(learner, input.preferredVocabularyMode, now);
    await this.placements.save(state);
    return {
      recommended: false,
      evidence: placementEvidenceSnapshot(learner, events, input.preferredVocabularyMode),
      state,
      currentStep: currentPlacementCalibrationStep(state),
    };
  }

  async skip(input: PlacementCalibrationInput): Promise<PlacementCalibrationSnapshot> {
    const learner = await this.learner(input);
    const events = await this.telemetry.list();
    let state = await this.placements.load(input.kidId);
    if (!state || state.status === "complete") state = buildPlacementCalibration(learner, input.preferredVocabularyMode, Date.now(), events);
    state = skipPlacementCalibration(state);
    await this.placements.save(state);
    return {
      recommended: false,
      evidence: placementEvidenceSnapshot(learner, events, input.preferredVocabularyMode),
      state,
      currentStep: null,
    };
  }
}
