import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from "node:fs";
import { get } from "node:http";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, constants as zlibConstants } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mod = await import(new URL("../server/agent-proxy/local-server.mjs", import.meta.url));

function compressedResponse(url) {
  return new Promise((resolvePromise, reject) => {
    get(url, { headers: { "accept-encoding": "gzip" } }, response => {
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("error", reject);
      response.on("end", () => resolvePromise({ headers: response.headers, chunks, body: Buffer.concat(chunks) }));
    }).on("error", reject);
  });
}

const parsed = mod.parseEnvText('OPENAI_API_KEY="abc"\nSUMMER_PORT=9011\n# comment\nFAMILY_TZ=Asia/Taipei\n');
assert.equal(parsed.OPENAI_API_KEY, "abc");
assert.equal(parsed.SUMMER_PORT, "9011");
assert.equal(parsed.FAMILY_TZ, "Asia/Taipei");

const config = mod.createRuntimeConfig({ FAMILY_TZ: "Asia/Taipei", SUMMER_AGENT_TIMEOUT_MS: "8750", SUMMER_TUTOR_EXPERIMENTS: "math-near-miss-support-v1" }, { defaultProfileId: "openai-luna-cheap", labMode: true });
assert.equal(config.SUMMER_AGENT_ENDPOINT, "/api/summer-agent");
assert.equal(config.SUMMER_AGENT_HEALTH_ENDPOINT, "/api/summer-agent/health");
assert.equal(config.SUMMER_LEARNING_TELEMETRY_ENDPOINT, "/api/learning-telemetry");
assert.deepEqual(config.SUMMER_TUTOR_EXPERIMENTS, ["math-near-miss-support-v1"]);
assert.equal(config.SUMMER_AGENT_SERVER_MODE, "ai_lab");
assert.equal(config.SUMMER_AGENT_TIMEOUT_MS, 8750);

assert.equal(mod.publicPathForUrl("/index.html", root), resolve(root, "index.html"));
assert.equal(mod.publicPathForUrl("/apps/kid/", root), resolve(root, "apps/kid/index.html"));
assert.equal(mod.publicPathForUrl("/../server/agent-proxy/.env", root), null);
assert.equal(mod.publicPathForUrl("/server/agent-proxy/.env", root), null);
assert.equal(mod.publicPathForUrl("/.env", root), null);

const prior = { ...process.env };
const testDir = mkdtempSync(join(tmpdir(), "summer-quest-server-"));
const telemetryPath = join(testDir, "telemetry.json");
for (const key of ["OPENAI_API_KEY","ANTHROPIC_API_KEY","OPENROUTER_API_KEY","SUMMER_AGENT_ALLOWED_PROFILES","SUMMER_AGENT_PROFILE","SUMMER_AGENT_LAB_MODE","SUMMER_HOST","SUMMER_PORT"]) delete process.env[key];
try {
  const local = await mod.startLocalServer({ host: "127.0.0.1", port: 0, labMode: true, envPath: "__missing-test-env__", telemetryPath });
  try {
    assert.equal(local.labMode, true);
    const base = `http://127.0.0.1:${local.port}`;
    const healthRes = await fetch(base + "/api/summer-agent/health");
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.headers.get("cache-control"), "no-store");
    const health = await healthRes.json();
    assert.equal(health.ok, true);
    assert.equal(health.mode, "ai_lab");
    assert.deepEqual(health.providers, { openai:false, anthropic:false, openrouter:false });

    const configRes = await fetch(base + "/js/config.js");
    assert.equal(configRes.status, 200);
    assert.equal(configRes.headers.get("cache-control"), "no-store");
    const configJs = await configRes.text();
    assert.match(configJs, /SUMMER_AGENT_ENDPOINT/);
    assert.match(configJs, /SUMMER_LEARNING_TELEMETRY_ENDPOINT/);
    assert.match(configJs, /SUMMER_TUTOR_EXPERIMENTS/);
    assert.doesNotMatch(configJs, /OPENAI_API_KEY/);

    const indexRes = await fetch(base + "/index.html");
    assert.equal(indexRes.status, 200);
    assert.equal(indexRes.headers.get("content-encoding"), "gzip");
    assert.equal(indexRes.headers.get("vary"), "Accept-Encoding");
    assert.equal(indexRes.headers.get("cache-control"), "no-cache");
    assert.match(await indexRes.text(), /Summer Quest/i);

    const etag = indexRes.headers.get("etag");
    assert.ok(etag);
    const unchanged = await fetch(base + "/index.html", { headers: { "if-none-match": etag } });
    assert.equal(unchanged.status, 304, "unchanged app source requires no retransmission");
    assert.equal(await unchanged.text(), "");
    const changed = await fetch(base + "/index.html", { headers: { "if-none-match": 'W/"old-release"', "accept-encoding": "gzip;q=0, identity" } });
    assert.equal(changed.status, 200, "a changed source is returned rather than serving stale code");
    assert.equal(changed.headers.get("content-encoding"), null, "compression respects gzip;q=0");
    await changed.arrayBuffer();
    const compiled = await fetch(base + "/dist/mobile/packages/core/src/localization.js", { method: "HEAD" });
    assert.equal(compiled.headers.get("cache-control"), "no-cache", "compiled app code revalidates immediately after a build");
    const picture = await fetch(base + "/assets/solar/earth.jpg", { method: "HEAD" });
    assert.equal(picture.headers.get("content-encoding"), null, "already compressed images are streamed directly");
    const html = await compressedResponse(base + "/index.html");
    const firstHtml = gunzipSync(html.chunks[0], { finishFlush: zlibConstants.Z_SYNC_FLUSH });
    assert.ok(firstHtml.length > 0, "the first gzip chunk contains parseable HTML, not just a gzip header");
    assert.match(firstHtml.toString(), /<!doctype html>/i);
    assert.deepEqual(gunzipSync(html.body), readFileSync(resolve(root, "index.html")), "flushing early preserves the entire document");
    const source = readFileSync(resolve(root, "js/vendor/three.core.min.js"));
    const compressed = await compressedResponse(base + "/js/vendor/three.core.min.js");
    assert.equal(compressed.headers["content-encoding"], "gzip");
    assert.deepEqual(gunzipSync(compressed.body), source, "wire compression preserves exact JavaScript source");
    assert.ok(compressed.body.length < source.length / 2, "large libraries transfer at less than half their raw size");
    console.log(`Three.js transfer: ${source.length} -> ${compressed.body.length} bytes (${Math.round(100 * (1 - compressed.body.length / source.length))}% smaller)`);

    const secretRes = await fetch(base + "/server/agent-proxy/.env");
    assert.equal(secretRes.status, 404);

    const telemetryEvent = {
      version:1,id:"lt-server-test",type:"attempt",at:Date.now(),learnerId:"lili",domain:"math",skill:"arithmetic",sessionId:"session-test",questionId:"q1",
      correct:false,responseMs:650,hintsUsed:0,difficulty:2,mistake:"near_miss",extraShouldDisappear:"secret"
    };
    const telemetryPost = await fetch(base + "/api/learning-telemetry", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(telemetryEvent) });
    assert.equal(telemetryPost.status, 202);
    const telemetryGet = await fetch(base + "/api/learning-telemetry");
    assert.equal(telemetryGet.status, 200);
    const telemetryBody = await telemetryGet.json();
    assert.ok(telemetryBody.events.some((event) => event.id === "lt-server-test"));
    const stored = telemetryBody.events.find((event) => event.id === "lt-server-test");
    assert.equal(stored.extraShouldDisappear, undefined, "collector normalizes fields instead of persisting arbitrary payloads");
    const telemetryDelete = await fetch(base + "/api/learning-telemetry", { method:"DELETE" });
    assert.equal(telemetryDelete.status, 200);

    const postRes = await fetch(base + "/api/summer-agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version:1, stage:"learning:math_hint", task:"lesson_hint", context:{} }),
    });
    assert.equal(postRes.status, 502, "no provider key means remote request fails safely rather than leaking config");
  } finally {
    await local.close();
  }
} finally {
  rmSync(telemetryPath, { force: true });
  rmdirSync(testDir);
  for (const key of Object.keys(process.env)) if (!(key in prior)) delete process.env[key];
  Object.assign(process.env, prior);
}

console.log("agent local server tests: ok");
