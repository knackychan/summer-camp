# Summer Quest agent proxy

The child application never holds provider API keys. A protected server endpoint owns provider credentials and calls `AgentProxyService`.

## v0.2.7 routing policy

Routing is **manual only**. The server chooses a default profile and allow-list. Client profile requests are ignored unless `allowClientProfileOverride` is explicitly enabled.

Recommended initial production profile:

- `openai-luna-cheap` — GPT-6 Luna, low reasoning.

Available comparison adapters/profiles are included for Anthropic and OpenRouter, but no automatic escalation is implemented yet.

Environment/deployment code should inject provider keys into the matching adapter. Never serialize keys to the PWA or Android WebView.

Example deployment wiring:

```ts
const service = new AgentProxyService({
  adapters: [new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! })],
  defaultProfileId: "openai-luna-cheap",
  allowedProfileIds: ["openai-luna-cheap"],
});
```

Later we can allow a parent/developer setting to change the server policy after we have representative quality/cost evals.

## v0.2.8 learning tasks

The same protected endpoint now supports task-specific structured responses. `lesson_hint` uses a restricted hint schema instead of the general Summer companion schema. Provider adapters receive the task-specific prompt/schema, while `AgentProxyService` remains the authoritative validator and attaches normalized usage metadata only after validation.

Math correctness, scoring and difficulty progression stay local to the Learning Runtime. If the remote hint call fails, the child activity must continue with its deterministic local fallback.


## AI Lab comparison mode (v0.3.0)

The Operations → AI Lab screen can request explicit profile IDs for controlled evaluation. The server remains authoritative. To perform a real multi-model comparison, the deployment must construct `AgentProxyService` with `allowClientProfileOverride: true` and explicitly list every comparison profile in `allowedProfileIds`. Keep this disabled in ordinary child-facing production deployments.

The AI Lab verifies the `usage.profileId` returned by the server. If the server substitutes the default profile, the UI flags the mismatch rather than presenting it as a valid comparison.

## v0.3.3 local/LAN runner

The repository now includes a real Node LAN host for the prototype. It serves the existing Summer Quest UI and the protected agent endpoint from the same origin, so tablets never receive provider credentials.

1. Copy `server/agent-proxy/.env.example` to `server/agent-proxy/.env`.
2. Add at least one provider key.
3. Run:

```sh
npm run agent:serve
```

The server binds to port `9000` by default and prints both the local URL and detected LAN URLs. `GET /js/config.js` is generated at runtime with `/api/summer-agent` as the endpoint; provider keys are never serialized into it.

For explicit model comparison in Operations → AI Lab, use:

```sh
npm run agent:serve:lab
```

AI Lab mode intentionally enables client profile overrides for the model profiles belonging to providers that have keys configured on the server. It is a developer/prototype mode and should not be exposed directly to the public Internet.

Useful endpoints:

- `/` — existing Summer Quest UI;
- `/admin.html#ai` — AI Lab;
- `/api/summer-agent` — protected POST endpoint;
- `/api/summer-agent/health` — non-secret provider/profile readiness information.

The local server also adds a per-client request limit and blocks static access to server/source/secret paths such as `server/`, `.env`, `packages/`, `scripts/` and `node_modules/`.

## v0.3.6 learning telemetry collector

The local/LAN server also exposes `/api/learning-telemetry`. Child browsers write a bounded local telemetry buffer first and mirror compact, normalized events to the family PC on a best-effort basis. The collector accepts only the v1 learning event schema, drops unknown fields, and stores its bounded JSON window under `server/agent-proxy/data/` (git-ignored and blocked from static serving).

Endpoints:

- `GET /api/learning-telemetry` — read the current family-PC event window;
- `POST /api/learning-telemetry` — append one normalized event;
- `DELETE /api/learning-telemetry` — clear telemetry only.

Runtime config injects `SUMMER_LEARNING_TELEMETRY_ENDPOINT=/api/learning-telemetry` automatically when this server is used. The collector never receives provider credentials or unrestricted child chat/history.

## v0.3.7 tutor policy evidence

Operations → Reports evaluates the collected event stream descriptively by learner, domain, skill and deterministic intervention. The report shows observed support/retry recovery and later independent success with explicit sample-size labels. It does not feed evidence back into grading, progression, intervention selection or LLM routing.
