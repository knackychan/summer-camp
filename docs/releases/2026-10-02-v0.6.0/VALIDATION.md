# Summer Quest v0.6.0 Validation

Date: 2026-10-02

## Automated gates

| Gate | Result |
| --- | --- |
| Mobile TypeScript typecheck | PASS |
| Agent TypeScript typecheck | PASS |
| Android web bundle build | PASS — 277 payload files |
| Unified runtime gate | PASS — 5/5 |
| Android foundation gate | PASS — 8/8 |
| Android build/device acceptance gate | PASS — 11/11 |
| Offline shell gate | PASS |
| Mobile architecture gate | PASS |
| Complete repository test suite | PASS — 342/342 |
| Legacy checker comparison | PASS — 132 → 132, 0 added / 0 removed |

## Android payload

- Entry: `index.html`
- Runtime: `unified-root`
- `legacy.html`: absent
- Product-host iframe: absent
- Payload files: 277
- Payload tree SHA-256: `8899bae08f9f49eb83117198c7ea0c8f726bce9369cfe294dab91ee446e85b8d`

## Rendered UI validation limitation

An optional Playwright/Chromium click-through gate was prepared to exercise real hero → hub → book/music/game → Back flows and repeated book cycles. This hosted environment blocks navigation to local HTTP and `file://` origins with `ERR_BLOCKED_BY_ADMINISTRATOR` before Summer Quest loads. Therefore no rendered-browser pass is claimed here.

Run locally after `npm run build:android-web`:

```sh
python scripts/check-unified-runtime-ui.py --browser <chromium-path>
```

## Required physical-device acceptance

Build/install the v0.6.0 APK and confirm on the real tablet:

1. app launches directly into the real Summer Quest runtime;
2. no duplicate/nested `Summer Quest` headers after repeated navigation;
3. Games, Activities, Learning, Books and Music open real content;
4. Android Back returns through the expected product hierarchy;
5. repeated Books → book → Back cycles do not create new shells;
6. portrait/landscape remain usable;
7. offline cold start still works;
8. audio focus, TTS and haptics remain functional.

Physical-device acceptance is pending and is not represented as passed in this release.
