# Summer Quest v0.3.3 — Local/LAN Agent Server

## Added

- one-command local/LAN Summer Quest server;
- `npm run agent:serve` child-safe mode;
- `npm run agent:serve:lab` explicit AI Lab comparison mode;
- server-only `.env` loading without a new runtime dependency;
- automatic OpenAI / Anthropic / OpenRouter adapter wiring when their keys are present;
- runtime-generated `/js/config.js` pointing the existing UI to the same-origin agent endpoint;
- `/api/summer-agent/health` readiness endpoint with no secrets;
- LAN-address discovery printed at startup;
- per-client request throttling and body-size guardrails;
- static-path blocking for secrets/source/server internals;
- Windows launchers for normal and AI Lab modes;
- `test:agent-server` integration test.

## Changed

- Operations → AI Lab reads local server readiness when available;
- unavailable/disallowed model profiles are visibly disabled;
- mobile child shell now loads the shared runtime config script;
- service worker cache key bumped for the local-server integration;
- local server workflow documented in the root and agent-proxy READMEs.

## Unchanged by design

- existing child UI/navigation;
- Math and Vocabulary correctness/scoring remain deterministic;
- automatic model escalation remains disabled;
- child-safe routing remains server-authoritative;
- activities continue to work with local fallbacks when no AI provider is available.

## Validation

- `test:agent-server` passes;
- `test:agent-routing` passes;
- `test:learning` passes;
- `test:language` passes;
- `test:ai-eval` passes;
- `test:mobile` passes;
- `typecheck:agent` passes;
- Brain host: 19/19;
- Registry: 10/10;
- Core: 75/75;
- broad `scripts/check.mjs`: unchanged at 132 pre-existing findings compared with v0.3.2.
