import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/mobile");
if (!existsSync(resolve(dist, "packages/learning/src/placement/PlacementCalibration.js"))) {
  const command = process.execPath;
  const built = spawnSync(command, [resolve(root, "scripts/build-mobile.mjs")], { cwd: root, stdio: "inherit" });
  assert.equal(built.status, 0);
}

const placement = await import(pathToFileURL(resolve(dist, "packages/learning/src/placement/PlacementCalibration.js")));
const { MemoryStorageDriver } = await import(pathToFileURL(resolve(dist, "packages/storage/src/memory/MemoryStorageDriver.js")));
const { PlacementCalibrationBridge } = await import(pathToFileURL(resolve(dist, "packages/learning/src/legacy/PlacementCalibrationBridge.js")));
const { LearningTelemetryStore } = await import(pathToFileURL(resolve(dist, "packages/learning/src/telemetry/LearningTelemetry.js")));
const { buildLearningDirectorPlan } = await import(pathToFileURL(resolve(dist, "packages/learning/src/director/LearningDirector.js")));

const learner = {
  kidId: "lili",
  age: 7,
  language: "en-zh-TW",
  readingLevel: "early_reader",
  levels: { math: 1, language: 1, logic: 1 },
};

function attempt(id, at, domain, skill, correct, hintsUsed = 0) {
  return { version:1,id,type:"attempt",at,learnerId:"lili",domain,skill,sessionId:"placement-test",questionId:id,correct,responseMs:400,hintsUsed,difficulty:2 };
}

let state = placement.buildPlacementCalibration(learner, "recall", 1000);
assert.equal(state.version, 3);
assert.deepEqual(state.trackOrder, [
  "math:number_operations",
  "math:number_sense",
  "math:number_bonds",
  "math:multiplication",
  "language",
], "age 7 gets an independent Math map plus Words");
assert.equal(state.status, "in_progress");
assert.equal(placement.currentPlacementCalibrationStep(state).skill, "math.subtraction.within_20", "operations starts near the age-appropriate anchor");
assert.equal(placement.currentPlacementCalibrationStep(state).targetAttempts, 2);

state = placement.startPlacementCalibrationStep(state, 1100);
state = placement.refreshPlacementCalibration(state, [
  attempt("m1", 1200, "math", "math.subtraction.within_20", true),
  attempt("m2", 1300, "math", "math.subtraction.within_20", true),
], 1400);
assert.equal(placement.currentPlacementCalibrationStep(state).skill, "math.addition.within_100", "two clean anchor answers request one adjacent confirmation");
assert.equal(placement.currentPlacementCalibrationStep(state).targetAttempts, 1, "confirmation probes stay short");

state = placement.startPlacementCalibrationStep(state, 1500);
state = placement.refreshPlacementCalibration(state, [
  attempt("m3", 1600, "math", "math.addition.within_100", false),
], 1700);
assert.equal(state.tracks["math:number_operations"].result.recommendedSkill, "math.subtraction.within_20", "a failed harder confirmation keeps the operation start at the anchor");
assert.equal(placement.currentPlacementCalibrationStep(state).skill, "math.number_comparison.within_100", "placement moves independently to number sense");

state = placement.startPlacementCalibrationStep(state, 1800);
state = placement.refreshPlacementCalibration(state, [
  attempt("ns1", 1900, "math", "math.number_comparison.within_100", true),
  attempt("ns2", 2000, "math", "math.number_comparison.within_100", false),
], 2100);
assert.equal(state.tracks["math:number_sense"].result.recommendedSkill, "math.number_comparison.within_100", "mixed evidence finalizes the strand without another probe");
assert.equal(placement.currentPlacementCalibrationStep(state).skill, "math.number_bonds.to_20");

state = placement.startPlacementCalibrationStep(state, 2200);
state = placement.refreshPlacementCalibration(state, [
  attempt("b1", 2300, "math", "math.number_bonds.to_20", false),
  attempt("b2", 2400, "math", "math.number_bonds.to_20", false),
], 2500);
assert.equal(placement.currentPlacementCalibrationStep(state).skill, "math.number_bonds.to_10", "zero correct probes one adjacent easier skill");
assert.equal(placement.currentPlacementCalibrationStep(state).targetAttempts, 1);

state = placement.startPlacementCalibrationStep(state, 2600);
state = placement.refreshPlacementCalibration(state, [
  attempt("b3", 2700, "math", "math.number_bonds.to_10", true),
], 2800);
assert.equal(state.tracks["math:number_bonds"].result.recommendedSkill, "math.number_bonds.to_10");
assert.equal(placement.currentPlacementCalibrationStep(state).skill, "math.multiplication.tables_2_5_10", "age-eligible multiplication is calibrated separately");

state = placement.startPlacementCalibrationStep(state, 2900);
state = placement.refreshPlacementCalibration(state, [
  attempt("x1", 3000, "math", "math.multiplication.tables_2_5_10", true),
  attempt("x2", 3100, "math", "math.multiplication.tables_2_5_10", false),
], 3200);
assert.equal(state.tracks["math:multiplication"].result.recommendedSkill, "math.multiplication.tables_2_5_10");
assert.equal(placement.currentPlacementCalibrationStep(state).skill, "language.spelling_patterns.basic", "Words remain a separate final track");

state = placement.startPlacementCalibrationStep(state, 3300);
state = placement.refreshPlacementCalibration(state, [
  attempt("l1", 3400, "language", "language.spelling_patterns.basic", true),
  attempt("l2", 3500, "language", "language.spelling_patterns.basic", true),
], 3600);
assert.equal(state.status, "complete");
assert.equal(state.tracks.language.result.recommendedSkill, "language.spelling_patterns.basic");
assert.equal(state.steps.length, 7, "each strand stops after at most one adjacent confirmation");
const mathResults = placement.placementResults(state, "math");
assert.equal(mathResults.length, 4);
assert.deepEqual(mathResults.map((result) => result.strand), ["number_operations","number_sense","number_bonds","multiplication"]);
assert.ok(mathResults.every((result) => result.source === "quick_check"));
assert.equal(placement.placementResultForSkill(state, "math.number_bonds.to_20").recommendedSkill, "math.number_bonds.to_10");
assert.equal(state.tracks["math:number_operations"].result.strandLabelZh.length > 0, true, "strand results carry bilingual presentation metadata");

const sparseEvidence = placement.placementEvidenceSnapshot(learner, [attempt("x", 1, "math", "math.addition.within_20", true)], "recall");
assert.equal(sparseEvidence.enoughExistingEvidence, false);
assert.equal(sparseEvidence.requiredMathStrands.length, 4);

const richEvents = [];
for (let i = 0; i < 4; i += 1) richEvents.push(attempt(`op${i}`, 10+i, "math", "math.subtraction.within_20", true));
for (let i = 0; i < 4; i += 1) richEvents.push(attempt(`ns${i}`, 20+i, "math", "math.number_comparison.within_100", true));
for (let i = 0; i < 4; i += 1) richEvents.push(attempt(`nb${i}`, 30+i, "math", "math.number_bonds.to_20", true));
for (let i = 0; i < 4; i += 1) richEvents.push(attempt(`mu${i}`, 40+i, "math", "math.multiplication.tables_2_5_10", true));
for (let i = 0; i < 4; i += 1) richEvents.push(attempt(`la${i}`, 50+i, "language", "language.spelling_patterns.basic", true));
const richEvidence = placement.placementEvidenceSnapshot(learner, richEvents, "recall");
assert.equal(richEvidence.enoughExistingEvidence, true);
assert.equal(richEvidence.resolvedMathStrands.length, 4);
assert.equal(richEvidence.resolvedTrackCount, richEvidence.requiredTrackCount);
assert.equal(placement.shouldRecommendPlacement(learner, richEvents, "recall"), false, "real independent history can resolve every strand without another check");
const historyPlacement = placement.buildPlacementCalibration(learner, "recall", 5000, richEvents);
assert.equal(historyPlacement.status, "complete", "a re-entry can stop immediately when every required strand already has enough history");
assert.equal(historyPlacement.steps.length, 0);
assert.ok(placement.placementResults(historyPlacement).every((result) => result.source === "history"));

const legacyRecallHistory = Array.from({ length: 4 }, (_, i) => attempt(`legacy-la${i}`, 80+i, "language", "language.word_recall", true));
const legacyLanguagePlacement = placement.buildPlacementCalibration(learner, "recall", 5050, legacyRecallHistory);
assert.equal(legacyLanguagePlacement.tracks.language.result?.recommendedSkill, "language.picture_vocabulary.basic", "legacy coarse recall history migrates only to the closest granular language base skill");

const operationHistoryOnly = richEvents.filter((event) => event.skill === "math.subtraction.within_20");
const partial = placement.buildPlacementCalibration(learner, "recall", 5100, operationHistoryOnly);
assert.equal(partial.tracks["math:number_operations"].result.source, "history");
assert.equal(placement.currentPlacementCalibrationStep(partial).trackKey, "math:number_sense", "known strands are skipped while missing strands are sampled");

function summary(overrides) {
  return {
    learnerId:"lili",domain:"language",skill:"language.spelling_patterns.basic",attempts:10,correctAttempts:9,
    independentAttempts:10,independentCorrectAttempts:9,independentCorrectRate:.9,
    firstAttemptAt:100,lastAttemptAt:900,lastIndependentAttemptAt:900,consecutiveIndependentCorrect:4,
    recentIndependentCorrectRate:.9,previousIndependentCorrectRate:.9,independenceTrend:"stable",averageResponseMs:450,
    interventionCount:0,remoteHintCount:0,localHintCount:0,aiHintRate:null,remoteFallbackCount:0,retryRecoveries:0,
    retryAttempts:0,retryRecoveryRate:null,assistedCompletions:0,topMistake:null,latestAdaptation:"maintain",
    inputTokens:0,outputTokens:0,estimatedCostUsd:0,...overrides,
  };
}
const directorPlan = buildLearningDirectorPlan({
  learner,
  summaries:[summary({})],
  day:"2026-09-24",
  preferredVocabularyMode:"recall",
  placement:state,
  now:6000,
});
assert.equal(directorPlan.version, 11);
assert.equal(directorPlan.placementId, state.id);
for (const result of mathResults) {
  assert.ok(directorPlan.skills.some((skill)=>skill.skill === result.recommendedSkill && skill.placementRelation === "start" && skill.readiness === "ready"), `director should honor ${result.strand} placement start`);
}
assert.ok(directorPlan.skills.some((skill)=>skill.skill === "math.number_bonds.to_20" && skill.placementRelation === "above" && skill.readiness === "locked"));

const memory = new MemoryStorageDriver();
const telemetry = new LearningTelemetryStore(memory);
const bridge = new PlacementCalibrationBridge(memory);
const input = { kidId:"lili", age:7, language:"en-zh-TW", preferredVocabularyMode:"recall" };
const before = await bridge.snapshot(input);
assert.equal(before.recommended, true);
const started = await bridge.start(input);
assert.equal(started.state.version, 3);
assert.ok(started.currentStep?.startedAt);
for (let i = 0; i < 2; i += 1) {
  await telemetry.append(attempt(`bridge-${i}`, started.currentStep.startedAt + i + 1, started.currentStep.domain, started.currentStep.skill, true));
}
const advanced = await bridge.snapshot(input);
assert.notEqual(advanced.currentStep?.skill, started.currentStep?.skill, "bridge refresh advances from real telemetry rather than a separate placement score store");
const skipped = await bridge.skip(input);
assert.equal(skipped.state.status, "skipped");
assert.equal(skipped.recommended, false, "placement never blocks Smart Practice when the child chooses Later");
const reset = await bridge.reset(input);
assert.equal(reset.state.status, "in_progress");
assert.notEqual(reset.state.id, skipped.state.id);
assert.equal(reset.currentStep.trackKey, "math:number_operations", "explicit re-check ignores prior history and samples the complete map again");

console.log("strand-aware placement calibration tests: ok");
