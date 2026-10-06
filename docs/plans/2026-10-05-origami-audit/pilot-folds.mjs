/* Slice 07: the six ★ models on the paper model. Writes `paper` and every step (text + fold) of
   Little Fox, Dog Face, Cat Face, Swimming Fish, Rabbit Face and Paper Cup into origami-data.js and
   leaves the other 22 models as they are. Re-runnable: node docs/plans/2026-10-05-origami-audit/pilot-folds.mjs
   Coordinates are paper coordinates (the start sheet is the unit square, y down), worked out here
   from named points so creases meet corners exactly. Every model starts as a diamond, white side up. */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { apply, start } from "../../../js/vendor/origami-atelier/origami-paper.js";

const FILE = fileURLToPath(new URL("../../../js/vendor/origami-atelier/origami-data.js", import.meta.url));
const { ORIGAMI_MODELS } = await import(new URL(`file://${FILE.replace(/\\/g, "/")}`));

const r = Math.SQRT1_2;
const T = [0.5, 0.5 - r], R = [0.5 + r, 0.5], B = [0.5, 0.5 + r], L = [0.5 - r, 0.5];
const PAPER = { shape: "square", sheets: 1, startFace: "back", startRotate: 45 };

const round = (v) => Math.round(v * 1e10) / 1e10;
const pt = (p) => [round(p[0]), round(p[1])];
const dir = (deg) => [Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)];
/* Where the ray from p along d meets the line through a, b. */
function meet(p, d, a, b) {
  const ex = b[0] - a[0], ey = b[1] - a[1];
  const t = ((a[0] - p[0]) * ey - (a[1] - p[1]) * ex) / (d[0] * ey - d[1] * ex);
  return [p[0] + d[0] * t, p[1] + d[1] * t];
}
const mirror = ([x, y]) => [1 - x, y];
const valley = (a, b, move, extra = {}) => ({ op: "valley", line: [pt(a), pt(b)], move: pt(move), ...extra });
const mountain = (a, b, move, extra = {}) => ({ op: "mountain", line: [pt(a), pt(b)], move: pt(move), ...extra });
const precrease = (a, b, move) => ({ op: "precrease", line: [pt(a), pt(b)], move: pt(move) });
const level = (y) => [[0, y], [1, y]];
const t2 = (en, zhHant) => ({ en, zhHant });
const step = (title, instruction, hint, operation, diagram, fold) => ({ title, instruction, hint, diagram, operation, fold });
const finish = (diagram, title, instruction, hint) => step(title, instruction, hint, "finish", diagram, { op: "finish" });
const WHITE = ["Start white side up. ", "白色面朝上。"];
const half = { op: "valley", line: level(0.5) };

const PILOT = {
  /* Triangle point down; each ear turns up on a crease from the bottom point; turn over so the
     ears stand up behind the face; a small fold at the tip makes the muzzle. */
  "little-fox": () => {
    const aL = [0.05, 0.5], aR = mirror(aL);
    return [
      step(t2("Diagonal fold", "對角摺"), t2("Bring the top corner to the bottom corner.", "把上方角摺到下方角。"),
        t2(WHITE[0] + "Match the corners first, then make the crease.", WHITE[1] + "先對齊兩個角，再壓出摺痕。"), "valley-fold", "diag-down", { ...half, move: pt(T) }),
      step(t2("Left ear", "左耳"), t2("Fold the left corner up on a line from the bottom point.", "從下方尖角往上，把左邊的角往上摺。"),
        t2("Leave a little point above the head.", "讓尖角稍微高出頭頂。"), "valley-fold", "ear-left", valley(aL, B, L)),
      step(t2("Right ear", "右耳"), t2("Fold the right corner up the same way.", "用同樣的方法，把右邊的角往上摺。"),
        t2("Try to make it match the other ear.", "盡量和另一邊耳朵一樣高。"), "valley-fold", "ear-right", valley(aR, B, R)),
      step(t2("Turn it over", "翻面"), t2("Turn the fox over.", "把小狐狸翻到另一面。"),
        t2("Now the ears stand up behind the face.", "耳朵會從臉的後面立起來。"), "flip", "flip", { op: "flip" }),
      step(t2("Make the muzzle", "做出嘴巴"), t2("Fold the bottom tip up a little.", "把下方尖角往上摺一點點。"),
        t2("Press the small crease gently.", "輕輕壓好這個小摺痕。"), "valley-fold", "tip-up", valley(...level(1.07), [0.5, 1.15])),
      finish("finish-fox", t2("Finish the fox", "完成小狐狸"), t2("Your fox is ready. Look at its face!", "小狐狸完成了，看看牠的臉！"),
        t2("You can draw a face later if you want.", "想要的話，完成後可以畫上表情。")),
    ];
  },
  /* Triangle point down; floppy ears fold down onto the face; the top layer of the bottom point
     folds up (nose), the layer behind folds back (chin). */
  "dog-face": () => {
    const aL = [0.28, 0.5], cL = meet(aL, dir(130), L, B);
    const aR = mirror(aL), cR = mirror(cL);
    return [
      step(t2("Make a triangle", "摺成三角形"), t2("Fold the top corner down to the bottom corner.", "把上方角往下摺到下方角，摺成三角形。"),
        t2(WHITE[0] + "Line up the corners.", WHITE[1] + "先把角對齊。"), "valley-fold", "diag-down", { ...half, move: pt(T) }),
      step(t2("Left ear", "左耳"), t2("Fold the left point down onto the face.", "把左側尖角往下摺到臉上。"),
        t2("Let the ear hang beside the face.", "讓耳朵垂在臉旁。"), "valley-fold", "ear-down-left", valley(aL, cL, L)),
      step(t2("Right ear", "右耳"), t2("Fold the right point down the same way.", "用同樣的方法，把右側尖角往下摺。"),
        t2("Match the first ear.", "和另一邊耳朵差不多即可。"), "valley-fold", "ear-down-right", valley(aR, cR, R)),
      step(t2("Nose", "鼻子"), t2("Fold only the top layer of the bottom point up.", "只把下方尖角的上層往上摺。"),
        t2("This makes the nose.", "這是小狗的鼻子。"), "valley-fold", "tip-up", valley(...level(1.0), [0.5, 1.15], { layers: "top" })),
      step(t2("Chin", "下巴"), t2("Fold the point behind it backward.", "把後面那層尖角往後摺。"),
        t2("Now the chin is flat.", "下巴就變平了。"), "mountain-fold", "bottom-back", mountain(...level(1.0), [0.5, 1.15])),
      finish("finish-dog", t2("Finish the dog", "完成小狗"), t2("Your dog face is ready.", "小狗臉完成了。"),
        t2("Add eyes and a nose after folding if you like.", "喜歡的話可以再畫眼睛和鼻子。")),
    ];
  },
  /* Triangle point up; a middle crease; the top tip folds down (forehead) so the head is flat; the
     bottom corners turn up so their tips stand above it (ears); a thin strip at the bottom folds
     back (chin). The forehead comes before the ears so the ears can stand tall over it. */
  "cat-face": () => {
    const aL = [0.36, 0.5], cL = meet(aL, dir(219), L, T);
    const aR = mirror(aL), cR = mirror(cL);
    return [
      step(t2("Make a triangle", "摺成三角形"), t2("Fold the bottom corner up to the top corner.", "把下方角往上摺到上方角。"),
        t2(WHITE[0] + "Keep the long edge at the bottom.", WHITE[1] + "讓長邊朝下。"), "valley-fold", "diag-up", { ...half, move: pt(B) }),
      step(t2("Find the middle", "找出中間"), t2("Make a light center crease.", "輕輕摺出中間線。"),
        t2("Open it again after marking the middle.", "只要做記號，再打開。"), "precrease", "center-mark", precrease([0.5, 0], [0.5, 1], [0.2, 0.4])),
      step(t2("Forehead", "額頭"), t2("Fold the top tip down to make the head flat.", "把最上面的尖角往下摺，讓頭頂變平。"),
        t2("Fold it down a little less than halfway.", "往下摺，不到一半的地方。"), "valley-fold", "top-down", valley(...level(0.1), [0.5, -0.1])),
      step(t2("Left ear", "左耳"), t2("Fold the left corner up so its tip stands above the head.", "把左邊的角往上摺，讓尖角立在頭頂上面。"),
        t2("Start the fold a little left of the middle crease.", "從中間摺線左邊一點點開始摺。"), "valley-fold", "ear-left", valley(aL, cL, L)),
      step(t2("Right ear", "右耳"), t2("Fold the right corner up the same way.", "用同樣的方法，把右邊的角往上摺。"),
        t2("Match the height of the first ear.", "高度和第一隻耳朵接近。"), "valley-fold", "ear-right", valley(aR, cR, R)),
      step(t2("Chin", "下巴"), t2("Fold the bottom edge backward a little.", "把下方的邊往後摺一點點。"),
        t2("A thin strip is enough.", "摺一小條就好。"), "mountain-fold", "bottom-back", mountain(...level(0.44), [0.5, 0.48])),
      finish("finish-cat", t2("Finish the cat", "完成小貓"), t2("Your cat face is ready.", "小貓臉完成了。"),
        t2("Whiskers can be drawn after the fold.", "完成後可以畫上鬍鬚。")),
    ];
  },
  /* A middle crease, the two lower edges to it (a kite, long point down), the long point folded out
     to the side as a tail, turn over, the top tip back for the nose. The fish swims upward. */
  "swimming-fish": () => {
    const pL = meet(B, dir(247.5), L, T), pR = mirror(pL);
    return [
      step(t2("Middle crease", "中間摺痕"), t2("Fold the square in half into a triangle, then open it again.", "把正方形對摺成三角形，再打開。"),
        t2(WHITE[0] + "Keep the crease from top to bottom.", WHITE[1] + "保留從上到下的摺痕。"), "precrease", "diag-open", precrease([0.5, 0], [0.5, 1], [0.1, 0.5])),
      step(t2("Left side in", "左邊往內"), t2("Fold the bottom-left edge onto the middle crease.", "把左下邊摺到中間摺痕上。"),
        t2("Let the edge lie on the crease.", "讓邊緣貼齊摺痕。"), "valley-fold", "side-left", valley(B, pL, L)),
      step(t2("Right side in", "右邊往內"), t2("Fold the bottom-right edge onto the middle crease.", "把右下邊摺到中間摺痕上。"),
        t2("Make a kite shape.", "摺出風箏形。"), "valley-fold", "side-right", valley(B, pR, R)),
      step(t2("Make the tail", "做出魚尾"), t2("Fold the long bottom point out to the right.", "把下方的長尖角往右摺出去。"),
        t2("This becomes the tail fin.", "這會變成魚尾。"), "valley-fold", "tail-right", valley([0.2, 0.4], [0.7, 0.9], [0.5, 1.15])),
      step(t2("Turn it over", "翻面"), t2("Flip the whole model over.", "把整個作品翻到另一面。"),
        t2("Keep the tail pointing sideways.", "讓尾巴保持朝側邊。"), "flip", "flip", { op: "flip" }),
      step(t2("Shape the nose", "做出魚頭"), t2("Fold the top tip slightly backward.", "把上方尖角稍微往後摺。"),
        t2("A tiny fold softens the nose.", "小小一摺就好。"), "mountain-fold", "nose-back", mountain(...level(-0.06), [0.5, -0.15])),
      finish("finish-fish", t2("Finish the fish", "完成小魚"), t2("Your fish is ready to swim.", "小魚完成，可以游泳了。"),
        t2("Add an eye after folding if you like.", "喜歡的話可以畫上一隻眼睛。")),
    ];
  },
  /* Triangle point up, turned around; tall ears turn up on creases from the bottom point with a gap
     between them; turn over so they stand behind the head; a small fold at the tip for the chin. */
  "rabbit-face": () => {
    /* After the turn the triangle is L(−r+.5, y0), R(.5+r, y0), point (0.5, 0.5). */
    const y0 = 0.5 - r, P = [0.5, 0.5];
    const aL = [0.17, y0], aR = mirror(aL);
    return [
      step(t2("Make a triangle", "摺成三角形"), t2("Fold the bottom corner up to the top corner.", "把下方角往上摺到上方角。"),
        t2(WHITE[0] + "Match the corners before pressing.", WHITE[1] + "先把兩個角對齊再壓摺痕。"), "valley-fold", "diag-up", { ...half, move: pt(B) }),
      step(t2("Turn the triangle", "轉動三角形"), t2("Rotate so the long edge is at the top.", "把三角形轉到長邊朝上。"),
        t2("Keep the point facing down.", "尖角朝下。"), "rotate", "rotate-180", { op: "rotate", deg: 180 }),
      step(t2("Left ear", "左耳"), t2("Fold the left corner up on a line from the bottom point.", "從下方尖角往上，把左角往上摺。"),
        t2("Leave a narrow gap near the middle.", "中央留一點小縫。"), "valley-fold", "ear-left", valley(aL, P, [L[0] + 0.05, y0 + 0.02])),
      step(t2("Right ear", "右耳"), t2("Fold the right corner up the same way.", "用同樣的方法，把右角往上摺。"),
        t2("Try to match the first ear.", "盡量和左耳一樣。"), "valley-fold", "ear-right", valley(aR, P, [R[0] - 0.05, y0 + 0.02])),
      step(t2("Turn it over", "翻面"), t2("Turn the rabbit over.", "把兔子翻到另一面。"),
        t2("Now the ears stand up behind the head.", "耳朵會在頭的後面立起來。"), "flip", "flip", { op: "flip" }),
      step(t2("Make the chin", "做出下巴"), t2("Fold the bottom point upward.", "把下方尖角往上摺。"),
        t2("Keep the fold small.", "摺一小段就好。"), "valley-fold", "tip-up", valley(...level(0.36), [0.5, 0.45])),
      finish("finish-rabbit", t2("Finish the rabbit", "完成兔子"), t2("Your rabbit is ready. Open the ears a little.", "兔子完成了，把耳朵稍微張開。"),
        t2("Draw a face after folding if you like.", "喜歡的話可以畫上表情。")),
    ];
  },
  /* The classic cup: triangle point up; each side corner across to the opposite edge with the top of
     the flap level; the front top flap down into the front pocket, the back one down behind; open. */
  "paper-cup": () => {
    const eR = meet(L, dir(-22.5), T, R), eL = mirror(eR);
    const rim = eR[1];
    return [
      step(t2("Triangle base", "三角形底"), t2("Fold the square diagonally into a triangle.", "把正方形沿對角線摺成三角形。"),
        t2(WHITE[0] + "Put the long edge at the bottom.", WHITE[1] + "長邊朝下。"), "valley-fold", "diag-up", { ...half, move: pt(B) }),
      step(t2("Left corner across", "左角摺過去"), t2("Fold the left corner across to the right edge.", "把左角摺過去，碰到右邊的斜邊。"),
        t2("Keep the top of the flap level.", "讓摺過去那片的上緣保持水平。"), "valley-fold", "left-across", { op: "valley", line: perp(L, eR), move: pt(L) }),
      step(t2("Right corner across", "右角摺過去"), t2("Fold the right corner across to the left edge.", "把右角摺過去，碰到左邊的斜邊。"),
        t2("Match the height of the first fold.", "高度和第一摺差不多。"), "valley-fold", "right-across", { op: "valley", line: perp(R, eL), move: pt(R) }),
      step(t2("Front rim down", "前面杯口往下"), t2("Fold the front top flap downward.", "把前方上層往下摺。"),
        t2("Fold it over the crossed corners.", "蓋住剛才交叉的紙層。"), "valley-fold", "top-down", valley(...level(rim), [0.5, -0.1], { layers: "top" })),
      step(t2("Back rim down", "後面杯口往下"), t2("Fold the back top flap down behind the cup.", "把後面那片上層往後摺下來。"),
        t2("Make both rim folds similar.", "前後杯口高度一致。"), "mountain-fold", "top-back", mountain(...level(rim), [0.5, -0.1])),
      step(t2("Open the cup", "打開紙杯"), t2("Open the pocket from the top.", "從上方把口袋撐開。"),
        t2("Use two fingers and widen gently.", "用兩根手指輕輕撐開。"), "spread", "spread-top", { op: "keyframe", to: "open-cup" }),
      finish("finish-cup", t2("Flatten the base", "壓平杯底"), t2("Pinch the lower corners so the cup shape holds.", "捏整底部兩角，讓杯形固定。"),
        t2("Do not put liquid in craft paper.", "一般摺紙不適合裝液體。")),
    ];
  },
};

/* The crease that lays point p onto point q. */
function perp(p, q) {
  const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], v = [q[1] - p[1], p[0] - q[0]];
  return [pt([m[0] - v[0], m[1] - v[1]]), pt([m[0] + v[0], m[1] + v[1]])];
}

/* Opening the cup: seen from the front it gets narrower and taller (the base stays). x × 0.88 and
   y ÷ 0.88 keeps every facet's area. */
function openCup(state) {
  const k = 0.88, to = {};
  for (const f of state.facets) to[f.id] = f.poly.map(([x, y]) => [Math.round((0.5 + (x - 0.5) * k) * 1e9) / 1e9, Math.round((0.5 + (y - 0.5) / k) * 1e9) / 1e9]);
  return to;
}

for (const [id, build] of Object.entries(PILOT)) {
  const model = ORIGAMI_MODELS.find((m) => m.id === id);
  model.paper = { ...PAPER };
  const steps = build();
  let state = start(model);
  model.steps = steps.map((s, i) => {
    if (s.fold.to === "open-cup") s.fold.to = openCup(state);
    state = apply(state, s.fold).state;
    return { id: `step-${String(i + 1).padStart(2, "0")}`, ...s };
  });
}

/* Same layout as before (JSON, two spaces), with each `fold` on one line. */
const folds = [];
const json = JSON.stringify(ORIGAMI_MODELS, (k, v) => (k === "fold" ? `@@FOLD${folds.push(v) - 1}@@` : v), 2)
  .replace(/"@@FOLD(\d+)@@"/g, (_, i) => JSON.stringify(folds[i]));
const src = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");
const end = src.indexOf("\n];\n") + 4;
fs.writeFileSync(FILE, `export const ORIGAMI_MODELS = ${json};\n${src.slice(end)}`);
console.log("pilot folds written:", Object.keys(PILOT).join(", "));
