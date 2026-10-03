# Summer Quest v0.4.8 — Knowledge Lesson Runtime / Science

**Date:** 2026-09-24
**Scope:** existing Learn UI, shared learning runtime, protected agent boundary, unified learning telemetry.

## Goal

Prove that the Summer Quest tuition architecture works for a third kind of subject that is not arithmetic or spelling. v0.4.8 introduces the first **Knowledge Lesson Runtime**, starting with short Science lessons inside the existing Learn tab.

The runtime must teach a compact deterministic concept, provide a touchable visual, ask real locally graded questions, record skill evidence, and remain fully usable with no LLM connection.

## First Science lesson bank

Six fixed bilingual lessons ship in the prototype:

- Animals — body clues and animal groups;
- Plants — roots, stems and leaves;
- Human body — heart, lungs and brain;
- Matter — solid, liquid and gas;
- Weather — the water cycle;
- Space — Earth, Moon and Sun motion.

Each lesson contains:

- one science skill ID;
- one deterministic visual model;
- three approved facts;
- two deterministic multiple-choice questions;
- fixed correct answers and explanations;
- EN + Traditional Chinese copy;
- a shorter pre-reader introduction.

## Runtime flow

```text
Choose Science topic
      ↓
Explore a deterministic visual
      ↓
Tap parts to inspect their jobs
      ↓
Read/listen to approved facts
      ↓
2 locally graded questions
      ↓
Science attempt telemetry
      ↓
Complete / choose another topic
```

The Science Lab is added as a card in the existing **Learn** tab. There is no new global navigation and no second app shell.

## AI boundary

The new protected agent task is `knowledge_lesson`.

The model **does not write science facts or answers**. Instead it receives only an approved lesson bank and may return a strict plan:

```json
{
  "kind": "knowledge_lesson_plan",
  "factIds": ["approved-fact-a", "approved-fact-b"],
  "questionIds": ["approved-question-a", "approved-question-b"],
  "presentation": "visual_first",
  "encouragement": "explorer"
}
```

The client/server validate:

- 2–3 unique fact IDs;
- 2–3 unique question IDs;
- every ID belongs to the selected deterministic lesson;
- presentation is one of `visual_first`, `compare_first`, `story_first`;
- encouragement is one of `curious`, `detective`, `explorer`.

Any invented/unsupported ID rejects the remote plan and keeps the local lesson.

This means AI can adapt **order and presentation**, but cannot invent a scientific claim, question, correct answer, reward, grade or curriculum decision.

## Learning telemetry

`LearningDomain` now includes `science`.

Each Science question produces the same bounded attempt telemetry used by Math/Language:

- learner ID;
- `science.*` skill ID;
- question ID;
- correct/incorrect;
- response time;
- difficulty;
- zero hints.

No typed child answer or free-form personal data is added.

This establishes the evidence needed to later add Science mastery/review and Smart Practice integration without creating a parallel analytics system.

## Offline behavior

Science lesson definitions, runtime, store, service and legacy bridge are included in the PWA app shell under cache revision:

`summer-quest-v99-knowledge-science-runtime`

The local deterministic lesson always works offline. The optional remote lesson ordering is best-effort only.

## Acceptance criteria

- six Science topics available inside the existing Learn UI;
- each lesson has a deterministic touchable visual and exactly two graded questions;
- correctness is always local;
- Science attempts enter unified telemetry as `domain: science`;
- AI can only select/reorder approved IDs through strict schema;
- invalid AI IDs fall back locally;
- pre-reader intros remain short and visual-first;
- no stars / Daily Brain / Word Wizard mastery mutation;
- offline cache contains the Knowledge Lesson Runtime;
- existing Math, Language, placement, mastery, tutor, agent and mobile regression gates remain clean;
- broad legacy checker has no new findings versus v0.4.7.
