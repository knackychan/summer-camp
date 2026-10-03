# Summer Quest v0.3.4 — Adaptive Math Tutor

## Added

- deterministic Math mistake classification;
- adaptive tutor policy with `continue`, `tiny_hint`, `visual_explanation` and `easier_follow_up` interventions;
- locally generated unscored scaffold questions;
- stored mistake tags on learning attempts;
- Brain Gym integration for proactive visual support and smaller-step practice;
- provider hint strategy constraints chosen by the local tutor policy;
- automatic local fallback when a model ignores those constraints;
- focused adaptive tutor test command.

## Behavior changes

- a strong learner making one small slip can continue without an unnecessary AI request;
- repeated diagnosed mistakes trigger concrete visual support;
- repeated difficulty can insert one easier local practice step before retrying the original question;
- guided retries and scaffold questions never rewrite the original Brain Gym score;
- adaptive level changes remain the existing deterministic five-attempt policy.

## Unchanged

- existing Summer Quest navigation/UI shell;
- provider credentials remain server-only;
- manual-first provider/model routing;
- vocabulary learning behavior from v0.3.1;
- AI Lab evaluation workflow;
- local/LAN agent server architecture.
