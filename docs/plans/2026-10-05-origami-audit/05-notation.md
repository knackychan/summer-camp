# Slice 05 — Valley and mountain look different

**Approved by Papa, 2026-10-06** (audit I1). Implements design.md O7.

**Depends on:** slices 01–02 (mountain flap behind, reopened crease).

## Changes
- `js/vendor/origami-atelier/origami-engine.js` — the crease and arrow read `step.operation`:
  - valley: dashed crease (`8 6`), full filled arrowhead;
  - mountain: dash-dot crease (`8 4 2 4`), half arrowhead (one barb);
  - precrease: dashed while folding, thin solid crease after reopening;
  - flip: a looped turn-over arrow in the diagram's corner; rotate: a circular arrow there.
  - `parts` reports which of these the step shows.
- `js/vendor/origami-atelier/origami-atelier.js` — the legend lists only the step's parts, each with
  its symbol and one line:
  - Valley fold — fold toward you, the paper makes a V / 谷摺：往自己這邊摺，紙會變成 V 字
  - Mountain fold — fold away from you, the paper makes a ^ / 山摺：往後面摺，紙會像一座山
  - Turn the paper over / 把紙翻到背面
  - Turn the paper around / 把紙轉個方向
  - Fold, press, then open again / 摺好、壓一壓，再打開
  The legend must still fit the frame (origami-lesson D1): one line per entry, clamped.
- `js/vendor/origami-atelier/origami-data.js` — operation tags only, where the text says "backward":
  Cat Face 06, Swimming Fish 07, Paper Heart 07, Tulip 04, 05, 06: `valley-fold` → `mountain-fold`.
- `js/vendor/origami-atelier/origami-atelier.css` — legend symbols.
- `scripts/check.mjs` — gate: a step whose EN instruction says "backward" or "behind" is not tagged
  `valley-fold` (allow-list: Samurai Helmet 04–05 "back up", Swan 09 "back point", Water Bomb 06
  "on the back").
- `scripts/check-origami-ui.py` — Cat Face 06 shows the dash-dot crease and the mountain legend;
  Little Fox 01 shows the dashed crease and the valley legend; Swimming Fish 06 shows the flip
  symbol; no scroll at the three frame sizes with the longest legend.
- `sw.js` — bump `CACHE_NAME`.

**DONE WHEN:** `node scripts/check.mjs` green with the new gate; `python scripts/check-origami-ui.py`
passes.

**Shipped 2026-10-06.** Engine: `notationFor()` per operation; valley 8 6 dashes and a filled
arrowhead, mountain 9 4 2 4 dash-dot and a hollow half arrowhead, precrease dashes that turn into a
thin solid `oa-crease-mark` once reopened, flip / rotate symbols top-right; `parts.notation`. The
legend shows one symbol + meaning (EN + 中文) and hides the plain fold-line / arrow chips; other
operations keep those chips. Data: the six tags listed above. `check.mjs` gate green;
`check-origami-ui.py` 62/62 (new: Little Fox 1 valley, Cat Face 6 mountain with the flap behind,
Swimming Fish 6 flip symbol, Cat Face 6 legend 山摺 in the real lesson, the mountain legend fits at
all three sizes). Cache `v187-origami-notation` (v186 went to Code Quest meanwhile).
