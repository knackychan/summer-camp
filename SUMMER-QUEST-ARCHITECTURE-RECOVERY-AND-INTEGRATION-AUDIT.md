# Summer Quest — Architecture Recovery & Integration Audit

## Mission

You are working locally on the **original Summer Quest repository**, from before the recent UI/theme/Android/3D-world work began.

The current working directory is a **merged/overlaid tree**:

- the original pre-theme Summer Quest architecture is still present;
- newer v0.6.0/v0.6.1 files have been pasted on top of it;
- the Android native project was originally generated from the older repo and is still present;
- the physical Android tablet launches successfully;
- however, the product architecture and runtime behavior are clearly inconsistent.

Your job is to perform a **deep architecture audit first**, then propose the safest way to integrate the original working application with the useful newer architecture.

Do **not** assume the newest files are correct.

Do **not** assume the oldest architecture should simply be restored unchanged.

Treat both as evidence.

---

# Current observed state

## What works

The Android build toolchain works on the user's Windows machine.

The current generated Android payload reports:

```json
{
  "version": 2,
  "release": "v0.6.1",
  "runtime": "unified-root",
  "entry": "index.html",
  "localOnlyConfig": true,
  "fileCount": 279,
  "treeSha256": "d83f338262501c1b69c1c53ae8d89f290f2e7e0b66aaf54e8bee726647f573c6"
}
```

This file is located at:

```text
apps/android/android/app/src/main/assets/public/android-build.json
```

The generated Android `index.html` contains the newer world markup:

```text
<button class="world-menu" id="worldClassic">☰ Classic menu</button>
```

and:

```text
<div class="world-status hidden" id="worldStatus">
  <b>3D world unavailable</b>
  <span>You can still use the Classic menu. · 仍可使用傳統選單。</span>
</div>
```

The generated Android `index.html` also contains older/internal code paths such as:

```text
startLegacy(...)
```

and comments mentioning:

```text
legacy:false
```

Therefore:

> **Do not assume the Android APK contains the wrong `index.html`. The v0.6.1 root entry is present.**

The remaining issue is likely runtime/state/navigation/source interaction.

---

# What the user physically sees on the tablet

The tablet currently shows a screen with:

```text
Summer Quest
SUMMER WORLD · 夏日世界
Where do you want to explore?
你想去哪裡探險？

Daily Life
生活任務

Brain Island
頭腦島

Play Park
遊戲樂園

Science Garden
科學花園

Tap a place to visit it.
點一個地方開始。

LEGACY
```

There is also a vertical right-side navigation with entries such as:

```text
World
Quests
Adventure
```

Visually this is still the older flat "planet/world selector" experience.

The user expected a real small explorable 3D world.

This screen must be traced to its **exact source and runtime path**.

Do not infer its origin from appearance.

---

# Historical context

## Original Summer Quest

The original repository contained the actual accumulated product:

- child selection
- games
- activities
- books
- Music Room
- learning
- quests
- rewards
- navigation
- saved state
- adaptive learning systems
- Science
- Geography
- History
- Math
- Language
- original game launchers
- original content IDs
- existing internal routing assumptions

This original architecture is important because it contains the real working content.

---

## Later architecture work

Later work introduced concepts including:

- `apps/kid`
- `apps/android`
- Capacitor
- Android web packaging
- `dist/android-web`
- alternate child shell / modern UI
- `legacy.html`
- iframe hosting
- Android native bridge
- Back handling
- content registry concepts
- `SQContentRegistry`
- root-runtime changes
- world-explorer code
- Three.js
- 3D-world CSS
- Classic menu fallback
- localStorage migrations
- PWA/service-worker changes

Some of that work was useful.

Some of it was architecturally wrong.

---

# Known prior architecture failure

At one stage Android effectively became:

```text
Android / Capacitor
       ↓
new child shell
       ↓
iframe
       ↓
real Summer Quest app
```

Some old content contained links such as:

```text
../index.html#books
```

Inside the Android packaging layout, those links could resolve back to the new shell rather than the intended real-app hub.

This could produce:

```text
shell
  └── iframe
       └── shell
            └── iframe
                 └── shell
```

Symptoms included:

- duplicated `← Summer Quest`
- duplicated chevrons/back controls
- progressively broken UI after repeated navigation
- confusing Back behavior
- multiple navigation owners
- shell-inside-shell recursion

This architecture must **not** return.

---

# v0.6.0 / v0.6.1 intended correction

The intended newer principle was:

> The root Summer Quest runtime should be the one authoritative application.

The proposed 3D world was supposed to be only a new screen inside that runtime.

The intended model was approximately:

```text
Summer Quest authoritative runtime
        │
        ├── child/profile state
        ├── one navigation system
        ├── real games
        ├── real books
        ├── Music Room
        ├── learning
        ├── quests/rewards
        │
        ├── Classic hub
        │
        └── 3D exploration world
                 │
                 └── launches SAME real content
```

The 3D world must **not** become another application shell.

---

# User's desired 3D-world direction

The user does **not** want another flat globe/planet selector.

The desired experience is closer to a miniature Animal-Crossing-like world:

- genuine 3D environment;
- small island/world;
- camera can rotate around it;
- touch drag rotates/looks around;
- pinch provides bounded zoom;
- activities exist as buildings/places/props;
- children discover them visually;
- young children should not depend on reading;
- tapping a place launches the real existing activity;
- returning from content returns to the same world;
- later the world may contain characters, rewards, decorations, day/night, etc.

The world should be a **view/controller over existing content**, not a new content implementation.

---

# Primary objective

Recover a clean architecture in which:

1. There is exactly **one authoritative Summer Quest application**.
2. There is exactly **one navigation/state owner**.
3. Existing games/books/music/learning/quests remain the authoritative real content.
4. Android packages and launches that same runtime.
5. The Classic UI and future 3D world are alternate surfaces/views over the same underlying runtime.
6. No iframe is used to host the main application inside another application.
7. No second router is introduced for the 3D world.
8. No second content database competes with the real original content catalogs.
9. Existing content IDs and return behavior remain stable where possible.
10. The future 3D world can consume a normalized content registry without owning navigation.

---

# Phase 1 — Audit before editing

Do **not** begin by patching visible UI symptoms.

First map the architecture.

Produce:

```text
docs/audits/SUMMER-QUEST-ARCHITECTURE-RECOVERY-AUDIT.md
```

or an equivalent clearly named report.

The report must contain evidence, file paths, call chains, and architecture diagrams.

---

# Audit A — Identify every application entry point

Find every candidate entry point, including:

- root `index.html`
- `apps/kid`
- Android entry files
- PWA entry
- generated `dist/android-web/index.html`
- any `legacy.html`
- any prototype/admin/demo entry
- iframe hosts
- old planet/world entry screen
- 3D-world entry screen

For each, document:

| Entry | Source file | Purpose | Source/generated | Currently reachable? | Should survive? |
|---|---|---|---|---|---|

Determine which entry is actually authoritative.

---

# Audit B — Locate the exact tablet screen

Search the **entire repository**, not only `index.html`, for:

```text
Where do you want to explore?
你想去哪裡探險？
SUMMER WORLD
夏日世界
Daily Life
生活任務
Brain Island
頭腦島
Play Park
遊戲樂園
Science Garden
科學花園
Tap a place to visit it.
點一個地方開始。
LEGACY
```

Search:

- HTML
- JS
- TS
- JSON
- CSS pseudo-content
- generated files
- templates
- static assets
- localization dictionaries

Report:

1. exact source file(s);
2. exact function/component responsible;
3. route/state required to display it;
4. whether it is original architecture or newer overlay code;
5. whether `LEGACY` is intentionally user-facing or a debug marker;
6. why this screen wins over the new world at runtime;
7. whether the 3D world exists but fails initialization;
8. whether world initialization falls back automatically;
9. whether localStorage/session state selects this path;
10. whether a JS exception causes fallback.

This is a **blocking audit item**.

---

# Audit C — Trace runtime startup end-to-end

Trace the actual startup chain:

```text
Android MainActivity
        ↓
Capacitor WebView
        ↓
assets/public/index.html
        ↓
script loading order
        ↓
startup/init
        ↓
stored state restoration
        ↓
child selection
        ↓
screen selection
        ↓
world / hub / legacy view
```

Document every decision.

Specifically inspect:

- startup functions;
- DOMContentLoaded handlers;
- initialization order;
- async module loading;
- Three.js import/load failures;
- `world-explorer` initialization;
- fallback behavior;
- `worldStatus`;
- Classic hub selection;
- localStorage;
- profile state;
- stored current-view state;
- release migrations;
- Android-specific startup logic.

---

# Audit D — Find every navigation owner

Search for and classify:

```text
window.location
location.href
location.hash
history.pushState
history.replaceState
popstate
hashchange
Android Back
native Back listeners
postMessage
iframe parent calls
iframe child calls
show/hide screen functions
currentView
currentScreen
route
navigate
goBack
backStack
openGame
openBook
openActivity
openMusic
```

Produce a diagram of every subsystem that currently believes it owns navigation.

Example:

```text
root navigation
apps/kid router
legacy hash links
Android Back handler
world navigation
book links
game return callbacks
```

Then determine which must remain authoritative.

Final target: **one navigation owner**.

---

# Audit E — Original content inventory

Build a real inventory from the repository.

Do not assume the newer registry is complete.

## Games

For every game record:

- ID
- title
- source
- launcher
- assets
- expected return target
- current working status

## Activities

Same fields.

## Books

Same fields.

Check internal navigation links carefully.

## Music

Inventory:

- instruments
- Music Room
- audio assets
- launch paths
- return paths

## Learning

Inventory:

- Math
- Language
- Science
- Geography
- History
- Explore
- Check
- adaptive/director/runtime components
- AI-assisted features

## Quests / rewards / daily life

Inventory these separately.

---

# Audit F — `SQContentRegistry`

Find the implementation and answer:

1. What are its actual source inputs?
2. Does it represent all original content?
3. Does it duplicate existing catalogs?
4. Does it manufacture new IDs?
5. Does it preserve old IDs?
6. Is it static?
7. Is it generated?
8. Is it hand-maintained?
9. Is it used by the Classic UI?
10. Is it used by the 3D world?
11. Is it used by Android?
12. Could it become stale independently?

Preferred architecture:

```text
authoritative original catalogs/state
              ↓
      SQContentRegistry
       normalized view
              ↓
     ┌────────┴────────┐
     │                 │
 Classic UI        3D World
```

NOT:

```text
old catalogs        SQContentRegistry
     │                     │
 old app               new app
```

If `SQContentRegistry` is currently a second source of truth, redesign it as an adapter/projection.

---

# Audit G — 3D-world code

Find all 3D-world files.

Audit:

- Three.js version/source
- module loading
- WebGL initialization
- OrbitControls
- touch handling
- raycasting
- landmark definitions
- world → registry lookup
- world → navigation calls
- world state persistence
- camera persistence
- Classic menu fallback
- failure/fallback path
- Android WebView compatibility
- content security/CORS issues
- local packaged-module paths

Answer:

> Is the world genuinely initializing on Android?

If not, capture the exact reason.

Do not silently fall back to the old planet screen while tests report success.

---

# Audit H — Android packaging

Trace exactly:

```text
source files
   ↓
build:mobile
   ↓
build:android-web
   ↓
dist/android-web
   ↓
Capacitor sync
   ↓
apps/android/android/app/src/main/assets/public
   ↓
Gradle APK
```

Verify:

- stale-file deletion;
- overlay behavior;
- source-vs-generated confusion;
- files copied from old releases;
- `legacy.html`;
- `apps/kid`;
- root index;
- world modules;
- Three.js files;
- runtime modules;
- CSS;
- registry;
- JSON metadata.

Do not accept `android-build.json` alone as proof of correct runtime.

Add a test that verifies actual expected executable modules and startup path.

---

# Audit I — Build/tooling problems already discovered

The real Windows/device installation exposed several release/tooling defects.

Audit and permanently fix these rather than relying on manual edits.

## Windows `.cmd` spawning

Multiple Node scripts attempted to spawn:

```text
npm.cmd
npx.cmd
tsc.cmd
```

using incompatible `spawnSync(... shell:false)` behavior on modern Windows/Node.

One example required manually changing:

```js
shell: false
```

to a Windows-aware invocation.

Fix these robustly.

Do not simply use `shell:true` with untrusted arbitrary arguments.

Prefer an explicit safe strategy such as:

- execute Node entry point directly where possible;
- use `cmd.exe /d /s /c` with controlled arguments when necessary;
- call local `node_modules/.bin` entry implementation;
- or otherwise use a cross-platform process helper.

Audit **all** build scripts for the same class of issue.

---

## Root TypeScript dependency

The root build requires `tsc`, but a fresh install did not reliably provide it.

A manual:

```text
npm install -D typescript
```

was required.

Fix package ownership so:

```text
npm install
npm run build:android-web
```

works on a fresh checkout.

---

## Capacitor TypeScript config issue

Earlier Android packaging used a TS Capacitor config while TypeScript was not installed in the Android package.

The newer JSON config approach may be preferable.

Verify the current configuration and remove unnecessary dependency coupling.

---

## JDK compatibility

Gradle 8.14.3 failed under JDK 25:

```text
Unsupported class file major version 69
```

The Android doctor previously accepted any JDK `21+`, which was wrong.

Keep/check the actual valid JDK range for the pinned Gradle/AGP stack.

The working machine used JDK 21 successfully.

---

## Android SDK location

A fresh Gradle run required:

```text
local.properties
sdk.dir=C:/Users/.../AppData/Local/Android/Sdk
```

Ensure bootstrap/sync/doctor can create or clearly request this rather than requiring ad hoc repair.

---

# Architecture decision required

After the audit, propose **2–3 viable integration strategies**.

At minimum consider:

## Strategy A — Original runtime remains authoritative

```text
original root runtime
      │
      ├── original content
      ├── original navigation
      ├── normalized registry adapter
      └── optional 3D world screen
```

The new world calls the old runtime's public launch/navigation API.

---

## Strategy B — New root runtime owns state, old content is adapted

Only propose this if the audit shows it can be done without wrappers/iframes/duplication.

You must explain the migration cost and risk.

---

## Strategy C — Selective merge

Preserve original navigation/content authority while adopting:

- Android native bridge
- build tooling
- registry normalization
- selected modern UI primitives
- future 3D exploration screen

This may be the safest option.

---

# Recommendation criteria

Evaluate each strategy against:

- risk of breaking existing games;
- risk of duplicate navigation;
- amount of rewrite;
- content coverage;
- ability to support young children;
- Android offline behavior;
- performance;
- maintainability;
- future 3D-world support;
- ability to test;
- migration safety;
- preservation of user state.

Then make a recommendation.

Do not choose based on which code is newer.

Choose based on product integrity.

---

# Required integration contract

Whichever architecture is selected must provide a stable internal API approximately equivalent to:

```js
SummerQuest.navigate(...)
SummerQuest.back()
SummerQuest.openGame(id)
SummerQuest.openBook(id)
SummerQuest.openActivity(id)
SummerQuest.openMusic(id)
SummerQuest.openLearning(id)
SummerQuest.openQuest(id)
SummerQuest.getContentRegistry()
SummerQuest.getCurrentChild()
```

The names may differ.

The important requirement is:

> UI surfaces should invoke one public runtime/navigation interface rather than manually manipulating unrelated screens.

Classic UI and future 3D world must both use this interface.

---

# 3D world integration contract

Do not spend time polishing the 3D world until architecture recovery is complete.

The future world must:

1. exist inside the authoritative app;
2. read normalized content from the registry;
3. call the authoritative navigation API;
4. never load the whole application in an iframe;
5. never own a parallel back stack;
6. never duplicate content;
7. preserve camera/world state while content is open;
8. support Android Back;
9. have an explicit visible error during development if WebGL initialization fails;
10. not silently fall back to a misleading old planet UI during testing.

---

# Testing requirements

The current automated tests gave false confidence previously.

Improve them.

## 1. Startup integration test

Test actual startup state rather than file existence.

Verify:

```text
launch
→ child selection
→ choose child
→ expected default screen
```

---

## 2. Real navigation loop

Automate:

```text
Hero
→ child
→ world/hub
→ Games
→ game
→ Back
→ Books
→ book
→ Back
→ Books
→ another book
→ Back
→ Music
→ instrument
→ Back
→ Learning
→ activity
→ Back
```

Repeat enough navigation to detect duplicated wrappers/headers.

---

## 3. No recursive shell test

Explicitly fail if:

- app root is loaded inside iframe;
- root `index.html` is loaded inside itself;
- multiple Summer Quest headers exist;
- multiple global navigation shells appear;
- `legacy.html` hosts the real app.

---

## 4. Registry coverage test

Every playable original content item should either:

- appear in the registry;
- or be intentionally excluded with a documented reason.

---

## 5. Android package integration test

Run tests against:

```text
apps/android/android/app/src/main/assets/public
```

after sync, not only source files.

---

## 6. Physical device debug visibility

During development add a hidden/dev diagnostics surface showing at minimum:

```text
release
entry
runtime
current screen
current child
navigation stack
world initialized: yes/no
WebGL: yes/no
registry item count
Android/native bridge: yes/no
```

This should make future tablet debugging much faster.

It can be disabled/hidden for production.

---

# Clean-up requirements

Once the architecture decision is made:

- remove dead shells;
- remove deprecated iframe bridges;
- remove duplicate routers;
- remove stale generated source copies;
- remove obsolete world prototypes;
- remove debug `LEGACY` labels from user UI unless intentionally needed;
- keep migration compatibility only where real stored users need it;
- clearly separate source from generated output;
- document which directories may be safely deleted/regenerated.

Do not keep deprecated architecture "just in case" if it can accidentally become executable again.

---

# Do not do these things

Do **not**:

- rewrite all games;
- rewrite all books;
- create another app shell;
- create another router;
- iframe the original app;
- copy original content into a new duplicate catalog;
- hard-code only a few showcase games into the world;
- treat generated Android files as authoritative source;
- hide initialization failures behind a fallback during audit;
- claim physical functionality from static tests;
- spend time on visual 3D polish before architecture recovery.

---

# Expected deliverables

## Deliverable 1 — Architecture audit

Create:

```text
docs/audits/SUMMER-QUEST-ARCHITECTURE-RECOVERY-AUDIT.md
```

Include:

- original architecture;
- newer architecture;
- actual current merged architecture;
- exact tablet-screen source;
- runtime startup flow;
- navigation owners;
- content inventory;
- registry analysis;
- Android packaging analysis;
- build/tooling issues;
- dead/duplicate code;
- risks.

---

## Deliverable 2 — Architecture recommendation

Create:

```text
docs/plans/SUMMER-QUEST-ARCHITECTURE-RECOVERY-PLAN.md
```

Include:

- candidate strategies;
- comparison;
- recommended architecture;
- target diagrams;
- migration phases;
- explicit files/modules affected;
- compatibility plan;
- deletion/deprecation plan.

---

## Deliverable 3 — Implementation plan

Create a phased implementation checklist.

Suggested shape:

### Phase A
Recover one authoritative runtime.

### Phase B
Consolidate navigation.

### Phase C
Normalize original catalogs through registry adapter.

### Phase D
Fix Android packaging/build determinism.

### Phase E
Full content click-through regression.

### Phase F
Only after the above: reintroduce/refine the 3D world.

---

# Stop point

Do **not** perform a broad destructive refactor immediately.

After producing the audit and recommendation:

1. summarize the findings;
2. identify the exact root cause of the tablet's current screen;
3. show the proposed target architecture;
4. list files to keep/adapt/remove;
5. report risks;
6. stop for review unless a change is obviously small, reversible, and required to complete the audit.

---

# Definition of success

This audit is successful when we can answer, with evidence:

> What is Summer Quest?

There should be one answer.

Not:

```text
the old app
the new shell
the Android shell
the legacy app
the kid app
the 3D app
```

But:

```text
Summer Quest
   │
   ├── one runtime
   ├── one navigation authority
   ├── one authoritative content model
   ├── multiple presentation surfaces
   │      ├── Classic UI
   │      └── 3D exploration world
   └── one Android container
```

The priority is to recover this architecture first.

The visual quality of the 3D world comes after.
