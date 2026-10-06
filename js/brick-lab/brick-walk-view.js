/* Walking a minifig (docs/plans/2026-10-06-brick-lab-walk/, slice 02): the
   joystick walks, one finger anywhere else on the view looks around, Jump
   jumps, and the camera follows behind (W4, W5). The lab hands over a
   stand-in — the figure drawn jointed, its riders with it — and this moves
   it with the maths in brick-walk.js. The real pieces wait, hidden and
   unchanged, until the walk ends (W2, W3). The camera only moves while
   something does, so a still walker draws nothing (W8). Slice 03: the lab
   aims the crosshair whenever the camera moved (`onAim`) and does the
   building buttons (`onAct`: place, remove, turn, view). Slice 04: the
   eyes view, glided to in 300 ms (at once with reduced motion); the
   stand-in hides once the camera is past halfway into its head. Slice 06
   (W11): on a computer, W A S D or the arrows walk, Space jumps, V switches
   the view, R turns the part, a click places and a right click removes —
   only while walking; nothing here outlives the walk. */
import { behindCamera, clampLook, eyesCamera, step } from "./brick-walk.js";

const LOOK_PER_PX = 0.006; /* radians of look per CSS pixel of drag */
const STICK = 48;          /* knob travel, CSS px */
const DEAD = 0.12;         /* stick dead zone, of full travel */
const SWING = 35 * Math.PI / 180;
export const STRIDE = 20;  /* swing phase, radians a second at full stick (W7); keeps step with MOVE.speed */
/* Legs swing opposite each other, each arm opposite its leg. */
const LIMBS = { legL: 1, legR: -1, armL: -0.8, armR: 0.8 };
const VIEW_GLIDE = 0.3; /* seconds, behind ↔ eyes */
const CLICK = 10; /* CSS px a click may travel and still place (the lab's DRAG_START) */
const KEYS = {
  KeyW: "forward", ArrowUp: "forward", KeyS: "back", ArrowDown: "back",
  KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right",
};
const mix = (a, b, k) => a + (b - a) * k;
const ease = (t) => t * t * (3 - 2 * t);

/* The figure's legs and arms in a stand-in, at rest, for the walk swing (W7). */
export function limbsOf(standIn) {
  const found = [];
  standIn.traverse((node) => {
    const sign = LIMBS[node.userData.sqblJoint];
    if (sign && node.userData.sqblWalker) found.push({ node, rest: node.rotation.x, sign });
  });
  return found;
}

export function swingLimbs(limbs, phase, scale = 1) {
  const swing = Math.sin(phase) * SWING * scale;
  limbs.forEach((limb) => { limb.node.rotation.x = limb.rest + swing * limb.sign; });
}

export function createWalk({ camera, canvas, overlay, standIn, start, lift, boxes, half, view = "behind", reducedMotion = false, onExit, onAct, onAim }) {
  let state = { x: start.x, y: start.y, z: start.z, vy: 0, yaw: start.yaw, grounded: true, moving: false };
  let look = { yaw: start.yaw, pitch: 0 };
  let world = boxes;
  let jump = false;
  let last = 0;
  let phase = 0;
  let lookPointer = null;
  let aim = true; /* aim again on the next frame */
  let mode = view === "eyes" ? "eyes" : "behind";
  let blend = mode === "eyes" ? 1 : 0; /* 0 behind … 1 eyes */
  let seen = "";
  const stick = { id: null, forward: 0, strafe: 0 };
  const held = new Set(); /* walking keys down */
  let click = null; /* a left mouse press on the view: place on release if it stayed put */
  const base = overlay.querySelector("[data-walk-stick]");
  const knob = overlay.querySelector("[data-walk-knob]");
  const swingScale = reducedMotion ? 0.5 : 1;
  const limbs = limbsOf(standIn);

  function setStick(event) {
    const r = base.getBoundingClientRect();
    let dx = event.clientX - (r.left + r.width / 2);
    let dy = event.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > STICK) { dx *= STICK / len; dy *= STICK / len; }
    knob.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`;
    const live = Math.hypot(dx, dy) / STICK >= DEAD;
    stick.forward = live ? -dy / STICK : 0;
    stick.strafe = live ? dx / STICK : 0;
  }
  function releaseStick() {
    stick.id = null;
    stick.forward = 0;
    stick.strafe = 0;
    knob.style.transform = "";
  }

  const onStickDown = (event) => {
    event.preventDefault();
    if (stick.id !== null) return;
    stick.id = event.pointerId;
    try { base.setPointerCapture(event.pointerId); } catch {}
    setStick(event);
  };
  const onStickMove = (event) => { if (event.pointerId === stick.id) setStick(event); };
  const onStickUp = (event) => { if (event.pointerId === stick.id) releaseStick(); };

  /* Drag right turns the look right; drag up looks up. */
  const onLookDown = (event) => {
    if (event.pointerType === "mouse" && event.button === 2) { if (onAct) onAct("remove"); return; }
    if (lookPointer || (event.pointerType === "mouse" && event.button !== 0)) return;
    lookPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    if (event.pointerType === "mouse") click = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const onLookMove = (event) => {
    if (!lookPointer || event.pointerId !== lookPointer.id) return;
    look = clampLook({
      yaw: look.yaw - (event.clientX - lookPointer.x) * LOOK_PER_PX,
      pitch: look.pitch + (event.clientY - lookPointer.y) * LOOK_PER_PX,
    });
    lookPointer.x = event.clientX;
    lookPointer.y = event.clientY;
  };
  const onLookUp = (event) => {
    if (lookPointer && event.pointerId === lookPointer.id) lookPointer = null;
    if (!click || event.pointerId !== click.id) return;
    const still = event.type === "pointerup" && Math.hypot(event.clientX - click.x, event.clientY - click.y) < CLICK;
    click = null;
    if (still && onAct) onAct("place");
  };

  const typing = (event) => !!(event.target && event.target.closest && event.target.closest("input, textarea, select, [contenteditable]"));
  const onKeyDown = (event) => {
    if (typing(event) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (KEYS[event.code]) held.add(KEYS[event.code]);
    else if (event.code === "Space") jump = true;
    else if (event.code === "KeyV" && !event.repeat) { if (onAct) onAct("view"); }
    else if (event.code === "KeyR" && !event.repeat) { if (onAct) onAct("turn"); }
    else return;
    event.preventDefault();
  };
  const onKeyUp = (event) => { if (KEYS[event.code]) held.delete(KEYS[event.code]); };
  const onBlur = () => held.clear();
  /* The stick wins while a finger is on it; otherwise the keys walk. */
  const input = () => {
    if (stick.id !== null || !held.size) return { forward: stick.forward, strafe: stick.strafe };
    const forward = (held.has("forward") ? 1 : 0) - (held.has("back") ? 1 : 0);
    const strafe = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
    return { forward, strafe };
  };

  const onButton = (event) => {
    const button = event.target.closest("[data-walk-act]");
    if (!button) return;
    event.preventDefault();
    const act = button.dataset.walkAct;
    if (act === "jump") jump = true;
    else if (act === "exit") { if (onExit) onExit(); }
    else if (onAct) onAct(act);
  };

  base.addEventListener("pointerdown", onStickDown);
  base.addEventListener("pointermove", onStickMove);
  base.addEventListener("pointerup", onStickUp);
  base.addEventListener("pointercancel", onStickUp);
  canvas.addEventListener("pointerdown", onLookDown);
  canvas.addEventListener("pointermove", onLookMove);
  canvas.addEventListener("pointerup", onLookUp);
  canvas.addEventListener("pointercancel", onLookUp);
  overlay.addEventListener("pointerdown", onButton);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  const api = {
    /* One frame: walk, swing the limbs, follow with the camera. */
    frame(time) {
      const dt = last ? (time - last) / 1000 : 0;
      last = time;
      const move = input();
      state = step(state, { forward: move.forward, strafe: move.strafe, jump, yaw: look.yaw }, dt, world, half);
      jump = false;
      phase = state.moving ? phase + dt * STRIDE * Math.min(1, Math.hypot(move.forward, move.strafe)) : 0;
      swingLimbs(limbs, phase, swingScale);
      standIn.position.set(state.x, state.y + lift, state.z);
      standIn.rotation.y = state.yaw;
      const goal = mode === "eyes" ? 1 : 0;
      blend = reducedMotion ? goal : goal > blend ? Math.min(goal, blend + dt / VIEW_GLIDE) : Math.max(goal, blend - dt / VIEW_GLIDE);
      standIn.visible = blend < 0.5;
      const k = ease(blend);
      const back = behindCamera(state, look, world);
      const eyes = eyesCamera(state, look);
      const view = {
        position: { x: mix(back.position.x, eyes.position.x, k), y: mix(back.position.y, eyes.position.y, k), z: mix(back.position.z, eyes.position.z, k) },
        target: { x: mix(back.target.x, eyes.target.x, k), y: mix(back.target.y, eyes.target.y, k), z: mix(back.target.z, eyes.target.z, k) },
        fov: mix(back.fov, eyes.fov, k),
      };
      camera.position.set(view.position.x, view.position.y, view.position.z);
      camera.up.set(0, 1, 0);
      camera.lookAt(view.target.x, view.target.y, view.target.z);
      if (camera.fov !== view.fov) {
        camera.fov = view.fov;
        camera.updateProjectionMatrix();
      }
      camera.updateMatrixWorld();
      const now = `${view.position.x},${view.position.y},${view.position.z},${view.target.x},${view.target.y},${view.target.z}`;
      if ((aim || now !== seen) && onAim) onAim();
      aim = false;
      seen = now;
    },
    state: () => ({ ...state }),
    look: () => ({ ...look }),
    /* The pieces changed (slice 03 places and removes): new solid boxes. */
    setWorld(next) { world = next; aim = true; },
    /* The picked part, colour or turn changed: aim again. */
    reaim() { aim = true; },
    jump() { jump = true; },
    /* "behind" or "eyes" (W4). */
    view: () => mode,
    setView(next) { mode = next === "eyes" ? "eyes" : "behind"; },
    dispose() {
      base.removeEventListener("pointerdown", onStickDown);
      base.removeEventListener("pointermove", onStickMove);
      base.removeEventListener("pointerup", onStickUp);
      base.removeEventListener("pointercancel", onStickUp);
      canvas.removeEventListener("pointerdown", onLookDown);
      canvas.removeEventListener("pointermove", onLookMove);
      canvas.removeEventListener("pointerup", onLookUp);
      canvas.removeEventListener("pointercancel", onLookUp);
      overlay.removeEventListener("pointerdown", onButton);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      held.clear();
      releaseStick();
    },
  };
  return api;
}
