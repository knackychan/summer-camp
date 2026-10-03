# v0.2.1 — Persistent Summer Companion, Quest Lifecycle and Verification

Date: 2026-09-23

## Goal

Move Summer from a home-screen recommender to a persistent application companion while keeping quest state, rewards and parent authority deterministic.

This milestone does **not** introduce a remote LLM. It establishes the contracts that a future remote provider can use safely.

## Quest lifecycle

A quest can now be in these states:

- `not_started`
- `in_progress`
- `paused`
- `awaiting_verification`
- `redo`
- `completed`

Progress is local-first and records the current step. Parent-verification rows are reconciled from the existing `asks` channel when sync is available.

A rejected verification is tied to the exact request/attempt that created it. Starting again clears that verification so a stale answered row cannot force the new attempt back into `redo`.

## Parent verification

Quest rules can use:

```text
verification = self
verification = parent
```

For `parent` quests:

1. The child completes the visible steps.
2. The kid app creates a `quest_verify:<questId>:<YYYY-MM-DD>` Ask request.
3. Papa sees the request in the existing operational queue.
4. Papa can Approve or Redo.
5. Approval creates the deterministic quest star row and answers the request.
6. The kid reconciles the answered request and transitions to `completed`.
7. Redo returns the quest to `redo`; a new attempt starts cleanly.

The LLM has no completion/approval tool.

## Persistent Summer companion

Summer is now a globally available child-side companion rather than only a recommendation sentence.

The companion reads a minimal context:

- active quest;
- quest lifecycle state;
- current application surface;
- current activity context when available.

Local responses cover:

- resume an active/paused quest;
- explain that a quest is waiting for Papa;
- encourage a redo attempt;
- open the Quest Board;
- open Today;
- request contextual activity help;
- close the companion.

This works offline.

## Activity routing contract

`SQActivityRouter` is the stable seam between the global assistant and existing Summer Quest activities.

Existing games remain unchanged. The host can route normal application actions today; individual activities can later register adapters exposing:

```text
getContext()
getHelpContext()
open(action)
```

This avoids coupling the assistant to game internals.

## Agent tool safety

The MCP-like tool registry exposes only controlled navigation/read capabilities:

```text
context.get
quest.list_available
quest.get_active
quest.open
quest.resume
activity.open
activity.context
routine.open_today
assistant.open
reminder.request
```

It deliberately does not expose:

- quest completion;
- quest verification;
- star/coin mutation;
- reward approval;
- parent-rule mutation.

## Android direction

The persistent companion, routing layer and reminder requests stay behind app/platform contracts rather than DOM-only assumptions. This keeps the quest/agent architecture portable to a future Capacitor/native Android shell.

## Validation

`node scripts/quest-agent.test.mjs` validates:

- start/pause/resume;
- step progress;
- verification request;
- redo;
- stale-verification isolation;
- approval;
- quest normalization;
- active/redo ranking;
- activity router seam;
- deterministic offline companion output.

The canonical `scripts/check.mjs` still reports the same known 132 failures as the supplied expanded baseline (missing omitted book assets, missing git metadata, and pre-existing Brain Gym token checks). v0.2.1 adds no new full-gate failures.
