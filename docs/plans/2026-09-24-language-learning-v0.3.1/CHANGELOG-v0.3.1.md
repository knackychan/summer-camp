# Summer Quest v0.3.1 — Language / Vocabulary Learning Slice

## Added

- vocabulary-specific `lesson_hint` request builder;
- deterministic vocabulary hint fallback;
- trusted local vocabulary hint presentation strategies;
- `VocabularyHintService` with provider failure, wrong-domain and answer-leak fallback;
- `VocabularyLearningBridge` for persistent language sessions;
- Word Wizard Study integration with AI-assisted hints;
- local recording of vocabulary correctness, response time and hint use;
- copy-mode learning history without AI spend or adaptive-level mutation;
- language-learning tests and `npm run test:language`;
- service-worker precache entries for the new mobile learning modules.

## Changed

- the shared `lesson_hint` contract now supports both math and language strategies;
- the Agent Proxy lesson-hint prompt is domain-aware;
- the Math hint service explicitly rejects language-only strategies;
- the browser learning runtime now lazy-loads both Math and Vocabulary bridges;
- the existing game context exposes vocabulary learning hooks to Word Wizard.

## Intentionally unchanged

- existing Summer Quest navigation/UI shell;
- Word Wizard word pools and core typing/correctness logic;
- Potion Shop timed mode;
- AI routing remains manual; there is no automatic model escalation;
- the parked 3D planet/home-world concept.

## Validation

- `test:language` passes;
- `test:learning` passes;
- `test:agent-routing` passes;
- `test:ai-eval` passes;
- `typecheck:mobile` passes;
- `typecheck:agent` passes;
- `test:mobile` passes;
- Brain host: 19/19 pass;
- Registry: 10/10 pass;
- Core: 75/75 pass;
- full legacy check remains at the unchanged v0.3.0 baseline of 132 known findings.
