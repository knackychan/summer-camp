/* Big Machines 🚜 大機器 — migrated from index.html:1502-1593 (slice 19). */
var S = null, C = null;

var NUM_EN = ["","one","two","three","four","five","six","seven","eight","nine"];
var NUM_FR = ["","un","deux","trois","quatre","cinq","six","sept","huit","neuf"];

function mchWords() {
  var pool = (C.words.all || []).filter(function (w) { return w[0].length <= 4 && !w[0].includes(" "); });
  return pool.length ? pool : (C.words.easy || [["cat", "\ud83d\udc31", "", ""]]);
}

function machinesHud() {
  C.hud([{ k: "Wins", v: S.wins, c: C.kids[C.kid].raw }, { k: "Stars", v: C.stars }]);
}

function mountMachine(kind, html) {
  C.stage.innerHTML =
    '<div class="game-scene game-scene--machines game-scene--machines-' + kind + '">'
    + '<div class="game-scene__center">'
    + html
    + '</div>'
    + '</div>';
}

function drawMchWord() {
  var el = document.getElementById("mword"); if (!el) return;
  el.innerHTML = S.word.split("").map(function (c, i) {
    return '<span class="' + (i < S.pos ? "done" : i === S.pos ? "cur" : "todo") + '">' + c + '</span>';
  }).join("");
  var car = document.getElementById("car");
  if (car) car.style.left = (S.pos / S.word.length * 82) + "%";
  C.keys.highlight(S.word[S.pos]);
}

function mchRace() {
  var pick = C.rand(mchWords());
  S.word = pick[0]; S.pos = 0; S.em = pick[1]; S.fr = pick[2];
  mountMachine("race",
    '<div class="cue">\ud83c\udfce\ufe0f Type the letters to race to the flag!</div>'
    + '<div class="word-em" style="font-size:44px">' + S.em + '</div>'
    + '<div class="word" id="mword"></div>'
    + '<div class="vfr" style="font-size:18px">' + S.fr + '</div>'
    + '<div class="mch-track"><span class="mch-car" id="car" style="left:0%">\ud83c\udfce\ufe0f</span>'
    + '<span class="mch-flag">\ud83c\udfc1</span></div>'
    + '<div class="msg" id="msg"></div>');
  drawMchWord(); C.say(S.word);
}

function mchDig() {
  var n = 1 + Math.floor(Math.random() * 9);
  S.num = n;
  mountMachine("dig",
    '<div class="cue">\ud83d\ude9c How many stones did the excavator dig up?</div>'
    + '<div class="mch-row"><span class="mch-digger" id="digger">\ud83d\ude9c</span></div>'
    + '<div class="mch-row" id="stones">' + "\ud83e\udea8".repeat(n) + '</div>'
    + '<div class="bigletter" style="font-size:64px;color:' + C.kids[C.kid].color + '" id="dignum">?</div>'
    + '<div class="msg" id="msg">Press the number!</div>');
  C.keys.highlight(String(n));
}

function mchHeli() {
  var letter = C.rand(Object.keys(C.words.letters));
  S.letter = letter;
  var parts = C.words.letters[letter].split(" ");
  var em = parts[0];
  var rest = parts.slice(1).join(" ");
  mountMachine("heli",
    '<div class="cue">\ud83d\ude81 Press the key to lift the cargo!</div>'
    + '<div class="mch-row"><span class="mch-lift" id="heli" style="opacity:0">\ud83d\ude81</span></div>'
    + '<div class="mch-lift" id="cargo">'
    + '<div class="bigletter" style="font-size:76px;color:' + C.kids[C.kid].color + '">' + letter + '</div>'
    + '<div class="picword"><span class="em">' + em + '</span>' + rest + '</div>'
    + '</div>'
    + '<div class="msg" id="msg">Find the glowing key!</div>');
  C.keys.highlight(letter);
}

function mchWin() {
  S.wins++; C.sfx.win(); C.fx.burst(14); C.fx.flash("ok");
  machinesHud();
  S.timeout = setTimeout(nextMachine, 1300);
}

function nextMachine() {
  var kinds = ["race", "dig", "heli"];
  S.kind = kinds[S.round % 3]; S.round++;
  if (S.kind === "race") mchRace();
  else if (S.kind === "dig") mchDig();
  else mchHeli();
  machinesHud();
}

function key(ch) {
  if (!S || !S.running) return;
  if (S.kind === "race") {
    if (ch === S.word[S.pos]) {
      S.pos++; C.sfx.good(); drawMchWord();
      if (S.pos >= S.word.length) {
        var car = document.getElementById("car"); if (car) car.style.left = "88%";
        C.sayPair(S.word, S.fr); mchWin();
      }
    } else { C.sfx.bad(); C.fx.flash("bad"); }
  } else if (S.kind === "dig") {
    if (ch === String(S.num)) {
      var d = document.getElementById("digger"); if (d) d.classList.add("dig");
      var el = document.getElementById("dignum");
      if (el) el.textContent = S.num + " \u00b7 " + NUM_EN[S.num] + " \u00b7 " + NUM_FR[S.num];
      C.sayPair(NUM_EN[S.num], NUM_FR[S.num]); mchWin();
    } else if (/[1-9]/.test(ch)) { C.sfx.bad(); C.fx.flash("bad"); C.fx.hint("Count the stones again! \ud83e\udea8"); }
  } else { /* heli */
    if (ch.toUpperCase() === S.letter) {
      var h = document.getElementById("heli"), cg = document.getElementById("cargo");
      if (h) { h.style.opacity = "1"; setTimeout(function () { h.classList.add("up"); if (cg) cg.classList.add("up"); }, 250); }
      C.say(S.letter);
      mchWin();
    } else { C.sfx.bad(); C.fx.flash("bad"); }
  }
}

function init(ctx) {
  C = ctx;
  S = { round: 0, wins: 0, running: true, kind: null, timeout: null };
  nextMachine();
}

function stop() {
  if (!S) return;
  S.running = false;
  if (S.timeout) { clearTimeout(S.timeout); S.timeout = null; }
  S = null;
}

export default {
  id: "machines",
  meta: { icon: "\ud83d\ude9c", title: "Big Machines", tz: "\u5927\u6a5f\u5668", blurb: "Race, dig & fly" },
  keyboard: true,
  bestKey: null,
  init: init,
  key: key,
  stop: stop,
  debugState: function () { return S; }
};
