import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("miniature world is a real root-runtime surface, not a wrapper", () => {
  const html = read("index.html");
  assert.match(html, /<section id="world" class="hidden"/);
  assert.match(html, /id="worldMount"/);
  assert.match(html, /function openWorld\(id\)/);
  assert.match(html, /resetQuestSession\(id\);openWorld\(id\)/);
  assert.match(html, /\["home","world","game","hub","act","book","music"\]/);
  assert.doesNotMatch(html, /<iframe[^>]+world/i);
});

test("world explorer uses vendored Three.js and content registry only for launches", () => {
  const source = read("js/world/world-explorer.js");
  assert.match(source, /from "\.\.\/vendor\/three\.module\.min\.js"/);
  assert.match(source, /from "\.\.\/vendor\/OrbitControls\.js"/);
  assert.match(source, /registry\.open\(selected\.id,\{origin:"world"\}\)/);
  assert.match(source, /new THREE\.WebGLRenderer/);
  assert.match(source, /new OrbitControls/);
  assert.match(source, /Raycaster/);
  assert.doesNotMatch(source, /iframe|legacy\.html|apps\/kid/);
  assert.doesNotMatch(source, /window\.location|location\.href/);
});

test("world exposes physical destinations and featured real content", () => {
  const source = read("js/world/world-explorer.js");
  for (const id of ["section:quests","section:games","section:acts","section:learn","section:books","section:music","section:day","section:rewards"]) {
    assert.match(source, new RegExp(id.replace(":", "\\:")));
  }
  for (const id of ["game:monster-truck","game:solar","book:space","game:paint"]) {
    assert.match(source, new RegExp(id.replace(":", "\\:")));
  }
});

test("content opened from the world can return to that same surface", () => {
  const html = read("index.html");
  assert.match(html, /function rememberContentReturn\(\)/);
  assert.match(html, /contentReturnSurface=worldVisible\(\)\?"world":"hub"/);
  assert.match(html, /if\(contentReturnSurface==="world"\).*openWorld\(id\)/s);
  assert.match(html, /returnAfterContent\("books"\)/);
  assert.match(html, /returnAfterContent\("music"\)/);
  assert.match(html, /returnAfterContent\(String\(actIdx\).*"learn":"acts"/);
  assert.match(html, /hubReturnSurface==="world"/);
});

test("world runtime is packaged offline for PWA and Android", () => {
  const sw = read("sw.js");
  assert.match(sw, /const CACHE_NAME\s*=\s*["']summer-quest-/);
  assert.match(sw, /\.\/css\/world-explorer\.css/);
  assert.match(sw, /\.\/js\/world\/world-explorer\.js/);
  assert.match(sw, /\.\/js\/vendor\/three\.module\.min\.js/);
  assert.match(sw, /\.\/js\/vendor\/OrbitControls\.js/);
  assert.equal(existsSync(resolve(root, "css/world-explorer.css")), true);
  assert.equal(existsSync(resolve(root, "js/world/world-explorer.js")), true);
});

test("world persistence accepts bounded finite vectors and rejects corrupt saved views", () => {
  const source = read("js/world/world-explorer.js");
  let stored = null;
  const context = { savedViews: new Map(), window: { localStorage: { getItem: () => stored } } };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("function readView("), source.indexOf("function clamp(")), context);
  const valid = { camera: [9, 7, 10], target: [0, 1, 0], selected: "section:books" };
  stored = JSON.stringify(valid);
  assert.equal(context.readView("lucien").selected, valid.selected);
  for (const value of ["broken JSON", "null", '{"camera":[1,2],"target":[0,1,0]}', '{"camera":[1,2,999],"target":[0,1,0]}', '{"camera":[1,2,"3"],"target":[0,1,0]}']) {
    stored = value;
    assert.equal(context.readView("lucien"), null);
  }
});
