/* Change Maker — Corner Shop (slice 35; 35-change-maker-pilot.md).
   Tot: two-coin comparison, no drawer/tray. Mid/hard: shop counter with a
   register, cash drawer and change tray built on the pixel-art atlas already
   generated for the pilot (assets/brain/sprites/change.png, provenance in
   assets/brain/SPRITE-PROMPTS.md). Only "apple" has a generated product sprite;
   every other SHOP_PRODUCTS entry uses the documented CSS fallback card
   (guidelines §13: "missing product SVG symbol falls back... play continues"). */

var COIN_FRAMES = { 1: 0, 5: 1, 10: 2, 50: 3 };
var NOTE_FRAMES = { 100: 0, 500: 1 };

/* Pure view-model: DOM is always rendered FROM this, never the source of truth
   (35-change-maker-pilot.md "Scene-local model"). Exported for node tests. */
export function createMoneyTray(denominations) {
  var allowed = {};
  (denominations || []).forEach(function (d) { allowed[d] = true; });
  var pieces = [];

  function add(value) {
    if (!allowed[value]) return false;
    pieces.push(value);
    return true;
  }
  function undo() {
    if (!pieces.length) return null;
    return pieces.pop();
  }
  function clear() { pieces.length = 0; }
  function total() { return pieces.reduce(function (s, v) { return s + v; }, 0); }
  function groups() {
    var counts = {};
    pieces.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
    return Object.keys(counts).map(Number).sort(function (a, b) { return b - a; })
      .map(function (v) { return { value: v, count: counts[v], subtotal: v * counts[v] }; });
  }
  function serialize() { return String(total()); }

  return {
    add: add, undo: undo, clear: clear, total: total, groups: groups, serialize: serialize,
    get pieces() { return pieces.slice(); }
  };
}

function productPictureHtml(item) {
  var id = item.prompt.productId, name = item.prompt.productName;
  if (id === "apple") {
    return '<div class="brain-change__picture"><span class="brain-sprite sprite-apple" role="img" aria-label="' + name[0] + ' ' + name[1] + '"></span></div>';
  }
  return '<div class="brain-change__picture"><span class="brain-change__name">' + name[0] + '<br>' + name[1] + '</span></div>';
}

function tokenHtml(value) {
  var isNote = value >= 100;
  var frame = isNote ? NOTE_FRAMES[value] : COIN_FRAMES[value];
  return '<button class="brain-change__token" type="button" data-v="' + value + '" ' +
    'aria-label="Add NT$' + value + ' ' + (isNote ? '加' + value + '元鈔票' : '加' + value + '元硬幣') + '">' +
    '<span class="brain-sprite ' + (isNote ? 'sprite-note' : 'sprite-coin') + '" style="--sprite-frame:' + frame + '"></span>' +
    '<span>NT$' + value + '</span></button>';
}

function trayHtml(tray) {
  var groups = tray.groups();
  if (!groups.length) return '<span class="brain-change__tray-empty">Empty tray 空托盤</span>';
  return groups.map(function (g) {
    return '<div class="brain-change__tray-group">' +
      'NT$' + g.value + (g.count > 1 ? '<small>&times;' + g.count + '</small>' : '') +
      '</div>';
  }).join("");
}

function create(ctx) {
  var tray = null;
  var currentItem = null;
  var inputEnabled = false;
  var announceCancel = null;
  var pendingSubmit = false;

  function root() { return ctx.mount; }

  function scheduleAnnounce() {
    if (announceCancel) announceCancel();
    announceCancel = ctx.scheduler.after(250, function () {
      announceCancel = null;
      ctx.announce(["Your change " + tray.total(), "你找的錢 " + tray.total()]);
    });
  }

  /* ---------- tot: coin comparison, no drawer/tray ---------- */
  function presentTot(item) {
    root().innerHTML =
      '<div class="brain-task-card brain-change__tot">' +
      '<div class="brain-generic__sub">Which is worth more?<span class="zhs">哪個比較多錢？</span></div>' +
      '<div class="brain-change__coins">' +
      item.prompt.coins.map(function (v) {
        return '<button class="brain-change__token" type="button" style="--sprite-zoom:2" data-v="' + v + '" aria-label="NT$' + v + '">' +
          '<span class="brain-sprite sprite-coin" style="--sprite-frame:' + COIN_FRAMES[v] + '"></span><span>NT$' + v + '</span></button>';
      }).join("") +
      '</div></div>';
    root().querySelectorAll(".brain-change__token").forEach(function (b) {
      b.disabled = true;
      b.onclick = function () { if (inputEnabled && !pendingSubmit) { pendingSubmit = true; ctx.submit(b.dataset.v); } };
    });
    return Promise.resolve();
  }

  function feedbackTot(feedback) {
    var buttons = root().querySelectorAll(".brain-change__token");
    buttons.forEach(function (b) { b.disabled = true; });
    var correctBtn = root().querySelector('.brain-change__token[data-v="' + feedback.answer + '"]');
    if (feedback.correct) {
      if (correctBtn) ctx.motion.move(correctBtn, [{ transform: "translateY(0)" }, { transform: "translateY(-6px)" }], "snap");
      return null;
    }
    if (correctBtn) ctx.motion.emphasize(correctBtn, "outline");
    return new Promise(function (resolve) { ctx.scheduler.after(700, resolve); });
  }

  /* ---------- mid/hard: shop counter ---------- */
  function shopHtml(item) {
    var p = item.prompt;
    var tiles = p.denominations.map(tokenHtml).join("");
    return '<div class="brain-change__awning"></div>' +
      '<div class="brain-change__customer" aria-hidden="true"></div>' +
      '<div class="brain-change__summary">' +
        '<div class="brain-change__panel brain-change__product">' +
          productPictureHtml(item) +
          '<div><div class="brain-change__price">NT$' + p.price + '</div>' +
            '<div class="brain-generic__sub">' + p.productName[0] + '<span class="zhs">' + p.productName[1] + '</span></div></div>' +
        '</div>' +
        '<div class="brain-change__panel brain-change__register">' +
          '<div class="brain-change__display">NT$' + p.paid + ' &minus; NT$' + p.price + '</div>' +
          '<div class="brain-change__register-label">Register 收銀機</div>' +
        '</div>' +
        '<div class="brain-change__panel brain-change__payment">' +
          '<div class="brain-generic__sub">Paid<span class="zhs">已付</span></div>' +
          '<div class="brain-change__paid">NT$' + p.paid + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="brain-change__work">' +
        '<div class="brain-change__till-col">' +
          '<div class="brain-change__label"><span>Cash drawer<span class="zhs"> 收銀抽屜</span></span></div>' +
          '<div class="brain-change__till" data-drawer="closed">' +
            '<span class="brain-sprite sprite-till" style="--sprite-frame:0"></span>' +
            '<div class="brain-change__till-display">NT$' + p.paid + '</div>' +
            '<div class="brain-change__till-drawer">' + tiles + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="brain-change__tray-col">' +
          '<div class="brain-change__label"><span>Your change<span class="zhs"> 你找的錢</span></span>' +
            '<output class="brain-change__tray-total">NT$0</output></div>' +
          '<div class="brain-tray brain-change__tray"><div class="brain-change__tray-groups"></div></div>' +
        '</div>' +
        '<div class="brain-change__actions-col brain-change__actions">' +
          '<button class="brain-button" type="button" data-act="undo">Undo <span class="zht">上一步</span></button>' +
          '<button class="brain-button" type="button" data-act="clear">Clear tray <span class="zht">清空托盤</span></button>' +
          '<button class="brain-button brain-button--give" type="button" data-act="give">Give change <span class="zht">找錢</span></button>' +
        '</div>' +
      '</div>';
  }

  function renderTray() {
    var groupsEl = root().querySelector(".brain-change__tray-groups");
    var totalEl = root().querySelector(".brain-change__tray-total");
    if (!groupsEl || !totalEl) return;
    groupsEl.innerHTML = trayHtml(tray);
    totalEl.textContent = "NT$" + tray.total();
    var last = groupsEl.lastElementChild;
    if (last) ctx.motion.move(last, [{ transform: "scale(.85)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], "move");
    var giveBtn = root().querySelector('[data-act="give"]');
    if (giveBtn) giveBtn.disabled = !inputEnabled || tray.total() === 0;
  }

  function wireShop(item) {
    root().querySelectorAll(".brain-change__token").forEach(function (b) {
      b.disabled = !inputEnabled;
      b.onclick = function () {
        if (!inputEnabled) return;
        var value = Number(b.dataset.v);
        if (!tray.add(value)) return;
        var cue = value >= 100 ? "note-place" : "coin-" + value;
        ctx.audio.play(cue, { rate: 1 + ((tray.pieces.length % 3) - 1) * 0.03 });
        renderTray();
        scheduleAnnounce();
        b.focus();
      };
    });
    var undoBtn = root().querySelector('[data-act="undo"]');
    var clearBtn = root().querySelector('[data-act="clear"]');
    var giveBtn = root().querySelector('[data-act="give"]');
    if (undoBtn) undoBtn.onclick = function () {
      if (!inputEnabled) return;
      if (tray.undo() != null) { ctx.audio.play("token-pick", {}); renderTray(); scheduleAnnounce(); }
    };
    if (clearBtn) clearBtn.onclick = function () {
      if (!inputEnabled || !tray.pieces.length) return;
      tray.clear(); ctx.audio.play("token-pick", {}); renderTray(); scheduleAnnounce();
      var firstToken = root().querySelector(".brain-change__token");
      if (firstToken) firstToken.focus();
    };
    if (giveBtn) giveBtn.onclick = function () {
      if (!inputEnabled || pendingSubmit || tray.total() === 0) return;
      pendingSubmit = true;
      ctx.submit(tray.serialize());
    };
  }

  function openDrawer() {
    var till = root().querySelector(".brain-change__till");
    if (!till) return Promise.resolve();
    ctx.audio.play("drawer-open", {});
    till.setAttribute("data-drawer", "open");
    var sprite = till.querySelector(".brain-sprite");
    if (ctx.reducedMotion) { if (sprite) sprite.style.setProperty("--sprite-frame", "2"); return Promise.resolve(); }
    if (sprite) {
      sprite.style.setProperty("--sprite-frames", "3");
      sprite.style.setProperty("--sprite-duration", ctx.motion.tokens.reveal + "ms");
      sprite.classList.add("brain-sprite--play");
    }
    return new Promise(function (resolve) { ctx.scheduler.after(ctx.motion.tokens.reveal, resolve); });
  }

  function presentShop(item) {
    root().innerHTML = '<div class="brain-change">' + shopHtml(item) + '</div>';
    tray = createMoneyTray(item.prompt.denominations);
    wireShop(item);
    renderTray();
    var panels = root().querySelectorAll(".brain-change__panel");
    var kf = ctx.reducedMotion
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ transform: "translateY(12px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }];
    panels.forEach(function (p, i) { ctx.motion.move(p, kf, "reveal"); });
    return openDrawer();
  }

  function feedbackShop(feedback) {
    var trayEl = root().querySelector(".brain-change__tray");
    var giveBtn = root().querySelector('[data-act="give"]');
    if (giveBtn) giveBtn.disabled = true;
    root().querySelectorAll(".brain-change__token,[data-act]").forEach(function (b) { b.disabled = true; });
    if (feedback.correct) {
      if (trayEl) trayEl.classList.add("is-success");
      ctx.audio.play("stamp", { when: 0.3 });
      return new Promise(function (resolve) { ctx.scheduler.after(ctx.motion.tokens.celebrate, resolve); });
    }
    if (trayEl) trayEl.classList.add("is-hint");
    var display = root().querySelector(".brain-change__display");
    if (display) display.textContent = "Count NT$" + feedback.answer;
    ctx.announce(["Count NT$" + feedback.answer, "數一數 NT$" + feedback.answer]);
    ctx.audio.play("paper-slide", {});
    return new Promise(function (resolve) { ctx.scheduler.after(900, resolve); });
  }

  function present(item, view) {
    currentItem = item;
    pendingSubmit = false;
    var tot = item.prompt.mode === "compare";
    return (tot ? presentTot(item) : presentShop(item));
  }

  function setInputEnabled(enabled) {
    inputEnabled = !!enabled;
    var tot = currentItem && currentItem.prompt.mode === "compare";
    if (tot) {
      root().querySelectorAll(".brain-change__token").forEach(function (b) { b.disabled = !inputEnabled; });
      return;
    }
    root().querySelectorAll(".brain-change__token,[data-act='undo'],[data-act='clear']").forEach(function (b) { b.disabled = !inputEnabled; });
    var giveBtn = root().querySelector('[data-act="give"]');
    if (giveBtn) giveBtn.disabled = !inputEnabled || !tray || tray.total() === 0;
  }

  function showFeedback(feedback) {
    var tot = currentItem && currentItem.prompt.mode === "compare";
    return tot ? feedbackTot(feedback) : feedbackShop(feedback);
  }

  function destroy() {
    if (announceCancel) { announceCancel(); announceCancel = null; }
    currentItem = null;
    tray = null;
    root().innerHTML = "";
  }

  return { present: present, setInputEnabled: setInputEnabled, showFeedback: showFeedback, destroy: destroy };
}

export default { id: "change", renderer: "dom", create: create };
