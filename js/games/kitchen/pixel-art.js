import { HEX, C, nearestIndex } from "../../world/planet-palette.js";

export const WIDTH = 384;
export const HEIGHT = 216;

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = HEX[color];
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Food sprites share a 32 × 20 grid with the globe's fixed palette. */
export function drawIngredient(ctx, id, x, y, scale = 1) {
  const r = (color, dx, dy, w, h) => rect(ctx, color, x + dx * scale, y + dy * scale, w * scale, h * scale);
  if (id === "patty" || id === "patty-raw") {
    const raw = id === "patty-raw";
    r(C.outline, 4, 6, 24, 10); r(C.outline, 2, 8, 28, 6);
    r(raw ? C.magenta : C.rockDark, 4, 9, 24, 5);
    r(raw ? C.pink : C.rock, 5, 6, 22, 6);
    r(raw ? C.lilac : C.rockLit, 7, 7, 8, 2);
    for (let i = 0; i < 3; i++) r(raw ? C.magenta : C.woodDark, 9 + i * 6, 8, 2, 4);
  } else if (id === "cheese") {
    r(C.woodDark, 2, 7, 28, 5); r(C.woodDark, 6, 12, 6, 3);
    r(C.yellow, 3, 7, 26, 4); r(C.yellow, 7, 11, 4, 3);
    r(C.sandLit, 4, 7, 24, 1); r(C.sand, 20, 9, 3, 2);
  } else if (id === "tomato" || id === "whole-tomato") {
    r(C.rockDark, 5, 6, 22, 10); r(C.rockDark, 3, 8, 26, 6);
    r(C.red, 5, 7, 22, 7); r(C.lava, 7, 7, 18, 3);
    r(C.sandLit, 9, 9, 3, 2); r(C.sandLit, 20, 9, 3, 2);
    r(C.red, 15, 7, 2, 6);
    if (id === "whole-tomato") { r(C.greenDark, 14, 3, 3, 5); r(C.green, 10, 5, 11, 2); }
  } else if (id === "lettuce") {
    r(C.greenDeep, 1, 9, 30, 4); r(C.greenDeep, 4, 6, 24, 9);
    r(C.green, 2, 9, 28, 3); r(C.greenLit, 5, 7, 22, 5);
    for (let i = 0; i < 4; i++) r(C.lime, 5 + i * 6, 6 + i % 2 * 2, 4, 2);
    r(C.greenDark, 8, 12, 5, 2); r(C.greenDark, 22, 12, 4, 2);
  } else if (id === "pickles") {
    for (let i = 0; i < 3; i++) {
      const dx = 3 + i * 9, dy = 8 - i % 2 * 3;
      r(C.greenDark, dx, dy, 9, 7); r(C.greenLit, dx + 1, dy, 7, 5);
      r(C.lime, dx + 3, dy + 1, 2, 2); r(C.green, dx + 5, dy + 3, 2, 1);
    }
  } else if (id === "sauce") {
    r(C.rockDark, 4, 9, 24, 4); r(C.red, 4, 8, 24, 3);
    r(C.red, 7, 7, 7, 2); r(C.red, 19, 10, 4, 5); r(C.lava, 8, 8, 11, 1);
  } else if (id === "lasagna") {
    r(C.woodDark, 4, 4, 25, 14); r(C.sand, 5, 7, 23, 9);
    r(C.red, 5, 9, 23, 2); r(C.rock, 5, 13, 23, 2);
    r(C.yellow, 4, 4, 24, 4); r(C.sandLit, 6, 4, 19, 2);
    r(C.lava, 8, 6, 3, 2); r(C.lava, 21, 5, 4, 2); r(C.greenDark, 15, 5, 2, 2);
  } else if (id === "pasta") {
    r(C.woodDark, 3, 6, 26, 9); r(C.sand, 4, 7, 24, 6);
    r(C.sandLit, 4, 6, 24, 4);
    for (let i = 0; i < 5; i++) r(C.yellow, 5 + i * 5, 6, 2, 6);
  } else if (id === "bun-base") {
    r(C.woodDark, 2, 7, 28, 9); r(C.sand, 3, 7, 26, 6);
    r(C.sandLit, 4, 7, 24, 2); r(C.wood, 5, 13, 22, 2);
  } else if (id === "bun" || id === "bun-top") {
    r(C.woodDark, 8, 2, 16, 3); r(C.woodDark, 5, 4, 22, 4); r(C.woodDark, 3, 7, 26, 5); r(C.woodDark, 2, 9, 28, 7);
    r(C.sand, 4, 9, 24, 5); r(C.sand, 6, 5, 20, 7); r(C.sandLit, 9, 3, 14, 5);
    r(C.sandLit, 5, 7, 7, 3); r(C.wood, 4, 13, 24, 2);
    r(C.white, 10, 6, 2, 1); r(C.white, 18, 5, 2, 1); r(C.white, 23, 9, 2, 1);
  }
}

const icons = new Map();
export function ingredientURL(id) {
  if (!icons.has(id)) {
    const canvas = document.createElement("canvas");
    canvas.width = 32; canvas.height = 20;
    drawIngredient(canvas.getContext("2d"), id, 0, 0);
    icons.set(id, canvas.toDataURL());
  }
  return icons.get(id);
}

function plate(ctx, x, y, scale) {
  rect(ctx, C.steel, x - 3 * scale, y + 15 * scale, 38 * scale, 4 * scale);
  rect(ctx, C.snowShade, x - 5 * scale, y + 12 * scale, 42 * scale, 4 * scale);
  rect(ctx, C.white, x - 3 * scale, y + 10 * scale, 38 * scale, 5 * scale);
}

function dish(ctx, layers, family, x, y, scale) {
  plate(ctx, x, y, scale);
  if (family === "burger") drawIngredient(ctx, "bun-base", x, y - 2 * scale, scale);
  const rise = layers.length > 7 ? 3 : 5;
  layers.forEach((layer, index) => {
    const id = layer.pending ? "patty-raw" : layer.ingredient;
    drawIngredient(ctx, id, x, y - (index * rise + 7) * scale, scale);
  });
  if (family === "burger" && layers.length) {
    drawIngredient(ctx, "bun-top", x, y - (layers.length * rise + 10) * scale, scale);
  }
  if (family === "salad") {
    rect(ctx, C.cyan, x - scale, y + 9 * scale, 34 * scale, 6 * scale);
    rect(ctx, C.oceanLit, x + 3 * scale, y + 15 * scale, 26 * scale, 3 * scale);
    rect(ctx, C.ice, x, y + 9 * scale, 32 * scale, 2 * scale);
  }
}

function person(ctx, x, y, shirt, variant, happy, tick) {
  const r = (color, dx, dy, w, h) => rect(ctx, color, x + dx, y + dy, w, h);
  const skin = variant ? C.rockLit : C.sand;
  r(C.outline, 4, 0, 17, 5); r(C.outline, 1, 5, 23, 21);
  r(C.woodDark, 3, 2, 19, 10); r(skin, 4, 10, 17, 16);
  r(skin, 1, 13, 23, 6); r(C.sandLit, 5, 11, 3, 7);
  r(variant ? C.rockDark : C.wood, 3, 5, 19, 7);
  if (variant) { r(C.rockDark, 1, 9, 5, 15); r(C.rockDark, 20, 9, 4, 15); }
  r(C.outline, 8, 14, 2, tick % 19 === 0 ? 1 : 3);
  r(C.outline, 16, 14, 2, tick % 19 === 0 ? 1 : 3);
  r(C.rockDark, 11, 22, 5, 1); if (happy) r(C.rockDark, 10, 20, 1, 2);
  r(C.outline, 0, 28, 25, 18); r(shirt, 2, 29, 21, 17);
  r(skin, 9, 26, 8, 5); r(C.sandLit, 1, 39, 6, 6); r(skin, 19, 39, 6, 6);
}

function steam(ctx, x, y, tick, color = C.white) {
  for (let i = 0; i < 3; i++) {
    const rise = (tick + i * 3) % 10;
    rect(ctx, color, x + i * 9 + (rise > 4 ? 2 : 0), y - rise, 2, 3);
  }
}

function heatBar(ctx, job, x, y, width) {
  if (!job || job.phase === "empty") return;
  const ready = job.phase === "ready" || job.phase === "flip";
  const progress = ready ? 1 : Math.max(0, Math.min(1, 1 - job.remaining / (job.duration || 1)));
  rect(ctx, C.outline, x, y, width, 4);
  rect(ctx, ready ? C.greenLit : C.yellow, x + 1, y + 1, (width - 2) * progress, 2);
}

/** Pure presentation; the host owns animation time, input, and all cooking rules. */
export function drawKitchen(canvas, { layers = [], stations = [], kitchen, activeSlot = 0, paused = false, time = 0, kidColor = "#39d0c8" } = {}) {
  if (canvas.width !== WIDTH) canvas.width = WIDTH;
  if (canvas.height !== HEIGHT) canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  const r = (color, x, y, w, h) => rect(ctx, color, x, y, w, h);
  const tick = Math.floor(time * 5), accent = nearestIndex(kidColor);
  r(C.sandLit, 0, 0, WIDTH, HEIGHT);
  // The awning and tiles frame a single, readable preparation counter.
  r(C.greenDeep, 0, 0, WIDTH, 7); r(C.rockDark, 0, 26, WIDTH, 3);
  for (let x = 0; x < WIDTH; x += 24) {
    const color = x % 48 ? C.sandLit : C.red;
    r(color, x, 7, 24, 17); r(color, x + 2, 24, 20, 5);
    r(x % 48 ? C.sand : C.rock, x + 2, 27, 20, 3);
  }
  r(C.sand, 0, 93, WIDTH, 36);
  for (let y = 95; y < 129; y += 11) {
    for (let x = 0; x < WIDTH; x += 24) r(C.sandLit, x + (y % 2 ? 0 : 12), y, 22, 9);
  }
  // Window: distant hills, a tree, and a tiny cloud, all on the same pixel grid.
  r(C.woodDark, 15, 40, 87, 63); r(C.wood, 18, 43, 81, 57); r(C.ice, 21, 46, 75, 51);
  r(C.white, 28, 55, 25, 4); r(C.white, 34, 51, 12, 4);
  r(C.lilac, 55, 73, 24, 24); r(C.lilac, 62, 64, 10, 9);
  r(C.green, 21, 86, 75, 11); r(C.greenLit, 21, 91, 75, 6);
  r(C.woodDark, 78, 65, 4, 27); r(C.greenDark, 68, 56, 24, 18);
  r(C.green, 72, 52, 16, 18); r(C.greenLit, 73, 54, 7, 7);
  r(C.wood, 56, 44, 3, 56); r(C.wood, 19, 76, 79, 3); r(C.woodDark, 12, 102, 93, 4);
  // Herb pots and hanging utensils make the empty kitchen feel inhabited.
  for (let x = 287; x < 366; x += 27) {
    r(C.greenDark, x + 5, 54, 2, 14); r(C.green, x, 56, 13, 4); r(C.greenLit, x + 7, 50, 5, 8);
    r(C.rock, x, 65, 14, 11); r(C.rockLit, x - 1, 64, 16, 3);
  }
  r(C.woodDark, 281, 76, 91, 4); r(C.wood, 281, 76, 91, 2);
  r(C.woodDark, 306, 86, 55, 3);
  for (let x = 310; x < 355; x += 18) { r(C.steel, x, 86, 3, 14); r(C.outline, x - 4, 98, 11, 10); r(C.grey, x - 2, 100, 7, 6); }
  // Customers match the two real order slots; a waiting slot is an empty stool.
  for (let slot = 0; slot < 2; slot++) {
    const station = stations[slot], x = 133 + slot * 73;
    r(C.woodDark, x - 1, 116, 31, 9); r(C.red, x - 1, 115, 31, 4);
    if (!station || station.phase === "waiting") continue;
    person(ctx, x + 2, 75, slot ? C.purple : C.cyan, slot, station.phase === "serving", tick + slot * 4);
    r(slot === activeSlot ? C.yellow : C.wood, x - 6, 38, 44, 29);
    r(C.white, x - 4, 40, 40, 25); r(C.white, x + 7, 65, 6, 4);
    const recipe = station.order && station.order.recipe;
    if (recipe && recipe.family === "lasagna") drawIngredient(ctx, "lasagna", x, 45);
    else if (recipe && recipe.family === "salad") {
      drawIngredient(ctx, "lettuce", x, 43); drawIngredient(ctx, "tomato", x, 40);
      r(C.cyan, x + 2, 55, 28, 7); r(C.oceanLit, x + 6, 62, 20, 2);
    } else if (recipe) {
      drawIngredient(ctx, "bun-base", x, 49); drawIngredient(ctx, "patty", x, 46);
      drawIngredient(ctx, "cheese", x, 43); drawIngredient(ctx, "bun-top", x, 40);
    }
    if (slot === activeSlot) { r(C.yellow, x + 10, 70, 7, 2); r(C.yellow, x + 12, 72, 3, 2); }
  }
  // Checkerboard floor and timber cabinet fronts.
  for (let y = 190; y < HEIGHT; y += 13) for (let x = 0; x < WIDTH; x += 16) r((x / 16 + (y - 190) / 13) % 2 ? C.sand : C.wood, x, y, 16, 13);
  r(C.woodDark, 0, 166, WIDTH, 26); r(C.wood, 2, 169, 380, 20);
  for (let x = 5; x < WIDTH; x += 64) { r(C.woodDark, x, 171, 59, 16); r(C.rockLit, x + 2, 172, 55, 13); r(C.sand, x + 25, 174, 10, 2); }
  r(C.woodDark, 0, 124, WIDTH, 45); r(C.sand, 0, 127, WIDTH, 37); r(C.sandLit, 0, 127, WIDTH, 4);
  r(C.wood, 0, 165, WIDTH, 4);
  // Grill: two independent pans with real cooking progress and steam.
  r(C.outline, 12, 136, 93, 26); r(C.steel, 14, 138, 89, 22);
  for (let slot = 0; slot < 2; slot++) {
    const x = 19 + slot * 43, job = kitchen && kitchen.grill[slot];
    r(C.space, x, 138, 36, 16); r(C.grey, x + 3, 140, 30, 1);
    if (job && job.phase !== "empty") {
      drawIngredient(ctx, job.phase === "side-one" || job.phase === "flip" ? "patty-raw" : "patty", x + 2, 129);
      if (job.phase === "burnt") r(C.outline, x + 7, 139, 21, 4);
      if (!paused) steam(ctx, x + 6, 128, tick, job.phase === "burnt" ? C.grey : C.white);
      heatBar(ctx, job, x, 155, 35);
    } else { r(C.rock, x + 8, 145, 20, 2); r(C.rock, x + 17, 141, 2, 10); }
  }
  // Cutting board tracks the selected vegetable and completed cuts.
  r(C.woodDark, 250, 141, 41, 19); r(C.wood, 251, 142, 39, 16); r(C.sand, 252, 143, 37, 2);
  const board = kitchen && kitchen.board;
  drawIngredient(ctx, board ? board.ingredient : "tomato", 254, 136);
  if (board) for (let i = 0; i < board.cuts; i++) r(C.sandLit, 260 + i * 5, 142, 1, 9);
  r(C.outline, 285, 132, 3, 17); r(C.snowShade, 283, 138, 4, 12);
  // Oven window changes with the live tray; ready food gets a green lamp.
  const oven = kitchen && kitchen.oven;
  r(C.outline, 307, 126, 65, 41); r(C.steel, 309, 128, 61, 37);
  r(C.snowShade, 311, 129, 57, 6); r(C.outline, 313, 137, 53, 23);
  r(oven && oven.phase === "baking" ? C.rockDark : C.space, 315, 139, 49, 19);
  r(C.ice, 316, 140, 2, 15); r(C.steel, 318, 154, 42, 2);
  r(oven && oven.phase === "ready" ? C.greenLit : C.yellow, 361, 131, 3, 3);
  r(C.outline, 314, 131, 4, 3); r(C.outline, 322, 131, 4, 3);
  if (oven && oven.phase !== "empty") {
    drawIngredient(ctx, "lasagna", 324, 139);
    if (oven.phase === "burnt") r(C.outline, 328, 143, 25, 6);
    if (!paused) steam(ctx, 327, 140, tick, oven.phase === "burnt" ? C.grey : C.white);
  }
  else if (kitchen && kitchen.lasagnaLayers.length) drawIngredient(ctx, kitchen.lasagnaLayers[kitchen.lasagnaLayers.length - 1], 324, 139);
  heatBar(ctx, oven, 313, 161, 53);
  // The selected dish is deliberately larger than every prop and order preview.
  const active = stations[activeSlot], recipe = active && active.order && active.order.recipe;
  const family = recipe && recipe.family || "burger";
  const shift = active && active.phase === "serving" ? Math.min(16, Math.round(active.serviceElapsed * 20)) : 0;
  r(C.wood, 118, 152, 124, 7); r(C.sandLit, 120, 151, 120, 5);
  dish(ctx, layers, family, 148, 133 - shift, 2);
  // A small apron badge ties the kitchen to the current kid's globe hero.
  r(C.outline, 178, 176, 28, 11); r(accent, 180, 177, 24, 8);
  r(C.white, 185, 178, 14, 3); r(C.white, 188, 181, 8, 3);
  if (paused) {
    r(C.outline, 172, 91, 40, 28); r(C.sandLit, 174, 93, 36, 24);
    r(C.woodDark, 181, 98, 6, 14); r(C.woodDark, 197, 98, 6, 14);
  }
}
