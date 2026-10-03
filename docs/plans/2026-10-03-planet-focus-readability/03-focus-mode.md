# Slice 03 — Focus mode with an attached prompt (D3–D8)

**Goal:** A tapped place, game toy or moon becomes the clear subject of the screen: dimmed scene, 2× sprite, prompt attached to it, and an obvious way to go.
**Depends on:** slice 01 (positions use `scale`).

**Changes:**
- `js/world/world-explorer.js`:
  - `focus` state: `{item, t}` plus a `dim` level that eases toward 0 or 1.
  - Composite draws the dim layer, then `drawFocus()`: shadow, white silhouette outline, sprite at the popped scale.
  - `placeCard()` positions the card each frame.
  - Pointer-down outside the focused sprite exits focus and swallows that tap. A second tap on the sprite launches.
  - A successful launch clears focus. Startup no longer restores the selection.
- `css/world-explorer.css`: `.world-selection.is-anchored` with a tail (`--tail-x`, `.is-above`), the hint row, the GO pulse, the 👆 bounce, `.world-shell.is-focus .world-hint` hidden, and reduced-motion overrides.
- `index.html`: hint element in the card; GO label "GO 出發 →".

**DONE WHEN:**
- `node scripts/check.mjs` is green.
- `scripts/check-world-explorer-ui.py` passes; the mini-game path still docks the card.
- Browser check: tap a place to enter focus (card anchored near the sprite, dim on). Tap empty space to exit focus with no rain or shooting star from that tap. Tap the sprite twice and the content opens. Return from the content and the planet is unfocused.
