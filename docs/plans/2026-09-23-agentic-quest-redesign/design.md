# Summer Quest — Agentic Quest Redesign

**Approved direction:** 2026-09-23 (Papa gave freedom on file/folder architecture and UI/UX)

## Product decision

Summer Quest is no longer schedule-first. The child experience is quest-first and answers **“What can I do now?”**. Time, routines, parent rules, completion history and child preference constrain the available quest set; they do not define the primary navigation.

The old My Day schedule remains as a migration source and parent-visible routine view. It is not deleted in this slice.

## Core rules

1. **The agent never owns state.** It recommends and calls typed app tools.
2. **Filter locally before AI.** The model never receives invalid or locked actions.
3. **Offline works.** Quest browsing, task completion, games and routines work without an LLM.
4. **Short child interaction.** Prefer 0–1 question and large visual choices over chat.
5. **Coach, not cop.** No shame, red lateness, punitive language or forced minute tracking.
6. **Bilingual child UI.** English + Traditional Chinese.
7. **Android-ready boundaries.** Browser APIs sit behind platform/provider interfaces so a later Capacitor/native shell can replace them.
8. **No OpenAI key in the client.** A future remote LLM provider must use a protected backend/proxy.

## Target child navigation

- **Quests** — dynamic “what can I do now?” home.
- **Adventure** — games, learning, activities, books and music.
- **Rewards** — existing achievement/reward view; economy evolves later.
- **Ask** — existing family help channel.
- **Today** — legacy routine/timeline retained as a secondary view during migration.

The top chip strip becomes mobile-style bottom navigation in the child hub. Sub-views such as Games remain implementation details behind Adventure.

## Agent architecture

```text
UI
 ↓
Summer Agent facade
 ↓
Context Builder
 ↓
Tool Registry
 ↓
Quest / Routine / Activity / Reward services
 ↓
Persistent state + sync
```

The first slice ships a deterministic local Summer provider. A remote provider can later be injected without rewriting the UI.

## Android direction

The web/PWA build remains the current runtime, but new architecture should map cleanly to Android:

- use `100dvh` / safe-area insets;
- coarse-pointer first, no hover dependency;
- central navigation state that can later handle Android back;
- platform bridge for haptics, TTS, notifications, camera, microphone and keep-awake;
- no direct OpenAI credentials in web or APK bundles;
- storage/sync behind services, not DOM code;
- event-driven reminders rather than page timers as the long-term model.

## This source-pack slice

Included in this implementation:

- quest catalog seed;
- deterministic Quest Engine;
- local quest completion store;
- local Summer structured recommendation provider;
- platform bridge seam;
- Quest-first child home;
- Adventure launcher;
- migration-safe Today access;
- offline/service-worker registration of new assets;
- deterministic per-day quest reward IDs for the existing star ledger.

Not included because the remote pack omits the implementation:

- deep in-game assistant adapters for individual games;
- Checkout Quest/Kitchen Quest-specific semantic state;
- full server-side LLM proxy;
- synced quest history schema/migration;
- native Android notification/background scheduling.

Those are follow-on slices, not blockers for the new shell.

## Expanded handover update — v0.2.2

The later 20 MB handover includes real Brain Gym/game host code. v0.2.2 therefore adds the first semantic activity adapter for Brain Gym. Kitchen Quest and Checkout Quest are still outside this checkout, so their deep adapters remain future work.


## Interaction layer update — v0.2.3

The agent orchestration layer now feeds a dedicated `SQSummerUI` presenter. Agent-provided emotion and animation values are allow-listed and translated into local visual states; they never become arbitrary UI/CSS instructions. The Quest hub uses a short two-step visual question flow, category-accented quest cards, and a proactive nudge surface. Nudges are hub-only and dismissible; active games and activities receive only the persistent Summer badge so play is not interrupted. All new motion has a reduced-motion fallback and avoids newer CSS dependencies that would complicate older Android WebView support.
