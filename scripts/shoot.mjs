// Review screenshots at exact viewports.
//
//   node scripts/shoot.mjs <spec.json>
//
// Windows clamps a headless browser window to ~516px, so `--window-size=360,800`
// silently renders a 492px viewport and crops the image — a 360px screenshot that
// never tested 360px. This drives the browser over CDP instead and sets the viewport
// with Emulation.setDeviceMetricsOverride, which honours any width and any DPR.
//
// No dependencies: Node's built-in fetch and WebSocket only.
//
// spec.json:
// {
//   "browser": "C:/.../msedge.exe",          // optional, autodetected
//   "outDir": "test-results/brain-visual",
//   "shots": [
//     { "name": "mobile-360", "url": "file:///...", "w": 360, "h": 800, "dsf": 2, "full": false }
//   ]
// }

import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";

const CANDIDATES = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"
];

const specPath = process.argv[2];
if (!specPath) {
  console.error("usage: node scripts/shoot.mjs <spec.json>");
  process.exit(2);
}
const spec = JSON.parse(await readFile(specPath, "utf8"));

async function findBrowser() {
  if (spec.browser) return spec.browser;
  for (const c of CANDIDATES) {
    try { await access(c); return c; } catch {}
  }
  throw new Error("no Edge or Chrome found; set \"browser\" in the spec");
}

const PORT = 9333 + (process.pid % 200);
const profile = join(process.env.TEMP || "/tmp", `sq-shoot-${process.pid}`);
const browser = await findBrowser();

const child = spawn(browser, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  "--allow-file-access-from-files",
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${PORT}`,
  "about:blank"
], { stdio: "ignore" });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function endpoint() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch {}
    await sleep(100);
  }
  throw new Error("browser did not expose a debugging endpoint");
}

// Minimal CDP client. One socket, sequential commands, sessionId for the page target.
function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  const events = new Map();
  let id = 0;
  ws.addEventListener("message", ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { ok, fail } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
    } else if (msg.method) {
      const waiters = events.get(msg.method) || [];
      events.set(msg.method, []);
      waiters.forEach(fn => fn(msg.params));
    }
  });
  const ready = new Promise((ok, fail) => {
    ws.addEventListener("open", ok, { once: true });
    ws.addEventListener("error", () => fail(new Error("CDP socket failed")), { once: true });
  });
  return {
    ready,
    send(method, params = {}, sessionId) {
      return new Promise((ok, fail) => {
        const msgId = ++id;
        pending.set(msgId, { ok, fail });
        ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
      });
    },
    once(method) {
      return new Promise(ok => {
        events.set(method, [...(events.get(method) || []), ok]);
      });
    },
    close() { ws.close(); }
  };
}

const cdp = connect(await endpoint());
await cdp.ready;

const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
await cdp.send("Page.enable", {}, sessionId);

const outDir = resolve(dirname(specPath), spec.outDir);
await mkdir(outDir, { recursive: true });

for (const shot of spec.shots) {
  const dsf = shot.dsf || 1;
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: shot.w,
    height: shot.h,
    deviceScaleFactor: dsf,
    mobile: !!shot.mobile,
    screenWidth: shot.w,
    screenHeight: shot.h
  }, sessionId);

  // about:blank between shots so a same-document (hash-only) navigation still fires load
  await cdp.send("Page.navigate", { url: "about:blank" }, sessionId);
  const loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: shot.url }, sessionId);
  await Promise.race([loaded, sleep(8000)]);   // never wedge the run on one page
  // let fonts settle and any one-shot sprite animation reach its final frame
  await sleep(shot.settle ?? 900);

  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: !!shot.full,
    fromSurface: true
  }, sessionId);

  const file = join(outDir, `${shot.name}.png`);
  await writeFile(file, Buffer.from(data, "base64"));
  const kb = Math.round(Buffer.from(data, "base64").length / 1024);
  console.log(`${shot.name.padEnd(38)} ${shot.w}x${shot.h} @${dsf}x  ${kb} KB`);
}

cdp.close();
child.kill();
