# Summer Quest v0.3.4 — Adaptive Math Tutor
**Date:** 2026-09-24

## Goal

Turn the existing Brain Gym Math learning slice from a generic “wrong answer → optional AI hint” flow into a small adaptive tutoring loop without changing the existing Summer Quest shell.

The tutor must react to repeated difficulty, but **grading, progression, difficulty changes and scaffold selection remain deterministic application logic**. The LLM may only phrase a constrained hint within strategies selected by the local tutor policy.

## Scope

v0.3.4 applies the adaptive policy to Brain Gym `calc` addition/subtraction only. Vocabulary keeps the v0.3.1 structured hint flow for now.

## Deterministic diagnosis

A locally graded wrong Math answer is tagged as one of:

- `near_miss` — one away from the correct answer;
- `counting_slip` — two away;
- `operation_confusion` — answer matches the opposite +/− operation;
- `unknown` — no safe local diagnosis.

The diagnosis is stored with the learning attempt and never changes the Brain Gym score.

## Tutor interventions

The local policy chooses one of four support shapes:

### `continue`
Used for an isolated small slip after a strong recent run. The normal Brain corrective feedback is considered sufficient; no AI call is made.

### `tiny_hint`
Used for a first/isolated mistake. The child is offered a small clue. If accepted, the hint uses only locally approved strategies.

### `visual_explanation`
Used for operation confusion or a repeated diagnosed pattern. The UI proactively shows a concrete representation. Approved strategies are limited to `objects` and `number_line`.

### `easier_follow_up`
Used after repeated recent errors/hint dependence. Summer Quest inserts one deterministic, unscored smaller question, then returns to a guided retry of the original item.

The smaller question is generated locally. It cannot change the original score or count as a separate adaptive attempt.

## AI boundary

The tutor policy can send:

- mistake tag;
- intervention kind;
- a short allow-list of preferred hint strategies;
- the existing privacy-shaped lesson context.

The provider must choose a strategy from that allow-list. If it ignores the constraint, Summer Quest rejects the response and uses the local deterministic fallback.

The LLM still cannot:

- decide whether an answer is correct;
- decide the learner’s level;
- decide whether to advance;
- generate the easier follow-up question;
- overwrite score/progress;
- choose an unrestricted UI action.

## Existing UI integration

No new global UI is introduced. Adaptive support lives inside the existing Brain Gym support panel:

1. child answers;
2. Brain Gym grades locally;
3. scene gives its normal corrective feedback;
4. tutor policy inspects current error + recent learning attempts;
5. policy chooses continue / tiny hint / visual explanation / easier follow-up;
6. original Brain score remains the first scored answer;
7. guided retries are support only.

## Offline behavior

Every intervention still works without an LLM:

- `continue` needs no AI;
- scaffold generation is local;
- visual/tiny hint text has a local fallback;
- answer grading remains local.

## Validation

Focused gates:

```sh
npm run test:adaptive-tutor
npm run test:learning
npm run test:language
npm run test:agent-routing
npm run test:agent-server
npm run test:mobile
```

The Brain host suite now includes direct coverage for the `continue` and `easier_follow_up` paths, including preservation of the original score.

## Next likely step

Apply the same policy architecture to vocabulary using language-specific diagnoses such as repeated-letter confusion, sound/picture mismatch and recall difficulty, rather than adding more subject areas immediately.
