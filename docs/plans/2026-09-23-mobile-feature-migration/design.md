# Mobile feature migration — v0.2.6

**Approved direction:** continue the strangler migration started in v0.2.5 and promote the TypeScript kid shell to the installed PWA/mobile entry without deleting the legacy app.

## Decisions

1. `apps/kid/index.html` is now the PWA `start_url`.
2. The Planet is data-driven through `packages/world`, not hard-coded navigation decoration.
3. Child navigation is routed: Planet -> Zone -> Quest detail / Activity host.
4. Android Back and browser/mobile UI back use the same navigation stack.
5. Legacy games, books, activities and music are embedded through typed activity adapters while their internals remain untouched.
6. Pre-reader mode uses the same world model with icon-first rendering and voice guidance.
7. The root `index.html` remains a compatibility host until individual activities are migrated.

## Non-goals

- no rewrite of legacy games;
- no new framework;
- no direct Supabase/OpenAI calls from the new shell;
- no deletion of old child UI yet;
- no Learning Runtime implementation in this slice.
