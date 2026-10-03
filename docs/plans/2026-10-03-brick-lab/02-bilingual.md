# Slice 02 — Bilingual pass + pre-reader mapping (D5)

**Depends on:** 01.

**Changes:** `js/brick-lab/brick-catalog.js` gains `zh` on parts, categories and colours; `brick-lab.js` routes every kid-facing string through a `[en, zh]` pair; pre-reader = `age <= 5`.

**DONE WHEN:** `check.mjs` green; no English-only kid-facing string left in `js/brick-lab/` (grep of the template and `setHint`/`toast` calls); Lucien's profile shows icon-first UI.
