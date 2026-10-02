import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  adb,
  adbDevices,
  boolFlag,
  fileInfo,
  parseFlags,
  resolveAdb,
  selectDevice,
  shell,
} from "./lib/android-tools.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const shellRoot = resolve(here, "..");
const { flags, positionals } = parseFlags(process.argv.slice(2));
const command = positionals[0] || "status";
const serial = typeof flags.get("serial") === "string" ? flags.get("serial") : undefined;
const json = boolFlag(flags, "json");
const adbPath = resolveAdb(resolve(shellRoot, "android"));
if (!adbPath) {
  console.error("adb was not found. Install Android SDK Platform Tools or set ANDROID_SDK_ROOT.");
  process.exit(2);
}

let selected;
try { selected = selectDevice(adbDevices(adbPath), serial); }
catch (error) { console.error(error.message); process.exit(2); }

const packageId = "com.summerquest.app";
const activity = `${packageId}/.MainActivity`;
const reportsDir = resolve(shellRoot, ".reports");
mkdirSync(reportsDir, { recursive: true });

function prop(name) {
  const result = shell(adbPath, selected.serial, ["getprop", name], { capture: true, allowFailure: true });
  return result.status === 0 ? result.stdout.trim() : "";
}
function shellText(args) {
  const result = shell(adbPath, selected.serial, args, { capture: true, allowFailure: true });
  return result.status === 0 ? result.stdout.trim() : "";
}
function installed() {
  return shellText(["pm", "path", packageId]).includes("package:");
}
function deviceInfo() {
  const packageDetails = shellText(["dumpsys", "package", packageId]);
  return {
    serial: selected.serial,
    manufacturer: prop("ro.product.manufacturer"),
    model: prop("ro.product.model"),
    androidVersion: prop("ro.build.version.release"),
    apiLevel: Number(prop("ro.build.version.sdk")) || null,
    display: shellText(["wm", "size"]),
    density: shellText(["wm", "density"]),
    installed: installed(),
    installedVersionName: packageDetails.match(/\bversionName=([^\s]+)/)?.[1] ?? null,
    installedVersionCode: Number(packageDetails.match(/\bversionCode=(\d+)/)?.[1]) || null,
  };
}
function latestDebugApk() {
  const reportPath = resolve(reportsDir, "build-debug.json");
  if (existsSync(reportPath)) {
    try {
      const report = JSON.parse(readFileSync(reportPath, "utf8"));
      if (report.artifact?.path && existsSync(report.artifact.path)) return report.artifact.path;
    } catch {}
  }
  return resolve(shellRoot, "android/app/build/outputs/apk/debug/app-debug.apk");
}
function wait(ms) { return new Promise((resolveWait) => setTimeout(resolveWait, ms)); }

let release = "unknown";
try { release = JSON.parse(readFileSync(resolve(shellRoot, "../../dist/android-web/android-build.json"), "utf8")).release || "unknown"; } catch {}
let report = { version: 1, release, command, device: deviceInfo(), ok: true };

if (command === "status") {
  // Device identity only. No state-changing ADB commands are used.
} else if (command === "install") {
  const apk = typeof flags.get("apk") === "string" ? resolve(String(flags.get("apk"))) : latestDebugApk();
  if (!existsSync(apk)) {
    console.error(`Debug APK not found: ${apk}\nRun npm run android:build:debug first, or pass --apk <path>.`);
    process.exit(3);
  }
  const installResult = adb(adbPath, selected.serial, ["install", "-r", "-t", apk], { capture: true, allowFailure: true });
  if (installResult.status !== 0 || !/Success/i.test(`${installResult.stdout}\n${installResult.stderr}`)) {
    console.error(installResult.stdout || installResult.stderr || "adb install failed");
    process.exit(4);
  }
  report = { ...report, artifact: fileInfo(apk), installed: true, device: deviceInfo() };
} else if (command === "launch") {
  const start = shell(adbPath, selected.serial, ["am", "start", "-W", "-n", activity], { capture: true, allowFailure: true });
  report = { ...report, launchOutput: start.stdout.trim(), ok: start.status === 0 && !/Error:/i.test(start.stdout + start.stderr) };
} else if (command === "smoke") {
  if (!installed()) {
    console.error("Summer Quest is not installed on the selected device. Run npm run android:install first.");
    process.exit(3);
  }
  shell(adbPath, selected.serial, ["am", "force-stop", packageId], { capture: true, allowFailure: true });
  const cold = shell(adbPath, selected.serial, ["am", "start", "-W", "-n", activity], { capture: true, allowFailure: true });
  await wait(1200);
  const pidCold = shellText(["pidof", packageId]);
  shell(adbPath, selected.serial, ["input", "keyevent", "KEYCODE_HOME"], { capture: true, allowFailure: true });
  await wait(300);
  const resume = shell(adbPath, selected.serial, ["am", "start", "-W", "-n", activity], { capture: true, allowFailure: true });
  await wait(500);
  const pidResume = shellText(["pidof", packageId]);
  const logs = adb(adbPath, selected.serial, ["logcat", "-d", "-t", "250"], { capture: true, allowFailure: true }).stdout
    .split(/\r?\n/)
    .filter((line) => /SummerQuest|Capacitor|AndroidRuntime/.test(line))
    .slice(-80);
  report = {
    ...report,
    coldStart: { ok: cold.status === 0 && Boolean(pidCold), pid: pidCold, output: cold.stdout.trim() },
    backgroundResume: { ok: resume.status === 0 && Boolean(pidResume), pid: pidResume, output: resume.stdout.trim() },
    logs,
    ok: cold.status === 0 && Boolean(pidCold) && resume.status === 0 && Boolean(pidResume),
  };
  const reportPath = resolve(reportsDir, `device-smoke-${selected.serial.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  report.reportPath = reportPath;
} else {
  console.error("Usage: node scripts/device.mjs [status|install|launch|smoke] [--serial <id>] [--apk <path>] [--json]");
  process.exit(2);
}

if (json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
else {
  console.log(`Device: ${report.device.manufacturer} ${report.device.model} (${report.device.serial}) Android ${report.device.androidVersion} / API ${report.device.apiLevel}`);
  console.log(`Display: ${report.device.display || "unknown"}; ${report.device.density || "density unknown"}`);
  console.log(`Summer Quest installed: ${report.device.installed ? "yes" : "no"}`);
  if (report.artifact) console.log(`Installed APK SHA-256: ${report.artifact.sha256}`);
  if (report.coldStart) console.log(`Cold start process: ${report.coldStart.ok ? "OK" : "FAILED"}`);
  if (report.backgroundResume) console.log(`Background/resume process: ${report.backgroundResume.ok ? "OK" : "FAILED"}`);
  if (report.reportPath) console.log(`Device report: ${report.reportPath}`);
  if (command === "status" || command === "smoke") {
    console.log("\nPhysical acceptance still requires the manual checklist: apps/android/ACCEPTANCE-CHECKLIST.md");
    console.log("The tooling intentionally does not toggle airplane mode, force orientation, or change accessibility/device settings.");
  }
}
if (!report.ok) process.exitCode = 5;
