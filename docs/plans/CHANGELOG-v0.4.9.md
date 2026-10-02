# Summer Quest v0.4.9 — Science Smart Practice + Mastery / Review

## Added

- six Science curriculum skills to the shared director-eligible Skill Catalog;
- Science as a Learning Director domain;
- Smart Practice launches for the existing Science Lab;
- `explore` and `check` Science lesson modes;
- directed Science session metadata (`flow`, director session/step IDs);
- Science spaced-review launches through the existing MasteryReviewScheduler;
- a focused `test:science-adaptive` regression gate;
- Science Smart Practice coverage in the complete Knowledge runtime gate.

## Learning Director v9

- plan schema moves from v8 to v9;
- Science may become the focus from real shared telemetry;
- a Science-focused session uses three bounded steps rather than duplicating the same two-question lesson as Focus + Reinforce;
- active/new/Building Science launches in Explore mode;
- Secure/Review-due Science launches in Check mode;
- existing Math and Language step behavior remains unchanged.

## Science review safeguards

- Check mode starts directly at deterministic questions;
- Check mode marks remote adaptation as already attempted so AI cannot resequence a spaced-review measurement;
- correctness remains owned by the local lesson catalog;
- Science mastery/review uses the existing independent-attempt evidence rules;
- the LLM cannot select curriculum skill, grade answers, set mastery/review state or change provider/model tier.

## Existing UI

- Smart Practice can open the current Science Lab directly;
- directed Science completion exposes `Back to Smart Practice / 回到聰明練習`;
- non-active Science topics are temporarily disabled while a directed Science step is in progress;
- free Science Lab behavior remains available outside Smart Practice.

## Offline

- service-worker cache revision moves to `summer-quest-v100-science-smart-practice`;
- Science Smart Practice and review remain fully local-first.

## Validation

- Science Smart Practice / mastery tests pass;
- complete Knowledge Lesson Runtime tests pass;
- Curriculum, Placement, Mastery/Review and Learning Director tests pass;
- Math/Language adaptive tutoring and Teach tests pass;
- unified telemetry / tutor policy / tutor experiment tests pass;
- AI evaluation, agent routing and local agent server tests pass;
- mobile architecture and TypeScript checks pass;
- Brain / Registry / Core regressions remain clean;
- broad legacy checker remains at the inherited baseline finding set, with no new findings.
