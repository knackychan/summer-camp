# Summer Quest v0.3.5 — Adaptive Language Tutor
**Date:** 2026-09-24

## Goal

Extend the deterministic tutoring architecture introduced for Brain Gym Math to Word Wizard Study mode without redesigning the existing Summer Quest shell.

The child should no longer get the same generic “wrong letter → Hint button” response regardless of context. Summer Quest should observe safe interaction signals, choose an appropriate support shape locally, and use the LLM only when short phrasing adds value.

## Scope

v0.3.5 applies to Word Wizard **Study mode** for recall/translate/sentences/Bopomofo flows.

Intentionally unchanged:

- Copy mode remains deterministic and AI-free;
- Potion Shop remains the existing timed arcade loop;
- grading, mastery, language level and queue order remain application-owned;
- the existing Summer Quest navigation/UI shell is unchanged.

## Conservative local diagnosis

A wrong character can be tagged using only observable interaction data:

- `single_letter_slip` — one wrong input at the current position;
- `repeated_letter_confusion` — repeated wrong input at the same position;
- `recall_stall` — repeated difficulty before the learner gets started;
- `unknown` — no safe diagnosis.

These labels describe interaction patterns only. They are not medical, developmental or linguistic diagnoses.

## Tutor interventions

The local policy chooses one of five support shapes.

### `continue`

A strong learner making one isolated typo receives the normal Word Wizard feedback only. No AI request is made.

### `tiny_clue`

For a first/isolated mistake, Word Wizard gently points to the existing Hint control. The learner still chooses whether to spend a hint.

### `picture_audio`

For pre-readers or a recall stall, Summer Quest reinforces the existing clue through picture/audio. If AI is available it may phrase one short hint, constrained to locally approved strategies such as `picture_clue`, `sound_it_out` or `repeat_prompt`.

### `reveal_letter`

Repeated difficulty on the same position reveals **exactly the current letter**. This is deterministic local behavior; the model does not decide what to reveal.

### `easier_recall`

When recent completed attempts show repeated errors or hint dependence, Summer Quest temporarily makes the current recall easier by combining a small letter reveal with picture/audio reinforcement. It does not change the child’s selected global Word Wizard mode. The completed word remains a supported attempt and is queued for later review through the existing mastery flow.

## AI boundary

Vocabulary hint requests can now carry:

- the local mistake tag;
- the selected intervention kind;
- a short `preferredStrategies` allow-list.

The provider must choose from that allow-list. If it returns another language strategy, a Math strategy, or leaks the target word in text, Summer Quest rejects it and uses the local fallback.

The LLM still cannot:

- grade typed input;
- choose the intervention;
- choose what letter is revealed;
- change mastery/level;
- switch the child’s activity mode;
- control queue/progression;
- produce arbitrary UI.

## Existing UI integration

No new global screen is added.

Word Wizard Study mode now behaves approximately as:

```text
wrong key
  ↓
local observable mistake classification
  ↓
recent learning session
  ↓
local tutor policy
  ├─ continue
  ├─ tiny clue
  ├─ picture/audio
  ├─ reveal current letter
  └─ easier recall support
```

The existing Hint button continues to work manually.

## Offline behavior

The entire intervention policy works with no provider configured:

- diagnosis is local;
- intervention selection is local;
- exact letter reveal is local;
- easier recall support is local;
- picture/audio has deterministic fallback;
- grading/mastery remain local.

## Validation

Focused gates:

```sh
npm run test:adaptive-language
npm run test:adaptive-tutor
npm run test:agent-routing
npm run test:agent-server
npm run test:ai-eval
npm run test:mobile
```

The broad legacy checker remains at the same 132 known baseline findings.

## Next likely step

With Math and Language now sharing the same local-policy → constrained-AI pattern, the next useful milestone is to unify tutoring telemetry into one learner-support summary so the prototype can answer practical questions such as:

- which skills repeatedly need support;
- whether support is decreasing over time;
- which intervention types are actually helping;
- when AI was useful versus when local support was enough.

This should remain an adult/developer diagnostic view first, not a child-facing scorecard.
