# Slice 03 — Outing mode

**Depends on:** P2 pass lifecycle (an outing is a bulk pass over a block range). PIN override from slice 02.
**Design:** see `design.md` §3.

## Goal

When the family is out (visit, walk, trip), Papa marks a block range as "outing". Affected blocks stop nagging, the lock stays off, and day-complete remains reachable.

## Changes

1. **Toggle from admin:** pick kid(s) — usually all — a block range (e.g. all morning blocks), and the star treatment:
   - **Credited (default):** each outing block earns its star (family time counts as real activity).
   - **Excused:** no stars, like a sick pass; day-complete still reachable.
2. **Toggle from a tablet:** via the Papa PIN pad (slice 02) for the offline / spur-of-the-moment case; same range + star choice, queued through the offline write queue.
3. **Rendering:** outing blocks show 🚶 with bilingual label ("Family outing 家庭出遊"). Not amber, not late — a neutral/positive state.
4. **Interactions:**
   - Activity lock (slice 02) never fires on outing blocks.
   - Day-complete logic honours outing blocks exactly like passed blocks (P2 semantics).
   - Credited outing stars go through `stars_ledger` (ledger invariant — never a stored counter), one delta per block with reason "outing 出遊".
5. **Data:** model as a pass-type row (e.g. pass kind `outing` with a block range) rather than a new table, if the P2 pass schema allows; otherwise smallest possible addition. Follow the SPEC's pass lifecycle tables.

## DONE WHEN

- Papa marks the whole morning as a credited outing from admin; all 3 tablets show 🚶 blocks live, stars land via ledger, day progress reflects them.
- Excused variant awards no stars but day-complete bonus is still earnable.
- With wifi off, PIN-pad outing toggle on a tablet works and syncs later.
- Games lock never triggers during outing blocks.
- `node scripts/check.mjs` green.
