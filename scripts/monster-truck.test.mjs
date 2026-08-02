import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/games/monster-truck.js", import.meta.url), "utf8");

test("monster truck keeps visuals, steering, and touch controls aligned", () => {
  assert.doesNotMatch(src, /-car\.h \+ Math\.PI \/ 2|-truck\.h \+ Math\.PI \/ 2/);
  assert.match(src, /var steer = \(k\.r \? 1 : 0\) - \(k\.l \? 1 : 0\)/);
  assert.match(src, /setPointerCapture/);
  assert.doesNotMatch(src, /addEventListener\("pointerout"/);
});

test("monster truck updates AI and cold-load state independently of frame timing", () => {
  assert.match(src, /Math\.pow\(0\.98, dt \* 60\)/);
  assert.match(src, /Math\.pow\(1 - 0\.018, dt \* 60\)/);
  assert.match(src, /if \(token !== initToken\) return/);
});
