import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/mobile");
if (!existsSync(resolve(dist, "packages/agent/src/eval/LessonHintEval.js"))) {
  const command = process.execPath;
  const built = spawnSync(command, [resolve(root, "scripts/build-mobile.mjs")], { cwd: root, stdio: "inherit" });
  assert.equal(built.status, 0);
}
const evalMod = await import(pathToFileURL(resolve(dist, "packages/agent/src/eval/LessonHintEval.js")));
const {
  LESSON_HINT_EVAL_SCENARIOS,
  buildAnyLessonHintEvalRequest,
  buildLessonHintEvalRequest,
  buildVocabularyLessonHintEvalRequest,
  evaluateLessonHintGuardrails,
  runAnyLessonHintEval,
  runLessonHintEval,
} = evalMod;

const mathInput = {
  profileId: "openai-luna-cheap",
  age: 7,
  language: "en",
  readingLevel: "early_reader",
  level: 2,
  operation: "addition",
  left: 8,
  right: 7,
  childAnswer: 14,
};
const request = buildLessonHintEvalRequest(mathInput);
assert.equal(request.task, "lesson_hint");
assert.equal(request.context.ageBand, "7-9");
assert.equal(request.context.question.correctAnswer, 15);
assert.equal(request.routing.profileId, "openai-luna-cheap");
assert.equal(request.context.eval, true);

const vocabInput = {
  domain: "language",
  profileId: "anthropic-haiku-cheap",
  age: 4,
  language: "en",
  readingLevel: "pre_reader",
  level: 1,
  target: "dog",
  mode: "recall",
  emoji: "🐶",
  sourceFrench: "chien",
  sourceChinese: "狗",
  promptMode: "picture",
  position: 0,
  revealed: 0,
};
const vocabRequest = buildVocabularyLessonHintEvalRequest(vocabInput);
assert.equal(vocabRequest.context.domain, "language");
assert.equal(vocabRequest.context.exercise.target, "dog");
assert.equal(vocabRequest.context.exercise.emoji, "🐶");
assert.equal(vocabRequest.routing.profileId, "anthropic-haiku-cheap");
assert.deepEqual(buildAnyLessonHintEvalRequest(vocabInput), vocabRequest);

const safeMath = { kind: "lesson_hint", message: "Start at eight and count on seven steps.", messageZh: "從八開始，再往前數七步。", strategy: "count_forward" };
const safeMathGuardrails = evaluateLessonHintGuardrails(mathInput, safeMath);
assert.equal(safeMathGuardrails.passed, true);
assert.equal(safeMathGuardrails.score, 100);

const leakingMath = { kind: "lesson_hint", message: "The answer is 15.", messageZh: "答案是十五。", strategy: "count_forward" };
const leakingMathGuardrails = evaluateLessonHintGuardrails(mathInput, leakingMath);
assert.equal(leakingMathGuardrails.passed, false);
assert.equal(leakingMathGuardrails.answerLeakFree, false);
assert.ok(leakingMathGuardrails.issues.includes("math_answer_leak"));

const safeVocab = { kind: "lesson_hint", message: "Look at the picture and listen to the first sound.", messageZh: "看看圖片，聽第一個音。", strategy: "picture_clue" };
const safeVocabGuardrails = evaluateLessonHintGuardrails(vocabInput, safeVocab);
assert.equal(safeVocabGuardrails.passed, true);
assert.equal(safeVocabGuardrails.score, 100);

const leakingVocab = { kind: "lesson_hint", message: "The word is dog.", messageZh: "再試一次。", strategy: "picture_clue" };
const leakingVocabGuardrails = evaluateLessonHintGuardrails(vocabInput, leakingVocab);
assert.equal(leakingVocabGuardrails.passed, false);
assert.equal(leakingVocabGuardrails.answerLeakFree, false);
assert.ok(leakingVocabGuardrails.issues.includes("target_answer_leak"));

const wrongDomain = { kind: "lesson_hint", message: "Try again.", messageZh: "再試一次。", strategy: "count_forward" };
const wrongDomainGuardrails = evaluateLessonHintGuardrails(vocabInput, wrongDomain);
assert.equal(wrongDomainGuardrails.passed, false);
assert.equal(wrongDomainGuardrails.strategyFitsDomain, false);

let call = null;
let clock = 100;
const client = {
  async request(body) {
    call = body;
    clock = 147;
    return {
      kind: "lesson_hint",
      message: "Start at eight and count on.",
      messageZh: "從八開始往前數。",
      strategy: "count_forward",
      usage: { provider: "openai", model: "gpt-6-luna", profileId: "openai-luna-cheap", inputTokens: 90, outputTokens: 18, estimatedCostUsd: 0.000018 },
    };
  },
};
const result = await runLessonHintEval(client, mathInput, () => clock);
assert.equal(call.routing.profileId, "openai-luna-cheap");
assert.equal(result.latencyMs, 47);
assert.equal(result.profileMatched, true);
assert.equal(result.actualProfileId, "openai-luna-cheap");
assert.equal(result.guardrails.passed, true);

clock = 200;
const mismatched = await runAnyLessonHintEval({ async request() { clock = 205; return {
  kind: "lesson_hint", message: "Look at the picture.", messageZh: "看看圖片。", strategy: "picture_clue",
  usage: { provider: "openai", model: "gpt-6-luna", profileId: "openai-luna-cheap" },
}; } }, { ...vocabInput, profileId: "anthropic-sonnet-standard" }, () => clock);
assert.equal(mismatched.profileMatched, false, "AI Lab detects when server policy substituted another profile");
assert.equal(mismatched.actualProfileId, "openai-luna-cheap");
assert.equal(mismatched.guardrails.passed, true);

const multiplicationInput = { ...mathInput, operation: "multiplication", left: 6, right: 4, childAnswer: 10 };
const multiplicationRequest = buildLessonHintEvalRequest(multiplicationInput);
assert.equal(multiplicationRequest.context.question.correctAnswer, 24);
const safeMultiplication = { kind: "lesson_hint", message: "Picture six equal groups.", messageZh: "想像六個一樣大的組。", strategy: "equal_groups" };
assert.equal(evaluateLessonHintGuardrails(multiplicationInput, safeMultiplication).passed, true);
const leakingMultiplication = { kind: "lesson_hint", message: "There are 24 in all.", messageZh: "總共有二十四。", strategy: "equal_groups" };
assert.equal(evaluateLessonHintGuardrails(multiplicationInput, leakingMultiplication).answerLeakFree, false);

assert.equal(LESSON_HINT_EVAL_SCENARIOS.length, 5);
assert.equal(LESSON_HINT_EVAL_SCENARIOS.filter((s) => s.input.domain === "language").length, 2);
assert.equal(LESSON_HINT_EVAL_SCENARIOS.filter((s) => s.input.domain !== "language").length, 3);

console.log("AI math + vocabulary eval tests: ok");
