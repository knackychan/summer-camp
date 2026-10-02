import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const origin = "http://summer.test";
const listeners = new Map();
const stores = new Map();
let online = true;

function keyOf(input) {
  const raw = typeof input === "string" ? input : input.url;
  return new URL(raw, origin + "/").href;
}
function cacheFor(name) {
  let store = stores.get(name);
  if (!store) { store = new Map(); stores.set(name, store); }
  return {
    async put(input, response) { store.set(keyOf(input), response.clone()); },
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
async function fetchFake(input) {
  if (!online) throw new Error("offline");
  const url = keyOf(input);
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
  setTimeout,
  clearTimeout,
  Response,
}, { filename: "sw.js" });

let installPromise;
listeners.get("install")({ waitUntil(value) { installPromise = value; } });
await installPromise;
assert.equal(await caches.match("./js/config.js"), undefined, "missing optional config does not prevent shell installation");
assert.ok((await caches.match("./index.html")), "authoritative root app is installed in the offline cache");
assert.equal(await caches.match("./dist/mobile/apps/kid/src/runtime/TabletRuntimeController.js"), undefined, "retired child shell is not precached");
assert.ok((await caches.match("./dist/mobile/packages/core/src/tablet-runtime.js")), "tablet viewport rules are precached");

let activatePromise;
listeners.get("activate")({ waitUntil(value) { activatePromise = value; } });
await activatePromise;

online = false;
let responsePromise;
listeners.get("fetch")({
  request: { method: "GET", url: origin + "/index.html?kid=offline&age=4", mode: "navigate" },
  respondWith(value) { responsePromise = value; },
});
const offlineNavigation = await responsePromise;
assert.ok(offlineNavigation, "offline navigation receives the cached authoritative root fallback");
assert.match(await offlineNavigation.text(), /network:\/index\.html/);

listeners.get("fetch")({
  request: { method: "GET", url: origin + "/dist/mobile/packages/core/src/tablet-runtime.js", mode: "cors" },
  respondWith(value) { responsePromise = value; },
});
const offlineModule = await responsePromise;
assert.ok(offlineModule, "offline module request is served from precache");
assert.match(await offlineModule.text(), /network:\/dist\/mobile\/packages\/core\/src\/tablet-runtime\.js/);

console.log("service worker offline tests: ok");
