# v0.5.4 — Validation and release notes

Date: 2026-09-27. Source baseline: the user-uploaded v0.5.3 History Smart Practice FULL ZIP.
Verified baseline SHA256: `90ac72c32fddd17f957d285a59dc48038a65b73e231ea9afbfaf89e61a88a368`.

## Actual automated results

| Gate | Result |
| --- | --- |
| Mobile build (`npm run build:mobile`, also exercised by focused test script) | PASS |
| Agent build (`npm run build:agent`) | PASS |
| Mobile TypeScript check (`npm run typecheck:mobile`) | PASS |
| Agent TypeScript check (`npm run typecheck:agent`) | PASS |
| All discovered Node tests (`node --experimental-default-type=module --test scripts/*.test.mjs`) | 264 pass; 0 fail/skip/cancel |
| New focused session gate (`npm run test:guided-session`) | 22 pass |
| Optional rendered-component smoke test | 8 checks pass; no page-level JS exceptions in the tested interactions |
| Broad checker (`node scripts/check.mjs`) | Exit 1; exactly 132 inherited findings |
| Diagnostic identity comparison against untouched v0.5.3 baseline | 0 added, 0 removed; same 132 exact diagnostic strings |
| Archive, UPDATE overlay and patch reconstruction | Same target file hashes; no baseline-file deletions |
| Hash-checked UPDATE helper | Dry run, apply, idempotent repeat and rejection of a modified baseline checked |

Environment used for code gates: Node v22.16.0, TypeScript 5.8.3. No dependency installation, new provider configuration or live model key was needed.

The all-tests count includes the existing test-file wrappers and named subtests reported by Node; it is not a count of manual scenarios. Supporting output is retained as `all-tests.txt`, `guided-session-tests.txt` and `component-ui-validation.json`. Baseline/current diagnostic identity files are included separately.

## New focused coverage

The 22 session tests cover actual existing result adapters for all five domains; unrelated/free/other-child/wrong-skill evidence; deduplication; partial progress after telemetry pruning; pause/resume with a new run; alternative persistence; early finish versus success; no candidates; stale actions and double start; v11 partial migration and v10 rebuild; repeated Math and Language callbacks; concurrent telemetry writes; late knowledge adaptation after advancing/resetting/replacing a lesson; Check-mode AI suppression; stale/double answer and advance; knowledge resume; a saved activity becoming unavailable; and completion of the full original bounded plan without automatically starting any subsequent step.

Existing subject, placement, mastery/review, knowledge, teach, provider routing/server and other project regression tests remain in the discovered suite. The runtime continues to distinguish practice completion from correctness and mastery.

## Rendered-component scope — not a full-app certification

`python scripts/check-guided-session-ui.py --browser /path/to/chromium --out /path/to/output` reads the actual Smart Practice/knowledge UI functions and CSS from index.html. It renders those components in Chromium and calls the real compiled bridges through a local Node JSON-storage harness. It checks changing an activity, pause/resume, finish, a two-question History journey across bridge reload, free topic availability after pause, a stale start after child switching, and 768px document overflow.

The harness uses test doubles for surrounding game navigation/audio, blocks external network assets, and starts from an in-memory document. It is not the complete root app, the native wrapper, a full Math/Vocabulary UI session or a service-worker test. The supplied component screenshots are not claimed to show the complete application.

An attempt to navigate the complete app over local HTTP was blocked by the environment with `ERR_BLOCKED_BY_ADMINISTRATOR`. The normal Playwright-managed browser executable was also absent; the installed system Chromium was used for the component test. No successful full-page HTTP launch, real service-worker installation/reload, airplane-mode test or physical-device interaction is claimed.

## Inherited checker limitations

The broad check remains red at the original 132 findings, including inherited optional/missing asset references and legacy styling constraints. It was not made green by mutating fixtures, deleting files or suppressing diagnostics. Exact strings, not just totals, were compared. Its Git-based tracked-file scan cannot operate as a Git checkout inside a bare source ZIP; this release is not a security audit. No new provider secret/configuration files were added.

The new serial-storage module is present in the compiled output and explicitly included in the v105 APP_SHELL. This verifies static packaging, not actual browser offline lifecycle behavior. Some inherited checker messages describe a cache.addAll failure, whereas the shipped worker installs assets individually; these diagnostic strings were preserved as baseline evidence rather than silently rewritten.

## Remaining manual acceptance

1. On the target tablet, serve/open the existing root UI over HTTP for local testing (localhost/HTTPS where a service worker is required). Select a child, open Learn → Smart Practice, complete two items and explicitly start the next activity.
2. Pause after one answer, reload, resume and check saved progress. Finish early and verify unfinished work is not labelled complete. Switch children during a pending start/help request.
3. Warm the worker over localhost/HTTPS, confirm `summer-quest-v105-guided-learning-sessions`, then reload offline and complete a local lesson. Test the existing Android back/background behavior on actual hardware.
4. With explicit adult/developer authorization, test one configured live provider, then an outage. Check the selected profile, local fallback, latency and usage without enabling automatic escalation.

Local mutation serialization is per storage-driver instance, not cross-tab/cross-device/distributed exactly-once delivery. Physical Android/LAN lifecycle, live-model quality/cost and real offline reload remain unverified here.

## Release installation

The FULL ZIP is standalone source plus compiled modules under `summer-quest/`. Use it for a clean checkout. The UPDATE contains only changed/new application files and must be applied to the verified v0.5.3 baseline, not an arbitrary older version. Back up your folder and close the app/server first. `APPLY-UPDATE.py` defaults to dry run, validates the supplied update payload and every original baseline file, and needs `--apply` to write. Extra local configuration files are not overwritten.

The patch applies from inside an unchanged v0.5.3 `summer-quest` directory with `git apply --check path/to/release.patch` followed by `git apply path/to/release.patch`. The release manifest records baseline and changed-file hashes; the SHA256 companion file authenticates the delivered artifact bytes against the supplied checksums, not publisher identity.
