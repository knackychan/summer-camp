import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const offlineConfig = "/* Summer Quest local/offline build: no remote provider config. */\n";
const sourceDirectories = ["assets", "books", "css", "js", "dist/mobile"];
const sourceEntries = ["index.html", "admin.html", "manifest.webmanifest", "sw.js"];
// Source references and development entries are not runtime dependencies.
const excluded = new Set(["js/config.js", "js/config.example.js", "js/games/cube.js"]);

export function filesIn(directory) {
  return readdirSync(directory, { recursive: true, withFileTypes: true }).filter(entry => {
    assert.equal(entry.isSymbolicLink(), false, `Symlink is not a reproducible build input: ${entry.name}`);
    return entry.isFile();
  }).map(entry => relative(directory, resolve(entry.parentPath, entry.name)).replaceAll("\\", "/")).sort();
}

export function sourceFiles() {
  return [...sourceEntries, ...sourceDirectories.flatMap(directory => filesIn(resolve(root, directory)).map(file => `${directory}/${file}`))]
    .filter(file => !excluded.has(file) && !/(?:^|\/)CLAUDE\.md$/.test(file)).sort();
}

export function treeHash(directory, files) {
  const digest = createHash("sha256");
  for (const file of [...files].sort()) digest.update(file).update("\0").update(readFileSync(resolve(directory, file))).update("\0");
  return digest.digest("hex");
}

export function verifyBundle(directory, { native = false } = {}) {
  const expected = sourceFiles();
  const generated = ["android-build.json", "js/config.js"];
  const actual = filesIn(directory).filter(file => !native || !/^cordova(?:_plugins)?\.js$/.test(file));
  assert.deepEqual(actual, [...expected, ...generated].sort(), "Source/payload coverage differs (missing or unexpected files)");
  for (const file of expected) assert.ok(readFileSync(resolve(directory, file)).equals(readFileSync(resolve(root, file))), `Stale payload: ${file}`);
  const config = existsSync(resolve(root, "js/config.js")) ? readFileSync(resolve(root, "js/config.js")) : Buffer.from(offlineConfig);
  assert.ok(readFileSync(resolve(directory, "js/config.js")).equals(config), "Config differs from build input");
  for (const file of actual.filter(file => /\.(?:html|js|css)$/.test(file))) {
    const text = readFileSync(resolve(directory, file), "utf8");
    assert.doesNotMatch(text, /dist\/mobile\/(?:apps\/kid|packages\/(?:navigation|activities|world|state))\//, `Retired executable reference in ${file}`);
    const references = [...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.[^"']+\.js)["']/g)].map(match => match[1]);
    if (file.endsWith(".html")) {
      const html = text.replace(/<script\b([^>]*)>[\s\S]*?<\/script>/gi, '<script $1></script>');
      references.push(...[...html.matchAll(/(?:src|href)=["']([^"'#?]+)["']/g)].map(match => match[1]).filter(ref => !/^(?:\w+:|\/\/|\/|\{|mailto:)/.test(ref)));
    }
    if (/^js\/(?:book|books)/.test(file)) {
      for (const match of text.matchAll(/["'](assets\/[^"']+\.(?:png|jpg|jpeg|webp|svg))["']/g)) assert.ok(existsSync(resolve(directory, match[1])), `Missing book image ${match[1]} in ${file}`);
    }
    for (const ref of references) assert.ok(existsSync(resolve(dirname(resolve(directory, file)), ref)), `Missing dependency ${ref} in ${file}`);
  }
  const metadata = JSON.parse(readFileSync(resolve(directory, "android-build.json"), "utf8"));
  const hashed = actual.filter(file => file !== "android-build.json");
  assert.equal(metadata.fileCount, hashed.length);
  assert.equal(metadata.treeSha256, treeHash(directory, hashed));
  return { files: hashed.length, treeSha256: metadata.treeSha256 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = resolve(process.argv[2] || resolve(root, "dist/android-web"));
  console.log(JSON.stringify(verifyBundle(directory, { native: process.argv.includes("--native") }), null, 2));
}
