# Summer Quest v0.4.8 — Knowledge Lesson Runtime / Science

## Added

- Science Lab card inside the existing Learn tab;
- deterministic Knowledge Lesson Runtime and per-child session store;
- six bilingual Science lessons: Animals, Plants, Human Body, Matter, Weather and Space;
- touchable lesson visuals with deterministic inspection notes;
- two locally graded questions per Science lesson;
- Science skill IDs and unified `domain: science` attempt telemetry;
- optional protected `knowledge_lesson` agent task;
- strict `knowledge_lesson_plan` schema that can only select/reorder approved fact/question IDs;
- server-side prompt that explicitly forbids invented science claims/questions/answers;
- local fallback when the remote plan is absent or violates the approved ID allow-list;
- `test:knowledge` regression gate;
- Knowledge Lesson modules in the PWA app shell.

## AI authority remains bounded

AI may choose:

- approved fact order/subset;
- approved question order/subset;
- one presentation mode;
- one encouragement style.

AI may not choose or invent:

- science facts;
- correct answers;
- grading;
- rewards;
- learner levels;
- mastery/review state;
- curriculum access;
- model escalation.

## Validation

- Knowledge Lesson Runtime tests pass;
- Math/Language learning and curriculum gates pass;
- Teach / adaptive tutor / telemetry gates pass;
- agent routing and local-server gates pass;
- mobile architecture and TypeScript checks pass;
- Brain host remains 21/21;
- Registry remains 10/10;
- Core remains 75/75;
- broad legacy checker remains at the exact inherited v0.4.7 132-finding set, with zero new findings.
