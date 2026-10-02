# Summer Quest v0.5.3 — History Smart Practice + Mastery / Review

**Date:** 2026-09-25  
**Scope:** existing Learn UI, Time Traveler, shared Curriculum Skill Map, Learning Director, unified telemetry and Mastery/Review scheduler.

## Goal

v0.5.2 established History as the third shared Knowledge Lesson Runtime domain and began collecting locally graded `history.*` evidence. v0.5.3 promotes that evidence into the same deterministic adaptive loop already used by Science and Geography.

The release does **not** create a second History game. It registers the six existing Time Traveler lessons in the shared curriculum catalog, lets the Learning Director select them, and reuses the existing Knowledge Lesson Runtime for Explore and Check sessions.

## Product rules

1. **Reuse Time Traveler.** Smart Practice launches the existing History lesson, never a duplicate quiz.
2. **Historical content stays deterministic.** Facts, questions, correct answers and explanations continue to come from the curated local lesson bank.
3. **Mastery requires independent evidence.** Only real History question attempts enter mastery/review calculations.
4. **Explore and Check remain distinct.** New/Building History concepts show the approved model/facts first; spaced review goes directly to questions.
5. **No duplicated History focus.** A two-question History lesson is one bounded Knowledge step, not separate Focus + Reinforce copies.
6. **AI remains presentation-only.** The protected model may reorder only approved facts/questions during Explore mode. It cannot choose a skill, grade, change mastery or alter review timing.
7. **Quick Placement remains Math + Language only.** History enters adaptively through ordinary learning evidence.
8. **Offline remains complete.** History practice, grading, mastery and review work without the LAN agent server.

## Shared History skills

```text
history.time.past_present        → Past and present
history.time.before_after        → Before and after
history.sources.clues            → History detectives
history.ancient.egypt_clues      → Ancient Egypt clues
history.ancient.china_clues      → Ancient China clues
history.change.communication     → Messages through time
```

All six definitions point to the existing deterministic Time Traveler lessons.

## Smart Practice behavior

### New / Building concept

```text
Smart Practice
      ↓
History focus
      ↓
Explore mode
      ↓
approved time/evidence model + facts
      ↓
2 locally graded questions
      ↓
shared telemetry
```

### Secure / Review due concept

```text
Spaced review
      ↓
History Check mode
      ↓
question 1
      ↓
question 2
      ↓
independent evidence
```

Check mode begins directly at the questions and has `adaptationAttempted: true`, preventing model resequencing during the measurement.

## Bounded Knowledge sessions

History uses the same three-step Knowledge-focused plan shape as Science and Geography:

```text
review / warm-up
      ↓
History focus
      ↓
confidence finish
```

This prevents the exact same two-question lesson appearing twice to satisfy a generic Focus + Reinforce shape.

## Learning Director v11

The Learning Director domain now includes History and plan schema moves from **v10 to v11**. Older v10 daily plans rebuild locally.

The generic Knowledge launch remains:

```ts
{
  gameId: "science" | "geography" | "history",
  lessonId: string,
  knowledgeMode: "explore" | "check",
  targetAttempts: 2
}
```

The legacy `scienceMode` alias remains supported only for older persisted Science plans. History does not introduce a History-specific mode field.

## Mastery / review integration

History uses the existing `MasteryReviewScheduler` unchanged:

```text
Starting → Building → Secure → Review due
```

Only independent History attempts can establish Secure or move the review anchor. The existing bounded 1 / 3 / 7 / 14 / 30-day review spacing applies without a History-specific mastery score.

History evidence can therefore:

- become the Smart Practice focus when weak;
- become Secure after sustained independent success;
- return as Review due;
- move back toward Building if later independent evidence weakens.

## Existing UI behavior

When Smart Practice launches History:

- the existing Time Traveler card is used;
- non-active History topics are disabled while the directed step is running;
- completion offers **Back to Smart Practice / 回到聰明練習**;
- returning resets only the directed History session and rerenders the same Smart Practice plan;
- free Time Traveler use remains unchanged outside Smart Practice.

## Placement

Quick Placement remains intentionally limited to Math + Language in v0.5.3. History is introduced into the adaptive loop through normal locally graded evidence.

## Offline

Service-worker cache revision:

```text
summer-quest-v104-history-smart-practice
```

All History runtime/director/mastery modules remain part of the local app shell.

## Acceptance criteria

- all six History skills are director eligible;
- weak History evidence can become Smart Practice focus;
- History focus launches existing Time Traveler in Explore mode;
- a History-focused plan does not duplicate the same lesson as Reinforce;
- exactly two real History attempts complete the directed History step;
- Secure History can become Review due through the existing scheduler;
- History review launches directly in Check mode;
- Check mode cannot request AI lesson resequencing;
- History mastery uses independent telemetry only;
- free Time Traveler behavior remains unchanged;
- Quick Placement remains Math + Language only;
- old v10 plans rebuild under v11;
- offline cache uses the updated runtime;
- Science and Geography adaptive regressions remain clean;
- broad legacy checker adds no new findings.
