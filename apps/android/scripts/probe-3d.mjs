/* 3D black-screen probe: attaches to the app's WebView (or Chrome) on a USB tablet
   through DevTools, runs lib/probe-3d-page.js in the page, and writes what the GPU
   actually drew per game and per switched-off scene feature.

   node scripts/probe-3d.mjs [--serial <id>] [--games solar,monster-truck,bricklab]
                             [--browser] [--cdp http://127.0.0.1:9222] [--no-thumbs]
                             [--variants baseline,noFog,...]

   --browser  attach to Chrome on the tablet instead of the Summer Quest app.
   --cdp      skip adb and attach to an already-open DevTools endpoint (desktop runs).
   Reports land in apps/android/.reports/probe-3d-<serial>-<time>/ (gitignored). */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { adb, adbDevices, boolFlag, parseFlags, resolveAdb, selectDevice, shell } from "./lib/android-tools.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const shellRoot = resolve(here, "..");
const { flags } = parseFlags(process.argv.slice(2));
const games = String(flags.get("games") || "solar,monster-truck,bricklab").split(",").filter(Boolean);
const thumbs = !boolFlag(flags, "no-thumbs") && flags.get("thumbs") !== "false";
const browser = boolFlag(flags, "browser");
const variants = typeof flags.get("variants") === "string" ? String(flags.get("variants")).split(",").filter(Boolean) : null;
const packageId = "com.summerquest.app";
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

let adbPath = null, serial = "desktop", forwarded = null, endpoint = flags.get("cdp");
const device = {};

if (!endpoint) {
  adbPath = resolveAdb(resolve(shellRoot, "android"));
  if (!adbPath) { console.error("adb was not found. Install Android SDK Platform Tools or set ANDROID_SDK_ROOT."); process.exit(2); }
  try { serial = selectDevice(adbDevices(adbPath), typeof flags.get("serial") === "string" ? flags.get("serial") : undefined).serial; }
  catch (error) { console.error(error.message); process.exit(2); }
  const text = (args) => { const r = shell(adbPath, serial, args, { capture: true, allowFailure: true }); return r.status === 0 ? r.stdout.trim() : ""; };
  Object.assign(device, {
    serial, manufacturer: text(["getprop", "ro.product.manufacturer"]), model: text(["getprop", "ro.product.model"]),
    android: text(["getprop", "ro.build.version.release"]), board: text(["getprop", "ro.board.platform"]),
    hardware: text(["getprop", "ro.hardware"]),
    gles: text(["dumpsys", "SurfaceFlinger"]).split(/\r?\n/).filter((line) => /GLES|EGL/.test(line)).slice(0, 4),
    webView: text(["dumpsys", "webviewupdate"]).split(/\r?\n/).find((line) => line.includes("Current WebView package"))?.trim() || "unknown",
    chrome: text(["dumpsys", "package", "com.android.chrome"]).match(/versionName=(\S+)/)?.[1] || null,
  });
  let socket;
  if (browser) socket = "chrome_devtools_remote";
  else {
    let pid = text(["pidof", packageId]);
    if (!pid) {
      shell(adbPath, serial, ["am", "start", "-W", "-n", `${packageId}/.MainActivity`], { capture: true, allowFailure: true });
      await wait(5000);
      pid = text(["pidof", packageId]);
    }
    if (!pid) { console.error("Summer Quest is not running and did not start. Install it first (INSTALL-ANDROID-DEBUG.cmd)."); process.exit(3); }
    socket = `webview_devtools_remote_${pid.split(/\s+/)[0]}`;
  }
  if (!text(["cat", "/proc/net/unix"]).includes(`@${socket}`)) {
    console.error(`DevTools socket @${socket} is not open. ${browser ? "Open Summer Quest in Chrome on the tablet first." : "This build may not allow WebView debugging (use the debug APK)."}`);
    process.exit(3);
  }
  const port = adb(adbPath, serial, ["forward", "tcp:0", `localabstract:${socket}`], { capture: true, allowFailure: true }).stdout.trim();
  if (!/^\d+$/.test(port)) { console.error(`adb forward failed: ${port}`); process.exit(3); }
  forwarded = port;
  endpoint = `http://127.0.0.1:${port}`;
}

function cleanup() {
  if (forwarded) adb(adbPath, serial, ["forward", "--remove", `tcp:${forwarded}`], { capture: true, allowFailure: true });
  forwarded = null;
}

async function evaluate(wsUrl, expression, timeoutMs) {
  const ws = new WebSocket(wsUrl);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = () => fail(new Error(`cannot open ${wsUrl}`)); });
  try {
    return await new Promise((ok, fail) => {
      const timer = setTimeout(() => fail(new Error("probe timed out")), timeoutMs);
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== 1) return;
        clearTimeout(timer);
        if (message.error) fail(new Error(JSON.stringify(message.error)));
        else if (message.result.exceptionDetails) fail(new Error(message.result.exceptionDetails.exception?.description || JSON.stringify(message.result.exceptionDetails)));
        else ok(message.result.result.value);
      };
      ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true, userGesture: true } }));
    });
  } finally { ws.close(); }
}

let exitCode = 0;
try {
  const targets = await (await fetch(`${endpoint}/json/list`)).json();
  const pages = targets.filter((t) => t.type === "page" && t.webSocketDebuggerUrl);
  const wanted = typeof flags.get("url") === "string" ? flags.get("url") : null;
  const page = pages.find((t) => (wanted ? t.url.includes(wanted) : /^https?:\/\/localhost\//.test(t.url) || /summer/i.test(t.url + t.title))) || (!wanted && pages[0]);
  if (!page) throw new Error(`No matching page. Open pages: ${pages.map((t) => t.url).join(", ") || "none"}`);
  console.log(`Attached to ${page.url}`);
  const source = readFileSync(resolve(here, "lib/probe-3d-page.js"), "utf8");
  const report = await evaluate(page.webSocketDebuggerUrl, `(${source})(${JSON.stringify(games)}, ${JSON.stringify({ thumbs, variants })})`, 240000);
  report.device = device;
  report.page = page.url;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = resolve(shellRoot, ".reports", `probe-3d-${serial.replace(/[^a-zA-Z0-9._-]/g, "_")}-${stamp}`);
  mkdirSync(out, { recursive: true });
  for (const game of report.games) {
    for (const step of game.steps) {
      if (!step.thumb) continue;
      writeFileSync(resolve(out, `${game.id}-${step.label}.png`), Buffer.from(step.thumb.split(",")[1], "base64"));
      step.thumb = `${game.id}-${step.label}.png`;
    }
  }
  writeFileSync(resolve(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  if (adbPath) {
    const log = adb(adbPath, serial, ["logcat", "-d", "-t", "600"], { capture: true, allowFailure: true }).stdout
      .split(/\r?\n/).filter((line) => /chromium|GPU|gpu_|Adreno|mali|Mali|PowerVR|libEGL|GLES|cr_/i.test(line)).slice(-200);
    writeFileSync(resolve(out, "logcat.txt"), log.join("\n") + "\n");
  }

  const gpu = report.gpu;
  console.log(`\nDevice:   ${device.manufacturer || ""} ${device.model || serial} Android ${device.android || "?"} ${device.board || ""}`);
  console.log(`WebView:  ${device.webView || report.userAgent}`);
  console.log(`GPU:      ${gpu.unmaskedRenderer || gpu.renderer} (${gpu.unmaskedVendor || gpu.vendor})`);
  console.log(`Context:  ${gpu.version} · Three r${report.runtime.revision} · ${report.runtime.legacy ? "WebGL1 fallback" : "WebGL2"} · ${report.runtime.reduced ? "reduced" : "standard"} quality`);
  console.log(`Fragment highp: ${JSON.stringify(gpu.precision.fragmentHigh)} · varyings ${gpu.limits.MAX_VARYING_VECTORS} · frag uniforms ${gpu.limits.MAX_FRAGMENT_UNIFORM_VECTORS} · depth bits ${gpu.limits.DEPTH_BITS}`);
  for (const game of report.games) {
    console.log(`\n${game.id}${game.graphics ? ` [${game.graphics.kind}/${game.graphics.quality}, precision ${game.graphics.precision}]` : ""}`);
    if (game.error) { console.log(`  ERROR ${game.error.split("\n")[0]}${game.notice ? ` · notice: ${game.notice}` : ""}`); exitCode = 1; }
    for (const step of game.steps) {
      const bad = step.programs.filter((p) => !p.runnable).length;
      console.log(`  ${step.label.padEnd(20)} black ${String(step.black).padStart(2)}/${step.of}  mean rgb(${step.mean.join(",")})${step.glError ? `  glError ${step.glError}` : ""}${bad ? `  ${bad} broken program(s)` : ""}${step.error ? `  THROW ${step.error.split("\n")[0]}` : ""}`);
    }
  }
  if (report.console.length) console.log(`\nConsole errors/warnings (${report.console.length}): first: ${report.console[0].slice(0, 300)}`);
  console.log(`\nReport: ${out}`);
} catch (error) {
  console.error(error.stack || error.message);
  exitCode = 1;
} finally { cleanup(); }
process.exit(exitCode);
