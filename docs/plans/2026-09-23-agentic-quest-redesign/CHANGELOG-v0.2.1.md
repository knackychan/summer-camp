# Summer Quest — 2026-09-23 v0.2.1

## Persistent Summer companion

- Added globally accessible Summer companion on child surfaces.
- Companion reacts to active, paused, verification-pending and redo quest states.
- Added contextual activity-help action through the activity router.
- Local deterministic companion remains fully functional offline.

## Quest lifecycle

- Added pause/resume and per-step progress.
- Added `awaiting_verification` and `redo` states.
- Added active quest resurfacing on the Quest Board.
- Added clean-attempt semantics so stale verification rows cannot affect a new retry.

## Parent verification

- Quest Studio can mark a quest as child self-check or Papa verification.
- Parent-verified chores submit through the existing Ask transport.
- Papa queue exposes Approve + coins and Redo controls.
- Approval uses deterministic quest star IDs and only pays once.
- Verification sync is queued with the existing offline sync mechanism when configured.

## Activity / agent architecture

- Added application-level `SQActivityRouter` seam.
- Added read/navigation agent tools for active quest and activity context.
- Explicitly kept completion, reward mutation and approval out of the model tool surface.
- Added lifecycle/agent contract tests.

## Validation

- Targeted quest-agent tests pass.
- Modified JavaScript parses cleanly.
- Full project gate has the same 132 pre-existing failures as the supplied expanded baseline; no new gate failures were introduced by this milestone.
