# Slice 06 — Reference sheet, building together, Android 8, Papa's look

**Design:** [design.md](design.md) M9, M11. **Depends on:** 01–05.

## What it does
- **Pose sheet for Papa** (`scripts/check-brick-lab-ui.py`, like the parts sheet): every minifigure in Stand, Sit, Wave and Cheer, every animal in each of its poses, every machine at rest and open, in one picture, `pose-sheet.png`.
- **Two pretend tablets** (the harness's `WIFI` loopback fixture):
  - Lili's tablet poses a figure (Wave) and sits another on a chair.
  - The host tablet sees both poses and the sitter's new spot.
  - Lili's Undo takes her pose back on both tablets.
  - A tablet saying `proto: 3` is refused with "Update the app on both tablets · 兩台平板都要更新".
  - Play on one tablet sends nothing.
- **Reopen a posed world:** a world with a sitter, a waving figure, a posed dog and a half-open door is saved. The page is reloaded and the world reopened, and all four come back as they were.
- **Android 8:** `scripts/check-android8-ui.py` with Chrome 138. If it isn't installed: `npx @puppeteer/browsers install chrome@138`, then `--browser <its chrome.exe>`. It must pass in all four modes with Brick Lab drawing. Add a Play step to its Brick Lab visit: Play on, 2 s, Play off, no GL errors.
- **Cost reading:** the starter village plus 20 figures and 10 animals, Play on, on the reduced tier (`deviceMemory` 4) and on a standard profile. Record `render.calls`, `triangles` and drawn frames per second in this file's *As built*.
- **Papa's tablet look** (APK build, real fingers):
  1. Pose a figure in focus mode by tapping its arm, then sit it on a chair.
  2. Pose a dog.
  3. Press Play: are they alive and not frantic?
  4. Open the castle door with a tap.
  5. Build together with a second tablet and pose from each side.

**DONE WHEN:**
- `node scripts/check.mjs` is green.
- `check-brick-lab-ui.py` passes, including the together and reopen checks.
- `check-android8-ui.py` with Chrome 138 passes.
- Papa has looked at `pose-sheet.png` and at the app on a real tablet, and said what (if anything) to change.
