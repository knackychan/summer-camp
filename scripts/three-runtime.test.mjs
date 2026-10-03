import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { graphicsContext, loadThree, createRenderer, firstFrame, observeResize } from "../js/games/three-runtime.js";

function globalValue(t, key, value) {
  const before = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, value });
  t.after(() => { if (before) Object.defineProperty(globalThis, key, before); else delete globalThis[key]; });
}

test("modern GPUs retain WebGL2 and retry without antialiasing when allocation fails", (t) => {
  globalValue(t, "navigator", { userAgent: "desktop", deviceMemory: 8 });
  const attempts = [], context = {};
  const canvas = { getContext(kind, options) { attempts.push([kind, options.antialias]); return options.antialias ? null : context; } };
  const runtime = graphicsContext(canvas);
  assert.equal(runtime.context, context);
  assert.equal(runtime.legacy, false);
  assert.equal(runtime.reduced, true);
  assert.deepEqual(attempts, [["webgl2", true], ["webgl2", false]]);
});

test("old Android uses fewer graphics resources without downgrading a working WebGL2 renderer", (t) => {
  globalValue(t, "navigator", { userAgent: "Mozilla/5.0 (Linux; Android 8.1.0)", deviceMemory: 2 });
  const calls = [], context = {};
  const runtime = graphicsContext({ getContext(kind, options) { calls.push([kind, options.antialias]); return context; } });
  assert.equal(runtime.legacy, false);
  assert.equal(runtime.reduced, true);
  assert.deepEqual(calls, [["webgl2", false]]);
});

test("WebGL1-only graphics load the matching legacy renderer, controls and official Timer", async (t) => {
  globalValue(t, "navigator", { userAgent: "desktop" });
  const context = { getExtension() { return null; } };
  const runtime = await loadThree({ getContext(kind) { return kind === "webgl" ? context : null; } }, true);
  assert.equal(runtime.legacy, true);
  assert.equal(runtime.reduced, true);
  assert.equal(runtime.THREE.REVISION, "162");
  assert.equal(typeof runtime.OrbitControls, "function");
  const timer = new runtime.THREE.Timer();
  timer.reset(); timer.update();
  assert.ok(timer.getDelta() >= 0);
  timer.dispose();
});

test("missing GPU and failed renderer construction report the host's recoverable graphics error", (t) => {
  globalValue(t, "navigator", {});
  assert.throws(() => graphicsContext({ getContext() { return null; } }), { code: "SQ_GRAPHICS_UNAVAILABLE" });
  let released = 0;
  const runtime = {
    canvas: {}, context: { getExtension: () => ({ loseContext() { released++; } }) },
    THREE: { WebGLRenderer: class { constructor() { throw new Error("GPU allocation failed"); } } }
  };
  assert.throws(() => createRenderer(runtime, 2), { code: "SQ_GRAPHICS_UNAVAILABLE" });
  assert.equal(released, 1, "failed initialization releases its graphics context");
});

test("context recovery clears its notice, disposal releases listeners, and bad shaders reject first paint", (t) => {
  const listeners = new Map(), notices = [];
  let disposed = 0, prevented = false;
  globalValue(t, "window", { devicePixelRatio: 3 });
  globalValue(t, "document", { createElement() { return {
    dataset: {}, style: {}, setAttribute() {}, remove() { notices.splice(notices.indexOf(this), 1); }
  }; } });
  const canvas = {
    dataset: {}, parentNode: { appendChild(node) { notices.push(node); } },
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name) { listeners.delete(name); }
  };
  const runtime = {
    canvas, context: {}, attributes: {}, legacy: true, reduced: true,
    THREE: { WebGLRenderer: class {
      constructor() { this.debug = {}; }
      setPixelRatio(value) { this.ratio = value; }
      dispose() { disposed++; }
      render() { this.debug.onShaderError(); }
    } }
  };
  const renderer = createRenderer(runtime, 2);
  assert.equal(renderer.ratio, 1);
  assert.equal(canvas.dataset.sqGraphics, "webgl1");
  listeners.get("webglcontextlost")({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true, "allows the browser to restore the context");
  assert.equal(notices.length, 1);
  listeners.get("webglcontextrestored")();
  assert.equal(notices.length, 0);
  assert.throws(() => firstFrame(renderer, {}, {}), { code: "SQ_GRAPHICS_UNAVAILABLE" });
  assert.equal(notices.length, 1);
  renderer.dispose();
  assert.equal(notices.length, 0);
  assert.equal(listeners.size, 0);
  assert.equal(disposed, 1);
});

test("older WebViews can resize and clean up without ResizeObserver", (t) => {
  const listeners = new Map();
  globalValue(t, "ResizeObserver", undefined);
  globalValue(t, "window", {
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name) { listeners.delete(name); }
  });
  let resized = 0;
  const observer = observeResize({}, () => resized++);
  listeners.get("resize")();
  assert.equal(resized, 1);
  observer.disconnect();
  assert.equal(listeners.size, 0);
});

test("late Solar textures are disposed after leaving the game, including the Milky Way backdrop", () => {
  const source = readFileSync(new URL("../js/games/solar.js", import.meta.url), "utf8");
  const callbacks = [...source.matchAll(/function \(tex\) \{[\s\S]*?\n\s*\}/g)];
  assert.equal(callbacks.length, 2);
  let disposed = 0;
  for (const callback of callbacks) {
    vm.runInNewContext("(" + callback[0] + ")(tex)", {
      token: 1, initToken: 2, tex: { dispose() { disposed++; } }
    });
  }
  assert.equal(disposed, 2, "neither callback reaches a disposed scene or retains its texture");
});
