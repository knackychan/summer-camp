# Summer Quest v0.5.7 — Tablet Runtime Hardening Validation

Date: 2026-09-29
Baseline: `Summer-Quest-2026-09-29-v0.5.6-Bounded-Check-Help-FULL.zip`

## Implemented

This release hardens the current child shell for tablet use without changing learning authority. It adds runtime viewport/orientation/network signals, safe-area/visual-viewport sizing, coarse-pointer touch sizing, a landscape tablet navigation rail, an offline status indicator, automatic pre-reader selection for ages 3–4, non-blocking no-key LAN startup, child-app LAN URLs, secure-context/offline capability reporting, Service Worker cache v108, and WebAudio foreground resume.

The age-3/4 path still uses the existing `PRE_READER_PROFILE`: no assistant dialogue, no text-heavy shell labels, direct exploration, and voice guidance. `mode=reader` remains a QA override.

## Automated gates

- `npm run build:mobile` — pass
- `npm run typecheck:mobile` — pass
- `npm run build:agent` — pass
- `npm run typecheck:agent` — pass
- `npm run test:tablet-runtime` — pass
- `npm run test:offline-shell` — pass
- `npm run test:mobile` — pass
- `node --experimental-default-type=module --test scripts/music-audio.test.mjs` — 12/12 pass
- `node --experimental-default-type=module --test scripts/*.test.mjs` — 317/317 pass
- `node scripts/check.mjs` — exit 1 with 132 inherited findings. The reconstructed v0.5.6 baseline produces the same 132 findings in this environment, so this release adds 0 and removes 0.

## Rendered tablet validation

`python scripts/check-tablet-runtime-ui.py --browser /usr/bin/chromium --out <dir>` passes 4/4 checks using the production kid CSS and compiled tablet runtime functions:

- 768×1024 portrait: no horizontal overflow; pre-reader labels remain visually removed; visible buttons are at least 48×48 CSS px.
- 1024×768 landscape: navigation becomes a compact right rail; no horizontal overflow.
- Browser online/offline events update the runtime state and offline status.
- No page-level JavaScript errors in the exercised flow.

This execution environment applies an administrator URL policy that blocks Chromium navigation to both `localhost` and `127.0.0.1`. Therefore a real browser URL-navigation/Service-Worker reload could not be executed here. The Service Worker offline path is instead exercised deterministically in `scripts/service-worker-offline.test.mjs`, which installs the real `sw.js` into a fake Cache API, disables network, and verifies cached fallback for `/apps/kid/` navigation plus the tablet runtime module.

## LAN/offline limitation

The Node local server binds to `0.0.0.0`, serves `/apps/kid/`, and passes its no-provider-key server tests. A physical tablet can use the printed `http://<LAN-IP>:9000/apps/kid/` URL while the server is reachable.

A plain HTTP LAN origin is not a secure browser context, so normal browser Service Workers cannot provide offline restart there. Full physical-tablet offline acceptance therefore remains pending either the Android wrapper or a trusted HTTPS LAN setup. Localhost Service Worker behavior is covered by code/unit validation but could not be browser-navigated in this controlled environment.

## Not changed

No learning schema, grading rule, mastery/review rule, reward rule, Knowledge Help policy, provider routing policy, or curriculum content was changed.
