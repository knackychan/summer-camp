# Summer Quest v0.4.4 — Strand-aware Placement Map

## Added

- independent Math placement tracks for addition/subtraction, number sense, number bonds and multiplication;
- age-aware strand selection;
- two-item anchor + one-item maximum confirmation probe policy;
- early stop on mixed anchor evidence;
- history-derived strand placement from existing independent telemetry;
- placement result source metadata (`quick_check` vs `history`);
- bilingual strand metadata in placement results;
- multi-card Math starting map in the existing Learn → Quick skill check UI;
- focused `test:strand-placement` script;
- offline cache revision `summer-quest-v95-strand-aware-placement`.

## Changed

- placement state schema moves from v1 to v2 and local placement storage uses a v2 namespace;
- explicit Re-check deliberately ignores history shortcuts and samples the complete age-eligible map;
- Learning Director placement logic is now strand-local rather than applying one Math ladder to every Math skill;
- Learning Director plan schema moves from v4 to v5 so old unstarted plans rebuild cleanly;
- Quick skill check status now reports placement areas and completed results distinguish quick-check evidence from recent independent practice.

## Safeguards

- placement still reuses the existing Brain Math / Word Wizard activities;
- placement items remain unscored, reward-free and AI-free;
- no placement result can grade an answer, change stars, select an LLM/model or override real later independent evidence;
- started Smart Practice plans remain stable.

## Validation

- strand-aware placement focused gate passes;
- curriculum, mastery/review and Learning Director gates pass;
- expanded Math and adaptive tutor gates pass;
- learning telemetry / tutor-policy / tutor-experiment gates pass;
- AI evaluation / agent routing / local agent server gates pass;
- mobile architecture and TypeScript checks pass;
- Brain host remains 21/21;
- Registry remains 10/10;
- Core remains 75/75;
- full legacy checker remains at the inherited v0.4.3 finding set, with no new findings.
