# Slice 01 — World-first navigation and waiting landmarks (D1–D6)

**Goal:** The planet is the kid's home. Base Camp is the one clear way into the full menu, every Back says where it goes, switching hero is a quiet log-out, and the planet shows what is waiting.
**Depends on:** pixel-planet slices 60–64 and planet-focus-readability slice 03 (focus mode, `focusOn`).

**Changes:**
- `index.html`:
  - World HUD: `#worldClassic` "⛺ Base Camp 營地" comes first in the DOM. The kid chip contains `#worldHeroes` "⇄ Switch 換人". New `#worldWaiting` chip.
  - `#hubBack` is always "← 🌍 Planet 星球". The dynamic Heroes/World label in `renderHub()` is gone.
  - `backLabel()` sets the labels on `#back`, `#actBack`, `#musicBack` and `#bookBack` when content opens.
  - `summerQuestBack()`: Back from Base Camp calls `openWorld(hubKid)`. Back on the planet returns `worldExplorerModule.back()` and never goes Home.
  - `worldAttention()` sets `entry.attention` in the registry `list()`. `renderWorldWaiting()` updates the chip. `refreshWorldAttention()` is coalesced and called from `refreshLockUI()` (every store change passes through it) and `updateRewardBadge()`.
  - "Classic" copy becomes "Base Camp 營地".
- `js/content-registry.js`: `cloneEntry` passes `attention` through, as `[en, zh]` or `null`.
- `js/world/world-explorer.js`: `waiting()`, the yellow `BUBBLE` sprite, `drawAttention()`, rim bubbles computed in `layout()`, `hitAt()` returns `{kind:"rim"}`, `flyTo()` with `pendingFocus` resolved when the spin ends, and `nextAttention()`. Sparkle ambient on waiting places. New `refresh` and `nextAttention` exports. `snapshot().landmarks[]` gains `waiting` and `rim`.
- `css/world-explorer.css`: Base Camp primary button, quiet `.world-switch`, `.world-waiting` chip with glow, explicit grid placement, and phone layout (labels stay bilingual; the chip shrinks to "✨ N", the switch to "⇄").
- `sw.js`: `CACHE_NAME` bumped.
- `scripts/world-explorer.test.mjs`: contract tests for D2–D5.

**DONE WHEN:**
- `node scripts/check.mjs` is green.
- `scripts/check-world-explorer-ui.py` passes (16/16).
- `scripts/check-desktop-history.py` gets as far as it did before this slice. The step that clicks `#summerCompanion` (line 129) failed on the baseline too: the button's pulse never settles.
- Browser check (verified 2026-10-03, 1280×800 and 600×900):
  - Pick a hero and the planet opens. Base Camp opens the hub; its Back reads "← 🌍 Planet 星球" and returns to the planet.
  - A book opened from the planet shows "← 🌍 Planet 星球" and returns there.
  - Back on the planet returns `false` and the planet stays put.
  - The quests and games landmarks show "!" bubbles. The chip reads "✨ 2 waiting · 2 件事在等你" and focuses the quests landmark with "✨ 4 quests for today / 任務 · 今天還有 4 個任務".
  - After spinning the games landmark to the far side, its bubble sits on the rim. Tapping it spins the planet there and focuses the landmark.
