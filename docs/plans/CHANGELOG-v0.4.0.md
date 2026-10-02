# Summer Quest v0.4.0 — Curriculum / Skill Map

## Added

- explicit bilingual curriculum/skill catalog for Math and Language;
- exact skill IDs for addition/subtraction ranges and Word Wizard learning modes;
- age, reading-level, prerequisite and readiness metadata;
- exact Math/Vocabulary attempt classification into the new skill map;
- Learning Director plan version 2 with exact skill focus and launch constraints;
- skill-aware directed Brain Gym calculation generation;
- bounded `itemLimit` support for directed Brain rounds;
- focused `test:curriculum` gate and exact-skill bridge regression assertions;
- refreshed service-worker cache plus offline pre-cache entries for the curriculum/director modules.

## Smart Practice changes

- Smart Practice now displays and targets concrete skills instead of broad domains;
- focus/reinforce steps repeat the exact selected skill;
- language launch reuses the matching existing Word Wizard Study mode;
- Bopomofo preference is kept as its own skill lane;
- old v1 daily director plans are automatically rebuilt as v2 plans;
- progress only advances from attempts matching the exact step skill.

## Brain Gym isolation

- directed Math steps are limited to the requested Smart Practice item count;
- directed Math resume state includes the requested skill;
- Smart Practice Math no longer updates normal Daily Brain Gym completion/best/reward state;
- normal Brain Gym remains unchanged when no skill constraint is supplied.

## Guardrails / scope

- curriculum selection remains deterministic and local;
- LLMs cannot select/unlock skills or change readiness;
- historical broad telemetry is not rewritten;
- the catalog is an internal progression scaffold, not formal national-curriculum alignment;
- multiplication remains normal Brain free-play content and is not yet in the adaptive v0.4.0 skill map.
