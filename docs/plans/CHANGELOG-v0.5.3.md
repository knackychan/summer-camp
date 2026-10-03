# Summer Quest v0.5.3 — History Smart Practice + Mastery / Review

## Added

- six History curriculum skills to the shared director-eligible Skill Catalog;
- History as a Learning Director domain;
- Smart Practice launches for the existing Time Traveler card;
- History Explore and Check launches through the generic Knowledge contract;
- History spaced-review launches through the existing MasteryReviewScheduler;
- focused `test:history-adaptive` regression gate;
- History adaptive coverage in the complete `test:knowledge` gate.

## Learning Director v11

- plan schema moves from v10 to v11;
- History can become focus from real shared telemetry;
- History-focused sessions use the same three bounded Knowledge steps as Science and Geography;
- new/Building History launches in Explore mode;
- Secure/Review-due History launches in Check mode;
- old v10 daily plans rebuild locally;
- `knowledgeMode` remains the shared Knowledge launch mode;
- the old `scienceMode` field remains a compatibility alias only for persisted Science plans.

## History safeguards

- correctness remains owned by the deterministic Time Traveler catalog;
- Check mode starts directly at the two local questions;
- Check mode cannot request AI resequencing;
- History mastery/review uses independent attempt telemetry only;
- the LLM cannot select curriculum skill, grade answers, set mastery/review state or change review timing;
- Quick Placement remains Math + Language only.

## Existing UI

- Smart Practice opens the current Time Traveler card directly;
- directed History completion exposes `Back to Smart Practice / 回到聰明練習`;
- non-active History topics are temporarily disabled while a directed History step is active;
- free History use remains available outside Smart Practice;
- generic Knowledge launch UI now handles Science, Geography and History.

## Offline

- service-worker cache revision moves to `summer-quest-v104-history-smart-practice`;
- History Smart Practice and review remain fully local-first.

## Validation

- History Smart Practice / mastery tests pass;
- complete Science + Geography + History Knowledge tests pass;
- Curriculum, Placement, Mastery/Review and Learning Director tests pass;
- Science and Geography adaptive regressions pass;
- Math/Language Teach, telemetry and tutor-policy tests pass;
- AI evaluation, agent routing and local agent server tests pass;
- mobile architecture checks pass;
- Brain host remains 21/21;
- Registry remains 10/10;
- Core remains 75/75;
- broad legacy checker remains exactly at the inherited v0.5.2 132-finding set, with zero new findings.
