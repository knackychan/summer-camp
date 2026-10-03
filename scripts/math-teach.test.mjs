import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/mobile");
if (!existsSync(resolve(dist, "packages/learning/src/teach/MathTeachScene.js"))) {
  const command = process.execPath;
  const built = spawnSync(command, [resolve(root, "scripts/build-mobile.mjs")], { cwd: root, stdio: "inherit" });
  assert.equal(built.status, 0);
}

const { createLocalMathTeachScene } = await import(pathToFileURL(resolve(dist, "packages/learning/src/teach/MathTeachScene.js")));
const { MathTeachService } = await import(pathToFileURL(resolve(dist, "packages/learning/src/teach/MathTeachService.js")));
const { MemoryStorageDriver } = await import(pathToFileURL(resolve(dist, "packages/storage/src/memory/MemoryStorageDriver.js")));
const { MathTeachBridge } = await import(pathToFileURL(resolve(dist, "packages/learning/src/legacy/MathTeachBridge.js")));

const mathSkills = [
  "math.number_comparison.within_20",
  "math.addition.within_5",
  "math.number_bonds.to_10",
  "math.addition.within_20",
  "math.subtraction.within_20",
  "math.number_comparison.within_100",
  "math.number_bonds.to_20",
  "math.addition.within_100",
  "math.subtraction.within_100",
  "math.multiplication.tables_2_5_10",
  "math.multiplication.tables_2_to_9",
  "math.addition.within_200",
];
for (const skill of mathSkills) {
  const scene = createLocalMathTeachScene(skill, "early_reader");
  assert.ok(scene, `${skill} has a deterministic teach scene`);
  assert.equal(scene.skill, skill);
  assert.ok(scene.message.length > 0 && scene.messageZh.length > 0);
  assert.ok(scene.exampleLabel.length > 0);
}
assert.equal(createLocalMathTeachScene("language.word_recall", "early_reader"), null);
assert.equal(createLocalMathTeachScene("math.multiplication.tables_2_to_9", "pre_reader")?.visual.kind, "array");
assert.equal(createLocalMathTeachScene("math.number_bonds.to_10", "early_reader")?.visual.kind, "number_bond");

const learner = { kidId:"kid", age:7, language:"en-zh-TW", readingLevel:"early_reader", levels:{math:2,language:1,logic:1} };
let requested = null;
const remote = new MathTeachService({
  async request(request) {
    requested = request;
    return { kind:"lesson_explanation", message:"Move forward five steps from eight.", messageZh:"從八往前走五步。", strategy:"number_line", emotion:"encouraging" };
  },
});
const remoteResult = await remote.getScene({ learner, skill:"math.addition.within_20", profileId:"openai-luna-cheap" });
assert.equal(remoteResult.source, "remote");
assert.equal(requested.task, "lesson_explanation");
assert.deepEqual(requested.context.preferredStrategies, ["number_line"]);
assert.equal(requested.routing.profileId, "openai-luna-cheap");

const constrained = new MathTeachService({
  async request() { return { kind:"lesson_explanation", message:"Use groups.", messageZh:"用分組。", strategy:"equal_groups" }; },
});
const fallback = await constrained.getScene({ learner, skill:"math.addition.within_20" });
assert.equal(fallback.source, "local_fallback", "AI cannot replace the deterministic visual strategy");
assert.equal(fallback.explanation.strategy, "number_line");

const bridge = new MathTeachBridge(new MemoryStorageDriver());
const bridgeScene = await bridge.localScene({ kidId:"kid", age:7, language:"en-zh-TW", skill:"math.multiplication.tables_2_5_10" });
assert.equal(bridgeScene.scene.visual.kind, "equal_groups");
assert.equal(bridgeScene.source, "local_fallback", "teach scenes remain available without the agent server");

const indexSource = readFileSync(resolve(root, "index.html"), "utf8");
const swSource = readFileSync(resolve(root, "sw.js"), "utf8");
assert.match(indexSource, /mathTeachLocalScene/, "existing Learn UI paints the deterministic scene before optional AI wording returns");
assert.match(indexSource, /learningTeachVisual/, "existing Learn UI renders the inline deterministic teach scene");
assert.match(indexSource, /completeLearningTeachStep/, "teach scene requires an explicit child acknowledgement before practice");
assert.match(swSource, /teach\/MathTeachScene\.js/, "teach scene is included in the offline app shell");
assert.match(swSource, /legacy\/MathTeachBridge\.js/, "teach bridge is included in the offline app shell");

console.log("math teach scene tests: ok");
