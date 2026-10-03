# Summer Quest v0.5.2 — History / Time Traveler Knowledge Runtime

## Added

- **Time Traveler / 時光旅行家** card inside the existing Learn tab;
- six deterministic bilingual History lessons:
  - Past and Present;
  - Before and After;
  - History Detectives / Sources;
  - Ancient Egypt Clues;
  - Ancient China Clues;
  - Messages Through Time;
- `HistoryLessonCatalog` on top of the shared Knowledge Lesson Runtime;
- History visual kinds for past/present, sequence, sources, civilizations and change over time;
- `history` as a shared learning/telemetry domain;
- normalized History level in learner profiles;
- History attempt telemetry with concrete `history.*` skill IDs;
- History browser bridge methods in the existing `SQLearningRuntime`;
- focused `test:history` regression gate;
- History coverage in the complete `test:knowledge` gate.

## Shared runtime improvements

- Knowledge Lesson Catalog now supports Science, Geography and History;
- the generic Knowledge card config owns its question-button icon instead of special-casing Geography in renderer code;
- cross-domain session isolation now covers three Knowledge domains.

## AI authority remains bounded

AI may choose only:

- approved fact order/subset;
- approved question order/subset;
- one bounded presentation mode;
- one bounded encouragement tone.

AI may not choose or invent:

- historical facts or claims;
- historical answers;
- grading;
- rewards;
- learner level changes;
- mastery/review state;
- curriculum access;
- model escalation.

Unsupported History IDs reject the remote plan and preserve the deterministic local lesson.

## Adaptive scope

- History evidence is recorded now;
- History is **not yet** part of Learning Director, Mastery/Review or Quick Placement;
- existing Math, Language, Science and Geography adaptive behavior is unchanged.

## Offline

- service-worker cache revision moves to `summer-quest-v103-history-time-traveler`;
- `HistoryLessonCatalog.js` is included in the offline app shell.

## Validation

- focused History Knowledge Runtime tests pass;
- combined Science + Geography + History Knowledge tests pass;
- existing Science/Geography adaptive tests remain clean;
- mobile and agent TypeScript checks pass;
- no new broad legacy-check findings are accepted for the release.
