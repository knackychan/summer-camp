# Slice 06 — Harness + Android 8 check

**Status:** Approved by Papa 2026-10-04 (`design.md`).
**Goal:** The state flow works by touch on the target tablets, offline.
**Depends on:** 03, 04, 05.
**Files:** `scripts/check-codequest-lab-ui.py`, `test-results/codequest-lab/`, fixes wherever the harness finds them.

## Change

- Extend the Lab harness: lift → tool → cauldron by taps and by drag onto a tool; Snowflake Copies vs Duplication; fresh hint; forms in the Journal; all existing Phase 1 checks still pass at 1280×800 and 1280×600.
- `scripts/check-android8-ui.py` with Chrome 138: unchanged scope (the Lab is 2D), re-run for evidence.

## DONE WHEN

- `python scripts/check-codequest-lab-ui.py` green at both sizes; `scripts/check-android8-ui.py` green on Chrome 138.
- `node scripts/check.mjs` green.
