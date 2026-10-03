# Summer Quest v0.4.2 — Mastery + Review Scheduler

## Added

- deterministic `MasteryReviewScheduler` derived from existing learning telemetry;
- longitudinal skill states: **Starting**, **Building**, **Secure**, **Review due**;
- bounded spaced-review intervals of 1 / 3 / 7 / 14 / 30 days;
- independent-correct streak and attempt timestamp fields in telemetry summaries;
- due-review metadata in Learning Director skill state;
- explicit `review` Smart Practice step kind;
- review-due/secure visual states in the existing Smart Practice skill chips;
- focused `test:mastery` regression gate;
- mastery scheduler module in the offline service-worker app shell.

## Learning Director v4

- plan schema moves from v3 to v4;
- at most one due secure skill can replace the normal warm-up as an explicit Review step;
- if the focus skill itself is due, Focus copy explains that it is a spaced-review check;
- due-review pressure is capped so active learning difficulty still takes priority;
- plan exposes `reviewDueCount` and optional `scheduledReviewSkill`;
- already-started daily plans remain stable.

## Mastery safeguards

- only independent attempts can establish Secure;
- assisted/hinted attempts do not independently advance review spacing;
- declining evidence or a level-down signal prevents Secure;
- a fresh independent attempt becomes the next review anchor;
- no LLM is involved in mastery state or review scheduling;
- scheduler cannot grade, change levels, spend rewards, select providers/models or unlock curriculum.

## Validation

- mastery/review scheduler tests pass;
- curriculum + placement + Learning Director tests pass;
- adaptive Math + Language tests pass;
- learning telemetry / tutor policy / tutor experiment tests pass;
- AI evaluation / agent routing / local agent server tests pass;
- mobile architecture and TypeScript checks pass;
- Registry remains 10/10;
- Core remains 75/75;
- full legacy checker remains at the inherited v0.4.1 finding set, with no new findings.
