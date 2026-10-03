# Summer Quest v0.3.8 — Controlled Tutor Policy Experiment Harness

**Date:** 2026-09-24

## Goal

Turn the descriptive tutor-policy telemetry from v0.3.7 into a deliberately controlled experiment mechanism without allowing telemetry, the LLM, or an automatic optimizer to rewrite teaching policy.

The first experiment is intentionally narrow:

`math-near-miss-support-v1`

It is eligible only when the existing deterministic Math tutor has already classified an error as a repeated `near_miss` / `counting_slip` pattern and would normally use `visual_explanation`.

Two predefined support variants are compared:

- `visual_explanation` — concrete objects / number-line support;
- `easier_follow_up` — one locally generated easier scaffold, then retry the original problem.

## Safety / product constraints

- OFF by default;
- enabled only by an adult/developer through the family-PC server configuration;
- stable assignment per learner + experiment;
- no random per-question switching;
- no change to grading;
- no change to learning level;
- no change to curriculum/activity access;
- no change to model tier or provider;
- no LLM-selected experiment arm;
- no automatic winner, recommendation, or rollout;
- raw typed child answers remain excluded from learning telemetry.

## Configuration

In `server/agent-proxy/.env`:

```text
SUMMER_TUTOR_EXPERIMENTS=math-near-miss-support-v1
```

Leave the setting empty for normal operation.

The local server exposes only the enabled experiment IDs through the public runtime config. No secret or experiment result is placed in the client config.

## Deterministic assignment

Assignment uses a stable local hash of:

```text
experiment ID + learner ID
```

This means the same learner receives the same predefined support variant across sessions and devices using the same experiment ID.

## Telemetry

The already-existing `intervention` telemetry event can now include:

```json
{
  "experimentId": "math-near-miss-support-v1",
  "experimentVariant": "visual_explanation"
}
```

Only intervention metadata is added. Raw answers remain discarded by the normalizer / LAN collector.

## Adult/developer report

Operations → Reports adds **Controlled tutor experiment** with per-variant descriptive evidence:

- learners;
- uses;
- support success;
- retry recovery;
- next independent success;
- later independent success;
- before/after independence delta;
- explicit sample-volume label.

The report intentionally does not rank variants or call one a winner.

## Acceptance criteria

- experiment off by default;
- ineligible tutor cases follow the existing policy unchanged;
- same learner is assigned consistently;
- experiment can expose both predefined variants across learners;
- generated easier scaffold remains deterministic/local;
- telemetry is explicitly tagged with experiment + variant;
- arbitrary/raw answer fields are still stripped;
- experiment evidence is visible in the existing Reports UI;
- no automatic policy mutation exists;
- existing Math, Language, telemetry, server and typecheck gates remain green.
