# Summer Quest v0.6.0 — Unified Runtime Architecture Audit

Date: 2026-10-02
Baseline: v0.5.9 Android Build & Device Acceptance
Scope: Android/web entry points, navigation ownership, content routing, native Back, packaged assets, test coverage and first-device setup defects.

## Executive finding

The first physical Android build exposed an architectural defect rather than an isolated visual bug. v0.5.8/v0.5.9 installed a second kid-shell UI as the Android entry point and embedded the real Summer Quest runtime in an iframe as `legacy.html`. The repository already contained the complete product runtime at root `index.html`, including games, activities, books, Music Room and learning flows. The extra Android shell therefore duplicated navigation instead of integrating it.

This violated the earlier architecture direction to wire mobile/runtime work into the existing Summer Quest navigation instead of introducing another navigation shell.

## Reproduced failure chain

1. Android loaded the experimental `apps/kid` shell as packaged `index.html`.
2. The shell opened the real root application in an iframe as `legacy.html`.
3. Existing content legitimately navigates back to paths such as `../index.html#books`.
4. Inside the Android iframe, `../index.html` resolved to the Android shell, not to the real product runtime.
5. A new shell could therefore load inside the existing iframe.
6. Repeating content navigation could create shell-inside-shell recursion, duplicate the `← Summer Quest` navigation affordance and progressively break layout/state.

The duplicate chevron was consequently a routing/ownership symptom, not a CSS defect.

## Why the old tests missed it

The v0.5.8/v0.5.9 Android tests encoded the wrapper architecture as the expected design. They asserted that the new kid shell was Android `index.html`, that `legacy.html` existed, and that the Activity Host iframe was available. Those assertions could all pass while the real product navigation was recursively nesting shells.

Static file-existence checks were also insufficient to prove that a real book/game/music flow could open and return through the same navigation owner.

## v0.6.0 architecture

There is now one product runtime:

```text
Web / PWA / Android
        │
        ▼
root index.html
        │
        ├── Games
        ├── Activities
        ├── Learning
        ├── Books
        └── Music Room
```

Android is only a native container around that runtime:

```text
Capacitor / MainActivity
        │
        ├── Android Back
        ├── lifecycle
        ├── audio focus
        ├── haptics
        └── Android TTS
        │
        ▼
root Summer Quest runtime
```

There is no `legacy.html`, no app iframe and no second Android navigation shell.

## Content registry

`js/content-registry.js` introduces `window.SQContentRegistry`, a normalized read/open facade over the existing live sources rather than a duplicate content database. The root runtime binds it to:

- game metadata / game IDs;
- Music Room instruments;
- `BOOK_SHELF`;
- activity `BANK`;
- top-level product sections.

This is the contract that a future miniature 3D world should consume. The 3D exploration layer must be a presentation/navigation surface over this registry, not a new app host and not another iframe router.

## Navigation ownership

The root runtime now owns one Android Back handler. It handles, in order, modal/zoom states and then book, music, activity, game, hub and hero/root navigation. At the true root it returns control to Android so the system may exit normally.

The app lock cannot be bypassed by native Back.

## Android packaging/tooling defects found during first physical install

Physical installation also uncovered four setup defects in v0.5.9. These are fixed in v0.6.0:

1. Windows/Node 26 could not `spawnSync` `npm.cmd`/`npx.cmd` with `shell:false`; known command-file launches now use the Windows shell path.
2. `capacitor.config.ts` required a local TypeScript install before Capacitor could even create the Android project; the bounded Capacitor config is now JSON.
3. The doctor accepted JDK 25 although the pinned Gradle 8.14.3 build rejected it. The supported doctor gate is now JDK 21–24.
4. SDK discovery was session-dependent. It now also reads Android `local.properties` and standard OS SDK locations and can persist `sdk.dir` during bootstrap/sync.

## Test strategy correction

v0.6.0 adds a unified-runtime gate that fails if:

- Android reintroduces `legacy.html`;
- packaged Android `index.html` becomes the experimental kid shell;
- an iframe is used as the product host;
- PWA starts somewhere other than root `index.html`;
- the content registry is missing;
- root Back ownership is removed;
- standalone book return links point at a wrapper shell.

The optional rendered Chromium script performs real hub → book/music/game → Back cycles and repeats the book cycle to catch iframe/header accumulation. The current hosted validation environment blocks local browser origins with `ERR_BLOCKED_BY_ADMINISTRATOR`, so this rendered gate could not be truthfully executed here. It should be run on the development PC and, more importantly, the repaired APK must be smoke-tested on the physical tablet.

## Inherited repository findings

The broad legacy checker remains exactly unchanged from v0.5.9: 132 findings before and 132 after, with 0 added and 0 removed. They are inherited debt rather than regressions from this repair:

- 87 offline/cache warnings, mostly referenced Minecraft/giraffe assets and local config expectations;
- 10 missing giraffe book photo findings;
- 1 example/config secret-pattern finding;
- 34 Brain Gym literal-color/token warnings.

These should be handled as a separate cleanup/content-integrity milestone rather than mixed into the navigation repair.

## Explicitly out of scope

The flat Planet shell is not being polished in v0.6.0. It is demoted to prototype/reference status. The desired future home is a genuinely interactive miniature 3D world, with camera movement/rotation and discoverable activity locations. That work begins only after the single-runtime build passes physical tablet navigation/content acceptance.
