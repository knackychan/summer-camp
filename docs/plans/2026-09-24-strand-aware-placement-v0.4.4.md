# Summer Quest v0.4.4 — Strand-aware Placement Map

**Date:** 2026-09-24
**Scope:** existing Quick skill check, curriculum skill map, Learning Director, local learning telemetry.

## Goal

v0.4.1 introduced a short deterministic placement check, but Math was represented as one linear arithmetic ladder. After v0.4.3 added number sense, number bonds and multiplication, one Math starting level became misleading: a child can be strong in addition while still learning multiplication, or have good number sense while needing number-bond practice.

v0.4.4 changes placement from one Math result into a small **strand-aware starting map** while reusing the same Brain Calculation / Word Wizard activities and the same no-reward, no-AI measurement mode.

## Product rules

1. **No new quiz engine.** Placement still launches the existing Brain Math and Word Wizard Study activities.
2. **Math strands are independent.** Number sense, number bonds, addition/subtraction and multiplication receive separate provisional starts when age-eligible.
3. **Keep it bounded.** A strand uses two anchor items and at most one adjacent confirmation item.
4. **Stop on mixed evidence.** A 1/2 anchor result is already informative enough for a provisional start; do not keep probing.
5. **Reuse real history.** Four or more independent attempts with usable per-skill evidence can resolve a strand before the quick check starts.
6. **Explicit re-check means re-check.** Choosing Re-check ignores history shortcuts and samples the full age-eligible map again.
7. **Placement is only a prior.** Real independent learning telemetry, mastery and review scheduling gradually supersede placement.
8. **No AI authority.** LLMs remain disabled for placement and cannot decide grading, strand starts, curriculum readiness or model routing.

## Math placement strands

### Addition & subtraction (`number_operations`)

```text
+ to 5 → + to 20 → − to 20 → + to 100 → − to 100 → + to 200
```

The age anchor follows the previous v0.4.1 arithmetic placement behavior.

### Number sense (`number_sense`)

```text
Compare to 20 → Compare to 100
```

### Number bonds (`number_bonds`)

```text
Bonds to 10 → Bonds to 20
```

### Multiplication (`multiplication`)

```text
× 2,5,10 → × 2–9
```

Multiplication placement starts from age 7, matching the current internal curriculum map.

## Age-aware strand set

The quick check does not force every strand on every child:

```text
age 3       addition/subtraction + Words
age 4       + number sense
age 5–6     + number bonds
age 7+      + multiplication
```

This is an internal Summer Quest product heuristic, not a formal national-curriculum claim.

## Probe policy

Every unresolved strand begins with two items at an age-appropriate anchor.

```text
2/2 correct
  → one adjacent harder confirmation (if one exists)

0/2 correct
  → one adjacent easier confirmation (if one exists)

1/2 correct
  → stop immediately at the anchor
```

A confirmation is only one item. Therefore each live-sampled strand uses **2–3 items maximum**.

## Existing-history shortcut

Before creating a placement step, Summer Quest checks independent learning telemetry for that strand. A strand can be resolved from history when:

- it has at least four independent attempts in the strand;
- at least one curriculum skill has two or more independent attempts;
- the highest sufficiently successful sampled skill (>=75% independent accuracy) can be identified; or, if none passed, the result steps one level below the lowest sufficiently sampled failing skill when possible.

These history-derived starts are displayed as **Recent independent practice** rather than Quick check results.

The explicit Re-check action deliberately does not use this shortcut.

## State schema

Placement state moves from v1 to v2.

```text
trackOrder
  math:number_operations
  math:number_sense
  math:number_bonds
  math:multiplication
  language

tracks[trackKey]
  ladder
  anchorIndex
  samples
  result
```

The local storage namespace moves to `sq:learning:placement:v2:`. Previous v1 placement records are not used as authoritative multi-strand maps; children may run the new optional check or continue with real telemetry.

## Learning Director v5

Learning Director now resolves placement **per skill strand** instead of using one Math ladder for every Math skill.

Examples:

```text
Operations start: − to 20
Number sense start: Compare to 100
Number bonds start: Bonds to 10
Multiplication start: × 2,5,10
```

Each recommended skill receives the temporary `placementRelation = start` boost only inside its own ladder. A result in number bonds cannot incorrectly lock or promote multiplication, and vice versa.

Placement can also add a recommended skill definition to the active learner map if age/readiness filtering would otherwise omit that exact start. The usual curriculum/readiness rules continue to apply outside the strand-local placement relation.

Daily Smart Practice plans move to schema version 5 so old unstarted v4 plans rebuild cleanly. Started plans remain stable.

## UI

The existing Quick skill check card is retained.

Completed placement now shows a **Math starting map** with separate result cards for each sampled strand plus the Words result. Each card indicates whether it came from:

- Quick check; or
- Recent independent practice.

The in-progress status reports placement **areas** rather than only a raw step count because one area may contain a one-item confirmation step.

## Offline behavior

All placement logic stays local. The service-worker cache revision is bumped to `summer-quest-v95-strand-aware-placement`; the same compiled placement/director modules remain part of the app shell.

## Acceptance criteria

- Math placement is strand-aware rather than one linear result;
- age-eligible strands are sampled independently;
- each live strand uses no more than two anchor items + one confirmation;
- mixed 1/2 evidence stops the strand immediately;
- existing independent history can skip already-understood strands;
- explicit Re-check samples the whole eligible map again;
- completed UI shows a multi-card Math starting map + Words;
- Learning Director applies placement relations only within the corresponding strand;
- Learning Director schema is v5 and old unstarted plans rebuild;
- placement storage schema is v2;
- placement remains reward-free, AI-free and locally graded;
- focused and regression gates pass with no new legacy-check findings.
