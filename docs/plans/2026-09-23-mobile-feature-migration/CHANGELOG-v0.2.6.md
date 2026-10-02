# v0.2.6 — Planet Mobile Migration

Date: 2026-09-23

## Added

- data-driven `packages/world` model for Planet Home zones;
- routed Zone, Quest Detail and Activity Host screens;
- typed embedded/external activity launch targets;
- generic legacy hub-section adapters for Games, Activities, Books and Music;
- pre-reader voice guidance on world/quest/activity selection;
- mobile-shell service-worker registration;
- dedicated offline navigation fallback for `/apps/kid/`.

## Changed

- installed PWA `start_url` now points to `apps/kid/index.html`;
- Android/browser Back now unwinds the same TypeScript route stack;
- Brain Gym no longer navigates the whole window away from the mobile shell; it returns an embedded launch target;
- Planet hotspot attention is derived from real available/required quests and activities;
- the legacy root app is now explicitly a compatibility/activity host during migration.

## Preserved

- legacy games and books are not rewritten;
- legacy quest rules remain authoritative through `LegacyQuestGateway`;
- offline-first behavior remains;
- no OpenAI or Supabase access is added to the new child UI layer;
- no project files are deleted.

## Verification

- `npm run typecheck:mobile` — pass
- `npm run test:mobile` — pass
- `node scripts/quest-agent.test.mjs` — pass
- `node scripts/agent-orchestration.test.mjs` — pass
- `node scripts/summer-ui.test.mjs` — pass
- full `node scripts/check.mjs` — 98 baseline failures before / 98 after; failure set unchanged apart from runtime path/PID text.
