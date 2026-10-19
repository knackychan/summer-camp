# Admin reset — points and progress, tablets included

**Status:** asked by Papa 2026-10-19 ("i want the reset function to actually reset all the points etc"). Papa ran `20261009_admin_cleanup.sql` live and confirmed the plain points reset worked. Papa then approved this follow-up and asked for it to be merged to main (2026-10-19). **Waiting on:** Papa running `supabase/migrations/20261019_admin_reset_all.sql` in the Supabase SQL editor. Until he does, the Reset button says to run it.

Amends `2026-10-09-admin-cleanup/` D2 (points reset). Admin chrome is English-only (D23). The kid app gets no new strings.

## Gap it closes
- **Tablets kept their own copy.** `admin_reset_points` empties the server tables. Tablets merge server claims into their local list and never drop any. So they kept showing the old claims, the pending points and the Games-gate "reached today" mark. Any earning still in a tablet's offline queue was sent back after the reset.
- **Progress stayed.** Today's My Day ticks and Brain Gym stayed marked done after the points reset. Word mastery, best scores and missions also stayed. The only other way to clear them was the all-kids Season reset.

## Decisions
- **D1:** `admin_reset_all(p_kid, p_progress)` in `supabase/migrations/20261019_admin_reset_all.sql` is a parent-only `SECURITY DEFINER` function.
  - It clears the same points tables as `admin_reset_points`, plus `guide_decisions` and `braingate_<kid>`.
  - With `p_progress` it also clears the kid's `day_ticks`, `day_rolls`, `act_done`, `brain_done`, `vocab_mastery`, `game_stats`, `day_redos` and `help_claims`.
  - It keeps messages, photos, passes, Summer chats, schedule overrides, settings and PINs.
  - The old function stays in place, unused.
- **D2:** The reset writes `family_settings.points_reset_v1 = {kid: {at, progress}}`. A tablet that has not seen a kid's stamp drops that kid's local claims, attempts, totals, Games-gate mark and guide picks. It also drops every point op queued before `at`, and every progress op too when `progress` is true. A progress reset then reloads the page, like a Season reset. Queued ops now carry `at`; ops without it count as older.
  - The stamp is checked on hydrate. It is also checked before a flush, because a tablet coming back online flushes before it hydrates.
- **D3:** The reset card has two choices, "Points and progress" (the default) and "Points only". Typing `RESET` is still required.

## Tests
- `points-database.test.mjs`: parent-only access, one kid's progress cleared and the others kept, the stamp per kid, points-only keeps ticks, the ledger guard is re-enabled.
- `admin-cleanup.test.mjs`: the reset text and the scope hint.
- `check-admin-cleanup-ui.py`: the card calls `admin_reset_all` with `p_progress`.
