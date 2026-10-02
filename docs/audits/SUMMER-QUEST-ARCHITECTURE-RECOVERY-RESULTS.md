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

## Remaining hardware gate

ADB was rechecked and still reports one unauthorized device. The installed package/version, launch activity, WebView URL, service-worker state, actual bridge flag and entry-selection cause remain unverified. Nothing was installed, uninstalled or cleared on the tablet, and its app ID/storage origin were not changed.

After USB-debugging authorization, inspect and preserve the installed entry evidence before any replacement. Then run physical touch, audio, Back, background/resume and offline process-start checks. The plan's hardware boxes and visual polish remain open.
