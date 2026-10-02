# Summer Quest v0.3.0 — AI Lab / Model Evaluation

## Goal

Before automatic model escalation, collect comparable evidence for the same real Summer Quest task across manually selected provider/model profiles.

The new **Operations → AI Lab** uses the existing protected agent endpoint and the same `lesson_hint` JSON contract used by Brain Gym. It does not expose provider credentials or add model logic to the child UI.

## What it compares

For the same arithmetic mistake, selected profiles are run sequentially and the panel shows:

- requested profile;
- actual server-returned profile;
- schema validity;
- English / Traditional Chinese hint;
- hint strategy;
- latency;
- provider / model;
- input and output tokens when supplied;
- estimated cost when supplied;
- validated JSON.

A requested/actual profile mismatch is explicitly highlighted. This prevents a server-side allow-list fallback from being mistaken for a genuine model comparison.

## Safety / architecture

Arithmetic truth remains local. The evaluator calculates the correct answer and sends the model only a constrained `lesson_hint` task. The model cannot change Brain Gym scores, learner difficulty or progression.

The browser only knows the protected Summer agent endpoint. API keys remain server-side.

## Server policy

Ordinary deployments should keep client profile overrides disabled. For a controlled developer comparison, the deployment may set `allowClientProfileOverride: true` and allow-list only the profiles being evaluated.

## Next

Use the panel to gather representative hint-quality/cost samples for pre-reader, early-reader and reader scenarios. Only after those results should deterministic task → model routing be introduced.
