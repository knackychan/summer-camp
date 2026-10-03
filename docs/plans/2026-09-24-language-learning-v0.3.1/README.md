# Summer Quest v0.3.1 — Language / Vocabulary Learning Slice
**Date:** 2026-09-24

## Goal

Prove that the v0.2.8 learning runtime and v0.3.0 multi-provider AI evaluation foundation work for a second subject without redesigning the existing Summer Quest interface.

This release integrates the learning runtime into the existing **Word Wizard** study experience. Vocabulary exercises remain game-owned and deterministic; AI is used only when it adds value as a constrained hint provider.

## Product rule

The existing Summer Quest UI remains the prototype shell.

This release does **not** introduce the proposed 3D planet home, a new navigation system, a new language game, or unrestricted child chat. The planet concept stays parked as a later presentation layer.

## Learning flow

```text
Word Wizard study exercise
        ↓
existing local typing / correctness logic
        ↓
learner attempt + response time + hint use
        ↓
LearningSessionEngine (domain = language)
        ↓
deterministic 5-attempt adaptation

When the child asks for a hint:
Word Wizard
        ↓
VocabularyLearningBridge
        ↓
VocabularyHintService
        ↓
lesson_hint task through existing Agent Proxy
        ↓
validated language hint strategy
        ↓
local presentation instruction
        ↓
existing Word Wizard UI
```

## AI boundary

The model does not own the answer, word mastery, score, progression, difficulty, or UI markup.

It may return only a structured `lesson_hint` response with one of the language strategies:

- `first_letter`
- `next_letter`
- `word_shape`
- `picture_clue`
- `repeat_prompt`
- `sound_it_out`
- `retry`

The application converts that strategy into trusted local presentation behavior.

Math strategies and language strategies are kept separate. A vocabulary hint returning a math strategy is rejected and falls back locally. The existing Math hint service likewise rejects language-only strategies.

## Answer-leak guard

Vocabulary hint text is checked before display. If the returned English/Chinese hint contains the full target word or phrase, the remote result is rejected and the app uses a deterministic local hint.

This is defense in depth on top of the provider prompt, which also tells the model not to reveal the target answer.

## Privacy-shaped provider context

The provider receives only compact context needed for the hint:

- age band rather than exact age;
- language;
- reading level;
- language skill and current level;
- current exercise mode and compact clue data;
- target word/phrase because the model must reason about the vocabulary task;
- recent correctness / hint-use summary.

The request omits learner ID and exact age. Provider credentials remain server-side under the existing Agent Proxy boundary.

## Word Wizard integration

### Study mode

Study mode now records learning attempts and can request an AI-assisted hint in all non-copy modes.

A structured hint can locally produce:

- one revealed next letter;
- a first-letter clue;
- a masked word shape;
- the existing emoji/picture clue;
- a repeated French / picture / Chinese prompt cue;
- spoken target pronunciation;
- a generic retry cue.

The AI message is displayed only when the learner presentation allows text. Pre-readers can receive visual/audio presentation instead.

### Copy mode

Copy mode remains AI-free. It still records local learning attempts so the session history is complete, but it does not request model tokens and does not rewrite the learner's adaptive language level.

### Potion Shop

Potion Shop remains unchanged in v0.3.1. The first language integration is intentionally limited to Study mode so the learning behavior can be evaluated without changing the timed arcade loop.

## Adaptation

The existing deterministic session policy is reused:

```text
last 5 attempts
5 correct     → level up
4 correct     → maintain
2–3 correct   → support
0–1 correct   → level down
```

The LLM does not choose the level.

For exercise metadata, vocabulary modes currently map to increasing task difficulty:

- copy: 1
- recall / bopomofo: 2
- translate: 3
- sentences: 5

## Offline behavior

If the Agent Proxy is unavailable, a provider fails, a schema is invalid, a non-language strategy is returned, or the hint leaks the answer, Word Wizard continues with a local deterministic hint.

The child should never see provider/network error text.

## Main implementation files

### Learning runtime

- `packages/learning/src/language/VocabularyHintRequest.ts`
- `packages/learning/src/language/VocabularyHintFallback.ts`
- `packages/learning/src/language/VocabularyHintPresentation.ts`
- `packages/learning/src/language/VocabularyHintService.ts`
- `packages/learning/src/legacy/VocabularyLearningBridge.ts`
- `packages/learning/src/types.ts`

### Agent contracts

- `packages/agent/src/types.ts`
- `packages/agent/src/ResponseValidation.ts`
- `server/agent-proxy/src/prompt.ts`

### Existing UI/runtime integration

- `js/learning-runtime.js`
- `js/games/vocab.js`
- `index.html`
- `sw.js`

### Tests

- `scripts/vocabulary-learning.test.mjs`

## Acceptance criteria

v0.3.1 is accepted when:

- Word Wizard Study continues to use its existing UI and word pools;
- non-copy Study modes can request a `lesson_hint` through the shared AI gateway;
- copy mode uses zero AI calls;
- language hint strategies are structured and locally rendered;
- vocabulary hints cannot silently use math strategies;
- a hint that repeats the target answer is rejected;
- remote failure produces a local hint;
- pre-reader presentation can avoid text;
- response time, correctness and hint use are recorded;
- language sessions persist independently from math sessions;
- deterministic adaptation remains app-owned;
- provider secrets remain outside the browser;
- existing math and AI Lab behavior continue to pass regression tests.

## Validation on 2026-09-24

Passed:

- `npm run test:language`
- `npm run test:learning`
- `npm run test:agent-routing`
- `npm run test:ai-eval`
- `npm run typecheck:mobile`
- `npm run typecheck:agent`
- `npm run test:mobile`
- `node --experimental-default-type=module scripts/brain-host.test.mjs` — 19/19
- `node --experimental-default-type=module scripts/registry.test.mjs` — 10/10
- `node --experimental-default-type=module scripts/core.test.mjs` — 75/75

The broad legacy `scripts/check.mjs` gate reports **132 findings**, exactly the same count and finding set as the clean v0.3.0 baseline. v0.3.1 therefore adds no new findings to that known baseline.

## Recommended next slice

Do not add another subject immediately. The next useful step is to extend **AI Lab** so the same representative Math and Vocabulary hint cases can be run side by side across provider/model profiles and saved as small eval records. That will give us evidence for the later cheap/standard/reasoning routing policy instead of adding automatic escalation by intuition.
