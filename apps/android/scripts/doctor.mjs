import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  adbDevices,
  androidSdkRoot,
  boolFlag,
  javaMajor,
  parseFlags,
  resolveAdb,
  resolveJava,
  supportedJavaMajor,
} from "./lib/android-tools.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const shellRoot = resolve(here, "..");
const repoRoot = resolve(shellRoot, "../..");
const { flags } = parseFlags(process.argv.slice(2));
const json = boolFlag(flags, "json");
const strict = boolFlag(flags, "strict");
const requireDevice = boolFlag(flags, "require-device");

const androidProject = resolve(shellRoot, "android");
const sdk = androidSdkRoot(androidProject);
const java = resolveJava();
const javaVersion = javaMajor(java);
const adb = resolveAdb(androidProject);
const devices = adbDevices(adb);
const readyDevices = devices.filter((device) => device.state === "device");
const bundleMetaPath = resolve(repoRoot, "dist/android-web/android-build.json");
let bundleMeta = null;
try { bundleMeta = JSON.parse(readFileSync(bundleMetaPath, "utf8")); } catch {}
const readOptional = file => existsSync(file) ? readFileSync(file, "utf8") : "";
const wrapperVersion = readOptional(resolve(androidProject, "gradle/wrapper/gradle-wrapper.properties")).match(/gradle-([\d.]+)-/)?.[1];
const pluginVersion = readOptional(resolve(androidProject, "build.gradle")).match(/com\.android\.tools\.build:gradle:([\d.]+)/)?.[1];
const capacitorVersions = ["cli", "core", "android"].map(name => {
  try { return JSON.parse(readFileSync(resolve(shellRoot, `node_modules/@capacitor/${name}/package.json`), "utf8")).version; } catch { return null; }
});

const checks = [
  { id: "node22", required: true, ok: Number(process.versions.node.split(".")[0]) >= 22, detail: `Node ${process.versions.node}` },
  { id: "androidWebBundle", required: true, ok: Boolean(bundleMeta && bundleMeta.release && bundleMeta.runtime === "unified-root"), detail: bundleMeta ? `${bundleMeta.release}; ${bundleMeta.fileCount} files` : "dist/android-web missing; run npm run build:android-web" },
  { id: "capacitorDependencies", required: true, ok: existsSync(resolve(shellRoot, "node_modules/@capacitor/cli")) && existsSync(resolve(shellRoot, "node_modules/@capacitor/android")), detail: existsSync(resolve(shellRoot, "node_modules/@capacitor/cli")) ? "installed" : "run npm --prefix apps/android install" },
  { id: "androidProject", required: true, ok: existsSync(resolve(shellRoot, "android")), detail: existsSync(resolve(shellRoot, "android")) ? "generated" : "run npm run android:bootstrap" },
  { id: "gradleWrapper", required: true, ok: existsSync(resolve(shellRoot, "android", process.platform === "win32" ? "gradlew.bat" : "gradlew")), detail: "generated with the Capacitor Android project" },
  { id: "pinnedBuildVersions", required: true, ok: wrapperVersion === "8.14.3" && pluginVersion === "8.13.0" && capacitorVersions.every(version => version === "8.5.2"), detail: `Gradle ${wrapperVersion ?? "missing"}; AGP ${pluginVersion ?? "missing"}; Capacitor ${capacitorVersions.join("/")}; expected 8.14.3 / 8.13.0 / 8.5.2` },
  { id: "java21to24", required: true, ok: supportedJavaMajor(javaVersion), detail: java ? `${java}; major ${javaVersion ?? "unknown"}; Gradle 8.14.3 requires JDK 21-24 for this project` : "java not found; JDK 21-24 required" },
  { id: "androidSdk", required: true, ok: Boolean(sdk), detail: sdk || "ANDROID_SDK_ROOT / ANDROID_HOME not found" },
  { id: "androidPlatform36", required: true, ok: Boolean(sdk && existsSync(resolve(sdk, "platforms/android-36/android.jar"))), detail: sdk ? resolve(sdk, "platforms/android-36") : "Android SDK unavailable" },
  { id: "adb", required: true, ok: Boolean(adb), detail: adb || "adb not found" },
  { id: "authorizedDevice", required: requireDevice, ok: readyDevices.length > 0, detail: readyDevices.length ? readyDevices.map((device) => device.serial).join(", ") : "no authorized device/emulator connected" },
];

const report = {
  version: 1,
  release: bundleMeta?.release ?? "unknown",
  strict,
  requireDevice,
  checks,
  devices,
  ok: checks.every((check) => !check.required || check.ok),
};

if (json) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  for (const check of checks) {
    const label = check.ok ? "OK" : (check.required ? "MISSING" : "INFO");
    console.log(`${label.padEnd(7)} ${check.id.padEnd(22)} ${check.detail}`);
  }
  console.log(report.ok ? "\nAndroid environment is ready for the requested gate." : "\nAndroid environment is not ready for the requested gate.");
}

if (strict && !report.ok) process.exitCode = 2;
