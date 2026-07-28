/* Motion service (implementation-guidelines.md §8, §12.9; brain slice 34 task 3).
   Owns the approved timing/easing tokens and the single prefers-reduced-motion
   read for a round. Scenes MUST use this instead of hardcoding alternate timing
   or querying matchMedia themselves. All scheduling delegates to the round's
   scheduler so pause()/resume()/cancelAll() there covers motion too. */

export var TOKENS = Object.freeze({
  press: 120,
  snap: 180,
  move: 320,
  reveal: 480,
  celebrate: 640
});

export var EASE = Object.freeze({
  out: "cubic-bezier(.2,.8,.2,1)",
  settle: "cubic-bezier(.34,1.35,.64,1)",
  standard: "cubic-bezier(.4,0,.2,1)"
});

/* §8.3: strip travel/rotation/scale, keep opacity, cap the transition at 120ms. */
function reduceKeyframes(keyframes) {
  return keyframes.map(function (kf) {
    var out = {};
    if ("offset" in kf) out.offset = kf.offset;
    out.opacity = "opacity" in kf ? kf.opacity : 1;
    return out;
  });
}

export function createMotion(scheduler) {
  var mql = (typeof matchMedia === "function") ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  var reduced = mql ? !!mql.matches : false;
  function onChange(e) { reduced = e.matches; }
  if (mql) {
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else if (mql.addListener) mql.addListener(onChange);
  }

  function durationFor(token) {
    return TOKENS[token] || TOKENS.move;
  }

  function press(element) {
    if (!element) return Promise.resolve();
    var kf = reduced
      ? [{ transform: "translateY(0)" }, { transform: "translateY(0)" }]
      : [{ transform: "translateY(0)" }, { transform: "translateY(3px)" }];
    return scheduler.animate(element, kf, { duration: reduced ? 1 : TOKENS.press, easing: EASE.out, fill: "forwards" });
  }

  function move(element, keyframes, token) {
    if (!element) return Promise.resolve();
    var dur = durationFor(token);
    var kf = reduced ? reduceKeyframes(keyframes) : keyframes;
    var duration = reduced ? Math.min(dur, 120) : dur;
    return scheduler.animate(element, kf, { duration: duration, easing: EASE.standard, fill: "forwards" });
  }

  function emphasize(element, kind) {
    if (!element) return Promise.resolve();
    if (reduced || kind === "outline") {
      element.classList.add("brain-emphasize");
      return new Promise(function (resolve) {
        scheduler.after(160, function () { element.classList.remove("brain-emphasize"); resolve(); });
      });
    }
    var kf = [{ transform: "scale(1)" }, { transform: "scale(1.04)" }, { transform: "scale(1)" }];
    return scheduler.animate(element, kf, { duration: TOKENS.snap, easing: EASE.settle });
  }

  function sequence(steps) {
    return (steps || []).reduce(function (chain, step) {
      return chain.then(function () {
        return typeof step === "function" ? step() : Promise.resolve();
      });
    }, Promise.resolve());
  }

  return {
    get reduced() { return reduced; },
    tokens: TOKENS,
    ease: EASE,
    press: press,
    move: move,
    emphasize: emphasize,
    sequence: sequence,
    dispose: function () {
      if (!mql) return;
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else if (mql.removeListener) mql.removeListener(onChange);
    }
  };
}

export default createMotion;
