import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/mobile");
if (!existsSync(resolve(dist, "packages/learning/src/experiments/TutorExperimentHarness.js"))) {
  const command = process.execPath;
  const built = spawnSync(command, [resolve(root, "scripts/build-mobile.mjs")], { cwd: root, stdio: "inherit" });
  assert.equal(built.status, 0);
}

const { TutorExperimentHarness, MATH_NEAR_MISS_SUPPORT_EXPERIMENT_ID } = await import(pathToFileURL(resolve(dist, "packages/learning/src/experiments/TutorExperimentHarness.js")));
const { evaluateTutorExperiments } = await import(pathToFileURL(resolve(dist, "packages/learning/src/telemetry/TutorExperimentEvaluation.js")));
const { normalizeLearningTelemetryEvent } = await import(pathToFileURL(resolve(dist, "packages/learning/src/telemetry/LearningTelemetry.js")));

const baseline = {
  kind: "visual_explanation",
  mistake: "near_miss",
  reason: "repeated_pattern",
  preferredStrategies: ["objects", "number_line"],
};
const question = { id:"q", operation:"addition", left:8, right:7, answer:15, difficulty:2 };

const off = new TutorExperimentHarness([]);
assert.equal(off.applyMath({ learnerId:"lili", question, baseline }).assignment, undefined, "experiment is opt-in");
assert.equal(off.applyMath({ learnerId:"lili", question, baseline }).intervention.kind, baseline.kind);

const on = new TutorExperimentHarness([MATH_NEAR_MISS_SUPPORT_EXPERIMENT_ID]);
const first = on.applyMath({ learnerId:"lili", question, baseline });
const second = on.applyMath({ learnerId:"lili", question, baseline });
assert.ok(first.assignment);
assert.equal(first.assignment.variantId, second.assignment.variantId, "assignment is stable for the same learner");
assert.ok(["visual_explanation","easier_follow_up"].includes(first.intervention.kind));
if (first.assignment.variantId === "easier_follow_up") assert.ok(first.intervention.easierQuestion, "scaffold variant owns a local easier question");

const ineligible = on.applyMath({ learnerId:"lili", question, baseline:{...baseline, reason:"isolated_error"} });
assert.equal(ineligible.assignment, undefined, "isolated errors are not enrolled");
assert.equal(ineligible.intervention.kind, "visual_explanation");

let other = null;
for (let i = 0; i < 200; i += 1) {
  const candidate = on.assignmentFor(`kid-${i}`);
  if (candidate && candidate.variantId !== first.assignment.variantId) { other = candidate; break; }
}
assert.ok(other, "deterministic bucketing exposes both predefined variants across learners");

const normalized = normalizeLearningTelemetryEvent({
  version:1,id:"i",type:"intervention",at:10,learnerId:"lili",domain:"math",skill:"arithmetic",sessionId:"s",questionId:"q1",
  intervention:"visual_explanation",reason:"repeated_pattern",mistake:"near_miss",
  experimentId:MATH_NEAR_MISS_SUPPORT_EXPERIMENT_ID,experimentVariant:"visual_explanation",rawAnswer:"14",
});
assert.ok(normalized);
assert.equal(normalized.experimentId, MATH_NEAR_MISS_SUPPORT_EXPERIMENT_ID);
assert.equal(normalized.experimentVariant, "visual_explanation");
assert.equal(normalized.rawAnswer, undefined, "experiment telemetry still drops arbitrary/raw child data");

const base = { version:1, domain:"math", skill:"arithmetic", sessionId:"s" };
const events = [
  { ...base,id:"a0",type:"attempt",at:1,learnerId:"lili",questionId:"pre",correct:false,responseMs:700,hintsUsed:0,difficulty:2 },
  { ...base,id:"i1",type:"intervention",at:2,learnerId:"lili",questionId:"q1",intervention:"visual_explanation",reason:"repeated_pattern",mistake:"near_miss",experimentId:MATH_NEAR_MISS_SUPPORT_EXPERIMENT_ID,experimentVariant:"visual_explanation" },
  { ...base,id:"o1",type:"support_outcome",at:3,learnerId:"lili",questionId:"q1",outcome:"retry_recovered",intervention:"visual_explanation" },
  { ...base,id:"a1",type:"attempt",at:4,learnerId:"lili",questionId:"post",correct:true,responseMs:500,hintsUsed:0,difficulty:2 },
  { ...base,id:"b0",type:"attempt",at:5,learnerId:"milo",questionId:"pre2",correct:false,responseMs:750,hintsUsed:0,difficulty:2 },
  { ...base,id:"i2",type:"intervention",at:6,learnerId:"milo",questionId:"q2",intervention:"easier_follow_up",reason:"repeated_pattern",mistake:"near_miss",experimentId:MATH_NEAR_MISS_SUPPORT_EXPERIMENT_ID,experimentVariant:"easier_follow_up" },
  { ...base,id:"o2",type:"support_outcome",at:7,learnerId:"milo",questionId:"q2",outcome:"scaffold_success",intervention:"easier_follow_up" },
  { ...base,id:"b1",type:"attempt",at:8,learnerId:"milo",questionId:"post2",correct:true,responseMs:520,hintsUsed:0,difficulty:2 },
].map(normalizeLearningTelemetryEvent).filter(Boolean);
const rows = evaluateTutorExperiments(events);
assert.equal(rows.length, 2);
assert.deepEqual(rows.map((row)=>row.variantId).sort(), ["easier_follow_up","visual_explanation"]);
assert.ok(rows.every((row)=>row.uses===1 && row.nextIndependentCorrectRate===1));
assert.ok(rows.every((row)=>!("winner" in row) && !("recommended" in row)), "evaluation is descriptive and does not pick a policy");

console.log("tutor experiment tests: ok");
