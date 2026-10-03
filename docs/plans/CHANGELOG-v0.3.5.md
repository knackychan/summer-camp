# Summer Quest v0.3.5 — Adaptive Language Tutor

## Added

- deterministic vocabulary mistake classification;
- adaptive Word Wizard Study-mode tutor policy;
- `continue`, `tiny_clue`, `picture_audio`, `reveal_letter` and `easier_recall` interventions;
- persisted language mistake labels on learning attempts;
- locally controlled one-letter reveal and easier-recall support;
- vocabulary provider strategy allow-lists selected by the local tutor policy;
- automatic fallback when a provider ignores the selected vocabulary strategy constraint;
- `getVocabularyIntervention` bridge through the existing learning runtime;
- `test:adaptive-language` and combined Math + Language adaptive tutor coverage;
- offline cache entries for the new language tutor modules.

## Behavior changes

- an isolated typo after a strong run can continue without an AI call;
- pre-readers can receive picture/audio reinforcement automatically;
- repeated misses at one position reveal exactly that letter;
- recent repeated difficulty can temporarily step the current word down to easier recall support without changing the global Word Wizard mode;
- manual Hint remains available;
- supported attempts remain non-first-try for mastery and are naturally scheduled for later review.

## AI guardrails

- the local tutor selects the intervention and allowed strategies;
- the provider cannot override that allow-list;
- target-word leakage in returned text is still rejected;
- Math strategies returned for Vocabulary are still rejected;
- grading, mastery, queue order and learner level remain deterministic application logic.

## Unchanged

- existing Summer Quest global UI/navigation;
- Brain Gym Math adaptive tutor behavior from v0.3.4;
- Copy mode remains AI-free;
- Potion Shop remains unchanged;
- manual-first provider routing and server-only credentials;
- AI Lab and local/LAN agent-server architecture.
