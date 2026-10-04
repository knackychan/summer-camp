# Summer Quest architecture recovery results

Date: 2026-10-02. Strategy C implementation branch: `fix/architecture-recovery-strategy-c`, based on audit commit `29b1f0e`.

## Delivered

The root application remains authoritative. Classic, the 3D world and agent actions share its content launches, transitions and Back handling. The second child shell is excluded from builds and caching; its old source URL redirects to root without changing family state. Historical source/design documents remain available.

The implementation includes the previously uncommitted application overlay and its dependencies. The audit branch alone did not contain that application. Required learning/agent services, game and book integrations, parent UI, source catalogs, tests and tooling are now included explicitly. Credentials, family telemetry, dependency directories, generated bundles/native projects and local reports remain excluded.

The default registry projects 90 entries from existing sources, including all 21 games, 3 instruments, 8 books, 11 activities, 3 guides and 18 knowledge lessons. It preserves IDs, access exceptions, child storage and the star ledger. The [plan](../plans/SUMMER-QUEST-ARCHITECTURE-RECOVERY-PLAN.md) records the remaining session-internal exclusions and implementation details.

## Validation

| Gate | Actual result |
| --- | --- |
| Root/Android dependency installation | `npm ci` passed using both committed locks, including in a clean export of staged source |
| Shared modules and agent compilation | Passed with root-owned TypeScript 5.9.3 |
| Required project gate | `node scripts/check.mjs` passed on Node 26.2.0 and CI's Node 24.21.0; clean source also passed with no private `js/config.js` |
| Windows process checks | Real batch path with spaces, working directory, argument preservation, exit propagation and unsafe argument rejection passed |
| Toolchain checks | Actual JDK 21, SDK 36, Gradle 8.14.3, AGP 8.13.0 and Capacitor 8.5.2; supported/rejected Java-major tests passed |
| Repeated builds | Two builds matched within the working checkout; two fresh builds also matched within the clean source export |
| Web/native coverage | 444 payload files; source-to-output and output-to-source comparison, local imports, book image references and synchronized native bytes passed |
| Android debug build | Passed in the workspace and a newly generated native project in the clean source export |
| APK payload | All 447 native public files matched the workspace APK: 444 hashed payload files, metadata and two Capacitor bridge files |
| Browser execution | 27/27 scenarios passed across actual source, generated web and synchronized native directories, served independently to isolated Edge 154.0.4258.48 contexts |
| Catalog launches | 90 IDs from each of World and Classic origins on each target: 540 explicit outcomes, with policy rejections checked rather than counted as successful opens |
| Books | All 178 distinct referenced images fetched and decoded independently on each target; standalone Shelf return also exercised |
| Navigation/lifecycle | Repeated real Classic clicks and UI/shared-native Back; one visible root surface, no nested application iframe, no retired shell imports; every game module and all three instruments initialized |
| World interaction | Numeric camera rotation and real pinch distance/bounds; raycast on a visible mesh then GO; camera/selection after return/reload; child changes, resize, hidden frame stop, simulated native lifecycle, WebGL loss/restoration |
| Saved state/access | Synthetic pre-existing Classic/world views, PIN, best score, vocabulary, missions, cached stars and pending ledger operation survived navigation/reload; lock exceptions, app pause and six age-restricted lessons passed |
| Failures | Forced world-import, WebGL, game-module and missing-config failures remained in the root runtime with truthful outcomes; no Planet fallback |
| Offline | Real service worker installation, offline reload and a new offline document; game, non-Space book, Drum Pads and pending queue preservation passed |

The tests use synthetic local-only profiles and block external services, including service-worker configuration fetches. They do not read or reset a family's browser profile. Launch coverage is not a complete gameplay walkthrough of every game. Browser execution of native assets uses desktop SwiftShader; it is not evidence of Android GPU/audio performance or physical Back behavior.

## Re-run

```powershell
npm ci
npm --prefix apps/android ci
npm run build:android-web
npm run build:agent
npm run android:sync
node scripts/check.mjs
node scripts/verify-android-web.mjs apps/android/android/app/src/main/assets/public --native
npm run android:build:debug
python scripts/audit-architecture-runtime.py --browser "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
```

The browser command defaults to source/web/native targets and reports missing payloads explicitly. Use `--target native` to require native output. Reports default to ignored `apps/android/.reports/architecture-recovery-runtime.json`. `--historical` retains the old audit probe; the recovery runner refuses to overwrite `docs/audits/runtime-probe.json`.

## Artifact identities

Web metadata release: `v0.6.2-recovery`. The generated native template remains versionName `1.0` / versionCode `1`; this debug artifact is not asserted to be an installable upgrade over the uninspected tablet app.

| Artifact | SHA-256 |
| --- | --- |
| Workspace web/native payload | `3663c1d9241d938b558badb760308bbf624fc83269d54786f9bec6d5e4098d4f` |
| Workspace debug APK | `282660592b0ff17816e646edf550dbdde70edb0ad28c47f694f5156b1c4c13a0` |
| Clean source export web/native payload | `580f5af5b45c15288856c89fbfac6287cbf0d9f45c6416cbf81737b3d5056488` |
| Clean source export debug APK | `a1de7d16507e5fe218e6808c1657f2cb0d6816cd0e157c7fe7a9529aa6b41d5e` |

The clean export has the same payload file set. Compared with the working overlay, 43 source files differ only in Git-normalized LF/CRLF bytes; configuration becomes the intentional offline stub, and metadata follows those differences. The build hashes source bytes and does not promise identical hashes across different configuration/newline inputs. No unexpected source/content difference was found. APK signing/build metadata is outside the deterministic web-payload claim.

## Desktop browser acceptance — 2026-10-02

Follow-up branch: `fix/desktop-browser-acceptance`, based on `e00a2eb` (the documentation-only Android deferral after `eb2065b`). The starting workspace was clean. No reset, cleanup, normal-browser-profile change, Android sync, install or device test was performed.

Implementation commit: `7de27df` (`fix(desktop): restore browser navigation and offline usability`), pushed to the follow-up branch. The local server and isolated visible browser remain available for handoff; automation command execution has been disabled.

### Entry and test boundary

The root `index.html` was served at **http://127.0.0.1:9000/index.html** using the repository's existing static regression HTTP handler after building shared modules. The handler supplies empty configuration, including service-worker requests. Installed **Microsoft Edge 154.0.4258.48** ran visibly with isolated synthetic profiles. Initial release was `v0.6.2-recovery`; the final source and web metadata identify **`v0.6.3-desktop`**, runtime `unified-root`, cache `summer-quest-v113-desktop-acceptance`.

The main visible session rendered WebGL2 using **NVIDIA GeForce RTX 4080 Laptop GPU / ANGLE Direct3D11**. Screenshots confirmed the island, books, instruments and layouts. Playwright mouse and keyboard input drove the UI; JavaScript reads measured surfaces, camera, audio and saved state. Separate automated regression contexts use desktop SwiftShader. Neither establishes Android acceptance. Private configuration and live services were excluded; screenshots, browser profiles and detailed logs remain ignored under `.tmp/desktop-acceptance/`.

### Observed interface coverage

| Area | Actual evidence |
| --- | --- |
| Entry and child selection | Fresh hero selection, restored Classic/world sessions, child switching, wrong/right synthetic child and parent PINs, child PIN Enter and cancel/Escape focus return |
| 3D world | Visible hardware-rendered island; mouse drag changed camera position; wheel reached bounded distances 8.2 and 15.2; mouse raycast selected Books, GO opened its real shelf; camera/selection retained on content return and reload |
| Navigation | Classic/3D switching, repeated content/Back cycles, keyboard Escape, real browser Back/Forward and reload, single visible root, no application iframe; cross-child history cannot select a different protected child |
| Books | Space, Animals and Minecraft reading; decoded photos, next/previous and keyboard navigation, page grid, zoom, single Escape dismissal and focus return; all 178 referenced images also checked separately as assets |
| Games and Brain Gym | Calculations answered through its visible number pad and advanced; Balloon Pop accepted a displayed letter from the keyboard and increased its score; launch, exit and relaunch across the catalog. This is not full completion of every game or a complete daily Brain Gym trio |
| Music | Piano, Synth and Drum Pads played through their controls. Piano/Synth also support held Enter/Space, key release and focus loss. WebAudio signal was measured during playback and returned to zero after exit; this is not a human listening assessment |
| Activities and learning | Generated an activity mission, started its timer and verified it stopped on exit; inspected a Science plant clue, requested local help and completed both questions; Quick Placement and Smart Practice entry/resume exercised |
| Quests and rewards | Visible energy/preference controls opened eligible quests; reward requests showed explicit offline-sync feedback. No live redemption or parent approval claimed |
| Desktop layout | World at 1280×720, 1365×768, 1536×864 and 1920×1080; no horizontal world overflow. Classic scrolling and reachable controls inspected; Space/Minecraft reader/zoom and keyboard focus checked at 1280×720 |
| Failure handling | Missing config and simulated HTTP 503 provider calls left local books, Brain Gym and quest recommendations usable. Parent admin opened its visible Config needed state. Forced game-module failure on reload displays a bilingual error with working Back and retry |
| Persistence and offline | 16 headed checks passed: saved progress/PIN/selected child/Classic/world/camera, controlled offline reload and a new offline document, visible Space/Animals reading/zoom, Brain Gym keypad input, Drum Pads and activity completion. Repeated completion clicks and reload retained exactly 43 synthetic stars and the original one pending +3 operation. All 178 book images also decoded offline |

**All 90 catalog IDs were accounted for through visible controls:** 81 launches (8 sections, 21 games, 3 instruments, 8 books, 11 activities, 3 guides, 18 lessons, 2 learning cards and 7 eligible quests); 5 quests unavailable under the current schedule (`morning_teeth`, `plant_patrol`, `laundry_helper`, `move_break`, `creative_build`); 4 reward requests reported sync offline. The visible sweep used Papa's Open games today action and kept test mode off. Six age-restricted geography/history lessons were correctly absent for the youngest profile. The sweep recorded zero page errors or HTTP failures. Catalog launch coverage is distinct from the representative interaction checks above.

### Demonstrated defects fixed

- Browser Back previously left the root document. Native browser history now records root destinations and replays through existing launch/access/lifecycle operations. Directed exercises return to their owning learning screen, preserving assessment and star rules. Native app restoration retains its previous behavior. A new document with no previous entry still has ordinary browser Back semantics.
- Book grid/zoom Escape reached two handlers and closed the book as well. Shared Back now owns dismissal. Shelf/page/photo controls accept keyboard input; focus returns from zoom/grid and follows screen changes. Child PIN now submits with Enter.
- Piano and Synth's shared keybed ignored keyboard activation. It now supports press/release, repeated keydown and focus loss, with a visible focus indicator.
- Knowledge clue/answer feedback and an already-pending reward path called undefined `sTap`. They now use existing `sGood` feedback; gameplay and ledger policy are unchanged.
- A cold failed game import could leave an empty stage because its error helper required a pre-existing message node. The shared launcher now renders its error node directly, and history restoration preserves it.
- The worker omitted 99 images from five books. All 178 referenced book images now precache, and runtime cache writes extend the worker's lifetime. The focused worker test checks image coverage and delayed cache writes; offline browser checks now decode the images rather than merely opening the reader.
- The required source gate implicitly checked stale workstation native output after every web edit. Its payload test now exercises native bridge exclusions in a temporary fixture; actual native-byte verification remains an explicit tool. Existing native output was preserved.

### Final validation

The required `node scripts/check.mjs` gate passed. Web rebuild and byte/import/asset verification passed: 444 files; SHA-256 `dd985825067c6f9adba26de71a2097b2843a594e95f517d6c02d6ba9e16978fa`.

| Final affected gate | Result |
| --- | --- |
| Source normal runtime regression | Passed, including keyboard books/keybed audio, completed knowledge interaction, lifecycle/camera, 180 catalog API outcomes across World/Classic and all book images |
| Generated web runtime regression | All 9 scenarios passed: normal, saved state, PIN, ages, WebGL/import/config/game failures and offline |
| Source offline regression | Passed, including offline decode of all 178 book images |
| Visible browser history | 10 focused checks passed against both source and generated web, including directed learning, cross-child access and recoverable loading failure |
| Visible persistence/offline | 16 checks passed, including repeated completion without duplicate reward/queue mutation |
| Focused service worker | Passed book-image coverage and delayed runtime-cache-write checks |

The catalog API sweeps supplement the separate 90-ID visible-control sweep; they are not described as gameplay. Native assets/build/device checks were not repeated. The source normal test's initial failure was a newly added test selector typo (`scienceRestart` instead of the existing `scienceRepeat`); the corrected final run passed. No application change was needed for that assertion.

Re-run the affected desktop checks without a native sync:

```powershell
npm run build:android-web
node scripts/check.mjs
node scripts/verify-android-web.mjs
python scripts/audit-architecture-runtime.py --browser "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --target source --out .tmp/desktop-source.json
python scripts/audit-architecture-runtime.py --browser "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --target web --out .tmp/desktop-web.json
python scripts/check-desktop-history.py --browser "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --target web --out .tmp/desktop-history-web.json
```

### Limits

Live Supabase login/sync, reward approval/redemption, remote provider quality, TTS speech and human audio listening were not tested. Provider failure was injected, not a live outage. Moving another automated browser page to the foreground did not change this session's reported `visibilityState`; desktop background suspension is therefore not established by that observation (the separate lifecycle regression is simulated). All Android package identity, compatibility, physical Back/touch/audio and offline process-restart checks remain deferred.

## Remaining hardware gate

The implementation pass detected one unauthorized device. At the subsequent physical acceptance attempt on 2026-10-02, `adb devices -l` completed with an empty device list. The user confirmed that the tablet had been removed and explicitly deferred the physical pass until later.

Follow-up branch: `fix/android-device-acceptance`, created from implementation commit `eb2065b` without resetting or discarding workspace changes. This follow-up only records the deferral; no build, install, launch, smoke test or physical acceptance check was performed. No device settings or app/browser data were changed. The previous software results above were not rerun and remain software evidence only.

The installed package/version, signing certificate, launch activity, WebView debugging availability, entry URL, loaded modules, service-worker/cache identity, bridge flag and current surface remain unverified. No original APK could be captured. The source diagnosis still identifies the Planet selector and its `LEGACY` adapter badge; why the installed tablet entered that path remains uncertain. All physical checks are blocked by the absent tablet, with no physical pass or failure established.

On resumption, reconnect/unlock the tablet and authorize USB debugging if prompted. Inspect the existing installation and preserve its APK and diagnostics in ignored `apps/android/.reports/` before replacement. Verify package ID, signing compatibility, versionCode and storage origin before any in-place update; the template's `1.0` / `1` is not an approved upgrade. Never uninstall, clear data or delete caches to pass acceptance. Then complete the physical checklist, including existing profiles/PINs/progress/queued stars, content, touch, audio, Back, rotation, lifecycle and offline process restart. The plan's hardware boxes and visual polish remain open.

## Pixel Planet world (2026-10-02)

Branch `feat/pixel-planet`, slices 60–64 of [the pixel planet plan](../plans/2026-10-02-pixel-planet/design.md). The world home now renders on a 2D canvas (a code-drawn pixel-art globe) instead of Three.js/WebGL, so the recovery harness's `webgl` failure scenario became `canvas` (the `data-sq-world="planet"` canvas gets a `null` 2D context) and its WebGL context-loss step became a resize-redraw step. Harness commit: `36024ea` (`test(world): retarget browser harnesses to the pixel planet`). All runs below used headless **Microsoft Edge 154.0.4258.48** through Playwright on a desktop workstation. They are desktop software evidence, not Android hardware evidence.

| Command | Actual outcome |
| --- | --- |
| `npm run build:android-web` | Exit 0; web bundle 450 files, tree `42a8c2c61136db4225a32941d604c2f3daeb026033cfcb5b2cbcb4cde0b9556c` |
| `node scripts/verify-android-web.mjs` | Exit 0; `{"files": 450, "treeSha256": "42a8c2c6…9556c"}` (matches the build) |
| `python scripts/check-world-explorer-ui.py --browser "<Edge>" --out .tmp/world-ui` | Exit 0; **16/16 PASS**: `heroes`, `single_runtime`, `world_is_primary`, `world_canvas`, `registry`, `router_reports_world`, `camera_drag_alive`, `toy_tap_stays_on_world`, `minigame_starts`, `back_ends_minigame`, `book_launch`, `book_returns_world`, `section_launch`, `section_returns_world`, `classic_menu_returns_world`, `landscape_world`; no fatal console errors |
| `python scripts/audit-architecture-runtime.py --browser "<Edge>" --target source --out .tmp/pixel-source.json` | Exit 0; 9/9 scenarios PASS (`normal`, `state`, `pin`, `ages`, `canvas`, `import`, `config`, `game`, `offline`), 21/21 steps PASS |
| `python scripts/audit-architecture-runtime.py --browser "<Edge>" --target web --out .tmp/pixel-web.json` | Exit 0; 9/9 scenarios PASS, 21/21 steps PASS (rerun on the freshly rebuilt, verified payload) |
| `node scripts/check.mjs` | Green: "syntax, bilingual data, pool alignment, and tracked-file secret scan are green" |

The `world camera/pinch/tap/lifecycle/resize redraw` step passed on both targets: drag moved the camera eye (delta 31.1 source / 30.8 web), the two pinch gestures produced different bounded distances (about 8.1 and 16.6), a tap selected a place, GO opened real content, the world paused under a book and resumed with the same camera, simulated native pause/resume stopped and restarted it, an 800×600 resize redrew the canvas at full width with no status banner, the camera and selection survived reload, and two child switches kept a single world canvas. Every catalog entry opened from both the world and Classic origins, and the `canvas` failure scenario showed the world status message with a working Classic fallback.

Two harness defects surfaced and were fixed in the harness commit; neither needed an application change:

- `check-world-explorer-ui.py` chdirs into `dist/android-web` while it serves, so the relative `--out .tmp/world-ui` wrote its screenshots into the built payload. That broke the bundle tree-hash test in `check.mjs` (450 recorded vs 452 present files). The harness now resolves `--out` before serving, and the rebuilt payload was verified clean afterwards.
- With no DNS for remote hosts, the bundled realtime sync socket logged `net::ERR_NAME_NOT_RESOLVED` WebSocket console errors, which the harness counted as fatal even though all 16 checks passed. The harness now ignores DNS failures as well as `Failed to load resource`. A DNS failure cannot come from the local 127.0.0.1 server under test.

The slice 63 desktop automation (headless Edge via Playwright, 35/35 checks) additionally exercised the pixel-locked 2D canvas (320×200 buffer, ×4, `pixelated`), drag/flick/self-righting, wheel zoom limits, tap-to-centre with a bilingual card, toy taps with no card and Sound off silencing them, all four mini-games (Star Catch, Bubble Pop, Mole Hop, Crystal Echo) with **Done 完成** and time-up **Yay! 好棒！** / **OK 好**, `triggerBack()` ending a mini-game, and reduced-motion behaviour. It did not verify pinch on a touchscreen, coarse-pointer hit areas, real audio output or the hero hop animation.

Physical tablet checks are **pending device check**: touch feel and coarse-pointer hit areas, pinch zoom, frame pacing while spinning and during mini-games, audio and haptics for toys and mini-games, the hero hop, Android Back during a mini-game, and orientation-change redraw. See `apps/android/ACCEPTANCE-CHECKLIST.md`. No Android sync, install or device session was run for this slice.

## Connected Android APK update — 2026-10-03

One authorized Samsung SM-X210 was connected: Android 16/API 36, active WebView 154.0.8037.57, 1200×1920 physical display at density 240. The existing package was `com.summerquest.app` version `1.0`/code `1`, `.MainActivity`, debug signer SHA-256 `6005bd04bfdc18516b032586c97db57fdd82011fafe65dcd49d056ec4ccb72a0`. Its original APK is saved only in ignored `.reports/installed-original.apk` (SHA-256 `388ba16b449dee66eebecf8e86f5a4c3c04acb38e092028aa2df6c25108501c0`). It bundled root `index.html`, no `legacy.html`, and opened `https://localhost/` with root scripts. DevTools showed an active service worker/cache `summer-quest-v137-codequest-v14` and the Adventure screen; the previous selector/LEGACY report was not visible and its original cause remains unknown.

The original installed app exposed `Capacitor.Plugins.SummerQuestNative`, yet `SQPlatform.capabilities().native` was false: the classic adapter required `Capacitor.registerPlugin`, absent from the injected runtime. The adapter now uses the injected plugin. On the first updated APK, an ADB system Back from Space left the app even though calling the JavaScript Back handler directly returned true. The native overlay now uses AndroidX `OnBackPressedDispatcher`. On the final APK, Space opened from the world and ADB system Back returned to the world while the app remained foregrounded. The Pixel Planet rendered in a physical screenshot. This establishes the observed native Back path; it does not establish human touch feel or audio quality. Android's [Back dispatcher reference](https://developer.android.com/reference/androidx/activity/OnBackPressedDispatcher) supports the callback API used here.

Final installed APK: `232fb2fd439e9c02514e73061e5777409ecf1609b28c4b480e23e43287648c62`, version `1.1`/code `2`, same package, signer, launch activity and HTTPS localhost origin. Install was `adb install -r -t`, without uninstall, data clear or cache deletion. DevTools then showed root world, native bridge/audio-focus flags true, 511 bundled files and current cache `summer-quest-v142-brick-lab-01`. All 23 `sq:` keys remained present; child selection, PINs, saved world view and the 1,545-byte points queue had unchanged hashes. `sq:hubTab` changed with navigation. The separate `sq:queue` fell from 105 bytes to `[]` after the newly configured build launched; its prior operation was not captured, so server receipt is not independently proven. The source flush removes operations only after successful `applyOp`, but that is code evidence rather than a server audit. No raw family values were committed or printed; hashes/sizes and screenshots remain in ignored `.reports/`.

`node scripts/check.mjs`, `node --test scripts/android-device-foundation.test.mjs`, native web payload verification, and Gradle `assembleDebug` passed. `npm run android:smoke` passed cold process start and background/resume after the final install, with no AndroidRuntime crash in the excerpt. The build included the current dirty working tree and ignored local `js/config.js`; unrelated Origami/Code Quest files were not part of this Android fix commit, so the source commit alone is not a byte-for-byte recipe for that APK. Airplane-mode restart, rotation, PIN entry, all content, toy sound/haptics, Music Room listening and TTS remain open in the [physical checklist](../../apps/android/ACCEPTANCE-CHECKLIST.md). This is an installed/debugged APK, not final physical acceptance.
