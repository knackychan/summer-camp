# Summer Quest v0.4.5 — Teach / Explain Step

**Date:** 2026-09-24
**Scope:** existing Learn → Smart Practice UI, Learning Director, Math curriculum, optional protected agent wording.

## Goal

Summer Quest already knows how to choose a skill, grade practice, diagnose several observable mistakes, provide hints/scaffolds, schedule reviews and build a short Smart Practice session. The missing tutor behavior is the ability to briefly **teach a concept before asking another question** when the child has repeated evidence of difficulty.

v0.4.5 adds the first bounded Teach / Explain step without creating a new math game or letting the LLM control pedagogy.

## Product flow

When the locally selected focus Math skill has enough evidence of repeated struggle, the normal four-step Smart Practice plan changes from:

```text
warm-up / review → focus → reinforce → confidence
```

to:

```text
warm-up / review → teach → focus practice → confidence
```

The teach step is an inline visual scene inside the existing Smart Practice card. It is not a scored exercise.

## Deterministic trigger

A Teach step is inserted only when all of these are true:

- the focus is a Math curriculum skill;
- at least three real attempts exist for that skill;
- the skill is currently ready, not locked;
- the skill is not Secure / Review due;
- local evidence shows `needs_practice`, `level_down`, or repeated `support` intervention evidence.

Placement alone never triggers a Teach step. New learners still begin with real practice unless evidence demonstrates a need for teaching.

## Visual teaching scenes

Each supported Math skill has one deterministic teaching scene owned by Summer Quest:

- Addition to 5 → two object groups joining;
- Addition to 20 / 100 / 200 → forward number-line jump;
- Subtraction to 20 / 100 → backward number-line jump;
- Number comparison → two quantity bars;
- Number bonds → known + missing = whole;
- × 2,5,10 → equal groups;
- × 2–9 → array.

The application owns the numbers, visual strategy, worked example and correct answer. The LLM cannot replace these.

## Optional AI explanation

The visual scene renders **locally first** and is fully usable offline.

If the protected agent server is available, Summer Quest may then request a short bilingual rephrasing using the new `lesson_explanation` task. The request includes:

- age band;
- reading level;
- exact curriculum skill;
- fixed example operands / answer;
- one fixed allowed visual strategy.

The response must be:

```json
{
  "kind": "lesson_explanation",
  "message": "...",
  "messageZh": "...",
  "strategy": "number_line",
  "emotion": "encouraging"
}
```

If the model changes the visual strategy, fails schema validation, times out, or is unavailable, the local explanation remains on screen unchanged.

This means AI may adapt **wording only**. It cannot choose whether teaching occurs, which concept is taught, which example is used, how the visual works, what the answer is, or what comes next.

## Pre-reader behavior

Teach scenes are visual-first. Local fallback wording is reduced to very short prompts for pre-readers, and the existing TTS control can read the explanation aloud when family TTS is enabled.

No reading is required to understand the core visual representation.

## Director lifecycle

Learning Director schema moves from v5 to **v6**.

Teach steps:

- have no game launch;
- have no target-attempt count;
- never complete from telemetry;
- require explicit child acknowledgement (`Got it — practice`);
- then advance to a normal bounded practice step for the same skill.

Old v5 daily plans rebuild cleanly. Started v6 plans remain stable as before.

## Safety / learning authority

Teach scenes do not:

- grade answers;
- create mastery evidence;
- affect spaced-review intervals;
- award stars or coins;
- alter Daily Brain state;
- change learner level;
- unlock curriculum;
- select a model/provider tier;
- create a second mastery database.

The following remain authoritative:

- existing activities for grading;
- telemetry for learning evidence;
- local tutor policy for interventions;
- local Learning Director for session composition;
- local mastery/review scheduler for longitudinal status.

## New modules

```text
packages/learning/src/teach/
  MathTeachScene.ts
  MathTeachRequest.ts
  MathTeachService.ts

packages/learning/src/legacy/
  MathTeachBridge.ts
```

The agent protocol adds a schema-constrained `lesson_explanation` response type.

## Offline behavior

The new teach modules and bridge are pre-cached in the service-worker app shell. The local scene is painted before any optional remote wording request, so slow/unavailable AI never blocks the teaching interaction.

## Acceptance criteria

- repeated Math difficulty can insert one Teach step before focus practice;
- no Teach step is inserted from age/placement alone;
- deterministic visual scene exists for every current adaptive Math skill;
- local visual renders without agent connectivity;
- optional AI can only rephrase within the fixed visual strategy;
- model strategy mismatch falls back locally;
- Teach step cannot auto-complete from practice telemetry;
- child acknowledgement advances Teach → practice;
- no Teach interaction creates graded mastery evidence;
- offline cache contains all new modules;
- existing Math/Language/placement/mastery/director regressions remain clean;
- broad legacy check introduces no new findings.
