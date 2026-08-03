/* Math Recall: answer the old value, remember the new one.
   The data/scoring already builds the dependent item chain; this scene only
   makes that chain visible for kids. */

export function recallView(item) {
  var first = !item.answer;
  var prompt = item.prompt || {};
  var fresh = String(item.shown || "");
  var expr = String(prompt.en || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (expr.indexOf(" = ?") >= 0) expr = expr.replace(" = ?", " = " + fresh);
  else if (expr.indexOf("Remember:") === 0) expr = fresh;
  else if (!expr) expr = fresh;
  return {
    first: first,
    oldValue: first ? "" : String(item.answer),
    freshValue: fresh,
    freshText: expr
  };
}

function keyButton(v, cls) {
  return '<button class="brain-key ' + (cls || "") + '" type="button" data-v="' + v + '">' + v + '</button>';
}

function choicesHtml(item) {
  return '<div class="brain-recall__choices">' + (item.choices || []).map(function (c) {
    return keyButton(c, "brain-recall__choice");
  }).join("") + '</div>';
}

function keypadHtml() {
  return '<div class="brain-recall__entry" aria-live="polite">&nbsp;</div>' +
    '<div class="brain-recall__keypad">' +
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"].map(function (k) {
      return keyButton(k, "");
    }).join("") + '</div>';
}

function layoutHtml(item, pad, entry) {
  var v = recallView(item);
  if (v.first) {
    return '<div class="brain-recall brain-recall--first">' +
      '<section class="brain-recall__panel brain-recall__panel--new">' +
        '<div class="brain-recall__label">Look and remember<span class="zhs">先看，記住</span></div>' +
        '<div class="brain-recall__sum">' + v.freshText + '</div>' +
      '</section>' +
      '<button class="brain-button brain-button--primary brain-recall__next" type="button" data-next="1">Next <span class="zht">下一題</span></button>' +
      '<div class="brain-corrective" hidden></div>' +
    '</div>';
  }
  return '<div class="brain-recall">' +
    '<section class="brain-recall__panel brain-recall__panel--old">' +
      '<div class="brain-recall__label">Answer now<span class="zhs">現在回答</span></div>' +
      '<div class="brain-recall__old-value">' + v.oldValue + '</div>' +
      '<div class="brain-recall__hint">Tap the old answer<span class="zhs">點上一題答案</span></div>' +
    '</section>' +
    '<section class="brain-recall__panel brain-recall__panel--new">' +
      '<div class="brain-recall__label">Remember next<span class="zhs">下一題要記住</span></div>' +
      '<div class="brain-recall__sum">' + v.freshText + '</div>' +
    '</section>' +
    '<section class="brain-recall__answer">' +
      (pad === "choice" ? choicesHtml(item) : keypadHtml(entry)) +
    '</section>' +
    '<div class="brain-corrective" hidden></div>' +
  '</div>';
}

function padTypeFor(ctx) {
  var D = window.SQBrainData;
  var g = D.GAMES[ctx.gameId];
  var cfg = g && g.tiers[ctx.tier];
  return cfg ? cfg.pad : "choice";
}

function create(ctx) {
  var pad = padTypeFor(ctx);
  var entry = "";
  var currentItem = null;
  var inputEnabled = false;
  var pendingSubmit = false;

  function root() { return ctx.mount; }

  function renderEntry() {
    var box = root().querySelector(".brain-recall__entry");
    if (box) box.innerHTML = entry === "" ? "&nbsp;" : entry;
  }

  function submit(v) {
    if (pendingSubmit) return;
    pendingSubmit = true;
    ctx.submit(v);
  }

  function press(v) {
    if (!inputEnabled) return;
    if (currentItem && !currentItem.answer) { submit(""); return; }
    if (pad === "choice") { submit(v); return; }
    if (v === "⌫") { entry = entry.slice(0, -1); renderEntry(); return; }
    if (v === "✓") { if (entry !== "") submit(entry); return; }
    if (entry.length >= 4) return;
    entry += v;
    renderEntry();
  }

  function wire() {
    root().querySelectorAll(".brain-key,[data-next]").forEach(function (b) {
      b.disabled = !inputEnabled;
      b.onclick = function () { press(b.dataset.v || ""); };
    });
  }

  function present(item) {
    currentItem = item;
    entry = "";
    pendingSubmit = false;
    root().innerHTML = layoutHtml(item, pad, entry);
    wire();
  }

  function setInputEnabled(enabled) {
    inputEnabled = !!enabled;
    root().querySelectorAll(".brain-key,[data-next]").forEach(function (b) { b.disabled = !inputEnabled; });
  }

  function showFeedback(feedback) {
    root().querySelectorAll(".brain-key,[data-next]").forEach(function (b) { b.disabled = true; });
    if (feedback.correct) return null;
    var panel = root().querySelector(".brain-corrective");
    var old = root().querySelector(".brain-recall__old-value");
    if (old) ctx.motion.emphasize(old, "outline");
    if (panel) {
      panel.hidden = false;
      panel.innerHTML = 'Old answer: <b>' + feedback.answer + '</b><span class="zhs">上一題答案：' + feedback.answer + '</span>';
    }
    return new Promise(function (resolve) { ctx.scheduler.after(900, resolve); });
  }

  function destroy() {
    currentItem = null;
    root().innerHTML = "";
  }

  return { present: present, setInputEnabled: setInputEnabled, showFeedback: showFeedback, destroy: destroy };
}

export default { id: "recall", renderer: "dom", create: create };
