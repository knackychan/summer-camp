# Summer Quest v0.3.6 — Unified Learning & Tutor Telemetry
**Date:** 2026-09-24

## Goal

Turn the Math and Language adaptive tutor work into one measurable learning system without changing the existing child UI or allowing analytics/AI to control progression.

The prototype should now be able to answer practical questions such as:

- which skills repeatedly need support;
- whether independent success is improving over recent attempts;
- which observable mistake patterns recur;
- how often the tutor intervenes;
- whether a retry succeeds after support;
- how often support uses a remote model versus deterministic/local behavior;
- the approximate token/cost footprint of AI hints.

Telemetry is evidence for adult/developer review. v0.3.6 does **not** feed these metrics back into autonomous progression or model escalation.

## Unified event schema

Math and Language now emit the same bounded event families:

- `attempt` — correctness, response time, hints used, difficulty and an optional observable mistake pattern;
- `intervention` — the locally selected tutor support shape and reason;
- `hint` — local/remote source, strategy and optional normalized provider usage;
- `adaptation` — deterministic learner-level adaptation signal;
- `support_outcome` — what happened after support, such as retry recovery or assisted completion.

The schema deliberately excludes raw typed child answer text.

## Learner/skill summary

`LearningTelemetry.ts` summarizes the event stream by learner + domain + skill and exposes:

- attempts and correct attempts;
- independent-correct rate;
- recent independence trend;
- average response time;
- support-intervention count;
- AI/local hint count and AI hint rate;
- remote fallback count;
- retry-recovery rate;
- assisted completions;
- top recurring observable mistake pattern;
- latest deterministic adaptation signal;
- AI input/output tokens and estimated cost.

“Top mistake” is only an observable interaction pattern (for example `near_miss` or `recall_stall`). It is not a diagnosis.

## Local-first collection

Every child browser keeps a bounded local ring buffer:

```text
sq:learning:telemetry:v1
latest 1,200 events
```

Gameplay writes locally first. Telemetry failures never block grading, tutor behavior, progression or the next activity.

## Family-PC LAN collector

When Summer Quest is launched through the v0.3.3+ local/LAN server, `/js/config.js` now also supplies:

```text
SUMMER_LEARNING_TELEMETRY_ENDPOINT=/api/learning-telemetry
```

The learning runtime mirrors local events to that endpoint using a short fire-and-forget HTTP client:

```text
Tablet / browser
    ↓
local ring buffer (offline-safe)
    ↓ best effort
/api/learning-telemetry
    ↓
family PC bounded JSON event store
```

The central collector retains 5,000 events by default and can be configured through server-only environment values.

### Endpoint contract

- `GET /api/learning-telemetry` — read the central family event window;
- `POST /api/learning-telemetry` — submit one version-1 event;
- `DELETE /api/learning-telemetry` — clear telemetry only.

The server normalizes accepted events field-by-field and discards unknown fields rather than saving arbitrary request payloads.

Runtime data is stored under `server/agent-proxy/data/`, which is both statically inaccessible and git-ignored.

## Reports integration

Operations → Reports keeps the existing Summer Quest administration shell.

The Learning telemetry section now:

1. tries the family-PC collector first;
2. shows combined telemetry from tablets when available;
3. falls back to the current browser’s local telemetry when the collector is unavailable;
4. clearly labels which source is being displayed;
5. supports Refresh, JSON export and source-appropriate Clear.

No child-facing scorecard or new navigation was added.

## Privacy boundary

v0.3.6 intentionally stores only compact learning/tutor operational signals:

- learner ID already used by Summer Quest;
- domain + skill;
- attempt correctness/timing/hint count;
- observable mistake pattern;
- local intervention type;
- hint strategy/source and normalized provider usage;
- deterministic adaptation signal;
- support outcome.

It does not collect raw typed answers, unrestricted chat history, provider credentials or the complete family profile.

## What telemetry cannot do

Telemetry does not:

- grade answers;
- change the child’s level;
- choose tutor interventions;
- select a stronger LLM;
- change mastery/progression;
- diagnose learning/developmental conditions.

Those boundaries remain with deterministic application logic and explicit future policy design.

## Validation

Focused gates:

```sh
npm run test:telemetry
npm run test:adaptive-tutor
npm run typecheck:mobile
npm run test:agent-routing
npm run test:agent-server
npm run test:ai-eval
npm run test:language
node --experimental-default-type=module scripts/registry.test.mjs
node --experimental-default-type=module scripts/core.test.mjs
```

Current results:

- Brain adaptive host: 21/21;
- Registry: 10/10;
- Core: 75/75;
- telemetry tests: pass;
- adaptive Math + Language tutor tests: pass;
- agent routing/local server tests: pass;
- AI evaluation and Language tests: pass;
- mobile TypeScript typecheck: pass.

The broad legacy checker remains at the inherited **132 known findings**, with zero additional findings introduced by v0.3.6.

## Next likely step

Use this evidence to build a **Tutor Policy Evaluation** layer rather than immediately adding more child-facing rules.

The next milestone should compare deterministic intervention outcomes by skill and surface developer-side evidence such as:

- tiny hint → retry recovery;
- visual explanation → retry recovery;
- easier follow-up → original-question recovery;
- picture/audio → supported completion;
- reveal letter → later independent recall;
- independence trend before/after repeated support.

Any policy change should remain explicit/deterministic until enough representative usage data exists. The LLM should not decide to escalate tutoring or spend more based on telemetry by itself.
