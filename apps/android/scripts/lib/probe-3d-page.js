/* Runs inside the app page (device WebView or desktop) through CDP Runtime.evaluate.
   One async function expression: (ids, options) => report. Opens each 3D game in
   its own full-screen layer with a stub ctx (no kid state, no stars), then reads
   the drawing buffer back while switching one scene feature off at a time, so the
   report shows WHICH feature turns the picture black on this GPU. Read-only for
   the app: every change is undone and the game is stopped before the next one. */
async (ids, options) => {
  options = options || {};
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  /* Same URLs the app's registry imports, so the games share the app's Three module. */
  const base = options.base || new URL(".", location.href).href;
  const report = { userAgent: navigator.userAgent, deviceMemory: navigator.deviceMemory || null,
    dpr: window.devicePixelRatio, viewport: [innerWidth, innerHeight], console: [], games: [] };

  const logs = report.console;
  if (!window.__sqProbeConsole) {
    window.__sqProbeConsole = [];
    ["error", "warn"].forEach((level) => {
      const original = console[level];
      console[level] = function () {
        try { window.__sqProbeConsole.push(level + ": " + Array.from(arguments).map(String).join(" ").slice(0, 4000)); } catch (error) {}
        return original.apply(this, arguments);
      };
    });
    window.addEventListener("error", (event) => window.__sqProbeConsole.push("uncaught: " + event.message));
    window.addEventListener("unhandledrejection", (event) => window.__sqProbeConsole.push("rejection: " + (event.reason && event.reason.stack || event.reason)));
  }
  window.__sqProbeConsole.length = 0;

  const runtimeModule = await import(base + "js/games/three-runtime.js");
  const runtime = await runtimeModule.loadThree(document.createElement("canvas"), false);
  const THREE = runtime.THREE;
  report.runtime = { legacy: runtime.legacy, reduced: runtime.reduced, attributes: runtime.attributes, revision: THREE.REVISION };

  /* GPU identity and limits, from the same kind of context the games get. */
  const gl = runtime.context;
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const precision = (shader, kind) => {
    const format = gl.getShaderPrecisionFormat(gl[shader], gl[kind]);
    return format ? [format.rangeMin, format.rangeMax, format.precision] : null;
  };
  report.gpu = {
    version: gl.getParameter(gl.VERSION),
    glsl: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    vendor: gl.getParameter(gl.VENDOR),
    renderer: gl.getParameter(gl.RENDERER),
    unmaskedVendor: info ? gl.getParameter(info.UNMASKED_VENDOR_WEBGL) : null,
    unmaskedRenderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : null,
    precision: {
      vertexHigh: precision("VERTEX_SHADER", "HIGH_FLOAT"), vertexMedium: precision("VERTEX_SHADER", "MEDIUM_FLOAT"),
      fragmentHigh: precision("FRAGMENT_SHADER", "HIGH_FLOAT"), fragmentMedium: precision("FRAGMENT_SHADER", "MEDIUM_FLOAT"),
      fragmentHighInt: precision("FRAGMENT_SHADER", "HIGH_INT"),
    },
    limits: Object.fromEntries(["MAX_VARYING_VECTORS", "MAX_VERTEX_UNIFORM_VECTORS", "MAX_FRAGMENT_UNIFORM_VECTORS",
      "MAX_VERTEX_ATTRIBS", "MAX_TEXTURE_IMAGE_UNITS", "MAX_VERTEX_TEXTURE_IMAGE_UNITS", "MAX_TEXTURE_SIZE",
      "MAX_RENDERBUFFER_SIZE", "DEPTH_BITS", "STENCIL_BITS"].map((name) => [name, gl.getParameter(gl[name])])),
    maxViewport: Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS)),
    extensions: gl.getSupportedExtensions(),
  };
  runtimeModule.releaseContext(runtime);

  /* Every frame a game draws passes its scene through here. */
  const proto = THREE.Scene.prototype;
  const ownHook = Object.prototype.hasOwnProperty.call(proto, "onBeforeRender") ? proto.onBeforeRender : null;
  proto.onBeforeRender = function (renderer, scene, camera) { window.__sqProbeFrame = { renderer, scene, camera }; };

  const ctxFor = (mount) => ({
    mount, kid: "probe", kids: {}, best: 0, settings: {},
    sfx: new Proxy({}, { get: () => () => {} }),
    say() {}, sayPair() {}, hud() {}, finish() {}, saveSettings() {}, award() {},
  });

  function frame() { return window.__sqProbeFrame; }

  /* Draw once and read a 7×7 grid of the drawing buffer in the same task. */
  function capture(label, thumbs) {
    const { renderer, scene, camera } = frame();
    const glc = renderer.getContext();
    let error = null;
    try { renderer.render(scene, camera); } catch (caught) { error = String(caught && caught.stack || caught).slice(0, 600); }
    const width = glc.drawingBufferWidth, height = glc.drawingBufferHeight;
    const pixel = new Uint8Array(4);
    const grid = [];
    for (let row = 1; row <= 7; row += 1) {
      for (let col = 1; col <= 7; col += 1) {
        glc.readPixels(Math.floor(width * col / 8), Math.floor(height * row / 8), 1, 1, glc.RGBA, glc.UNSIGNED_BYTE, pixel);
        grid.push([pixel[0], pixel[1], pixel[2]]);
      }
    }
    const glError = glc.getError();
    const black = grid.filter((p) => p[0] + p[1] + p[2] < 24).length;
    const mean = [0, 1, 2].map((i) => Math.round(grid.reduce((sum, p) => sum + p[i], 0) / grid.length));
    let thumb = null;
    if (thumbs) {
      const small = document.createElement("canvas");
      small.width = 320; small.height = Math.max(1, Math.round(320 * height / width));
      small.getContext("2d").drawImage(renderer.domElement, 0, 0, small.width, small.height);
      thumb = small.toDataURL("image/png");
    }
    const programs = (renderer.info.programs || []).map((program) => ({
      name: program.name, type: program.type,
      runnable: program.diagnostics ? program.diagnostics.runnable : true,
      log: program.diagnostics ? JSON.stringify(program.diagnostics).slice(0, 2000) : null,
    }));
    return { label, black, of: grid.length, mean, glError, error, buffer: [width, height],
      calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      contextLost: glc.isContextLost(), programs, thumb, grid: options.grid ? grid : undefined };
  }

  function materials(scene) {
    const set = new Set();
    scene.traverse((object) => {
      if (!object.material) return;
      (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) => set.add(m));
    });
    return Array.from(set);
  }
  function recompile(scene) { materials(scene).forEach((m) => { m.needsUpdate = true; }); }
  function lights(scene, test) { const list = []; scene.traverse((o) => { if (o.isLight && test(o)) list.push(o); }); return list; }

  function override(make) {
    return ({ scene }) => {
      const previous = scene.overrideMaterial; scene.overrideMaterial = make();
      return () => { scene.overrideMaterial.dispose(); scene.overrideMaterial = previous; };
    };
  }

  /* Each variant changes one thing and returns its undo. */
  const variants = {
    baseline: () => () => {},
    noFog: ({ scene }) => { const fog = scene.fog; scene.fog = null; return () => { scene.fog = fog; }; },
    noHemisphereLight: ({ scene }) => {
      const list = lights(scene, (o) => o.isHemisphereLight && o.visible); list.forEach((o) => { o.visible = false; });
      return () => list.forEach((o) => { o.visible = true; });
    },
    noDirectionalLight: ({ scene }) => {
      const list = lights(scene, (o) => o.isDirectionalLight && o.visible); list.forEach((o) => { o.visible = false; });
      return () => list.forEach((o) => { o.visible = true; });
    },
    noLightCastShadow: ({ scene }) => {
      const list = lights(scene, (o) => o.castShadow); list.forEach((o) => { o.castShadow = false; });
      return () => list.forEach((o) => { o.castShadow = true; });
    },
    noFlatShading: ({ scene }) => {
      const list = materials(scene).filter((m) => m.flatShading); list.forEach((m) => { m.flatShading = false; });
      return () => list.forEach((m) => { m.flatShading = true; });
    },
    noMaps: ({ scene }) => {
      const list = materials(scene).filter((m) => m.map).map((m) => [m, m.map]); list.forEach(([m]) => { m.map = null; });
      return () => list.forEach(([m, map]) => { m.map = map; });
    },
    noToneMapping: ({ renderer }) => {
      const value = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
      return () => { renderer.toneMapping = value; };
    },
    linearOutput: ({ renderer }) => {
      const value = renderer.outputColorSpace; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      return () => { renderer.outputColorSpace = value; };
    },
    ambientOnly: ({ scene }) => {
      const list = lights(scene, (o) => o.visible); list.forEach((o) => { o.visible = false; });
      const ambient = new THREE.AmbientLight(0xffffff, 1); scene.add(ambient);
      return () => { scene.remove(ambient); list.forEach((o) => { o.visible = true; }); };
    },
    noFogNoHemisphere: ({ scene }) => {
      const fog = scene.fog; scene.fog = null;
      const list = lights(scene, (o) => o.isHemisphereLight && o.visible); list.forEach((o) => { o.visible = false; });
      return () => { scene.fog = fog; list.forEach((o) => { o.visible = true; }); };
    },
    basicOverride: ({ scene }) => {
      const previous = scene.overrideMaterial; scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff });
      return () => { scene.overrideMaterial.dispose(); scene.overrideMaterial = previous; };
    },
    lambertOverride: ({ scene }) => {
      const previous = scene.overrideMaterial; scene.overrideMaterial = new THREE.MeshLambertMaterial({ color: 0xff00ff });
      return () => { scene.overrideMaterial.dispose(); scene.overrideMaterial = previous; };
    },
    /* Which lit-material pieces still draw on this GPU. */
    lambertEmissive: override(() => new THREE.MeshLambertMaterial({ color: 0x000000, emissive: 0xff00ff })),
    lambertTransparent: override(() => new THREE.MeshLambertMaterial({ color: 0xff00ff, transparent: true, opacity: 1 })),
    phongOverride: override(() => new THREE.MeshPhongMaterial({ color: 0xff00ff, shininess: 0, specular: 0x000000 })),
    standardOverride: override(() => new THREE.MeshStandardMaterial({ color: 0xff00ff, roughness: 1, metalness: 0 })),
    toonOverride: override(() => new THREE.MeshToonMaterial({ color: 0xff00ff })),
    normalOverride: override(() => new THREE.MeshNormalMaterial()),
    shaderNdotL: override(() => new THREE.ShaderMaterial({
      vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "varying vec3 vN; void main(){ float d = max(dot(normalize(vN), normalize(vec3(0.3, 1.0, 0.5))), 0.0); gl_FragColor = vec4(vec3(1.0, 0.0, 1.0) * (0.35 + 0.65 * d), 1.0); }",
    })),
    emptyScene: (state) => {
      const scene = state.scene;
      const empty = new THREE.Scene();
      empty.background = scene.background || new THREE.Color(0x00ff00);
      window.__sqProbeFrame = Object.assign({}, state, { scene: empty });
      return () => { window.__sqProbeFrame = state; };
    },
  };

  for (const id of ids) {
    const game = { id, steps: [] };
    report.games.push(game);
    const layer = document.createElement("div");
    layer.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:#ff00ff";
    const mount = document.createElement("div");
    mount.style.cssText = "position:absolute;inset:0";
    layer.appendChild(mount);
    document.body.appendChild(layer);
    window.__sqProbeFrame = null;
    let module = null;
    try {
      module = (await import(base + "js/games/" + id + ".js")).default;
      const started = performance.now();
      await Promise.race([module.init(ctxFor(mount)), wait(20000).then(() => { throw new Error("init timed out"); })]);
      game.initMs = Math.round(performance.now() - started);
      await wait(options.settleMs || 1500);
      if (!frame()) throw new Error("the game never drew a frame");
      const state = frame();
      const canvas = state.renderer.domElement;
      game.graphics = { kind: canvas.dataset.sqGraphics, quality: canvas.dataset.sqGraphicsQuality,
        pixelRatio: state.renderer.getPixelRatio(), css: [canvas.clientWidth, canvas.clientHeight],
        precision: state.renderer.capabilities.precision, shadowMap: state.renderer.shadowMap.enabled,
        toneMapping: state.renderer.toneMapping, outputColorSpace: state.renderer.outputColorSpace,
        notice: !!document.querySelector("[data-sq-graphics-notice]") };
      const lightsList = [];
      state.scene.traverse((o) => { if (o.isLight) lightsList.push({ type: o.type, intensity: o.intensity, castShadow: o.castShadow, visible: o.visible }); });
      game.scene = { fog: state.scene.fog ? { type: state.scene.fog.type, near: state.scene.fog.near, far: state.scene.fog.far } : null,
        background: state.scene.background && state.scene.background.isColor ? "#" + state.scene.background.getHexString() : null,
        lights: lightsList, materials: Array.from(new Set(materials(state.scene).map((m) => m.type + (m.flatShading ? "+flat" : "") + (m.map ? "+map" : "")))),
        camera: { near: state.camera.near, far: state.camera.far, position: state.camera.position.toArray().map((v) => +v.toFixed(2)) } };
      for (const [name, apply] of Object.entries(variants)) {
        if (options.variants && !options.variants.includes(name)) continue;
        const current = frame();
        const undo = apply(current);
        recompile(frame().scene);
        try { game.steps.push(capture(name, options.thumbs !== false)); }
        finally { undo(); recompile(current.scene); }
      }
    } catch (error) {
      game.error = String(error && error.stack || error).slice(0, 1500);
      game.notice = (document.querySelector("[data-sq-graphics-notice]") || {}).textContent || null;
    } finally {
      try { if (module && module.stop) module.stop(); } catch (error) { game.stopError = String(error); }
      layer.remove();
      await wait(300);
    }
  }

  if (ownHook) proto.onBeforeRender = ownHook; else delete proto.onBeforeRender;
  report.console = window.__sqProbeConsole.slice(0, 200);
  return report;
}
