import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const origin = "http://summer.test";
const listeners = new Map();
const stores = new Map();
let online = true;
let delayWrites = false, finishWrite;
let activeFetches = 0, peakFetches = 0;
const fetches = [];
let stalledPath, finishFetch, expireNetworkFallback;
let failedPath = "/js/quest-core.js";

function keyOf(input) {
  const raw = typeof input === "string" ? input : input.url;
  return new URL(raw, origin + "/").href;
}
function cacheFor(name) {
  let store = stores.get(name);
  if (!store) { store = new Map(); stores.set(name, store); }
  return {
    async match(input) { return store.get(keyOf(input))?.clone(); },
    async put(input, response) {
      if (delayWrites) await new Promise(resolve => { finishWrite = resolve; });
      store.set(keyOf(input), response.clone());
    },
  };
}
const caches = {
  async open(name) { return cacheFor(name); },
  async keys() { return [...stores.keys()]; },
  async delete(name) { return stores.delete(name); },
  async match(input) {
    const key = keyOf(input);
    for (const store of stores.values()) {
      const response = store.get(key);
      if (response) return response.clone();
    }
    return undefined;
  },
};
async function fetchFake(input, options) {
  fetches.push({ url: keyOf(input), options });
  activeFetches += 1;
  peakFetches = Math.max(peakFetches, activeFetches);
  await Promise.resolve();
  activeFetches -= 1;
  if (!online) throw new Error("offline");
  const url = keyOf(input);
  if (new URL(url).pathname === stalledPath) await new Promise(resolve => { finishFetch = resolve; });
  if (new URL(url).pathname === failedPath) return new Response("temporarily unavailable", { status: 503 });
  if (new URL(url).pathname === "/js/config.js") return new Response("", { status: 404 });
  return new Response(`network:${new URL(url).pathname}`, { status: 200, headers: { "content-type": "text/plain" } });
}
const self = {
  location: { origin },
  clients: { claim: async () => true },
  skipWaiting() {},
  addEventListener(name, handler) { listeners.set(name, handler); },
};

vm.runInNewContext(source, {
  self,
  caches,
  fetch: fetchFake,
  URL,
  Promise,
  setTimeout(callback, ms) { assert.equal(ms, 2000); expireNetworkFallback = callback; return callback; },
  clearTimeout(callback) { if (expireNetworkFallback === callback) expireNetworkFallback = null; },
  Response,
}, { filename: "sw.js" });

let installPromise;
await (await caches.open("summer-quest-previous")).put(failedPath, new Response("previous working quest core"));
listeners.get("install")({ waitUntil(value) { installPromise = value; } });
await installPromise;
assert.ok(peakFetches <= 4, `offline installation leaves room for foreground requests: ${peakFetches} simultaneous fetches`);
assert.ok(fetches.every(call => call.options?.priority === "low" && call.options?.cache === "no-cache"), "precache runs at low priority and revalidates existing HTTP cache entries");
assert.equal(await caches.match("./js/config.js"), undefined, "missing optional config does not prevent shell installation");
assert.ok((await caches.match("./index.html")), "authoritative root app is installed in the offline cache");
assert.equal(await caches.match("./dist/mobile/apps/kid/src/runtime/TabletRuntimeController.js"), undefined, "retired child shell is not precached");
assert.ok((await caches.match("./dist/mobile/packages/core/src/tablet-runtime.js")), "tablet viewport rules are precached");
for (const name of readdirSync(new URL("../js/books/", import.meta.url)).filter(name => name.endsWith("-data.js"))) {
  const file = "js/books/" + name;
  const data = readFileSync(new URL("../" + file, import.meta.url), "utf8");
  for (const [, path] of data.matchAll(/(?:\.\.\/)?(assets\/[^\s"'<>]+?\.(?:png|jpe?g|webp|svg))/g)) {
    assert.ok(await caches.match("./" + path), file + " image must be available before its first offline visit: " + path);
  }
}

let activatePromise;
await (await caches.open("another-app-cache")).put("/another-app.js", new Response("unrelated app"));
await (await caches.open("summer-quest-old")).put("/old.js", new Response("retired"));
listeners.get("activate")({ waitUntil(value) { activatePromise = value; } });
await activatePromise;
assert.equal(await (await caches.match(failedPath)).text(), "previous working quest core", "a failed update retains the existing offline asset after old-cache cleanup");
failedPath = undefined;
assert.ok(stores.has("another-app-cache"), "activation preserves unrelated app caches");
assert.equal(stores.has("summer-quest-old"), false, "activation removes the previous Summer Quest cache");

let responsePromise, runtimeWrite;
delayWrites = true;
listeners.get("fetch")({
  request: { method: "GET", url: origin + "/runtime-book-image.jpg", mode: "cors" },
  respondWith(value) { responsePromise = value; },
  waitUntil(value) { runtimeWrite = value; },
});
assert.ok(await responsePromise, "network response does not wait for its cache write");
assert.ok(runtimeWrite instanceof Promise, "runtime cache writes keep the worker alive");
assert.equal(await caches.match("./runtime-book-image.jpg"), undefined);
finishWrite();
await runtimeWrite;
delayWrites = false;
assert.ok(await caches.match("./runtime-book-image.jpg"), "runtime image is cached before the worker may stop");

for (const path of ["/assets/solar/earth.jpg", "/js/vendor/three.core.min.js"]) {
  const count = fetches.length;
  listeners.get("fetch")({
    request: { method: "GET", url: origin + path, mode: "cors" },
    respondWith(value) { responsePromise = value; },
    waitUntil(value) { runtimeWrite = value; },
  });
  assert.ok(await responsePromise);
  assert.equal(fetches.length, count, "cached media/vendor requests make no network trip: " + path);
}

for (const request of [
  { method: "GET", url: origin + "/api/learning-telemetry" },
  { method: "GET", url: origin + "/api/summer-agent/health" },
  { method: "GET", url: origin + "/private.json", headers: new Headers({ authorization: "Bearer private" }) },
  { method: "GET", url: "https://other.test/image.jpg" },
  { method: "POST", url: origin + "/api/summer-agent" },
]) {
  listeners.get("fetch")({ request, respondWith() { assert.fail("API/auth/cross-origin/write requests bypass the offline cache"); } });
}

for (const path of ["/js/main.js", "/js/config.js", "/assets/solar/earth.jpg"]) {
  const count = fetches.length;
  listeners.get("fetch")({
    request: { method: "GET", url: origin + path, mode: "cors", cache: path.startsWith("/assets/") ? "reload" : "default" },
    respondWith(value) { responsePromise = value; },
    waitUntil(value) { runtimeWrite = value; },
  });
  await responsePromise;
  await runtimeWrite;
  assert.equal(fetches.length, count + 1, "app code/config and explicit reloads check the network: " + path);
}

stalledPath = "/index.html";
listeners.get("fetch")({
  request: { method: "GET", url: origin + "/index.html?kid=slow", mode: "navigate" },
  respondWith(value) { responsePromise = value; },
  waitUntil(value) { runtimeWrite = value; },
});
while (!expireNetworkFallback || !finishFetch) await Promise.resolve();
expireNetworkFallback();
assert.match(await (await responsePromise).text(), /network:\/index\.html/, "slow navigation falls back to the installed page after two seconds");
finishFetch();
await runtimeWrite;
assert.ok(await caches.match("/index.html?kid=slow"), "the slow network request refreshes the cache in the background");
stalledPath = undefined;

online = false;
listeners.get("fetch")({
  request: { method: "GET", url: origin + "/index.html?kid=offline&age=4", mode: "navigate" },
  respondWith(value) { responsePromise = value; },
  waitUntil(value) { runtimeWrite = value; },
});
const offlineNavigation = await responsePromise;
assert.ok(offlineNavigation, "offline navigation receives the cached authoritative root fallback");
assert.match(await offlineNavigation.text(), /network:\/index\.html/);

listeners.get("fetch")({
  request: { method: "GET", url: origin + "/dist/mobile/packages/core/src/tablet-runtime.js", mode: "cors" },
  respondWith(value) { responsePromise = value; },
  waitUntil(value) { runtimeWrite = value; },
});
const offlineModule = await responsePromise;
assert.ok(offlineModule, "offline module request is served from precache");
assert.match(await offlineModule.text(), /network:\/dist\/mobile\/packages\/core\/src\/tablet-runtime\.js/);

console.log("service worker offline tests: ok");
