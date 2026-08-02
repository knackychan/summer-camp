/* Smoke test for the Paint game: load the module against a stub ctx, fill a
   region, draw a stroke, undo both, swap sheets. Fails loudly if the wiring breaks.
   Manual, not part of check.mjs — it needs a browser and a running server:
     python -m http.server 8123      (from summer-quest/)
     node scripts/paint-smoke.mjs [out.png]
   Uses the vendored playwright in node_modules with the system Edge. */
import { chromium } from "playwright";
import assert from "node:assert";

const b = await chromium.launch({ channel: "msedge" });
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
p.on("console", m => { if (m.type() === "error") console.log("CONSOLE ERROR:", m.text()); });
p.on("pageerror", e => console.log("PAGE ERROR:", e.message));

await p.goto("http://localhost:8123/index.html");
await p.addStyleTag({ content: "#mountTest{position:fixed;inset:0;background:#1c1436;z-index:9999}" });

const out = await p.evaluate(async () => {
  const mount = document.createElement("div");
  mount.id = "mountTest";
  document.body.appendChild(mount);
  const mod = await import("./js/games/paint.js");
  const said = [];
  mod.default.init({
    kid: "lili", mount, stage: mount,
    hud: () => {}, say: () => {}, sayPair: (a, z) => said.push([a, z]),
    sfx: { good() {}, bad() {}, pop() {}, zap() {}, hit() {}, win() {} },
    keys: {}, fx: {}, settings: {}, rand: a => a[0], shuffle: a => a,
    kids: { lili: { raw: "#f8a", color: "#f8a", name: "Lili" } }, best: 0, stars: 3,
    words: {}, finish: () => {}, saveProgress: () => {}, vocab: {}
  });
  return { regions: mount.querySelectorAll("svg .z").length, said };
});
assert.ok(out.regions > 5, "sheet should render fillable regions, got " + out.regions);
assert.equal(out.said[0][0], "Tap a part to fill it with colour!");

/* fill: pick green, tap the roof */
await p.click('.pa__sw[data-col="#3cb44b"]');
const before = await p.$eval('.pa__paper svg .z:nth-of-type(7)', e => e.getAttribute("fill"));
await p.click('.pa__paper svg .z:nth-of-type(7)');
const after = await p.$eval('.pa__paper svg .z:nth-of-type(7)', e => e.getAttribute("fill"));
assert.equal(before, null);
assert.equal(after, "#3cb44b", "tapping a region must fill it");

/* draw: switch to brush and drag across the paper */
await p.click('.pa__btn[data-mode="draw"]');
const box = await p.$eval(".pa__paper", e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
await p.mouse.move(box.x + 60, box.y + 60);
await p.mouse.down();
await p.mouse.move(box.x + 200, box.y + 160, { steps: 12 });
await p.mouse.up();
let ink = await p.$eval(".pa__paper canvas", c => {
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
});
assert.ok(ink > 500, "brush must leave ink on the canvas, got " + ink);

/* undo the stroke, then undo the fill */
await p.click('.pa__btn[data-act="undo"]');
ink = await p.$eval(".pa__paper canvas", c => {
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
});
assert.equal(ink, 0, "undo must remove the stroke, ink left: " + ink);
await p.click('.pa__btn[data-act="undo"]');
/* an unfilled region has no fill attribute; undo restores the <g> default, #fff */
assert.equal(await p.$eval('.pa__paper svg .z:nth-of-type(7)', e => e.getAttribute("fill")), "#fff", "undo must revert the fill");

/* sheet picker swaps the art */
await p.click('.pa__btn[data-act="pick"]');
await p.click('[data-sheet="butterfly"]');
assert.ok(await p.$('.pa__paper svg'), "picker must load a new sheet");
assert.equal(await p.$$eval('.pa__pick', n => n.length), 0, "picker closes after choosing");

/* draw something colourful for the screenshot */
await p.click('.pa__btn[data-mode="fill"]');
/* overlapping art means a centre-click can land on a sibling: dispatch straight
   at the node instead, which is what a tap on the visible part would do anyway */
await p.evaluate(() => {
  const cols = ["#911eb4", "#42d4f4", "#ffe119", "#f032e6", "#3cb44b", "#e6194b"];
  const zs = document.querySelectorAll(".pa__paper svg .z");
  zs.forEach((z, i) => {
    document.querySelector('.pa__sw[data-col="' + cols[i % cols.length] + '"]')
      .dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    z.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  });
});
await p.screenshot({ path: process.argv[2] || "paint.png" });

console.log("paint smoke: OK —", out.regions, "regions, fill/draw/undo/picker all pass");
await b.close();
