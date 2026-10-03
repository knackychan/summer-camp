# Summer Quest v0.5.4 — Guided Learning Sessions

Release date: 2026-09-27
Implementation of the local Unified Adaptive Tutor Orchestrator slice on the exact v0.5.3 History Smart Practice FULL archive.

## Child-visible changes

Smart Practice now has Start/Resume, Another choice, Pause and Finish for now in the existing Learn interface. It proposes the next appropriate existing activity after locally validated completion, without auto-launching. Saved partial progress and a voluntarily finished session are displayed explicitly. The existing skill map remains available under an expandable heading.

All five subjects use the session path. Science/Geography/History resume preserves the lesson's position and answers. Paused guided lessons leave free topic selection available. An unavailable saved activity produces another eligible suggestion or an honest no-candidate state. The original games, curriculum content, two-question knowledge assessments and reward ownership are unchanged.

## Reliability and implementation

- Extended the existing Learning Director and v11 plan store, with an additive coordination-v1 object rather than a parallel scheduler.
- Bound guided progress to learner, skill, activity run and stable attempt identity. Persisted accepted partial progress survives telemetry-buffer pruning.
- Serialized local mutations and deduplicated Math/Language attempts and Knowledge answer evidence, including repeated callbacks.
- Added expected plan/step/revision and lesson/question guards plus child/view/word freshness checks for delayed UI/AI responses.
- Prevented delayed knowledge adaptation from restoring a reset/replaced session, overwriting answered state or sequencing Check mode.
- Reused the existing optional AI hint/teach/Explore paths and protected provider gateway; no autonomous escalation or new provider task.
- Bumped the shell cache to `summer-quest-v105-guided-learning-sessions` and included the compiled shared storage helper.

## Compatibility

Existing v11 plans upgrade lazily in the shipped UI. Completed work and committed partial counts are retained; incomplete old unbound starts reopen safely. Old v10 plans retain the previous rebuild behavior. Quick Placement remains Math + Language. `knowledgeMode` and the `scienceMode` compatibility alias remain. No DB migration, provider configuration change, application-file deletion or new star grant is part of this release.

The local serialization is per storage-driver instance. It does not establish cross-tab, cross-device or distributed exactly-once delivery. Legacy non-guided bridge callers retain their previous compatibility path.

## Validation

Both builds and both type checks pass. All 264 discovered tests pass, including 22 new guided-session tests. Eight rendered-component smoke checks pass using the actual UI functions and real compiled bridges, with surrounding navigation/audio replaced by test doubles. FULL/UPDATE/patch reconstruction is checked during packaging.

The broad project checker is intentionally **not green**: it reports exactly the same 132 inherited diagnostic identities as v0.5.3, with no additions or removals. See VALIDATION.md for the baseline comparison and untested full-app/service-worker/device/live-provider boundaries.
