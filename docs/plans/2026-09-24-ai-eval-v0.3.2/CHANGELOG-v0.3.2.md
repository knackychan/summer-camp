# Summer Quest v0.3.2 — AI Evaluation Bench

## Added

- Math + Vocabulary support in the AI lesson-hint evaluation runtime;
- four representative built-in evaluation scenarios;
- local guardrail scoring for domain strategy, answer leakage and reading-level text budget;
- suite execution across manually selected model profiles;
- per-profile comparison summary for guardrails, profile match, latency and estimated cost;
- optional human `Useful` and `Age fit` ratings;
- local saved evaluation history (latest 20 runs);
- JSON export of saved eval history;
- regression coverage for Math answer leakage, Vocabulary target leakage and wrong-domain strategies.

## Unchanged

- no automatic model escalation;
- server profile allow-list remains authoritative;
- child Math/Vocabulary correctness and progression remain deterministic;
- provider credentials remain server-only;
- no planet/home-world UI work resumed.

## Validation

- `npm run typecheck:mobile` passes;
- `npm run test:ai-eval` passes;
- `npm run test:learning` passes;
- `npm run test:language` passes;
- `npm run test:agent-routing` passes;
- `npm run typecheck:agent` passes;
- `npm run test:mobile` passes;
- Brain host: 19/19;
- registry: 10/10;
- core: 75/75;
- full legacy checker remains at the same 132 pre-existing findings as v0.3.1.
