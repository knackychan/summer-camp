import test from "node:test";
import assert from "node:assert/strict";
import { SPRITES, KEY, LANDMARK_SPRITE, spritePixels, frameCount } from "../js/world/planet-sprites.js";
import { SITES } from "../js/world/planet-map.js";
import { TOYS, SKY } from "../js/world/planet-toys.js";
import { C, DARK } from "../js/world/planet-palette.js";

test("every sprite parses with known pixels in every frame and variant", () => {
  for (const name of Object.keys(SPRITES)) {
    for (let f = 0; f < frameCount(name); f++) for (const variant of ["normal", "dark", "sleep"]) {
      const s = spritePixels(name, f, variant, C.pink);
      assert.equal(s.pixels.length, s.width * s.height, name);
      assert.ok(s.pixels.some(v => v >= 0), `${name} is empty`);
      for (const v of s.pixels) assert.ok(v >= -1 && v < 32, `${name} pixel ${v}`);
    }
  }
});

test("explicit second frames keep the first frame's size", () => {
  for (const [name, def] of Object.entries(SPRITES)) {
    if (!def.alt) continue;
    assert.equal(def.alt.length, def.art.length, `${name} height`);
    const width = rows => Math.max(...rows.map(r => r.length));
    assert.equal(width(def.alt), width(def.art), `${name} width`);
  }
});

test("every landmark, toy and sky toy has a sprite; places are big, toys small", () => {
  for (const site of SITES) {
    const name = LANDMARK_SPRITE[site.id];
    assert.ok(SPRITES[name], `${site.id} has no sprite`);
    const h = spritePixels(name, 0, "normal").height - 2;
    assert.ok(h >= (site.id.startsWith("section:") ? 12 : 8) && h <= 18, `${name} height ${h}`);
  }
  for (const toy of TOYS) {
    assert.ok(SPRITES[toy.sprite], `${toy.id} sprite ${toy.sprite}`);
    assert.ok(spritePixels(toy.sprite, 0, "normal").height - 2 <= 13, `${toy.sprite} too tall for a toy`);
  }
  assert.ok(SPRITES[SKY.moon.sprite]);
});

test("hero takes the kid's colour; sleeping places are grey, never red", () => {
  const hero = spritePixels("hero", 0, "normal", C.purple);
  assert.ok(hero.pixels.includes(C.purple) && hero.pixels.includes(DARK[C.purple]));
  for (const name of Object.values(LANDMARK_SPRITE)) {
    const asleep = spritePixels(name, 0, "sleep");
    for (const v of asleep.pixels) assert.ok([-1, C.outline, C.snowShade, C.grey, C.steel].includes(v), `${name} sleep pixel ${v}`);
  }
});

test("outline option rims sprites drawn without one", () => {
  const fish = spritePixels("fish", 0, "normal");
  assert.equal(fish.pixels[0], -1);
  assert.ok(fish.pixels.filter(v => v === C.outline).length > 8);
  assert.ok(Object.keys(KEY).every(ch => ch.length === 1));
});
