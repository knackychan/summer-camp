# Summer Quest v0.6.1 — Validation

Date: 2026-10-02
Baseline: v0.6.0 Unified Runtime Repair

## Automated gates

- `npm run typecheck:mobile` — PASS
- `npm run typecheck:agent` — PASS
- `npm run build:android-web` — PASS
  - payload files: 279
  - payload tree SHA-256: `d83f338262501c1b69c1c53ae8d89f290f2e7e0b66aaf54e8bee726647f573c6`
- `npm run test:world` focused world gate — 5/5 PASS
- `npm run test:unified-runtime` — 5/5 PASS
- `npm run test:android-foundation` — 8/8 PASS
- `npm run test:android-acceptance` — 11/11 PASS
- full repository `node --experimental-default-type=module --test scripts/*.test.mjs` — 347/347 PASS
- `node --check js/world/world-explorer.js` — PASS

## Legacy checker comparison

The legacy checker is intentionally not a clean gate because v0.6.0 already contains inherited diagnostic findings.

- v0.6.0 baseline findings: 132
- v0.6.1 findings: 132
- added findings: 0
- removed findings: 0

The unchanged inherited set includes missing optional/private/offline assets and legacy token diagnostics. v0.6.1 adds no checker regression.

## Architecture assertions

Automated tests verify that:

- the 3D world is a root-runtime screen, not a second application shell;
- no iframe/product-shell architecture is reintroduced;
- the world imports the checked-in Three.js/OrbitControls modules;
- world destinations resolve through `SQContentRegistry`;
- world-origin content returns to the world through the shared navigation owner;
- the world CSS/module are present in both service-worker and Android packaging;
- Android still boots the authoritative root `index.html`.

## Rendered browser gate

`check-world-explorer-ui.py` was attempted against both `http://127.0.0.1/...` and the packaged `file://...` payload with Chromium/WebGL flags. In this hosted environment Chromium fails before Summer Quest executes with:

`net::ERR_BLOCKED_BY_ADMINISTRATOR`

Therefore rendered-browser visual validation is **not claimed as passed** here. The script remains in the release for execution on a normal development workstation.

## Physical Android gate — pending

The actual tablet is the authoritative visual/performance gate for v0.6.1. Required checks are in `apps/android/ACCEPTANCE-CHECKLIST.md`, especially:

- world renders without black/blank canvas;
- drag rotates/looks around smoothly;
- pinch zoom is bounded and stable;
- multiple physical landmarks can be tapped reliably;
- selection card + GO launch real content;
- content Back returns to the world;
- Classic menu → Back returns to world;
- portrait/landscape recovery;
- background/resume/WebGL recovery;
- offline cold start of the packaged Android app.

No physical-device visual/performance PASS is claimed until that checklist is exercised on the user's tablet.
