/* Study timer — the one "time to remember" signal every memorize phase shares
   (Memory Match, Low to High, Word Memory). A big seconds number sits on a disc
   that shrinks as the study time runs out, and a soft tick-tock marks each
   second. It lives in its own slot beside what the kid must remember, never on
   top of it, and it is calm: no red, no buzzer (coach, not cop).

   Every second goes through ctx.scheduler, so a Clue overlay, a hidden tab or
   destroy() freezes or stops it with the rest of the round. Long studies (Word
   Memory, 45-60 s) only tick for the last TICK_WINDOW seconds so a minute of
   clicking never drowns the words out; the disc and number run the whole time. */

var TICK_WINDOW = 10;

export function studyTimerHtml(totalMs, label) {
  var secs = Math.max(1, Math.ceil((totalMs || 0) / 1000));
  var text = label || ["Remember!", "記住！"];
  return '<div class="brain-study-timer" data-role="study-timer" role="timer" aria-live="off" ' +
      'aria-label="' + secs + ' seconds to remember ' + secs + ' 秒記住">' +
    '<span class="brain-study-timer__dial" aria-hidden="true">' +
      '<svg viewBox="0 0 100 100" focusable="false">' +
        '<circle class="brain-study-timer__track" cx="50" cy="50" r="46"/>' +
        '<circle class="brain-study-timer__disc" cx="50" cy="50" r="46"/>' +
      '</svg>' +
      '<b class="brain-study-timer__num">' + secs + '</b>' +
    '</span>' +
    '<span class="brain-study-timer__label">' + text[0] + '<span class="zhs">' + text[1] + '</span></span>' +
  '</div>';
}

/* Starts the countdown on an element made by studyTimerHtml(). Returns cancel().
   The number shows whole seconds left (rounded up) and changes on the second
   boundaries counted back from the end, so it reaches 0 exactly when the study
   time does. Each step sets the disc's next size and CSS glides it there
   linearly, so it shrinks smoothly without a frame loop. */
export function startStudyTimer(ctx, el, totalMs) {
  if (!el) return function () {};
  var total = Math.max(1, totalMs || 0);
  var left = Math.ceil(total / 1000);
  var remaining = total;
  var stopped = false;
  var cancelNext = null;
  var num = el.querySelector(".brain-study-timer__num");
  var disc = el.querySelector(".brain-study-timer__disc");
  var glide = !ctx.reducedMotion;

  function paint(nextRemaining, ms) {
    if (num) num.textContent = String(left);
    if (disc) {
      disc.style.transitionDuration = glide ? ms + "ms" : "0ms";
      disc.style.transform = "scale(" + Math.max(0, (glide ? nextRemaining : remaining) / total).toFixed(3) + ")";
    }
    el.classList[left <= 3 ? "add" : "remove"]("is-last");
    el.setAttribute("aria-label", left + " seconds to remember " + left + " 秒記住");
  }
  function sound() {
    if (left > TICK_WINDOW) return;
    ctx.audio.play(left % 2 ? "clock-tick" : "clock-tock", {});
  }
  function step() {
    cancelNext = null;
    if (stopped) return;
    if (remaining <= 0) {
      left = 0; paint(0, 0); el.classList.add("is-done");
      return;
    }
    left = Math.ceil(remaining / 1000);
    var ms = remaining - (left - 1) * 1000;
    paint(remaining - ms, ms); sound();
    remaining -= ms;
    cancelNext = ctx.scheduler.after(ms, step);
  }

  if (num) num.textContent = String(left);
  if (disc) {
    disc.style.transitionDuration = "0ms";
    disc.style.transform = "scale(1)";
    /* Flush the full-size start so the first glide has somewhere to start from. */
    if (disc.getBoundingClientRect) disc.getBoundingClientRect();
  }
  step();
  return function cancel() {
    stopped = true;
    if (cancelNext) cancelNext();
    cancelNext = null;
  };
}
