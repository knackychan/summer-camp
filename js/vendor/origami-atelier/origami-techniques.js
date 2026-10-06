/* Technique cards (docs/plans/2026-10-05-origami-audit/ slice 11, design O13). The first time a kid
   meets one of these folds, a card names it, says what it means and loops a mini demo. Pure data
   plus one SVG builder; no state.
   A demo is drawn in a 120 × 90 box. Each shape lists its outline per keyframe (same point count in
   every keyframe, so CSS `d` can morph between them). `turn` = the keyframe where a hinge is edge-on:
   the shape shows its starting face before it and the other face after. */

const NS = "http://www.w3.org/2000/svg";

const t2 = (en, zhHant) => ({ en, zhHant });

/* The long point used by both reverse folds: body below the cut, tip above. */
const POINT_BODY = [[15, 82], [55, 82], [82, 40], [66, 40]];
const tip = (end, mid) => [[[66, 40], [82, 40], [100, 12]], [[66, 40], [82, 40], mid], [[66, 40], [82, 40], end]];

export const TECHNIQUES = {
  "inside-reverse": {
    name: t2("Inside reverse fold", "內反摺"),
    meaning: t2("Push the point inside between the layers.", "把尖角往兩層紙的中間推進去。"),
    /* The tip is drawn under the body: it goes in between the layers and comes out bent. */
    shapes: [
      { face: "front", pts: tip([104, 58], [86, 34]) },
      { face: "front", pts: [POINT_BODY, POINT_BODY, POINT_BODY] },
    ],
  },
  "outside-reverse": {
    name: t2("Outside reverse fold", "外反摺"),
    meaning: t2("Wrap the point around the outside of the layers.", "把尖角翻到外面，包住兩層紙。"),
    /* Drawn over the body and turning over: the inside of the paper shows on the outside. */
    shapes: [
      { face: "front", pts: [POINT_BODY, POINT_BODY, POINT_BODY] },
      { face: "front", turn: 1, pts: tip([104, 58], [92, 40]) },
    ],
  },
  "petal-fold": {
    name: t2("Petal fold", "花瓣摺"),
    meaning: t2("Lift one layer up like opening a flower.", "把一層紙往上掀開，像花打開一樣。"),
    shapes: [
      { face: "front", pts: [[[60, 8], [88, 45], [60, 82], [32, 45]], [[60, 8], [88, 45], [60, 82], [32, 45]], [[60, 8], [88, 45], [60, 82], [32, 45]]] },
      { face: "front", turn: 1, pts: [[[32, 45], [88, 45], [60, 82]], [[39, 45], [81, 45], [60, 47]], [[46, 45], [74, 45], [60, 2]]] },
    ],
  },
  "squash-fold": {
    name: t2("Squash fold", "壓平摺"),
    meaning: t2("Open the flap and press it flat.", "把紙層打開，再壓平。"),
    shapes: [
      { face: "front", pts: [[[20, 80], [100, 80], [60, 20]], [[20, 80], [100, 80], [60, 20]], [[20, 80], [100, 80], [60, 20]]] },
      { face: "front", turn: 1, pts: [[[60, 20], [56, 80], [60, 80], [64, 80]], [[60, 20], [48, 74], [60, 80], [72, 74]], [[60, 20], [34, 60], [60, 80], [86, 60]]] },
    ],
  },
  "rabbit-ear": {
    name: t2("Rabbit-ear fold", "兔耳摺"),
    meaning: t2("Pinch two sides together into a point.", "把兩邊捏在一起，摺出尖角。"),
    /* Both edges fold to the middle line at once; the paper they gather stands up as a point. */
    shapes: [
      { face: "front", pts: [[[10, 45], [60, 30], [110, 45], [60, 60]], [[10, 45], [60, 30], [110, 45], [60, 60]], [[10, 45], [60, 30], [110, 45], [60, 60]]] },
      { face: "front", turn: 1, pts: [[[10, 45], [60, 8], [60, 30]], [[10, 45], [60, 30], [60, 30]], [[10, 45], [60, 45], [60, 30]]] },
      { face: "front", turn: 1, pts: [[[10, 45], [60, 82], [60, 60]], [[10, 45], [60, 60], [60, 60]], [[10, 45], [60, 45], [60, 60]]] },
      { face: "back", pts: [[[60, 30], [60, 45], [60, 60]], [[60, 30], [70, 32], [60, 60]], [[60, 30], [92, 12], [60, 60]]] },
    ],
  },
  "pleat": {
    name: t2("Pleat", "階梯摺"),
    meaning: t2("Fold forward, then back, like a step.", "先往前摺，再往後摺，像樓梯。"),
    /* The top folds down over the paper, then half of it folds back up: a step. */
    shapes: [
      { face: "front", pts: [[[20, 8], [100, 8], [100, 82], [20, 82]], [[20, 30], [100, 30], [100, 82], [20, 82]], [[20, 30], [100, 30], [100, 82], [20, 82]]] },
      { face: "front", turn: 1, pts: [[[20, 8], [100, 8], [100, 30], [20, 30]], [[20, 30], [100, 30], [100, 31], [20, 31]], [[20, 30], [100, 30], [100, 52], [20, 52]]] },
      { face: "front", pts: [[[20, 30], [100, 30], [100, 30], [20, 30]], [[20, 30], [100, 30], [100, 30], [20, 30]], [[20, 30], [100, 30], [100, 41], [20, 41]]] },
    ],
  },
  "crimp": {
    name: t2("Crimp", "曲摺"),
    meaning: t2("A pleat on both layers of a point, so it bends.", "在尖角的兩層紙上一起摺階梯，讓它彎過來。"),
    shapes: [
      { face: "front", pts: [[[30, 82], [90, 82], [70, 36], [50, 36]], [[30, 82], [90, 82], [70, 36], [50, 36]], [[30, 82], [90, 82], [70, 36], [50, 36]]] },
      { face: "front", pts: [[[50, 36], [70, 36], [60, 6]], [[50, 36], [70, 36], [76, 8]], [[50, 36], [70, 36], [98, 18]]] },
      { face: "back", pts: [[[50, 36], [70, 36], [70, 36], [50, 36]], [[50, 36], [70, 36], [70, 40], [50, 40]], [[50, 36], [70, 36], [70, 44], [50, 44]]] },
    ],
  },
  "blintz": {
    name: t2("Blintz fold", "四角摺"),
    meaning: t2("Fold all four corners to the center.", "把四個角都摺到中心點。"),
    /* The middle diamond stays; each corner turns over on the line between the middles of its two
       edges and lands on the centre. */
    shapes: [
      { face: "front", pts: [[[60, 5], [100, 45], [60, 85], [20, 45]], [[60, 5], [100, 45], [60, 85], [20, 45]], [[60, 5], [100, 45], [60, 85], [20, 45]]] },
      ...[[[20, 5], [60, 5], [20, 45]], [[100, 5], [100, 45], [60, 5]], [[100, 85], [60, 85], [100, 45]], [[20, 85], [20, 45], [60, 85]]].map(([c, a, b]) => {
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        return { face: "front", turn: 1, pts: [[c, a, b], [mid, a, b], [[60, 45], a, b]] };
      }),
    ],
  },
};

export function techniqueFor(step) {
  const id = step?.operation;
  return id && TECHNIQUES[id] ? { id, ...TECHNIQUES[id] } : null;
}

const pathD = (poly) => `M ${poly.map(([x, y]) => `${x} ${y}`).join(" L ")} Z`;

/* One loop: the keyframes spread over the first 60 %, a hold, a quick fade, back to the start. */
const LOOP_MS = 4000, MOVE = 0.6, FADE_OUT = 0.92, RESTART = 0.96;

/* Draws a technique's demo into `svg` (an empty <svg viewBox="0 0 120 90">) in the paper's colours.
   Returns its animations (none with reduced motion: it rests on the last keyframe). */
export function drawTechniqueDemo(svg, technique, { front, back, reducedMotion = false }) {
  const group = document.createElementNS(NS, "g");
  svg.append(group);
  const anims = [];
  const colour = (face) => (face === "back" ? back : front);
  const other = (face) => (face === "back" ? "front" : "back");
  for (const shape of technique.shapes) {
    const n = shape.pts.length;
    const at = (i) => (n === 1 ? 0 : MOVE * i / (n - 1));
    const sides = shape.turn == null ? [[shape.face, null]] : [[shape.face, true], [other(shape.face), false]];
    for (const [face, before] of sides) {
      const el = document.createElementNS(NS, "path");
      el.setAttribute("class", "oa-technique-shape");
      el.setAttribute("d", pathD(reducedMotion ? shape.pts[n - 1] : shape.pts[0]));
      el.style.fill = colour(face);
      group.append(el);
      if (reducedMotion) { if (before === true) el.style.opacity = "0"; continue; }
      const frames = shape.pts.map((poly, i) => ({ offset: at(i), d: `path("${pathD(poly)}")`, easing: "ease-in-out" }));
      frames.push({ offset: RESTART, d: frames[frames.length - 1].d }, { offset: RESTART, d: frames[0].d }, { offset: 1, d: frames[0].d });
      anims.push(el.animate(frames, { duration: LOOP_MS, iterations: Infinity }));
      if (before !== null) {
        const swap = at(shape.turn), on = before ? 1 : 0;
        anims.push(el.animate([
          { offset: 0, opacity: on }, { offset: swap, opacity: on }, { offset: swap, opacity: 1 - on },
          { offset: RESTART, opacity: 1 - on }, { offset: RESTART, opacity: on }, { offset: 1, opacity: on },
        ], { duration: LOOP_MS, iterations: Infinity }));
      }
    }
  }
  if (!reducedMotion) {
    anims.push(group.animate([
      { offset: 0, opacity: 1 }, { offset: FADE_OUT - 0.04, opacity: 1 }, { offset: RESTART, opacity: 0 }, { offset: 1, opacity: 1 },
    ], { duration: LOOP_MS, iterations: Infinity }));
  }
  return anims;
}
