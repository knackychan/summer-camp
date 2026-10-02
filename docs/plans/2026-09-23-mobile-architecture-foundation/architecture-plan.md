# Summer Quest — Mobile/Tablet Architecture Refactor Plan
**Date:** 2026-09-23  
**Version:** v0.2.5-plan  
**Status:** Architecture decision / migration plan  
**Target:** Android tablet first, browser/PWA retained, future iOS possible

---

# 1. Why the Current Structure Should Be Refactored

The current project has grown beyond the point where adding more logic to the existing page structure is a good long-term choice.

Current characteristics observed in the handover:

- `index.html` contains most of the kid-facing UI and interaction behavior.
- `index.html` is now roughly 3,500 lines.
- `admin.js` is roughly 2,400 lines.
- the project contains both:
  - classic scripts publishing `window.SQ*` globals;
  - ES module code for newer game/runtime systems.
- games already have their own host/registry concepts.
- the PWA/offline shell is valuable and should be preserved.
- the future system now includes:
  - Quest Engine;
  - persistent Summer assistant;
  - AI orchestration;
  - Learning Runtime;
  - Student Model;
  - Planet Home;
  - pre-reader UX;
  - rewards;
  - routines;
  - games;
  - Android-native capabilities.

The problem is therefore **not that JavaScript is incapable**.

The problem is that application state, rendering, navigation, domain logic and platform behavior are too closely mixed.

---

# 2. Primary Architecture Decision

## Do NOT rewrite the whole application in another language.

The recommended direction is:

> **TypeScript application core + modular web/game runtime + Capacitor-style Android shell + small native Kotlin capabilities where they add real value.**

This keeps almost all useful existing work while giving us a proper mobile architecture.

Recommended language split:

```text
TYPECRIPT
├── application/domain logic
├── Quest Engine
├── Learning Runtime
├── Student Model
├── AI orchestration
├── game host
├── Planet Home
├── UI state
├── offline sync logic
└── shared Android/browser behavior

HTML/CSS
├── application shell
├── semantic UI surfaces
└── rendered component templates

CANVAS / WEBGL
├── games
├── animated Planet Home if appropriate
├── science simulations
└── richer interactive learning scenes

KOTLIN
└── only native Android capabilities
    ├── notifications
    ├── haptics
    ├── background work
    ├── Android lifecycle
    ├── device integrations
    ├── audio focus if necessary
    └── secure/native storage where appropriate
```

Do not move Quest logic, learning logic or game rules to Kotlin unless a future technical requirement specifically demands it.

---

# 3. Why Not Flutter / React Native / Full Kotlin Rewrite

A full rewrite would throw away too much of the existing value.

Summer Quest already contains:

- browser-first games;
- DOM interfaces;
- Canvas/WebGL possibilities;
- JavaScript/TypeScript game infrastructure;
- PWA logic;
- offline behavior;
- web-based admin tools;
- existing content.

A React Native or Flutter rewrite would require many game and interactive-learning surfaces to be rebuilt.

A full Kotlin/Compose rewrite would create an even larger migration and would separate the browser version from the Android version.

For this project, the best tradeoff is:

```text
SHARED TYPESCRIPT PRODUCT
          │
          ├── Browser/PWA
          │
          └── Android native shell
```

Android becomes a first-class deployment target without becoming a completely different product.

---

# 4. Recommended Mobile Technology Shape

Conceptually:

```text
┌───────────────────────────────────────┐
│             ANDROID APP               │
│                                       │
│   Native shell / Capacitor bridge     │
│                                       │
│ ┌───────────────────────────────────┐ │
│ │       SUMMER QUEST WEB RUNTIME    │ │
│ │                                   │ │
│ │ TypeScript + HTML/CSS             │ │
│ │ Canvas/WebGL games                │ │
│ │ Quest Engine                      │ │
│ │ Learning Runtime                  │ │
│ │ Planet Home                       │ │
│ └───────────────────────────────────┘ │
│                                       │
│ Native services                       │
│ notifications / haptics / files etc. │
└───────────────────────────────────────┘
```

The web runtime should not know whether it is running:

- in Chrome;
- as an installed PWA;
- inside Android.

It talks to a `PlatformService`.

---

# 5. Platform Abstraction

Create one platform interface.

Example:

```ts
interface PlatformService {
  platform: "web" | "android";

  haptics: HapticsService;
  notifications: NotificationService;
  storage: StorageService;
  lifecycle: LifecycleService;
  audio: AudioPlatformService;
  speech?: SpeechService;
}
```

Then:

```ts
createWebPlatform()
createAndroidPlatform()
```

The rest of Summer Quest never calls Android APIs directly.

This is important because the product must remain usable as a browser/PWA application.

---

# 6. Do Not Split the Kid App Into Many Traditional HTML Pages

Although the current `index.html` needs to be broken apart, replacing it with:

```text
home.html
quests.html
learning.html
rewards.html
games.html
...
```

would not be the best mobile architecture.

A tablet application should behave like one persistent application.

Use:

```text
index.html
    ↓
AppShell
    ↓
Router / Screens
```

Then screens become TypeScript modules/components.

Conceptually:

```text
App
├── Planet Home
├── Quest
├── Learning
├── Adventure
├── Rewards
├── Profile
└── Activity Host
```

Only the root HTML shell remains.

---

# 7. The New `index.html`

The final `index.html` should eventually be extremely small.

Target:

```html
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
```

No business logic.

No application state.

No giant inline style block.

No giant inline script block.

The file should only bootstrap the application.

---

# 8. Admin Should Be a Separate Application

The parent interface and child application serve fundamentally different purposes.

Recommended:

```text
apps/
  kid/
  admin/
```

They share domain packages but have separate UI applications.

This gives us:

```text
Kid Android app
Kid browser/PWA

Papa browser dashboard
Optional future Papa mobile interface
```

The parent dashboard does not need to ship inside the child Android bundle unless we explicitly want it.

---

# 9. Recommended Monorepo Structure

Proposed target:

```text
summer-quest/

  apps/
    kid/
      src/
        app/
        screens/
        navigation/
        planet/
        companion/
        theme/
        main.ts
      index.html

    admin/
      src/
        app/
        screens/
        quest-studio/
        children/
        rewards/
        settings/
        main.ts
      index.html

    android/
      capacitor/
      native/
      resources/

  packages/

    core/
      src/
        events/
        ids/
        time/
        localization/
        types/

    state/
      src/
        store/
        persistence/
        migration/

    quests/
      src/
        QuestEngine.ts
        QuestEligibility.ts
        QuestLifecycle.ts
        QuestCatalog.ts
        QuestScoring.ts
        QuestTypes.ts

    routines/
      src/
        RoutineEngine.ts
        TimeWindows.ts
        RoutineTypes.ts

    rewards/
      src/
        RewardEngine.ts
        Wallet.ts
        RewardCatalog.ts

    learning/
      src/
        curriculum/
        student-model/
        tutor/
        scenes/
        evaluation/
        LearningRuntime.ts

    agent/
      src/
        SummerAgent.ts
        Planner.ts
        ContextBuilder.ts
        SessionMemory.ts
        providers/
        schemas/
        safety/

    activities/
      src/
        ActivityRegistry.ts
        ActivityRouter.ts
        ActivityAdapter.ts

    platform/
      src/
        PlatformService.ts
        web/
        android/

    sync/
      src/
        SyncService.ts
        Queue.ts
        Reconciliation.ts
        supabase/

    ui/
      src/
        controls/
        cards/
        overlays/
        transitions/
        icons/
        accessibility/

    audio/
      src/

    animation/
      src/

  games/
    kitchen-quest/
    checkout-quest/
    code-dojo/
    brain-gym/
    music-room/
    solar-system/
    ...

  content/
    curriculum/
    quests/
    rewards/
    books/
    localization/

  assets/
    common/
    characters/
    planet/
    audio/
    game/

  server/
    agent-proxy/
    parent-api/
    shared/

  tests/
    core/
    quests/
    learning/
    agent/
    integration/

  docs/
```

---

# 10. Why `packages/` Matters

The major systems should not belong to a page.

For example:

```text
QuestEngine
```

must not live in:

```text
kid/screens/home/
```

because quests are used by:

- Planet Home;
- Summer Agent;
- parent dashboard;
- notification system;
- rewards;
- learning;
- Android background tasks.

The same is true for:

- Learning Runtime;
- Student Model;
- routines;
- wallet;
- agent;
- synchronization.

They belong in independent domain packages.

---

# 11. Screens vs Domain Logic

A screen should only orchestrate presentation.

Example:

```text
PlanetHomeScreen
    ↓
QuestService
LearningService
RoutineService
SummerAgent
```

Bad:

```text
PlanetHomeScreen
    ↓
contains quest rules
contains reward calculation
contains AI prompts
contains Supabase calls
contains notification logic
```

This separation is the main defense against another monolith forming.

---

# 12. Planet Home Architecture

The Planet Home should become its own feature.

```text
apps/kid/src/planet/

  PlanetScreen.ts
  PlanetRenderer.ts
  PlanetCamera.ts

  world/
    WorldDefinition.ts
    WorldState.ts
    Zone.ts
    Hotspot.ts

  zones/
    DailyLifeZone.ts
    BrainZone.ts
    ScienceZone.ts
    ExplorerZone.ts
    PlayZone.ts
    RewardZone.ts

  interaction/
    HotspotController.ts
    GestureController.ts
    FocusController.ts

  presentation/
    PlanetAnimations.ts
    PlanetAudio.ts
```

This lets the home evolve toward:

- CSS/DOM;
- Canvas;
- WebGL;
- hybrid rendering;

without changing the rest of Summer Quest.

---

# 13. Planet Renderer Should Be Replaceable

Define:

```ts
interface PlanetRenderer {
  mount(root: HTMLElement): void;
  render(state: WorldState): void;
  focus(hotspotId: string): void;
  destroy(): void;
}
```

Then we can initially build a lightweight 2D/isometric renderer.

Later:

```text
DOM Planet Renderer
        ↓
Canvas renderer
        ↓
WebGL / Three.js renderer
```

The Quest system does not care.

The agent does not care.

Android does not care.

This is a good long-term boundary.

---

# 14. Learning Runtime Structure

The Learning Runtime should be a standalone package rather than another screen.

```text
packages/learning/

  curriculum/
    Curriculum.ts
    CurriculumGraph.ts
    Skill.ts
    SkillPrerequisite.ts

  student-model/
    StudentModel.ts
    Mastery.ts
    AttemptHistory.ts
    ErrorPatterns.ts

  tutor/
    TutorPlanner.ts
    TeachingStrategy.ts
    TutorContext.ts

  scenes/
    LearningScene.ts
    SceneRegistry.ts

    math/
      NumberLineScene.ts
      CountingScene.ts
      FractionScene.ts
      BaseTenScene.ts

    language/
      PictureWordScene.ts
      SentenceBuilderScene.ts
      PhonicsScene.ts

    history/
      TimelineScene.ts
      EventOrderScene.ts

    geography/
      MapScene.ts
      DirectionScene.ts

    science/
      DiagramScene.ts
      SimulationScene.ts

  evaluation/
    Evaluator.ts
    Attempt.ts

  LearningRuntime.ts
```

This is then rendered inside:

```text
apps/kid/src/screens/learning/
```

---

# 15. Separate Lesson Logic From Rendering

Example:

```text
TutorPlanner
    ↓
LearningScene definition
    ↓
SceneRenderer
```

The AI may create:

```json
{
  "type": "number_line",
  "start": 0,
  "end": 20,
  "target": 14,
  "operation": {
    "type": "subtract",
    "value": 7
  }
}
```

The app renders it.

This prevents arbitrary AI-generated code from entering the application.

---

# 16. Pre-Reader UI Should Be a Capability, Not a Separate App

Do not fork the application into:

```text
kid-small/
kid-big/
```

Instead define UI capabilities.

Example:

```ts
interface InteractionProfile {
  readingLevel: "pre_reader" | "early_reader" | "reader";
  textDensity: "none" | "low" | "normal";
  voiceGuidance: boolean;
  assistantDialogue: boolean;
  directExploration: boolean;
}
```

Then the Planet Home adapts.

For a pre-reader:

```text
Planet
→ large visual hotspot
→ sound
→ animation
→ activity
```

For an older child:

```text
Planet
→ Summer recommendation
→ quest description
→ activity
```

Same architecture.

---

# 17. Activity Plugin Architecture

Every game/activity should become independently registered.

Target:

```text
games/
  kitchen-quest/
    manifest.ts
    adapter.ts
    game/
    assets/

  checkout-quest/
    manifest.ts
    adapter.ts
    game/
    assets/
```

Manifest:

```ts
interface ActivityManifest {
  id: string;
  title: LocalizedText;
  category: string[];
  ageBands: string[];
  capabilities: string[];
  adapter: ActivityAdapterFactory;
}
```

The global app should never import internal game logic directly.

It loads through `ActivityRegistry`.

---

# 18. Generic Activity Adapter

```ts
interface ActivityAdapter {
  start(context: ActivityLaunchContext): Promise<void>;

  pause(): Promise<void>;
  resume(): Promise<void>;
  exit(): Promise<void>;

  getState(): ActivityPublicState;

  getTutorContext?(): TutorContext;

  getProgress(): ActivityProgress;
}
```

This is how Summer can help inside games.

---

# 19. Native Android Project

The native Android folder should remain thin.

Example:

```text
apps/android/

  android/
    app/
      src/main/java/.../

        MainActivity.kt

        plugins/
          SQNotificationsPlugin.kt
          SQHapticsPlugin.kt
          SQLifecyclePlugin.kt
          SQAudioPlugin.kt
```

These native classes should expose capabilities to TypeScript.

Avoid reproducing business logic in Kotlin.

---

# 20. What Native Android Should Handle

Good native candidates:

## Notifications
- routine reminder;
- quest availability;
- parental-approved reminder.

## Background tasks
- scheduled local processing;
- sync retry;
- reminder scheduling.

## Haptics
- taps;
- success;
- warnings;
- game feedback.

## Device lifecycle
- background;
- foreground;
- suspend;
- restore.

## File/device storage
When browser storage is insufficient.

## Audio integration
If Android audio focus / latency requires it.

## Text-to-speech
Potentially useful for pre-reader mode.

## Speech recognition
Potential future feature, but not required for the first Android version.

---

# 21. What Android Should NOT Handle

Do not put these in Kotlin:

- quest eligibility;
- rewards;
- tuition logic;
- curriculum;
- Student Model;
- Summer prompts;
- game progression;
- routine rules.

They must remain portable and testable in TypeScript.

---

# 22. Storage Strategy

Create a storage abstraction now.

```ts
interface StorageDriver {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  transaction<T>(...): Promise<T>;
}
```

Drivers:

```text
IndexedDbStorage
AndroidSqliteStorage   // optional later
MemoryStorage          // tests
```

The application should not call `localStorage` directly.

---

# 23. Offline-First Mobile Model

Android must remain useful without Internet.

Local first:

```text
UI
 ↓
LOCAL STATE
 ↓
LOCAL DATABASE
 ↓
SYNC QUEUE
 ↓
CLOUD
```

Never:

```text
UI
 ↓
CLOUD
 ↓
STATE
```

This matters especially for:

- children using a tablet around the house;
- intermittent Wi-Fi;
- games;
- routines;
- reward events;
- learning progress.

---

# 24. Synchronization Should Become Its Own Package

Current cloud logic should progressively move behind:

```text
SyncService
```

Example:

```text
packages/sync/

  SyncService.ts
  SyncQueue.ts
  SyncOperation.ts
  ConflictResolver.ts

  repositories/
    QuestRepository.ts
    ProgressRepository.ts
    RewardRepository.ts

  providers/
    SupabaseSyncProvider.ts
```

This stops UI modules from directly knowing how Supabase works.

---

# 25. Agent Proxy Must Be Server-Side

The mobile app must not contain an OpenAI API key.

Recommended:

```text
Android / PWA
      │
      ▼
Summer Agent Provider
      │
      ▼
Protected Summer Quest endpoint
      │
      ▼
LLM API
```

The client sends only the structured, privacy-shaped context we already designed.

---

# 26. Server Folder

A lightweight backend can remain TypeScript initially.

```text
server/

  agent-proxy/
    routes/
    providers/
    schemas/
    safety/
    rate-limit/

  parent-api/

  shared/
```

There is currently no strong reason to introduce another backend language.

If a future high-performance service genuinely requires it, it can be added independently.

---

# 27. State Architecture

Avoid one enormous global mutable object.

Use domain stores:

```text
AppSessionStore
QuestStore
RoutineStore
LearningStore
ActivityStore
RewardStore
ProfileStore
WorldStore
AgentStore
```

Domain engines remain pure where possible.

Example:

```text
QuestEngine
```

receives state and returns decisions.

It does not manipulate DOM.

---

# 28. Events

Maintain an application event bus.

Example:

```text
QUEST_STARTED
QUEST_COMPLETED
QUEST_REQUIRES_VERIFICATION

ROUTINE_DUE

LEARNING_SCENE_STARTED
LEARNING_ATTEMPT_RECORDED
SKILL_MASTERY_CHANGED

ACTIVITY_STARTED
ACTIVITY_EXITED

REWARD_UNLOCKED

APP_FOREGROUNDED
APP_BACKGROUNDED
```

This is especially valuable on Android because lifecycle events can enter the same event system.

---

# 29. Navigation Model

Child app navigation should be mobile-like.

Primary destinations:

```text
PLANET
ADVENTURE
REWARDS
PROFILE
```

But Planet should be the actual emotional home.

Activities should push onto a navigation stack.

Example:

```text
Planet
  ↓
Science Garden
  ↓
Water Cycle
  ↓
back
Science Garden
  ↓
back
Planet
```

A Back action should behave consistently both:
- in browser;
- with Android system back.

---

# 30. Android Back Button

Create a navigation abstraction.

```ts
interface NavigationService {
  push(route: Route): void;
  replace(route: Route): void;
  back(): boolean;
}
```

Android's Back button calls:

```text
NavigationService.back()
```

not browser history directly.

This prevents Android navigation from becoming a later hack.

---

# 31. Responsive Philosophy

Do not build "desktop then responsive".

Primary design targets:

```text
tablet landscape
tablet portrait
phone portrait
```

Desktop browser becomes an additional presentation mode.

Important:
- touch targets >= comfortable finger size;
- no hover-dependent actions;
- safe areas;
- no fixed desktop widths;
- split panes only when screen size permits;
- landscape game surfaces can request/prefer landscape when packaged on Android.

---

# 32. Screen Architecture

Suggested kid screen structure:

```text
apps/kid/src/screens/

  planet/
    PlanetScreen.ts

  quests/
    QuestScreen.ts
    QuestDetailScreen.ts

  learning/
    LearningSessionScreen.ts

  activity/
    ActivityHostScreen.ts

  rewards/
    RewardScreen.ts

  profile/
    ProfileScreen.ts
```

Each screen should normally stay under a manageable size.

Large systems are split into:
- controllers;
- renderers;
- view models;
- components.

---

# 33. UI Component Strategy

We do not necessarily need React.

A lightweight component architecture is sufficient if disciplined.

Possible direction:

```text
TypeScript
+ Web Components or lightweight typed view modules
+ Vite
```

The crucial requirements are:
- modules;
- explicit ownership;
- typed inputs;
- controlled lifecycle;
- no inline global script;
- no direct cross-feature DOM manipulation.

Do not add a large framework simply to solve organization.

---

# 34. When a UI Framework Could Be Justified

A framework becomes worthwhile if:

- parent dashboard grows significantly;
- component state becomes difficult to maintain manually;
- route/layout composition becomes complex;
- accessibility/state synchronization benefits clearly.

Even then, the domain packages should remain framework-independent.

We should be able to replace:

```text
UI implementation
```

without replacing:

```text
QuestEngine
LearningRuntime
Agent
StudentModel
Sync
```

---

# 35. Build System

Introduce a real build system.

Recommended responsibilities:

```text
TypeScript compile/type-check
ES module bundling
code splitting
asset hashing
development server
Android build output
PWA manifest/service worker output
```

The browser should no longer rely on carefully ordered `<script>` tags.

The module graph should determine load order.

---

# 36. Service Worker

The service worker remains important.

But it should become generated/configured from the build rather than being responsible for understanding application architecture.

It should cache:
- shell;
- game assets;
- learning components;
- static content.

Dynamic state stays in storage/sync services.

---

# 37. Content Must Be Data

Educational and quest content should not be embedded in UI files.

Target:

```text
content/

  curriculum/
    math/
    language/
    history/
    geography/
    science/

  quests/
    household/
    hygiene/
    plants/

  localization/
    en/
    zh-TW/

  rewards/
```

This makes future content generation and AI-assisted authoring far easier.

---

# 38. Migration From `window.SQ*`

Do not remove every global at once.

Use adapters.

Example:

```ts
LegacyDayAdapter
LegacyStarAdapter
LegacyBrainGymAdapter
```

They translate old behavior into the new package interfaces.

Then progressively retire them.

Migration:

```text
window.SQDay
     ↓
LegacyDayAdapter
     ↓
RoutineService
```

Later:

```text
RoutineService
```

becomes independent and the old global disappears.

---

# 39. Migration of `index.html`

## Stage 1
Extract CSS and scripts without behavior changes.

## Stage 2
Create:
- `main.ts`;
- `AppShell`;
- `NavigationService`.

## Stage 3
Move major surfaces individually:
- Planet;
- Quest;
- Adventure;
- Rewards.

## Stage 4
Remove inline application logic.

## Final

`index.html` becomes only a bootstrap shell.

---

# 40. Migration of `admin.js`

Split by feature.

Example:

```text
apps/admin/src/

  app/
    AdminApp.ts

  quest-studio/
    QuestStudioController.ts
    QuestEditor.ts

  children/
    ChildrenScreen.ts

  rewards/
    RewardsAdmin.ts

  routines/
    RoutineEditor.ts

  sync/
    AdminSyncStatus.ts
```

Again, shared rules belong in `packages/`, not duplicated in admin.

---

# 41. Game Migration

Games should migrate independently.

No need for one giant rewrite.

Sequence:

```text
existing game
    ↓
wrap in ActivityAdapter
    ↓
register manifest
    ↓
move into games/<game>
    ↓
remove legacy global dependencies when convenient
```

This is low risk.

---

# 42. What Could Eventually Use Another Language

Another language should only be introduced for an actual technical advantage.

Potential future candidates:

## Kotlin
Android-only native APIs.

## Rust
Potential future use for:
- very high-performance simulation;
- shared deterministic engine compiled to WASM;
- heavy data processing.

There is currently no need for Rust.

## Python
Could be useful for:
- offline curriculum generation tools;
- asset processing;
- dataset preparation;
- development pipelines.

Python should not become the mobile runtime.

---

# 43. Recommended Language Policy

```text
TypeScript = product language
Kotlin     = Android platform language
Python     = tooling/content pipelines
SQL        = persistence/schema
```

This is enough.

Avoid introducing more languages unless clearly justified.

---

# 44. Target Runtime Boundaries

```text
┌────────────────────────────────────────────┐
│              PRESENTATION                  │
│ Planet / Screens / Animations / Components │
└───────────────────┬────────────────────────┘
                    │
┌───────────────────▼────────────────────────┐
│             APPLICATION LAYER              │
│ Navigation / orchestration / session       │
└───────────────────┬────────────────────────┘
                    │
┌───────────────────▼────────────────────────┐
│               DOMAIN LAYER                 │
│ Quest / Learning / Routine / Reward        │
└───────────────────┬────────────────────────┘
                    │
┌───────────────────▼────────────────────────┐
│                SERVICES                    │
│ Agent / Sync / Storage / Activity Registry │
└───────────────────┬────────────────────────┘
                    │
┌───────────────────▼────────────────────────┐
│               PLATFORM                     │
│ Web / Android                              │
└────────────────────────────────────────────┘
```

Dependencies should primarily move downward.

The Quest Engine should never import Planet UI.

The Learning Runtime should never import Android.

The Android bridge should never contain curriculum logic.

---

# 45. Target Android Experience

The final Android application should feel native even though most of the product runtime is web-based.

Requirements:

- instant app startup;
- offline shell;
- full touch interaction;
- Android back support;
- haptic feedback;
- local notifications;
- orientation handling;
- safe area support;
- background/foreground restoration;
- persistent activity state;
- minimal visible WebView behavior;
- no browser chrome;
- no dependency on an always-online API.

The child should not be able to tell that the game/activity runtime is implemented using web technologies.

---

# 46. Recommended Next Architecture Milestone

The next implementation milestone should be:

## `Summer-Quest-2026-09-23-v0.2.5-Mobile-Architecture-Foundation`

It should **not** attempt to migrate the entire application.

It should establish the new skeleton:

1. TypeScript build pipeline.
2. `apps/kid` shell.
3. shared `packages/core`.
4. `packages/platform`.
5. `packages/activities`.
6. `packages/quests`.
7. navigation abstraction.
8. storage abstraction.
9. compatibility adapter for existing `window.SQ*` services.
10. one existing screen routed through the new shell.
11. one existing activity routed through `ActivityRegistry`.
12. Android/Capacitor project placeholder or initial shell.

Then move features incrementally.

---

# 47. Migration Rule

At every stage:

> **The application must remain runnable.**

Do not do a multi-week rewrite where nothing works until the end.

Use a strangler migration:

```text
OLD SYSTEM
████████████████████

v0.2.5
██████████████░░░░░░

v0.2.6
██████████░░░░░░░░░░

v0.3.x
████░░░░░░░░░░░░░░░░

NEW SYSTEM
░░░░░░░░░░░░░░░░░░░░
```

New systems take over feature by feature.

---

# 48. Architectural Non-Negotiables

From this point forward:

1. No new large inline scripts in HTML.
2. No new business logic in HTML.
3. No new `window.*` globals unless implementing a temporary legacy bridge.
4. New domain logic must be TypeScript.
5. UI cannot directly talk to Supabase.
6. UI cannot directly talk to OpenAI.
7. OpenAI keys never exist in the child app.
8. Native Android APIs go through `PlatformService`.
9. Games integrate through `ActivityAdapter`.
10. Learning content integrates through `LearningScene`.
11. Quest/routine/reward state has a single domain owner.
12. Offline functionality remains first class.
13. Pre-reader behavior is a profile/capability, not a forked app.
14. Parent and child UIs share domain packages but remain separate applications.

---

# 49. Final Recommendation

Summer Quest does **not** need a full rewrite into a different language.

It needs a **real application architecture**.

The recommended target is:

```text
TYPECRIPT MONOREPO
      │
      ├── Kid App
      │     ├── Planet Home
      │     ├── Quest
      │     ├── Learning Runtime
      │     └── Games
      │
      ├── Parent App
      │
      ├── Shared Domain Packages
      │
      ├── Activity Plugins
      │
      └── Agent Services
            │
            ▼
      Platform Abstraction
         │           │
         ▼           ▼
       PWA         Android
                    │
                    ▼
              Thin Kotlin layer
```

This gives us a system capable of growing into the full vision:

- an explorable Planet Home;
- pre-reader play;
- AI-assisted tutoring;
- household quests;
- routines;
- mini-games;
- persistent Summer companion;
- Android tablet deployment;

without continuing to increase the size and coupling of one giant HTML application.
