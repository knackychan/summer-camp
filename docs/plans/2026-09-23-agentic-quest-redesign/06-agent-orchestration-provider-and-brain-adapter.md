# Slice 06 — Agent orchestration, protected provider and first activity adapter

**Package:** Summer Quest 2026-09-23 v0.2.2
**Approved direction:** continuation of Papa-approved 2026-09-23 agentic quest redesign.

## Goal

Move Summer from a UI helper into an application-level orchestration service without giving the model authority over quest completion, rewards or parent rules.

This slice also proves one real in-activity context adapter using Brain Gym.

## Architecture

```text
Semantic app events
      ↓
SQAgentOrchestrator
      ├── tiny session memory
      ├── attention / reminder intents
      └── context refresh
              ↓
        SQAgentContext
              ↓
         SQSummerAgent
        ↙             ↘
local deterministic   protected remote provider
        fallback       (optional backend)
```

The activity path is:

```text
Brain Gym state
      ↓
SQBrainActivityAdapter
      ↓
SQActivityRouter
      ↓
SQAgentContext
      ↓
Summer help
```

## Remote provider boundary

`SQAgentProvider` never calls a model vendor directly from the tablet.

`js/config.js` may optionally specify:

```js
SUMMER_AGENT_ENDPOINT: "/api/summer-agent"
```

The endpoint is a protected backend owned by the deployment. API/model secrets live there, never in the PWA or future APK.

The client POST body contains only:

```json
{
  "version": 1,
  "stage": "recommend",
  "context": { "...structured minimal context...": true }
}
```

The provider response is validated before it reaches the UI:

- bilingual speech is required;
- quest IDs are intersected with the already-filtered valid quest set;
- companion actions use an allow-list;
- energy/intent question choices use fixed allow-lists;
- emotion/animation IDs use fixed allow-lists;
- basic markup/control characters are stripped;
- dynamic agent copy is HTML-escaped again when inserted into rich UI containers;
- timeout/error/invalid response falls back to the deterministic local Summer provider.

## Privacy-shaped context

`SQAgentContext` is the only object intended for the remote provider.

It includes:

- age band, not exact age;
- current day/time bucket;
- current energy / activity preference;
- Quest Coin balance;
- daily-essential completion ratio;
- active quest summary;
- up to six already-valid quest options;
- current semantic activity state;
- recent event *types* only.

It deliberately does not include:

- child display name;
- exact birth date;
- address or location;
- school data;
- photos/audio;
- Ask bodies;
- free-form conversation transcripts;
- full progress/database state.

## Session memory

`SQAgentMemory` uses session-scoped local storage.

Stored information is intentionally small:

- energy choice;
- quest-intent choice;
- recent semantic event names;
- per-activity help count;
- latest assistant event.

Memory expires after 12 hours and is not a conversation transcript. Obvious free-form/personal fields are dropped by the memory sanitizer.

The Quest Board reuses the current session's energy/intent choices instead of asking the same questions every time the child returns. **Reset questions** clears that session memory.

## Event orchestration

`SQEventBus` carries semantic events such as:

```text
APP_OPENED
CHILD_PREFERENCE
QUEST_STARTED
QUEST_PAUSED
QUEST_COMPLETED
QUEST_VERIFICATION_REQUESTED
QUEST_VERIFICATION_RESOLVED
ACTIVITY_OPENED
CHILD_REQUESTED_HELP
```

The event bus does not contain DOM events or model instructions.

`SQAgentOrchestrator` reacts deterministically. Current responsibilities:

- remember the small interaction state;
- surface companion attention for redo / currently due essentials;
- request future native reminders for required quests;
- keep reminder scheduling idempotent, including concurrent refreshes.

It does not complete quests or award currency.

## Android reminder contract

Required quest reminders are emitted through:

```text
SQPlatform.scheduleNotification(...)
```

The current browser adapter safely reports `supported:false`. A future Android/Capacitor adapter owns actual native scheduling.

The reminder request carries:

- stable notification ID;
- child slot;
- quest ID;
- local family day/time;
- bilingual English + Traditional Chinese title/body payloads;

No long-running browser timer is required for background reminders.

## First real Activity Adapter — Brain Gym

`SQBrainActivityAdapter` reads semantic Brain Gym data supplied by the host:

- activity/game title;
- skill category;
- current item index;
- item total;
- current phase;
- hint level;
- high-level objective.

It does **not** scrape the DOM and does not expose the current correct answer.

Summer can now provide contextual Brain Gym assistance such as:

> Work out only the current problem. Try a smaller step before guessing.

and its Traditional Chinese equivalent.

The deterministic adapter help is the offline fallback. If a remote Summer provider is configured, the same semantic activity context can be used to produce a more natural explanation.

## Safety / authority boundary

The previous tool restrictions remain unchanged. The remote model still has no tool for:

- `quest.complete`;
- star / coin mutation;
- Papa approval;
- reward approval;
- parent rule mutation.

The model can communicate and request safe navigation through the existing tool registry; state authority remains in application services and parent flows.

## DONE WHEN

- remote provider can be configured without any model secret in client assets;
- an invalid/failed remote result falls back to local Summer;
- provider cannot recommend a quest ID outside the locally valid set;
- exact child age/name are absent from provider context;
- energy/intent choices survive navigation during the current app session;
- reset clears those session choices;
- semantic quest events are emitted at lifecycle transitions;
- required future routines create at most one native reminder request per quest/day even under concurrent refreshes;
- persistent companion can ask for activity help and use the semantic activity context;
- Brain Gym exposes a real adapter without DOM scraping or correct-answer leakage;
- v0.2.1 lifecycle tests still pass;
- v0.2.2 orchestration tests pass;
- the full handover gate has no failures beyond the supplied baseline failures.
