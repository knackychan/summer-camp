# Summer Quest v0.4.0 — Curriculum / Skill Map

**Date:** 2026-09-24
**Status:** implemented prototype foundation

## Goal

Replace the Learning Director's broad `math` / `vocabulary_<mode>` targeting with an explicit, inspectable skill map. Smart Practice should be able to say *what* the learner is practising, launch an existing activity constrained to that skill, and attribute new evidence back to the same skill.

This is an **internal Summer Quest progression scaffold**, not yet a claim of alignment with a national school curriculum. Formal curriculum mapping can be layered on later without changing activity/telemetry contracts.

## v0.4.0 skill catalog

### Math

- `math.addition.within_5`
- `math.addition.within_20`
- `math.subtraction.within_20`
- `math.addition.within_100`
- `math.subtraction.within_100`
- `math.addition.within_200`

### Language

- `language.word_copy`
- `language.word_recall`
- `language.word_translation`
- `language.sentence_recall`
- `language.bopomofo`

Each catalog entry carries bilingual display labels, strand, age/readiness constraints, prerequisites, an introduction need, and the launch metadata required to reuse an existing game.

## Readiness model

The catalog separates **eligibility** from **readiness**.

- age and reading level determine which skills are reasonable candidates;
- prerequisite evidence can lock a later skill;
- an age-based prerequisite bypass prevents an older child with no Summer Quest history from being forced through every beginner item;
- locked skills are visible to the director/UI as locked but are not selected for practice.

The first version is intentionally conservative. It does not infer a diagnosis or school grade from age alone.

## Precise evidence attribution

Math and Word Wizard learning bridges now classify each real attempt into a curriculum skill before creating/persisting the learning session.

Examples:

```text
3 + 2       → math.addition.within_5
8 + 7       → math.addition.within_20
42 - 17     → math.subtraction.within_100
Word copy   → language.word_copy
Word recall → language.word_recall
```

Telemetry, tutor interventions, support outcomes and deterministic adaptation therefore carry the same exact skill ID.

Historical broad v0.3.x evidence is left intact; v0.4.0 does not rewrite old telemetry. New v2 Smart Practice plans rely on the precise skill stream.

## Learning Director v2

Daily Smart Practice plans are now version `2` and store an exact `CurriculumSkillId` for every step.

The sequence remains:

```text
warm-up → focus → reinforce → confidence
```

but a plan can now look like:

```text
Warm up   · Word recall
Focus     · + to 20
Again     · + to 20
Finish    · Word recall
```

instead of merely `Language → Math → Math → Language`.

The focus skill is still selected locally from bounded learning evidence. No LLM chooses the curriculum skill or changes readiness.

## Directed Math practice

The existing Brain Gym `calc` activity can now receive a `mathSkill` constraint. Its existing tier generators accept the optional constraint and create questions inside the requested range/operation.

Smart Practice also supplies `itemLimit`, so one two-attempt director step is a real two-question practice step rather than silently launching a full Daily Brain Gym round.

Directed Smart Practice Math is isolated from the ordinary Daily Brain Gym reward/progress path:

- no daily Brain completion is written;
- no daily Brain best is changed;
- no Daily Brain stars are awarded by the directed step;
- the child returns to Smart Practice when the bounded step finishes.

Normal/free-play Brain Gym remains unchanged when no `mathSkill` is supplied.

The service-worker cache revision is also bumped and the curriculum/director modules are included in the app shell so Smart Practice remains available after an online install/cache refresh when the tablet later goes offline.

## Directed Language practice

The existing Word Wizard Study mode continues to be reused. The director maps the selected language skill back to its existing vocabulary mode (`copy`, `recall`, `translate`, `sentences`, or `bopomofo`) without changing the child's normal preference.

Pre-reader and early-reader guards remain in place. If the child uses Bopomofo input, Smart Practice targets the Bopomofo skill rather than mixing it with Latin-alphabet recall modes.

## UI changes

No global navigation redesign was introduced. The existing Learn → Smart Practice card now shows the concrete skill label/icon and locked readiness where relevant.

Examples:

```text
➕ + to 20     Building
🧠 Word recall Strong
🔒 + to 100    Locked
```

The 3D planet concept remains outside this milestone.

## Authority boundaries

The skill map and director may:

- classify supported attempts into known skill IDs;
- read local learning evidence;
- compute readiness from explicit metadata/evidence;
- choose a short local Smart Practice sequence;
- constrain an existing activity to the chosen skill.

They may not:

- grade a child's answer;
- change correctness;
- choose an AI provider/model;
- let an LLM unlock skills;
- award/spend rewards;
- rewrite historical telemetry;
- claim formal school-curriculum equivalence.

Existing activity code remains authoritative for grading and existing tutor policies remain authoritative for support.

## Explicit limitation in v0.4.0

Multiplication remains available in normal Brain Gym hard/free-play rounds, but is **not yet part of the adaptive skill map**. The current Math learning/tutor bridge intentionally handles addition/subtraction only. Multiplication should be added only after it has the same deterministic classification, hint/scaffold and regression coverage.

## Validation

Focused gate:

```sh
npm run test:curriculum
```

This checks:

- exact Math/Vocabulary skill classification;
- age/reading-level candidate filtering;
- selected Word Wizard mode ceiling;
- constrained Brain question generation;
- Learning Director v2 exact-skill planning/progress;
- bounded directed Math integration and reward isolation.

Existing Math, Language, tutor, telemetry, AI routing/server, mobile architecture, registry and core suites remain part of the regression pass.

## Next useful slice

The skill map makes a proper **placement/mastery layer** possible. A follow-up should distinguish “no evidence yet” from “needs practice” and perform a short deterministic placement/calibration so a new child is not targeted mainly from age defaults.
