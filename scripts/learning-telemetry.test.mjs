import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/mobile");
if (!existsSync(resolve(dist, "packages/learning/src/telemetry/LearningTelemetry.js"))) {
  const command = process.execPath;
  const built = spawnSync(command, [resolve(root, "scripts/build-mobile.mjs")], { cwd: root, stdio: "inherit" });
  assert.equal(built.status, 0, "mobile TypeScript build succeeds before telemetry tests");
}

const { MemoryStorageDriver } = await import(pathToFileURL(resolve(dist, "packages/storage/src/memory/MemoryStorageDriver.js")));
const {
  LearningTelemetryStore,
  LearningTelemetryRecorder,
  normalizeLearningTelemetryEvent,
  summarizeLearningTelemetry,
} = await import(pathToFileURL(resolve(dist, "packages/learning/src/telemetry/LearningTelemetry.js")));

const now = 1_700_000_000_000;
const attempt = normalizeLearningTelemetryEvent({
  version: 1,
  id: "lt-a",
  type: "attempt",
  at: now,
  learnerId: "lili",
  domain: "math",
  skill: "arithmetic",
  sessionId: "s1",
  questionId: "q1",
  correct: false,
  responseMs: 900,
  hintsUsed: 0,
  difficulty: 2,
  mistake: "near_miss",
  rawAnswer: "14",
});
assert.ok(attempt);
assert.equal(attempt.rawAnswer, undefined, "unknown/raw answer fields are discarded");
assert.equal(attempt.mistake, "near_miss");
assert.equal(normalizeLearningTelemetryEvent({ type: "attempt" }), null, "malformed telemetry is rejected");

const memory = new MemoryStorageDriver();
const store = new LearningTelemetryStore(memory, 3);
for (let i = 0; i < 5; i += 1) {
  await store.append({
    version: 1,
    id: `lt-${i}`,
    type: "attempt",
    at: now + i,
    learnerId: "lili",
    domain: "math",
    skill: "arithmetic",
    sessionId: "s1",
    questionId: `q${i}`,
    correct: i >= 2,
    responseMs: 500 + i,
    hintsUsed: 0,
    difficulty: 2,
  });
}
const bounded = await store.list();
assert.equal(bounded.length, 3);
assert.deepEqual(bounded.map((event) => event.id), ["lt-2", "lt-3", "lt-4"]);

let mirrored = 0;
const recorder = new LearningTelemetryRecorder(store, { async post() { mirrored += 1; throw new Error("offline"); } });
await recorder.record({
  version: 1,
  id: "lt-mirror",
  type: "hint",
  at: now + 10,
  learnerId: "lili",
  domain: "math",
  skill: "arithmetic",
  sessionId: "s1",
  questionId: "q9",
  source: "local_fallback",
  strategy: "number_line",
  remoteFallback: true,
});
await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
assert.equal(mirrored, 1, "mirror is attempted best-effort");
assert.ok((await store.list()).some((event) => event.id === "lt-mirror"), "local write survives mirror failure");

const events = [
  { version:1,id:"1",type:"attempt",at:1,learnerId:"lili",domain:"math",skill:"arithmetic",sessionId:"s",questionId:"q1",correct:false,responseMs:800,hintsUsed:0,difficulty:2,mistake:"near_miss" },
  { version:1,id:"2",type:"intervention",at:2,learnerId:"lili",domain:"math",skill:"arithmetic",sessionId:"s",questionId:"q1",intervention:"visual_explanation",reason:"repeated_pattern",mistake:"near_miss" },
  { version:1,id:"3",type:"hint",at:3,learnerId:"lili",domain:"math",skill:"arithmetic",sessionId:"s",questionId:"q1",source:"remote",strategy:"number_line",remoteFallback:false,provider:"openai",model:"demo",profileId:"cheap",inputTokens:100,outputTokens:20,estimatedCostUsd:.0002 },
  { version:1,id:"4",type:"support_outcome",at:4,learnerId:"lili",domain:"math",skill:"arithmetic",sessionId:"s",questionId:"q1",outcome:"retry_recovered",intervention:"visual_explanation" },
  { version:1,id:"5",type:"attempt",at:5,learnerId:"lili",domain:"math",skill:"arithmetic",sessionId:"s",questionId:"q2",correct:true,responseMs:500,hintsUsed:0,difficulty:2 },
  { version:1,id:"6",type:"attempt",at:6,learnerId:"lili",domain:"math",skill:"arithmetic",sessionId:"s",questionId:"q3",correct:true,responseMs:450,hintsUsed:0,difficulty:2 },
  { version:1,id:"7",type:"attempt",at:7,learnerId:"lili",domain:"math",skill:"arithmetic",sessionId:"s",questionId:"q4",correct:true,responseMs:430,hintsUsed:0,difficulty:2 },
  { version:1,id:"8",type:"attempt",at:8,learnerId:"lili",domain:"math",skill:"arithmetic",sessionId:"s",questionId:"q5",correct:true,responseMs:420,hintsUsed:0,difficulty:2 },
].map(normalizeLearningTelemetryEvent).filter(Boolean);
const summary = summarizeLearningTelemetry(events)[0];
assert.equal(summary.attempts, 5);
assert.equal(summary.interventionCount, 1);
assert.equal(summary.remoteHintCount, 1);
assert.equal(summary.retryRecoveryRate, 1);
assert.equal(summary.topMistake, "near_miss");
assert.equal(summary.inputTokens, 100);
assert.equal(summary.outputTokens, 20);
assert.equal(summary.estimatedCostUsd, .0002);

console.log("learning telemetry tests: ok");
