# v0.5.6 — Bounded Check-Mode Help

## Goal

Add explicit help to unanswered Science, Geography and History Check questions without allowing an LLM to answer, grade, select curriculum, change mastery, change review timing or change rewards.

## Contract

- Local help is always available and is rendered from three fixed bilingual strategy cues.
- Optional AI is selection-only: it may return one exact approved `strategy:*` cue ID.
- The canonical Check request contains the lesson/domain, current question text, reading/age band and fixed cues.
- It excludes answer choices, `correctOptionId`, explanation text, selected answers, grading, mastery and rewards.
- Provider prose is never rendered.
- No automatic escalation or retry is introduced.
- Answer submission invalidates pending help. Late responses cannot rewind or modify an attempt.
- Advancing to another question removes prior help state.
- Attempt telemetry remains independent and records `hintsUsed: 0` so help cannot alter mastery/review evidence.

## UI

An unanswered Check question shows **Need a hint? 提示** above the choices. After opening it, the fixed hint can be read aloud or replaced with another local strategy. Once the child answers, the hint panel disappears.
