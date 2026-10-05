/* Brick Lab building-together acceptance on real tablets
   (docs/plans/2026-10-04-brick-lab-multiplayer/07-device-acceptance.md).
   Two tablets on USB, both running the debug APK, on the same home wifi.
   The host opens a throwaway world "Wifi test 測試" (deleted at the end), the
   guest joins, both build at once, then the checklist: same brick, shared
   undo, the guest's wifi off and on, the host's Back, reopen, own worlds
   untouched, screen kept awake. Bricks are placed through the lab's own
   change() path, not by touch.

   node scripts/accept-lan.mjs [--host <serial>] [--guest <serial>] [--minutes 10]

   An attached DevTools session keeps the screen on by itself, so the
   keep-awake checks read the window flag with the host detached. */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { adbDevices, parseFlags, resolveAdb } from "./lib/android-tools.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const { flags } = parseFlags(process.argv.slice(2));
const ADB = resolveAdb(resolve(here, "..", "android"));
if (!ADB) { console.error("adb was not found."); process.exit(2); }
const ready = adbDevices(ADB).filter((d) => d.state === "device").map((d) => d.serial);
const A_SERIAL = typeof flags.get("host") === "string" ? flags.get("host") : ready[0];
const B_SERIAL = typeof flags.get("guest") === "string" ? flags.get("guest") : ready.find((s) => s !== A_SERIAL);
if (!A_SERIAL || !B_SERIAL || A_SERIAL === B_SERIAL) {
  console.error(`Two tablets are needed; connected: ${ready.join(", ") || "none"}. Pass --host and --guest.`);
  process.exit(2);
}
const MINUTES = typeof flags.get("minutes") === "string" ? Number(flags.get("minutes")) : 10;
const out = resolve(here, "..", ".reports", "lan-acceptance");
mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };
const adb = (s, ...args) => execFileSync(ADB, ["-s", s, ...args], { encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "pipe"] });
const shot = (s, name) => { writeFileSync(resolve(out, `${name}.png`), execFileSync(ADB, ["-s", s, "exec-out", "screencap", "-p"], { maxBuffer: 1 << 26 })); };
/* Android 11+: cmd wifi; older Android: svc wifi. */
const setWifi = (s, on) => { try { adb(s, "shell", "cmd", "wifi", "set-wifi-enabled", on ? "enabled" : "disabled"); } catch { adb(s, "shell", "svc", "wifi", on ? "enable" : "disable"); } };
const keptAwake = (s) => adb(s, "shell", "dumpsys window windows").split(/\n(?=  Window #)/).filter((w) => w.includes("com.summerquest.app/"))
  .some((w) => /KEEP_SCREEN_ON/.test(w) || [...w.matchAll(/(?:^|\s)fl=(?:0x)?([0-9a-f]+)/g)].some((m) => (parseInt(m[1], 16) & 0x80) !== 0));

/* DevTools on the app's WebView, through an adb port forward. */
async function attach(serial) {
  const pid = adb(serial, "shell", "pidof", "com.summerquest.app").trim().split(/\s+/)[0];
  if (!pid) throw new Error(`${serial}: Summer Quest is not running.`);
  const port = adb(serial, "forward", "tcp:0", `localabstract:webview_devtools_remote_${pid}`).trim();
  const pages = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter((t) => t.type === "page");
  const page = pages.find((t) => /^https?:\/\/localhost\//.test(t.url)) || pages[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
  let id = 0;
  const waiting = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); const w = waiting.get(m.id); if (w) { waiting.delete(m.id); w(m); } };
  const ev = (expression) => new Promise((ok, fail) => {
    const n = ++id;
    const timer = setTimeout(() => fail(new Error(`${serial}: timed out`)), 30000);
    waiting.set(n, (m) => {
      clearTimeout(timer);
      const r = m.result;
      if (m.error) fail(new Error(JSON.stringify(m.error)));
      else if (r.exceptionDetails) fail(new Error(`${serial}: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`));
      else ok(r.result.value);
    });
    ws.send(JSON.stringify({ id: n, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
  });
  const model = adb(serial, "shell", "getprop", "ro.product.model").trim();
  const android = adb(serial, "shell", "getprop", "ro.build.version.release").trim();
  return { serial, label: `${model} (Android ${android})`, ev, close: () => { ws.close(); adb(serial, "forward", "--remove", `tcp:${port}`); } };
}

/* The lab runtime isn't on window: catch it the next time its snapshot() runs. */
const L = "window.__lab";
const GRAB = `import('/js/brick-lab/brick-lab.js').then(m => { const P = m.BrickLabRuntime.prototype; if (!P.__accWrapped) { const o = P.snapshot; P.snapshot = function () { window.__lab = this; return o.call(this); }; P.__accWrapped = true; } window.__lab = null; const s = SQGames.get('bricklab') && SQGames.get('bricklab').snapshot(); return !!(s && s.menu && window.__lab); })`;
let A = await attach(A_SERIAL);
const B = await attach(B_SERIAL);
console.log(`Host: ${A.label}\nGuest: ${B.label}`);
/* An attached DevTools session keeps the screen on by itself: read the flag with A detached. */
async function awakeDetached() { A.close(); await wait(1500); const on = keptAwake(A_SERIAL); A = await attach(A_SERIAL); return on; }
const both = (f) => Promise.all([f(A), f(B)]);
async function until(t, expr, ms, what) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = await t.ev(expr); if (v) return v; await wait(100); }
  throw new Error(`${t.serial}: ${what} not within ${ms / 1000}s`);
}
const pieces = (t) => t.ev(`JSON.stringify([...${L}.pieces.values()].map(p => [p.id,p.partId,p.colorId,p.x,p.y,p.z,p.rotation]).sort())`);
const same = async () => { const [a, b] = await both(pieces); return a === b; };
const worldsDump = (t, kid) => t.ev(`JSON.stringify(Object.keys(localStorage).filter(k => k.startsWith('sq:brick-lab:world') && k.includes(':${kid}')).sort().map(k => [k, k.includes(':worlds:') ? JSON.parse(localStorage.getItem(k)).map(w => [w.id, w.name, w.count]) : JSON.parse(localStorage.getItem(k)).pieces]))`);
const has = (t, id) => `${L}.pieces.has('${id}')`;
let testId = null;
try {
  await both((t) => t.ev(`window.__accErr = []; addEventListener('error', e => __accErr.push(String(e.message))); addEventListener('unhandledrejection', e => __accErr.push(String(e.reason))); true`));
  await both((t) => t.ev(`SummerQuest.openGame('bricklab'); true`));
  await both((t) => until(t, GRAB, 20000, "Brick Lab menu"));
  const kidA = await A.ev(`${L}.kidId`), kidB = await B.ev(`${L}.kidId`);
  console.log(`Host kid ${kidA}, guest kid ${kidB}`);
  const bWorldsBefore = await worldsDump(B, kidB), aWorldsBefore = await worldsDump(A, kidA);
  const w1 = await both((t) => t.ev(`${L}.snapshot().worlds`));
  check("Each tablet: the existing build shows as world 1", w1.every((w) => w.length >= 1 && w[0].count > 0), w1.map((w) => `${w[0].name} (${w[0].count})`).join(" / "));
  const colors = await A.ev(`import('/js/brick-lab/brick-catalog.js').then(m => Object.keys(m.COLORS))`);
  const add = (t, id, color) => t.ev(`!!${L}.change({ type: 'add', piece: { id: '${id}', partId: 'brick_2x2', colorId: '${color}', x: ${2 * Math.floor(Math.random() * 28 - 14)}, y: 0.6, z: ${2 * Math.floor(Math.random() * 28 - 14)}, rotation: 0 } })`);

  // A opens a fresh test world: it goes on the wifi. B should see it within ~5 s.
  testId = await A.ev(`(() => { const w = ${L}.worlds.create('Wifi test 測試'); ${L}.renderMenu(); return w.id; })()`);
  const t0 = Date.now();
  await A.ev(`${L}.openWorld(${JSON.stringify(testId)})`);
  await until(B, `${L}.together.joinable().some(w => w.kid === ${JSON.stringify(kidA)} && w.world === 'Wifi test 測試') && !!document.querySelector('[data-join-world]')`, 15000, "seeing A's world");
  const seen = Date.now() - t0;
  check("A opens a world; B sees it within ~5 s", seen <= 5000, `${seen} ms`);
  shot(B_SERIAL, "b-menu-join-card");
  check("Hosting alone does not keep A's screen on", !(await awakeDetached()), "read with DevTools detached");

  await B.ev(`document.querySelector('[data-join-world]').click(); true`);
  await until(B, `${L}.together.snapshot().role === 'guest' && !${L}.snapshot().menu`, 10000, "joining");
  await until(A, `${L}.together.snapshot().peers === 1`, 5000, "A seeing B");
  await wait(1500);
  shot(A_SERIAL, "a-guest-joined"); shot(B_SERIAL, "b-joined");
  check("A's screen is kept awake while a guest is in", await awakeDetached(), "read with DevTools detached");

  // Both build at once.
  const lat = { AtoB: [], BtoA: [] };
  const end = Date.now() + Number(MINUTES) * 60000;
  let n = 0, refused = 0, shotTaken = false;
  const startedAt = Date.now();
  while (Date.now() < end) {
    n++;
    const ia = `acc-a-${n}`, ib = `acc-b-${n}`;
    const s = Date.now();
    const [okA, okB] = await Promise.all([add(A, ia, colors[n % colors.length]), add(B, ib, colors[(n + 3) % colors.length])]);
    if (!okA || !okB) refused++;
    const [la, lb] = await Promise.all([
      until(B, has(B, ia), 10000, `A's ${ia} on B`).then(() => Date.now() - s),
      until(A, has(A, ib), 10000, `B's ${ib} on A`).then(() => Date.now() - s)]);
    lat.AtoB.push(la); lat.BtoA.push(lb);
    if (!shotTaken && Date.now() - startedAt > 20000) { shot(A_SERIAL, "a-building"); shot(B_SERIAL, "b-building"); shotTaken = true; }
    await wait(1500);
  }
  const stats = (xs) => { const s = [...xs].sort((a, b) => a - b); return { n: s.length, median: s[s.length >> 1], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] }; };
  const sa = stats(lat.AtoB), sb = stats(lat.BtoA);
  check(`Both build at once for ${MINUTES} min; each sees the other's bricks within 1 s`, sa.p95 <= 1000 && sb.p95 <= 1000 && refused === 0,
    `A→B ${JSON.stringify(sa)}; B→A ${JSON.stringify(sb)} (ms, includes driver polling); refused ${refused}`);
  await wait(1000);
  check("After building, the world is the same on both", await same(), `${await A.ev(`${L}.pieces.size`)} pieces`);

  // Same brick, both at once: move, then remove.
  await Promise.all([A.ev(`!!${L}.change({ type: 'move', id: 'acc-a-1', x: 20, y: 0.6, z: 20, rotation: 0 })`), B.ev(`!!${L}.change({ type: 'move', id: 'acc-a-1', x: -20, y: 0.6, z: -20, rotation: 90 })`)]);
  await wait(1500);
  await Promise.all([A.ev(`!!${L}.change({ type: 'remove', id: 'acc-b-1' })`), B.ev(`!!${L}.change({ type: 'remove', id: 'acc-b-1' })`)]);
  await wait(1500);
  const errs1 = await both((t) => t.ev(`__accErr.slice()`));
  check("Two kids grab the same brick: no crash, the world ends up the same on both", (await same()) && errs1.every((e) => !e.length) && !(await A.ev(has(A, "acc-b-1"))), JSON.stringify(errs1));

  // Shared undo only undoes your own change.
  await add(B, "acc-undo-b", colors[0]); await wait(800);
  await add(A, "acc-undo-a", colors[1]); await wait(1200);
  await B.ev(`${L}.undo(); true`); await wait(1500);
  const afterBUndo = await both((t) => t.ev(`[${has(t, "acc-undo-b")}, ${has(t, "acc-undo-a")}]`));
  await A.ev(`${L}.undo(); true`); await wait(1500);
  const afterAUndo = await both((t) => t.ev(`[${has(t, "acc-undo-b")}, ${has(t, "acc-undo-a")}]`));
  check("Shared undo only undoes your own change", afterBUndo.every(([b, a]) => !b && a) && afterAUndo.every(([b, a]) => !b && !a) && (await same()),
    `after B undo ${JSON.stringify(afterBUndo)}, after A undo ${JSON.stringify(afterAUndo)}`);

  // B's wifi off and on; A keeps building meanwhile.
  setWifi(B_SERIAL, false);
  await until(B, `${L}.together.snapshot().lost`, 20000, "B noticing the lost link");
  shot(B_SERIAL, "b-wifi-lost");
  await add(A, "acc-while-away", colors[2]);
  await wait(3000);
  setWifi(B_SERIAL, true);
  const t1 = Date.now();
  await until(B, `(() => { const s = ${L}.together.snapshot(); return s.role === 'guest' && !s.lost && ${has(B, "acc-while-away")}; })()`, 60000, "B rejoining");
  await wait(1000);
  check("B turns wifi off and on: rejoins with the right world", await same(), `back ${Date.now() - t1} ms after wifi on, with the brick A placed meanwhile`);

  // A presses Back: B sees the closed line and lands on its menu.
  const before = await A.ev(`${L}.pieces.size`), beforeSet = await pieces(A);
  await A.ev(`SQPlatform.triggerBack(); true`);
  await until(B, `${L}.snapshot().menu && ${L}.together.snapshot().role === null`, 10000, "B back on its menu");
  const toast = await B.ev(`(document.querySelector('.sqbl-toast') || {}).innerText || ''`);
  shot(B_SERIAL, "b-host-closed");
  check(`A presses Back: B sees the "closed" line and lands on its menu`, /[㐀-鿿]/.test(toast) && /[A-Za-z]/.test(toast), JSON.stringify(toast));
  check("A's screen goes back to normal once the world closes", !(await awakeDetached()), "read with DevTools detached");

  await A.ev(`${L}.openWorld(${JSON.stringify(testId)})`);
  await wait(1000);
  check("A reopens the world: every brick from B is there", (await pieces(A)) === beforeSet, `${before} pieces, ${await A.ev(`[...${L}.pieces.values()].filter(p => p.by === ${JSON.stringify(kidB)}).length`)} by ${kidB}`);
  await A.ev(`SQPlatform.triggerBack(); true`);
  await until(A, `${L}.snapshot().menu`, 5000, "A on its menu");

  check("B's own worlds are unchanged", (await worldsDump(B, kidB)) === bWorldsBefore);
  const strip = (dump) => JSON.parse(dump).filter(([k]) => !k.includes(testId)).map(([k, v]) => [k, k.includes(":worlds:") ? v.filter(([id]) => id !== testId) : v]);
  check("A's own earlier worlds are unchanged", JSON.stringify(strip(await worldsDump(A, kidA))) === JSON.stringify(strip(aWorldsBefore)));
  const errs = await both((t) => t.ev(`__accErr.slice()`));
  check("No page errors on either tablet", errs.every((e) => !e.length), JSON.stringify(errs));
} catch (error) {
  check("Run finished", false, error.message);
  try { shot(A_SERIAL, "a-failure"); shot(B_SERIAL, "b-failure"); } catch {}
} finally {
  try { setWifi(B_SERIAL, true); } catch {}
  if (testId) { try { await A.ev(`(() => { const l = ${L}; if (!l.snapshot().menu) SQPlatform.triggerBack(); l.worlds.remove(${JSON.stringify(testId)}); l.renderMenu(); return true; })()`); } catch (e) { console.log("cleanup:", e.message); } }
  writeFileSync(resolve(out, "acceptance.json"), JSON.stringify(results, null, 2));
  console.log(`Report and screenshots: ${out}`);
  A.close(); B.close();
}
console.log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
