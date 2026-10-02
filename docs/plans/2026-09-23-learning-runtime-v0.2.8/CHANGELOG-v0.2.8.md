# Summer Quest v0.2.8 — Learning Runtime + AI Math Hint

## Added

- learner profile normalization/storage;
- persistent learning-session state;
- deterministic five-attempt difficulty adaptation;
- local Math question generator;
- local Math hint fallback;
- age/reading-level-aware Math hint presentation plan;
- privacy-shaped `lesson_hint` request builder;
- `MathHintService` with remote-first/local-fallback behavior;
- protected `AgentHttpClient` for typed task requests;
- task-specific `lesson_hint` response schema/validation;
- task-specific provider prompt/schema selection for OpenAI, Anthropic and OpenRouter;
- `test:learning` focused runtime test.

## Preserved

- existing Summer Quest UI/navigation;
- v0.2.7 manual provider/model routing;
- server-side API keys only;
- deterministic game truth and progression;
- offline-first activity behavior.

## Not added

- no 3D planet work;
- no automatic LLM escalation;
- no LLM-controlled scoring/difficulty;
- no new child-facing global UI.
