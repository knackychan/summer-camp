# Slice 02 — Hybrid activity lock + Papa PIN override

**Depends on:** P0 live timeline (shipped). Pass-based unlock hardens with P2.
**Design:** see `design.md` §2. Note the amended CLAUDE.md stance: games may be blocked during activity blocks; everything else stays indicate-only.

## Goal

While a non-screen activity block is current and unticked, games are unplayable. My Day, guides, Learn tab, ask channel stay open. Coach-not-cop tone throughout.

## Changes

1. **Lock state (client-side, no new tables):** derive `locked` from the existing live-timeline current-block computation:
   - current block is an activity (not screen/free) AND not ticked AND not passed/excused/outing, **OR**
   - current block is *not* an activity AND the most recent past activity block today is unticked and not passed/excused/outing (overrun linger — see design.md §2). When the current block is itself an activity, the current one governs alone.
   - The overlay names whichever block is the unfinished one.
2. **Lock overlay on games area only:** current block name + bilingual invite ("It's Sport time! 運動時間到了！ Games are resting 遊戲休息中") + button to that block's guide. No red, no countdown, no shame copy. Tablet-size tap targets.
3. **Unlock paths:**
   - Tick the current block → lock lifts immediately.
   - Approved Excused/Golden pass on the block (integrate when P2 pass lifecycle lands; until then, PIN override is the manual path).
   - **Papa PIN override:** small "Papa 爸爸" button on the lock overlay → 4-digit pad → correct admin PIN unlocks games for the remainder of the current block only.
4. **Admin PIN storage:** new admin-settable value (admin Settings section). Synced to tablets and cached in `localStorage` so the override works offline. Plaintext, same trust level as `kids.pin`. Never in the repo.
5. **Guards:** lock must never fire during screen/free blocks, outing blocks (slice 03), or when the block is already ticked. Re-evaluate on tick, on timeline block change, and on hydration.

## DONE WHEN

- During an activity block, opening any game shows the invite overlay instead of gameplay; guide/Learn/My Day/ask all still work.
- Overrun linger: sport block ends unticked, next block is a free block → games stay locked, overlay names Sport; ticking Sport late unlocks and still earns the star.
- Ticking the block from My Day unlocks games with no reload.
- PIN override unlocks instantly with wifi off.
- Wrong PIN: gentle shake, no lockout, no shame copy.
- `node scripts/check.mjs` green.
