import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/mobile");
const rulesFile = resolve(dist, "packages/learning/src/curriculum/LanguageSkillRules.js");
if (!existsSync(rulesFile)) {
  const command = process.execPath;
  const built = spawnSync(command, [resolve(root, "scripts/build-mobile.mjs")], { cwd: root, stdio: "inherit" });
  assert.equal(built.status, 0);
}

const rules = await import(pathToFileURL(rulesFile));

assert.equal(rules.classifyGranularLanguageSkill({ mode:"copy", target:"cat", emoji:"🐱" }), "language.word_build.simple");
assert.equal(rules.classifyGranularLanguageSkill({ mode:"copy", target:"c", emoji:"🐱" }), "language.initial_sound");
assert.equal(rules.classifyGranularLanguageSkill({ mode:"recall", target:"go", emoji:"➡️" }), "language.high_frequency.recall");
assert.equal(rules.classifyGranularLanguageSkill({ mode:"recall", target:"rain", emoji:"🌧️" }), "language.spelling_patterns.basic");
assert.equal(rules.classifyGranularLanguageSkill({ mode:"recall", target:"cat", emoji:"🐱" }), "language.picture_vocabulary.basic");
assert.equal(rules.classifyGranularLanguageSkill({ mode:"translate", target:"water", emoji:"💧", sourceFrench:"eau", sourceChinese:"水" }), "language.word_translation.basic");
assert.equal(rules.classifyGranularLanguageSkill({ mode:"sentences", target:"i like pizza", emoji:"🍕" }), "language.sentence_patterns.simple");
assert.equal(rules.classifyGranularLanguageSkill({ mode:"sentences", target:"where is my bag", emoji:"🎒" }), "language.sentence_patterns.questions");
assert.equal(rules.classifyGranularLanguageSkill({ mode:"bopomofo", target:"ㄇ", sourceChinese:"貓" }), "language.bopomofo.sound_symbol");
assert.equal(rules.classifyGranularLanguageSkill({ mode:"bopomofo", target:"ㄇㄠ", sourceChinese:"貓" }), "language.bopomofo.word_build");

assert.equal(rules.directedVocabularyTarget("language.initial_sound", "cat"), "c");
assert.equal(rules.directedVocabularyTarget("language.bopomofo.sound_symbol", "ㄇㄠ"), "ㄇ");
assert.equal(rules.directedVocabularyTarget("language.word_build.simple", "cat"), "cat");

assert.equal(rules.languageEntryMatchesSkill("language.initial_sound", { mode:"copy", target:"cat", emoji:"🐱" }), true);
assert.equal(rules.languageEntryMatchesSkill("language.initial_sound", { mode:"copy", target:"elephant", emoji:"🐘" }), false, "initial-sound pool stays bounded to short readable words");
assert.equal(rules.languageEntryMatchesSkill("language.spelling_patterns.basic", { mode:"recall", target:"rain", emoji:"🌧️" }), true);
assert.equal(rules.languageEntryMatchesSkill("language.spelling_patterns.basic", { mode:"recall", target:"cat", emoji:"🐱" }), false);
assert.equal(rules.languageEntryMatchesSkill("language.sentence_patterns.questions", { mode:"sentences", target:"where is my bag", emoji:"🎒" }), true);
assert.equal(rules.languageEntryMatchesSkill("language.sentence_patterns.simple", { mode:"sentences", target:"where is my bag", emoji:"🎒" }), false);

assert.equal(rules.vocabularyModeForLanguageSkill("language.initial_sound"), "copy");
assert.equal(rules.vocabularyModeForLanguageSkill("language.spelling_patterns.basic"), "recall");
assert.equal(rules.vocabularyModeForLanguageSkill("language.sentence_patterns.questions"), "sentences");
assert.equal(rules.vocabularyModeForLanguageSkill("language.bopomofo.sound_symbol"), "bopomofo");
assert.equal(rules.granularLanguageSkillForLegacy("language.word_recall"), "language.picture_vocabulary.basic");
assert.equal(rules.legacyLanguageSkillForGranular("language.picture_vocabulary.basic"), "language.word_recall");
assert.equal(rules.legacyLanguageSkillForGranular("language.spelling_patterns.basic"), null, "coarse legacy recall is not treated as proof of a specific spelling subskill");

const vocabSource = readFileSync(resolve(root, "js/games/vocab.js"), "utf8");
const swSource = readFileSync(resolve(root, "sw.js"), "utf8");
assert.match(vocabSource, /LanguageSkillRules\.js/, "Word Wizard imports the shared granular language rules rather than duplicating them");
assert.match(vocabSource, /directedVocabularyTarget\(skill, en\)/, "directed initial-sound and Zhuyin-sound steps reduce only the answer target, not the source item");
assert.match(vocabSource, /languageEntryMatchesSkill\(skill/, "directed Word Wizard queues filter to the requested subskill");
assert.match(vocabSource, /C\.director \? '' : '<div class="vshelf"/, "directed practice does not mutate or present the legacy collection shelf");
assert.match(swSource, /LanguageSkillRules\.js/, "language rules are included in the offline app shell");

console.log("granular language skill-map tests: ok");
