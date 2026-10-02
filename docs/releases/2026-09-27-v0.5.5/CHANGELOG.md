# Summer Quest v0.5.5 — Bounded Explore Help

Release date: 2026-09-27. Baseline: exact v0.5.4 Guided Learning Sessions FULL archive.

## Child-visible changes

The existing Science Lab, Map Explorer and Time Traveler Explore introductions now include **Explore with Summer / 跟 Summer 探索**. A local approved clue appears first; an optional AI selection can choose one catalogue clue. The matching visual/fact is highlighted, Listen reads the existing bilingual text, and Another clue stays entirely local. Main question and navigation controls remain usable.

The AI selects an ID only, never writes facts or answers. Both the gateway and client validate it. Help is absent in Check mode and during every question phase. The existing two-question assessments, local grading, guided session loop, Math/Language support and Quick Placement scope are unchanged.

## Reliability and cost controls

One explicit optional help-selection attempt per stored Explore lesson session; no automatic retry, no paid upgrade, and no request from rerender, reload or Another clue. The earlier optional lesson-sequencing task is unchanged and separate from this allowance. A newly started lesson has a new allowance; this is not a family-wide budget.

A six-second deadline and cancellation keep late output from overwriting a newer clue, answered question, reset lesson or different child view. Listening preserves the visible clue instead of accepting a pending replacement. Interrupted requests recover to local help and are not silently replayed. Cancellation does not guarantee provider-side zero usage.

## Adult diagnostics

Existing learning telemetry now has an Explore tutor help section: actual returned route/profile, task/outcome, latency, fallback and token/cost fields. Unknown values are Unavailable/null, not zero. Help is diagnostic-only, excluded from learning-evidence summaries. A separate last-100 help-record allowance prevents these records evicting the existing graded-evidence window locally or in the optional family-PC collector.

## Compatibility and packaging

Learning Director v11 and knowledge-session v1 remain; `help` is additive presentation state. The cache is `summer-quest-v106-bounded-explore-help`. No provider configuration change, new dependency, DB migration, automatic routing change, new curriculum content, gameplay change or baseline-file deletion.

This release has 62 changed/new files (31 modified, 31 added), with zero deletions. Model catalogue, lesson catalogues, Learning Director, placement, mastery scheduler, checker and inherited runtime data are byte-identical to the baseline where stated in validation.

## Validation

Both builds and TypeScript checks pass. The complete discovered suite passes 308 tests, including 44 new focused tests. Nine new rendered-help component checks and eight existing guided-session component checks pass. The broad checker remains red at exactly the same 132 diagnostic identities as v0.5.4, none added or removed.

Full/UPDATE/patch reconstruction and UPDATE-helper safety are checked during packaging. Full-page navigation was blocked by the environment; real service-worker lifecycle, physical tablet and live-provider acceptance remain unverified. See VALIDATION.md.
