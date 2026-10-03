import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/mobile");
if (!existsSync(resolve(dist, "packages/learning/src/LearningSessionEngine.js"))) {
  const command = process.execPath;
  const built = spawnSync(command, [resolve(root, "scripts/build-mobile.mjs")], { cwd: root, stdio: "inherit" });
  assert.equal(built.status, 0, "mobile TypeScript build succeeds before learning tests");
}

const { MemoryStorageDriver } = await import(pathToFileURL(resolve(dist, "packages/storage/src/memory/MemoryStorageDriver.js")));
const { LearnerProfileStore, normalizeLearnerProfile } = await import(pathToFileURL(resolve(dist, "packages/learning/src/LearnerProfileStore.js")));
const { LearningSessionEngine, adaptationForWindow } = await import(pathToFileURL(resolve(dist, "packages/learning/src/LearningSessionEngine.js")));
const { LearningSessionStore } = await import(pathToFileURL(resolve(dist, "packages/learning/src/storage/LearningSessionStore.js")));
const { generateMathQuestion } = await import(pathToFileURL(resolve(dist, "packages/learning/src/math/MathQuestionGenerator.js")));
const { buildMathHintPresentation } = await import(pathToFileURL(resolve(dist, "packages/learning/src/math/MathHintPresentation.js")));
const { buildMathHintRequest } = await import(pathToFileURL(resolve(dist, "packages/learning/src/math/MathHintRequest.js")));
const { MathHintService } = await import(pathToFileURL(resolve(dist, "packages/learning/src/math/MathHintService.js")));
const { brainMathQuestionFromItem, canUseBrainMathHint } = await import(pathToFileURL(resolve(dist, "packages/learning/src/math/BrainMathQuestionAdapter.js")));
const { BrainMathLearningBridge } = await import(pathToFileURL(resolve(dist, "packages/learning/src/legacy/BrainMathLearningBridge.js")));
const { classifyMathMistake } = await import(pathToFileURL(resolve(dist, "packages/learning/src/math/MathMistakeClassifier.js")));
const { createEasierMathFollowUp } = await import(pathToFileURL(resolve(dist, "packages/learning/src/math/MathScaffold.js")));
const { chooseMathTutorIntervention } = await import(pathToFileURL(resolve(dist, "packages/learning/src/tutor/AdaptiveMathTutorPolicy.js")));
const { AgentHttpClient } = await import(pathToFileURL(resolve(dist, "packages/agent/src/client/AgentHttpClient.js")));

assert.equal(adaptationForWindow(5), "level_up");
assert.equal(adaptationForWindow(4), "maintain");
assert.equal(adaptationForWindow(3), "support");
assert.equal(adaptationForWindow(1), "level_down");

const preReader = normalizeLearnerProfile({ kidId: "demo-4", age: 4, levels: { math: 0, language: 2, logic: 99 } });
assert.equal(preReader.readingLevel, "pre_reader");
assert.equal(preReader.levels.math, 1);
assert.equal(preReader.levels.logic, 10);

const memory = new MemoryStorageDriver();
const profiles = new LearnerProfileStore(memory);
await profiles.save({ ...preReader, language: "zh-TW" });
const loadedProfile = await profiles.load("demo-4");
assert.equal(loadedProfile.language, "zh-TW");
assert.equal(loadedProfile.readingLevel, "pre_reader");

let now = 1_000;
const sessionEngine = new LearningSessionEngine({
  learnerId: "demo-4",
  domain: "math",
  skill: "addition_under_20",
  level: 2,
  now: () => now,
  idFactory: () => "session-test",
});
for (let i = 0; i < 5; i += 1) {
  now += 100;
  sessionEngine.recordAttempt({ questionId: `q${i}`, correct: true, responseMs: 500 });
}
let session = sessionEngine.snapshot();
assert.equal(session.level, 3);
assert.equal(session.lastAdaptation, "level_up");
for (let i = 5; i < 10; i += 1) {
  now += 100;
  sessionEngine.recordAttempt({ questionId: `q${i}`, correct: false, responseMs: 700, hintsUsed: 1 });
}
session = sessionEngine.snapshot();
assert.equal(session.level, 2);
assert.equal(session.lastAdaptation, "level_down");

const sessionStore = new LearningSessionStore(memory);
await sessionStore.save(session);
assert.equal((await sessionStore.load("session-test"))?.attempts.length, 10);

const generated = generateMathQuestion({ difficulty: 2, random: (() => { const values = [0.37, 0.51]; return () => values.shift() ?? 0.2; })() });
assert.equal(generated.operation, "addition");
assert.equal(generated.answer, generated.left + generated.right);
assert.ok(generated.answer <= 20);

const question = { id: "math-8-7", operation: "addition", left: 8, right: 7, answer: 15, difficulty: 2 };

assert.equal(classifyMathMistake(question, 14), "near_miss");
assert.equal(classifyMathMistake(question, 1), "operation_confusion", "8 + 7 answered as 8 - 7 is diagnosed locally");
const scaffold = createEasierMathFollowUp(question);
assert.equal(scaffold.operation, "addition");
assert.ok(scaffold.right < question.right, "scaffold reduces the second addend");
assert.equal(scaffold.answer, scaffold.left + scaffold.right);

const firstWrongPolicy = chooseMathTutorIntervention({
  session: { ...session, attempts: [], lastAdaptedAttemptCount: 0, level: 2 },
  question,
  childAnswer: 14,
});
assert.equal(firstWrongPolicy.kind, "tiny_hint");
assert.ok(firstWrongPolicy.preferredStrategies.includes("count_forward"));

const repeatedPatternPolicy = chooseMathTutorIntervention({
  session: {
    ...session,
    attempts: [{ questionId: "x", correct: false, responseMs: 500, hintsUsed: 0, difficulty: 2, answeredAt: 1, mistake: "near_miss" }],
    lastAdaptedAttemptCount: 0,
    level: 2,
  },
  question,
  childAnswer: 14,
});
assert.equal(repeatedPatternPolicy.kind, "visual_explanation");
assert.equal(repeatedPatternPolicy.reason, "repeated_pattern");

const strugglingPolicy = chooseMathTutorIntervention({
  session: {
    ...session,
    attempts: [
      { questionId: "x1", correct: false, responseMs: 500, hintsUsed: 1, difficulty: 2, answeredAt: 1, mistake: "unknown" },
      { questionId: "x2", correct: false, responseMs: 600, hintsUsed: 1, difficulty: 2, answeredAt: 2, mistake: "unknown" },
    ],
    lastAdaptedAttemptCount: 0,
    level: 2,
  },
  question,
  childAnswer: 10,
});
assert.equal(strugglingPolicy.kind, "easier_follow_up");
assert.ok(strugglingPolicy.easierQuestion);

const request = buildMathHintRequest(loadedProfile, session, question, 14, "openai-luna-cheap");
assert.equal(request.task, "lesson_hint");
assert.equal(request.stage, "learning:math_hint");
assert.equal(request.context.ageBand, "3-4");
assert.equal(request.context.kidId, undefined, "provider context does not expose learner ID");
assert.equal(request.context.age, undefined, "provider context uses an age band, not exact age");
assert.equal(request.routing.profileId, "openai-luna-cheap");
const constrainedRequest = buildMathHintRequest(loadedProfile, session, question, 14, "openai-luna-cheap", {
  preferredStrategies: ["objects", "number_line"],
  mistake: "operation_confusion",
  intervention: "visual_explanation",
});
assert.deepEqual(constrainedRequest.context.preferredStrategies, ["objects", "number_line"]);
assert.equal(constrainedRequest.context.intervention, "visual_explanation");

const visual = buildMathHintPresentation(question, "count_forward", "pre_reader");
assert.equal(visual.mode, "visual_audio");
assert.equal(visual.showText, false);
assert.deepEqual(visual.numberLine, { start: 8, direction: 1, steps: 7 });

const offlineHints = new MathHintService();
const offline = await offlineHints.getHint({ learner: loadedProfile, session, question, childAnswer: 14 });
assert.equal(offline.source, "local_fallback");
assert.equal(offline.hint.strategy, "count_forward");
assert.equal(offline.presentation.mode, "visual_audio");

let postedBody = null;
const httpClient = new AgentHttpClient({
  endpoint: "/api/summer-agent",
  fetch: async (_url, init) => {
    postedBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      kind: "lesson_hint",
      message: "Start at eight and count seven more.",
      messageZh: "從八開始，再往前數七個。",
      strategy: "count_forward",
      emotion: "encouraging",
      provider: "remote:openai",
      usage: { provider: "openai", model: "gpt-6-luna", profileId: "openai-luna-cheap", inputTokens: 80, outputTokens: 20, estimatedCostUsd: 0.00002 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  },
});
const remoteHints = new MathHintService(httpClient);
const remote = await remoteHints.getHint({ learner: loadedProfile, session, question, childAnswer: 14 });
assert.equal(postedBody.task, "lesson_hint");
assert.equal(remote.source, "remote");
assert.equal(remote.hint.usage.profileId, "openai-luna-cheap");
assert.equal(remote.presentation.strategy, "count_forward");
const constrainedService = new MathHintService({
  async request() {
    return { kind: "lesson_hint", message: "Count on.", messageZh: "往前數。", strategy: "count_forward", emotion: "encouraging" };
  },
});
const constrainedFallback = await constrainedService.getHint({
  learner: loadedProfile, session, question, childAnswer: 1, preferredStrategies: ["objects", "number_line"], mistake: "operation_confusion", intervention: "visual_explanation",
});
assert.equal(constrainedFallback.source, "local_fallback", "AI cannot ignore deterministic tutor strategy constraints");
assert.equal(constrainedFallback.presentation.strategy, "objects");

const brokenClient = { async request() { throw new Error("offline"); } };
const recovered = await new MathHintService(brokenClient).getHint({ learner: loadedProfile, session, question, childAnswer: 14 });
assert.equal(recovered.source, "local_fallback");
assert.match(recovered.remoteError, /offline/);

const brainAddition = {
  gameId: "calc", tier: "tot", index: 0,
  item: { answer: "5", prompt: { type: "emoji", a: 3, b: 2, en: "🍎🍎🍎 + 🍎🍎 = ?" } },
};
const mappedAddition = brainMathQuestionFromItem(brainAddition);
assert.equal(mappedAddition.operation, "addition");
assert.equal(mappedAddition.answer, 5);
assert.equal(canUseBrainMathHint(brainAddition), true);

const brainSubtraction = {
  gameId: "calc", tier: "mid", index: 2,
  item: { answer: "9", prompt: { type: "text", en: "14 − 5 = ?" } },
};
const mappedSubtraction = brainMathQuestionFromItem(brainSubtraction);
assert.equal(mappedSubtraction.operation, "subtraction");
assert.equal(mappedSubtraction.answer, 9);
assert.equal(mappedSubtraction.difficulty, 3);
const subtractionObjects = buildMathHintPresentation(mappedSubtraction, "objects", "early_reader");
assert.deepEqual(subtractionObjects.objectGroups, [14, 5]);
assert.equal(subtractionObjects.operator, "−", "object hints preserve subtraction instead of showing addition");

const brainMultiplication = {
  gameId: "calc", tier: "hard", index: 1,
  item: { answer: "42", prompt: { type: "text", en: "6 × 7 = ?" } },
};
const mappedMultiplication = brainMathQuestionFromItem(brainMultiplication);
assert.equal(mappedMultiplication.operation, "multiplication");
assert.equal(mappedMultiplication.answer, 42);
assert.equal(canUseBrainMathHint(brainMultiplication), true, "multiplication now uses the same controlled tutor boundary");
assert.equal(classifyMathMistake(mappedMultiplication, 13), "operation_confusion", "multiplication answered as addition is diagnosed locally");
assert.equal(classifyMathMistake(mappedMultiplication, 36), "skip_counting_slip", "one missing group is recognized as a skip-counting slip");
const multiplicationVisual = buildMathHintPresentation(mappedMultiplication, "array", "early_reader");
assert.deepEqual(multiplicationVisual.equalGroups, { groups: 6, each: 7, layout: "array" });
const multiplicationScaffold = createEasierMathFollowUp(mappedMultiplication);
assert.equal(multiplicationScaffold.operation, "multiplication");
assert.equal(multiplicationScaffold.answer, multiplicationScaffold.left * multiplicationScaffold.right);

const mappedComparison = brainMathQuestionFromItem({
  gameId: "calc", tier: "mid", index: 3,
  item: { answer: "17", prompt: { type: "comparison", a: 12, b: 17, en: "Which is bigger? 12 or 17" } },
});
assert.equal(mappedComparison.operation, "comparison");
assert.equal(classifyMathMistake(mappedComparison, 12), "comparison_reversal");
assert.deepEqual(buildMathHintPresentation(mappedComparison, "compare_quantity", "pre_reader").comparison, [12,17]);

const mappedBond = brainMathQuestionFromItem({
  gameId: "calc", tier: "mid", index: 4,
  item: { answer: "4", prompt: { type: "numberbond", a: 6, b: 10, en: "6 + ? = 10" } },
});
assert.equal(mappedBond.operation, "number_bond");
assert.equal(mappedBond.answer, 4);
assert.deepEqual(buildMathHintPresentation(mappedBond, "missing_part", "pre_reader").numberBond, { known:6, target:10 });

const bridgeMemory = new MemoryStorageDriver();
let bridgeRequests = 0;
const bridge = new BrainMathLearningBridge(bridgeMemory, {
  async request(request) {
    bridgeRequests += 1;
    assert.equal(request.task, "lesson_hint");
    return {
      kind: "lesson_hint",
      message: "Count on from three.",
      messageZh: "從三開始往前數。",
      strategy: "count_forward",
      emotion: "encouraging",
    };
  },
});
assert.equal(bridge.canSupport({ ...brainAddition, kidId: "lucien", age: 4 }), true);
const bridgeHint = await bridge.getHint({ ...brainAddition, kidId: "lucien", age: 4, childAnswer: 4 });
assert.equal(bridgeRequests, 1);
assert.equal(bridgeHint.source, "remote");
assert.equal(bridgeHint.presentation.mode, "visual_audio", "age 4 automatically gets the pre-reader presentation");
const bridgeIntervention = await bridge.getIntervention({ ...brainAddition, kidId: "lucien", age: 4, childAnswer: 4 });
assert.equal(bridgeIntervention.kind, "tiny_hint");
for (let i = 0; i < 5; i += 1) {
  await bridge.recordAttempt({ ...brainAddition, index: i, kidId: "lucien", age: 4, childAnswer: 5, responseMs: 600, hintsUsed: 0 });
}
const bridgeSession = await bridge.snapshot({ ...brainAddition, kidId: "lucien", age: 4 });
assert.equal(bridgeSession.skill, "math.addition.within_5", "Brain learning sessions are attributed to the exact curriculum skill");
assert.equal(bridgeSession.attempts.length, 5);
assert.equal(bridgeSession.level, 2, "five locally-correct Brain attempts adapt the persisted Math level");

console.log("learning runtime tests: ok");
