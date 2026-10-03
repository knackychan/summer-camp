import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/mobile");
if (!existsSync(resolve(dist, "packages/learning/src/legacy/VocabularyLearningBridge.js"))) {
  const command = process.execPath;
  const built = spawnSync(command, [resolve(root, "scripts/build-mobile.mjs")], { cwd: root, stdio: "inherit" });
  assert.equal(built.status, 0, "mobile TypeScript build succeeds before vocabulary tests");
}

const { MemoryStorageDriver } = await import(pathToFileURL(resolve(dist, "packages/storage/src/memory/MemoryStorageDriver.js")));
const { normalizeLearnerProfile } = await import(pathToFileURL(resolve(dist, "packages/learning/src/LearnerProfileStore.js")));
const { LearningSessionEngine } = await import(pathToFileURL(resolve(dist, "packages/learning/src/LearningSessionEngine.js")));
const { buildVocabularyHintRequest } = await import(pathToFileURL(resolve(dist, "packages/learning/src/language/VocabularyHintRequest.js")));
const { buildVocabularyHintPresentation } = await import(pathToFileURL(resolve(dist, "packages/learning/src/language/VocabularyHintPresentation.js")));
const { VocabularyHintService } = await import(pathToFileURL(resolve(dist, "packages/learning/src/language/VocabularyHintService.js")));
const { classifyVocabularyMistake } = await import(pathToFileURL(resolve(dist, "packages/learning/src/language/VocabularyMistakeClassifier.js")));
const { chooseVocabularyTutorIntervention } = await import(pathToFileURL(resolve(dist, "packages/learning/src/tutor/AdaptiveVocabularyTutorPolicy.js")));
const { VocabularyLearningBridge } = await import(pathToFileURL(resolve(dist, "packages/learning/src/legacy/VocabularyLearningBridge.js")));

const learner = normalizeLearnerProfile({ kidId: "demo", age: 7, language: "en-zh-TW", levels: { math: 1, language: 2, logic: 1 } });
const engine = new LearningSessionEngine({ learnerId: "demo", domain: "language", skill: "vocabulary_recall", level: 2, idFactory: () => "vocab-test" });
const session = engine.snapshot();
const exercise = {
  id: "vocab:recall:apple",
  mode: "recall",
  target: "apple",
  difficulty: 2,
  position: 1,
  revealed: 0,
  emoji: "🍎",
  sourceFrench: "la pomme",
  sourceChinese: "蘋果",
  promptMode: "pic",
};

const request = buildVocabularyHintRequest(learner, session, exercise, "openai-luna-cheap");
assert.equal(request.task, "lesson_hint");
assert.equal(request.stage, "learning:vocabulary_hint");
assert.equal(request.context.domain, "language");
assert.equal(request.context.kidId, undefined, "provider context does not expose learner ID");
assert.equal(request.context.age, undefined, "provider context uses age band rather than exact age");
assert.equal(request.context.exercise.target, "apple");
assert.equal(request.routing.profileId, "openai-luna-cheap");

const nextLetter = buildVocabularyHintPresentation(exercise, "next_letter", "early_reader");
assert.equal(nextLetter.revealThrough, 2);
assert.equal(nextLetter.letter, "p");
assert.equal(nextLetter.showText, true);
const picture = buildVocabularyHintPresentation(exercise, "picture_clue", "pre_reader");
assert.equal(picture.mode, "visual_audio");
assert.equal(picture.showText, false);
assert.equal(picture.emoji, "🍎");

assert.equal(classifyVocabularyMistake({ exercise, typedCharacter: "x", expectedCharacter: "p", wrongCountAtPosition: 1, totalWrongCount: 1 }), "single_letter_slip");
assert.equal(classifyVocabularyMistake({ exercise: { ...exercise, position: 2 }, typedCharacter: "x", expectedCharacter: "p", wrongCountAtPosition: 2, totalWrongCount: 2 }), "repeated_letter_confusion");
assert.equal(classifyVocabularyMistake({ exercise: { ...exercise, position: 0 }, typedCharacter: "x", expectedCharacter: "a", wrongCountAtPosition: 2, totalWrongCount: 2 }), "recall_stall");

const strongSession = { ...session, attempts: [0,1,2,3].map((i) => ({ questionId: `ok${i}`, correct: true, responseMs: 500, hintsUsed: 0, difficulty: 2, answeredAt: i + 1 })) };
const continueIntervention = chooseVocabularyTutorIntervention({
  session: strongSession,
  exercise: { ...exercise, position: 2 },
  readingLevel: "early_reader",
  typedCharacter: "x", expectedCharacter: "p", wrongCountAtPosition: 1, totalWrongCount: 1,
});
assert.equal(continueIntervention.kind, "continue", "one typo after a strong run does not interrupt the learner");

const revealIntervention = chooseVocabularyTutorIntervention({
  session, exercise: { ...exercise, position: 2 }, readingLevel: "early_reader",
  typedCharacter: "x", expectedCharacter: "p", wrongCountAtPosition: 2, totalWrongCount: 2,
});
assert.equal(revealIntervention.kind, "reveal_letter");
assert.equal(revealIntervention.revealThrough, 3, "repeated position difficulty reveals exactly the current letter");

const preReaderIntervention = chooseVocabularyTutorIntervention({
  session, exercise: { ...exercise, position: 0 }, readingLevel: "pre_reader",
  typedCharacter: "x", expectedCharacter: "a", wrongCountAtPosition: 1, totalWrongCount: 1,
});
assert.equal(preReaderIntervention.kind, "picture_audio");
assert.equal(preReaderIntervention.showPicture, true);
assert.equal(preReaderIntervention.speakTarget, true);

const strugglingSession = { ...session, attempts: [
  { questionId: "w1", correct: false, responseMs: 900, hintsUsed: 1, difficulty: 2, answeredAt: 1, mistake: "single_letter_slip" },
  { questionId: "w2", correct: false, responseMs: 1000, hintsUsed: 1, difficulty: 2, answeredAt: 2, mistake: "single_letter_slip" },
] };
const easierIntervention = chooseVocabularyTutorIntervention({
  session: strugglingSession, exercise: { ...exercise, position: 2 }, readingLevel: "early_reader",
  typedCharacter: "x", expectedCharacter: "p", wrongCountAtPosition: 1, totalWrongCount: 1,
});
assert.equal(easierIntervention.kind, "easier_recall");
assert.equal(easierIntervention.speakTarget, true);

const offline = await new VocabularyHintService().getHint({ learner, session, exercise });
assert.equal(offline.source, "local_fallback");
assert.equal(offline.hint.strategy, "next_letter");

let remoteCalls = 0;
const remote = await new VocabularyHintService({ async request(body) {
  remoteCalls += 1;
  assert.equal(body.context.domain, "language");
  return { kind: "lesson_hint", message: "Look at the first sound.", messageZh: "先想第一個聲音。", strategy: "sound_it_out", emotion: "encouraging" };
} }).getHint({ learner, session, exercise });
assert.equal(remoteCalls, 1);
assert.equal(remote.source, "remote");
assert.equal(remote.presentation.speakTarget, true);

const wrongDomain = await new VocabularyHintService({ async request() {
  return { kind: "lesson_hint", message: "Count on.", messageZh: "往前數。", strategy: "count_forward" };
} }).getHint({ learner, session, exercise });
assert.equal(wrongDomain.source, "local_fallback");
assert.match(wrongDomain.remoteError, /non-language/);

const ignoredConstraint = await new VocabularyHintService({ async request(body) {
  assert.deepEqual(body.context.preferredStrategies, ["picture_clue"]);
  return { kind: "lesson_hint", message: "Start with one letter.", messageZh: "先看一個字母。", strategy: "first_letter" };
} }).getHint({ learner, session, exercise, preferredStrategies: ["picture_clue"], mistake: "recall_stall", intervention: "picture_audio" });
assert.equal(ignoredConstraint.source, "local_fallback");
assert.equal(ignoredConstraint.hint.strategy, "picture_clue");
assert.match(ignoredConstraint.remoteError, /strategy constraint/);

const leaked = await new VocabularyHintService({ async request() {
  return { kind: "lesson_hint", message: "The answer is apple.", messageZh: "答案是 apple。", strategy: "first_letter" };
} }).getHint({ learner, session, exercise });
assert.equal(leaked.source, "local_fallback");
assert.match(leaked.remoteError, /revealed the target/);

const memory = new MemoryStorageDriver();
const bridge = new VocabularyLearningBridge(memory, { async request(body) {
  const preferred = Array.isArray(body.context.preferredStrategies) ? body.context.preferredStrategies[0] : null;
  return { kind: "lesson_hint", message: "Use one small clue.", messageZh: "用一個小提示。", strategy: preferred || "first_letter", emotion: "encouraging" };
} });
const base = {
  kidId: "lili", age: 7, language: "en-zh-TW", gameId: "vocab", mode: "recall",
  target: "zebra", emoji: "🦓", sourceFrench: "le zèbre", sourceChinese: "斑馬", promptMode: "pic", position: 0, revealed: 0,
};
assert.equal(bridge.canSupport(base), true);
assert.equal(bridge.canSupport({ ...base, mode: "copy" }), false, "copy mode remains deterministic and does not spend AI tokens");
assert.equal(await bridge.getHint({ ...base, mode: "copy" }), null, "copy mode never requests an AI hint");
await bridge.recordAttempt({ ...base, mode: "copy", correct: true, responseMs: 420, hintsUsed: 0 });
const copySession = await bridge.snapshot({ ...base, mode: "copy" });
assert.equal(copySession.skill, "language.word_build.simple", "copy practice is attributed to its exact granular curriculum skill");
assert.equal(copySession.attempts.length, 1, "copy-mode learning progress is still recorded locally");
const bridgeIntervention = await bridge.getIntervention({
  ...base, position: 2, typedCharacter: "x", expectedCharacter: "b", wrongCountAtPosition: 2, totalWrongCount: 2,
});
assert.equal(bridgeIntervention.kind, "reveal_letter");
const bridgeHint = await bridge.getHint({ ...base, position: 2, intervention: bridgeIntervention });
assert.equal(bridgeHint.source, "remote");
assert.equal(bridgeHint.presentation.revealThrough, 3, "adaptive reveal constraint is preserved through the bridge");
const mistakeMemory = new MemoryStorageDriver();
const mistakeBridge = new VocabularyLearningBridge(mistakeMemory);
await mistakeBridge.recordAttempt({ ...base, correct: false, responseMs: 800, hintsUsed: 1, mistake: "repeated_letter_confusion" });
const mistakeSession = await mistakeBridge.snapshot(base);
assert.equal(mistakeSession.attempts[0].mistake, "repeated_letter_confusion", "language mistake labels persist with learning attempts");
for (const [i, target] of ["cat", "zebra", "lion", "panda", "kiwi"].entries()) {
  await bridge.recordAttempt({ ...base, target, correct: true, responseMs: 500 + i, hintsUsed: 0 });
}
const bridgeSession = await bridge.snapshot(base);
assert.equal(bridgeSession.domain, "language");
assert.equal(bridgeSession.skill, "language.picture_vocabulary.basic", "recall practice is attributed to its exact granular curriculum skill");
assert.equal(bridgeSession.attempts.length, 5);
assert.equal(bridgeSession.level, 3, "five independent successes adapt the persisted language level");

const runtimeSource = readFileSync(resolve(root, "js/learning-runtime.js"), "utf8");
const vocabSource = readFileSync(resolve(root, "js/games/vocab.js"), "utf8");
const indexSource = readFileSync(resolve(root, "index.html"), "utf8");
assert.match(runtimeSource, /VocabularyLearningBridge/);
assert.match(runtimeSource, /getVocabularyHint/);
assert.match(runtimeSource, /getVocabularyIntervention/);
assert.match(vocabSource, /recordVocabularyLearningAttempt/);
assert.match(vocabSource, /requestVocabularyHint/);
assert.match(vocabSource, /maybeApplyVocabularyTutor/);
assert.match(indexSource, /canSupportVocabulary/);
assert.match(indexSource, /getVocabularyIntervention/);
assert.match(vocabSource, /vGameMode/);
assert.match(vocabSource, /Smart Practice step complete/);
assert.match(indexSource, /learningDirectorSession/);
assert.match(indexSource, /Smart Practice/);

console.log("vocabulary learning tests: ok");
