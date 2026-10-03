# Summer Quest v0.4.3 — Expanded Math Skills + Multiplication Tutor

**Date:** 2026-09-24
**Scope:** existing curriculum skill map, Brain Gym Calculation activity, adaptive Math tutor, AI hint evaluation.

## Goal

v0.4.0–v0.4.2 established explicit skills, placement, mastery and spaced review, but the adaptive Math map still covered mostly addition/subtraction. v0.4.3 expands the real child-facing Math content without adding another game or another grading system.

The new slice adds number sense, number bonds and multiplication to the same deterministic learning/tutor pipeline already used by Smart Practice.

## Product rules

1. **Reuse Brain Gym.** New Math skills launch the existing Calculation activity rather than introducing a second quiz UI.
2. **Local grading stays authoritative.** Every directed item is parsed and recomputed locally before it can participate in learning/tutor logic.
3. **Skill attribution is exact.** Directed Smart Practice keeps the requested curriculum skill even when a particular generated multiplication fact could also fit a simpler table family.
4. **Tutor intervention is local.** The deterministic tutor chooses continue/tiny hint/visual explanation/easier follow-up. The LLM may only phrase an approved strategy.
5. **Scaffolds are unscored.** Smaller multiplication/comparison/number-bond steps never overwrite the original graded attempt.
6. **No reward leakage.** Directed Smart Practice continues to stay isolated from Daily Brain completion, best score and Daily Brain stars.
7. **Offline-first.** All new curriculum/tutor logic remains local; AI is optional and has a deterministic fallback.

## New curriculum skills

### Number sense

- `math.number_comparison.within_20` — Compare numbers to 20 / 20 以內比大小
- `math.number_comparison.within_100` — Compare numbers to 100 / 100 以內比大小

### Number bonds

- `math.number_bonds.to_10` — Number bonds to 10 / 10 以內數字分合
- `math.number_bonds.to_20` — Number bonds to 20 / 20 以內數字分合

### Multiplication

- `math.multiplication.tables_2_5_10` — Times tables 2, 5 and 10 / 2、5、10 乘法表
- `math.multiplication.tables_2_to_9` — Times tables 2 to 9 / 2 到 9 乘法表

Age/readiness metadata and prerequisites are internal Summer Quest progression heuristics, not a claim of alignment to a national curriculum.

## Directed Brain Math generation

`directedCalcItem()` now understands the new skill IDs.

```text
Compare to 20   → Which is bigger? 12 or 17
Bonds to 10     → 4 + ? = 10
× 2, 5, 10      → 5 × 7 = ?
× 2–9           → 7 × 6 = ?
```

Tot/choice-mode children receive numeric choices where appropriate; mid/hard tiers keep the existing keypad interaction. All kid-facing prompts/correctives are bilingual.

## Deterministic Math diagnosis

The local classifier adds observable, task-specific labels:

- `skip_counting_slip` — multiplication result is exactly one factor/group away;
- `comparison_reversal` — the child selected the smaller of the two compared values;
- `number_bond_slip` — the child reused the known part or whole instead of the missing part.

Existing `near_miss`, `counting_slip`, `operation_confusion` and `unknown` remain. These are interaction labels, not diagnoses of the child.

For multiplication, using `left + right` on a multiplication item is classified as `operation_confusion`, allowing immediate concrete representation.

## Tutor strategies

The Math strategy set now includes:

```text
equal_groups
array
skip_count
compare_quantity
missing_part
```

The local tutor chooses an allow-list appropriate to the operation and mistake. Examples:

```text
6 × 4 wrong by one group
  → skip_count / equal_groups

7 × 6 repeated difficulty
  → array / equal_groups

12 vs 17 reversed
  → compare_quantity / number_line

4 + ? = 10 difficulty
  → missing_part / objects
```

If a remote model returns a strategy outside the local allow-list, the response is rejected and the deterministic local hint is used.

## Easier follow-up scaffolds

The existing unscored scaffold flow now supports:

- smaller multiplication factors;
- smaller number comparisons preserving which side is larger;
- smaller number-bond totals;
- existing addition/subtraction scaffolds.

A successful scaffold returns the child to the original question. It does not award progress itself.

## Presentation

The existing Brain tutor support panel can render:

- equal groups;
- simple arrays;
- skip-count sequences;
- quantity comparison bars;
- missing-part number bonds;
- existing object and number-line visuals.

Pre-reader presentation can use the visual without requiring explanatory text.

## AI evaluation

AI Lab's built-in suite grows from four to five cases by adding a multiplication/equal-groups scenario. The same guardrails continue to measure schema adherence, domain strategy validity, answer leakage, age fit, latency, tokens and estimated cost.

## Out of scope

- division;
- fractions/decimals;
- formal national-curriculum alignment;
- automatic AI model escalation;
- replacing the existing placement system with multi-strand Math placement (recommended next).

## Acceptance criteria

- all six new Math skills appear in the curriculum map with bilingual labels;
- Smart Practice can launch each skill through existing Brain Calculation;
- generated items stay inside each requested skill contract;
- multiplication is parsed and locally recomputed before tutor use;
- comparison/number-bond items are locally validated;
- multiplication/comparison/number-bond wrong answers can enter deterministic tutor policy;
- local visual strategies and unscored scaffolds work for the new operations;
- AI strategy responses remain constrained by the local tutor allow-list;
- normal Brain Gym behavior remains unchanged outside directed practice;
- offline cache revision is bumped;
- focused and regression tests pass with no new legacy-check findings.
