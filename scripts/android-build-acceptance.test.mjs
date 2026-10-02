import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("v0.6.1 exposes one build/device workflow from the root package", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["android:doctor:strict"], "npm --prefix apps/android run doctor -- --strict");
  assert.equal(pkg.scripts["android:build:debug"], "npm --prefix apps/android run build:debug");
  assert.equal(pkg.scripts["android:install"], "npm --prefix apps/android run device -- install");
  assert.equal(pkg.scripts["android:smoke"], "npm --prefix apps/android run device -- smoke");
  assert.match(pkg.scripts["test:android-acceptance"], /android-build-acceptance\.test\.mjs/);
});

test("isolated Android package identifies recovery and keeps Capacitor pinned", () => {
  const pkg = JSON.parse(read("apps/android/package.json"));
  assert.equal(pkg.version, "0.6.2");
  assert.equal(pkg.dependencies["@capacitor/core"], "8.5.2");
  assert.equal(pkg.dependencies["@capacitor/android"], "8.5.2");
  assert.equal(pkg.devDependencies["@capacitor/cli"], "8.5.2");
  assert.equal(pkg.scripts.doctor, "node scripts/doctor.mjs");
  assert.match(pkg.scripts["build:debug"], /build\.mjs debug/);
  assert.match(pkg.scripts.device, /device\.mjs/);
});

test("strict doctor checks the complete documented Android toolchain", () => {
  const doctor = read("apps/android/scripts/doctor.mjs");
  for (const gate of ["node22", "androidWebBundle", "capacitorDependencies", "androidProject", "gradleWrapper", "java21to24", "androidSdk", "androidPlatform36", "adb"]) {
    assert.match(doctor, new RegExp(`id: \\"${gate}\\"`));
  }
  assert.match(doctor, /--require-device|require-device/);
  assert.match(doctor, /if \(strict && !report\.ok\) process\.exitCode = 2/);
});

test("Gradle build gate performs sync, uses wrapper tasks and hashes the artifact", () => {
  const source = read("apps/android/scripts/build.mjs");
  assert.match(source, /sync\.mjs/);
  assert.match(source, /assembleDebug/);
  assert.match(source, /assembleRelease/);
  assert.match(source, /bundleRelease/);
  assert.match(source, /--no-daemon/);
  assert.match(source, /sha256/);
  assert.match(source, /\.reports/);
  assert.doesNotMatch(source, /keystore|storePassword|keyPassword/i);
});

test("ADB parser and device selector reject ambiguous or unauthorized targets", async () => {
  const tools = await import(pathToFileURL(resolve(root, "apps/android/scripts/lib/android-tools.mjs")).href + `?v=${Date.now()}`);
  const devices = tools.parseAdbDevices("List of devices attached\nABC\tdevice product:x model:Tablet\nDEF\tunauthorized usb:1\n\n");
  assert.equal(devices.length, 2);
  assert.equal(tools.selectDevice(devices).serial, "ABC");
  assert.throws(() => tools.selectDevice([{ serial: "DEF", state: "unauthorized", detail: "" }]), /No authorized/);
  assert.throws(() => tools.selectDevice([{ serial: "A", state: "device", detail: "" }, { serial: "B", state: "device", detail: "" }]), /Multiple Android devices/);
  assert.throws(() => tools.selectDevice(devices, "DEF"), /not authorized\/ready/);
});

test("device smoke is bounded and does not silently alter connectivity or orientation", () => {
  const source = read("apps/android/scripts/device.mjs");
  assert.match(source, /am", "force-stop/);
  assert.match(source, /am", "start/);
  assert.match(source, /KEYCODE_HOME/);
  assert.match(source, /pidof/);
  assert.match(source, /logcat/);
  assert.doesNotMatch(source, /\["svc",\s*"(?:wifi|data)"/i);
  assert.doesNotMatch(source, /\["settings",\s*"put"/i);
  assert.doesNotMatch(source, /accelerometer_rotation|user_rotation/i);
  assert.doesNotMatch(source, /\["pm",\s*"grant"/i);
});

test("physical-device checklist owns the hardware-only acceptance gates", () => {
  const checklist = read("apps/android/ACCEPTANCE-CHECKLIST.md");
  for (const phrase of [
    "offline cold start",
    "Android Back behavior",
    "Portrait / landscape / resizing",
    "Haptics + voice guidance",
    "Audio focus + lifecycle",
    "Persistence / process death",
    "Physical-device acceptance PASS",
  ]) assert.match(checklist, new RegExp(phrase.replace(/[+/]/g, "\\$&"), "i"));
  assert.match(checklist, /Airplane mode ON/);
  assert.match(checklist, /APK SHA-256/);
});

test("Windows shortcuts are thin wrappers over the same npm workflow", () => {
  assert.match(read("BUILD-ANDROID-DEBUG.cmd"), /npm run android:doctor:strict[\s\S]*npm run android:build:debug/);
  assert.match(read("INSTALL-ANDROID-DEBUG.cmd"), /npm run android:doctor:strict -- --require-device[\s\S]*npm run android:install/);
  assert.match(read("CHECK-ANDROID-DEVICE.cmd"), /npm run android:device/);
});

test("generated Android workstation state stays out of authoritative source", () => {
  const ignore = read(".gitignore");
  assert.match(ignore, /apps\/android\/android\//);
  assert.match(ignore, /apps\/android\/\.reports\//);
});

test("Android web bundle metadata identifies root recovery and a versioned browser cache", () => {
  const build = read("scripts/build-android-web.mjs");
  const sw = read("sw.js");
  assert.match(build, /release: "v0\.6\.2-recovery"/);
  assert.match(build, /runtime: "unified-root"/);
  assert.match(sw, /summer-quest-v\d+/);
});

test("acceptance tooling does not expand native product authority", () => {
  const manifest = read("apps/android/native-overlay/app/src/main/AndroidManifest.xml");
  const activity = read("apps/android/native-overlay/app/src/main/java/com/summerquest/app/MainActivity.java");
  const plugin = read("apps/android/native-overlay/app/src/main/java/com/summerquest/app/SummerQuestNativePlugin.java");
  assert.match(manifest, /android\.permission\.INTERNET/);
  assert.match(manifest, /android\.permission\.VIBRATE/);
  assert.doesNotMatch(manifest, /CAMERA|RECORD_AUDIO|ACCESS_FINE_LOCATION|READ_CONTACTS|POST_NOTIFICATIONS/);
  assert.doesNotMatch(activity + plugin, /mastery|rewardStars|correctOptionId|OPENAI|ANTHROPIC|api[_-]?key/i);
});
