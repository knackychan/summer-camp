# Summer Quest v0.3.9 — Learning Director / Smart Practice

## Added

- deterministic `LearningDirector` for short cross-domain sessions;
- local `LearningDirectorStore` with per-learner/per-day persistence;
- legacy/runtime bridge for the existing Summer Quest UI;
- Smart Practice card in the existing Learn tab;
- four-step `warm_up → focus → reinforce → confidence` session shape;
- compact local mastery/practice-need summaries for Math and Language;
- stable learner/day tie-breaking when evidence is equal or absent;
- explicit director launch metadata for existing activities;
- focused `test:learning-director` regression gate.

## Activity integration

- Brain Gym Math is reused as the Math Smart Practice activity;
- Word Wizard Study mode is reused for Language Smart Practice;
- Word Wizard can receive a director-selected vocabulary mode without changing the learner's normal preference;
- directed Word Wizard steps finish after their bounded attempt target and return to Learn;
- pre-reader Smart Practice avoids Translate/Sentences.

## Guardrails

- planning remains deterministic/local;
- no LLM selects the next skill or activity;
- grading remains inside the existing activity runtime;
- persisted learner levels remain owned by the existing adaptation engine;
- adaptive tutoring remains owned by the existing Math/Language tutor policy;
- Smart Practice awards no new currency/reward by itself;
- plans do not reshuffle mid-session;
- unrelated/historical telemetry cannot finish a director step;
- offline behavior remains first-class.
