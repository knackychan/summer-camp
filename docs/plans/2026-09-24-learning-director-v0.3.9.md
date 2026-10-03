# Summer Quest v0.3.9 — First Learning Director / Smart Practice

**Date:** 2026-09-24
**Status:** implementation slice

## Goal

Turn the existing Math + Language learning/tutor foundations into one short personalized practice session without redesigning the Summer Quest shell.

The new Learning Director is deliberately deterministic. It reads the learner profile and compact Math/Language telemetry, then chooses a small sequence of existing activities. It does **not** ask an LLM what the child should study.

## Child flow

The current Learn tab gets a **Smart Practice** card. A daily session contains four bounded steps:

1. **Warm-up** — a familiar/stronger skill;
2. **Focus** — the skill with the higher local practice need;
3. **Reinforce** — one more short pass in the focus domain;
4. **Confidence** — finish on a familiar/stronger skill.

Each step currently targets two practice attempts. The director launches existing activities rather than duplicating them:

- Math → existing Brain Gym calculation activity;
- Language → existing Word Wizard **Study** mode.

After a directed step finishes, the child returns to the Learn tab and the Smart Practice card advances.

## Local skill model

v0.3.9 intentionally keeps the skill model small:

- Math skill: `arithmetic`;
- Language skill: the active vocabulary mode (`vocabulary_copy`, `vocabulary_recall`, etc.).

Each skill is summarized into one descriptive band:

- `new`;
- `needs_practice`;
- `building`;
- `steady`;
- `strong`.

These are UI/planning bands derived from observable telemetry. They are **not diagnoses** and do not alter the persisted learning level.

The director also computes a local practice-need value from recent correctness, independent performance, support use and trend. It is used only to order the session.

## Stability rules

A Smart Practice plan is fixed once created. New telemetry updates progress but does not reshuffle the remaining steps mid-session.

A reset/new session deliberately recomputes from the latest evidence. No-data ties are stable per learner/day rather than changing on every render.

## Pre-reader behavior

The director respects the existing presentation/reading profile. A pre-reader cannot be routed into Translate or Sentences merely because those modes exist. The initial vocabulary route is Copy, keeping the existing visual/audio-first behavior available.

## Progress attribution

A director step only counts attempts that:

- occur after that step was explicitly started;
- match the step's domain/skill/activity context.

Historical or unrelated telemetry cannot complete a later step. Directed scaffold/retry behavior inside the activity remains owned by the existing tutor runtime.

## Authority boundaries

The Learning Director may:

- read learner/profile state;
- read bounded learning telemetry;
- select among registered existing learning activities;
- choose a short practice sequence;
- track session progress.

It may **not**:

- grade answers;
- change Math/Language level;
- award/spend stars or coins;
- change curriculum access;
- select AI provider/model tier;
- override tutor interventions;
- expose provider keys;
- require network/AI availability.

The activity remains authoritative for grading. The adaptive tutor remains authoritative for support. The existing agent gateway remains optional support only.

## Existing UI integration

No new global shell was created. The existing Learn tab hosts Smart Practice. Normal Math/Word Wizard entry points continue to work exactly as before.

Directed learning can launch an existing learning activity even when the ordinary **Games** category is unavailable, because it originated from Learn, but the app-level pause and Learn access rules are still respected.

## Storage

Daily plans are local-first and stored under a versioned per-learner/per-day key:

`SQ learning director v1 / learner / day`

Only compact plan/progress state is stored. Existing telemetry privacy rules remain unchanged; raw typed child answers are not added to the telemetry stream by this slice.

## Acceptance criteria

- Learn tab exposes Smart Practice without replacing existing navigation;
- four-step deterministic plan is generated from Math + Language evidence;
- weak Math can become focus while stronger Language is warm-up/confidence, and vice versa;
- stable no-data fallback exists;
- pre-readers are not routed into inappropriate reading modes;
- existing Brain Math and Word Wizard Study are reused;
- only attempts after step start advance that step;
- unrelated attempts cannot advance a step;
- returning from a directed activity goes back to Learn;
- normal non-director activity behavior is preserved;
- the complete flow works offline;
- focused and existing regression gates pass.
