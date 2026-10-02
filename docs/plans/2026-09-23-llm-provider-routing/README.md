# Summer Quest — Multi-Provider LLM Routing Plan
**Date:** 2026-09-23  
**Version:** v0.2.7 foundation

## Goal

Summer Quest must not be coupled to one LLM vendor or one intelligence/cost level.

Supported provider families from the architecture level:

- OpenAI direct;
- Anthropic direct;
- OpenRouter;
- additional providers later through the same `ProviderAdapter` contract.

## Current policy: manual first

v0.2.7 deliberately does **not** auto-escalate between models.

The protected server has one explicit default profile and an allow-list. The first production candidate is:

`openai-luna-cheap` → `gpt-6-luna` → low reasoning.

This should handle short child-facing phrasing, quest recommendations, simple structured classification and most lightweight Summer interactions.

Higher profiles are registered for controlled comparison only:

- Claude Haiku 4.5 low;
- Claude Sonnet 5 medium;
- GPT-6 Sol medium;
- OpenRouter free route for development/prototyping only.

## Why manual first

Before automatic escalation we need real Summer Quest evals measuring:

- correct schema adherence;
- safe age-appropriate phrasing;
- bilingual quality;
- tutor hint quality;
- hallucination/error rate;
- latency;
- tokens/request;
- cost/request.

Only then should task classes automatically map to different power levels.

## Future routing ladder

Later, after evals:

```text
Tier 0 — local deterministic
    ↓ only when AI adds value
Tier 1 — cheapest model / low reasoning
    ↓ retry or task policy
Tier 2 — stronger model / medium reasoning
    ↓ explicit difficult task
Tier 3 — high reasoning / premium model
```

Escalation must be based on task type and measurable failure/quality signals, not on the model deciding to spend more by itself.

## Cost guardrail

The child client never owns provider credentials and cannot authorize an expensive model.

Even when the client includes a `profileId`, the server may only honor profiles explicitly present in its allow-list. The default v0.2.7 allow-list should contain only `openai-luna-cheap`.

## Privacy

Provider requests continue to use the privacy-shaped Summer context:

- age band, not full birth date;
- quest/activity IDs and semantic state;
- compact learning state when required;
- no complete family profile;
- no unrestricted chat history;
- no provider key in Android/PWA.

## Task policy preparation

The code records advisory task classes such as:

- `child_phrase`;
- `quest_recommendation`;
- `activity_help`;
- `lesson_hint`;
- `lesson_explanation`;
- `lesson_plan`;
- `curriculum_authoring`.

For now these do not trigger automatic model changes. They are included so we can collect evals and later introduce deterministic routing without changing the agent protocol.
