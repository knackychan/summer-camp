import type { LearnerProfile, LearningDomain, VocabularyMode } from "../types.js";
import type { LearningTelemetryEvent, LearningTelemetrySummary } from "../telemetry/LearningTelemetry.js";
import { deriveMasteryReview, masteryReviewNeed, type MasteryReviewState } from "../mastery/MasteryReviewScheduler.js";
import {
  curriculumSkillForVocabularyMode,
  curriculumSkillsForLearner,
  getCurriculumSkill,
  vocabularyModeForCurriculumSkill,
  type CurriculumSkillDefinition,
  type CurriculumSkillId,
  type CurriculumSkillReadiness,
} from "../curriculum/SkillCatalog.js";
import { legacyLanguageSkillForGranular } from "../curriculum/LanguageSkillRules.js";
import {
  placementResult,
  placementResultForSkill,
  placementResults,
  type PlacementCalibrationState,
  type PlacementCalibrationResult,
} from "../placement/PlacementCalibration.js";

export type LearningDirectorDomain = Extract<LearningDomain, "math" | "language" | "science" | "geography" | "history">;
export type LearningMasteryBand = "new" | "needs_practice" | "building" | "steady" | "strong";
export type LearningDirectorStepKind = "warm_up" | "review" | "teach" | "focus" | "reinforce" | "confidence";
export type LearningPlacementRelation = "below" | "start" | "above";

export interface LearningDirectorSkillState {
  domain: LearningDirectorDomain;
  skill: CurriculumSkillId;
  label: string;
  labelZh: string;
  shortLabel: string;
  shortLabelZh: string;
  icon: string;
  band: LearningMasteryBand;
  readiness: CurriculumSkillReadiness;
  prerequisites: CurriculumSkillId[];
  attempts: number;
  independentCorrectRate: number | null;
  trend: LearningTelemetrySummary["independenceTrend"];
  latestAdaptation: LearningTelemetrySummary["latestAdaptation"];
  interventionCount: number;
  practiceNeed: number;
  mastery: MasteryReviewState;
  lastIndependentAt: number | null;
  reviewDueAt: number | null;
  reviewIntervalDays: number | null;
  reviewOverdueDays: number;
  placementRelation?: LearningPlacementRelation;
}

export interface LearningDirectorLaunch {
  gameId: "calc" | "vocab" | "science" | "geography" | "history";
  vocabularyMode?: VocabularyMode;
  mathSkill?: CurriculumSkillId;
  lessonId?: string;
  knowledgeMode?: "explore" | "check";
  /** Backward-compatible alias for persisted v9 Science plans. */
  scienceMode?: "explore" | "check";
  forceStudy?: boolean;
  targetAttempts: number;
}

export interface LearningDirectorStep {
  id: string;
  kind: LearningDirectorStepKind;
  domain: LearningDirectorDomain;
  skill: CurriculumSkillId;
  title: string;
  titleZh: string;
  note: string;
  noteZh: string;
  targetAttempts: number;
  launch?: LearningDirectorLaunch;
  startedAt?: number;
  completedAt?: number;
  progressAttempts: number;
  /** Activity-run identity; only this run can contribute guided progress. */
  runId?: string;
  acceptedAttemptIds?: string[];
}

export interface LearningDirectorCoordination {
  version: 1;
  status: "ready" | "running" | "paused" | "finished";
  revision: number;
  declinedSkills: string[];
  finishReason?: "child_choice" | "no_candidates";
  finishedAt?: number;
}


export interface LearningDirectorPlan {
  version: 11;
  /** Additive v0.5.4 coordination; existing v11 progress is retained. */
  coordination?: LearningDirectorCoordination;
  id: string;
  learnerId: string;
  day: string;
  createdAt: number;
  updatedAt: number;
  focusDomain: LearningDirectorDomain;
  focusSkill: CurriculumSkillId;
  vocabularyMode: VocabularyMode;
  skills: LearningDirectorSkillState[];
  steps: LearningDirectorStep[];
  activeStepIndex: number;
  placementId?: string;
  placementUpdatedAt?: number;
  scheduledReviewSkill?: CurriculumSkillId;
  reviewDueCount: number;
  completedAt?: number;
}

export interface BuildLearningDirectorPlanInput {
  learner: LearnerProfile;
  summaries: LearningTelemetrySummary[];
  day: string;
  preferredVocabularyMode?: VocabularyMode;
  placement?: PlacementCalibrationState | null;
  now?: number;
}

const VOCABULARY_MODES = new Set<VocabularyMode>(["copy", "recall", "translate", "sentences", "bopomofo"]);
const VOCABULARY_ORDER: VocabularyMode[] = ["copy", "recall", "translate", "sentences"];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function defaultVocabularyMode(learner: LearnerProfile): VocabularyMode {
  if (learner.readingLevel === "pre_reader") return "copy";
  if (learner.readingLevel === "early_reader") return "recall";
  return "translate";
}

function normalizeVocabularyMode(learner: LearnerProfile, preferred?: VocabularyMode): VocabularyMode {
  if (preferred && VOCABULARY_MODES.has(preferred)) {
    if (learner.readingLevel === "pre_reader" && preferred !== "copy" && preferred !== "bopomofo") return "copy";
    if (learner.readingLevel === "early_reader" && (preferred === "translate" || preferred === "sentences")) return "recall";
    return preferred;
  }
  return defaultVocabularyMode(learner);
}

function effectiveVocabularyMode(
  learner: LearnerProfile,
  preferred: VocabularyMode | undefined,
  placement: PlacementCalibrationState | null | undefined,
): VocabularyMode {
  const normal = normalizeVocabularyMode(learner, preferred);
  const placedSkill = placementResult(placement, "language")?.recommendedSkill;
  const placed = placedSkill ? vocabularyModeForCurriculumSkill(placedSkill) : null;
  if (!placed) return normal;
  if (placed === "bopomofo") return "bopomofo";
  if (normal === "bopomofo") return normal;
  const normalIndex = VOCABULARY_ORDER.indexOf(normal);
  const placedIndex = VOCABULARY_ORDER.indexOf(placed);
  return placedIndex > normalIndex ? placed : normal;
}

function summaryFor(
  summaries: LearningTelemetrySummary[],
  learnerId: string,
  domain: LearningDirectorDomain,
  skill: CurriculumSkillId,
): LearningTelemetrySummary | undefined {
  const exact = summaries.find((summary) => summary.learnerId === learnerId && summary.domain === domain && summary.skill === skill);
  if (exact || domain !== "language") return exact;
  // v0.4.7 introduces granular language skills. A bounded alias lets existing
  // v0.4.6 telemetry seed the closest base skill without pretending coarse
  // history proves newer subskills such as spelling patterns or question frames.
  const legacySkill = legacyLanguageSkillForGranular(skill);
  if (!legacySkill) return undefined;
  return summaries.find((summary) => summary.learnerId === learnerId && summary.domain === domain && summary.skill === legacySkill);
}

function masteryBand(summary: LearningTelemetrySummary | undefined): LearningMasteryBand {
  if (!summary || summary.attempts === 0) return "new";
  const rate = summary.independentCorrectRate;
  if (summary.latestAdaptation === "level_down" || summary.independenceTrend === "declining" || (rate != null && rate < 0.5)) return "needs_practice";
  if (summary.attempts < 5 || rate == null || rate < 0.72 || summary.latestAdaptation === "support") return "building";
  if (rate >= 0.9 && summary.attempts >= 8) return "strong";
  return "steady";
}

function needFor(summary: LearningTelemetrySummary | undefined, introductionNeed: number): number {
  if (!summary || summary.attempts === 0) return clamp01(introductionNeed);
  const rate = summary.independentCorrectRate ?? 0.5;
  let need = 1 - rate;
  if (summary.attempts < 4) need += 0.12;
  if (summary.independenceTrend === "declining") need += 0.2;
  if (summary.latestAdaptation === "support") need += 0.12;
  if (summary.latestAdaptation === "level_down") need += 0.2;
  if (summary.interventionCount > Math.max(1, summary.attempts / 3)) need += 0.08;
  if (summary.independenceTrend === "improving") need -= 0.08;
  return clamp01(need);
}

function prerequisiteMastered(id: CurriculumSkillId, learner: LearnerProfile, summaries: LearningTelemetrySummary[]): boolean {
  const definition = getCurriculumSkill(id);
  if (!definition) return true;
  const summary = summaryFor(summaries, learner.kidId, definition.domain, id);
  const band = masteryBand(summary);
  return band === "steady" || band === "strong";
}

function placementForSkill(
  placement: PlacementCalibrationState | null | undefined,
  domain: LearningDirectorDomain,
  skill: CurriculumSkillId,
): { result: PlacementCalibrationResult; relation: LearningPlacementRelation } | null {
  const result = placementResultForSkill(placement, skill);
  if (!result || result.domain !== domain) return null;
  const index = result.ladder.indexOf(skill);
  if (index < 0) return null;
  const relation: LearningPlacementRelation = index < result.recommendedIndex ? "below" : index === result.recommendedIndex ? "start" : "above";
  return { result, relation };
}

function readinessFor(
  definition: CurriculumSkillDefinition,
  learner: LearnerProfile,
  summaries: LearningTelemetrySummary[],
  placement?: PlacementCalibrationState | null,
): CurriculumSkillReadiness {
  const placed = placementForSkill(placement, definition.domain, definition.id);
  if (placed?.relation === "start" || placed?.relation === "below") return "ready";
  if (placed?.relation === "above") {
    const own = masteryBand(summaryFor(summaries, learner.kidId, definition.domain, definition.id));
    if (own === "steady" || own === "strong") return "ready";
    const recommended = masteryBand(summaryFor(summaries, learner.kidId, definition.domain, placed.result.recommendedSkill));
    if (recommended !== "steady" && recommended !== "strong") return "locked";
  }
  if (!definition.prerequisites.length) return "ready";
  if (definition.prerequisiteBypassAge != null && learner.age >= definition.prerequisiteBypassAge) return "ready";
  return definition.prerequisites.every((id) => prerequisiteMastered(id, learner, summaries)) ? "ready" : "locked";
}

function skillState(
  definition: CurriculumSkillDefinition,
  learner: LearnerProfile,
  summaries: LearningTelemetrySummary[],
  placement: PlacementCalibrationState | null | undefined,
  now: number,
): LearningDirectorSkillState {
  const summary = summaryFor(summaries, learner.kidId, definition.domain, definition.id);
  const band = masteryBand(summary);
  const mastery = deriveMasteryReview(summary, now);
  let practiceNeed = Math.max(needFor(summary, definition.introductionNeed), masteryReviewNeed(mastery));
  const placed = placementForSkill(placement, definition.domain, definition.id);
  if (placed && (summary?.attempts ?? 0) < 4) {
    if (placed.relation === "start") practiceNeed = Math.max(practiceNeed, 0.92);
    if (placed.relation === "below" && band !== "needs_practice") practiceNeed = Math.min(practiceNeed, 0.28);
  }
  return {
    domain: definition.domain,
    skill: definition.id,
    label: definition.label,
    labelZh: definition.labelZh,
    shortLabel: definition.shortLabel,
    shortLabelZh: definition.shortLabelZh,
    icon: definition.icon,
    band,
    readiness: readinessFor(definition, learner, summaries, placement),
    prerequisites: [...definition.prerequisites],
    attempts: summary?.attempts ?? 0,
    independentCorrectRate: summary?.independentCorrectRate ?? null,
    trend: summary?.independenceTrend ?? "insufficient",
    latestAdaptation: summary?.latestAdaptation ?? null,
    interventionCount: summary?.interventionCount ?? 0,
    practiceNeed,
    mastery: mastery.state,
    lastIndependentAt: mastery.lastIndependentAt,
    reviewDueAt: mastery.reviewDueAt,
    reviewIntervalDays: mastery.reviewIntervalDays,
    reviewOverdueDays: mastery.overdueDays,
    ...(placed ? { placementRelation: placed.relation } : {}),
  };
}

function stepCopy(kind: LearningDirectorStepKind, state: LearningDirectorSkillState): Pick<LearningDirectorStep, "title" | "titleZh" | "note" | "noteZh"> {
  if (kind === "warm_up") return {
    title: `Warm up · ${state.shortLabel}`,
    titleZh: `熱身 · ${state.shortLabelZh}`,
    note: `Start with ${state.label.toLowerCase()}.`,
    noteZh: `先用「${state.labelZh}」熱身。`,
  };
  if (kind === "review") return {
    title: `Review · ${state.shortLabel}`,
    titleZh: `複習 · ${state.shortLabelZh}`,
    note: `A skill you knew before is ready for a short memory check.`,
    noteZh: `以前學會的「${state.labelZh}」到了短暫複習的時間。`,
  };
  if (kind === "teach") return {
    title: `Learn it · ${state.shortLabel}`,
    titleZh: `先學會 · ${state.shortLabelZh}`,
    note: `A short visual explanation comes before the next practice questions.`,
    noteZh: `下一輪練習前，先看一個很短的圖像說明。`,
  };
  if (kind === "focus") return {
    title: state.mastery === "review_due" ? `Review focus · ${state.shortLabel}` : `Focus · ${state.shortLabel}`,
    titleZh: state.mastery === "review_due" ? `複習重點 · ${state.shortLabelZh}` : `重點 · ${state.shortLabelZh}`,
    note: state.mastery === "review_due"
      ? "This secure skill is due for spaced review today."
      : state.domain === "science"
      ? "Explore one short model, then answer two locally graded science questions."
      : state.domain === "geography"
      ? "Explore one short map model, then answer two locally graded geography questions."
      : state.domain === "history"
      ? "Explore one short time or evidence model, then answer two locally graded history questions."
      : state.placementRelation === "start"
      ? "The quick check marked this as a good starting skill for this strand."
      : "This specific skill needs the most useful practice today.",
    noteZh: state.mastery === "review_due"
      ? `「${state.labelZh}」今天到了間隔複習時間。`
      : state.domain === "science"
      ? `先探索一個短短的圖像模型，再回答兩個由本機判分的科學問題。`
      : state.domain === "geography"
      ? `先探索一個短短的地圖模型，再回答兩個由本機判分的地理問題。`
      : state.domain === "history"
      ? `先探索一個短短的時間或史料模型，再回答兩個由本機判分的歷史問題。`
      : state.placementRelation === "start"
      ? `快速小測建議這個學習分支先從「${state.labelZh}」開始。`
      : `今天最值得練的是「${state.labelZh}」。`,
  };
  if (kind === "reinforce") return {
    title: `Again · ${state.shortLabel}`,
    titleZh: `再練 · ${state.shortLabelZh}`,
    note: `Try the same skill once more; the tutor can step in if needed.`,
    noteZh: `再練一次「${state.labelZh}」，需要時導師會幫忙。`,
  };
  return {
    title: `Finish · ${state.shortLabel}`,
    titleZh: `收尾 · ${state.shortLabelZh}`,
    note: `Finish with a skill that should feel manageable.`,
    noteZh: `用比較有把握的「${state.labelZh}」收尾。`,
  };
}

function launchFor(
  state: LearningDirectorSkillState,
  targetAttempts: number,
  kind: LearningDirectorStepKind,
): LearningDirectorLaunch {
  const definition = getCurriculumSkill(state.skill);
  if (!definition) {
    if (state.domain === "math") return { gameId: "calc", targetAttempts };
    if (state.domain === "science") return { gameId: "science", targetAttempts };
    if (state.domain === "geography") return { gameId: "geography", targetAttempts };
    if (state.domain === "history") return { gameId: "history", targetAttempts };
    return { gameId: "vocab", targetAttempts };
  }
  if (definition.launch.gameId === "calc") {
    return { gameId: "calc", mathSkill: definition.id, targetAttempts };
  }
  if (definition.launch.gameId === "science" || definition.launch.gameId === "geography" || definition.launch.gameId === "history") {
    const knowledgeMode = kind === "review" || state.mastery === "review_due" || state.mastery === "secure" ? "check" : "explore";
    return {
      gameId: definition.launch.gameId,
      lessonId: definition.launch.lessonId,
      knowledgeMode,
      ...(definition.launch.gameId === "science" ? { scienceMode: knowledgeMode } : {}),
      targetAttempts,
    };
  }
  return { gameId: "vocab", vocabularyMode: definition.launch.vocabularyMode, forceStudy: true, targetAttempts };
}

function stepFor(
  planId: string,
  index: number,
  kind: LearningDirectorStepKind,
  state: LearningDirectorSkillState,
  targetAttempts: number,
): LearningDirectorStep {
  return {
    id: `${planId}:step-${index + 1}`,
    kind,
    domain: state.domain,
    skill: state.skill,
    ...stepCopy(kind, state),
    targetAttempts,
    launch: launchFor(state, targetAttempts, kind),
    progressAttempts: 0,
  };
}

function teachStepFor(planId: string, index: number, state: LearningDirectorSkillState): LearningDirectorStep {
  return {
    id: `${planId}:step-${index + 1}`,
    kind: "teach",
    domain: state.domain,
    skill: state.skill,
    ...stepCopy("teach", state),
    targetAttempts: 0,
    progressAttempts: 0,
  };
}

function shouldTeachDomain(state: LearningDirectorSkillState): boolean {
  if ((state.domain !== "math" && state.domain !== "language") || state.attempts < 3 || state.readiness !== "ready") return false;
  if (state.mastery === "review_due" || state.mastery === "secure") return false;
  if (state.band === "needs_practice") return true;
  if (state.latestAdaptation === "level_down") return true;
  // Copy practice does not emit adaptation signals, so repeated independent errors
  // are intentionally enough to trigger a deterministic language teaching scene.
  if (state.domain === "language" && (state.skill === "language.initial_sound" || state.skill === "language.word_build.simple")) {
    return state.attempts >= 4 && (state.independentCorrectRate ?? 1) < 0.65;
  }
  return state.latestAdaptation === "support" && state.interventionCount >= 2;
}

function stableNeedSort(a: LearningDirectorSkillState, b: LearningDirectorSkillState, seed: string, descending: boolean): number {
  const delta = descending ? b.practiceNeed - a.practiceNeed : a.practiceNeed - b.practiceNeed;
  if (Math.abs(delta) > 0.000001) return delta;
  const ah = stableHash(`${seed}\u0000${a.skill}`);
  const bh = stableHash(`${seed}\u0000${b.skill}`);
  return ah - bh || a.skill.localeCompare(b.skill);
}

function pickWarm(ready: LearningDirectorSkillState[], focus: LearningDirectorSkillState, seed: string): LearningDirectorSkillState {
  const otherDomain = ready.filter((state) => state.domain !== focus.domain);
  const pool = otherDomain.length ? otherDomain : ready.filter((state) => state.skill !== focus.skill);
  const practiced = pool.filter((state) => state.attempts > 0);
  const source = practiced.length ? practiced : (pool.length ? pool : [focus]);
  return [...source].sort((a, b) => stableNeedSort(a, b, `${seed}:warm`, false))[0] ?? focus;
}

function pickDueReview(ready: LearningDirectorSkillState[], focus: LearningDirectorSkillState, seed: string): LearningDirectorSkillState | null {
  const due = ready.filter((state) => state.mastery === "review_due" && state.skill !== focus.skill);
  if (!due.length) return null;
  return [...due].sort((a, b) => {
    const overdue = b.reviewOverdueDays - a.reviewOverdueDays;
    if (overdue) return overdue;
    const ah = stableHash(`${seed}\u0000review\u0000${a.skill}`);
    const bh = stableHash(`${seed}\u0000review\u0000${b.skill}`);
    return ah - bh || a.skill.localeCompare(b.skill);
  })[0] ?? null;
}

function pickConfidence(ready: LearningDirectorSkillState[], focus: LearningDirectorSkillState, warm: LearningDirectorSkillState, seed: string): LearningDirectorSkillState {
  const practiced = ready.filter((state) => state.attempts > 0 && state.skill !== focus.skill);
  if (!practiced.length) return warm;
  return [...practiced].sort((a, b) => stableNeedSort(a, b, `${seed}:confidence`, false))[0] ?? warm;
}

function withPlacementDefinitions(
  definitions: CurriculumSkillDefinition[],
  placement?: PlacementCalibrationState | null,
): CurriculumSkillDefinition[] {
  const out = [...definitions];
  if (!placement || placement.status !== "complete") return out;
  const results = [...placementResults(placement, "math"), ...placementResults(placement, "language")];
  for (const result of results) {
    const id = result.recommendedSkill;
    if (out.some((definition) => definition.id === id)) continue;
    const definition = getCurriculumSkill(id);
    if (definition) out.push(definition);
  }
  return out;
}

/**
 * Builds a short, deterministic practice session from the curriculum skill map,
 * optional quick-placement estimate, and local evidence. The director does not
 * grade, call an LLM, or change learner levels. It only selects explicit skills
 * and launches existing games with constraints that make the activity actually
 * practise those skills.
 */
export function buildLearningDirectorPlan(input: BuildLearningDirectorPlanInput): LearningDirectorPlan {
  const now = Math.max(1, Math.round(input.now ?? Date.now()));
  const vocabularyMode = effectiveVocabularyMode(input.learner, input.preferredVocabularyMode, input.placement);
  const definitions = withPlacementDefinitions(curriculumSkillsForLearner(input.learner, vocabularyMode), input.placement);
  const skills = definitions.map((definition) => skillState(definition, input.learner, input.summaries, input.placement, now));
  const ready = skills.filter((state) => state.readiness === "ready");
  const usable = ready.length ? ready : skills;
  if (!usable.length) {
    const fallbackId = curriculumSkillForVocabularyMode(vocabularyMode);
    const fallbackDefinition = getCurriculumSkill(fallbackId);
    if (!fallbackDefinition) throw new Error("No curriculum skill is available for this learner");
    usable.push(skillState(fallbackDefinition, input.learner, input.summaries, input.placement, now));
  }
  const seed = `${input.learner.kidId}\u0000${input.day}`;
  const focus = [...usable].sort((a, b) => stableNeedSort(a, b, `${seed}:focus`, true))[0]!;
  const dueReview = pickDueReview(usable, focus, seed);
  const warm = dueReview ?? pickWarm(usable, focus, seed);
  const finish = pickConfidence(usable, focus, warm, seed);
  const planId = `learning-director:${input.learner.kidId}:${input.day}:${now}`;
  const teachFirst = shouldTeachDomain(focus);
  const steps = focus.domain === "science" || focus.domain === "geography" || focus.domain === "history"
    ? [
        stepFor(planId, 0, dueReview ? "review" : "warm_up", warm, 2),
        stepFor(planId, 1, "focus", focus, 2),
        stepFor(planId, 2, "confidence", finish, 2),
      ]
    : teachFirst
    ? [
        stepFor(planId, 0, dueReview ? "review" : "warm_up", warm, 2),
        teachStepFor(planId, 1, focus),
        stepFor(planId, 2, "focus", focus, 2),
        stepFor(planId, 3, "confidence", finish, 2),
      ]
    : [
        stepFor(planId, 0, dueReview ? "review" : "warm_up", warm, 2),
        stepFor(planId, 1, "focus", focus, 2),
        stepFor(planId, 2, "reinforce", focus, 2),
        stepFor(planId, 3, "confidence", finish, 2),
      ];
  const placement = input.placement?.status === "complete" ? input.placement : null;
  return {
    version: 11,
    id: planId,
    learnerId: input.learner.kidId,
    day: input.day,
    createdAt: now,
    updatedAt: now,
    focusDomain: focus.domain,
    focusSkill: focus.skill,
    vocabularyMode,
    skills,
    steps,
    activeStepIndex: 0,
    reviewDueCount: usable.filter((state) => state.mastery === "review_due").length,
    ...(dueReview ? { scheduledReviewSkill: dueReview.skill } : {}),
    ...(placement ? { placementId: placement.id, placementUpdatedAt: placement.updatedAt } : {}),
  };
}

function isMatchingAttempt(event: LearningTelemetryEvent, plan: LearningDirectorPlan, step: LearningDirectorStep): boolean {
  return event.type === "attempt" && event.learnerId === plan.learnerId && event.domain === step.domain && event.skill === step.skill;
}

export function refreshLearningDirectorPlan(plan: LearningDirectorPlan, events: LearningTelemetryEvent[], now = Date.now()): LearningDirectorPlan {
  const next: LearningDirectorPlan = {
    ...plan,
    skills: plan.skills.map((skill) => ({ ...skill, prerequisites: [...skill.prerequisites] })),
    steps: plan.steps.map((step) => ({ ...step, ...(step.launch ? { launch: { ...step.launch } } : {}) })),
  };
  if (next.completedAt || next.coordination?.status === "finished") return next;
  const step = next.steps[next.activeStepIndex];
  if (!step || !step.startedAt) return next;
  if (step.kind === "teach") return next;
  if (next.coordination && (next.coordination.status !== "running" || !step.runId)) return next;
  const accepted = new Set(step.acceptedAttemptIds ?? []);
  const matching = events.filter((event) => event.at >= step.startedAt! && isMatchingAttempt(event, next, step));
  if (next.coordination) {
    for (const event of matching) {
      if (event.sessionId === step.runId && accepted.size < step.targetAttempts) accepted.add(event.id);
    }
    step.acceptedAttemptIds = [...accepted];
  }
  // A migrated partial v11 step keeps its committed count without relabelling
  // old unbound telemetry. New progress requires run-bound evidence.
  const count = next.coordination
    ? Math.max(step.progressAttempts, accepted.size)
    : new Set(matching.map((event) => event.id)).size;
  step.progressAttempts = Math.min(step.targetAttempts, count);
  if (count >= step.targetAttempts) {
    step.completedAt = Math.max(step.startedAt, Math.round(now));
    step.progressAttempts = step.targetAttempts;
    next.activeStepIndex += 1;
    if (next.coordination) next.coordination = { ...next.coordination, status: "ready", revision: next.coordination.revision + 1, declinedSkills: [] };
    if (next.activeStepIndex >= next.steps.length) next.completedAt = Math.round(now);
  }
  next.updatedAt = Math.round(now);
  return next;
}

export function startLearningDirectorStep(plan: LearningDirectorPlan, now = Date.now()): LearningDirectorPlan {
  if (plan.completedAt) return plan;
  const next: LearningDirectorPlan = {
    ...plan,
    skills: plan.skills.map((skill) => ({ ...skill, prerequisites: [...skill.prerequisites] })),
    steps: plan.steps.map((step) => ({ ...step, ...(step.launch ? { launch: { ...step.launch } } : {}) })),
  };
  const step = next.steps[next.activeStepIndex];
  if (step && !step.startedAt) step.startedAt = Math.round(now);
  next.updatedAt = Math.round(now);
  return next;
}

export function completeLearningDirectorStep(plan: LearningDirectorPlan, now = Date.now()): LearningDirectorPlan {
  if (plan.completedAt) return plan;
  const next: LearningDirectorPlan = {
    ...plan,
    skills: plan.skills.map((skill) => ({ ...skill, prerequisites: [...skill.prerequisites] })),
    steps: plan.steps.map((step) => ({ ...step, ...(step.launch ? { launch: { ...step.launch } } : {}) })),
  };
  const step = next.steps[next.activeStepIndex];
  if (!step || step.kind !== "teach" || !step.startedAt) return next;
  step.completedAt = Math.max(step.startedAt, Math.round(now));
  next.activeStepIndex += 1;
  if (next.activeStepIndex >= next.steps.length) next.completedAt = Math.round(now);
  next.updatedAt = Math.round(now);
  return next;
}

export function currentLearningDirectorStep(plan: LearningDirectorPlan): LearningDirectorStep | null {
  if (plan.completedAt || plan.coordination?.status === "finished") return null;
  return plan.steps[plan.activeStepIndex] ?? null;
}

/** Re-evaluate ONE unstarted step from a freshly built Director plan.
 * No second scheduler, AI ranking, grading, or learner state is introduced. */
export function recommendLearningDirectorStep(
  plan: LearningDirectorPlan,
  fresh: LearningDirectorPlan,
  options: { availableGameIds?: LearningDirectorLaunch["gameId"][]; excludeSkills?: string[]; alternative?: boolean } = {},
): LearningDirectorStep | null {
  const slot = plan.steps[plan.activeStepIndex];
  if (!slot) return null;
  const completedKnowledge = new Set(plan.steps.filter((step) => step.completedAt &&
    (step.domain === "science" || step.domain === "geography" || step.domain === "history")).map((step) => step.skill));
  const ready = fresh.skills.filter((state) => {
    if (state.readiness !== "ready" || options.excludeSkills?.includes(state.skill) || completedKnowledge.has(state.skill)) return false;
    const launch = launchFor(state, 2, slot.kind);
    return !options.availableGameIds || options.availableGameIds.includes(launch.gameId);
  });
  if (!ready.length) return null;
  const seed = `${plan.learnerId}\u0000${plan.day}:next:${plan.activeStepIndex}`;
  const suggested = fresh.steps.find((step) => step.kind === slot.kind) ?? fresh.steps.find((step) => step.kind === "focus");
  let state = !options.alternative && suggested ? ready.find((item) => item.skill === suggested.skill) : undefined;
  if (!state) state = [...ready].sort((a, b) => stableNeedSort(a, b, seed, slot.kind !== "confidence"))[0];
  if (!state) return null;
  // Keep an already scheduled teaching slot only when the refreshed evidence
  // still calls for it. Viewing a teaching scene never counts as an attempt.
  const kind = slot.kind === "teach" && !shouldTeachDomain(state) ? "focus" : slot.kind;
  const step = kind === "teach" ? teachStepFor(plan.id, plan.activeStepIndex, state)
    : stepFor(plan.id, plan.activeStepIndex, kind, state, 2);
  return { ...step, id: slot.id };
}
