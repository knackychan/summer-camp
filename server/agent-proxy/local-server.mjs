import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { AgentProxyService } from "../../dist/agent-proxy/server/agent-proxy/src/AgentProxyService.js";
import { createAgentProxyFetchHandler } from "../../dist/agent-proxy/server/agent-proxy/src/createFetchHandler.js";
import { OpenAIProvider } from "../../dist/agent-proxy/server/agent-proxy/src/providers/OpenAIProvider.js";
import { AnthropicProvider } from "../../dist/agent-proxy/server/agent-proxy/src/providers/AnthropicProvider.js";
import { OpenRouterProvider } from "../../dist/agent-proxy/server/agent-proxy/src/providers/OpenRouterProvider.js";
import { DEFAULT_MODEL_PROFILE_ID, MODEL_PROFILES, getModelProfile } from "../../dist/agent-proxy/packages/agent/src/routing/ModelCatalog.js";
import { LearningTelemetryFileStore } from "./learning-telemetry-store.mjs";

const HERE = resolve(fileURLToPath(new URL(".", import.meta.url)));
const PROJECT_ROOT = resolve(HERE, "../..");
const DEFAULT_PORT = 9000;
const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_BODY_LIMIT = 64_000;
const DEFAULT_TELEMETRY_BODY_LIMIT = 16_000;

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".mp3", "audio/mpeg"],
  [".wav", "audio/wav"],
  [".ogg", "audio/ogg"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
]);

const BLOCKED_TOP_LEVEL = new Set([
  ".git",
  ".github",
  "node_modules",
  "server",
  "scripts",
  "packages",
  "supabase",
  "docs",
]);

export function parseEnvText(text) {
  const out = {};
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

export function loadLocalEnv({ envPath } = {}) {
  const candidates = envPath
    ? [resolve(PROJECT_ROOT, envPath)]
    : [resolve(PROJECT_ROOT, "server/agent-proxy/.env"), resolve(PROJECT_ROOT, ".env")];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) return { env: { ...process.env }, source: null };
  const parsed = parseEnvText(readFileSync(file, "utf8"));
  return { env: { ...parsed, ...process.env }, source: file };
}

function bool(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

function int(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function splitCsv(value) {
  return String(value || "").split(",").map((part) => part.trim()).filter(Boolean);
}

export function createRuntimeConfig(env, options = {}) {
  const defaultProfileId = options.defaultProfileId || env.SUMMER_AGENT_PROFILE || DEFAULT_MODEL_PROFILE_ID;
  return {
    SUPABASE_URL: env.SQ_SUPABASE_URL || env.SUPABASE_URL || "",
    SUPABASE_ANON_KEY: env.SQ_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "",
    FAMILY_TZ: env.FAMILY_TZ || "Asia/Taipei",
    NTFY_TOPIC: env.SQ_NTFY_TOPIC || env.NTFY_TOPIC || "",
    SUMMER_AGENT_ENDPOINT: "/api/summer-agent",
    SUMMER_AGENT_HEALTH_ENDPOINT: "/api/summer-agent/health",
    SUMMER_LEARNING_TELEMETRY_ENDPOINT: "/api/learning-telemetry",
    SUMMER_TUTOR_EXPERIMENTS: splitCsv(env.SUMMER_TUTOR_EXPERIMENTS).slice(0, 10),
    SUMMER_AGENT_PROFILE: defaultProfileId,
    SUMMER_AGENT_TIMEOUT_MS: int(env.SUMMER_AGENT_TIMEOUT_MS, 10_000, 1_500, 30_000),
    SUMMER_AGENT_SERVER_MODE: options.labMode ? "ai_lab" : "child_safe",
  };
}

export function publicPathForUrl(urlPath, root = PROJECT_ROOT) {
  const decoded = decodeURIComponent(String(urlPath || "/").split("?")[0]);
  let rel = decoded.replace(/^\/+/, "");
  if (!rel) rel = "index.html";
  if (rel.endsWith("/")) rel += "index.html";
  const segments = rel.split(/[\\/]+/).filter(Boolean);
  if (!segments.length || segments.some((part) => part === ".." || part.startsWith("."))) return null;
  if (BLOCKED_TOP_LEVEL.has(segments[0])) return null;
  if (segments[0] === "js" && segments[1] === "config.js") return null;
  const candidate = resolve(root, normalize(rel));
  const rootPrefix = root.endsWith(sep) ? root : root + sep;
  if (candidate !== root && !candidate.startsWith(rootPrefix)) return null;
  return candidate;
}

function configuredAdapters(env) {
  const adapters = [];
  if (String(env.OPENAI_API_KEY || "").trim()) adapters.push(new OpenAIProvider({ apiKey: String(env.OPENAI_API_KEY).trim() }));
  if (String(env.ANTHROPIC_API_KEY || "").trim()) adapters.push(new AnthropicProvider({ apiKey: String(env.ANTHROPIC_API_KEY).trim() }));
  if (String(env.OPENROUTER_API_KEY || "").trim()) adapters.push(new OpenRouterProvider({ apiKey: String(env.OPENROUTER_API_KEY).trim() }));
  return adapters;
}

function configuredProviderIds(env) {
  return {
    openai: Boolean(String(env.OPENAI_API_KEY || "").trim()),
    anthropic: Boolean(String(env.ANTHROPIC_API_KEY || "").trim()),
    openrouter: Boolean(String(env.OPENROUTER_API_KEY || "").trim()),
  };
}

function allowedProfiles(env, labMode, defaultProfileId) {
  const explicit = splitCsv(env.SUMMER_AGENT_ALLOWED_PROFILES);
  if (explicit.length) return [...new Set(explicit)];
  if (!labMode) return [defaultProfileId];
  const configured = configuredProviderIds(env);
  return MODEL_PROFILES.filter((profile) => configured[profile.provider]).map((profile) => profile.id);
}

function sendJson(res, status, value, headers = {}) {
  const body = Buffer.from(JSON.stringify(value, null, 2));
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": body.length,
    "cache-control": "no-store",
    ...headers,
  });
  res.end(body);
}

function sendText(res, status, text, contentType = "text/plain; charset=utf-8", headers = {}) {
  const body = Buffer.from(String(text));
  res.writeHead(status, {
    "content-type": contentType,
    "content-length": body.length,
    ...headers,
  });
  res.end(body);
}

function runtimeConfigJs(config) {
  const safe = JSON.stringify(config).replace(/</g, "\\u003c");
  return `window.SQ_CONFIG = Object.assign({}, window.SQ_CONFIG || {}, ${safe});\n`;
}

async function readBody(req, maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw Object.assign(new Error("payload_too_large"), { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function clientAddress(req) {
  const raw = req.socket.remoteAddress || "unknown";
  return raw.startsWith("::ffff:") ? raw.slice(7) : raw;
}

function createRateLimiter(limitPerMinute) {
  const buckets = new Map();
  return function allow(key) {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.startedAt >= 60_000) {
      buckets.set(key, { startedAt: now, count: 1 });
      return true;
    }
    bucket.count += 1;
    if (buckets.size > 500) {
      for (const [k, value] of buckets) if (now - value.startedAt > 120_000) buckets.delete(k);
    }
    return bucket.count <= limitPerMinute;
  };
}

function lanAddresses(port) {
  const out = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const item of entries || []) {
      if (item.family !== "IPv4" || item.internal) continue;
      out.push(`http://${item.address}:${port}/`);
    }
  }
  return [...new Set(out)];
}

function profileSummary(ids) {
  return ids.map((id) => {
    const profile = getModelProfile(id);
    return profile ? { id: profile.id, provider: profile.provider, model: profile.model, label: profile.label, productionAllowed: profile.productionAllowed } : { id, provider: "unknown", model: "unknown", label: id, productionAllowed: false };
  });
}

function parseArgs(argv) {
  const args = { labMode: false, host: null, port: null, envPath: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--lab") args.labMode = true;
    else if (arg === "--host") args.host = argv[++i] || null;
    else if (arg === "--port") args.port = Number(argv[++i]);
    else if (arg === "--env") args.envPath = argv[++i] || null;
  }
  return args;
}

export async function startLocalServer(options = {}) {
  const loaded = loadLocalEnv({ envPath: options.envPath });
  const env = loaded.env;
  const labMode = options.labMode === true || bool(env.SUMMER_AGENT_LAB_MODE, false);
  const host = options.host || env.SUMMER_HOST || DEFAULT_HOST;
  const requestedPort = Number.isFinite(options.port) ? Number(options.port) : int(env.SUMMER_PORT, DEFAULT_PORT, 0, 65_535);
  const defaultProfileId = env.SUMMER_AGENT_PROFILE || DEFAULT_MODEL_PROFILE_ID;
  const allowedProfileIds = allowedProfiles(env, labMode, defaultProfileId);
  const providers = configuredProviderIds(env);
  const adapters = configuredAdapters(env);
  const allowClientProfileOverride = labMode || bool(env.SUMMER_AGENT_ALLOW_PROFILE_OVERRIDE, false);
  const allowDevelopmentProfiles = labMode || bool(env.SUMMER_AGENT_ALLOW_DEV_PROFILES, false);
  const bodyLimit = int(env.SUMMER_AGENT_MAX_BODY_BYTES, DEFAULT_BODY_LIMIT, 4_096, 256_000);
  const rateLimit = int(env.SUMMER_AGENT_RATE_LIMIT_PER_MINUTE, labMode ? 180 : 60, 5, 2_000);
  const telemetryBodyLimit = int(env.SUMMER_LEARNING_TELEMETRY_MAX_BODY_BYTES, DEFAULT_TELEMETRY_BODY_LIMIT, 2_048, 64_000);
  const telemetryRateLimit = int(env.SUMMER_LEARNING_TELEMETRY_RATE_LIMIT_PER_MINUTE, 300, 10, 5_000);
  const telemetryLimit = int(env.SUMMER_LEARNING_TELEMETRY_LIMIT, 5_000, 100, 50_000);
  const runtimeConfig = createRuntimeConfig(env, { defaultProfileId, labMode });
  const service = new AgentProxyService({
    adapters,
    defaultProfileId,
    allowedProfileIds,
    allowClientProfileOverride,
    allowDevelopmentProfiles,
  });
  const fetchHandler = createAgentProxyFetchHandler(service, { maxBodyBytes: bodyLimit });
  const rateAllow = createRateLimiter(rateLimit);
  const telemetryRateAllow = createRateLimiter(telemetryRateLimit);
  const telemetryStore = new LearningTelemetryFileStore({
    path: resolve(PROJECT_ROOT, "server/agent-proxy/data/learning-telemetry.json"),
    limit: telemetryLimit,
  });

  const server = createServer(async (req, res) => {
    try {
      const hostHeader = req.headers.host || `localhost:${requestedPort || DEFAULT_PORT}`;
      const url = new URL(req.url || "/", `http://${hostHeader}`);

      if (url.pathname === "/api/summer-agent/health") {
        if (req.method !== "GET") return sendJson(res, 405, { error: "method_not_allowed" }, { allow: "GET" });
        return sendJson(res, 200, {
          ok: true,
          service: "summer-quest-agent",
          version: "0.3.8",
          mode: labMode ? "ai_lab" : "child_safe",
          providers,
          defaultProfileId,
          allowClientProfileOverride,
          allowDevelopmentProfiles,
          allowedProfiles: profileSummary(allowedProfileIds),
          rateLimitPerMinute: rateLimit,
        });
      }

      if (url.pathname === "/api/learning-telemetry") {
        if (!telemetryRateAllow(clientAddress(req))) return sendJson(res, 429, { error: "rate_limited", message: "Too many learning telemetry requests. Try again shortly." });
        if (req.method === "GET") {
          const events = telemetryStore.list();
          return sendJson(res, 200, { version: 1, count: events.length, limit: telemetryLimit, events });
        }
        if (req.method === "DELETE") {
          telemetryStore.clear();
          return sendJson(res, 200, { ok: true, version: 1, count: 0 });
        }
        if (req.method === "POST") {
          const body = await readBody(req, telemetryBodyLimit);
          let parsed;
          try { parsed = JSON.parse(body.toString("utf8")); } catch { return sendJson(res, 400, { error: "invalid_json" }); }
          const event = telemetryStore.append(parsed);
          if (!event) return sendJson(res, 400, { error: "invalid_learning_telemetry_event" });
          return sendJson(res, 202, { ok: true, version: 1, id: event.id });
        }
        return sendJson(res, 405, { error: "method_not_allowed" }, { allow: "GET, POST, DELETE" });
      }

      if (url.pathname === "/api/summer-agent") {
        if (!rateAllow(clientAddress(req))) return sendJson(res, 429, { error: "rate_limited", message: "Too many Summer agent requests. Try again shortly." });
        const body = req.method === "POST" ? await readBody(req, bodyLimit) : undefined;
        const webRequest = new Request(url, {
          method: req.method,
          headers: req.headers,
          ...(body ? { body } : {}),
        });
        const webResponse = await fetchHandler(webRequest);
        const responseBody = Buffer.from(await webResponse.arrayBuffer());
        const headers = {};
        webResponse.headers.forEach((value, key) => { headers[key] = value; });
        res.writeHead(webResponse.status, headers);
        res.end(responseBody);
        return;
      }

      if (url.pathname === "/js/config.js") {
        if (req.method !== "GET" && req.method !== "HEAD") return sendText(res, 405, "Method not allowed", "text/plain; charset=utf-8", { allow: "GET, HEAD" });
        const js = runtimeConfigJs(runtimeConfig);
        if (req.method === "HEAD") return sendText(res, 200, "", "text/javascript; charset=utf-8", { "cache-control": "no-store" });
        return sendText(res, 200, js, "text/javascript; charset=utf-8", { "cache-control": "no-store" });
      }

      if (req.method !== "GET" && req.method !== "HEAD") return sendText(res, 405, "Method not allowed", "text/plain; charset=utf-8", { allow: "GET, HEAD" });
      let filePath = publicPathForUrl(url.pathname);
      if (!filePath) return sendText(res, 404, "Not found");
      if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = join(filePath, "index.html");
      if (!existsSync(filePath) || !statSync(filePath).isFile()) return sendText(res, 404, "Not found");
      const stat = statSync(filePath);
      const type = MIME.get(extname(filePath).toLowerCase()) || "application/octet-stream";
      res.writeHead(200, {
        "content-type": type,
        "content-length": stat.size,
        "cache-control": /(?:^|[\\/])(?:dist|assets)[\\/]/.test(filePath) ? "public, max-age=300" : "no-cache",
      });
      if (req.method === "HEAD") return res.end();
      createReadStream(filePath).pipe(res);
    } catch (error) {
      const statusCode = Number(error && error.statusCode) || 500;
      if (!res.headersSent) sendJson(res, statusCode, { error: statusCode === 413 ? "payload_too_large" : "server_error", message: statusCode === 500 ? "Local Summer Quest server error" : String(error.message || error) });
      else res.end();
    }
  });

  await new Promise((resolvePromise, reject) => {
    const onError = (error) => { server.off("listening", onListening); reject(error); };
    const onListening = () => { server.off("error", onError); resolvePromise(); };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(requestedPort, host);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : requestedPort;
  const urls = lanAddresses(port);
  return {
    server,
    host,
    port,
    labMode,
    envSource: loaded.source,
    providers,
    defaultProfileId,
    allowedProfileIds,
    allowClientProfileOverride,
    telemetryLimit,
    telemetryRateLimit,
    urls,
    kidUrls: urls.map((url) => new URL("index.html", url).toString()),
    close: () => new Promise((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise())),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const local = await startLocalServer(args);
  const providerText = Object.entries(local.providers).map(([name, ok]) => `${name}:${ok ? "ready" : "no-key"}`).join("  ");
  console.log("\nSummer Quest local server v0.3.8");
  console.log(`Mode: ${local.labMode ? "AI Lab comparison" : "child-safe"}`);
  console.log(`Provider keys: ${providerText}`);
  console.log(`Default profile: ${local.defaultProfileId}`);
  console.log(`Allowed profiles: ${local.allowedProfileIds.join(", ") || "none"}`);
  console.log(`Environment: ${local.envSource || "process environment only"}`);
  console.log("\nOpen the child tablet app on this computer:");
  console.log(`  http://127.0.0.1:${local.port}/index.html`);
  console.log("\nAdmin interface:");
  console.log(`  http://127.0.0.1:${local.port}/admin.html#ai`);
  if (local.kidUrls.length) {
    console.log("\nOpen the child app on tablets connected to the same LAN:");
    for (const url of local.kidUrls) console.log(`  ${url}`);
  }
  console.log("\nNote: browser Service Workers require a secure context. Offline restart is available on localhost and the Android wrapper; plain http:// LAN tablet URLs are online-session only.");
  console.log("\nProvider API keys remain server-side. Press Ctrl+C to stop.\n");

  const shutdown = async () => {
    process.off("SIGINT", shutdown);
    process.off("SIGTERM", shutdown);
    try { await local.close(); } finally { process.exit(0); }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedAsScript) {
  main().catch((error) => {
    console.error("Summer Quest server failed to start:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
