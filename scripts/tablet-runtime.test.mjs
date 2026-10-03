import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/mobile");

const runtime = await import(pathToFileURL(resolve(dist, "packages/core/src/tablet-runtime.js")));
assert.equal(runtime.viewportOrientation(768, 1024), "portrait");
assert.equal(runtime.viewportOrientation(1024, 768), "landscape");
assert.equal(runtime.viewportClass(390, 844, true), "phone");
assert.equal(runtime.viewportClass(768, 1024, true), "tablet");
assert.equal(runtime.viewportClass(1024, 768, true), "tablet");
assert.equal(runtime.viewportClass(1366, 768, false), "desktop");
assert.deepEqual(runtime.viewportSnapshot(767.7, 1023.6, true), {
  width: 768,
  height: 1024,
  orientation: "portrait",
  viewportClass: "tablet",
  coarsePointer: true,
});

const profiles = await import(pathToFileURL(resolve(dist, "packages/core/src/interaction-profile.js")));
assert.equal(profiles.defaultInteractionProfileForAge(3).readingLevel, "pre_reader");
assert.equal(profiles.defaultInteractionProfileForAge(4).assistantDialogue, false);
assert.equal(profiles.defaultInteractionProfileForAge(5).readingLevel, "reader");
assert.equal(profiles.resolveInteractionProfile(4, null, profiles.READER_PROFILE).readingLevel, "pre_reader");
assert.equal(profiles.resolveInteractionProfile(4, "reader", profiles.PRE_READER_PROFILE).readingLevel, "reader");
assert.equal(profiles.resolveInteractionProfile(8, null, profiles.PRE_READER_PROFILE).readingLevel, "pre_reader");

const sw = readFileSync(resolve(root, "sw.js"), "utf8");
assert.doesNotMatch(sw, /TabletRuntimeController\.js/);
assert.match(sw, /tablet-runtime\.js/);

const launcher = readFileSync(resolve(root, "START-SUMMER-QUEST.cmd"), "utf8");
assert.doesNotMatch(launcher, /exit \/b 1/i, "missing AI env must not block local-first tablet serving");
assert.match(launcher, /local-first mode/i);

const server = readFileSync(resolve(root, "server/agent-proxy/local-server.mjs"), "utf8");
assert.match(server, /kidUrls/);
assert.match(server, /index\.html/);
assert.match(server, /Service Workers require a secure context/);

console.log("tablet runtime tests: ok");
