import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/mobile");
if (!existsSync(resolve(dist, "packages/learning/src/telemetry/TutorPolicyEvaluation.js"))) {
  const command = process.execPath;
  const built = spawnSync(command, [resolve(root, "scripts/build-mobile.mjs")], { cwd: root, stdio: "inherit" });
  assert.equal(built.status, 0);
}
const { evaluateTutorPolicy } = await import(pathToFileURL(resolve(dist, "packages/learning/src/telemetry/TutorPolicyEvaluation.js")));

const base = { version:1, learnerId:"lili", domain:"math", skill:"arithmetic", sessionId:"s" };
const events = [
  { ...base,id:"a1",type:"attempt",at:1,questionId:"q0",correct:false,responseMs:800,hintsUsed:0,difficulty:2 },
  { ...base,id:"a2",type:"attempt",at:2,questionId:"q00",correct:false,responseMs:750,hintsUsed:0,difficulty:2 },
  { ...base,id:"i1",type:"intervention",at:3,questionId:"q1",intervention:"visual_explanation",reason:"repeated_pattern",mistake:"near_miss" },
  { ...base,id:"o1",type:"support_outcome",at:4,questionId:"q1",outcome:"retry_recovered",intervention:"visual_explanation" },
  { ...base,id:"a3",type:"attempt",at:5,questionId:"q2",correct:true,responseMs:500,hintsUsed:0,difficulty:2 },
  { ...base,id:"i2",type:"intervention",at:6,questionId:"q3",intervention:"visual_explanation",reason:"repeated_pattern",mistake:"near_miss" },
  { ...base,id:"o2",type:"support_outcome",at:7,questionId:"q3",outcome:"retry_failed",intervention:"visual_explanation" },
  { ...base,id:"a4",type:"attempt",at:8,questionId:"q4",correct:true,responseMs:500,hintsUsed:0,difficulty:2 },
  { ...base,id:"a5",type:"attempt",at:9,questionId:"q5",correct:true,responseMs:500,hintsUsed:0,difficulty:2 },
  { ...base,id:"a6",type:"attempt",at:10,questionId:"q6",correct:true,responseMs:500,hintsUsed:0,difficulty:2 },
];
const rows = evaluateTutorPolicy(events);
assert.equal(rows.length, 1);
const row = rows[0];
assert.equal(row.intervention, "visual_explanation");
assert.equal(row.uses, 2);
assert.equal(row.retryAttempts, 2);
assert.equal(row.retryRecoveries, 1);
assert.equal(row.retryRecoveryRate, .5);
assert.equal(row.nextIndependentCorrectRate, 1);
assert.equal(row.evidence, "very_low", "small samples are explicitly labelled");
assert.ok(row.laterIndependentCorrectRate >= row.baselineIndependentCorrectRate, "descriptive before/after independence is computed");

console.log("tutor policy evaluation tests: ok");
