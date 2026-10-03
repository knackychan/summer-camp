/* Kitchen Quest v0.8 counter scene: the v0.6.0 illustrated counter (src/render/scene.ts)
   redrawn as pixel art. Food snaps onto the plate, lands, squashes and wobbles on
   bounded springs; customers walk in, wait behind the counter and cheer.
   Presentation only: no stock, order, timer or grading depends on anything here. */
import { HEX, C } from "../../world/planet-palette.js";
import { MATERIALS } from "./ingredients.js";
import { Spring, clamp, lerp, easeOut, easeIn, seeded } from "./motion.js";
import { sprite } from "./sprites.js";
import { drawPerson, speech } from "./customers.js";
import { LASAGNA_STEPS } from "./kitchen.js";

const TAU = Math.PI * 2;
const FONT = "ui-monospace, Menlo, Consolas, 'Courier New', monospace";
const SPEECH_FONT = "'Nunito', system-ui, sans-serif";
// Lasagna layer thickness in art pixels, and the word each one says as it lands.
const BAND = { pasta: 4, sauce: 4, cheese: 3 };
const BAND_WORD = { pasta: ["FLOP!", C.sandLit], sauce: ["SPLOUIT!", C.red], cheese: ["FLOUP!", C.yellow] };
const SEND_TIME = .9;
const fill = (g, col, x, y, w, h) => { g.fillStyle = HEX[col]; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

/* Line breaks for a speech bubble, as [start, end) ranges so typing can reveal them in order. */
function wrap(g, text, width, zh) {
  const lines = [];
  let start = 0;
  while (start < text.length) {
    let end = start, space = -1;
    while (end < text.length && (end === start || g.measureText(text.slice(start, end + 1)).width <= width)) {
      if (!zh && text[end] === " ") space = end;
      end++;
    }
    if (end < text.length && !zh && space > start) end = space;
    lines.push([start, end]);
    start = end;
    while (text[start] === " ") start++;
  }
  return lines;
}

function rectsHit(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

export class CounterScene {
  constructor(canvas, audio, options = {}) {
    this.canvas = canvas; this.audio = audio;
    this.c = canvas.getContext("2d");
    this.reduced = !!options.reducedMotion;
    this.lang = options.lang === "zh" ? "zh" : "en";
    this.wall = document.createElement("canvas"); this.front = document.createElement("canvas");
    this.layers = []; this.particles = []; this.captions = []; this.hits = []; this.regions = [];
    this.now = 0; this.w = 1; this.h = 1; this.dpr = 1; this.U = 3; this.scale = 4;
    this.plateSpring = new Spring(58, .78, 3);
    this.view = "plate"; this.inset = 0;
    this.activeKey = null; this.serveStart = -1; this.serveImpact = false; this.family = "burger";
    this.customers = [null, null];
    this.cast = options.cast || null; this.liners = []; this.doorFree = 0; this.speechQueue = [];
    this.arrivals = []; this.talks = 0;
    this.pans = [{}, {}]; this.board = {}; this.oven = {};
    this.random = seeded(29813);
    this.contacts = 0;
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, Math.round(r.width)); this.h = Math.max(1, Math.round(r.height));
    this.dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
    this.U = Math.max(2, Math.min(6, Math.floor(Math.min(this.w / 165, this.h / 112))));
    this.counterY = Math.round(Math.min(this.h * .4, this.U * 64 + 12));
    this.paintBackground();
  }
  /* Words drawn on the canvas follow the kitchen's one-language-at-a-time switch. */
  setLang(lang) { this.lang = lang === "zh" ? "zh" : "en"; }
  t(en, zh) { return this.lang === "zh" ? zh : en; }
  setView(view, inset) {
    this.view = view; this.inset = Math.max(0, inset || 0);
  }

  /* ---------- geometry ---------- */
  get dishX() { return this.w / 2; }
  get plateY() { return Math.round(this.counterY + Math.min((this.h - this.counterY) * .74, this.U * 80)); }
  slotX(slot) { return Math.round(this.w * (slot === 0 ? .7 : .3)); }
  stackHeight(layers) {
    const fam = this.family;
    let art = fam === "burger" ? 8 + 17 : fam === "salad" ? 16 : 4;
    layers.forEach(l => { art += (fam === "salad" ? .45 : 1) * (sprite(l.pending ? "patty-raw" : l.ingredient).thick || 4); });
    return art;
  }
  targetScale(layers) {
    const room = this.plateY - Math.max(10, this.h * .05);
    return clamp(Math.min(this.w * .42 / 50, room / this.stackHeight(layers), 7.5), 1.5, 7.5);
  }

  /* ---------- food commands (called by the host right after the model accepts) ---------- */
  add(layer, origin) {
    const r = this.canvas.getBoundingClientRect();
    const duration = this.reduced ? .075 : .09;
    const pending = this.layers.filter(v => v.removed === undefined && !v.landed);
    const previous = pending[pending.length - 1];
    const from = origin ? { x: origin.x - r.left, y: origin.y - r.top } : { x: this.dishX, y: this.h + 30 };
    this.layers.push({ layer: { ...layer }, born: this.now, arriveAt: Math.max(this.now + duration, previous ? previous.arriveAt : 0),
      from, landed: !!layer.pending,
      squash: new Spring(62, .65, .48), angle: new Spring(62, .66, .07), tail: new Spring(52, .56, .7), slide: new Spring(60, .63, 4),
      lastX: this.dishX, lastY: this.plateY });
  }
  finishPatty(id) {
    const v = this.layers.find(l => l.layer.id === id && l.removed === undefined);
    if (!v) return;
    v.layer = { id, ingredient: "patty" }; v.landed = false; v.born = this.now;
    v.arriveAt = this.now + (this.reduced ? .075 : .16);
    v.from = { x: this.dishX - this.w * .2, y: -20 };
  }
  remove(id) {
    const v = this.layers.find(l => l.layer.id === id && l.removed === undefined);
    if (v) v.removed = this.now;
    this.plateSpring.kick(-22);
  }
  clear() {
    this.layers.forEach(v => { if (v.removed === undefined) v.removed = this.now; });
    this.plateSpring.kick(-35);
  }
  serve() {
    let height = 0;
    for (const v of this.layers.filter(l => l.removed === undefined)) {
      if (!v.landed) { v.landed = true; v.arriveAt = this.now; }
      height += sprite(v.layer.ingredient).thick || 4;
    }
    this.serveStart = this.now; this.serveImpact = false;
  }
  rejectFull() { this.caption("FULL!", this.dishX, this.plateY - 140, C.lava); }

  /* ---------- reconciliation with the model ---------- */
  reconcile(st) {
    const station = st.stations[st.activeSlot];
    const order = station && station.order;
    this.family = order ? order.recipe.family : "burger";
    const key = (order ? order.id : 0) + ":" + st.activeSlot;
    const waiting = !station || station.phase === "waiting";
    if (key !== this.activeKey || (waiting && this.wasServing)) {
      // A different dish (selection, or the next customer): restore without replaying contacts.
      this.activeKey = key; this.serveStart = -1; this.serveImpact = false;
      this.layers = []; this.particles = this.particles.filter(p => p.keep);
      for (const layer of st.layers) { this.add(layer); const v = this.layers[this.layers.length - 1]; v.landed = true; v.arriveAt = this.now; }
      this.scale = this.targetScale(st.layers);
    }
    this.wasServing = station && station.phase === "serving";
    if (waiting) { this.layers = []; return; }
    if (station.phase === "serving") { if (this.serveStart < 0) this.serve(); return; }
    const ids = new Set(st.layers.map(l => l.id));
    for (const v of this.layers) if (v.removed === undefined && !ids.has(v.layer.id)) v.removed = this.now;
    for (const layer of st.layers) {
      const v = this.layers.find(l => l.layer.id === layer.id && l.removed === undefined);
      if (!v) { this.add(layer); const added = this.layers[this.layers.length - 1]; added.landed = true; added.arriveAt = this.now; }
      else if (v.layer.pending && !layer.pending) this.finishPatty(layer.id);
    }
  }

  /* ---------- customers ---------- */
  // Seats at the counter; the line waits in the background between them, and the
  // street is off the left edge. People come through the door one at a time.
  lineX(i) { return Math.round(this.w * (i === 0 ? .56 : .45)); }
  nextDoor() {
    const at = Math.max(this.now, this.doorFree);
    this.doorFree = at + (this.reduced ? .2 : 1.1);
    return at;
  }
  walkTime(from, to) { return this.reduced ? 0 : clamp(Math.abs(to - from) / (this.w * .5), .45, 1.8); }
  syncCustomers(st) {
    for (let slot = 0; slot < 2; slot++) {
      const station = st.stations[slot]; if (!station) continue;
      const present = station.phase !== "waiting", id = station.order ? station.order.id : 0;
      let c = this.customers[slot];
      if (!c) c = this.customers[slot] = { id: 0, state: "gone", t: 0, x: -60, hop: new Spring(18, .5, .3) };
      if (present && (c.id !== id || c.state === "gone")) {
        // Someone from the line steps up to the seat; anyone else walks in from the street.
        const who = this.cast ? this.cast.of(id) : null;
        const liner = who && this.liners.find(l => l.who.id === who.id && l.state !== "outside");
        c.id = id; c.who = who; c.t = 0; c.spoken = false; c.talk = null; c.thanks = null;
        if (liner) { c.state = "arriving"; c.from = liner.x; c.fromLine = true; this.liners.splice(this.liners.indexOf(liner), 1); }
        else { c.state = "outside"; c.from = -40; c.fromLine = false; c.enterAt = this.nextDoor(); }
        c.x = c.from;
      } else if (!present && ["here", "arriving", "outside"].includes(c.state)) {
        c.state = c.state === "outside" ? "gone" : "leaving"; c.t = 0; c.from = c.x; c.talk = null;
      }
      c.happy = station.phase === "serving" || c.state === "leaving";
      // Served: a happy hop and a quick thank-you in their own words, carried out of the door.
      if (station.phase === "serving" && c.who && !c.thanks && c.state === "here") { c.thanks = { typed: 0, doneAt: -1 }; c.talk = null; c.hop.kick(this.reduced ? 0 : 9); }
      c.order = station.order || null;
      c.request = !!(c.order && c.order.request);
      c.recipe = c.order ? c.order.recipe : null;
    }
    // The line follows the cast: newcomers wait at the door for their turn, then walk in.
    if (!this.cast) return;
    const line = this.cast.line;
    this.liners = this.liners.filter(l => line.some(who => who.id === l.who.id));
    line.forEach((who, i) => {
      let l = this.liners.find(entry => entry.who.id === who.id);
      if (!l) { l = { who, state: "outside", x: -40, t: 0, enterAt: this.nextDoor() }; this.liners.push(l); }
      l.spot = i;
    });
  }
  updateCustomers(dt) {
    this.customers.forEach((c, slot) => {
      if (!c) return;
      c.t += dt; c.hop.update(dt);
      const target = this.slotX(slot);
      if (c.state === "outside" && this.now >= c.enterAt) { c.state = "arriving"; c.t = 0; this.audio.bell(); this.logArrival(c.who, "seat"); }
      if (c.state === "arriving") {
        const d = this.walkTime(c.from, target), p = d ? clamp(c.t / d, 0, 1) : 1;
        c.x = lerp(c.from, target, c.fromLine ? easeOut(p) : p);
        c.grow = c.fromLine ? p : 1;
        if (p >= 1) { c.state = "here"; c.grow = 1; c.hop.kick(this.reduced ? 0 : 6); if (!c.spoken) this.speechQueue.push(slot); }
      } else if (c.state === "leaving") {
        const p = this.reduced ? 1 : clamp((c.t - (c.thanks ? 1.1 : .25)) / .8, 0, 1);
        c.x = lerp(c.from, this.w + 50, easeIn(p));
        if (p >= 1) c.state = "gone";
      } else if (c.state === "here") c.x = target;
    });
    this.liners.forEach(l => {
      if (l.state === "outside") {
        if (this.now < l.enterAt) return;
        l.state = "walking"; l.from = l.x; l.t = 0; this.audio.bell(); this.logArrival(l.who, "line");
      }
      const target = this.lineX(l.spot);
      if (l.state === "standing" && Math.abs(l.x - target) > 1) { l.state = "walking"; l.from = l.x; l.t = 0; }
      if (l.state === "walking") {
        l.t += dt;
        const d = this.walkTime(l.from, target), p = d ? clamp(l.t / d, 0, 1) : 1;
        l.x = lerp(l.from, target, p);
        if (p >= 1) l.state = "standing";
      }
    });
    this.updateSpeech(dt);
  }

  /* Door log for the harness: who walked in, heading where, and when. */
  logArrival(who, where) { if (who && this.arrivals.length < 40) this.arrivals.push({ who: who.id, where, at: Math.round(this.now * 100) / 100 }); }

  /* ---------- chatter: one customer types at a time, with a "bla" per syllable ---------- */
  speechText(c) { return speech(c.who, c.order, this.lang); }
  updateSpeech(dt) {
    const typing = this.customers.some(c => c && c.talk && c.talk.doneAt < 0);
    if (!typing) {
      while (this.speechQueue.length) {
        const c = this.customers[this.speechQueue.shift()];
        if (c && c.state === "here" && !c.spoken && c.who && c.order) { c.spoken = true; c.talk = { typed: 0, doneAt: -1 }; this.talks++; break; }
      }
    }
    this.customers.forEach(c => {
      if (!c) return;
      if (c.talk) {
        if (c.state !== "here") c.talk = null;
        else if (c.talk.doneAt < 0) this.typeOut(c.talk, this.speechText(c), c.who, dt, 1);
        else if (this.now - c.talk.doneAt > 2.8) c.talk = null;
      }
      if (c.thanks) {
        if (c.state === "gone") c.thanks = null;
        else if (c.thanks.doneAt < 0) this.typeOut(c.thanks, this.thanksText(c), c.who, dt, 1.4);
      }
    });
  }
  thanksText(c) { return c.who.thanks[this.lang === "zh" ? 1 : 0]; }
  /* Reveal a few more characters, with one "bla" per syllable in the speaker's voice. */
  typeOut(talk, text, who, dt, speed) {
    const before = Math.floor(talk.typed);
    talk.typed = Math.min(text.length, talk.typed + dt * (this.lang === "zh" ? 11 : 30) * speed);
    for (let i = before; i < Math.floor(talk.typed); i++) {
      if (/[\s.,!?'！？，。、]/.test(text[i])) continue;
      if (this.lang === "zh" || i % 2 === 0) this.audio.blip(who.voice, who.wave);
    }
    if (talk.typed >= text.length) talk.doneAt = this.now;
  }
  /* A tap on a customer who is still talking finishes the sentence at once. */
  skipSpeech(slot) {
    const c = this.customers[slot];
    if (c && c.talk && c.talk.doneAt < 0) { c.talk.typed = Infinity; c.talk.doneAt = this.now; }
  }

  drawCustomers(g, st) {
    const U = this.U, baseY = this.counterY + 2 * U, small = Math.max(2, U - 1);
    // The line stands further back, so it is drawn smaller and first.
    this.liners.forEach(l => {
      if (l.state === "outside") return;
      const bob = this.reduced || l.state !== "walking" ? 0 : Math.abs(Math.sin(this.now * 14)) * -2 * small;
      drawPerson(g, l.x - 10 * small, baseY - 34 * small + bob, small, l.who, { blink: (this.now + l.who.voice / 100) % 4.4 < .12 });
    });
    this.customers.forEach((c, slot) => {
      if (!c || !c.who || c.state === "gone" || c.state === "outside") return;
      const uu = c.state === "arriving" && c.fromLine ? lerp(small, U, c.grow || 0) : U;
      const walking = c.state === "arriving" || c.state === "leaving";
      const bob = this.reduced ? 0 : (walking ? Math.abs(Math.sin(this.now * 14)) * -2 * uu : c.hop.value * -4 * uu) + (c.happy && !walking ? Math.abs(Math.sin(this.now * 9)) * -2 * uu : 0);
      const blink = (this.now + c.who.voice / 100) % 4.2 < .12;
      const talking = !!(c.talk && c.talk.doneAt < 0) && Math.floor(this.now * 9) % 2 === 0;
      const box = drawPerson(g, c.x - 10 * uu, baseY + bob - 34 * uu, uu, c.who, { happy: c.happy, blink, talk: talking });
      if (c.thanks && (c.state === "here" || c.state === "leaving")) this.drawSpeech(g, c, slot, box, c.thanks, this.thanksText(c), false);
      if (c.state !== "here" || !c.recipe) return;
      const bubble = c.thanks ? box : c.talk ? this.drawSpeech(g, c, slot, box, c.talk, this.speechText(c), true) : this.drawOrderBubble(g, c, slot, box, st);
      const left = Math.min(bubble.x, box.x), right = Math.max(bubble.x + bubble.w, box.x + box.w), topY = Math.min(bubble.y, box.y);
      this.regions.push({ x: left, y: topY, w: right - left, h: this.counterY - topY, customer: slot });
    });
  }
  /* After they have spoken: a small picture of their meal, beside the head. */
  drawOrderBubble(g, c, slot, box, st) {
    const U = this.U, selected = slot === st.activeSlot, bu = Math.max(2, U - 1);
    // Bubbles sit on the outer side of each head, so a tall stack never hides them.
    const bw = 34 * bu, bh = 26 * bu, side = slot === 0 ? 1 : -1;
    const bx = Math.round(clamp(side > 0 ? c.x + 12 * U : c.x - 12 * U - bw, 2 * bu, this.w - bw - 2 * bu)), by = Math.round(Math.max(9 * U, box.y));
    fill(g, C.outline, bx - bu, by - bu, bw + 2 * bu, bh + 2 * bu);
    fill(g, selected ? C.yellow : C.white, bx, by, bw, bh);
    fill(g, C.white, bx + bu, by + bu, bw - 2 * bu, bh - 2 * bu);
    const tx = side > 0 ? bx - 3 * bu : bx + bw + bu;
    fill(g, C.outline, tx, by + 10 * bu, 2 * bu, 4 * bu); fill(g, C.outline, side > 0 ? tx - bu : tx + 2 * bu, by + 11 * bu, bu, 2 * bu);
    if (selected) { fill(g, C.yellow, bx - 2 * bu, by - 2 * bu, bw + 4 * bu, bu); fill(g, C.yellow, bx - 2 * bu, by + bh + bu, bw + 4 * bu, bu); }
    const mini = this.miniDish(c.recipe);
    g.drawImage(mini, bx + 2 * bu, by + 2 * bu, 30 * bu, (30 * bu) * mini.height / mini.width);
    if (c.request) { g.font = "900 " + Math.round(8 * bu) + "px " + FONT; g.textBaseline = "top"; g.textAlign = "left"; g.fillStyle = HEX[C.lava]; g.fillText("!", bx + bw - 6 * bu, by + bu); }
    if (selected && !this.reduced) {
      const ay = Math.max(2 * bu, box.y - 7 * bu + Math.sin(this.now * 5) * bu);
      fill(g, C.outline, c.x - 3 * bu, ay - bu, 6 * bu, 4 * bu); fill(g, C.yellow, c.x - 2 * bu, ay, 4 * bu, 2 * bu); fill(g, C.yellow, c.x - bu, ay + 2 * bu, 2 * bu, bu);
    }
    return { x: bx, y: by, w: bw, h: bh };
  }
  /* While they speak: a speech bubble with their name, typing out what they want. */
  drawSpeech(g, c, slot, box, talk, text, named) {
    const U = this.U, bu = Math.max(2, U - 1);
    const size = Math.round(clamp(U * 3.6, 12, 17)), lineH = Math.round(size * 1.3), pad = Math.round(size * .6);
    g.font = "800 " + size + "px " + SPEECH_FONT; g.textBaseline = "top"; g.textAlign = "left";
    const maxW = Math.round(clamp(this.w * .28, 130, 280)), key = text + "|" + maxW + "|" + size;
    if (!talk.layout || talk.layout.key !== key) {
      const lines = wrap(g, text, maxW - 2 * pad, this.lang === "zh");
      const wide = Math.max(...lines.map(([a, b]) => g.measureText(text.slice(a, b)).width), g.measureText(this.t(c.who.name[0], c.who.name[1])).width + size);
      talk.layout = { key, lines, w: Math.ceil(wide) + 2 * pad };
    }
    const { lines, w: bw } = talk.layout, head = named ? 1 : 0, bh = 2 * pad + lineH * (lines.length + head);
    const side = slot === 0 ? 1 : -1;
    const bx = Math.round(clamp(side > 0 ? c.x + 12 * U : c.x - 12 * U - bw, 2 * bu, this.w - bw - 2 * bu));
    const by = Math.round(clamp(box.y - lineH, 2 * bu, Math.max(2 * bu, this.counterY - bh - 2 * U)));
    fill(g, C.outline, bx - bu, by - bu, bw + 2 * bu, bh + 2 * bu);
    fill(g, C.white, bx, by, bw, bh);
    const tx = side > 0 ? bx - 3 * bu : bx + bw + bu, ty = Math.round(clamp(box.y + 8 * U, by + 2 * bu, by + bh - 6 * bu));
    fill(g, C.outline, tx, ty, 2 * bu, 4 * bu); fill(g, C.outline, side > 0 ? tx - bu : tx + 2 * bu, ty + bu, bu, 2 * bu);
    // Name first, with a swatch of their shirt colour so it matches the person.
    if (named) {
      fill(g, C.outline, bx + pad, by + pad + 2, size - 4, size - 4); fill(g, c.who.shirt, bx + pad + 1, by + pad + 3, size - 6, size - 6);
      g.fillStyle = HEX[C.magenta]; g.fillText(this.t(c.who.name[0], c.who.name[1]), bx + pad + size, by + pad);
    }
    g.fillStyle = HEX[C.space2];
    const typed = Math.min(text.length, Math.floor(talk.typed));
    lines.forEach(([a, b], i) => { if (typed > a) g.fillText(text.slice(a, Math.min(b, typed)), bx + pad, by + pad + lineH * (i + head)); });
    return { x: bx, y: by, w: bw, h: bh };
  }
  miniDish(recipe) {
    this.minis = this.minis || new Map();
    const key = recipe.family + ":" + recipe.sequence.join(",");
    if (!this.minis.has(key)) {
      const canvas = document.createElement("canvas"); canvas.width = 64; canvas.height = 48;
      const g = canvas.getContext("2d"); let y = 42;
      const put = id => { const s = sprite(id); g.drawImage(s.canvas, Math.round(32 - s.w / 2), Math.round(y - s.h)); y -= s.thick || 3; };
      const plate = sprite("plate"); g.drawImage(plate.canvas, 0, 40);
      if (recipe.family === "salad") {
        const bowl = sprite("bowl"); g.drawImage(bowl.canvas, 1, 42 - bowl.h);
        y = 33; recipe.sequence.forEach(id => { const s = sprite(id); g.drawImage(s.canvas, Math.round(32 - s.w / 2), y - s.h); y -= 2; });
      } else {
        if (recipe.family === "burger") put("bun-base");
        recipe.sequence.forEach(put);
        if (recipe.family === "burger") put("bun-top");
      }
      this.minis.set(key, canvas);
    }
    return this.minis.get(key);
  }

  /* ---------- background ---------- */
  paintBackground() {
    const w = this.w, h = this.h, U = this.U, cy = this.counterY;
    for (const canvas of [this.wall, this.front]) { canvas.width = this.canvas.width; canvas.height = this.canvas.height; }
    const g = this.wall.getContext("2d"); g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // Tiled wall with a warm stripe, like the v0.6 café.
    fill(g, C.sandLit, 0, 0, w, cy);
    for (let y = 8 * U; y < cy; y += 8 * U) fill(g, C.sand, 0, y, w, Math.max(1, U / 2));
    for (let y = 8 * U, row = 0; y < cy; y += 8 * U, row++) for (let x = (row % 2) * 6 * U; x < w; x += 12 * U) fill(g, C.sand, x, y, Math.max(1, U / 2), 8 * U);
    fill(g, C.greenLit, 0, cy - 9 * U, w, 3 * U); fill(g, C.green, 0, cy - 6 * U, w, U);
    // Awning
    for (let x = 0, i = 0; x < w; x += 10 * U, i++) {
      fill(g, i % 2 ? C.white : C.red, x, 0, 10 * U, 6 * U);
      fill(g, i % 2 ? C.white : C.red, x + U, 6 * U, 8 * U, U); fill(g, i % 2 ? C.white : C.red, x + 2 * U, 7 * U, 6 * U, U);
    }
    fill(g, C.outline, 0, 0, w, U);
    // Window on the left
    if (w > 420) {
      const wx = Math.round(w * .04), wy = 13 * U, ww = Math.min(Math.round(w * .17), 52 * U), wh = Math.min(cy - wy - 14 * U, 40 * U);
      if (wh > 12 * U) {
        fill(g, C.woodDark, wx - U, wy - U, ww + 2 * U, wh + 2 * U); fill(g, C.wood, wx, wy, ww, wh);
        fill(g, C.ice, wx + 2 * U, wy + 2 * U, ww - 4 * U, wh - 4 * U);
        fill(g, C.yellow, wx + ww - 12 * U, wy + 4 * U, 5 * U, 5 * U);
        fill(g, C.white, wx + 5 * U, wy + 6 * U, 10 * U, 2 * U); fill(g, C.white, wx + 8 * U, wy + 4 * U, 5 * U, 2 * U);
        fill(g, C.greenLit, wx + 2 * U, wy + wh - 9 * U, ww - 4 * U, 7 * U); fill(g, C.green, wx + 2 * U, wy + wh - 5 * U, ww - 4 * U, 3 * U);
        fill(g, C.woodDark, wx + Math.round(ww * .35), wy + wh - 16 * U, 2 * U, 8 * U); fill(g, C.greenDark, wx + Math.round(ww * .35) - 4 * U, wy + wh - 22 * U, 10 * U, 7 * U);
        fill(g, C.wood, wx + Math.round(ww / 2) - U, wy, 2 * U, wh); fill(g, C.wood, wx, wy + Math.round(wh / 2), ww, 2 * U);
        fill(g, C.woodDark, wx - 3 * U, wy + wh + U, ww + 6 * U, 2 * U);
      }
    }
    // Shelf with herb pots on the right
    if (w > 420) {
      const sx = Math.round(w * .78), sy = 24 * U, sw = Math.round(w * .19);
      if (sy + 10 * U < cy - 12 * U) {
        fill(g, C.woodDark, sx, sy, sw, 2 * U); fill(g, C.wood, sx, sy, sw, U);
        for (let x = sx + 3 * U; x < sx + sw - 8 * U; x += 13 * U) {
          fill(g, C.outline, x - U, sy - 8 * U, 10 * U, 8 * U); fill(g, C.rockLit, x, sy - 7 * U, 8 * U, 7 * U); fill(g, C.rock, x, sy - 3 * U, 8 * U, 3 * U);
          fill(g, C.greenDark, x + 3 * U, sy - 14 * U, 2 * U, 7 * U); fill(g, C.green, x, sy - 13 * U, 4 * U, 3 * U); fill(g, C.greenLit, x + 4 * U, sy - 15 * U, 4 * U, 3 * U);
        }
      }
    }
    // Counter (drawn over the customers' legs)
    const f = this.front.getContext("2d"); f.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    fill(f, C.outline, 0, cy, w, U); fill(f, C.woodDark, 0, cy + U, w, 2 * U); fill(f, C.wood, 0, cy + 3 * U, w, 2 * U);
    fill(f, C.sandLit, 0, cy + 5 * U, w, h - cy - 5 * U);
    const rnd = seeded(131);
    for (let y = cy + 12 * U; y < h; y += 11 * U) fill(f, C.sand, 0, y, w, Math.max(1, Math.round(U / 2)));
    for (let i = 0; i < 26; i++) fill(f, C.sand, rnd() * w, cy + 8 * U + rnd() * (h - cy - 10 * U), (6 + rnd() * 14) * U, Math.max(1, Math.round(U / 2)));
  }

  /* ---------- update + draw ---------- */
  update(dt, st) {
    dt = clamp(dt, 0, .05); this.now += dt;
    this.reconcile(st); this.syncCustomers(st); this.updateCustomers(dt);
    this.scale = lerp(this.scale, this.targetScale(st.layers), 1 - Math.exp(-dt * 14));
    this.plateSpring.update(dt);
    this.layers.forEach(v => { v.squash.update(dt); v.angle.update(dt); v.tail.update(dt); v.slide.update(dt); });
    this.layers = this.layers.filter(v => v.removed === undefined || this.now - v.removed < .18);
    this.captions = this.captions.filter(t => this.now - t.born < (t.big ? .85 : .6));
    if (this.reduced) this.particles = [];
    this.particles.forEach(p => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; });
    this.particles = this.particles.filter(p => p.life > 0);
    this.trackStations(st.kitchen, dt);
    const g = this.c;
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    g.drawImage(this.wall, 0, 0);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); g.imageSmoothingEnabled = false;
    this.hits = []; this.regions = [];
    this.drawCustomers(g, st);
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(this.front, 0, 0);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); g.imageSmoothingEnabled = false;
    if (this.view === "grill") this.drawGrill(g, st.kitchen);
    else if (this.view === "board") this.drawBoard(g, st.kitchen);
    else if (this.view === "oven") this.drawOven(g, st.kitchen);
    else if (this.view === "plate") this.drawDish(g, st);
    this.drawEffects(g);
  }

  drawSprite(g, id, x, y, s, angle = 0, squash = 0, opts = {}) {
    const sp = sprite(id), soft = id === "sauce" ? .65 : .22, flat = id === "sauce" ? .37 : .28;
    g.save(); g.translate(x, y); g.rotate(angle); g.scale(s * (1 + squash * soft), s * (1 - squash * flat));
    if (id === "lettuce" && opts.tail) {
      const third = Math.round(sp.w / 3);
      g.drawImage(sp.canvas, third, 0, sp.w - 2 * third, sp.h, -sp.w / 2 + third, -sp.h, sp.w - 2 * third, sp.h);
      for (const side of [-1, 1]) {
        g.save(); g.translate(side * (sp.w / 2 - third), -sp.h / 2); g.rotate(side * opts.tail * .13);
        const sx = side < 0 ? 0 : sp.w - third;
        g.drawImage(sp.canvas, sx, 0, third, sp.h, side < 0 ? -third : 0, -sp.h / 2, third, sp.h); g.restore();
      }
    } else g.drawImage(sp.canvas, -sp.w / 2, -sp.h);
    if (id === "cheese") {
      const left = sprite("cheese-corner-left"), right = sprite("cheese-corner-right"), t = opts.tail || 0;
      g.save(); g.translate(-sp.w / 2 + 1, -sp.h + 2); g.rotate(t * .17); g.drawImage(left.canvas, 0, 0); g.restore();
      g.save(); g.translate(sp.w / 2 - 1, -sp.h + 2); g.rotate(-t * .21 + Math.sin(t * 7) * .018); g.drawImage(right.canvas, -right.w, 0); g.restore();
    }
    g.restore();
    return sp;
  }

  drawDish(g, st) {
    const station = st.stations[st.activeSlot];
    const x = this.dishX, y = this.plateY, s = this.scale, U = this.U;
    const napkin = sprite("napkin"), nS = Math.max(2, Math.round(Math.min(this.w * .5 / napkin.w, U * 1.6)));
    g.drawImage(napkin.canvas, Math.round(x - napkin.w * nS / 2), Math.round(y - 2 * nS), napkin.w * nS, napkin.h * nS);
    if (!station || station.phase === "waiting") {
      g.font = "900 " + Math.round(clamp(this.w / 34, 12, 22)) + "px " + FONT; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = HEX[C.woodDark]; g.fillText(this.t("Next customer soon", "下一位客人快來了"), x, y - 30 * U);
      return;
    }
    const service = this.serveStart < 0 ? -1 : this.now - this.serveStart;
    let fly = 0; if (service > .32) fly = easeIn((service - .32) / .4);
    g.save();
    if (fly > 0) { g.translate(fly * (this.w - x + 220), -Math.sin(fly * Math.PI) * this.h * .17); g.rotate(fly * .045); }
    const bump = this.reduced ? 0 : this.plateSpring.value;
    const plate = sprite("plate"), pS = Math.max(s * 1.15, 2);
    g.save(); g.translate(x, y + bump); g.rotate(this.reduced ? 0 : bump * .0015);
    g.drawImage(plate.canvas, -plate.w * pS / 2, -plate.h * pS * .45, plate.w * pS, plate.h * pS); g.restore();
    const anchor = y - 1 * s, fam = this.family;
    if (fam === "burger") this.drawSprite(g, "bun-base", x, anchor + bump * .8, s, 0, this.reduced ? 0 : Math.abs(bump) * .02);
    else if (fam === "salad") this.drawSprite(g, "bowl", x, anchor + bump * .8, s);
    let height = fam === "burger" ? sprite("bun-base").thick : fam === "salad" ? 6 : 0;
    const live = this.layers.filter(v => v.removed === undefined);
    live.forEach((v, i) => {
      const id = v.layer.pending ? "patty-raw" : v.layer.ingredient, sp = sprite(id);
      const ty = anchor - height * s, elapsed = this.now - v.born, duration = Math.max(.001, v.arriveAt - v.born);
      const p = v.landed ? 1 : clamp(elapsed / duration, 0, 1), e = easeOut(p);
      const tx = x + Math.sin(v.layer.id * 1.71) * (fam === "salad" ? 9 : .6) * s;
      let px = lerp(v.from.x, tx, e), py = lerp(Math.min(v.from.y, this.h + 25), ty, e) - Math.sin(p * Math.PI) * (this.reduced ? 0 : Math.min(20, this.h * .05));
      if (p === 1 && !v.landed) { v.landed = true; this.contact(v, tx, ty); }
      const squash = v.squash.value * (this.reduced ? .2 : 1), angle = this.reduced ? 0 : v.angle.value;
      px += this.reduced ? 0 : v.slide.value * s / 4 + angle * 8; py += this.reduced ? 0 : bump * (.8 + i * .1);
      v.lastX = px; v.lastY = py;
      const vs = s * lerp(.4, 1, e);
      g.save(); if (p < 1) g.globalAlpha *= Math.min(1, .3 + p * 2);
      if (v.layer.pending) {
        // Reserved place for a patty that is still on the grill: a dashed tray with a raw patty.
        const bw = 52 * vs, bh = 12 * vs;
        g.globalAlpha *= .9; fill(g, C.sandLit, px - bw / 2, py - bh, bw, bh);
        g.strokeStyle = HEX[C.woodDark]; g.lineWidth = Math.max(2, vs * .6); g.setLineDash([vs * 2, vs * 1.5]); g.strokeRect(px - bw / 2, py - bh, bw, bh); g.setLineDash([]);
        const raw = sprite("patty-raw"); g.globalAlpha *= .3; g.drawImage(raw.canvas, px - raw.w * vs * .35, py - bh + vs, raw.w * vs * .7, raw.h * vs * .7);
        g.globalAlpha = 1; g.font = "900 " + Math.round(clamp(vs * 3, 11, 18)) + "px " + FONT; g.textAlign = "center"; g.textBaseline = "middle";
        g.lineJoin = "round"; g.lineWidth = 4; g.strokeStyle = HEX[C.sandLit]; g.strokeText(this.t("ON THE GRILL", "煎肉排中"), px, py - bh / 2);
        g.fillStyle = HEX[C.woodDark]; g.fillText(this.t("ON THE GRILL", "煎肉排中"), px, py - bh / 2);
        this.hits.push({ id: v.layer.id, rect: { x: px - bw / 2, y: py - bh, w: bw, h: bh } });
      } else {
        this.drawSprite(g, id, px, py, vs, angle, squash, { tail: this.reduced ? 0 : v.tail.value });
        this.hits.push({ id: v.layer.id, ingredient: id, x: px, y: py, sx: vs * (1 + squash * .22), sy: vs * (1 - squash * .28), angle, sp });
      }
      g.restore();
      height += (sp.thick || 4) * (fam === "salad" ? .45 : 1);
    });
    for (const v of this.layers.filter(l => l.removed !== undefined && !l.layer.pending)) {
      const p = clamp((this.now - v.removed) / .18, 0, 1);
      g.save(); g.globalAlpha *= 1 - p; this.drawSprite(g, v.layer.ingredient, v.lastX - p * 40, v.lastY - easeOut(p) * 65, s * (1 - p * .3), -.2 * p); g.restore();
    }
    if (service >= 0) {
      const p = clamp(service / .16, 0, 1), ty = anchor - height * s;
      if (fam === "burger") this.drawSprite(g, "bun-top", x, ty - (1 - easeOut(p)) * 130, s, this.reduced ? 0 : Math.sin(service * 29) * Math.exp(-service * 10) * .02, this.reduced ? 0 : Math.sin(service * 30) * Math.exp(-service * 9) * .8);
      if (p === 1 && !this.serveImpact) this.lidImpact(ty);
    }
    g.restore();
    this.hits.reverse();
  }
  lidImpact(y) {
    this.serveImpact = true; this.plateSpring.kick(72);
    this.audio.cap(); this.audio.celebrate();
    this.burst(this.dishX, y, C.yellow, 26);
    this.caption("YUM!", this.dishX, Math.max(50, this.counterY - 20), C.lava, true);
  }
  contact(v, x, y) {
    const id = v.layer.ingredient, m = MATERIALS[id] || MATERIALS.patty;
    this.contacts++;
    this.audio.impact(id);
    const amp = this.reduced ? .24 : 1;
    v.squash.kick((id === "patty" ? 16 : id === "sauce" ? 30 : 24 * m.softness) * amp);
    if (this.reduced) return;
    v.tail.kick(id === "cheese" ? 38 : id === "lettuce" ? 42 : 12 * m.softness);
    if (id !== "sauce" && id !== "patty") v.angle.kick((v.layer.id % 2 ? 1 : -1) * 2.1 * m.softness);
    if (id === "tomato" || id === "pickles") v.slide.kick((v.layer.id % 2 ? 1 : -1) * (id === "tomato" ? 75 : 100));
    this.plateSpring.kick(30 * m.weight);
    for (const lower of this.layers) if (lower.layer.id < v.layer.id && lower.landed && lower.removed === undefined) { lower.squash.kick(7 * m.weight); lower.tail.kick(3 * m.weight); }
    const col = { patty: C.rock, cheese: C.yellow, tomato: C.red, lettuce: C.greenLit, pickles: C.green, sauce: C.red, lasagna: C.yellow }[id] || C.sand;
    this.burst(x, y - 4, col, id === "sauce" ? 7 : m.weight > .5 ? 5 : 3);
    this.caption(m.word, x + Math.min(this.w * .2, 150), y - 30, col);
  }

  /* ---------- stations ---------- */
  area() {
    const top = this.counterY + 6 * this.U, bottom = this.h - this.inset - this.U;
    return { top, bottom, h: Math.max(20, bottom - top), cx: this.w / 2 };
  }
  trackStations(k, dt) {
    if (!k) return;
    k.grill.forEach((job, i) => {
      const t = this.pans[i], prev = t.phase;
      if (prev !== job.phase) {
        if (prev === "flip" && job.phase === "side-two") { t.flipAt = this.now; this.audio.flip(); }
        if (prev === "empty" && job.phase === "side-one") { t.dropAt = this.now; this.audio.impact("patty"); }
        if (prev === "ready" && job.phase === "empty") t.collectAt = this.now;
        if (job.phase === "burnt") t.burntAt = this.now;
        t.phase = job.phase;
      }
      t.steam = (t.steam || 0) + dt;
      if (this.view === "grill" && t.rect && ["side-one", "side-two", "flip", "ready", "burnt"].includes(job.phase) && t.steam > (job.phase === "burnt" ? .12 : .22) && !this.reduced) {
        t.steam = 0;
        const r = t.rect;
        this.particles.push({ x: r.x + r.w * (.3 + Math.random() * .4), y: r.y + r.h * .2, vx: (Math.random() - .5) * 10, vy: -30 - Math.random() * 25, g: -10, life: .9, max: .9, size: this.U * (1 + Math.round(Math.random())), col: job.phase === "burnt" ? C.grey : C.white, keep: false });
      }
    });
    if (this.board.cuts !== k.board.cuts || this.board.ingredient !== k.board.ingredient) {
      if (k.board.cuts > (this.board.cuts || 0) || (k.board.cuts === 0 && this.board.cuts === k.board.required - 1 && this.board.ingredient === k.board.ingredient)) { this.board.chopAt = this.now; this.audio.chop(); }
      this.board.cuts = k.board.cuts; this.board.ingredient = k.board.ingredient;
    }
    const ov = this.oven, here = this.view === "oven";
    if (ov.phase !== k.oven.phase) {
      if (k.oven.phase === "baking") {
        ov.bakeAt = this.now;
        // The finished tray (already cleared in the model) is drawn sliding into the oven.
        if (ov.phase === "empty" && ov.lastLayers) { ov.sending = { at: this.now, layers: ov.lastLayers.slice() }; this.audio.cap(); }
      }
      if (ov.phase === "ready" && k.oven.phase === "empty" && here && ov.rect) {
        this.caption("+4", ov.rect.x + ov.rect.w / 2, ov.rect.y - 10, C.yellow); this.burst(ov.rect.x + ov.rect.w / 2, ov.rect.y + ov.rect.h / 2, C.yellow, 14);
      }
      ov.phase = k.oven.phase;
    }
    if (ov.layers !== k.lasagnaLayers.length) {
      const top = k.lasagnaLayers[k.lasagnaLayers.length - 1];
      if (k.lasagnaLayers.length > (ov.layers || 0)) {
        ov.layerAt = this.now; this.audio.impact(top === "pasta" ? "lettuce" : top);
        if (here && ov.dish) { const word = BAND_WORD[top] || BAND_WORD.pasta; this.caption(word[0], ov.dish.x, ov.dish.y - 24, word[1]); if (top === "sauce") this.burst(ov.dish.x, ov.dish.y, C.red, 8); }
      }
      ov.layers = k.lasagnaLayers.length;
    }
    if (k.lasagnaLayers.length) ov.lastLayers = k.lasagnaLayers.slice();
  }
  label(g, text, x, y, size, col, pulse) {
    const scale = pulse && !this.reduced ? 1 + Math.max(0, Math.sin(this.now * 7)) * .12 : 1;
    g.save(); g.translate(x, y); g.scale(scale, scale);
    g.font = "900 " + Math.round(size) + "px " + FONT; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineJoin = "round"; g.lineWidth = Math.max(3, size / 4); g.strokeStyle = HEX[C.outline]; g.strokeText(text, 0, 0);
    g.fillStyle = HEX[col]; g.fillText(text, 0, 0); g.restore();
  }
  bar(g, x, y, w, h, progress, col) {
    fill(g, C.outline, x - 1, y - 1, w + 2, h + 2); fill(g, C.space2, x, y, w, h); fill(g, col, x, y, w * clamp(progress, 0, 1), h);
  }
  drawGrill(g, k) {
    const a = this.area(), U = this.U;
    const pan = sprite("pan"), ps = clamp(Math.floor(Math.min(this.w * .36 / pan.w, a.h * .5 / pan.h)), 2, 7);
    const rangeW = Math.min(this.w * .92, pan.w * ps * 2 + 24 * U), rangeH = Math.min(a.h * .42, 16 * ps), rx = a.cx - rangeW / 2, ry = a.bottom - rangeH;
    fill(g, C.outline, rx - U, ry - U, rangeW + 2 * U, rangeH + 2 * U); fill(g, C.steel, rx, ry, rangeW, rangeH); fill(g, C.snowShade, rx, ry, rangeW, U * 2);
    for (let i = 0; i < 2; i++) {
      const job = k.grill[i], t = this.pans[i];
      const px = a.cx + (i ? 1 : -1) * rangeW * .25 - pan.w * ps * .38, py = ry - pan.h * ps * .4;
      // burner flames under a working pan
      if (["side-one", "side-two", "flip", "ready"].includes(job.phase)) for (let f = 0; f < 6; f++) {
        const fl = this.reduced ? 2 : 2 + Math.round((Math.sin(this.now * 20 + f * 1.7) + 1) * 1.5);
        fill(g, f % 2 ? C.yellow : C.lava, px + (6 + f * 6) * ps, py + pan.h * ps - fl * ps * .6, 3 * ps, fl * ps * .6);
      }
      g.drawImage(pan.canvas, px, py, pan.w * ps, pan.h * ps);
      const rect = { x: px, y: py - 18 * ps, w: 46 * ps, h: pan.h * ps + 18 * ps };
      t.rect = rect;
      this.regions.push({ ...rect, action: "grill:" + i });
      if (job.phase !== "empty") {
        const id = job.phase === "burnt" ? "patty-burnt" : job.phase === "side-one" || job.phase === "flip" ? "patty-raw" : "patty";
        const sp = sprite(id); let hop = 0, flipScale = 1;
        if (t.flipAt !== undefined && this.now - t.flipAt < .4 && !this.reduced) { const q = (this.now - t.flipAt) / .4; hop = Math.sin(q * Math.PI) * 26 * ps; flipScale = Math.cos(q * Math.PI); }
        if (t.dropAt !== undefined && this.now - t.dropAt < .18 && !this.reduced) hop = (1 - (this.now - t.dropAt) / .18) * 30 * ps;
        const cxp = px + 23 * ps, cyp = py + 2 * ps - hop;
        g.save(); g.translate(cxp, cyp - sp.h * ps / 2); g.scale(1, flipScale || .05); g.drawImage(sp.canvas, -sp.w * ps * .42, -sp.h * ps * .42, sp.w * ps * .84, sp.h * ps * .84); g.restore();
        if (job.quantity === undefined && job.phase !== "burnt") { g.save(); g.translate(cxp + 6 * ps, cyp - sp.h * ps * .2); g.drawImage(sp.canvas, -sp.w * ps * .3, -sp.h * ps * .3, sp.w * ps * .6, sp.h * ps * .6); g.restore(); }
        const ready = job.phase === "flip" || job.phase === "ready";
        const progress = ready ? 1 - job.remaining / (job.duration || 1) : 1 - job.remaining / (job.duration || 1);
        this.bar(g, px + 4 * ps, py + pan.h * ps + 3 * U, 38 * ps, Math.max(4, 2 * U), job.phase === "burnt" ? 1 : progress, ready ? (job.phase === "flip" ? C.yellow : C.greenLit) : job.phase === "burnt" ? C.grey : C.lava);
        const size = clamp(ps * 5, 14, 30), ly = py - 14 * ps;
        // FLIP / TAKE IT OUT are said by the big prompt; over the pan, only the seconds left.
        if (job.phase === "flip") this.label(g, Math.ceil(job.remaining) + "s", cxp, ly, size, C.yellow, true);
        else if (job.phase === "ready") this.label(g, Math.ceil(job.remaining) + "s", cxp, ly, size, C.greenLit, true);
        else if (job.phase === "burnt") this.label(g, this.t("BURNT", "燒焦了"), cxp, ly, size, C.grey, false);
        else this.label(g, Math.ceil(job.remaining) + "s", cxp, ly, size, C.white, false);
        if (job.targetOrderId !== undefined) this.label(g, "★", cxp + 22 * ps, ly, size * .8, C.yellow, false);
      } else this.label(g, "+2", px + 23 * ps, py - 10 * ps, clamp(ps * 4, 12, 24), C.snowShade, false);
      if (t.collectAt !== undefined && this.now - t.collectAt < .35 && !this.reduced) {
        const q = (this.now - t.collectAt) / .35, sp = sprite("patty");
        g.save(); g.globalAlpha = 1 - q; g.drawImage(sp.canvas, px + 4 * ps, py - q * 80 * ps * .5, sp.w * ps * .8, sp.h * ps * .8); g.restore();
      }
    }
  }
  drawBoard(g, k) {
    const a = this.area(), U = this.U, b = k.board;
    const bs = clamp(Math.floor(Math.min(this.w * .7 / 90, a.h * .75 / 34)), 2, 7);
    const bw = 90 * bs, bh = 22 * bs, bx = a.cx - bw / 2, by = a.bottom - bh - 2 * U;
    fill(g, C.outline, bx - bs, by - bs, bw + 2 * bs, bh + 2 * bs); fill(g, C.wood, bx, by, bw, bh); fill(g, C.sand, bx, by, bw, 2 * bs);
    fill(g, C.woodDark, bx, by + bh - 3 * bs, bw, 3 * bs); fill(g, C.woodDark, bx + bw - 10 * bs, by + 6 * bs, 5 * bs, 3 * bs);
    this.regions.push({ x: bx, y: by - 30 * bs, w: bw, h: bh + 30 * bs, action: "board:cut" });
    const whole = sprite(b.ingredient === "tomato" ? "whole-tomato" : "whole-lettuce"), slice = sprite(b.ingredient);
    const left = 1 - b.cuts / b.required;
    const chop = this.board.chopAt !== undefined ? this.now - this.board.chopAt : 9;
    const shake = chop < .15 && !this.reduced ? Math.sin(chop * 80) * bs : 0;
    g.drawImage(whole.canvas, 0, 0, Math.max(4, Math.round(whole.w * left)), whole.h, bx + 10 * bs + shake, by - whole.h * bs + 2 * bs, Math.max(4, Math.round(whole.w * left)) * bs, whole.h * bs);
    for (let i = 0; i < b.cuts * 2; i++) g.drawImage(slice.canvas, bx + 40 * bs + (i % 3) * 2 * bs, by - (i + 1) * 2 * bs, slice.w * bs * .7, slice.h * bs * .7);
    const knife = sprite("knife"), kx = bx + 10 * bs + Math.round(whole.w * left) * bs - 2 * bs, kd = chop < .12 && !this.reduced ? 0 : 10 * bs;
    g.drawImage(knife.canvas, kx, by - whole.h * bs - kd, knife.w * bs, knife.h * bs);
    for (let i = 0; i < b.required; i++) fill(g, i < b.cuts ? C.greenLit : C.snowShade, bx + bw - (b.required - i) * 7 * bs, by + 8 * bs, 5 * bs, 5 * bs);
    this.label(g, b.cuts + " / " + b.required, a.cx + bw * .3, by - 12 * bs, clamp(bs * 5, 14, 30), C.white, false);
  }
  /* ---------- lasagna: a big glass dish of chunky layers, then into the oven (07-lasagna.md) ---------- */
  /* One layer as a slab of colour, `w × h` screen px from (x, y) at art scale `s`. */
  drawBand(g, id, x, y, w, h, s, n) {
    if (id === "pasta") {
      fill(g, C.sand, x, y, w, h); fill(g, C.wood, x, y + h - s, w, s);
      for (let i = 0, xx = x; xx < x + w; xx += 3 * s, i++) fill(g, (i + n) % 2 ? C.sandLit : C.yellow, xx, y, Math.min(3 * s, x + w - xx), s);
      for (let xx = x + 4 * s; xx < x + w - 2 * s; xx += 9 * s) fill(g, C.yellow, xx, y + 2 * s, 3 * s, Math.max(1, s / 2));
    } else if (id === "sauce") {
      fill(g, C.red, x, y, w, h); fill(g, C.rockDark, x, y + h - s, w, s);
      for (let xx = x + ((n * 5) % 7) * s; xx < x + w - 4 * s; xx += 11 * s) { fill(g, C.lava, xx, y + s, 4 * s, s); fill(g, C.red, xx + 6 * s, y + h, 2 * s, s); }
    } else {
      fill(g, C.yellow, x, y, w, h); fill(g, C.sand, x, y + h - s, w, s);
      for (let xx = x + ((n * 3) % 5) * s; xx < x + w - 2 * s; xx += 5 * s) fill(g, (xx / s + n) % 3 < 1 ? C.white : C.sandLit, xx, y + (Math.floor(xx / s) % 2) * s, 2 * s, s);
    }
  }
  /* The glass baking dish with its layers; returns where each layer sits so taps can remove it. */
  drawBakingDish(g, cx, base, s, layers, opts = {}) {
    const W = 72, H = 28, x0 = Math.round(cx - W * s / 2), top = base - H * s, wall = 3 * s;
    const rects = [];
    g.save(); g.globalAlpha = .3; fill(g, C.ice, x0 + s, top, (W - 2) * s, H * s); g.restore();
    let y = base - 2 * s;
    const fresh = opts.fresh === undefined ? 9 : opts.fresh;
    layers.forEach((id, i) => {
      const bh = BAND[id] * s;
      let drop = 0, squash = 1;
      if (i === layers.length - 1 && fresh < .4 && !this.reduced) {
        const p = fresh / .4;
        if (p < .4) drop = Math.pow(1 - p / .4, 2) * 30 * s;
        else squash = 1 - Math.sin((p - .4) / .6 * Math.PI) * .3 * (1 - p);
      }
      const h = Math.max(s, Math.round(bh * squash)), bx = x0 + wall, bw = W * s - 2 * wall;
      this.drawBand(g, id, bx, y - h - drop, bw, h, s, i);
      if (opts.check && id !== LASAGNA_STEPS[i] && (this.reduced || Math.floor(this.now * 3) % 2 === 0)) {
        g.strokeStyle = HEX[C.red]; g.lineWidth = s; g.strokeRect(bx + s / 2, y - h + s / 2, bw - s, h - s);
      }
      rects.push({ x: bx, y: y - bh, w: bw, h: bh, index: i });
      y -= bh;
    });
    // A faint copy of the layer that goes next, so the dish itself shows what to add.
    if (opts.ghost) {
      g.save(); g.globalAlpha = this.reduced ? .35 : .25 + Math.max(0, Math.sin(this.now * 5)) * .25;
      this.drawBand(g, opts.ghost, x0 + wall, y - BAND[opts.ghost] * s, W * s - 2 * wall, BAND[opts.ghost] * s, s, layers.length);
      g.restore();
    }
    // Front glass: walls, base, rim with handles and a highlight streak.
    fill(g, C.outline, x0, top, s, H * s); fill(g, C.outline, x0 + (W - 1) * s, top, s, H * s); fill(g, C.outline, x0, base - s, W * s, s);
    fill(g, C.snowShade, x0 + s, top, s * 2, H * s - s); fill(g, C.snowShade, x0 + (W - 3) * s, top, s * 2, H * s - s); fill(g, C.snowShade, x0 + s, base - 2 * s, (W - 2) * s, s);
    fill(g, C.outline, x0 - 5 * s, top - s, W * s + 10 * s, s * 3); fill(g, C.white, x0 - 4 * s, top, W * s + 8 * s, s);
    g.save(); g.globalAlpha = .55; fill(g, C.white, x0 + 6 * s, top + 3 * s, s, H * s - 7 * s); fill(g, C.white, x0 + 8 * s, top + 3 * s, s, 4 * s); g.restore();
    return { x: x0, y: top, w: W * s, h: H * s, rects };
  }
  drawOven(g, k) {
    const a = this.area(), U = this.U, o = k.oven, layers = k.lasagnaLayers, sending = this.oven.sending;
    const ds = clamp(Math.floor(Math.min(this.w * .44 / 72, a.h * .82 / 28)), 2, 8);
    const dishX = Math.round(this.w * .33), base = a.bottom - 2 * ds;
    const os = clamp(Math.floor(Math.min(this.w * .28 / 64, a.h * .85 / 46)), 2, 7);
    const ow = 64 * os, oh = 44 * os, ox = Math.round(Math.max(this.w * .6, dishX + 40 * ds)), oy = a.bottom - oh;
    // Oven
    fill(g, C.outline, ox - os, oy - os, ow + 2 * os, oh + 2 * os); fill(g, C.steel, ox, oy, ow, oh); fill(g, C.snowShade, ox, oy, ow, 6 * os);
    for (let i = 0; i < 3; i++) fill(g, C.outline, ox + (6 + i * 7) * os, oy + 2 * os, 4 * os, 2 * os);
    fill(g, o.phase === "ready" ? C.greenLit : o.phase === "baking" ? C.lava : C.grey, ox + ow - 8 * os, oy + 2 * os, 3 * os, 3 * os);
    const inside = { x: ox + 6 * os, y: oy + 10 * os, w: ow - 12 * os, h: oh - 17 * os };
    fill(g, C.outline, inside.x - os, inside.y - os, inside.w + 2 * os, inside.h + 2 * os);
    fill(g, o.phase === "baking" ? C.rockDark : o.phase === "burnt" ? C.outline : C.space, inside.x, inside.y, inside.w, inside.h);
    const arriving = sending && this.now - sending.at < SEND_TIME;
    if (o.phase === "baking" && !arriving) {
      const glow = this.reduced ? 1 : .75 + Math.sin(this.now * 6) * .25;
      g.save(); g.globalAlpha = glow * .55; fill(g, C.lava, inside.x, inside.y + inside.h - 5 * os, inside.w, 5 * os); g.restore();
    }
    if (o.phase !== "empty" && !arriving) {
      const las = sprite(o.phase === "burnt" ? "patty-burnt" : "lasagna"), ls = Math.min(inside.w * .8 / las.w, inside.h * .7 / las.h);
      g.drawImage(las.canvas, inside.x + inside.w / 2 - las.w * ls / 2, inside.y + inside.h - 2 * os - las.h * ls, las.w * ls, las.h * ls);
      if (!this.reduced && (o.phase === "baking" || o.phase === "ready") && this.random() < .12)
        this.particles.push({ x: inside.x + inside.w * (.25 + this.random() * .5), y: inside.y + inside.h * .4, vx: (this.random() - .5) * 8, vy: -26, g: -8, life: .7, max: .7, size: U, col: o.phase === "ready" ? C.white : C.yellow, keep: false });
    }
    fill(g, C.snowShade, inside.x + 2 * os, inside.y + os, 2 * os, inside.h - 4 * os);
    this.oven.rect = { x: ox, y: oy, w: ow, h: oh };
    this.regions.push({ x: ox, y: oy, w: ow, h: oh, action: "oven" });
    if (o.phase !== "empty" && !arriving) {
      const size = clamp(os * 5, 14, 28);
      this.bar(g, ox + 6 * os, oy - 6 * os, ow - 12 * os, Math.max(4, 2 * U), o.phase === "burnt" ? 1 : 1 - o.remaining / (o.duration || 1), o.phase === "ready" ? C.greenLit : o.phase === "burnt" ? C.grey : C.lava);
      // When it is ready the big TAKE IT OUT prompt says so; the bar alone shows the time left.
      if (o.phase !== "ready") this.label(g, o.phase === "burnt" ? this.t("BURNT", "燒焦了") : Math.ceil(o.remaining) + "s", ox + ow / 2, oy - 14 * os, size, C.white, false);
    }
    // The dish being layered: tap a layer to take it off, like the burger.
    const ok = layers.every((id, i) => id === LASAGNA_STEPS[i]);
    const ghost = ok && layers.length < LASAGNA_STEPS.length ? LASAGNA_STEPS[layers.length] : null;
    const fresh = this.oven.layerAt !== undefined ? this.now - this.oven.layerAt : 9;
    const dish = this.drawBakingDish(g, dishX, base, ds, layers, { fresh, ghost, check: true });
    this.oven.dish = { x: dishX, y: dish.y };
    dish.rects.forEach(r => this.regions.push({ x: r.x, y: r.y, w: r.w, h: r.h, action: "lasagna:remove:" + r.index }));
    this.label(g, layers.length + " / " + LASAGNA_STEPS.length, dishX, dish.y - 9 * ds, clamp(ds * 5, 14, 26), layers.length === LASAGNA_STEPS.length && ok ? C.greenLit : C.white, false);
    // A finished tray slides into the oven, shrinking as it goes in.
    if (arriving) {
      const p = clamp((this.now - sending.at) / SEND_TIME, 0, 1), e = easeIn(p);
      const tx = inside.x + inside.w / 2, ty = inside.y + inside.h - 2 * os;
      const x = lerp(dishX, tx, e), y = lerp(base, ty, e) - Math.sin(p * Math.PI) * 24 * ds, s = Math.max(1, lerp(ds, ds * .45, e));
      this.drawBakingDish(g, x, y, s, sending.layers);
    }
  }

  /* ---------- effects ---------- */
  burst(x, y, col, count) {
    if (this.reduced) return;
    for (let i = 0; i < count && this.particles.length < 110; i++) {
      const a = -Math.PI + this.random() * Math.PI, speed = 65 + this.random() * 190, life = .32 + this.random() * .4;
      this.particles.push({ x: x + (this.random() - .5) * 60, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, g: 230, life, max: life, size: this.U * (1 + Math.floor(this.random() * 2)), col: i % 3 === 0 ? C.white : col });
    }
  }
  caption(text, x, y, col, big = false) {
    if (this.reduced && !big) return;
    if (this.captions.length >= 3) this.captions.shift();
    this.captions.push({ text, x: clamp(x, 70, this.w - 70), y: clamp(y, 30, this.h - 40), born: this.now, col, big });
  }
  drawEffects(g) {
    for (const p of this.particles) {
      g.globalAlpha = clamp(p.life / p.max * 1.8, 0, 1);
      fill(g, p.col, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    g.globalAlpha = 1;
    for (const t of this.captions) {
      const p = clamp((this.now - t.born) / (t.big ? .85 : .6), 0, 1), pop = t.big ? 1 + Math.sin(p * 9) * Math.exp(-p * 7) * .2 : 1 + Math.sin(p * 8) * Math.exp(-p * 6) * .12;
      g.save(); g.translate(t.x, t.y - p * (t.big ? 6 : 18)); g.scale(pop, pop); g.rotate(t.big ? -.055 : .055);
      g.globalAlpha = p > .7 ? (1 - p) / .3 : 1;
      const size = t.big ? clamp(this.w / 12, 34, 72) : clamp(this.w / 34, 16, 28);
      g.font = "900 " + Math.round(size) + "px " + FONT; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
      g.lineWidth = t.big ? 10 : 6; g.strokeStyle = HEX[C.outline]; g.strokeText(t.text, 0, 0);
      g.fillStyle = HEX[t.col]; g.fillText(t.text, 0, 0); g.restore();
    }
  }

  /* ---------- input ---------- */
  hitTest(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect(), x = clientX - r.left, y = clientY - r.top;
    if (this.view === "plate" && this.serveStart < 0) {
      for (const h of this.hits) {
        if (h.rect) { if (rectsHit(h.rect, x, y)) return { type: "layer", id: h.id }; continue; }
        const dx = x - h.x, dy = y - h.y, ca = Math.cos(h.angle), sa = Math.sin(h.angle);
        const u = (dx * ca + dy * sa) / h.sx, v = (-dx * sa + dy * ca) / h.sy;
        const px = Math.floor(u + h.sp.w / 2), py = Math.floor(v + h.sp.h);
        // A one-pixel grace ring keeps thin layers (sauce, cheese) tappable by a finger.
        for (const [ox, oy] of [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0], [0, -2], [0, 2]]) {
          const qx = px + ox, qy = py + oy;
          if (qx >= 0 && qy >= 0 && qx < h.sp.w && qy < h.sp.h && h.sp.mask[qy * h.sp.w + qx]) return { type: "layer", id: h.id };
        }
      }
    }
    for (const region of this.regions.slice().reverse()) {
      if (!rectsHit(region, x, y)) continue;
      if (region.customer !== undefined) return { type: "customer", slot: region.customer };
      if (region.action) return { type: "action", action: region.action };
    }
    return null;
  }
  /* Centre of a layer on screen — used by tests and keyboard focus rings. */
  layerPoint(id) {
    const r = this.canvas.getBoundingClientRect(), h = this.hits.find(entry => entry.id === id);
    if (!h) return null;
    if (h.rect) return { x: r.left + h.rect.x + h.rect.w / 2, y: r.top + h.rect.y + h.rect.h / 2 };
    return { x: r.left + h.x, y: r.top + h.y - h.sp.h * h.sy / 2 };
  }
  get diagnostics() {
    return { width: this.w, height: this.h, unit: this.U, scale: this.scale, view: this.view, contacts: this.contacts,
      visualLayers: this.layers.length, pending: this.layers.filter(v => !v.landed && v.removed === undefined).length,
      particles: this.particles.length, captions: this.captions.map(c => c.text), regions: this.regions.length,
      customers: this.customers.map(c => c && { id: c.id, state: c.state, who: c.who && c.who.id, talking: !!c.talk, thanks: !!c.thanks }),
      line: this.liners.map(l => ({ who: l.who.id, state: l.state })), arrivals: this.arrivals.slice(), talks: this.talks };
  }
}
