# Slice 03 — Creative-tool door (D4)

**Depends on:** 01.

**Changes:** `index.html` — add `"bricklab"` to `CREATIVE_TOOLS` (the `isCreativeTool` helper the Origami work introduced; keep it below `gameLaunchAccess`, the registry test slices index.html there). `scripts/content-registry.test.mjs` — `bricklab` joins the lock-exception loop.

**DONE WHEN:** `check.mjs` green; `scripts/check-brick-lab-ui.py`: Brick Lab available while the Brain Gym gate is closed and under the Games category lock; a Papa app pause blocks it.
