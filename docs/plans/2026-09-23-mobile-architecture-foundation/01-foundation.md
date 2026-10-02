# Slice 01 — mobile shell and package boundaries

## Dependencies

- Existing v0.2.3 Quest/agent work.
- Existing classic Quest services.
- Existing Brain Gym host.

## Deliverables

1. TypeScript compilation config.
2. Mobile child shell with no inline business logic.
3. `PlatformService` and legacy/web implementations.
4. `StorageDriver` and session store.
5. `NavigationService` with back-stack behavior.
6. `QuestGateway` backed by the current deterministic Quest Engine.
7. `ActivityRegistry` with a Brain Gym legacy adapter.
8. Initial Planet/Quest/Adventure screens.
9. Pre-reader presentation capability.
10. Dedicated architecture tests.

## DONE WHEN

- TypeScript compiles with strict mode.
- Architecture tests pass.
- The existing root child app remains untouched as the production entry point.
- The pilot mobile shell renders from `apps/kid/index.html` using compiled modules.
- No OpenAI, Supabase, quest or reward logic is duplicated into the new UI.
