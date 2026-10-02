# Summer Quest v0.3.6 — Unified Learning & Tutor Telemetry

## Added

- one shared Math + Language learning/tutor telemetry schema;
- bounded browser-local telemetry store (1,200 events);
- attempt, intervention, hint, adaptation and support-outcome events;
- learner/domain/skill summaries for independence, support and recovery;
- recent independence trend and top recurring observable mistake pattern;
- AI/local hint ratio, provider token usage and estimated AI cost summaries;
- best-effort `LearningTelemetryHttpClient` mirroring that never blocks gameplay;
- family-PC `/api/learning-telemetry` GET/POST/DELETE endpoints;
- server-side telemetry validation/field normalization and 5,000-event default bound;
- family-PC central telemetry source in Operations → Reports;
- automatic local-browser fallback when the LAN collector is unavailable;
- JSON export and source-aware clear behavior;
- server-only telemetry retention/rate/body-size configuration;
- telemetry integration tests and LAN collector tests.

## Math + Language integration

- Brain Gym Math records local attempts, intervention decisions, hint source/usage, adaptation and retry/scaffold outcomes;
- Word Wizard Study records the same event families through the shared schema;
- both domains report through the existing `SQLearningRuntime` without provider-specific game code.

## Privacy / safety

- raw typed child answer text is not part of the telemetry schema;
- the LAN server discards unknown event fields instead of persisting arbitrary client payloads;
- provider credentials remain server-side;
- telemetry storage lives in a statically blocked, git-ignored server data directory;
- telemetry failures cannot block learning/gameplay;
- observable mistake-pattern labels are not treated as diagnoses.

## Reports behavior

- when running on the local Summer Quest host, Reports prefers centralized family-LAN telemetry from all participating devices;
- if the collector is unavailable, Reports uses only the current browser’s local event buffer and labels that fallback clearly;
- no new child UI or global navigation was introduced.

## Unchanged

- existing Summer Quest UI shell;
- deterministic grading and mastery;
- deterministic Math/Language tutor intervention selection;
- five-attempt learning-level adaptation policy;
- manual-first LLM profile routing;
- no automatic model escalation;
- AI Lab model evaluation workflow.

## Validation

- telemetry tests pass;
- adaptive tutor tests pass, including Brain 21/21;
- mobile typecheck passes;
- agent routing and local/LAN server tests pass;
- AI evaluation and Language tests pass;
- Registry remains 10/10;
- Core remains 75/75;
- broad project checker remains at the inherited 132 findings (zero new findings).
