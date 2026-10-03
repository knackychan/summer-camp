# Summer Quest v0.4.3 — Expanded Math Skills + Multiplication Tutor

## Added

- six new curriculum skills covering number comparison, number bonds and multiplication;
- directed Brain Calculation generation for each new skill;
- exact directed-skill attribution in the Brain learning bridge;
- multiplication-aware local parsing and answer recomputation;
- deterministic mistake labels for skip-counting slips, comparison reversals and number-bond slips;
- multiplication/comparison/number-bond adaptive tutor strategies;
- equal-groups, array, skip-count, comparison and missing-part tutor visuals;
- unscored easier scaffolds for the new Math operations;
- operation-aware bilingual local hint fallbacks;
- multiplication case in the AI Lab evaluation suite;
- focused `test:expanded-math` script;
- offline cache revision `summer-quest-v94-expanded-math-skills`.

## Behavior

- Smart Practice reuses the existing Brain Gym Calculation game for all new Math skills;
- directed skill constraints do not alter normal Brain Gym/free-play generation;
- Daily Brain reward/progress isolation remains intact for Smart Practice;
- the LLM cannot grade, choose the intervention, select a scaffold, modify mastery/review state, or unlock curriculum;
- remote hint strategies outside the deterministic local allow-list fall back locally.

## Validation

- expanded Math focused gate passes;
- curriculum, placement, mastery and Learning Director tests pass;
- adaptive Math + Language tests pass;
- learning telemetry / tutor policy / tutor experiment tests pass;
- AI evaluation / agent routing / local agent server tests pass;
- mobile architecture and TypeScript checks pass;
- Brain host remains 21/21;
- Registry remains 10/10;
- Core remains 75/75;
- full legacy checker remains at the inherited v0.4.2 finding set, with no new findings.
