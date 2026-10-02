import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { run, batchCommandLine, ensureLocalProperties, supportedJavaMajor } from "../apps/android/scripts/lib/android-tools.mjs";
import { root, verifyBundle } from "./verify-android-web.mjs";

const tempRoot = resolve(root, ".tmp");
mkdirSync(tempRoot, { recursive: true });

test("process invocation preserves spaced paths, cwd, arguments and failures", () => {
  const directory = mkdtempSync(resolve(tempRoot, "build tools "));
  try {
    const script = resolve(directory, "echo args.cjs");
    writeFileSync(script, 'console.log(JSON.stringify({cwd:process.cwd(),args:process.argv.slice(2)}));');
    const executable = process.platform === "win32" ? resolve(directory, "echo args.cmd") : process.execPath;
    if (process.platform === "win32") writeFileSync(executable, `@"${process.execPath}" "${script}" %*\r\n`);
    const result = run(executable, process.platform === "win32" ? ["two words"] : [script, "two words"], { cwd: directory, capture: true });
    assert.deepEqual(JSON.parse(result.stdout), { cwd: directory, args: ["two words"] });
    assert.equal(run(process.execPath, ["-e", "process.exit(7)"], { capture: true, allowFailure: true }).status, 7);
    assert.throws(() => run(process.execPath, [], directory), /options must be an object/);
    for (const argument of ["& whoami", "%PATH%", 'bad"quote', "bad\nline", "!delayed!"]) assert.throws(() => batchCommandLine("gradlew.bat", [argument]), /Unsafe/);
  } finally {
    assert.equal(dirname(directory), tempRoot);
    rmSync(directory, { recursive: true, force: true });
  }
});

test("JDK bounds and SDK repair preserve unrelated local properties", () => {
  assert.deepEqual([17, 20, 21, 22, 23, 24, 25, null].map(supportedJavaMajor), [false, false, true, true, true, true, false, false]);
  const directory = mkdtempSync(resolve(tempRoot, "sdk properties "));
  try {
    const properties = resolve(directory, "local.properties");
    writeFileSync(properties, "custom.property=keep\nsdk.dir=C:/missing-sdk\n");
    ensureLocalProperties(directory, resolve(directory, "sdk path"));
    assert.equal(readFileSync(properties, "utf8"), `custom.property=keep\nsdk.dir=${resolve(directory, "sdk path").replaceAll("\\", "/")}\n`);
    assert.throws(() => ensureLocalProperties(directory, null), /SDK platform 36 missing/);
  } finally {
    assert.equal(dirname(directory), tempRoot);
    rmSync(directory, { recursive: true, force: true });
  }
});

test("payload verifier rejects missing, stale and extra files and checks native output", () => {
  const bundle = resolve(root, "dist/android-web");
  verifyBundle(bundle);
  const directory = mkdtempSync(resolve(tempRoot, "payload check "));
  try {
    cpSync(bundle, directory, { recursive: true });
    // Exercise native-only bridge exclusions in a fixture, without requiring
    // an unrelated workstation Android build to match current web source.
    for (const file of ["cordova.js", "cordova_plugins.js"]) writeFileSync(resolve(directory, file), "");
    verifyBundle(directory, { native: true });
    assert.throws(() => verifyBundle(directory), /Source\/payload coverage differs/);
    for (const file of ["cordova.js", "cordova_plugins.js"]) rmSync(resolve(directory, file));
    const asset = "assets/books/animals";
    renameSync(resolve(directory, asset), resolve(directory, "missing-animals"));
    assert.throws(() => verifyBundle(directory), /Source\/payload coverage differs/);
    renameSync(resolve(directory, "missing-animals"), resolve(directory, asset));
    writeFileSync(resolve(directory, "unexpected.js"), "");
    assert.throws(() => verifyBundle(directory), /Source\/payload coverage differs/);
    rmSync(resolve(directory, "unexpected.js"));
    writeFileSync(resolve(directory, "index.html"), "stale");
    assert.throws(() => verifyBundle(directory), /Stale payload: index.html/);
  } finally {
    assert.equal(dirname(directory), tempRoot);
    rmSync(directory, { recursive: true, force: true });
  }
});
