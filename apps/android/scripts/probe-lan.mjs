/* Home-wifi probe (docs/plans/2026-10-04-brick-lab-multiplayer/ slice 03): two
   tablets on USB, both running the debug APK and on the same wifi. Tablet A hosts,
   tablet B finds it, joins, and a line goes each way. Only the native transport is
   tested here; nothing in the game changes.

   node scripts/probe-lan.mjs [--host <serial>] [--guest <serial>]

   With exactly two authorized devices the serials are optional. */
import { adb, adbDevices, parseFlags, resolveAdb, shell } from "./lib/android-tools.mjs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { flags } = parseFlags(process.argv.slice(2));
const packageId = "com.summerquest.app";
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const forwards = [];

const adbPath = resolveAdb(resolve(here, "..", "android"));
if (!adbPath) { console.error("adb was not found."); process.exit(2); }
const ready = adbDevices(adbPath).filter((d) => d.state === "device").map((d) => d.serial);
const hostSerial = typeof flags.get("host") === "string" ? flags.get("host") : ready[0];
const guestSerial = typeof flags.get("guest") === "string" ? flags.get("guest") : ready.find((s) => s !== hostSerial);
if (!hostSerial || !guestSerial || hostSerial === guestSerial) {
  console.error(`Two tablets are needed; connected: ${ready.join(", ") || "none"}. Pass --host and --guest.`);
  process.exit(2);
}

async function attach(serial) {
  const text = (args) => { const r = shell(adbPath, serial, args, { capture: true, allowFailure: true }); return r.status === 0 ? r.stdout.trim() : ""; };
  let pid = text(["pidof", packageId]);
  if (!pid) {
    shell(adbPath, serial, ["am", "start", "-W", "-n", `${packageId}/.MainActivity`], { capture: true, allowFailure: true });
    await wait(5000);
    pid = text(["pidof", packageId]);
  }
  if (!pid) throw new Error(`${serial}: Summer Quest is not running (install the debug APK first).`);
  const port = adb(adbPath, serial, ["forward", "tcp:0", `localabstract:webview_devtools_remote_${pid.split(/\s+/)[0]}`], { capture: true, allowFailure: true }).stdout.trim();
  if (!/^\d+$/.test(port)) throw new Error(`${serial}: adb forward failed: ${port}`);
  forwards.push([serial, port]);
  const pages = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter((t) => t.type === "page" && t.webSocketDebuggerUrl);
  const page = pages.find((t) => /^https?:\/\/localhost\//.test(t.url)) || pages[0];
  if (!page) throw new Error(`${serial}: no page to attach to`);
  const model = text(["getprop", "ro.product.model"]);
  const android = text(["getprop", "ro.build.version.release"]);
  return { serial, label: `${model || serial} (Android ${android || "?"})`, ws: page.webSocketDebuggerUrl };
}

let nextId = 1;
async function evaluate(target, expression, timeoutMs = 20000) {
  const ws = new WebSocket(target.ws);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = () => fail(new Error(`cannot open ${target.ws}`)); });
  const id = nextId++;
  try {
    return await new Promise((ok, fail) => {
      const timer = setTimeout(() => fail(new Error(`${target.label}: timed out`)), timeoutMs);
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
        clearTimeout(timer);
        if (message.error) fail(new Error(JSON.stringify(message.error)));
        else if (message.result.exceptionDetails) fail(new Error(message.result.exceptionDetails.exception?.description || "page error"));
        else ok(message.result.result.value);
      };
      ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
    });
  } finally { ws.close(); }
}

/* Listeners land in window.__sqLan; every step reads from there. */
const SETUP = `(async () => {
  const P = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SummerQuestNative;
  if (!P || !P.lanHost) throw new Error('SummerQuestNative.lanHost missing: old APK?');
  if (window.__sqLan) { try { await P.lanStop(); await P.lanLeave(); await P.lanStopDiscover(); } catch (e) {} }
  window.__sqLan = { found: [], lines: [], peers: [], closed: [] };
  for (const [event, key] of [['lanFound', 'found'], ['lanLine', 'lines'], ['lanPeerOpen', 'peers'], ['lanPeerClosed', 'closed']])
    await P.addListener(event, (e) => window.__sqLan[key].push(Object.assign({ at: Date.now() }, e)));
  return true; })()`;
const plugin = "window.Capacitor.Plugins.SummerQuestNative";

async function until(target, expression, timeoutMs, what) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const value = await evaluate(target, expression);
    if (value) return value;
    await wait(250);
  }
  throw new Error(`${target.label}: ${what} did not happen within ${timeoutMs / 1000} s`);
}

let exitCode = 0;
let host, guest;
try {
  host = await attach(hostSerial);
  guest = await attach(guestSerial);
  console.log(`Host:  ${host.label}\nGuest: ${guest.label}`);
  await evaluate(host, SETUP);
  await evaluate(guest, SETUP);

  const name = `SQ probe ${Date.now().toString(36)}`;
  const hosted = await evaluate(host, `${plugin}.lanHost({ name: ${JSON.stringify(name)}, txt: { game: 'probe', proto: '1' } })`);
  console.log(`Hosting "${hosted.name}" on port ${hosted.port}${hosted.warning ? ` (warning: ${hosted.warning})` : ""}`);

  const t0 = Date.now();
  await evaluate(guest, `${plugin}.lanDiscover()`);
  const found = await until(guest, `window.__sqLan.found.find((f) => f.name === ${JSON.stringify(hosted.name)}) || null`, 20000, "finding the host");
  console.log(`Found in ${Date.now() - t0} ms at ${found.host}:${found.port}, txt ${JSON.stringify(found.txt)}`);

  const joined = await evaluate(guest, `${plugin}.lanJoin({ host: ${JSON.stringify(found.host)}, port: ${found.port} })`);
  await until(host, "window.__sqLan.peers.length > 0", 5000, "the guest connecting");
  const t1 = Date.now();
  await evaluate(guest, `${plugin}.lanSend({ peer: ${JSON.stringify(joined.peer)}, line: 'hello from the guest 你好' })`);
  const got = await until(host, "window.__sqLan.lines.find((l) => l.line.startsWith('hello from the guest')) || null", 5000, "the guest's line arriving");
  await evaluate(host, `${plugin}.lanSend({ peer: ${JSON.stringify(got.peer)}, line: 'hello back from the host' })`);
  await until(guest, "window.__sqLan.lines.some((l) => l.line === 'hello back from the host')", 5000, "the host's line arriving");
  console.log(`Round trip ${Date.now() - t1} ms; Chinese survived: ${got.line.endsWith('你好')}`);

  await evaluate(host, `${plugin}.lanStop()`);
  await until(guest, "window.__sqLan.closed.length > 0", 5000, "the guest seeing the host close");
  console.log("Host stop closed the guest's connection: ok");
  console.log("\nLAN probe passed.");
} catch (error) {
  console.error(error.message);
  exitCode = 1;
} finally {
  for (const target of [guest, host]) {
    if (!target) continue;
    try { await evaluate(target, `(async () => { const P = ${plugin}; await P.lanStopDiscover(); await P.lanLeave(); await P.lanStop(); return true; })()`, 5000); } catch {}
  }
  for (const [serial, port] of forwards) adb(adbPath, serial, ["forward", "--remove", `tcp:${port}`], { capture: true, allowFailure: true });
}
process.exit(exitCode);
