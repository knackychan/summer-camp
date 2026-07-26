# P1 — Papa Supervises And Assists

## Scope

Implement the P1 slice from `docs/SPEC.md` without changing gameplay:

- Admin login, today overview, star grants, undoable ledger.
- Kid ask channel with canned, typed, and voice memo asks.
- Admin inbox with text and voice answers.
- Realtime admin-star fanfare and ask-answer badge on the active kid tablet.
- Direct ntfy urgent ping when `SQ_CONFIG.NTFY_TOPIC` is set.

## Deliberate simplification

Urgent push posts directly to `ntfy.sh` from the kid tablet instead of adding an Edge Function. This keeps the app static and satisfies the P1 push behavior for a family/unlisted-topic setup. Add an Edge Function later if the ntfy topic needs to be hidden.

## Checks

- `node scripts/check.mjs`
- Browser smoke: index local/supabase mode, admin load, ask insert/update, admin-star realtime.
