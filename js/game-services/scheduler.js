/* Scheduler service (implementation-guidelines.md §12.8; brain slice 34 task 2).
   One instance per Brain round, disposed with it. Every timeout, interval, frame
   loop and Web Animation goes through here so a round can guarantee zero live
   resources after destroy(), and so pause()/resume() (document hidden) freezes
   everything uniformly without each scene reimplementing that bookkeeping. */

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function createScheduler() {
  var disposed = false;
  var globalPaused = false;
  var resources = new Set();

  function rethrowAsync(err) {
    queueMicrotask(function () { throw err; });
  }

  function track(kind, handlers) {
    var res = Object.assign({ kind: kind }, handlers);
    resources.add(res);
    return res;
  }
  function untrack(res) { resources.delete(res); }

  function after(ms, fn) {
    if (disposed) return function () {};
    var remaining = Math.max(0, ms || 0);
    var startedAt = now();
    var timerId = null;
    var paused = globalPaused;

    function fire() {
      timerId = null;
      untrack(res);
      try { fn(); } catch (e) { rethrowAsync(e); }
    }
    function arm(delay) {
      startedAt = now();
      timerId = setTimeout(fire, delay);
    }

    var res = track("after", {
      cancel: function () {
        if (timerId != null) { clearTimeout(timerId); timerId = null; }
        untrack(res);
      },
      pause: function () {
        if (paused) return;
        paused = true;
        if (timerId != null) {
          clearTimeout(timerId); timerId = null;
          remaining = Math.max(0, remaining - (now() - startedAt));
        }
      },
      resume: function () {
        if (!paused) return;
        paused = false;
        arm(remaining);
      }
    });

    if (paused) { /* stays pending until the round-level resume() arms it */ }
    else arm(remaining);
    return res.cancel;
  }

  function every(ms, fn) {
    if (disposed) return function () {};
    var intervalId = null;
    var paused = globalPaused;

    function start() {
      intervalId = setInterval(function () {
        try { fn(); } catch (e) { rethrowAsync(e); }
      }, ms);
    }

    var res = track("every", {
      cancel: function () {
        if (intervalId != null) { clearInterval(intervalId); intervalId = null; }
        untrack(res);
      },
      pause: function () {
        paused = true;
        if (intervalId != null) { clearInterval(intervalId); intervalId = null; }
      },
      resume: function () {
        if (!paused) return;
        paused = false;
        start();
      }
    });

    if (!paused) start();
    return res.cancel;
  }

  function frame(fn) {
    if (disposed) return function () {};
    var rafId = null;
    var paused = globalPaused;
    var cancelled = false;

    function tick(ts) {
      rafId = null;
      try { fn(ts); }
      catch (e) { cancelled = true; untrack(res); rethrowAsync(e); return; }
      if (!cancelled && !paused) rafId = requestAnimationFrame(tick);
    }

    var res = track("frame", {
      cancel: function () {
        cancelled = true;
        if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
        untrack(res);
      },
      pause: function () {
        paused = true;
        if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
      },
      resume: function () {
        if (!paused || cancelled) return;
        paused = false;
        rafId = requestAnimationFrame(tick);
      }
    });

    if (!paused) rafId = requestAnimationFrame(tick);
    return res.cancel;
  }

  function animate(element, keyframes, options) {
    if (disposed || !element || typeof element.animate !== "function") {
      return Promise.resolve();
    }
    var anim = element.animate(keyframes, options);
    var res = track("animate", {
      cancel: function () { try { anim.cancel(); } catch (e) {} untrack(res); },
      pause: function () { try { anim.pause(); } catch (e) {} },
      resume: function () { try { anim.play(); } catch (e) {} }
    });
    return new Promise(function (resolve) {
      var done = function () { untrack(res); resolve(); };
      try {
        anim.addEventListener("finish", done, { once: true });
        anim.addEventListener("cancel", done, { once: true });
      } catch (e) { done(); }
    });
  }

  function pause() {
    if (globalPaused) return;
    globalPaused = true;
    resources.forEach(function (r) { if (r.pause) r.pause(); });
  }
  function resume() {
    if (!globalPaused) return;
    globalPaused = false;
    resources.forEach(function (r) { if (r.resume) r.resume(); });
  }
  function cancelAll() {
    disposed = true;
    resources.forEach(function (r) { if (r.cancel) r.cancel(); });
    resources.clear();
  }

  return {
    after: after,
    every: every,
    frame: frame,
    animate: animate,
    pause: pause,
    resume: resume,
    cancelAll: cancelAll,
    get activeCount() { return resources.size; },
    get paused() { return globalPaused; },
    get disposed() { return disposed; }
  };
}

export default createScheduler;
