# Summer Quest v0.2.7 — Multi-Provider LLM Routing Foundation

## Added

- provider-neutral `packages/agent` contracts;
- manual model profile catalog;
- OpenAI, Anthropic and OpenRouter server-side adapters;
- protected `AgentProxyService` with server-side profile allow-list;
- Web `Request`/`Response` handler for framework-neutral deployment;
- normalized usage and estimated-cost telemetry;
- task classes and future reasoning hints without automatic escalation;
- `tsconfig.agent-proxy.json` plus focused routing tests;
- documented server-only key handling and `.env.example`.

## Initial routing policy

- default production profile: `openai-luna-cheap`;
- low reasoning;
- all automatic escalation disabled;
- higher-power profiles registered but manual/allow-listed only;
- OpenRouter free route marked development-only.

## Client changes

- the existing protected Summer endpoint request can include a manual profile hint;
- server policy remains authoritative;
- normalized provider/model/cost telemetry can be returned without exposing secrets.

## Validation

- `npm run typecheck:agent` passes;
- `npm run test:agent-routing` passes;
- `npm run typecheck:mobile` passes;
- existing Quest/Orchestration/Summer tests pass;
- full handover gate remains at the same 98 known baseline failures.
