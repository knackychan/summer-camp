import { rmSync, existsSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const agent = process.argv.includes("--agent");
const out = resolve(root, agent ? "dist/agent-proxy" : "dist/mobile");
const compiler = resolve(root, "node_modules/typescript/lib/tsc.js");
if (!existsSync(compiler)) throw new Error("Run npm ci at the repository root before building TypeScript.");
if (!out.startsWith(resolve(root, "dist") + "/") && !out.startsWith(resolve(root, "dist") + "\\")) throw new Error("Unsafe build output path");
// Check the compiler before replacing the previous generated output.
const checked = spawnSync(process.execPath, [compiler, "--version"], { cwd: root, stdio: "inherit" });
if (checked.error) throw checked.error;
if (checked.status !== 0) process.exit(checked.status || 1);
rmSync(out, { recursive: true, force: true });

const result = spawnSync(process.execPath, [compiler, "-p", agent ? "tsconfig.agent-proxy.json" : "tsconfig.mobile.json"], {
  cwd: root,
  stdio: "inherit",
  shell: false,
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status || 1);

const entry = resolve(out, agent ? "server/agent-proxy/src/AgentProxyService.js" : "packages/learning/src/legacy/BrainMathLearningBridge.js");
if (!existsSync(entry)) {
  console.error("Mobile build did not create", entry);
  process.exit(1);
}
writeFileSync(resolve(out, "package.json"), '{"type":"module"}\n');
console.log(`Summer Quest modules built to ${out}`);
