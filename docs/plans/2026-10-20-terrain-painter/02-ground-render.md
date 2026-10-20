# 02: Draw the painted ground
**Depends on:** 01.
Colour each baseplate cell's studs and plate from `ground` (per-instance colour on slice 13's painting, plus cheap pattern accents for flowers / stone). Re-tint only the changed cells, and draw frames on demand only.
**DONE WHEN:** a seeded `ground` shows all 8 terrains in Chrome 138 on WebGL2 and on the r162 WebGL1 fallback; `scripts/check-android8-ui.py` passes; frame rate unchanged with no stroke going on.
