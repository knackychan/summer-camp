# Summer Quest v0.4.6 — Language Teach / Explain

**Date:** 2026-09-24  
**Scope:** existing Learn → Smart Practice UI, Learning Director, Word Wizard curriculum, deterministic language teaching scenes, optional protected agent wording.

## Goal

v0.4.5 proved that Smart Practice can pause repeated Math drilling and briefly **teach the concept** with a local visual before returning to the existing game. v0.4.6 applies the same architecture to Language / Word Wizard so adaptive teaching is cross-domain rather than Math-only.

No new home UI, language game or chat surface is introduced.

## Product flow

When the locally selected focus Language skill has repeated evidence of difficulty, the four-step Smart Practice session can become:

```text
warm-up / review → teach → Word Wizard practice → confidence
```

The Teach step is inline inside the existing Smart Practice card. It is a short demonstration, not a scored exercise.

## Deterministic trigger

Language teaching uses the same evidence-first rule as Math:

- the focus is a ready Language curriculum skill;
- at least three real attempts exist;
- the skill is not Secure / Review due;
- local evidence shows `needs_practice`, `level_down`, or repeated support need.

Copy practice has no adaptive hint policy by design, so repeated independent copy errors can still qualify from its real correctness evidence.

Age and placement can decide which skills are available, but they cannot by themselves trigger a Teach step.

## Deterministic language teaching scenes

Summer Quest owns one local scene for every current Language skill:

- **Word copy** → progressive letter construction (`c → ca → cat`);
- **Word recall** → picture + spoken word + ordered letter reconstruction;
- **Word translation** → French / Traditional Chinese meaning bridged to one English target;
- **Sentence recall** → sentence rebuilt in semantic word chunks;
- **Bopomofo** → spoken Chinese example mapped to ordered Zhuyin symbols.

These are demonstrations. Revealing the worked example is intentional because the child is being taught, not tested. The following practice step uses the normal Word Wizard and records independent evidence normally.

## Audio-first behavior

Each language teaching scene owns a deterministic audio cue:

- English word/sentence examples use English TTS;
- Bopomofo examples speak the Chinese source word;
- pre-reader wording is reduced to very short visual/audio instructions.

The existing family TTS path is reused. No microphone or speech recognition is required.

## Optional AI wording

The visual/audio lesson renders locally first and works offline.

If the protected agent server is available, Summer Quest can request a short bilingual `lesson_explanation`. The application sends:

- age band and reading level;
- exact Language curriculum skill;
- fixed target/source example;
- fixed local visual kind;
- exactly one allowed explanation strategy.

The model can rephrase only the short teaching text. It cannot replace the target, spelling, translation, sentence, Bopomofo symbols, visual interaction, lesson trigger or follow-up activity.

A strategy mismatch, malformed response, timeout or unavailable provider immediately keeps the local explanation.

## Shared Teach UI

The existing v0.4.5 Teach card is reused and expanded with shared visual components for:

```text
letter_build
picture_word
translation_pair
sentence_chunks
sound_symbols
```

Math visuals remain unchanged. The renderer chooses the appropriate deterministic scene from `step.domain`, so the Smart Practice shell stays shared rather than forking into separate Math and Language UIs.

## Learning Director v7

Plan schema moves from v6 to **v7** because Teach can now be selected for either supported learning domain.

A Teach step remains:

- inline;
- unscored;
- targetAttempts = 0;
- impossible to auto-complete from telemetry;
- completed only after explicit child acknowledgement;
- followed by the existing activity for the exact same skill.

Old v6 daily plans rebuild cleanly.

## New modules

```text
packages/learning/src/teach/
  LanguageTeachScene.ts
  LanguageTeachRequest.ts
  LanguageTeachService.ts

packages/learning/src/legacy/
  LanguageTeachBridge.ts
```

The existing `lesson_explanation` agent task is reused rather than inventing a second AI contract.

## Offline behavior

Language Teach scene/request/service and the legacy bridge are included in the service-worker app shell. The cache revision is bumped so already-installed tablets receive the new modules.

## Safety / learning authority

Language Teach does not:

- grade the child;
- record a Teach scene as a successful learning attempt;
- increase mastery;
- schedule review;
- award stars/coins;
- alter Word Wizard legacy mastery;
- choose or change AI model tiers;
- change the curriculum or placement map.

The existing Word Wizard remains authoritative for actual practice and correctness.

## Acceptance criteria

- repeated Language difficulty can insert a Teach step before Word Wizard practice;
- all five current Language skills have deterministic local teaching scenes;
- pre-reader Word Copy remains visual/audio first;
- Bopomofo teaching has a Chinese audio cue plus deterministic Zhuyin symbols;
- AI can only rephrase within the local selected strategy;
- strategy mismatch falls back locally;
- the existing shared Teach card renders both Math and Language scenes;
- Teach cannot create mastery evidence or complete from telemetry;
- offline cache includes every new language-teach module;
- existing Math Teach behavior is unchanged;
- focused and regression tests pass with no new broad-check findings.
