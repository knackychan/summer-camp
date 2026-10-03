# Summer Quest v0.3.7 — Tutor Policy Evaluation
**Date:** 2026-09-24

## Goal

Use the unified v0.3.6 learning/tutor telemetry to measure how the current deterministic tutoring rules behave before adding more rules or any automatic policy/model escalation.

The important boundary stays unchanged:

```text
Telemetry → evidence for adults/developers
           ↓
       review / experiments
           ↓
 explicit deterministic policy change
```

Telemetry never directly changes a child's level, grades an answer, selects a tutor intervention or upgrades an LLM.

## Policy evidence rows

Operations → Reports groups evidence by:

- learner;
- domain;
- skill;
- deterministic intervention kind.

For each group it shows:

- intervention uses;
- observed support-outcome success;
- retry recovery rate;
- assisted completions;
- correctness of the next independent attempt;
- recent independent performance after the intervention;
- comparison with independent attempts immediately before support;
- an explicit sample-size/evidence label.

## Evidence labels

Small samples must not look authoritative:

```text
< 5 uses     very low sample
5–9          low sample
10–19        emerging
20+          usable sample
```

These labels describe sample volume only. They are not statistical significance claims.

## Causality boundary

A higher recovery or later-independent rate does not prove the intervention caused the improvement. The report is descriptive evidence to help decide what to test next.

The UI therefore does not display "best intervention", rankings, automatic winners or recommended policy changes.

## Math outcomes

Brain Gym now emits explicit support outcomes for the adaptive Math flow:

- scaffold completed successfully;
- original-question retry recovered;
- original-question retry failed;
- support skipped.

These events do not alter the original Brain Gym score. The first graded attempt remains authoritative.

## Language outcomes

Word Wizard Study keeps its existing local intervention policy. Completing a word after actual support records an assisted completion. The bridge keeps the last local intervention for the current word so that assisted outcomes can be associated with `picture_audio`, `reveal_letter`, `easier_recall`, etc.

Copy mode remains AI-free and Potion Shop remains outside adaptive tutoring.

## Reports UI

The existing Reports route gains two developer/adult sections only:

1. **Learning telemetry** — learner/domain/skill summaries from v0.3.6;
2. **Tutor policy evidence** — descriptive intervention/outcome comparison from v0.3.7.

The report prefers the family-PC LAN collector and falls back to the current browser's local ring buffer. Refresh, export and source-aware clear stay available.

JSON export includes:

- normalized events;
- learner/skill summaries;
- tutor-policy evidence rows.

## Privacy

No raw typed child answer text is added. Policy evaluation operates only on normalized v1 learning telemetry.

## Validation

Focused commands:

```sh
npm run test:telemetry
npm run test:tutor-policy-eval
npm run test:adaptive-tutor
npm run test:agent-server
npm run typecheck:mobile
npm run typecheck:agent
```

Legacy gates remain unchanged:

- Brain host: 21/21;
- Registry: 10/10;
- Core: 75/75;
- broad checker: inherited 132 findings, zero new findings.

## Next likely step

Do not automatically rewrite tutor policy yet. First collect real representative sessions and use the evidence view to identify one narrow policy hypothesis to A/B manually, for example:

- whether repeated `near_miss` Math errors recover better from `number_line` than immediate easier-follow-up;
- whether `picture_audio` improves later independent recall for pre-readers without over-supporting them.

Any experiment should be explicit, reversible and deterministic.
