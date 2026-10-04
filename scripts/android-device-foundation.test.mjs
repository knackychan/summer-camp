import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
const androidRoot = resolve(root, "apps/android");
const bundle = resolve(root, "dist/android-web");

function read(path) { return readFileSync(resolve(root, path), "utf8"); }
function walk(directory) {
  const files = [];
  for (const name of readdirSync(directory)) {
    const absolute = resolve(directory, name);
    if (statSync(absolute).isDirectory()) files.push(...walk(absolute));
    else files.push(absolute);
  }
  return files;
}

test("Android shell pins stable Capacitor 8.5.2 and local HTTPS assets", () => {
  const pkg = JSON.parse(read("apps/android/package.json"));
  assert.equal(pkg.dependencies["@capacitor/core"], "8.5.2");
  assert.equal(pkg.dependencies["@capacitor/android"], "8.5.2");
  assert.equal(pkg.devDependencies["@capacitor/cli"], "8.5.2");
  const config = JSON.parse(read("apps/android/capacitor.config.json"));
  assert.equal(config.webDir, "../../dist/android-web");
  assert.equal(config.server.androidScheme, "https");
  assert.equal(config.server.url, undefined, "release shell must not depend on a remote server URL");
});

test("Android web bundle boots the real root runtime with no shell recursion", () => {
  const index = readFileSync(resolve(bundle, "index.html"), "utf8");
  assert.match(index, /id="home"/);
  assert.match(index, /id="hub"/);
  assert.match(index, /js\/main\.js/);
  assert.match(index, /js\/content-registry\.js/);
  assert.doesNotMatch(index, /dist\/mobile\/apps\/kid\/src\/main\.js/);
  assert.doesNotMatch(index, /<iframe[^>]+activity-frame/);
  assert.equal(existsSync(resolve(bundle, "legacy.html")), false);
  const metadata = JSON.parse(readFileSync(resolve(bundle, "android-build.json"), "utf8"));
  assert.equal(metadata.localOnlyConfig, !existsSync(resolve(root, "js/config.js")));
  if (metadata.localOnlyConfig) assert.ok(readFileSync(resolve(bundle, "js/config.js"), "utf8").includes("local/offline build"));
  else assert.ok(readFileSync(resolve(bundle, "js/config.js")).equals(readFileSync(resolve(root, "js/config.js"))), "bundled browser config matches local input");
});

test("Android web bundle tree hash is deterministic and self-described", () => {
  const metadata = JSON.parse(readFileSync(resolve(bundle, "android-build.json"), "utf8"));
  const files = walk(bundle).filter((file) => relative(bundle, file).replaceAll("\\", "/") !== "android-build.json").sort();
  const digest = createHash("sha256");
  for (const file of files) {
    const rel = relative(bundle, file).replaceAll("\\", "/");
    digest.update(rel); digest.update("\0"); digest.update(readFileSync(file)); digest.update("\0");
  }
  assert.equal(metadata.fileCount, files.length);
  assert.equal(metadata.treeSha256, digest.digest("hex"));
  assert.equal(metadata.entry, "index.html");
  assert.equal(metadata.runtime, "unified-root");
  assert.equal(metadata.legacyEntry, undefined);
});

test("Android build promotes root runtime rather than the prototype kid shell", () => {
  const build = read("scripts/build-android-web.mjs");
  assert.match(build, /sourceFiles/);
  assert.doesNotMatch(build, /legacy\.html/);
  assert.doesNotMatch(build, /apps\/kid\/index\.html/);
  const source = read("index.html");
  assert.match(source, /window\.SQAppNavigation=/);
  assert.match(source, /SQPlatform\.registerBackHandler\)SQPlatform\.registerBackHandler\(summerQuestBack\)/);
});

test("classic platform seam registers the bounded Capacitor plugin before app services use it", async () => {
  const calls = [];
  const listeners = new Map();
  const windowListeners = new Map();
  const plugin = {
    haptic(options) { calls.push(["haptic", options.kind]); return Promise.resolve({ supported: true }); },
    speak(options) { calls.push(["speak", options.text, options.lang]); return Promise.resolve({ supported: true }); },
    requestAudioFocus() { calls.push(["focus"]); return Promise.resolve({ granted: true }); },
    releaseAudioFocus() { calls.push(["release"]); return Promise.resolve(); },
    addListener(name, handler) { listeners.set(name, handler); return Promise.resolve({ remove() {} }); },
  };
  const context = {
    console,
    Promise,
    navigator: {},
    CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
    Event: class Event { constructor(type) { this.type = type; } },
    Capacitor: {
      isNativePlatform() { return true; },
      Plugins: { SummerQuestNative: plugin },
    },
    addEventListener(name, handler) { windowListeners.set(name, handler); },
    dispatchEvent(event) { const handler = windowListeners.get(event.type); if (handler) handler(event); },
  };
  context.window = context;
  context.parent = context;
  vm.runInNewContext(read("js/platform.js"), context, { filename: "platform.js" });
  assert.equal(context.SummerQuestNative.native, true);
  assert.equal(context.SQPlatform.capabilities().native, true);
  assert.equal(await context.SQPlatform.haptic("success"), true);
  assert.equal(await context.SQPlatform.requestAudioFocus(), true);
  let backed = 0;
  context.SummerQuestNative.setBackHandler(() => { backed += 1; return true; });
  assert.equal(context.SummerQuestNative.triggerBack(), true);
  assert.equal(backed, 1);
  await context.SQPlatform.releaseAudioFocus();
  assert.deepEqual(calls.map((entry) => entry[0]), ["haptic", "focus", "release"]);
  assert.equal(listeners.has("audioFocusChanged"), true);
  assert.equal(listeners.has("lifecycleChanged"), true);
});

test("native overlay registers a bounded Capacitor plugin before BridgeActivity loads the page", () => {
  const activity = read("apps/android/native-overlay/app/src/main/java/com/summerquest/app/MainActivity.java");
  const plugin = read("apps/android/native-overlay/app/src/main/java/com/summerquest/app/SummerQuestNativePlugin.java");
  const overlay = read("apps/android/scripts/apply-native-overlay.mjs");
  const manifest = read("apps/android/native-overlay/app/src/main/AndroidManifest.xml");
  assert.match(activity, /registerPlugin\(SummerQuestNativePlugin\.class\);\s*super\.onCreate\(savedInstanceState\);/s);
  assert.match(activity, /getOnBackPressedDispatcher\(\)\.addCallback\(this, backCallback\)/);
  assert.doesNotMatch(activity, /addJavascriptInterface|JavascriptInterface/);
  assert.match(activity, /window\.SummerQuestNative&&window\.SummerQuestNative\.triggerBack/);
  assert.match(plugin, /@CapacitorPlugin\(name = "SummerQuestNative"\)/);
  assert.match(plugin, /@PluginMethod\s+public void haptic/);
  assert.match(plugin, /@PluginMethod\s+public void speak/);
  assert.match(plugin, /@PluginMethod\s+public void requestAudioFocus/);
  assert.match(plugin, /@PluginMethod\s+public void releaseAudioFocus/);
  assert.match(plugin, /notifyListeners\("lifecycleChanged"/);
  assert.match(plugin, /notifyListeners\("audioFocusChanged"/);
  assert.match(plugin, /Build\.VERSION_CODES\.O/);
  assert.doesNotMatch(plugin, /\.isBlank\(/, "native helpers must not require the Android 13 String.isBlank API");
  assert.match(plugin, /vibrator\.vibrate\(pattern, -1\)/, "API 24-25 must not call VibrationEffect");
  assert.match(overlay, /SummerQuestNativePlugin\.java/);
  /* Home-wifi sessions (brick-lab multiplayer plan, slice 03): transport only, no location. */
  const lan = read("apps/android/native-overlay/app/src/main/java/com/summerquest/app/LanHub.java");
  assert.match(overlay, /LanHub\.java/);
  for (const method of ["lanHost", "lanStop", "lanDiscover", "lanStopDiscover", "lanJoin", "lanSend", "lanClose", "lanLeave", "keepAwake"]) {
    assert.match(plugin, new RegExp(`@PluginMethod\\s+public void ${method}\\(`), method);
  }
  assert.match(lan, /LINE_MAX = 64 \* 1024/);
  assert.match(manifest, /android\.permission\.CHANGE_WIFI_MULTICAST_STATE/);
  assert.doesNotMatch(lan + manifest, /ACCESS_COARSE_LOCATION|NEARBY_WIFI_DEVICES/);
  assert.doesNotMatch(lan, /\.isBlank\(/);
  assert.match(manifest, /android\.permission\.INTERNET/);
  assert.match(manifest, /android\.permission\.VIBRATE/);
  assert.doesNotMatch(manifest, /CAMERA|RECORD_AUDIO|ACCESS_FINE_LOCATION|READ_CONTACTS|POST_NOTIFICATIONS/);
  assert.doesNotMatch(activity + plugin, /mastery|rewardStars|correctOptionId|OPENAI|ANTHROPIC|api[_-]?key/i);
});

test("shared audio hooks are native-focus aware but browser-safe", () => {
  const audio = read("js/game-services/audio.js");
  assert.match(audio, /SQPlatform/);
  assert.match(audio, /requestAudioFocus/);
  assert.match(audio, /releaseAudioFocus/);
  assert.match(audio, /summerquest:native-audio-lost/);
  assert.match(audio, /summerquest:native-audio-gained/);
  assert.match(audio, /summerquest:native-resume/);
});
