/* Kitchen Quest v0.8 food and prop sprites, drawn in code on Pixel Planet's palette.
   Every sprite is a side view on a 1x grid; the counter scene scales them up with
   nearest-neighbour sampling so squash, flap and wobble stay crisp pixel art.
   `thick` is how far the next layer sits above this one (art pixels). */
import { HEX, C } from "../../world/planet-palette.js";

const cache = new Map();

function build(w, h, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext("2d");
  const px = (col, x, y, pw = 1, ph = 1) => { g.fillStyle = HEX[col]; g.fillRect(x, y, pw, ph); };
  draw(px, w, h);
  const data = g.getImageData(0, 0, w, h).data, mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 40 ? 1 : 0;
  return { canvas, w, h, mask };
}

/* A rounded slab: rows from top, each [inset, fill]. Outline hugs the silhouette. */
function slab(px, w, rows, outline = C.outline) {
  const last = rows.length - 1;
  const outside = (row, x) => !row || x < row[0] || x >= w - row[0];
  rows.forEach(([inset, fill], y) => {
    for (let x = inset; x < w - inset; x++) {
      const edge = x === inset || x === w - inset - 1 || y === 0 || y === last || outside(rows[y - 1], x) || outside(rows[y + 1], x);
      px(edge ? outline : fill, x, y);
    }
  });
}

/* Deterministic speckles so every tablet draws the same patty. */
function specks(px, seed, count, col, x0, y0, w, h) {
  let s = seed;
  for (let i = 0; i < count; i++) {
    s = (s * 1103515245 + 12345) >>> 0; const x = x0 + (s >>> 8) % w;
    s = (s * 1103515245 + 12345) >>> 0; const y = y0 + (s >>> 8) % h;
    px(col, x, y);
  }
}

const DRAW = {
  plate: [64, 8, 2, px => {
    slab(px, 64, [[6, C.white], [2, C.white], [0, C.white], [0, C.snowShade], [1, C.snowShade], [3, C.steel], [6, C.steel], [10, C.steel]]);
    px(C.white, 8, 2, 48, 1); px(C.ice, 14, 1, 20, 1);
  }],
  napkin: [84, 10, 0, px => {
    for (let y = 0; y < 10; y++) for (let x = 0; x < 84; x++) px(((x >> 2) + (y >> 1)) % 2 ? C.white : C.pink, x, y);
    px(C.magenta, 0, 9, 84, 1);
  }],
  "bun-base": [48, 8, 6, px => {
    slab(px, 48, [[2, C.sandLit], [0, C.sandLit], [0, C.sand], [0, C.sand], [0, C.sand], [1, C.wood], [3, C.wood], [5, C.woodDark]]);
    px(C.white, 6, 1, 10, 1); px(C.sandLit, 4, 2, 40, 1);
  }],
  patty: [50, 10, 7, px => {
    slab(px, 50, [[4, C.rock], [1, C.rock], [0, C.rockLit], [0, C.rock], [0, C.rock], [0, C.rock], [0, C.rockDark], [1, C.rockDark], [2, C.rockDark], [5, C.rockDark]]);
    px(C.rockLit, 6, 2, 12, 1); px(C.rockLit, 24, 2, 8, 1);
    specks(px, 7, 22, C.rockDark, 3, 3, 44, 4); specks(px, 19, 10, C.rockLit, 4, 3, 42, 3);
  }],
  "patty-raw": [50, 10, 7, px => {
    slab(px, 50, [[4, C.pink], [1, C.pink], [0, C.lilac], [0, C.pink], [0, C.pink], [0, C.pink], [0, C.magenta], [1, C.magenta], [2, C.magenta], [5, C.magenta]]);
    specks(px, 11, 26, C.magenta, 3, 2, 44, 5); specks(px, 23, 14, C.lilac, 4, 2, 42, 4);
  }],
  "patty-burnt": [50, 10, 7, px => {
    slab(px, 50, [[4, C.rockDark], [1, C.rockDark], [0, C.rockDark], [0, C.space2], [0, C.space2], [0, C.space2], [0, C.outline], [1, C.outline], [2, C.outline], [5, C.outline]]);
    specks(px, 5, 20, C.grey, 3, 2, 44, 5);
  }],
  cheese: [50, 5, 3, px => {
    slab(px, 50, [[1, C.yellow], [0, C.yellow], [0, C.yellow], [0, C.sand], [1, C.sand]]);
    px(C.sandLit, 4, 1, 40, 1); px(C.sand, 18, 2, 3, 1); px(C.sand, 31, 2, 2, 1);
  }],
  "cheese-corner-left": [9, 9, 0, px => {
    for (let y = 0; y < 9; y++) { const w = 9 - y; px(C.outline, 0, y, w, 1); if (w > 2 && y < 8) px(y < 2 ? C.yellow : C.sand, 1, y, w - 2, 1); }
    px(C.sandLit, 1, 0, 6, 1);
  }],
  "cheese-corner-right": [9, 9, 0, px => {
    for (let y = 0; y < 9; y++) { const w = 9 - y; px(C.outline, 9 - w, y, w, 1); if (w > 2 && y < 8) px(y < 2 ? C.yellow : C.sand, 10 - w, y, w - 2, 1); }
    px(C.sandLit, 2, 0, 6, 1);
  }],
  tomato: [46, 6, 4, px => {
    slab(px, 46, [[2, C.lava], [0, C.red], [0, C.red], [0, C.red], [1, C.rockDark], [3, C.rockDark]]);
    for (let x = 4; x < 42; x += 7) { px(C.sandLit, x, 2); px(C.sandLit, x + 2, 2); px(C.lava, x + 4, 1, 2, 1); }
    px(C.red, 22, 1, 2, 3);
  }],
  lettuce: [54, 8, 4, px => {
    for (let x = 0; x < 54; x++) {
      const crest = (x % 6 < 3 ? 0 : 1) + (x % 11 === 0 ? 1 : 0), drop = 5 + ((x * 7) % 5 === 0 ? 2 : (x % 4 === 0 ? 1 : 0));
      px(C.outline, x, crest); px(x % 6 < 3 ? C.lime : C.greenLit, x, crest + 1, 1, 2);
      for (let y = crest + 3; y < drop; y++) px(y > 4 ? C.green : C.greenLit, x, y);
      px(C.greenDark, x, drop, 1, 1); if (drop < 7) px(C.outline, x, drop + 1);
    }
    px(C.outline, 0, 1, 1, 6); px(C.outline, 53, 1, 1, 6);
  }],
  pickles: [46, 5, 3, px => {
    for (let i = 0; i < 4; i++) {
      const x = 1 + i * 11, rows = [[2, C.greenLit], [0, C.greenLit], [0, C.green], [0, C.green], [2, C.greenDark]];
      slab((col, X, Y, W, H) => px(col, X + x, Y, W, H), 10, rows, C.greenDeep);
      px(C.lime, x + 3, 1, 4, 1); px(C.lime, x + 4, 2, 2, 1);
    }
  }],
  sauce: [42, 5, 2, px => {
    slab(px, 42, [[3, C.red], [0, C.red], [0, C.red], [2, C.rockDark]]);
    px(C.lava, 6, 1, 12, 1); px(C.lava, 24, 1, 6, 1);
    px(C.red, 9, 4, 2, 1); px(C.outline, 9, 4); px(C.red, 30, 4, 2, 1); px(C.outline, 31, 4);
  }],
  "bun-top": [48, 17, 0, px => {
    const rows = [[15, C.sand], [10, C.sand], [7, C.sandLit], [5, C.sandLit], [3, C.sand], [2, C.sand], [1, C.sand], [1, C.sand], [0, C.sand], [0, C.sand], [0, C.sand], [0, C.sand], [0, C.wood], [0, C.wood], [1, C.wood], [2, C.woodDark], [4, C.woodDark]];
    slab(px, 48, rows);
    px(C.sandLit, 12, 3, 10, 1); px(C.sandLit, 8, 4, 8, 2); px(C.white, 10, 4, 3, 1);
    [[14, 6], [22, 4], [30, 6], [36, 9], [19, 9], [27, 10], [10, 10], [33, 3]].forEach(([x, y]) => { px(C.white, x, y, 2, 1); px(C.sand, x, y + 1, 2, 1); });
  }],
  lasagna: [44, 18, 14, px => {
    const bands = [C.yellow, C.yellow, C.yellow, C.sand, C.sand, C.red, C.red, C.sandLit, C.sand, C.yellow, C.red, C.red, C.sand, C.sand, C.wood, C.wood, C.woodDark, C.woodDark];
    slab(px, 44, bands.map((fill, y) => [y === 0 ? 2 : y === 17 ? 2 : 0, fill]));
    px(C.lava, 6, 1, 4, 1); px(C.lava, 20, 2, 3, 1); px(C.lava, 32, 1, 4, 1); px(C.greenDark, 14, 1, 2, 1); px(C.greenLit, 27, 1, 2, 1);
    px(C.sandLit, 4, 1, 3, 1);
  }],
  pasta: [44, 4, 3, px => {
    slab(px, 44, [[1, C.sandLit], [0, C.sand], [0, C.sand], [1, C.wood]]);
    for (let x = 4; x < 40; x += 5) px(C.yellow, x, 1, 2, 1);
  }],
  bowl: [62, 16, 4, px => {
    const rows = [[0, C.ice], [0, C.oceanLit], [1, C.ocean], [1, C.ocean], [2, C.ocean], [2, C.ocean], [3, C.ocean], [4, C.oceanDark], [5, C.oceanDark], [6, C.oceanDark], [8, C.oceanDark], [10, C.oceanDark], [14, C.space2], [18, C.space2], [20, C.steel], [19, C.steel]];
    slab(px, 62, rows);
    px(C.white, 6, 2, 10, 1); px(C.cyan, 4, 5, 54, 1); px(C.cyan, 7, 8, 48, 1);
  }],
  "whole-tomato": [22, 18, 0, px => {
    slab(px, 22, [[7, C.red], [4, C.red], [2, C.lava], [1, C.red], [0, C.red], [0, C.red], [0, C.red], [0, C.red], [0, C.red], [0, C.red], [0, C.red], [0, C.rockDark], [1, C.rockDark], [2, C.rockDark], [4, C.rockDark], [7, C.rockDark]]);
    px(C.white, 5, 4, 2, 2); px(C.lava, 4, 6, 1, 3);
    px(C.greenDark, 9, 0, 4, 2); px(C.greenLit, 7, 1, 8, 1); px(C.green, 10, 0, 2, 1);
  }],
  "whole-lettuce": [26, 18, 0, px => {
    slab(px, 26, [[8, C.lime], [5, C.greenLit], [3, C.greenLit], [2, C.green], [1, C.greenLit], [0, C.green], [0, C.green], [0, C.greenLit], [0, C.green], [0, C.green], [0, C.green], [0, C.greenDark], [1, C.greenDark], [2, C.greenDark], [4, C.greenDeep], [7, C.greenDeep]]);
    for (let y = 3; y < 14; y += 3) px(C.lime, 12, y, 2, 2);
    px(C.lime, 6, 6, 1, 4); px(C.lime, 19, 5, 1, 5);
  }],
  pan: [60, 12, 0, px => {
    slab(px, 46, [[0, C.steel], [0, C.space2], [0, C.space2], [0, C.space], [1, C.space], [2, C.outline]]);
    px(C.snowShade, 2, 0, 42, 1);
    px(C.outline, 45, 1, 15, 3); px(C.woodDark, 47, 2, 12, 1);
  }],
  knife: [24, 7, 0, px => {
    px(C.outline, 0, 1, 16, 4); px(C.snowShade, 1, 2, 14, 2); px(C.white, 2, 2, 10, 1);
    px(C.outline, 15, 0, 9, 7); px(C.woodDark, 16, 1, 7, 5); px(C.wood, 17, 2, 5, 1);
  }]
};

export function sprite(id) {
  if (!cache.has(id)) {
    const spec = DRAW[id] || DRAW.patty;
    const built = build(spec[0], spec[1], spec[3]);
    built.thick = spec[2];
    cache.set(id, built);
  }
  return cache.get(id);
}

/* Small DOM icons for trays, tickets and cards. The browser upscales them pixelated. */
const urls = new Map();
export function spriteURL(id) {
  if (!urls.has(id)) urls.set(id, sprite(id).canvas.toDataURL());
  return urls.get(id);
}

/* Chunky 20 × 20 icons for buttons and lists. The side-view layers above are a few
   pixels tall, which reads as a thin line on a tray; these are the same foods seen
   from above so each one is a big, distinct shape a child can spot at a glance. */
function disc(px, cx, cy, r, fill, shade, lit, outline = C.outline) {
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const dx = x + .5 - cx, dy = y + .5 - cy, d = Math.hypot(dx, dy);
    if (d > r) continue;
    px(d > r - 1.2 ? outline : dx + dy > r * .55 ? shade : dx + dy < -r * .7 ? lit : fill, x, y);
  }
}
const ICON = {
  patty: px => {
    disc(px, 10, 10, 9.6, C.rock, C.rockDark, C.rockLit);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 9; j++) px(C.rockDark, 4 + i * 4 + j * .5 | 0, 4 + j);
    specks(px, 7, 10, C.rockLit, 4, 4, 12, 12);
  },
  "patty-raw": px => {
    disc(px, 10, 10, 9.6, C.pink, C.magenta, C.lilac);
    specks(px, 11, 18, C.lilac, 4, 4, 12, 12); specks(px, 23, 12, C.magenta, 4, 5, 12, 11);
  },
  "patty-burnt": px => {
    disc(px, 10, 10, 9.6, C.space2, C.outline, C.rockDark);
    specks(px, 5, 12, C.grey, 4, 4, 12, 12);
  },
  cheese: px => {
    px(C.outline, 2, 2, 16, 16);
    px(C.yellow, 3, 3, 14, 14); px(C.sandLit, 3, 3, 14, 1); px(C.sandLit, 3, 3, 1, 14);
    px(C.sand, 16, 4, 1, 13); px(C.sand, 4, 16, 13, 1);
    [[6, 6], [12, 9], [7, 12], [13, 14], [11, 5]].forEach(([x, y]) => { px(C.sand, x, y, 2, 2); px(C.wood, x + 1, y + 1); });
    px(C.outline, 9, 18, 3, 1); px(C.yellow, 9, 17, 3, 1); px(C.outline, 8, 17); px(C.outline, 12, 17);
  },
  tomato: px => {
    disc(px, 10, 10, 9.6, C.red, C.red, C.red);
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const dx = x + .5 - 10, dy = y + .5 - 10, d = Math.hypot(dx, dy);
      if (d > 7.2 || d < 1.6) continue;
      const wall = Math.abs(dx) < 1 || Math.abs(dy) < 1;
      px(wall ? C.red : d > 6 ? C.red : C.lava, x, y);
    }
    [[6, 6], [13, 6], [6, 13], [13, 13], [7, 8], [12, 8], [8, 12], [11, 12]].forEach(([x, y]) => px(C.sandLit, x, y));
    px(C.pink, 4, 4, 2, 1);
  },
  lettuce: px => {
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const dx = x + .5 - 10, dy = y + .5 - 10, a = Math.atan2(dy, dx), r = 8.4 + Math.sin(a * 7) * 1.1, d = Math.hypot(dx, dy);
      if (d > r) continue;
      px(d > r - 1.2 ? C.greenDeep : dx + dy > 4 ? C.green : dx + dy < -6 ? C.lime : C.greenLit, x, y);
    }
    for (let i = 3; i < 17; i++) px(C.lime, i, 19 - i);
    [[7, 9, 1], [10, 6, 1], [9, 13, -1], [12, 10, -1]].forEach(([x, y, s]) => { px(C.lime, x, y); px(C.lime, x - s, y - 1); });
  },
  pickles: px => {
    [[6.5, 13.5], [13.5, 13.5], [10, 6.5]].forEach(([cx, cy]) => {
      disc(px, cx, cy, 6.2, C.greenLit, C.greenLit, C.greenLit, C.greenDeep);
      for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
        const d = Math.hypot(x + .5 - cx, y + .5 - cy);
        if (d <= 5 && d > 4) px(C.green, x, y);
        if (d <= 2.4) px(C.lime, x, y);
      }
      px(C.sandLit, Math.floor(cx) - 2, Math.floor(cy)); px(C.sandLit, Math.floor(cx) + 1, Math.floor(cy) - 2); px(C.sandLit, Math.floor(cx) + 1, Math.floor(cy) + 1);
    });
  },
  sauce: px => {
    px(C.outline, 9, 0, 2, 1); px(C.outline, 8, 1, 4, 4); px(C.white, 9, 1, 2, 3);
    px(C.outline, 5, 4, 10, 2); px(C.yellow, 6, 5, 8, 1);
    px(C.outline, 4, 6, 12, 14); px(C.red, 5, 6, 10, 13); px(C.lava, 6, 7, 2, 10);
    px(C.sandLit, 5, 11, 10, 4); px(C.red, 9, 12, 2, 2); px(C.rockDark, 13, 7, 1, 11);
  },
  lasagna: px => {
    const bands = [C.yellow, C.yellow, C.sand, C.red, C.red, C.sandLit, C.sand, C.red, C.red, C.sandLit, C.sand, C.wood, C.woodDark];
    px(C.outline, 1, 3, 18, 15);
    bands.forEach((col, i) => px(col, 2, 4 + i, 16, 1));
    px(C.lava, 4, 4, 2, 1); px(C.lava, 12, 5, 2, 1); px(C.greenLit, 8, 4, 2, 1); px(C.greenDark, 15, 4, 1, 1);
    px(C.yellow, 5, 17 - 1, 1, 1);
  },
  pan: px => {
    px(C.outline, 14, 8, 6, 4); px(C.woodDark, 15, 9, 4, 2); px(C.wood, 15, 9, 4, 1);
    disc(px, 8, 10, 7.8, C.space2, C.space, C.steel);
    disc(px, 8, 10, 5.4, C.space, C.space, C.space2, C.space);
    px(C.snowShade, 4, 5, 3, 1);
  },
  // A pointing glove for the first-order guide.
  hand: px => {
    px(C.outline, 7, 0, 6, 11); px(C.outline, 12, 5, 7, 6); px(C.outline, 4, 9, 15, 11); px(C.outline, 2, 10, 4, 6);
    px(C.white, 8, 1, 4, 10); px(C.white, 13, 6, 5, 4); px(C.white, 5, 10, 13, 7); px(C.white, 3, 11, 3, 4);
    px(C.snowShade, 15, 6, 1, 3); px(C.snowShade, 12, 7, 1, 3); px(C.snowShade, 16, 10, 2, 7); px(C.snowShade, 8, 1, 1, 2);
    px(C.cyan, 5, 17, 13, 2);
  },
  pasta: px => {
    for (let x = 1; x < 19; x++) {
      const top = 4 + (x % 4 < 2 ? 0 : 1), bottom = 15 + (x % 4 < 2 ? 1 : 0);
      px(C.outline, x, top); px(C.outline, x, bottom);
      for (let y = top + 1; y < bottom; y++) px(y === top + 1 ? C.sandLit : (x + y) % 5 === 0 ? C.yellow : C.sand, x, y);
    }
    px(C.outline, 0, 5, 1, 11); px(C.outline, 19, 5, 1, 11);
    for (let x = 3; x < 17; x += 4) px(C.wood, x, 9, 2, 1);
  }
};
export const ICON_IDS = Object.keys(ICON);
export function iconURL(id) {
  if (!ICON[id]) return spriteURL(id);
  const key = "icon:" + id;
  if (!urls.has(key)) urls.set(key, build(20, 20, ICON[id]).canvas.toDataURL());
  return urls.get(key);
}

/* A mini meal preview for speech bubbles and order cards: plate + family + top layers. */
export function dishURL(recipe) {
  const key = recipe.family + ":" + recipe.sequence.join(",");
  if (urls.has(key)) return urls.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 48;
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  let y = 40;
  const put = id => { const s = sprite(id); g.drawImage(s.canvas, Math.round(32 - s.w / 2), Math.round(y - s.h)); y -= s.thick || 3; };
  g.drawImage(sprite("plate").canvas, 0, 40);
  if (recipe.family === "salad") {
    const bowl = sprite("bowl");
    g.drawImage(bowl.canvas, 1, 41 - bowl.h);
    y = 30; recipe.sequence.forEach(id => { const s = sprite(id); g.drawImage(s.canvas, Math.round(32 - s.w / 2), y - 2); y -= 2; });
  } else {
    if (recipe.family === "burger") put("bun-base");
    recipe.sequence.forEach(put);
    if (recipe.family === "burger") put("bun-top");
  }
  urls.set(key, canvas.toDataURL());
  return urls.get(key);
}

export const SPRITE_IDS = Object.keys(DRAW);
