import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/mobile");
if (!existsSync(resolve(dist, "packages/learning/src/teach/LanguageTeachScene.js"))) {
  const command = process.execPath;
  const built = spawnSync(command, [resolve(root, "scripts/build-mobile.mjs")], { cwd: root, stdio: "inherit" });
  assert.equal(built.status, 0);
}

const { createLocalLanguageTeachScene } = await import(pathToFileURL(resolve(dist, "packages/learning/src/teach/LanguageTeachScene.js")));
const { LanguageTeachService } = await import(pathToFileURL(resolve(dist, "packages/learning/src/teach/LanguageTeachService.js")));
const { MemoryStorageDriver } = await import(pathToFileURL(resolve(dist, "packages/storage/src/memory/MemoryStorageDriver.js")));
const { LanguageTeachBridge } = await import(pathToFileURL(resolve(dist, "packages/learning/src/legacy/LanguageTeachBridge.js")));

const cases = [
  ["language.initial_sound", "picture_word", "sound_it_out"],
  ["language.word_build.simple", "letter_build", "next_letter"],
  ["language.picture_vocabulary.basic", "picture_word", "picture_clue"],
  ["language.high_frequency.recall", "letter_build", "word_shape"],
  ["language.spelling_patterns.basic", "letter_build", "word_shape"],
  ["language.word_translation.basic", "translation_pair", "repeat_prompt"],
  ["language.sentence_patterns.simple", "sentence_chunks", "word_shape"],
  ["language.sentence_patterns.questions", "sentence_chunks", "word_shape"],
  ["language.bopomofo.sound_symbol", "sound_symbols", "sound_it_out"],
  ["language.bopomofo.word_build", "sound_symbols", "sound_it_out"],
]
for (const [skill, visualKind, strategy] of cases) {
  const scene = createLocalLanguageTeachScene(skill, "early_reader");
  assert.ok(scene, `${skill} has a deterministic teach scene`);
  assert.equal(scene.skill, skill);
  assert.equal(scene.visual.kind, visualKind);
  assert.equal(scene.strategy, strategy);
  assert.ok(scene.target.length > 0);
  assert.ok(scene.message.length > 0 && scene.messageZh.length > 0);
  assert.ok(scene.audioCue?.text.length > 0);
}
assert.equal(createLocalLanguageTeachScene("math.addition.within_20", "early_reader"), null);
const preReader = createLocalLanguageTeachScene("language.word_build.simple", "pre_reader");
assert.match(preReader.message, /Tap the same letters/i);
assert.equal(createLocalLanguageTeachScene("language.bopomofo.word_build", "early_reader")?.audioCue.locale, "zh-TW");

const learner = { kidId:"kid", age:7, language:"en-zh-TW", readingLevel:"early_reader", levels:{math:2,language:2,logic:1} };
let requested = null;
const remote = new LanguageTeachService({
  async request(request) {
    requested = request;
    return { kind:"lesson_explanation", message:"Look at the apple, say it, then build the letters in order.", messageZh:"看蘋果、說出單字，再依序把字母拼起來。", strategy:"picture_clue", emotion:"encouraging" };
  },
});
const remoteResult = await remote.getScene({ learner, skill:"language.picture_vocabulary.basic", profileId:"openai-luna-cheap" });
assert.equal(remoteResult.source, "remote");
assert.equal(requested.task, "lesson_explanation");
assert.equal(requested.context.domain, "language");
assert.equal(requested.context.example.target, "apple");
assert.deepEqual(requested.context.preferredStrategies, ["picture_clue"]);
assert.equal(requested.routing.profileId, "openai-luna-cheap");

const constrained = new LanguageTeachService({
  async request() { return { kind:"lesson_explanation", message:"Use a number line.", messageZh:"使用數線。", strategy:"number_line" }; },
});
const fallback = await constrained.getScene({ learner, skill:"language.picture_vocabulary.basic" });
assert.equal(fallback.source, "local_fallback", "AI cannot replace the deterministic language teaching strategy");
assert.equal(fallback.explanation.strategy, "picture_clue");

const bridge = new LanguageTeachBridge(new MemoryStorageDriver());
const bridgeScene = await bridge.localScene({ kidId:"kid", age:7, language:"en-zh-TW", skill:"language.picture_vocabulary.basic" });
assert.equal(bridgeScene.scene.visual.kind, "picture_word");
assert.equal(bridgeScene.source, "local_fallback", "language teach scenes remain available without the agent server");
assert.equal(await bridge.localScene({ kidId:"kid", age:7, skill:"math.addition.within_20" }), null);

const indexSource = readFileSync(resolve(root, "index.html"), "utf8");
const runtimeSource = readFileSync(resolve(root, "js/learning-runtime.js"), "utf8");
const swSource = readFileSync(resolve(root, "sw.js"), "utf8");
assert.match(indexSource, /languageTeachLocalScene/, "existing Learn UI dispatches language teach steps through the shared teach card");
assert.match(indexSource, /letter_build/, "existing Teach renderer supports progressive letter construction");
assert.match(indexSource, /sound_symbols/, "existing Teach renderer supports Bopomofo sound-symbol teaching");
assert.match(runtimeSource, /LanguageTeachBridge/, "legacy learning runtime exposes the language teach bridge");
assert.match(swSource, /teach\/LanguageTeachScene\.js/, "language teach scene is included in the offline app shell");
assert.match(swSource, /legacy\/LanguageTeachBridge\.js/, "language teach bridge is included in the offline app shell");

console.log("language teach scene tests: ok");
