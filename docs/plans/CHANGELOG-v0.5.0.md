# Summer Quest v0.5.0 — Geography / Map Explorer Knowledge Runtime

## Added

- `Map Explorer / 地圖探險家` in the existing Learn tab;
- six deterministic bilingual Geography lessons;
- Geography visual kinds for compass, map, land/water, globe and environment concepts;
- shared `KnowledgeLessonCatalog` domain contract for Science + Geography;
- `geography` in unified learning telemetry / learner-domain typing;
- Geography browser bridge methods through the existing `KnowledgeLessonBridge`;
- domain-scoped Knowledge snapshots/resets so Science and Geography cannot consume each other's active session;
- focused `test:geography` regression gate;
- Geography coverage in the complete `test:knowledge` gate;
- Geography/shared Knowledge modules in the PWA app shell.

## Refactored

- Knowledge runtime/session snapshot types are now domain-neutral instead of Science-specific;
- Knowledge lesson requests use the selected lesson domain rather than hard-coded `science`;
- protected `knowledge_lesson` prompt now treats both Science and Geography catalog content as the complete factual boundary;
- Learn lesson rendering is shared through one domain-configured renderer rather than copied for Map Explorer;
- local lesson presentation selection understands Geography visual kinds.

## Preserved

- existing Science Lab public methods and child behavior;
- v0.4.9 `scienceMode` compatibility for Smart Practice Explore/Check launches;
- Science Learning Director / Mastery / spaced review behavior;
- local deterministic grading;
- manual LLM profile routing;
- Math + Language placement scope.

## Deferred

- Geography curriculum registration in Learning Director;
- Geography Mastery / Review scheduling;
- Geography Quick Placement;
- richer draggable/zoomable geographic maps or globe interaction;
- open-ended country/current-affairs generation.

## Offline

- service-worker revision: `summer-quest-v101-geography-map-explorer`.

## Validation

- shared Knowledge Lesson Runtime tests pass;
- Geography Knowledge Runtime tests pass;
- Science Smart Practice + mastery tests pass;
- `test:knowledge`, `test:geography`, `test:curriculum`, `test:telemetry`, `test:teach`, `test:agent-routing`, `test:agent-server`, `test:mobile`, AI evaluation and adaptive-tutor regressions pass;
- the broad checker reports 131 inherited findings versus 132 on the raw v0.4.9 archive, with **0 new findings**; the one removed finding was the baseline archive not being a Git working tree.
