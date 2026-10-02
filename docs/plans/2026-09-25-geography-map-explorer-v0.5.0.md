# Summer Quest v0.5.0 — Geography / Map Explorer Knowledge Runtime

**Date:** 2026-09-25
**Baseline:** v0.4.9 Science Smart Practice + Mastery / Review
**Scope:** shared Knowledge Lesson Runtime, Learn UI, protected `knowledge_lesson` task, unified learning telemetry, offline app shell.

## Goal

v0.4.8 proved a local-first deterministic Knowledge Lesson Runtime with Science, and v0.4.9 connected Science to longitudinal adaptive practice. v0.5.0 now proves the Knowledge runtime itself is genuinely reusable by adding a structurally different knowledge subject: **Geography**.

The release must not create a parallel Geography engine. Map Explorer reuses the same session lifecycle, deterministic grading, persistence, telemetry, AI allow-list boundary and tablet lesson UI primitives already used by Science.

## Product rules

1. **One Knowledge engine.** Science and Geography share `KnowledgeLessonRuntime`, `KnowledgeLessonService`, `KnowledgeLessonStore` and `KnowledgeLessonBridge`.
2. **Local truth owns facts and answers.** Every Geography fact, question, option, correct answer and explanation lives in the deterministic catalog.
3. **AI is presentation-only.** The protected `knowledge_lesson` task may choose/reorder only supplied approved fact/question IDs.
4. **No open-web Geography generation.** The child-facing lesson does not ask a model to invent places, map claims, climate claims or answers.
5. **Unified evidence.** Real Geography question attempts use the existing telemetry stream with `domain: geography`.
6. **Age-aware and bilingual.** EN + Traditional Chinese copy is deterministic; younger children see only age-eligible topics and shorter introductions.
7. **Offline is complete.** The entire Map Explorer lesson bank, runtime and UI work with no agent server.
8. **Do not prematurely add adaptive Geography.** v0.5.0 gathers trustworthy evidence first. Learning Director / Mastery / spaced review integration is a later slice, mirroring the Science v0.4.8 → v0.4.9 progression.

## Shared Knowledge catalog

A new domain-neutral Knowledge catalog defines the common lesson contract:

```text
KnowledgeLessonDefinition
  domain: science | geography
  topic
  skill
  age / difficulty
  bilingual intro
  deterministic visual
  approved facts
  deterministic questions + answers
```

The shared catalog dispatches to the existing Science bank or the new Geography bank. Existing `ScienceLessonCatalog` exports remain available for compatibility.

## First Geography lesson bank

Six deterministic lessons ship:

```text
geography.map.cardinal_directions       → Compass directions
geography.map.symbols                   → Read a map key
geography.land_water.features           → Land and water features
geography.world.continents_oceans       → Continents and oceans
geography.world.equator_hemispheres     → Equator and hemispheres
geography.environment.climate_clues     → Environment clues
```

The visual vocabulary adds Geography-oriented scene kinds such as `compass`, `map`, `land_water`, `globe` and `environment` while keeping the same touch/inspect lesson component.

## Lesson flow

```text
Choose a Map Explorer topic
        ↓
Explore deterministic visual clues
        ↓
Tap parts/symbols to inspect them
        ↓
Read/listen to 2–3 approved facts
        ↓
Answer exactly 2 local questions
        ↓
Record geography.* telemetry
        ↓
Complete / choose another topic
```

## AI boundary

`knowledge_lesson` becomes explicitly domain-neutral.

The request includes:

- selected domain;
- lesson/topic ID;
- visual kind;
- approved fact IDs + their fixed text;
- approved question IDs + their fixed prompts.

The model can return only:

```json
{
  "kind": "knowledge_lesson_plan",
  "factIds": ["approved-a", "approved-b"],
  "questionIds": ["approved-q1", "approved-q2"],
  "presentation": "visual_first",
  "encouragement": "explorer"
}
```

Any unsupported Geography ID is rejected and the local ordering remains active. The model cannot supply a factual statement, map answer, grade, skill decision, reward or mastery state.

## Domain isolation

Science and Geography share one active Knowledge session store per learner, but bridge calls are domain-scoped. A Geography session cannot appear in the Science Lab, and Science reset/snapshot calls cannot accidentally consume or delete a Geography session (and vice versa).

This keeps the current lightweight session model while making the UI safe for multiple knowledge cards.

## Learn UI

The existing **Learn** tab gains a second card:

- `🔬 Science Lab` — unchanged behavior;
- `🗺️ Map Explorer` — Geography topics through the same visual/fact/question renderer.

The renderer is factorized around a domain configuration instead of copying the full Science interaction implementation. Shared visual, fact, option, feedback and completion primitives stay in one code path.

## Telemetry

`LearningDomain` now includes `geography`.

Every real answer records:

- learner ID;
- `domain: geography`;
- concrete `geography.*` skill;
- question ID;
- correct/incorrect;
- response time;
- difficulty;
- zero hints.

This is the evidence base for a later Geography mastery/review + Smart Practice integration.

## Backward compatibility

- Existing Science public bridge methods remain unchanged.
- `scienceMode` remains supported as the v0.4.9 Smart Practice compatibility alias.
- Science Learning Director schema remains v9 in this release.
- Existing Science Explore/Check behavior is unchanged.
- Math / Language placement remains unchanged.

## Offline

Service-worker cache revision:

```text
summer-quest-v101-geography-map-explorer
```

The app shell now includes the shared Knowledge catalog and Geography catalog in addition to the existing Science runtime modules.

## Acceptance criteria

- six age-aware Geography topics appear in Map Explorer;
- each Geography lesson contains three approved facts and exactly two deterministic questions;
- Geography correctness is entirely local;
- Geography attempts record as `domain: geography` with concrete `geography.*` skills;
- Science and Geography use one generic Knowledge runtime/service/store/bridge;
- Science behavior and Science Smart Practice regressions remain clean;
- a Geography session cannot leak into the Science card;
- AI requests identify the Geography domain and remain ID allow-list constrained;
- invented Geography IDs fall back to the local plan;
- Map Explorer works without an agent server;
- the new Knowledge/Geography modules are in the offline app shell;
- focused Knowledge/Geography/Science regressions pass;
- broader curriculum, telemetry, agent, mobile and core regression gates have no new findings.

## Validation result

The focused Knowledge/Geography/Science gates, TypeScript mobile + agent checks, curriculum/director, telemetry, Teach, agent routing/server, mobile architecture, AI evaluation, adaptive tutor, Core, Registry and Brain Host regressions pass. The broad legacy checker still reports inherited repository issues (missing precached assets and existing Brain CSS token literals), but v0.5.0 introduces **0 new broad-check findings** relative to the v0.4.9 archive.
