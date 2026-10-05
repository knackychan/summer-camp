/* Brick Lab poses (docs/plans/2026-10-05-brick-lab-moving-parts/ M1, M5, M6, M12).
   Pure: no DOM, no Three, so node tests and check.mjs read it directly.

   A jointed part lists `joints`: { name: { at: [x, y, z], axis, step, min, max } }
   — the pivot in part space (x across, y up from the part's floor, z to its
   front), the axis it turns on and, in degrees, how far one ↻ turns and the
   range it wraps inside. Its `body` names its pose list below. A piece's pose
   is { p: presetId, t: { joint: steps } }; no pose means the first preset. */

/* Sitting (M12): the legs are 0.8 thick, so the body drops by the part of the
   thigh under the hip pivot, and moves half a stud back onto the back row. */
export const SIT = Object.freeze({ drop: 0.85, back: 0.5 });

/* `icon` stands on a pose card until its picture is drawn (slice 02, F3):
   Emoji 5.0 or older, so Android 8 draws it. */
const preset = (id, en, zh, icon, angles = {}, extra = {}) =>
  Object.freeze({ id, label: Object.freeze([en, zh]), icon, angles: Object.freeze(angles), ...extra });

export const POSES = Object.freeze({
  minifig: Object.freeze([
    preset("stand", "Stand", "站好", "🙂"),
    preset("sit", "Sit", "坐下", "💺", { legL: -90, legR: -90 }, { sit: true }),
    preset("wave", "Wave", "揮手", "👋", { armR: -135 }),
    preset("cheer", "Cheer", "歡呼", "🙌", { armL: -180, armR: -180 }),
    preset("walk", "Walk", "走路", "🚶", { armL: 45, armR: -45, legL: -22.5, legR: 22.5 }),
    preset("point", "Point", "指向", "👉", { armR: -90 }),
    preset("lookL", "Look left", "看左邊", "⬅️", { head: 45 }),
    preset("lookR", "Look right", "看右邊", "➡️", { head: -45 }),
  ]),
  /* The Sitting Minifigure part comes seated: its rest is sitting. */
  minifigSeated: Object.freeze([
    preset("seated", "Sit", "坐好", "💺"),
    preset("wave", "Wave", "揮手", "👋", { armR: -135 }),
    preset("cheer", "Cheer", "歡呼", "🙌", { armL: -180, armR: -180 }),
    preset("lookL", "Look left", "看左邊", "⬅️", { head: 45 }),
    preset("lookR", "Look right", "看右邊", "➡️", { head: -45 }),
  ]),
});

/* What each joint is called on a focus-mode chip (slice 02). */
export const JOINT_LABELS = Object.freeze({
  head: Object.freeze(["Head", "頭"]),
  armL: Object.freeze(["Left arm", "左手"]),
  armR: Object.freeze(["Right arm", "右手"]),
  legL: Object.freeze(["Left leg", "左腳"]),
  legR: Object.freeze(["Right leg", "右腳"]),
});

const round = (n) => Math.round(n * 1000) / 1000;

/* The presets a part can take: those whose every joint it has. */
export function posesFor(part) {
  if (!part || !part.joints) return [];
  return (POSES[part.body] || []).filter((p) => Object.keys(p.angles).every((j) => part.joints[j]));
}

/* Every angle a joint can stop at, min → max. */
export function stopsOf(def) {
  const out = [];
  for (let a = def.min; a <= def.max + 1e-9; a += def.step) out.push(round(a));
  return out;
}

/* A saved or asked-for pose made safe for this part; null means rest. */
export function cleanPose(part, raw) {
  if (!part || !part.joints || !raw || typeof raw !== "object") return null;
  const presets = posesFor(part);
  if (!presets.length) return null;
  const chosen = presets.find((p) => p.id === raw.p) || presets[0];
  const t = {};
  if (raw.t && typeof raw.t === "object") {
    Object.keys(raw.t).sort().forEach((joint) => {
      const steps = raw.t[joint];
      if (part.joints[joint] && Number.isInteger(steps) && steps !== 0 && Math.abs(steps) <= 64) t[joint] = steps;
    });
  }
  const tweaked = Object.keys(t).length > 0;
  if (chosen === presets[0] && !tweaked) return null;
  return tweaked ? { p: chosen.id, t } : { p: chosen.id };
}

export function samePose(a, b) {
  return JSON.stringify(a || null) === JSON.stringify(b || null);
}

function presetOf(part, pose) {
  const presets = posesFor(part);
  return (pose && presets.find((p) => p.id === pose.p)) || presets[0] || null;
}

/* Degrees for every joint of the part in this pose. */
export function jointAngles(part, pose) {
  const out = {};
  if (!part || !part.joints) return out;
  const chosen = presetOf(part, pose);
  Object.keys(part.joints).forEach((joint) => {
    const stops = stopsOf(part.joints[joint]);
    const base = chosen && chosen.angles[joint] != null ? chosen.angles[joint] : 0;
    let index = stops.findIndex((a) => Math.abs(a - base) < 1e-6);
    if (index < 0) index = stops.findIndex((a) => Math.abs(a) < 1e-6);
    const steps = pose && pose.t && pose.t[joint] ? pose.t[joint] : 0;
    out[joint] = stops[(((index + steps) % stops.length) + stops.length) % stops.length];
  });
  return out;
}

export function isSitting(part, pose) {
  const chosen = pose ? presetOf(part, pose) : null;
  return !!(chosen && chosen.sit);
}

/* The box a piece fills in this pose: a sitting minifigure is 2 deep and lower (M12). */
export function poseShape(part, pose) {
  if (!isSitting(part, pose)) return part;
  return { ...part, depth: 2, height: round(part.height - SIT.drop), top: round(part.top - SIT.drop) };
}

/* How far the piece's centre moves when it sits (+1) or stands up (−1):
   half a stud towards its front, which turns with the piece. */
export function sitShift(rotation, sign = 1) {
  const r = rotation * Math.PI / 180;
  return { dx: round(Math.sin(r) * SIT.back * sign) + 0, dz: round(Math.cos(r) * SIT.back * sign) + 0 };
}

/* Where the standing model sits inside its sitting box, in part space before
   the piece's turn: lower by the drop less the box's own drop, half a stud back. */
export function sitOffset() {
  return { y: -SIT.drop / 2, z: -SIT.back };
}
