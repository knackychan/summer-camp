# Summer Quest v0.5.1 — Geography Smart Practice + Mastery / Review

**Date:** 2026-09-25  
**Baseline:** v0.5.0 Geography / Map Explorer Knowledge Runtime

## Goal

v0.5.0 proved that Geography can use the shared local-first Knowledge Lesson Runtime. v0.5.1 connects those same six deterministic Map Explorer lessons to the longitudinal adaptive loop already used by Math, Language and Science.

No second Geography quiz engine is created. Smart Practice launches the existing Map Explorer lesson by ID, and all grading continues to come from the deterministic Geography catalog.

## Shared Geography skills

```text
geography.map.cardinal_directions       → Compass directions
geography.map.symbols                   → Map symbols and keys
geography.land_water.features           → Land and water features
geography.world.continents_oceans       → Continents and oceans
geography.world.equator_hemispheres     → Equator and hemispheres
geography.environment.climate_clues     → Environment and climate clues
```

All six are director-eligible. Age filtering remains aligned with the v0.5.0 lesson bank, including the three visual age-3 concepts.

## Smart Practice behavior

### New / active / Building Geography

```text
Smart Practice
      ↓
Geography focus
      ↓
Map Explorer · Explore mode
      ↓
approved visual + approved facts
      ↓
2 deterministic questions
      ↓
shared telemetry
```

The optional protected `knowledge_lesson` model may reorder only approved facts/questions during Explore mode.

### Secure / Review due Geography

```text
Spaced review
      ↓
Map Explorer · Check mode
      ↓
question 1
      ↓
question 2
      ↓
independent mastery evidence
```

Check mode starts directly at the questions and marks adaptation as already attempted, so AI cannot resequence a review measurement.

## Bounded Knowledge sessions

Science and Geography now share the same three-step Knowledge focus shape:

```text
review / warm-up
      ↓
Knowledge focus
      ↓
confidence finish
```

This prevents a fixed two-question lesson from being repeated as both Focus and Reinforce merely to satisfy the generic four-step Math/Language plan.

## Learning Director v10

The Director domain now includes Geography and plan schema moves from **v9 to v10**. Older v9 daily plans rebuild locally.

Knowledge launches use the shared contract:

```ts
{
  gameId: "science" | "geography",
  lessonId: string,
  knowledgeMode: "explore" | "check",
  targetAttempts: 2
}
```

For compatibility, Science launches may still expose the old `scienceMode` alias while v9 state ages out. The UI itself uses the shared `knowledgeMode` path for both subjects.

## Mastery and spaced review

Geography uses the existing MasteryReviewScheduler unchanged:

```text
Starting → Building → Secure → Review due
```

Only independent Map Explorer question attempts can establish Secure or move the review anchor. The existing bounded 1 / 3 / 7 / 14 / 30-day review intervals remain authoritative.

Geography evidence can therefore:

- become the Smart Practice focus when weak;
- become Secure after sustained independent success;
- return later as Review due;
- fall back to Building if later evidence weakens.

## Existing UI

No new navigation or duplicate lesson surface is introduced.

When Smart Practice launches Geography:

- the existing Map Explorer card opens directly;
- only the directed lesson remains selectable while the step is active;
- Explore mode shows map/fact presentation first;
- Check mode starts at question 1;
- completion offers **Back to Smart Practice / 回到聰明練習**;
- free Map Explorer use remains unchanged outside directed practice.

The Science-only Smart Practice launcher was replaced by a shared Knowledge launcher that dispatches through the existing `KNOWLEDGE_LABS` configuration.

## Placement

Quick Placement remains intentionally limited to Math + Language. Science and Geography enter the model through ordinary learning evidence and spaced review rather than adding more startup assessment tracks.

## Offline

Cache revision:

```text
summer-quest-v102-geography-smart-practice
```

All curriculum, director, mastery and Knowledge Runtime modules remain part of the local app shell.

## Acceptance criteria

- all six Geography skills are director eligible;
- weak Geography evidence can become Smart Practice focus;
- Geography Focus launches the existing Map Explorer in Explore mode;
- Geography-focused plans use three bounded steps and do not duplicate the lesson;
- exactly two Geography attempts can complete a directed Geography step;
- Secure Geography can become Review due through the shared scheduler;
- Geography review launches in Check mode;
- Check mode cannot request AI lesson resequencing;
- Geography mastery uses independent telemetry only;
- pre-reader Geography remains available where the catalog allows it;
- Science Smart Practice remains unchanged and backward-compatible;
- Quick Placement remains Math + Language only;
- offline cache revision is updated;
- focused and broad regression gates pass with no new broad-check findings.
