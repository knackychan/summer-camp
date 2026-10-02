import { directedVocabularyTarget, languageEntryMatchesSkill, languageSkillDisplayName, vocabularyModeForLanguageSkill } from "../../dist/mobile/packages/learning/src/curriculum/LanguageSkillRules.js";
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
function directedLanguageSkill() {
  return C && C.director && typeof C.director.skill === "string" && C.director.skill.indexOf("language.") === 0 ? C.director.skill : "";
}

function isBopomofo() {
  return !!(C && C.bopomofo && ((C.director && C.director.vocabularyMode === "bopomofo") || C.inputScript === "bpmf"));
}

function vGameMode() {
  return C && C.director && C.director.forceStudy ? "study" : C.settings.vocab.mode;
}

function isPlacementFlow() {
  return !!(C && C.director && C.director.flow === "placement");
}

function vLevel() {
  if (C && C.director && C.director.vocabularyMode) return C.director.vocabularyMode;
  if (isBopomofo()) return "bopomofo";
  return (C.settings.vocab.levels[C.kid] || "copy");
}

function baseVocabPool() {
  if (vLevel() === "bopomofo") return C.words.bopomofo || [];
  if (vLevel() === "sentences") return SENT;
  if (directedLanguageSkill() === "language.initial_sound" || directedLanguageSkill() === "language.word_build.simple") return C.words.easy || C.words.all;
  return C.words.all;
}

function vPool() {
  var base = baseVocabPool() || [];
  var skill = directedLanguageSkill();
  if (!skill) return base;
  var mode = vocabularyModeForLanguageSkill(skill) || vLevel();
  var filtered = base.filter(function (entry) {
    return languageEntryMatchesSkill(skill, {
      mode: mode, target: entry[0], emoji: entry[1], sourceFrench: entry[2], sourceChinese: entry[3]
    });
  });
  return filtered.length ? filtered : base;
}

function vKey(w) {
  if (isBopomofo()) return "b:" + w;
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
  if (C && C.director) return { done: S ? (S.directorDone || 0) : 0, total: S ? (S.directorTarget || P.length) : P.length };
  return { done: P.filter(function (w) { return vMastered(w[0]); }).length, total: P.length };
}

function buildVocabQueue() {
  var P = vPool();
  if (C && C.director) return C.shuffle(P.slice());
  var fresh = C.shuffle(P.filter(function (w) { return !vMastered(w[0]); }));
  var review = C.shuffle(P.filter(function (w) { return vMastered(w[0]); }));
  return fresh.concat(review);
}

function pickPrompt(lvl) {
  if (lvl === "bopomofo") return "zh";
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
    { k: vLevel() === "sentences" ? "Sentences" : vLevel() === "bopomofo" ? "ㄅㄆㄇ" : "Words", v: st.done + "/" + st.total, c: C.kids[C.kid].raw },
    { k: "Streak", v: S.streak },
    { k: "Stars", v: C.stars }
  ]);
}


function escHint(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });
}

function vocabularyLearningInput() {
  return {
    directorRunId: C.director && C.director.directorRunId || undefined,
    attemptId: C.director && C.director.directorRunId ? C.director.directorRunId + ":item-" + ((C.director.completedAttempts || 0) + (S.directorDone || 0)) : undefined,
    mode: vLevel(),
    target: S.word,
    emoji: S.em,
    sourceFrench: S.fr,
    sourceChinese: S.zh,
    promptMode: S.prompt,
    position: S.pos,
    revealed: S.revealed,
    skill: directedLanguageSkill() || ("vocabulary_" + vLevel())
  };
}

function revealNextLocalLetter() {
  var r = Math.max(S.revealed, S.pos);
  do { r++; } while (r < S.word.length && S.word[r - 1] === " ");
  S.revealed = Math.min(r, S.word.length);
  redrawVocabWord();
}

function speakVocabularyTarget() {
  if (vLevel() === "bopomofo" && C.sayZh) C.sayZh(S.fr || S.zh || S.sourceWord || S.word);
  else C.say(S.sourceWord || S.word);
}

function renderVocabularyLearningHint(result) {
  var msg = document.getElementById("msg");
  var presentation = result && result.presentation || {};
  var hint = result && result.hint || {};
  var visual = "";

  if (Number.isFinite(Number(presentation.revealThrough))) {
    S.revealed = Math.max(S.revealed, Math.min(S.word.length, Number(presentation.revealThrough)));
    redrawVocabWord();
  }
  if (presentation.emoji) visual = '<span class="v-ai-hint__visual">' + escHint(presentation.emoji) + '</span>';
  else if (presentation.wordShape) visual = '<span class="v-ai-hint__shape">' + escHint(presentation.wordShape) + '</span>';
  else if (presentation.letter) visual = '<span class="v-ai-hint__letter">' + escHint(presentation.letter) + '</span>';
  else if (presentation.promptCue) visual = '<span class="v-ai-hint__cue">' + escHint(presentation.promptCue) + '</span>';
  else visual = '<span class="v-ai-hint__visual">💡</span>';

  if (presentation.speakTarget) speakVocabularyTarget();
  if (msg) {
    var showText = presentation.showText !== false;
    msg.innerHTML = '<div class="v-ai-hint">' + visual + (showText ? '<div><b>' + escHint(hint.message || "Try one smaller clue.") + '</b><span>' + escHint(hint.messageZh || "先看一個小提示。") + '</span></div>' : '') + '</div>';
  }
}

function requestVocabularyHint(button, intervention) {
  if (!S || S.aiHintBusy) return;
  S.hintUsed = true;
  S.aiHintBusy = true;
  if (button) { button.disabled = true; button.textContent = "💡 Finding clue…"; }
  var input = vocabularyLearningInput(), expectedState = S, expectedContext = C, revision = S.learningRevision;
  function live() { return S === expectedState && C === expectedContext && S.learningRevision === revision && S.running; }
  if (intervention) input.intervention = intervention;

  function fallback() {
    if (!live()) return;
    var msg = document.getElementById("msg");
    if (intervention && intervention.kind === "picture_audio") {
      speakVocabularyTarget();
      if (msg) msg.innerHTML = '<div class="v-ai-hint"><span class="v-ai-hint__visual">' + escHint(S.em || "🔊") + '</span><div><b>Look and listen once more.</b><span>再看一次、再聽一次。</span></div></div>';
      return;
    }
    revealNextLocalLetter();
    speakVocabularyTarget();
    if (msg) msg.innerHTML = '<div class="v-ai-hint"><span class="v-ai-hint__visual">💡</span><div><b>One letter at a time.</b><span>一次看一個字母。</span></div></div>';
  }
  function done() {
    if (!live()) return;
    S.aiHintBusy = false;
    if (button && document.body.contains(button)) { button.disabled = false; button.textContent = "💡 Hint"; }
  }

  if (!C.learning || typeof C.learning.canSupportVocabulary !== "function" || typeof C.learning.getVocabularyHint !== "function") {
    fallback(); done(); return;
  }
  Promise.resolve(C.learning.canSupportVocabulary(input)).then(function (supported) {
    if (!live()) return null;
    if (!supported) { fallback(); return null; }
    return C.learning.getVocabularyHint(input);
  }).then(function (result) {
    if (live() && result) renderVocabularyLearningHint(result);
  }).catch(function () { fallback(); }).finally(done);
}

function rememberVocabularyMistake(kind) {
  if (!S || !kind || kind === "unknown") return;
  var rank = {single_letter_slip:1, repeated_letter_confusion:2, recall_stall:3};
  if (!S.learningMistake || (rank[kind] || 0) >= (rank[S.learningMistake] || 0)) S.learningMistake = kind;
}

function showVocabularyTutorNote(icon, en, zh) {
  var msg = document.getElementById("msg");
  if (!msg) return;
  msg.innerHTML = '<div class="v-ai-hint v-ai-hint--tutor"><span class="v-ai-hint__visual">' + escHint(icon) + '</span><div><b>' + escHint(en) + '</b><span>' + escHint(zh) + '</span></div></div>';
}

function applyVocabularyTutorIntervention(intervention) {
  if (!S || !intervention || !intervention.kind) return;
  rememberVocabularyMistake(intervention.mistake);
  if (intervention.kind === "continue") return;
  if (intervention.kind === "tiny_clue") {
    showVocabularyTutorNote("💡", "Want a tiny clue?", "要一個小提示嗎？");
    var hb = document.getElementById("hintBtn");
    if (hb && hb.animate) hb.animate([{transform:"scale(1)"},{transform:"scale(1.08)"},{transform:"scale(1)"}], {duration:360});
    return;
  }
  S.hintUsed = true;
  if (intervention.kind === "reveal_letter") {
    if (Number.isFinite(Number(intervention.revealThrough))) {
      S.revealed = Math.max(S.revealed, Math.min(S.word.length, Number(intervention.revealThrough)));
      redrawVocabWord();
    } else revealNextLocalLetter();
    showVocabularyTutorNote("🔤", "Let’s lock in this letter, then keep going.", "先記住這個字母，再繼續。");
    return;
  }
  if (intervention.kind === "easier_recall") {
    if (Number.isFinite(Number(intervention.revealThrough))) {
      S.revealed = Math.max(S.revealed, Math.min(S.word.length, Number(intervention.revealThrough)));
      redrawVocabWord();
    }
    if (intervention.speakTarget) speakVocabularyTarget();
    showVocabularyTutorNote(intervention.showPicture && S.em ? S.em : "🪜", "One easier recall step first.", "先用簡單一點的方式回想。");
    S.easyRecallActive = true;
    return;
  }
  if (intervention.kind === "picture_audio") {
    requestVocabularyHint(null, intervention);
  }
}

function maybeApplyVocabularyTutor(typedCharacter, expectedCharacter) {
  if (!S || isPlacementFlow() || vGameMode() === "shop" || vLevel() === "copy" || S.adaptiveBusy) return;
  if (!C.learning || typeof C.learning.getVocabularyIntervention !== "function") return;
  var pos = S.pos;
  S.totalWrongCount = (S.totalWrongCount || 0) + 1;
  S.wrongByPos = S.wrongByPos || {};
  S.wrongByPos[pos] = (S.wrongByPos[pos] || 0) + 1;
  var input = vocabularyLearningInput();
  input.typedCharacter = typedCharacter;
  input.expectedCharacter = expectedCharacter;
  input.wrongCountAtPosition = S.wrongByPos[pos];
  input.totalWrongCount = S.totalWrongCount;
  S.adaptiveBusy = true;
  var expectedState = S, expectedContext = C, revision = S.learningRevision;
  function live() { return S === expectedState && C === expectedContext && S.learningRevision === revision && S.running; }
  Promise.resolve(C.learning.getVocabularyIntervention(input)).then(function (intervention) {
    if (!live()) return;
    applyVocabularyTutorIntervention(intervention);
  }).catch(function () {}).finally(function () { if (live()) S.adaptiveBusy = false; });
}

function recordVocabularyLearningAttempt(success) {
  if (!C.learning || typeof C.learning.recordVocabularyAttempt !== "function") return Promise.resolve(null);
  var input = vocabularyLearningInput();
  input.correct = success === true;
  input.responseMs = S.startedAt ? Math.max(0, Math.round(performance.now() - S.startedAt)) : 0;
  input.hintsUsed = S.hintUsed ? 1 : 0;
  if (S.learningMistake) input.mistake = S.learningMistake;
  return Promise.resolve(C.learning.recordVocabularyAttempt(input)).catch(function () { return null; });
}

/* ---- Study mode ---- */
function drawVocab() {
  var lvl = vLevel();
  var showPic = (S.prompt !== "fr");
  var showFr = lvl === "bopomofo" || ((lvl === "translate" || lvl === "sentences") && S.prompt !== "pic");
  var wstyle = S.word.length > 14 ? 'style="font-size:clamp(22px,4.6vw,36px);letter-spacing:1px"' : "";
  var got = vPool().filter(function (w) { return vMastered(w[0]); }).map(function (w) { return w[1]; });
  var shelf = got.slice(0, 28).join("") + (got.length > 28 ? " +" + (got.length - 28) : "");
  var skill = directedLanguageSkill();
  var cue = skill === "language.initial_sound" ? "Listen, then type the first letter! 🔊"
    : skill === "language.bopomofo.sound_symbol" ? "Listen, then type the first Zhuyin symbol! 🔊"
    : skill === "language.spelling_patterns.basic" ? "Build the word and notice its spelling pattern!"
    : skill === "language.high_frequency.recall" ? "Recall this everyday word!"
    : skill === "language.sentence_patterns.questions" ? "Build the question pattern! 💬"
    : lvl === "copy" ? "Type the word you see!"
    : lvl === "recall" ? "What is it in English?"
    : lvl === "bopomofo" ? "Type the Bopomofo! 打注音！"
    : lvl === "sentences" ? "Say it in English! 💬"
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
    + (lvl !== "copy" && !isPlacementFlow() ? '<button class="btn small" id="hintBtn">\ud83d\udca1 Hint</button>' : '')
    + '</div>'
    + (C.director ? '' : '<div class="vshelf"><span class="lbl">YOUR COLLECTION</span>' + (shelf || "…") + '</div>')
    + '</div>'
    + '</div>';
  document.getElementById("sayBtn").onclick = function () { speakVocabularyTarget(); };
  var hb = document.getElementById("hintBtn");
  if (hb) hb.onclick = function () { requestVocabularyHint(hb); };
  highlightVocab();
}

function nextVocab() {
  S.learningRevision = (S.learningRevision || 0) + 1;
  if (S.qi >= S.queue.length) { S.queue = buildVocabQueue(); S.qi = 0; }
  var entry = S.queue[S.qi];
  var en = entry[0], em = entry[1], fr = entry[2], zh = entry[3];
  var lvl = vLevel(), skill = directedLanguageSkill();
  S.sourceWord = en;
  S.word = skill ? directedVocabularyTarget(skill, en) : en; S.em = em; S.fr = fr; S.zh = zh || ""; S.pos = 0; S.wrong = false;
  S.firstTry = true; S.hintUsed = false; S.aiHintBusy = false; S.adaptiveBusy = false; S.startedAt = performance.now();
  S.totalWrongCount = 0; S.wrongByPos = {}; S.learningMistake = null; S.easyRecallActive = false;
  S.revealed = (lvl === "copy" && skill !== "language.initial_sound") ? S.word.length : 0;
  S.prompt = (skill === "language.initial_sound" || skill === "language.bopomofo.sound_symbol") ? "pic" : pickPrompt(lvl);
  drawVocab(); vocabHud();
  if (lvl === "copy" || skill === "language.initial_sound") speakVocabularyTarget();
  if (lvl === "bopomofo" && C.sayZh) C.sayZh(fr);
}

function vocabComplete() {
  var success = S.firstTry && !S.hintUsed;
  var directed = !!(C && C.director);
  var k = vKey(S.word), was = vMastered(S.word), now = was;
  if (!directed) {
    C.vocab[k] = success ? Math.min(vBox(S.word) + 1, 3) : Math.max(vBox(S.word) - 1, 0);
    now = vMastered(S.word);
  }
  S.streak = success ? S.streak + 1 : 0;
  speakVocabularyTarget();
  C.sfx.win(); C.fx.burst(12); C.fx.flash("ok");
  if (!directed && now && !was) {
    S.sessionMastered++;
    C.fx.bigFloat(S.em);
  }
  if (!directed) C.saveProgress();
  var recordPromise = recordVocabularyLearningAttempt(success);
  if (!directed && !success) {
    S.queue.splice(S.qi + 3, 0, [S.word, S.em, S.fr, S.zh]);
  }
  S.qi++;
  if (C.director) {
    S.directorDone = (S.directorDone || 0) + 1;
    if (S.directorDone >= S.directorTarget) {
      var expectedState = S, expectedContext = C;
      Promise.resolve(recordPromise).finally(function () { if (S === expectedState && C === expectedContext) showDirectorStepComplete(); });
      return;
    }
  }
  S.timeout = setTimeout(nextVocab, 650);
}

function showDirectorStepComplete() {
  if (!S || !C || !C.director) return;
  var placement = isPlacementFlow();
  S.running = false;
  C.stage.innerHTML = '<div class="game-scene game-scene--vocab"><div class="game-scene__center">'
    + '<div class="word-em" style="font-size:64px">' + (placement ? '🧭' : '🎯') + '</div>'
    + '<div class="cue">' + (placement ? 'Quick check step complete!' : 'Smart Practice step complete!') + '</div>'
    + '<div class="vzh">' + (placement ? '這一段能力定位完成了！' : '這一段練習完成了！') + '</div>'
    + '<div class="msg"><b>' + S.directorDone + ' / ' + S.directorTarget + '</b> ' + (placement ? 'check items' : 'practice items') + '</div>'
    + '<button class="btn" id="directorBackToLearn">→ ' + (placement ? 'Back to quick check 回到能力定位' : 'Back to Smart Practice 回到聰明練習') + '</button>'
    + '</div></div>';
  var button = document.getElementById("directorBackToLearn");
  if (button) button.onclick = function () {
    var backBtn = document.getElementById("back");
    if (backBtn) backBtn.click();
  };
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
  if (lvl === "bopomofo" && C.sayZh) C.sayZh(fr);
  if (!S.raf) S.raf = requestAnimationFrame(shopLoop);
}

function drawShop() {
  var lvl = vLevel();
  var showPic = (S.prompt !== "fr");
  var showFr = lvl === "bopomofo" || ((lvl === "translate" || lvl === "sentences") && S.prompt !== "pic");
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
    if (isBopomofo() && C.sayZh) C.sayZh(S.fr); else C.say(S.word);
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
  if (isBopomofo() && C.sayZh) C.sayZh(S.fr); else C.say(S.word);
  C.sfx.win(); C.fx.burst(12); C.fx.flash("ok");
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
  if (!S.running && vGameMode() === "shop") return;
  if (S.word == null || S.pos >= S.word.length) return;
  if (ch === S.word[S.pos]) {
    S.pos++; S.wrong = false; C.sfx.good();
    redrawVocabWord();
    if (S.pos >= S.word.length) {
      if (vGameMode() === "shop") shopComplete(); else vocabComplete();
    }
  } else {
    var expected = S.word[S.pos];
    S.wrong = true; S.firstTry = false; C.sfx.bad(); C.fx.flash("bad");
    redrawVocabWord();
    C.fx.hint(vGameMode() === "shop" ? "Oops, try again!" : "Not quite — 💡 Hint can help!");
    maybeApplyVocabularyTutor(ch, expected);
  }
}

function init(ctx) {
  C = ctx;
  if (vGameMode() === "shop") { initShop(); return; }
  S = { queue: buildVocabQueue(), qi: 0, streak: 0, sessionMastered: 0, running: true, timeout: null, directorDone: 0, directorTarget: C.director ? Math.max(1, Number(C.director.targetAttempts) || 2) : 0 };
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
  var lvl = (ctx.director && ctx.director.vocabularyMode) || s.levels[ctx.kid] || "copy";
  if (ctx.director) {
    bar.innerHTML = '';
    var badge = document.createElement("span"); badge.className = "chip on";
    badge.style.background = ctx.kids[ctx.kid].raw;
    badge.textContent = (isPlacementFlow() ? "🧭 Quick check · " : "🎯 Smart Practice · ") + (directedLanguageSkill() ? languageSkillDisplayName(directedLanguageSkill()) : lvl);
    bar.appendChild(badge);
    var voice = document.createElement("button"); voice.className = "chip" + (s.tts ? " on" : "");
    if (s.tts) voice.style.background = ctx.kids[ctx.kid].raw;
    voice.textContent = "🗣️ Voice";
    voice.onclick = function () { s.tts = !s.tts; ctx.saveSettings(); settings(bar, ctx); };
    bar.appendChild(voice);
    return;
  }
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
