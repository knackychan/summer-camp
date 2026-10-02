import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { androidSdkRoot, ensureLocalProperties, run } from "./lib/android-tools.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const shellRoot = resolve(here, "..");
const repoRoot = resolve(shellRoot, "../..");
const androidProject = resolve(shellRoot, "android");
const cap = resolve(shellRoot, "node_modules/@capacitor/cli/bin/capacitor");

if (!existsSync(androidProject)) {
  console.error("Capacitor Android project is missing. Run `npm run bootstrap` from apps/android first.");
  process.exit(2);
}
run(process.execPath, [resolve(repoRoot, "scripts/build-android-web.mjs")], { cwd: repoRoot });
const sdk = androidSdkRoot(androidProject);
ensureLocalProperties(androidProject, sdk);
run(process.execPath, [cap, "sync", "android"], { cwd: shellRoot });
run(process.execPath, [resolve(here, "apply-native-overlay.mjs")], { cwd: shellRoot });
run(process.execPath, [resolve(repoRoot, "scripts/verify-android-web.mjs"), resolve(androidProject, "app/src/main/assets/public"), "--native"], { cwd: repoRoot });
