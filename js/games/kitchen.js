/* Kitchen Quest v0.8 — the v0.6.0 counter feel, in pixel art (docs/plans/2026-10-03-kitchen-quest/04-counter-feel.md).
   One live counter: tap a tray and the food snaps onto the plate; tap the real
   food to take that layer off. The grill, chopping board and oven open in the
   middle while customers, orders and every cooking timer stay on screen.
   Rules live in ./kitchen/model.js (unchanged v0.7 domain); this file is input,
   DOM and the hand-off to the pixel counter scene. */
import { KitchenModel, shiftSeeds, seedsFromKey } from "./kitchen/model.js";
import { LASAGNA_STEPS } from "./kitchen/kitchen.js";
import { FOOD, RECIPES, REQUESTS, GOALS, HEAT, PATTY, PATTY_HINT, REJECT, kitchenMessage } from "./kitchen/strings.js";
import { MENU_RECIPES } from "./kitchen/recipes.js";
import { normalizeProfile } from "./kitchen/progression.js";
import { prepPlan } from "./kitchen/prep-plan.js";
import { iconURL, dishURL } from "./kitchen/sprites.js";
import { CounterScene } from "./kitchen/scene.js";
import { Cast, portraitURL } from "./kitchen/customers.js";
import { HEX } from "../world/planet-palette.js";
import { KitchenAudio } from "./kitchen/audio.js";
import { createScheduler } from "../game-services/scheduler.js";

let S = null;
let BAR = null;
/* One language on screen at a time (05-readability.md). Every string still ships
   EN + 中文; the setbar switch picks which one is shown, remembered per kid. */
let LANG = "en";
const TRAYS = ["patty", "cheese", "tomato", "lettuce", "pickles", "sauce", "lasagna"];
const VIEWS = ["plate", "grill", "board", "oven", "plan"];
const zh = () => LANG === "zh";
const t = p => p[zh() ? 1 : 0];
const pair = (en, zhText) => '<span lang="' + (zh() ? "zh-Hant" : "en") + '">' + (zh() ? zhText : en) + '</span>';
const label = p => pair(p[0], p[1]);
const icon = (id, cls = "") => '<img class="' + cls + '" src="' + iconURL(id) + '" alt="">';
// No stray space before ">": html() compares against the browser's serialisation, and a
// mismatch rewrote the board and prep panels ten times a second, detaching CHOP mid-tap.
const button = (action, content, attrs = "") => '<button type="button" data-action="' + action + '"' + (attrs ? " " + attrs : "") + '>' + content + '</button>';
// English plurals read "1 dish", never "1 dishes"; the Chinese needs no plural.
const dishes = n => n + (n === 1 ? " dish" : " dishes");
const times = n => n + (n === 1 ? " time" : " times");
const seconds = n => Math.max(0, Math.ceil(n));

function kitchenSettings(settings) {
  if (!settings.kitchen || typeof settings.kitchen !== "object" || Array.isArray(settings.kitchen)) settings.kitchen = {};
  return settings.kitchen;
}
function savedLang(ctx) {
  const langs = ctx.settings.kitchen && ctx.settings.kitchen.lang;
  return langs && typeof langs === "object" && langs[ctx.kid] === "zh" ? "zh" : "en";
}
/* Visits to the kitchen so far today by this kid, remembered so each visit deals a new shift; saved with the next profile save. */
function countVisit(ctx, day) {
  const kitchen = kitchenSettings(ctx.settings);
  if (!kitchen.visits || typeof kitchen.visits !== "object" || Array.isArray(kitchen.visits)) kitchen.visits = {};
  const last = kitchen.visits[ctx.kid], before = last && last.day === day && Number.isInteger(last.n) ? Math.min(Math.max(last.n, 0), 999) : 0;
  kitchen.visits[ctx.kid] = { day, n: before + 1 };
  return before;
}
function saveProfile() {
  const kitchen = kitchenSettings(S.ctx.settings);
  if (!kitchen.profiles || typeof kitchen.profiles !== "object" || Array.isArray(kitchen.profiles)) kitchen.profiles = {};
  kitchen.profiles[S.ctx.kid] = S.model.profile;
  S.ctx.saveSettings();
}

/* ---------- panels ---------- */
function career() {
  const profile = S.model.profile, goals = S.model.goals;
  const next = MENU_RECIPES.find(recipe => recipe.unlockAt > profile.totalServed);
  const unlocked = MENU_RECIPES.filter(recipe => recipe.unlockAt <= profile.totalServed).length;
  return '<div class="kq-career-heading"><b>' + pair("SHIFT " + goals.shiftNumber, "料理挑戰 " + goals.shiftNumber) + '</b></div>' +
    '<ul class="kq-goals">' + goals.targets.map(goal => '<li class="' + (goal.complete ? "complete" : "") + '"><span>' + label(GOALS[goal.id]) + '</span><b>' + goal.current + '/' + goal.target + '</b><progress max="' + goal.target + '" value="' + goal.current + '" aria-label="' + t(GOALS[goal.id]) + '"></progress></li>').join("") + '</ul>' +
    '<p class="kq-unlock">' + (next ? pair("New recipe in " + dishes(next.unlockAt - profile.totalServed), "再完成 " + (next.unlockAt - profile.totalServed) + " 份解鎖新食譜") : pair("All " + unlocked + " recipes unlocked", unlocked + " 道食譜全部解鎖")) +
    ' · ' + pair(dishes(profile.totalServed) + " made", "累計完成 " + profile.totalServed + " 份") + '</p>';
}
function cookbook() {
  const profile = S.model.profile;
  return '<div class="kq-book-heading"><h2>' + pair("Your cookbook", "你的食譜本") + '</h2><div>' + button("tutorial", pair("Show me how", "教我怎麼玩")) + button("book:close", pair("Back to cooking", "繼續料理"), 'class="kq-primary" autofocus') + '</div></div>' +
    '<section class="kq-career" aria-label="' + t(["Cooking progress", "料理進度"]) + '">' + career() + '</section><div class="kq-book-grid">' + MENU_RECIPES.map(recipe => {
      const unlocked = recipe.unlockAt <= profile.totalServed;
      return '<article data-recipe-id="' + recipe.id + '" data-unlocked="' + unlocked + '"><img class="kq-dish" src="' + dishURL(recipe) + '" alt=""><h3>' + label(RECIPES[recipe.id]) + '</h3><ol>' + recipe.sequence.map((id, i) => '<li><b>' + (i + 1) + '</b>' + icon(id) + label(FOOD[id]) + '</li>').join("") + '</ol><p>' +
        (unlocked ? pair("Served " + times(profile.recipeServes[recipe.id]), "已完成 " + profile.recipeServes[recipe.id] + " 次") : pair("Unlocks in " + dishes(recipe.unlockAt - profile.totalServed), "再完成 " + (recipe.unlockAt - profile.totalServed) + " 份解鎖")) + '</p></article>';
    }).join("") + '</div>';
}
function preparation(k) {
  const rows = prepPlan(S.model.stations, k);
  return '<h3>' + pair("Prep for both customers", "一起準備兩位客人的食材") + '</h3>' +
    (rows.length ? '<div class="kq-prep-table"><table><thead><tr><th>' + pair("Food", "食材") + '</th><th>' + pair("Need", "還需要") + '</th><th>' + pair("Ready", "備好了") + '</th><th>' + pair("Cooking", "準備中") + '</th><th></th></tr></thead><tbody>' + rows.map(row => {
      const station = row.ingredient === "patty" ? "grill" : row.ingredient === "lasagna" ? "oven" : "board";
      return '<tr data-ingredient="' + row.ingredient + '" data-shortage="' + row.missing + '" data-preparing="' + row.cooking + '"><th>' + icon(row.ingredient) + label(FOOD[row.ingredient]) + '</th><td>' + row.needed + '</td><td>' + row.ready + '</td><td>' + row.cooking + '</td><td>' + button("view:" + station, row.missing ? pair("Make " + row.missing, "去準備 " + row.missing) : pair("Look", "看看")) + '</td></tr>' +
        (row.reserved || row.retry ? '<tr class="kq-reserved"><td colspan="5">' + (row.retry ? pair(row.retry + " patties need a retry at the grill.", row.retry + " 份肉排需要回煎鍋重做。") : pair(row.reserved + " patties already saved for these plates.", "已預留 " + row.reserved + " 份肉排。")) + '</td></tr>' : "");
    }).join("") + '</tbody></table></div>' : '<p class="kq-prep-clear">' + pair("All prepped. Finish the recipes, then serve!", "備料完成，照食譜做好再上菜！") + '</p>');
}
/* What the pan holding this layer's patty is doing; a patty with no pan (it should not happen) reads as cooking. */
function pattyPhase(layerId, k) {
  const job = k.grill.find(entry => entry.targetLayerId === layerId);
  return job ? job.phase : "side-one";
}
/* The pending patty that needs a hand soonest on the active plate, else whichever one is cooking. */
function pendingPhase(layers, k) {
  const phases = layers.filter(l => l.pending).map(l => pattyPhase(l.id, k));
  return ["burnt", "ready", "flip"].find(phase => phases.includes(phase)) || phases[0] || null;
}
function activeHint(k = S.model.kitchen.snapshot()) {
  const m = S.model, report = m.evaluation();
  if (m.phase === "serving") return ["Delicious! Thank you, chef!", "好好吃！謝謝小廚師！"];
  if (m.waiting) return ["A new customer is coming!", "新客人快來了！"];
  const cooking = pendingPhase(m.layers, k);
  if (cooking) return PATTY_HINT[cooking];
  if (report.correct) return ["Ready to serve!", "可以上菜囉！"];
  const step = report.steps[report.firstMismatch];
  if (step.status === "wrong" || step.status === "extra") return ["Tap the wrong food to take it off.", "點放錯的食材拿掉它。"];
  // When the next food has run out, say where it comes from instead of just naming it.
  const out = shortage();
  if (out === "lasagna") {
    const oven = m.kitchen.snapshot().oven.phase;
    return oven === "baking" ? ["The lasagna is baking…", "千層麵正在烤…"] : oven === "ready" ? ["Take the lasagna out of the oven!", "把千層麵從烤箱取出來！"] : ["Bake a lasagna first!", "先烤一盤千層麵！"];
  }
  if (out === "tomato" || out === "lettuce") return ["Chop more " + FOOD[out][0].toLowerCase() + " first!", "先切更多" + FOOD[out][1] + "！"];
  if (out === "patty") return ["Tap Raw patty to grill one.", "點生肉排去煎一份。"];
  return ["Next: " + FOOD[step.required][0], "下一步：" + FOOD[step.required][1]];
}
/* The food the active plate needs next, if it has run out (and so must be made first). */
function shortage() {
  const m = S.model, report = m.evaluation();
  if (m.phase !== "editing" || report.correct || report.firstMismatch === null || m.layers.some(l => l.pending)) return null;
  const step = report.steps[report.firstMismatch];
  return step && step.status === "missing" && m.kitchen.available(step.required) === 0 ? step.required : null;
}
function panStatus(job) {
  const s = seconds(job.remaining);
  if (job.phase === "empty") return ["Empty", "空的"];
  if (job.phase === "flip") return ["Flip! " + s + "s", "翻面！" + s + " 秒"];
  if (job.phase === "ready") return ["Ready! " + s + "s", "取出！" + s + " 秒"];
  if (job.phase === "burnt") return ["Burnt", "燒焦了"];
  return job.phase === "side-one" ? ["Side 1 · " + s + "s", "第一面 " + s + " 秒"] : ["Side 2 · " + s + "s", "第二面 " + s + " 秒"];
}
function progressOf(job) {
  if (job.phase === "empty") return 0;
  if (job.phase === "burnt") return 1;
  return Math.max(0, Math.min(1, 1 - job.remaining / (job.duration || 1)));
}
function strip(k) {
  const m = S.model, order = m.order;
  const chip = (action, pressed, img, title, status, cls = "", extra = "") => button(action, img + '<span class="kq-chip-copy">' + title + '<em>' + status + '</em></span>' + extra,
    'class="kq-chip' + cls + '" aria-pressed="' + pressed + '"');
  const who = S.cast.of(order.id);
  const plate = chip("view:plate", S.view === "plate", '<img src="' + dishURL(order.recipe) + '" alt="">', who ? '<span>' + whoName(who) + '</span>' : pair("Plate", "餐盤"), t(RECIPES[order.recipe.id]));
  // Idle stations shrink to an icon; a station that is working, or is needed now, shows in full.
  const out = shortage();
  const idle = (action, img, name, needed) => button(action, img, 'class="kq-chip kq-chip--idle' + (needed ? " attention" : "") + '" aria-pressed="' + (S.view === action.slice(5)) + '" aria-label="' + t(name) + '"');
  const busy = k.grill.some(job => job.phase !== "empty");
  const pans = !busy ? idle("view:grill", icon("pan"), ["Grill", "煎鍋"], out === "patty") : k.grill.map((job, i) => {
    if (job.phase === "empty") return "";
    const attention = job.phase === "flip" || job.phase === "ready" || job.phase === "burnt";
    const img = icon(job.phase === "burnt" ? "patty-burnt" : job.phase === "side-one" || job.phase === "flip" ? "patty-raw" : "patty");
    return button("view:grill", img + '<span class="kq-chip-copy">' + pair("Grill " + (i + 1) + (job.targetOrderId !== undefined ? " ★" : ""), "煎鍋 " + (i + 1) + (job.targetOrderId !== undefined ? " ★" : "")) + '<em>' + t(panStatus(job)) + '</em></span><i class="kq-meter" style="--p:' + progressOf(job) + '"></i>',
      'class="kq-chip' + (attention ? " attention" : "") + '" data-pan="' + i + '" aria-pressed="' + (S.view === "grill") + '"');
  }).join("");
  const boardIcon = icon(k.board.ingredient === "tomato" ? "whole-tomato" : "whole-lettuce");
  const board = k.board.cuts === 0 ? idle("view:board", boardIcon, ["Chop", "切菜"], out === "tomato" || out === "lettuce") :
    chip("view:board", S.view === "board", boardIcon, pair("Chop", "切菜"), k.board.cuts + " / " + k.board.required + " · " + t(FOOD[k.board.ingredient]));
  const ovenJob = k.oven, ovenAttention = ovenJob.phase === "ready" || ovenJob.phase === "burnt" || (out === "lasagna" && ovenJob.phase !== "baking");
  const ovenStatus = ovenJob.phase === "empty" ? [k.lasagnaLayers.length + " / 6 layers", k.lasagnaLayers.length + " / 6 層"] : ovenJob.phase === "baking" ? [seconds(ovenJob.remaining) + "s", seconds(ovenJob.remaining) + " 秒"] : ovenJob.phase === "ready" ? ["Ready!", "取出！"] : ["Burnt", "燒焦了"];
  const oven = ovenJob.phase === "empty" && !k.lasagnaLayers.length ? idle("view:oven", icon("lasagna"), ["Oven", "烤箱"], out === "lasagna") :
    chip("view:oven", S.view === "oven", icon("lasagna"), pair("Oven", "烤箱"), t(ovenStatus), ovenAttention ? " attention" : "", '<i class="kq-meter" style="--p:' + progressOf(ovenJob) + '"></i>');
  const plan = button("view:plan", '<span class="kq-chip-copy">' + pair("Prep", "備料") + '</span>', 'class="kq-chip kq-chip--small" aria-pressed="' + (S.view === "plan") + '"');
  return plate + pans + board + oven + plan;
}
function ticket(k) {
  const m = S.model, report = m.evaluation(), layers = m.layers;
  const remove = layer => 'aria-label="' + t(["Remove " + FOOD[layer.ingredient][0], "移除" + FOOD[layer.ingredient][1]]) + '"';
  const rows = m.order.recipe.sequence.map((id, i) => {
    const layer = layers[i], status = layer && layer.pending ? "pending" : report.steps[i].status;
    // Only the rows that need attention say anything; the highlight carries the rest.
    const heat = status === "pending" ? pattyPhase(layer.id, k) : null;
    const detail = heat ? PATTY[heat] : status === "wrong" ? ["Wrong food", "放錯了"] : null;
    const mark = status === "matched" ? "✓" : status === "wrong" ? "✗" : "";
    const body = '<b>' + (i + 1) + '</b>' + icon(id) + '<span>' + label(FOOD[id]) + (detail ? '<em>' + t(detail) + '</em>' : "") + '</span><i class="kq-check">' + mark + '</i>';
    return '<li class="' + status + (mark ? "" : " nomark") + (i === report.firstMismatch ? " next" : "") + '"' + (heat ? ' data-heat="' + heat + '"' : "") + '>' + (layer ? button("remove:" + layer.id, body, remove(layer)) : '<div>' + body + '</div>') + '</li>';
  }).join("");
  const extras = layers.slice(m.order.recipe.sequence.length).map(layer => '<li class="extra">' + button("remove:" + layer.id, '<b>+</b>' + icon(layer.ingredient) + '<span>' + label(FOOD[layer.ingredient]) + '<em>' + t(["Extra", "多放了"]) + '</em></span><i class="kq-check">✗</i>', remove(layer)) + '</li>').join("");
  const who = S.cast.of(m.order.id);
  return '<div class="kq-ticket-heading"><span class="kq-who">' + (who ? '<img class="kq-face" src="' + portraitURL(who) + '" alt="">' + whoName(who) : t(["Order", "點餐"])) + '</span>' + button("read", pair("Listen", "聽"), 'class="kq-listen"') + '</div>' +
    '<img class="kq-dish-small" src="' + dishURL(m.order.recipe) + '" alt="">' +
    '<h3>' + label(RECIPES[m.order.recipe.id]) + '</h3>' + (m.order.request ? '<p class="kq-request">' + label(REQUESTS[m.order.request]) + '</p>' : "") +
    '<ol>' + rows + extras + '</ol>';
}
/* The customer list is a queue of toasts: who is at the counter, then who is in line.
   Cards are keyed by person so they slide in and out instead of blinking on every redraw. */
function whoName(who) { return t(who.name); }
function queueItems(k) {
  const m = S.model, items = [];
  m.stations.forEach(st => {
    const c = S.scene.customers[st.slot], who = S.cast.of(st.order.id);
    if (!who || !c || c.id !== st.order.id || c.state !== "here") return;
    const recipe = st.order.recipe, title = RECIPES[recipe.id];
    const cooking = pendingPhase(st.layers, k);
    let status = st.evaluation.correct ? ["Ready!", "可以上菜！"] : cooking ? PATTY[cooking] : [st.evaluation.matchedPrefix + " / " + recipe.sequence.length, st.evaluation.matchedPrefix + " / " + recipe.sequence.length];
    if (st.phase === "serving") status = ["Thank you!", "謝謝！"];
    items.push({ key: "seat:" + who.id, tag: "button", who,
      html: '<img class="kq-face" src="' + portraitURL(who) + '" alt=""><span class="kq-order-copy"><b>' + whoName(who) + '</b><span>' + t(title) + '</span>' +
        (st.order.request ? '<em class="kq-request-small">' + t(REQUESTS[st.order.request]) + '</em>' : "") + '<em class="kq-order-status">' + t(status) + '</em></span>',
      attrs: { "data-action": "order:" + st.slot, "aria-pressed": String(st.slot === m.activeSlot), "data-ready": String(st.phase === "editing" && st.evaluation.correct),
        "aria-label": whoName(who) + ", " + t(title) + (st.order.request ? ", " + t(REQUESTS[st.order.request]) : "") } });
  });
  S.scene.liners.filter(l => l.state !== "outside").sort((a, b) => a.spot - b.spot).forEach((l, i) => {
    items.push({ key: "line:" + l.who.id, tag: "div", who: l.who,
      html: '<img class="kq-face" src="' + portraitURL(l.who) + '" alt=""><span class="kq-order-copy"><b>' + whoName(l.who) + '</b><em class="kq-order-status">' + t(i === 0 ? ["Next in line", "下一位"] : ["In line", "排隊中"]) + '</em></span>',
      attrs: {} });
  });
  return items;
}
function syncQueue(k) {
  const box = S.root.querySelector(".kq-queue"), items = queueItems(k);
  const live = new Map(Array.from(box.children).filter(el => !el.classList.contains("kq-toast-out")).map(el => [el.dataset.key, el]));
  let prev = null;
  items.forEach(item => {
    let el = live.get(item.key);
    if (el) live.delete(item.key);
    else {
      el = document.createElement(item.tag); el.dataset.key = item.key;
      if (item.tag === "button") el.type = "button";
      el.className = "kq-order kq-toast-in" + (item.tag === "div" ? " kq-order--line" : "");
      el.style.setProperty("--who", HEX[item.who.shirt]);
      el.addEventListener("animationend", () => el.classList.remove("kq-toast-in"), { once: true });
    }
    Object.entries(item.attrs).forEach(([name, value]) => { if (el.getAttribute(name) !== value) el.setAttribute(name, value); });
    if (el.innerHTML !== item.html && !(S.touchTarget && el.contains(S.touchTarget))) el.innerHTML = item.html;
    const after = prev ? prev.nextSibling : box.firstChild;
    if (el !== after) box.insertBefore(el, after);
    prev = el;
  });
  live.forEach(el => {
    el.classList.remove("kq-toast-in"); el.classList.add("kq-toast-out"); el.removeAttribute("data-action");
    const gone = () => el.remove();
    el.addEventListener("animationend", gone, { once: true }); setTimeout(gone, 450);
  });
}
function heatButton(action, job) {
  const wording = job.phase === "empty" ? ["Cook 2 for stock", "煎兩份備用"] : HEAT[job.phase];
  const timed = !["empty", "burnt"].includes(job.phase);
  return button(action, label(wording) + (timed ? '<b class="kq-timer">' + seconds(job.remaining) + 's</b>' : ""),
    'class="kq-heat ' + job.phase + '" data-job="' + job.id + '"' + (["side-one", "side-two", "baking"].includes(job.phase) ? " disabled" : ""));
}
function station(k) {
  if (S.view === "plan") return '<div class="kq-plan">' + preparation(k) + '</div>';
  if (S.view === "grill") return '<div class="kq-bar">' + k.grill.map((job, i) => '<div class="kq-pan">' + heatButton("grill:" + i, job) + '</div>').join("") + '</div>';
  if (S.view === "board") return '<div class="kq-bar">' + ["tomato", "lettuce"].map(id => button("board:" + id, icon(id === "tomato" ? "whole-tomato" : "whole-lettuce") + label(FOOD[id]), 'class="kq-pick" aria-pressed="' + (k.board.ingredient === id) + '"')).join("") +
    button("board:cut", pair("CHOP " + k.board.cuts + " / " + k.board.required, "切 " + k.board.cuts + " / " + k.board.required), 'class="kq-primary kq-chop"') + button("board:reset", pair("Reset", "重設")) + '</div>';
  // The ingredient the tray needs next glows, and so does its empty slot, like the burger trays.
  const ok = k.lasagnaLayers.every((id, i) => id === LASAGNA_STEPS[i]);
  const next = ok && k.lasagnaLayers.length < LASAGNA_STEPS.length ? LASAGNA_STEPS[k.lasagnaLayers.length] : null;
  const revision = 'data-revision="' + k.trayRevision + '"';
  return '<div class="kq-bar kq-bar--oven"><div class="kq-oven-add">' + ["pasta", "sauce", "cheese"].map(id => button("lasagna:add:" + id, icon(id) + label(FOOD[id]), (id === next ? 'class="next" ' : "") + revision)).join("") + '</div>' +
    '<ol class="kq-lasagna-recipe" aria-label="' + t(["Lasagna layers", "千層麵層次"]) + '">' + LASAGNA_STEPS.map((id, i) => {
      const placed = k.lasagnaLayers[i];
      return '<li class="' + (placed === id ? "matched" : placed ? "wrong" : next && i === k.lasagnaLayers.length ? "next" : "") + '">' + (placed ? button("lasagna:remove:" + i, '<b>' + (i + 1) + '</b>' + icon(placed), revision + ' aria-label="' + t(["Remove layer " + (i + 1), "移除第 " + (i + 1) + " 層"]) + '"') : '<span><b>' + (i + 1) + '</b>' + icon(id, "ghost") + '</span>') + '</li>';
    }).join("") + '</ol>' +
    button("lasagna:clear", pair("Clear", "清空"), 'class="kq-oven-clear" ' + revision) + '</div>';
}
const trayDone = k => k.lasagnaLayers.length === LASAGNA_STEPS.length && k.lasagnaLayers.every((id, i) => id === LASAGNA_STEPS[i]);
/* The one big thing to do next, centred over the counter and blinking: serve, bake or take out. */
function promptFor(k) {
  const m = S.model, o = k.oven;
  if (S.view === "plate" && m.phase === "editing" && m.evaluation().correct) return { action: "serve", text: ["SERVE IT!", "上菜！"] };
  if (S.view === "grill") {
    // The pan that needs a hand soonest; numbered only when both pans are cooking.
    const due = k.grill.map((job, i) => ({ job, i })).filter(({ job }) => ["flip", "ready", "burnt"].includes(job.phase))
      .sort((a, b) => (a.job.phase === "burnt") - (b.job.phase === "burnt") || a.job.remaining - b.job.remaining)[0];
    if (!due) return null;
    const { job, i } = due, n = i + 1, two = k.grill.every(j => j.phase !== "empty");
    if (job.phase === "burnt") return { action: "grill:" + i, job: job.id, text: ["Try again", "再試一次"], calm: true };
    if (job.phase === "flip") return { action: "grill:" + i, job: job.id, icon: "patty-raw", text: two ? ["FLIP PAN " + n + "!", n + " 號鍋翻面！"] : ["FLIP!", "翻面！"] };
    return { action: "grill:" + i, job: job.id, icon: "patty", text: two ? ["TAKE OUT PAN " + n + "!", "取出 " + n + " 號鍋！"] : ["TAKE IT OUT!", "取出來！"] };
  }
  if (S.view !== "oven") return null;
  if (o.phase === "ready") return { action: "oven", job: o.id, icon: "lasagna", text: ["TAKE IT OUT!", "取出來！"] };
  if (o.phase === "burnt") return { action: "oven", job: o.id, text: ["Try again", "再試一次"], calm: true };
  if (o.phase === "empty" && trayDone(k)) return { action: "oven", job: o.id, icon: "lasagna", text: ["BAKE IT!", "送進烤箱！"] };
  return null;
}
/* First-order guide: a bouncing glove points at the one thing to tap next, until the first serve. */
function tutorialTarget() {
  const m = S.model, q = selector => S.root.querySelector(selector);
  const prompt = q(".kq-prompt");
  if (!prompt.hidden) return prompt;
  if (m.phase !== "editing") return null;
  if (m.layers.some(l => l.pending)) return S.view === "grill" ? null : q('.kq-strip [data-action="view:grill"]');
  const report = m.evaluation();
  if (report.correct) return S.view === "plate" ? null : q('.kq-strip [data-action="view:plate"]');
  const step = report.steps[report.firstMismatch];
  if (step.status === "wrong" || step.status === "extra") return q(".kq-ticket li.wrong button, .kq-ticket li.extra button");
  const out = shortage();
  if (out === "lasagna") return S.view === "oven" ? q(".kq-oven-add .next") : q('.kq-strip [data-action="view:oven"]');
  if ((out === "tomato" || out === "lettuce") && S.view === "board") return q('.kq-station [data-action="board:cut"]');
  return q('.kq-tray[data-food="' + step.required + '"]');
}
function renderHand() {
  const hand = S.root.querySelector(".kq-hand"), target = S.tutorial && !S.dialog ? tutorialTarget() : null;
  if (!target || !target.getClientRects().length) { if (!hand.hidden) hand.hidden = true; return; }
  const r = target.getBoundingClientRect(), box = S.root.getBoundingClientRect(), size = 52;
  // Upper targets get the glove underneath pointing up; lower ones get it above pointing down.
  const below = r.top + r.height / 2 < box.top + box.height * .55;
  hand.style.left = Math.round(r.left - box.left + r.width / 2 - size / 2) + "px";
  hand.style.top = Math.round(below ? r.bottom - box.top - 6 : r.top - box.top - size + 6) + "px";
  hand.style.setProperty("--r", below ? "0deg" : "180deg");
  hand.hidden = false;
}
function renderPrompt(k) {
  const el = S.root.querySelector(".kq-prompt"), prompt = promptFor(k);
  if (!prompt) { if (!el.hidden) el.hidden = true; return; }
  if (S.touchTarget === el) return;
  el.hidden = false;
  if (el.dataset.action !== prompt.action) el.dataset.action = prompt.action;
  if (prompt.job !== undefined) el.dataset.job = String(prompt.job); else delete el.dataset.job;
  el.classList.toggle("calm", !!prompt.calm);
  const content = (prompt.icon ? icon(prompt.icon) : "") + label(prompt.text);
  if (el.innerHTML !== content) el.innerHTML = content;
  el.style.top = Math.round(S.scene.counterY + 6) + "px";
}
function trays(k) {
  // The tray the ticket asks for next glows, so the recipe reads at a glance.
  const report = S.model.evaluation(), step = report.firstMismatch === null ? null : report.steps[report.firstMismatch];
  const next = S.model.phase === "editing" && step && step.status === "missing" ? step.required : null;
  return TRAYS.map(id => {
    const direct = id === "patty" && k.stock.patty === 0;
    const count = Object.hasOwn(k.stock, id) ? k.stock[id] : null;
    const empty = count === 0 && !direct;
    // Pantry food never runs out, so it carries no number at all.
    const badge = direct ? t(["RAW", "生"]) : count === null ? "" : String(count);
    const sub = direct ? ["Grill it", "去煎"] : empty ? (id === "lasagna" ? ["Bake more", "去烤"] : ["Chop more", "去切"]) : null;
    return button(direct ? "cookPatty" : "add:" + id, (badge ? '<i class="kq-badge">' + badge + '</i>' : "") + icon(direct ? "patty-raw" : id) +
      '<span class="kq-tray-copy"><b>' + label(FOOD[direct ? "patty-raw" : id]) + '</b>' + (sub ? '<em class="kq-stock">' + t(sub) + '</em>' : "") + '</span>',
      'class="kq-tray' + (empty ? " empty" : "") + (direct ? " raw" : "") + (id === next ? " next" : "") + '" data-food="' + id + '"');
  }).join("");
}
function setbar() {
  return '<div class="kq-setbar" role="group" aria-label="' + t(["Kitchen controls", "廚房設定"]) + '">' +
    '<div class="kq-mode">' + button("difficulty:easy", pair("Very easy", "輕鬆玩")) + button("difficulty:standard", pair("Kitchen shift", "廚房輪班")) + '</div>' +
    button("book", pair("Cookbook", "食譜本")) + button("pause", pair("Pause", "暫停")) +
    // The switch is written in the language it switches to, so a child who reads only that one can find it.
    button("lang", zh() ? '<span lang="en">English</span>' : '<span lang="zh-Hant">中文</span>', 'class="kq-lang" aria-label="' + (zh() ? "Switch to English" : "切換成中文") + '"') +
    '<span class="kq-pace" aria-live="off"></span></div>';
}

/* ---------- render ---------- */
function html(selector, value) {
  const el = S.root.querySelector(selector);
  // Keep the native touch target alive until release, even when a countdown changes.
  if (S.touchTarget && el.contains(S.touchTarget)) return;
  if (el.innerHTML !== value) {
    const active = document.activeElement, action = el.contains(active) && active.dataset.action;
    el.innerHTML = value;
    if (action) {
      const replacement = Array.from(el.querySelectorAll("button")).find(b => b.dataset.action === action);
      if (replacement && !replacement.disabled) replacement.focus({ preventScroll: true });
    }
  }
}
// Event messages show briefly under the hint, then step aside so one line of guidance remains.
const NOTICE_MS = 4500;
function notice(en, zhText) {
  S.root.querySelector(".kq-notice").textContent = zh() ? zhText : en;
  S.noticeAt = performance.now();
}
function labels() {
  const set = (selector, text) => S.root.querySelector(selector).setAttribute("aria-label", text);
  S.root.setAttribute("aria-label", t(["Kitchen Quest", "廚房冒險"]));
  set(".kq-strip", t(["Plate and cooking stations", "餐盤與料理工作台"]));
  set(".kq-ticket", t(["Recipe", "食譜"]));
  set(".kq-counter canvas", t(["Pixel café counter with your customers and dish", "像素餐廳櫃台，有客人和你的料理"]));
  set(".kq-orders", t(["Orders", "點餐"]));
  set(".kq-trays", t(["Ingredients", "食材"]));
}
function setLang(next) {
  LANG = next === "zh" ? "zh" : "en";
  const kitchen = kitchenSettings(S.ctx.settings);
  if (!kitchen.lang || typeof kitchen.lang !== "object" || Array.isArray(kitchen.lang)) kitchen.lang = {};
  kitchen.lang[S.ctx.kid] = LANG;
  S.ctx.saveSettings();
  S.scene.setLang(LANG);
  if (BAR) BAR.innerHTML = setbar();
  S.root.querySelector(".kq-notice").textContent = ""; S.noticeAt = 0;
  labels(); render();
}
function render() {
  if (!S) return;
  const m = S.model, k = m.kitchen.snapshot();
  S.cast.sync(m.stations);
  S.root.dataset.view = S.view;
  S.root.dataset.lang = LANG;
  html(".kq-strip", strip(k));
  html(".kq-ticket", ticket(k));
  if (S.ticketOrderId !== m.order.id) { S.root.querySelector(".kq-ticket").scrollTop = 0; S.ticketOrderId = m.order.id; }
  html(".kq-orders h3", label(["Customers", "客人"]));
  syncQueue(k);
  const st = S.root.querySelector(".kq-station");
  st.hidden = S.view === "plate";
  if (S.view !== "plate") html(".kq-station", station(k));
  html(".kq-trays", trays(k));
  html(".kq-hint", label(activeHint(k)));
  const noticeEl = S.root.querySelector(".kq-notice");
  if (noticeEl.textContent && noticeEl.textContent === S.root.querySelector(".kq-hint").textContent) noticeEl.textContent = "";
  if (S.noticeAt && performance.now() - S.noticeAt > NOTICE_MS) { S.root.querySelector(".kq-notice").textContent = ""; S.noticeAt = 0; }
  renderPrompt(k);
  renderHand();
  html('[data-action="clear"]', label(["Start over", "重新開始"]));
  html('[data-action="serve"]', label(["SERVE IT!", "上菜！"]));
  const pace = BAR && BAR.querySelector(".kq-pace"), paceText = label(m.difficulty === "easy" ? ["No rush", "慢慢來"] : k.pace === "rush" ? ["Busy kitchen!", "客人變多囉"] : ["Time to prepare", "準備食材時間"]);
  if (pace && pace.innerHTML !== paceText) pace.innerHTML = paceText;
  const serve = S.root.querySelector('[data-action="serve"]');
  serve.disabled = m.phase !== "editing"; serve.classList.toggle("ready", m.evaluation().correct);
  if (BAR) BAR.querySelectorAll("[data-action^='difficulty:']").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.action === "difficulty:" + m.difficulty)));
  const hud = m.ordersServed + ":" + S.best + ":" + LANG;
  if (S.hud !== hud) { S.hud = hud; S.ctx.hud([{ k: t(["Served", "已上菜"]), v: m.ordersServed }, { k: t(["Best", "最佳"]), v: S.best }]); }
}
function frameState() {
  const m = S.model;
  return { layers: m.layers, stations: m.stations, activeSlot: m.activeSlot, kitchen: m.kitchen.snapshot() };
}
function draw(dt) {
  if (!S) return;
  const st = S.root.querySelector(".kq-station");
  S.scene.setView(S.view, S.view === "plate" || S.view === "plan" ? 0 : st.offsetHeight);
  S.cast.sync(S.model.stations);
  S.scene.update(dt, frameState());
}

/* ---------- dialogs ---------- */
function modal(kind) {
  const dialog = S.root.querySelector("dialog");
  S.scheduler.pause();
  S.last = 0;
  S.dialog = kind; dialog.dataset.kind = kind;
  dialog.setAttribute("aria-label", t(kind === "book" ? ["Your cookbook", "你的食譜本"] : ["Kitchen paused", "廚房暫停"]));
  dialog.innerHTML = kind === "book" ? cookbook() : kind === "pause" ? '<h2>' + pair("Kitchen paused", "廚房暫停中") + '</h2><p>' + pair("Your dishes and timers can wait.", "餐點和計時都會等你。") + '</p>' + button("pause", pair("Keep cooking", "繼續料理"), 'class="kq-primary"') :
    '<h2>' + pair("Start a fresh shift?", "開始新的料理時間？") + '</h2><p>' + pair("Both dishes reset. Your cookbook and best stay saved.", "兩份餐點會重設，食譜本和最佳紀錄會保留。") + '</p><div>' + button("confirm:no", pair("Keep cooking", "繼續這一局"), 'autofocus') + button("confirm:yes", pair("Start fresh", "重新開始"), 'class="kq-primary"') + '</div>';
  if (!dialog.open) dialog.showModal();
}
function pause() {
  if (!S || S.paused) return;
  S.paused = true; S.covered = false; S.touchTarget = null;
  if (S.audio) S.audio.stop();
  if (!S.model.pendingMode && S.dialog !== "book") modal("pause");
  else S.scheduler.pause();
}
function resume() {
  S.paused = false; S.dialog = null; S.last = 0;
  S.root.querySelector("dialog").close();
  S.scheduler.resume();
  render();
}

/* ---------- actions ---------- */
function origin(target) {
  if (!target || !target.getBoundingClientRect) return null;
  const r = target.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 3 };
}
function perform(action, target) {
  if (!S || S.covered) return;
  const m = S.model;
  if (action === "tutorial") {
    if (S.dialog !== "book") return;
    S.tutorial = true; S.view = "plate";
    if (S.paused) modal("pause"); else resume();
    return;
  }
  if (action === "book:close") {
    if (S.dialog !== "book") return;
    if (S.paused) modal("pause"); else resume();
    return;
  }
  if (action === "lang") { setLang(zh() ? "en" : "zh"); S.audio.press(); return; }
  if (action === "pause") { if (m.pendingMode || S.dialog === "book") return; if (S.paused) resume(); else pause(); return; }
  if (action.indexOf("confirm:") === 0) {
    m.confirmMode(action === "confirm:yes");
    S.root.querySelector("dialog").close();
    S.dialog = null;
    if (S.paused) modal("pause"); else { S.last = 0; S.scheduler.resume(); }
    S.view = "plate"; render(); return;
  }
  if (S.paused || m.pendingMode || S.dialog === "book") return;
  if (action === "book") { modal("book"); return; }
  if (action.indexOf("difficulty:") === 0) {
    if (m.requestDifficulty(action.slice(11)) === "confirm") modal("mode");
  } else if (action.indexOf("view:") === 0) {
    const view = action.slice(5);
    if (VIEWS.includes(view)) { S.view = view; S.audio.press(); const st = S.root.querySelector(".kq-station"); st.scrollTop = 0; }
  } else if (action === "tray") {
    S.view = "oven";
  } else if (action.indexOf("order:") === 0) {
    if (m.selectOrder(Number(action.slice(6))) === "changed") { S.view = "plate"; S.audio.press(); }
  } else if (action === "read") {
    const recipe = RECIPES[m.order.recipe.id], steps = m.order.recipe.sequence;
    const request = m.order.request ? REQUESTS[m.order.request] : ["", ""];
    if (zh()) S.ctx.say([recipe[1], request[1], steps.map(id => FOOD[id][1]).join("、")].filter(Boolean).join("。"), "zh-TW");
    else S.ctx.say([recipe[0], request[0], steps.map(id => FOOD[id][0]).join(", ")].filter(Boolean).join(". "), "en-US");
  } else if (/^(grill:|board:|lasagna:|oven$)/.test(action)) {
    const data = target && target.dataset || {};
    const k = m.kitchen.snapshot();
    // A tap on the pan or oven in the scene acts on the job that is showing right now.
    const job = data.job !== undefined ? Number(data.job) : action.indexOf("grill:") === 0 ? (k.grill[Number(action.slice(6))] || {}).id : action === "oven" ? k.oven.id : undefined;
    const revision = data.revision !== undefined ? Number(data.revision) : undefined;
    const result = m.kitchenAction(action, "k" + ++S.serial, m.session, job, revision);
    notice(...kitchenMessage(result.message));
    if (!result.ok) S.audio.error();
    else if (result.sound === "collect") S.audio.celebrate();
    if (result.plated) S.view = "plate";
  } else {
    const parts = action.split(":"), type = parts[0];
    if (type === "add" && FOOD[parts[1]] && m.kitchen.available(parts[1]) === 0) {
      S.view = parts[1] === "lasagna" ? "oven" : "board";
      if (parts[1] === "tomato" || parts[1] === "lettuce") m.kitchenAction("board:" + parts[1], "k" + ++S.serial, m.session);
      notice(...REJECT.stock); S.audio.press(); render(); return;
    }
    if (!["add", "cookPatty", "remove", "clear", "serve"].includes(type)) return;
    if (type === "add" && !FOOD[parts[1]]) return;
    const result = m.apply({ id: "p" + ++S.serial, session: m.session, orderId: m.order.id, type, ingredient: parts[1], layerId: Number(parts[1]) });
    if (result.type === "reject") {
      notice(...REJECT[result.reason]); S.audio.error();
      if (result.reason === "full") S.scene.rejectFull();
    } else if (result.type === "mismatch") { notice(...activeHint()); S.view = "plate"; S.audio.error(); }
    else if (result.type === "serve") {
      S.view = "plate"; S.scene.serve();
      if (S.tutorial) {
        S.tutorial = false;
        const kitchen = kitchenSettings(S.ctx.settings);
        if (!kitchen.tutorial || typeof kitchen.tutorial !== "object" || Array.isArray(kitchen.tutorial)) kitchen.tutorial = {};
        kitchen.tutorial[S.ctx.kid] = "done";
      }
      S.best = Math.max(S.best, m.ordersServed);
      saveProfile();
      S.ctx.finish({ score: m.ordersServed });
      notice("Delicious! Thank you, chef!", "好好吃！謝謝小廚師！");
      if (result.progress.completedShift) notice("Shift complete! Your next cooking challenge is ready.", "料理挑戰完成！下一個挑戰準備好了。");
      if (result.progress.unlocked.length) notice("New recipe: " + result.progress.unlocked.map(id => RECIPES[id][0]).join(", "), "新食譜：" + result.progress.unlocked.map(id => RECIPES[id][1]).join("、"));
    } else if (result.type === "add") {
      S.view = "plate"; S.scene.add(result.layer, origin(target)); notice(...activeHint());
    } else if (result.type === "cook") {
      S.scene.add(result.layer, origin(target)); S.view = "grill"; S.audio.press();
      notice("Raw patty on the grill. Its place on the plate is saved.", "生肉排放上煎鍋了，盤子上的位置已保留。");
    } else if (result.type === "clear") {
      S.scene.clear(); S.audio.clear(); notice("Fresh plate. Ingredients returned to stock.", "換好盤子，食材已放回備料架。");
    } else if (result.type === "undo") {
      S.scene.remove(result.layer.id); S.audio.undo(); notice("Layer removed. Your other food stays.", "已拿掉這一層，其他食材都還在。");
    }
  }
  render();
}

/* ---------- input ---------- */
function keys(e) {
  if (!S || S.covered || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const inBar = BAR && BAR.contains(e.target);
  if (!S.root.contains(e.target) && !inBar && e.target.closest && e.target.closest("button,a,[role=button],[contenteditable=true]")) return;
  let action;
  const focused = e.target.closest && e.target.closest(".kq button,.kq-setbar button");
  if ((e.key === " " || e.key === "Enter") && focused) action = focused.dataset.action;
  else if (e.key === "Escape" && (S.paused || S.model.pendingMode || S.dialog === "book")) action = S.dialog === "book" ? "book:close" : S.model.pendingMode ? "confirm:no" : "pause";
  else if (e.key === "Enter") action = "serve";
  else if (/^[1-7]$/.test(e.key)) { focusedTray(Number(e.key) - 1); return; }
  else action = { q: "order:0", w: "order:1", g: "view:grill", b: "view:board", o: "view:oven", a: "view:plate", r: "view:plan", h: "book", p: "pause" }[e.key.toLowerCase()];
  if (!action) return;
  e.preventDefault(); e.stopPropagation();
  if (!e.repeat && !(focused && focused.disabled)) perform(action, focused);
  function focusedTray(index) {
    e.preventDefault(); e.stopPropagation();
    const tray = S.root.querySelectorAll(".kq-tray")[index];
    if (tray && !e.repeat) { S.audio.unlock(); perform(tray.dataset.action, tray); }
  }
}
function onCanvas(e) {
  if (!S || e.button !== 0) return;
  S.audio.unlock();
  const hit = S.scene.hitTest(e.clientX, e.clientY);
  if (!hit) return;
  e.preventDefault();
  if (hit.type === "layer") perform("remove:" + hit.id);
  else if (hit.type === "customer") { S.scene.skipSpeech(hit.slot); perform("order:" + hit.slot); }
  else if (hit.type === "action") perform(hit.action);
}

function settings(bar, ctx) {
  BAR = bar;
  if (ctx) LANG = savedLang(ctx);
  bar.innerHTML = setbar();
  // Delegated: the language switch re-renders the bar's buttons in place.
  bar.addEventListener("click", e => {
    const b = e.target.closest("button[data-action]");
    if (b && S) { S.audio.unlock(); perform(b.dataset.action, b); }
  });
}

function init(ctx) {
  stop();
  LANG = savedLang(ctx);
  const root = document.createElement("section"); root.className = "kq"; root.dataset.version = "0.8.0";
  root.innerHTML = '<link rel="stylesheet" href="' + new URL("../../css/kitchen-quest.css", import.meta.url).href + '">' +
    '<nav class="kq-strip"></nav>' +
    '<div class="kq-main"><aside class="kq-ticket"></aside>' +
    '<div class="kq-counter"><canvas role="img"></canvas><div class="kq-station" hidden></div><button type="button" class="kq-prompt" hidden></button></div>' +
    '<aside class="kq-orders"><h3></h3><div class="kq-queue"></div></aside></div>' +
    '<div class="kq-trays" role="group"></div>' +
    '<footer class="kq-bottom">' + button("clear", "", 'class="kq-clear"') + '<div class="kq-say"><div class="kq-hint"></div><p class="kq-notice" role="status" aria-live="polite"></p></div>' + button("serve", "", 'class="kq-primary kq-serve"') + '</footer>' +
    '<img class="kq-hand" src="' + iconURL("hand") + '" alt="" aria-hidden="true" hidden>' +
    '<dialog class="kq-dialog"></dialog>';
  const saved = ctx.settings.kitchen && ctx.settings.kitchen.profiles && ctx.settings.kitchen.profiles[ctx.kid];
  const profile = normalizeProfile(saved, ctx.best);
  // One deal per kid per (Taipei) day and amount of progress: different tomorrow, and different again once a
  // dish has been served since the last visit. The key is on root.dataset.seed and in snapshot().seed; to replay
  // a shift (a bug report, a test) put that key in settings.kitchen.seed. Each visit the same day gets its own key (…:r1, …:r2).
  const pinned = ctx.settings.kitchen && typeof ctx.settings.kitchen.seed === "string" ? ctx.settings.kitchen.seed : "";
  const day = typeof ctx.today === "function" ? ctx.today() : "";
  const seeds = pinned ? seedsFromKey(pinned) : shiftSeeds(ctx.kid, day, profile.totalServed, countVisit(ctx, day));
  const model = new KitchenModel(seeds.orders, true, true, profile); model.requestDifficulty("easy");
  const audio = new KitchenAudio(() => !!(ctx.isMuted && ctx.isMuted()));
  root.dataset.seed = seeds.key;
  ctx.mount.classList.add("kq-stage"); ctx.mount.appendChild(root);
  const canvas = root.querySelector("canvas");
  const reducedMotion = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  S = { root, ctx, model, audio, canvas, scene: null, scheduler: createScheduler(), paused: false, dialog: null, view: "plate", best: Number(ctx.best) || 0, serial: 0, last: 0, drawn: 0, hud: "" };
  S.cast = new Cast(seeds.cast); S.cast.sync(model.stations);
  const guide = ctx.settings.kitchen && ctx.settings.kitchen.tutorial;
  S.tutorial = model.profile.totalServed === 0 && !(guide && typeof guide === "object" && guide[ctx.kid] === "done");
  S.scene = new CounterScene(canvas, audio, { reducedMotion, lang: LANG, cast: S.cast });
  saveProfile();
  labels();
  root.addEventListener("pointerdown", e => {
    if (S) S.audio.unlock();
    const target = e.target.closest("button[data-action]");
    if (!target || target.disabled || e.button !== 0) return;
    if (e.pointerType === "touch" || e.pointerType === "pen") { S.touchTarget = target; return; }
    e.preventDefault(); target.focus({ preventScroll: true }); perform(target.dataset.action, target);
  });
  root.addEventListener("pointerup", () => { if (S) S.touchTarget = null; });
  root.addEventListener("pointercancel", () => { if (S) S.touchTarget = null; });
  root.addEventListener("click", e => {
    const target = e.target.closest("button[data-action]");
    // Native touch clicks are cancelled by scrolling; mouse controls already acted on press.
    if ((e.detail === 0 || e.pointerType === "touch" || e.pointerType === "pen") && target && !target.disabled) perform(target.dataset.action, target);
  });
  canvas.addEventListener("pointerdown", onCanvas);
  root.querySelector("dialog").addEventListener("cancel", e => { e.preventDefault(); perform(S.dialog === "book" ? "book:close" : S.model.pendingMode ? "confirm:no" : "pause"); });
  document.addEventListener("keydown", keys, true);
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("blur", pause);
  window.addEventListener("summerquest:native-pause", pause);
  S.resize = new ResizeObserver(() => { if (S) { S.scene.resize(); draw(0); } });
  S.resize.observe(root.querySelector(".kq-counter"));
  render(); draw(0);
  notice("Tap a customer, then follow their recipe. Nobody is in a hurry.", "點一位客人，照食譜做。客人會耐心等你。");
  S.scheduler.frame(time => {
    if (!S || S.paused || S.model.pendingMode || S.dialog === "book") return;
    if (ctx.isOverlayOpen && ctx.isOverlayOpen()) { S.covered = true; S.last = 0; return; }
    if (S.covered) { S.covered = false; pause(); return; }
    const dt = S.last ? Math.min(.05, (time - S.last) / 1000) : 0; S.last = time;
    const events = model.kitchen.advance(dt), arrivals = model.advanceServices(dt);
    if (events.length) {
      const event = events[0];
      notice(...(event.type === "flip" ? ["Time to flip a patty!", "肉排可以翻面了！"] : event.type === "ready" ? ["Ready! Collect your food.", "做好了！把食物取出吧。"] : ["Try a fresh batch. The other food is safe.", "再試一批，其他食材都還在。"]));
      if (event.type !== "burnt") S.audio.press(); else S.audio.error();
    }
    draw(dt);
    if (time - S.drawn >= 100 || events.length || arrivals.length) { S.drawn = time; render(); }
  });
}
function visibility() { if (document.hidden) pause(); }
function stop() {
  if (!S) return;
  S.scheduler.cancelAll();
  if (S.resize) S.resize.disconnect();
  document.removeEventListener("keydown", keys, true);
  document.removeEventListener("visibilitychange", visibility);
  window.removeEventListener("blur", pause);
  window.removeEventListener("summerquest:native-pause", pause);
  S.audio.close();
  S.root.querySelector("dialog").close(); S.root.remove(); S.ctx.mount.classList.remove("kq-stage"); S = null;
}
export default {
  id: "kitchen", version: "0.8.0", keyboard: false, bestKey: "kitchen",
  meta: { icon: "🍳", title: "Kitchen Quest", tz: "廚房冒險", blurb: "Cook & serve · 料理上菜" },
  settings, init, stop,
  snapshot() {
    if (!S) return null;
    return Object.assign(S.model.snapshot(), { paused: S.paused || !!S.covered || !!S.model.pendingMode || S.dialog === "book", dialog: S.dialog, lang: LANG, seed: S.root.dataset.seed, tutorial: !!S.tutorial, view: S.view, panel: S.view, best: S.best, scene: S.scene.diagnostics });
  },
  /* Test hook: where a plate layer is drawn right now, so a harness can tap the real food. */
  layerPoint(id) { return S ? S.scene.layerPoint(id) : null; }
};
