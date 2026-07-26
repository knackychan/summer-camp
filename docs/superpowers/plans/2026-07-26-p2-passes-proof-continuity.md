# P2 — Passes, Proof, And Continuity

## Scope

Implement the P2 slice from `docs/SPEC.md`:

- Pass lifecycle: kid request, admin approve/deny, kid spend/excuse, My Day counts the block.
- Photo proof upload to `proofs` storage, admin proof view, and dinner gallery.
- Kid PINs in admin settings, checked on profile select and cached locally.
- Learn tab `search_log` writes.
- 14-day admin history heatmap.

## Deliberate simplification

Passes are requested from a My Day block and applied to that same block. Golden and excused passes both count the block without awarding the normal block star; Papa can grant stars separately from the ledger if needed.

## Checks

- `node scripts/check.mjs`
- Browser smoke: PIN gate, pass request/approval/spend, proof upload, search log, admin P2 sections.
