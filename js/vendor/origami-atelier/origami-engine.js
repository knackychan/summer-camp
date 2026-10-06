import { area, centroid, clipByLine, foldArrow, hingeSamples, hingeTransform, reflect, sideOf, turnTransform } from "./origami-fold.js";

const NS = "http://www.w3.org/2000/svg";

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}

function points(list) {
  return list.map(([x, y]) => `${x},${y}`).join(" ");
}

const SHAPES = {
  square: [[75,30],[225,30],[225,180],[75,180]],
  triangleDown: [[75,30],[225,30],[150,180]],
  triangleUp: [[150,30],[225,180],[75,180]],
  diamond: [[150,25],[230,105],[150,185],[70,105]],
  kite: [[150,25],[205,105],[150,185],[95,105]],
  slimKite: [[150,20],[185,105],[150,190],[115,105]],
  rectangle: [[75,70],[225,70],[225,145],[75,145]],
  smallSquare: [[105,60],[195,60],[195,150],[105,150]],
  waterbomb: [[150,35],[225,105],[150,175],[75,105]],
};

const FINISH_SHAPES = {
  "finish-boat": [[65,145],[100,85],[200,85],[235,145],[150,165]],
  "finish-butterfly": [[150,105],[70,55],[105,110],[75,165],[150,120],[225,165],[195,110],[230,55]],
  "finish-heart": [[150,180],[72,100],[82,60],[120,45],[150,75],[180,45],[218,60],[228,100]],
  "finish-tulip": [[150,178],[88,98],[75,45],[128,72],[150,30],[172,72],[225,45],[212,98]],
  "finish-fish": [[80,105],[145,55],[205,70],[238,45],[225,105],[238,165],[205,140],[145,155]],
  "finish-fox": [[85,65],[112,35],[135,65],[165,65],[188,35],[215,65],[205,145],[150,180],[95,145]],
  "finish-cat": [[85,65],[112,35],[135,65],[165,65],[188,35],[215,65],[205,145],[150,180],[95,145]],
  "finish-dog": [[85,65],[112,42],[128,70],[172,70],[188,42],[215,65],[205,145],[150,180],[95,145]],
  "finish-rabbit": [[95,92],[108,28],[133,80],[167,80],[192,28],[205,92],[195,155],[150,182],[105,155]],
  "finish-penguin": [[150,25],[195,70],[202,132],[177,177],[150,188],[123,177],[98,132],[105,70]],
  "finish-whale": [[75,115],[115,72],[185,72],[215,93],[238,60],[228,115],[238,155],[207,135],[180,152],[110,150]],
  "finish-owl": [[88,70],[115,35],[150,62],[185,35],[212,70],[205,155],[170,180],[150,158],[130,180],[95,155]],
  "finish-turtle": [[85,105],[112,72],[175,62],[205,92],[235,103],[207,118],[192,156],[160,142],[125,158],[105,125],[75,130]],
  "finish-frog": [[95,68],[125,45],[150,70],[175,45],[205,68],[218,118],[190,112],[225,165],[170,145],[130,145],[75,165],[110,112],[82,118]],
  "finish-crane": [[65,120],[125,92],[150,48],[168,92],[235,55],[205,112],[235,165],[160,135],[150,185],[140,135],[95,160]],
  "finish-swan": [[80,148],[125,112],[155,120],[170,85],[165,45],[190,25],[181,55],[200,88],[185,120],[225,148],[170,160],[120,160]],
  "finish-pigeon": [[75,118],[125,86],[155,98],[182,65],[205,72],[190,92],[230,130],[170,128],[145,158],[120,128]],
  "finish-helmet": [[78,135],[95,75],[120,100],[108,45],[145,78],[150,55],[155,78],[192,45],[180,100],[205,75],[222,135]],
  "finish-box": [[92,78],[208,78],[225,96],[225,155],[208,172],[92,172],[75,155],[75,96]],
  "finish-cup": [[88,68],[212,68],[190,170],[110,170]],
  "finish-envelope": [[75,62],[225,62],[225,168],[75,168],[75,100],[150,145],[225,100]],
  "finish-fortune": [[150,42],[190,82],[230,105],[190,128],[150,168],[110,128],[70,105],[110,82]],
  "finish-pinwheel": [[150,105],[82,65],[120,108],[72,145],[145,122],[185,175],[180,120],[228,72],[170,92],[155,35]],
  "finish-waterbomb": [[105,58],[195,58],[225,105],[195,152],[105,152],[75,105]],
  "finish-lotus": [[150,100],[115,35],[128,88],[72,65],[112,112],[65,150],[128,132],[150,188],[172,132],[235,150],[188,112],[228,65],[172,88],[185,35]],
  "finish-elephant": [[85,95],[115,62],[160,62],[190,80],[205,120],[222,145],[212,160],[192,130],[180,170],[155,132],[125,170],[118,128],[82,128]],
  "finish-dinosaur": [[70,142],[112,125],[125,82],[150,40],[172,25],[164,62],[188,98],[225,118],[205,138],[190,170],[170,132],[145,132],[128,170],[112,135]],
  "finish-dragon": [[65,128],[112,110],[78,62],[132,94],[145,48],[165,26],[160,70],[185,90],[235,60],[205,112],[238,155],[178,130],[165,180],[148,138],[125,172],[118,132]],
};

function baseDiagram() {
  return {
    base: SHAPES.square,
    after: SHAPES.square,
    flap: [[75,30],[225,30],[225,180]],
    crease:[[75,30],[225,180]],
    arrow:[[95,155],[145,110],[190,70]],
    rotate:-22, dx:12, dy:-8
  };
}

function finishDiagram(name) {
  const shape = FINISH_SHAPES[name];
  if (!shape) return null;
  return {...baseDiagram(), base:shape, after:shape, flap:null, crease:null, arrow:null};
}

function diagramFor(name) {
  const base = baseDiagram();
  const finish = finishDiagram(name);
  if (finish) return finish;

  if (name === "diag-cross") return {...base, flap:null, arrow:null, crease:[[75,30],[225,180]], extraCrease:[[225,30],[75,180]]};
  if (name.startsWith("diag")) {
    const other = name.includes("other");
    const open = name.includes("open") || name.includes("mark");
    return {...base,
      crease:other?[[225,30],[75,180]]:[[75,30],[225,180]],
      flap:open?null:(other?[[225,30],[225,180],[75,180]]:[[75,30],[75,180],[225,180]]),
      arrow:open?null:(other?[[205,150],[160,115],[110,70]]:[[95,155],[145,110],[195,65]]),
      after:open?SHAPES.square:(name==="diag-down"?SHAPES.triangleDown:name==="diag-up"?SHAPES.triangleUp:SHAPES.square)
    };
  }

  if (name.startsWith("half-down")) {
    const open=name.includes("open");
    return {...base, crease:[[75,105],[225,105]], flap:open?null:[[75,30],[225,30],[225,105],[75,105]], arrow:open?null:[[150,60],[150,92],[150,145]], rotate:0, dy:55, dx:0, after:open?SHAPES.square:[[75,105],[225,105],[225,180],[75,180]]};
  }
  if (name.startsWith("half-vertical")) {
    const open=name.includes("open");
    return {...base, crease:[[150,30],[150,180]], flap:open?null:[[75,30],[150,30],[150,180],[75,180]], arrow:open?null:[[95,105],[122,105],[172,105]], rotate:0, dx:55,dy:0, after:open?SHAPES.square:[[150,30],[225,30],[225,180],[150,180]]};
  }
  if (name === "center-mark") return {...base, crease:[[150,30],[150,180]], flap:null, arrow:null};
  if (name === "unfold") return {...base, base:SHAPES.triangleDown, after:SHAPES.square, flap:SHAPES.triangleDown, crease:[[75,30],[225,180]], arrow:[[150,125],[125,85],[95,55]], rotate:18, dx:-8, dy:-8};
  if (name === "rotate-180") return {...base, base:SHAPES.triangleDown, after:SHAPES.triangleDown, flap:SHAPES.triangleDown, crease:null, arrow:[[220,105],[150,42],[80,105]], rotate:180, dx:0,dy:0};
  if (name === "flip") return {...base, base:SHAPES.diamond, after:SHAPES.diamond, flap:SHAPES.diamond, crease:null, arrow:[[215,105],[150,55],[85,105]], rotate:180, dx:0,dy:0};

  if (name === "square-base") return {...base, base:SHAPES.square, after:SHAPES.smallSquare, flap:[[75,30],[225,30],[150,105]], crease:[[75,105],[225,105]], arrow:[[85,105],[120,105],[150,105]], rotate:0,dx:35,dy:0};
  if (name === "waterbomb-base" || name === "collapse") return {...base, base:SHAPES.square, after:SHAPES.triangleDown, flap:[[75,30],[150,105],[75,180]], crease:[[75,30],[75,180]], arrow:[[82,105],[112,105],[148,105]], rotate:0,dx:34,dy:0};

  if (name.startsWith("blintz")) return {...base, base:SHAPES.square, after:SHAPES.diamond, flap:[[75,30],[150,30],[150,105],[75,105]], crease:[[75,105],[150,30]], arrow:[[86,48],[112,72],[146,101]], rotate:28,dx:30,dy:28, reach:1};
  if (name === "kite-both") return {...base, base:SHAPES.square, after:SHAPES.kite, flap:[[75,30],[150,30],[150,180],[75,180]], crease:[[150,30],[150,180]], arrow:[[92,105],[118,105],[148,105]], rotate:12,dx:30,dy:0};

  if (name.startsWith("inside-reverse")) {
    const left=name.includes("left"), right=name.includes("right") || name.includes("tail"), pair=name.includes("pair");
    const flap=pair?[[95,105],[150,185],[205,105]]:left?[[95,105],[150,185],[150,105]]:right?[[205,105],[150,185],[150,105]]:[[150,25],[115,95],[185,95]];
    const crease=pair?[[95,105],[205,105]]:left?[[150,105],[150,185]]:right?[[150,105],[150,185]]:[[115,95],[185,95]];
    const arrow=pair?[[150,165],[150,120],[150,72]]:left?[[125,155],[110,118],[128,78]]:right?[[175,155],[190,118],[172,78]]:[[150,55],[150,88],[150,122]];
    return {...base, base:SHAPES.slimKite, after:SHAPES.kite, flap, crease, arrow, rotate:left?-38:right?38:24, dx:left?-18:right?18:0,dy:-34};
  }

  if (name.startsWith("outside-reverse")) return {...base, base:SHAPES.kite, after:SHAPES.kite, flap:[[150,25],[128,62],[172,62]], crease:[[128,62],[172,62]], arrow:[[150,42],[178,58],[186,86]], rotate:48,dx:20,dy:18};

  if (name.includes("squash") || name.startsWith("pocket")) {
    const top=name.includes("top"), bottom=name.includes("bottom") || name.includes("back"), left=name.includes("left"), right=name.includes("right");
    const flap=top?[[150,25],[95,105],[205,105]]:bottom?[[150,185],[95,105],[205,105]]:left?[[70,105],[150,25],[150,185]]:right?[[230,105],[150,25],[150,185]]:[[150,25],[230,105],[150,185]];
    const crease=top||bottom?[[95,105],[205,105]]:[[150,25],[150,185]];
    const arrow=top?[[150,45],[150,78],[150,110]]:bottom?[[150,166],[150,138],[150,108]]:left?[[88,105],[120,105],[150,105]]:[[212,105],[182,105],[150,105]];
    return {...base, base:SHAPES.diamond, after:SHAPES.kite, flap, crease, arrow, rotate:0,dx:left?34:right?-34:0,dy:top?42:bottom?-42:0};
  }

  if (name.startsWith("petal")) {
    const back=name.includes("back"), invert=name.includes("invert"), layer=name.includes("layer"), soften=name.includes("soften");
    if (soften) return {...base, base:SHAPES.diamond, after:SHAPES.diamond, flap:null, crease:[[95,105],[205,105]], arrow:[[150,105],[150,82],[150,58]]};
    return {...base, base:SHAPES.diamond, after:SHAPES.slimKite, flap:[[150,185],[95,105],[205,105]], crease:[[95,105],[205,105]], arrow:[[150,165],[150,118],[150,42]], rotate:back?-8:8, dx:0,dy:-62, opacity:invert||layer?0.65:1};
  }

  if (name.startsWith("rabbit-ear") || name.includes("ear-out")) {
    const left=name.includes("left"), right=name.includes("right");
    const flap=left?[[70,105],[150,25],[150,105]]:right?[[230,105],[150,25],[150,105]]:[[150,25],[120,70],[180,70]];
    const arrow=left?[[90,105],[112,78],[135,55]]:right?[[210,105],[188,78],[165,55]]:[[150,42],[178,58],[188,82]];
    return {...base, base:SHAPES.diamond, after:SHAPES.kite, flap, crease:left?[[150,25],[150,105]]:right?[[150,25],[150,105]]:[[120,70],[180,70]], arrow, rotate:left?-36:right?36:28, dx:left?-24:right?24:18,dy:-18};
  }

  if (name.startsWith("pleat") || name.startsWith("crimp")) {
    const vertical=name.includes("left")||name.includes("right")||name.includes("tail");
    return {...base, base:SHAPES.kite, after:SHAPES.kite,
      flap:vertical?[[150,25],[205,105],[150,185]]:[[95,105],[205,105],[150,185]],
      crease:vertical?[[150,25],[150,185]]:[[95,128],[205,128]],
      extraCrease:vertical?[[168,25],[168,185]]:[[95,145],[205,145]],
      arrow:vertical?[[196,105],[175,105],[155,105]]:[[150,168],[150,142],[150,116]],
      rotate:vertical?-12:0,dx:vertical?-18:0,dy:vertical?0:-22};
  }

  if (name.startsWith("spread")) {
    const top=name.includes("top"), bottom=name.includes("bottom")||name.includes("back"), opposite=name.includes("opposite");
    return {...base, base:SHAPES.kite, after:opposite?SHAPES.diamond:SHAPES.waterbomb,
      flap:[[150,105],[95,105],[150,185],[205,105]], crease:[[95,105],[205,105]],
      arrow:top?[[150,105],[150,72],[150,45]]:bottom?[[150,105],[150,138],[150,172]]:[[150,105],[120,80],[92,62]],
      rotate:0,dx:0,dy:top?-30:bottom?30:0};
  }

  if (name.startsWith("tuck")) return {...base, base:SHAPES.diamond, after:SHAPES.kite, flap:[[205,105],[150,65],[150,145]], crease:[[150,65],[150,145]], arrow:[[205,105],[180,105],[155,105]], rotate:-16,dx:-28,dy:0};

  if (name.startsWith("box-wall")) {
    const left=name.includes("left"), right=name.includes("right"), top=name.includes("top"), bottom=name.includes("bottom");
    return {...base, base:SHAPES.smallSquare, after:SHAPES.rectangle,
      flap:left?[[105,60],[135,60],[135,150],[105,150]]:right?[[165,60],[195,60],[195,150],[165,150]]:top?[[105,60],[195,60],[195,90],[105,90]]:[[105,120],[195,120],[195,150],[105,150]],
      crease:left?[[135,60],[135,150]]:right?[[165,60],[165,150]]:top?[[105,90],[195,90]]:[[105,120],[195,120]],
      arrow:left?[[115,105],[138,105],[160,105]]:right?[[185,105],[162,105],[140,105]]:top?[[150,70],[150,92],[150,112]]:[[150,140],[150,118],[150,98]],
      rotate:0,dx:left?25:right?-25:0,dy:top?25:bottom?-25:0};
  }
  if (name === "box-raise-sides" || name === "box-lock-top") return {...base, base:SHAPES.smallSquare, after:[[95,82],[205,82],[220,98],[220,155],[205,170],[95,170],[80,155],[80,98]], flap:[[105,60],[195,60],[195,92],[105,92]], crease:[[105,92],[195,92]], arrow:[[150,70],[150,94],[150,128]], rotate:0,dx:0,dy:28};

  if (name.startsWith("pair-")) {
    const up=name.includes("up"), inward=name.includes("in");
    return {...base, base:SHAPES.triangleDown, after:SHAPES.diamond, flap:[[75,180],[150,105],[225,180]], crease:[[75,180],[225,180]], arrow:up?[[150,170],[150,125],[150,72]]:[[88,105],[120,105],[150,105]], rotate:0,dx:0,dy:up?-50:0};
  }

  if (name === "top-to-center" || name === "top-center") return {...base, base:SHAPES.diamond, after:SHAPES.kite, flap:[[150,25],[95,105],[205,105]], crease:[[95,105],[205,105]], arrow:[[150,42],[150,72],[150,104]], rotate:0,dx:0,dy:55, reach:1};
  if (name === "bottom-to-center" || name === "bottom-to-top") return {...base, base:SHAPES.diamond, after:SHAPES.kite, flap:[[150,185],[95,105],[205,105]], crease:[[95,105],[205,105]], arrow:[[150,168],[150,138],[150,104]], rotate:0,dx:0,dy:-55, reach:name==="bottom-to-center"?1:0};
  if (name === "left-to-center" || name === "left-to-bottom" || name === "left-across") return {...base, base:SHAPES.diamond, after:SHAPES.kite, flap:[[70,105],[150,25],[150,185]], crease:[[150,25],[150,185]], arrow:[[88,105],[120,105],[150,105]], rotate:20,dx:32,dy:0, reach:name==="left-to-center"?1:0, to:name==="left-to-bottom"?[150,185]:null};
  if (name === "right-to-center" || name === "right-to-bottom" || name === "right-across") return {...base, base:SHAPES.diamond, after:SHAPES.kite, flap:[[230,105],[150,25],[150,185]], crease:[[150,25],[150,185]], arrow:[[212,105],[180,105],[150,105]], rotate:-20,dx:-32,dy:0, reach:name==="right-to-center"?1:0, to:name==="right-to-bottom"?[150,185]:null};

  if (name.includes("heart-left")) return {...base, base:SHAPES.triangleUp, after:SHAPES.kite, flap:[[75,180],[150,180],[150,105]], crease:[[75,180],[150,105]], arrow:[[95,155],[120,120],[145,80]], rotate:-28, slide:true};
  if (name.includes("heart-right")) return {...base, base:SHAPES.kite, after:SHAPES.diamond, flap:[[225,180],[150,180],[150,105]], crease:[[225,180],[150,105]], arrow:[[205,155],[180,120],[155,80]], rotate:28, slide:true};
  if (name.includes("tail-right") || name === "tail-up") return {...base, base:SHAPES.kite, after:[[95,105],[150,35],[205,105],[235,70],[225,135],[150,175]], flap:[[150,105],[205,105],[150,175]], crease:[[150,105],[150,175]], arrow:[[170,145],[195,130],[225,105]], rotate:28};

  if (name.includes("left")) return {...base, base:SHAPES.diamond, after:SHAPES.kite, flap:[[70,105],[150,25],[150,185]], crease:[[150,25],[150,185]], arrow:[[90,105],[120,105],[148,105]], rotate:18, dx:30, dy:0, reach:.75};
  if (name.includes("right")) return {...base, base:SHAPES.kite, after:SHAPES.diamond, flap:[[230,105],[150,25],[150,185]], crease:[[150,25],[150,185]], arrow:[[210,105],[180,105],[152,105]], rotate:-18, dx:-30, dy:0, reach:.75};
  if (name.includes("top") || name.includes("front")) return {...base, base:SHAPES.diamond, after:SHAPES.kite, flap:[[150,25],[95,105],[205,105]], crease:[[95,105],[205,105]], arrow:[[150,45],[150,75],[150,112]], rotate:0, dx:0, dy:55, reach:.75};
  if (name.includes("bottom") || name.includes("tip") || name.includes("nose")) return {...base, base:SHAPES.diamond, after:SHAPES.kite, flap:[[150,185],[95,105],[205,105]], crease:[[95,105],[205,105]], arrow:[[150,165],[150,135],[150,100]], rotate:0, dx:0, dy:-48, reach:.75};
  if (name.includes("corner-back")) return {...base, base:SHAPES.diamond, after:SHAPES.kite, flap:[[150,25],[120,55],[180,55]], crease:[[120,55],[180,55]], arrow:[[150,38],[150,60],[150,78]], rotate:0, dy:25, dx:0};

  return null;
}

export function supportsOrigamiDiagram(name) {
  return Boolean(diagramFor(name));
}

/* A fold that turns over on its crease (docs/plans/2026-10-05-origami-audit/ slice 01, design O2):
   the moving part is the paper on the template flap's side of the crease, cut from the sheet, not
   the template's hand-drawn flap. Flip turns the whole sheet over, rotate turns it around. Every
   other operation keeps the template slide until its model gets a paper model (design O3). */
const HINGE_OPS = new Set(["valley-fold", "mountain-fold", "unfold", "blintz"]);

function bounds(poly) {
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  return { minX:Math.min(...xs), maxX:Math.max(...xs), minY:Math.min(...ys), maxY:Math.max(...ys) };
}

function foldPlan(step, d) {
  const op = step.operation;
  if (op === "flip" || op === "rotate") {
    const sheet = d.base, box = bounds(sheet);
    const cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2;
    if (op === "rotate") return { kind:"turn", flap:sheet, stay:[], centre:[cx, cy], deg:d.rotate || 180 };
    return { kind:"flip", flap:sheet, stay:[], a:[cx, box.minY], b:[cx, box.maxY] };
  }
  if (op === "shape") return { kind:"shape", flap:[], stay:d.base, centre:centroid(d.base) };
  /* Fold-and-reopen (slice 02, design O4): precreases, and the "…-open" / "…-mark" pictures. */
  const reopen = op === "precrease" || /-(open|mark)$/.test(step.diagram) || step.diagram === "diag-cross";
  if (!(HINGE_OPS.has(op) || reopen) || !d.crease || d.slide) return null;
  if (!d.flap && !reopen) return null;
  const sheet = op === "unfold" ? (d.after || d.base) : d.base;
  const plan = hingeOf(sheet, d, d.crease, d.flap);
  if (!plan) return null;
  plan.kind = op === "mountain-fold" ? "mountain" : "valley";
  plan.reverse = op === "unfold";
  if (reopen) {
    plan.reopen = true;
    if (d.extraCrease && step.diagram === "diag-cross") plan.second = hingeOf(sheet, d, d.extraCrease, null);
  }
  return plan;
}

/* One crease on one sheet: which side moves, the moving part, the part that stays. */
function hingeOf(sheet, d, line, templateFlap) {
  const [a, b, tip] = templateFlap && (d.reach || d.to) ? reachLine(sheet, templateFlap, d.reach, d.to) : line;
  let side;
  if (templateFlap) {
    side = Math.sign(sideOf(tip || centroid(templateFlap), a, b));
    if (!side) return null;
    /* A template whose drawn flap is the bigger side means the smaller side folds over it
       ("fold the left lower edge toward the middle"). */
    if (!tip && area(clipByLine(sheet, a, b, side)) > 1.2 * area(clipByLine(sheet, a, b, -side))) side = -side;
  } else {
    /* No drawn flap (a precrease picture): the half whose middle is further left folds, or the
       top half for a level crease. */
    const one = clipByLine(sheet, a, b, 1), other = clipByLine(sheet, a, b, -1);
    if (!one.length || !other.length) return null;
    const p = centroid(one), q = centroid(other);
    side = Math.abs(p[0] - q[0]) > 1 ? (p[0] < q[0] ? 1 : -1) : (p[1] < q[1] ? 1 : -1);
  }
  /* A crease on the paper's edge has nothing to fold over: keep the template slide. */
  const flap = clipByLine(sheet, a, b, side), stay = clipByLine(sheet, a, b, -side);
  if (!flap.length || area(flap) < 40 || area(stay) < 0.15 * area(sheet)) return null;
  return { flap, stay, a, b, crease:tip ? chord(flap, a, b) : line };
}

/* Templates that bring a corner toward the middle ("…-to-center", and the generic left / right /
   top / bottom ones) only say which corner moves; their drawn crease is the centre line, which
   would fold the sheet in half. The crease that brings the corner `reach` of the way to the
   middle is the perpendicular bisector of the corner and that point (or of the corner and the
   template's `to`, e.g. "left corner to the bottom point"). Returns [a, b, corner]. */
function reachLine(sheet, flap, reach, target = null) {
  const mid = centroid(sheet), toward = centroid(flap);
  let tip = sheet[0], best = -Infinity;
  for (const p of sheet) {
    const k = (p[0] - mid[0]) * (toward[0] - mid[0]) + (p[1] - mid[1]) * (toward[1] - mid[1]);
    if (k > best) { best = k; tip = p; }
  }
  const to = target || [tip[0] + (mid[0] - tip[0]) * reach, tip[1] + (mid[1] - tip[1]) * reach];
  const m = [(tip[0] + to[0]) / 2, (tip[1] + to[1]) / 2];
  const vx = to[0] - tip[0], vy = to[1] - tip[1];
  return [[m[0] + vy, m[1] - vx], [m[0] - vy, m[1] + vx], tip];
}

/* The crease as drawn: where the fold line crosses the moving part. */
function chord(poly, a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const on = poly.filter(p => Math.abs(sideOf(p, a, b)) / len < 1e-3);
  if (on.length < 2) return [a, b];
  const along = p => (p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1]);
  on.sort((p, q) => along(p) - along(q));
  return [on[0], on[on.length - 1]];
}

/* One loop cycle: the unfolded start (arrow lights up), the fold, a hold on the folded
   shape so kids can catch up, then a short fade back to the start. Pure WAAPI, so pause
   and resume keep the exact frame (docs/plans/2026-10-04-origami-lesson/). Timing and the rest
   after LOOPS cycles: docs/plans/2026-10-05-origami-audit/ slice 03 (amends origami-lesson D2).
   The last cycle stops at the end of its hold, so the fold rests on the result. */
const LEAD_MS = 600;
const HOLD_MS = 2000;
const RESET_MS = 400;
const LOOPS = 4;
const SIMPLE_FOLD_MS = 1800;
const COMPLEX_FOLD_MS = 3000;
const COMPLEX_OPS = new Set(["squash-fold", "petal-fold", "inside-reverse", "outside-reverse", "rabbit-ear", "pleat", "crimp", "collapse", "spread", "tuck"]);

/* Offsets (0–1) of one cycle. A fold: lead, fold, hold, reset; a = fold start, b = fold end,
   c = hold end. */
function foldTimeline(foldMs) {
  const total = LEAD_MS + foldMs + HOLD_MS + RESET_MS;
  return { total, a:LEAD_MS / total, b:(LEAD_MS + foldMs) / total, c:(LEAD_MS + foldMs + HOLD_MS) / total };
}

/* A fold-and-reopen: lead, then per crease fold / short hold / unfold, then a hold on the open
   sheet with its crease, then the reset. folds[i] = { fs, fe, us, ue } (fold start / end, unfold
   start / end); a and b span the first fold, c ends the hold. */
const REOPEN_FOLD_MS = 1500, REOPEN_PAUSE_MS = 600, REOPEN_UNFOLD_MS = 1200, REOPEN_HOLD_MS = 800;
function reopenTimeline(plan) {
  const count = plan.second ? 2 : 1;
  const total = LEAD_MS + count * (REOPEN_FOLD_MS + REOPEN_PAUSE_MS + REOPEN_UNFOLD_MS) + REOPEN_HOLD_MS + RESET_MS;
  const folds = [];
  let at = LEAD_MS;
  for (let i = 0; i < count; i++) {
    const fs = at, fe = fs + REOPEN_FOLD_MS, us = fe + REOPEN_PAUSE_MS, ue = us + REOPEN_UNFOLD_MS;
    folds.push({ fs:fs / total, fe:fe / total, us:us / total, ue:ue / total });
    at = ue;
  }
  return { total, folds, a:folds[0].fs, b:folds[0].fe, c:(at + REOPEN_HOLD_MS) / total };
}

export class OrigamiFoldEngine {
  constructor(host, options = {}) {
    this.host = host;
    this.front = options.front || "#ef8f9f";
    this.back = options.back || "#ffe6e9";
    this.label = options.label || "Origami folding diagram";
    this.reducedMotion = options.reducedMotion ?? window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    this.anims = [];
    this.cycleMs = 0;
    this.paused = true;
    this.played = false;
    this.parts = { crease:false, arrow:false };
    this.renderShell();
  }

  renderShell() {
    this.host.innerHTML = "";
    this.svg = svgEl("svg", { viewBox:"0 0 300 210", role:"img", "aria-label":this.label });
    this.svg.classList.add("oa-fold-svg");
    const shadow = svgEl("ellipse", {cx:150,cy:193,rx:88,ry:8,class:"oa-paper-shadow"});
    this.base = svgEl("polygon", {class:"oa-paper-base"});
    this.ghost = svgEl("polygon", {class:"oa-paper-ghost"});
    this.after = svgEl("polygon", {class:"oa-paper-after"});
    this.flap = svgEl("polygon", {class:"oa-paper-flap"});
    this.flapBehind = svgEl("polygon", {class:"oa-paper-flap-behind"});
    this.flapHome = svgEl("polygon", {class:"oa-paper-flap-home"});
    this.landing = svgEl("polygon", {class:"oa-paper-landing"});
    this.crease = svgEl("line", {class:"oa-crease"});
    this.extraCrease = svgEl("line", {class:"oa-crease oa-crease-secondary"});
    this.arrowGlow = svgEl("path", {class:"oa-arrow-glow", fill:"none"});
    this.arrow = svgEl("path", {class:"oa-arrow", fill:"none"});
    this.arrowHead = svgEl("path", {class:"oa-arrow-head", fill:"none"});
    this.base2 = svgEl("polygon", {class:"oa-paper-base oa-paper-base-second"});
    this.flap2 = svgEl("polygon", {class:"oa-paper-flap-second"});
    this.svg.append(shadow,this.ghost,this.after,this.flapBehind,this.base,this.base2,this.landing,this.flapHome,this.flap,this.flap2,this.crease,this.extraCrease,this.arrowGlow,this.arrow,this.arrowHead);
    this.host.append(this.svg);
    this.setColors(this.front,this.back);
  }

  setColors(front, back) {
    this.front = front; this.back = back;
    this.base.style.fill = front;
    this.base2.style.fill = front;
    this.after.style.fill = front;
    this.flap.style.fill = back;
    this.ghost.style.fill = front;
  }

  /* autoplay: start looping now. time: pick the cycle up at this point (language re-render).
     Reduced motion never autoplays; it rests on the start frame until Play is tapped. */
  show(step, { autoplay = true, time = null } = {}) {
    this.stop();
    const d = diagramFor(step.diagram) || baseDiagram();
    const plan = foldPlan(step, d);
    const folds = plan && (plan.kind === "valley" || plan.kind === "mountain");
    const arrowPts = folds
      ? foldArrow(plan.reverse ? reflect(plan.flap, plan.a, plan.b) : plan.flap, plan.a, plan.b)
      : d.arrow;
    const crease = plan?.crease || d.crease;
    const extra = plan?.second?.crease || d.extraCrease;
    this.parts = { crease:Boolean(crease), arrow:Boolean(arrowPts) };
    [this.base2, this.flap2].forEach(el => { el.style.display = "none"; });
    this.base.style.transform = "none";
    if (plan?.kind === "shape") this.drawShape(plan);
    else if (plan) this.drawHinge(plan);
    else this.drawSlide(d);
    const line = (el, seg) => {
      if (!seg) { el.style.display = "none"; return; }
      el.style.display = "";
      el.setAttribute("x1",seg[0][0]); el.setAttribute("y1",seg[0][1]);
      el.setAttribute("x2",seg[1][0]); el.setAttribute("y2",seg[1][1]);
    };
    line(this.crease, crease);
    line(this.extraCrease, extra);
    this.extraCrease.classList.toggle("oa-crease-secondary", !plan?.second);
    const arrowParts = [this.arrowGlow, this.arrow, this.arrowHead];
    if (arrowPts) {
      const [s,c,e]=arrowPts;
      arrowParts.forEach(el => { el.style.display = ""; });
      const curve = `M ${s[0]} ${s[1]} Q ${c[0]} ${c[1]} ${e[0]} ${e[1]}`;
      this.arrow.setAttribute("d",curve);
      this.arrowGlow.setAttribute("d",curve);
      const vx=e[0]-c[0], vy=e[1]-c[1], len=Math.hypot(vx,vy)||1, ux=vx/len, uy=vy/len;
      const px=-uy, py=ux, ax=e[0]-ux*12, ay=e[1]-uy*12;
      this.arrowHead.setAttribute("d",`M ${ax+px*7} ${ay+py*7} L ${e[0]} ${e[1]} L ${ax-px*7} ${ay-py*7}`);
    } else arrowParts.forEach(el => { el.style.display = "none"; });
    this.arrowGlow.style.opacity = "0";

    const foldMs = Number(step.durationMs) || (COMPLEX_OPS.has(step.operation) ? COMPLEX_FOLD_MS : SIMPLE_FOLD_MS);
    const t = plan?.reopen ? reopenTimeline(plan) : foldTimeline(foldMs);
    const { total, a, b, c } = t;
    const m = a + (b - a) * .58;
    const timing = { duration:total, iterations:LOOPS - 1 + c, fill:"forwards" };
    const canAnimate = typeof this.flap.animate === "function";
    const anims = [];
    if (canAnimate && plan?.reopen) anims.push(...this.animateReopen(plan, t, timing));
    else if (canAnimate && plan?.kind === "shape") anims.push(this.animateShape(plan, t, timing));
    else if (canAnimate && plan) anims.push(...this.animateHinge(plan, t, timing));
    else if (canAnimate && d.flap) anims.push(...this.animateSlide(d, { a, b, c, m }, timing));
    if (canAnimate && arrowPts && anims.length) {
      const beam = [{offset:0,opacity:.35},{offset:a,opacity:1},{offset:m,opacity:1},{offset:b,opacity:.3},{offset:1,opacity:.3}];
      anims.push(this.arrow.animate(beam, timing), this.arrowHead.animate(beam, timing));
      anims.push(this.arrowGlow.animate([{offset:0,opacity:0},{offset:a,opacity:.85},{offset:(a+m)/2,opacity:.35},{offset:m,opacity:.85},{offset:b,opacity:0},{offset:1,opacity:0}], timing));
    }
    if (canAnimate && crease && anims.length) {
      if (plan?.reopen) {
        /* The crease is faint until the paper has been folded and opened: it is what is left. */
        const mark = (w) => [{offset:0,opacity:.35},{offset:w.fs,opacity:.6},{offset:w.ue,opacity:1},{offset:c,opacity:1},{offset:1,opacity:.35}];
        anims.push(this.crease.animate(mark(t.folds[0]), timing));
        if (plan.second) anims.push(this.extraCrease.animate(mark(t.folds[1]), timing));
      } else {
        anims.push(this.crease.animate([{offset:0,opacity:.55},{offset:a,opacity:1},{offset:b,opacity:1},{offset:1,opacity:.55}], timing));
      }
    }
    this.anims = anims;
    this.cycleMs = anims.length ? total : 0;
    this.endMs = total * timing.iterations;
    if (!anims.length) {
      this.paused = true;
      return;
    }
    const start = time == null ? (this.reducedMotion ? LEAD_MS : 0) : Math.min(time, this.endMs);
    anims.forEach(x => { x.currentTime = start; });
    if (start >= this.endMs) { this.paused = false; this.played = true; return; }
    if (autoplay && !this.reducedMotion) this.resume();
    else this.pause();
  }

  /* Template steps (design O3): the hand-drawn flap slides and spins around its own middle, then
     the template's folded shape fades in. */
  drawSlide(d) {
    this.base.style.display = "";
    this.base.setAttribute("points", points(d.flap ? d.base : (d.after || d.base)));
    this.after.setAttribute("points", points(d.after || d.base));
    this.ghost.setAttribute("points", points(d.after || d.base));
    this.ghost.style.opacity = d.flap ? "0.18" : "0";
    this.flap.style.display = d.flap ? "" : "none";
    if (d.flap) this.flap.setAttribute("points", points(d.flap));
    this.flap.style.transformBox = "fill-box";
    this.flap.style.transformOrigin = "center";
    this.flap.style.transform = "none";
    this.flap.style.fill = this.back;
    this.flap.style.opacity = d.flap ? "0.82" : "0";
    [this.flapBehind, this.flapHome, this.landing].forEach(el => { el.style.display = "none"; });
    this.base.style.opacity = "1";
    this.after.style.opacity = "0";
  }

  animateSlide(d, { a, b, c, m }, timing) {
    const settle = Math.min(c, b + .05);
    const t0 = "translate(0px,0px) rotate(0deg)";
    const tMid = `translate(${(d.dx||0)*.55}px,${(d.dy||0)*.55}px) rotate(${(d.rotate||0)*.55}deg)`;
    const t1 = `translate(${d.dx||0}px,${d.dy||0}px) rotate(${d.rotate||0}deg)`;
    return [
      this.flap.animate([
        { offset:0, transform:t0, opacity:0 },
        { offset:a*.4, transform:t0, opacity:.82 },
        { offset:a, transform:t0, opacity:.82, easing:"cubic-bezier(.3,.55,.45,1)" },
        { offset:m, transform:tMid, opacity:.96, easing:"cubic-bezier(.2,.6,.3,1)" },
        { offset:b, transform:t1, opacity:.18 },
        { offset:settle, transform:t1, opacity:0 },
        { offset:1, transform:t1, opacity:0 }
      ], timing),
      this.base.animate([{offset:0,opacity:1},{offset:b,opacity:1},{offset:settle,opacity:0},{offset:c,opacity:0},{offset:1,opacity:1}], timing),
      this.after.animate([{offset:0,opacity:0},{offset:b,opacity:0},{offset:settle,opacity:1},{offset:c,opacity:1},{offset:1,opacity:0}], timing)
    ];
  }

  /* Hinge steps (design O2): the staying part is still; the moving part turns over on the crease
     (front colour until it is edge-on, back colour after) and stays on the result. A mountain fold
     passes behind the paper. During the reset the moving part fades back in where it started. */
  drawHinge(plan) {
    const startPoly = plan.reverse ? reflect(plan.flap, plan.a, plan.b) : plan.flap;
    this.base.style.display = plan.stay.length ? "" : "none";
    if (plan.stay.length) this.base.setAttribute("points", points(plan.stay));
    this.base.style.opacity = "1";
    this.after.style.opacity = "0";
    this.ghost.style.opacity = "0";
    [this.flap, this.flapBehind, this.flap2].forEach(el => {
      el.style.display = "";
      el.setAttribute("points", points(plan.flap));
      el.style.transformBox = "view-box";
      el.style.transformOrigin = "0 0";
    });
    this.flap.style.opacity = "1";
    this.flapBehind.style.display = plan.kind === "mountain" ? "" : "none";
    this.flapBehind.style.opacity = "0";
    this.flap2.style.display = "none";
    this.flapHome.style.display = plan.reopen ? "none" : "";
    this.flapHome.setAttribute("points", points(startPoly));
    this.flapHome.style.fill = plan.reverse ? this.back : this.front;
    this.flapHome.style.opacity = "0";
    const lands = (plan.kind === "valley" || plan.kind === "mountain") && !plan.second;
    this.landing.style.display = lands ? "" : "none";
    if (lands) this.landing.setAttribute("points", points(plan.reverse ? plan.flap : reflect(plan.flap, plan.a, plan.b)));
    if (plan.second) {
      this.base2.style.display = "";
      this.base2.setAttribute("points", points(plan.second.stay));
      this.flap2.style.display = "";
      this.flap2.setAttribute("points", points(plan.second.flap));
    }
  }

  /* The keyframes of one fold of `flap` over a→b between offsets from and to: s goes 1 → −1
     (or back with `back`), the face changes where the paper is edge-on. */
  turnFrames(a, b, from, to, c0, c1, back = false) {
    const out = [];
    for (const { u, s } of hingeSamples(16)) {
      if (u === 0) continue;
      const offset = from + (to - from) * u, v = back ? -s : s;
      if (u === 0.5) out.push({ offset, transform:hingeTransform(a, b, v), fill:c0 }, { offset, transform:hingeTransform(a, b, v), fill:c1 });
      else out.push({ offset, transform:hingeTransform(a, b, v), fill:u < 0.5 ? c0 : c1 });
    }
    return out;
  }

  animateHinge(plan, { a, b, c }, timing) {
    const turn = plan.kind === "turn";
    const tf = s => turn ? turnTransform(plan.centre, plan.deg * (1 - s) / 2) : hingeTransform(plan.a, plan.b, plan.reverse ? -s : s);
    const c0 = plan.reverse ? this.back : this.front;
    const c1 = turn ? c0 : (plan.reverse ? this.front : this.back);
    const mountain = plan.kind === "mountain";
    const front = [], behind = [];
    const push = (offset, s, fill, before) => {
      const shown = !mountain || before;
      front.push({ offset, transform:tf(s), fill, opacity:shown ? 1 : 0 });
      behind.push({ offset, transform:tf(s), fill, opacity:shown ? 0 : 1 });
    };
    push(0, 1, c0, true);
    push(a, 1, c0, true);
    for (const { u, s } of hingeSamples(16)) {
      if (u === 0) continue;
      const offset = a + (b - a) * u;
      if (u === 0.5) { push(offset, s, c0, true); push(offset, s, c1, false); }
      else push(offset, s, u < 0.5 ? c0 : c1, u < 0.5);
    }
    push(c, -1, c1, false);
    front.push({ ...front[front.length - 1], offset:1, opacity:0 });
    behind.push({ ...behind[behind.length - 1], offset:1, opacity:0 });
    const anims = [this.flap.animate(front, timing)];
    if (mountain) anims.push(this.flapBehind.animate(behind, timing));
    anims.push(this.flapHome.animate([{offset:0,opacity:0},{offset:c,opacity:0},{offset:1,opacity:1}], timing));
    if (this.landing.style.display !== "none") {
      anims.push(this.landing.animate([{offset:0,opacity:0},{offset:a,opacity:.7},{offset:b,opacity:.7},{offset:Math.min(c, b + .04),opacity:0},{offset:1,opacity:0}], timing));
    }
    return anims;
  }

  /* Fold-and-reopen (slice 02, design O4): fold, a short hold, unfold to where it started; with a
     second crease (diag-cross) the second fold follows on the other half-pair. At the switch both
     pictures are the whole flat sheet, so swapping which polygons show is invisible. */
  animateReopen(plan, t, timing) {
    const id = (p) => hingeTransform(p.a, p.b, 1);
    const fw = t.folds;
    const one = (p, w) => [
      { offset:w.fs, transform:id(p), fill:this.front },
      ...this.turnFrames(p.a, p.b, w.fs, w.fe, this.front, this.back),
      { offset:w.us, transform:hingeTransform(p.a, p.b, -1), fill:this.back },
      ...this.turnFrames(p.a, p.b, w.us, w.ue, this.back, this.front, true),
    ];
    const anims = [];
    if (!plan.second) {
      anims.push(this.flap.animate([{ offset:0, transform:id(plan), fill:this.front }, ...one(plan, fw[0]), { offset:1, transform:id(plan), fill:this.front }], timing));
      if (this.landing.style.display !== "none") {
        anims.push(this.landing.animate([{offset:0,opacity:0},{offset:fw[0].fs,opacity:.7},{offset:fw[0].us,opacity:.7},{offset:fw[0].ue,opacity:0},{offset:1,opacity:0}], timing));
      }
      return anims;
    }
    const sw = fw[0].ue;
    const shownUntil = (on) => [{offset:0,opacity:on?1:0},{offset:sw,opacity:on?1:0},{offset:sw,opacity:on?0:1},{offset:1,opacity:on?0:1}];
    const firstFrames = [{ offset:0, transform:id(plan), fill:this.front }, ...one(plan, fw[0]), { offset:1, transform:id(plan), fill:this.front }];
    const secondFrames = [{ offset:0, transform:id(plan.second), fill:this.front }, ...one(plan.second, fw[1]), { offset:1, transform:id(plan.second), fill:this.front }];
    anims.push(this.flap.animate(firstFrames, timing), this.flap.animate(shownUntil(true), timing));
    anims.push(this.flap2.animate(secondFrames, timing), this.flap2.animate(shownUntil(false), timing));
    anims.push(this.base.animate(shownUntil(true), timing), this.base2.animate(shownUntil(false), timing));
    return anims;
  }

  /* The Lotus "soften" step: the paper lifts a little and settles. */
  drawShape(plan) {
    this.base.style.display = "";
    this.base.setAttribute("points", points(plan.stay));
    this.base.style.opacity = "1";
    this.base.style.transformBox = "view-box";
    this.base.style.transformOrigin = "0 0";
    [this.flap, this.flapBehind, this.flapHome, this.landing].forEach(el => { el.style.display = "none"; });
    this.after.style.opacity = "0";
    this.ghost.style.opacity = "0";
  }

  animateShape(plan, { a, b }, timing) {
    const [x, y] = plan.centre;
    const k = (s) => `translate(${x}px,${y}px) scale(${s}) translate(${-x}px,${-y}px)`;
    return this.base.animate([{offset:0,transform:k(1)},{offset:a,transform:k(1)},{offset:(a+b)/2,transform:k(1.04)},{offset:b,transform:k(1)},{offset:1,transform:k(1)}], timing);
  }

  get hasMotion() { return this.anims.length > 0; }

  /* After the last loop the fold rests on the result until Watch again (replay). */
  get resting() { return this.anims.length > 0 && this.anims.every(x => x.playState === "finished"); }

  /* Calls back once when the loops run out; a later call replaces an earlier one. */
  onRest(callback) {
    const token = this.restToken = (this.restToken || 0) + 1;
    Promise.all(this.anims.map(x => x.finished)).then(() => { if (token === this.restToken && this.resting) callback(); }, () => {});
  }

  pause() {
    this.anims.forEach(x => x.pause());
    this.paused = true;
  }

  resume() {
    if (!this.anims.length) return;
    this.anims.forEach(x => x.play());
    this.paused = false;
    this.played = true;
  }

  replay() {
    if (!this.anims.length) return;
    this.anims.forEach(x => { x.currentTime = 0; });
    this.resume();
  }

  /* Where the loop is, so a re-render (language switch) can pick it up again: the time since the
     first loop started, so the loop count carries over too. */
  snapshot() {
    const now = this.anims[0]?.currentTime;
    return { paused:this.paused, played:this.played, time:now == null ? null : now };
  }

  stop() {
    this.anims.forEach(x => x.cancel());
    this.anims = [];
    this.cycleMs = 0;
  }

  destroy() {
    this.stop();
    this.host.innerHTML="";
  }
}
