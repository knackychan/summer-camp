# Slice 01 — Wrapper, offline bundle and native bridge

## Depends on

v0.5.7 Tablet Runtime Hardening.

## Work

- Emit deterministic Android web assets.
- Promote the kid shell to Android bundle root while preserving legacy activities as `legacy.html`.
- Add isolated stable Capacitor package/config and bootstrap/sync scripts.
- Add a native MainActivity + registered Capacitor plugin overlay for Back, lifecycle, haptics, TTS and audio focus; register the plugin before `BridgeActivity.onCreate()` loads the page.
- Route native capability calls through existing platform seams.
- Add structural tests and release documentation.

## DONE WHEN

- Android bundle builds locally with no provider configuration.
- Web/PWA behavior remains unchanged.
- Native mode does not register a Service Worker.
- Back/focus/lifecycle contracts are test-covered.
- Full existing automated suite remains green.
