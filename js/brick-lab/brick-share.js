/* Change requests for building together (docs/plans/2026-10-04-brick-lab-multiplayer/
   D5, D6, D10; slice 02). Pure: no DOM, no Three.

   Every change to a world is a small op. The host tablet's code applies ops
   one at a time, in order, automatically — no kid confirms anything — and
   numbers each one (`seq`) so every tablet applies the same changes in the
   same order. Solo play runs the same sequencer in-process.

   Ops (pieces are { id, partId, colorId, x, y, z, rotation, by }):
     { type: "add", piece }
     { type: "move", id, x, y, z, rotation }      (a turn is a move)
     { type: "remove", id }
     { type: "recolor", id, colorId }
     { type: "pose", id, pose, x, y, z }   (pose null = rest; sitting moves the piece)
   An op may carry `expect`: the state the asker last saw. Undo sends the
   inverse op with `expect`; if the piece has changed since (a sibling moved
   it), the op is refused instead of undoing someone else's work. */

export const PROTO = 4; /* 2: a big world comes in several lines · 3: hello carries the catalog fingerprint · 4: poses (moving-parts M9) */
const ID_MAX = 64;
const Y_MAX = 200;
const FIELDS = ["partId", "colorId", "x", "y", "z", "rotation"];

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const goodId = (id) => typeof id === "string" && id.length > 0 && id.length <= ID_MAX;
const goodRotation = (r) => r === 0 || r === 90 || r === 180 || r === 270;

function copyPiece(piece) {
  const out = { id: piece.id, partId: piece.partId, colorId: piece.colorId, x: piece.x, y: piece.y, z: piece.z, rotation: piece.rotation };
  if (typeof piece.by === "string") out.by = piece.by;
  if (piece.pose) out.pose = JSON.parse(JSON.stringify(piece.pose));
  return out;
}

/* The fields `expect` compares: where it is, which part, which colour, its pose. */
function stateOf(piece) {
  if (!piece) return null;
  const out = {};
  FIELDS.forEach((key) => { out[key] = piece[key]; });
  out.pose = piece.pose ? JSON.stringify(piece.pose) : null;
  return out;
}

export function sameState(a, b) {
  if (!a || !b) return !a && !b;
  return FIELDS.every((key) => a[key] === b[key]) && (a.pose || null) === (b.pose || null);
}

function placeOk(p, rules) {
  return finite(p.x) && finite(p.y) && finite(p.z) && goodRotation(p.rotation)
    && Math.abs(p.x) <= rules.half && Math.abs(p.z) <= rules.half && p.y > 0 && p.y <= Y_MAX;
}

/* Why an op can't be applied to `world` (a Map id → piece), or null.
   `rules`: { part(id) → part|null, color(id) → bool, half, blocked?(piece, ignoreId) → bool, pose?(partId, pose) → bool }. */
export function checkOp(op, world, rules) {
  if (!op || typeof op !== "object") return "shape";
  const current = goodId(op.id) ? world.get(op.id) : null;
  if ("expect" in op && !sameState(op.expect, stateOf(op.type === "add" ? world.get(op.piece && op.piece.id) : current))) return "changed";
  switch (op.type) {
    case "add": {
      const piece = op.piece;
      if (!piece || !goodId(piece.id) || world.has(piece.id)) return "id";
      if (!rules.part(piece.partId) || !rules.color(piece.colorId)) return "catalog";
      if (piece.pose !== undefined && rules.pose && !rules.pose(piece.partId, piece.pose)) return "catalog";
      if (piece.by !== undefined && !goodId(piece.by)) return "shape";
      if (!placeOk(piece, rules)) return "place";
      if (rules.blocked && rules.blocked(piece, null)) return "blocked";
      return null;
    }
    case "move": {
      if (!current) return "id";
      const next = { ...current, x: op.x, y: op.y, z: op.z, rotation: op.rotation };
      if (!placeOk(next, rules)) return "place";
      if (rules.blocked && rules.blocked(next, current.id)) return "blocked";
      return null;
    }
    case "remove":
      return current ? null : "id";
    case "recolor":
      if (!current) return "id";
      return rules.color(op.colorId) ? null : "catalog";
    case "pose": {
      if (!current) return "id";
      const good = op.pose === null || (op.pose && typeof op.pose === "object" && typeof op.pose.p === "string" && op.pose.p.length <= 24);
      if (!good) return "shape";
      if (rules.pose && !rules.pose(current.partId, op.pose)) return "catalog";
      return placeOk({ ...current, x: op.x, y: op.y, z: op.z }, rules) ? null : "place";
    }
    default:
      return "shape";
  }
}

/* Apply a checked op to `world`; returns the inverse op, with `expect` set
   to the state this op leaves behind. */
export function applyOp(op, world) {
  switch (op.type) {
    case "add": {
      const piece = copyPiece(op.piece);
      world.set(piece.id, piece);
      return { type: "remove", id: piece.id, expect: stateOf(piece) };
    }
    case "move": {
      const piece = world.get(op.id);
      const back = { type: "move", id: op.id, x: piece.x, y: piece.y, z: piece.z, rotation: piece.rotation };
      Object.assign(piece, { x: op.x, y: op.y, z: op.z, rotation: op.rotation });
      back.expect = stateOf(piece);
      return back;
    }
    case "remove": {
      const piece = world.get(op.id);
      world.delete(op.id);
      return { type: "add", piece: copyPiece(piece), expect: null };
    }
    case "recolor": {
      const piece = world.get(op.id);
      const back = { type: "recolor", id: op.id, colorId: piece.colorId };
      piece.colorId = op.colorId;
      back.expect = stateOf(piece);
      return back;
    }
    case "pose": {
      const piece = world.get(op.id);
      const back = { type: "pose", id: op.id, pose: piece.pose || null, x: piece.x, y: piece.y, z: piece.z };
      if (op.pose) piece.pose = JSON.parse(JSON.stringify(op.pose));
      else delete piece.pose;
      Object.assign(piece, { x: op.x, y: op.y, z: op.z });
      back.expect = stateOf(piece);
      return back;
    }
    default:
      throw new Error(`unknown op ${op.type}`);
  }
}

/* The host's loop: one request at a time, in arrival order. */
export function createSequencer({ world, rules, seq = 0 }) {
  return {
    get seq() { return seq; },
    /* `req` = { id, op }. Returns { t: "apply", seq, by, req, op, inverse }
       or { t: "reject", req, why }. */
    submit(kid, req) {
      const reqId = req && goodId(req.id) ? req.id : null;
      if (!reqId || !goodId(kid)) return { t: "reject", req: reqId, why: "shape" };
      let op = req.op;
      /* A new piece is the asker's; an undone delete keeps its first owner. */
      if (op && op.type === "add" && op.piece && op.piece.by === undefined) op = { ...op, piece: { ...op.piece, by: kid } };
      const why = checkOp(op, world, rules);
      if (why) return { t: "reject", req: reqId, why };
      const { expect, ...clean } = op;
      const inverse = applyOp(clean, world);
      seq += 1;
      return { t: "apply", seq, by: kid, req: reqId, op: clean, inverse };
    },
  };
}

/* A guest's side: applies the host's numbered changes in order and asks
   for a fresh copy when one is missing. */
export function createClient({ world, seq = 0 }) {
  return {
    get seq() { return seq; },
    /* Returns the inverse of the applied op, "stale" (already seen) or
       "resync" (a change was missed: ask for a fresh copy). */
    apply(message) {
      if (message.seq <= seq) return "stale";
      if (message.seq !== seq + 1) return "resync";
      seq = message.seq;
      return applyOp(message.op, world);
    },
    reset(nextWorld, nextSeq) {
      world.clear();
      nextWorld.forEach((piece) => world.set(piece.id, copyPiece(piece)));
      seq = nextSeq;
    },
  };
}

/* Each kid's own undo in a shared world: the inverses of their own changes. */
export function createUndo(limit = 40) {
  const stack = [];
  return {
    push(inverse) {
      stack.push(inverse);
      if (stack.length > limit) stack.shift();
    },
    pop: () => stack.pop() || null,
    /* The last `count` inverses become one step, undone last first (a walk's moves). */
    group(count) {
      if (count < 2) return;
      stack.push(stack.splice(-count).reverse());
    },
    get size() { return stack.length; },
    clear() { stack.length = 0; },
  };
}
