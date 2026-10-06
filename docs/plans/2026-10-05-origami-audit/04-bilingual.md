# Slice 04 — Bilingual pass

**Approved by Papa, 2026-10-06** (audit N2). Implements design.md O6.

**Depends on:** none (independent of slices 01–03).

## Changes
- `js/vendor/origami-atelier/origami-atelier.js`
  - Library card: `~${n} min` → `t(\`~${n} min\`, \`約 ${n} 分鐘\`)`.
  - Colour buttons: `aria-label` uses the colour's 中文 in 中文 mode.
  - Language switch: `aria-label="${t("Language","語言")}"`.
  - Pass the diagram label into the engine (`t("Origami folding diagram","摺紙步驟圖")`).
- `js/vendor/origami-atelier/origami-engine.js` — the SVG `aria-label` comes from an option.
- `js/vendor/origami-atelier/origami-data.js`
  - `PAPER_COLORS` gets `labelZh`: sakura 櫻花粉, sky 天空藍, leaf 葉子綠, sun 陽光黃,
    violet 紫羅蘭, paper 白紙, ink 靛藍, matcha 抹茶綠.
  - Every 中文 step title / instruction / hint: 折 → 摺 where it means folding (104 → 341 uses of 摺).
    Text only; ids, diagrams, operations untouched.
- `scripts/check.mjs` — gate: no 折 in `origami-data.js` `zhHant` strings; every `PAPER_COLORS`
  entry has `labelZh`.
- `scripts/check-origami-ui.py` — in 中文 mode the library card shows 約 … 分鐘 and no "min".
- `sw.js` — bump `CACHE_NAME`.

**DONE WHEN:** `node scripts/check.mjs` green with the new gate; `python scripts/check-origami-ui.py`
passes.

**Shipped 2026-10-06.** 255 × 折 → 摺 in `origami-data.js` (every one was a folding verb: 對摺, 反摺,
往上摺, 摺到 …); `labelZh` on the 8 paper colours; "約 N 分鐘", 語言 and 摺紙步驟圖 in 中文. New
`check.mjs` gate (no 折 in any `zhHant` string, every colour has `labelZh`) — green;
`check-origami-ui.py` 55/55 with three new 中文 checks (library card, language switch label, diagram
label). Cache `v185-origami-zh`.
