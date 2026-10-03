# Summer Quest v0.3.8 — Controlled Tutor Policy Experiment Harness

## Added

- opt-in `TutorExperimentHarness` in the shared Learning Runtime;
- first controlled experiment: `math-near-miss-support-v1`;
- stable per-learner deterministic variant assignment;
- `visual_explanation` vs `easier_follow_up` predefined Math support variants;
- experiment tags on intervention telemetry;
- descriptive `TutorExperimentEvaluation` aggregation;
- Operations → Reports **Controlled tutor experiment** section;
- `SUMMER_TUTOR_EXPERIMENTS` family-PC server configuration;
- focused `test:tutor-experiment` coverage.

## Guardrails

- experiments are disabled by default;
- only already-eligible repeated Math near-miss/counting-slip support can enter v0.3.8's experiment;
- experiment assignment cannot affect grading, level, curriculum access, model provider/tier, or normal answer checking;
- no AI chooses the experiment arm;
- no automatic winner or rollout is produced;
- raw typed child answers remain excluded from telemetry.

## Validation

- `npm run test:tutor-experiment` passes;
- `npm run test:tutor-policy-eval` passes;
- `npm run test:telemetry` passes;
- `npm run test:adaptive-tutor` passes (Brain 21/21 included);
- `npm run test:agent-server` passes;
- `npm run typecheck:mobile` passes;
- `npm run typecheck:agent` passes.
