# v0.5.5 — Validation and release boundaries

Date: 2026-09-27.
Baseline: `Summer-Quest-2026-09-27-v0.5.4-Guided-Learning-Sessions-FULL.zip`.
Verified baseline SHA256: `b0499d756bdfeb0afd238547d207a1895110ce5306cb55cb60e0c6b6b8648a7e`.

## Executed gates

| Gate | Result |
| --- | --- |
| Mobile build | PASS |
| Agent-proxy build | PASS |
| Mobile TypeScript check | PASS |
| Agent TypeScript check | PASS |
| `node --experimental-default-type=module --test scripts/*.test.mjs` | 308 pass; 0 fail/skip/cancel |
| New focused `scripts/knowledge-help.test.mjs` | 44 pass; included in 308 |
| Existing guided-session rendered-component smoke | 8 checks pass |
| New Explore-help rendered-component smoke | 9 checks pass |
| Broad `node scripts/check.mjs` | Exit 1; 132 inherited diagnostic identities |
| Exact diagnostic comparison with v0.5.4 | 0 added, 0 removed |
| FULL / UPDATE / Git patch reconstruction | Verified in the external RECONSTRUCTION report |
| UPDATE dry run, apply, repeat, baseline/payload rejection | Verified in the external RECONSTRUCTION report |

Environment: Node v22.16.0, TypeScript 5.8.3, local system Chromium and Python Playwright. No npm dependency installation, live provider key or paid model call was used. Node's complete count includes existing test-file wrapper entries and subtests; it is not a count of manual scenarios.

## New automated coverage

All 18 lessons preserve literal approved bilingual clue text. Tests cover visual-first pre-reader fallback and explicit focus; no network on start/snapshot/local-open; one remote claim under concurrent taps; cached selection across reload; local clue cycling; all three Check modes before/after answers; current child/domain/session/phase/age guards; invalid/malicious/wrong-kind selections; provider failure; timeout and adapters ignoring AbortSignal; cancellation before and after the request claim; stale responses after questions, answers, reset/replacement and local next; interrupted-request recovery; unknown session versions; canonical server context removing client-supplied prose/private extras; profile authorization and server-authorized manual override; task/prompt/schema dispatch; HTTP abort; client→fetch handler→proxy→bridge success/outage; nullable usage; adult Unavailable rendering; evidence-preserving bounded diagnostic retention, including repeated IDs; and transitive offline-module registration.

The proxy and HTTP tests use in-process deterministic fixtures, not a live external model. Server canonicalization validates the declared task context; it does not attest browser-side learner state. This is not an adversarial security certification.

## Rendered component checks

`python scripts/check-knowledge-help-ui.py --browser /path/to/chromium --out /path/to/output` reads the actual root UI functions and CSS, uses the same `bigcard` wrappers as the root lesson panels, and exercises real compiled bridges over serialized storage. Only the surrounding navigation/audio and provider are test fixtures. The RPC helper supports concurrent pending requests so cancellation and child switching are exercised while a selection is in flight.

Checks exercise local bilingual help, Listen dispatch and local next in all three subjects; one fixture-provider selection across rerender/reload; delayed help after entering and answering a question; child switching; Check-mode absence; no page-level JavaScript errors; 768px/390px document overflow; and at-least-44px new touch controls. Listen verifies calls to the existing speech function, not actual audible synthesis or installed voices. Screenshots are component captures, not full-application screenshots.

The existing `check-guided-session-ui.py` also passes its eight checks, including a two-question History pause/resume journey with actual bridges. Its navigation/audio are still doubles.

## Full-app limitation

A fresh attempt to navigate the root over loopback HTTP failed with `net::ERR_BLOCKED_BY_ADMINISTRATOR`. No successful full-page launch, service-worker installation/update/reload, physical Android test or live-model quality/cost test is claimed. Static transitive cache coverage is not proof of real offline lifecycle behavior. The raw attempt result is included as `full-page-attempt.json`.

## Inherited findings and preserved boundaries

The broad checker is intentionally still red. Exact diagnostic strings—not just counts—match the untouched v0.5.4 baseline: 132 before and 132 after. The checker itself was not changed or suppressed. Three existing cache-version assertions were advanced to v106; one visible safety-copy assertion was updated to the new, more accurate approved-clue/lesson-order wording.

Byte-identical to v0.5.4: provider model catalogue/pricing/defaults; provider and client configuration examples; all three knowledge content catalogues; Learning Director and its bridge; placement/calibration implementation; mastery/review scheduler; `scripts/check.mjs`; and the inherited `server/agent-proxy/data/learning-telemetry.json`. No new private runtime data or credential file was created. The existing provider prices/model availability were not verified against current public sources.

The shared usage parser now ignores null/non-numeric counters and the proxy estimates only from genuinely reported numeric counters. This prevents missing usage appearing as zero; it does not authenticate provider billing. Existing estimated-price methodology remains unchanged.

Local serialization remains per storage-driver instance; there is no cross-device or distributed exactly-once/spending guarantee. The one-help-attempt allowance is tied to a lesson session and does not include the inherited optional lesson-sequencing request. Help diagnostics retain their own last-100 allowance in addition to the existing learning-event allowance; old learning evidence is not displaced by help records.

## Manual acceptance still required

On the actual served app/tablet: open Learn, start an Explore introduction, use Explore with Summer and Listen, move through local clues, then complete the two questions. Pause/resume a guided session and switch children during pending help. Confirm Check offers no help.

Warm the new worker through localhost/HTTPS, confirm `summer-quest-v106-bounded-explore-help`, and reload offline. Check that a browser already on v105 updates without clearing learning storage. Test Android back/background behavior on hardware.

With explicit adult/developer authorization, exercise one configured live provider and an outage. Confirm the actual selected profile, latency and returned usage. Do not enable autonomous escalation for that test. Existing model catalogue settings may need a separate current-availability/pricing review before production use.

## Installation

FULL is a standalone `summer-quest/` source and compiled-runtime tree. UPDATE targets only the exact v0.5.4 tree. Back up the folder and stop the app/server before applying it. Extract UPDATE separately, then run `python APPLY-UPDATE.py --root "C:\path\to\summer-quest"`; add `--apply` only after a successful dry run. The helper needs Python 3.9+ and preserves extra local configuration files. A modified baseline is rejected instead of silently overwritten.

Restart the existing app/proxy launcher after application so it loads the new server code as well as the UI. Keep browser storage. No manual DB/profile migration is required. A client updated without its old proxy will fall back locally if that proxy cannot serve the new task.

The patch applies from inside the unchanged v0.5.4 project with `git apply --check` and then `git apply`. SHA256 checks verify artifact bytes, not publisher identity. The external manifest provides per-file before/after hashes and reconstruction checks; no baseline files are deleted.
