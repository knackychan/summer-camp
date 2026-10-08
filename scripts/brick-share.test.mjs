import test from "node:test";
import assert from "node:assert/strict";
import { COLORS, getPart, PARTS } from "../js/brick-lab/brick-catalog.js";
import {
  applyOp, checkOp, cleanWalk, createClaims, createClient, createSequencer, createUndo, groupIds, PROTO, sameState,
} from "../js/brick-lab/brick-share.js";

const rules = {
  part: (id) => PARTS.find((p) => p.id === id) || null,
  color: (id) => id in COLORS,
  half: 32,
};
const brick = (id, x = 0.5, z = 0, extra = {}) => ({ id, partId: "brick_2x4", colorId: "red", x, y: 0.6, z, rotation: 0, ...extra });
const worldOf = (...pieces) => new Map(pieces.map((p) => [p.id, { ...p }]));
const clone = (world) => new Map(Array.from(world, ([id, p]) => [id, { ...p }]));

test("each op applies, and its inverse puts the world back", () => {
  const ops = [
    { type: "add", piece: brick("b", 4.5, 4) },
    { type: "move", id: "a", x: 2.5, y: 0.6, z: 1, rotation: 90 },
    { type: "recolor", id: "a", colorId: "blue" },
    { type: "remove", id: "a" },
  ];
  for (const op of ops) {
    const world = worldOf(brick("a"));
    const before = clone(world);
    assert.equal(checkOp(op, world, rules), null, op.type);
    const inverse = applyOp(op, world);
    assert.notDeepEqual(world, before, `${op.type} changed the world`);
    assert.equal(checkOp(inverse, world, rules), null, `${op.type} inverse is valid right away`);
    applyOp(inverse, world);
    assert.deepEqual(world, before, `${op.type} inverse restores`);
  }
});

test("the host refuses what the catalog or the plate can't hold", () => {
  const world = worldOf(brick("a"));
  const bad = [
    [{ type: "add", piece: brick("a") }, "id"],
    [{ type: "add", piece: { ...brick("n"), partId: "hoverboard" } }, "catalog"],
    [{ type: "add", piece: { ...brick("n"), colorId: "plaid" } }, "catalog"],
    [{ type: "add", piece: brick("n", 40) }, "place"],
    [{ type: "add", piece: { ...brick("n"), y: -1 } }, "place"],
    [{ type: "add", piece: { ...brick("n"), rotation: 45 } }, "place"],
    [{ type: "add", piece: { ...brick("n"), x: NaN } }, "place"],
    [{ type: "add", piece: { ...brick("n"), id: "x".repeat(65) } }, "id"],
    [{ type: "move", id: "ghost", x: 0, y: 0.6, z: 0, rotation: 0 }, "id"],
    [{ type: "move", id: "a", x: 0, y: 0.6, z: -33, rotation: 0 }, "place"],
    [{ type: "remove", id: "ghost" }, "id"],
    [{ type: "recolor", id: "a", colorId: "plaid" }, "catalog"],
    [{ type: "explode", id: "a" }, "shape"],
    [null, "shape"],
  ];
  for (const [op, why] of bad) assert.equal(checkOp(op, world, rules), why, JSON.stringify(op));
});

test("rail rules come from the lab: a blocked spot is refused", () => {
  const world = worldOf(brick("a"));
  const strict = { ...rules, blocked: (piece) => piece.x > 10 };
  assert.equal(checkOp({ type: "add", piece: brick("n", 12) }, world, strict), "blocked");
  assert.equal(checkOp({ type: "move", id: "a", x: 12, y: 0.6, z: 0, rotation: 0 }, world, strict), "blocked");
  assert.equal(checkOp({ type: "add", piece: brick("n", 2) }, world, strict), null);
});

test("sequencer: in order, numbered, and the asker owns a new piece", () => {
  const world = worldOf();
  const host = createSequencer({ world, rules });
  const a = host.submit("maya", { id: "r1", op: { type: "add", piece: brick("p1") } });
  const b = host.submit("leo", { id: "r2", op: { type: "add", piece: brick("p1") } });
  const c = host.submit("leo", { id: "r3", op: { type: "add", piece: { ...brick("p2", 6), by: "maya" } } });
  assert.equal(a.t, "apply");
  assert.equal(a.seq, 1);
  assert.equal(world.get("p1").by, "maya");
  assert.deepEqual([b.t, b.why], ["reject", "id"], "the same id twice: the second loses");
  assert.equal(c.seq, 2, "a rejected request takes no number");
  assert.equal(host.seq, 2);
  assert.equal(host.submit("", { id: "r4", op: { type: "remove", id: "p1" } }).t, "reject");
  assert.equal(host.submit("leo", { op: { type: "remove", id: "p1" } }).t, "reject");
});

test("two kids grab the same brick: both moves apply in order, the later one wins", () => {
  const world = worldOf(brick("a"));
  const host = createSequencer({ world, rules });
  host.submit("maya", { id: "m", op: { type: "move", id: "a", x: 4.5, y: 0.6, z: 0, rotation: 0 } });
  host.submit("leo", { id: "l", op: { type: "move", id: "a", x: -4.5, y: 0.6, z: 0, rotation: 0 } });
  assert.equal(world.get("a").x, -4.5);
  const gone = host.submit("maya", { id: "m2", op: { type: "remove", id: "a" } });
  const late = host.submit("leo", { id: "l2", op: { type: "recolor", id: "a", colorId: "blue" } });
  assert.equal(gone.t, "apply");
  assert.deepEqual([late.t, late.why], ["reject", "id"]);
});

test("shared undo: only your own last change, and not once a sibling changed it", () => {
  const world = worldOf();
  const host = createSequencer({ world, rules });
  const maya = createUndo();
  const placed = host.submit("maya", { id: "1", op: { type: "add", piece: brick("p") } });
  maya.push(placed.inverse);
  const moved = host.submit("maya", { id: "2", op: { type: "move", id: "p", x: 2.5, y: 0.6, z: 0, rotation: 0 } });
  maya.push(moved.inverse);
  host.submit("leo", { id: "3", op: { type: "recolor", id: "p", colorId: "green" } });
  const undo = host.submit("maya", { id: "4", op: maya.pop() });
  assert.deepEqual([undo.t, undo.why], ["reject", "changed"], "Leo recoloured it: Maya's undo is refused");
  assert.equal(world.get("p").colorId, "green");
  assert.equal(world.get("p").x, 2.5);

  const world2 = worldOf();
  const host2 = createSequencer({ world: world2, rules });
  const undo2 = createUndo();
  undo2.push(host2.submit("maya", { id: "1", op: { type: "add", piece: brick("q") } }).inverse);
  undo2.push(host2.submit("maya", { id: "2", op: { type: "move", id: "q", x: 2.5, y: 0.6, z: 0, rotation: 90 } }).inverse);
  assert.equal(host2.submit("maya", { id: "3", op: undo2.pop() }).t, "apply");
  assert.equal(world2.get("q").x, 0.5);
  assert.equal(world2.get("q").rotation, 0);
  assert.equal(host2.submit("maya", { id: "4", op: undo2.pop() }).t, "apply");
  assert.equal(world2.size, 0);
  assert.equal(undo2.pop(), null);
});

test("undo group: a walk's moves come back off the stack as one step, last first (walk plan W2)", () => {
  const undo = createUndo();
  undo.push({ type: "remove", id: "earlier" });
  undo.push({ type: "move", id: "fig" });
  undo.push({ type: "move", id: "hat" });
  undo.group(2);
  assert.equal(undo.size, 2);
  assert.deepEqual(undo.pop(), [{ type: "move", id: "hat" }, { type: "move", id: "fig" }]);
  undo.group(1);
  assert.deepEqual(undo.pop(), { type: "remove", id: "earlier" }, "a group of one stays a single op");
  undo.group(0);
  assert.equal(undo.size, 0);
});

test("undoing a delete brings the brick back with its first owner", () => {
  const world = worldOf(brick("a", 0.5, 0, { by: "leo" }));
  const host = createSequencer({ world, rules });
  const removed = host.submit("maya", { id: "1", op: { type: "remove", id: "a" } });
  assert.equal(host.submit("maya", { id: "2", op: removed.inverse }).t, "apply");
  assert.equal(world.get("a").by, "leo");
});

test("guest client: applies in order, skips repeats, asks for a fresh copy on a gap", () => {
  const hostWorld = worldOf();
  const host = createSequencer({ world: hostWorld, rules });
  const guestWorld = worldOf();
  const guest = createClient({ world: guestWorld });
  const m1 = host.submit("maya", { id: "1", op: { type: "add", piece: brick("p") } });
  const m2 = host.submit("maya", { id: "2", op: { type: "move", id: "p", x: 3.5, y: 0.6, z: 0, rotation: 0 } });
  const m3 = host.submit("maya", { id: "3", op: { type: "recolor", id: "p", colorId: "blue" } });
  assert.equal(typeof guest.apply(m1), "object");
  assert.equal(guest.apply(m1), "stale");
  assert.equal(guest.apply(m3), "resync");
  guest.apply(m2);
  guest.apply(m3);
  assert.deepEqual(guestWorld, hostWorld);
  guest.reset(Array.from(hostWorld.values()), host.seq);
  assert.equal(guest.seq, 3);
  assert.deepEqual(guestWorld, hostWorld);
});

test("sameState compares place, part and colour only", () => {
  assert.ok(sameState(brick("a"), { ...brick("a"), by: "leo" }));
  assert.ok(!sameState(brick("a"), brick("a", 1.5)));
  assert.ok(sameState(null, null));
  assert.ok(!sameState(null, brick("a")));
});

test("the real catalog: every part and colour passes the checks", () => {
  const world = worldOf();
  PARTS.forEach((part, i) => {
    const op = { type: "add", piece: { id: `p${i}`, partId: part.id, colorId: Object.keys(COLORS)[i % 13], x: 0, y: getPart(part.id).height / 2 || 0.1, z: 0, rotation: 0 } };
    assert.equal(checkOp(op, world, rules), null, part.id);
  });
});

const fig = (extra = {}) => ({ id: "f", partId: "fig_boy", colorId: "red", x: 0, y: 2.025, z: 0.5, rotation: 0, ...extra });

test("a pose op sets the pose and the spot, and its inverse puts both back", () => {
  const world = worldOf(fig());
  const op = { type: "pose", id: "f", pose: { p: "sit" }, x: 0, y: 1.6, z: 1 };
  assert.equal(checkOp(op, world, rules), null);
  const back = applyOp(op, world);
  assert.deepEqual(world.get("f").pose, { p: "sit" });
  assert.equal(world.get("f").z, 1);
  assert.equal(checkOp(back, world, rules), null);
  applyOp(back, world);
  assert.equal("pose" in world.get("f"), false);
  assert.equal(world.get("f").z, 0.5);
});

test("a pose op is refused for a missing piece, a bad shape, the rules' veto or off the plate", () => {
  const world = worldOf(fig());
  assert.equal(checkOp({ type: "pose", id: "nope", pose: null, x: 0, y: 2, z: 0.5 }, world, rules), "id");
  assert.equal(checkOp({ type: "pose", id: "f", pose: "wave", x: 0, y: 2, z: 0.5 }, world, rules), "shape");
  assert.equal(checkOp({ type: "pose", id: "f", pose: { p: "wave" }, x: 0, y: 2, z: 0.5 }, world, { ...rules, pose: () => false }), "catalog");
  assert.equal(checkOp({ type: "pose", id: "f", pose: { p: "wave" }, x: 99, y: 2, z: 0.5 }, world, rules), "place");
});

test("a removed posed piece comes back posed; expect sees a pose change", () => {
  const world = worldOf(fig({ pose: { p: "wave" } }));
  const back = applyOp({ type: "remove", id: "f" }, world);
  applyOp(back, world);
  assert.deepEqual(world.get("f").pose, { p: "wave" });
  const before = { ...world.get("f") };
  applyOp({ type: "pose", id: "f", pose: { p: "cheer" }, x: 0, y: 2.025, z: 0.5 }, world);
  assert.equal(checkOp({ type: "move", id: "f", x: 2, y: 2.025, z: 0.5, rotation: 0, expect: { ...before, pose: JSON.stringify({ p: "wave" }) } }, world, rules), "changed");
});

test("PROTO is 7: a piece's assembly group is new on the wire", () => {
  assert.equal(PROTO, 7);
});

/* Assemblies plan slice 02 (A6): a wall is one atomic batch of adds. */
const batchOf = (n, from = 0) => ({ type: "batch", ops: Array.from({ length: n }, (_, i) => ({ type: "add", piece: brick(`w${from + i}`, -20.5 + (i % 16) * 2, 10 + Math.floor(i / 16) * 4) })) });

test("a batch of adds applies all; its inverse removes all in one step", () => {
  const world = worldOf(brick("a"));
  const host = createSequencer({ world, rules });
  const done = host.submit("maya", { id: "1", op: batchOf(8) });
  assert.equal(done.t, "apply");
  assert.equal(done.seq, 1, "one batch, one number");
  assert.equal(world.size, 9);
  assert.ok(done.op.ops.every((member) => member.piece.by === "maya"), "every brick is the asker's");
  assert.equal(done.inverse.type, "batch");
  assert.deepEqual(done.inverse.ops.map((member) => member.type), Array(8).fill("remove"));
  assert.equal(done.inverse.ops[0].id, "w7", "last first");
  assert.ok(done.inverse.ops.every((member) => member.expect && member.expect.partId === "brick_2x4"));
  const undo = host.submit("maya", { id: "2", op: done.inverse });
  assert.equal(undo.t, "apply");
  assert.deepEqual(Array.from(world.keys()), ["a"]);
});

test("one bad member rejects the whole batch and leaves the world unchanged", () => {
  const world = worldOf(brick("a"));
  const before = clone(world);
  const host = createSequencer({ world, rules });
  const bad = batchOf(4);
  bad.ops[2] = { type: "add", piece: brick("far", 40) };
  assert.deepEqual([host.submit("maya", { id: "1", op: bad }).why, world], ["place", before]);
  const taken = batchOf(4);
  taken.ops[3] = { type: "add", piece: brick("a", 6) };
  assert.equal(checkOp(taken, world, rules), "id", "an id already on the plate");
  const twice = batchOf(3);
  twice.ops[2] = { type: "add", piece: brick("w0", 9) };
  assert.equal(checkOp(twice, world, rules), "id", "the same id twice inside a batch");
  assert.deepEqual(world, before);
  assert.equal(host.seq, 0);
});

test("a batch is 1–64 adds or removes, never mixed or nested", () => {
  const world = worldOf(brick("a"), brick("b", 4.5));
  assert.equal(checkOp(batchOf(64), world, rules), null);
  assert.equal(checkOp(batchOf(65), world, rules), "shape");
  assert.equal(checkOp({ type: "batch", ops: [] }, world, rules), "shape");
  assert.equal(checkOp({ type: "batch" }, world, rules), "shape");
  assert.equal(checkOp({ type: "batch", ops: [{ type: "add", piece: brick("n", 8.5) }, { type: "remove", id: "a" }] }, world, rules), "shape");
  assert.equal(checkOp({ type: "batch", ops: [{ type: "move", id: "a", x: 2.5, y: 0.6, z: 0, rotation: 0 }] }, world, rules), "shape");
  assert.equal(checkOp({ type: "batch", ops: [batchOf(2)] }, world, rules), "shape");
  assert.equal(checkOp({ type: "batch", ops: [{ type: "remove", id: "a" }, { type: "remove", id: "b" }] }, world, rules), null);
  assert.equal(checkOp({ type: "batch", ops: [{ type: "remove", id: "a" }, { type: "remove", id: "a" }] }, world, rules), "id");
});

test("a sibling changes one brick of the wall: the undo fails as a whole", () => {
  const world = worldOf();
  const host = createSequencer({ world, rules });
  const done = host.submit("maya", { id: "1", op: batchOf(5) });
  host.submit("leo", { id: "2", op: { type: "recolor", id: "w2", colorId: "blue" } });
  const before = clone(world);
  const undo = host.submit("maya", { id: "3", op: done.inverse });
  assert.deepEqual([undo.t, undo.why], ["reject", "changed"]);
  assert.deepEqual(world, before, "nothing removed");
});

test("an undo batch that takes a walked figure is busy for the others (W13)", () => {
  const claims = createClaims();
  claims.claim("fig", "leo", ["fig", "hat"]);
  assert.equal(claims.busy({ type: "batch", ops: [{ type: "remove", id: "w1" }, { type: "remove", id: "hat" }] }, "maya"), "leo");
  assert.equal(claims.busy({ type: "batch", ops: [{ type: "remove", id: "w1" }] }, "maya"), null);
  assert.equal(claims.busy(batchOf(3), "maya"), null, "adds are never busy");
});

test("a guest applies a batch like any op", () => {
  const hostWorld = worldOf();
  const host = createSequencer({ world: hostWorld, rules });
  const guestWorld = worldOf();
  const guest = createClient({ world: guestWorld });
  const m1 = host.submit("maya", { id: "1", op: batchOf(6) });
  assert.equal(guest.apply(m1).type, "batch");
  assert.deepEqual(guestWorld, hostWorld);
  assert.ok(m1.op.ops.every((member) => !("expect" in member)), "the broadcast carries no expects");
});

test("walk messages: claims, positions and releases are checked and cleaned (W12)", () => {
  assert.deepEqual(cleanWalk({ t: "walk-claim", id: "fig", ids: ["fig", "hat", 3, ""], extra: 1 }), { t: "walk-claim", id: "fig", ids: ["fig", "hat"] });
  assert.deepEqual(cleanWalk({ t: "walk-claim", id: "fig" }), { t: "walk-claim", id: "fig", ids: ["fig"] }, "the figure is always in its own claim");
  const pos = { t: "walk-pos", id: "fig", x: 1.5, y: 1.2, z: -3, yaw: 0.5, view: "eyes", moving: true };
  assert.deepEqual(cleanWalk({ ...pos, kid: "leo" }), pos, "a position carries no kid: the host adds who walks");
  assert.equal(cleanWalk({ ...pos, view: "upside" }).view, "behind");
  assert.equal(cleanWalk({ ...pos, x: Infinity }), null);
  assert.equal(cleanWalk({ ...pos, y: 900 }), null, "no higher than any piece may go");
  assert.equal(cleanWalk({ ...pos, x: 99 }), null, "off the island");
  assert.deepEqual(cleanWalk({ t: "walk-release", id: "fig" }), { t: "walk-release", id: "fig" });
  assert.equal(cleanWalk({ t: "walk-claim", id: "" }), null);
  assert.equal(cleanWalk({ t: "walk-jump", id: "fig" }), null);
  assert.equal(cleanWalk({ t: "walk-claim", id: "fig", ids: Array.from({ length: 40 }, (_, i) => `p${i}`) }).ids.length, 16, "at most 16 riders");
});

test("walk claims: first wins, a walked figure and its riders are busy for everyone else (W13)", () => {
  const claims = createClaims();
  assert.equal(claims.claim("fig", "leo", ["fig", "hat"]), true);
  assert.equal(claims.claim("fig", "lili", ["fig"]), false, "Lili can't take Leo's figure");
  assert.equal(claims.claim("hat", "lili", ["hat"]), false, "nor the hat riding on it");
  assert.equal(claims.claim("fig", "leo", ["fig", "hat"]), true, "Leo asking again keeps it");
  assert.equal(claims.busy({ type: "move", id: "fig" }, "lili"), "leo");
  assert.equal(claims.busy({ type: "remove", id: "hat" }, "lili"), "leo");
  assert.equal(claims.busy({ type: "move", id: "fig" }, "leo"), null, "the walker's own moves go through");
  assert.equal(claims.busy({ type: "add", piece: { id: "new" } }, "lili"), null);
  assert.equal(claims.busyFor("hat", "maya"), "leo");
  assert.deepEqual(claims.list(), [["fig", "leo", ["fig", "hat"]]]);
  assert.equal(claims.release("fig", "lili"), false, "only the walker lets go");
  assert.equal(claims.claim("boy", "lili", ["boy"]), true);
  assert.deepEqual(claims.releaseKid("leo"), ["fig"], "a tablet that leaves lets go of its walks");
  assert.equal(claims.busyFor("fig", "maya"), null);
  assert.equal(claims.release("boy", "lili"), true);
  claims.set([["x", "leo", ["x"]], ["bad"]]);
  assert.deepEqual(claims.list(), [["x", "leo", ["x"]]], "a guest mirrors the host's list, cleaned");
});

/* Remove a whole wall: the pieces of one assembly share a `group`. */
test("a wall's group rides on its pieces; removing the group is one batch, undone in one step", () => {
  const world = worldOf(brick("a"));
  const host = createSequencer({ world, rules });
  const wall = batchOf(6);
  wall.ops.forEach((member) => { member.piece.group = "wall-1"; });
  assert.equal(host.submit("maya", { id: "1", op: wall }).t, "apply");
  assert.equal(world.get("w3").group, "wall-1");
  assert.deepEqual(groupIds(world, "w3"), ["w0", "w1", "w2", "w3", "w4", "w5"]);
  assert.deepEqual(groupIds(world, "a"), [], "a piece placed alone has no group");
  const gone = host.submit("lucien", { id: "2", op: { type: "batch", ops: groupIds(world, "w3").map((id) => ({ type: "remove", id })) } });
  assert.equal(gone.t, "apply");
  assert.deepEqual(Array.from(world.keys()), ["a"]);
  assert.equal(host.submit("lucien", { id: "3", op: gone.inverse }).t, "apply");
  assert.equal(world.size, 7);
  assert.equal(world.get("w0").group, "wall-1", "Undo brings the group back");
  assert.equal(world.get("w0").by, "maya", "and the first owner");
});

test("a group id must be a short string", () => {
  const world = worldOf();
  assert.equal(checkOp({ type: "add", piece: brick("n", 0.5, 0, { group: 5 }) }, world, rules), "shape");
  assert.equal(checkOp({ type: "add", piece: brick("n", 0.5, 0, { group: "x".repeat(65) }) }, world, rules), "shape");
  assert.equal(checkOp({ type: "add", piece: brick("n", 0.5, 0, { group: "wall-2" }) }, world, rules), null);
});
