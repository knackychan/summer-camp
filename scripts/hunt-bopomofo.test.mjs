import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { bopomofoTargets } from "../js/games/hunt.js";

const require = createRequire(import.meta.url);
const SQBopomofo = require("../js/bopomofo.js");

test("every zhuyin key that a pack word uses gets a picture word", function () {
  const t = bopomofoTargets(SQBopomofo.ROWS, SQBopomofo.WORDS);
  const used = new Set();
  SQBopomofo.WORDS.forEach(function (w) { w[0].split("").forEach(function (c) { used.add(c); }); });
  SQBopomofo.ROWS.flat().forEach(function (sym) {
    assert.equal(sym in t, used.has(sym), "mismatch for " + sym);
  });
  assert.ok(Object.keys(t).length > 30, "pool too small to hunt in");
});

test("targets are emoji + 中文, and prefer a word starting with the symbol", function () {
  const t = bopomofoTargets(SQBopomofo.ROWS, SQBopomofo.WORDS);
  Object.keys(t).forEach(function (sym) {
    const parts = t[sym].split(" ");
    assert.equal(parts.length, 2, sym + " must render as '<emoji> <中文>'");
    assert.ok(/[一-鿿]/.test(parts[1]), sym + " needs a 中文 label");
    const starts = SQBopomofo.WORDS.some(function (w) { return w[0].indexOf(sym) === 0; });
    const hit = SQBopomofo.WORDS.find(function (w) { return w[1] + " " + w[2] === t[sym]; });
    if (starts) assert.equal(hit[0].indexOf(sym), 0, sym + " should borrow a word it starts");
  });
});

test("a symbol no word uses is left out rather than crashing", function () {
  const t = bopomofoTargets([["ㄅ", "ㄗ"]], [["ㄅㄚ", "8️⃣", "八", "八"]]);
  assert.deepEqual(t, { "ㄅ": "8️⃣ 八" });
});
