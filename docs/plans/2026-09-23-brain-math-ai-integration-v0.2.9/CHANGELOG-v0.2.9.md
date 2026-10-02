# Summer Quest v0.2.9 — Brain Gym Math + AI Learning Integration

## Added

- conservative Brain Gym calculation → typed `MathQuestion` adapter;
- existing Brain Gym Calculations integration with the v0.2.8 learning runtime;
- daily persisted arithmetic learning sessions per child;
- optional structured AI hint flow after an incorrect answer;
- deterministic local hint fallback when the agent endpoint is unavailable;
- age/reading-level-aware hint presentation;
- guided retry of the same question after a hint;
- reusable learning-support panel inside the existing Brain round host;
- service-worker precache entries for the learning/agent client runtime;
- focused tests covering adapter mapping, persisted adaptation and the UI hint/retry flow.

## Scoring / safety invariants

- arithmetic correctness remains local and deterministic;
- AI cannot modify the Brain Gym answer or score;
- AI cannot select learner difficulty;
- guided retries do not overwrite the original Brain Gym score;
- provider credentials remain server-side;
- malformed/unavailable AI responses fall back locally.

## Initial coverage

Learning hints are enabled only for unambiguous addition/subtraction calculation items. Multiplication and unsupported items continue through the unchanged Brain Gym behaviour.

## Validation

- `npm run test:agent-routing` — pass;
- `npm run typecheck:agent` — pass;
- `npm run typecheck:mobile` — pass;
- `npm run test:learning` — pass;
- `scripts/brain-host.test.mjs` — 19/19 pass;
- `node scripts/check.mjs` — same 131 known baseline findings, zero new findings.
