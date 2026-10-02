# Summer Quest — 2026-09-23 v0.2.2

## Agent orchestration

- Added semantic `SQEventBus` for quest/assistant lifecycle events.
- Added deterministic `SQAgentOrchestrator` for attention state and reminder intents.
- Added concurrent reminder idempotency guard after targeted tests exposed a duplicate-scheduling race.
- Quest start, pause, completion, verification and activity-help flows now emit semantic events.

## Session memory / interaction

- Added small session-scoped `SQAgentMemory`.
- Energy + intent choices survive navigation in the current session.
- Reset questions clears the assistant session memory.
- Activity help count is tracked without storing a chat transcript.

## Protected remote provider

- Added `SQAgentProvider` with optional `SUMMER_AGENT_ENDPOINT`.
- No OpenAI/model secret is stored in the client.
- Remote request uses only `SQAgentContext` minimal structured state.
- Remote output is allow-listed / validated before display.
- Remote speech/choice text is HTML-escaped at dynamic UI insertion points as a second display-layer defense.
- Invalid IDs, actions and question choices are discarded or rejected.
- Remote timeout/error automatically falls back to the deterministic local provider.

## Privacy-shaped context

- Remote context uses child age bands rather than exact age.
- Child display name is excluded.
- Recent context includes semantic event types only, not free-form message bodies.
- Available quest context remains pre-filtered by the deterministic Quest Engine.

## Activity integration

- Added first real adapter: `SQBrainActivityAdapter`.
- Brain Gym exposes semantic phase/index/total/skill/objective context without DOM scraping.
- Persistent Summer help can use the adapter offline or pass its semantic context to the optional remote provider.

## Android readiness

- Future routine notifications are requested through `SQPlatform.scheduleNotification`.
- Browser remains a no-op fallback; native Android/Capacitor owns actual background scheduling later.
- Stable per-kid/day/quest reminder IDs are used.
- Native reminder title/body payloads are bilingual (English + Traditional Chinese).

## Validation

- `node scripts/agent-orchestration.test.mjs` passes.
- `node scripts/quest-agent.test.mjs` passes.
- All new/modified JS parses.
- `node scripts/check.mjs` reports the exact same 132 known failures as v0.2.1 / supplied handover baseline; no new full-gate failures were introduced.
