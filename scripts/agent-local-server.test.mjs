import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mod = await import(new URL("../server/agent-proxy/local-server.mjs", import.meta.url));

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
for (const key of ["OPENAI_API_KEY","ANTHROPIC_API_KEY","OPENROUTER_API_KEY","SUMMER_AGENT_ALLOWED_PROFILES","SUMMER_AGENT_PROFILE","SUMMER_AGENT_LAB_MODE","SUMMER_HOST","SUMMER_PORT"]) delete process.env[key];
try {
  const local = await mod.startLocalServer({ host: "127.0.0.1", port: 0, labMode: true, envPath: "__missing-test-env__" });
  try {
    assert.equal(local.labMode, true);
    const base = `http://127.0.0.1:${local.port}`;
    const healthRes = await fetch(base + "/api/summer-agent/health");
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.ok, true);
    assert.equal(health.mode, "ai_lab");
    assert.deepEqual(health.providers, { openai:false, anthropic:false, openrouter:false });

    const configRes = await fetch(base + "/js/config.js");
    assert.equal(configRes.status, 200);
    const configJs = await configRes.text();
    assert.match(configJs, /SUMMER_AGENT_ENDPOINT/);
    assert.match(configJs, /SUMMER_LEARNING_TELEMETRY_ENDPOINT/);
    assert.match(configJs, /SUMMER_TUTOR_EXPERIMENTS/);
    assert.doesNotMatch(configJs, /OPENAI_API_KEY/);

    const indexRes = await fetch(base + "/index.html");
    assert.equal(indexRes.status, 200);
    assert.match(await indexRes.text(), /Summer Quest/i);

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
  for (const key of Object.keys(process.env)) if (!(key in prior)) delete process.env[key];
  Object.assign(process.env, prior);
}

console.log("agent local server tests: ok");
