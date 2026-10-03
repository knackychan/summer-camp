import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("root index is the one authoritative web/PWA/Android entry", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  const androidMeta = JSON.parse(read("dist/android-web/android-build.json"));
  const androidIndex = read("dist/android-web/index.html");
  assert.equal(manifest.start_url, "./index.html");
  assert.equal(manifest.id, "./index.html");
  assert.equal(androidMeta.entry, "index.html");
  assert.equal(androidMeta.runtime, "unified-root");
  assert.equal(existsSync(resolve(root, "dist/android-web/legacy.html")), false);
  assert.match(androidIndex, /id="home"/);
  assert.match(androidIndex, /id="hub"/);
  assert.match(androidIndex, /js\/main\.js/);
  assert.doesNotMatch(androidIndex, /apps\/kid\/src\/main\.js/);
  assert.doesNotMatch(androidIndex, /<iframe/i);
});

test("future exploration surfaces consume one normalized content registry", async () => {
  const context = { console, Promise };
  context.window = context;
  vm.runInNewContext(read("js/content-registry.js"), context, { filename: "content-registry.js" });
  let opened = null;
  context.SQContentRegistry.bind({
    list() {
      return [
        { id:"game:solar", kind:"game", zone:"arcade", icon:"🪐", title:["Solar","太陽系"], blurb:["Explore","探索"], available:true, capabilities:["play"] },
        { id:"book:space", kind:"book", zone:"library", icon:"📚", title:["Space","太空"], available:false },
      ];
    },
    open(entry) { opened = entry.id; return { ok:true, id:entry.id }; },
  });
  assert.equal(context.SQContentRegistry.list().length, 2);
  assert.equal(context.SQContentRegistry.list({ kind:"game" }).length, 1);
  assert.equal(context.SQContentRegistry.zones().find((zone) => zone.id === "arcade").count, 1);
  assert.equal((await context.SQContentRegistry.open("game:solar")).ok, true);
  assert.equal(opened, "game:solar");
  assert.deepEqual(JSON.parse(JSON.stringify(await context.SQContentRegistry.open("book:space"))), { ok:false, reason:"not_available" });
});

test("root runtime owns Android Back across content surfaces", () => {
  const source = read("index.html");
  assert.match(source, /function summerQuestBack\(\)/);
  assert.match(source, /document\.querySelector\("\.book-zoom"\)/);
  assert.match(source, /closeBook\(\);return true/);
  assert.match(source, /closeInstrument\(false\);return true/);
  assert.match(source, /goHome\(\);return true/);
  assert.match(source, /hubKid=null;saveAppPlace\("home"\);showOnly\("home"\);renderHome\(\);return true/);
  assert.match(source, /SQPlatform\.registerBackHandler\)SQPlatform\.registerBackHandler\(summerQuestBack\)/);
});

test("historical standalone book links now return to the real entry instead of a wrapper shell", () => {
  for (const name of ["space","animals","giraffe","minecraft","science","race-cars","construction","public-vehicles"]) {
    const html = read(`books/${name}.html`);
    assert.match(html, /\.\.\/index\.html#books/);
    assert.doesNotMatch(html, /apps\/kid|legacy\.html/);
  }
});

test("prototype kid shell is explicitly non-authoritative", () => {
  const readme = read("apps/kid/README.md");
  assert.match(readme, /not.*authoritative/i);
  assert.match(readme, /prototype/i);
  assert.match(readme, /SQContentRegistry/);
});
