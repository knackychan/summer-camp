# Summer Quest v0.4.1 — Quick Placement / Calibration

## Added

- optional **Quick skill check** card inside the existing Learn tab;
- local deterministic placement state machine for Math + Language;
- two-item adjacent-skill probes with early stopping;
- age-anchored Math placement ladder;
- reading-profile-aware Language placement ladder;
- Bopomofo placement path;
- persistent `PlacementCalibrationStore`;
- classic-shell `PlacementCalibrationBridge`;
- `test:placement` regression gate;
- placement modules in the offline service-worker shell.

## Smart Practice

- Learning Director plan schema moves from v2 to v3;
- completed placement can mark a provisional **Start here** skill;
- placement can make the recommended skill ready even when sparse-history prerequisites would otherwise hide it;
- skills above the provisional start can remain locked until foundation evidence becomes steady/strong;
- lower skills are de-prioritized while placement evidence is still sparse;
- real telemetry remains authoritative as more practice accumulates;
- completed placement can rebuild an **unstarted** daily plan;
- already-started Smart Practice sessions remain stable and are never reshuffled mid-session.

## Measurement safeguards

During placement items:

- Math AI hints are disabled;
- Math adaptive tutor interventions are disabled;
- Word Wizard adaptive tutor interventions are disabled;
- Word Wizard's Hint button is hidden;
- placement does not alter Word Wizard legacy mastery boxes;
- directed Brain placement does not affect Daily Brain completion, bests, or stars;
- placement remains optional and can be skipped without blocking learning.

## Existing-evidence behavior

- a fresh placement is recommended only while either Math or Language has fewer than four independent attempts;
- children with enough existing practice see the check as optional instead of being prompted to recalibrate.

## Validation

- placement calibration tests pass;
- curriculum + Learning Director tests pass;
- adaptive Math + Language tests pass;
- learning telemetry / tutor policy / tutor experiment tests pass;
- AI evaluation / agent routing / local agent server tests pass;
- mobile architecture and TypeScript checks pass;
- Registry remains 10/10;
- Core remains 75/75;
- full legacy checker remains at the inherited 132 findings from v0.4.0, with no new findings.
