import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const androidRoot = resolve(here, "..");
const project = resolve(androidRoot, "android");
const overlay = resolve(androidRoot, "native-overlay");

if (!existsSync(project)) {
  console.error("Capacitor Android project is missing. Run `npm run bootstrap` from apps/android first.");
  process.exit(1);
}

const files = [
  ["app/src/main/AndroidManifest.xml", "app/src/main/AndroidManifest.xml"],
  ["app/src/main/java/com/summerquest/app/MainActivity.java", "app/src/main/java/com/summerquest/app/MainActivity.java"],
  ["app/src/main/java/com/summerquest/app/SummerQuestNativePlugin.java", "app/src/main/java/com/summerquest/app/SummerQuestNativePlugin.java"],
  ["app/src/main/java/com/summerquest/app/LanHub.java", "app/src/main/java/com/summerquest/app/LanHub.java"],
];

for (const [sourceRel, targetRel] of files) {
  const source = resolve(overlay, sourceRel);
  const target = resolve(project, targetRel);
  if (!existsSync(source)) throw new Error(`Missing native overlay: ${sourceRel}`);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target);
}

const gradle = resolve(project, "app/build.gradle");
const source = readFileSync(gradle, "utf8");
const upgraded = source.replace(/versionCode 1\s+versionName "1\.0"/, 'versionCode 2\n        versionName "1.1"');
if (upgraded === source && !/versionCode 2\s+versionName "1\.1"/.test(source)) {
  throw new Error("Android template version changed; inspect the installed version before building.");
}
if (upgraded !== source) writeFileSync(gradle, upgraded);

console.log("Summer Quest native Android overlay applied.");
