/* Kitchen Quest customers: a small cast of regulars with a name, a look and a voice,
   so a child can tell "Captain Tom" from "Grandma Rose" at a glance (05-readability.md,
   06-customers.md). Presentation only: the model still owns orders and seats; this
   module only decides who is wearing each order and who is waiting in line. */
import { HEX, C } from "../../world/planet-palette.js";
import { RECIPES, REQUESTS } from "./strings.js";
import { seeded } from "./motion.js";

/* `want` holds {dish}; English dish names go lower-case mid-sentence. `thanks` is said when served.
   Every line ships EN + 中文. */
export const CAST = [
  { id: "mia", name: ["Mia", "米亞"], skin: C.sand, hair: C.yellow, style: "pigtails", shirt: C.pink, extra: "bow", voice: 560, wave: "triangle",
    thanks: ["Yummy! Thank you!", "好好吃！謝謝！"], hi: ["Hi! I'm Mia.", "嗨！我是米亞。"], want: ["Can I have a {dish}?", "我可以吃{dish}嗎？"] },
  { id: "leo", name: ["Leo", "里歐"], skin: C.rockLit, hair: C.woodDark, style: "short", shirt: C.lava, extra: "cap", voice: 300, wave: "triangle",
    thanks: ["Awesome, thanks!", "太棒了，謝啦！"], hi: ["Hey! Leo here.", "嘿！我是里歐。"], want: ["One {dish}, please!", "請給我一份{dish}！"] },
  { id: "rose", name: ["Grandma Rose", "玫瑰奶奶"], skin: C.sandLit, hair: C.snowShade, style: "bun", shirt: C.purple, extra: "glasses", voice: 400, wave: "sine",
    thanks: ["Delicious, dear!", "真好吃，乖孩子！"], hi: ["Hello, dear! I'm Grandma Rose.", "乖孩子你好！我是玫瑰奶奶。"], want: ["A {dish} would be lovely.", "我想要一份{dish}，謝謝你。"] },
  { id: "tom", name: ["Captain Tom", "湯姆船長"], skin: C.sand, hair: C.white, style: "short", shirt: C.ocean, extra: "captain", voice: 170, wave: "triangle",
    thanks: ["Arr, delicious!", "啊哈，真美味！"], hi: ["Ahoy! Captain Tom here.", "啊嗨！我是湯姆船長。"], want: ["Bring me a {dish}!", "給我來一份{dish}！"] },
  { id: "robo", name: ["Robo", "機器人小波"], skin: C.steel, hair: C.steel, style: "robot", shirt: C.grey, extra: "robot", voice: 720, wave: "square",
    thanks: ["YUM.EXE COMPLETE.", "美味程式完成。"], hi: ["BEEP BOOP. I AM ROBO.", "嗶嗶啵啵，我是機器人小波。"], want: ["ROBO NEEDS A {DISH}.", "小波需要{dish}。"] },
  { id: "ava", name: ["Astronaut Ava", "太空人艾娃"], skin: C.rock, hair: C.outline, style: "short", shirt: C.white, extra: "helmet", voice: 470, wave: "sine",
    thanks: ["Out of this world!", "好吃到外太空！"], hi: ["Hello from space! I'm Ava.", "來自太空的問候！我是艾娃。"], want: ["One {dish} for my rocket trip!", "我要帶一份{dish}上火箭！"] },
  { id: "ben", name: ["Ben", "小班"], skin: C.rockLit, hair: C.outline, style: "short", shirt: C.green, extra: "headphones", voice: 340, wave: "triangle",
    thanks: ["So good, thanks!", "超好吃，謝謝！"], hi: ["Yo! I'm Ben.", "哈囉！我是小班。"], want: ["I'd like a {dish}.", "我想要{dish}。"] },
  { id: "lily", name: ["Lily", "莉莉"], skin: C.sand, hair: C.lava, style: "long", shirt: C.yellow, extra: "flower", voice: 620, wave: "triangle",
    thanks: ["Lovely, thank you!", "好棒，謝謝你！"], hi: ["Hello! I'm Lily.", "你好！我是莉莉。"], want: ["May I have a {dish}, please?", "可以給我{dish}嗎？"] },
  { id: "kim", name: ["Coach Kim", "金教練"], skin: C.sandLit, hair: C.outline, style: "short", shirt: C.red, extra: "headband", voice: 260, wave: "triangle",
    thanks: ["Champion food!", "冠軍美食！"], hi: ["Let's go! Coach Kim here!", "加油！我是金教練！"], want: ["Fuel me up with a {dish}!", "給我一份{dish}補充體力！"] },
  { id: "max", name: ["Max", "麥克斯"], skin: C.rock, hair: C.purple, style: "spiky", shirt: C.cyan, extra: "", voice: 430, wave: "triangle",
    thanks: ["Wow, amazing!", "哇，太讚了！"], hi: ["Wow, what a kitchen! I'm Max.", "哇，好棒的廚房！我是麥克斯。"], want: ["A {dish}, please!", "請給我{dish}！"] }
];

/** What a customer says at the counter, in one language. */
export function speech(who, order, lang) {
  const zh = lang === "zh", dish = RECIPES[order.recipe.id][zh ? 1 : 0];
  const said = dish.toLowerCase();
  let want = who.want[zh ? 1 : 0].replace("{dish}", zh ? dish : said).replace("{DISH}", dish.toUpperCase());
  const request = order.request ? REQUESTS[order.request][zh ? 1 : 0] + (zh ? "！" : "!") : "";
  return [who.hi[zh ? 1 : 0], want, request].filter(Boolean).join(zh ? "" : " ");
}

/** Who wears each order, and who is waiting in line for the next free seat. */
export class Cast {
  constructor(seed = 29813, lineLength = 2) {
    this.random = seeded(seed);
    this.byOrder = new Map(); this.deck = []; this.lineLength = lineLength;
    this.line = [];
    this.seated = [null, null];
  }
  draw(avoid) {
    for (let tries = 0; tries < 30; tries++) {
      if (!this.deck.length) {
        this.deck = CAST.slice();
        for (let i = this.deck.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]]; }
      }
      const who = this.deck.shift();
      if (!avoid.has(who.id)) return who;
      this.deck.push(who);
    }
    return CAST.find(who => !avoid.has(who.id)) || CAST[0];
  }
  visible() {
    return new Set([...this.line, ...this.seated].filter(Boolean).map(who => who.id));
  }
  /* New orders take the person at the front of the line; the line refills from the street. */
  sync(stations) {
    stations.forEach(st => {
      const order = st.order;
      if (!order || this.byOrder.has(order.id)) return;
      const who = this.line.length ? this.line.shift() : this.draw(this.visible());
      this.byOrder.set(order.id, who);
      this.seated[st.slot] = who;
    });
    while (this.line.length < this.lineLength) this.line.push(this.draw(this.visible()));
    if (this.byOrder.size > 40) this.byOrder.delete(this.byOrder.keys().next().value);
  }
  of(orderId) { return this.byOrder.get(orderId) || null; }
}

/* One pixel-art person on a 20-wide grid, 34 tall from `top` (accessories may poke above). */
export function drawPerson(g, x0, top, U, who, mood = {}) {
  const p = (col, x, y, w, h) => { g.fillStyle = HEX[col]; g.fillRect(Math.round(x0 + x * U), Math.round(top + y * U), Math.round(w * U), Math.round(h * U)); };
  const robot = who.extra === "robot";
  // torso and arms
  p(C.outline, 1, 18, 18, 16); p(who.shirt, 2, 19, 16, 15);
  if (who.extra === "helmet") { p(C.lava, 4, 22, 3, 2); p(C.steel, 13, 21, 3, 6); } else if (robot) { p(C.cyan, 8, 22, 4, 3); p(C.outline, 9, 23, 2, 1); } else p(C.white, 8, 19, 4, 3);
  if (who.extra === "captain") { p(C.yellow, 5, 22, 1, 1); p(C.yellow, 5, 25, 1, 1); p(C.yellow, 14, 22, 1, 1); p(C.yellow, 14, 25, 1, 1); }
  if (who.extra === "headband") { p(C.white, 9, 22, 2, 1); p(C.outline, 9, 23, 2, 3); }
  p(C.outline, 0, 21, 2, 9); p(who.skin, 0, 22, 1, 7); p(C.outline, 18, 21, 2, 9); p(who.skin, 19, 22, 1, 7);
  // helmet glass sits behind the head
  if (who.extra === "helmet") { p(C.outline, 0, 0, 20, 19); p(C.white, 1, 1, 18, 17); p(C.ice, 2, 2, 16, 15); }
  // neck and head
  p(C.outline, 7, 15, 6, 4); p(who.skin, 8, 15, 4, 4);
  if (robot) { p(C.outline, 2, 2, 16, 15); p(who.skin, 3, 3, 14, 13); p(C.snowShade, 3, 3, 14, 1); }
  else { p(C.outline, 3, 2, 14, 15); p(C.outline, 2, 4, 16, 11); p(who.skin, 3, 4, 14, 12); p(who.skin, 4, 3, 12, 13); }
  // hair
  const h = who.hair;
  if (who.style === "robot") { p(C.outline, 9, -2, 2, 4); p(C.red, 9, -3, 2, 2); }
  else if (who.style === "spiky") { p(h, 3, 2, 14, 3); p(h, 4, 0, 2, 2); p(h, 8, -1, 2, 3); p(h, 12, 0, 2, 2); p(h, 15, 1, 2, 2); p(h, 2, 4, 2, 4); p(h, 16, 4, 2, 4); }
  else if (who.style === "long") { p(h, 3, 2, 14, 3); p(h, 2, 4, 2, 13); p(h, 16, 4, 2, 13); p(h, 5, 1, 10, 2); }
  else if (who.style === "pigtails") { p(h, 3, 2, 14, 3); p(h, 2, 4, 2, 4); p(h, 16, 4, 2, 4); p(C.outline, -1, 5, 3, 5); p(h, -1, 6, 2, 3); p(C.outline, 18, 5, 3, 5); p(h, 19, 6, 2, 3); }
  else if (who.style === "bun") { p(h, 3, 2, 14, 3); p(h, 2, 4, 2, 6); p(h, 16, 4, 2, 6); p(C.outline, 7, -2, 6, 4); p(h, 8, -1, 4, 3); }
  else { p(h, 3, 2, 14, 3); p(h, 2, 4, 2, 5); p(h, 16, 4, 2, 5); p(h, 5, 1, 10, 2); p(h, 4, 5, 5, 1); }
  // hats and things on the head
  if (who.extra === "cap") { p(C.outline, 2, 0, 16, 5); p(C.cyan, 3, 1, 14, 3); p(C.outline, 12, 4, 9, 2); p(C.oceanLit, 13, 4, 7, 1); }
  if (who.extra === "captain") { p(C.outline, 1, -1, 18, 6); p(C.white, 2, 0, 16, 3); p(C.oceanDark, 2, 3, 16, 1); p(C.yellow, 9, 1, 2, 1); }
  if (who.extra === "bow") { p(C.outline, 12, 0, 7, 4); p(C.magenta, 13, 1, 2, 2); p(C.magenta, 16, 1, 2, 2); p(C.pink, 15, 1, 1, 2); }
  if (who.extra === "flower") { p(C.pink, 3, 2, 3, 3); p(C.yellow, 4, 3, 1, 1); }
  if (who.extra === "headband") p(C.red, 2, 4, 16, 2);
  if (who.extra === "headphones") { p(C.outline, 3, 0, 14, 2); p(C.space2, 1, 6, 3, 6); p(C.space2, 16, 6, 3, 6); p(C.pink, 1, 7, 1, 4); }
  // beard under the mouth
  if (who.extra === "captain") { p(C.white, 3, 12, 14, 5); p(C.white, 5, 17, 10, 1); }
  // face
  if (robot) {
    p(C.outline, 5, 7, 4, 4); p(C.outline, 11, 7, 4, 4);
    if (!mood.blink) { p(mood.happy ? C.lime : C.cyan, 6, 8, 2, 2); p(mood.happy ? C.lime : C.cyan, 12, 8, 2, 2); }
    p(C.outline, 7, 13, 6, 2); for (let x = 8; x < 12; x += 2) p(mood.talk ? C.yellow : C.steel, x, 13, 1, 1);
  } else {
    if (mood.happy) { p(C.outline, 6, 9, 3, 1); p(C.outline, 5, 10, 1, 1); p(C.outline, 9, 10, 1, 1); p(C.outline, 12, 9, 3, 1); p(C.outline, 11, 10, 1, 1); p(C.outline, 15, 10, 1, 1); }
    else if (mood.blink) { p(C.outline, 6, 10, 3, 1); p(C.outline, 11, 10, 3, 1); }
    else { p(C.outline, 7, 8, 2, 3); p(C.outline, 12, 8, 2, 3); p(C.white, 7, 8, 1, 1); p(C.white, 12, 8, 1, 1); }
    if (who.extra === "glasses") { for (const gx of [5, 11]) { p(C.outline, gx, 7, 4, 1); p(C.outline, gx, 11, 4, 1); p(C.outline, gx, 7, 1, 5); p(C.outline, gx + 3, 7, 1, 5); } p(C.outline, 9, 8, 2, 1); }
    if (who.extra !== "captain") { p(C.pink, 4, 12, 2, 1); p(C.pink, 14, 12, 2, 1); }
    if (mood.talk) { p(C.outline, 8, 13, 4, 3); p(C.red, 9, 14, 2, 1); }
    else if (mood.happy) { p(C.outline, 8, 13, 5, 2); p(C.pink, 9, 14, 3, 1); }
    else p(C.rockDark, 9, 13, 3, 1);
  }
  return { x: x0, y: top, w: 20 * U, h: 34 * U };
}

/* Head-and-shoulders portrait for the customer list. */
const portraits = new Map();
export function portraitURL(who) {
  if (!portraits.has(who.id)) {
    const canvas = document.createElement("canvas"); canvas.width = 24; canvas.height = 24;
    drawPerson(canvas.getContext("2d"), 2, 4, 1, who, { happy: false });
    portraits.set(who.id, canvas.toDataURL());
  }
  return portraits.get(who.id);
}
