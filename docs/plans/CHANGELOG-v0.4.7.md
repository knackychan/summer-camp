# Summer Quest v0.4.7 — Granular Language Skill Map

## Added

- ten deterministic Language curriculum subskills covering initial sound, word construction, picture vocabulary, high-frequency recall, spelling patterns, meaning links, sentence patterns and Bopomofo;
- shared `LanguageSkillRules` module used by curriculum attribution and directed Word Wizard practice;
- skill-specific Word Wizard pool filtering;
- Initial Sound target reduction (`cat → c`) while preserving picture + spoken source;
- Bopomofo Sound-symbol target reduction (`ㄇㄠ → ㄇ`) while preserving Chinese source/audio;
- conservative legacy coarse-skill compatibility aliases;
- deterministic Language Teach examples for every granular skill;
- focused `test:language-skills` regression gate;
- granular Language rules in the offline PWA app shell.

## Word Wizard

- Smart Practice / Placement now pass the exact Language subskill into Word Wizard;
- directed queues are filtered using the shared curriculum rules;
- directed sessions no longer show or mutate the legacy collection/mastery shelf;
- normal free-play attempts are classified into the closest granular skill from their actual target/mode;
- Copy remains AI-free, and Placement still disables adaptive hinting.

## Placement v3

- Language calibration uses the age/reading/mode-appropriate granular ladder;
- Bopomofo calibrates sound-symbol separately from full word construction;
- old v2 placement state is rebuilt instead of being interpreted as granular placement;
- bounded legacy telemetry can still seed the closest base Language skill.

## Learning Director v8

- new plans operate on granular Language skill IDs;
- repeated weakness can still insert the existing deterministic Language Teach step for the exact subskill;
- pre-reader Smart Practice can target Initial Sound without forcing text-heavy recall/translation modes;
- old v7 plans rebuild cleanly.

## Compatibility

- legacy IDs (`language.word_copy`, `language.word_recall`, `language.word_translation`, `language.sentence_recall`, `language.bopomofo`) remain valid for stored historical data;
- coarse history is mapped only to the nearest base skill and is not treated as evidence for specialist spelling/question/sound subskills.

## Validation

- `test:language-skills` passes;
- curriculum, placement, mastery/review and Learning Director tests pass;
- Math + Language Teach tests pass;
- adaptive Math/Language, telemetry, tutor-policy/experiment and AI-eval tests pass;
- agent routing/server, mobile architecture and TypeScript checks pass;
- Brain host remains 21/21;
- Registry remains 10/10;
- Core remains 75/75;
- broad checker remains on the inherited baseline with no new findings.
