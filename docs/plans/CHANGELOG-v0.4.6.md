# Summer Quest v0.4.6 — Language Teach / Explain

## Added

- deterministic Language Teach scenes for Word Copy, Word Recall, Translation, Sentence Recall and Bopomofo;
- progressive letter-build, picture-word, translation-pair, sentence-chunk and sound-symbol visuals in the existing Teach card;
- deterministic audio cue per language teaching scene;
- `LanguageTeachScene`, `LanguageTeachRequest`, `LanguageTeachService` and `LanguageTeachBridge`;
- local-first Language Teach rendering with optional protected AI wording;
- focused `test:language-teach` coverage;
- Language Teach modules in the offline PWA app shell.

## Learning Director v7

- plan schema moves from v6 to v7;
- repeated Language weakness can now produce `warm-up/review → teach → focus → confidence`;
- the same local evidence rules used for Math now apply to supported Language skills;
- Teach remains inline, unscored and explicitly acknowledged;
- the step after Teach launches the existing Word Wizard in the exact curriculum mode selected by the director.

## Shared Teach UI

- v0.4.5 Math Teach and v0.4.6 Language Teach share one Smart Practice Teach card;
- the UI dispatches the local/remote teaching bridge by `step.domain`;
- Language-specific visuals do not create another game or navigation route;
- Listen uses the scene's deterministic word/sentence/Chinese audio cue when provided.

## Guardrails

- the application owns the exact language target, source meaning, spelling/symbols, visual kind and allowed strategy;
- AI may rephrase short bilingual explanation text only;
- AI strategy mismatch, invalid schema or provider failure falls back locally;
- teaching does not grade, alter mastery/review, award rewards, change learner levels or mutate Word Wizard mastery;
- existing hint leakage protections remain unchanged because Teach and Hint are separate interactions.

## Validation

- Language Teach scene/service/bridge tests pass;
- Math Teach regression tests pass;
- Learning Director v7 cross-domain Teach tests pass;
- Language learning, expanded Math, mobile and agent typechecks pass;
- broader project regression gates remain unchanged.

## Regression status

- `test:teach`: Math Teach + Language Teach + Learning Director pass;
- `test:curriculum`: skill map + strand placement + mastery/review + Learning Director pass;
- `test:adaptive-tutor`: learning runtime + Brain host 21/21 + Vocabulary pass;
- telemetry, tutor-policy evaluation, tutor experiments and AI evaluation pass;
- agent routing/server and mobile architecture pass;
- Registry remains 10/10;
- Core remains 75/75;
- broad checker remains at the exact inherited 132-finding set from v0.4.5 (0 added / 0 removed).
