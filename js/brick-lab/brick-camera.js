/* Brick Lab camera a kid can drive (docs/plans/2026-10-05-brick-lab-kid-camera/).
   A view is four numbers: the ground point it looks at (x, z), the turn
   (yaw, radians: 0 = camera on +z looking towards −z) and the distance. The
   tilt follows the distance (K4), so a kid never has to set it. The maths
   below are plain functions (no Three) a node test checks; createKidCamera
   wires touch, mouse and the buttons to them and moves a Three camera.

   One finger slides the map, the ground under it staying under it (K1); two
   fingers pinch, twist and slide around their midpoint (K2); a mouse slides
   with the left button, turns with the right and zooms with the wheel (K6).

   Focus mode (moving-parts slice 02, F1): the view may look at a point
   `lift` above the ground; one finger then turns around it, pinch and wheel
   zoom without sliding, and unfocus() gives the exact earlier view back. */

const DEG = Math.PI / 180;

/* K4: 22° looking down close up, 55° far out, on a log scale of distance. */
export const TILT = Object.freeze({ near: 5, far: 220, low: 22 * DEG, high: 55 * DEG });

export function pitchFor(distance) {
  const t = (Math.log(distance) - Math.log(TILT.near)) / (Math.log(TILT.far) - Math.log(TILT.near));
  return TILT.low + (TILT.high - TILT.low) * Math.max(0, Math.min(1, t));
}

/* Camera position for a view: up `pitch` from the point it looks at (on the
   ground, or `lift` above it), out along yaw. */
export function cameraPosition(view) {
  const pitch = pitchFor(view.distance);
  const flat = Math.cos(pitch) * view.distance;
  return { x: view.x + Math.sin(view.yaw) * flat, y: Math.sin(pitch) * view.distance + (view.lift || 0), z: view.z + Math.cos(view.yaw) * flat };
}

/* The ground point (y = 0) under a screen point, in normalised device
   coordinates (−1…1, y up), for a camera looking at the view's point with +y
   up — what Three's lookAt does. Null when the ray misses the ground (above
   the horizon) or lands absurdly far. */
export function groundAt(view, ndcX, ndcY, fov, aspect) {
  const eye = cameraPosition(view);
  let fx = view.x - eye.x;
  let fy = (view.lift || 0) - eye.y;
  let fz = view.z - eye.z;
  const fl = Math.hypot(fx, fy, fz);
  fx /= fl; fy /= fl; fz /= fl;
  /* right = forward × up, up' = right × forward */
  let rx = -fz;
  let rz = fx;
  const rl = Math.hypot(rx, rz);
  rx /= rl; rz /= rl;
  const ux = -rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy;
  const h = Math.tan(fov * DEG / 2);
  const dx = fx + rx * ndcX * h * aspect + ux * ndcY * h;
  const dy = fy + uy * ndcY * h;
  const dz = fz + rz * ndcX * h * aspect + uz * ndcY * h;
  if (dy > -1e-4) return null;
  const t = -eye.y / dy;
  const x = eye.x + dx * t;
  const z = eye.z + dz * t;
  if (Math.hypot(x - view.x, z - view.z) > view.distance * 6) return null;
  return { x, z };
}

/* K5: the view's point stays over the island, the distance within limits. */
export function clampView(view, limits) {
  const r = limits.reach;
  const out = {
    x: Math.max(-r, Math.min(r, view.x)),
    z: Math.max(-r, Math.min(r, view.z)),
    yaw: view.yaw,
    distance: Math.max(limits.minDistance, Math.min(limits.maxDistance, view.distance)),
  };
  if (view.lift) out.lift = view.lift; /* focus mode only (F1) */
  return out;
}

/* Move the view's point so `anchor` (a ground point) sits under the screen
   point again — the heart of "grab the ground". */
export function keepAnchor(view, anchor, ndcX, ndcY, fov, aspect) {
  const now = groundAt(view, ndcX, ndcY, fov, aspect);
  if (!now) return view;
  return { ...view, x: view.x + anchor.x - now.x, z: view.z + anchor.z - now.z };
}

/* Gesture thresholds (K1, K2). */
export const SLIDE_START = 10; /* px, same as a piece drag (DRAG_START) */
const PINCH_START = 0.08;
const TWIST_START = 12 * DEG;
const GLIDE_MS = 130; /* velocity halves in ~90 ms: stops in ~0.4 s (K5) */
const MOUSE_TURN = 0.008; /* radians per px of right-button drag */

const ease = (t) => 1 - Math.pow(1 - t, 3);

export function createKidCamera({ camera, element, limits, view, reducedMotion = false }) {
  let state = clampView(view, limits);
  let bounds = { ...limits };
  let tween = null;
  let glide = null;
  let dirty = true;
  const pointers = new Map();
  let gesture = null;
  let moved = false; /* this touch sequence slid, pinched or turned: not a tap */
  let samples = [];
  let saved = null; /* focus mode: the view and limits to give back */

  const set = (next) => {
    const clamped = clampView(next, bounds);
    if (clamped.x !== state.x || clamped.z !== state.z || clamped.yaw !== state.yaw || clamped.distance !== state.distance || clamped.lift !== state.lift) dirty = true;
    state = clamped;
  };
  const ndc = (x, y) => {
    const r = element.getBoundingClientRect();
    return { x: ((x - r.left) / r.width) * 2 - 1, y: -(((y - r.top) / r.height) * 2 - 1), aspect: r.width / r.height };
  };
  const ground = (x, y, v = state) => {
    const p = ndc(x, y);
    return groundAt(v, p.x, p.y, camera.fov, p.aspect);
  };
  const anchorTo = (anchor, x, y) => {
    const p = ndc(x, y);
    set(keepAnchor(state, anchor, p.x, p.y, camera.fov, p.aspect));
  };
  const stopMotion = () => { tween = null; glide = null; };

  /* One finger (or the left button): slide; two: pinch / twist / slide. */
  function begin() {
    const list = Array.from(pointers.values());
    samples = [];
    if (list.length === 1) {
      const p = list[0];
      gesture = { kind: p.button === 2 || saved ? "turn" : "slide", x0: p.x, y0: p.y, active: false, anchor: ground(p.x, p.y), lastX: p.x, yaw0: state.yaw };
    } else if (list.length >= 2) {
      const [a, b] = list;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      gesture = {
        kind: "pair", anchor: saved ? null : ground(mx, my),
        span: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), angle: Math.atan2(b.y - a.y, b.x - a.x),
        distance: state.distance, yaw: state.yaw, pinch: false, twist: false, ids: [a.id, b.id],
      };
      moved = true;
    }
  }

  function track(p) {
    if (!gesture) return;
    if (gesture.kind === "slide" || gesture.kind === "turn") {
      if (!gesture.active) {
        if (Math.hypot(p.x - gesture.x0, p.y - gesture.y0) < SLIDE_START) return;
        gesture.active = true;
        moved = true;
        gesture.lastX = p.x;
      }
      if (gesture.kind === "turn") {
        set({ ...state, yaw: state.yaw - (p.x - gesture.lastX) * MOUSE_TURN });
        gesture.lastX = p.x;
        return;
      }
      if (!gesture.anchor) { gesture.anchor = ground(p.x, p.y); return; }
      const before = { x: state.x, z: state.z };
      anchorTo(gesture.anchor, p.x, p.y);
      samples.push({ t: performance.now(), dx: state.x - before.x, dz: state.z - before.z });
      if (samples.length > 6) samples.shift();
      return;
    }
    const a = pointers.get(gesture.ids[0]);
    const b = pointers.get(gesture.ids[1]);
    if (!a || !b) return;
    const span = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const ratio = gesture.span / span;
    let turn = angle - gesture.angle;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    /* Each part starts past its own threshold, then follows from there. */
    if (!gesture.pinch && Math.abs(ratio - 1) > PINCH_START) { gesture.pinch = true; gesture.span = span; gesture.distance = state.distance; }
    if (!gesture.twist && Math.abs(turn) > TWIST_START) { gesture.twist = true; gesture.angle = angle; gesture.yaw = state.yaw; }
    const next = { ...state };
    if (gesture.pinch) next.distance = gesture.distance * (gesture.span / span);
    if (gesture.twist) {
      let since = angle - gesture.angle;
      since = Math.atan2(Math.sin(since), Math.cos(since));
      /* Fingers turning clockwise on screen turn the island with them. */
      next.yaw = gesture.yaw + since;
    }
    set(next);
    if (gesture.anchor) anchorTo(gesture.anchor, (a.x + b.x) / 2, (a.y + b.y) / 2);
  }

  const api = {
    enabled: true,

    /* True when the touch sequence that just ended moved the view: the lift
       must not count as a tap. */
    moved: () => moved,
    gesturing: () => pointers.size > 0 && moved,

    view: () => ({ ...state, pitch: pitchFor(state.distance) }),
    focused: () => !!saved,
    /* F1: look at a point in the air (a piece's middle) from `distance`, with
       focus limits; one finger now turns around it. */
    focusOn({ x, y, z, distance, minDistance, maxDistance }, ms = 400) {
      if (!saved) saved = { view: { ...(tween ? tween.to : state) }, bounds: { ...bounds } };
      bounds = { ...bounds, minDistance, maxDistance, reach: Math.max(bounds.reach, Math.abs(x), Math.abs(z)) };
      api.animateTo({ x, z, lift: y, distance }, ms);
    },
    unfocus(ms = 400) {
      if (!saved) return;
      const back = saved;
      saved = null;
      bounds = back.bounds;
      api.animateTo({ ...back.view, lift: 0 }, ms);
    },
    setLimits(next) { bounds = { ...bounds, ...next }; set(state); },
    jumpTo(next) { stopMotion(); set({ ...state, ...next }); },
    animateTo(next, ms = 450) {
      glide = null;
      const to = clampView({ ...state, ...next }, bounds);
      if (reducedMotion || ms <= 0) { tween = null; set(to); return; }
      tween = { from: { ...state }, to, start: performance.now(), ms };
    },
    /* K3 buttons: from where a running tween is heading, so taps add up. */
    turn(deg, ms = 300) {
      const base = tween ? tween.to : state;
      api.animateTo({ ...base, yaw: base.yaw + deg * DEG }, ms);
    },
    zoom(factor, ms = 250) {
      const base = tween ? tween.to : state;
      api.animateTo({ ...base, distance: base.distance * factor }, ms);
    },

    /* Called every frame; true when the camera moved. */
    update(time = performance.now()) {
      if (tween) {
        const t = Math.max(0, Math.min(1, (time - tween.start) / tween.ms));
        const k = ease(t);
        const f = tween.from;
        const g = tween.to;
        set({ x: f.x + (g.x - f.x) * k, z: f.z + (g.z - f.z) * k, yaw: f.yaw + (g.yaw - f.yaw) * k, distance: f.distance + (g.distance - f.distance) * k,
          lift: (f.lift || 0) + ((g.lift || 0) - (f.lift || 0)) * k });
        if (t >= 1) tween = null;
      } else if (glide) {
        const dt = Math.min(50, time - glide.last);
        glide.last = time;
        set({ ...state, x: state.x + glide.vx * dt, z: state.z + glide.vz * dt });
        const keep = Math.exp(-dt / GLIDE_MS);
        glide.vx *= keep;
        glide.vz *= keep;
        if (Math.hypot(glide.vx, glide.vz) < 0.0004) glide = null;
      }
      if (!dirty) return false;
      dirty = false;
      const eye = cameraPosition(state);
      camera.position.set(eye.x, eye.y, eye.z);
      camera.up.set(0, 1, 0);
      camera.lookAt(state.x, state.lift || 0, state.z);
      camera.updateMatrixWorld();
      return true;
    },

    dispose() {
      element.removeEventListener("pointerdown", onDown);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointercancel", onUp);
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("contextmenu", onMenu);
      pointers.clear();
    },
  };

  function onDown(event) {
    if (!api.enabled) return;
    if (event.pointerType === "mouse" && event.button !== 0 && event.button !== 2) return;
    if (!pointers.size) moved = false;
    stopMotion();
    pointers.set(event.pointerId, { id: event.pointerId, x: event.clientX, y: event.clientY, button: event.pointerType === "mouse" ? event.button : 0 });
    try { element.setPointerCapture(event.pointerId); } catch {}
    begin();
  }

  function onMove(event) {
    const p = pointers.get(event.pointerId);
    if (!p) return;
    if (!api.enabled) { pointers.clear(); gesture = null; return; }
    p.x = event.clientX;
    p.y = event.clientY;
    track(p);
  }

  function onUp(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    const sliding = gesture && gesture.kind === "slide" && gesture.active;
    if (!pointers.size && sliding && !reducedMotion && api.enabled) {
      /* Release glide (K5) from the last ~80 ms of the slide. */
      const now = performance.now();
      const recent = samples.filter((s) => now - s.t < 80);
      if (recent.length >= 2) {
        const span = Math.max(16, now - recent[0].t);
        const vx = recent.reduce((sum, s) => sum + s.dx, 0) / span;
        const vz = recent.reduce((sum, s) => sum + s.dz, 0) / span;
        if (Math.hypot(vx, vz) > 0.002) glide = { vx, vz, last: now };
      }
    }
    gesture = null;
    /* A finger left a pinch: the other one keeps sliding from where it is. */
    if (pointers.size) begin();
  }

  function onWheel(event) {
    if (!api.enabled) return;
    event.preventDefault();
    stopMotion();
    const anchor = saved ? null : ground(event.clientX, event.clientY);
    set({ ...state, distance: state.distance * Math.exp(event.deltaY * 0.0012) });
    if (anchor) anchorTo(anchor, event.clientX, event.clientY);
  }

  const onMenu = (event) => event.preventDefault();

  element.style.touchAction = "none";
  element.addEventListener("pointerdown", onDown);
  element.addEventListener("pointermove", onMove);
  element.addEventListener("pointerup", onUp);
  element.addEventListener("pointercancel", onUp);
  element.addEventListener("wheel", onWheel, { passive: false });
  element.addEventListener("contextmenu", onMenu);
  api.update();
  return api;
}
