/* Word Wizard 🧙 文字巫師 — migrated from index.html:1595-1821 (slice 19).
   Two modes: study (copy/recall/translate/sentences) and shop (timed potion shop).
   Word mastery persists in C.vocab and is saved via C.saveProgress. */
var S = null, C = null;

var CUSTOMERS = ["🧙","🧝","🧛","🧚","🤴","👸","🧟","🥷","🧑‍🚀","🦹"];

var SENT = [
 ["i want water","💧","je veux de l'eau","我想要水"],
 ["i like pizza","🍕","j'aime la pizza","我喜歡披薩"],
 ["she likes cats","🐱","elle aime les chats","她喜歡貓"],
 ["he plays football","⚽","il joue au foot","他踢足球"],
 ["we go to school","🏫","nous allons à l'école","我們去上學"],
 ["i can swim","🏊","je sais nager","我會游泳"],
 ["the dog is big","🐶","le chien est grand","這隻狗很大"],
 ["the cat is small","🐈","le chat est petit","這隻貓很小"],
 ["i am happy","😊","je suis content","我很開心"],
 ["i am hungry","🍽️","j'ai faim","我肚子餓"],
 ["where is mom","👩","où est maman","媽媽在哪裡"],
 ["i want to sleep","😴","je veux dormir","我想睡覺"],
 ["it is raining","🌧️","il pleut","下雨了"],
 ["the sun is hot","☀️","le soleil est chaud","太陽很熱"],
 ["open the door","🚪","ouvre la porte","開門"],
 ["close the window","🪟","ferme la fenêtre","關窗戶"],
 ["wash your hands","🧼","lave tes mains","洗手"],
 ["i love you","❤️","je t'aime","我愛你"],
 ["good morning","🌅","bonjour","早安"],
 ["good night","🌙","bonne nuit","晚安"],
 ["happy birthday","🎂","joyeux anniversaire","生日快樂"],
 ["take a bath","🛁","prends un bain","洗澡"],
 ["brush your teeth","🪥","brosse tes dents","刷牙"],
 ["come here","👋","viens ici","過來"],
 ["stop that","🛑","arrête ça","停止"],
 ["be careful","⚠️","fais attention","小心"],
 ["i am sorry","🙏","je suis désolé","對不起"],
 ["thank you","🙇","merci","謝謝"],
 ["you are welcome","🤗","de rien","不客氣"],
 ["see you later","👋","à plus tard","再見"],
 ["what is your name","🪪","comment tu t'appelles","你叫什麼名字"],
 ["my name is","🏷️","je m'appelle","我的名字是"],
 ["how are you","👋","comment ça va","你好嗎"],
 ["how much","💰","combien ça coûte","多少錢"],
 ["what time is it","🕐","quelle heure est-il","現在幾點"],
 ["let's go","🚶","allons-y","我們走吧"],
 ["i am cold","🥶","j'ai froid","我很冷"],
 ["turn left","👈","tourne à gauche","左轉"],
 ["turn right","👉","tourne à droite","右轉"],
 ["sit down","🪑","assieds-toi","坐下"],
 ["stand up","🧍","lève-toi","站起來"],
 ["what is this","❓","qu'est-ce que c'est","這是什麼"],
 ["who is it","👤","qui est-ce","是誰"],
 ["can i play","🎮","je peux jouer","我可以玩嗎"],
 ["do you want water","🚰","veux-tu de l'eau","你要喝水嗎"],
 ["where is my bag","🎒","où est mon sac","我的書包在哪裡"],
 ["why are you sad","😢","pourquoi es-tu triste","你為什麼難過"],
 ["when do we eat","🥄","quand mange-t-on","我們什麼時候吃飯"]
];

/* ---- shared helpers ---- */
function vLevel() {
  return (C.settings.vocab.levels[C.kid] || "copy");
}

function vPool() {
  return vLevel() === "sentences" ? SENT : C.words.all;
}

function vKey(w) {
  return (vLevel() === "sentences" ? "s:" : "w:") + w;
}

function vBox(w) {
  return C.vocab[vKey(w)] || 0;
}

function vMastered(w) {
  return vBox(w) >= 2;
}

function packStats() {
  var P = vPool();
  return { done: P.filter(function (w) { return vMastered(w[0]); }).length, total: P.length };
}

function buildVocabQueue() {
  var P = vPool();
  var fresh = C.shuffle(P.filter(function (w) { return !vMastered(w[0]); }));
  var review = C.shuffle(P.filter(function (w) { return vMastered(w[0]); }));
  return fresh.concat(review);
}

function pickPrompt(lvl) {
  if (lvl === "copy" || lvl === "recall") return "pic";
  var r = Math.random();
  if (lvl === "sentences") return r < 0.6 ? "fr" : "both";
  return r < 0.4 ? "fr" : r < 0.7 ? "pic" : "both";
}

function vocabSpans() {
  var w = S.word;
  return w.split("").map(function (c, i) {
    if (i < S.pos) return '<span class="done">' + (c === " " ? "&nbsp;" : c) + '</span>';
    var shown = i < S.revealed;
    var cls = (i === S.pos) ? (S.wrong ? "bad cur" : "cur") : (shown ? "hintl" : "todo");
    if (c === " ") return '<span class="' + cls + '">&nbsp;&nbsp;</span>';
    return '<span class="' + cls + '">' + (shown ? c : "_") + '</span>';
  }).join("");
}

function redrawVocabWord() {
  var el = document.getElementById("vword"); if (el) el.innerHTML = vocabSpans();
  highlightVocab();
}

function highlightVocab() {
  if (S.pos < S.revealed) C.keys.highlight(S.word[S.pos]);
  else C.keys.highlightSet([]);
}

function vocabHud() {
  var st = packStats();
  C.hud([
    { k: vLevel() === "sentences" ? "Sentences" : "Words", v: st.done + "/" + st.total, c: C.kids[C.kid].raw },
    { k: "Streak", v: S.streak },
    { k: "Stars", v: C.stars }
  ]);
}

/* ---- Study mode ---- */
function drawVocab() {
  var lvl = vLevel();
  var showPic = (S.prompt !== "fr");
  var showFr = ((lvl === "translate" || lvl === "sentences") && S.prompt !== "pic");
  var wstyle = S.word.length > 14 ? 'style="font-size:clamp(22px,4.6vw,36px);letter-spacing:1px"' : "";
  var got = vPool().filter(function (w) { return vMastered(w[0]); }).map(function (w) { return w[1]; });
  var shelf = got.slice(0, 28).join("") + (got.length > 28 ? " +" + (got.length - 28) : "");
  var cue = lvl === "copy" ? "Type the word you see!"
    : lvl === "recall" ? "What is it in English?"
    : lvl === "sentences" ? "Say it in English! \ud83d\udcac"
    : "Type it in English!";
  C.stage.innerHTML =
    '<div class="game-scene game-scene--vocab">'
    + '<div class="game-scene__center">'
    + '<div class="cue">' + cue + '</div>'
    + (showPic ? '<div class="word-em" style="font-size:56px">' + S.em + '</div>' : '')
    + (showFr ? '<div class="vfr">' + S.fr + '</div><div class="vzh">' + S.zh + '</div>' : '')
    + '<div class="word" id="vword" ' + wstyle + '>' + vocabSpans() + '</div>'
    + '<div class="msg" id="msg"></div>'
    + '<div class="vrow">'
    + '<button class="btn small" id="sayBtn">\ud83d\udde3\ufe0f Say it</button>'
    + (lvl !== "copy" ? '<button class="btn small" id="hintBtn">\ud83d\udca1 Hint</button>' : '')
    + '</div>'
    + '<div class="vshelf"><span class="lbl">YOUR COLLECTION</span>' + (shelf || "\u2026") + '</div>'
    + '</div>'
    + '</div>';
  document.getElementById("sayBtn").onclick = function () { C.say(S.word); };
  var hb = document.getElementById("hintBtn");
  if (hb) hb.onclick = function () {
    S.hintUsed = true;
    var r = Math.max(S.revealed, S.pos);
    do { r++; } while (r < S.word.length && S.word[r - 1] === " ");
    S.revealed = Math.min(r, S.word.length);
    C.say(S.word);
    redrawVocabWord();
  };
  highlightVocab();
}

function nextVocab() {
  if (S.qi >= S.queue.length) { S.queue = buildVocabQueue(); S.qi = 0; }
  var entry = S.queue[S.qi];
  var en = entry[0], em = entry[1], fr = entry[2], zh = entry[3];
  var lvl = vLevel();
  S.word = en; S.em = em; S.fr = fr; S.zh = zh || ""; S.pos = 0; S.wrong = false;
  S.firstTry = true; S.hintUsed = false;
  S.revealed = (lvl === "copy") ? en.length : 0;
  S.prompt = pickPrompt(lvl);
  drawVocab(); vocabHud();
  if (lvl === "copy") C.say(en);
}

function vocabComplete() {
  var success = S.firstTry && !S.hintUsed;
  var k = vKey(S.word), was = vMastered(S.word);
  C.vocab[k] = success ? Math.min(vBox(S.word) + 1, 3) : Math.max(vBox(S.word) - 1, 0);
  var now = vMastered(S.word);
  S.streak = success ? S.streak + 1 : 0;
  C.say(S.word); C.sfx.win(); C.fx.burst(12); C.fx.flash("ok");
  if (now && !was) {
    S.sessionMastered++;
    C.fx.bigFloat(S.em);
  }
  C.saveProgress();
  if (!success) {
    S.queue.splice(S.qi + 3, 0, [S.word, S.em, S.fr, S.zh]);
  }
  S.qi++;
  S.timeout = setTimeout(nextVocab, 650);
}

/* ---- Shop mode (timed potion shop) ---- */
function initShop() {
  S = { hp: 3, score: 0, served: 0, streak: 0, running: true, raf: null, timeout: null };
  nextCustomer();
}

function shopDur() {
  var lvl = vLevel();
  var base = lvl === "copy" ? 12 : lvl === "recall" ? 14 : lvl === "sentences" ? 26 : 16;
  return base * (1.4 - C.settings.vocab.speed * 0.15) * 1000;
}

function nextCustomer() {
  var entry = C.rand(vPool());
  var en = entry[0], em = entry[1], fr = entry[2], zh = entry[3];
  var lvl = vLevel();
  S.word = en; S.em = em; S.fr = fr; S.zh = zh || ""; S.pos = 0; S.wrong = false; S.firstTry = true;
  S.revealed = (lvl === "copy") ? en.length : 0; S.hintUsed = false;
  S.prompt = pickPrompt(lvl);
  S.cust = C.rand(CUSTOMERS);
  S.custStart = performance.now(); S.dur = shopDur();
  drawShop(); shopHud();
  if (lvl === "copy") C.say(en);
  if (!S.raf) S.raf = requestAnimationFrame(shopLoop);
}

function drawShop() {
  var lvl = vLevel();
  var showPic = (S.prompt !== "fr");
  var showFr = ((lvl === "translate" || lvl === "sentences") && S.prompt !== "pic");
  var wstyle = S.word.length > 14 ? 'style="font-size:clamp(22px,4.6vw,36px);letter-spacing:1px"' : "";
  var bub = [showPic ? S.em : "", showFr ? S.fr : "", lvl === "copy" ? S.word : ""]
    .filter(Boolean).join("  ");
  C.stage.innerHTML =
    '<div class="game-scene game-scene--vocab game-scene--vocab-shop">'
    + '<div class="game-scene__center">'
    + '<div class="cue">Serve the customer before they leave! \u2697\ufe0f</div>'
    + '<div class="word-em" style="font-size:54px">' + S.cust + '</div>'
    + '<div class="vbubble">' + bub + (showFr ? '<div class="vzh">' + S.zh + '</div>' : '') + '</div>'
    + '<div class="pbar"><div class="pfill" id="pfill" style="width:100%"></div></div>'
    + '<div class="word" id="vword" ' + wstyle + '>' + vocabSpans() + '</div>'
    + '<div class="msg" id="msg"></div>'
    + '</div>'
    + '</div>';
  highlightVocab();
}

function shopHud() {
  var hp = Math.max(S.hp, 0);
  C.hud([
    { k: "Lives", v: hp > 0 ? "\u2764\ufe0f".repeat(hp) : "\ud83d\udc80", c: S.hp <= 1 ? "var(--bad)" : C.kids[C.kid].raw },
    { k: "Score", v: S.score },
    { k: "Served", v: S.served },
    { k: "Best", v: C.best }
  ]);
}

function shopLoop(now) {
  if (!S.running) return;
  var left = 1 - ((now - S.custStart) / S.dur);
  var f = document.getElementById("pfill");
  if (f) {
    f.style.width = Math.max(left * 100, 0) + "%";
    f.style.background = left < 0.3 ? "var(--bad)" : left < 0.6 ? "var(--gold)" : "var(--ok)";
  }
  if (left <= 0) {
    S.hp--; C.sfx.hit(); C.fx.flash("bad");
    var k = vKey(S.word);
    C.vocab[k] = Math.max(vBox(S.word) - 1, 0); C.saveProgress();
    shopHud();
    if (S.hp <= 0) { finishShop(); return; }
    C.fx.hint('It was "' + S.word + '" — ' + S.em + ' ' + S.fr + "\u30fb" + S.zh);
    C.say(S.word);
    S.timeout = setTimeout(function () { if (S && S.running) nextCustomer(); }, 1400);
    S.custStart = now + 999999;
  }
  S.raf = requestAnimationFrame(shopLoop);
}

function shopComplete() {
  var left = Math.max(1 - ((performance.now() - S.custStart) / S.dur), 0);
  var pts = S.word.length * 10 + Math.round(left * 20);
  S.score += pts; S.served++;
  var k = vKey(S.word);
  C.vocab[k] = Math.min(vBox(S.word) + 1, 3);
  C.finish({ score: S.score });
  C.say(S.word); C.sfx.win(); C.fx.burst(12); C.fx.flash("ok");
  shopHud();
  S.custStart = performance.now() + 999999;
  S.timeout = setTimeout(function () { if (S && S.running) nextCustomer(); }, 600);
}

function finishShop() {
  if (!S || !S.running) return;
  S.running = false;
  if (S.raf) { cancelAnimationFrame(S.raf); S.raf = null; }
  var prevBest = C.best || 0;
  var isBest = S.score >= prevBest && S.score > 0;
  C.finish({ score: S.score });
  C.fx.burst(40);
  var ov = document.createElement("div"); ov.className = "overlay";
  ov.innerHTML = '<div class="card">'
    + '<h3 style="color:' + C.kids[C.kid].color + '">' + (isBest ? "\ud83c\udfc6 New best!" : "\u2697\ufe0f Shop closed!") + '</h3>'
    + '<div class="big" style="color:' + C.kids[C.kid].color + '">' + S.score + '</div>'
    + '<p>points \u00b7 ' + S.served + ' customers served' + (isBest ? '' : ' \u00b7 best ' + prevBest) + '</p>'
    + '<button class="btn" id="shopAgain" style="background:' + C.kids[C.kid].raw + ';color:#1c1436">Open again \u2697\ufe0f</button>'
    + '<button class="btn small" id="shopHome" style="margin-left:8px">Heroes</button>'
    + '</div>';
  document.body.appendChild(ov);
  ov.querySelector("#shopAgain").onclick = function () { ov.remove(); initShop(); };
  ov.querySelector("#shopHome").onclick = function () {
    ov.remove();
    var backBtn = document.getElementById("back");
    if (backBtn) backBtn.click();
  };
}

/* ---- input (both modes) ---- */
function key(ch) {
  if (!S) return;
  if (!S.running && C.settings.vocab.mode === "shop") return;
  if (S.word == null || S.pos >= S.word.length) return;
  if (ch === S.word[S.pos]) {
    S.pos++; S.wrong = false; C.sfx.good();
    redrawVocabWord();
    if (S.pos >= S.word.length) {
      if (C.settings.vocab.mode === "shop") shopComplete(); else vocabComplete();
    }
  } else {
    S.wrong = true; S.firstTry = false; C.sfx.bad(); C.fx.flash("bad");
    redrawVocabWord();
    C.fx.hint(C.settings.vocab.mode === "shop" ? "Oops, try again!" : "Not quite — \ud83d\udca1 Hint can help!");
  }
}

function init(ctx) {
  C = ctx;
  if (C.settings.vocab.mode === "shop") { initShop(); return; }
  S = { queue: buildVocabQueue(), qi: 0, streak: 0, sessionMastered: 0, running: true, timeout: null };
  nextVocab();
}

function stop() {
  if (!S) return;
  S.running = false;
  if (S.raf) { cancelAnimationFrame(S.raf); S.raf = null; }
  if (S.timeout) { clearTimeout(S.timeout); S.timeout = null; }
  S = null;
}

function settings(bar, ctx) {
  var s = ctx.settings.vocab;
  var lvl = s.levels[ctx.kid] || "copy";
  var M = [["study", "\ud83e\uddd8 Study"], ["shop", "\u2697\ufe0f Potion Shop"]];
  var L = [["copy", "\u270d\ufe0f Copy"], ["recall", "\ud83e\udde0 Recall"], ["translate", "\ud83c\uddeb\u2192\ud83c\uddec Translate"], ["sentences", "\ud83d\udcac Sentences"]];
  bar.innerHTML = '';

  var modeDiv = document.createElement("div"); modeDiv.className = "grp dchips";
  M.forEach(function (d) {
    var btn = document.createElement("button");
    btn.className = "chip" + (s.mode === d[0] ? " on" : "");
    btn.setAttribute("data-m", d[0]);
    if (s.mode === d[0]) btn.style.background = ctx.kids[ctx.kid].raw;
    btn.textContent = d[1];
    btn.onclick = function () {
      s.mode = d[0]; ctx.saveSettings(); ctx.restart();
    };
    modeDiv.appendChild(btn);
  });
  bar.appendChild(modeDiv);

  var lvlDiv = document.createElement("div"); lvlDiv.className = "grp dchips";
  L.forEach(function (d) {
    var btn = document.createElement("button");
    btn.className = "chip" + (lvl === d[0] ? " on" : "");
    btn.setAttribute("data-lv", d[0]);
    if (lvl === d[0]) btn.style.background = ctx.kids[ctx.kid].raw;
    btn.textContent = d[1];
    btn.onclick = function () {
      s.levels[ctx.kid] = d[0]; ctx.saveSettings(); ctx.restart();
    };
    lvlDiv.appendChild(btn);
  });
  bar.appendChild(lvlDiv);

  if (s.mode === "shop") {
    var spdGrp = document.createElement("span"); spdGrp.className = "grp";
    spdGrp.innerHTML = "\ud83d\udc22 Speed ";
    var spdInput = document.createElement("input");
    spdInput.type = "range"; spdInput.id = "setSpeed"; spdInput.min = "1"; spdInput.max = "5"; spdInput.value = s.speed;
    spdGrp.appendChild(spdInput);
    var spdVal = document.createElement("span"); spdVal.className = "val"; spdVal.id = "vSpeed"; spdVal.textContent = s.speed;
    spdGrp.appendChild(spdVal);
    spdGrp.appendChild(document.createTextNode(" \ud83d\udc07"));
    spdInput.oninput = function () {
      s.speed = +spdInput.value; spdVal.textContent = spdInput.value; ctx.saveSettings();
    };
    bar.appendChild(spdGrp);
  }

  var ttsBtn = document.createElement("button");
  ttsBtn.className = "chip" + (s.tts ? " on" : ""); ttsBtn.id = "ttsBtn";
  if (s.tts) ttsBtn.style.background = ctx.kids[ctx.kid].raw;
  ttsBtn.textContent = "\ud83d\udde3\ufe0f Voice";
  ttsBtn.onclick = function () {
    s.tts = !s.tts; ctx.saveSettings();
    settings(bar, ctx);
  };
  var ttsGrp = document.createElement("div"); ttsGrp.className = "grp";
  ttsGrp.appendChild(ttsBtn);
  bar.appendChild(ttsGrp);
}

export default {
  id: "vocab",
  meta: { icon: "\ud83e\uddd9", title: "Word Wizard", tz: "\u6587\u5b57\u5deb\u5e2b", blurb: "Learn English words" },
  keyboard: true,
  bestKey: "shop",
  init: init,
  key: key,
  settings: settings,
  stop: stop,
  debugState: function () { return S; }
};
