# Summer Quest — 2026-09-23 v0.2.0

## Quest-first child experience

- Guided Summer question flow with energy + intent choices.
- Direct mode can skip questions.
- Time/rule-aware quest recommendations.
- Daily-essential visibility and later-today preview.
- Configurable plant care, chores, hygiene, learning, movement and game activities.
- Quest Coins shown alongside lifetime stars.

## Reward shop

- Parent-configurable reward catalog.
- Child reward requests use the existing Ask transport.
- Parent approve/decline controls in the operational queue.
- Spending is separate from permanent stars.
- Approval is idempotent by request ID.

## Parent Quest Studio

- New Quests route in admin.
- Task/routine rule editor.
- Reward editor and wallet summary.
- Summer assistant settings.
- Shared `family_settings` configuration; no DB migration required.

## Architecture

- Shared quest/reward config parser.
- Deterministic Quest Engine remains authoritative.
- Agent stays behind a structured provider boundary.
- MCP-like tool registry remains state-limited.
- Android-ready platform adapter seam.
- Service-worker cache bumped and new assets included.

## Deferred

- Synced cross-device quest-completion history.
- Parent-verification mode for selected chores.
- Server-side OpenAI provider/proxy.
- Deep activity adapters for omitted game implementations.
- Native Android background notification implementation.
