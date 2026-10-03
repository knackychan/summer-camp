# Summer Quest v0.3.2 — AI Evaluation Bench

## Goal

Use the existing Admin → AI Lab to compare the same child-facing hint tasks across manually selected model profiles before introducing any automatic model escalation.

The evaluation bench now covers both real learning domains already integrated in Summer Quest:

- Math lesson hints;
- Vocabulary lesson hints.

This milestone does **not** change child navigation, global UI, scoring, progression, or production routing policy.

## What changed

### 1. Shared Math + Vocabulary eval runtime

`packages/agent/src/eval/LessonHintEval.ts` now supports two request shapes:

- arithmetic near-miss / hint cases;
- vocabulary recall / picture cases.

Both use the existing protected `lesson_hint` agent task and manual profile routing.

### 2. Built-in four-case suite

The AI Lab can run four representative cases sequentially against every selected profile:

1. Math · early-reader near miss (`8 + 7`, answer `14`);
2. Math · pre-reader subtraction;
3. Vocabulary · early-reader picture recall (`apple`);
4. Vocabulary · pre-reader picture/audio recall (`dog`).

The suite is intentionally small. Its purpose is to expose clear quality/cost differences before a larger eval corpus is created.

### 3. Local deterministic guardrails

Every validated response receives a mechanical guardrail check:

- selected strategy belongs to the requested learning domain;
- the model did not reveal the Math final answer or Vocabulary target;
- response length stays within the current reading-level text budget.

The resulting `0–100` guard score is **not a teaching-quality score**. It only summarizes those deterministic checks.

### 4. Human review

Each result has two optional 1–5 fields:

- Useful;
- Age fit.

These are deliberately human-entered. Summer Quest should not pretend that deterministic rules can fully judge teaching quality.

### 5. Saved local eval history

Completed single-case and suite runs are stored locally in the Admin browser (latest 20). A run records:

- requested profile;
- actual returned profile;
- provider/model;
- response JSON;
- guardrail result;
- latency;
- tokens;
- estimated cost;
- optional human ratings.

History can be exported as JSON for later analysis.

## Routing remains manual

v0.3.2 does not introduce automatic cheap → standard → reasoning escalation.

The server allow-list is still authoritative. If a requested profile is substituted by server policy, the UI shows the mismatch and does not treat it as a valid comparison of that requested model.

## Acceptance criteria

- single Math eval still works;
- single Vocabulary eval works;
- four-case suite runs selected profiles sequentially;
- vocabulary target leakage is detected locally;
- Math final-answer leakage is detected locally;
- wrong-domain hint strategies are detected locally;
- pre-reader text-budget failures are visible;
- provider/profile substitution remains visible;
- latency/tokens/cost remain visible;
- human Useful/Age-fit ratings can be stored;
- latest 20 runs persist locally;
- history exports as JSON;
- existing child learning behavior is unchanged;
- no new full-project checker findings are introduced.

## Next decision point

After collecting representative runs, use the exported data to define a task-to-tier policy. Only then should Summer Quest add deterministic automatic routing for selected task classes.
