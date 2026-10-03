# Summer Quest v0.4.1 — Quick Placement / Calibration

**Date:** 2026-09-24
**Status:** implemented prototype slice

## Goal

When Summer Quest has little or no learning history for a child, it should not rely only on age to choose the first Smart Practice skill. v0.4.1 adds a short, optional, deterministic placement check that reuses the existing Math and Word Wizard activities.

The placement check is intentionally small and low-stakes:

- normally 4–8 items total;
- two items per sampled skill;
- Math + Language only in this slice;
- no stars, ranking, Daily Brain completion, or reward payout;
- no AI hints or adaptive tutor interventions during the measurement items;
- the child can choose **Later** and continue using Smart Practice normally.

This is a **starting estimate**, not a formal assessment or diagnosis.

## Placement flow

```text
existing learning evidence
        ↓
enough evidence already?
   yes          no
    ↓            ↓
 optional    quick check suggested
                 ↓
         Math anchor (2 items)
             ↙       ↘
        easier       harder
          2 items     2 items
                 ↓
       provisional Math start
                 ↓
        Language anchor (2 items)
             ↙       ↘
        easier       harder
          2 items     2 items
                 ↓
     provisional Language start
                 ↓
        Smart Practice Director
```

Each domain samples at most two adjacent skills. The calibration stops as soon as the domain has a usable local bracket or reaches a ladder boundary.

## Math ladder

The first prototype ladder is:

```text
Addition to 5
→ Addition to 20
→ Subtraction to 20
→ Addition to 100
→ Subtraction to 100
→ Addition to 200
```

The first sampled skill is age-anchored, but the second sample can move one adjacent step up or down. This allows an older child to demonstrate that an easier foundation is a better starting point, or a younger child to demonstrate that one adjacent harder skill is comfortable.

The result is deliberately provisional. Real Smart Practice evidence replaces its influence as independent attempts accumulate.

## Language ladder

The standard language ladder is constrained by the learner's reading profile:

```text
Word copy
→ Word recall
→ Word translation
→ Sentence recall
```

For Bopomofo mode, the quick check samples the existing Bopomofo activity directly rather than pretending it belongs to the Latin spelling ladder.

The placement flow launches **Word Wizard Study mode** only. Potion Shop remains untouched.

## Existing evidence

A new placement check is only recommended when the local telemetry stream is sparse.

Current threshold:

- fewer than 4 independent Math attempts; or
- fewer than 4 independent Language attempts.

If both domains already have at least four independent attempts, the card becomes optional rather than recommended.

This threshold is a product heuristic, not a statistical-confidence claim.

## Reuse existing activity truth

Placement does not implement a second grading engine.

Math:

```text
Placement step
  ↓
existing Brain Gym calculation activity
  ↓
existing local gradeItem / Math correctness
  ↓
normal learning attempt telemetry
```

Language:

```text
Placement step
  ↓
existing Word Wizard Study activity
  ↓
existing first-try correctness
  ↓
normal learning attempt telemetry
```

The placement state machine only reads the resulting telemetry after a step starts.

## No tutoring during measurement items

During a placement launch:

- Brain Math reports learning-support capability as unavailable;
- AI/local Math hint requests are disabled;
- automatic Math tutor interventions are disabled;
- Word Wizard hides the Hint button;
- Word Wizard adaptive interventions are disabled;
- Word Wizard placement items do not modify the legacy vocabulary mastery-box progression.

This keeps the quick estimate about independent performance while leaving normal Smart Practice tutoring unchanged.

## Persistence

Placement state is local-first and stored separately from learner levels:

```text
sq:learning:placement:v1:<kidId>
```

The state contains only:

- sampled curriculum skill IDs;
- attempt/correct counts for those two-item samples;
- the provisional recommended skill per domain;
- timestamps and progress.

Raw typed answers are not copied into placement storage.

## Smart Practice integration

Learning Director plans move to schema version 3.

A completed placement can seed the Director when direct practice evidence is still sparse:

- the recommended skill is marked **Start here**;
- it receives higher initial practice need;
- lower ladder skills are de-prioritized unless real telemetry shows difficulty;
- skills above the provisional starting point can remain locked until the starting skill develops steady/strong evidence;
- real learning telemetry remains authoritative and gradually replaces the placement prior.

If a placement recommends a language mode above the current Word Wizard preference, the Director may use that placed mode for directed practice without rewriting the child's general Word Wizard setting.

## Session stability

Completing or rerunning placement must not reshuffle a Smart Practice session that has already started.

Rules:

- an **unstarted** daily plan can be rebuilt from a newly completed placement;
- an already-started or completed Smart Practice plan remains fixed;
- the new placement takes effect on the next **New plan / New session**.

This preserves the v0.3.9 rule that learning telemetry cannot rearrange a child mid-session.

## Existing UI

No new global navigation is introduced.

The existing Learn tab gets one compact card above Smart Practice:

```text
🧭 Quick skill check

recommended / optional / in progress / ready

[Start quick check]
[Later]
```

When complete it shows the provisional Math and Language starting skills and a **Re-check** action.

All kid-facing copy remains English + Traditional Chinese.

## Offline behavior

The placement runtime is fully local and requires no provider or network access.

The service-worker shell now includes:

- `PlacementCalibration.js`;
- `PlacementCalibrationStore.js`;
- `PlacementCalibrationBridge.js`.

Cache revision: `summer-quest-v92-placement-calibration`.

## Validation

Focused gate:

```sh
npm run test:placement
```

Curriculum gate now also includes placement:

```sh
npm run test:curriculum
```

Regression requirements remain:

- Learning Director passes;
- adaptive Math/Language passes;
- telemetry/tutor policy/experiments pass;
- agent/server/mobile gates pass;
- registry 10/10;
- core 75/75;
- full legacy checker introduces no new findings above the v0.4.0 baseline.

## Explicit limitations

v0.4.1 does not attempt to provide a psychometric placement score or formal curriculum grade.

It also does not:

- calibrate multiplication yet;
- infer reading level from the calibration;
- change age/profile data;
- automatically change the child's normal Word Wizard mode;
- call an LLM to decide placement;
- send calibration results to a remote model;
- gate Smart Practice until calibration is complete.

The purpose is simply to improve the first useful starting point while real learning evidence is still sparse.
