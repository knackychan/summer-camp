# Summer Quest v0.3.7 — Tutor Policy Evaluation

## Added

- `TutorPolicyEvaluation` over the normalized learning telemetry stream;
- evidence rows grouped by learner, domain, skill and deterministic intervention;
- support success, retry recovery, next-independent success and later-independence metrics;
- before/after independent-attempt comparison for descriptive review;
- explicit `very_low`, `low`, `emerging` and `usable` sample-volume labels;
- Operations → Reports **Tutor policy evidence** table;
- telemetry JSON export now includes policy evidence;
- focused `test:tutor-policy-eval` gate;
- Brain Gym support-outcome callbacks for scaffold success, retry recovery/failure and support skip;
- language assisted-completion outcomes associated with the locally selected intervention.

## v0.3.6 foundation completed in this baseline

- unified Math + Language learning/tutor telemetry events;
- bounded browser-local ring buffer;
- family-PC `/api/learning-telemetry` collector;
- field-by-field server normalization and bounded JSON storage;
- centralized/fallback Operations → Reports learning telemetry view;
- AI/local hint usage, token/cost and recovery summaries;
- best-effort telemetry mirroring that never blocks gameplay.

## Unchanged

- existing Summer Quest child UI and navigation;
- deterministic grading and progression;
- deterministic Math and Language tutor policies;
- five-attempt level adaptation;
- manual-first LLM routing;
- no automatic model escalation;
- no telemetry-driven policy changes;
- Copy mode AI-free;
- Potion Shop adaptive tutoring disabled.

## Validation

- `test:telemetry` passes;
- `test:tutor-policy-eval` passes;
- adaptive Math + Language tests pass (Brain 21/21);
- agent routing/local server tests pass;
- mobile/agent TypeScript typechecks pass;
- Registry remains 10/10;
- Core remains 75/75;
- broad checker remains at the inherited 132 findings, with zero new findings.
