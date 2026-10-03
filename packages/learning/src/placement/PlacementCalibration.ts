import type { LearningDomain, LearnerProfile, VocabularyMode } from "../types.js";
import type { LearningTelemetryEvent } from "../telemetry/LearningTelemetry.js";
import {
  getCurriculumSkill,
  type CurriculumSkillId,
} from "../curriculum/SkillCatalog.js";
import { granularLanguageSkillForLegacy } from "../curriculum/LanguageSkillRules.js";

export type PlacementCalibrationDomain = Extract<LearningDomain, "math" | "language">;
export type PlacementCalibrationStatus = "in_progress" | "complete" | "skipped";
export type PlacementCalibrationDirection = "up" | "down";
export type PlacementCalibrationConfidence = "single_sample" | "two_sample" | "history";
export type PlacementCalibrationResultSource = "quick_check" | "history";
export type MathPlacementStrand = "number_sense" | "number_bonds" | "number_operations" | "multiplication";
export type PlacementCalibrationTrackKey =
  | "math:number_sense"
  | "math:number_bonds"
  | "math:number_operations"
  | "math:multiplication"
  | "language";
export type PlacementCalibrationProbeKind = "anchor" | "confirmation";

export interface PlacementCalibrationSample {
  skill: CurriculumSkillId;
  attempts: number;
  correctAttempts: number;
}

export interface PlacementCalibrationResult {
  domain: PlacementCalibrationDomain;
  strand?: MathPlacementStrand;
  strandLabel?: string;
  strandLabelZh?: string;
  recommendedSkill: CurriculumSkillId;
  label: string;
  labelZh: string;
  shortLabel: string;
  shortLabelZh: string;
  icon: string;
  ladder: CurriculumSkillId[];
  recommendedIndex: number;
  samples: PlacementCalibrationSample[];
  confidence: PlacementCalibrationConfidence;
  source: PlacementCalibrationResultSource;
  completedAt: number;
}

export interface PlacementCalibrationTrack {
  key: PlacementCalibrationTrackKey;
  domain: PlacementCalibrationDomain;
  strand?: MathPlacementStrand;
  ladder: CurriculumSkillId[];
  anchorIndex: number;
  direction?: PlacementCalibrationDirection;
  samples: PlacementCalibrationSample[];
  result?: PlacementCalibrationResult;
}

export interface PlacementCalibrationLaunch {
  flow: "placement";
  gameId: "calc" | "vocab";
  mathSkill?: CurriculumSkillId;
  vocabularyMode?: VocabularyMode;
  forceStudy?: boolean;
  targetAttempts: number;
}

export interface PlacementCalibrationStep {
  id: string;
  trackKey: PlacementCalibrationTrackKey;
  domain: PlacementCalibrationDomain;
  strand?: MathPlacementStrand;
  probe: PlacementCalibrationProbeKind;
  skill: CurriculumSkillId;
  title: string;
  titleZh: string;
  note: string;
  noteZh: string;
  targetAttempts: number;
  progressAttempts: number;
  correctAttempts: number;
  launch: PlacementCalibrationLaunch;
  startedAt?: number;
  completedAt?: number;
}

export interface PlacementCalibrationState {
  version: 3;
  id: string;
  learnerId: string;
  status: PlacementCalibrationStatus;
  createdAt: number;
  updatedAt: number;
  preferredVocabularyMode?: VocabularyMode;
  trackOrder: PlacementCalibrationTrackKey[];
  currentTrackIndex: number;
  tracks: Partial<Record<PlacementCalibrationTrackKey, PlacementCalibrationTrack>>;
  steps: PlacementCalibrationStep[];
  activeStepIndex: number;
  completedAt?: number;
  skippedAt?: number;
}

export interface PlacementEvidenceSnapshot {
  mathIndependentAttempts: number;
  languageIndependentAttempts: number;
  mathStrands: Record<MathPlacementStrand, number>;
  requiredMathStrands: MathPlacementStrand[];
  resolvedMathStrands: MathPlacementStrand[];
  requiredTrackCount: number;
  resolvedTrackCount: number;
  enoughExistingEvidence: boolean;
}

const MATH_STRAND_LADDERS: Record<MathPlacementStrand, CurriculumSkillId[]> = {
  number_sense: [
    "math.number_comparison.within_20",
    "math.number_comparison.within_100",
  ],
  number_bonds: [
    "math.number_bonds.to_10",
    "math.number_bonds.to_20",
  ],
  number_operations: [
    "math.addition.within_5",
    "math.addition.within_20",
    "math.subtraction.within_20",
    "math.addition.within_100",
    "math.subtraction.within_100",
    "math.addition.within_200",
  ],
  multiplication: [
    "math.multiplication.tables_2_5_10",
    "math.multiplication.tables_2_to_9",
  ],
};

const MATH_STRAND_COPY: Record<MathPlacementStrand, { label: string; labelZh: string }> = {
  number_sense: { label: "Number sense", labelZh: "數感" },
  number_bonds: { label: "Number bonds", labelZh: "數字分合" },
  number_operations: { label: "Addition & subtraction", labelZh: "加減法" },
  multiplication: { label: "Multiplication", labelZh: "乘法" },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mathOperationsAnchorIndex(age: number): number {
  if (age <= 4) return 0;
  if (age <= 6) return 1;
  if (age === 7) return 2;
  if (age <= 9) return 3;
  if (age === 10) return 4;
  return 5;
}

function mathAnchorIndex(strand: MathPlacementStrand, age: number): number {
  if (strand === "number_sense") return age <= 5 ? 0 : 1;
  if (strand === "number_bonds") return age <= 5 ? 0 : 1;
  if (strand === "multiplication") return age <= 7 ? 0 : 1;
  return mathOperationsAnchorIndex(age);
}

function mathStrandsForLearner(learner: LearnerProfile): MathPlacementStrand[] {
  const strands: MathPlacementStrand[] = ["number_operations"];
  if (learner.age >= 4) strands.push("number_sense");
  if (learner.age >= 5) strands.push("number_bonds");
  if (learner.age >= 7) strands.push("multiplication");
  return strands;
}

function mathTrackKey(strand: MathPlacementStrand): PlacementCalibrationTrackKey {
  return `math:${strand}` as PlacementCalibrationTrackKey;
}

function languageLadder(learner: LearnerProfile, preferred?: VocabularyMode): CurriculumSkillId[] {
  if (preferred === "bopomofo") {
    const ladder: CurriculumSkillId[] = ["language.bopomofo.sound_symbol"];
    if (learner.readingLevel !== "pre_reader" && learner.age >= 5) ladder.push("language.bopomofo.word_build");
    return ladder;
  }
  const ladder: CurriculumSkillId[] = [];
  if (learner.readingLevel === "pre_reader" || learner.age <= 6) ladder.push("language.initial_sound");
  if (learner.readingLevel !== "reader") ladder.push("language.word_build.simple");
  if (learner.readingLevel !== "pre_reader" && learner.age >= 5) ladder.push("language.picture_vocabulary.basic");
  if (learner.readingLevel !== "pre_reader" && learner.age >= 6) ladder.push("language.high_frequency.recall");
  if (learner.readingLevel !== "pre_reader" && learner.age >= 7) ladder.push("language.spelling_patterns.basic");
  if (preferred === "translate" && learner.readingLevel === "reader" && learner.age >= 8) ladder.push("language.word_translation.basic");
  if (preferred === "sentences" && learner.readingLevel !== "pre_reader" && learner.age >= 7) ladder.push("language.sentence_patterns.simple");
  if (preferred === "sentences" && learner.readingLevel === "reader" && learner.age >= 9) ladder.push("language.sentence_patterns.questions");
  if (!ladder.length) ladder.push("language.picture_vocabulary.basic");
  return ladder;
}

function languageAnchorIndex(learner: LearnerProfile, ladder: CurriculumSkillId[], preferred?: VocabularyMode): number {
  if (ladder.length <= 1) return 0;
  if (preferred === "bopomofo") return learner.readingLevel === "pre_reader" ? 0 : Math.min(1, ladder.length - 1);
  let defaultIndex = learner.age <= 4 ? 0
    : learner.age === 5 ? 1
    : learner.age === 6 ? 2
    : learner.age === 7 ? 3
    : Math.min(4, ladder.length - 1);
  if (learner.readingLevel === "reader" && (preferred === "translate" || preferred === "sentences")) {
    defaultIndex = Math.max(defaultIndex, ladder.length - 1);
  }
  return clamp(defaultIndex, 0, ladder.length - 1);
}

function makeMathTrack(strand: MathPlacementStrand, learner: LearnerProfile): PlacementCalibrationTrack {
  const ladder = [...MATH_STRAND_LADDERS[strand]];
  return {
    key: mathTrackKey(strand),
    domain: "math",
    strand,
    ladder,
    anchorIndex: clamp(mathAnchorIndex(strand, learner.age), 0, ladder.length - 1),
    samples: [],
  };
}

function makeLanguageTrack(learner: LearnerProfile, preferred?: VocabularyMode): PlacementCalibrationTrack {
  const ladder = languageLadder(learner, preferred);
  return {
    key: "language",
    domain: "language",
    ladder,
    anchorIndex: languageAnchorIndex(learner, ladder, preferred),
    samples: [],
  };
}

function cloneResult(result: PlacementCalibrationResult): PlacementCalibrationResult {
  return {
    ...result,
    ladder: [...result.ladder],
    samples: result.samples.map((sample) => ({ ...sample })),
  };
}

function cloneTrack(track: PlacementCalibrationTrack): PlacementCalibrationTrack {
  return {
    ...track,
    ladder: [...track.ladder],
    samples: track.samples.map((sample) => ({ ...sample })),
    ...(track.result ? { result: cloneResult(track.result) } : {}),
  };
}

function cloneState(state: PlacementCalibrationState): PlacementCalibrationState {
  const tracks: Partial<Record<PlacementCalibrationTrackKey, PlacementCalibrationTrack>> = {};
  for (const key of state.trackOrder) {
    const track = state.tracks[key];
    if (track) tracks[key] = cloneTrack(track);
  }
  return {
    ...state,
    trackOrder: [...state.trackOrder],
    tracks,
    steps: state.steps.map((step) => ({ ...step, launch: { ...step.launch } })),
  };
}

function launchFor(skill: CurriculumSkillId, targetAttempts: number): PlacementCalibrationLaunch {
  const definition = getCurriculumSkill(skill);
  if (!definition) throw new Error(`Unknown placement skill ${skill}`);
  if (definition.launch.gameId === "calc") {
    return {
      flow: "placement",
      gameId: "calc",
      mathSkill: skill,
      targetAttempts,
    };
  }
  if (definition.launch.gameId === "vocab") {
    return {
      flow: "placement",
      gameId: "vocab",
      vocabularyMode: definition.launch.vocabularyMode,
      forceStudy: true,
      targetAttempts,
    };
  }
  throw new Error(`Knowledge skill ${skill} is not part of quick placement`);
}

function trackCopy(track: PlacementCalibrationTrack): { label: string; labelZh: string } {
  if (track.strand) return MATH_STRAND_COPY[track.strand];
  return { label: "Words", labelZh: "文字" };
}

function makeStep(
  stateId: string,
  index: number,
  track: PlacementCalibrationTrack,
  skill: CurriculumSkillId,
  probe: PlacementCalibrationProbeKind,
): PlacementCalibrationStep {
  const definition = getCurriculumSkill(skill);
  if (!definition) throw new Error(`Unknown placement skill ${skill}`);
  const area = trackCopy(track);
  const targetAttempts = probe === "anchor" ? 2 : 1;
  return {
    id: `${stateId}:step-${index + 1}`,
    trackKey: track.key,
    domain: track.domain,
    ...(track.strand ? { strand: track.strand } : {}),
    probe,
    skill,
    title: `${area.label} · ${definition.shortLabel}`,
    titleZh: `${area.labelZh} · ${definition.shortLabelZh}`,
    note: probe === "anchor"
      ? "Two quick items. No score, no reward, no AI help."
      : "One quick confirmation item, then we move on.",
    noteZh: probe === "anchor"
      ? "只做兩題。不計分、不給獎勵，也不用 AI 幫忙。"
      : "再做一題確認，接著就換下一區。",
    targetAttempts,
    progressAttempts: 0,
    correctAttempts: 0,
    launch: launchFor(skill, targetAttempts),
  };
}

function placementEventSkill(event: LearningTelemetryEvent): string {
  if (event.type !== "attempt" || event.domain !== "language") return event.type === "attempt" ? event.skill : "";
  return granularLanguageSkillForLegacy(event.skill) ?? event.skill;
}

function independentAttemptsForTrack(
  track: PlacementCalibrationTrack,
  learnerId: string,
  events: LearningTelemetryEvent[],
): LearningTelemetryEvent[] {
  const skills = new Set(track.ladder);
  return events.filter((event) => event.type === "attempt"
    && event.learnerId === learnerId
    && event.domain === track.domain
    && skills.has(placementEventSkill(event) as CurriculumSkillId)
    && event.hintsUsed === 0);
}

function aggregateSamples(track: PlacementCalibrationTrack, events: LearningTelemetryEvent[]): PlacementCalibrationSample[] {
  return track.ladder.map((skill) => {
    const matching = events.filter((event) => event.type === "attempt" && placementEventSkill(event) === skill);
    return {
      skill,
      attempts: matching.length,
      correctAttempts: matching.filter((event) => event.type === "attempt" && event.correct).length,
    };
  }).filter((sample) => sample.attempts > 0);
}

function resultFor(
  track: PlacementCalibrationTrack,
  recommendedIndex: number,
  now: number,
  source: PlacementCalibrationResultSource,
  confidence?: PlacementCalibrationConfidence,
  samples?: PlacementCalibrationSample[],
): PlacementCalibrationResult {
  const recommendedSkill = track.ladder[recommendedIndex]!;
  const definition = getCurriculumSkill(recommendedSkill);
  if (!definition) throw new Error(`Unknown placement result skill ${recommendedSkill}`);
  const area = track.strand ? MATH_STRAND_COPY[track.strand] : null;
  const resultSamples = (samples ?? track.samples).map((sample) => ({ ...sample }));
  return {
    domain: track.domain,
    ...(track.strand ? { strand: track.strand, strandLabel: area!.label, strandLabelZh: area!.labelZh } : {}),
    recommendedSkill,
    label: definition.label,
    labelZh: definition.labelZh,
    shortLabel: definition.shortLabel,
    shortLabelZh: definition.shortLabelZh,
    icon: definition.icon,
    ladder: [...track.ladder],
    recommendedIndex,
    samples: resultSamples,
    confidence: confidence ?? (resultSamples.length >= 2 ? "two_sample" : "single_sample"),
    source,
    completedAt: now,
  };
}

function historyResultForTrack(
  track: PlacementCalibrationTrack,
  learnerId: string,
  events: LearningTelemetryEvent[],
  now: number,
): PlacementCalibrationResult | null {
  const independent = independentAttemptsForTrack(track, learnerId, events);
  if (independent.length < 4) return null;
  const samples = aggregateSamples(track, independent);
  const usable = samples.filter((sample) => sample.attempts >= 2);
  if (!usable.length) return null;
  let highestPassed = -1;
  let lowestFailed = Number.POSITIVE_INFINITY;
  for (const sample of usable) {
    const index = track.ladder.indexOf(sample.skill);
    if (index < 0) continue;
    const rate = sample.correctAttempts / sample.attempts;
    if (rate >= 0.75) highestPassed = Math.max(highestPassed, index);
    else lowestFailed = Math.min(lowestFailed, index);
  }
  let recommendedIndex: number;
  if (highestPassed >= 0) recommendedIndex = highestPassed;
  else if (Number.isFinite(lowestFailed)) recommendedIndex = Math.max(0, lowestFailed - 1);
  else return null;
  const completedAt = independent.reduce((max, event) => Math.max(max, event.at), Math.round(now));
  return resultFor(track, recommendedIndex, completedAt, "history", "history", samples);
}

function firstUnresolvedTrackIndex(state: PlacementCalibrationState, start = 0): number {
  for (let i = Math.max(0, start); i < state.trackOrder.length; i += 1) {
    const track = state.tracks[state.trackOrder[i]!];
    if (track && !track.result) return i;
  }
  return state.trackOrder.length;
}

function appendAnchorStepForTrack(state: PlacementCalibrationState, trackIndex: number): void {
  const key = state.trackOrder[trackIndex];
  const track = key ? state.tracks[key] : null;
  if (!track) return;
  const skill = track.ladder[track.anchorIndex]!;
  state.steps.push(makeStep(state.id, state.steps.length, track, skill, "anchor"));
  state.activeStepIndex = state.steps.length - 1;
  state.currentTrackIndex = trackIndex;
}

export function buildPlacementCalibration(
  learner: LearnerProfile,
  preferredVocabularyMode?: VocabularyMode,
  now = Date.now(),
  existingEvents: LearningTelemetryEvent[] = [],
): PlacementCalibrationState {
  const createdAt = Math.max(1, Math.round(now));
  const tracks: Partial<Record<PlacementCalibrationTrackKey, PlacementCalibrationTrack>> = {};
  const trackOrder: PlacementCalibrationTrackKey[] = [];
  for (const strand of mathStrandsForLearner(learner)) {
    const track = makeMathTrack(strand, learner);
    const history = historyResultForTrack(track, learner.kidId, existingEvents, createdAt);
    if (history) track.result = history;
    tracks[track.key] = track;
    trackOrder.push(track.key);
  }
  const languageTrack = makeLanguageTrack(learner, preferredVocabularyMode);
  const languageHistory = historyResultForTrack(languageTrack, learner.kidId, existingEvents, createdAt);
  if (languageHistory) languageTrack.result = languageHistory;
  tracks.language = languageTrack;
  trackOrder.push("language");

  const id = `placement:${learner.kidId}:${createdAt}`;
  const state: PlacementCalibrationState = {
    version: 3,
    id,
    learnerId: learner.kidId,
    status: "in_progress",
    createdAt,
    updatedAt: createdAt,
    ...(preferredVocabularyMode ? { preferredVocabularyMode } : {}),
    trackOrder,
    currentTrackIndex: 0,
    tracks,
    steps: [],
    activeStepIndex: 0,
  };
  const first = firstUnresolvedTrackIndex(state);
  if (first >= trackOrder.length) {
    state.status = "complete";
    state.currentTrackIndex = trackOrder.length;
    state.completedAt = createdAt;
    return state;
  }
  appendAnchorStepForTrack(state, first);
  return state;
}

function isMatchingAttempt(event: LearningTelemetryEvent, state: PlacementCalibrationState, step: PlacementCalibrationStep): boolean {
  return event.type === "attempt"
    && event.learnerId === state.learnerId
    && event.domain === step.domain
    && event.skill === step.skill;
}

function finalizeTrack(state: PlacementCalibrationState, track: PlacementCalibrationTrack, recommendedIndex: number, now: number): void {
  track.result = resultFor(track, clamp(recommendedIndex, 0, track.ladder.length - 1), now, "quick_check");
  const nextTrackIndex = firstUnresolvedTrackIndex(state, state.currentTrackIndex + 1);
  if (nextTrackIndex >= state.trackOrder.length) {
    state.status = "complete";
    state.completedAt = now;
    state.currentTrackIndex = state.trackOrder.length;
    state.activeStepIndex = state.steps.length;
    return;
  }
  appendAnchorStepForTrack(state, nextTrackIndex);
}

function completeCurrentStep(state: PlacementCalibrationState, step: PlacementCalibrationStep, attempts: LearningTelemetryEvent[], now: number): void {
  const attemptEvents = attempts.filter((event) => event.type === "attempt");
  const correctAttempts = attemptEvents.filter((event) => event.type === "attempt" && event.correct).length;
  step.progressAttempts = step.targetAttempts;
  step.correctAttempts = Math.min(step.targetAttempts, correctAttempts);
  step.completedAt = Math.max(step.startedAt ?? now, now);

  const track = state.tracks[step.trackKey];
  if (!track) return;
  const stepIndex = track.ladder.indexOf(step.skill);
  track.samples.push({ skill: step.skill, attempts: step.targetAttempts, correctAttempts: step.correctAttempts });
  const passed = step.correctAttempts === step.targetAttempts;

  if (step.probe === "anchor") {
    if (step.correctAttempts > 0 && step.correctAttempts < step.targetAttempts) {
      finalizeTrack(state, track, stepIndex, now);
      return;
    }
    track.direction = passed ? "up" : "down";
    const nextIndex = stepIndex + (passed ? 1 : -1);
    if (nextIndex >= 0 && nextIndex < track.ladder.length) {
      const nextSkill = track.ladder[nextIndex]!;
      state.steps.push(makeStep(state.id, state.steps.length, track, nextSkill, "confirmation"));
      state.activeStepIndex = state.steps.length - 1;
      return;
    }
    finalizeTrack(state, track, stepIndex, now);
    return;
  }

  const first = track.samples[0]!;
  const firstIndex = track.ladder.indexOf(first.skill);
  if (track.direction === "up") {
    finalizeTrack(state, track, passed ? stepIndex : firstIndex, now);
  } else {
    // If the anchor was not secure, the easier confirmation becomes the
    // provisional start even when that single confirmation item is missed.
    finalizeTrack(state, track, stepIndex, now);
  }
}

export function refreshPlacementCalibration(
  state: PlacementCalibrationState,
  events: LearningTelemetryEvent[],
  now = Date.now(),
): PlacementCalibrationState {
  const next = cloneState(state);
  if (next.status !== "in_progress") return next;
  const step = next.steps[next.activeStepIndex];
  if (!step || !step.startedAt) return next;
  const matches = events
    .filter((event) => event.at >= step.startedAt! && isMatchingAttempt(event, next, step))
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
    .slice(0, step.targetAttempts);
  step.progressAttempts = matches.length;
  step.correctAttempts = matches.filter((event) => event.type === "attempt" && event.correct).length;
  if (matches.length >= step.targetAttempts) completeCurrentStep(next, step, matches, Math.round(now));
  next.updatedAt = Math.round(now);
  return next;
}

export function startPlacementCalibrationStep(state: PlacementCalibrationState, now = Date.now()): PlacementCalibrationState {
  if (state.status !== "in_progress") return cloneState(state);
  const next = cloneState(state);
  const step = next.steps[next.activeStepIndex];
  if (step && !step.startedAt) step.startedAt = Math.round(now);
  next.updatedAt = Math.round(now);
  return next;
}

export function currentPlacementCalibrationStep(state: PlacementCalibrationState): PlacementCalibrationStep | null {
  if (state.status !== "in_progress") return null;
  return state.steps[state.activeStepIndex] ?? null;
}

export function skipPlacementCalibration(state: PlacementCalibrationState, now = Date.now()): PlacementCalibrationState {
  const next = cloneState(state);
  const at = Math.round(now);
  next.status = "skipped";
  next.skippedAt = at;
  next.updatedAt = at;
  return next;
}

function trackAttemptCounts(
  learnerId: string,
  events: LearningTelemetryEvent[],
): { math: number; language: number; strands: Record<MathPlacementStrand, number> } {
  const strands: Record<MathPlacementStrand, number> = {
    number_sense: 0,
    number_bonds: 0,
    number_operations: 0,
    multiplication: 0,
  };
  let math = 0;
  let language = 0;
  for (const event of events) {
    if (event.type !== "attempt" || event.learnerId !== learnerId || event.hintsUsed !== 0) continue;
    if (event.domain === "language") {
      language += 1;
      continue;
    }
    if (event.domain !== "math") continue;
    math += 1;
    const definition = getCurriculumSkill(event.skill);
    const strand = definition?.strand as MathPlacementStrand | undefined;
    if (strand && strand in strands) strands[strand] += 1;
  }
  return { math, language, strands };
}

export function placementEvidenceSnapshot(
  learner: LearnerProfile,
  events: LearningTelemetryEvent[],
  preferredVocabularyMode?: VocabularyMode,
): PlacementEvidenceSnapshot {
  const counts = trackAttemptCounts(learner.kidId, events);
  const requiredMathStrands = mathStrandsForLearner(learner);
  const resolvedMathStrands = requiredMathStrands.filter((strand) => {
    const track = makeMathTrack(strand, learner);
    return historyResultForTrack(track, learner.kidId, events, Date.now()) != null;
  });
  const language = makeLanguageTrack(learner, preferredVocabularyMode);
  const languageResolved = historyResultForTrack(language, learner.kidId, events, Date.now()) != null;
  const requiredTrackCount = requiredMathStrands.length + 1;
  const resolvedTrackCount = resolvedMathStrands.length + (languageResolved ? 1 : 0);
  return {
    mathIndependentAttempts: counts.math,
    languageIndependentAttempts: counts.language,
    mathStrands: counts.strands,
    requiredMathStrands: [...requiredMathStrands],
    resolvedMathStrands,
    requiredTrackCount,
    resolvedTrackCount,
    enoughExistingEvidence: resolvedTrackCount >= requiredTrackCount,
  };
}

export function shouldRecommendPlacement(
  learner: LearnerProfile,
  events: LearningTelemetryEvent[],
  preferredVocabularyMode?: VocabularyMode,
): boolean {
  return !placementEvidenceSnapshot(learner, events, preferredVocabularyMode).enoughExistingEvidence;
}

export function placementResults(
  state: PlacementCalibrationState | null | undefined,
  domain?: PlacementCalibrationDomain,
): PlacementCalibrationResult[] {
  if (!state || state.status !== "complete") return [];
  const out: PlacementCalibrationResult[] = [];
  for (const key of state.trackOrder) {
    const result = state.tracks[key]?.result;
    if (!result || (domain && result.domain !== domain)) continue;
    out.push(cloneResult(result));
  }
  return out;
}

export function placementResult(
  state: PlacementCalibrationState | null | undefined,
  domain: PlacementCalibrationDomain,
): PlacementCalibrationResult | null {
  const results = placementResults(state, domain);
  if (domain === "language") return results[0] ?? null;
  return results.find((result) => result.strand === "number_operations") ?? results[0] ?? null;
}

export function placementResultForSkill(
  state: PlacementCalibrationState | null | undefined,
  skill: CurriculumSkillId,
): PlacementCalibrationResult | null {
  if (!state || state.status !== "complete") return null;
  const definition = getCurriculumSkill(skill);
  if (!definition) return null;
  if (definition.domain === "language") return placementResult(state, "language");
  const strand = definition.strand as MathPlacementStrand;
  const key = mathTrackKey(strand);
  return state.tracks[key]?.result ? cloneResult(state.tracks[key]!.result!) : null;
}
