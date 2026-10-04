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

  if (name.startsWith("blintz")) return {...base, base:SHAPES.square, after:SHAPES.diamond, flap:[[75,30],[150,30],[150,105],[75,105]], crease:[[75,105],[150,30]], arrow:[[86,48],[112,72],[146,101]], rotate:28,dx:30,dy:28};
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

  if (name === "top-to-center" || name === "top-center") return {...base, base:SHAPES.diamond, after:SHAPES.kite, flap:[[150,25],[95,105],[205,105]], crease:[[95,105],[205,105]], arrow:[[150,42],[150,72],[150,104]], rotate:0,dx:0,dy:55};
  if (name === "bottom-to-center" || name === "bottom-to-top") return {...base, base:SHAPES.diamond, after:SHAPES.kite, flap:[[150,185],[95,105],[205,105]], crease:[[95,105],[205,105]], arrow:[[150,168],[150,138],[150,104]], rotate:0,dx:0,dy:-55};
  if (name === "left-to-center" || name === "left-to-bottom" || name === "left-across") return {...base, base:SHAPES.diamond, after:SHAPES.kite, flap:[[70,105],[150,25],[150,185]], crease:[[150,25],[150,185]], arrow:[[88,105],[120,105],[150,105]], rotate:20,dx:32,dy:0};
  if (name === "right-to-center" || name === "right-to-bottom" || name === "right-across") return {...base, base:SHAPES.diamond, after:SHAPES.kite, flap:[[230,105],[150,25],[150,185]], crease:[[150,25],[150,185]], arrow:[[212,105],[180,105],[150,105]], rotate:-20,dx:-32,dy:0};

  if (name.includes("heart-left")) return {...base, base:SHAPES.triangleUp, after:SHAPES.kite, flap:[[75,180],[150,180],[150,105]], crease:[[75,180],[150,105]], arrow:[[95,155],[120,120],[145,80]], rotate:-28};
  if (name.includes("heart-right")) return {...base, base:SHAPES.kite, after:SHAPES.diamond, flap:[[225,180],[150,180],[150,105]], crease:[[225,180],[150,105]], arrow:[[205,155],[180,120],[155,80]], rotate:28};
  if (name.includes("tail-right") || name === "tail-up") return {...base, base:SHAPES.kite, after:[[95,105],[150,35],[205,105],[235,70],[225,135],[150,175]], flap:[[150,105],[205,105],[150,175]], crease:[[150,105],[150,175]], arrow:[[170,145],[195,130],[225,105]], rotate:28};

  if (name.includes("left")) return {...base, base:SHAPES.diamond, after:SHAPES.kite, flap:[[70,105],[150,25],[150,185]], crease:[[150,25],[150,185]], arrow:[[90,105],[120,105],[148,105]], rotate:18, dx:30, dy:0};
  if (name.includes("right")) return {...base, base:SHAPES.kite, after:SHAPES.diamond, flap:[[230,105],[150,25],[150,185]], crease:[[150,25],[150,185]], arrow:[[210,105],[180,105],[152,105]], rotate:-18, dx:-30, dy:0};
  if (name.includes("top") || name.includes("front")) return {...base, base:SHAPES.diamond, after:SHAPES.kite, flap:[[150,25],[95,105],[205,105]], crease:[[95,105],[205,105]], arrow:[[150,45],[150,75],[150,112]], rotate:0, dx:0, dy:55};
  if (name.includes("bottom") || name.includes("tip") || name.includes("nose")) return {...base, base:SHAPES.diamond, after:SHAPES.kite, flap:[[150,185],[95,105],[205,105]], crease:[[95,105],[205,105]], arrow:[[150,165],[150,135],[150,100]], rotate:0, dx:0, dy:-48};
  if (name.includes("corner-back")) return {...base, base:SHAPES.diamond, after:SHAPES.kite, flap:[[150,25],[120,55],[180,55]], crease:[[120,55],[180,55]], arrow:[[150,38],[150,60],[150,78]], rotate:0, dy:25, dx:0};

  return null;
}

export function supportsOrigamiDiagram(name) {
  return Boolean(diagramFor(name));
}

export class OrigamiFoldEngine {
  constructor(host, options = {}) {
    this.host = host;
    this.front = options.front || "#ef8f9f";
    this.back = options.back || "#ffe6e9";
    this.reducedMotion = options.reducedMotion ?? window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    this.timeout = null;
    this.renderShell();
  }

  renderShell() {
    this.host.innerHTML = "";
    this.svg = svgEl("svg", { viewBox:"0 0 300 210", role:"img", "aria-label":"Origami folding diagram" });
    this.svg.classList.add("oa-fold-svg");
    const shadow = svgEl("ellipse", {cx:150,cy:193,rx:88,ry:8,class:"oa-paper-shadow"});
    this.base = svgEl("polygon", {class:"oa-paper-base"});
    this.ghost = svgEl("polygon", {class:"oa-paper-ghost"});
    this.flap = svgEl("polygon", {class:"oa-paper-flap"});
    this.crease = svgEl("line", {class:"oa-crease"});
    this.extraCrease = svgEl("line", {class:"oa-crease oa-crease-secondary"});
    this.arrow = svgEl("path", {class:"oa-arrow", fill:"none"});
    this.arrowHead = svgEl("path", {class:"oa-arrow-head", fill:"none"});
    this.svg.append(shadow,this.ghost,this.base,this.flap,this.crease,this.extraCrease,this.arrow,this.arrowHead);
    this.host.append(this.svg);
    this.setColors(this.front,this.back);
  }

  setColors(front, back) {
    this.front = front; this.back = back;
    this.base.style.fill = front;
    this.flap.style.fill = back;
    this.ghost.style.fill = front;
  }

  show(step, { animate = true } = {}) {
    if (this.timeout) clearTimeout(this.timeout);
    const d = diagramFor(step.diagram) || baseDiagram();
    this.base.setAttribute("points", points(d.base));
    this.ghost.setAttribute("points", points(d.after || d.base));
    this.ghost.style.opacity = d.flap ? "0.18" : "0";
    this.flap.style.display = d.flap ? "" : "none";
    if (d.flap) this.flap.setAttribute("points", points(d.flap));
    if (d.crease) {
      this.crease.style.display = "";
      this.crease.setAttribute("x1",d.crease[0][0]); this.crease.setAttribute("y1",d.crease[0][1]);
      this.crease.setAttribute("x2",d.crease[1][0]); this.crease.setAttribute("y2",d.crease[1][1]);
    } else this.crease.style.display = "none";
    if (d.extraCrease) {
      this.extraCrease.style.display = "";
      this.extraCrease.setAttribute("x1",d.extraCrease[0][0]); this.extraCrease.setAttribute("y1",d.extraCrease[0][1]);
      this.extraCrease.setAttribute("x2",d.extraCrease[1][0]); this.extraCrease.setAttribute("y2",d.extraCrease[1][1]);
    } else this.extraCrease.style.display = "none";
    if (d.arrow) {
      const [s,c,e]=d.arrow;
      this.arrow.style.display=""; this.arrowHead.style.display="";
      this.arrow.setAttribute("d",`M ${s[0]} ${s[1]} Q ${c[0]} ${c[1]} ${e[0]} ${e[1]}`);
      const vx=e[0]-c[0], vy=e[1]-c[1], len=Math.hypot(vx,vy)||1, ux=vx/len, uy=vy/len;
      const px=-uy, py=ux, ax=e[0]-ux*12, ay=e[1]-uy*12;
      this.arrowHead.setAttribute("d",`M ${ax+px*7} ${ay+py*7} L ${e[0]} ${e[1]} L ${ax-px*7} ${ay-py*7}`);
    } else { this.arrow.style.display="none"; this.arrowHead.style.display="none"; }

    this.flap.getAnimations?.().forEach(a=>a.cancel());
    this.arrow.getAnimations?.().forEach(a=>a.cancel());
    this.arrowHead.getAnimations?.().forEach(a=>a.cancel());
    this.flap.style.transform = "none";
    this.base.style.opacity = "1";

    if (!animate || this.reducedMotion || !d.flap) {
      if (d.after) this.base.setAttribute("points", points(d.after));
      this.flap.style.opacity = d.flap ? "0.28" : "0";
      return;
    }
    const duration = Number(step.durationMs) || 1850;
    this.arrow.animate([{opacity:.15,transform:"translate(0,0)"},{opacity:1,transform:"translate(0,-2px)"},{opacity:.15}],{duration,iterations:1,easing:"ease-in-out"});
    this.arrowHead.animate([{opacity:.15},{opacity:1},{opacity:.15}],{duration,iterations:1,easing:"ease-in-out"});
    this.flap.animate([
      { transform:"translate(0px,0px) rotate(0deg)", opacity:.82 },
      { transform:`translate(${(d.dx||0)*.55}px,${(d.dy||0)*.55}px) rotate(${(d.rotate||0)*.55}deg)`, opacity:.96, offset:.58 },
      { transform:`translate(${d.dx||0}px,${d.dy||0}px) rotate(${d.rotate||0}deg)`, opacity:.18 }
    ],{duration,fill:"forwards",easing:"cubic-bezier(.2,.72,.22,1)"});
    this.timeout=setTimeout(()=>{
      if (d.after) this.base.setAttribute("points", points(d.after));
      this.flap.style.opacity="0";
    },Math.max(0,duration-40));
  }

  destroy() {
    if (this.timeout) clearTimeout(this.timeout);
    this.host.innerHTML="";
  }
}
