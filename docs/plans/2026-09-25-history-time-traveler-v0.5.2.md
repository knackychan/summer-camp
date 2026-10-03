# Summer Quest v0.5.2 — History / Time Traveler Knowledge Runtime

**Date:** 2026-09-25  
**Scope:** existing Learn UI, shared Knowledge Lesson Runtime, unified learning telemetry, protected `knowledge_lesson` agent boundary.

## Goal

v0.5.0 proved that the Knowledge Lesson Runtime could expand from Science to Geography without duplicating the lesson engine. v0.5.2 extends the same architecture to a third knowledge subject: **History**.

The release adds a child-facing **Time Traveler** card inside the existing Learn tab. History must remain deterministic and evidence-grounded: the app owns the approved facts, questions, correct answers and explanations; optional AI may only sequence content already present in the local lesson definition.

History intentionally starts as a **free evidence domain** in this release. Its attempts enter unified telemetry, but History is not yet registered in the Curriculum Skill Map or Learning Director. That adaptive integration is reserved for a later slice after the History runtime itself is validated.

## Product rules

1. **Reuse the Knowledge Lesson Runtime.** No second History quiz engine, store or grading path.
2. **History facts stay curated.** Every child-facing historical claim comes from the deterministic lesson bank.
3. **AI does not author history.** It may reorder only approved fact/question IDs.
4. **Correctness is local.** The LLM never supplies or changes the correct answer.
5. **History evidence is real telemetry.** Each question writes a normal `attempt` event under `domain: history`.
6. **No premature adaptive behavior.** History does not enter Smart Practice, Mastery or spaced review in v0.5.2.
7. **Pre-reader access is visual.** Age 3 can explore Past/Present and Before/After without reading.
8. **Offline remains complete.** All six History lessons work without the LAN agent server.

## First History lesson bank

Six fixed bilingual lessons ship in the prototype:

```text
history.time.past_present          → Past and present
history.time.before_after          → Before and after
history.sources.clues              → History detectives / sources
history.ancient.egypt_clues        → Ancient Egypt clues
history.ancient.china_clues        → Ancient China clues
history.change.communication       → Messages through time
```

Each lesson contains:

- one concrete History skill ID;
- one deterministic visual model;
- three approved facts;
- exactly two deterministic multiple-choice questions;
- fixed correct answers and explanations;
- English + Traditional Chinese copy;
- a short pre-reader introduction.

## Runtime flow

```text
Choose Time Traveler topic
        ↓
Explore approved visual clues
        ↓
Tap clues for deterministic notes
        ↓
Read/listen to approved facts
        ↓
2 locally graded questions
        ↓
History attempt telemetry
        ↓
Complete / choose another topic
```

The History card uses the same generic Knowledge renderer as Science Lab and Map Explorer.

## Visual families

History extends the shared visual-kind vocabulary with:

- `past_present`;
- `sequence`;
- `sources`;
- `timeline`;
- `civilization`;
- `change`.

These are data-level presentation hints. They do not create arbitrary HTML or model-generated UI.

## AI boundary

The protected task remains `knowledge_lesson`.

The request includes only:

- domain / lesson / topic metadata;
- allowed fact IDs;
- allowed question IDs;
- the already-approved fact and question text;
- reading level and age band.

The model may return only:

```json
{
  "kind": "knowledge_lesson_plan",
  "factIds": ["approved-id-a", "approved-id-b"],
  "questionIds": ["approved-q-a", "approved-q-b"],
  "presentation": "visual_first",
  "encouragement": "detective"
}
```

The client/server reject unsupported IDs. The system prompt now explicitly forbids invented **historical claims** in addition to scientific/geographic claims.

## Unified learner / telemetry model

`LearningDomain` now includes:

```text
history
```

Learner profiles normalize a `history` level so old stored profiles remain readable. History question attempts use the existing telemetry event schema:

- learner ID;
- `domain: history`;
- concrete `history.*` skill ID;
- question ID;
- correct / incorrect;
- response time;
- difficulty;
- zero hints.

No new child free-text or personal data is collected.

## Adaptive boundary for v0.5.2

History is deliberately **not** added to:

- `SkillCatalog` director-eligible curriculum definitions;
- Learning Director domain selection;
- Mastery / Review scheduling;
- Quick Placement.

This mirrors the earlier Science and Geography rollout pattern: first prove the subject runtime and evidence path, then integrate adaptive selection in a later release.

## Existing UI

A new Learn card appears after Map Explorer:

```text
⏳ Time Traveler / 時光旅行家
```

It uses the same shared rendering functions for:

- topic chips;
- visual clue buttons;
- bilingual intro/facts;
- speech playback;
- two-question flow;
- local feedback;
- completion / reset.

The generic config now owns the question button icon, removing one remaining Science-vs-Geography presentation conditional.

## Offline

The app-shell cache revision becomes:

```text
summer-quest-v103-history-time-traveler
```

The cache includes `HistoryLessonCatalog.js` alongside the existing Knowledge runtime modules.

## Acceptance criteria

- six deterministic bilingual History lessons are available in Learn;
- age 3 can access Past/Present and Before/After;
- every lesson has exactly three approved facts and two locally graded questions;
- History uses the shared Knowledge store/runtime/service/bridge;
- History sessions do not leak into Science or Geography cards;
- resetting another Knowledge domain cannot delete an active History session;
- History attempts enter unified telemetry as `domain: history`;
- the optional model can only reorder approved History IDs;
- invented History IDs fall back to the local plan;
- History is not yet director/mastery eligible;
- the History runtime is fully offline-capable;
- existing Science and Geography Knowledge/Smart Practice gates remain clean;
- mobile, agent, telemetry, curriculum and legacy regression gates add no new findings.
