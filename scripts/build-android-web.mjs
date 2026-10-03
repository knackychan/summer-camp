import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { root, offlineConfig, sourceFiles, treeHash, verifyBundle } from "./verify-android-web.mjs";

const built = spawnSync(process.execPath, [resolve(root, "scripts/build-mobile.mjs")], { cwd: root, stdio: "inherit" });
if (built.error) throw built.error;
if (built.status !== 0) process.exit(built.status || 1);
// Resolve every input before replacing the generated payload.
const files = sourceFiles();
for (const file of files) if (!existsSync(resolve(root, file))) throw new Error(`Missing build input: ${file}`);
const out = resolve(root, "dist/android-web");
if (dirname(out) !== resolve(root, "dist")) throw new Error("Unsafe build output path");
// Windows may keep the served output directory open. Replace its contents while
// retaining that directory; obsolete generated files still cannot survive.
mkdirSync(out, { recursive: true });
for (const entry of readdirSync(out)) {
  const target = resolve(out, entry);
  if (dirname(target) !== out) throw new Error("Unsafe build cleanup path");
  rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
for (const file of files) {
  mkdirSync(dirname(resolve(out, file)), { recursive: true });
  cpSync(resolve(root, file), resolve(out, file));
}
const privateConfig = resolve(root, "js/config.js");
if (existsSync(privateConfig)) cpSync(privateConfig, resolve(out, "js/config.js"));
else writeFileSync(resolve(out, "js/config.js"), offlineConfig);
const payload = [...files, "js/config.js"].sort();
const metadata = {
  version: 2,
  release: "v0.6.3-desktop",
  runtime: "unified-root",
  entry: "index.html",
  localOnlyConfig: !existsSync(privateConfig),
  fileCount: payload.length,
  treeSha256: treeHash(out, payload),
};
writeFileSync(resolve(out, "android-build.json"), `${JSON.stringify(metadata, null, 2)}\n`);
verifyBundle(out);
console.log(`Summer Quest web bundle: ${metadata.fileCount} files, ${metadata.treeSha256}`);
