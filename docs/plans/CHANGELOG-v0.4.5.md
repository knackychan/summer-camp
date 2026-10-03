# Summer Quest v0.4.5 — Teach / Explain Step

## Added

- deterministic inline Math Teach step for repeated concept difficulty;
- local visual scenes for addition, subtraction, comparison, number bonds and multiplication;
- explicit child acknowledgement before Teach advances to practice;
- new `MathTeachScene`, `MathTeachRequest`, `MathTeachService` and `MathTeachBridge` modules;
- local-first render path so the visual lesson appears before optional AI wording;
- schema-constrained `lesson_explanation` agent response;
- optional bilingual AI rephrasing that cannot change the selected visual strategy;
- focused `test:teach` gate;
- teach modules in the offline PWA app shell.

## Learning Director v6

- plan schema moves from v5 to v6;
- repeated Math weakness can produce `warm-up/review → teach → focus → confidence`;
- Teach is inserted only from existing local evidence, never from placement/age alone;
- Teach has no activity launch or scored attempt target;
- Teach never auto-completes from telemetry;
- `Got it — practice` explicitly advances to the existing Brain Math practice step.

## Guardrails

- the app owns whether teaching happens;
- the app owns the skill, example, correct answer and visual strategy;
- AI can only rephrase a short bilingual explanation;
- strategy mismatch / malformed output / timeout falls back locally;
- Teach does not affect grading, mastery, review scheduling, rewards, learner level or curriculum access;
- no new navigation or parallel Math engine was introduced.

## Validation

- Math Teach scene tests pass;
- Learning Director v6 tests pass;
- agent routing / explanation schema tests pass;
- expanded Math, Language, telemetry, tutor policy/experiment, AI eval, placement, mastery and mobile architecture gates pass;
- Brain host remains 21/21;
- Registry remains 10/10;
- Core remains 75/75;
- broad legacy checker remains at the inherited 132-finding set with zero added/removed findings.
