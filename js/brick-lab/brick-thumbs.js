/* Part icons drawn from the real part (docs/plans/2026-10-04-brick-lab-multiplayer/
   D12, slice 08). Each icon is the mesh that lands on the plate, in the picked
   colour, seen from a fixed 3/4 view, so the tray shows exactly what a tap
   places.

   No second WebGL context (Android 8 / Adreno 3xx tablets): icons are drawn
   by the lab's own renderer into the corner of its canvas, copied out to a
   2D canvas in the same task, and the caller draws the full scene over that
   corner before the frame is shown. The lab's context has no alpha, so each
   icon is drawn twice, on black and on white; the difference between the two
   gives the exact coverage of every pixel (antialiased edges included) and the
   icon ends up on a transparent background. Icons are data URLs, cached per
   key, so they outlive a lost GL context. */

const SIZE = { width: 56, height: 36 }; /* CSS pixels */
const VIEW = [1, 0.95, 1.35]; /* camera direction: from the front right, above */
const MARGIN = 1.08;

export function createThumbs({ THREE, renderer, cheap = false, perFrame = 3 }) {
  const cache = new Map();
  const queue = new Map();
  const listeners = new Set();
  const scene = new THREE.Scene();
  /* Same light as the plate (slices 08 and 13), fixed relative to the view. */
  scene.add(new THREE.HemisphereLight(0xc6d8ff, 0xa88a6a, cheap ? 1.4 : 1.2));
  const sun = new THREE.DirectionalLight(0xffcf94, 3.3);
  sun.position.set(40, 34, 18);
  scene.add(sun);
  if (!cheap) {
    const fill = new THREE.DirectionalLight(0x9fb6ff, 0.65);
    fill.position.set(-10, 7, -8);
    scene.add(fill);
  }
  /* Orthographic, like a parts catalogue: every part fills its tile, a long
     plate as much as a 1×1 brick, and nothing leans from perspective. */
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  const view = new THREE.Vector3(...VIEW).normalize();
  const box = new THREE.Box3();
  const sphere = new THREE.Sphere();
  const corner = new THREE.Vector3();
  const keepViewport = new THREE.Vector4();
  const keepScissor = new THREE.Vector4();
  const keepClear = new THREE.Color();
  let pad = null;

  /* Fit the camera to the part's box as seen from VIEW, centred, at the
     tile's aspect ratio. */
  function frame(object) {
    box.setFromObject(object);
    box.getBoundingSphere(sphere);
    camera.position.copy(view).multiplyScalar(sphere.radius * 3).add(sphere.center);
    camera.lookAt(sphere.center);
    camera.updateMatrixWorld();
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < 8; i += 1) {
      corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
        .applyMatrix4(camera.matrixWorldInverse);
      corner.toArray().forEach((v, axis) => { lo[axis] = Math.min(lo[axis], v); hi[axis] = Math.max(hi[axis], v); });
    }
    const aspect = SIZE.width / SIZE.height;
    let w = (hi[0] - lo[0]) * MARGIN;
    let h = (hi[1] - lo[1]) * MARGIN;
    if (w / h > aspect) h = w / aspect;
    else w = h * aspect;
    const cx = (hi[0] + lo[0]) / 2;
    const cy = (hi[1] + lo[1]) / 2;
    camera.left = cx - w / 2;
    camera.right = cx + w / 2;
    camera.top = cy + h / 2;
    camera.bottom = cy - h / 2;
    camera.near = Math.max(0.01, -hi[2] - 0.1);
    camera.far = -lo[2] + 0.1;
    camera.updateProjectionMatrix();
  }

  /* Draw the scene on a flat background and read the corner back. */
  function shot(clear, w, h) {
    renderer.setClearColor(clear, 1);
    renderer.render(scene, camera);
    const canvas = renderer.domElement;
    pad.ctx.clearRect(0, 0, w, h);
    pad.ctx.drawImage(canvas, 0, canvas.height - h, w, h, 0, 0, w, h);
    return pad.ctx.getImageData(0, 0, w, h);
  }

  function pixels() {
    const ratio = renderer.getPixelRatio();
    return { w: Math.round(SIZE.width * ratio), h: Math.round(SIZE.height * ratio) };
  }

  function draw(object) {
    const { w, h } = pixels();
    if (!pad || pad.canvas.width !== w || pad.canvas.height !== h) {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      pad = { canvas: c, ctx: c.getContext("2d", { willReadFrequently: true }) };
    }
    scene.add(object);
    frame(object);
    renderer.getViewport(keepViewport);
    renderer.getScissor(keepScissor);
    const keepTest = renderer.getScissorTest();
    renderer.getClearColor(keepClear);
    const keepAlpha = renderer.getClearAlpha();
    const keepShadows = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = false;
    renderer.setViewport(0, 0, SIZE.width, SIZE.height);
    renderer.setScissor(0, 0, SIZE.width, SIZE.height);
    renderer.setScissorTest(true);
    let dark;
    let light;
    try {
      dark = shot(0x000000, w, h);
      light = shot(0xffffff, w, h);
    } finally {
      scene.remove(object);
      renderer.shadowMap.enabled = keepShadows;
      renderer.setViewport(keepViewport);
      renderer.setScissor(keepScissor);
      renderer.setScissorTest(keepTest);
      renderer.setClearColor(keepClear, keepAlpha);
    }
    const out = dark;
    const a = dark.data;
    const b = light.data;
    for (let i = 0; i < a.length; i += 4) {
      /* On white minus on black = how much background shows through. */
      const through = Math.max(b[i] - a[i], b[i + 1] - a[i + 1], b[i + 2] - a[i + 2]);
      const alpha = 255 - Math.max(0, through);
      if (alpha <= 0) { a[i] = a[i + 1] = a[i + 2] = a[i + 3] = 0; continue; }
      const k = 255 / alpha;
      a[i] = Math.min(255, a[i] * k);
      a[i + 1] = Math.min(255, a[i + 1] * k);
      a[i + 2] = Math.min(255, a[i + 2] * k);
      a[i + 3] = alpha;
    }
    pad.ctx.putImageData(out, 0, 0);
    return pad.canvas.toDataURL("image/png");
  }

  return {
    size: SIZE,
    get: (key) => cache.get(key) || null,
    /* Queue an icon; `build()` returns a fresh object, freed by `release`. */
    want(key, build, release) {
      if (!cache.has(key) && !queue.has(key)) queue.set(key, { build, release });
    },
    cancel: () => queue.clear(),
    pending: () => queue.size,
    cached: () => cache.size,
    onReady(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /* Draw up to `perFrame` queued icons into the canvas corner. Returns how
       many were drawn: when > 0 the caller must draw the full scene this frame. */
    pump() {
      if (!queue.size) return 0;
      const gl = renderer.getContext();
      if (gl.isContextLost && gl.isContextLost()) return 0;
      const { w, h } = pixels();
      const canvas = renderer.domElement;
      if (canvas.width < w || canvas.height < h) return 0;
      let drawn = 0;
      for (const [key, job] of queue) {
        if (drawn >= perFrame) break;
        queue.delete(key);
        const object = job.build();
        let url = null;
        try {
          url = draw(object);
        } catch {
          url = null;
        } finally {
          if (job.release) job.release(object);
        }
        drawn += 1;
        if (!url) continue;
        cache.set(key, url);
        listeners.forEach((listener) => listener(key, url));
      }
      return drawn;
    },
    dispose() {
      queue.clear();
      listeners.clear();
      cache.clear();
    },
  };
}
