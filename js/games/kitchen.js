import { KitchenModel } from "./kitchen/model.js";
import { LASAGNA_STEPS } from "./kitchen/kitchen.js";
import { FOOD, RECIPES, REQUESTS, GOALS, HEAT, REJECT, kitchenMessage } from "./kitchen/strings.js";
import { MENU_RECIPES } from "./kitchen/recipes.js";
import { normalizeProfile } from "./kitchen/progression.js";
import { prepPlan } from "./kitchen/prep-plan.js";
import { drawKitchen, ingredientURL, WIDTH, HEIGHT } from "./kitchen/pixel-art.js";
import { createScheduler } from "../game-services/scheduler.js";

let S = null;
const pair = (en, zh) => '<span>' + en + '</span><small lang="zh-Hant">' + zh + '</small>';
const label = p => pair(p[0], p[1]);
const icon = id => '<img src="' + ingredientURL(id) + '" alt="" width="64" height="40">';
const button = (action, content, attrs = "") => '<button type="button" data-action="' + action + '" ' + attrs + '>' + content + '</button>';
const seconds = n => Math.max(0, Math.ceil(n));

function saveProfile() {
  const settings = S.ctx.settings;
  if (!settings.kitchen || typeof settings.kitchen !== "object" || Array.isArray(settings.kitchen)) settings.kitchen = {};
  if (!settings.kitchen.profiles || typeof settings.kitchen.profiles !== "object" || Array.isArray(settings.kitchen.profiles)) settings.kitchen.profiles = {};
  settings.kitchen.profiles[S.ctx.kid] = S.model.profile;
  S.ctx.saveSettings();
}
function career() {
  const profile = S.model.profile, goals = S.model.goals;
  const next = MENU_RECIPES.find(recipe => recipe.unlockAt > profile.totalServed);
  const unlocked = MENU_RECIPES.filter(recipe => recipe.unlockAt <= profile.totalServed).length;
  return '<div class="kq-career-heading"><b>' + pair("SHIFT " + goals.shiftNumber, "料理挑戰 " + goals.shiftNumber) + '</b><span>' + pair(profile.totalServed + " dishes made", "累計完成 " + profile.totalServed + " 份") + '</span></div>' +
    '<ul class="kq-goals">' + goals.targets.map(goal => '<li class="' + (goal.complete ? "complete" : "") + '"><span>' + label(GOALS[goal.id]) + '</span><b>' + goal.current + '/' + goal.target + '</b><progress max="' + goal.target + '" value="' + goal.current + '" aria-label="' + GOALS[goal.id].join(" ") + '"></progress></li>').join("") + '</ul>' +
    '<span class="kq-unlock">' + (next ? pair("Next recipe in " + (next.unlockAt - profile.totalServed) + " dishes", "再完成 " + (next.unlockAt - profile.totalServed) + " 份就能解鎖新食譜") : pair("All " + unlocked + " recipes unlocked", unlocked + " 道食譜全部解鎖")) + '</span>';
}
function cookbook() {
  const profile = S.model.profile;
  return '<div class="kq-book-heading"><h2>' + pair("Your cookbook", "你的食譜本") + '</h2>' + button("book:close", pair("Back to cooking", "繼續料理"), 'class="kq-primary" autofocus') + '</div>' +
    '<p>' + pair("Complete dishes to discover new recipes. Cooking waits while you read.", "完成餐點就能解鎖新食譜。看食譜時，料理計時會暫停。") + '</p><div class="kq-book-grid">' + MENU_RECIPES.map(recipe => {
      const unlocked = recipe.unlockAt <= profile.totalServed;
      return '<article data-recipe-id="' + recipe.id + '" data-unlocked="' + unlocked + '"><h3>' + label(RECIPES[recipe.id]) + '</h3><ol>' + recipe.sequence.map((id, i) => '<li><b>' + (i + 1) + '</b>' + icon(id) + label(FOOD[id]) + '</li>').join("") + '</ol><p>' +
        (unlocked ? pair("Served " + profile.recipeServes[recipe.id] + " times", "已完成 " + profile.recipeServes[recipe.id] + " 次") : pair("Unlock after " + recipe.unlockAt + " dishes · " + (recipe.unlockAt - profile.totalServed) + " to go", "累計完成 " + recipe.unlockAt + " 份解鎖・還差 " + (recipe.unlockAt - profile.totalServed) + " 份")) + '</p></article>';
    }).join("") + '</div>';
}
function preparation(k) {
  const rows = prepPlan(S.model.stations, k);
  return '<h3>' + pair("Prep for both customers", "一起準備兩位客人的食材") + '</h3><p class="kq-note">' + pair("Check both plates before starting a batch. The numbered recipes still decide the order.", "先看兩份餐點再備料，放食材的順序仍要照食譜。") + '</p>' +
    (rows.length ? '<div class="kq-prep-table"><table><thead><tr><th>' + pair("Food", "食材") + '</th><th>' + pair("Needed", "還需要") + '</th><th>' + pair("Ready", "備好了") + '</th><th>' + pair("Preparing", "準備中") + '</th><th>' + pair("Prep next", "再準備") + '</th></tr></thead><tbody>' + rows.map(row => {
      const station = row.ingredient === "patty" ? "grill" : row.ingredient === "lasagna" ? "oven" : "board";
      return '<tr data-ingredient="' + row.ingredient + '" data-shortage="' + row.missing + '" data-preparing="' + row.cooking + '"><th>' + icon(row.ingredient) + label(FOOD[row.ingredient]) + '</th><td>' + row.needed + '</td><td>' + row.ready + '</td><td>' + row.cooking + '</td><td>' + button("tab:" + station, pair(String(row.missing), row.missing ? "去準備" : "看工作台")) + '</td></tr>' +
        (row.reserved || row.retry ? '<tr class="kq-reserved"><td colspan="5">' + (row.retry ? pair(row.retry + " reserved patties need a retry at the grill.", row.retry + " 份預留肉排需要回煎鍋重做。") : pair(row.reserved + " patties are already reserved for these plates.", "這兩份餐點已預留 " + row.reserved + " 份肉排，記得翻面並取出。")) + '</td></tr>' : "");
    }).join("") + '</tbody></table></div>' : '<p class="kq-prep-clear">' + pair("No more preparation needed. Finish both numbered recipes, then serve!", "暫時不用再備料，照順序完成兩份食譜，再上菜！") + '</p>') +
    '<p class="kq-note">' + pair("Preparing food still needs finishing and collecting. Extras on a plate can be removed and reused.", "準備中的食材還需要完成並取出。盤子上多放的食材可以移除再用。") + '</p>';
}

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
function notice(en, zh) {
  const el = S.root.querySelector(".kq-notice");
  el.textContent = en + " · " + zh;
}
function sound(name) { if (S.ctx.sfx && S.ctx.sfx[name]) S.ctx.sfx[name](); }
function activeHint() {
  const m = S.model, report = m.evaluation();
  if (m.phase === "serving") return ["Delicious! Thank you, chef!", "好好吃！謝謝小廚師！"];
  if (m.waiting) return ["A new customer is coming. Time to prep!", "新客人快來了，先準備食材吧！"];
  if (m.layers.some(l => l.pending)) return ["A patty is on the grill. Flip, then collect.", "肉排正在煎，翻面後記得取出。"];
  if (report.correct) return ["Ready to serve!", "可以上菜囉！"];
  const step = report.steps[report.firstMismatch];
  if (step.status === "wrong" || step.status === "extra") return ["Tap the wrong layer to remove it.", "點選放錯的食材，就能移除。"];
  return ["Next: " + FOOD[step.required][0], "下一步：" + FOOD[step.required][1]];
}
function customers() {
  return S.model.stations.map(st => {
    const title = RECIPES[st.order.recipe.id], n = st.slot + 1;
    let status = st.evaluation.matchedPrefix + " / " + st.order.recipe.sequence.length;
    if (st.phase === "serving") status = "Thank you! · 謝謝！";
    if (st.phase === "waiting") status = "Next · 下一位 " + seconds(st.waitRemaining) + "s";
    return button("order:" + st.slot, '<b class="kq-seat">' + n + '</b><span class="kq-customer-copy">' + label(title) + (st.order.request ? '<em class="kq-request-small">' + REQUESTS[st.order.request].join(" · ") + '</em>' : "") + '</span><b class="kq-progress">' + status + '</b>',
      'class="kq-customer" aria-pressed="' + (st.slot === S.model.activeSlot) + '" aria-label="Customer ' + n + ' 客人 ' + n + ', ' + title.join(" ") + (st.order.request ? ', ' + REQUESTS[st.order.request].join(" ") : "") + '"');
  }).join("");
}
function ticket() {
  const m = S.model, report = m.evaluation();
  const rows = m.order.recipe.sequence.map((id, i) => {
    const layer = m.layers[i], status = layer && layer.pending ? "pending" : report.steps[i].status;
    const detail = status === "matched" ? ["Added", "已加入"] : status === "pending" ? ["On the grill", "煎肉排中"] : status === "wrong" ? ["Check this layer", "看看這一層"] : i === report.firstMismatch ? ["Add next", "下一個"] : ["Then", "接著"];
    return '<li class="' + status + '"><b>' + (i + 1) + '</b>' + icon(id) + '<span>' + label(FOOD[id]) + '<em>' + detail.join(" · ") + '</em></span></li>';
  }).join("");
  return '<div class="kq-ticket-heading"><span>' + pair("ORDER " + (m.activeSlot + 1), "第 " + (m.activeSlot + 1) + " 位客人") + '</span>' + button("read", pair("Listen", "聽食譜"), 'class="kq-listen"') + '</div>' +
    '<h3>' + label(RECIPES[m.order.recipe.id]) + '</h3>' + (m.order.request ? '<p class="kq-request">' + label(REQUESTS[m.order.request]) + '</p>' : "") + '<ol>' + rows + '</ol><p>' + pair("Follow the steps in order.", "照順序加入食材。") + '</p>';
}
function heatButton(action, job, oven) {
  const wording = job.phase === "empty" && oven ? ["Bake tray", "放進烤箱"] : HEAT[job.phase];
  const timed = !["empty", "burnt"].includes(job.phase);
  return button(action, label(wording) + (timed ? '<b class="kq-timer">' + seconds(job.remaining) + 's</b>' : ""),
    'class="kq-heat ' + job.phase + '" data-job="' + job.id + '"' + (["side-one", "side-two", "baking"].includes(job.phase) ? " disabled" : ""));
}
function workbench(k) {
  if (S.panel === "plan") return preparation(k);
  if (S.panel === "plate") {
    const layers = S.model.layers;
    return '<div class="kq-layer-heading">' + pair("Your plate · tap a layer to remove", "你的餐盤・點食材可移除") + '</div><div class="kq-layers">' +
      (layers.length ? layers.map(l => button("remove:" + l.id, icon(l.pending ? "patty-raw" : l.ingredient) + label(l.pending ? ["Grilling", "煎肉排中"] : FOOD[l.ingredient]), 'aria-label="Remove ' + FOOD[l.ingredient][0] + ' 移除' + FOOD[l.ingredient][1] + '"')).join("") : '<p>' + pair("A fresh plate. Start with step 1.", "空盤子準備好了，從第一步開始。") + '</p>') + '</div>';
  }
  if (S.panel === "grill") return '<div class="kq-pans">' + k.grill.map((job, i) => '<section><h3>' + pair("Pan " + (i + 1), "平底鍋 " + (i + 1)) + '</h3>' + icon(job.phase === "side-one" ? "patty-raw" : "patty") + heatButton("grill:" + i, job, false) +
    '<p>' + (job.targetOrderId ? pair("Reserved for an order", "這份留給客人") : pair("Cook two for the pantry", "煎兩份，備好食材")) + '</p></section>').join("") + '</div><p class="kq-note">' + pair("Flip when ready, then collect. Game timers only.", "時間到就翻面，再取出。這是遊戲時間。") + '</p>';
  if (S.panel === "board") return '<div class="kq-board-select">' + ["tomato", "lettuce"].map(id => button("board:" + id, icon(id) + label(FOOD[id]), 'aria-pressed="' + (k.board.ingredient === id) + '"')).join("") + '</div><div class="kq-chop">' +
    button("board:cut", icon(k.board.ingredient) + pair("Chop " + k.board.cuts + " / " + k.board.required, "切菜 " + k.board.cuts + " / " + k.board.required), 'class="kq-primary"') + button("board:reset", pair("Reset board", "重設砧板")) + '</div><p class="kq-note">' + pair("One batch makes 6 portions.", "每批可準備 6 份食材。") + '</p>';
  return '<p class="kq-note">' + pair("Layer these six ingredients, then bake.", "照順序疊好六層，再放進烤箱。") + '</p><ol class="kq-lasagna-recipe">' + LASAGNA_STEPS.map((id, i) => '<li class="' + (k.lasagnaLayers[i] === id ? "matched" : "") + '">' + (i + 1) + icon(id) + label(FOOD[id]) + '</li>').join("") + '</ol><div class="kq-oven-add">' +
    ["pasta", "sauce", "cheese"].map(id => button("lasagna:add:" + id, icon(id) + label(FOOD[id]), 'data-revision="' + k.trayRevision + '"')).join("") + '</div><div class="kq-tray">' +
    (k.lasagnaLayers.length ? k.lasagnaLayers.map((id, i) => button("lasagna:remove:" + i, (i + 1) + ". " + label(FOOD[id]), 'data-revision="' + k.trayRevision + '" aria-label="Remove layer ' + (i + 1) + ' 移除第 ' + (i + 1) + ' 層"')).join("") : '<span>' + pair("Empty baking tray", "空烤盤") + '</span>') + '</div><div class="kq-oven-bottom">' + heatButton("oven", k.oven, true) + button("lasagna:clear", pair("Clear tray", "清空烤盤"), 'data-revision="' + k.trayRevision + '"') + '</div>';
}
function pantry(k) {
  return ["patty", "cheese", "tomato", "lettuce", "pickles", "sauce", "lasagna"].map((id, i) => {
    const direct = id === "patty" && k.stock.patty === 0, name = direct ? "patty-raw" : id;
    const count = Object.hasOwn(k.stock, id) ? k.stock[id] : null;
    const unavailable = count === 0 && !direct;
    const stock = direct ? pair("To the grill", "放上煎鍋") : count === null ? pair("Pantry", "隨時可用") : pair(count + " ready", "備好 " + count + " 份");
    return button(direct ? "cookPatty" : "add:" + id, '<kbd>' + (i + 1) + '</kbd>' + icon(name) + '<b>' + label(FOOD[name]) + '</b><span class="kq-stock">' + stock + '</span>', 'class="kq-food' + (unavailable ? " empty" : "") + '"');
  }).join("");
}
function render() {
  if (!S) return;
  const m = S.model, k = m.kitchen.snapshot();
  html(".kq-customers", customers());
  html(".kq-ticket", ticket());
  if (S.ticketOrderId !== m.order.id) {
    S.root.querySelector(".kq-ticket").scrollTop = 0;
    S.ticketOrderId = m.order.id;
  }
  html(".kq-bench", workbench(k));
  html(".kq-pantry", pantry(k));
  html(".kq-career", career());
  html(".kq-hint", label(activeHint()));
  html(".kq-score", pair("Served " + m.ordersServed + " · Best " + S.best, "已上菜 " + m.ordersServed + "・最佳 " + S.best));
  html(".kq-pace", label(m.difficulty === "easy" ? ["Take your time", "慢慢來就好"] : k.pace === "rush" ? ["Busy kitchen", "客人變多囉"] : ["Time to prepare", "準備食材時間"]));
  const alerts = k.grill.filter(j => j.phase === "flip" || j.phase === "ready" || j.phase === "burnt").length;
  html('.kq-tabs [data-action="tab:grill"]', pair("Grill" + (alerts ? " · " + alerts : ""), "煎鍋"));
  S.root.querySelector('.kq-tabs [data-action="tab:grill"]').classList.toggle("attention", alerts > 0);
  S.root.querySelectorAll(".kq-tabs [data-action^='tab:']").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.action === "tab:" + S.panel)));
  S.root.querySelectorAll("[data-action^='difficulty:']").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.action === "difficulty:" + m.difficulty)));
  S.root.querySelector('[data-action="serve"]').disabled = m.phase !== "editing";
  S.root.querySelector('[data-action="serve"]').classList.toggle("ready", m.evaluation().correct);
  S.root.dataset.panel = S.panel;
  draw();
}
function draw() {
  if (!S) return;
  drawKitchen(S.canvas, { layers: S.model.layers, stations: S.model.stations, kitchen: S.model.kitchen.snapshot(), activeSlot: S.model.activeSlot,
    paused: S.paused || !!S.model.pendingMode || S.dialog === "book", time: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : S.model.kitchen.clock, kidColor: S.ctx.kids[S.ctx.kid].color });
}
function modal(kind) {
  const dialog = S.root.querySelector("dialog");
  S.scheduler.pause();
  S.last = 0;
  S.dialog = kind; dialog.dataset.kind = kind;
  dialog.setAttribute("aria-label", kind === "book" ? "Your cookbook 你的食譜本" : "Kitchen paused 廚房暫停");
  dialog.innerHTML = kind === "book" ? cookbook() : kind === "pause" ? '<h2>' + pair("Kitchen paused", "廚房暫停中") + '</h2><p>' + pair("Your dishes and timers can wait.", "餐點和計時都會等你。") + '</p>' + button("pause", pair("Keep cooking", "繼續料理"), 'class="kq-primary"') :
    '<h2>' + pair("Start a fresh shift?", "開始新的料理時間？") + '</h2><p>' + pair("Both dishes and prepared food will reset. Your cookbook, goals and best stay saved.", "兩份餐點和備料會重設，食譜、挑戰進度和最佳紀錄會保留。") + '</p><div>' + button("confirm:no", pair("Keep cooking", "繼續這一局"), 'autofocus') + button("confirm:yes", pair("Start fresh", "重新開始"), 'class="kq-primary"') + '</div>';
  if (!dialog.open) dialog.showModal();
  draw();
}
function pause() {
  if (!S || S.paused) return;
  S.paused = true;
  S.covered = false;
  S.touchTarget = null;
  if (!S.model.pendingMode && S.dialog !== "book") modal("pause");
  else S.scheduler.pause();
}
function resume() {
  S.paused = false;
  S.dialog = null;
  S.last = 0;
  S.root.querySelector("dialog").close();
  S.scheduler.resume();
  render();
}
function perform(action, target) {
  if (!S || S.covered) return;
  const m = S.model;
  if (action === "book:close") {
    if (S.dialog !== "book") return;
    if (S.paused) modal("pause"); else resume();
    return;
  }
  if (action === "pause") { if (m.pendingMode || S.dialog === "book") return; if (S.paused) resume(); else pause(); return; }
  if (action.indexOf("confirm:") === 0) {
    m.confirmMode(action === "confirm:yes");
    S.root.querySelector("dialog").close();
    S.dialog = null;
    if (S.paused) modal("pause"); else { S.last = 0; S.scheduler.resume(); }
    render(); return;
  }
  if (S.paused || m.pendingMode || S.dialog === "book") return;
  if (action === "book") { modal("book"); return; }
  if (action.indexOf("difficulty:") === 0) {
    if (m.requestDifficulty(action.slice(11)) === "confirm") modal("mode");
  } else if (action.indexOf("tab:") === 0) {
    S.panel = action.slice(4);
    S.root.querySelector(".kq-bench").scrollTop = 0;
  }
  else if (action.indexOf("order:") === 0) m.selectOrder(Number(action.slice(6)));
  else if (action === "read") {
    const recipe = RECIPES[m.order.recipe.id], steps = m.order.recipe.sequence;
    const request = m.order.request ? REQUESTS[m.order.request] : ["", ""];
    S.ctx.say([recipe[0], request[0], steps.map(id => FOOD[id][0]).join(", ")].filter(Boolean).join(". "), "en-US");
    S.ctx.say([recipe[1], request[1], steps.map(id => FOOD[id][1]).join("、")].filter(Boolean).join("。"), "zh-TW", true);
  } else if (/^(grill:|board:|lasagna:|oven$)/.test(action)) {
    const data = target && target.dataset || {};
    const result = m.kitchenAction(action, "k" + ++S.serial, m.session, data.job === undefined ? undefined : Number(data.job), data.revision === undefined ? undefined : Number(data.revision));
    notice(...kitchenMessage(result.message));
    if (result.ok) sound(result.sound === "collect" ? "good" : "pop");
  } else {
    const parts = action.split(":"), type = parts[0];
    if (type === "add" && FOOD[parts[1]] && m.kitchen.available(parts[1]) === 0) {
      S.panel = parts[1] === "lasagna" ? "oven" : "board";
      if (parts[1] === "tomato" || parts[1] === "lettuce") m.kitchenAction("board:" + parts[1], "k" + ++S.serial, m.session);
      notice(...REJECT.stock); render(); return;
    }
    if (!["add", "cookPatty", "remove", "undo", "clear", "serve"].includes(type)) return;
    if (type === "add" && !FOOD[parts[1]]) return;
    const result = m.apply({ id: "p" + ++S.serial, session: m.session, orderId: m.order.id, type, ingredient: parts[1], layerId: Number(parts[1]) });
    if (result.type === "reject") notice(...REJECT[result.reason]);
    else if (result.type === "mismatch") { notice(...activeHint()); S.panel = "plate"; }
    else if (result.type === "serve") {
      S.best = Math.max(S.best, m.ordersServed);
      saveProfile();
      S.ctx.finish({ score: m.ordersServed });
      sound("win"); notice("Delicious! Thank you, chef!", "好好吃！謝謝小廚師！");
      if (result.progress.completedShift) notice("Shift complete! Your next cooking challenge is ready.", "料理挑戰完成！下一個挑戰準備好了。");
      if (result.progress.unlocked.length) notice("New recipe: " + result.progress.unlocked.map(id => RECIPES[id][0]).join(", "), "新食譜：" + result.progress.unlocked.map(id => RECIPES[id][1]).join("、"));
    } else {
      if (result.type === "cook") S.panel = "grill";
      if (result.type === "clear") notice("Fresh plate. Ingredients returned to stock.", "換好盤子，食材已放回備料架。 ");
      else if (result.type === "undo") notice("Layer removed. Your other ingredients stay.", "已移除這一層，其他食材都還在。 ");
      else notice(...activeHint());
      sound("pop");
    }
  }
  render();
}
function keys(e) {
  if (!S || S.covered || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (!S.root.contains(e.target) && e.target.closest && e.target.closest("button,a,[role=button],[contenteditable=true]")) return;
  let action;
  const focused = e.target.closest && e.target.closest(".kq button");
  if ((e.key === " " || e.key === "Enter") && focused) action = focused.dataset.action;
  else if (e.key === "Escape" && (S.paused || S.model.pendingMode || S.dialog === "book")) action = S.dialog === "book" ? "book:close" : S.model.pendingMode ? "confirm:no" : "pause";
  else if (e.key === "Enter") action = "serve";
  else if (/^[1-7]$/.test(e.key)) action = S.root.querySelectorAll(".kq-food")[Number(e.key) - 1].dataset.action;
  else action = { q: "order:0", w: "order:1", g: "tab:grill", b: "tab:board", o: "tab:oven", a: "tab:plate", r: "tab:plan", h: "book", u: "undo", p: "pause" }[e.key.toLowerCase()];
  if (!action) return;
  e.preventDefault(); e.stopPropagation();
  if (!e.repeat && !(focused && focused.disabled)) perform(action, focused);
}
function init(ctx) {
  stop();
  const root = document.createElement("section"); root.className = "kq"; root.dataset.version = "0.7.0"; root.setAttribute("aria-label", "Kitchen Quest 廚房冒險");
  root.innerHTML = '<link rel="stylesheet" href="' + new URL("../../css/kitchen-quest.css", import.meta.url).href + '">' +
    '<header class="kq-top"><div><h2>' + pair("KITCHEN QUEST <i>0.7</i>", "廚房冒險") + '</h2><span class="kq-score"></span></div><div class="kq-mode">' + button("difficulty:easy", pair("Very easy", "輕鬆玩")) + button("difficulty:standard", pair("Kitchen shift", "廚房輪班")) + '</div>' + button("book", pair("Cookbook", "食譜本")) + button("pause", pair("Pause", "暫停")) + '</header><section class="kq-career" aria-label="Cooking progress 料理進度"></section>' +
    '<div class="kq-customers" role="group" aria-label="Choose a customer 選擇客人"></div>' +
    '<div class="kq-work"><aside class="kq-ticket"></aside><div class="kq-workspace"><nav class="kq-tabs" aria-label="Kitchen stations 料理工作台">' + [["plate", "Plate", "餐盤"], ["grill", "Grill", "煎鍋"], ["board", "Chop", "砧板"], ["oven", "Oven", "烤箱"], ["plan", "Prep", "備料"]].map(t => button("tab:" + t[0], pair(t[1], t[2]))).join("") + '</nav><div class="kq-scene"><canvas width="' + WIDTH + '" height="' + HEIGHT + '" role="img" aria-label="Pixel diner showing your customers and dish 像素餐廳裡的客人和料理"></canvas><span class="kq-pace"></span></div><div class="kq-bench"></div></div></div>' +
    '<div class="kq-pantry" role="group" aria-label="Ingredients 食材"></div><footer class="kq-bottom"><div class="kq-hint"></div><div class="kq-actions">' + button("undo", pair("Undo", "上一步")) + button("clear", pair("Clear plate", "清空餐盤")) + button("serve", pair("Serve", "上菜"), 'class="kq-primary"') + '</div></footer><p class="kq-notice" role="status" aria-live="polite"></p><dialog class="kq-dialog" aria-label="Kitchen paused 廚房暫停"></dialog>';
  const saved = ctx.settings.kitchen && ctx.settings.kitchen.profiles && ctx.settings.kitchen.profiles[ctx.kid];
  const model = new KitchenModel(29813, true, true, normalizeProfile(saved, ctx.best)); model.requestDifficulty("easy");
  S = { root, ctx, model, canvas: root.querySelector("canvas"), scheduler: createScheduler(), paused: false, dialog: null, panel: "plate", best: Number(ctx.best) || 0, serial: 0, last: 0, drawn: 0 };
  saveProfile();
  ctx.mount.classList.add("kq-stage"); ctx.mount.appendChild(root); ctx.hud([]);
  root.addEventListener("pointerdown", e => {
    const target = e.target.closest("button[data-action]");
    if (!target || target.disabled || e.button !== 0) return;
    if (e.pointerType === "touch" || e.pointerType === "pen") { S.touchTarget = target; return; }
    e.preventDefault(); target.focus({ preventScroll: true }); perform(target.dataset.action, target);
  });
  root.addEventListener("pointerup", () => { if (S) S.touchTarget = null; });
  root.addEventListener("pointercancel", () => { if (S) S.touchTarget = null; });
  root.addEventListener("click", e => {
    const target = e.target.closest("button[data-action]");
    // Native touch clicks are cancelled by scrolling; mouse controls still respond on press.
    if ((e.detail === 0 || e.pointerType === "touch" || e.pointerType === "pen") && target && !target.disabled) perform(target.dataset.action, target);
  });
  root.querySelector("dialog").addEventListener("cancel", e => { e.preventDefault(); perform(S.dialog === "book" ? "book:close" : S.model.pendingMode ? "confirm:no" : "pause"); });
  document.addEventListener("keydown", keys, true);
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("blur", pause);
  window.addEventListener("summerquest:native-pause", pause);
  render(); notice("Choose a customer. Follow their recipe. No customer deadlines.", "選一位客人，照食譜料理。客人會耐心等你。");
  S.scheduler.frame(time => {
    if (!S || S.paused || S.model.pendingMode || S.dialog === "book") return;
    if (ctx.isOverlayOpen && ctx.isOverlayOpen()) { S.covered = true; S.last = 0; return; }
    if (S.covered) { S.covered = false; pause(); return; }
    const dt = S.last ? Math.min(.05, (time - S.last) / 1000) : 0; S.last = time;
    const events = model.kitchen.advance(dt); model.advanceServices(dt);
    if (events.length) {
      const event = events[0];
      notice(...(event.type === "flip" ? ["Time to flip a patty!", "肉排可以翻面了！"] : event.type === "ready" ? ["Ready! Collect your food.", "做好了！把食物取出吧。"] : ["Try a fresh batch. The other food is safe.", "再試一批，其他食材都還在。"]));
      sound("pop");
    }
    if (time - S.drawn >= 100 || events.length) { S.drawn = time; render(); }
  });
}
function visibility() { if (document.hidden) pause(); }
function stop() {
  if (!S) return;
  S.scheduler.cancelAll();
  document.removeEventListener("keydown", keys, true);
  document.removeEventListener("visibilitychange", visibility);
  window.removeEventListener("blur", pause);
  window.removeEventListener("summerquest:native-pause", pause);
  S.root.querySelector("dialog").close(); S.root.remove(); S.ctx.mount.classList.remove("kq-stage"); S = null;
}
export default {
  id: "kitchen", version: "0.7.0", keyboard: false, bestKey: "kitchen",
  meta: { icon: "🍳", title: "Kitchen Quest", tz: "廚房冒險", blurb: "Cook & serve · 料理上菜" },
  init, stop,
  snapshot() { return S ? Object.assign(S.model.snapshot(), { paused: S.paused || !!S.covered || !!S.model.pendingMode || S.dialog === "book", dialog: S.dialog, panel: S.panel, best: S.best }) : null; }
};
