import test from "node:test";
import assert from "node:assert/strict";
import { COLORS, PARTS } from "../js/brick-lab/brick-catalog.js";
import { createSequencer, PROTO } from "../js/brick-lab/brick-share.js";
import { BrickTogether } from "../js/brick-lab/brick-together.js";
import { createLanSession, createLoopback, LINE_MAX } from "../js/game-services/lan-session.js";

const rules = { part: (id) => PARTS.find((p) => p.id === id) || null, color: (id) => id in COLORS, half: 32 };
const brick = (id, x = 0.5, z = 0) => ({ id, partId: "brick_2x4", colorId: "red", x, y: 0.6, z, rotation: 0 });
const flush = async (n = 6) => { for (let i = 0; i < n; i += 1) await new Promise((done) => setTimeout(done, 0)); };
const plain = (world) => Array.from(world.values()).map((p) => ({ ...p })).sort((a, b) => a.id.localeCompare(b.id));

/* What BrickTogether needs from the lab, without DOM or Three. */
function fakeLab(kid) {
  const lab = {
    kidId: kid, pieces: new Map(), sequencer: null, events: [],
    kidName: (k) => k, currentWorldName: () => "Castle 城堡",
    renderJoin() {}, renderCrew() {}, sharedChanged() {}, showOp() {}, afterRemoteOp() {}, updateUndoUI() {},
    crewToast: (k, joined) => lab.events.push(["crew", k, joined]),
    loadShared(world) { lab.pieces.clear(); world.forEach((p) => lab.pieces.set(p.id, { ...p })); lab.events.push(["loaded", world.length]); },
    ownChangeApplied: (op) => lab.events.push(["mine", op.type]),
    ownChangeRefused: (op, why) => lab.events.push(["refused", why]),
    sessionEnded: (reason, host) => lab.events.push(["ended", reason, host]),
    connectionLost: (host) => lab.events.push(["lost", host]),
    versionRefused: () => lab.events.push(["version"]),
  };
  return lab;
}

/* The lab's commit() on the host: through the sequencer, then to every guest. */
function hostChange(lab, together, op) {
  const result = lab.sequencer.submit(lab.kidId, { id: `h${Math.random()}`, op });
  if (result.t === "apply") together.applied(result);
  return result;
}

async function family() {
  const wifi = createLoopback();
  const maya = fakeLab("maya");
  maya.pieces.set("a", { ...brick("a"), by: "maya" });
  maya.sequencer = createSequencer({ world: maya.pieces, rules });
  const host = new BrickTogether(maya, createLanSession(wifi.device()), "maya");
  await host.host("Castle 城堡");
  const guests = [];
  for (const kid of ["leo", "lili"]) {
    const lab = fakeLab(kid);
    const together = new BrickTogether(lab, createLanSession(wifi.device()), kid, { retryMs: 150 });
    together.startLooking();
    await flush();
    const [service] = together.joinable();
    assert.ok(service, `${kid} finds Maya's world`);
    assert.equal(service.kid, "maya");
    assert.equal(service.world, "Castle 城堡");
    assert.ok(await together.join(service));
    await flush();
    guests.push({ lab, together });
  }
  return { wifi, maya, host, leo: guests[0], lili: guests[1] };
}

test("two guests join: both get the world, the roster has all three", async () => {
  const { maya, host, leo, lili } = await family();
  assert.deepEqual(leo.lab.events[0], ["loaded", 1]);
  assert.deepEqual(plain(leo.lab.pieces), plain(maya.pieces));
  assert.deepEqual(host.roster, ["maya", "leo", "lili"]);
  assert.deepEqual(lili.together.roster, ["maya", "leo", "lili"]);
  assert.ok(host.shared && leo.together.shared);
  assert.deepEqual(maya.events.filter((e) => e[0] === "crew"), [["crew", "leo", true], ["crew", "lili", true]]);
  assert.ok(leo.lab.events.some((e) => e[0] === "crew" && e[1] === "lili" && e[2]), "Leo hears that Lili joined");
});

test("a guest's brick lands in the host's world and on every tablet", async () => {
  const { maya, leo, lili } = await family();
  const sent = leo.together.request({ type: "add", piece: brick("b", 4.5, 4) });
  assert.ok(sent.pending);
  assert.ok(!leo.lab.pieces.has("b"), "nothing changes until the host says so");
  await flush();
  assert.equal(maya.pieces.get("b").by, "leo");
  assert.deepEqual(plain(leo.lab.pieces), plain(maya.pieces));
  assert.deepEqual(plain(lili.lab.pieces), plain(maya.pieces));
  assert.deepEqual(leo.lab.events.at(-1), ["mine", "add"]);
  assert.equal(leo.together.undo.size, 1);
  assert.equal(lili.together.undo.size, 0, "only the kid who did it can undo it");
});

test("the host's own change reaches the guests, in order", async () => {
  const { maya, host, leo, lili } = await family();
  hostChange(maya, host, { type: "move", id: "a", x: 6.5, y: 0.6, z: 2, rotation: 90 });
  hostChange(maya, host, { type: "recolor", id: "a", colorId: "blue" });
  await flush();
  assert.deepEqual(plain(leo.lab.pieces), plain(maya.pieces));
  assert.deepEqual(plain(lili.lab.pieces), plain(maya.pieces));
  assert.equal(leo.together.client.seq, 2);
  assert.equal(host.undo.size, 2);
});

test("two kids grab the same brick: every tablet ends the same", async () => {
  const { maya, leo, lili } = await family();
  leo.together.request({ type: "move", id: "a", x: 8.5, y: 0.6, z: 0, rotation: 0 });
  lili.together.request({ type: "move", id: "a", x: -8.5, y: 0.6, z: 0, rotation: 0 });
  leo.together.request({ type: "remove", id: "a" });
  lili.together.request({ type: "recolor", id: "a", colorId: "green" });
  await flush(12);
  assert.deepEqual(plain(leo.lab.pieces), plain(maya.pieces));
  assert.deepEqual(plain(lili.lab.pieces), plain(maya.pieces));
  assert.ok(lili.lab.events.some((e) => e[0] === "refused"), "the late recolour of a removed brick is refused");
});

test("shared undo: own change only, refused once a sibling changed the brick", async () => {
  const { maya, leo, lili } = await family();
  leo.together.request({ type: "add", piece: brick("b", 4.5, 4) });
  await flush();
  assert.ok(leo.together.undoLast());
  await flush();
  assert.ok(!maya.pieces.has("b") && !lili.lab.pieces.has("b"), "Leo's undo removed his brick everywhere");

  leo.together.request({ type: "add", piece: brick("c", 4.5, 4) });
  await flush();
  lili.together.request({ type: "move", id: "c", x: 10.5, y: 0.6, z: 4, rotation: 0 });
  await flush();
  leo.together.undoLast();
  await flush();
  assert.deepEqual(leo.lab.events.at(-1), ["refused", "changed"]);
  assert.equal(maya.pieces.get("c").x, 10.5, "Lili's move stays");
});

test("a guest leaves: the host's roster and toasts follow", async () => {
  const { maya, host, leo, lili } = await family();
  leo.together.leave();
  await flush();
  assert.deepEqual(host.roster, ["maya", "lili"]);
  assert.deepEqual(maya.events.at(-1), ["crew", "leo", false]);
  assert.deepEqual(lili.together.roster, ["maya", "lili"]);
  assert.equal(leo.together.role, null);
});

test("the host closes the world: every guest is sent home", async () => {
  const { host, leo, lili } = await family();
  host.stopHosting();
  await flush();
  assert.deepEqual(leo.lab.events.at(-1), ["ended", "closed", "maya"]);
  assert.deepEqual(lili.lab.events.at(-1), ["ended", "closed", "maya"]);
  assert.equal(leo.together.role, null);
});

test("the host drops off the wifi: guests look for it, then go home gently", async () => {
  const { wifi, leo } = await family();
  const hostDevice = Array.from(wifi.services.values())[0].device;
  hostDevice.drop();
  await flush();
  assert.deepEqual(leo.lab.events.at(-1), ["lost", "maya"]);
  assert.equal(leo.together.request({ type: "remove", id: "a" }), null, "nothing is sent while the host is gone");
  await new Promise((done) => setTimeout(done, 250));
  assert.deepEqual(leo.lab.events.at(-1), ["ended", "closed", "maya"]);
  assert.equal(leo.together.role, null);
});

test("a guest's wifi blinks: it finds the same world again and gets a fresh copy", async () => {
  const { maya, host, leo } = await family();
  hostChange(maya, host, { type: "add", piece: brick("b", 4.5, 4) });
  await flush();
  /* Leo's link drops; the host keeps building meanwhile. */
  const guestPeer = Array.from(host.peers.entries()).find(([, kid]) => kid === "leo")[0];
  host.lan.close(guestPeer);
  await flush();
  hostChange(maya, host, { type: "add", piece: brick("c", 8.5, 4) });
  await flush(12);
  assert.ok(leo.lab.events.some((e) => e[0] === "lost"));
  assert.equal(leo.together.role, "guest");
  assert.equal(leo.together.lost, null, "found it again");
  assert.deepEqual(plain(leo.lab.pieces), plain(maya.pieces));
  assert.ok(Array.from(host.peers.values()).includes("leo"));
});

test("an app pause on the host sends every guest home", async () => {
  const { host, leo, lili } = await family();
  host.dispose();
  await flush();
  assert.deepEqual(leo.lab.events.at(-1), ["ended", "closed", "maya"]);
  assert.deepEqual(lili.lab.events.at(-1), ["ended", "closed", "maya"]);
});

test("a different app version is refused cleanly", async () => {
  const { wifi } = await family();
  const old = createLanSession(wifi.device());
  const got = [];
  old.onMessage((_, m) => got.push(m));
  const name = Array.from(wifi.services.keys())[0];
  const peer = await old.join({ host: name, port: 1 });
  old.send(peer, { t: "hello", proto: PROTO + 1, kid: "lucien" });
  await new Promise((done) => setTimeout(done, 300));
  assert.deepEqual(got, [{ t: "refuse", why: "proto" }]);
});

test("the same kid on a second tablet replaces the first connection", async () => {
  const { wifi, host } = await family();
  const lab = fakeLab("leo");
  const again = new BrickTogether(lab, createLanSession(wifi.device()), "leo");
  again.startLooking();
  await flush();
  await again.join(again.joinable()[0]);
  await flush();
  assert.equal(host.peers.size, 2);
  assert.deepEqual(host.roster.slice().sort(), ["leo", "lili", "maya"]);
  await new Promise((done) => setTimeout(done, 400));
  assert.equal(host.peers.size, 2, "the old connection goes home and does not fight back");
});

test("a guest that missed a change asks for a fresh copy", async () => {
  const { maya, host, leo } = await family();
  hostChange(maya, host, { type: "add", piece: brick("b", 4.5, 4) });
  await flush();
  /* Pretend Leo never saw change 1: his next change is a gap. */
  leo.together.client = null;
  leo.together.guestWelcome({ world: [], seq: 0, roster: ["maya", "leo"], host: "maya", name: "x" });
  hostChange(maya, host, { type: "add", piece: brick("c", 8.5, 4) });
  await flush(12);
  assert.deepEqual(plain(leo.lab.pieces), plain(maya.pieces));
});

test("a world too big for one line still reaches a guest who joins, and one whose wifi blinks", async () => {
  const { wifi, maya, host, leo } = await family();
  /* About 1500 bricks: the whole world is several times one line's 64 KB. */
  for (let i = 0; i < 1500; i += 1) hostChange(maya, host, { type: "add", piece: brick(`big-${i}`, (i % 60) - 29.5, Math.floor(i / 60) - 12) });
  await flush(12);
  assert.ok(JSON.stringify(Array.from(maya.pieces.values())).length > LINE_MAX * 2);
  assert.deepEqual(plain(leo.lab.pieces), plain(maya.pieces), "built while joined: every change arrives");
  /* Leo's link drops and he finds the world again: the fresh copy is the big one. */
  const guestPeer = Array.from(host.peers.entries()).find(([, kid]) => kid === "leo")[0];
  host.lan.close(guestPeer);
  await flush(20);
  assert.equal(leo.together.lost, null, "found it again");
  assert.deepEqual(plain(leo.lab.pieces), plain(maya.pieces));
  assert.equal(leo.lab.events.filter((e) => e[0] === "loaded").at(-1)[1], maya.pieces.size, "the plate is loaded once, whole");
  /* A new guest joins the big world. */
  const lab = fakeLab("tom");
  const tom = new BrickTogether(lab, createLanSession(wifi.device()), "tom");
  tom.startLooking();
  await flush();
  assert.ok(await tom.join(tom.joinable()[0]));
  await flush(20);
  assert.deepEqual(plain(lab.pieces), plain(maya.pieces));
  assert.deepEqual(lab.events.filter((e) => e[0] === "loaded"), [["loaded", maya.pieces.size]]);
  /* Building goes on normally afterwards. */
  tom.request({ type: "add", piece: brick("after", 0.5, 20) });
  await flush();
  assert.equal(maya.pieces.get("after").by, "tom");
  assert.deepEqual(plain(leo.lab.pieces), plain(maya.pieces));
});
