# Summer Quest v0.4.7 — Granular Language Skill Map

**Date:** 2026-09-24  
**Scope:** existing Word Wizard UI/runtime, curriculum skill map, placement, Learning Director, Language Teach scenes, learning telemetry and offline shell.

## Goal

Math now has precise concepts such as number comparison, number bonds, operation ranges and multiplication tables. Language was still mostly represented by five Word Wizard modes (`copy`, `recall`, `translate`, `sentences`, `bopomofo`). That was too coarse for Smart Practice to know *what* the child actually needed to learn.

v0.4.7 keeps the existing Word Wizard and breaks its learning evidence into deterministic language subskills. No new home UI, chat surface or second language game is introduced.

## New Language skill map

```text
FOUNDATIONS
language.initial_sound
language.word_build.simple

VOCABULARY / FLUENCY
language.picture_vocabulary.basic
language.high_frequency.recall
language.spelling_patterns.basic
language.word_translation.basic

SENTENCES
language.sentence_patterns.simple
language.sentence_patterns.questions

BOPOMOFO / ZHUYIN
language.bopomofo.sound_symbol
language.bopomofo.word_build
```

Each skill has bilingual labels, age/reading constraints, prerequisites, launch metadata and its own Smart Practice / mastery / review identity.

The five v0.4.6 coarse IDs remain readable as legacy IDs so persisted telemetry/session data does not become invalid, but they are no longer selected for new Smart Practice plans.

## Shared language rules

`LanguageSkillRules.ts` is the single deterministic rule layer shared by curriculum attribution and Word Wizard directed practice. It owns:

- granular skill IDs;
- Word Wizard mode for each skill;
- starter high-frequency vocabulary list;
- starter spelling-pattern recognition rules;
- simple-vs-question sentence classification;
- Bopomofo sound-symbol vs word-build distinction;
- directed answer reduction for initial-sound / first-Zhuyin-symbol practice;
- bounded legacy coarse → granular compatibility aliases.

The rules are product heuristics for this prototype, not a formal language assessment or national-curriculum mapping.

## Existing Word Wizard, skill-specific practice

Smart Practice and Placement still launch `gameId: "vocab"`. The game reads the requested `C.director.skill`, then filters its existing local content pool to entries compatible with that skill.

Examples:

```text
Initial sound
🐱 + spoken "cat"
answer target: c

Simple word build
🐱
answer target: cat

Spelling pattern
🌧️ rain
focus: common orthographic chunk such as ai

Sentence question
🎒 where is my bag

Bopomofo sound-symbol
🐱 + spoken 貓
answer target: ㄇ
```

If a requested filter unexpectedly produces no entries, Word Wizard falls back to the existing local pool rather than breaking the activity.

## Directed-practice isolation

Smart Practice / Placement sessions do not mutate or display the old Word Wizard collection/mastery shelf. That prevents a one-letter Initial Sound task from polluting a legacy whole-word mastery key.

The real learning runtime still records the attempt against the exact granular skill, so mastery/review and the Learning Director receive useful evidence.

Normal free Word Wizard play remains intact and is deterministically classified from the actual target/mode.

## Legacy evidence migration

Existing v0.4.6 coarse telemetry is not discarded. A conservative compatibility map can seed only the nearest base skill:

```text
language.word_copy        → language.word_build.simple
language.word_recall      → language.picture_vocabulary.basic
language.word_translation → language.word_translation.basic
language.sentence_recall  → language.sentence_patterns.simple
language.bopomofo         → language.bopomofo.word_build
```

It intentionally does **not** infer specialist evidence for:

- Initial Sound;
- High-frequency recall;
- Spelling patterns;
- Question patterns;
- Bopomofo first-symbol recognition.

This avoids fabricating precision that the old telemetry never captured.

## Placement v3

Language placement now calibrates along the granular ladder appropriate to age, reading level and selected Word Wizard mode.

Examples:

- pre-reader / young learner → Initial Sound → Simple Word Build;
- early reader → Word Build → Picture Vocabulary → High-frequency Recall → Spelling Patterns;
- reader using Translate → can extend to Meaning Links;
- reader using Sentences → can extend to Simple Sentences → Everyday Questions;
- Bopomofo mode → Sound-symbol → Zhuyin Word Build.

Placement storage moves to **v3** so the old single coarse Language placement result is not mistaken for a granular result. Existing independent coarse history can still resolve the compatible base skill through the conservative migration map.

## Learning Director v8

Daily Smart Practice plan schema moves from v7 to **v8**. New plans can select the granular Language skills directly for warm-up, focus, teach, reinforce, confidence and review steps.

The existing Math and Language Teach card is reused. `LanguageTeachScene` now contains deterministic examples for every new Language skill.

Already persisted v7 plans rebuild cleanly rather than mixing coarse and granular language IDs inside one active plan.

## AI boundary

No LLM classifies a word, assigns a language skill, chooses placement, chooses mastery, filters the Word Wizard pool or reduces a target to its initial sound.

AI remains optional wording support for the existing constrained hint/Teach services only. The application still owns:

- target;
- correct answer;
- selected skill;
- mode;
- teaching/hint strategy allow-list;
- progression and review state.

## Offline behavior

`LanguageSkillRules.js` is included in the service-worker app shell and the cache revision is bumped to `summer-quest-v98-granular-language-skills`.

Granular language selection, directed Word Wizard practice, placement and local teaching therefore continue to work without the LAN agent server.

## Acceptance criteria

- new Smart Practice plans use granular Language skills rather than the five coarse IDs;
- Word Wizard filters directed local content to the requested subskill;
- Initial Sound uses the original picture/spoken word but requires only the first letter;
- Bopomofo Sound-symbol keeps the Chinese source/audio but requires only the first Zhuyin symbol;
- directed practice cannot mutate legacy Word Wizard collection/mastery boxes;
- normal Word Wizard attempts are deterministically attributed to a granular skill;
- v0.4.6 coarse history seeds only a conservative compatible base skill;
- Language Teach has a deterministic scene for every new skill;
- Placement v3 and Learning Director v8 rebuild older persisted state cleanly;
- offline cache includes the shared Language rule module;
- focused and project regression gates pass with no new broad-check findings.
