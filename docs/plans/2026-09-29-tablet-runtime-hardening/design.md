# v0.5.7 — Tablet Runtime Hardening

Date: 2026-09-29
Baseline: v0.5.6 Bounded Check Help

## Goal

Make the existing Summer Quest child shell behave predictably as a tablet-first local/LAN prototype before adding more curriculum or AI features. This release hardens the browser/mobile runtime; it does not introduce a new scheduler, grading path, reward rule, curriculum source, or AI authority.

## Product decisions

- Ages 3–4 default to the existing `pre_reader` interaction profile without requiring a query-string flag. That profile keeps text density at none, voice guidance on, assistant dialogue off, and direct exploration on.
- `?mode=reader` remains an explicit adult QA override. `?mode=pre_reader` remains an explicit force-on override.
- The child shell tracks viewport class, orientation, coarse/fine pointer, online status, display mode, secure-context availability, and browser Service Worker capability as presentation/runtime signals only. None of these signals can change learning/mastery data.
- Coarse-pointer tablet controls keep a 48 CSS-pixel minimum target. Landscape tablets move the three-item bottom navigation into a right rail so the activity/planet viewport does not lose excessive vertical space.
- The app shell uses the visual viewport height when available, safe-area insets, contained scrolling, and `interactive-widget=resizes-content` to reduce Android browser address-bar/keyboard height glitches.
- Offline status is visible but non-blocking. The UI does not imply that network loss stops local learning.
- The Windows LAN launcher must start without provider keys. Provider configuration is optional for local learning and only enables live remote model calls.
- The local server prints the actual `/apps/kid/` LAN URL rather than only the legacy root.
- Browser Service Workers require a secure context. `localhost` can support offline restart, while a plain `http://192.168.x.x` tablet URL cannot. The future Android wrapper or HTTPS LAN serving is the hardware path for full offline restart.
- The shared WebAudio service resumes an already-unlocked context after returning from a backgrounded/suspended browser tab.

## Runtime boundaries

The new tablet signals are presentation/runtime metadata only. They do not enter learner profiles, telemetry attempts, grading, mastery, review scheduling, rewards, quest completion, or model prompts.

The pre-reader default selects the already-existing profile; it does not add an LLM path. `assistantDialogue` remains false for this age path.

## Acceptance

- Mobile and agent TypeScript build/typecheck cleanly.
- Ages 3 and 4 resolve to `pre_reader`; age 5+ defaults to reader unless a saved/explicit profile applies.
- Explicit `mode=reader` can override the age-4 default for QA.
- 768×1024 and 1024×768 coarse-pointer layouts have no horizontal overflow and touch controls remain at least 48×48 CSS px.
- Landscape navigation becomes a right rail.
- Online/offline runtime events update presentation state without navigation loss.
- Service Worker precaches the tablet runtime modules and falls back to the cached kid shell during an offline navigation.
- LAN server starts with no provider `.env` and provider requests still fail closed when no provider is configured.
- Shared audio resumes after a background/suspend lifecycle event once the user has previously unlocked it.
- Existing full automated suite stays green and the legacy checker gains no new findings.
