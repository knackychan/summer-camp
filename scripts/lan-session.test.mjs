import test from "node:test";
import assert from "node:assert/strict";
import {
  clipBytes, createLanSession, createLoopback, decodeLine, encodeLine, LINE_MAX, nativeTransport,
} from "../js/game-services/lan-session.js";

const tick = () => new Promise((done) => setTimeout(done, 0));

test("no plugin: unavailable, every call harmless", async () => {
  const session = createLanSession(null);
  assert.equal(session.available, false);
  assert.equal(await session.host("x"), null);
  assert.equal(await session.join({ host: "h", port: 1 }), null);
  assert.equal(session.send("host", { t: "hello" }), false);
  await session.discover();
  await session.leave();
  await session.keepAwake(true);
  session.dispose();
  assert.equal(nativeTransport({}), null, "no Capacitor");
  assert.equal(nativeTransport({ Capacitor: { isNativePlatform: () => false } }), null, "web build");
  assert.equal(nativeTransport({ Capacitor: { isNativePlatform: () => true, Plugins: { SummerQuestNative: { haptic() {} } } } }), null,
    "an APK from before the LAN plugin");
});

test("the Android plugin is wrapped when it has the LAN methods", async () => {
  const calls = [];
  const plugin = new Proxy({}, { get: (_, name) => (name === "then" ? undefined : (args) => { calls.push([name, args]); return Promise.resolve(name === "lanJoin" ? { peer: "host" } : { remove() {} }); }) });
  const t = nativeTransport({ Capacitor: { isNativePlatform: () => true, Plugins: { SummerQuestNative: plugin } } });
  assert.ok(t);
  assert.equal(await t.join("10.0.0.2", 4242), "host");
  await t.send("*", "{}");
  await t.keepAwake(1);
  assert.deepEqual(calls.map(([name]) => name), ["lanJoin", "lanSend", "keepAwake"]);
  assert.deepEqual(calls[2][1], { on: true });
});

test("loopback: host, find, join, a message each way, bye", async () => {
  const wifi = createLoopback();
  const maya = createLanSession(wifi.device());
  const leo = createLanSession(wifi.device());
  const seen = { maya: [], leo: [], found: [], peers: [] };
  maya.onMessage((peer, m) => seen.maya.push([peer, m]));
  maya.onPeer((peer, open) => seen.peers.push([peer, open]));
  leo.onMessage((peer, m) => seen.leo.push([peer, m]));
  leo.onFound((service) => seen.found.push(service));

  const hosted = await maya.host("Maya · Castle 城堡", { game: "bricklab", proto: "1" });
  await leo.discover();
  await tick();
  assert.equal(seen.found.length, 1);
  assert.equal(seen.found[0].name, hosted.name);
  assert.equal(seen.found[0].txt.game, "bricklab");

  const peer = await leo.join(seen.found[0]);
  await tick();
  assert.equal(peer, "host");
  assert.equal(seen.peers.length, 1);
  const guestId = seen.peers[0][0];
  leo.send(peer, { t: "hello", kid: "leo" });
  await tick();
  assert.deepEqual(seen.maya, [[guestId, { t: "hello", kid: "leo" }]]);
  maya.send(guestId, { t: "welcome", text: "你好" });
  await tick();
  assert.equal(seen.leo[0][1].text, "你好");

  await maya.stopHosting();
  await tick();
  assert.deepEqual(seen.peers.at(-1), [guestId, false], "stopping closes the guests");
});

test("loopback: one host, two guests, broadcast reaches both", async () => {
  const wifi = createLoopback();
  const host = createLanSession(wifi.device());
  const guests = [createLanSession(wifi.device()), createLanSession(wifi.device())];
  const got = [[], []];
  guests.forEach((g, i) => g.onMessage((_, m) => got[i].push(m.t)));
  const { name } = await host.host("Maya");
  for (const g of guests) await g.join({ host: name, port: 1 });
  host.broadcast({ t: "apply" });
  await tick();
  assert.deepEqual(got, [["apply"], ["apply"]]);
});

test("junk and oversized lines never reach the game", async () => {
  const wifi = createLoopback();
  const a = wifi.device();
  const host = createLanSession(a);
  const guest = createLanSession(wifi.device());
  const got = [];
  host.onMessage((_, m) => got.push(m));
  const { name } = await host.host("Maya");
  await guest.join({ host: name, port: 1 });
  const guestDevice = Array.from(a.links.values())[0].other;
  await guestDevice.send("host", "{not json");
  await guestDevice.send("host", "[1,2]");
  await guestDevice.send("host", '{"no":"type"}');
  await guestDevice.send("host", JSON.stringify({ t: "x", pad: "y".repeat(LINE_MAX) }));
  await tick();
  assert.deepEqual(got, []);
  assert.equal(guest.send("host", { t: "big", pad: "z".repeat(LINE_MAX) }), false);
});

test("lines: encode, decode and byte clipping", () => {
  assert.equal(decodeLine(encodeLine({ t: "req", id: "1" })).id, "1");
  assert.ok(!encodeLine({ t: "x", s: "a\nb" }).includes("\n"), "newlines are escaped inside JSON");
  assert.equal(encodeLine({ t: "x", pad: "y".repeat(LINE_MAX) }), null);
  assert.equal(clipBytes("Maya · Castle 城堡城堡", 17), "Maya · Castle ");
  assert.equal(new TextEncoder().encode(clipBytes("城".repeat(40), 60)).length, 60);
});

test("a host name is clipped to fit NSD's 63 bytes", async () => {
  const wifi = createLoopback();
  const session = createLanSession(wifi.device());
  const { name } = await session.host("城堡".repeat(30));
  assert.ok(new TextEncoder().encode(name).length <= 60);
});
