/* Brick Lab — Lego-style 3D builder (docs/plans/2026-10-03-brick-lab/).
   A creative tool like Paint: no stars, no score, builds saved per kid on
   this tablet. The runtime lives in js/brick-lab/; this file is only the
   ctx-contract wrapper. */
import { createBrickLab } from "../brick-lab/brick-lab.js";

var meta = { icon: "🧱", title: "Brick Lab", tz: "積木實驗室", blurb: "Build with bricks · 積木建造" };
var lab = null;

async function init(ctx) {
  if (lab) lab.destroy();
  var kid = ctx.kids && ctx.kids[ctx.kid];
  var mount = ctx.mount;
  mount.innerHTML = "";
  mount.classList.add("sqbl-host");
  var mine = lab = createBrickLab(mount, {
    kidId: ctx.kid,
    preReader: !!(kid && kid.age <= 5),
    kids: ctx.kids || {},
    onTap: function () { if (ctx.sfx && ctx.sfx.pop) ctx.sfx.pop(); }
  });
  try {
    await mine.mount();
  } catch (error) {
    mine.destroy();
    if (lab === mine) lab = null;
    throw error;
  }
}

function stop() {
  if (lab) {
    var mount = lab.root;
    lab.destroy();
    mount.classList.remove("sqbl-host");
    lab = null;
  }
}

export default {
  id: "bricklab",
  meta: meta,
  keyboard: false,
  bestKey: null,
  init: init,
  stop: stop,
  /* Host Back goes to the world menu first (multiplayer plan slice 01). */
  back: function () { return !!(lab && !lab.destroyed && lab.back()); },
  snapshot: function () { return lab && !lab.destroyed ? lab.snapshot() : null; }
};
