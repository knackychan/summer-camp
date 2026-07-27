/* Solar quiz engine (tech-spec.md §12). Pure: no DOM, no Three.js.
   Questions are computed from solar-data.js — never hand-written (design D6).
   Hand-writing a question is forbidden: a fact and its answer can never drift. */

/* One mission = 8 questions, unique targets, exactly 4 name + 4 superlative shuffled.
   rng is a function () → [0,1), so tests can inject deterministic sequences. */
export function buildMission(planets, rng) {
  rng = rng || Math.random;
  var pool = planets.slice();
  var targets = [];
  var kinds = ["name", "name", "name", "name", "superlative", "superlative", "superlative", "superlative"];

  /* Shuffle kind order deterministically */
  for (var si = kinds.length - 1; si > 0; si--) {
    var sj = Math.floor(rng() * (si + 1));
    var st = kinds[si]; kinds[si] = kinds[sj]; kinds[sj] = st;
  }

  /* Pick 8 unique planets via Fisher-Yates shuffle */
  for (var fi = pool.length - 1; fi > 0; fi--) {
    var fj = Math.floor(rng() * (fi + 1));
    var ft = pool[fi]; pool[fi] = pool[fj]; pool[fj] = ft;
  }
  targets = pool.slice(0, 8);

  /* Computed superlatives (runtime, so they can't drift from the data) */
  var biggest = planets.reduce(function (a, b) { return b.diameterKm > a.diameterKm ? b : a; });
  var closest = planets.reduce(function (a, b) { return b.au < a.au ? b : a; });
  var farthest = planets.reduce(function (a, b) { return b.au > a.au ? b : a; });
  var mostMoons = planets.reduce(function (a, b) { return b.moons > a.moons ? b : a; });

  /* Named superlatives from flags */
  var byFlag = function (flag) {
    return planets.filter(function (p) { return p.flags && p.flags[flag]; });
  };

  var questions = [];

  /* Assign 4 planets to name questions and 4 to superlatives.
     Pick superlative planets first (they're constrained by data), then
     use remaining planets for name questions. */
  var supTargets = [];
  var supers = [];

  /* Gather all possible superlative entries */
  var allSupers = [
    { superlative: "biggest", promptEn: "Which planet is the biggest?", promptTz: "\u54ea\u4e00\u9846\u884c\u661f\u6700\u5927?", targetId: biggest.id },
    { superlative: "closest", promptEn: "Which planet is closest to the Sun?", promptTz: "\u54ea\u4e00\u9846\u884c\u661f\u96e2\u592a\u967d\u6700\u8fd1?", targetId: closest.id },
    { superlative: "farthest", promptEn: "Which planet is farthest from the Sun?", promptTz: "\u54ea\u4e00\u9846\u884c\u661f\u96e2\u592a\u967d\u6700\u9060?", targetId: farthest.id },
    { superlative: "mostMoons", promptEn: "Which planet has the most moons?", promptTz: "\u54ea\u4e00\u9846\u884c\u661f\u7684\u885b\u661f\u6700\u591a?", targetId: mostMoons.id },
  ];

  ["hottest", "coldest", "red", "rings"].forEach(function (flag) {
    var holders = byFlag(flag);
    if (holders.length !== 1) return;
    var prompts = {
      hottest:  { en: "Which planet is the hottest?",    tz: "\u54ea\u4e00\u9846\u884c\u661f\u6700\u71b1?" },
      coldest:  { en: "Which planet is the coldest?",    tz: "\u54ea\u4e00\u9846\u884c\u661f\u6700\u51b7?" },
      red:      { en: "Which planet is called the red planet?", tz: "\u54ea\u4e00\u9846\u884c\u661f\u88ab\u7a31\u70ba\u7d05\u8272\u661f\u7403?" },
      rings:    { en: "Which planet has beautiful rings?", tz: "\u54ea\u4e00\u9846\u884c\u661f\u6709\u6f02\u4eae\u7684\u74b0?" },
    };
    allSupers.push({ superlative: flag, promptEn: prompts[flag].en, promptTz: prompts[flag].tz, targetId: holders[0].id });
  });

  /* Shuffle allSupers */
  for (var ai = allSupers.length - 1; ai > 0; ai--) {
    var aj = Math.floor(rng() * (ai + 1));
    var at = allSupers[ai]; allSupers[ai] = allSupers[aj]; allSupers[aj] = at;
  }

  /* Pick 4 unique superlatives with unique targets */
  for (var as = 0; as < allSupers.length && supers.length < 4; as++) {
    var candidate = allSupers[as];
    if (supTargets.indexOf(candidate.targetId) === -1) {
      supers.push({ kind: "superlative", superlative: candidate.superlative, promptEn: candidate.promptEn, promptTz: candidate.promptTz, targetId: candidate.targetId });
      supTargets.push(candidate.targetId);
    }
  }

  /* Name-question candidates: any planet NOT used in a superlative */
  var nameCandidates = targets.filter(function (p) { return supTargets.indexOf(p.id) === -1; });

  /* If we don't have enough name candidates, fill from all planets, preferring unused */
  if (nameCandidates.length < 4) {
    var rest = targets.filter(function (p) { return nameCandidates.indexOf(p) === -1; });
    for (var nc = nameCandidates.length; nc < 4 && rest.length; nc++) {
      nameCandidates.push(rest.shift());
    }
  }

  /* Build the 8 questions interleaved per shuffled kinds */
  var ni = 0, si = 0;
  for (var qi = 0; qi < 8; qi++) {
    var kind = kinds[qi];
    if (kind === "name" && ni < nameCandidates.length) {
      var target = nameCandidates[ni++];
      var useTz = rng() > 0.5;
      questions.push({
        kind: "name",
        targetId: target.id,
        promptEn: useTz ? ("Tap " + target.tz + "!") : ("Tap " + target.name.toUpperCase() + "!"),
        promptTz: useTz ? ("\u9ede " + target.tz + "!") : ("\u9ede " + target.name.toUpperCase() + "!"),
      });
    } else {
      if (si < supers.length) {
        questions.push(supers[si++]);
      } else if (ni < nameCandidates.length) {
        var ft = nameCandidates[ni++];
        var utz = rng() > 0.5;
        questions.push({
          kind: "name",
          targetId: ft.id,
          promptEn: utz ? ("Tap " + ft.tz + "!") : ("Tap " + ft.name.toUpperCase() + "!"),
          promptTz: utz ? ("\u9ede " + ft.tz + "!") : ("\u9ede " + ft.name.toUpperCase() + "!"),
        });
      }
    }
  }

  return questions;
}

/* Grade a single tap. Returns { correct, star }.
   star is true only when the first tap is correct (attempts === 0).
   Retries are free and unrecorded (design D5: coach, not cop). */
export function grade(question, tappedId, attempts) {
  var correct = tappedId === question.targetId;
  return { correct: correct, star: correct && attempts === 0 };
}
