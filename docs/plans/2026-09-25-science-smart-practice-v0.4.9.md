# Summer Quest v0.4.9 — Science Smart Practice + Mastery / Review

**Date:** 2026-09-25  
**Scope:** existing Learn UI, Science Lab, shared curriculum skill map, Learning Director, telemetry and Mastery/Review scheduler.

## Goal

v0.4.8 proved that Summer Quest can run a third learning domain through a local-first structured Knowledge Lesson Runtime. v0.4.9 completes the next important step: Science must participate in the same longitudinal adaptive loop as Math and Language instead of remaining an isolated lesson launcher.

The release therefore connects the six deterministic Science concepts to the shared Curriculum Skill Map, Learning Director, Smart Practice progress tracking, Mastery state and spaced review.

## Product rules

1. **Reuse the existing Science Lab.** Smart Practice does not create another Science quiz or lesson engine.
2. **Science grading remains local.** Correct answers come only from the deterministic lesson catalog.
3. **Mastery comes from evidence.** Science uses the same independent-attempt evidence and Mastery/Review scheduler as the other domains.
4. **Explore and review are different jobs.** Active learning may show approved facts/visuals first; spaced review should measure recall directly.
5. **No duplicated Science lesson in one plan.** A two-question Science lesson is one bounded Smart Practice step, not both Focus and Reinforce.
6. **AI remains presentation-only.** It may reorder only approved facts/questions in Explore mode and never controls skill choice, grading, mastery or review timing.
7. **Offline remains complete.** Directed Science, Science checks and review scheduling work without the LAN agent server.

## Shared Science skills

The existing six v0.4.8 lessons now have director-eligible curriculum definitions:

```text
science.animals.groups          → Animals
science.plants.parts            → Plants
science.body.organ_jobs         → Human body
science.matter.states           → Matter
science.weather.water_cycle     → Weather / water cycle
science.space.earth_moon_sun    → Earth, Moon & Sun
```

Each definition points to the existing deterministic Science lesson rather than a new activity.

## Smart Practice behavior

### Active / new / Building concept

```text
Smart Practice
      ↓
Science focus
      ↓
Explore mode
      ↓
approved visual + facts
      ↓
2 local questions
      ↓
shared telemetry
```

The optional protected `knowledge_lesson` model may reorder the approved facts/questions during Explore mode, subject to the existing ID allow-list validation.

### Secure / Review due concept

```text
Spaced review
      ↓
Science Check mode
      ↓
question 1
      ↓
question 2
      ↓
independent evidence
```

Check mode starts directly at the deterministic questions and marks adaptation as already attempted so the model cannot resequence the measurement.

## Bounded Science sessions

Math and Language Smart Practice retain the existing four-step structure.

A Science-focused plan uses three steps:

```text
review / warm-up
      ↓
Science focus
      ↓
confidence finish
```

This avoids presenting the exact same two-question Science lesson twice merely to satisfy a generic Focus + Reinforce shape.

## Directed-session context

`KnowledgeLessonSession` now records:

- `mode: explore | check`;
- `flow: free | director`;
- optional `directorSessionId`;
- optional `directorStepId`.

That context allows the existing UI to return coherently to Smart Practice and allows refresh/progress logic to attribute only the real Science attempts that occurred after the directed step started.

## Mastery / review integration

Science uses the existing MasteryReviewScheduler unchanged:

```text
Starting → Building → Secure → Review due
```

Only independent Science question attempts can establish Secure or become a new review anchor. The existing 1 / 3 / 7 / 14 / 30-day bounded review spacing applies without introducing a Science-specific mastery score.

Science evidence can therefore:

- become a Smart Practice focus when weak;
- become Secure after sustained independent success;
- return later as Review due;
- move back to Building if later independent evidence weakens.

## Existing UI behavior

No navigation redesign is introduced.

When Smart Practice launches Science:

- the existing Science Lab scrolls into view;
- other Science topics are disabled while the directed step is active;
- completion offers **Back to Smart Practice / 回到聰明練習**;
- returning clears the active Science lesson and rerenders the same Smart Practice plan;
- free Science Lab use remains unchanged.

## Learning Director schema

Learning Director plan schema moves to **v9** so older stored v8 daily plans rebuild cleanly with the new Science launch contract.

A Science launch can include:

```ts
{
  gameId: "science",
  lessonId: "science-matter-states",
  scienceMode: "explore" | "check",
  targetAttempts: 2
}
```

## Placement

Quick Placement remains intentionally limited to Math + Language in v0.4.9. Science is introduced through normal learning evidence and the Director rather than adding another assessment flow in this release.

## Offline behavior

The service-worker cache revision becomes:

```text
summer-quest-v100-science-smart-practice
```

All Science runtime/director/mastery modules remain part of the local app shell.

## Acceptance criteria

- all six Science skills are director eligible;
- weak Science evidence can become Smart Practice focus;
- a Science focus launches the existing Science lesson in Explore mode;
- a Science-focused plan does not duplicate the same Science lesson as Reinforce;
- exactly two real Science attempts can complete the directed Science step;
- a Secure Science skill can become Review due through the existing scheduler;
- Science review launches directly in Check mode;
- Check mode cannot request AI lesson resequencing;
- Science mastery uses independent telemetry only;
- existing free Science use remains unchanged;
- Math/Language placement remains unchanged;
- offline cache includes the updated runtime;
- focused and regression tests pass with no new broad-check findings.
