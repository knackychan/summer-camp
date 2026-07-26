# PWA Install And Offline Shell

Goal: make the live static app installable on tablets and cache the app shell for offline launch.

Scope:
- Add manifest metadata, theme color, app icons, and Apple install hints.
- Register one service worker from `index.html` and `admin.html`.
- Cache the app shell only: kid app, admin shell, CSS, and shared JS.
- Do not cache `js/config.js`; it is local/generated and should stay fresh.
- Do not change gameplay, Supabase schema, or the ignored `docs/plans/2026-07-26-homework-lock-drills-outing` folder.

Done when:
- `manifest.webmanifest` is valid and references existing icons.
- `sw.js` installs and serves cached same-origin shell files offline.
- `index.html` and `admin.html` include manifest/icon/theme metadata and register the worker.
- `node scripts/check.mjs` passes.
