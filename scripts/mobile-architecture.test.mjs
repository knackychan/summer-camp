import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { root, sourceFiles } from "./verify-android-web.mjs";

const dist = resolve(root, "dist/mobile");
for (const retired of ["apps/kid", "packages/navigation", "packages/world", "packages/activities", "packages/state", "packages/platform", "packages/quests"]) {
  assert.equal(existsSync(resolve(dist, retired)), false, `${retired} must not be compiled for the product`);
}
for (const required of ["packages/learning/src/legacy/BrainMathLearningBridge.js", "packages/storage/src/web/LocalStorageDriver.js", "packages/agent/src/client/AgentHttpClient.js", "packages/core/src/tablet-runtime.js"]) {
  assert.ok(existsSync(resolve(dist, required)), `${required} survives shell retirement`);
}
assert.ok(sourceFiles().includes("admin.html"), "parent application is shipped");
const redirect = readFileSync(resolve(root, "apps/kid/index.html"), "utf8");
assert.match(redirect, /location\.replace/);
assert.doesNotMatch(redirect, /dist\/mobile|iframe|id="app"/);
const manifest = JSON.parse(readFileSync(resolve(root, "manifest.webmanifest"), "utf8"));
assert.equal(manifest.start_url, "./index.html");
assert.equal(manifest.id, "./index.html");
const sw = readFileSync(resolve(root, "sw.js"), "utf8");
assert.doesNotMatch(sw, /apps\/kid|TabletRuntimeController|ActivityHostScreen|NavigationService|WorldModel|AppSessionStore/);
assert.ok(sw.includes('cache.match("./index.html")'), "offline navigation uses the active release cache");
await import("./tablet-runtime.test.mjs");
console.log("root mobile architecture tests: ok");
