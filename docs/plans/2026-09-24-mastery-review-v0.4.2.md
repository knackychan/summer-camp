# Summer Quest v0.4.2 — Mastery + Review Scheduler

**Date:** 2026-09-24
**Scope:** existing Summer Quest Learn UI, curriculum skill map, learning telemetry, Smart Practice Learning Director.

## Goal

v0.4.1 can find a provisional starting point and v0.4.0 can identify the exact Math/Language skill being practised. The missing longitudinal layer is deciding when a skill is still being established, when it is reasonably secure, and when previously secure material should come back for a short review.

This release adds that layer without creating a second grading system and without putting the LLM in control of progression.

## Product rules

1. **Telemetry is the source of truth.** Mastery/review state is derived from real learning attempts; there is no editable mastery score that can drift away from evidence.
2. **Independent work matters most.** Hinted/assisted attempts can help learning but cannot by themselves advance a skill to Secure.
3. **Secure is not permanent.** A secure skill is scheduled for spaced review and can return to Building if later independent performance weakens.
4. **Review must stay bounded.** An overdue review can be mixed into Smart Practice, but cannot overwhelm a skill that is currently struggling.
5. **No AI authority.** The scheduler never calls an LLM and does not change model/provider routing, grading, levels, rewards or curriculum access.
6. **Existing games remain authoritative.** Review launches the same Brain Math / Word Wizard activities already used by Smart Practice.

## Skill states

Each eligible curriculum skill exposes one of four longitudinal states:

```text
Starting
   ↓ enough independent evidence
Building
   ↓ sustained independent success
Secure
   ↓ review interval expires
Review due
   ↓ fresh independent practice
Secure / Building (depending on performance)
```

### Starting

- no independent evidence, or
- fewer than three independent attempts.

### Building

- enough attempts to learn from, but not enough sustained accuracy/stability to call the skill secure;
- declining recent performance also returns a skill to Building.

### Secure

A skill must have at least six independent attempts, at least ~85% overall independent accuracy, at least ~80% recent independent accuracy, a short independent-correct streak, and no declining trend/level-down signal.

These are product heuristics for the prototype, not a psychometric claim.

### Review due

A Secure skill becomes Review due when its deterministic review interval expires after the last independent attempt.

## Review spacing

The first bounded schedule is:

```text
6–9 independent attempts     → 1 day
10–14                        → 3 days
15–24                        → 7 days
25–39                        → 14 days
40+                          → 30 days
```

The interval stretches only with accumulated independent evidence. It never exceeds 30 days in this prototype.

A new independent attempt becomes the new review anchor. A wrong/recently declining review can move the skill back to Building, where normal practice and tutor policy take over.

## Learning Director v4

The daily Smart Practice plan remains four short steps:

```text
review/warm-up → focus → reinforce → confidence
```

If an eligible secure skill is due and is different from the selected focus skill, it can replace the warm-up with a **Review** step. If the focus skill itself is Review due, the focus copy explicitly tells the child that this is a spaced-review check.

The director exposes:

- `mastery` per skill;
- `lastIndependentAt`;
- `reviewDueAt`;
- `reviewIntervalDays`;
- `reviewOverdueDays`;
- `reviewDueCount` for the plan;
- optional `scheduledReviewSkill`.

Daily plans remain stable after they start. The plan schema moves to version 4 so old stored v3 plans rebuild cleanly.

## UI

The existing Smart Practice card is reused. No new navigation is introduced.

Skill chips now communicate:

```text
Starting · 起步
Building · 建立中
Secure · 已掌握
↻ Review due · 該複習
```

A due review gets a subtle highlighted border and the session track labels an actual `Review · …` step.

## Telemetry additions

The existing summary now derives:

- first attempt timestamp;
- latest attempt timestamp;
- latest independent attempt timestamp;
- trailing independent-correct streak.

No raw answer text is added.

## Offline behavior

`MasteryReviewScheduler.js` is part of the PWA app shell. Review scheduling is entirely local and continues to work with no agent server or provider keys.

## Acceptance criteria

- Starting / Building / Secure / Review due are deterministic from telemetry;
- only independent work can establish Secure;
- a secure skill gets a bounded 1/3/7/14/30-day review interval;
- fresh independent practice pushes review forward;
- declining evidence moves a skill back to Building;
- Smart Practice inserts at most one explicit due-review step per four-step plan;
- active weakness still outranks review pressure;
- existing Math/Language grading and tutor policy are untouched;
- old director plans rebuild via schema version 4;
- offline cache includes the scheduler module;
- focused and regression tests pass with no new broad-check findings.
