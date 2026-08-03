/* Generic Brain scene (implementation-guidelines.md §12.4 task 6).
   Behavior-equivalent port of the old inline prompt/pad rendering from
   js/brain-ui.js, now behind the scene contract. This is the fallback every
   game uses until its bespoke scene ships (slice 36-37), and the safety net a
   bespoke scene falls back to if it throws (guidelines §13). Gameplay parity is
   the acceptance bar here, not new visual design. */

var COLORS = {
  red: ["#e5484d", "Red", "紅色"], blue: ["#3b82f6", "Blue", "藍色"],
  green: ["#22c55e", "Green", "綠色"], yellow: ["#eab308", "Yellow", "黃色"],
  purple: ["#a855f7", "Purple", "紫色"], black: ["#111827", "Black", "黑色"]
};

function clockSvg(h, m) {
  var ha = (h % 12) * 30 + m * 0.5 - 90, ma = m * 6 - 90, R = Math.PI / 180;
  var hx = 50 + 25 * Math.cos(ha * R), hy = 50 + 25 * Math.sin(ha * R);
  var mx = 50 + 39 * Math.cos(ma * R), my = 50 + 39 * Math.sin(ma * R);
  var ticks = "";
  for (var i = 0; i < 12; i++) {
    var a = i * 30 - 90;
    ticks += '<circle cx="' + (50 + 42 * Math.cos(a * R)) + '" cy="' + (50 + 42 * Math.sin(a * R)) + '" r="2" fill="currentColor"/>';
  }
  return '<svg viewBox="0 0 100 100" class="bclockface" aria-hidden="true" width="140" height="140">' +
    '<circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="3"/>' + ticks +
    '<line class="bclockface__hand bclockface__hand--minute" x1="50" y1="50" x2="' + mx + '" y2="' + my + '" stroke="#ffc93c" stroke-width="3" stroke-linecap="round"/>' +
    '<line class="bclockface__hand bclockface__hand--hour" x1="50" y1="50" x2="' + hx + '" y2="' + hy + '" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>' +
    '<circle cx="50" cy="50" r="3.5" fill="#ffc93c" stroke="currentColor" stroke-width="1.5"/></svg>';
}

function promptHtml(p) {
  if (p.type === "emoji") return '<div class="brain-generic__task">' + p.en + '</div>';
  if (p.type === "swatch") return '<div class="brain-generic__swatch" style="background:' + COLORS[p.ink][0] + '"></div>';
  if (p.type === "colorword") return '<div class="brain-generic__task" style="color:' + COLORS[p.ink][0] + '">' + p.word + '</div>';
  if (p.type === "countfield") return '<div class="brain-generic__field">' + p.glyphs.join("") + '</div>' + sub(p);
  if (p.type === "clockface") return clockSvg(p.h, p.m) + sub(p);
  if (p.type === "money") return '<div class="brain-generic__task">' + (p.art || "") + '</div>' + sub(p);
  if (p.type === "gridflash") return '<div class="brain-generic__grid" data-role="grid"></div>' + sub(p);
  if (p.type === "wordlist") return '<div class="brain-generic__words" data-role="words"></div>' + sub(p);
  return '<div class="brain-generic__task">' + p.en + '</div>';
}
function sub(p) {
  return '<div class="brain-generic__sub">' + p.en + '<span class="zhs">' + p.zh + '</span></div>';
}

function padHtml(pad, entry) {
  if (pad === "grid") {
    return '<div class="brain-generic__entry">' + (entry === "" ? "&nbsp;" : entry.split(",").join(" · ")) + '</div>' +
      '<div class="brain-generic__grid" data-role="gridpad"></div>';
  }
  if (pad === "type") {
    return '<textarea class="brain-generic__type" data-role="type" rows="3" placeholder="Type the words 打出單字"></textarea>' +
      '<div class="brain-generic__bpmfpad" data-role="bpmfpad"></div>' +
      '<button class="brain-key" data-v="✓">Done 完成</button>';
  }
  if (pad === "keypad") {
    var keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"];
    return '<div class="brain-generic__entry">' + (entry === "" ? "&nbsp;" : entry) + '</div>' +
      '<div class="brain-generic__keypad">' + keys.map(function (k) {
        return '<button class="brain-key" data-v="' + k + '">' + k + '</button>';
      }).join("") + '</div>';
  }
  return '<div class="brain-generic__choices" data-role="choices"></div>';
}

function choiceButtonsHtml(item) {
  return (item.choices || []).map(function (c) {
    if (item.choiceStyle === "swatch") {
      return '<button class="brain-key brain-key--swatch" data-v="' + c + '" style="background:' + COLORS[c][0] + '" aria-label="' + COLORS[c][1] + '"></button>';
    }
    var label = COLORS[c] ? COLORS[c][1] + " " + COLORS[c][2] : c;
    return '<button class="brain-key" data-v="' + c + '">' + label + '</button>';
  }).join("");
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

  function root() { return ctx.mount; }
  function isBopomofoType() { return pad === "type" && ctx.inputScript === "bpmf" && ctx.bopomofo; }

  function renderEntry() {
    var box = root().querySelector(".brain-generic__entry");
    if (box) box.innerHTML = pad === "grid" ? (entry === "" ? "&nbsp;" : entry.split(",").join(" · ")) : (entry === "" ? "&nbsp;" : entry);
  }

  function submitValue(v) {
    ctx.submit(v);
  }

  function press(v) {
    if (pad === "choice") { submitValue(v); return; }
    if (v === "⌫") { entry = entry.slice(0, -1); renderEntry(); return; }
    if (v === "✓") { if (entry === "") return; submitValue(entry); return; }
    if (entry.length >= 4) return;
    entry += v; renderEntry();
  }
  function syncTextarea() {
    var ta = root().querySelector('[data-role="type"]');
    if (ta) ta.value = entry;
  }
  function pressType(v) {
    if (v === "⌫") entry = Array.from(entry).slice(0, -1).join("");
    else if (v === "空格") entry += " ";
    else entry += v;
    syncTextarea();
  }

  function wireKeys() {
    root().querySelectorAll(".brain-key").forEach(function (b) {
      b.disabled = !inputEnabled;
      b.onclick = function () { if (inputEnabled) press(b.dataset.v); };
    });
  }

  function mountChoices(item) {
    var host = root().querySelector('[data-role="choices"]');
    if (!host) return;
    host.innerHTML = choiceButtonsHtml(item);
    wireKeys();
  }

  function mountGrid(item) {
    var host = root().querySelector('[data-role="grid"]');
    var padHost = root().querySelector('[data-role="gridpad"]');
    if (!host || !padHost) return;
    var cells = item.prompt.cells;
    host.innerHTML = cells.map(function (c) { return '<span class="brain-generic__cell">' + c.n + '</span>'; }).join("");
    padHost.innerHTML = "";
    ctx.scheduler.after(item.prompt.flashMs, function () {
      if (!currentItem || currentItem !== item) return;
      host.innerHTML = cells.map(function () { return '<span class="brain-generic__cell is-hidden">?</span>'; }).join("");
      var C = window.SQBrainCore;
      var shuffled = C.seededShuffle(cells, ctx.random);
      padHost.innerHTML = shuffled.map(function (c) {
        return '<button class="brain-key" data-v="' + c.n + '">' + c.n + '</button>';
      }).join("");
      padHost.querySelectorAll(".brain-key").forEach(function (b) {
        b.onclick = function () {
          if (!inputEnabled) return;
          b.disabled = true; b.classList.add("is-used");
          entry = entry === "" ? b.dataset.v : entry + "," + b.dataset.v;
          renderEntry();
          if (entry.split(",").length === cells.length) submitValue(entry);
        };
      });
    });
  }

  function mountWords(item) {
    var host = root().querySelector('[data-role="words"]');
    if (!host) return;
    host.innerHTML = item.prompt.words.map(function (w) { return '<span class="brain-generic__word">' + w + '</span>'; }).join("");
    var ta = root().querySelector('[data-role="type"]');
    if (ta) { ta.disabled = true; ta.dataset.studying = "1"; }
    ctx.scheduler.after(item.prompt.studyMs, function () {
      if (!currentItem || currentItem !== item) return;
      if (item.choices) {
        host.innerHTML = item.prompt.words
          .filter(function (w) { return w !== item.answer; })
          .map(function (w) { return '<span class="brain-generic__word">' + w + '</span>'; }).join("") +
          '<span class="brain-generic__word is-hidden">？</span>';
        mountChoices(item);
        return;
      }
      host.innerHTML = '<span class="brain-generic__sub">' +
        (isBopomofoType() ? "Now type the Bopomofo 現在打出注音" : "Now type what you remember 現在打出你記得的") +
        '</span>';
      var box = root().querySelector('[data-role="type"]');
      if (box) { delete box.dataset.studying; box.disabled = false; box.focus(); }
      root().querySelectorAll(".brain-key").forEach(function (b) { b.disabled = false; });
    });
  }
  function mountBopomofoPad() {
    var host = root().querySelector('[data-role="bpmfpad"]');
    if (!host) return;
    if (!isBopomofoType()) { host.hidden = true; return; }
    host.hidden = false;
    host.innerHTML = ctx.bopomofo.ROWS.map(function (row) {
      return '<div class="brain-generic__bpmfrow">' + row.map(function (k) {
        return '<button class="brain-key brain-key--bpmf" type="button" data-v="' + k + '">' + k + '</button>';
      }).join("") + '</div>';
    }).join("") +
      '<div class="brain-generic__bpmfrow">' +
        '<button class="brain-key brain-key--bpmf brain-key--wide" type="button" data-v="空格">空格</button>' +
        '<button class="brain-key brain-key--bpmf" type="button" data-v="⌫">⌫</button>' +
      '</div>';
    host.querySelectorAll(".brain-key--bpmf").forEach(function (b) {
      b.disabled = !inputEnabled;
      b.onclick = function () { if (inputEnabled) pressType(b.dataset.v); };
    });
    var ta = root().querySelector('[data-role="type"]');
    if (ta) ta.setAttribute("inputmode", "none");
  }

  function present(item) {
    currentItem = item; entry = ""; inputEnabled = false;
    root().innerHTML =
      '<div class="brain-task-card brain-generic__prompt">' + promptHtml(item.prompt) + '</div>' +
      '<div class="brain-answer brain-generic__pad">' + padHtml(pad, entry) + '</div>' +
      '<div class="brain-corrective" hidden></div>';
    var ta = root().querySelector('[data-role="type"]');
    if (ta) ta.oninput = function () { entry = ta.value; };
    var doneBtn = root().querySelector('.brain-key[data-v="✓"]');
    if (doneBtn) doneBtn.onclick = function () { if (inputEnabled && entry !== "") submitValue(entry); };

    if (item.prompt.type === "gridflash") mountGrid(item);
    else if (item.prompt.type === "wordlist") mountWords(item);
    else if (pad === "choice") mountChoices(item);
    else wireKeys();
    if (pad === "type") mountBopomofoPad();
  }

  function setInputEnabled(enabled) {
    inputEnabled = !!enabled;
    var ta = root().querySelector('[data-role="type"]');
    var studying = !!(ta && ta.dataset.studying);
    root().querySelectorAll(".brain-key").forEach(function (b) { b.disabled = !inputEnabled || studying; });
    if (ta && !ta.dataset.studying) ta.disabled = !inputEnabled;
  }

  function showFeedback(feedback) {
    root().querySelectorAll(".brain-key").forEach(function (b) { b.disabled = true; });
    if (feedback.correct) return null;
    var panel = root().querySelector(".brain-corrective");
    if (panel) {
      panel.hidden = false;
      panel.innerHTML = '<span>Count</span> <b>' + feedback.answer + '</b><span class="zhs">數一數 ' + feedback.answer + '</span>';
    }
    return new Promise(function (resolve) { ctx.scheduler.after(900, resolve); });
  }

  function destroy() {
    currentItem = null;
    root().innerHTML = "";
  }

  return {
    present: function (item) { present(item); },
    setInputEnabled: setInputEnabled,
    showFeedback: showFeedback,
    destroy: destroy
  };
}

export default { id: "generic", renderer: "dom", create: create };
