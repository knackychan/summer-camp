# Summer Quest — Brain Gym Math + Learning Runtime Integration
**Date:** 2026-09-23
**Version:** v0.2.9

## Goal

Use the existing Summer Quest child UI as the prototype shell and prove the first real AI-assisted learning loop without redesigning navigation or building the 3D planet.

The existing **Brain Gym → Calculations** activity remains the visible experience. v0.2.9 connects it to the v0.2.8 learner/session runtime and the v0.2.7 provider-neutral AI gateway.

## Child flow

```text
Brain Gym / Calculations
        ↓
local arithmetic question
        ↓
child submits an answer
        ↓
SQBrainCore grades locally
        ↓
   correct? ───────── yes ──→ normal Brain feedback / next
        │
        no
        ↓
existing corrective feedback
        ↓
Hint? / 提示嗎？
   │                │
  Next             Hint
   │                ↓
   │          lesson_hint task
   │                ↓
   │        remote model OR local fallback
   │                ↓
   │          structured strategy
   │                ↓
   │       Summer Quest renders it
   │                ↓
   └──────────→ Try again / Next
```

## Important ownership boundary

The learning model never owns mathematical truth or Brain Gym scoring.

Summer Quest locally owns:

- question operands;
- correct answer;
- correct/incorrect grading;
- Brain Gym score;
- learner attempt history;
- difficulty adaptation;
- the visual implementation of hint strategies.

The model may only return the constrained `lesson_hint` response already defined in the agent contract.

A guided retry after a hint is graded locally, but deliberately **does not replace the original Brain Gym answer**. This prevents AI-assisted retries from inflating the existing arcade score.

## Supported first slice

v0.2.9 intentionally supports only arithmetic items whose semantics can be recovered with certainty:

- emoji addition questions with explicit `prompt.a` and `prompt.b`;
- textual addition such as `8 + 7 = ?`;
- textual subtraction such as `14 − 5 = ?`.

The adapter verifies that the locally recomputed result equals the Brain item answer before enabling learning support.

Multiplication and any ambiguous item remain on the unchanged Brain Gym path for now.

## New modules

### `packages/learning/src/math/BrainMathQuestionAdapter.ts`

Converts trusted Brain Gym calculation items into typed `MathQuestion` objects. It is deliberately conservative and returns `null` for unsupported/ambiguous content.

### `packages/learning/src/legacy/BrainMathLearningBridge.ts`

Bridges the existing child shell to the typed learning runtime. It:

- resolves/creates the learner profile;
- opens a daily arithmetic learning session;
- records local attempts;
- persists deterministic adaptation;
- asks `MathHintService` for a hint;
- automatically receives the local fallback if no remote client is configured.

### `js/learning-runtime.js`

Thin classic-script bridge for the legacy root `index.html`. It lazy-loads the compiled typed modules under `dist/mobile` and exposes semantic methods through `window.SQLearningRuntime`.

Provider API keys are not read or stored here. The browser can only be configured with a protected Summer agent endpoint and an optional server-allowed profile hint.

## Existing UI integration

`index.html` now passes three optional capabilities into `SQBrain.openRound(...)` for the `calc` game:

- `canLearningSupport(meta)`;
- `getLearningHint(meta)`;
- `onLearningAttempt(meta)`.

`js/brain/host.js` owns the shared hint/retry overlay so individual calculation scenes do not need model-specific or learning-runtime code.

This keeps the architecture reusable for later subjects while leaving existing scene generation and grading untouched.

## Reading-level behaviour

The learner profile from v0.2.8 is reused.

- ages up to 4 default to `pre_reader`;
- ages 5–7 default to `early_reader`;
- older children default to `reader`.

For pre-readers, validated hint strategies render visually and the bilingual hint can be spoken through the existing `say` callback. Text can be suppressed by the presentation contract.

## Offline behaviour

AI is optional.

If `SUMMER_AGENT_ENDPOINT` is absent, unreachable, times out, or returns invalid structured data, `MathHintService` uses the deterministic local hint generator.

Therefore:

```text
No internet / no API key / provider failure
                ↓
Brain Gym still works
                ↓
Hint still works using local strategy
```

The new runtime modules are included in the service-worker precache.

## Learning persistence

Each supported attempt records:

- stable question ID;
- locally determined correctness;
- response time;
- number of hints used;
- question difficulty;
- answer timestamp.

Daily arithmetic sessions use a stable key shaped like:

```text
brain-math:<kidId>:arithmetic:<TaipeiDay>
```

The v0.2.8 deterministic five-attempt adaptation window remains authoritative.

## Validation

Passing focused gates:

```text
npm run test:agent-routing
npm run typecheck:agent
npm run typecheck:mobile
npm run test:learning
node --experimental-default-type=module scripts/brain-host.test.mjs
```

`brain-host.test.mjs` now includes a guided-hint integration test proving that:

- a wrong answer offers the learning support flow;
- requesting a hint records one hint use;
- retry re-presents the same question;
- retry is graded locally;
- original Brain score remains the original wrong attempt;
- the learning attempt is not double-counted.

The mandatory legacy `node scripts/check.mjs` still reports **131 failures**, exactly identical to the v0.2.8 baseline. Those are pre-existing handover omissions/token-audit findings (notably missing optional book assets/config and existing Brain token literals); v0.2.9 introduces zero new `check.mjs` failures.

## Next recommended slice

After reviewing this interaction in the real existing UI, the next functional step should be an **AI developer/evaluation panel** using the same gateway. It should allow controlled comparison of cheap / standard / reasoning profiles for the same `lesson_hint` request, with schema validity, latency, tokens and estimated cost visible side by side.

That gives us evidence for model routing before automatic escalation is introduced.
