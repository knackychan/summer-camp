import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/agent-proxy");
if (!existsSync(resolve(dist, "packages/agent/src/routing/ModelCatalog.js"))) {
  const command = process.execPath;
  const built = spawnSync(command, [resolve(root, "scripts/build-mobile.mjs"), "--agent"], { cwd: root, stdio: "inherit" });
  assert.equal(built.status, 0, "agent proxy TypeScript build succeeds before routing tests");
}

const { MODEL_PROFILES, DEFAULT_MODEL_PROFILE_ID, getModelProfile } = await import(pathToFileURL(resolve(dist, "packages/agent/src/routing/ModelCatalog.js")));
const { ManualModelRouter } = await import(pathToFileURL(resolve(dist, "packages/agent/src/routing/ManualModelRouter.js")));
const { AgentProxyService } = await import(pathToFileURL(resolve(dist, "server/agent-proxy/src/AgentProxyService.js")));
const { OpenAIProvider } = await import(pathToFileURL(resolve(dist, "server/agent-proxy/src/providers/OpenAIProvider.js")));
const { AnthropicProvider } = await import(pathToFileURL(resolve(dist, "server/agent-proxy/src/providers/AnthropicProvider.js")));
const { OpenRouterProvider } = await import(pathToFileURL(resolve(dist, "server/agent-proxy/src/providers/OpenRouterProvider.js")));
const { createAgentProxyFetchHandler } = await import(pathToFileURL(resolve(dist, "server/agent-proxy/src/createFetchHandler.js")));

assert.equal(DEFAULT_MODEL_PROFILE_ID, "openai-luna-cheap");
assert.equal(getModelProfile("openai-luna-cheap")?.model, "gpt-6-luna");
assert.equal(MODEL_PROFILES.some((profile) => profile.provider === "anthropic"), true);
assert.equal(MODEL_PROFILES.some((profile) => profile.provider === "openrouter"), true);

const router = new ManualModelRouter();
assert.equal(router.resolve("child_phrase", { mode: "manual", profileId: "openai-luna-cheap" }).profile.model, "gpt-6-luna");
assert.throws(() => router.resolve("child_phrase", { mode: "manual", profileId: "openrouter-free-dev" }), /development-only/);
assert.equal(router.resolve("child_phrase", { mode: "manual", profileId: "openrouter-free-dev", allowDevelopmentProfiles: true }).profile.provider, "openrouter");

let selectedProfile = null;
const fakeOpenAI = {
  provider: "openai",
  async call(request, profile) {
    selectedProfile = profile.id;
    if (request.task === "lesson_hint") {
      return { response: { kind: "lesson_hint", message: "Count on from eight.", messageZh: "從八開始往前數。", strategy: "count_forward", emotion: "encouraging" }, inputTokens: 90, outputTokens: 18 };
    }
    if (request.task === "lesson_explanation") {
      return { response: { kind: "lesson_explanation", message: "Addition moves forward on the number line.", messageZh: "加法會在數線上往前走。", strategy: "number_line", emotion: "encouraging" }, inputTokens: 80, outputTokens: 16 };
    }
    return { response: { kind: "companion", speech: "Ready!", speechZh: "準備好了！" }, inputTokens: 100, outputTokens: 20 };
  },
};
const service = new AgentProxyService({
  adapters: [fakeOpenAI],
  defaultProfileId: "openai-luna-cheap",
  allowedProfileIds: ["openai-luna-cheap"],
  allowClientProfileOverride: true,
});
const response = await service.handle({
  version: 1,
  stage: "companion",
  context: { ageBand: "7-9" },
  routing: { mode: "manual", profileId: "openai-sol-standard" },
});
assert.equal(selectedProfile, "openai-luna-cheap", "unallowed expensive client profile is ignored");
assert.equal(response.usage.profileId, "openai-luna-cheap");
assert.equal(response.usage.estimatedCostUsd, 0.00002);

const lessonResponse = await service.handle({
  version: 1,
  stage: "learning:math_hint",
  task: "lesson_hint",
  context: { ageBand: "7-9", question: { operation: "addition", left: 8, right: 7, correctAnswer: 15 }, childAnswer: 14 },
});
assert.equal(lessonResponse.kind, "lesson_hint");
assert.equal(lessonResponse.strategy, "count_forward");
assert.equal(lessonResponse.usage.profileId, "openai-luna-cheap");

const explanationResponse = await service.handle({
  version: 1,
  stage: "learning:math_explanation",
  task: "lesson_explanation",
  context: { ageBand: "7-9", domain:"math", preferredStrategies:["number_line"], example: { operation:"addition", left:8, right:5, correctAnswer:13 } },
});
assert.equal(explanationResponse.kind, "lesson_explanation");
assert.equal(explanationResponse.strategy, "number_line");
assert.equal(explanationResponse.usage.profileId, "openai-luna-cheap");

const handler = createAgentProxyFetchHandler(service);
const httpResponse = await handler(new Request("https://summer.test/api/summer-agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: 1, stage: "companion", context: {} }) }));
assert.equal(httpResponse.status, 200);
assert.equal(httpResponse.headers.get("cache-control"), "no-store");
assert.equal((await httpResponse.json()).usage.profileId, "openai-luna-cheap");

let openAIBody;
const openai = new OpenAIProvider({
  apiKey: "test",
  fetch: async (_url, init) => {
    openAIBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      output_text: JSON.stringify({ kind: "status", speech: "Hi", speechZh: "你好" }),
      usage: { input_tokens: 12, output_tokens: 4 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  },
});
await openai.call({ version: 1, stage: "companion", context: {} }, getModelProfile("openai-luna-cheap"));
assert.equal(openAIBody.model, "gpt-6-luna");
assert.equal(openAIBody.reasoning.effort, "low");
assert.equal(openAIBody.text.format.type, "json_schema");

await openai.call({ version: 1, stage: "learning:math_hint", task: "lesson_hint", context: {} }, getModelProfile("openai-luna-cheap"));
assert.equal(openAIBody.text.format.name, "lesson_hint_response");
assert.equal(openAIBody.text.format.schema.properties.kind.const, "lesson_hint");
assert.match(openAIBody.instructions, /controlled hint generator/i);

await openai.call({ version: 1, stage: "learning:math_explanation", task: "lesson_explanation", context: {} }, getModelProfile("openai-luna-cheap"));
assert.equal(openAIBody.text.format.name, "lesson_explanation_response");
assert.equal(openAIBody.text.format.schema.properties.kind.const, "lesson_explanation");
assert.match(openAIBody.instructions, /controlled concept explainer/i);

let anthropicBody;
const anthropic = new AnthropicProvider({
  apiKey: "test",
  fetch: async (_url, init) => {
    anthropicBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ kind: "status", speech: "Hi", speechZh: "你好" }) }], usage: { input_tokens: 9, output_tokens: 3 } }), { status: 200, headers: { "content-type": "application/json" } });
  },
});
await anthropic.call({ version: 1, stage: "companion", context: {} }, getModelProfile("anthropic-sonnet-standard"));
assert.equal(anthropicBody.model, "claude-sonnet-5");
assert.equal(anthropicBody.output_config.effort, "medium");

let openRouterBody;
const openrouter = new OpenRouterProvider({
  apiKey: "test",
  fetch: async (_url, init) => {
    openRouterBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ kind: "status", speech: "Hi", speechZh: "你好" }) } }], usage: { prompt_tokens: 11, completion_tokens: 5 } }), { status: 200, headers: { "content-type": "application/json" } });
  },
});
await openrouter.call({ version: 1, stage: "companion", context: {} }, getModelProfile("openrouter-free-dev"));
assert.equal(openRouterBody.model, "openrouter/free");
assert.equal(openRouterBody.reasoning.effort, "low");

console.log("agent routing tests: ok");
