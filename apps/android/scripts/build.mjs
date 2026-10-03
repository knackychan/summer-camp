import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { boolFlag, fileInfo, parseFlags, run, resolveJava } from "./lib/android-tools.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const shellRoot = resolve(here, "..");
const repoRoot = resolve(shellRoot, "../..");
const androidProject = resolve(shellRoot, "android");
const { flags, positionals } = parseFlags(process.argv.slice(2));
const mode = positionals[0] || "debug";
const skipSync = boolFlag(flags, "skip-sync");

if (!["debug", "release-apk", "release-bundle"].includes(mode)) {
  console.error("Usage: node scripts/build.mjs [debug|release-apk|release-bundle] [--skip-sync]");
  process.exit(2);
}
if (!existsSync(resolve(shellRoot, "node_modules/@capacitor/cli"))) {
  console.error("Capacitor dependencies are missing. Run `npm --prefix apps/android install` first.");
  process.exit(2);
}
if (!existsSync(androidProject)) {
  console.error("Generated Android project is missing. Run `npm run android:bootstrap` first.");
  process.exit(2);
}

run(process.execPath, [resolve(here, "doctor.mjs"), "--strict"], { cwd: shellRoot });
if (!skipSync) run(process.execPath, [resolve(here, "sync.mjs")], { cwd: shellRoot });
run(process.execPath, [resolve(repoRoot, "scripts/verify-android-web.mjs"), resolve(androidProject, "app/src/main/assets/public"), "--native"], { cwd: repoRoot });

const gradle = resolve(androidProject, process.platform === "win32" ? "gradlew.bat" : "gradlew");
if (!existsSync(gradle)) {
  console.error(`Gradle wrapper is missing: ${gradle}`);
  process.exit(2);
}
const task = mode === "debug" ? "assembleDebug" : mode === "release-apk" ? "assembleRelease" : "bundleRelease";
const javaHome = dirname(dirname(resolveJava()));
run(gradle, [task, "--no-daemon"], { cwd: androidProject, env: { ...process.env, JAVA_HOME: javaHome } });

const outputRoot = resolve(androidProject, "app/build/outputs");
function walk(directory) {
  if (!existsSync(directory)) return [];
  const result = [];
  for (const name of readdirSync(directory)) {
    const absolute = resolve(directory, name);
    if (statSync(absolute).isDirectory()) result.push(...walk(absolute));
    else result.push(absolute);
  }
  return result;
}
const wanted = mode === "release-bundle" ? /\.aab$/i : /\.apk$/i;
const candidates = walk(outputRoot)
  .filter((file) => wanted.test(file))
  .filter((file) => mode !== "debug" || /debug/i.test(file))
  .filter((file) => mode === "debug" || /release/i.test(file))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
const artifact = candidates[0];
if (!artifact) {
  console.error(`Gradle task ${task} completed but no matching ${mode === "release-bundle" ? "AAB" : "APK"} was found under app/build/outputs.`);
  process.exit(3);
}

const reports = resolve(shellRoot, ".reports");
mkdirSync(reports, { recursive: true });
const artifactInfo = fileInfo(artifact);
const payload = JSON.parse(readFileSync(resolve(repoRoot, "dist/android-web/android-build.json"), "utf8"));
const report = {
  version: 1,
  release: payload.release,
  builtAt: new Date().toISOString(),
  mode,
  gradleTask: task,
  payload,
  artifact: { ...artifactInfo, relativePath: relative(shellRoot, artifact).replaceAll("\\", "/") },
};
const reportPath = resolve(reports, `build-${mode}.json`);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Android ${mode} artifact: ${artifact}`);
console.log(`SHA-256: ${artifactInfo.sha256}`);
console.log(`Build report: ${reportPath}`);
