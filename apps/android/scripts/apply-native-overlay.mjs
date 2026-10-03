import { cpSync, existsSync, mkdirSync } from "node:fs";
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
];

for (const [sourceRel, targetRel] of files) {
  const source = resolve(overlay, sourceRel);
  const target = resolve(project, targetRel);
  if (!existsSync(source)) throw new Error(`Missing native overlay: ${sourceRel}`);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target);
}

console.log("Summer Quest native Android overlay applied.");
