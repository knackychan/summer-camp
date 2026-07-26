# Slice 01 — Homework block

**Depends on:** nothing. Pure DAY-data change. Can ship immediately.
**Design:** see `design.md` §1.

## Goal

A fixed morning homework block for all 3 kids, replacing one existing morning block. Progress math stays `x/16`.

## Changes

1. Inspect current DAY data; propose to Papa which morning block to replace and at what time. Wait for confirmation before editing.
2. Replace that block in DAY data for all kids:
   - Luis / Lili: homework 暑假作業 (e.g. "Homework time 寫作業時間").
   - Lucien: quiet work in the same slot (e.g. "Quiet work 安靜活動" — coloring / tracing / puzzle) so the schedule shape matches across tablets.
3. Bilingual labels mandatory (CLAUDE.md invariant).
4. Optional: ACT_GUIDE-style steps for the block (what to lay out, how to start). Skip if it delays shipping.
5. Tick behaviour, star award, spoken transition announcement: all inherited from existing block machinery — verify, don't rebuild.

## DONE WHEN

- All 3 tablets show the homework/quiet block at the same slot with correct bilingual labels.
- Ticking it counts toward `x/16` and earns a star like any other block.
- Spoken transition announces the block at its start time.
- `node scripts/check.mjs` green.
