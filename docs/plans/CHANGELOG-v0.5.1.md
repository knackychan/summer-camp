# Summer Quest v0.5.1 — Geography Smart Practice + Mastery / Review

## Added

- six Geography curriculum skills to the shared director-eligible Skill Catalog;
- Geography as a Learning Director domain;
- Smart Practice launches for the existing Map Explorer;
- Geography Explore and Check launches through the shared Knowledge Lesson Runtime;
- Geography spaced review through the existing MasteryReviewScheduler;
- `test:geography-adaptive` focused regression gate;
- Geography adaptive coverage in `test:knowledge` and `test:geography`.

## Learning Director v10

- plan schema moves from v9 to v10;
- Geography may become focus from real shared telemetry;
- Geography-focused sessions use the same three-step bounded Knowledge shape as Science;
- new/Building Geography launches in Explore mode;
- Secure/Review-due Geography launches in Check mode;
- Knowledge launch metadata is generalized to `knowledgeMode`;
- the old Science `scienceMode` field remains as a compatibility alias.

## UI factorization

- the former Science-only Smart Practice launcher is replaced by one shared Knowledge launcher;
- Science and Geography dispatch through the existing `KNOWLEDGE_LABS` configuration;
- Map Explorer receives the same directed-session lock and Back to Smart Practice behavior as Science Lab;
- free Science and Geography use remain unchanged.

## Safety / authority

- Geography answers remain locally graded from the deterministic catalog;
- Check mode cannot request remote resequencing;
- mastery/review uses independent local telemetry;
- the LLM cannot select curriculum skills, grade answers, set mastery/review state, change review timing, or invent geographic claims.

## Placement

- Quick Placement remains Math + Language only.

## Offline

- service-worker cache revision moves to `summer-quest-v102-geography-smart-practice`.
