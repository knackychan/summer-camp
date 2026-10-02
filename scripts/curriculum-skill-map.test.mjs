import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/mobile");
if (!existsSync(resolve(dist, "packages/learning/src/curriculum/SkillCatalog.js"))) {
  const command = process.execPath;
  const built = spawnSync(command, [resolve(root, "scripts/build-mobile.mjs")], { cwd: root, stdio: "inherit" });
  assert.equal(built.status, 0);
}

const catalog = await import(pathToFileURL(resolve(dist, "packages/learning/src/curriculum/SkillCatalog.js")));

assert.equal(catalog.curriculumMathSkill({ id:"a", operation:"addition", left:2, right:3, answer:5, difficulty:1 }), "math.addition.within_5");
assert.equal(catalog.curriculumMathSkill({ id:"b", operation:"addition", left:8, right:7, answer:15, difficulty:2 }), "math.addition.within_20");
assert.equal(catalog.curriculumMathSkill({ id:"c", operation:"subtraction", left:18, right:9, answer:9, difficulty:2 }), "math.subtraction.within_20");
assert.equal(catalog.curriculumMathSkill({ id:"d", operation:"addition", left:63, right:27, answer:90, difficulty:4 }), "math.addition.within_100");
assert.equal(catalog.curriculumMathSkill({ id:"e", operation:"subtraction", left:84, right:27, answer:57, difficulty:4 }), "math.subtraction.within_100");
assert.equal(catalog.curriculumMathSkill({ id:"f", operation:"addition", left:99, right:45, answer:144, difficulty:6 }), "math.addition.within_200");
assert.equal(catalog.curriculumMathSkill({ id:"g", operation:"comparison", left:12, right:17, answer:17, difficulty:2 }), "math.number_comparison.within_20");
assert.equal(catalog.curriculumMathSkill({ id:"h", operation:"comparison", left:42, right:71, answer:71, difficulty:3 }), "math.number_comparison.within_100");
assert.equal(catalog.curriculumMathSkill({ id:"i", operation:"number_bond", left:6, right:10, answer:4, difficulty:2 }), "math.number_bonds.to_10");
assert.equal(catalog.curriculumMathSkill({ id:"j", operation:"number_bond", left:8, right:17, answer:9, difficulty:2 }), "math.number_bonds.to_20");
assert.equal(catalog.curriculumMathSkill({ id:"k", operation:"multiplication", left:5, right:7, answer:35, difficulty:3 }), "math.multiplication.tables_2_5_10");
assert.equal(catalog.curriculumMathSkill({ id:"l", operation:"multiplication", left:7, right:8, answer:56, difficulty:4 }), "math.multiplication.tables_2_to_9");

function vocab(mode) {
  if (mode === "copy") return { id:"v-copy", mode, target:"cat", emoji:"🐱", difficulty:2, position:0, revealed:0 };
  if (mode === "recall") return { id:"v-recall", mode, target:"cat", emoji:"🐱", difficulty:2, position:0, revealed:0 };
  if (mode === "translate") return { id:"v-translate", mode, target:"water", emoji:"💧", sourceFrench:"eau", sourceChinese:"水", difficulty:2, position:0, revealed:0 };
  if (mode === "sentences") return { id:"v-sentences", mode, target:"i like pizza", emoji:"🍕", difficulty:2, position:0, revealed:0 };
  return { id:"v-bopomofo", mode, target:"ㄇㄠ", emoji:"🐱", sourceChinese:"貓", difficulty:2, position:0, revealed:0 };
}
assert.equal(catalog.curriculumVocabularySkill(vocab("copy")), "language.word_build.simple");
assert.equal(catalog.curriculumVocabularySkill(vocab("recall")), "language.picture_vocabulary.basic");
assert.equal(catalog.curriculumVocabularySkill(vocab("translate")), "language.word_translation.basic");
assert.equal(catalog.curriculumVocabularySkill(vocab("sentences")), "language.sentence_patterns.simple");
assert.equal(catalog.curriculumVocabularySkill(vocab("bopomofo")), "language.bopomofo.word_build");

const pre = { kidId:"p", age:4, language:"en-zh-TW", readingLevel:"pre_reader", levels:{math:1,language:1,logic:1} };
const early = { kidId:"e", age:7, language:"en-zh-TW", readingLevel:"early_reader", levels:{math:2,language:2,logic:1} };
const reader = { kidId:"r", age:9, language:"en-zh-TW", readingLevel:"reader", levels:{math:4,language:3,logic:1} };
assert.deepEqual(catalog.curriculumSkillsForLearner(pre, "translate").map((s)=>s.id).sort(), [
  "language.initial_sound","language.word_build.simple","math.addition.within_5","math.number_comparison.within_20",
  "science.animals.groups","science.plants.parts","science.body.organ_jobs","science.matter.states",
  "science.weather.water_cycle","science.space.earth_moon_sun",
  "geography.map.cardinal_directions","geography.map.symbols","geography.land_water.features",
  "history.time.past_present","history.time.before_after","history.sources.clues",
].sort());
assert.ok(catalog.curriculumSkillsForLearner(early, "recall").some((s)=>s.id === "science.matter.states"));
assert.equal(catalog.getCurriculumSkill("science.weather.water_cycle")?.launch.gameId, "science");
assert.equal(catalog.getCurriculumSkill("science.weather.water_cycle")?.launch.lessonId, "science-weather-water-cycle");
assert.ok(catalog.curriculumSkillsForLearner(early, "recall").some((s)=>s.id === "geography.world.continents_oceans"));
assert.equal(catalog.getCurriculumSkill("geography.map.cardinal_directions")?.launch.gameId, "geography");
assert.equal(catalog.getCurriculumSkill("geography.map.cardinal_directions")?.launch.lessonId, "geography-cardinal-directions");
assert.ok(catalog.curriculumSkillsForLearner(early, "recall").some((s)=>s.id === "history.ancient.egypt_clues"));
assert.equal(catalog.getCurriculumSkill("history.time.before_after")?.launch.gameId, "history");
assert.equal(catalog.getCurriculumSkill("history.time.before_after")?.launch.lessonId, "history-before-after");
assert.ok(catalog.curriculumSkillsForLearner(early, "recall").some((s)=>s.id === "math.subtraction.within_20"));
assert.ok(catalog.curriculumSkillsForLearner(early, "recall").some((s)=>s.id === "language.picture_vocabulary.basic"));
assert.ok(catalog.curriculumSkillsForLearner(early, "recall").some((s)=>s.id === "language.high_frequency.recall"));
assert.ok(catalog.curriculumSkillsForLearner(early, "recall").some((s)=>s.id === "language.spelling_patterns.basic"));
assert.ok(catalog.curriculumSkillsForLearner(early, "recall").some((s)=>s.id === "math.number_bonds.to_20"));
assert.ok(catalog.curriculumSkillsForLearner(early, "recall").some((s)=>s.id === "math.multiplication.tables_2_5_10"));
assert.ok(catalog.curriculumSkillsForLearner(reader, "translate").some((s)=>s.id === "math.addition.within_100"));
assert.ok(catalog.curriculumSkillsForLearner(reader, "translate").some((s)=>s.id === "language.word_translation.basic"));
assert.ok(!catalog.curriculumSkillsForLearner(reader, "translate").some((s)=>s.id === "language.sentence_patterns.simple"), "preferred mode is a ceiling until the family/learner selects sentences");

const require = createRequire(import.meta.url);
require("../js/brain-data.js");
require("../js/brain-core.js");
const D = globalThis.SQBrainData || globalThis.window?.SQBrainData;
const C = globalThis.SQBrainCore || globalThis.window?.SQBrainCore;
// CommonJS files publish to module.exports under Node rather than global/window.
const data = D || require("../js/brain-data.js");
const core = C || require("../js/brain-core.js");

function seeded() { return 0.37; }
function promptText(item) { return item?.prompt?.en || ""; }
for (const [skill, regex, check] of [
  ["math.addition.within_20", /\+/, (n)=>n <= 20],
  ["math.subtraction.within_20", /−/, (_n,item)=>Number(item.prompt.a) <= 20],
  ["math.number_comparison.within_20", /Which is bigger/, (n,item)=>n === Math.max(Number(item.prompt.a),Number(item.prompt.b)) && n <= 20],
  ["math.number_comparison.within_100", /Which is bigger/, (n,item)=>n === Math.max(Number(item.prompt.a),Number(item.prompt.b)) && n <= 100],
  ["math.number_bonds.to_10", /\+ \? =/, (n,item)=>n === Number(item.prompt.b)-Number(item.prompt.a) && Number(item.prompt.b) <= 10],
  ["math.number_bonds.to_20", /\+ \? =/, (n,item)=>n === Number(item.prompt.b)-Number(item.prompt.a) && Number(item.prompt.b) <= 20],
  ["math.addition.within_100", /\+/, (n)=>n <= 100],
  ["math.subtraction.within_100", /−/, (_n,item)=>Number(item.prompt.a) <= 100],
  ["math.multiplication.tables_2_5_10", /×/, (n,item)=>[2,5,10].includes(Number(item.prompt.a)) && n === Number(item.prompt.a)*Number(item.prompt.b)],
  ["math.multiplication.tables_2_to_9", /×/, (n,item)=>[3,4,6,7,8,9].includes(Number(item.prompt.a)) && n === Number(item.prompt.a)*Number(item.prompt.b)],
]) {
  const round = core.buildRound("calc", "hard", seeded, data, { mathSkill: skill });
  assert.ok(round.items.length > 0);
  for (const item of round.items) {
    assert.match(promptText(item), regex, `${skill} should constrain the operation`);
    assert.ok(check(Number(item.answer), item), `${skill} should constrain the number range`);
  }
}

const indexSource = readFileSync(resolve(root, "index.html"), "utf8");
const hostSource = readFileSync(resolve(root, "js/brain/host.js"), "utf8");
const serviceWorkerSource = readFileSync(resolve(root, "sw.js"), "utf8");
assert.match(indexSource, /itemLimit:directedTarget\|\|undefined/, "directed Math steps are bounded to their Smart Practice target");
assert.match(indexSource, /if\(learningDirectorLaunch\)\{[\s\S]*showDirectedBrainResult/, "directed practice does not flow through the daily Brain Gym reward path");
assert.match(hostSource, /mathSkill: opts\.mathSkill/, "the Brain host forwards the curriculum skill constraint into round generation");
assert.match(serviceWorkerSource, /curriculum\/SkillCatalog\.js/, "the curriculum module is part of the offline app shell");
assert.match(serviceWorkerSource, /curriculum\/LanguageSkillRules\.js/, "granular language rules are pre-cached for offline Word Wizard launch");
assert.match(serviceWorkerSource, /legacy\/LearningDirectorBridge\.js/, "Smart Practice director modules are pre-cached for offline launch");

console.log("curriculum skill-map tests: ok");
