import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { androidSdkRoot, ensureLocalProperties, run } from "./lib/android-tools.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const shellRoot = resolve(here, "..");
const repoRoot = resolve(shellRoot, "../..");
const androidProject = resolve(shellRoot, "android");
const cap = resolve(shellRoot, "node_modules/@capacitor/cli/bin/capacitor");

if (!existsSync(resolve(shellRoot, "node_modules/@capacitor/cli"))) {
  console.error("Android shell dependencies are not installed. Run `npm install` inside apps/android, then rerun bootstrap.");
  process.exit(2);
}

run(process.execPath, [resolve(repoRoot, "scripts/build-android-web.mjs")], { cwd: repoRoot });
if (!existsSync(androidProject)) run(process.execPath, [cap, "add", "android"], { cwd: shellRoot });
const sdk = androidSdkRoot(androidProject);
ensureLocalProperties(androidProject, sdk);
run(process.execPath, [cap, "sync", "android"], { cwd: shellRoot });
run(process.execPath, [resolve(here, "apply-native-overlay.mjs")], { cwd: shellRoot });
run(process.execPath, [resolve(repoRoot, "scripts/verify-android-web.mjs"), resolve(androidProject, "app/src/main/assets/public"), "--native"], { cwd: repoRoot });
console.log("Android project ready. Open it with `npm run open` from apps/android.");
